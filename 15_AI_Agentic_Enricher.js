/**
 * 15_AIAgenticEnricher.gs — v7.0 (INTEGRAÇÃO TOTAL COM CONFIG)
 * =============================================================================
 * ✅ DINÂMICO: Busca Modelo, Score Mínimo e Chaves via CONFIG.get().
 * ✅ RESILIENTE: Se a configuração falhar, usa os Defaults do sistema.
 * ✅ EFICIENTE: Só aciona a IA se o ativo passar pelo filtro técnico inicial.
 */

var AIAgenticEnricher = {

    enrichOpportunities: function(opportunities) {
    // 1️⃣ Bypass da IA: Transforma o módulo em um preparador de contexto técnico
    return opportunities.map(op => {
      try {
        const ind = op.indicators || {};

        // 2️⃣ Formatação de rótulos técnicos para o prompt unificado
        op.adxLabel = (ind.adx !== null && ind.adx !== undefined)
          ? (ind.adx < 20 ? `${ind.adx} (LATERAL)` : ind.adx < 25 ? `${ind.adx} (nascente)` : `${ind.adx} (presente)`)
          : "N/A";

        const bb = ind.bollinger || {};
        const bbAcima  = op.price > (bb.upper  || Infinity);
        const bbAbaixo = op.price < (bb.lower  || -Infinity);
        op.bbLabelAdj = bbAcima ? "⚠️ ACIMA DA BANDA" : bbAbaixo ? "📉 ABAIXO DA BANDA" : "DENTRO DAS BANDAS";

        // 3️⃣ Manutenção da integridade do pipeline (valores neutros)
        op.aiScore = op.score;
        op.enrichedScore = op.score;
        op.sentiment = "NEUTRAL"; 

        return op;

      } catch (e) {
        console.error(`❌ Erro na preparação de contexto de ${op.ticker}: ${e.message}`);
        op.enrichedScore = op.score; 
        return op;
      }
    });
  },

  /**
   * Chamada à API Generativa do Google
   */
  _callGemini: function(op, model, key) {
  try {
    const ind = op.indicators || {};

    // ── ADX com rótulo interpretativo ─────────────────────────────────────
    let adxLabel = 'N/A';
    if (ind.adx !== null && ind.adx !== undefined) {
      if      (ind.adx < 20) adxLabel = `${ind.adx} (LATERAL — sinal fraco)`;
      else if (ind.adx < 25) adxLabel = `${ind.adx} (tendência nascente)`;
      else                   adxLabel = `${ind.adx} (tendência presente)`;
    }

    // ── Bollinger com alerta inline ───────────────────────────────────────
    let bbLabel  = 'N/A';
    let bbAcima  = false;
    let bbAbaixo = false;
    if (ind.bollinger) {
      const bb = ind.bollinger;
      bbLabel  = `Superior ${bb.upper} | Média ${bb.middle} | Inferior ${bb.lower}`;
      bbAcima  = op.price > bb.upper;
      bbAbaixo = op.price < bb.lower;
      if (bbAcima)  bbLabel += ' ⚠️ ACIMA DA BANDA';
      if (bbAbaixo) bbLabel += ' 📉 ABAIXO DA BANDA';
    }

    const prompt = `Atue como analista quantitativo sênior da B3.
Ativo: ${op.ticker}
Setup Técnico: ${op.setup || op.setupType || 'N/A'}
RSI (14): ${ind.rsi ? Number(ind.rsi).toFixed(1) : 'N/A'}
ADX (14): ${adxLabel}
Bollinger (20): ${bbLabel}
Preço Atual: ${op.price}
Score Técnico de Entrada: ${op.score}
Tendência Semanal: ${op.isWeeklyBullish ? 'ALTA' : 'BAIXA'}

REGRAS OBRIGATÓRIAS — aplique sem exceção na ordem abaixo:
1. Se ADX < 20: score -= 15 e sentiment = "BEARISH" (mercado lateral invalida o setup)
2. Se preço ACIMA DA BANDA SUPERIOR de Bollinger: score -= 10 e sentiment = "BEARISH" (exaustão)
3. Se preço ABAIXO DA BANDA INFERIOR de Bollinger: score += 5 e sentiment = "BULLISH" (sobrevenda)
4. Se RSI >= 62 E RSI <= 68 E ADX >= 25: score += 10 e sentiment = "BULLISH" (setup ideal)
5. Se score técnico de entrada >= 80 E tendência semanal = ALTA E ADX >= 20: sentiment = "BULLISH"
6. Se score técnico de entrada < 50: sentiment = "BEARISH"
7. Se nenhuma das regras acima se aplicar: sentiment = "NEUTRAL"
8. Se sua decisão for APPROVED, o campo "motivo" DEVE conter justificativa de aprovação, nunca de rejeição. Se for REJECTED, o motivo deve explicar a rejeição. Motivo e decisão devem ser COERENTES entre si

IMPORTANTE:
- As regras são cumulativas: aplique todas que se encaixarem antes de retornar o score final.
- O score final deve estar entre 0 e 100.
- Retorne APENAS o JSON abaixo, sem texto adicional, sem markdown:

{"score": <número 0-100>, "rationale": "<1 frase curta explicando a decisão principal>", "sentiment": "<BULLISH|BEARISH|NEUTRAL>"}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    };

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': key },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const resText = response.getContentText();
    const json    = JSON.parse(resText);

    if (json.error) throw new Error(json.error.message);

    const rawOutput = json.candidates[0].content.parts[0].text;
    const cleaned   = rawOutput.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed    = JSON.parse(cleaned);

    // Debug temporário — remover após confirmar sentimentos corretos
    console.log(`[DEBUG ${op.ticker}] score=${parsed.score} sentiment=${parsed.sentiment} | ADX=${ind.adx} RSI=${ind.rsi}`);

    return {
      score:     Math.min(100, Math.max(0, parseInt(parsed.score) || 50)),
      rationale: parsed.rationale || parsed.reasoning || "Análise processada.",
      sentiment: parsed.sentiment || "NEUTRAL"
    };

  } catch (e) {
    console.error(`❌ [_callGemini] ${op.ticker}: ${e.message}`);
    return { score: 50, rationale: "Erro na comunicação com a IA.", sentiment: "NEUTRAL" };
  }
}
};