/**
 * 08_AI_Ensemble.js
 * =============================================================================
 * CENTRAL DE INTELIGÊNCIA COLETIVA DE IA (UNIFICADO v10.0)
 * =============================================================================
 * Fusão e consolidação dos Ensembles 08 (Multi-IA) e 55 (Produção Otimizada).
 * Garante uniformidade nas decisões do orquestrador e do analista.
 */

var AIEnsemble = (function() {
  'use strict';

  // Configurações padrão do Ensemble
  const CONFIG_ENSEMBLE = {
    DISCORD_THRESHOLD: 0.40,
    MIN_SCORE_DEFAULT: 0.65,
    MIN_SCORE_BEARISH: 0.70
  };

  // Pesos base caso o ADX esteja indisponível
  const PESOS_PADRAO = {
    GEMINI: 0.40,
    DEEPSEEK: 0.40,
    TECH: 0.20
  };

  // ===========================================================================
  // ⚙️ WORKFLOW A: ENRIQUECIMENTO RÁPIDO DO SCANNER (Antigo Módulo 55)
  // ===========================================================================

  /**
   * Ponto de entrada do Orquestrador principal para pré-filtragem técnica rápida.
   */
  function getEnhancedScore(originalAnalysis) {
    if (!originalAnalysis) return { finalScore: 50, confidence: 0, sentiment: 'NEUTRAL' };

    var ensemble = analyzeWithEnsemble(originalAnalysis);
    var pesoEnsemble = 0.7;
    var pesoTecnico = 0.3;
    var finalScore = (ensemble.score * pesoEnsemble) + ((originalAnalysis.score || 50) * pesoTecnico);

    return {
      originalScore: originalAnalysis.score || 50,
      ensembleScore: ensemble.score,
      finalScore: Math.round(finalScore),
      confidence: ensemble.confidence,
      sentiment: ensemble.sentiment,
      rationale: ensemble.rationale || "Análise combinada rápida",
      sources: ensemble.sources
    };
  }

  /**
   * Orquestração simplificada: Gemini + Técnico (50/50)
   */
  function analyzeWithEnsemble(technicalData) {
    var ticker = technicalData?.ticker;
    if (!ticker) {
      console.error("❌ Ensemble: ticker não fornecido");
      return { score: 0, confidence: 0, error: "Ticker inválido" };
    }

    console.log("🧠 [AIEnsemble] Analisando rápido " + ticker + "...");

    var ind = technicalData.indicators || {};
    var adxValue = technicalData.adx || ind.adx || 25;
    
    var bollingerUpper = technicalData.bollingerUpper || ind.bollinger?.upper || 0;
    var bollingerMiddle = technicalData.bollingerMiddle || ind.bollinger?.middle || 0;
    var bollingerLower = technicalData.bollingerLower || ind.bollinger?.lower || 0;
    
    var bollingerObj = null;
    if (bollingerUpper > 0 || bollingerMiddle > 0 || bollingerLower > 0) {
      bollingerObj = { upper: bollingerUpper, middle: bollingerMiddle, lower: bollingerLower };
    }
    
    var rsiValue = ind.rsi || technicalData.rsi || 50;
    var volumeRelativo = ind.volumeRelativo || technicalData.volumeRelativo || 1.0;
    var preco = technicalData.price || 0;
    var setupType = technicalData.setup || technicalData.setupType || 'N/A';
    var scoreTecnico = technicalData.score || 50;
    var isWeeklyBullish = technicalData.isWeeklyBullish || false;

    var enrichedData = {
      ticker: ticker,
      price: preco,
      score: scoreTecnico,
      setup: setupType,
      isWeeklyBullish: isWeeklyBullish,
      indicators: { rsi: rsiValue, adx: adxValue, bollinger: bollingerObj, volumeRelativo: volumeRelativo }
    };

    var tecnicoScore = scoreTecnico;

    // 🔧 CORREÇÃO v10.1: CONECTAR GUILHOTINA BOLLINGER AO PIPELINE
    // Antes: AIService.diagnosticarOportunidade() existia mas NUNCA era chamada (código morto)
    // Agora: penaliza o score técnico quando preço > banda superior (exaustão)
    // Exceção: zona Fibo confirmada pode ser rompimento legítimo → não penaliza
    try {
      var inFiboZone = !!(technicalData.estrutura && technicalData.estrutura.inFiboZone);
      var bbUpperLocal = bollingerObj && bollingerObj.upper > 0 ? bollingerObj.upper : 0;
      
      if (bbUpperLocal > 0 && preco > bbUpperLocal && !inFiboZone) {
        var penalidadeBollinger = 15;
        // Se estiver muito acima da banda, penalidade maior
        var acimaPct = (preco - bbUpperLocal) / bbUpperLocal;
        if (acimaPct > 0.03) penalidadeBollinger = 20;
        
        tecnicoScore = Math.max(0, tecnicoScore - penalidadeBollinger);
        console.warn("⚠️ [AIEnsemble] GUILHOTINA BOLLINGER ativada para " + ticker + 
          ": preço " + preco + " > banda superior " + bbUpperLocal.toFixed(2) + 
          ". Score técnico " + scoreTecnico + " → " + tecnicoScore);
      }
      
      // Chamada à função oficial (que estava órfã) para telemetria/consistência
      if (typeof AIService !== 'undefined' && typeof AIService.diagnosticarOportunidade === 'function') {
        var diagOp = {
          indicators: { rsi: rsiValue, adx: adxValue, bollinger: bollingerObj, volumeRelativo: volumeRelativo, atr: ind.atr },
          setupType: setupType,
          preco: preco,
          score: scoreTecnico,
          estrutura: { inFiboZone: inFiboZone }
        };
        var diag = AIService.diagnosticarOportunidade(diagOp);
        if (diag && diag.temDivergencia) {
          var exaustaoMotivo = diag.motivos.find(function(m) {
            return m.indexOf('exaust') !== -1 || m.indexOf('Banda Superior') !== -1;
          });
          if (exaustaoMotivo) {
            console.warn("⚠️ [AIEnsemble] Divergência confirmada por AIService para " + ticker + ": " + exaustaoMotivo);
          }
        }
      }
    } catch(e) {
      console.warn("⚠️ [AIEnsemble] Falha ao aplicar Guilhotina Bollinger: " + e.message);
    }

    // 🔧 CORREÇÃO v10.1: PENALIDADE POR EXTENSÃO (DISTÂNCIA DA EMA21)
    // Mede o quanto o preço está "esticado" acima da média — proxy de "perto do topo"
    try {
      var ema21Local = ind.ema21 || technicalData.ema21 || 0;
      if (preco > 0 && ema21Local > 0) {
        var extensaoPct = (preco - ema21Local) / ema21Local;
        if (extensaoPct > 0.10) {
          tecnicoScore = Math.max(0, tecnicoScore - 25);
          console.warn("⚠️ [AIEnsemble] Preço esticado " + (extensaoPct * 100).toFixed(1) + "% acima da EMA21 para " + ticker + ". Penalidade -25.");
        } else if (extensaoPct > 0.07) {
          tecnicoScore = Math.max(0, tecnicoScore - 15);
          console.warn("⚠️ [AIEnsemble] Preço esticado " + (extensaoPct * 100).toFixed(1) + "% acima da EMA21 para " + ticker + ". Penalidade -15.");
        } else if (extensaoPct > 0.04) {
          tecnicoScore = Math.max(0, tecnicoScore - 8);
          console.log("ℹ️ [AIEnsemble] Preço levemente esticado " + (extensaoPct * 100).toFixed(1) + "% acima da EMA21 para " + ticker + ". Penalidade -8.");
        }
      }
    } catch(e) {
      console.warn("⚠️ [AIEnsemble] Falha ao aplicar penalidade de extensão: " + e.message);
    }

    // 🔧 CORREÇÃO v10.2: PENALIDADE POR PROXIMIDADE AO TOPO RECENTE (TOPO50)
    // Quanto mais perto da máxima de 30 candles, pior o timing de entrada (risco de pullback)
    try {
      var topo50Local = Number(technicalData.topo50) || 0;
      if (topo50Local > 0 && preco > 0 && topo50Local > preco) {
        var distTopoLocal = (topo50Local - preco) / topo50Local;
        if (distTopoLocal < 0.01) {
          tecnicoScore = Math.max(0, tecnicoScore - 20);
          console.warn("⚠️ [AIEnsemble] Preço NO TOPO recente (R$" + topo50Local.toFixed(2) + ") para " + ticker + ". Penalidade -20.");
        } else if (distTopoLocal < 0.03) {
          tecnicoScore = Math.max(0, tecnicoScore - 12);
          console.warn("⚠️ [AIEnsemble] Preço próximo ao topo (a " + (distTopoLocal * 100).toFixed(1) + "% da máxima) para " + ticker + ". Penalidade -12.");
        }
      }
    } catch(e) {
      console.warn("⚠️ [AIEnsemble] Falha ao aplicar penalidade de topo: " + e.message);
    }

    // 🔧 CORREÇÃO v10.2: PENALIDADE POR GANHO RÁPIDO ACUMULADO (MOVIMENTO ACELERADO)
    // Detecta subida vertical (ex: +12% pós-resultado) — EMA21 "persegue" o preço, mascara extensão
    try {
      var ganhoRapidoLocal = Number(technicalData.ganhoRapidoPct) || 0;
      if (ganhoRapidoLocal > 0.08) {
        tecnicoScore = Math.max(0, tecnicoScore - 15);
        console.warn("⚠️ [AIEnsemble] GANHO RÁPIDO de " + (ganhoRapidoLocal * 100).toFixed(1) + "% em 10 sessões para " + ticker + ". Penalidade -15 (movimento acelerado).");
      } else if (ganhoRapidoLocal > 0.05) {
        tecnicoScore = Math.max(0, tecnicoScore - 8);
        console.log("ℹ️ [AIEnsemble] Ganho de " + (ganhoRapidoLocal * 100).toFixed(1) + "% em 10 sessões para " + ticker + ". Penalidade -8.");
      }
    } catch(e) {
      console.warn("⚠️ [AIEnsemble] Falha ao aplicar penalidade de ganho rápido: " + e.message);
    }

    var gemini = _getGeminiAnalysis(ticker, enrichedData);

    if (gemini === null) {
      console.warn("⚠️ [AIEnsemble] Gemini falhou na análise rápida, usando fallback puramente técnico.");
      return { score: tecnicoScore, confidence: 50, sentiment: 'NEUTRAL', sources: { tecnico: tecnicoScore, gemini: null } };
    }

    var totalScore = (tecnicoScore * 0.5) + (gemini.score * 0.5);
    var finalScore = Math.min(100, Math.max(0, totalScore));

    var sentiment = 'NEUTRAL';
    if (finalScore >= 65) sentiment = 'BULLISH';
    else if (finalScore <= 35) sentiment = 'BEARISH';

    return {
      score: Math.round(finalScore),
      confidence: 100,
      sentiment: sentiment,
      sources: { tecnico: tecnicoScore, gemini: gemini.score },
      rationale: gemini.rationale || "Análise rápida processada.",
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Processamento em lote para o Orquestrador v9.5+
   */
  function getEnhancedScoresBatch(lista) {
    if (!lista || lista.length === 0) return [];
    console.log("🧠 [AIEnsemble] Processando lote de " + lista.length + " ativos...");

    return lista.map(function(op) {
      try {
        var result = getEnhancedScore(op);
        // Mapeamento de campos para compatibilidade com Orchestrator._enriquecerComIA
        return {
          ...op,
          enrichedScore: result.finalScore,
          ensembleScore: result.ensembleScore,
          aiConfidence: result.confidence,
          sentiment: result.sentiment,
          aiRationale: result.rationale,
          sources: result.sources
        };
      } catch (e) {
        console.error("❌ [AIEnsemble] Erro no ativo " + op.ticker + ": " + e.message);
        return {
          ...op,
          enrichedScore: op.score || 50,
          ensembleScore: op.score || 50,
          aiConfidence: 0,
          sentiment: 'NEUTRAL',
          aiRationale: 'Falha na análise individual.',
          sources: { tecnico: op.score, gemini: null }
        };
      }
    });
  }

  // ===========================================================================
  // ⚙️ WORKFLOW B: VALIDAÇÃO PROFUNDA MULTI-AGENTE (Antigo Módulo 08)
  // ===========================================================================

  /**
   * Ponto de entrada do AgentAnalyst para validação profunda multi-IA (Gemini + DeepSeek).
   * Implementa pesos dinâmicos em função do regime (ADX) e dimensionamento de lote (sizing) dinâmico.
   */
  function analisar(prompt, dadosTecnicos = {}, macroRegime = "NEUTRAL") {
    console.log("🧠 [AIEnsemble] Iniciando análise multi-IA profunda...");

    var ticker = dadosTecnicos.ticker || "Ativo";
    
    // Unificando escala para 0-100 em todo o módulo
    var rawTechScore = dadosTecnicos.score || 50;
    var techScore = rawTechScore > 1 ? rawTechScore : rawTechScore * 100;

    var adx = dadosTecnicos.adx || 25; // Lê o ADX do ativo para o ajuste de pesos dinâmicos

    // Prompts customizados para forçar especializações opostas e garantir respostas JSON válidas
    const promptGemini = `${prompt}\n\nVocê é um trader de MOMENTUM. Prefira tendência forte.\n` +
      `REGRAS DE RESPOSTA:\n` +
      `1. Responda ESTRITAMENTE em formato JSON.\n` +
      `2. Não inclua explicações, comentários ou markdown no retorno.\n` +
      `3. Retorne EXATAMENTE este formato: {"score": número entre 0.00 e 1.00}\n` +
      `4. Se o cenário for otimista, score > 0.60. Se pessimista, < 0.40.\n\n` +
      `Exemplo: {"score": 0.85}`;

    const promptDeepSeek = `${prompt}\n\nVocê é um trader de REVERSÃO À MÉDIA. Prefira sobrevenda/sobrecompra.\n` +
      `REGRAS DE RESPOSTA:\n` +
      `1. Responda ESTRITAMENTE em formato JSON.\n` +
      `2. Não inclua explicações, comentários ou markdown no retorno.\n` +
      `3. Retorne EXATAMENTE este formato: {"score": número entre 0.00 e 1.00}\n` +
      `4. Se o cenário for de exaustão de venda, score > 0.60.\n\n` +
      `Exemplo: {"score": 0.75}`;

    // ⚡ EXECUÇÃO PARALELA (FETCH ALL)
    const reqG = AI_Connector.buildGeminiRequest(promptGemini, { jsonMode: true });
    const reqD = AI_Connector.buildDeepSeekRequest(promptDeepSeek, { jsonMode: true });
    
    const requests = [];
    const requestTypes = [];
    
    if (reqG) {
      requests.push({ ...reqG.params, url: reqG.url });
      requestTypes.push('GEMINI');
    } else {
      console.warn("⚠️ [AIEnsemble] buildGeminiRequest retornou null. Verifique GEMINI_API_KEY.");
    }
    if (reqD) {
      requests.push({ ...reqD.params, url: reqD.url });
      requestTypes.push('DEEPSEEK');
    } else {
      console.warn("⚠️ [AIEnsemble] buildDeepSeekRequest retornou null. Verifique DEEPSEEK_API_KEY ou limite diário.");
    }

    let gemini = null;
    let deepseek = null;

    if (requests.length === 0) {
      console.warn("⚠️ [AIEnsemble] Nenhuma requisição de IA pôde ser construída (verifique as chaves de API)." );
      return { rejected: true, decision: "NEUTRO", finalScore: techScore, rationale: "Falha na construção de requisições IA." };
    }

    console.log("📡 [AIEnsemble] Preparando fetchAll para:", requestTypes.join(", "));

    try {
      const responses = UrlFetchApp.fetchAll(requests);
      var parseFailures = 0;
      responses.forEach((resp, idx) => {
        const text = resp.getContentText();
        const type = requestTypes[idx];
        console.log(`📡 [AIEnsemble] ${type} HTTP ${resp.getResponseCode()}`);

        if (resp.getResponseCode() === 200) {
          var prepped = null;
          var outputText = null;

          if (type === 'GEMINI') {
            try {
              const rawJson = JSON.parse(text);
              if (rawJson.candidates && rawJson.candidates[0] && rawJson.candidates[0].content && rawJson.candidates[0].content.parts && rawJson.candidates[0].content.parts[0]) {
                outputText = rawJson.candidates[0].content.parts[0].text || JSON.stringify(rawJson.candidates[0].content.parts[0]);
              }
            } catch (extractErr) {
              // fallback para texto bruto
              outputText = text;
            }
          } else if (type === 'DEEPSEEK') {
            try {
              const rawJson = JSON.parse(text);
              if (rawJson.choices && rawJson.choices[0] && rawJson.choices[0].message) {
                outputText = rawJson.choices[0].message.content;
              }
            } catch (extractErr) {
              // fallback para texto bruto
              outputText = text;
            }
          }

          if (!outputText) {
            outputText = text;
          }

          prepped = outputText;
          try {
            if (typeof AI_Connector !== 'undefined' && typeof AI_Connector.cleanJsonBlock === 'function') {
              const cleaned = AI_Connector.cleanJsonBlock(outputText);
              if (cleaned) prepped = cleaned;
            }
          } catch (cleanErr) {
            console.warn("⚠️ [AIEnsemble] cleanJsonBlock falhou:", cleanErr.message);
          }

          const parsed = _safeParse(prepped);
          if (parsed) {
            if (type === 'GEMINI') gemini = parsed;
            if (type === 'DEEPSEEK') deepseek = parsed;
          } else {
            parseFailures++;
            console.warn(`⚠️ [AIEnsemble] ${type} retornou resposta inválida ou sem JSON esperado.`);
            try {
              console.log(`🔍 [AIEnsemble] Detalhes do response (${type} index=${idx}): length=${text ? text.length : 0}`);
              console.log("🔍 [AIEnsemble] Headers:", JSON.stringify(resp.getAllHeaders()));
              console.log("🔍 [AIEnsemble] Output extraído (até 2000 chars):", outputText ? outputText.substring(0, 2000) : "<vazio>");
              console.log("🔍 [AIEnsemble] Conteúdo bruto da resposta (até 2000 chars):", text ? text.substring(0, 2000) : "<vazio>");
            } catch (logErr) {
              console.warn("⚠️ [AIEnsemble] Falha ao logar conteúdo bruto:", logErr.message);
            }
          }
        } else {
          parseFailures++;
          console.warn(`⚠️ [AIEnsemble] ${type} retornou erro HTTP ${resp.getResponseCode()}`);
          try {
            console.log(`🔍 [AIEnsemble] Detalhes do response (${type} index=${idx}): length=${text ? text.length : 0}`);
            console.log("🔍 [AIEnsemble] Headers:", JSON.stringify(resp.getAllHeaders()));
            console.log("🔍 [AIEnsemble] Conteúdo bruto da resposta (até 2000 chars):", text ? text.substring(0, 2000) : "<vazio>");
          } catch (logErr) {
            console.warn("⚠️ [AIEnsemble] Falha ao logar conteúdo bruto:", logErr.message);
          }
        }
      });

      // Telemetria simples: avisar se muitos parses falharem no caminho paralelo
      try {
        const failureRate = parseFailures / requests.length;
        if (failureRate > 0.2) {
          console.warn(`⚠️ [AIEnsemble] Alta taxa de falha de parse no fetchAll: ${(failureRate * 100).toFixed(0)}% — usando fallback sequencial com mais frequência.`);
        }
      } catch (tErr) {
        /* silent */
      }

    } catch (e) {
      console.error("❌ [AIEnsemble] Falha no processamento paralelo: " + e.message);
    }

    // Extração com normalização para 0-100
    var gS = _extractScore(gemini); 
    var dS = _extractScore(deepseek);

    if (gS === null && dS === null) {
      console.warn("⚠️ [AIEnsemble] Falha inicial de IA; tentando fallback sequencial para isolar Gemini e DeepSeek.");

      if (reqG) {
        try {
          var geminiRaw = AI_Connector.callGemini(promptGemini, { jsonMode: true, temperature: 0.2 });
          console.log("🔍 [AIEnsemble] Gemini fallback raw:", geminiRaw ? geminiRaw.substring(0, 400) : "<vazio>");
          var parsedGemini = _safeParse(geminiRaw);
          if (parsedGemini) {
            gemini = parsedGemini;
            gS = _extractScore(gemini);
          }
        } catch (e) {
          console.warn("⚠️ [AIEnsemble] Fallback Gemini falhou: " + e.message);
        }
      }

      if (reqD) {
        try {
          var deepseekRaw = AI_Connector.callDeepSeek(promptDeepSeek, { jsonMode: true, temperature: 0.2 });
          console.log("🔍 [AIEnsemble] DeepSeek fallback raw:", deepseekRaw ? deepseekRaw.substring(0, 400) : "<vazio>");
          var parsedDeepSeek = _safeParse(deepseekRaw);
          if (parsedDeepSeek) {
            deepseek = parsedDeepSeek;
            dS = _extractScore(deepseek);
          }
        } catch (e) {
          console.warn("⚠️ [AIEnsemble] Fallback DeepSeek falhou: " + e.message);
        }
      }
    }

    if (gS !== null) gS *= 100;
    if (dS !== null) dS *= 100;

    if (gS !== null && isNaN(gS)) gS = null;
    if (dS !== null && isNaN(dS)) dS = null;

    // Ajuste dinâmico de pesos (considera nulls)
    var weights = _ajustarPesosDinamicos(gS, dS, adx, macroRegime);

    // Média ponderada com pesos inteligentes
    var finalScore = (weights.GEMINI * (gS || 0)) + (weights.DEEPSEEK * (dS || 0)) + (weights.TECH * techScore);

    var diff = (gS !== null && dS !== null) ? Math.abs(gS - dS) : 0;
    
    console.log("📊 [Ensemble] Scores: Gemini: " + (gS !== null ? gS.toFixed(1) : "OFF") + " | DeepSeek: " + (dS !== null ? dS.toFixed(1) : "OFF") + " | Tech: " + techScore.toFixed(1));
    console.log("⚖️ [Ensemble] Pesos: Gemini: " + (weights.GEMINI * 100).toFixed(0) + "% | DeepSeek: " + (weights.DEEPSEEK * 100).toFixed(0) + "% | Tech: " + (weights.TECH * 100).toFixed(0) + "%");

    // Validação de Conflito Crítico (Bloqueio)
    var conflitoBloqueante = false;
    // Se as duas concordam em direções opostas com força (diff > 40 pontos)
    // ✅ Ajuste: Aumentar o threshold de conflito para ser menos agressivo em BEARISH
    var currentDiscordThreshold = (macroRegime === "BEARISH" && techScore >= 70) ? 50 : (CONFIG_ENSEMBLE.DISCORD_THRESHOLD * 100);
    if (gS !== null && dS !== null && diff > currentDiscordThreshold) {
      console.warn("🚨 [AIEnsemble] Conflito extremo de convicção detectado. Vetando operação.");
      conflitoBloqueante = true;
    }

    // ==============================
// ⚖️ PENALIZAÇÃO POR DIVERGÊNCIA
// ==============================
    if (gS !== null && dS !== null) {
  var diff = Math.abs(gS - dS);

      if (diff > 35) {
        console.warn("🚨 Divergência forte entre IAs: " + diff.toFixed(1));
        finalScore *= 0.85; // penalização forte por falta de consenso
      } else if (diff > 20) {
        console.warn("⚠️ Divergência moderada entre IAs: " + diff.toFixed(1));
        // ✅ CORREÇÃO: Penalidade menos severa se em regime BEARISH e score técnico alto
        if (macroRegime === "BEARISH" && techScore >= 70) {
            finalScore *= 0.95; // Penalidade reduzida
        } else {
            finalScore *= 0.90; // Penalidade padrão
        }
  }
}


    // Regra de Threshold Operacional
    var threshold = (macroRegime === "BEARISH" ? CONFIG_ENSEMBLE.MIN_SCORE_BEARISH : CONFIG_ENSEMBLE.MIN_SCORE_DEFAULT) * 100;
    
    var rejected = finalScore < threshold || conflitoBloqueante;
    
    if (rejected) {
      var motivoRejeicao = conflitoBloqueante ? "Conflito crítico de inteligências" : "Score " + Math.round(finalScore) + " abaixo do limite " + Math.round(threshold);
      
      return {
        finalScore: Math.round(finalScore),
        decision: "NEUTRO",
        rejected: true,
        rationale: "Descartado pelo Ensemble: " + motivoRejeicao,
        breakdown: { gemini: gS, deepseek: dS, tecnico: techScore, conflito: diff },
        pesos: weights,
        positionSize: 0
      };
    }

    // Decisão final
    var decision = _scoreToDecision(finalScore / 100);

    var positionSize = _calcularSizingDinamico(finalScore / 100, (gS || 0) / 100, (dS || 0) / 100, macroRegime);

    return {
      finalScore: Math.round(finalScore),
      decision: decision,
      rejected: false,
      rationale: "Aprovado pelo Ensemble de IA. Consenso quantitativo atingido.",
      breakdown: { gemini: gS, deepseek: dS, tecnico: techScore, conflito: diff },
      pesos: weights,
      positionSize: positionSize
    };
  }

  // ===========================================================================
  // 🛠️ FUNÇÕES AUXILIARES / MOTORES PRIVADOS
  // ===========================================================================

  /**
   * Ajusta dinamicamente os pesos com base no regime de ADX e falhas de resposta das IAs.
   * Evita a anulação de estratégias opostas em regimes claros.
   */
  function _ajustarPesosDinamicos(gScore, dScore, adxValue) {

var macro = null;
var macroRegime = "NEUTRAL";

try {
  if (typeof MacroFetcher !== 'undefined') {
    macro = MacroFetcher.getMacroContext();
    macroRegime = macro.regime || "NEUTRAL";
  }
} catch (e) {
  console.warn("⚠️ MacroFetcher falhou em _ajustarPesosDinamicos");
}



    var w = { GEMINI: PESOS_PADRAO.GEMINI, DEEPSEEK: PESOS_PADRAO.DEEPSEEK, TECH: PESOS_PADRAO.TECH };

    // 1. Tratamento de Ausência de Resposta (Fallback de Peso)
    var geminiFalhou = gScore === null || gScore === undefined;
    var deepseekFalhou = dScore === null || dScore === undefined;

    // CASO 1: Ambas as IAs falharam - PRIVILEGIAR TÉCNICO
    if (geminiFalhou && deepseekFalhou) {
      console.warn("⚠️ [AIEnsemble] AMBAS as IAs falharam. Usando técnico 100%.");
      w.GEMINI = 0;
      w.DEEPSEEK = 0;
      w.TECH = 1.0;
      return w;
    }

    // CASO 2: Apenas DeepSeek falhou
    if (deepseekFalhou) {
      console.warn("⚠️ [AIEnsemble] DeepSeek falhou, usando Gemini + Técnico (50/50).");
      w.DEEPSEEK = 0;
      w.GEMINI = 0.50;
      w.TECH = 0.50;
      return w;
    }

    // CASO 3: Apenas Gemini falhou
    if (geminiFalhou) {
      console.warn("⚠️ [AIEnsemble] Gemini falhou, usando DeepSeek + Técnico (50/50).");
      w.GEMINI = 0;
      w.DEEPSEEK = 0.50;
      w.TECH = 0.50;
      return w;
    }

    // 2. Ajuste Fino por Regime Técnico de Tendência (ADX)
    if (adxValue > 25) {
      // Tendência Forte: Privilegia o Gemini (Momentum)
      w.GEMINI = 0.60;
      w.DEEPSEEK = 0.15;
      w.TECH = 0.25;
    } else if (adxValue < 20) {
      // Mercado Lateral: Privilegia o DeepSeek (Reversão à Média)
      w.GEMINI = 0.15;
      w.DEEPSEEK = 0.60;
      w.TECH = 0.25;
    } else {
      // Zona de Transição: Pesos Equilibrados
      w.GEMINI = 0.35;
      w.DEEPSEEK = 0.35;
      w.TECH = 0.30;
    }

// ==============================
// 🌎 AJUSTE POR REGIME MACRO
// ==============================
if (macroRegime === "BEARISH") {
      // 🔴 Mercado ruim → AUMENTAR PESO TÉCNICO (maior confiabilidade)
      // DeepSeek (reversão) ganha importância, Gemini (momentum) reduzido
      w.GEMINI *= 0.65;      // De 0.45 → 0.29 (menos momentum em BEARISH)
      w.DEEPSEEK *= 1.35;    // De 0.35 → 0.47 (reversão crucial em BEARISH)
      w.TECH *= 1.5;         // De 0.20 → 0.30 (técnico é mais confiável que IA em risco)

    } else if (macroRegime === "DEFENSIVE") {
      // 🟡 mercado instável → mais técnico, menos Gemini
      w.GEMINI *= 0.75;
      w.DEEPSEEK *= 1.15;
      w.TECH *= 1.25;

    } else if (macroRegime === "BULLISH") {
      // 🟢 mercado bom → confiar em momentum (Gemini), menos reversão
      w.GEMINI *= 1.4;       // Gemini (momentum) mais importante
      w.DEEPSEEK *= 0.7;     // DeepSeek (reversão) menos importante
      w.TECH *= 0.9;         // Técnico ainda importante mas menos que IAs
    }
    // Normalização matemática para garantir que a soma dos pesos seja igual a 1
    var total = w.GEMINI + w.DEEPSEEK + w.TECH;
    return {
      GEMINI: w.GEMINI / total,
      DEEPSEEK: w.DEEPSEEK / total,
      TECH: w.TECH / total
    };
  }

  /**
   * Sizing dinâmico real baseado no score final ponderado e no contexto macro.
   */
  function _calcularSizingDinamico(finalScore, gemini, deepseek, macroRegime) {
    var size = 0.5; // tamanho neutro inicial

    var consenso = (gemini > 0.7 && deepseek > 0.7);
    var reversao = (gemini < 0.5 && deepseek > 0.7);

    if (consenso) {
      size = 1.0; // Mão cheia no consenso de alta probabilidade
    } else if (reversao) {
      size = 0.3; // Mão reduzida em trades contra a tendência principal
    } else if (finalScore >= 0.75) {
      size = 0.8;
    } else if (finalScore >= 0.65) {
      size = 0.6;
    }

    // Penalização macro bearish
    // ==============================
// 🌎 AJUSTE DE POSITION SIZE POR MACRO
// ==============================
if (macroRegime === "BEARISH") {
  size *= 0.6; // mais conservador

} else if (macroRegime === "DEFENSIVE") {
  size *= 0.75;

} else if (macroRegime === "BULLISH") {
  size *= 1.1; // leve aumento
}


    return Number(size.toFixed(2));
  }

  /**
   * Gemini Prompt Executor local.
   */
  function _getGeminiAnalysis(ticker, data) {
  try {
    if (typeof AI_Connector === 'undefined') return null;

    var macro = null;
    try {
      if (typeof MacroFetcher !== 'undefined') {
        macro = MacroFetcher.getMacroContext();
      }
    } catch (e) {
      console.warn("⚠️ MacroFetcher falhou no AIEnsemble:", e.message);
    }

    var macroInfo = macro ? ("Contexto macro atual: " + macro.summary + "\n") : "";

    var ind = data.indicators || {};
    var bbLabel = ind.bollinger 
      ? "Superior " + ind.bollinger.upper.toFixed(2) + " | Inferior " + ind.bollinger.lower.toFixed(2) 
      : "N/A";

    var prompt = "Atue como analista quantitativo sênior da B3.\n" +
      macroInfo +
      "Ativo: " + ticker + "\n" +
      "Setup Técnico: " + (data.setup || 'N/A') + "\n" +
      "RSI (14): " + (ind.rsi ? Number(ind.rsi).toFixed(1) : 'N/A') + "\n" +
      "ADX (14): " + (ind.adx ? Number(ind.adx).toFixed(1) : 'N/A') + "\n" +
      "Bollinger (20): " + bbLabel + "\n" +
      "Preço Atual: " + data.price + "\n" +
      "Score Técnico de Entrada: " + data.score + "\n" +
      "Tendência Semanal: " + (data.isWeeklyBullish ? 'ALTA' : 'BAIXA') + "\n\n" +
      "REGRAS OBRIGATÓRIAS:\n" +
      "1. Se ADX < 20: score -= 15 e sentiment = \"BEARISH\"\n" +
      "2. Se preço acima da banda superior de Bollinger: score -= 10\n" +
      "3. Se preço abaixo da banda inferior de Bollinger: score += 5\n" +
      "4. Se RSI >= 62 E RSI <= 68 E ADX >= 25: score += 10\n" +
      "Retorne APENAS JSON:\n" +
      "{\"score\": 0-100, \"rationale\": \"curto\", \"sentiment\": \"BULLISH|BEARISH|NEUTRAL\"}";

    var response = AI_Connector.callGemini(prompt, { jsonMode: true, temperature: 0.1 });

    if (response) {
      var parsed = _safeParse(response);
      var score = Number(parsed.score);

      if (!isNaN(score)) {
        return {
          score: Math.min(100, Math.max(0, score)),
          rationale: parsed.rationale || "Análise executada.",
          sentiment: parsed.sentiment || "NEUTRAL"
        };
      }
    }
  } catch(e) {
    console.warn("⚠️ [AIEnsemble] Falha ao executar Gemini rápido: " + e.message);
  }
  return null;
}

  function _extractScore(obj) {
    if (obj === null || obj === undefined) {
      return null;
    }

    if (typeof obj === 'string') {
      const match = obj.match(/score\s*[:=]\s*([0-9]+(?:[.,][0-9]+)?)/i);
      if (match) {
        obj = { score: match[1] };
      } else {
        const numMatch = obj.match(/([0-9]+(?:[.,][0-9]+)?)/);
        return numMatch ? _normalizeScore(numMatch[1]) : null;
      }
    }

    if (typeof obj !== 'object') {
      return null;
    }

    const scoreValue = _findScoreValue(obj);
    if (scoreValue === null) {
      return null;
    }

    return _normalizeScore(scoreValue);
  }

  function _findScoreValue(data) {
    if (data === null || data === undefined) return null;
    if (typeof data === 'number') return data;
    if (typeof data === 'string') {
      const match = data.match(/score\s*[:=]\s*([0-9]+(?:[.,][0-9]+)?)/i);
      if (match) return Number(match[1].replace(',', '.'));
      const trimmed = data.trim();
      if (/^[0-9]+(?:[.,][0-9]+)?$/.test(trimmed)) {
        return Number(trimmed.replace(',', '.'));
      }
      return null;
    }
    if (Array.isArray(data)) {
      for (var i = 0; i < data.length; i++) {
        var nested = _findScoreValue(data[i]);
        if (nested !== null) return nested;
      }
      return null;
    }
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (/^(score|ai_score|aiscore|aiScore|value|rating|result|resultado)$/i.test(key)) {
          var nested = _findScoreValue(data[key]);
          if (nested !== null) return nested;
        }
      }
      for (var j = 0; j < keys.length; j++) {
        var value = data[keys[j]];
        if (typeof value === 'object' || typeof value === 'string') {
          var nested2 = _findScoreValue(value);
          if (nested2 !== null) return nested2;
        }
      }
    }
    return null;
  }

  function _normalizeScore(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') val = val.trim().replace(',', '.').replace(/[^\d.-]/g, '');
    var num = Number(val);
    if (isNaN(num)) {
      // Tenta extrair apenas o primeiro número se a IA retornou texto extra
      var match = String(val).match(/(\d+(?:\.\d+)?)/);
      if (match) num = parseFloat(match[1]);
      else return null;
    }
    // Se o valor for > 1.0 (ex: 85), assume escala 0-100 e normaliza para 0.85
    var normalized = num > 1.0 ? num / 100 : num;
    if (normalized < 0 || normalized > 1) {
      console.warn("⚠️ [AIEnsemble] Score normalizado fora de faixa detectado e descartado: " + normalized + " (raw=" + num + ")");
      return null;
    }
    console.log("🔍 [DEBUG _normalizeScore] valor=" + val + " → normalizado=" + normalized.toFixed(3) + " (raw: " + num + ", escala: " + (num > 1.0 ? "0-100→0-1" : "0-1") + ")");
    return normalized;
  }

  function _extractTechScore(data) {
    if (!data) return 0.5;
    // Prioriza o score técnico calibrado do algoritmo Core 22 se disponível
    if (data.score !== undefined) return data.score > 1 ? data.score / 100 : data.score;

    let score = 0;
    if (data.trend === "up") score += 0.3;
    if (data.rsi < 30) score += 0.2;
    if (data.rsi > 70) score -= 0.2;
    if (data.macd === "bullish") score += 0.2;
    return Math.max(0, Math.min(1, score + 0.5));
  }

  function _safeParse(text) {
    if (!text) return null;
    if (typeof text === 'object') return text;
    
    // Se o texto for "null" (string do conector)
    if (text === "null" || text.trim() === "") return null;

    // 1. Limpeza inicial de blocos de código Markdown e espaços em branco
    let cleaned = text.toString()
      .replace(/<think>[\s\S]*?<\/think>/gi, '') // Blindagem contra tags de raciocínio
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed === 'string') {
        return _safeParse(parsed);
      }
      if (typeof parsed === 'number') {
        return { score: parsed };
      }
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        return parsed[0];
      }
      return parsed;
    } catch (e) {
      // 2. Busca o primeiro '{' e o último '}' para isolar o objeto JSON de textos explicativos
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      
      if (start !== -1 && end !== -1) {
        // 3. Extração e correção de vírgulas pendentes (trailing commas) que invalidam o JSON standard
        const jsonStr = cleaned.substring(start, end + 1).replace(/,\s*([\}\]])/g, '$1');
        try { return JSON.parse(jsonStr); } catch (e2) {}
      }

      // 4. Fallback em texto livre: procura por um score numérico solto no texto
      const scoreMatch = cleaned.match(/score\s*[:=]\s*([0-9]+(?:[.,][0-9]+)?)/i);
      if (scoreMatch) {
        return { score: Number(scoreMatch[1].replace(',', '.')) };
      }

      return null;
    }
  }

  function _scoreToDecision(score) {
    if (score >= 0.75) return "COMPRA_FORTE";
    if (score >= 0.6) return "COMPRA";
    if (score <= 0.25) return "VENDA_FORTE";
    if (score <= 0.4) return "VENDA";
    return "NEUTRO";
  }

  // ===========================================================================
  // ✅ TESTES LOCAIS DO ENSEMBLE UNIFICADO + DEBUG COMPLETO
  // ===========================================================================
  function TESTAR_ENSEMBLE() {
    var mock = { ticker: 'PETR4', price: 36.50, score: 75, indicators: { rsi: 65, adx: 28 } };
    console.log("🧪 Teste AIEnsemble Unificado:");
    console.log("analyzeWithEnsemble:", JSON.stringify(analyzeWithEnsemble(mock), null, 2));
    console.log("getEnhancedScore:", JSON.stringify(getEnhancedScore(mock), null, 2));
  }

  /**
   * Debug função: Verifica por que IA está retornando 0 ou null
   */
  function DEBUG_AI_FAILURE(ticker) {
    console.log("\n🔍 === DEBUG IA FAILURE ===");
    console.log("Testando chamadas de IA para: " + ticker);
    
    // Teste Gemini direto
    console.log("\n1️⃣ Testando AI_Connector.callGemini:");
    try {
      var promptSimples = "Responda em JSON: {\"score\": 0.75}";
      var resGemini = AI_Connector.callGemini(promptSimples, { jsonMode: true });
      console.log("  Resposta Gemini (raw):", resGemini);
      console.log("  Tipo:", typeof resGemini);
      console.log("  É null?", resGemini === null);
      console.log("  Parsed:", _safeParse(resGemini));
    } catch(e) {
      console.error("  ❌ Erro ao chamar Gemini:", e.message);
    }
    
    // Teste DeepSeek direto
    console.log("\n2️⃣ Testando AI_Connector.callDeepSeek:");
    try {
      var resDeepSeek = AI_Connector.callDeepSeek(promptSimples, { jsonMode: true });
      console.log("  Resposta DeepSeek (raw):", resDeepSeek);
      console.log("  Tipo:", typeof resDeepSeek);
      console.log("  É null?", resDeepSeek === null);
      console.log("  Parsed:", _safeParse(resDeepSeek));
    } catch(e) {
      console.error("  ❌ Erro ao chamar DeepSeek:", e.message);
    }
    
    // Teste de score extraction
    console.log("\n3️⃣ Testando _extractScore:");
    var testObjs = [
      { score: 0.75 },
      { score: 75 },
      null,
      { score: null },
      { score: 0 },
      undefined
    ];
    testObjs.forEach(function(obj, i) {
      var result = _extractScore(obj);
      console.log("  Input " + i + ":", obj, "→", result);
    });
    
    console.log("\n🔍 === FIM DEBUG ===");
  }

  // ===========================================================================
  // ✅ API PÚBLICA EXPORTADA
  // ===========================================================================
  return {
    getEnhancedScore: getEnhancedScore,
    analyzeWithEnsemble: analyzeWithEnsemble, // retrocompatibilidade com módulo 55
    getEnhancedScoresBatch: getEnhancedScoresBatch, // Adicionado para Orchestrator v9.5
    analisar: analisar, // retrocompatibilidade com módulo 08
    TESTAR_ENSEMBLE: TESTAR_ENSEMBLE,
    DEBUG_AI_FAILURE: DEBUG_AI_FAILURE
  };

})();