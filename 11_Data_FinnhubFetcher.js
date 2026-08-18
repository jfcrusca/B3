/**
 * 11_Data_FinnhubFetcher.js — Provedor de Dados Finnhub (v1.1)
 * =============================================================================
 * ✅ Fonte terciária de histórico OHLCV real (60 req/min no free tier)
 * ✅ Fallback quando BRAPI e Alpha Vantage falharem
 * ✅ Cache de 30 min para histórico, 5 min para cotações
 * ✅ Sem chaves hardcoded (chaves expostas publicamente → revogadas → HTTP 403)
 * ✅ Tratamento específico para HTTP 403 (abre circuit breaker imediatamente)
 * =============================================================================
 */

var FinnhubFetcher = (function() {
  'use strict';

  const API_BASE_URL = 'https://finnhub.io/api/v1';
  const CACHE_TTL_HISTORY = 1800; // 30 min
  const CACHE_TTL_QUOTE = 300;    // 5 min
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 1000;
  
  // 🚀 NOVO: Circuit breaker para Finnhub (evita chamadas repetidas quando API retorna 403)
  var _circuitBreaker = {
    failures: 0,
    maxFailures: 3,
    isOpen: false,
    lastFailureTime: 0,
    cooldownMs: 300000 // 5 min de cooldown
  };
  
  // BDR tickers que a Finnhub nunca tem dados (evita chamadas desperdiçadas)
  var _bdrPattern = /^\w{4}(33|34|35|36|37|38|39)$/;

  function _getApiKey() {
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
    
    console.warn('⚠️ [Finnhub] FINNHUB_API_KEY/FINNHUB_KEY não configurada. Finnhub será ignorado (fallback para BRAPI/Yahoo).');
    return null;
  }


  function _fetchWithRetry(url, ttl) {
    // 🚀 Circuit breaker check
    if (_circuitBreaker.isOpen) {
      var elapsed = Date.now() - _circuitBreaker.lastFailureTime;
      if (elapsed < _circuitBreaker.cooldownMs) {
        console.warn('⏭️ [Finnhub] Circuit breaker ABERTO. Pulando requisição (cooldown: ' + Math.round((_circuitBreaker.cooldownMs - elapsed)/1000) + 's).');
        return null;
      } else {
        // Tenta resetar após cooldown
        console.log('🔄 [Finnhub] Circuit breaker resetado após cooldown.');
        _circuitBreaker.isOpen = false;
        _circuitBreaker.failures = 0;
      }
    }

    const apiKey = _getApiKey();
    if (!apiKey) {
      console.error("❌ Finnhub: FINNHUB_API_KEY ausente.");
      return null;
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = 'finnhub_' + url;
    const cached = cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) { /* ignore */ }
    }

    const finalUrl = url + (url.includes('?') ? '&' : '?') + 'token=' + apiKey;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = UrlFetchApp.fetch(finalUrl, { 
          muteHttpExceptions: true,
          connectTimeout: 15000,
          readTimeout: 15000
        });
        const code = response.getResponseCode();
        
        if (code === 200) {
          const data = JSON.parse(response.getContentText());
          // Finnhub retorna vazio como {} ou { count: 0 }
          if (data && Object.keys(data).length > 0 && data.count !== 0) {
            // Sucesso → reseta circuit breaker
            _circuitBreaker.failures = 0;
            try { cache.put(cacheKey, JSON.stringify(data), ttl); } catch(e) {}
            return data;
          }
          return null;
        } else if (code === 429) {
          console.warn(`⚠️ Finnhub rate limit (429), tentativa ${attempt}/${MAX_RETRIES}`);
          if (attempt < MAX_RETRIES) Utilities.sleep(RETRY_DELAY_MS * attempt * 2);
          continue;
        } else if (code === 403) {
          // ❌ Chave inválida/revogada — Finnhub revoga chaves expostas publicamente.
          // Abre circuit breaker imediatamente (não adianta tentar de novo).
          _circuitBreaker.isOpen = true;
          _circuitBreaker.lastFailureTime = Date.now();
          console.error('🚨 [Finnhub] HTTP 403 — Chave de API inválida ou revogada. Configure FINNHUB_API_KEY válida nas Script Properties. Finnhub desativado por 5 min.');
          return null;
        } else {
          // Erro HTTP (404, 500, etc.) → incrementa circuit breaker
          _circuitBreaker.failures++;
          _circuitBreaker.lastFailureTime = Date.now();
          if (_circuitBreaker.failures >= _circuitBreaker.maxFailures) {
            _circuitBreaker.isOpen = true;
            console.error('🚨 [Finnhub] Circuit breaker ATIVADO após ' + _circuitBreaker.failures + ' falhas HTTP seguidas.');
          }
          console.warn(`⚠️ Finnhub HTTP ${code}`);
          return null;
        }
      } catch (e) {
        console.warn(`⚠️ Finnhub fetch error (tentativa ${attempt}): ${e.message}`);
        if (attempt < MAX_RETRIES) Utilities.sleep(RETRY_DELAY_MS * attempt);
      }
    }
    return null;
  }
  
  /**
   * 🚀 NOVO: Verifica se Finnhub provavelmente não tem dados para este ticker
   * (BDRs e ativos internacionais normalmente não existem na Finnhub)
   */
  function isTickerSkippable(ticker) {
    if (!ticker) return true;
    var upper = ticker.toUpperCase().trim();
    // BDRs (terminação 33,34,35,36,37,38,39)
    if (_bdrPattern.test(upper)) return true;
    // ETFs internacionais
    if (/^(IVVB|BOVA|SMAL|XINA|NASD|SPXI|HASH|BITH|QDFI|ECOO|GOLD|ISPU|EURP|ACWI|WRLD|BIOM|FIND|DIVO|PIBB)\d*/.test(upper)) return true;
    return false;
  }

  /**
   * Busca histórico de preços (OHLCV) para um ticker.
   * Finnhub usa formato americano (ex: AAPL, MSFT) ou internacional com sufixo
   * Para B3: usar "PETR4.SA" (formato Yahoo)
   * @param {string} ticker - Ex: "PETR4", "VALE3"
   * @param {string} resolution - 'D' (daily), 'W' (weekly), 'M' (monthly), '60' (60min)
   * @param {number} count - número de candles (max 5000)
   */
  function getHistory(ticker, resolution, count) {
    if (!ticker) return null;
    
    resolution = resolution || 'D';
    count = count || 120; // ~6 meses de dados diários

    // Finnhub espera formato "PETR4.SA" para B3
    const cleanTicker = ticker.toUpperCase().trim().replace(/\.SA$/, '') + '.SA';
    
    // Timestamps em segundos (Unix)
    const to = Math.floor(Date.now() / 1000);
    const from = to - (count * 86400); // count dias atrás

    const url = `${API_BASE_URL}/stock/candle?symbol=${cleanTicker}&resolution=${resolution}&from=${from}&to=${to}`;
    const data = _fetchWithRetry(url, CACHE_TTL_HISTORY);
    
    if (!data || data.s === 'no_data' || !data.c || !Array.isArray(data.c)) {
      return null;
    }

    const candles = [];
    for (let i = 0; i < data.c.length; i++) {
      if (data.c[i] === null || data.c[i] === undefined) continue;
      candles.push({
        date: new Date(data.t[i] * 1000),
        open: data.o[i] || data.c[i],
        high: data.h[i] || data.c[i],
        low: data.l[i] || data.c[i],
        close: data.c[i],
        volume: data.v[i] || 0,
        ticker: ticker
      });
    }

    if (candles.length < 10) return null;
    
    console.log(`📡 [Finnhub] ${ticker}: ${candles.length} candles obtidos`);
    return candles;
  }

  /**
   * Busca cotação atual de um ticker.
   */
  function getQuote(ticker) {
    if (!ticker) return null;
    
    const cleanTicker = ticker.toUpperCase().trim().replace(/\.SA$/, '') + '.SA';
    const url = `${API_BASE_URL}/quote?symbol=${cleanTicker}`;
    const data = _fetchWithRetry(url, CACHE_TTL_QUOTE);
    
    if (!data || data.c === 0 || data.c === undefined) return null;

    return {
      price: data.c,
      change: data.dp || 0,
      volume: data.v || 0,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      timestamp: new Date(data.t * 1000),
      source: 'finnhub'
    };
  }

  /**
   * Busca cotações em lote (chamadas individuais, sem batch endpoint).
   */
  function getQuoteBatch(tickers) {
    const results = {};
    if (!Array.isArray(tickers)) return results;
    
    tickers.forEach(ticker => {
      const quote = getQuote(ticker);
      if (quote) {
        results[ticker] = quote;
      }
    });
    return results;
  }

  return {
    getHistory: getHistory,
    getQuote: getQuote,
    getQuoteBatch: getQuoteBatch
  };
})();