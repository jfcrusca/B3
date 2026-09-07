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
  
  // CIRCUIT BREAKER CONFIG (v14.0 — por ticker, não global)
  // 🔧 CORREÇÃO: O circuit breaker global desligava BRAPI para todos os tickers
  // após 3 falhas. Agora cada ticker tem seu próprio breaker.
  var _circuitBreaker = {};  // ticker -> { failures, isOpen, lastFailureTime }
  var CB_THRESHOLD = 3;
  var CB_COOLDOWN_MS = 300000; // 5 min cooldown
  
  function _isCircuitOpen(ticker) {
    var cb = _circuitBreaker[ticker];
    if (!cb) return false;
    if (cb.isOpen) {
      if (Date.now() - cb.lastFailureTime > CB_COOLDOWN_MS) {
        cb.isOpen = false;
        cb.failures = 0;
        console.log('🔄 [DataService] Circuit breaker resetado para ' + ticker + ' após cooldown.');
        return false;
      }
      return true;
    }
    return false;
  }
  
  function _recordBrapiFailure(ticker) {
    if (!_circuitBreaker[ticker]) _circuitBreaker[ticker] = { failures: 0, isOpen: false, lastFailureTime: 0 };
    _circuitBreaker[ticker].failures++;
    _circuitBreaker[ticker].lastFailureTime = Date.now();
    if (_circuitBreaker[ticker].failures >= CB_THRESHOLD) {
      _circuitBreaker[ticker].isOpen = true;
      console.error('🚨 [DataService] CIRCUIT BREAKER ATIVADO para ' + ticker + ': Brapi falhou ' + _circuitBreaker[ticker].failures + ' vezes consecutivamente.');
    }
  }
  
  function _recordBrapiSuccess(ticker) {
    if (_circuitBreaker[ticker]) {
      _circuitBreaker[ticker].failures = 0;
      _circuitBreaker[ticker].isOpen = false;
    }
  }
  
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

  /**
   * 🔧 CORREÇÃO v15.1: Reescena a série de candles quando há evento corporativo
   * (split/desdobramento ou grupamento). Empresas como HAPV3 e ONCO3 passaram por
   * grupamentos que desatualizam as médias móveis, stops, alvos e pivô.
   * Quando o preço ao vivo (referência) divergir >15% do último close do candle,
   * escalamos a série inteira pelo fator (preçoVivo / ultimoClose), gerando candles
   * "ajustados" que mantêm o formato OHLCV e permitem cálculos técnicos corretos.
   * @param {Array} candles - Série de candles
   * @param {number} precoVivo - Cotação atual do ativo (fonte confiável: GoogleFinance)
   * @returns {Array} Série ajustada
   */
  function _ajustarCandlesPorEventoCorporativo(candles, precoVivo) {
    if (!candles || !Array.isArray(candles) || candles.length === 0) return candles;
    var ultimoClose = _getLastPrice(candles);
    if (!(ultimoClose > 0) || !(precoVivo > 0)) return candles;
    var diffPct = Math.abs(precoVivo - ultimoClose) / ultimoClose;
    // Só reescalona se a divergência for realmente drástica (evento corporativo)
    if (diffPct <= 0.15) return candles;

    var fator = precoVivo / ultimoClose;
    var ajustados = candles.map(function(c) {
      if (!c) return c;
      var novo = {};
      // Copia todos os campos extras (date, volume, ticker, etc.)
      for (var k in c) {
        if (c.hasOwnProperty(k)) novo[k] = c[k];
      }
      if (typeof novo.open === 'number') novo.open = parseFloat((novo.open * fator).toFixed(4));
      if (typeof novo.high === 'number') novo.high = parseFloat((novo.high * fator).toFixed(4));
      if (typeof novo.low === 'number') novo.low = parseFloat((novo.low * fator).toFixed(4));
      if (typeof novo.close === 'number') novo.close = parseFloat((novo.close * fator).toFixed(4));
      return novo;
    });

    console.log('🔄 [DataService] Evento corporativo detectado: última série divergia ' + (diffPct*100).toFixed(0) + '% do preço ao vivo. Ajustando candles por fator ' + fator.toFixed(6) + '.');
    return ajustados;
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
    // 🔧 CORREÇÃO: Desativado para ativos B3. Alpha Vantage possui dados desatualizados (travados em 2024) ou incorretos (colisão com ativos dos EUA).
    console.log('⏭️ [DataService] Ignorando Alpha Vantage para garantir a integridade técnica de ativos B3.');
    return null;
  }

  // 🔧 v14.1: FALLBACK BOLSAI - histórico OHLCV real (provedor PRO com 10k req/dia)
  function _tryBolsaiHistory(ticker) {
    if (typeof BolsaiFetcher !== 'undefined' && typeof BolsaiFetcher.getHistory === 'function') {
      try {
        var data = BolsaiFetcher.getHistory(ticker, 260);
        if (data && data.length >= 18) {
          console.log('📡 [DataService] Bolsai forneceu ' + data.length + ' candles para ' + ticker);
          return data;
        }
      } catch (e) {
        console.warn('⚠️ [DataService] Bolsai falhou para ' + ticker + ': ' + e.message);
      }
    }
    return null;
  }

  function _tryFinnhubHistory(ticker) {
    // 🔧 CORREÇÃO: Desativado para ativos B3. Finnhub não possui dados históricos confiáveis/ajustados para o mercado nacional.
    console.log('⏭️ [DataService] Ignorando Finnhub para garantir a integridade técnica de ativos B3.');
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

    // 🔧 v14.3: Normaliza aliases de ticker (ex: JBSS3 -> JBSS32) antes de processar.
    if (typeof B3V10_TICKER_MANAGER !== 'undefined' && typeof B3V10_TICKER_MANAGER.resolveTicker === 'function') {
      ticker = B3V10_TICKER_MANAGER.resolveTicker(ticker);
    }

    // 🔧 CORREÇÃO v15: Força cache-busting para limpar de imediato os candles históricos corrompidos de ONCO3/HAPV3
    var cacheKey = 'DSv15_' + ticker + '_' + interval + '_' + range;

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

    // 🔧 v15.1: Obtém a cotação ao vivo do ticker via GOOGLEFINANCE (fonte confiável, blindada com BVMF:).
    // Usada para reescalonar os candles quando houver evento corporativo (split/grupamento).
    var precoVivoRef = null;
    try {
      if (typeof getPrecosGoogleFinance === 'function') {
        var gfMapa = getPrecosGoogleFinance([ticker]);
        if (gfMapa && gfMapa[ticker] && gfMapa[ticker].price > 0) {
          precoVivoRef = gfMapa[ticker].price;
        }
      }
    } catch (e) { /* fallback: sem preço vivo, seguimos sem reescalonar */ }

    // 🔧 v15.1: Se o cache tinha candles pré-evento (sem ajuste), o precoVivoRef
    // permite reescaloná-los corretamente mesmo vindos do cache.
    if (precoVivoRef > 0 && LOCAL_CACHE[cacheKey]) {
      var cacheAjustado = _ajustarCandlesPorEventoCorporativo((LOCAL_CACHE[cacheKey].candles || []), precoVivoRef);
      if (cacheAjustado && _hasMinimumCandles(cacheAjustado)) {
        LOCAL_CACHE[cacheKey] = _buildResult(ticker, cacheAjustado, 'CACHE_AJUSTADO');
        return LOCAL_CACHE[cacheKey];
      }
    }

    // PRIORIDADE 1: BOLSAI (provedor PRO - 10k req/dia, histórico OHLCV real)
    // 🔧 v14.1: Bolsai promovida a fonte principal de histórico.
    var bolsaiCandles = _normalizeCandles(_tryBolsaiHistory(ticker));
    if (precoVivoRef > 0) bolsaiCandles = _ajustarCandlesPorEventoCorporativo(bolsaiCandles, precoVivoRef);
    if (_hasMinimumCandles(bolsaiCandles)) {
      var result = _buildResult(ticker, bolsaiCandles, 'BOLSAI');
      if (result) {
        try {
          var dataStr = JSON.stringify(bolsaiCandles);
          if (dataStr.length < 90000 && cacheService) {
            cacheService.put(cacheKey, dataStr, CACHE_TTL);
          }
        } catch (e) { /* cache write não crítico */ }
        LOCAL_CACHE[cacheKey] = result;
        return result;
      }
    }

    // PRIORIDADE 2: BRAPI (circuit breaker por ticker)
    if (!_isCircuitOpen(ticker)) {
      var candles = _normalizeCandles(_tryBrapiHistory(ticker));
      if (precoVivoRef > 0) candles = _ajustarCandlesPorEventoCorporativo(candles, precoVivoRef);
      if (_hasMinimumCandles(candles)) {
        _recordBrapiSuccess(ticker);
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
        _recordBrapiFailure(ticker);
      }
    } else {
      console.warn('🚨 [DataService] Circuit Breaker ABERTO para ' + ticker + '. Indo para fallbacks primarios.');
    }

    // 🔧 Verifica se ainda temos tempo para fallbacks (aumentado limite para não pular fallbacks se Brapi travar)
    if ((Date.now() - inicioTicker) >= TICKER_TIMEOUT_MS + 10000) {
      console.warn('⏱️ [DataService] Timeout severo apos BRAPI para ' + ticker + '. Pulando para proximo fallback.');
    }

    // FALLBACK 1: Alpha Vantage (histórico real, 5 req/min)
    var avCandles = _normalizeCandles(_tryAlphaVantageHistory(ticker));
    if (precoVivoRef > 0) avCandles = _ajustarCandlesPorEventoCorporativo(avCandles, precoVivoRef);
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
      if (precoVivoRef > 0) fhCandles = _ajustarCandlesPorEventoCorporativo(fhCandles, precoVivoRef);
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
    if (precoVivoRef > 0) yhCandles = _ajustarCandlesPorEventoCorporativo(yhCandles, precoVivoRef);
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
    var ibovClose = null;
    var ibovChange = null;
    var dolarClose = null;
    var macroSource = 'MOCK';
    
    try {
      if (typeof MacroFetcher !== 'undefined' && typeof MacroFetcher.getMacroContext === 'function') {
        var macro = MacroFetcher.getMacroContext();
        if (macro) {
          regime = macro.regime || regime;
          if (macro.dolar) dolarClose = macro.dolar;
          if (macro.ibov && macro.ibov.close) ibovClose = macro.ibov.close;
          if (macro.ibov && macro.ibov.change !== undefined) ibovChange = macro.ibov.change;
          macroSource = macro.source || 'MacroFetcher';
        }
      }
    } catch (e) {
      console.warn('⚠️ MacroFetcher indisponivel, usando regime NEUTRAL');
    }
    
    if (ibovClose === null) ibovClose = 125000;
    if (ibovChange === null) ibovChange = 0;
    if (dolarClose === null) dolarClose = 5.10;
    
    return {
      ibov: {
        close: ibovClose,
        change: ibovChange
      },
      dolar: {
        close: dolarClose
      },
      regime: regime,
      macroSource: macroSource,
      timestamp: new Date().toISOString()
    };
  }

  // -------------------------------------------------------------------------
  // 3. COTAÇÕES EM LOTE (PREÇOS ATUAIS)
  // -------------------------------------------------------------------------
  function getPrecosAtuaisEmLote(tickersArray, opcoes) {
    if (!Array.isArray(tickersArray) || tickersArray.length === 0) return {};
    opcoes = opcoes || {};

    var resultado = {};

    // 🔧 v13.3: GOOGLEFINANCE — prioridade 1 na cotação (sem consumir quota externa).
    // Se a aba Cotacoes_Live existir e tiver valores, usamos o Google Finance como
    // fonte principal. Só caímos para as APIs (HGBrasil→Finnhub→BRAPI→...) quando a
    // célula estiver vazia/#N/A (ainda recalculando ou ativo sem dado no Google).
    try {
      if (typeof getPrecosGoogleFinance === 'function' && !opcoes.desativarGoogleFinance) {
        var gf = getPrecosGoogleFinance(tickersArray);
        if (gf && typeof gf === 'object') {
          Object.keys(gf).forEach(function (tk) {
            var q = gf[tk];
            if (q && q.price !== undefined && q.price > 0) {
              resultado[tk] = q;
            }
          });
        }
      }
    } catch (gfErr) {
      console.warn('⚠️ [GOOGLEFINANCE] Falha na integração dentro do lote: ' + gfErr.message);
    }

    // Guarida: se a aba ainda não existe, tenta criá-la (popular) para próxima execução.
    if (Object.keys(resultado).length === 0 && typeof _isGoogleFinanceAvailable === 'function' && !_isGoogleFinanceAvailable()) {
      // Não forçamos criação aqui para evitar operações de escrita pesadas no meio do
      // pipeline; a aba é criada por ATUALIZAR_COTACOES_LIVE()/RODAR_SETUP_COMPLETO().
      console.log('ℹ️ [GOOGLEFINANCE] Aba Cotacoes_Live não existe. Use ATUALIZAR_COTACOES_LIVE() uma vez.');
    }

    // 🔧 v13.2 (BRAPI quota exaurida, Bolsai sem intraday, Finnhub 401/403):
    // HG Brasil PROMOVIDO a prioridade 1 de cotação, pois o usuário tem a chave
    // HGBRASIL_API_KEY e as demais fontes estão indisponíveis/limitadas.
    // Ordem: HGBrasil → Finnhub → BRAPI → RapidAPI-Yahoo → Bolsai (último recurso).

    // PRIORIDADE 1: HGBrasil (cotação real da B3 via stock_price)
    if (typeof HGBrasilFetcher !== 'undefined' && typeof HGBrasilFetcher.getQuoteBatch === 'function') {
      try {
        var hgBatch = HGBrasilFetcher.getQuoteBatch(tickersArray);
        if (hgBatch && typeof hgBatch === 'object') {
          Object.keys(hgBatch).forEach(function (ticker) {
            var quote = hgBatch[ticker];
            if (quote && quote.price !== undefined && quote.price > 0) {
              resultado[ticker] = {
                price: quote.price,
                change: quote.change,
                volume: quote.volume,
                source: 'HGBrasil'
              };
            }
          });
        }
      } catch (hgErr) {
        console.warn('⚠️ HGBrasilFetcher.getQuoteBatch falhou:', hgErr.message);
      }
    }

    // PRIORIDADE 2: FINNHUB (preço atual em tempo real)
    var missingTickers = tickersArray.filter(function(t) { return !resultado[t] || resultado[t].price === undefined; });
    if (missingTickers.length > 0 && typeof FinnhubFetcher !== 'undefined' && typeof FinnhubFetcher.getQuoteBatch === 'function') {
      try {
        var finnhubBatch = FinnhubFetcher.getQuoteBatch(missingTickers);
        if (finnhubBatch && typeof finnhubBatch === 'object') {
          Object.keys(finnhubBatch).forEach(function (ticker) {
            var quote = finnhubBatch[ticker];
            if (quote && quote.price !== undefined && quote.price > 0) {
              resultado[ticker] = {
                price: quote.price,
                change: quote.change,
                volume: quote.volume,
                source: 'Finnhub'
              };
            }
          });
        }
      } catch (fhErr) {
        console.warn('⚠️ FinnhubFetcher.getQuoteBatch falhou:', fhErr.message);
      }
    }

    // PRIORIDADE 3: BRAPI (quota pode voltar; fallback)
    missingTickers = tickersArray.filter(function(t) { return !resultado[t] || resultado[t].price === undefined; });
    if (missingTickers.length > 0 && typeof BrapiFetcher !== 'undefined' && typeof BrapiFetcher.getQuoteBatch === 'function') {
      try {
        var brapiBatch = BrapiFetcher.getQuoteBatch(missingTickers);
        if (brapiBatch && typeof brapiBatch === 'object') {
          Object.keys(brapiBatch).forEach(function (ticker) {
            var quote = brapiBatch[ticker];
            if (quote && quote.price !== undefined) {
              resultado[ticker] = quote;
            }
          });
        }
      } catch (e) {
        console.warn('⚠️ BrapiFetcher.getQuoteBatch falhou, tentando fallbacks...');
      }
    }

    // PRIORIDADE 4: RapidAPI-Yahoo
    missingTickers = tickersArray.filter(function(t) { return !resultado[t] || resultado[t].price === undefined; });
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

    // PRIORIDADE 5: Bolsai (último recurso — sem intradiário, pode vir defasado)
    missingTickers = tickersArray.filter(function(t) { return !resultado[t] || resultado[t].price === undefined; });
    if (missingTickers.length > 0 && typeof BolsaiFetcher !== 'undefined' && typeof BolsaiFetcher.getQuoteBatch === 'function') {
      try {
        var bolsaiBatch = BolsaiFetcher.getQuoteBatch(missingTickers);
        if (bolsaiBatch && typeof bolsaiBatch === 'object') {
          Object.keys(bolsaiBatch).forEach(function (ticker) {
            var quote = bolsaiBatch[ticker];
            if (quote && quote.price !== undefined) {
              resultado[ticker] = quote;
            }
          });
        }
      } catch (bolsaiErr) {
        console.warn('⚠️ BolsaiFetcher.getQuoteBatch falhou (último recurso):', bolsaiErr.message);
      }
    }

    // 🔧 v12.8: BOLSAI É A FONTE AUTORITATIVA (API PAGA).
    // 🔧 v12.9: SANITY CHECK CRÍTICO contra dados corrompidos.
    // Observamos no log que a Bolsai (/quote) retornou preços absurdos para vários
    // tickers no mesmo momento (VALE3 78,58 | HAPV3 6,49 | BIDI11 10,40 | XPBR31 110,20),
    // todos muito fora do mercado real. O histórico (getHistory) da Bolsai retornou
    // candles corretos (VALE3 53,32). Portanto, usamos o close do ÚLTIMO CANDLE como
    // referência confiável: se a cotação ao vivo divergir >35% dele, tratamos como dado
    // corrompido e mantemos o preço do candle (valor plausível), sinalizando no resultado.
    var precosReferencia = opcoes.precosReferencia || null;
    if (precosReferencia) {
      Object.keys(resultado).forEach(function (tk) {
        var ref = precosReferencia[tk];
        var q = resultado[tk];
        if (!(ref > 0) || !q || !q.price || !(q.price > 0)) return;
        var diffPct = Math.abs(q.price - ref) / ref;
        if (diffPct > 0.35) {
          // 🔧 CORREÇÃO: Se a fonte for GoogleFinance, ela é altamente confiável (especialmente após o prefixo BVMF:).
          // Não a tratamos como corrompida, pois o candle diário pode estar defasado/errado devido a desdobramento, grupamento ou falta de atualização.
          if (q.source === 'GoogleFinance') {
            console.log('ℹ️ [DataService] ' + tk + ': cotação GoogleFinance=R$ ' + q.price.toFixed(2) + ' diverge ' + (diffPct * 100).toFixed(0) + '% do close do candle (R$ ' + ref.toFixed(2) + '), mas confiamos no GoogleFinance.');
            return;
          }
          var motivo = (q.source === 'Bolsai') ? 'Bolsai retornou preço divergente do candle (possível dado corrompido/no momento).' : 'Fonte fallback (' + q.source + ') divergiu muito do candle.';
          console.warn('⚠️ [DataService] ' + tk + ': cotação ' + q.source + '=R$ ' + q.price.toFixed(2) + ' diverge ' + (diffPct * 100).toFixed(0) + '% do close do candle (R$ ' + ref.toFixed(2) + '). ' + motivo + ' Mantendo preço do candle.');
          resultado[tk] = {
            price: ref,
            change: 0,
            volume: (q.volume !== undefined && q.volume !== null) ? q.volume : 0,
            source: q.source,
            corrompido: true,
            precoRealSuspeito: q.price
          };
        }
      });
    }

    return resultado;
  }

  // -------------------------------------------------------------------------
  // 3.1. OVERRIDE MANUAL DE PREÇO (Script Properties: PRECO_OVERRIDE_<TICKER>)
  // Permite forçar o preço exibido de um ativo quando as fontes de mercado
  // retornarem dados divergentes/defasados (ex: ONCO3). O override tem
  // prioridade máxima sobre qualquer cotação ao vivo.
  // -------------------------------------------------------------------------
  function getPrecoOverride(ticker) {
    if (!ticker) return null;
    try {
      var props = PropertiesService.getScriptProperties();
      var v = props.getProperty('PRECO_OVERRIDE_' + String(ticker).toUpperCase());
      if (v) {
        var n = parseFloat(String(v).trim().replace(',', '.'));
        if (!isNaN(n) && n > 0) return n;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function setPrecoOverride(ticker, preco) {
    var n = parseFloat(String(preco).replace(',', '.'));
    if (!ticker || isNaN(n) || n <= 0) {
      console.error('❌ [DataService] setPrecoOverride inválido: ticker=' + ticker + ' preco=' + preco);
      return false;
    }
    PropertiesService.getScriptProperties().setProperty('PRECO_OVERRIDE_' + String(ticker).toUpperCase(), String(n));
    console.log('🔧 [DataService] Override de preço definido: ' + String(ticker).toUpperCase() + ' = R$ ' + n.toFixed(2));
    return true;
  }

  function removePrecoOverride(ticker) {
    PropertiesService.getScriptProperties().deleteProperty('PRECO_OVERRIDE_' + String(ticker).toUpperCase());
    console.log('🧹 [DataService] Override removido para ' + String(ticker).toUpperCase());
  }

  // -------------------------------------------------------------------------
  // 4.1. GOOGLEFINANCE (v13.3) — colação ao vivo via planilha (sem quota externa)
  // A função GOOGLEFINANCE() do Google Sheets fornece cotação recente de ações da B3
  // em tempo real, SEM consumir quota de APIs externas (BRAPI/HG/Finnhub). Criamos uma
  // aba auxiliar "Cotacoes_Live" com =GOOGLEFINANCE("<TICKER>";"price") e, ao ler,
  // fazemos 1 única chamada getValues() para todos os ativos.
  // -------------------------------------------------------------------------
  function _isGoogleFinanceAvailable() {
    try {
      return typeof SpreadsheetApp !== 'undefined' &&
             typeof SpreadsheetApp.getActiveSpreadsheet === 'function' &&
             SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Cotacoes_Live') !== null;
    } catch (e) { return false; }
  }

  /** Popula a aba Cotacoes_Live com fórmulas GOOGLEFINANCE para os tickers monitorados. */
  function prepararAbaCotacoesLive(tickers) {
    try {
      tickers = tickers || (typeof B3V10_TICKER_MANAGER !== 'undefined' && typeof B3V10_TICKER_MANAGER.getAll === 'function' ? B3V10_TICKER_MANAGER.getAll() : []);
      if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
        console.warn('⚠️ [GOOGLEFINANCE] Nenhum ticker para popular a aba Cotacoes_Live.');
        return false;
      }
      // Remove duplicatas e normaliza (.SA -> limpo)
      var unicos = [];
      var vistos = {};
      for (var i = 0; i < tickers.length; i++) {
        var t = String(tickers[i]).toUpperCase().trim().replace(/\.SA$/, '');
        if (!vistos[t]) { vistos[t] = true; unicos.push(t); }
      }

      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('Cotacoes_Live');
      if (!sheet) sheet = ss.insertSheet('Cotacoes_Live');
      sheet.getRange('A1:B1').setValues([['Ticker', 'Preço Ao Vivo (GOOGLEFINANCE)']]);
      sheet.getRange('A1:B1').setFontWeight('bold');

      var linhas = [];
      for (var j = 0; j < unicos.length; j++) {
        var ticker = unicos[j];
        // 🔧 CORREÇÃO: Evita colisão de tickers da B3 com tickers americanos (ex: HAPV3 -> HAP, ONCO3 -> ONCO)
        // adicionando o prefixo "BVMF:" para o GoogleFinance.
        var gfTicker = 'BVMF:' + ticker;
        linhas.push([ticker, '=GOOGLEFINANCE("' + gfTicker + '";"price")']);
      }
      sheet.getRange(2, 1, linhas.length, 2).setValues(linhas);
      sheet.getRange('B2:B' + (linhas.length + 1)).setNumberFormat('R$ #,##0.00');
      console.log('✅ [GOOGLEFINANCE] Aba Cotacoes_Live populada com ' + linhas.length + ' tickers. Aguarde o recálculo do Google Sheets (~1-5 min).');
      return true;
    } catch (e) {
      console.warn('⚠️ [GOOGLEFINANCE] Falha ao popular aba Cotacoes_Live: ' + e.message);
      return false;
    }
  }

  /**
   * Lê a aba Cotacoes_Live (1 chamada em lote) e retorna mapa ticker -> {price, source}.
   * @param {Array<string>} [tickers] Lista de tickers desejados (usa todos se vazio).
   * @returns {Object} Mapa ticker -> { price, change, volume, source: 'GoogleFinance' }
   */
  function getPrecosGoogleFinance(tickers) {
    var resultado = {};
    if (!_isGoogleFinanceAvailable()) {
      // Se a aba não existe, papel do reconciler é popular — loga em nível baixo (shell).
      return resultado;
    }
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('Cotacoes_Live');
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return resultado;

      var dados = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // 1 operação de rede
      var desejados = {};
      if (tickers && Array.isArray(tickers)) {
        for (var i = 0; i < tickers.length; i++) {
          desejados[String(tickers[i]).toUpperCase().trim().replace(/\.SA$/, '')] = true;
        }
      }

      for (var r = 0; r < dados.length; r++) {
        var tk = String(dados[r][0] || '').toUpperCase().trim();
        if (!tk) continue;
        if (tickers && Array.isArray(tickers) && !desejados[tk]) continue;
        var preco = Number(dados[r][1]);
        if (isNaN(preco) || preco <= 0) continue; // célula #N/A / vazia / ainda recalculando
        resultado[tk] = {
          price: preco,
          change: 0,
          volume: 0,
          source: 'GoogleFinance'
        };
      }
      if (Object.keys(resultado).length > 0) {
        console.log('✅ [GOOGLEFINANCE] ' + Object.keys(resultado).length + ' cotações lidas da aba Cotacoes_Live.');
      }
    } catch (e) {
      console.warn('⚠️ [GOOGLEFINANCE] Falha ao ler Cotacoes_Live: ' + e.message);
    }
    return resultado;
  }

  // -------------------------------------------------------------------------
  // 4. PREÇO AO VIVO (UNITÁRIO)
  // -------------------------------------------------------------------------
  function getPrecoAtual(ticker) {
    if (!ticker) return null;

    // 🔧 v14.3: Normaliza aliases de ticker (ex: JBSS3 -> JBSS32) antes de processar.
    if (typeof B3V10_TICKER_MANAGER !== 'undefined' && typeof B3V10_TICKER_MANAGER.resolveTicker === 'function') {
      ticker = B3V10_TICKER_MANAGER.resolveTicker(ticker);
    }

    var tickerLimpo = ticker.replace(/\.SA$/i, '').toUpperCase();

    // 1. 🔧 v13.2 (BRAPI quota exaurida, Finnhub 401/403): HGBrasil — cotação real da B3.
    // O usuário tem a chave HGBRASIL_API_KEY. Prioridade máxima sobre as demais fontes.
    try {
      if (typeof HGBrasilFetcher !== 'undefined' && typeof HGBrasilFetcher.getQuote === 'function') {
        var hgQuote = HGBrasilFetcher.getQuote(tickerLimpo);
        if (hgQuote && hgQuote.price !== undefined && hgQuote.price > 0) {
          return {
            price: hgQuote.price,
            timestamp: new Date(),
            source: 'HGBrasil',
            ticker: ticker,
            change: hgQuote.change,
            volume: hgQuote.volume
          };
        }
      }
    } catch (hgErr) {
      console.warn('⚠️ HGBrasilFetcher.getQuote falhou para ' + ticker + ':', hgErr.message);
    }

    // 2. Tenta via FINNHUB (preço atual em tempo real; pode estar com chave indisponível)
    try {
      if (typeof FinnhubFetcher !== 'undefined' && typeof FinnhubFetcher.getQuote === 'function') {
        var fhQuote = FinnhubFetcher.getQuote(tickerLimpo);
        if (fhQuote && fhQuote.price !== undefined && fhQuote.price > 0) {
          return {
            price: fhQuote.price,
            timestamp: new Date(),
            source: 'Finnhub',
            ticker: ticker,
            change: fhQuote.change,
            volume: fhQuote.volume
          };
        }
      }
    } catch (fhErr) {
      console.warn('⚠️ FinnhubFetcher.getQuote falhou para ' + ticker + ':', fhErr.message);
    }

    // 3. Tenta via BRAPI (fallback quando a quota voltar)
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

    // 4. Tenta via RapidAPI-Yahoo
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

    // 5. Último recurso: Bolsai (sem intradiário, pode vir defasado)
    try {
      if (typeof BolsaiFetcher !== 'undefined' && typeof BolsaiFetcher.getQuote === 'function') {
        var bolsaiQuote = BolsaiFetcher.getQuote(tickerLimpo);
        if (bolsaiQuote && bolsaiQuote.price !== undefined && bolsaiQuote.price > 0) {
          return {
            price: bolsaiQuote.price,
            timestamp: new Date(),
            source: 'Bolsai',
            ticker: ticker,
            change: bolsaiQuote.change,
            volume: bolsaiQuote.volume
          };
        }
      }
    } catch (bolsaiErr) {
      console.warn('⚠️ BolsaiFetcher.getQuote falhou para ' + ticker + ' (último recurso):', bolsaiErr.message);
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
    getPrecoAtual:         getPrecoAtual,
    getPrecoOverride:      getPrecoOverride,
    setPrecoOverride:      setPrecoOverride,
    removePrecoOverride:   removePrecoOverride,
    // 🔧 v13.3: GOOGLEFINANCE
    getPrecosGoogleFinance: getPrecosGoogleFinance,
    prepararAbaCotacoesLive: prepararAbaCotacoesLive,
    isGoogleFinanceAvailable: _isGoogleFinanceAvailable
  };
})();

// 🔧 v13.3: Gatilho para popular/atualizar a aba Cotacoes_Live via menu/execução manual.
function ATUALIZAR_COTACOES_LIVE() {
  var ok = (typeof DataService !== 'undefined' && DataService.prepararAbaCotacoesLive ? DataService.prepararAbaCotacoesLive() : false);
  console.log(ok ? '✅ Cotacoes_Live atualizada.' : '❌ Não foi possível atualizar Cotacoes_Live.');
  return ok;
}

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

/**
 * 🔧 CORREÇÃO v12.7: DIAGNÓSTICO MULTIFONTE DE COTAÇÃO.
 * Consulta o mesmo ativo em TODAS as fontes (candle diário, BRAPI, Bolsai,
 * RapidAPI-Yahoo e HG Brasil) e imprime lado a lado, para identificar qual
 * fonte está retornando preço defasado/incorreto (ex: ONCO3 0,92 vs real 1,20).
 * Uso: VERIFICAR_COTACAO('ONCO3')
 */
function VERIFICAR_COTACAO(ticker) {
  if (!ticker) ticker = 'ONCO3';
  var resultado = { ticker: ticker, horario: new Date().toString() };

  // 1. Último close do candle diário (histórico usado na análise)
  try {
    var data = DataService.getMarketData(ticker);
    var candles = (data && data.candles) ? data.candles.filter(function (c) { return c && c.close > 0; }) : [];
    var last = candles[candles.length - 1];
    resultado.candleDiarioClose = last ? last.close : null;
    resultado.dataUltimoCandle = last && last.date ? String(last.date) : null;
    resultado.qtdCandles = candles.length;
  } catch (e) {
    resultado.candleDiarioClose = 'erro: ' + e.message;
  }

  // 2. Cotação ao vivo prioritária (Bolsai primeiro — via getPrecoAtual)
  try {
    var live = DataService.getPrecoAtual(ticker);
    resultado.cotacaoPrioritaria = live ? live.price : null;
    resultado.fonteUsadaAoVivo = live ? live.source : null;
  } catch (e) {
    resultado.brapi = 'erro: ' + e.message;
  }

  // 3. Bolsai (direto)
  if (typeof BolsaiFetcher !== 'undefined' && typeof BolsaiFetcher.getQuote === 'function') {
    try {
      var qB = BolsaiFetcher.getQuote(ticker);
      resultado.bolsai = (qB && qB.price !== undefined) ? qB.price : null;
    } catch (e) {
      resultado.bolsai = 'erro: ' + e.message;
    }
  }

  // 4. RapidAPI-Yahoo (direto)
  if (typeof RapidAPIYahooFetcher !== 'undefined' && typeof RapidAPIYahooFetcher.getQuoteBatch === 'function') {
    try {
      var yh = RapidAPIYahooFetcher.getQuoteBatch([ticker]);
      resultado.rapidapiYahoo = (yh && yh[ticker] && yh[ticker].price !== undefined) ? yh[ticker].price : null;
    } catch (e) {
      resultado.rapidapiYahoo = 'erro: ' + e.message;
    }
  }

  // 5. HG Brasil (direto)
  if (typeof HGBrasilFetcher !== 'undefined' && typeof HGBrasilFetcher.getQuote === 'function') {
    try {
      var qH = HGBrasilFetcher.getQuote(ticker);
      resultado.hgBrasil = (qH && qH.price !== undefined) ? qH.price : null;
    } catch (e) {
      resultado.hgBrasil = 'erro: ' + e.message;
    }
  }

  // 6. Override manual (se existir)
  resultado.overrideManual = DataService.getPrecoOverride(ticker);

  console.log('📊 DIAGNÓSTICO DE COTAÇÃO: ' + ticker);
  console.log(JSON.stringify(resultado, null, 2));
  return resultado;
}
