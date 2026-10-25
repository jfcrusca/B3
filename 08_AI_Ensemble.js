/**
 * 08_AI_Ensemble.js
 * =============================================================================
 * CENTRAL DE INTELIGÊNCIA COLETIVA DE IA (UNIFICADO v10.4 — MERGE 08+55 + B2 + B10)
 * =============================================================================
 * v10.4 (B10): FONTE ÚNICA DO AJUSTE DE IA. `getEnhancedScoresBatch` deixa de
 *   sobrescrever `op.score` com o score já ajustado pela IA do LOTE. Passa a
 *   preservar `op.score` = TÉCNICO PURO e a expor o resultado da IA do lote em
 *   campos separados (ensembleScore/scoreIA/scoreTecnico/scoreFinal). Isso
 *   elimina a DUPLA aplicação do ajuste de IA (lote no 08 + deep no 34), que
 *   gerava scores como "84 -3 = 81" para um técnico real de 71.25. O ponto ÚNICO
 *   de consolidação permanece no 34_DecisionEngine (ScorePolicy).
 * =============================================================================
 * v10.2 (B2): `getEnhancedScoresBatch` deixa de calcular um `ensembleScore`
 *   divergente (0.4*tech + 0.6*ia) e passa a usar a POLÍTICA ÚNICA de score
 *   (09_ScorePolicy): final = técnico + ajusteIA_limitado(±cap). Assim o score
 *   exibido é o MESMO do Sentinela (34_DecisionEngine) — sem 3 valores para o
 *   mesmo ativo.
 * =============================================================================
 * Fusão definitiva dos Ensembles 08 (Multi-IA) e 55 (Produção Otimizada).
 * Elimina a colisão do global `AIEnsemble` (o 55 sobrescrevia o 08 em runtime).
 *
 * Módulo canônico: 08_AI_Ensemble.js
 *   - Restaura getEnhancedScore, analyzeWithEnsemble, TESTAR_ENSEMBLE, DEBUG_AI_FAILURE
 *   - Unifica analisar(prompt, options) — compatível com 36_Agent_Analyst.js
 *   - Unifica getEnhancedScoresBatch — lote de 5 (do 55) + preservação de campos
 *   - Expõe PESOS (corrige VerificarFunciona.js)
 *   - Mantém pesos dinâmicos por ADX/macro e sizing dinâmico (do 08)
 *
 * Dependências:
 *   - AI_Connector (07_AI_Unified_Connector.js)
 *   - CONFIG (01_Core_Config.js) — opcional, via _cfg()
 *   - MacroFetcher (56_MacroFetcher.js) — opcional
 * =============================================================================
 */

var AIEnsemble = (function() {
  'use strict';

  // Configurações padrão do Ensemble
  const CONFIG_ENSEMBLE = {
    DISCORD_THRESHOLD: 0.40,
    MIN_SCORE_DEFAULT: 0.65,
    MIN_SCORE_BEARISH: 0.70
  };

  // ===========================================================================
  // ⚙️ CONFIG / HELPERS DE WORKFLOW EM LOTE
  // ---------------------------------------------------------------------------
  // Fundidos do antigo 55_AI_Ensemble.js (merge v10.1). O 55 declarava o mesmo
  // global `AIEnsemble` e, por carga alfabética no GAS, sobrescrevia este módulo
  // em runtime — matando getEnhancedScore/analyzeWithEnsemble/TESTAR_ENSEMBLE/
  // DEBUG_AI_FAILURE. Este arquivo é agora o módulo canônico e único.
  // ===========================================================================

  /**
   * Lê configuração do CONFIG global ou usa fallback.
   * @param {string} key
   * @param {*} fallback
   * @returns {*}
   */
  function _cfg(key, fallback) {
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function')
      ? CONFIG.get(key, fallback)
      : fallback;
  }

  /**
   * Configurações do fluxo em lote (fonte única de verdade).
   * Nota: PAUSE_BETWEEN_CALLS_MS também alimenta a pausa do workflow rápido.
   */
  var CONF = {
    TIMEOUT_MS: _cfg('AI_TIMEOUT_MS', 25000),
    MAX_RETRIES: _cfg('AI_MAX_RETRIES', 2),
    PAUSE_BETWEEN_CALLS_MS: _cfg('AI_PAUSE_BETWEEN_CALLS_MS', 500),
    ENSEMBLE_WEIGHT_GEMINI: _cfg('ENSEMBLE_WEIGHT_GEMINI', 0.6),
    ENSEMBLE_WEIGHT_DEEPSEEK: _cfg('ENSEMBLE_WEIGHT_DEEPSEEK', 0.4),
    // 🔧 CORREÇÃO v9: Reduzido de 65 para 55 para alinhar com DecisionEngine v9
    SCORE_MINIMO_APROVACAO: _cfg('IA_SCORE_MINIMO', 55),
    FALLBACK_SCORE: _cfg('ENSEMBLE_FALLBACK_SCORE', 50)
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

  // ===========================================================================
  // 🔀 WORKFLOW A.1: HELPERS DE ANÁLISE EM LOTE
  // ---------------------------------------------------------------------------
  // Portados do antigo 55_AI_Ensemble.js: reduzem o consumo de API em ~5x
  // (BATCH_SIZE ativos por chamada de IA) e oferecem fallback técnico robusto.
  // ===========================================================================

  /** Número de ativos analisados por chamada de IA (lote). */
  var BATCH_SIZE = 5;

  /**
   * Sanitiza e extrai JSON da resposta textual da IA. (do módulo 55)
   * @param {string} rawText
   * @returns {Object|Array|null}
   */
  function _extrairJSON(rawText) {
    if (!rawText) return null;

    // O conector pode devolver o objeto já parseado.
    if (typeof rawText === 'object') return rawText;
    if (typeof rawText !== 'string') return null;

    try {
      return JSON.parse(rawText);
    } catch (e1) {
      try {
        // Limpa blocos markdown e tags de raciocínio antes de isolar o JSON.
        var limpo = rawText
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .trim();

        var inicio = limpo.indexOf('{');
        var fim = limpo.lastIndexOf('}');
        if (inicio !== -1 && fim !== -1) {
          return JSON.parse(limpo.substring(inicio, fim + 1));
        }

        var inicioArr = limpo.indexOf('[');
        var fimArr = limpo.lastIndexOf(']');
        if (inicioArr !== -1 && fimArr !== -1) {
          return JSON.parse(limpo.substring(inicioArr, fimArr + 1));
        }

        return null;
      } catch (e2) {
        console.warn('⚠️ [AIEnsemble] Falha ao extrair JSON: ' + e2.message);
        return null;
      }
    }
  }

  /**
   * Chama o conector unificado de IA com fallback automático Gemini → DeepSeek.
   * @param {string} prompt
   * @param {Object} [options]
   * @returns {string|null}
   */
  function _callAI(prompt, options) {
    options = options || {};
    options.jsonMode = true;

    if (typeof AI_Connector === 'undefined') {
      console.warn('⚠️ [AIEnsemble] AI_Connector indisponível');
      return null;
    }

    try {
      // Tenta Gemini primeiro
      var resposta = AI_Connector.callGemini(prompt, options);
      if (resposta) return resposta;

      // Fallback para DeepSeek
      console.warn('⚠️ [AIEnsemble] Gemini falhou, tentando DeepSeek...');
      resposta = AI_Connector.callDeepSeek(prompt, options);
      return resposta;

    } catch (e) {
      console.error('❌ [AIEnsemble] Erro ao chamar IA: ' + e.message);
      return null;
    }
  }

  /**
   * Gera um score técnico combinado a partir dos indicadores disponíveis.
   * Usado como fallback quando a IA não responde.
   * @param {Object} op — oportunidade com indicadores
   * @returns {number} score 0-100
   */
  function _calcularScoreTecnicoFallback(op) {
    if (!op) return CONF.FALLBACK_SCORE;

    var score = 50; // neutro

    // Ajuste por RSI
    var rsi = op.rsi || (op.indicators && op.indicators.rsi) || 50;
    if (rsi > 30 && rsi < 70) score += 5;  // zona saudável
    if (rsi > 50 && rsi < 65) score += 10; // momentum positivo
    if (rsi >= 70) score -= 10;            // sobrecomprado
    if (rsi <= 30) score -= 5;             // sobrevendido

    // Ajuste por ADX
    var adx = op.adx || (op.indicators && op.indicators.adx) || 25;
    if (adx >= 25) score += 10;  // tendência presente
    if (adx >= 30) score += 5;   // tendência forte
    if (adx < 20) score -= 10;   // lateral

    // Ajuste por RR
    var rr = op.rr || 0;
    if (rr >= 2.0) score += 10;
    if (rr >= 3.0) score += 5;
    if (rr < 1.5) score -= 5;

    // Ajuste por setupType
    var setup = op.setupType || op.setup || '';
    if (setup.indexOf('PULLBACK') !== -1) score += 5;
    if (setup.indexOf('ROMBIMENTO') !== -1) score += 10;
    if (setup.indexOf('TENDENCIA') !== -1) score += 5;

    // Normaliza entre 0 e 100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /** Helper para criar resultado fallback padronizado. */
  function _makeFallbackResult(ticker, score, motivo) {
    // 🔧 B2: contrato canônico também no caminho degradado (score = técnico, sem IA).
    var s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    return {
      ticker: ticker,
      score: s,
      enrichedScore: s,
      ensembleScore: s,
      scoreTecnico: s,
      scoreIA: null,
      scoreFinal: s,
      scoreMotivo: 'Fallback: ' + (motivo || 'sem IA') + ' (tecnico ' + s + ')',
      ajusteIA: 0,
      aiScore: null,
      aiConfidence: 0,
      sentiment: 'NEUTRAL',
      aiRationale: motivo || 'Fallback',
      fallback: true
    };
  }

  /**
   * Monta o prompt multi-ativo para análise em lote única.
   * Reduz as chamadas de API de N para N/BATCH_SIZE.
   * @param {Array} batch — até BATCH_SIZE oportunidades
   * @returns {string}
   */
  function _montarPromptBatch(batch) {
    var linhas = batch.map(function(op, idx) {
      var ind = op.indicators || {};
      return (
        'Ativo ' + (idx + 1) + ': ' + op.ticker + '\n' +
        '  Score Técnico: ' + (op.score || 50) + '\n' +
        '  RSI: ' + (op.rsi || ind.rsi || 50) + '\n' +
        '  ADX: ' + (op.adx || ind.adx || 25) + '\n' +
        '  R/R: ' + (op.rr || 0) + '\n' +
        '  Setup: ' + (op.setupType || op.setup || 'N/A') + '\n' +
        '  Preço: R$ ' + (op.price || 0) + '\n' +
        '  Vol Rel: ' + (op.volumeRelativo || Number(ind.volumeRelativo || 1.0).toFixed(2)) + 'x\n'
      );
    }).join('\n');

    return (
      'Você é um analista técnico quantitativo da B3. ' +
      'Analise os ' + batch.length + ' ativos abaixo e retorne APENAS um array JSON.\n' +
      'Formato: [{"ticker":"XX","score":<0-100>,"sentiment":"BULLISH|BEARISH|NEUTRAL","rationale":"..."}, ...]\n\n' +
      'REGRAS:\n' +
      '- ADX < 20 sem tendência → score < 40\n' +
      '- RSI > 70 sobrecomprado → score < 50\n' +
      '- RR >= 2.0 e ADX >= 25 → score > 60\n' +
      '- Score >= 65: BULLISH | Score < 40: BEARISH | Demais: NEUTRAL\n' +
      '- Volume Relativo < 0.6: penalizar liquidez (reduzir score em 10-15)\n' +
      '- Volume Relativo > 1.5: confirmar momentum (aumentar score em 5-10)\n' +
      '- Seja CONSERVADOR: prefira NEUTRAL a BULLISH em caso de dúvida\n' +
      '- Retorne APENAS o array JSON, sem texto adicional.\n\n' +
      'ATIVOS:\n' + linhas
    );
  }

  /**
   * Processamento em lote para o Orquestrador (unificado: lote do 55 + campos do 08).
   *
   * Estratégia: BATCH_SIZE ativos por chamada de IA (reduz o consumo de API em ~5x)
   * com fallback técnico determinístico por ativo. O contrato de saída preserva
   * TODOS os campos originais da oportunidade (necessário para o Ranker/Sheets) e
   * acrescenta: enrichedScore, ensembleScore, aiScore, aiConfidence, sentiment,
   * aiRationale, fallback e sources.
   *
   * @param {Array} lista — lista de oportunidades
   * @returns {Array} lista enriquecida
   */
  function getEnhancedScoresBatch(lista) {
    if (!lista || !Array.isArray(lista) || lista.length === 0) {
      console.warn('⚠️ [AIEnsemble] Lista de candidatos vazia para getEnhancedScoresBatch');
      return [];
    }

    var total = lista.length;
    console.log('🤖 [AIEnsemble] Processando ' + total + ' ativos em lotes de ' + BATCH_SIZE + '...');

    var resultados = [];

    // Processa em lotes para reduzir chamadas de API
    for (var batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
      var batch = lista.slice(batchStart, batchStart + BATCH_SIZE);
      var batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
      var totalBatches = Math.ceil(total / BATCH_SIZE);
      var batchTickers = batch.map(function(o) { return o.ticker; }).join(', ');

      console.log('   📦 Lote ' + batchNum + '/' + totalBatches + ': ' + batchTickers);

      // Tenta análise via IA em lote (apenas quando há mais de 1 ativo)
      var resultadoIA = null;
      if (batch.length > 1) {
        var batchPrompt = _montarPromptBatch(batch);
        var resposta = _callAI(batchPrompt, {
          model: _cfg('GEMINI_MODEL', 'gemini-3.1-flash-lite'),
          jsonMode: true
        });
        resultadoIA = resposta ? _extrairJSON(resposta) : null;
      }

      // Processa cada ativo do lote
      for (var i = 0; i < batch.length; i++) {
        var op = batch[i];
        if (!op || !op.ticker) {
          resultados.push(_makeFallbackResult(op ? op.ticker : 'N/A', 0, 'Dados inválidos'));
          continue;
        }

        try {
          var ticker = op.ticker;
          var scoreBase = (typeof op.score === 'number' && isFinite(op.score)) ? op.score : 50;

          // Localiza a análise deste ativo dentro da resposta do lote
          var parsedItem = null;
          if (Array.isArray(resultadoIA)) {
            for (var j = 0; j < resultadoIA.length; j++) {
              var p = resultadoIA[j];
              if (p && p.ticker && String(p.ticker).toUpperCase() === String(ticker).toUpperCase()) {
                parsedItem = p;
                break;
              }
            }
          } else if (resultadoIA && typeof resultadoIA === 'object' && resultadoIA.ticker) {
            // Resposta única (lote de 1)
            if (String(resultadoIA.ticker).toUpperCase() === String(ticker).toUpperCase()) {
              parsedItem = resultadoIA;
            }
          }

          var aiScore, sentiment, rationale;
          var isFallbackIA = false;

          if (parsedItem && !isNaN(Number(parsedItem.score))) {
            aiScore = Math.max(0, Math.min(100, Math.round(Number(parsedItem.score))));
            sentiment = _sanitizarSentiment(parsedItem.sentiment);
            rationale = parsedItem.rationale || 'Análise Ensemble';
          } else {
            // Fallback técnico (sem chamada individual). A IA crua é INDISPONÍVEL —
            // não inventamos score de IA: passamos null para a política (não altera
            // o técnico). `sentiment` segue NEUTRAL por ausência de sinal de IA.
            aiScore = null;
            isFallbackIA = true;
            sentiment = 'NEUTRAL';
            rationale = 'Fallback técnico (lote sem resposta IA)';
          }

          // ==============================================================
          // 🔧 B2 (v22.17): SCORE CANÔNICO ÚNICO (09_ScorePolicy)
          // --------------------------------------------------------------
          // ANTES: ensembleScore = 0.4*tech + 0.6*ia — um número "fantasma"
          // que NUNCA era usado pelo Sentinela (o 34 recalculava do zero),
          // gerando o 3º valor divergente. AGORA usamos a MESMA política do
          // DecisionEngine: final = técnico + ajusteIA_limitado(±cap).
          // ensembleScore/enrichedScore viram ALIASES do scoreFinal canônico.
          // ==============================================================
          var pacote;
          if (typeof ScorePolicy !== 'undefined' && typeof ScorePolicy.consolidar === 'function') {
            pacote = ScorePolicy.consolidar(scoreBase, aiScore);
          } else {
            var _n = 50, _c = 15, _p = 0.30;
            var _aj = (aiScore === null) ? 0
              : Math.round(Math.min(_c, Math.max(-_c, (aiScore - _n) * _p)));
            pacote = {
              scoreFinal: Math.max(0, Math.min(100, Math.round(scoreBase + _aj))),
              scoreTecnico: Math.round(scoreBase),
              scoreIA: aiScore,
              ajusteIA: _aj
            };
          }
          var ensembleScore = pacote.scoreFinal;
          var aiConfidence = parsedItem ? 0.8 : 0.3;

          // Preserva TODOS os campos originais e acrescenta os campos de IA.
          // ==============================================================
          // 🔧 B10 (v10.4): FONTE ÚNICA DO AJUSTE DE IA.
          // --------------------------------------------------------------
          // ANTES (bug B10): gravávamos `score: ensembleScore` (já com IA
          // do lote). Como o 34_DecisionEngine LÊ `op.score` como técnico e
          // reaplica ScorePolicy com a IA DEEP, o ajuste de IA era contado
          // DUAS vezes — com DUAS IAs diferentes (lote vs deep). Ex. KLBN11:
          // lote IA=76 → op.score=79; deep IA=40 → 84 -3 = 81 (técnico real
          // 71.25). Isso violava o objetivo B2 (consolidação UNICA).
          // AGORA: preservamos `op.score` = TÉCNICO PURO (scoreBase). O
          // resultado da IA do lote fica exposto em campos SEPARADOS
          // (ensembleScore/scoreIA/scoreTecnico/scoreFinal) apenas para
          // telemetria/UI. O ponto ÚNICO de consolidação continua no
          // 34_DecisionEngine (onde a IA deep é aplicada uma única vez).
          // ==============================================================
          var enriquecido = Object.assign({}, op, {
            score: pacote.scoreTecnico,    // 🔧 B10: mantém TÉCNICO PURO (não embute IA)
            enrichedScore: ensembleScore,  // alias retrocompatível (técnico + IA lote; só leitura)
            ensembleScore: ensembleScore,  // alias retrocompatível (técnico + IA lote; só leitura)
            scoreTecnico: pacote.scoreTecnico,
            scoreIA: pacote.scoreIA,
            scoreFinal: pacote.scoreFinal,
            scoreMotivo: pacote.motivo || ('Score tecnico ' + pacote.scoreTecnico +
              (pacote.ajusteIA >= 0 ? '+' : '') + pacote.ajusteIA + ' = ' + ensembleScore),
            ajusteIA: pacote.ajusteIA,
            aiScore: aiScore,
            aiConfidence: aiConfidence,
            sentiment: sentiment,
            aiRationale: rationale,
            fallback: isFallbackIA,
            sources: { tecnico: scoreBase, ia: aiScore }
          });

          resultados.push(enriquecido);

          console.log('   ✅ [AIEnsemble] ' + ticker + ': técnico(puro)=' + scoreBase +
            ' → IA(lote)=' + (aiScore === null ? 'n/a' : aiScore) +
            ' → lote=' + ensembleScore + ' (ajuste ' + pacote.ajusteIA + ') | ' + sentiment +
            ' | op.score mantido TÉCNICO PURO (consolidação única no Sentinela)');


        } catch (e) {
          console.error('❌ [AIEnsemble] Erro ao processar ' + (op.ticker || '?') + ': ' + e.message);
          resultados.push(Object.assign(
            { score: op.score || 0 },
            _makeFallbackResult(op.ticker || 'N/A', op.score || 0, 'Erro: ' + e.message)
          ));
        }
      }

      // Pausa entre lotes (não entre cada ativo)
      if (batchStart + BATCH_SIZE < total) {
        Utilities.sleep(CONF.PAUSE_BETWEEN_CALLS_MS);
      }
    }

    console.log('✅ [AIEnsemble] Lote concluído. ' + resultados.length + '/' + total + ' processados.');
    return resultados;
  }

  /**
   * Normaliza rótulos de sentimento aceitos pela IA.
   * @param {string} valor
   * @returns {string} BULLISH | BEARISH | NEUTRAL
   */
  function _sanitizarSentiment(valor) {
    var s = String(valor || '').toUpperCase();
    if (s.indexOf('BULL') !== -1) return 'BULLISH';
    if (s.indexOf('BEAR') !== -1) return 'BEARISH';
    return 'NEUTRAL';
  }

  // ===========================================================================
  // ⚙️ WORKFLOW B: VALIDAÇÃO PROFUNDA MULTI-AGENTE (Antigo Módulo 08)
  // ===========================================================================

  /**
   * Ponto de entrada do AgentAnalyst (36_Agent_Analyst.js) para validação profunda multi-IA.
   *
   * Assinatura compatível com BOTH contratos:
   *   analisar(prompt, options)                      — contrato do módulo 55
   *   analisar(prompt, dadosTecnicos, macroRegime)   — contrato do módulo 08 (legado)
   *
   * Implementa pesos dinâmicos em função do regime (ADX + macro) e sizing dinâmico.
   *
   * @param {string} prompt — prompt completo (system + user)
   * @param {Object} [options] — { ticker, score, trend, rsi, adx, macd, macroRegime }
   * @param {string} [macroRegime] — compatibilidade com a assinatura antiga do 08
   * @returns {Object} { decision, finalScore, rejected, breakdown, rationale, sentiment, pesos, positionSize }
   */
  function analisar(prompt, options, macroRegime) {
    options = options || {};
    if (typeof options !== 'object') options = {};

    // Compatibilidade: o 08 antigo passava dadosTecnicos no 2º parâmetro.
    var ticker = options.ticker || "Ativo";
    var macroRegimeEfetivo = options.macroRegime || macroRegime || "NEUTRAL";

    console.log("🧠 [AIEnsemble] Iniciando análise multi-IA profunda para " + ticker + " (regime " + macroRegimeEfetivo + ")...");

    // Unificando escala para 0-100 em todo o módulo
    var rawTechScore = (typeof options.score === 'number' && isFinite(options.score)) ? options.score : 50;
    var techScore = rawTechScore > 1 ? rawTechScore : rawTechScore * 100;

    var adx = options.adx || 25; // Lê o ADX do ativo para o ajuste de pesos dinâmicos

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
          var geminiRaw = AI_Connector.callGemini(promptGemini, { jsonMode: true });
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

    // 💡 B9 (v10.3): _extractScore já devolve 0-100 (escala canônica).
    // Não convertemos mais aqui — mantém TUDO em 0-100 ponta a ponta.

    if (gS !== null && isNaN(gS)) gS = null;
    if (dS !== null && isNaN(dS)) dS = null;

    // Ajuste dinâmico de pesos (considera nulls + ADX + regime macro)
    var weights = _ajustarPesosDinamicos(gS, dS, adx, macroRegimeEfetivo);

    // =====================================================================
    // B2 (v10.2): SCORE DE IA PURO (nao re-blenda o tecnico)
    // ---------------------------------------------------------------------
    // ANTES: finalScore = w.G*gS + w.D*dS + w.TECH*techScore misturava o
    // tecnico dentro do ai_score, e o DecisionEngine misturava de novo.
    // AGORA: devolvemos a CONCORDANCIA DAS IAs (0-100). O blend com o tecnico
    // ocorre UMA vez em 09_ScorePolicy (final = tecnico + ajusteIA).
    // =====================================================================
    var iaPesoTotal = weights.GEMINI + weights.DEEPSEEK;
    var iaConsenso;
    if (iaPesoTotal > 0) {
      iaConsenso = ((weights.GEMINI * (gS || 0)) + (weights.DEEPSEEK * (dS || 0))) / iaPesoTotal;
    } else {
      iaConsenso = null; // nenhuma IA respondeu
    }
    var scoreIA = (iaConsenso === null) ? null : Math.max(0, Math.min(100, Math.round(iaConsenso)));
    var finalScore = (scoreIA === null) ? techScore : scoreIA;

    var diff = (gS !== null && dS !== null) ? Math.abs(gS - dS) : 0;

    console.log("Ensemble IA: Gemini: " + (gS !== null ? gS.toFixed(1) : "OFF") + " | DeepSeek: " + (dS !== null ? dS.toFixed(1) : "OFF") + " | Consenso IA: " + (scoreIA === null ? "n/a" : scoreIA) + " | (tech ref: " + techScore.toFixed(1) + ")");

    // Validação de Conflito Crítico (Bloqueio)
    var conflitoBloqueante = false;
    // Se as duas concordam em direções opostas com força (diff > 40 pontos)
    // ✅ Ajuste: Aumentar o threshold de conflito para ser menos agressivo em BEARISH
    var currentDiscordThreshold = (macroRegimeEfetivo === "BEARISH" && techScore >= 70) ? 50 : (CONFIG_ENSEMBLE.DISCORD_THRESHOLD * 100);
    if (gS !== null && dS !== null && diff > currentDiscordThreshold) {
      console.warn("🚨 [AIEnsemble] Conflito extremo de convicção detectado. Vetando operação.");
      conflitoBloqueante = true;
    }

    // ==============================
// ⚖️ PENALIZAÇÃO POR DIVERGÊNCIA
// ==============================
    // 🔧 v10.4 (correção): a penalização ANTES caía em `finalScore`, mas o bloco
    // B2 (acima) reescreveu a fonte da verdade para `iaConsenso` — e é `aiScore`
    // (= iaConsenso arredondado) que viaja para 36_Agent_Analyst até o
    // DecisionEngine. Resultado: `finalScore *= 0.85` era trabalho PERDIDO; o
    // score publicado refletia o consenso BRUTO, sem punição por divergência.
    // Ex. real (log 25/10): Gemini 82 / DeepSeek 35 → diff 47 → penalidade 0.85
    // descartada → ai_score=73 chegou intacto ao Sentinela, que aprovou com 100.
    // Agora a penalidade é aplicada no PRÓPRIO consenso, único ponto que propaga.
    if (gS !== null && dS !== null) {
  var diff = Math.abs(gS - dS);

      if (diff > 35) {
        console.warn("🚨 Divergência forte entre IAs: " + diff.toFixed(1));
        iaConsenso *= 0.85; // penalização forte por falta de consenso
      } else if (diff > 20) {
        console.warn("⚠️ Divergência moderada entre IAs: " + diff.toFixed(1));
        // ✅ CORREÇÃO: Penalidade menos severa se em regime BEARISH e score técnico alto
        if (macroRegimeEfetivo === "BEARISH" && techScore >= 70) {
            iaConsenso *= 0.95; // Penalidade reduzida
        } else {
            iaConsenso *= 0.90; // Penalidade padrão
        }
  }
  // Reflete o consenso penalizado no score final (mesma fonte usada no return).
  // 🔧 v10.4: `scoreIA` (o `aiScore` do retorno, consumido por 36_ → 34_ → ScorePolicy)
  // foi calculado na linha acima ANTES desta penalização. Recalcula para que a
  // punição por divergência chegue, de fato, ao score publicado.
  finalScore = iaConsenso;
  scoreIA = Math.max(0, Math.min(100, Math.round(iaConsenso)));
  console.log("🔧 [AIEnsemble] Consenso penalizado por divergência: " + Math.round(finalScore) + " (aiScore=" + scoreIA + ")");
}


    // Regra de Threshold Operacional
    // ✅ v10.1 (merge): passa a respeitar CONF.SCORE_MINIMO_APROVACAO (configurável via
    // CONFIG/IA_SCORE_MINIMO), unificando o limiar do 55 com os thresholds de decisão do 08.
    var threshold = (macroRegimeEfetivo === "BEARISH" ? CONFIG_ENSEMBLE.MIN_SCORE_BEARISH : CONFIG_ENSEMBLE.MIN_SCORE_DEFAULT) * 100;
    threshold = Math.min(threshold, CONF.SCORE_MINIMO_APROVACAO);
    
    var rejected = finalScore < threshold || conflitoBloqueante;
    
    if (rejected) {
      var motivoRejeicao = conflitoBloqueante ? "Conflito crítico de inteligências" : "Score " + Math.round(finalScore) + " abaixo do limite " + Math.round(threshold);
      
      return {
        finalScore: Math.round(finalScore),
        aiScore: scoreIA,          // 🔧 B2: concordância das IAs (0-100) ou null
        decision: "NEUTRO",
        rejected: true,
        rationale: "Descartado pelo Ensemble: " + motivoRejeicao,
        breakdown: { gemini: gS, deepseek: dS, tecnico: techScore, conflito: diff },
        sentiment: _scoreToSentiment(finalScore),
        pesos: weights,
        positionSize: 0
      };
    }

    // Decisão final
    var decision = _scoreToDecision(finalScore / 100);

    var positionSize = _calcularSizingDinamico(finalScore / 100, (gS || 0) / 100, (dS || 0) / 100, macroRegimeEfetivo);

    return {
      finalScore: Math.round(finalScore),
      aiScore: scoreIA,          // 🔧 B2: concordância das IAs (0-100) ou null
      decision: decision,
      rejected: false,
      rationale: "Aprovado pelo Ensemble de IA. Consenso quantitativo atingido.",
      breakdown: { gemini: gS, deepseek: dS, tecnico: techScore, conflito: diff },
      sentiment: _scoreToSentiment(finalScore),
      pesos: weights,
      positionSize: positionSize
    };
  }

  /**
   * Converte score 0-100 em rótulo de sentimento padronizado.
   * @param {number} score
   * @returns {string} BULLISH | BEARISH | NEUTRAL
   */
  function _scoreToSentiment(score) {
    if (score >= 65) return 'BULLISH';
    if (score <= 40) return 'BEARISH';
    return 'NEUTRAL';
  }

  // ===========================================================================
  // 🛠️ FUNÇÕES AUXILIARES / MOTORES PRIVADOS
  // ===========================================================================

  /**
   * Ajusta dinamicamente os pesos com base no regime de ADX, no macro e em falhas de resposta das IAs.
   * Evita a anulação de estratégias opostas em regimes claros.
   * @param {number|null} gScore — score Gemini 0-100 (null se falhou)
   * @param {number|null} dScore — score DeepSeek 0-100 (null se falhou)
   * @param {number} adxValue — ADX do ativo
   * @param {string} [macroRegimeParam] — regime macro já resolvido (evita 2ª chamada ao MacroFetcher)
   * @returns {{GEMINI:number, DEEPSEEK:number, TECH:number}} pesos normalizados (soma = 1)
   */
  function _ajustarPesosDinamicos(gScore, dScore, adxValue, macroRegimeParam) {

    var macroRegime = macroRegimeParam || "NEUTRAL";

    // Se o regime não veio do chamador, tenta obter do MacroFetcher (retrocompatibilidade).
    if (!macroRegimeParam && typeof MacroFetcher !== 'undefined') {
      try {
        var macro = MacroFetcher.getMacroContext();
        macroRegime = (macro && macro.regime) || "NEUTRAL";
      } catch (e) {
        console.warn("⚠️ MacroFetcher falhou em _ajustarPesosDinamicos");
      }
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

  // 💡 B9 (v10.3): NORMALIZAÇÃO ÚNICA PARA 0-100 (elimina o ping-pong 0-1/0-100).
  // -----------------------------------------------------------------------------
  // ANTES: _normalizeScore devolvia 0-1 e o chamador fazia `gS *= 100`. Além disso
  // a heurística `num > 1` tornava o valor EXATO `1` ambíguo (1.00 = máximo OU 1%?).
  // AGORA: a função devolve SEMPRE 0-100 (escala canônica do projeto). Regra:
  //   • valor em [0, 1]  → é FRAÇÃO (a IA é instruída a responder 0.00-1.00) → ×100
  //   • valor > 1        → já está em 0-100 → usa direto (com clamp 0-100)
  // Assim `1` → 100 (máximo, coerente com o contrato do prompt) e `0.85` → 85.
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
    // Fração 0-1 (contrato do prompt) → escala 0-100. Já >1 → assume 0-100.
    var in100 = (num >= 0 && num <= 1) ? num * 100 : num;
    // Clamp defensivo: descarta entradas absurdas fora de 0-100.
    if (in100 < 0 || in100 > 100) {
      console.warn("⚠️ [AIEnsemble] Score fora de faixa descartado: " + in100 + " (raw=" + num + ")");
      return null;
    }
    console.log("🔍 [DEBUG _normalizeScore] valor=" + val + " → " + in100.toFixed(1) + " (raw: " + num + ", escala: " + (num >= 0 && num <= 1 ? "0-1→0-100" : "0-100") + ")");
    return in100;
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
    // --- Workflow A: enriquecimento rápido/em lote (Orchestrator) ---
    getEnhancedScore: getEnhancedScore,
    analyzeWithEnsemble: analyzeWithEnsemble, // retrocompatibilidade com módulo 55
    getEnhancedScoresBatch: getEnhancedScoresBatch, // Orchestrator._enriquecerComIA (lote de 5)

    // --- Workflow B: validação profunda multi-IA (AgentAnalyst) ---
    analisar: analisar,

    // --- Debug/Testes ---
    TESTAR_ENSEMBLE: TESTAR_ENSEMBLE,
    DEBUG_AI_FAILURE: DEBUG_AI_FAILURE,

    // Exposto para VerificarFunciona.js (corrige referência fantasma ao PESOS).
    // Contrato legado do módulo 55: { GEMINI: 0.50, TECNICO: 0.50 }.
    // Os pesos dinâmicos reais ficam em PESOS_PADRAO (usados por _ajustarPesosDinamicos).
    PESOS: { GEMINI: 0.50, TECNICO: 0.50 },

    // --- Configuração (auditoria/observabilidade) ---
    CONFIG_ENSEMBLE: CONFIG_ENSEMBLE,
    PESOS_PADRAO: PESOS_PADRAO
  };

})();
