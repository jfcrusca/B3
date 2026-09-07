/**
 * =============================================================================
 * 11_Data_RapidAPIYahooFetcher.js
 * =============================================================================
 * Fallback via RapidAPI para Yahoo Finance, evitando erros 401/403.
 * Host esperado: yahoo-finance-real-time1.p.rapidapi.com
 */

var RapidAPIYahooFetcher = (function () {
  'use strict';

  const HOST = "yahoo-finance-real-time1.p.rapidapi.com";
  const BASE_URL = `https://${HOST}`;

  function _getKey() {
    if (typeof SecretsManager !== 'undefined' && typeof SecretsManager.getSecret === 'function') {
      const key = SecretsManager.getSecret('RAPIDAPI_KEY');
      if (key) return key;
    }
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('RAPIDAPI_KEY') || '';
  }

  function _formatTicker(ticker) {
    ticker = ticker.toUpperCase().trim();
    if (!ticker.endsWith('.SA') && !ticker.includes('^')) {
      ticker += '.SA';
    }
    return ticker;
  }

  function _fetch(endpoint, params) {
    const key = _getKey();
    if (!key) {
      Logger.log("⚠️ RAPIDAPI_KEY não configurada.");
      return null;
    }

    const queryStr = Object.keys(params).map(k => `${k}=${params[k]}`).join('&');
    const url = `${BASE_URL}/${endpoint}?${queryStr}`;
    
    const options = {
      method: 'get',
      headers: {
        'x-rapidapi-host': HOST,
        'x-rapidapi-key': key
      },
      muteHttpExceptions: true
    };

    try {
      const resp = UrlFetchApp.fetch(url, options);
      if (resp.getResponseCode() === 200) {
        return JSON.parse(resp.getContentText());
      } else {
        Logger.log(`⚠️ RapidAPI erro ${resp.getResponseCode()}: ${resp.getContentText()}`);
        return null;
      }
    } catch (e) {
      Logger.log(`❌ RapidAPI exceção: ${e.message}`);
      return null;
    }
  }

  /**
   * getHistory - Retorna candles históricos (OHLCV)
   * @param {string} ticker 
   * @param {string} interval - '1d', '1wk', '1mo'
   * @param {string} range - '1mo', '3mo', '6mo', '1y'
   */
  function getHistory(ticker, interval = '1d', range = '6mo') {
    const symbol = _formatTicker(ticker);
    
    // Mapeamento básico de intervalo e range caso venha do DataService
    let mappedInterval = interval;
    if (interval === 'D') mappedInterval = '1d';
    if (interval === 'W') mappedInterval = '1wk';
    
    let mappedRange = range;
    if (!mappedRange.endsWith('mo') && !mappedRange.endsWith('y') && !mappedRange.endsWith('d')) {
       mappedRange = '6mo';
    }

    const data = _fetch('stock/get-chart', {
      symbol: symbol,
      interval: mappedInterval,
      range: mappedRange,
      lang: 'en-US',
      region: 'US'
    });

    if (!data || !data.chart || !data.chart.result || data.chart.result.length === 0) return null;

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];

    if (!timestamps || !quote) return null;

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] === null || quote.close[i] === null) continue;

      candles.push({
        date: new Date(timestamps[i] * 1000).toISOString(),
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i] || 0
      });
    }

    return candles;
  }

  /**
   * getQuoteBatch - Retorna cotação atual para múltiplos ativos
   * @param {Array<string>} tickers 
   */
  // 🔧 BATCH_SIZE: Máximo de tickers por requisição simultânea.
  // Reduzido de 42 (ilimitado) para 10 para evitar "Argument too large" e 429 por quota.
  const BATCH_SIZE = 10;
  
  // Contador de falhas consecutivas 429 para ativar circuit breaker
  var _consecutive429 = 0;
  var _circuitOpen = false;
  var _circuitOpenTime = 0;
  const CIRCUIT_COOLDOWN_MS = 300000; // 5 min

  function _isCircuitOpen() {
    if (!_circuitOpen) return false;
    if (Date.now() - _circuitOpenTime > CIRCUIT_COOLDOWN_MS) {
      _circuitOpen = false;
      _consecutive429 = 0;
      console.log('🔄 [RapidAPI] Circuit breaker resetado após cooldown.');
      return false;
    }
    return true;
  }

  function getQuoteBatch(tickers) {
    if (!tickers || tickers.length === 0) return {};

    const key = _getKey();
    if (!key) {
      Logger.log('⚠️ RAPIDAPI_KEY não configurada.');
      return {};
    }

    // ⚠️ Verifica se o circuit breaker está aberto (muitos 429 consecutivos)
    if (_isCircuitOpen()) {
      console.warn('⏭️ [RapidAPI] Circuit breaker ABERTO. Pulando lote de ' + tickers.length + ' tickers.');
      return {};
    }

    const quotes = {};

    // Divide em lotes para evitar "Argument too large" e respeitar rate limits
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      // v14.0: Para imediatamente se circuit breaker abriu
      if (_isCircuitOpen()) {
        console.warn('RapidAPI Circuit breaker aberto. Abortando processamento.');
        break;
      }
      const batch = tickers.slice(i, i + BATCH_SIZE);
      let batchQuotes = {};
      try {
        batchQuotes = _fetchBatch(batch) || {};
      } catch (e) {
        // v14.0: Se _fetchBatch lancou QUOTA_EXHAUSTED, para aqui
        if (e.message && e.message.indexOf('QUOTA') !== -1) {
          console.warn('RapidAPI Quota esgotada. Parando processamento do lote.');
          break;
        }
        console.warn('Erro ao processar lote RapidAPI: ' + e.message);
      }

      if (batchQuotes && typeof batchQuotes === 'object') {
        Object.assign(quotes, batchQuotes);
      }

      // Pausa entre lotes para respeitar rate limit da RapidAPI
      if (i + BATCH_SIZE < tickers.length) {
        Utilities.sleep(800);
      }
    }

    return quotes;
  }

  function _fetchBatch(batch) {
    const quotes = {};
    const requests = batch.map(t => {
      const symbol = _formatTicker(t);
      return {
        url: `${BASE_URL}/stock/get-chart?symbol=${symbol}&interval=1d&range=1d&lang=en-US&region=US`,
        method: 'get',
        headers: {
          'x-rapidapi-host': HOST,
          'x-rapidapi-key': _getKey()
        },
        muteHttpExceptions: true
      };
    });

    try {
      const responses = UrlFetchApp.fetchAll(requests);

      responses.forEach((resp, index) => {
        const code = resp.getResponseCode();
        if (code === 200) {
          _consecutive429 = 0; // Reset ao sucesso
          try {
            const data = JSON.parse(resp.getContentText());
            if (data.chart && data.chart.result && data.chart.result.length > 0) {
              const meta = data.chart.result[0].meta;
              quotes[batch[index]] = {
                price: meta.regularMarketPrice,
                change: (meta.regularMarketPrice / meta.chartPreviousClose - 1) * 100,
                source: 'RapidAPI-Yahoo'
              };
            }
          } catch (parseErr) {
            Logger.log('RapidAPI parse error: ' + parseErr.message);
          }
        } else if (code === 429) {
          _consecutive429++;
          if (_consecutive429 >= 3) {
            _circuitOpen = true;
            _circuitOpenTime = Date.now();
            console.error('RapidAPI Circuit breaker ATIVADO apos 3 falhas 429 consecutivas.');
            // Para de processar o lote todo - quota esgotada
            throw new Error('RAPIDAPI_QUOTA_EXHAUSTED');
          }
          console.warn('RapidAPI 429 para ' + batch[index] + ' (tentativa ' + _consecutive429 + '/3)');
        } else {
          console.log('RapidAPI HTTP ' + code + ' para ' + batch[index]);
        }
      });
    } catch (e) {
      Logger.log(`❌ Erro em _fetchBatch RapidAPI: ${e.message}`);
      // Se o erro for de argument too large, tentar ticker por ticker
      if (e.message && e.message.indexOf('too large') !== -1) {
        console.warn('🔄 [RapidAPI] Tentando ticker por ticker...');
        for (let j = 0; j < batch.length; j++) {
          const single = _fetchSingle(batch[j]);
          if (single) Object.assign(quotes, single);
          Utilities.sleep(300);
        }
      }
    }

    return quotes;
  }

  function _fetchSingle(ticker) {
    const key = _getKey();
    if (!key) return {};
    const symbol = _formatTicker(ticker);
    const url = `${BASE_URL}/stock/get-chart?symbol=${symbol}&interval=1d&range=1d&lang=en-US&region=US`;
    try {
      const resp = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: {
          'x-rapidapi-host': HOST,
          'x-rapidapi-key': key
        },
        muteHttpExceptions: true
      });
      if (resp.getResponseCode() === 200) {
        const data = JSON.parse(resp.getContentText());
        if (data.chart && data.chart.result && data.chart.result.length > 0) {
          const meta = data.chart.result[0].meta;
          return {
            [ticker]: {
              price: meta.regularMarketPrice,
              change: (meta.regularMarketPrice / meta.chartPreviousClose - 1) * 100,
              source: 'RapidAPI-Yahoo'
            }
          };
        }
      }
    } catch (e) {
      Logger.log(`❌ RapidAPI single erro para ${ticker}: ${e.message}`);
    }
    return {};
  }

  return {
    getHistory: getHistory,
    getQuoteBatch: getQuoteBatch
  };

})();
