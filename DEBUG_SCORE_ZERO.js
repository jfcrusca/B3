
/**
 * Script de Auditoria para Score Zero
 */
function AUDITAR_SCORE_ZERO() {
  var tickers = ["VALE3", "BBAS3", "B3SA3", "SUZB3", "PRIO3", "CMIG4", "RAIL3", "RDOR3", "TRPL4", "CPLE3", "TOTS3", "VIIA3", "ROXO34"];
  
  console.log("🕵️ Iniciando Auditoria de Score Zero...");
  
  tickers.forEach(function(ticker) {
    console.log("\n--- Analisando: " + ticker + " ---");
    try {
      var data = DataService.getMarketData(ticker, "1d", "6mo");
      if (!data || !data.candles || data.candles.length === 0) {
        console.error("❌ Dados ausentes para " + ticker);
        return;
      }
      
      var res = STRATEGY_EVALUATE_CORE({ ticker: ticker, candles: data.candles }, null);
      if (!res) {
        console.error("❌ Falha no STRATEGY_EVALUATE_CORE para " + ticker);
        return;
      }
      
      console.log("📊 Score Final: " + res.score);
      console.log("⚙️ Setup: " + res.setup);
      console.log("📈 RR: " + res.rr);
      console.log("🔍 Indicadores: ADX=" + res.indicators.adx + ", RSI=" + res.indicators.rsi + ", VolRel=" + res.volumeRelativo);
      
      if (res.riskDebug) {
        console.log("🛡️ Gestão de Risco: Stop=" + res.stopLoss + ", Alvo1=" + res.target1 + ", Invalido=" + res.riskDebug.invalidoPorStop);
      }
      
    } catch (e) {
      console.error("💥 Erro ao processar " + ticker + ": " + e.message);
    }
  });
}
