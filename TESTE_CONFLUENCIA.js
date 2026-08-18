
function TESTAR_CONFLUENCIA_SCORE() {
  console.log("🚀 Testando novo score de confluência...");
  
  // Caso 1: Na zona Fibo + Volume Forte (Deve ter score alto)
  const mockOpForte = {
    ticker: "TESTE_FORTE",
    price: 100,
    score: 50, // Base
    indicators: { adx: 30, rsi: 60, volumeRelativo: 1.6 }
  };
  const estruturaForte = { inFiboZone: true, temConfluencia: true };
  const riscoForte = { rrRealista: 2.0 };
  
  const scoreForte = _calcularScoreSistêmico(100, {adx: 30, rsi: 60, volumeRelativo: 1.6, ema21: 90, ema50: 80, ema200: 70}, estruturaForte, riscoForte, 0, {regime: "BULLISH"});
  console.log("✅ Score Esperado Alto: " + scoreForte);
  
  // Caso 2: Fora da zona Fibo + Volume Fraco (Deve ter score baixo)
  const mockOpFraco = {
    ticker: "TESTE_FRACO",
    price: 100,
    score: 50,
    indicators: { adx: 20, rsi: 50, volumeRelativo: 0.7 }
  };
  const estruturaFraco = { inFiboZone: false, temConfluencia: false };
  const riscoFraco = { rrRealista: 1.0 };
  
  const scoreFraco = _calcularScoreSistêmico(100, {adx: 20, rsi: 50, volumeRelativo: 0.7, ema21: 110, ema50: 120, ema200: 130}, estruturaFraco, riscoFraco, 0, {regime: "BEARISH"});
  console.log("✅ Score Esperado Baixo: " + scoreFraco);
}

// Executa o teste caso a função _calcularScoreSistêmico esteja acessível no contexto
try {
  TESTAR_CONFLUENCIA_SCORE();
} catch (e) {
  console.error("❌ Erro ao rodar teste:", e.message);
}
