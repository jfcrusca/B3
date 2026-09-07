/**
 * 11_Data_BolsaiFetcher.js
 * =============================================================================
 * CAMADA DE DADOS FINANCEIROS BOLSAI (api.usebolsai.com) — v1.0
 * =============================================================================
 * Dados financeiros da B3, CVM e BCB via API REST.
 * Base URL: https://api.usebolsai.com/api/v1
 * Autenticação: Header X-API-Key
 *
 * ✅ Plano Grátis: 200 req/dia (reset meia-noite UTC)
 *   - Endpoints disponíveis: Fundamentos e preços atuais
 *   - Histórico OHLCV NÃO disponível no plano Free (é PRO)
 *
 * ✅ USO NESTE SISTEMA:
 *   - Fonte de COTAÇÃO (preço atual) — fallback quando BRAPI/RapidAPI/HG falham
 *   - NÃO usado para history (plano free não tem acesso a histórico real)
 *
 * Segurança: A chave é lida EXCLUSIVAMENTE das Script Properties (BOLSAI_KEY).
 * =============================================================================
 */

var BolsaiFetcher = (function() {
  'use strict';

  var BASE_URL = 'https://api.usebolsai.com/api/v1';
  var CACHE_TTL = 300; // 5 minutos de cache para cotações

  // Circuit breaker para evitar spam de 429
  var _consecutive429 = 0;
  var _circuitOpen = false;
  var _circuitOpenTime = 0;
  var CIRCUIT_COOLDOWN_MS = 300000; // 5 min

  /**
   * Obtém a chave de API das Script Properties (segurança).
   * @returns {string} Chave BOLSAI_KEY ou vazia se não configurada
   */
  function _getApiKey() {
    try {
      if (typeof SecretsManager !== 'undefined' && typeof SecretsManager.getSecret === 'function') {
        var viaSecrets = SecretsManager.getSecret('BOLSAI_KEY');
        if (viaSecrets) return String(viaSecrets).trim();
      }
    } catch (e) { /* fallback abaixo */ }

    var props = PropertiesService.getScriptProperties();
    var viaProps = props.getProperty('BOLSAI_KEY');
    return viaProps ? String(viaProps).trim() : '';
  }

  /**
   * Verifica se o circuit breaker está aberto (muitos 429 consecutivos).
   * @returns {boolean}
   */
  function _isCircuitOpen() {
    if (!_circuitOpen) return false;
    if (Date.now() - _circuitOpenTime > CIRCUIT_COOLDOWN_MS) {
      _circuitOpen = false;
      _consecutive429 = 0;
      console.log('🔄 [Bolsai] Circuit breaker resetado após cooldown.');
      return false;
    }
    return true;
  }

  /**
   * Normaliza o ticker (remove .SA se presente).
   * Ex: PETR4.SA -> PETR4
   * @param {string} ticker
   * @returns {string}
   */
  function _normalizeTicker(ticker) {
    return String(ticker).toUpperCase().trim().replace(/\.SA$/, '').replace(/^\^/, '');
  }

  /**
   * Realiza uma requisição autenticada à API Bolsai.
   * @param {string} endpoint - Ex: 'stocks/PETR4'
   * @returns {Object|null} Objeto JSON parse ou null em erro
   */
  function _request(endpoint) {
    if (_isCircuitOpen()) {
      console.warn('⏭️ [Bolsai] Circuit breaker ABERTO. Pulando ' + endpoint);
      return null;
    }

    var key = _getApiKey();
    if (!key) {
      console.warn('⚠️ [Bolsai] BOLSAI_KEY não configurada. Pule fallback Bolsai.');
      return null;
    }

    var url = BASE_URL + '/' + endpoint;
    var options = {
      method: 'get',
      headers: {
        'X-API-Key': key,
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    };

    try {
      var response = UrlFetchApp.fetch(url, options);
      var code = response.getResponseCode();

      if (code === 200) {
        _consecutive429 = 0; // reset ao sucesso
        return JSON.parse(response.getContentText());
      } else if (code === 429) {
        _consecutive429++;
        if (_consecutive429 >= 3) {
          _circuitOpen = true;
          _circuitOpenTime = Date.now();
          console.error('bolsai Circuit breaker ATIVADO apos 3 falhas 429.');
        }
        console.warn('bolsai Rate limit (429) para ' + endpoint + ' (tentativa ' + _consecutive429 + '/3)');
        return null;
      } else {
        console.warn('bolsai HTTP ' + code + ' para ' + endpoint);
        return null;
      }
    } catch (e) {
      console.warn('bolsai Excecao em ' + endpoint + ': ' + e.message);
      return null;
    }
  }

  /**
   * Gera as variações de formato de ticker aceitas pela API Bolsai.
   * 🔧 CORREÇÃO v14.2: A API Bolsai usa o padrão de validação
   * `^[A-Za-z][A-Za-z0-9]{3}\d{0,2}$` — ou seja, SOMENTE o ticker puro
   * (ex: WEGE3), SEM sufixo .SA ou .BSP. Estes sufixos causam HTTP 422
   * (Validation Error). Por isso retornamos apenas o ticker puro.
   * @param {string} ticker
   * @returns {Array<string>} Lista de formatos a tentar (apenas o puro)
   */
  function _tickerFormats(ticker) {
    var clean = _normalizeTicker(ticker);
    var formats = [];
    // 1. Apenas ticker puro (padrão da API: ^[A-Za-z][A-Za-z0-9]{3}\d{0,2}$)
    if (clean && /^[A-Za-z][A-Za-z0-9]{3}\d{0,2}$/.test(clean)) {
      formats.push(clean);
    }
    // 🔧 CORREÇÃO v14.3 (BDRs): A Bolsai indexa BDRs (ex: JBSS32, NVDC34, MELI34, ROXO34)
    // às vezes por códigos diferentes dos usados na B3. Se o ticker for um BDR
    // no formato XXNN32 (J B S S + 32) e retornar 404, tentamos o ticker ordinário
    // correspondente XXNN3 (ex: JBSS32 → JBSS3) como fallback de busca.
    if (clean && /^[A-Za-z]{4}\d{2}$/.test(clean)) {
      var ordinario = clean.slice(0, 4) + '3'; // Fallback: JBSS32 -> JBSS3 (código antigo)
      if (ordinario !== clean) formats.push(ordinario);
    }
    // Fallback: se por algum motivo o ticker já veio com sufixo, tenta o puro
    if (formats.length === 0 && clean) formats.push(clean);
    return formats;
  }

  /**
   * Obtém a cotação atual de um único ticker via Bolsai.
   * Tenta múltiplos formatos de ticker (puro, .SA, .BSP) caso algum dê 404.
   * @param {string} ticker - Ex: 'PETR4' ou 'PETR4.SA'
   * @returns {Object|null} Cotação no formato unificado
   */
  function getQuote(ticker) {
    if (!ticker) return null;
    var clean = _normalizeTicker(ticker);
    if (!clean) return null;

    var cacheKey = 'bolsai_quote_' + clean;
    var cache = CacheService.getScriptCache();
    try {
      var cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) { /* ignore cache read */ }

    // 🔧 CORREÇÃO v14.2+: A Bolsai usa sub-rotas (/quote, /stats). Além disso,
    // para BDRs (ex: JBSS32), tentamos também o ticker ordinário (JBSS3) via
    // _tickerFormats, pois a Bolsai pode indexar sob o código antigo.
    var formats = _tickerFormats(ticker);
    if (formats.length === 0) formats = [clean];

    var quoteEndpoints = [];
    for (var f = 0; f < formats.length; f++) {
      quoteEndpoints.push('stocks/' + formats[f] + '/quote');
      quoteEndpoints.push('stocks/' + formats[f] + '/stats');
    }

    var data = null;
    for (var q = 0; q < quoteEndpoints.length; q++) {
      var tentative = _request(quoteEndpoints[q]);
      if (_extractPrice(tentative) !== null) {
        data = tentative;
        break;
      }
    }

    if (!data) {
      console.warn('⚠️ [Bolsai] Sem dados válidos para ' + clean + ' nos endpoints de cotação.');
      return null;
    }

    var price = _extractPrice(data);
    if (price === null || price <= 0) {
      console.warn('⚠️ [Bolsai] Preço inválido para ' + clean);
      return null;
    }

    var result = {
      ticker: ticker,
      price: price,
      change: (typeof data.daily_change_pct === 'number') ? data.daily_change_pct :
              (typeof data.change_percent === 'number') ? data.change_percent : 0,
      volume: (typeof data.volume === 'number') ? data.volume : 0,
      source: 'Bolsai'
    };

    try { cache.put(cacheKey, JSON.stringify(result), CACHE_TTL); } catch (e) { /* ignore */ }
    return result;
  }

  /**
   * Extrai o preço de uma resposta da API Bolsai (tolerante a diferentes schemas).
   * @param {Object} data - Resposta JSON
   * @returns {number|null} Preço ou null se não encontrar/inválido
   */
  function _extractPrice(data) {
    if (!data) return null;
    // StockQuote real: { close }
    if (typeof data.close === 'number') return data.close;
    if (typeof data.close_price === 'number') return data.close_price;
    if (typeof data.price === 'number') return data.price;
    if (data.quote && typeof data.quote.regularMarketPrice === 'number') return data.quote.regularMarketPrice;
    if (typeof data.regularMarketPrice === 'number') return data.regularMarketPrice;
    if (data.quote && typeof data.quote.close === 'number') return data.quote.close;
    if (data.results && data.results[0] && typeof data.results[0].regularMarketPrice === 'number') return data.results[0].regularMarketPrice;
    if (data.results && data.results[0] && typeof data.results[0].close === 'number') return data.results[0].close;
    return null;
  }

  /**
   * Obtém cotação atual de múltiplos tickers.
   * Bolsai não tem endpoint de lote — fazemos requisição por ticker com pausa.
   * @param {Array<string>} tickers
   * @returns {Object} Mapa TICKER -> { price, change, volume, source }
   */
  function getQuoteBatch(tickers) {
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) return {};

    var results = {};
    var processed = 0;

    for (var i = 0; i < tickers.length; i++) {
      // Circuit breaker: para de processar se abriu
      if (_isCircuitOpen()) {
        console.warn('⏭️ [Bolsai] Circuit breaker aberto. Abortando lote.');
        break;
      }

      var ticker = tickers[i];
      // Pula tickers duplicados
      if (results[ticker]) continue;

      var quote = getQuote(ticker);
      if (quote && quote.price) {
        results[ticker] = {
          price: quote.price,
          change: quote.change,
          volume: quote.volume,
          source: 'Bolsai'
        };
      }

      processed++;
      // Pausa a cada 5 requisições para respeitar rate limits
      if (processed % 5 === 0 && i < tickers.length - 1) {
        Utilities.sleep(500);
      }
    }

    return results;
  }

  /**
   * Obtém histórico OHLCV de um ticker via Bolsai (endpoint PRO).
   * GET /stocks/{ticker}/history
   * @param {string} ticker - Ex: 'PETR4'
   * @param {number} limit - Máximo de candles (padrão 260)
   * @returns {Array|null} Lista de candles OHLCV no formato unificado
   */
  function getHistory(ticker, limit) {
    if (!ticker) return null;
    var clean = _normalizeTicker(ticker);
    if (!clean) return null;

    limit = (typeof limit === 'number' && limit > 0) ? limit : 260;

    var cacheKey = 'bolsai_hist_v15_' + clean;
    var cache = CacheService.getScriptCache();
    try {
      var cached = cache.get(cacheKey);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length >= 18) return parsed;
      }
    } catch (e) { /* ignore cache read */ }

    // 🔧 CORREÇÃO v14.2: Usa apenas o ticker puro (sem .SA/.BSP que causam 422)
    // e tenta variações de query (com/sem limit) caso o parâmetro não seja aceito.
    var formats = _tickerFormats(ticker);
    if (formats.length === 0) formats = [clean];
    var candles = null;

    // Lista de variantes de URL para o histórico
    var historyVariants = [
      'stocks/' + formats[0] + '/history?limit=' + limit,
      'stocks/' + formats[0] + '/history'
    ];

    for (var v = 0; v < historyVariants.length; v++) {
      var raw = _request(historyVariants[v]);
      var normalized = _normalizeHistory(raw, ticker);
      if (normalized && normalized.length >= 18) {
        try { cache.put(cacheKey, JSON.stringify(normalized), CACHE_TTL); } catch (e) { /* ignore */ }
        return normalized;
      }
      candles = null;
    }

    console.warn('⚠️ [Bolsai] Sem histórico válido para ' + clean);
    return null;
  }

  /**
   * Normaliza os candles da resposta Bolsai para o formato OHLCV unificado.
   * Tolerante a diferentes schemas (array direto, data[] , price_history[] ).
   * @param {Object|Array} data - Resposta do endpoint /stocks/{ticker}/history
   * @param {string} ticker - Ticker original
   * @returns {Array|null} Candles normalizados ou null
   */
  function _normalizeHistory(data, ticker) {
    if (!data) return null;

    // Suporta: data direto array, data.data[], data.price_history[]
    var list = null;
    if (Array.isArray(data)) list = data;
    else if (Array.isArray(data.data)) list = data.data;
    else if (Array.isArray(data.price_history)) list = data.price_history;
    else if (Array.isArray(data.historical_data)) list = data.historical_data;
    else if (Array.isArray(data.candles)) list = data.candles;
    else if (Array.isArray(data.results)) list = data.results;
    else if (Array.isArray(data.prices)) list = data.prices;

    if (!list) return null;

    var candles = [];
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (!row) continue;

      // Suporta formato de array de arrays: [date, open, high, low, close, volume]
      if (Array.isArray(row)) {
        if (row.length < 5) continue;
        var cClose = Number(row[4]);
        if (isNaN(cClose) || cClose <= 0) continue;
        candles.push({
          date: row[0] ? String(row[0]) : null,
          open: Number(row[1]) || cClose,
          high: Number(row[2]) || Math.max(Number(row[1] || cClose), cClose),
          low: Number(row[3]) || Math.min(Number(row[1] || cClose), cClose),
          close: cClose,
          volume: Number(row[5]) || 0,
          ticker: ticker
        });
        continue;
      }

      var close = (typeof row.close === 'number') ? row.close :
                  (typeof row.close_price === 'number') ? row.close_price :
                  (typeof row['4. close'] === 'number') ? row['4. close'] :
                  (typeof row.value === 'number') ? row.value : null;
      if (close === null || close <= 0) continue;

      var open = (typeof row.open === 'number') ? row.open :
                 (typeof row['1. open'] === 'number') ? row['1. open'] : close;
      var high = (typeof row.high === 'number') ? row.high :
                 (typeof row['2. high'] === 'number') ? row['2. high'] :
                 (typeof row.max === 'number') ? row.max : Math.max(open, close);
      var low = (typeof row.low === 'number') ? row.low :
                (typeof row['3. low'] === 'number') ? row['3. low'] :
                (typeof row.min === 'number') ? row.min : Math.min(open, close);
      var volume = (typeof row.volume === 'number') ? row.volume :
                   (typeof row['5. volume'] === 'number') ? row['5. volume'] :
                   (typeof row.volume_avg === 'number') ? row.volume_avg : 0;

      // `trade_date` é o campo real da API (StockPriceItem). Formato: 'YYYY-MM-DD'
      var date = row.trade_date || row.date || row.datetime || row.timestamp || row[0] || null;
      var parsedDate = date ? new Date(date) : null;
      if (parsedDate && isNaN(parsedDate.getTime())) parsedDate = null;

      candles.push({
        date: parsedDate ? parsedDate.toISOString() : (date ? String(date) : null),
        open: open,
        high: high,
        low: low,
        close: close,
        volume: volume,
        ticker: ticker
      });
    }

    return candles.length > 0 ? candles : null;
  }

  /**
   * Indica se a chave está configurada (verificação rápida).
   * @returns {boolean}
   */
  function isConfigured() {
    var key = _getApiKey();
    return !!(key && key.length > 5);
  }

  return {
    getQuote: getQuote,
    getQuoteBatch: getQuoteBatch,
    getHistory: getHistory,
    isConfigured: isConfigured
  };
})();
