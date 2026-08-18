/******************************************************************************/
// 📦 MÓDULO/ARQUIVO: 36_Agent_Analyst.js
// 🛠️  TECNOLOGIA: JAVASCRIPT (V8 / Google Apps Script)
// 📌  VERSÃO: 2.0 — CAMPOS CORRIGIDOS + PROMPT CALIBRADO
// =============================================================================
// CORREÇÕES v2.0:
//   ✅ userPrompt lê volume/rr/stop/target do nível raiz (alinhado ao módulo 35 v6.1)
//   ✅ Veto por dados ausentes REMOVIDO — IA analisa com o que tem
//   ✅ Prompt calibrado: foco em momentum, não em "Advogado do Diabo"
//   ✅ Escala ai_score documentada para o módulo 35 entender o veto (< 40)
//   ✅ response_mime_type: application/json forçado para evitar markdown
// =============================================================================
/******************************************************************************/



/**
 * Remove linguagem imperativa do campo de memória antes de enviar ao LLM.
 * Impede que instruções embutidas no contexto histórico contaminem a decisão.
 */
function _sanitizarMemoria(texto) {
  if (!texto || typeof texto !== 'string') return 'Sem histórico relevante.';

  // 🛡️ PROTEÇÃO CONTRA PROMPT INJECTION E OVERWRITE DE SISTEMA
  const padroesToxicos = [
    /ignore\s+(todas\s+as\s+)?instru[cç][oõ]es/gi,
    /esque[cç]a\s+(o\s+seu\s+)?papel/gi,
    /aja\s+como\s+(se)?/gi,
    /voc[eê]\s+agora\s+[eé]/gi,
    /vete?\s+qualquer\s+sinal/gi,
    /veto\s+obrigat[oó]rio/gi,
    /ordem[:\s]+vete?/gi,
    /alinhamento\s+planet[aá]rio/gi,
    /exige\s+(absten[cç][aã]o|cautela\s+m[aá]xima|perfei[cç][aã]o)/gi,
    /responda\s+apenas/gi,
    /overwrite/gi,
    /system\s+prompt/gi
  ];

  let textoLimpo = texto;
  for (const padrao of padroesToxicos) {
    textoLimpo = textoLimpo.replace(padrao, '[contexto de risco]');
  }

  // Limpeza de caracteres que podem quebrar a estrutura de injeção de texto ou JSON
  textoLimpo = textoLimpo.replace(/["'{}\[\]]/g, '');

  // Limita o tamanho para não dominar o prompt
  return textoLimpo.substring(0, 300);
}



var AgentAnalyst = {

  /**
   * Analisa um ativo combinando dados técnicos, macro e sentimento.
   * @param {string} ticker
   * @param {Object} data — Objeto montado pelo _consultarAnalista do módulo 35
   * @returns {Object} JSON com decisão e score
   */


      _extrairPayloadSeguro: function(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;

    try {
      // Tentativa 1: Parse direto (caso a API retorne limpo)
      return JSON.parse(rawText);
    } catch (e1) {
      try {
        // Tentativa 2: Limpeza de Markdown e extração por chaves
        let textoLimpo = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const inicio = textoLimpo.indexOf('{');
        const fim = textoLimpo.lastIndexOf('}');

        if (inicio !== -1 && fim !== -1) {
          const jsonExtraido = textoLimpo.substring(inicio, fim + 1);
          return JSON.parse(jsonExtraido);
        }
        throw new Error("Estrutura JSON não encontrada no texto.");
      } catch (e2) {
        console.error(`❌ [FALHA DE PARSE LGPD/SEC] Texto recebido: ${rawText.substring(0, 100)}...`);
        return null;
      }
    }
  },


  
    analyze: function (ticker, data) {
    if (!ticker || !data) {
      return { decision: 'AGUARDAR', ai_score: 0, sentiment: 'NEUTRAL', rationale: 'Dados ausentes.' };
    }

    const p = data;
    const memorySanitized = _sanitizarMemoria(p.memory);

    // ------------------------------------------------------------------
    // SYSTEM PROMPT UNIFICADO — Técnica + Risco
    // ------------------------------------------------------------------
    const systemPrompt = `
Você é um HEAD TRADER Quantitativo da B3 operando sob parâmetros estritos.
Sua missão é emitir um veredito final combinando Análise Técnica (ADX, Bollinger, RSI) e Gestão de Risco (Volume, Drawdown).

REGRAS TÉCNICAS (CRÍTICAS):
1. ADX < 20: Mercado lateral. Penalize o score e defina sentiment BEARISH.
2. Bollinger: Preço ACIMA da banda superior sugere exaustão (BEARISH). ABAIXO sugere suporte (BULLISH).
3. RSI: Entre 62 e 68 com ADX > 25 é BULLISH. > 70 exige volume forte para validar rompimento.
4. Ondas de Elliott: Se identificar visualmente um padrão completo de 5 ondas de Elliott nos candles, considere exaustão de tendência (BEARISH). Se identificar correção ABC com fundo duplo, considere suporte (BULLISH).

REGRAS DE RISCO E PORTFÓLIO:
1. Volume: Volume Atual > Média Histórica confirma momentum. Se N/A, exija ADX > 25 para aprovar.
2. Drawdown: Se a memória indicar drawdown, aumente a cautela (reduza até 15 pts), mas NÃO vete setups impecáveis (ADX>25, RR>=2.0).
3. Saldo de Aluguel (BTC): Use os dados de BTC fornecidos no prompt. Se o BTC estiver muito alto (ex: acima de 5% do free float ou em forte alta recente), adote cautela (penalize o score técnico por risco de forte pressão vendedora de short-sellers), a menos que haja sinal claro de rompimento iminente com volume forte (onde há potencial de Short Squeeze altista explosivo). Mencione explicitamente os dados de BTC na justificativa (rationale). ⛔ Pesquisa web em tempo real NÃO está disponível neste ambiente. Analise apenas os dados fornecidos.
4. OBV (On-Balance Volume): Use a leitura de fluxo de OBV fornecida para validar a direção institucional de médio prazo. Se o OBV estiver em "Acumulação (BULLISH)", isso fortalece e valida o sinal de alta (aumente a confiança do score). Se estiver em "Distribuição (BEARISH)", ligue o sinal de alerta para rompimento falso ou exaustão (reduza o score ou vete setups esticados).

ESCALA DE DECISÃO:
- ai_score 70-100: COMPRAR
- ai_score 0-69: AGUARDAR

Retorne APENAS um JSON estrito:
{"decision": "COMPRAR" ou "AGUARDAR", "ai_score": <0-100>, "sentiment": "BULLISH", "BEARISH" ou "NEUTRAL", "rationale": "<justificativa técnica e de risco>"}
`;

    // ------------------------------------------------------------------
    // USER PROMPT — Consumindo dados preparados
    // ------------------------------------------------------------------
    const userPrompt = `
ATIVO: ${p.ticker} | SETUP: ${p.setupType} | SCORE ALGO: ${p.score}

[DADOS TÉCNICOS]
- Preço Atual: R$ ${p.price}
- RSI (14): ${p.rsi}
- ADX (14): ${p.adxLabel || p.adx || 'N/A'}
- Bollinger: ${p.bbLabelAdj || 'N/A'}
- Volume Atual: ${p.volume}
- Média Histórica (20p): ${p.avgVolume || 'N/A'}
- Risco/Retorno (R/R): ${p.rr}
- Fluxo de Acumulação OBV: ${p.obv || 'N/A'}

[CONTEXTO AGÊNTICO]
- Macro/Notícias: ${p.macro || 'Neutro'} | ${p.news || 'Sem notícias'}
- Memória Institucional: ${memorySanitized || 'Sem histórico negativo.'}

[DADOS DE RISCO ADICIONAIS]
- Saldo de Aluguel (BTC): ${p.btc || 'Não disponível. Análise apenas com dados técnicos.'}
- ⛔ NOTA: Pesquisa web não disponível. Analise apenas os dados fornecidos acima.

Emita o veredito final em JSON.
`;

        // ------------------------------------------------------------------
    // EXECUÇÃO SEGURA E DECODIFICAÇÃO
    // ------------------------------------------------------------------
    // monta prompt (ESSENCIAL)
const promptCompleto = systemPrompt.trim() + '\n\n' + userPrompt.trim();

// execução
try {
  // Chamada do novo módulo unificado (sem underline)
  const ensembleResult = AIEnsemble.analisar(promptCompleto, {
    ticker: ticker,
    score: p.score, // Repassa o score técnico (0-100) para o Ensemble
    trend: p.trend || "neutral",
    rsi: p.rsi,
    adx: p.adx || 25,
    macd: p.macd || "neutral"
  });

  // BLINDAGEM DE VETO: Se o Ensemble rejeitar ou indicar conflito
  if (ensembleResult.rejected) {
    // 🔧 CORREÇÃO v5: Reduzido de 60 para 50 para evitar veto excessivo
    // Com adjustment macro 0.8x-0.95x, scores técnicos de 70 viram 56-66
    // Exigir >= 60 forçava BEARISH mesmo em setups de qualidade mediana
    var techScore = Number(p.score) || 0;
    var sentimentForcado = (techScore >= 50) ? 'NEUTRAL' : 'BEARISH';

    
    return {
      decision: 'AGUARDAR',
      ai_score: Math.round(ensembleResult.finalScore),
      sentiment: sentimentForcado,
      rationale: ensembleResult.rationale || 'Vetado pelo Ensemble de IA.'
    };
  }

    // ------------------------------------------------------------------
    // VALIDAÇÃO RÍGIDA DO CONTRATO (Rigid Schema Enforcement)
    // ------------------------------------------------------------------
    const veredito = {
      decision: (ensembleResult.decision === "COMPRA_FORTE" || ensembleResult.decision === "COMPRA") ? "COMPRAR" : "AGUARDAR",
      ai_score: Math.round(ensembleResult.finalScore),
      sentiment:
        ensembleResult.finalScore >= 60 ? "BULLISH" :
        ensembleResult.finalScore <= 40 ? "BEARISH" : "NEUTRAL",
      rationale: `Ensemble | G:${ensembleResult.breakdown?.gemini || 0} D:${ensembleResult.breakdown?.deepseek || 0} T:${ensembleResult.breakdown?.tecnico || 0}`
    };

    // Rejeição imediata se campos críticos estiverem corrompidos ou ausentes
    if (isNaN(veredito.ai_score) || !veredito.decision || !veredito.sentiment) {
      console.error("❌ [AGENT ANALYST] Resposta do Ensemble fora do schema obrigatório. Vetando por segurança.");
      return { decision: 'AGUARDAR', ai_score: 0, sentiment: 'BEARISH', rationale: 'Falha na integridade do payload de IA.' };
    }

    return veredito;

} catch (e) {
  console.error(`❌ [AGENT ANALYST] Erro Ensemble ${ticker}: ${e.message}`);

  return { decision: 'AGUARDAR', ai_score: 0, sentiment: 'BEARISH', rationale: 'Falha no Ensemble de IA.' };
}
  }
};