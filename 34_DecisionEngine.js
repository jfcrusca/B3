/******************************************************************************/
// MODULO/ARQUIVO: 34_DecisionEngine.js
// TECNOLOGIA: JAVASCRIPT (V8 / Google Apps Script)
// FINALIDADE: Veredito unico para score, vetos e auditoria de decisoes.
// v10.3 (B2): scoreFinal passa a usar a POLITICA UNICA (09_ScorePolicy):
//   final = tecnico + ajusteIA_limitado(±cap). Elimina o 3º blend divergente
//   (0.7*tech + 0.3*ia) que gerava scores diferentes para o mesmo ativo.
// v10.3 (B7): REGIME MACRO com FONTE UNICA = multiplicador no Orchestrator.
//   Removido o veto/rejeicao redundante por macroRegime aqui (evitava dupla
//   penalidade BEARISH/DEFENSIVE). Permanece apenas o veto pelo sentimento
//   proprio do ativo (noticia/NLP). Macro segue registrado na auditoria.
// v10.4 (B10): ESTE E O PONTO UNICO DE CONSOLIDACAO DO AJUSTE DE IA.
//   O `op.score` que entra aqui e o TECNICO PURO (o 08_AI_Ensemble nao embute
//   mais a IA do lote em op.score). Assim a IA e aplicada UMA UNICA VEZ
//   (via ScorePolicy.consolidar), eliminando a dupla contagem batch+deep.
/******************************************************************************/

var DecisionEngine = (function () {
  'use strict';

  const CFG = {
    // 🔧 CORREÇÃO v9: Threshold reduzido para 55 para compensar adjustment macro
    // Com adjustment 0.8x-0.95x, scores técnicos de 70 viram 56-66
    // Threshold 60 inviabilizava aprovações em regime DEFENSIVE/BEARISH
    DEFAULT_THRESHOLD: 55,
    SENTIMENT_BONUS: {
      EXCELLENT: 15,
      BULLISH: 10,
      POSITIVE: 5,
      OTIMISTA: 5,
      NEUTRO: 0,
      NEUTRAL: 0,
      CAUTELA: -10,
      BEARISH: -10,  // 🔧 CORREÇÃO v9: Reduzido de -20 para -10 (penalidade mais suave)
      TERRIBLE: -100
    },
    HARD_VETO_SENTIMENTS: ['TERRIBLE', 'CRISE'],
    DYNAMIC_VETO_SENTIMENTS: ['BEARISH', 'CAUTELA', 'BAIXA'],
    // 🔧 CORREÇÃO v10.1: PENALIDADE POR EXTENSÃO (COMPRA PERTO DO TOPO)
    // Mede quanto o preço está "esticado" acima da média — proxy de timing ruim
    EXTENSAO_THRESHOLD_LEVE: 0.04,    // 4% acima da média → penalidade leve
    EXTENSAO_THRESHOLD_MODERADA: 0.07, // 7% acima da média → penalidade moderada
    EXTENSAO_THRESHOLD_SEVERA: 0.10,   // 10% acima da média → penalidade severa
    EXTENSAO_PENALTY_LEVE: 8,
    EXTENSAO_PENALTY_MODERADA: 15,
    EXTENSAO_PENALTY_SEVERA: 25,
    // 🔧 CORREÇÃO v10.1: BÔNUS BULLISH DEPENDENTE DA DISTÂNCIA AO SUPORTE
    // Sentimento BULLISH é recompensado com +10 apenas se o preço NÃO estiver esticado
    // Se esticado, bônus reduzido para +3 (reconhece tendência mas penaliza timing)
    BULLISH_BONUS_ESTICADO: 3
  };


  function _cfg(key, fallback) {
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function') ? CONFIG.get(key, fallback) : fallback;
  }

  function _clampScore(value) {
    var n = Number(value);
    if (!isFinite(n)) n = 0;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  function _normalizeSentiment(raw) {
    if (!raw) return 'NEUTRAL';

    var s = String(raw).toUpperCase().trim();

    if (s.indexOf('TERRIBLE') !== -1 || s.indexOf('CRISE') !== -1) return 'TERRIBLE';
    if (s.indexOf('BEARISH') !== -1 || s.indexOf('BAIXA') !== -1 || s.indexOf('NEGATIVO') !== -1 || s.indexOf('NEGATIVE') !== -1 || s.indexOf('RUIM') !== -1 || s.indexOf('BAD') !== -1) return 'BEARISH';
    if (s.indexOf('CAUTELA') !== -1 || s.indexOf('MIXED') !== -1) return 'CAUTELA';
    if (s.indexOf('EXCELLENT') !== -1) return 'EXCELLENT';
    if (s.indexOf('BULLISH') !== -1 || s.indexOf('ALTA') !== -1 || s.indexOf('POSITIVO') !== -1 || s.indexOf('POSITIVE') !== -1 || s.indexOf('FORTE') !== -1 || s.indexOf('BOM') !== -1 || s.indexOf('GOOD') !== -1) return 'BULLISH';
    if (s.indexOf('OTIMISTA') !== -1) return 'OTIMISTA';
    if (s.indexOf('NEUTRAL') !== -1 || s.indexOf('NEUTRO') !== -1 || s.indexOf('NORMAL') !== -1 || s.indexOf('SIDEWAYS') !== -1) return 'NEUTRAL';
    if (s.indexOf('DESCARTADO') !== -1 || s.indexOf('SKIPPED') !== -1) return 'NEUTRAL';

    console.warn('[DecisionEngine] Sentimento desconhecido "' + raw + '". Assumindo NEUTRAL.');
    return 'NEUTRAL';
  }

  function _sentimentBonus(sentiment) {
    var keyMap = {
      EXCELLENT: 'SENTIMENT_BONUS_EXCELLENT',
      BULLISH: 'SENTIMENT_BONUS_BULLISH',
      POSITIVE: 'SENTIMENT_BONUS_POSITIVE',
      OTIMISTA: 'SENTIMENT_BONUS_OTIMISTA',
      NEUTRO: 'SENTIMENT_BONUS_NEUTRO',
      NEUTRAL: 'SENTIMENT_BONUS_NEUTRAL',
      CAUTELA: 'SENTIMENT_PENALTY_CAUTELA',
      BEARISH: 'SENTIMENT_PENALTY_BEARISH',
      TERRIBLE: 'SENTIMENT_PENALTY_TERRIBLE'
    };
    var fallback = CFG.SENTIMENT_BONUS[sentiment];
    var bonus = keyMap[sentiment] ? _cfg(keyMap[sentiment], fallback) : fallback;
    return (typeof bonus === 'number') ? bonus : 0;
  }

  function _contains(list, value) {
    return list.indexOf(value) !== -1;
  }

  function _threshold(options, flexApplied) {
    // 🔧 CORREÇÃO v9: Threshold base é 55 (CFG.DEFAULT_THRESHOLD)
    // Quando flexApplied=true, NÃO aumentamos o threshold (antes era 70!)
    // O flexApplied já indica que o ativo tem qualidade técnica (score >= 50 + ADX >= 20)
    // Aumentar o threshold para 70 anularia o propósito do flex
    var threshold = CFG.DEFAULT_THRESHOLD;
    return threshold;
  }


  function _reject(ctx, reason, score, sentiment, stage) {
    ctx.auditTrail.push({
      stage: stage || 'REJECT',
      status: 'REJECTED',
      score: _clampScore(score),
      sentiment: sentiment || ctx.sentiment || 'UNKNOWN',
      reason: reason
    });

    return {
      status: 'REJECTED',
      score: _clampScore(score),
      sentiment: sentiment || ctx.sentiment || 'UNKNOWN',
      motivo: reason,
      fiboPrice: (ctx.op && ctx.op.fiboPrice) ? ctx.op.fiboPrice : 0,
      suggested_allocation: 0,
      formattedReport: 'REJEITADO | ' + ((ctx.op && ctx.op.ticker) || '?') + ' | ' + reason,
      auditTrail: ctx.auditTrail,
      decisionSource: 'DecisionEngine'
    };
  }

  function evaluate(input) {
    var options = input || {};
    var op = options.op || {};
    var memoria = options.memoria || {};
    var analise = options.analise || null;
    var macroRegime = String(options.macroRegime || 'NEUTRAL').toUpperCase();
    var riskCheckFn = options.riskCheckFn;

    var ctx = {
      op: op,
      auditTrail: [],
      sentiment: 'NEUTRAL'
    };

    if (!op || !op.ticker) {
      return _reject(ctx, 'Oportunidade invalida ou sem ticker.', 0, 'UNKNOWN', 'INPUT');
    }

    if (op.sentiment === 'DESCARTADO_PRETRIAGEM') {
      return _reject(ctx, 'Descartado na pre-triagem (score/RR insuficiente).', 0, 'NEUTRAL', 'PRE_TRIAGE');
    }

    var ticker = op.ticker;
    var scoreOriginal = _clampScore(op.score);

    // 🔧 CORREÇÃO v10.1: CÁLCULO DE EXTENSÃO (DISTÂNCIA DO TOPO)
    // Quanto mais o preço está acima da média (EMA21), pior o timing de entrada
    var extensaoPct = 0;
    var extensaoNivel = 'NENHUMA';
    try {
      var precoRef = Number(op.price) || Number(op.preco) || 0;
      var ema21Ref = Number(op.ema21) || (op.indicators && Number(op.indicators.ema21)) || 0;
      // Fallback: usa a média do bollinger se EMA21 não disponível
      if (!ema21Ref && op.indicators && op.indicators.bollinger) {
        ema21Ref = Number(op.indicators.bollinger.middle) || 0;
      }
      if (precoRef > 0 && ema21Ref > 0) {
        extensaoPct = (precoRef - ema21Ref) / ema21Ref;
        if (extensaoPct > CFG.EXTENSAO_THRESHOLD_SEVERA) {
          extensaoNivel = 'SEVERA';
        } else if (extensaoPct > CFG.EXTENSAO_THRESHOLD_MODERADA) {
          extensaoNivel = 'MODERADA';
        } else if (extensaoPct > CFG.EXTENSAO_THRESHOLD_LEVE) {
          extensaoNivel = 'LEVE';
        }
      }
    } catch(e) {
      console.warn("[DecisionEngine] Falha ao calcular extensão para " + ticker + ": " + e.message);
    }

    var scoreBase = scoreOriginal;

    // 🔧 CORREÇÃO v10.1: PENALIDADE POR EXTENSÃO APLICADA AO SCORE TÉCNICO
    // Ativo que subiu forte recentemente (ex: +12%) está "perto do topo"
    // Comprar agora = pagar preço cheio de uma esticada → penaliza o score
    if (extensaoNivel === 'SEVERA') {
      scoreBase = _clampScore(scoreBase - CFG.EXTENSAO_PENALTY_SEVERA);
      console.warn("[DecisionEngine] " + ticker + " EXTENSÃO SEVERA (" + (extensaoPct * 100).toFixed(1) + "% acima da média). Score técnico penalizado -" + CFG.EXTENSAO_PENALTY_SEVERA + ".");
    } else if (extensaoNivel === 'MODERADA') {
      scoreBase = _clampScore(scoreBase - CFG.EXTENSAO_PENALTY_MODERADA);
      console.warn("[DecisionEngine] " + ticker + " EXTENSÃO MODERADA (" + (extensaoPct * 100).toFixed(1) + "% acima da média). Score técnico penalizado -" + CFG.EXTENSAO_PENALTY_MODERADA + ".");
    } else if (extensaoNivel === 'LEVE') {
      scoreBase = _clampScore(scoreBase - CFG.EXTENSAO_PENALTY_LEVE);
      console.log("[DecisionEngine] " + ticker + " extensão leve (" + (extensaoPct * 100).toFixed(1) + "% acima da média). Score técnico penalizado -" + CFG.EXTENSAO_PENALTY_LEVE + ".");
    }

    // 🔧 CORREÇÃO v10.2: PENALIDADE POR PROXIMIDADE AO TOPO RECENTE (TOPO50)
    // Se o preço está dentro de 3% da máxima de 30 candles → timing ruim (risco de pullback)
    try {
      var topo50Ref = Number(op.topo50) || 0;
      if (topo50Ref > 0 && precoRef > 0 && topo50Ref > precoRef) {
        var distTopoCalc = (topo50Ref - precoRef) / topo50Ref;
        if (distTopoCalc < 0.01) {
          scoreBase = _clampScore(scoreBase - 20);
          console.warn("[DecisionEngine] " + ticker + " PREÇO NO TOPO RECENTE (R$" + topo50Ref.toFixed(2) + "). Penalidade -20.");
        } else if (distTopoCalc < 0.03) {
          scoreBase = _clampScore(scoreBase - 12);
          console.warn("[DecisionEngine] " + ticker + " próximo do topo (a " + (distTopoCalc * 100).toFixed(1) + "% da máxima). Penalidade -12.");
        }
      }
    } catch(e) {
      console.warn("[DecisionEngine] Falha ao aplicar penalidade de topo: " + e.message);
    }

    // 🔧 CORREÇÃO v10.2: PENALIDADE POR GANHO RÁPIDO (MOVIMENTO ACELERADO)
    // Detecta subida vertical (ex: +12% pós-resultado) — metrica mais robusta que EMA21
    try {
      var ganhoRapidoRef = Number(op.ganhoRapidoPct) || 0;
      if (ganhoRapidoRef > 0.08) {
        scoreBase = _clampScore(scoreBase - 15);
        console.warn("[DecisionEngine] " + ticker + " GANHO RÁPIDO de " + (ganhoRapidoRef * 100).toFixed(1) + "% em 10 sessões. Penalidade -15 (movimento acelerado).");
      } else if (ganhoRapidoRef > 0.05) {
        scoreBase = _clampScore(scoreBase - 8);
        console.log("[DecisionEngine] " + ticker + " ganho de " + (ganhoRapidoRef * 100).toFixed(1) + "% em 10 sessões. Penalidade -8.");
      }
    } catch(e) {
      console.warn("[DecisionEngine] Falha ao aplicar penalidade de ganho rápido: " + e.message);
    }

    ctx.auditTrail.push({
      stage: 'EXTENSAO',
      extensaoPct: extensaoPct,
      extensaoNivel: extensaoNivel,
      motivo: extensaoNivel === 'NENHUMA' ? 'Preço próximo à média (timing ok)' : 'Preço esticado acima da média (timing ruim)'
    });

    var memoryPenalty = Number(memoria.penaltyPoints) || 0;
    var scoreAfterMemory = _clampScore(scoreBase + memoryPenalty);

    ctx.auditTrail.push({
      stage: 'MEMORY',
      scoreBefore: scoreBase,
      delta: memoryPenalty,
      scoreAfter: scoreAfterMemory,
      drawdownLevel: memoria.drawdownLevel || 'N/A',
      isBadTicker: !!memoria.isBadTicker,
      isGoodTicker: !!memoria.isGoodTicker
    });

    if (memoria.isBadTicker && memoria.inDrawdown) {
      return _reject(ctx, ticker + ' em blacklist (prejuizo recorrente + drawdown ativo).', scoreAfterMemory, 'NEUTRAL', 'MEMORY_BLACKLIST');
    }

    var rawSentiment = (analise && analise.sentiment) ? analise.sentiment : (op.sentiment || 'NEUTRAL');
    
    // 💡 INTEGRAÇÃO NLP: Se houver notícias, a IA de sentimento já foi invocada
    // Se não, usa o sentimento padrão (técnico)
    var sentiment = _normalizeSentiment(rawSentiment);
    
  // 💡 INTEGRAÇÃO NLP: Se houver notícias, a IA de sentimento já foi invocada
  if (op.news && op.news !== 'Sem alertas de notícias.' && op.news !== 'N/A' && typeof NLPSentimentAnalyzer !== 'undefined') {
    var nlpRes = NLPSentimentAnalyzer.analyze(op.news, op.ticker);
    sentiment = _normalizeSentiment(nlpRes.sentimento);
    console.log("🔍 [DecisionEngine] NLP para " + op.ticker + ": " + sentiment + " | " + nlpRes.rationale);
    ctx.auditTrail.push({ stage: 'NLP_SENTIMENT', raw: nlpRes.sentimento, normalized: sentiment, rationale: nlpRes.rationale });
  }

  ctx.sentiment = sentiment;

    var hardVeto = _contains(CFG.HARD_VETO_SENTIMENTS, sentiment);
    var dynamicVeto = _contains(CFG.DYNAMIC_VETO_SENTIMENTS, sentiment);
    var adx = Number(op.adx || (op.indicators && op.indicators.adx) || 25);
    var flexApplied = false;

    if (hardVeto || dynamicVeto) {
      // [B7 v10.3] REGIME MACRO NAO VETA AQUI — FONTE UNICA DE VERDADE.
      // ANTES: macro penalizado DUAS vezes (multiplicador no Orchestrator
      // analise.score *= macroAdjustment E veto/rejeicao por macroRegime aqui).
      // AGORA: macro entra so pelo multiplicador; aqui resta so o veto pelo
      // sentimento PROPRIO do ativo (noticia/NLP). Macro vai so na auditoria.
      flexApplied = false;
      
      if (hardVeto) {
        // TERRIBLE/CRISE → veto sempre, sem exceção
        return _reject(ctx, 'Sentimento critico: ' + sentiment + '. Veto absoluto.', scoreAfterMemory, sentiment, 'SENTIMENT_HARD_VETO');
      }
      
      
      // Flex só se aplica para CAUTELA com score técnico alto + ADX forte
      if (sentiment === 'CAUTELA') {
        flexApplied = (scoreAfterMemory >= Number(_cfg('DECISION_FLEX_BEARISH_MIN_SCORE', 50)) && 
                      adx >= Number(_cfg('DECISION_FLEX_BEARISH_MIN_ADX', 20)));
      }

      ctx.auditTrail.push({
        stage: 'SENTIMENT_VETO',
        sentiment: sentiment,
        hardVeto: hardVeto,
        dynamicVeto: dynamicVeto,
        flexApplied: flexApplied,
        macroRegime: macroRegime,        // [B7] informativo: macro ja refletido no score
        macroAppliedViaScore: true,      // [B7] macro entrou pelo multiplicador (sem dupla contagem)
        adx: adx,
        motivo: flexApplied ? 'Flex aplicado para CAUTELA com suporte técnico' : 'Veto aplicado'
      });

      if (!flexApplied) {
        var motivoSentimento = 'Sentimento desfavoravel do ativo: ' + sentiment +
          ' (regime macro ' + macroRegime + ' ja refletido no score).';
        return _reject(ctx, motivoSentimento, scoreAfterMemory, sentiment, 'SENTIMENT');
      }

      // Se flex foi aplicado, trata como neutro para não contaminar o score
      sentiment = 'NEUTRAL';
      ctx.sentiment = sentiment;
    }

    // 🔧 CORREÇÃO v10.1 + v10.2: BÔNUS BULLISH DEPENDENTE DA DISTÂNCIA AO SUPORTE
    // BULLISH cheio (+10) apenas se preço NÃO estiver em timing ruim
    // Timing ruim = extensão EMA21 (v10.1) OU preço no topo (v10.2) OU ganho rápido (v10.2)
    // Motivo: sentimento BULLISH é pró-cíclico — premia compra no topo
    var bonus = _sentimentBonus(sentiment);
    var timingRuim = extensaoNivel !== 'NENHUMA' ||
                     (typeof topo50Ref !== 'undefined' && topo50Ref > 0 && precoRef > 0 && (topo50Ref - precoRef) / topo50Ref < 0.03) ||
                     (typeof ganhoRapidoRef !== 'undefined' && ganhoRapidoRef > 0.05);
    if (sentiment === 'BULLISH' && timingRuim) {
      var bonusOriginal = bonus;
      bonus = Number(_cfg('DECISION_BULLISH_BONUS_ESTICADO', CFG.BULLISH_BONUS_ESTICADO)) || 3;
      console.warn("[DecisionEngine] " + ticker + " BÔNUS BULLISH reduzido " + bonusOriginal + " → " + bonus + 
        " (preço em timing ruim de entrada — extensão " + (extensaoPct * 100).toFixed(1) + "%, topo/próx. topo, ou ganho rápido — reduzindo bônus pró-cíclico)");
    }
    var scoreAfterSentiment = _clampScore(scoreAfterMemory + bonus);

    // =====================================================================
    // 🔧 B2 (v22.17): SCORE CANÔNICO ÚNICO (09_ScorePolicy)
    // ---------------------------------------------------------------------
    // ANTES: scoreFinal = scoreAfterSentiment*0.7 + aiScore*0.3 — um TERCEIRO
    // blend que divergia do ensemble (08) e do técnico (22), gerando 3 números
    // diferentes para o mesmo ativo. AGORA: um único ponto de consolidação.
    //   final = técnico + ajusteIA_limitado(±cap)
    // A IA é MODIFICADOR, não 30% do peso. O `aiScore` permanece = IA crua.
    // =====================================================================
    var aiScore = (analise && typeof analise.ai_score === 'number')
      ? _clampScore(analise.ai_score)
      : null; // null quando a IA não forneceu score (não vira técnico disfarçado)

    var pacoteScore;
    if (typeof ScorePolicy !== 'undefined' && typeof ScorePolicy.consolidar === 'function') {
      pacoteScore = ScorePolicy.consolidar(scoreAfterSentiment, aiScore);
    } else {
      // Fallback inline idêntico à política (defesa se o 09_ não carregar).
      var _neutro = 50, _cap = 15, _peso = 0.30;
      var _ajuste = (aiScore === null) ? 0
        : Math.round(Math.min(_cap, Math.max(-_cap, (aiScore - _neutro) * _peso)));
      pacoteScore = {
        scoreFinal: _clampScore(scoreAfterSentiment + _ajuste),
        scoreTecnico: scoreAfterSentiment,
        scoreIA: aiScore,
        ajusteIA: _ajuste,
        origemIA: (aiScore === null) ? 'FALLBACK' : 'IA'
      };
    }

    var scoreFinal = pacoteScore.scoreFinal;
    var motivoIA = (analise && analise.rationale) ? analise.rationale : '';

    ctx.auditTrail.push({
      stage: 'SCORE',
      scoreBase: scoreBase,
      scoreAfterMemory: scoreAfterMemory,
      sentiment: sentiment,
      sentimentBonus: bonus,
      scoreAfterSentiment: scoreAfterSentiment,
      aiScore: (aiScore === null ? 'n/a' : aiScore),
      ajusteIA: pacoteScore.ajusteIA,
      scoreFinal: scoreFinal
    });

    // 🔧 B2: só avalia veto da IA quando ela REALMENTE forneceu score numérico
    // (aiScore pode ser null quando a IA não respondeu — null < 20 seria true por coerção).
    if (analise && analise.decision === 'AGUARDAR' && typeof aiScore === 'number' && aiScore < 20 && scoreAfterSentiment < 70) {
      return _reject(ctx, 'IA vetou o trade: ' + motivoIA, scoreFinal, sentiment, 'AI');
    }

    var risco = { approved: true, reason: 'RiskManager indisponivel (fallback)', suggested_allocation: 1.0 };
    if (typeof riskCheckFn === 'function') {
      var opForRisk = {};
      for (var key in op) {
        if (Object.prototype.hasOwnProperty.call(op, key)) opForRisk[key] = op[key];
      }
      opForRisk.score = scoreFinal;
      risco = riskCheckFn(opForRisk) || risco;
    }

    ctx.auditTrail.push({
      stage: 'RISK',
      approved: !!risco.approved,
      reason: risco.reason || risco.veto_reason || '',
      suggested_allocation: risco.suggested_allocation || 0
    });

    if (!risco.approved) {
      return _reject(ctx, risco.reason || risco.veto_reason || 'Vetado pelo gestor de risco.', scoreFinal, sentiment, 'RISK');
    }

    var threshold = _threshold(options, flexApplied);
    ctx.auditTrail.push({
      stage: 'THRESHOLD',
      scoreFinal: scoreFinal,
      threshold: threshold,
      approved: scoreFinal >= threshold
    });

    if (scoreFinal < threshold) {
      return _reject(ctx, 'Score ' + scoreFinal + ' abaixo do threshold ' + threshold + '.', scoreFinal, sentiment, 'THRESHOLD');
    }

    // 🔧 CORREÇÃO v6: Não usa rationale do AIEnsemble quando o DecisionEngine aprova
    // O AIEnsemble pode ter rejeitado (ex: "Score 51 abaixo do limite 65") mas o
    // DecisionEngine aprovou com score final diferente. O rationale deve refletir a decisão real.
    // 🔧 B2: motivo canônico único (coerente com 09_ScorePolicy.consolidar).
    var motivoFinal = 'Score tecnico ' + scoreAfterSentiment +
      ' ' + (pacoteScore.ajusteIA >= 0 ? '+' : '') + pacoteScore.ajusteIA +
      ' (IA ' + (aiScore === null ? 'n/a' : aiScore) + ') = ' + scoreFinal +
      ' | Sentimento: ' + sentiment;
    ctx.auditTrail.push({
      stage: 'FINAL',
      status: 'APPROVED',
      score: scoreFinal,
      reason: motivoFinal
    });

    // 🔧 CORREÇÃO v10.1 + v10.2: Inclui status de timing no retorno
    // Permite que a UI exiba "⚠️ AGUARDAR PULLBACK" quando apropriado
    // Timing ruim = extensão EMA21 OU preço no topo OU ganho rápido (v10.2)
    var precoNoTopo = (typeof topo50Ref !== 'undefined' && topo50Ref > 0 && precoRef > 0 && (topo50Ref - precoRef) / topo50Ref < 0.03);
    var ganhoAcelerado = (typeof ganhoRapidoRef !== 'undefined' && ganhoRapidoRef > 0.08);
    
    var timingStatus;
    if (extensaoNivel === 'SEVERA' || precoNoTopo || ganhoAcelerado) {
      timingStatus = 'AGUARDAR_PULLBACK';
    } else if (extensaoNivel === 'MODERADA' || extensaoNivel === 'LEVE') {
      timingStatus = 'ENTRAR_PARCIAL';
    } else {
      timingStatus = 'ENTRAR';
    }
    
    // 🔧 v10.2: Aviso de timing enriquecido com as novas métricas
    var avisoTiming = '';
    if (extensaoNivel === 'SEVERA') avisoTiming = 'Ativo esticado +' + (extensaoPct * 100).toFixed(1) + '% acima da média.';
    if (precoNoTopo) avisoTiming += ' Preço colado no topo recente (R$' + topo50Ref.toFixed(2) + ').';
    if (ganhoAcelerado) avisoTiming += ' Subiu ' + (ganhoRapidoRef * 100).toFixed(1) + '% em 10 sessões (movimento acelerado).';
    
    var extensaoObj = {
      pct: extensaoPct,
      nivel: extensaoNivel,
      timingStatus: timingStatus,
      aviso: extensaoNivel === 'NENHUMA' && !precoNoTopo && !ganhoAcelerado ? '' :
             '⚠️ ' + (avisoTiming || 'Preço em timing ruim de entrada.') + 
             (timingStatus === 'AGUARDAR_PULLBACK' ? ' AGUARDAR PULLBACK para melhor entrada.' : ' Entrada parcial recomendada.')
    };

    return {
      status: 'APPROVED',
      score: scoreFinal,
      scoreOriginal: scoreOriginal,
      sentiment: sentiment,
      motivo: motivoFinal,
      extensao: extensaoObj,
      fiboPrice: op.fiboPrice || 0,
      suggested_allocation: risco.suggested_allocation || 1.0,
      stop: risco.stop,
      target: risco.target,
      rr_ratio: risco.rr_ratio,
      formattedReport: ticker + ' | ' + sentiment + ' | Score: ' + scoreOriginal + ' -> ' + scoreFinal + ' | Extensão: ' + (extensaoPct * 100).toFixed(1) + '% | Memoria: ' + memoryPenalty + ' | Bonus: ' + bonus,
      auditTrail: ctx.auditTrail,
      decisionSource: 'DecisionEngine',
      timingStatus: timingStatus
    };
  }

  return {
    evaluate: evaluate,
    normalizeSentiment: _normalizeSentiment,
    sentimentBonus: _sentimentBonus
  };
})();
