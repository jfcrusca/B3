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

  // 🔧 v14.3 (ANTI-TIMEOUT / OPÇÃO C): Cache de endpoints que retornaram 404/erro
  // permanente para um dado ticker. Evita repetir a MESMA requisição inútil na
  // mesma execução: hoje o getHistory tenta 2 variantes de URL e o getQuote tenta
  // até 4 endpoints (2 formatos × /quote + /stats), gastando round-trips que já
  // sabemos que vão falhar. Chave: 'TICKER|endpoint'. Valor: timestamp da falha.
  var _endpointMissCache = {};
  var ENDPOINT_MISS_TTL_MS = 600000; // 10 min (mesma ordem do CACHE_TTL de 5 min, com folga)

  // 🔧 v14.3: requisições de rede efetivamente disparadas nesta execução
  // (instrumentação para medir o ganho da otimização nos logs).
  var _metrics = { requests: 0, cacheHits: 0, missesEvitados: 0 };

  /** 🔧 v14.3: Verifica se um endpoint já falhou recentemente para o ticker. */
  function _isEndpointMiss(ticker, endpoint) {
    var k = ticker + '|' + endpoint;
    var ts = _endpointMissCache[k];
    if (ts && (Date.now() - ts) < ENDPOINT_MISS_TTL_MS) return true;
    return false;
  }

  /** 🔧 v14.3: Registra que um endpoint falhou (só para erros PERMANENTES). */
  function _markEndpointMiss(ticker, endpoint) {
    _endpointMissCache[ticker + '|' + endpoint] = Date.now();
  }

  /**
   * 🔧 v14.3: Resultado de uma tentativa de requisição com classificação de erro.
   * Distinguir 404 (permanente: não repetir) de 429/5xx (transitório: pode repetir)
   * é o que permite cortar o desperdício sem quebrar o fallback legítimo.
   * @param {string} endpoint
   * @param {string} ticker
   * @returns {{data: (Object|null), permanente: (boolean|null)}} permanente=true
   *          quando o endpoint não deve mais ser tentado para este ticker.
   */
  function _requestClassificado(endpoint, ticker) {
    if (_isEndpointMiss(ticker, endpoint)) {
      _metrics.missesEvitados++;
      console.log('⏭️ [Bolsai] Pulando ' + endpoint + ' para ' + ticker + ' (404 recente em cache)');
      return { data: null, permanente: true };
    }
    if (_isCircuitOpen()) {
      console.warn('⏭️ [Bolsai] Circuit breaker ABERTO. Pulando ' + endpoint);
      return { data: null, permanente: false };
    }

    var key = _getApiKey();
    if (!key) {
      console.warn('⚠️ [Bolsai] BOLSAI_KEY não configurada. Pule fallback Bolsai.');
      return { data: null, permanente: false };
    }

    var url = BASE_URL + '/' + endpoint;
    var options = {
      method: 'get',
      headers: { 'X-API-Key': key, 'Accept': 'application/json' },
      muteHttpExceptions: true
    };

    try {
      _metrics.requests++;
      var response = UrlFetchApp.fetch(url, options);
      var code = response.getResponseCode();

      if (code === 200) {
        _consecutive429 = 0;
        return { data: JSON.parse(response.getContentText()), permanente: null };
      }

      if (code === 429) {
        _consecutive429++;
        if (_consecutive429 >= 3) {
          _circuitOpen = true;
          _circuitOpenTime = Date.now();
          console.error('bolsai Circuit breaker ATIVADO apos 3 falhas 429.');
        }
        console.warn('bolsai Rate limit (429) para ' + endpoint + ' (tentativa ' + _consecutive429 + '/3)');
        return { data: null, permanente: false }; // transitório — pode repetir
      }

      if (code === 404 || code === 422) {
        // Permanente: o recurso não existe com este formato. Não repetir.
        _markEndpointMiss(ticker, endpoint);
        console.warn('bolsai HTTP ' + code + ' para ' + endpoint + ' (marcado como inexistente)');
        return { data: null, permanente: true };
      }

      console.warn('bolsai HTTP ' + code + ' para ' + endpoint);
      return { data: null, permanente: false };
    } catch (e) {
      console.warn('bolsai Excecao em ' + endpoint + ': ' + e.message);
      return { data: null, permanente: false };
    }
  }

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
   * 🔧 v14.3 (OPÇÃO C): _request() legado REMOVIDO. Toda chamada de rede passa
   * por _requestClassificado(), que distingue erro PERMANENTE (404/422 — não
   * repetir) de TRANSITÓRIO (429/5xx/rede — pode repetir) e alimenta o
   * _endpointMissCache. Sem essa classificação, cada ticker gastava até 6
   * round-trips na Bolsai (2 variantes de /history + 2 formatos × /quote+/stats).
   */

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
    // 🔧 v14.3 (OPÇÃO C): Se o PRIMEIRO formato (canônico) funciona, os formatos
    // alternativos (código ordinário do BDR) NÃO são tentados em /quote e /stats
    // de novo — cortando requisições redundantes.
    var formats = _tickerFormats(ticker);
    if (formats.length === 0) formats = [clean];

    var data = null;

    // Passo 1: para CADA formato, tenta o endpoint canônico /quote.
    // Só avança ao próximo formato se o /quote do anterior falhar PERMANENTEMENTE.
    for (var f = 0; f < formats.length; f++) {
      var epQuote = 'stocks/' + formats[f] + '/quote';
      var rq = _requestClassificado(epQuote, clean);
      if (_extractPrice(rq.data) !== null) {
        data = rq.data;
        break;
      }
      // Erro transitório (429/rede): não faz sentido tentar o formato alternativo
      // agora — as condições de rede não mudaram. Encerra o loop.
      if (rq.permanente !== true) break;
      // permanente === true → formato inexistente. Tenta o alternativo (BDR).
    }

    // Passo 2: SÓ se o /quote falhou permanentemente em TODOS os formatos,
    // tenta /stats (que é um endpoint diferente, não uma redundância).
    if (!data && _extractPrice(data) === null) {
      for (var f2 = 0; f2 < formats.length; f2++) {
        var epStats = 'stocks/' + formats[f2] + '/stats';
        var rs = _requestClassificado(epStats, clean);
        if (_extractPrice(rs.data) !== null) {
          data = rs.data;
          break;
        }
        if (rs.permanente !== true) break;
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
    // 🔧 v14.3 (OPÇÃO C): As variantes agora são tentadas com CLASSIFICAÇÃO de erro.
    // A variante 2 (sem `?limit`) só é tentada se a variante 1 falhar
    // PERMANENTEMENTE (404/422 — ex.: o parâmetro `limit` foi rejeitado). Em erro
    // transitório (429/rede), repetir a MESMA rota sem o parâmetro é desperdício
    // puro de round-trip, pois a condição de falha é idêntica.
    var formats = _tickerFormats(ticker);
    if (formats.length === 0) formats = [clean];

    // Lista de variantes de URL para o histórico (ordem: mais específica primeiro)
    var historyVariants = [
      { ep: 'stocks/' + formats[0] + '/history?limit=' + limit },
      { ep: 'stocks/' + formats[0] + '/history' }
    ];

    for (var v = 0; v < historyVariants.length; v++) {
      var rq = _requestClassificado(historyVariants[v].ep, clean);
      var normalized = _normalizeHistory(rq.data, ticker);
      if (normalized && normalized.length >= 18) {
        try { cache.put(cacheKey, JSON.stringify(normalized), CACHE_TTL); } catch (e) { /* ignore */ }
        return normalized;
      }
      // Transitório → não insiste nas outras variantes da MESMA rota.
      if (rq.permanente !== true) break;
    }

    // 🔧 v14.3: Último recurso para BDRs — se TODAS as variantes do formato
    // canônico falharam permanentemente e existe um formato alternativo
    // (ex.: JBSS32 → JBSS3), tenta o histórico do código alternativo.
    if (formats.length > 1) {
      for (var f = 1; f < formats.length; f++) {
        var epAlt = 'stocks/' + formats[f] + '/history?limit=' + limit;
        var rqAlt = _requestClassificado(epAlt, clean);
        var normAlt = _normalizeHistory(rqAlt.data, ticker);
        if (normAlt && normAlt.length >= 18) {
          console.log('📡 [Bolsai] Histórico obtido via código alternativo ' + formats[f] + ' para ' + clean);
          try { cache.put(cacheKey, JSON.stringify(normAlt), CACHE_TTL); } catch (e) { /* ignore */ }
          return normAlt;
        }
      }
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

  /**
   * 🔧 v14.3: SNAPSHOT das métricas de rede desta execução. Usado para medir o
   * ganho da Opção C (corte de desperdício) nos logs do orchestrator.
   * @returns {{requests: number, cacheHits: number, missesEvitados: number}}
   */
  function getMetrics() {
    return {
      requests: _metrics.requests,
      cacheHits: _metrics.cacheHits,
      missesEvitados: _metrics.missesEvitados
    };
  }

  /**
   * 🔧 v14.3: Reset das métricas (chamado no início de cada pipeline, para que o
   * log reflita apenas a execução corrente).
   */
  function resetMetrics() {
    _metrics.requests = 0;
    _metrics.cacheHits = 0;
    _metrics.missesEvitados = 0;
  }

  return {
    getQuote: getQuote,
    getQuoteBatch: getQuoteBatch,
    getHistory: getHistory,
    isConfigured: isConfigured,
    // 🔧 v14.3 (OPÇÃO C): instrumentação do corte de desperdício
    getMetrics: getMetrics,
    resetMetrics: resetMetrics
  };
})();
