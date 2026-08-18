/**
 * 53_CandlePatternScanner.gs — Motor de Price Action B3
 * =============================================================================
 * ✅ AUTONOMIA: Detecta padrões de alta probabilidade para o mercado brasileiro.
 * ✅ FOCO: Reversões em suportes e Gaps de exaustão.
 * ✅ DINÂMICO: Retorna impacto positivo ou negativo no score técnico.
 */

var CandlePatternScanner = {

  analyze: function(candles) {
    if (!candles || candles.length < 3) return { pattern: "NEUTRO", bonus: 0, reason: "" };

    const c1 = candles[candles.length - 1]; // Candle atual (fechado)
    const c2 = candles[candles.length - 2]; // Candle anterior
    const c3 = candles[candles.length - 3]; // Dois atrás

    // Metadados do Candle Atual
    const body = Math.abs(c1.close - c1.open);
    const range = c1.high - c1.low;
    const upperWick = c1.high - Math.max(c1.open, c1.close);
    const lowerWick = Math.min(c1.open, c1.close) - c1.low;
    const isBullish = c1.close > c1.open;

    // 1. PIN BAR (A "Agulhada") - Rejeição extrema
    // O pavio deve ser pelo menos 70% do tamanho total do candle
    if (lowerWick > (range * 0.7) && isBullish) {
      return { pattern: "BULLISH_PINBAR", bonus: 25, reason: "📍 Pin Bar de Alta: Rejeição forte de fundo detectada." };
    }
    if (upperWick > (range * 0.7) && !isBullish) {
      return { pattern: "BEARISH_PINBAR", bonus: -30, reason: "📍 Pin Bar de Baixa: Rejeição de topo (possível topo duplo/exaustão)." };
    }

    // 2. ENGOLFO TÁTICO (Engulfing) - Mudança de fluxo
    const isEngolfoAlta = isBullish && (c2.close < c2.open) && (c1.close > c2.open) && (c1.open < c2.close);
    if (isEngolfoAlta) {
      return { pattern: "ENGOLFO_ALTA", bonus: 20, reason: "🌊 Engolfo de Alta: Fluxo comprador dominou o vendedor anterior." };
    }

    // 3. GAP DE EXAUSTÃO (Comum na B3)
    // Se o ativo abre com gap de alta longe da média, mas fecha deixando pavio superior
    const gapAbertura = c1.open - c2.close;
    if (gapAbertura > (c2.close * 0.015) && upperWick > body) {
       return { pattern: "GAP_EXAUSTAO", bonus: -25, reason: "⚠️ Gap de Exaustão: Abertura eufórica com rejeição imediata. Perigo de correção." };
    }

    // 4. INSIDE BAR (Padrão de Volatilidade Contida)
    // O candle atual está totalmente dentro do candle anterior
    const isInsideBar = (c1.high < c2.high) && (c1.low > c2.low);
    if (isInsideBar) {
      return { pattern: "INSIDE_BAR", bonus: 0, reason: "📦 Inside Bar: Compressão de volatilidade. Aguardando rompimento." };
    }

    // 5. MARUBOZU (Convicção de Momentum)
    if (body > (range * 0.9) && range > 0) {
      return { 
        pattern: isBullish ? "MARUBOZU_ALTA" : "MARUBOZU_BAIXA", 
        bonus: isBullish ? 15 : -20, 
        reason: isBullish ? "🚀 Convicção: Fechamento na máxima (compradores no controle)." : "📉 Pânico: Fechamento na mínima (vendedores no controle)." 
      };
    }

    return { pattern: "NEUTRO", bonus: 0, reason: "" };
  }
};