/**
 * 25_Fundamentalist_Engine.gs
 * Especialista em Valuation e Margem de Segurança
 */
var ValuationEngine = (function() {
  
  function getValuationBonus(ticker) {
    try {
      // 1. Busca dados do Yahoo Finance (Quote Summary)
      const data = fetchFundamentalData(ticker);
      if (!data) return 0;

      let bonus = 0;
      const pl = data.trailingPE;
      const dy = data.dividendYield * 100; // Converte para %

      // Lógica de Caçador de Ofertas (Prioridade P/L)
      if (pl > 0 && pl <= 6) bonus += 15;
      else if (pl > 6 && pl <= 12) bonus += 10;
      else if (pl > 12 && pl <= 20) bonus += 5;
      else if (pl < 0) bonus -= 10; // Empresa dando prejuízo

      // Bônus Secundário (Dividendos como colchão)
      if (dy >= 8) bonus += 5;

      return bonus;
    } catch (e) {
      return 0; // Fallback seguro: se falhar, o bônus é zero.
    }
  }

  return { getValuationBonus };
})();