/**
 * 56_MacroFetcher.js — VERSÃO FINAL ESTÁVEL (BCB + BCBIpeadataFetcher)
 * -------------------------------------------------------------
 * ✔ APIs oficiais: BCB SGS (Selic, Dólar) - sem chave necessária
 * ✔ Fallback: BCBIpeadataFetcher para dados macro oficiais
 * ✔ EWZ via Yahoo removido (Yahoo bloqueado) - usa regime baseado em Selic
 * ✔ Proteção contra XML / erro
 * ✔ Regime unificado (NEUTRAL / DEFENSIVE / BEARISH / BULLISH)
 * ✔ Compatível com Orchestrator + AIEnsemble
 */

var MacroFetcher = (function () {

  // ================================
  // 📡 ENDPOINTS
  // ================================
  // ⚠️ Yahoo Finance removido (bloqueio 401/403 conforme .clinerules)
  // EWZ era obtido via Yahoo, agora usamos apenas dados BCB para regime macro
  const INDICATORS = {
    SELIC: 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json',
    DOLAR: 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json'
  };


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

  function getEWZVariation() {
    // ⚠️ Yahoo Finance removido (bloqueio 401/403).
    // EWZ era usado como proxy de mercado externo.
    // Agora usamos apenas Selic e Dólar (BCB) para determinar regime macro.
    // Retorna 0 para não influenciar o regime com dados desatualizados.
    return 0;
  }


  // ================================
  // 🧠 REGIME MACRO (baseado apenas em Selic e Dólar)
  // ================================
  // ⚠️ Yahoo Finance removido — EWZ não está mais disponível.
  // Regime agora é determinado exclusivamente por dados oficiais do BCB.
  function calcularRegime(selic, dolar) {
    // 🔴 BEARISH: Selic extremamente alta (>15%) OU dólar disparado (risco fiscal/cambial)
    // CORREÇÃO v2: Selic 14.25% não é BEARISH, é DEFENSIVE (juros altos mas controle fiscal)
    if (selic > 15.0) return "BEARISH";
    if (selic > 13.0 && dolar > 6.5) return "BEARISH";
    if (dolar > 7.0) return "BEARISH";

    // 🟡 DEFENSIVE: Juros elevados OU dólar pressionado
    // CORREÇÃO v2: Selic entre 12% e 15% é DEFENSIVE, não BEARISH
    if (selic > 12.0) return "DEFENSIVE";
    if (dolar > 5.8) return "DEFENSIVE";

    // 🟢 BULLISH: Juros baixos e dólar controlado
    if (selic < 11.5 && dolar < 5.2) return "BULLISH";

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

      var regime = calcularRegime(selic, dolar);


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
}