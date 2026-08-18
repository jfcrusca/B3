// 26_Data_BrapiFetcher.js – v3.2 OTIMIZADO: Timeout reduzido, cache de falhas, retry rápido
var BrapiFetcher = (function() {
  'use strict';

  const CACHE_TTL = 1800;              // 30 min para histórico
  const BATCH_CACHE_TTL = 300;         // 5 min para cotações em lote
  const MIN_INTERVAL_MS = 500;         // 🔧 REDUZIDO: 500ms entre chamadas (era 800ms)
  const MAX_RETRIES = 1;               // 🔧 REDUZIDO: apenas 1 retry (total 2 tentativas)
  const FETCH_TIMEOUT_MS = 8000;       // 🔧 NOVO: Timeout reduzido de 15s para 8s
  const CHAMADA_TIMEOUT_MS = 12000;    // 🔧 NOVO: Timeout total por chamada (incluindo retries)
  const FAILURE_CACHE_TTL_MS = 300000; // 🔧 NOVO: 5 min de cache de falha

  var _lastRequestTime = 0;
  var _failureCache = {};              // 🔧 NOVO: Cache de falhas em memória

  function _getToken() {
    if (typeof Secrets !== 'undefined') {
      var token = Secrets.getSecret('BRAPI_TOKEN');
      if (token) return token;
    }
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') ? CONFIG.getSecret('BRAPI_TOKEN') : null;
  }

  function _waitIfNeeded() {
    var now = Date.now();
    var elapsed = now - _lastRequestTime;
    if (elapsed < MIN_INTERVAL_MS) {
      Utilities.sleep(MIN_INTERVAL_MS - elapsed);
    }
    _lastRequestTime = Date.now();
  }

  /**
   * 🔧 NOVO: Verifica cache de falhas para evitar retentar APIs que estão fora
   */
  function _isFailureCached(ticker) {
    var key = 'brapi_fail_' + ticker;
    if (_failureCache[key] && (Date.now() - _failureCache[key]) < FAILURE_CACHE_TTL_MS) {
      return true;
    }
    return false;
  }

  function _markFailure(ticker) {
    _failureCache['brapi_fail_' + ticker] = Date.now();
  }

  function _clearFailure(ticker) {
    delete _failureCache['brapi_fail_' + ticker];
  }

  /**
   * Busca histórico de preços OHLCV para um ticker via BRAPI.
   * ⚡ OTIMIZADO: Timeout global de 12s, retry rápido, cache de falhas
   */
  function fetchHistory(ticker) {
    if (!ticker) return null;

    var token = _getToken();
    if (!token) {
      console.error('❌ BRAPI_TOKEN não configurado');
      return null;
    }

    var cleanTicker = ticker.toUpperCase().trim().replace(/\.SA$/, '').replace(/^\^/, '');

    // 🔧 Cache de falhas: se falhou recentemente, nem tenta
    if (_isFailureCached(cleanTicker)) {
      console.warn('⏭️ [Brapi] Pulando ' + cleanTicker + ' (falha recente em cache)');
      return null;
    }

    var url = 'https://brapi.dev/api/quote/' + cleanTicker + '?range=3mo&interval=1d&history=true&token=' + token;
    var cacheKey = 'brapi_hist_' + cleanTicker;

    // Tenta cache persistente primeiro
    var cache = CacheService.getScriptCache();
    try {
      var cached = cache.get(cacheKey);
      if (cached) {
        var cachedData = JSON.parse(cached);
        if (cachedData && cachedData.results && cachedData.results[0] && 
            cachedData.results[0].historicalDataPrice && 
            cachedData.results[0].historicalDataPrice.length >= 10) {
          return cachedData.results[0].historicalDataPrice.map(function(h) {
            return {
              date: new Date(h.date * 1000),
              open: h.open,
              high: h.high || h.close,
              low: h.low || h.close,
              close: h.close,
              volume: h.volume || 0,
              ticker: ticker
            };
          });
        }
      }
    } catch (e) { /* ignore cache read errors */ }

    // 🔧 Timeout global por chamada
    var inicioChamada = Date.now();
    _waitIfNeeded();

    var tentativas = 0;
    var maxTentativas = MAX_RETRIES + 1; // 2 tentativas

    while (tentativas < maxTentativas && (Date.now() - inicioChamada) < CHAMADA_TIMEOUT_MS) {
      tentativas++;
      try {
        var response = UrlFetchApp.fetch(url, { 
          muteHttpExceptions: true,
          connectTimeout: FETCH_TIMEOUT_MS,
          readTimeout: FETCH_TIMEOUT_MS 
        });
        var code = response.getResponseCode();

        if (code === 200) {
          var data = JSON.parse(response.getContentText());
          if (data && data.results && data.results[0] && data.results[0].historicalDataPrice) {
            try { cache.put(cacheKey, JSON.stringify(data), CACHE_TTL); } catch(e) {}
            _clearFailure(cleanTicker);

            return data.results[0].historicalDataPrice.map(function(h) {
              return {
                date: new Date(h.date * 1000),
                open: h.open,
                high: h.high || h.close,
                low: h.low || h.close,
                close: h.close,
                volume: h.volume || 0,
                ticker: ticker
              };
            });
          }
          // 200 sem histórico = falha rápida
          console.warn('⚠️ BRAPI 200 sem histórico para ' + cleanTicker);
          _markFailure(cleanTicker);
          return null;
        } else if (code === 429) {
          if ((Date.now() - inicioChamada) < CHAMADA_TIMEOUT_MS) {
            console.warn('⚠️ BRAPI rate limit (429) ' + cleanTicker + ', tentativa ' + tentativas + '/' + maxTentativas);
            Utilities.sleep(1000);
            continue;
          }
          break;
        } else if (code === 502 || code === 504) {
          if (tentativas < maxTentativas && (Date.now() - inicioChamada) < CHAMADA_TIMEOUT_MS) {
            var backoff = tentativas * 500; // 500ms, 1000ms
            console.warn('⚠️ BRAPI HTTP ' + code + ' ' + cleanTicker + ' — tentativa ' + tentativas + '/' + maxTentativas + ' em ' + backoff + 'ms');
            Utilities.sleep(backoff);
            continue;
          }
          console.error('❌ BRAPI HTTP ' + code + ' persistente para ' + cleanTicker + ' apos ' + tentativas + ' tentativas');
          _markFailure(cleanTicker);
          return null;
        } else {
          console.warn('⚠️ BRAPI HTTP ' + code + ' para ' + cleanTicker);
          _markFailure(cleanTicker);
          return null;
        }
      } catch (e) {
        console.warn('⚠️ Erro fetch BRAPI ' + cleanTicker + ' (tentativa ' + tentativas + '): ' + e.message);
        if (tentativas < maxTentativas && (Date.now() - inicioChamada) < CHAMADA_TIMEOUT_MS) {
          Utilities.sleep(500);
          continue;
        }
      }
    }

    // Todas as tentativas falharam
    _markFailure(cleanTicker);
    console.warn('❌ Falha ao obter historico para ' + ticker + ' (BRAPI) apos ' + tentativas + ' tentativas em ' + Math.round((Date.now()-inicioChamada)/1000) + 's');
    return null;
  }

  /**
   * Obtém cotações em lote (1 requisição por ticker no plano gratuito)
   */
  function getQuoteBatch(tickers) {
    var token = _getToken();
    if (!token) return {};

    var cleanTickers = [];
    var seen = {};
    for (var i = 0; i < tickers.length; i++) {
      var t = tickers[i].toUpperCase().trim().replace(/\.SA$/, '');
      if (!seen[t]) {
        seen[t] = true;
        cleanTickers.push(t);
      }
    }

    var results = {};

    for (var j = 0; j < cleanTickers.length; j++) {
      var t = cleanTickers[j];
      var individualUrl = 'https://brapi.dev/api/quote/' + t + '?token=' + token;
      var individualKey = 'brapi_batch_' + t;

      // Usa cache de falhas também para cotações
      if (_isFailureCached(t)) {
        console.warn('⏭️ [Brapi] Pulando cotacao ' + t + ' (falha recente)');
        continue;
      }

      try {
        _waitIfNeeded();
        var response = UrlFetchApp.fetch(individualUrl, { 
          muteHttpExceptions: true,
          connectTimeout: FETCH_TIMEOUT_MS,
          readTimeout: FETCH_TIMEOUT_MS 
        });

        if (response.getResponseCode() === 200) {
          var individualData = JSON.parse(response.getContentText());
          if (individualData && individualData.results && individualData.results[0]) {
            var quote = individualData.results[0];
            var originalTicker = null;
            for (var k = 0; k < tickers.length; k++) {
              if (tickers[k].replace(/\.SA$/, '').toUpperCase() === quote.symbol) {
                originalTicker = tickers[k];
                break;
              }
            }
            if (originalTicker && quote.regularMarketPrice) {
              results[originalTicker] = {
                price: quote.regularMarketPrice,
                change: quote.regularMarketChangePercent || 0,
                volume: quote.volume || 0,
                source: 'brapi'
              };
              _clearFailure(t);
            }
          }
        } else {
          _markFailure(t);
          console.warn('❌ BRAPI falhou para ' + t + ' HTTP ' + response.getResponseCode());
        }
      } catch (e) {
        _markFailure(t);
        console.warn('⚠️ BRAPI erro para ' + t + ': ' + e.message);
      }
    }

    return results;
  }

  return {
    fetchHistory: fetchHistory,
    getQuoteBatch: getQuoteBatch
  };
})();

function TESTAR_TICKER_BRAPI(ticker) {
  var token = (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') ? CONFIG.getSecret('BRAPI_TOKEN') : null;
  var url = 'https://brapi.dev/api/quote/' + ticker + '?range=3mo&interval=1d&history=true&token=' + token;
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  console.log(ticker + ': HTTP ' + response.getResponseCode());
  if (response.getResponseCode() === 200) {
    var json = JSON.parse(response.getContentText());
    var hist = json.results && json.results[0] ? json.results[0].historicalDataPrice : null;
    console.log('   Historico: ' + (hist ? hist.length : 0) + ' candles');
  } else {
    console.log('   Erro: ' + response.getContentText().substring(0, 200));
  }
}
