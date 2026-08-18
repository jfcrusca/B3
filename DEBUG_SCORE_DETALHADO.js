
/**
 * Script de Auditoria de Score Zero v3
 * Captura componentes detalhados do score sistêmico.
 * ⚠️ Espelha as regras ATUAIS de 22_Core_Analyzers.js (v11):
 *    ADX < 20: -25 | Volume: faixas 2.0/1.5/1.2/1.0/0.7 + veto < 0.6 +
 *    TETO -20 confirmado p/ alta liquidez (Tier 1) com VR < 0.7.
 */
function AUDITAR_DETALHADO_SCORE_ZERO() {
  var tickers = ["VALE3", "BBAS3", "B3SA3", "SUZB3", "PRIO3", "CMIG4", "RAIL3", "RDOR3", "TRPL4", "CPLE3", "TOTS3", "BHIA3", "ROXO34"];
  // 🔧 Remove tickers inativos/alterados antes de auditar (defensivo; ex.: VIIA3 → BHIA3)
  if (typeof B3V10_TICKER_MANAGER !== 'undefined' && typeof B3V10_TICKER_MANAGER.filterDead === 'function') {
    tickers = B3V10_TICKER_MANAGER.filterDead(tickers);
  }
  var report = "# 🕵️ Auditoria Detalhada de Score Zero\n\n";
  
  tickers.forEach(function(ticker) {
    try {
      var data = DataService.getMarketData(ticker, "1d", "6mo");
      if (!data || !data.candles) return;
      
      var candles = data.candles;
      var context = _obterContextoPrecos(candles);
      var last = candles[candles.length - 1];
      var ind = _calcularIndicadoresTecnicos(candles, context.closes);
      var est = _analisarEstruturaMercado(context, last.close, ind, candles);
      var rsc = _processarGestaoRisco(last.close, ind.atr, est, candles, context.closes);
      
      // Simular _calcularScoreSistêmico com logs manuais
      var s = 30;
      var logs = [];
      logs.push("Base: 30");
      
      if (ind.adx >= 30) { s += 25; logs.push("ADX >= 30: +25"); }
      else if (ind.adx >= 25) { s += 20; logs.push("ADX >= 25: +20"); }
      else if (ind.adx >= 22) { s += 12; logs.push("ADX >= 22: +12"); }
      else if (ind.adx >= 20) { s += 5; logs.push("ADX >= 20: +5"); }
      else { s -= 25; logs.push("ADX < 20: -25"); }
      
      if (last.close > ind.ema21) { s += 10; logs.push("Preço > EMA21: +10"); }
      if (ind.ema21 > ind.ema50) { s += 10; logs.push("EMA21 > EMA50: +10"); }
      if (last.close > ind.ema200 && ind.ema200 > 0) { s += 10; logs.push("Preço > EMA200: +10"); }
      if (last.close > ind.ema21 && ind.ema21 > ind.ema50 && ind.ema50 > ind.ema200) { s += 15; logs.push("Alinhamento EMA21>EMA50>EMA200: +15"); }
      
      if (ind.rsi >= 55 && ind.rsi <= 70) { s += 20; logs.push("RSI 55-70: +20"); }
      else if (ind.rsi >= 50 && ind.rsi < 55) {
        if (ind.adx >= 28) { s += 10; logs.push("RSI 50-55 c/ ADX forte: +10"); }
        else { s += 5; logs.push("RSI 50-55: +5"); }
      }
      else if (ind.rsi >= 45 && ind.rsi < 50) {
        if (ind.adx >= 30) { s += 5; logs.push("RSI 45-50 c/ ADX >= 30: +5"); }
      }
      else if (ind.rsi > 70) { s -= 20; logs.push("RSI > 70: -20"); }
      else if (ind.rsi < 40) { s -= 15; logs.push("RSI < 40: -15"); }
      
      var volumePenalidade = 0;
      if (ind.volumeRelativo >= 2.0) { s += 25; logs.push("VolRel >= 2.0: +25"); }
      else if (ind.volumeRelativo >= 1.5) { s += 20; logs.push("VolRel >= 1.5: +20"); }
      else if (ind.volumeRelativo >= 1.2) { s += 12; logs.push("VolRel >= 1.2: +12"); }
      else if (ind.volumeRelativo >= 1.0) { s += 5; logs.push("VolRel >= 1.0: +5"); }
      else if (ind.volumeRelativo >= 0.7) { volumePenalidade -= 15; logs.push("VolRel 0.7-1.0: -15"); }
      else { volumePenalidade -= 30; logs.push("VolRel < 0.7: -30"); }

      // Veto de iliquidez (VR < 0.6) — Blue Chips (Tier 1) têm penalidade moderada
      var isHighlyLiquid = false;
      if (typeof B3V10_TICKER_MANAGER !== "undefined") {
        var tier1 = B3V10_TICKER_MANAGER.getTier1();
        if (tier1.indexOf(ticker) !== -1) isHighlyLiquid = true;
      }
      if (ind.volumeRelativo < 0.6) {
        if (isHighlyLiquid) { volumePenalidade -= 5; logs.push("VolRel < 0.6 + liquida: veto -5"); }
        else { volumePenalidade -= 30; logs.push("VolRel < 0.6 + iliquida: veto -30"); }
      }

      // 🔧 Teto -20 confirmado: alta liquidez (Tier 1) com VR < 0.7
      if (isHighlyLiquid && ind.volumeRelativo < 0.7) {
        volumePenalidade = Math.max(volumePenalidade, -20);
        logs.push("Teto -20 (Tier 1, VR < 0.7): penalidade final -20");
      }
      s += volumePenalidade;

      // 11. OBV (VOTO DE FLUXO INSTITUCIONAL) — espelha 22_Core_Analyzers.js (moderado, nunca veto)
      var regimeDebug = (typeof MacroFetcher !== 'undefined' && typeof MacroFetcher.getMacroContext === 'function')
        ? MacroFetcher.getMacroContext().regime : 'NEUTRAL';
      if (ind.obvScore === -1) {
        var obvPenaltyDebug = 5; // distribuição geral (leve)
        if (ind.rsi >= 68) { obvPenaltyDebug = 15; }
        else if (rsc && rsc.rrRealista >= 2.0 && ind.adx >= 25) { obvPenaltyDebug = 10; }
        if (regimeDebug === 'DEFENSIVE') obvPenaltyDebug = Math.ceil(obvPenaltyDebug / 2);
        s -= obvPenaltyDebug;
        logs.push("OBV Distribuição: -" + obvPenaltyDebug + (regimeDebug === 'DEFENSIVE' ? " (regime DEFENSIVE)" : ""));
      } else if (ind.obvScore === 1 && ind.adx >= 25) {
        s += 5;
        logs.push("OBV Acumulação + ADX forte: +5");
      }
      
      if (rsc && rsc.rrRealista >= 4.0) { s += 20; logs.push("RR >= 4.0: +20"); }
      else if (rsc && rsc.rrRealista >= 3.0) { s += 15; logs.push("RR >= 3.0: +15"); }
      else if (rsc && rsc.rrRealista >= 2.5) { s += 10; logs.push("RR >= 2.5: +10"); }
      else if (rsc && rsc.rrRealista >= 2.0) { s += 5; logs.push("RR >= 2.0: +5"); }
      else if (rsc && rsc.rrRealista >= 1.8) { s -= 10; logs.push("RR 1.8-2.0: -10"); }
      else if (rsc && rsc.rrRealista < 1.8) { s -= 50; logs.push("RR < 1.8: -50"); }
      if (rsc && rsc.invalidoPorStop) { s -= 50; logs.push("Stop Inválido: -50"); }
      
      var scoreFinal = Math.min(100, Math.max(0, Math.round(s)));
      
      report += "## " + ticker + "\n";
      report += "- **Score Final:** " + scoreFinal + "\n";
      // 🔧 RR Gate: mostra se o ativo passaria no filtro mínimo do Orchestrator
      // (min 2.0, ou 1.8 com ADX >= 30 e VolRel >= 1.5). Se reprovado, o score
      // aqui é apenas informativo — o ativo nem chegaria ao score no pipeline.
      var minRRGate = 2.0;
      if (ind.adx >= 30 && ind.volumeRelativo >= 1.5) minRRGate = 1.8;
      var passaRRGate = (rsc && rsc.rrRealista >= minRRGate);
      report += "- **RR Gate (min " + minRRGate + "):** " + (passaRRGate ? "✅ Aprovado" : "❌ Reprovado (não chegaria ao score no pipeline)") + "\n";
      report += "- **Componentes:**\n  - " + logs.join("\n  - ") + "\n";
      report += "- **Indicadores:** ADX=" + ind.adx.toFixed(2) + ", RSI=" + ind.rsi.toFixed(2) + ", VolRel=" + ind.volumeRelativo.toFixed(2) + ", RR=" + rsc.rrRealista + "\n\n";
      
    } catch (e) {
      report += "## " + ticker + " (ERRO)\n- " + e.message + "\n\n";
    }
  });
  
  console.log(report);
}
