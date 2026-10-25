/**
 * 56_MacroFetcher.js — VERSÃO FINAL ESTÁVEL (BCB + BCBIpeadataFetcher)
 * -------------------------------------------------------------
 * ✔ APIs oficiais: BCB SGS (Selic, Dólar) - sem chave necessária
 * ✔ Fallback: BCBIpeadataFetcher para dados macro oficiais
 * ✔ EWZ (proxy Brasil em NY) via BRAPI - fonte principal do pipeline
 * ✔ Proteção contra XML / erro
 * ✔ Regime unificado (NEUTRAL / DEFENSIVE / BEARISH / BULLISH)
 * ✔ Compatível com Orchestrator + AIEnsemble
 */

var MacroFetcher = (function () {

  // ================================
  // 📡 ENDPOINTS
  // ================================
  // ⚠️ Yahoo Finance removido (bloqueio 401/403 conforme .clinerules)
  // EWZ agora é obtido via BRAPI (fonte principal do pipeline), conforme .clinerules §3.
  const INDICATORS = {
    SELIC: 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json',
    DOLAR: 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json'
  };

  /** Código do ETF iShares MSCI Brazil negociado em NY (proxy de fluxo estrangeiro). */
  const EWZ_TICKER = 'EWZ';
  /** TTL do cache do EWZ: 15 min (intradiário, muda mais que Selic/Dólar). */
  const EWZ_CACHE_TTL_SECONDS = 900;


  // ================================
  // 🔐 FETCH SEGURO
  // ================================
  function fetchJSONSafe(url) {
    try {
      var res = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true
      });

      var text = res.getContentText();

      if (!text || text.length < 5) {
        throw new Error("Resposta vazia");
      }

      // proteção contra XML
      if (text.trim().startsWith("<")) {
        throw new Error("Resposta XML inesperada");
      }

      return JSON.parse(text);

    } catch (e) {
      console.warn("⚠️ fetchJSONSafe falhou:", url, e.message);
      return null;
    }
  }

  // ================================
  // 📊 INDICADORES
  // ================================
  function getSelic() {
    var data = fetchJSONSafe(INDICATORS.SELIC);
    if (!data || !data[0]) return 13.75;
    return parseFloat(data[0].valor);
  }

  function getDolar() {
    var data = fetchJSONSafe(INDICATORS.DOLAR);
    if (!data || !data[0]) return 5.0;
    return parseFloat(data[0].valor);
  }

  /**
   * Obtém a variação percentual do dia do ETF EWZ (iShares MSCI Brazil — NY).
   *
   * ✅ v10.1: Reintegrado via BRAPI (fonte principal do pipeline, .clinerules §3).
   * Obtém o token via Secrets/CONFIG (nunca em texto plano, .clinerules §2).
   * Hierarquia: BrapiFetcher.getQuoteBatch (respeita circuit breaker + RateLimiter)
   *             → chamada BRAPI direta (fallback).
   *
   * @returns {number} Variação % do dia do EWZ ou 0 (NEUTRO) em caso de falha total.
   *                   O retorno 0 mantém o preço do EWZ no summary mesmo sem variação.
   */
  function getEWZVariation() {
    var cacheKey = 'MACRO_EWZ_VAR_V10';

    // 1. Cache persistente (evita gasto de quota em execuções encadeadas)
    try {
      var cached = CacheService.getScriptCache().get(cacheKey);
      if (cached !== null && cached !== undefined) {
        var cachedData = JSON.parse(cached);
        if (cachedData && typeof cachedData.change === 'number') {
          console.log('📦 [MacroFetcher] EWZ do cache: ' + cachedData.change.toFixed(2) + '%');
          return cachedData.change;
        }
      }
    } catch (e) { /* cache indisponível, segue para a API */ }

    // 2. BrapiFetcher (preferencial: já tem circuit breaker de falhas + RateLimiter)
    try {
      if (typeof BrapiFetcher !== 'undefined' && typeof BrapiFetcher.getQuoteBatch === 'function') {
        var batch = BrapiFetcher.getQuoteBatch([EWZ_TICKER]);
        if (batch && batch[EWZ_TICKER] && typeof batch[EWZ_TICKER].change === 'number') {
          var changeBrapi = batch[EWZ_TICKER].change;
          _cacheEWZVariation(cacheKey, changeBrapi, batch[EWZ_TICKER].price);
          console.log('📈 [MacroFetcher] EWZ (BrapiFetcher): ' + changeBrapi.toFixed(2) + '%');
          return changeBrapi;
        }
      }
    } catch (e) {
      console.warn('⚠️ [MacroFetcher] BrapiFetcher indisponível para EWZ: ' + e.message);
    }

    // 3. Chamada direta à BRAPI (fallback)
    var direct = _fetchEWZDirect();
    if (direct !== null) {
      _cacheEWZVariation(cacheKey, direct, null);
      console.log('📈 [MacroFetcher] EWZ (BRAPI direto): ' + direct.toFixed(2) + '%');
      return direct;
    }

    // 4. Falha total: 0 (NEUTRO) — não distorce o regime macro
    console.warn('⚠️ [MacroFetcher] EWZ indisponível. Usando variação neutra (0%) no regime.');
    return 0;
  }

  /**
   * Grava o resultado do EWZ no cache compartilhado (change + preço).
   * @param {string} cacheKey
   * @param {number} change Variação % do dia
   * @param {number|null} price Preço atual (opcional)
   */
  function _cacheEWZVariation(cacheKey, change, price) {
    try {
      CacheService.getScriptCache().put(cacheKey, JSON.stringify({
        change: change,
        price: price
      }), EWZ_CACHE_TTL_SECONDS);
    } catch (e) { /* cache é otimização, não requisito */ }
  }

  /**
   * Fallback: consulta BRAPI direto para o EWZ, lendo o token de forma segura.
   * @returns {number|null} Variação % do dia ou null se a chamada falhar.
   */
  function _fetchEWZDirect() {
    var token = null;
    try {
      if (typeof Secrets !== 'undefined' && typeof Secrets.getSecret === 'function') {
        token = Secrets.getSecret('BRAPI_TOKEN');
      }
      if (!token && typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') {
        token = CONFIG.getSecret('BRAPI_TOKEN');
      }
    } catch (e) {
      console.warn('⚠️ [MacroFetcher] Falha ao obter BRAPI_TOKEN: ' + e.message);
    }

    if (!token) {
      console.warn('⚠️ [MacroFetcher] BRAPI_TOKEN não configurado. EWZ desativado.');
      return null;
    }

    var url = 'https://brapi.dev/api/quote/' + EWZ_TICKER + '?token=' + token;
    try {
      var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) {
        console.warn('⚠️ [MacroFetcher] BRAPI EWZ HTTP ' + res.getResponseCode());
        return null;
      }
      var json = JSON.parse(res.getContentText());
      var quotes = (json && json.results) ? json.results : null;
      if (!quotes || !quotes[0]) return null;

      var variacao = quotes[0].regularMarketChangePercent;
      return (typeof variacao === 'number') ? variacao : null;
    } catch (e) {
      console.warn('⚠️ [MacroFetcher] Falha na chamada direta BRAPI (EWZ): ' + e.message);
      return null;
    }
  }


  // ================================
  // 🧠 REGIME MACRO (Selic + Dólar + EWZ)
  // ================================
  // ✅ v10.1: EWZ reintegrado via BRAPI como fator SECUNDÁRIO.
  // Efeito (adicional, não substitui as regras de Selic/Dólar):
  //   • BULLISH : EWZ sobe >1,5% no dia → confirma apetite por Brasil
  //   • DEFENSIVE: EWZ cai >1,5% no dia → estrangeiro saindo do Brasil
  //   • BEARISH : EWZ cai >3,0% no dia → pânico (mesmo com Selic moderada)
  // Movimentos menores que 1,5% são ignorados (ruído intradiário).
  function calcularRegime(selic, dolar, ewzVar) {
    var ewz = (typeof ewzVar === 'number' && isFinite(ewzVar)) ? ewzVar : 0;

    // 🔴 BEARISH: Selic extremamente alta (>15%) OU dólar disparado (risco fiscal/cambial)
    // CORREÇÃO v2: Selic 14.25% não é BEARISH, é DEFENSIVE (juros altos mas controle fiscal)
    if (selic > 15.0) return "BEARISH";
    if (selic > 13.0 && dolar > 6.5) return "BEARISH";
    if (dolar > 7.0) return "BEARISH";
    if (ewz < -3.0) return "BEARISH"; // Fluxo estrangeiro em pânico

    // 🟡 DEFENSIVE: Juros elevados OU dólar pressionado
    // CORREÇÃO v2: Selic entre 12% e 15% é DEFENSIVE, não BEARISH
    if (selic > 12.0) return "DEFENSIVE";
    if (dolar > 5.8) return "DEFENSIVE";
    if (ewz < -1.5) return "DEFENSIVE"; // Saída relevante de capital externo

    // 🟢 BULLISH: Juros baixos e dólar controlado
    if (selic < 11.5 && dolar < 5.2) return "BULLISH";
    if (ewz > 1.5 && selic < 12.0) return "BULLISH"; // Entrada de capital externo

    // padrão
    return "NEUTRAL";
  }



  // ================================
  // 🎯 CONTEXTO MACRO COMPLETO (COM CACHE DUPLO)
  // ================================
  var CACHED_CONTEXT = null; // Cache em memória (escopo de execução)
  const CACHE_KEY = "MACRO_CONTEXT_V10";
  const CACHE_TTL_SECONDS = 300; // 5 minutos de cache persistente para maior agilidade

  function getMacroContext() {
    // 1. Tentar cache em memória local da mesma execução (Velocidade instantânea)
    if (CACHED_CONTEXT) {
      return CACHED_CONTEXT;
    }

    // 2. Tentar cache persistente (CacheService) entre execuções
    try {
      var cached = CacheService.getScriptCache().get(CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.regime) {
          CACHED_CONTEXT = parsed;
          console.log("📦 [MacroFetcher] Cache hit persistente: " + parsed.summary);
          return parsed;
        }
      }
    } catch (e) {
      console.warn("⚠️ CacheService falhou no MacroFetcher:", e.message);
    }

    // 3. Fallback: Consulta real às APIs externas (apenas se o cache expirar ou estiver vazio)
    try {
      console.log("📡 [MacroFetcher] Buscando dados macro atualizados das APIs públicas...");
      var selic = getSelic();
      var dolar = getDolar();
      var ewzVar = getEWZVariation();

      var regime = calcularRegime(selic, dolar, ewzVar);


      var context = {
        selic: selic,
        dolar: dolar,
        ewzVariation: ewzVar,
        regime: regime,
        adjustment: getRiskAdjustmentInternal(regime),
        timestamp: new Date()
      };

      // ✅ summary (CRÍTICO pro resto do sistema)
      context.summary =
        "Selic: " + selic.toFixed(2) + "% | " +
        "Dólar: R$ " + dolar.toFixed(2) + " | " +
        "EWZ: " + ewzVar.toFixed(2) + "% | " +
        "Regime: " + regime;

      // Gravar no cache persistente por 1 hora
      try {
        CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(context), CACHE_TTL_SECONDS);
      } catch (cacheErr) {
        console.warn("⚠️ Falha ao escrever no CacheService:", cacheErr.message);
      }

      CACHED_CONTEXT = context;
      return context;

    } catch (e) {
      console.error("❌ getMacroContext falhou:", e.message);

      return {
        selic: 13.75,
        dolar: 5.0,
        ewzVariation: 0,
        regime: "NEUTRAL",
        adjustment: 1.0,
        summary: "Fallback macro ativo",
        timestamp: new Date()
      };
    }
  }

  // ================================
  // 📉 AJUSTE DE RISCO
  // ================================
  function getRiskAdjustmentInternal(regime) {
    if (regime === "BEARISH") return 0.80;
    if (regime === "DEFENSIVE") return 0.95; // Fator de ajuste suave para mercado defensivo
    if (regime === "BULLISH") return 1.1;
    return 1.0;
  }

  function getRiskAdjustment() {
    var ctx = getMacroContext();
    return ctx.adjustment;
  }

  // ================================
  // 🚀 EXPORT
  // ================================
  return {
    getMacroContext: getMacroContext,
    getRiskAdjustment: getRiskAdjustment
  };

})();

// Função de teste
function TESTAR_MACRO() {
  const contexto = MacroFetcher.getMacroContext();
  console.log("📊 CONTEXTO MACRO:");
  console.log(JSON.stringify(contexto, null, 2));
  console.log("\n✅ Ajuste de Risco:", MacroFetcher.getRiskAdjustment());

  // Diagnóstico do EWZ (integração BRAPI v10.1)
  try {
    var ewzBrapi = null;
    if (typeof BrapiFetcher !== 'undefined' && typeof BrapiFetcher.getQuoteBatch === 'function') {
      ewzBrapi = BrapiFetcher.getQuoteBatch(['EWZ'])['EWZ'];
    }
    if (ewzBrapi) {
      console.log("📈 EWZ (BRAPI):", ewzBrapi.price, "| variação:", ewzBrapi.change + "%");
    } else {
      console.warn("⚠️ EWZ não retornado pelo BRAPI (verifique BRAPI_TOKEN / quota).");
    }
  } catch (e) {
    console.warn("⚠️ Falha ao consultar EWZ:", e.message);
  }
}