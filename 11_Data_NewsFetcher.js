/**
 * 11_Data_NewsFetcher.js — Agregador de Notícias Financeiras (v1.1)
 * =============================================================================
 * ✅ Fonte primária: Google News RSS (100% gratuito, sem chave, funciona para B3)
 * ✅ Fallback: Finnhub Company News (requer FINNHUB_API_KEY nas Script Properties)
 * ✅ Sem chaves hardcoded (chaves expostas publicamente são revogadas → HTTP 403)
 * ✅ Cache de 60 min para evitar rate limits
 * ✅ Circuit breaker para Finnhub
 * =============================================================================
 */

var NewsFetcher = (function() {
  'use strict';

  const CACHE_TTL = 3600; // 60 min — notícias não mudam tão rápido
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 1000;
  const MAX_NEWS_PER_TICKER = 5;
  const MAX_CHARS_PER_NEWS = 300;

  // Circuit breaker para Finnhub News
  var _circuitBreaker = {
    failures: 0,
    maxFailures: 3,
    isOpen: false,
    lastFailureTime: 0,
    cooldownMs: 300000 // 5 min
  };

  /**
   * Obtém a chave da Finnhub (mesma lógica do FinnhubFetcher)
   * @returns {string|null} Chave da API ou null se não configurada
   */
  function _getFinnhubApiKey() {
    // ❌ Chave hardcoded REMOVIDA — Finnhub revoga chaves expostas em código público (HTTP 403).
    // ✅ Configure FINNHUB_API_KEY em: Script Properties, GCP Secret Manager ou aba "Configurações"

    if (typeof Secrets !== 'undefined') {
      try {
        var token = Secrets.getSecret('FINNHUB_API_KEY') || Secrets.getSecret('FINNHUB_KEY');
        if (token) return token;
      } catch(e) { /* fallback */ }
    }

    if (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') {
      try {
        var token = CONFIG.getSecret('FINNHUB_API_KEY') || CONFIG.getSecret('FINNHUB_KEY');
        if (token) return token;
      } catch(e) { /* fallback */ }
    }

    console.warn('⚠️ [NewsFetcher] FINNHUB_API_KEY não configurada. Usando apenas Google News.');
    return null;
  }

  /**
   * Converte ticker da B3 para formato Finnhub (ex: PETR4 → PETR4.SA)
   */
  function _toFinnhubSymbol(ticker) {
    if (!ticker) return null;
    var clean = ticker.toUpperCase().trim().replace(/\.SA$/, '');
    // Ignora BDRs e ETFs que a Finnhub não cobre
    if (/^\w{4}(33|34|35|36|37|38|39)$/.test(clean)) return null;
    if (/^(IVVB|BOVA|SMAL|XINA|NASD|SPXI|HASH|BITH|QDFI|ECOO|GOLD|ISPU|EURP|ACWI|WRLD|BIOM|FIND|DIVO|PIBB)\d*/.test(clean)) return null;
    return clean + '.SA';
  }

  /**
   * Busca notícias via Finnhub Company News
   * @param {string} ticker - Ex: "PETR4"
   * @returns {Array|null} Lista de notícias ou null
   */
  function _fetchFinnhubNews(ticker) {
    if (_circuitBreaker.isOpen) {
      var elapsed = Date.now() - _circuitBreaker.lastFailureTime;
      if (elapsed < _circuitBreaker.cooldownMs) {
        console.warn('⏭️ [NewsFetcher] Circuit breaker Finnhub ABERTO. Pulando...');
        return null;
      } else {
        _circuitBreaker.isOpen = false;
        _circuitBreaker.failures = 0;
      }
    }

    var symbol = _toFinnhubSymbol(ticker);
    if (!symbol) return null;

    var apiKey = _getFinnhubApiKey();
    if (!apiKey) return null;

    var cache = CacheService.getScriptCache();
    var cacheKey = 'news_finnhub_' + symbol;
    var cached = cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) { /* ignore */ }
    }

    var to = Math.floor(Date.now() / 1000);
    var from = to - (7 * 86400); // últimos 7 dias

    var url = 'https://finnhub.io/api/v1/company-news?symbol=' + symbol + 
              '&from=' + from + '&to=' + to + '&token=' + apiKey;

    for (var attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        var response = UrlFetchApp.fetch(url, {
          muteHttpExceptions: true,
          connectTimeout: 10000,
          readTimeout: 10000
        });
        var code = response.getResponseCode();

        if (code === 200) {
          var data = JSON.parse(response.getContentText());
          if (data && data.length > 0) {
            _circuitBreaker.failures = 0;
            try { cache.put(cacheKey, JSON.stringify(data), CACHE_TTL); } catch(e) {}
            return data;
          }
          // Sem notícias → cache negativo curto para não repetir chamadas
          try { cache.put(cacheKey, JSON.stringify([]), 1800); } catch(e) {}
          return [];
        } else if (code === 429) {
          console.warn('⚠️ [NewsFetcher] Finnhub rate limit (429), tentativa ' + attempt + '/' + MAX_RETRIES);
          if (attempt < MAX_RETRIES) Utilities.sleep(RETRY_DELAY_MS * attempt * 2);
        } else {
          _circuitBreaker.failures++;
          _circuitBreaker.lastFailureTime = Date.now();
          if (_circuitBreaker.failures >= _circuitBreaker.maxFailures) {
            _circuitBreaker.isOpen = true;
            console.error('🚨 [NewsFetcher] Circuit breaker ATIVADO após ' + _circuitBreaker.failures + ' falhas Finnhub.');
          }
          console.warn('⚠️ [NewsFetcher] Finnhub HTTP ' + code + ' para ' + ticker);
          return null;
        }
      } catch (e) {
        console.warn('⚠️ [NewsFetcher] Finnhub fetch error (' + ticker + '): ' + e.message);
        if (attempt < MAX_RETRIES) Utilities.sleep(RETRY_DELAY_MS * attempt);
      }
    }

    // Marca falha para circuit breaker
    _circuitBreaker.failures++;
    _circuitBreaker.lastFailureTime = Date.now();
    if (_circuitBreaker.failures >= _circuitBreaker.maxFailures) {
      _circuitBreaker.isOpen = true;
    }
    return null;
  }

  /**
   * Busca notícias via Google News RSS (100% gratuito, sem chave)
   * @param {string} ticker - Ex: "PETR4"
   * @returns {Array|null} Lista de notícias ou null
   */
  function _fetchGoogleNews(ticker) {
    if (!ticker) return null;

    var cache = CacheService.getScriptCache();
    var cacheKey = 'news_google_' + ticker.toUpperCase();
    var cached = cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) { /* ignore */ }
    }

    var query = encodeURIComponent(ticker.toUpperCase().replace(/\.SA$/, '') + ' (B3 OR bolsa OR ações OR "bolsa de valores") when:7d');
    var url = 'https://news.google.com/rss/search?q=' + query + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';

    try {
      var response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        connectTimeout: 10000,
        readTimeout: 10000
      });
      var code = response.getResponseCode();
      if (code !== 200) {
        console.warn('⚠️ [NewsFetcher] Google News HTTP ' + code + ' para ' + ticker);
        return null;
      }

      var xmlText = response.getContentText();

      // PARSER XML SIMPLES via regex (GAS não tem DOMParser)
      var items = [];
      var regex = /<item>([\s\S]*?)<\/item>/g;
      var match;
      while ((match = regex.exec(xmlText)) !== null && items.length < MAX_NEWS_PER_TICKER) {
        var itemXml = match[1];
        var titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
        var linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        var pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);

        if (titleMatch && titleMatch[1]) {
          var title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
          // Remove sufixo comum do Google News
          title = title.replace(/\s*-\s*[^-]{0,40}$/i, '').trim();

          if (title && title.toUpperCase() !== ticker.toUpperCase()) {
            items.push({
              title: title,
              link: linkMatch ? linkMatch[1] : '',
              date: pubDateMatch ? pubDateMatch[1] : new Date().toISOString(),
              source: 'google-news'
            });
          }
        }
      }

      if (items.length > 0) {
        try { cache.put(cacheKey, JSON.stringify(items), CACHE_TTL); } catch(e) {}
        return items;
      }

      // Cache negativo para evitar repetição
      try { cache.put(cacheKey, JSON.stringify([]), 1800); } catch(e) {}
      return [];
    } catch (e) {
      console.warn('⚠️ [NewsFetcher] Google News fetch error (' + ticker + '): ' + e.message);
      return null;
    }
  }

  /**
   * Busca notícias para um ticker (Google News primeiro, Finnhub como fallback)
   * @param {string} ticker - Ex: "PETR4"
   * @param {number} maxResults - Máximo de notícias (default 5)
   * @returns {Array} Lista de notícias [{title, link, date, source}, ...]
   */
  function getNewsForTicker(ticker, maxResults) {
    if (!ticker) return [];
    maxResults = maxResults || MAX_NEWS_PER_TICKER;

    try {
      // Tentativa 1: Google News RSS (grátis, sem chave, funciona para B3)
      var googleNews = _fetchGoogleNews(ticker);
      if (googleNews && googleNews.length > 0) {
        console.log('📰 [NewsFetcher] ' + ticker + ': ' + googleNews.length + ' notícias via Google News');
        return googleNews.slice(0, maxResults);
      }

      // Tentativa 2: Finnhub (estruturada, mas requer chave válida)
      var finnhubNews = _fetchFinnhubNews(ticker);
      if (finnhubNews && finnhubNews.length > 0) {
        var lista = finnhubNews.slice(0, maxResults).map(function(n) {
          var headline = (n.headline || '').substring(0, MAX_CHARS_PER_NEWS);
          return {
            title: headline,
            link: n.url || '',
            date: n.datetime ? new Date(n.datetime * 1000).toISOString() : '',
            source: 'finnhub'
          };
        });
        console.log('📰 [NewsFetcher] ' + ticker + ': ' + lista.length + ' notícias via Finnhub');
        return lista;
      }
    } catch (e) {
      console.error('❌ [NewsFetcher] Erro ao buscar notícias para ' + ticker + ': ' + e.message);
    }

    return [];
  }

  /**
   * Busca notícias para múltiplos tickers de uma vez
   * @param {Array} tickers - Lista de tickers
   * @param {number} maxResults - Máximo de notícias por ticker (default 3)
   * @returns {Object} Mapa {ticker: [noticias...]}
   */
  function getNewsForTickers(tickers, maxResults) {
    var result = {};
    if (!Array.isArray(tickers) || tickers.length === 0) return result;

    maxResults = maxResults || 3;

    tickers.forEach(function(ticker) {
      if (!ticker) return;
      var cache = CacheService.getScriptCache();
      var cacheKey = 'news_batch_' + ticker.toUpperCase();
      var cached = cache.get(cacheKey);
      if (cached) {
        try {
          result[ticker] = JSON.parse(cached);
          return;
        } catch(e) { /* ignore */ }
      }

      var news = getNewsForTicker(ticker, maxResults);
      result[ticker] = news;
      if (news.length > 0) {
        try { cache.put(cacheKey, JSON.stringify(news), CACHE_TTL); } catch(e) {}
      }
    });

    return result;
  }

  /**
   * Converte lista de notícias em texto resumido para o prompt da IA
   * @param {Array} newsArray - Lista de notícias [{title, ...}]
   * @returns {string} Texto concatenado
   */
  function toSummaryText(newsArray) {
    if (!Array.isArray(newsArray) || newsArray.length === 0) {
      return 'Sem alertas de notícias.';
    }
    return newsArray.map(function(n, i) {
      return (i + 1) + '. ' + (n.title || '') + (n.source ? ' [' + n.source + ']' : '');
    }).join(' | ');
  }

  /**
   * Busca notícias e retorna texto resumido para um ticker
   * @param {string} ticker - Ex: "PETR4"
   * @param {number} maxResults - Máximo de notícias
   * @returns {string} Texto resumido para o campo op.news
   */
  function getNewsSummary(ticker, maxResults) {
    var news = getNewsForTicker(ticker, maxResults);
    return toSummaryText(news);
  }

  return {
    getNewsForTicker: getNewsForTicker,
    getNewsForTickers: getNewsForTickers,
    getNewsSummary: getNewsSummary,
    toSummaryText: toSummaryText
  };

})();