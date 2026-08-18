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
  function getQuoteBatch(tickers) {
    if (!tickers || tickers.length === 0) return {};
    
    const key = _getKey();
    if (!key) return {};

    const quotes = {};
    const requests = tickers.map(t => {
      const symbol = _formatTicker(t);
      return {
        url: `${BASE_URL}/stock/get-chart?symbol=${symbol}&interval=1d&range=1d&lang=en-US&region=US`,
        method: 'get',
        headers: {
          'x-rapidapi-host': HOST,
          'x-rapidapi-key': key
        },
        muteHttpExceptions: true
      };
    });

    try {
      const responses = UrlFetchApp.fetchAll(requests);
      
      responses.forEach((resp, index) => {
        if (resp.getResponseCode() === 200) {
          const data = JSON.parse(resp.getContentText());
          if (data.chart && data.chart.result && data.chart.result.length > 0) {
            const meta = data.chart.result[0].meta;
            quotes[tickers[index]] = {
              price: meta.regularMarketPrice,
              change: (meta.regularMarketPrice / meta.chartPreviousClose - 1) * 100,
              source: 'RapidAPI-Yahoo'
            };
          }
        }
      });
    } catch (e) {
      Logger.log(`❌ Erro em getQuoteBatch RapidAPI: ${e.message}`);
    }

    return quotes;
  }

  return {
    getHistory: getHistory,
    getQuoteBatch: getQuoteBatch
  };

})();
