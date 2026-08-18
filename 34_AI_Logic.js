/******************************************************************************/
// 📦 MÓDULO/ARQUIVO: 34_AI_Logic.gs
// 🛠️  TECNOLOGIA: JAVASCRIPT (V8 / Google Apps Script)
// 📌  VERSÃO: 5.2 — REESCRITA: Fluxo de Parse Otimizado + Logs Limpos
// =============================================================================
// ✅ COMPLEXIDADE REDUZIDA: Fluxo de parseamento simplificado.
// ✅ PARSER OTIMIZADO: _safeJSONParse agora apenas tenta parsear JSON já limpo.
// ✅ FALLBACK SEGURO: Se a IA falhar, retorna análise técnica neutra.
// ✅ LOGS LIMPOS: Remoção de logs de debug temporários.
//
// v5.2 — Alterações:
//   • enrichOpportunity: Fluxo de tratamento de resposta e erro otimizado.
//   • _safeJSONParse: Simplificado para apenas JSON.parse, confiando na limpeza do AI_Connector.
//   • _buildPrompt: Mantido como estava na v5.1 (ADX e Bollinger).
//   • _callLLMService: Mantido como estava (wrapper para AI_Connector).
// =============================================================================
/******************************************************************************/

var AILogic = {

  /**
   * Função Principal: Recebe dados técnicos e pede opinião à IA.
   * Retorna um objeto com ai_score, rationale e sentiment.
   */
  enrichOpportunity: function(ticker, technicalData) {
    if (!technicalData) {
      return { ai_score: 50, rationale: "Dados técnicos ausentes.", sentiment: "NEUTRO" };
    }

    const prompt = this._buildPrompt(ticker, technicalData);

    try {
      // _callLLMService já retorna uma string JSON limpa ou null
      const rawResponseString = this._callLLMService(prompt);

      if (!rawResponseString) {
        // Se o conector da IA retornou null, significa que houve uma falha tratada lá.
        throw new Error("Resposta nula ou inválida do serviço LLM.");
      }

      // Tenta parsear a string JSON já limpa
      const aiAnalysis = this._safeJSONParse(rawResponseString);

      if (aiAnalysis) {
        return {
          ai_score:  parseInt(aiAnalysis.score) || 50,
          rationale: aiAnalysis.reasoning || aiAnalysis.rationale || "Análise processada.",
          sentiment: aiAnalysis.sentiment || "NEUTRO"
        };
      } else {
        // Se _safeJSONParse retornou null, significa que a string não era JSON válido
        throw new Error("JSON inválido retornado pela IA após parseamento.");
      }

    } catch (e) {
      console.warn(`⚠️ IA falhou para ${ticker}: ${e.message}`);
      return {
        ai_score:  technicalData.score || 50, // Fallback para score técnico
        rationale: "IA indisponível. Mantendo Score Técnico.",
        sentiment: "NEUTRO"
      };
    }
  },

  /**
   * 🛠️ HELPER: Sanitizador de JSON.
   * Agora apenas tenta parsear a string, confiando que a limpeza já foi feita pelo AI_Connector.
   */
  _safeJSONParse: function(text) {
    if (typeof text !== 'string' || text.trim() === '') {
      console.warn("⚠️ [AILogic] _safeJSONParse: Entrada não é string ou está vazia.");
      return null;
    }
    try {
      return JSON.parse(text); // 'text' já deve vir limpo do AI_Connector.cleanJsonBlock
    } catch (e) {
      console.error(`[AI CRITICAL] Falha no Parse Blindado (AILogic): ${text.substring(0, 200)}...`, e);
      return null;
    }
  },

  /**
   * Construtor de Prompt Otimizado (Economiza Tokens + Multi-Timeframe).
   * v5.1: ADX e Bollinger adicionados ao bloco [CONTEXTO GRÁFICO DIÁRIO].
   */
  _buildPrompt: function(ticker, data) {

    // =========================================================================
    // 🕒 PROCESSAMENTO MULTI-TIMEFRAME (H1)
    // =========================================================================
    let contextoH1 = "Dados intradiários indisponíveis no momento.";

    if (data.intradayCandles && data.intradayCandles.length > 0) {
      const ultimasHoras   = data.intradayCandles.slice(-3);
      const precosH1       = ultimasHoras.map(c => "R$ " + c.close.toFixed(2)).join(" ➡️ ");
      const ultimaHora     = ultimasHoras[ultimasHoras.length - 1];
      const primeiraHora   = ultimasHoras[0];
      const tendenciaCurta = ultimaHora.close > primeiraHora.close ? "ALTA 🟢" : "BAIXA 🔴";
      contextoH1 = `Últimas 3 horas: ${precosH1}\n      Micro-Tendência (H1): ${tendenciaCurta}`;
    }

    // =========================================================================
    // 📊 FORMATAÇÃO ADX (com rótulo interpretativo para o modelo)
    // =========================================================================
    const ind    = data.indicators || {};
    let adxLabel = "N/A";
    if (ind.adx !== null && ind.adx !== undefined) {
      if      (ind.adx < 20) adxLabel = `${ind.adx.toFixed(2)} (LATERAL — tendência sem força)`;
      else if (ind.adx < 25) adxLabel = `${ind.adx.toFixed(2)} (tendência nascente)`;
      else                   adxLabel = `${ind.adx.toFixed(2)} (tendência presente)`;
    }

    // =========================================================================
    // 📊 FORMATAÇÃO BOLLINGER
    // =========================================================================
    let bollingerLabel = "N/A";
    if (ind.bollinger) {
      const bb = ind.bollinger;
      bollingerLabel = `Superior ${bb.upper.toFixed(2)} | Média ${bb.middle.toFixed(2)} | Inferior ${bb.lower.toFixed(2)}`;
      if (data.price && data.price > bb.upper) {
        bollingerLabel += " ⚠️ Preço acima da banda superior";
      } else if (data.price && data.price < bb.lower) {
        bollingerLabel += " 📉 Preço abaixo da banda inferior";
      }
    }
    // =========================================================================

    return `
      Atue como um analista quantitativo sênior da B3. Analise o ativo ${ticker}.

      [CONTEXTO GRÁFICO DIÁRIO - TENDÊNCIA MAIOR]
      Preço Atual: ${data.price.toFixed(2)}
      RSI (14): ${ind.rsi ? ind.rsi.toFixed(2) : 'N/A'}
      ADX (14): ${adxLabel}
      Bollinger (20): ${bollingerLabel}
      Tendência Semanal: ${data.isWeeklyBullish ? 'ALTA' : 'BAIXA'}
      Setup Técnico Base: ${data.setup}

      [CONTEXTO INTRADIÁRIO (H1) - TIMING DE ENTRADA]
      ${contextoH1}

      REGRA DE OURO MTF: Use o Diário para validar a direção da tendência e o H1 para confirmar se não estamos a comprar no topo de um repique intradiário.

      REGRAS ADICIONAIS DE FILTRO:
      - Se o ADX estiver abaixo de 20, o mercado está lateral. Trate qualquer sinal como de baixa confiança e reduza o score.
      - Se o preço estiver acima da Banda Superior de Bollinger, sinalize possível exaustão e reduza o score, salvo rompimento confirmado por volume.

      Responda APENAS um JSON estrito neste formato:
      {
        "score": (0 a 100, onde >80 é compra forte),
        "sentiment": "BULLISH" ou "BEARISH" ou "NEUTRAL",
        "reasoning": "Resumo em 1 frase curta justificando a entrada baseada no alinhamento do Diário com o H1."
      }
    `;
  },

  /**
   * Wrapper de Chamada para o Conector Unificado.
   */
  _callLLMService: function(prompt) {
    if (typeof AI_Connector !== 'undefined') {
      const response = AI_Connector.callGemini(prompt, {
        jsonMode:    true,
        temperature: 0.2
      });
      return response; // Já vem limpo ou null do AI_Connector
    }
    console.warn("⚠️ AI_Connector não encontrado. Verifique o Módulo 07.");
    return null;
  }

};