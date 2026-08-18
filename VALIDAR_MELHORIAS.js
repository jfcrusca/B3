
/**
 * Script de Validação de Melhorias de Score (Antes x Depois)
 */
function VALIDAR_MELHORIAS_SCORE() {
  var tickers = ["VALE3", "BBAS3", "PRIO3", "B3SA3", "TOTS3", "VIIA3"];
  var report = "# 📊 RELATÓRIO DE REBALANCEAMENTO DO MOTOR DE SCORE\n\n";
  report += "| Ativo | Score Anterior (Est.) | Novo Score (Simulado) | Setup Anterior | Novo Setup | Impacto |\n";
  report += "|-------|-----------------------|------------------------|----------------|------------|---------|\n";

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
      
      // 1. Simular Score ANTERIOR (Regras antigas)
      var sOld = 30;
      if (ind.adx < 20) sOld -= 45;
      else if (ind.adx >= 25) sOld += 20;
      
      if (ind.volumeRelativo < 0.6) sOld -= 60;
      else if (ind.volumeRelativo >= 1.0) sOld += 5;
      
      var scoreOld = Math.min(100, Math.max(0, Math.round(sOld)));
      
      // 2. Simular Score NOVO (Regras atuais implementadas)
      var resNovo = STRATEGY_EVALUATE_CORE({ ticker: ticker, candles: candles }, null);
      var scoreNew = resNovo.score;
      
      var impacto = (scoreNew - scoreOld);
      var statusImpacto = impacto > 0 ? "🚀 +" + impacto : (impacto < 0 ? "🔻 " + impacto : "➡️ 0");
      
      report += "| " + ticker + " | " + scoreOld + " | " + scoreNew + " | - | " + resNovo.setup + " | " + statusImpacto + " |\n";
      
    } catch (e) {
      report += "| " + ticker + " | ERRO | " + e.message + " | - | - | - |\n";
    }
  });
  
  console.log(report);
  return report;
}
