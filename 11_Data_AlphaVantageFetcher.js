/**
 * 11_Data_AlphaVantageFetcher.js — Provedor de Dados Alpha Vantage (v1.0)
 * =============================================================================
 * ✅ Nova fonte de dados para histórico e cotações.
 * ✅ Integração com RateLimiter e Secrets Manager.
 * ✅ Fallback para Yahoo/Brapi em caso de falha.
 * =============================================================================
 */

var AlphaVantageFetcher = (function() {
  'use strict';

  const API_BASE_URL = 'https://www.alphavantage.co/query';
  const CACHE_TTL = 300; // 5 minutos para cotações, 1 hora para histórico
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 1000;

  function _getApiKey() {
    // ⚠️ SEGURANÇA: A chave hardcoded abaixo é um fallback de emergência.
    // Para produção, configure ALPHA_VANTAGE_API_KEY nas Script Properties
    // ou no GCP Secret Manager. A chave abaixo será removida em versão futura.
    var HARDCODED_KEY = '14NGYBGQYKZOACCO';
    
    if (typeof Secrets !== 'undefined') {
      try {
        var token = Secrets.getSecret('ALPHA_VANTAGE_API_KEY');
        if (token) return token;
      } catch(e) { /* fallback */ }
    }
    
    if (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') {
      try {
        var token = CONFIG.getSecret('ALPHA_VANTAGE_API_KEY');
        if (token) return token;
      } catch(e) { /* fallback */ }
    }
    
    console.warn('⚠️ [AlphaVantage] Usando chave hardcoded como fallback. Configure ALPHA_VANTAGE_API_KEY nas Script Properties.');
    return HARDCODED_KEY;
  }


  function _fetchWithRetry(url, options, bucketName) {
    const apiKey = _getApiKey();
    if (!apiKey) {
      console.error("❌ AlphaVantageFetcher: ALPHA_VANTAGE_API_KEY ausente.");
      return null;
    }

    const finalUrl = `${url}&apikey=${apiKey}`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        let response;
        // Usa RateLimiter se disponível (módulo 04)
        if (typeof RateLimiter !== 'undefined') {
          response = RateLimiter.execute(bucketName, () => UrlFetchApp.fetch(finalUrl, options));
        } else {
          response = UrlFetchApp.fetch(finalUrl, options);
        }

        const code = response.getResponseCode();
        const text = response.getContentText();

        if (code === 200) {
          const json = JSON.parse(text);
          // Alpha Vantage retorna erros no JSON com a chave "Error Message" ou "Note"
          if (json["Error Message"] || json["Note"]) {
            console.warn(`⚠️ Alpha Vantage API retornou erro/nota: ${json["Error Message"] || json["Note"]}`);
            return null; // Tratar como falha para tentar fallback
          }
          return json;
        } else if (code === 429) {
          console.warn(`⚠️ Alpha Vantage Rate Limit (tentativa ${attempt}).`);
          if (attempt < MAX_RETRIES) Utilities.sleep(RETRY_DELAY_MS * attempt);
          continue;
        } else {
          console.error(`❌ Alpha Vantage HTTP ${code}: ${text}`);
          return null;
        }
      } catch (e) {
        console.error(`❌ Alpha Vantage Fetch (tentativa ${attempt}): ${e.message}`);
        if (attempt < MAX_RETRIES) Utilities.sleep(RETRY_DELAY_MS * attempt);
      }
    }
    return null;
  }

  /**
   * Busca histórico de preços (OHLCV) para um ticker.
   * @param {string} ticker
   * @param {string} interval - '1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly'
   * @param {string} outputsize - 'compact' (últimos 100) ou 'full' (20+ anos)
   */
  function getHistory(ticker, interval = 'daily', outputsize = 'compact') {
    if (!ticker) return null;

    let functionType;
    if (interval.includes('min')) {
      functionType = `TIME_SERIES_INTRADAY&interval=${interval}`;
    } else if (interval === 'daily') {
      functionType = 'TIME_SERIES_DAILY';
    } else if (interval === 'weekly') {
      functionType = 'TIME_SERIES_WEEKLY';
    } else if (interval === 'monthly') {
      functionType = 'TIME_SERIES_MONTHLY';
    } else {
      console.warn(`⚠️ Alpha Vantage: Intervalo ${interval} não suportado.`);
      return null;
    }

    // 🔧 CORREÇÃO: Alpha Vantage espera ticker com .SA para B3 (formato Yahoo)
    const cleanTicker = ticker.toUpperCase().trim().replace(/\.SA$/, '') + '.SA';
    const url = `${API_BASE_URL}?function=${functionType}&symbol=${cleanTicker}&outputsize=${outputsize}`;
    const json = _fetchWithRetry(url, { muteHttpExceptions: true }, 'ALPHA_VANTAGE');
    if (!json) return null;

    const timeSeriesKey = Object.keys(json).find(key => key.startsWith('Time Series'));
    const timeSeries = json[timeSeriesKey];
    if (!timeSeries) return null;

    const candles = [];
    for (const dateStr in timeSeries) {
      const data = timeSeries[dateStr];
      candles.push({
        date: new Date(dateStr),
        open: parseFloat(data['1. open']),
        high: parseFloat(data['2. high']),
        low: parseFloat(data['3. low']),
        close: parseFloat(data['4. close']),
        volume: parseInt(data['5. volume']),
        ticker: ticker
      });
    }
    // Alpha Vantage retorna do mais recente para o mais antigo, precisamos inverter
    return candles.reverse();
  }

  /**
   * Busca a cotação atual (Preço) de múltiplos ativos em uma única chamada de rede.
   * Alpha Vantage não tem endpoint de batch para cotações em tempo real no free tier.
   * Simula batch fazendo chamadas individuais.
   * @param {Array<string>} tickers
   * @returns {Object}
   */
  function getQuoteBatch(tickers) {
    const results = {};
    tickers.forEach(ticker => {
      const quote = getQuote(ticker);
      if (quote) {
        results[ticker] = {
          price: quote.price,
          change: quote.change,
          volume: quote.volume
        };
      }
    });
    return results;
  }

  /**
   * Busca a cotação atual para um único ticker.
   */
  function getQuote(ticker) {
    if (!ticker) return null;
    const url = `${API_BASE_URL}?function=GLOBAL_QUOTE&symbol=${ticker}`;
    const json = _fetchWithRetry(url, { muteHttpExceptions: true }, 'ALPHA_VANTAGE');
    if (!json || !json['Global Quote']) return null;

    const quote = json['Global Quote'];
    return {
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      volume: parseInt(quote['06. volume']),
      timestamp: new Date(quote['07. latest trading day'])
    };
  }

  return {
    getHistory: getHistory,
    getQuote: getQuote,
    getQuoteBatch: getQuoteBatch
  };
})();