/**
 * 55_AI_Ensemble.js
 * =============================================================================
 * MÓDULO ENSEMBLE DE IA — UNIFICADO v10.0
 * =============================================================================
 * Fornece duas interfaces críticas para o pipeline:
 *   1. AIEnsemble.getEnhancedScoresBatch(candidatos) — usado pelo Orchestrator
 *      para enriquecer scores em lote via IA (Gemini + DeepSeek fallback)
 *   2. AIEnsemble.analisar(prompt, options) — usado pelo AgentAnalyst para
 *      análise individual de um ativo com prompt customizado
 *
 * Dependências:
 *   - AI_Connector (07_AI_Unified_Connector.js) — chamadas reais às APIs
 *   - RateLimiter (04_Core_RateLimiter.js) — controle de taxa
 *   - CONFIG (01_Core_Config.js) — configurações centralizadas
 * =============================================================================
 */

'use strict';

var AIEnsemble = (function () {

  // ---------------------------------------------------------------------------
  // CONFIGURAÇÕES
  // ---------------------------------------------------------------------------

  /**
   * Lê configuração do CONFIG global ou usa fallback.
   */
  function _cfg(key, fallback) {
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function')
      ? CONFIG.get(key, fallback)
      : fallback;
  }

  var CONF = {
    TIMEOUT_MS: _cfg('AI_TIMEOUT_MS', 25000),
    MAX_RETRIES: _cfg('AI_MAX_RETRIES', 2),
    PAUSE_BETWEEN_CALLS_MS: _cfg('AI_PAUSE_BETWEEN_CALLS_MS', 500),
    ENSEMBLE_WEIGHT_GEMINI: _cfg('ENSEMBLE_WEIGHT_GEMINI', 0.6),
    ENSEMBLE_WEIGHT_DEEPSEEK: _cfg('ENSEMBLE_WEIGHT_DEEPSEEK', 0.4),
    // 🔧 CORREÇÃO v9: Reduzido de 65 para 55 para alinhar com DecisionEngine v9
    // Com adjustment macro 0.8x-0.95x, scores técnicos de 70 viram 56-66
    // Threshold 65 inviabilizava aprovações em regimes restritivos
    SCORE_MINIMO_APROVACAO: _cfg('IA_SCORE_MINIMO', 55),

    FALLBACK_SCORE: _cfg('ENSEMBLE_FALLBACK_SCORE', 50)
  };

  // ---------------------------------------------------------------------------
  // HELPERS INTERNOS
  // ---------------------------------------------------------------------------

  /**
   * Sanitiza e extrai JSON da resposta textual da IA.
   * @param {string} rawText
   * @returns {Object|null}
   */
  function _extrairJSON(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;

    try {
      return JSON.parse(rawText);
    } catch (e1) {
      try {
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
   * Chama o conector unificado de IA com fallback automático.
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

  // ---------------------------------------------------------------------------
  // FUNÇÃO 1: getEnhancedScoresBatch — usada pelo Orchestrator._enriquecerComIA
  // ---------------------------------------------------------------------------

  /**
   * Enriquece uma lista de candidatos com scores de IA em lote.
   * @param {Array} candidatos — Lista de objetos de oportunidade
   * @returns {Array} Lista enriquecida com enrichedScore, ensembleScore, sentiment, etc.
   */
  // ═════════════════════════════════════════════════════════════════════════
  // CONSTANTES PARA LOTE
  // ═════════════════════════════════════════════════════════════════════════
  var BATCH_SIZE = 5; // Número de ativos analisados por chamada de IA

  /**
   * Gera prompt multi-ativo para análise em lote única.
   * Em vez de N chamadas individuais, faz N/BATCH_SIZE chamadas.
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
        '  Vol Rel: ' + (op.volumeRelativo || (ind.volumeRelativo || 1.0).toFixed(2)) + 'x\n'
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

  function getEnhancedScoresBatch(candidatos) {
    if (!candidatos || !Array.isArray(candidatos) || candidatos.length === 0) {
      console.warn('⚠️ [AIEnsemble] Lista de candidatos vazia para getEnhancedScoresBatch');
      return [];
    }

    var total = candidatos.length;
    console.log('🤖 [AIEnsemble] Processando ' + total + ' ativos em lotes de ' + BATCH_SIZE + '...');

    var resultados = [];

    // Processa em lotes para reduzir chamadas de API
    for (var batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
      var batch = candidatos.slice(batchStart, batchStart + BATCH_SIZE);
      var batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
      var totalBatches = Math.ceil(total / BATCH_SIZE);
      var batchTickers = batch.map(function(o) { return o.ticker; }).join(', ');
      
      console.log('   📦 Lote ' + batchNum + '/' + totalBatches + ': ' + batchTickers);

      // Tenta análise via IA em lote
      var resultadoIA = null;
      if (batch.length > 1) {
        // Prompt único para múltiplos ativos
        var batchPrompt = _montarPromptBatch(batch);
        var resposta = _callAI(batchPrompt, {
          model: _cfg('GEMINI_MODEL', 'gemini-2.0-flash-lite'),
          temperature: 0.1,
          jsonMode: true
        });
        resultadoIA = resposta ? _extrairJSON(resposta) : null;
      }

      // Processa cada ativo no lote
      for (var i = 0; i < batch.length; i++) {
        var op = batch[i];
        if (!op || !op.ticker) {
          resultados.push(_makeFallbackResult(op ? op.ticker : 'N/A', 0, 'Dados inválidos'));
          continue;
        }

        try {
          var ticker = op.ticker;
          var scoreBase = (typeof op.score === 'number' && isFinite(op.score)) ? op.score : 50;
          var rsi = op.rsi || (op.indicators && op.indicators.rsi) || 50;
          var adx = op.adx || (op.indicators && op.indicators.adx) || 25;
          var rr = op.rr || 0;
          var setup = op.setupType || op.setup || 'N/A';
          var price = op.price || 0;

          // Extrai análise deste ativo do resultado do lote
          var parsedItem = null;
          if (Array.isArray(resultadoIA)) {
            for (var j = 0; j < resultadoIA.length; j++) {
              var p = resultadoIA[j];
              if (p && p.ticker && p.ticker.toUpperCase() === ticker.toUpperCase()) {
                parsedItem = p;
                break;
              }
            }
          } else if (resultadoIA && typeof resultadoIA === 'object' && resultadoIA.ticker) {
            // Resposta única (caso lote de 1)
            if (resultadoIA.ticker.toUpperCase() === ticker.toUpperCase()) {
              parsedItem = resultadoIA;
            }
          }

          var aiScore, sentiment, rationale;

          if (parsedItem && typeof parsedItem.score === 'number') {
            aiScore = Math.max(0, Math.min(100, Math.round(parsedItem.score)));
            sentiment = parsedItem.sentiment || 'NEUTRAL';
            rationale = parsedItem.rationale || 'Análise Ensemble';
          } else {
            // Fallback técnico (sem chamada individual)
            aiScore = _calcularScoreTecnicoFallback(op);
            sentiment = aiScore >= 65 ? 'BULLISH' : (aiScore < 40 ? 'BEARISH' : 'NEUTRAL');
            rationale = 'Fallback técnico (lote sem resposta IA)';
          }

          // Score combinado: média ponderada entre score técnico original e IA
          var ensembleScore = Math.round((scoreBase * 0.4) + (aiScore * 0.6));
          var aiConfidence = parsedItem ? 0.8 : 0.3;

          resultados.push({
            ticker: ticker,
            score: scoreBase,
            enrichedScore: ensembleScore,
            ensembleScore: ensembleScore,
            aiScore: aiScore,
            aiConfidence: aiConfidence,
            sentiment: sentiment,
            aiRationale: rationale,
            fallback: !parsedItem,
            // Preserva campos originais
            price: op.price,
            rr: op.rr,
            rsi: op.rsi,
            adx: op.adx,
            setupType: op.setupType,
            setup: op.setup,
            indicators: op.indicators,
            reprovado: op.reprovado,
            motivo: op.motivo,
            macroMultiplier: op.macroMultiplier,
            avgVolume: op.avgVolume,
            livePrice: op.livePrice,
            estrategiaEntrada: op.estrategiaEntrada,
            stopLoss: op.stopLoss,
            target1: op.target1,
            target2: op.target2,
            fiboPrice: op.fiboPrice,
            pivot: op.pivot,
            riscoPercent: op.riscoPercent,
            volFactor: op.volFactor,
            volume: op.volume,
            volumeRelativo: op.volumeRelativo,
            volumeStatus: op.volumeStatus,
            paReason: op.paReason,
            riskDebug: op.riskDebug,
            isWeeklyBullish: op.isWeeklyBullish,
            data: op.data,
            observacoes: op.observacoes,
            bollingerUpper: op.bollingerUpper,
            bollingerMiddle: op.bollingerMiddle,
            bollingerLower: op.bollingerLower
          });

          console.log('   ✅ [AIEnsemble] ' + ticker + ': score=' + scoreBase + ' → IA=' + aiScore + ' → ensemble=' + ensembleScore + ' | ' + sentiment);

        } catch (e) {
          console.error('❌ [AIEnsemble] Erro ao processar ' + (op.ticker || '?') + ': ' + e.message);
          resultados.push(_makeFallbackResult(op.ticker || 'N/A', op.score || 0, 'Erro: ' + e.message));
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

  /** Helper para criar resultado fallback */
  function _makeFallbackResult(ticker, score, motivo) {
    return {
      ticker: ticker,
      score: score,
      enrichedScore: score,
      ensembleScore: score,
      aiScore: score,
      aiConfidence: 0,
      sentiment: 'NEUTRAL',
      aiRationale: motivo || 'Fallback',
      fallback: true
    };
  }

  // ---------------------------------------------------------------------------
  // FUNÇÃO 2: analisar — usada pelo AgentAnalyst.analyze()
  // ---------------------------------------------------------------------------

  /**
   * Analisa um prompt customizado e retorna decisão estruturada.
   * Usado pelo AgentAnalyst (36) para análise individual de ativos.
   *
   * @param {string} prompt — Prompt completo (system + user) para a IA
   * @param {Object} options — Opções contextuais
   * @param {string} options.ticker — Ticker do ativo
   * @param {number} options.score — Score técnico base (0-100)
   * @param {string} options.trend — Tendência (bullish/bearish/neutral)
   * @param {number} options.rsi — RSI atual
   * @param {number} options.adx — ADX atual
   * @param {string} options.macd — MACD (bullish/bearish/neutral)
   * @returns {Object} { decision, finalScore, rejected, breakdown, rationale }
   */
  function analisar(prompt, options) {
    options = options || {};

    var ticker = options.ticker || 'N/A';
    var scoreBase = (typeof options.score === 'number' && isFinite(options.score)) ? options.score : 50;

    console.log('   🤖 [AIEnsemble] Analisando ' + ticker + ' (score base: ' + scoreBase + ')...');

    try {
      // --- CHAMADA GEMINI ---
      var respostaGemini = null;
      var scoreGemini = 0;
      var sentimentGemini = 'NEUTRAL';

      try {
        if (typeof AI_Connector !== 'undefined') {
          var rawGemini = AI_Connector.callGemini(prompt, {
            jsonMode: true,
            temperature: 0.2,
            model: _cfg('GEMINI_MODEL', 'gemini-2.0-flash-lite')
          });

          if (rawGemini) {
            var parsedGemini = _extrairJSON(rawGemini);
            if (parsedGemini) {
              scoreGemini = typeof parsedGemini.ai_score === 'number' ? parsedGemini.ai_score :
                            typeof parsedGemini.score === 'number' ? parsedGemini.score : 0;
              sentimentGemini = parsedGemini.sentiment || 'NEUTRAL';
              respostaGemini = parsedGemini;
            }
          }
        }
      } catch (eGemini) {
        console.warn('   ⚠️ [AIEnsemble] Gemini falhou para ' + ticker + ': ' + eGemini.message);
      }

      // --- CHAMADA DEEPSEEK (fallback ou complemento) ---
      var respostaDeepSeek = null;
      var scoreDeepSeek = 0;
      var sentimentDeepSeek = 'NEUTRAL';

      try {
        if (typeof AI_Connector !== 'undefined') {
          var rawDS = AI_Connector.callDeepSeek(prompt, {
            jsonMode: true,
            temperature: 0.2
          });

          if (rawDS) {
            var parsedDS = _extrairJSON(rawDS);
            if (parsedDS) {
              scoreDeepSeek = typeof parsedDS.ai_score === 'number' ? parsedDS.ai_score :
                              typeof parsedDS.score === 'number' ? parsedDS.score : 0;
              sentimentDeepSeek = parsedDS.sentiment || 'NEUTRAL';
              respostaDeepSeek = parsedDS;
            }
          }
        }
      } catch (eDS) {
        console.warn('   ⚠️ [AIEnsemble] DeepSeek falhou para ' + ticker + ': ' + eDS.message);
      }

      // --- PONDERAÇÃO DOS RESULTADOS ---
      var pesoGemini = respostaGemini ? CONF.ENSEMBLE_WEIGHT_GEMINI : 0;
      var pesoDeepSeek = respostaDeepSeek ? CONF.ENSEMBLE_WEIGHT_DEEPSEEK : 0;

      // Se ambos falharam, usa fallback técnico
      if (pesoGemini === 0 && pesoDeepSeek === 0) {
        var techScore = _calcularScoreTecnicoFallback(options);
        return {
          decision: techScore >= CONF.SCORE_MINIMO_APROVACAO ? 'COMPRA' : 'AGUARDAR',
          finalScore: techScore,
          rejected: techScore < CONF.SCORE_MINIMO_APROVACAO,
          breakdown: { gemini: 0, deepseek: 0, tecnico: techScore },
          rationale: 'Fallback técnico completo (IA indisponível)',
          sentiment: techScore >= 65 ? 'BULLISH' : (techScore < 40 ? 'BEARISH' : 'NEUTRAL')
        };
      }

      // Se apenas um respondeu, dá peso total a ele
      if (pesoGemini > 0 && pesoDeepSeek === 0) {
        pesoGemini = 1.0;
      } else if (pesoDeepSeek > 0 && pesoGemini === 0) {
        pesoDeepSeek = 1.0;
      }

      // Score final ponderado
      var scoreFinal = 0;
      if (pesoGemini + pesoDeepSeek > 0) {
        scoreFinal = Math.round(
          ((scoreGemini * pesoGemini) + (scoreDeepSeek * pesoDeepSeek)) /
          (pesoGemini + pesoDeepSeek)
        );
      }

      // Sentimento combinado (preferência para BULLISH se houver conflito)
      var sentimentFinal = 'NEUTRAL';
      if (sentimentGemini === 'BULLISH' || sentimentDeepSeek === 'BULLISH') {
        sentimentFinal = 'BULLISH';
      } else if (sentimentGemini === 'BEARISH' || sentimentDeepSeek === 'BEARISH') {
        sentimentFinal = 'BEARISH';
      }

      // Decisão final
      var decision = scoreFinal >= CONF.SCORE_MINIMO_APROVACAO ? 'COMPRA' : 'AGUARDAR';
      var rejected = scoreFinal < CONF.SCORE_MINIMO_APROVACAO;

      // Monta rationale combinado
      var rationaleParts = [];
      if (respostaGemini && respostaGemini.rationale) {
        rationaleParts.push('G:' + respostaGemini.rationale.substring(0, 100));
      }
      if (respostaDeepSeek && respostaDeepSeek.rationale) {
        rationaleParts.push('D:' + respostaDeepSeek.rationale.substring(0, 100));
      }
      if (rationaleParts.length === 0) {
        rationaleParts.push('Score combinado: ' + scoreFinal);
      }

      return {
        decision: decision,
        finalScore: scoreFinal,
        rejected: rejected,
        breakdown: {
          gemini: scoreGemini,
          deepseek: scoreDeepSeek,
          tecnico: scoreBase
        },
        rationale: rationaleParts.join(' | '),
        sentiment: sentimentFinal
      };

    } catch (e) {
      console.error('❌ [AIEnsemble] Erro fatal ao analisar ' + ticker + ': ' + e.message);

      // Fallback seguro
      var fallbackScore = _calcularScoreTecnicoFallback(options);
      return {
        decision: 'AGUARDAR',
        finalScore: fallbackScore,
        rejected: true,
        breakdown: { gemini: 0, deepseek: 0, tecnico: fallbackScore },
        rationale: 'Erro no Ensemble: ' + e.message,
        sentiment: 'NEUTRAL'
      };
    }
  }

  // ---------------------------------------------------------------------------
  // API PÚBLICA
  // ---------------------------------------------------------------------------

  return {
    getEnhancedScoresBatch: getEnhancedScoresBatch,
    analisar: analisar
  };

})();