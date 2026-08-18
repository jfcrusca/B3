/******************************************************************************/
// 📦 MÓDULO/ARQUIVO: 35_Agent_Orchestrator.js
// 🛠️  TECNOLOGIA: JAVASCRIPT (V8 / Google Apps Script)
// 📌  VERSÃO: 7.0 — THRESHOLD DINÂMICO INTEGRADO
/******************************************************************************/

var AgentOrchestrator = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // CONFIGURAÇÕES (via CONFIG unificado)
  // ---------------------------------------------------------------------------

  function _cfg(key, fallback) {
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function')
      ? CONFIG.get(key, fallback)
      : fallback;
  }

  function _scoreMinimo() {
    return _cfg('IA_SCORE_MINIMO', _cfg('SCORE_EXECUTAR', 65));
  }

  // ---------------------------------------------------------------------------
  // NORMALIZAÇÃO DE SENTIMENTO
  // ---------------------------------------------------------------------------

  function _normalizeSentiment(raw) {
    if (typeof DecisionEngine !== 'undefined' && typeof DecisionEngine.normalizeSentiment === 'function') {
      return DecisionEngine.normalizeSentiment(raw);
    }
    return 'NEUTRAL';
  }

  // ---------------------------------------------------------------------------
  // CÁLCULO DE BÔNUS
  // ---------------------------------------------------------------------------

  function _calcularBonus(canonical) {
    if (typeof DecisionEngine !== 'undefined' && typeof DecisionEngine.sentimentBonus === 'function') {
      return DecisionEngine.sentimentBonus(canonical);
    }
    return 0;
  }

  // ---------------------------------------------------------------------------
  // CONSULTA AO AGENTE DE MEMÓRIA (38)
  // ---------------------------------------------------------------------------

  function _consultarMemoria(ticker, setupType) {
    try {
      if (typeof AgentMemory !== 'undefined' && typeof AgentMemory.getContext === 'function') {
        return AgentMemory.getContext(ticker, setupType);
      }
    } catch (e) {
      console.warn("⚠️ [AgentOrchestrator] AgentMemory falhou para " + ticker + ": " + e.message);
    }
    return { text: '', isBadTicker: false, inDrawdown: false };
  }

  // ---------------------------------------------------------------------------
  // CONSULTA AO ANALISTA DE IA (36)
  // ---------------------------------------------------------------------------

  function _consultarAnalista(ticker, op) {
  try {
    if (typeof AgentAnalyst === 'undefined' || typeof AgentAnalyst.analyze !== 'function') return null;

    // ✅ EXTRAIR INDICADORES CORRETAMENTE
    var ind = op.indicators || {};
    
    // ADX - várias fontes possíveis
    var adxValue = op.adx || ind.adx || 25;
    var volRel = op.volumeRelativo || ind.volumeRelativo || 1.0;
    
    // Bollinger
    var bollingerUpper = op.bollingerUpper || ind.bollinger?.upper || 0;
    var bollingerMiddle = op.bollingerMiddle || ind.bollinger?.middle || 0;
    var bollingerLower = op.bollingerLower || ind.bollinger?.lower || 0;
    
    var bbLabel = "N/A";
    if (bollingerUpper > 0 && bollingerMiddle > 0 && bollingerLower > 0) {
      bbLabel = "Superior " + bollingerUpper.toFixed(2) + " | Média " + bollingerMiddle.toFixed(2) + " | Inferior " + bollingerLower.toFixed(2);
      if (op.price && op.price > bollingerUpper) {
        bbLabel += " ⚠️ ACIMA DA BANDA";
      } else if (op.price && op.price < bollingerLower) {
        bbLabel += " 📉 ABAIXO DA BANDA";
      }
    }
    
    // ADX Label
    var adxLabel = "N/A";
    if (adxValue && adxValue !== 25) {
      if (adxValue < 20) adxLabel = adxValue + " (LATERAL — sinal fraco)";
      else if (adxValue < 25) adxLabel = adxValue + " (tendência nascente)";
      else adxLabel = adxValue + " (tendência presente)";
    }

    // Calcula tendência do OBV para alimentar o fluxo de IA
    var obvTrend = "Neutro (sem histórico suficiente)";
    try {
      if (typeof DataService !== 'undefined' && typeof VolumeIndicators !== 'undefined') {
        var histData = DataService.getMarketData(ticker);
        if (histData && histData.candles) {
          obvTrend = VolumeIndicators.getOBVTrendLabel(histData.candles);
        }
      }
    } catch (errObv) {
      console.warn("⚠️ [AgentOrchestrator] Falha ao calcular tendência OBV para " + ticker + ": " + errObv.message);
    }

    // 📰 FALLBACK DE NOTÍCIAS: Se não houver notícias, busca via NewsFetcher
    if (!op.news || op.news === 'Sem alertas de notícias.' || op.news === 'N/A') {
      try {
        if (typeof NewsFetcher !== 'undefined' && typeof NewsFetcher.getNewsSummary === 'function') {
          var newsFallback = NewsFetcher.getNewsSummary(ticker, 3);
          if (newsFallback && newsFallback !== 'Sem alertas de notícias.') {
            op.news = newsFallback;
            console.log('   📰 [AgentOrchestrator] Notícias obtidas via fallback para ' + ticker);
          }
        }
      } catch (e) {
        console.warn("⚠️ [AgentOrchestrator] Fallback de notícias falhou para " + ticker + ": " + e.message);
      }
    }

    var dadosAnalise = {
      ticker: ticker,
      score: op.score || 0,
      setupType: op.setupType || op.setup || 'N/A',
      price: op.price || 0,
      volume: op.volume || 'N/A',
      volumeRelativo: volRel,
      rr: op.rr || 'N/A',
      rsi: op.rsi || ind.rsi || 50,
      adx: adxValue,
      adxLabel: adxLabel,
      bbLabelAdj: bbLabel,
      obv: obvTrend,
      macro: op.macro || (typeof MacroFetcher !== 'undefined' ? MacroFetcher.getMacroContext().summary : 'N/A'),
      news: op.news || 'Sem alertas de notícias.',
      memory: op.memoryCtx || 'Sem histórico negativo registrado.'
    };

    console.log("   🤖 Enviando para AgentAnalyst: ADX=" + adxValue + ", RSI=" + dadosAnalise.rsi + ", OBV=" + obvTrend);
    
    return AgentAnalyst.analyze(ticker, dadosAnalise);

  } catch (e) {
    console.warn("⚠️ [AgentOrchestrator] Falha de mapeamento em " + ticker + ": " + e.message);
    return null;
  }
}
  // ---------------------------------------------------------------------------
  // CONSULTA AO GESTOR DE RISCO (37)
  // ---------------------------------------------------------------------------

  function _consultarRisco(op) {
    try {
      if (typeof AgentRiskManager !== 'undefined' && typeof AgentRiskManager.validateAndSize === 'function') {
        return AgentRiskManager.validateAndSize(op, null);
      }
    } catch (e) {
      console.warn("⚠️ [AgentOrchestrator] AgentRiskManager falhou para " + op.ticker + ": " + e.message);
    }
    return { approved: true, reason: 'RiskManager indisponível (fallback)', suggested_allocation: 1.0 };
  }

  // ---------------------------------------------------------------------------
  // PONTO DE ENTRADA PÚBLICO
  // ---------------------------------------------------------------------------

  function _getThreshold() {
    return _scoreMinimo();
  }

  function processOpportunity(op, macroRegime) {
    if (!op || !op.ticker) {
      return _rejeitarCom('Oportunidade inválida ou sem ticker.', op);
    }

    var ticker = op.ticker;
    var scoreBase = (typeof op.score === 'number' && isFinite(op.score)) ? op.score : 0;
    var setupType = op.setupType || op.setup || 'N/A';

    var memoria = _consultarMemoria(ticker, setupType);
    var analise = _consultarAnalista(ticker, op);

    if (typeof DecisionEngine === 'undefined' || typeof DecisionEngine.evaluate !== 'function') {
      return _rejeitarCom('DecisionEngine indisponível. Decisão bloqueada por segurança.', op, 'UNKNOWN', scoreBase);
    }

    try {
      var decisao = DecisionEngine.evaluate({
        op: op,
        macroRegime: macroRegime || 'NEUTRAL',
        memoria: memoria,
        analise: analise,
        threshold: _getThreshold(),
        riskCheckFn: function(opFinal) {
          return _consultarRisco(opFinal);
        }
      });

      _log(decisao.status === 'APPROVED' ? 'APROVADO' : 'VETADO', ticker, decisao.sentiment, scoreBase, decisao.score, decisao.motivo);
      return decisao;
    } catch (e) {
      console.error("⚠️ [AgentOrchestrator] Erro catastrófico no DecisionEngine para " + ticker + ": " + e.message);
      return _rejeitarCom('Erro no DecisionEngine: ' + e.message, op, 'UNKNOWN', scoreBase);
    }
  }

  // ---------------------------------------------------------------------------
  // HELPERS INTERNOS
  // ---------------------------------------------------------------------------

  function _rejeitarCom(motivo, op, sentiment, score) {
    return {
      status: 'REJECTED',
      score: score || 0,
      sentiment: sentiment || 'UNKNOWN',
      motivo: motivo,
      fiboPrice: (op && op.fiboPrice) ? op.fiboPrice : 0,
      suggested_allocation: 0,
      formattedReport: "REJEITADO | " + ((op && op.ticker) || '?') + " | " + motivo
    };
  }

  function _log(decisao, ticker, sentiment, scoreOriginal, scoreFinal, motivo) {
    var icone = decisao === 'APROVADO' ? '✅' : '⛔';
    var detalhe = "Score: " + scoreOriginal + " → " + scoreFinal + " | " + motivo;
    console.log("   " + icone + " Sentinela: " + ticker + " " + decisao + " (" + sentiment + "). " + detalhe);
  }

  // ---------------------------------------------------------------------------
  // ✅ API PÚBLICA
  // ---------------------------------------------------------------------------

  return {
    processOpportunity: processOpportunity,
    _normalizeSentiment: _normalizeSentiment,
    _calcularBonus: _calcularBonus
  };

})();
