/**
 * 05_Data_Service.gs — CAMADA DE DADOS UNIFICADA (v13.1 - OTIMIZADA)
 * =============================================================================
 * ✅ PRIORIDADE 1: BRAPI como fonte principal de histórico
 * ✅ PRIORIDADE 2: Alpha Vantage como fallback de histórico real
 * ✅ PRIORIDADE 3: Finnhub como fallback de histórico real (60 req/min)
 * ✅ PRIORIDADE 4: HG Brasil (candles sintéticos com variação realista)
 * ✅ MACRO: BCB/Ipeadata para dados macroeconômicos oficiais
 * ✅ OTIMIZADO: Cache duplo (memória + CacheService) e circuit breaker
 * ✅ OTIMIZADO v2: Timeout por ticker (25s), cache de falhas, negative caching
 * =============================================================================
 */

var DataService = (function () {
  'use strict';

  var MIN_CANDLES = 18;              // mínimo de candles para análise técnica
  var CACHE_TTL   = 600;             // 10 minutos de cache persistente
  var LOCAL_CACHE = {};              // cache por execução
  
  // 🔧 Timeout máximo por ticker para evitar travamento do pipeline
  var TICKER_TIMEOUT_MS = 25000;     // 25s no máximo por ticker (incluindo todos os fallbacks)
  
  // CIRCUIT BREAKER CONFIG
  var _circuitBreaker = {
    failures: 0,
    threshold: 3,                    // abre após 3 falhas seguidas da Brapi
    isOpen: false,
    lastFailureTime: 0
  };
  
  // 🔧 Cache de falhas para evitar retentar tickers problemáticos
  var _tickerFailureCache = {};
  var TICKER_FAILURE_TTL_MS = 300000; // 5 min

  function _getCacheService() {
    if (typeof CacheService !== 'undefined' && CacheService.getScriptCache) {
      return CacheService.getScriptCache();
    }
    return null;
  }

  function _normalizeCandles(rawCandles) {
    if (!rawCandles) return null;
    if (Array.isArray(rawCandles)) return rawCandles.filter(Boolean);
    if (rawCandles.candles && Array.isArray(rawCandles.candles)) {
      return rawCandles.candles.filter(Boolean);
    }
    return null;
  }

  function _hasMinimumCandles(candles) {
    return Array.isArray(candles) && candles.length >= MIN_CANDLES && candles.some(function (c) {
      return c && typeof c.close === 'number' && c.close > 0;
    });
  }

  function _hasPriceCandidate(candles) {
    return Array.isArray(candles) && candles.some(function (c) {
      return c && typeof c.close === 'number' && c.close > 0;
    });
  }

  function _getLastPrice(candles) {
    if (!Array.isArray(candles)) return null;
    for (var i = candles.length - 1; i >= 0; i--) {
      var candle = candles[i];
      if (candle && typeof candle.close === 'number' && candle.close > 0) {
        return candle.close;
      }
    }
    return null;
  }

  function _buildResult(ticker, candles, source) {
    var normalized = _normalizeCandles(candles);
    if (!normalized) return null;

    var result = normalized.slice();
    result.candles = normalized;
    result.price = _getLastPrice(normalized);
    result.ticker = ticker;
    result.source = source || 'UNKNOWN';
    return result;
  }

  function _tryBrapiHistory(ticker) {
    if (typeof BrapiFetcher !== 'undefined' && typeof BrapiFetcher.fetchHistory === 'function') {
      try {
        var data = BrapiFetcher.fetchHistory(ticker);
        if (data) return data;
        console.warn('⚠️ [DataService] Brapi retornou vazio para ' + ticker + '.');
      } catch (e) {
        console.warn('⚠️ [DataService] Erro BrapiFetcher para ' + ticker + ': ' + e.message);
      }
    }
    return null;
  }

  function _tryAlphaVantageHistory(ticker) {
    if (typeof AlphaVantageFetcher !== 'undefined' && typeof AlphaVantageFetcher.getHistory === 'function') {
      try {
        var data = AlphaVantageFetcher.getHistory(ticker, 'daily', 'compact');
        if (data && data.length >= 18) {
          console.log('📡 [DataService] Alpha Vantage forneceu ' + data.length + ' candles para ' + ticker);
          return data;
        }
      } catch (e) {
        console.warn('⚠️ [DataService] Alpha Vantage falhou para ' + ticker + ': ' + e.message);
      }
    }
    return null;
  }

  function _tryFinnhubHistory(ticker) {
    if (typeof FinnhubFetcher !== 'undefined' && typeof FinnhubFetcher.getHistory === 'function') {
      try {
        var data = FinnhubFetcher.getHistory(ticker, 'D', 120);
        if (data && data.length >= 18) {
          console.log('📡 [DataService] Finnhub forneceu ' + data.length + ' candles para ' + ticker);
          return data;
        }
      } catch (e) {
        console.warn('⚠️ [DataService] Finnhub falhou para ' + ticker + ': ' + e.message);
      }
    }
    return null;
  }

  function _tryRapidAPIYahooHistory(ticker, interval, range) {
    if (typeof RapidAPIYahooFetcher !== 'undefined' && typeof RapidAPIYahooFetcher.getHistory === 'function') {
      try {
        var data = RapidAPIYahooFetcher.getHistory(ticker, interval, range);
        if (data && data.length >= 18) {
          console.log('📡 [DataService] RapidAPI-Yahoo forneceu ' + data.length + ' candles para ' + ticker);
          return data;
        }
      } catch (e) {
        console.warn('⚠️ [DataService] RapidAPI-Yahoo falhou para ' + ticker + ': ' + e.message);
      }
    }
    return null;
  }

  // ⛔ REMOVIDO: _tryHGBrasilFallback — HG Brasil retorna candles sintéticos (artificiais)
  // que invalidam a análise técnica real. Mantemos HG Brasil apenas para cotações
  // atuais em getPrecosAtuaisEmLote (onde dados sintéticos são aceitáveis).
  // Histórico real é estritamente via BRAPI, Alpha Vantage, Finnhub ou RapidAPI Yahoo.

  // -------------------------------------------------------------------------
  // 1. OBTENÇÃO DE DADOS HISTÓRICOS (OHLCV) — OTIMIZADO v2
  // -------------------------------------------------------------------------
  function getMarketData(ticker, interval, range) {
    interval = interval || '1d';
    range = range || '6mo';
    var cacheKey = 'DS_' + ticker + '_' + interval + '_' + range;

    // Cache em memória (execução atual)
    if (LOCAL_CACHE[cacheKey]) {
      return LOCAL_CACHE[cacheKey];
    }

    // 🔧 Cache de falhas por ticker (evita retentar APIs que estão fora)
    if (_tickerFailureCache[ticker] && (Date.now() - _tickerFailureCache[ticker]) < TICKER_FAILURE_TTL_MS) {
      console.warn('⏭️ [DataService] Pulando ' + ticker + ' (falha recente em cache)');
      return null;
    }

    // Cache persistente (CacheService)
    var cacheService = _getCacheService();
    if (cacheService) {
      try {
        var cached = cacheService.get(cacheKey);
        if (cached) {
          var parsed = JSON.parse(cached);
          var normalized = _normalizeCandles(parsed);
          if (_hasMinimumCandles(normalized)) {
            var cachedResult = _buildResult(ticker, normalized, 'CACHE');
            LOCAL_CACHE[cacheKey] = cachedResult;
            return cachedResult;
          }
        }
      } catch (e) { /* ignore parse error */ }
    }

    // 🔧 Timeout global por ticker para evitar travamento do pipeline
    var inicioTicker = Date.now();

    // PRIORIDADE: BRAPI
    if (!_circuitBreaker.isOpen) {
      var candles = _normalizeCandles(_tryBrapiHistory(ticker));
      if (_hasMinimumCandles(candles)) {
        _circuitBreaker.failures = 0;
        var result = _buildResult(ticker, candles, 'BRAPI');
        if (result) {
          try {
            var dataStr = JSON.stringify(candles);
            if (dataStr.length < 90000 && cacheService) {
              cacheService.put(cacheKey, dataStr, CACHE_TTL);
            }
          } catch (e) { /* cache write não crítico */ }
          LOCAL_CACHE[cacheKey] = result;
          return result;
        }
      } else {
        _circuitBreaker.failures++;
        if (_circuitBreaker.failures >= _circuitBreaker.threshold) {
          _circuitBreaker.isOpen = true;
          _circuitBreaker.lastFailureTime = Date.now();
          console.error('🚨 [DataService] CIRCUIT BREAKER ATIVADO: Brapi falhou consecutivamente.');
        }
      }
    } else {
      console.warn('🚨 [DataService] Circuit Breaker ABERTO. Pulando Brapi para ' + ticker + ' e indo para fallbacks primarios.');
    }

    // 🔧 Verifica se ainda temos tempo para fallbacks (aumentado limite para não pular fallbacks se Brapi travar)
    if ((Date.now() - inicioTicker) >= TICKER_TIMEOUT_MS + 10000) {
      console.warn('⏱️ [DataService] Timeout severo apos BRAPI para ' + ticker + '. Pulando para proximo fallback.');
    }

    // FALLBACK 1: Alpha Vantage (histórico real, 5 req/min)
    var avCandles = _normalizeCandles(_tryAlphaVantageHistory(ticker));
    if (_hasMinimumCandles(avCandles)) {
      var result = _buildResult(ticker, avCandles, 'ALPHA_VANTAGE');
      if (result) {
        try {
          var dataStr = JSON.stringify(avCandles);
          if (dataStr.length < 90000 && cacheService) {
            cacheService.put(cacheKey, dataStr, CACHE_TTL);
          }
        } catch (e) { /* cache write não crítico */ }
        LOCAL_CACHE[cacheKey] = result;
        return result;
      }
    }

    // ⏱️ Timeout aumentado para garantir fallbacks reais antes de desistir
    if ((Date.now() - inicioTicker) >= TICKER_TIMEOUT_MS) {
      console.warn('⏱️ [DataService] Timeout apos Alpha Vantage para ' + ticker + '. Pulando Finnhub e Yahoo.');
      _tickerFailureCache[ticker] = Date.now();
      // ⛔ Sem fallback HG Brasil (candles sintéticos) — retorna null
      console.error('❌ [DataService] Todos os fallbacks reais exauridos para ' + ticker + '.');
      return null;
    }

    // FALLBACK 2: Finnhub (histórico real, 60 req/min)
    // ⏭️ Pula Finnhub para BDRs e ativos que sabemos que não existem lá
    var skipFinnhub = false;
    try {
      if (typeof FinnhubFetcher !== 'undefined' && typeof FinnhubFetcher.isTickerSkippable === 'function') {
        skipFinnhub = FinnhubFetcher.isTickerSkippable(ticker);
      }
    } catch(e) { /* fallback */ }
    
    var fhCandles = null;
    if (!skipFinnhub) {
      fhCandles = _normalizeCandles(_tryFinnhubHistory(ticker));
    } else {
      console.log('⏭️ [DataService] Pulando Finnhub para ' + ticker + ' (BDR/ETF internacional sem suporte).');
    }
    if (_hasMinimumCandles(fhCandles)) {
      var result = _buildResult(ticker, fhCandles, 'FINNHUB');
      if (result) {
        try {
          var dataStr = JSON.stringify(fhCandles);
          if (dataStr.length < 90000 && cacheService) {
            cacheService.put(cacheKey, dataStr, CACHE_TTL);
          }
        } catch (e) { /* cache write não crítico */ }
        LOCAL_CACHE[cacheKey] = result;
        return result;
      }
    }

    // FALLBACK 3: RapidAPI Yahoo
    var yhCandles = _normalizeCandles(_tryRapidAPIYahooHistory(ticker, interval, range));
    if (_hasMinimumCandles(yhCandles)) {
      var result = _buildResult(ticker, yhCandles, 'RAPIDAPI_YAHOO');
      if (result) {
        try {
          var dataStr = JSON.stringify(yhCandles);
          if (dataStr.length < 90000 && cacheService) {
            cacheService.put(cacheKey, dataStr, CACHE_TTL);
          }
        } catch (e) { /* cache write não crítico */ }
        LOCAL_CACHE[cacheKey] = result;
        return result;
      }
    }

    // ⛔ FALLBACK HG Brasil REMOVIDO: candles sintéticos inviabilizam análise técnica real
    // Se todos os fallbacks reais falharam, ticker não pode ser analisado tecnicamente
    _tickerFailureCache[ticker] = Date.now();
    console.error('❌ [DataService] Nenhum fallback real funcionou para ' + ticker + '. Dados insuficientes para análise técnica.');
    return null;
  }

  // -------------------------------------------------------------------------
  // 2. CONTEXTO DE MERCADO (IBOV + DÓLAR) – VALORES MOCK + MACRO
  // -------------------------------------------------------------------------
  function getMarketContext() {
    var regime = 'NEUTRAL';
    try {
      if (typeof MacroFetcher !== 'undefined' && typeof MacroFetcher.getMacroContext === 'function') {
        var macro = MacroFetcher.getMacroContext();
        if (macro && macro.regime) {
          regime = macro.regime;
        }
      }
    } catch (e) {
      console.warn('⚠️ MacroFetcher indisponivel, usando regime NEUTRAL');
    }

    var ibovClose = 125000;
    var ibovChange = 0;
    var dolarClose = 5.10;

    return {
      ibov: {
        close: ibovClose,
        change: ibovChange
      },
      dolar: {
        close: dolarClose
      },
      regime: regime,
      timestamp: new Date().toISOString()
    };
  }

  // -------------------------------------------------------------------------
  // 3. COTAÇÕES EM LOTE (PREÇOS ATUAIS)
  // -------------------------------------------------------------------------
  function getPrecosAtuaisEmLote(tickersArray) {
    if (!Array.isArray(tickersArray) || tickersArray.length === 0) return {};

    var resultado = {};

    // 1. Tenta obter o lote via BRAPI (Provedor Principal)
    if (typeof BrapiFetcher !== 'undefined' && typeof BrapiFetcher.getQuoteBatch === 'function') {
      try {
        var brapiBatch = BrapiFetcher.getQuoteBatch(tickersArray);
        if (brapiBatch && typeof brapiBatch === 'object') {
          Object.keys(brapiBatch).forEach(function (ticker) {
            var quote = brapiBatch[ticker];
            if (quote && quote.price !== undefined) {
              resultado[ticker] = quote;
            }
          });
        }
      } catch (e) {
        console.warn('⚠️ BrapiFetcher.getQuoteBatch falhou, tentando HG Brasil...');
      }
    }

    // 2. Tenta via RapidAPI-Yahoo para os ausentes
    var missingTickers = tickersArray.filter(function(t) { return !resultado[t] || resultado[t].price === undefined; });
    if (missingTickers.length > 0 && typeof RapidAPIYahooFetcher !== 'undefined' && typeof RapidAPIYahooFetcher.getQuoteBatch === 'function') {
      try {
        console.log('🔄 Fallback RapidAPI-Yahoo ativado para ' + missingTickers.length + ' ativos...');
        var yhBatch = RapidAPIYahooFetcher.getQuoteBatch(missingTickers);
        if (yhBatch && typeof yhBatch === 'object') {
          Object.keys(yhBatch).forEach(function (ticker) {
            var quote = yhBatch[ticker];
            if (quote && quote.price !== undefined) {
              resultado[ticker] = quote;
            }
          });
        }
      } catch (yhErr) {
        console.warn('⚠️ RapidAPIYahooFetcher.getQuoteBatch falhou:', yhErr.message);
      }
    }

    // 3. Se falhar ou faltar dados, tenta HG Brasil
    missingTickers = tickersArray.filter(function(t) { return !resultado[t] || resultado[t].price === undefined; });
    if (missingTickers.length > 0 && typeof HGBrasilFetcher !== 'undefined' && typeof HGBrasilFetcher.getQuoteBatch === 'function') {
      try {
        console.log('🔄 Fallback HG Brasil ativado para ' + missingTickers.length + ' ativos...');
        var hgBatch = HGBrasilFetcher.getQuoteBatch(missingTickers);
        if (hgBatch && typeof hgBatch === 'object') {
          Object.keys(hgBatch).forEach(function (ticker) {
            var quote = hgBatch[ticker];
            if (quote && quote.price !== undefined) {
              resultado[ticker] = quote;
            }
          });
        }
      } catch (hgErr) {
        console.warn('⚠️ HGBrasilFetcher.getQuoteBatch falhou:', hgErr.message);
      }
    }

    return resultado;
  }

  // -------------------------------------------------------------------------
  // 4. PREÇO AO VIVO (UNITÁRIO)
  // -------------------------------------------------------------------------
  function getPrecoAtual(ticker) {
    if (!ticker) return null;

    var tickerLimpo = ticker.replace(/\.SA$/i, '').toUpperCase();

    // 1. Tenta via BRAPI (Principal)
    try {
      var token = (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') ? CONFIG.getSecret('BRAPI_TOKEN') : null;
      if (token) {
        var url = 'https://brapi.dev/api/quote/' + tickerLimpo + '?token=' + token.trim();
        var response = UrlFetchApp.fetch(url, { 
          muteHttpExceptions: true,
          connectTimeout: 8000,
          readTimeout: 8000
        });

        if (response.getResponseCode() === 200) {
          var json = JSON.parse(response.getContentText());
          if (json.results && json.results[0] && json.results[0].regularMarketPrice) {
            var quote = json.results[0];
            return {
              price: quote.regularMarketPrice,
              timestamp: new Date(),
              source: 'BRAPI',
              ticker: ticker,
              pl: quote.priceEarnings,
              dy: quote.dividendYield,
              volume: quote.regularMarketVolume,
              change: quote.regularMarketChangePercent
            };
          }
        } else {
          console.warn('⚠️ BRAPI retornou HTTP ' + response.getResponseCode() + ' para ' + ticker);
        }
      }
    } catch (e) {
      console.warn('⚠️ Erro ao obter preco ao vivo via BRAPI para ' + ticker + ': ' + e.message);
    }

    // 2. Tenta via RapidAPI-Yahoo
    if (typeof RapidAPIYahooFetcher !== 'undefined' && typeof RapidAPIYahooFetcher.getQuoteBatch === 'function') {
      try {
        var yhBatch = RapidAPIYahooFetcher.getQuoteBatch([tickerLimpo]);
        if (yhBatch && yhBatch[tickerLimpo] && yhBatch[tickerLimpo].price !== undefined) {
          return {
            price: yhBatch[tickerLimpo].price,
            timestamp: new Date(),
            source: 'RapidAPI-Yahoo',
            ticker: ticker,
            change: yhBatch[tickerLimpo].change
          };
        }
      } catch (yhErr) {
        console.warn('⚠️ RapidAPIYahooFetcher.getQuoteBatch falhou para ' + ticker + ':', yhErr.message);
      }
    }

    // 3. Se falhar, tenta via HG Brasil
    if (typeof HGBrasilFetcher !== 'undefined' && typeof HGBrasilFetcher.getQuote === 'function') {
      try {
        var quote = HGBrasilFetcher.getQuote(tickerLimpo);
        if (quote && quote.price !== undefined) {
          return {
            price: quote.price,
            timestamp: new Date(),
            source: 'HGBrasil',
            ticker: ticker,
            change: quote.change,
            volume: quote.volume
          };
        }
      } catch (hgErr) {
        console.warn('⚠️ HGBrasilFetcher.getQuote falhou para ' + ticker + ':', hgErr.message);
      }
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // 5. FUNÇÕES DE COMPATIBILIDADE
  // -------------------------------------------------------------------------
  function obterDados(ticker, interval, range) {
    return getMarketData(ticker, interval, range);
  }

  // -------------------------------------------------------------------------
  // API PÚBLICA EXPORTADA
  // -------------------------------------------------------------------------
  return {
    getMarketData:         getMarketData,
    obterDados:            obterDados,
    getMarketContext:      getMarketContext,
    getPrecosAtuaisEmLote: getPrecosAtuaisEmLote,
    getPrecoAtual:         getPrecoAtual
  };
})();

// =============================================================================
// FUNÇÕES DE TESTE
// =============================================================================

function VERIFICAR_M1_FALLBACK() {
  var resultados = [];

  var metodos = ['getMarketData', 'getMarketContext', 'getPrecosAtuaisEmLote', 'getPrecoAtual'];
  metodos.forEach(function(m) {
    var ok = typeof DataService[m] === 'function';
    resultados.push((ok ? '✅' : '❌') + ' DataService.' + m);
  });

  var brapiOk = typeof BrapiFetcher !== 'undefined';
  resultados.push((brapiOk ? '✅' : '❌') + ' BrapiFetcher disponivel: ' + (brapiOk ? 'sim' : 'nao'));

  try {
    var data = DataService.getMarketData('PETR4');
    var ok = data && data.candles && data.candles.length >= 20;
    resultados.push((ok ? '✅' : '❌') + ' getMarketData PETR4: ' + (ok ? data.candles.length + ' candles' : 'falhou'));
  } catch(e) {
    resultados.push('❌ Teste PETR4 falhou: ' + e.message);
  }

  console.log('🔍 VERIFICAÇÃO DATASERVICE (BRAPI apenas)\n' + '='.repeat(50));
  resultados.forEach(function(r) { console.log(r); });
  console.log('='.repeat(50));

  try {
    var ui = SpreadsheetApp.getUi();
    ui.alert('✅ Verificacao DataService', resultados.join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    console.log('ℹ️ UI nao disponivel – resultados apenas no console.');
  }
}

function TESTAR_PRECO_AO_VIVO() {
  var preco = DataService.getPrecoAtual('PETR4');
  if (preco) {
    console.log('✅ Preco ao vivo PETR4: R$ ' + preco.price + ' (fonte: ' + preco.source + ')');
  } else {
    console.log('❌ Falha ao obter preco ao vivo.');
  }
}

function TESTAR_BRAPI() {
  var token = (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') ? CONFIG.getSecret('BRAPI_TOKEN') : null;
  if (!token) {
    console.log('❌ BRAPI_TOKEN nao configurado!');
    return;
  }
  var url = 'https://brapi.dev/api/quote/PETR4?token=' + token;
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() === 200) {
    var json = JSON.parse(response.getContentText());
    var quote = json.results[0];
    console.log('✅ BRAPI funcionando!');
    console.log('   Preco: R$ ' + quote.regularMarketPrice);
    console.log('   P/L: ' + quote.priceEarnings);
    console.log('   DY: ' + (quote.dividendYield * 100).toFixed(2) + '%');
  } else {
    console.log('❌ Falha: HTTP ' + response.getResponseCode());
  }
}
