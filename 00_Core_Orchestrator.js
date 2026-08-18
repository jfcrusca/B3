/********************************************************************************/
/* 📦 MÓDULO/ARQUIVO: 00_Core_Orchestrator.js                                   */
/* 🛠️  TECNOLOGIA: JAVASCRIPT (V8 / Google Apps Script)                         */
/* 📌  VERSÃO: 9.5 — BLINDAGEM DE COMPLIANCE E FALLBACK DE IA                   */
/********************************************************************************/

var CoreRegistry = (function () {
  'use strict';
  var modules = {};

  function register(name, value) {
    modules[name] = value;
    return value;
  }

  function get(name) {
    return modules[name];
  }

  function has(name) {
    return Object.prototype.hasOwnProperty.call(modules, name);
  }

  function init() {
    register('DataService', typeof DataService !== 'undefined' ? DataService : null);
    register('NewsFetcher', typeof NewsFetcher !== 'undefined' ? NewsFetcher : null);
    register('MacroFetcher', typeof MacroFetcher !== 'undefined' ? MacroFetcher : null);
    register('ComplianceUnified', typeof ComplianceUnified !== 'undefined' ? ComplianceUnified : null);
    register('AIEnsemble', typeof AIEnsemble !== 'undefined' ? AIEnsemble : null);
    register('AIAgenticEnricher', typeof AIAgenticEnricher !== 'undefined' ? AIAgenticEnricher : null);
    register('AgentOrchestrator', typeof AgentOrchestrator !== 'undefined' ? AgentOrchestrator : null);
    register('SectorCorrelationFilter', typeof SectorCorrelationFilter !== 'undefined' ? SectorCorrelationFilter : null);
    register('SheetWriter', typeof SheetWriter !== 'undefined' ? SheetWriter : null);
    register('SimulationManager', typeof SimulationManager !== 'undefined' ? SimulationManager : null);
    register('PROCESSAR_OPORTUNIDADES_FINAL', typeof PROCESSAR_OPORTUNIDADES_FINAL === 'function' ? PROCESSAR_OPORTUNIDADES_FINAL : null);
    register('PROCESSAR_CARTEIRA_FINAL', typeof PROCESSAR_CARTEIRA_FINAL === 'function' ? PROCESSAR_CARTEIRA_FINAL : null);
    register('ATUALIZAR_DASHBOARD', typeof ATUALIZAR_DASHBOARD === 'function' ? ATUALIZAR_DASHBOARD : null);
    return modules;
  }

  return {
    register: register,
    get: get,
    has: has,
    init: init
  };
})();

function executarRoboB3(forcado) {
  // Limpa log anterior
  CacheService.getScriptCache().put("process_log", JSON.stringify({ progress: 0, messages: ["Iniciando..."] }));
  try {
    CoreRegistry.init();
    Orchestrator.executar(forcado);
    return { success: true, message: "Scanner finalizado com sucesso! A lista foi atualizada." };
  } catch (e) {
    console.error("❌ Erro Fatal no Orchestrator:", e);
    if (typeof LogService !== 'undefined') LogService.error("ORCHESTRATOR", e.message);
    return { success: false, message: "Falha no scanner: " + e.message };
  }
}

var Orchestrator = {
  executar: function(forcado) {
    console.time("⏱️ Tempo Total Execução");
    console.log("🚀 [ORCHESTRATOR v9.5] INICIANDO PIPELINE MODULAR...");

    this._updateLog(10, "Inicializando módulos...");
    CoreRegistry.init();

    if (!this._validarAmbiente(forcado)) return;

    this._updateLog(20, "Rodando scanner técnico...");
    var analisesTecnicas = this._rodarScannerTecnico();
    if (!analisesTecnicas || analisesTecnicas.length === 0) {
      return this._encerrarVazio();
    }

    this._updateLog(50, "Enriquecendo com IA...");
    var analisesIA = this._enriquecerComIA(analisesTecnicas);
    
    this._updateLog(70, "Validando via Sentinela...");
    var listaCompleta = this._validarSentinela(analisesIA);

    // Extrai os ativos realmente aprovados pelo Sentinela de risco para fins de performance e listagem
    var aprovadosElite = listaCompleta.filter(function(x) { return x.approved === true; });

    // 🚀 NOVO: Registrar todos os aprovados para simulação de performance futura
    var simulationManager = CoreRegistry.get('SimulationManager');
    if (simulationManager && typeof simulationManager.registerEntries === 'function') {
      simulationManager.registerEntries(aprovadosElite);
    }

    // Grava TODA a lista de ativos (aprovados + reprovados) na aba Resultados_Analise
    // Em seguida: gera Oportunidades → Ranker lê de Oportunidades → Dashboard
    this._processarSaidasFinais(listaCompleta, aprovadosElite);

    this._updateLog(100, "Finalizado. Aprovados: " + aprovadosElite.length);
    console.timeEnd("⏱️ Tempo Total Execução");
    console.log("✅ SISTEMA B3-V10 FINALIZADO. Aprovados: " + aprovadosElite.length);
  },

  _updateLog: function(progress, message) {
    var log = CacheService.getScriptCache().get("process_log");
    log = log ? JSON.parse(log) : { progress: 0, messages: [] };
    log.progress = progress;
    log.messages.push(message);
    if (log.messages.length > 5) log.messages.shift();
    CacheService.getScriptCache().put("process_log", JSON.stringify(log));
  },

  _validarAmbiente: function(forcado) {
    try {
      var macroContext = null;
      var macroAdjustment = 1.0;

      var macroFetcher = CoreRegistry.get('MacroFetcher');
      if (macroFetcher) {
        try {
          macroContext = macroFetcher.getMacroContext();
          macroAdjustment = macroFetcher.getRiskAdjustment();
          console.log("📊 Macro RAW:", JSON.stringify(macroContext));
          console.log("🎯 Fator de Ajuste: " + macroAdjustment + "x");
          if (macroAdjustment < 0.7) {
            console.warn("⛔ Risco macro extremo (" + macroAdjustment + "x). Pipeline suspenso.");
            return false;
          }
        } catch(e) {
          console.warn("⚠️ MacroFetcher falhou: " + e.message);
        }
      }

      this._macroContext = macroContext;
      this._macroAdjustment = macroAdjustment;

      // Se for execução forçada (via Dashboard Web por exemplo), ignoramos validação de horário
      if (forcado) {
        console.log("🔓 Execução forçada ativada. Ignorando validação de horário operacional por Compliance.");
        return true;
      }

      // ✅ CORREÇÃO DE COMPLIANCE: Bloqueio operacional reativado
      var compliance = CoreRegistry.get('ComplianceUnified');
      if (compliance && !compliance.verificarHorarioOperacional()) {
        console.warn("⛔ Fora do horário operacional ou feriado. Execução bloqueada por Compliance.");
        return false; 
      }

      return true;
    } catch (e) {
      console.error("❌ Erro em _validarAmbiente:", e.message);
      return false;
    }
  },

  _bloqueioCalendarioMacro: function() {
    try {
      var hoje = new Date();
      var diaSemana = hoje.getDay();
      if (diaSemana === 0 || diaSemana === 6) return true;

      if (typeof CONFIG !== 'undefined') {
        var datasRisco = CONFIG.get('DATAS_RISCO_MACRO') || [];
        var hojeStr = Utilities.formatDate(hoje, Session.getScriptTimeZone(), "yyyy-MM-dd");
        if (datasRisco.indexOf(hojeStr) !== -1) return true;
      }
      return false;
    } catch (e) {
      console.warn("⚠️ _bloqueioCalendarioMacro falhou, assumindo sem bloqueio:", e.message);
      return false;
    }
  },

  _rodarScannerTecnico: function() {
    var TEMPO_LIMITE_MS = 300000; // 🔧 AUMENTADO de 240s para 300s (5 min) para usar melhor o limite GAS de 360s
    var TEMPO_GLOBAL_MS = 330000; // 🔧 NOVO: Limite global do pipeline (5.5 min) para deixar margem para gravação
    var inicio = Date.now();
    var BATCH_SIZE = 5;
    var PAUSE_BETWEEN_BATCHES_MS = 1000; // 🔧 AUMENTADO de 300ms para 1000ms para evitar rate limit
    
    // 🔧 NOVO: Timeout máximo por ticker individual para evitar travamento
    var TICKER_TIMEOUT_MS = 35000; // 35s no máximo gastos em um único ticker

    var tickers = (typeof B3V10_TICKER_MANAGER !== 'undefined') ? B3V10_TICKER_MANAGER.getAll() : [];
    if (!tickers || tickers.length === 0) {
      console.warn("⚠️ Nenhum ticker disponível em B3V10_TICKER_MANAGER.");
      return [];
    }

    // 🚀 NOVO: Filtra tickers inativos/alterados para não desperdiçar chamadas de API
    if (typeof B3V10_TICKER_MANAGER.filterDead === 'function') {
      tickers = B3V10_TICKER_MANAGER.filterDead(tickers);
    }

    console.log("📊 Iniciando scanner com " + tickers.length + " tickers (batch size: " + BATCH_SIZE + ")");
    var context = null;
    var dataService = CoreRegistry.get('DataService');
    if (dataService) {
      context = dataService.getMarketContext();
    }
    var resultados = [];
    var totalProcessados = 0;
    var totalBatches = Math.ceil(tickers.length / BATCH_SIZE);
    var falhasConsecutivas = 0;
    var FALHA_MAXIMA = 3;

    for (var batchIndex = 0; batchIndex < tickers.length; batchIndex += BATCH_SIZE) {
      var elapsed = Date.now() - inicio;
      if (elapsed > TEMPO_LIMITE_MS) {
        console.warn("⏱️ Timeout atingido (" + Math.round(elapsed/1000) + "s). Processados " + totalProcessados + " de " + tickers.length + " tickers.");
        break;
      }

      var batch = tickers.slice(batchIndex, batchIndex + BATCH_SIZE);
      var batchNum = Math.floor(batchIndex / BATCH_SIZE) + 1;
      console.log("📦 Processando lote " + batchNum + "/" + totalBatches + ": " + batch.join(', '));

      for (var t = 0; t < batch.length; t++) {
        var ticker = batch[t];
        if (Date.now() - inicio > TEMPO_LIMITE_MS) {
          console.warn("⏱️ Timeout durante processamento de " + ticker + ". Interrompendo...");
          break;
        }

        // 🔧 NOVO: Timeout individual por ticker
        var inicioTicker = Date.now();

        try {
          var dataService = CoreRegistry.get('DataService');
          if (!dataService) {
            console.error("❌ DataService não disponível");
            break;
          }

          var data = dataService.getMarketData(ticker);
          
          // 🔧 Verifica se o ticker estourou o timeout individual
          // Se tivermos obtido os dados (por fallback), o tempo já foi gasto na requisição,
          // então vale a pena processar a análise técnica que é instantânea, em vez de descartar a oportunidade.
          if ((Date.now() - inicioTicker) > TICKER_TIMEOUT_MS && !data) {
            console.warn("⏱️ Timeout individual para " + ticker + " (" + Math.round((Date.now()-inicioTicker)/1000) + "s). Pulando.");
            resultados.push({
              ticker: ticker,
              price: 0,
              score: 0,
              setup: "⏱️ TIMEOUT",
              motivo: "Timeout individual de " + Math.round(TICKER_TIMEOUT_MS/1000) + "s excedido",
              rr: 0,
              rsi: 50,
              adx: 25,
              reprovado: true
            });
            continue;
          }

          if (!data) {
            console.warn("⚠️ [Scanner] Sem dados para " + ticker + " — pulando");
            resultados.push({
              ticker: ticker,
              price: 0,
              score: 0,
              setup: "⚠️ SEM DADOS",
              motivo: "Falha ao obter dados históricos (API)",
              rr: 0,
              rsi: 50,
              adx: 25,
              reprovado: true
            });
            falhasConsecutivas++;
            if (falhasConsecutivas >= FALHA_MAXIMA) {
              console.error("❌ " + falhasConsecutivas + " falhas consecutivas. Interrompendo lote.");
              break;
            }
            continue;
          }

          falhasConsecutivas = 0;
          totalProcessados++;
          var analise = null;

          try {
            analise = STRATEGY_EVALUATE_CORE(data, context);
          } catch(errCore) {
            console.error("❌ [STRATEGY_EVALUATE_CORE] " + ticker + ": " + errCore.message);
            resultados.push({
              ticker: ticker,
              price: data.candles ? data.candles[data.candles.length-1].close : 0,
              score: 0,
              setup: "❌ ERRO ESTRATÉGIA",
              motivo: "Falha matemática no cálculo: " + errCore.message,
              rr: 0,
              rsi: 50,
              adx: 25,
              reprovado: true
            });
            continue;
          }

          if (!analise) {
            console.warn("⚠️ [Scanner] " + ticker + ": STRATEGY_EVALUATE_CORE retornou null");
            resultados.push({
              ticker: ticker,
              price: data.candles ? data.candles[data.candles.length-1].close : 0,
              score: 0,
              setup: "❌ REPROVADO TÉCNICO",
              motivo: "Estratégia indicou descarte absoluto técnico",
              rr: 0,
              rsi: 50,
              adx: 25,
              reprovado: true
            });
            continue;
          }

          var macroAdjustment = this._macroAdjustment || 1.0;
          
          // 🔧 MELHORIA v11: RR mínimo elevado para swing trade com custos reais
          // RR mínimo de 1.0 é insuficiente para swing trade (corretagem + spread + overnight)
          // Padrão de mercado aceito: RR >= 2.0 para swing, flexibilizado para 1.8 com ADX forte
          var minRR = 2.0; // Padrão swing trade
          if (this._macroContext && this._macroContext.regime === "BEARISH") {
            minRR = 2.0; // Em mercado baixista, manter RR 2.0 (não reduzir)
          }
          // Flexibilização para setups com tendência muito forte
          if (analise && analise.adx >= 30 && analise.volumeRelativo >= 1.5) {
            minRR = 1.8; // ADX muito forte + volume alto compensa RR marginal
          }
          
          if (macroAdjustment !== 1.0 && analise.score) { // Aplicar ajuste de score após cálculo bruto
            analise.score = parseFloat(Math.min(100, Math.max(0, analise.score * macroAdjustment)).toFixed(2));
            analise.macroMultiplier = macroAdjustment;
          }

          analise.avgVolume = data.avgVolume;
          
          // Mantém reprovados na lista final para visualização na aba Resultados_Analise
          if (analise.rr >= minRR) {
            analise.reprovado = false;
            resultados.push(analise);
            console.log(`✅ [Scanner] ${ticker}: score=${parseFloat(analise.score).toFixed(2)} | RR=${parseFloat(analise.rr).toFixed(2)} (min ${minRR}) | setup=${analise.setup}`);
          } else {
            analise.reprovado = true;
            analise.setup = "⛔ RISCO ALTO (RR < " + minRR + ")";
            analise.motivo = "Retorno-Risco de " + parseFloat(analise.rr).toFixed(2) + " é menor que o limite mínimo de " + minRR;
            resultados.push(analise);
            console.log("📊 [Scanner] " + ticker + ": score=" + parseFloat(analise.score).toFixed(2) + " | RR=" + parseFloat(analise.rr).toFixed(2) + " — abaixo do filtro");
          }
        } catch (e) {
          console.error("❌ [Scanner] Falha inesperada ao processar " + ticker + ": " + e.message);
          resultados.push({
            ticker: ticker,
            price: 0,
            score: 0,
            setup: "❌ FALHA EXECUTIVA",
            motivo: "Erro inesperado: " + e.message,
            rr: 0,
            rsi: 50,
            adx: 25,
            reprovado: true
          });
          falhasConsecutivas++;
          if (falhasConsecutivas >= FALHA_MAXIMA) break;
        }
      }

      if (batchIndex + BATCH_SIZE < tickers.length && Date.now() - inicio < TEMPO_LIMITE_MS) {
        console.log("⏸️ Pausa de " + PAUSE_BETWEEN_BATCHES_MS + "ms antes do próximo lote...");
        Utilities.sleep(PAUSE_BETWEEN_BATCHES_MS);
      }
    }

    var tempoTotal = Math.round((Date.now() - inicio) / 1000);
    var candidatosRR = resultados.filter(function(r) { return r.rr >= 2; }).length;
    console.log("📊 Scanner concluído em " + tempoTotal + "s. Processados: " + totalProcessados + "/" + tickers.length + " tickers. Candidatos com RR≥2: " + candidatosRR + " (total na lista: " + resultados.length + ")");
    
    // 🔧 OTIMIZAÇÃO: Extrair preços dos dados já obtidos durante o scanner (evita chamadas extras à API)
    if (resultados.length > 0) {
      this._extrairPrecosDosResultados(resultados);
    }

    return resultados;
  },

  /**
   * 🔧 OTIMIZAÇÃO: Extrai preços dos resultados já processados em vez de chamar a API novamente.
   * Os preços já foram obtidos via getMarketData durante o scanner técnico.
   */
  _extrairPrecosDosResultados: function(lista) {
    var atualizados = 0;
    lista.forEach(function(op) {
      // O preço já está em op.price (obtido via STRATEGY_EVALUATE_CORE)
      if (op.price && op.price > 0) {
        op.livePrice = op.price;
        atualizados++;
      }
    });
    console.log("💰 Preços extraídos dos resultados do scanner: " + atualizados + "/" + lista.length + " ativos");
  },


  _enriquecerComIA: function(lista) {
    if (!lista || lista.length === 0) return [];
    var candidatosIA = [];
    var naoEnviados = [];

    for (var i = 0; i < lista.length; i++) {
      var op = lista[i];
      var notaSegura = (op.score !== undefined && op.score !== null) ? op.score : 50;

      // Se já foi reprovado na triagem técnica ou de dados, pula IA e preserva
      if (op.reprovado) {
        var copia = {};
        for (var key in op) { copia[key] = op[key]; }
        copia.sentiment = 'DESCARTADO_TECNICO';
        copia.motivo = op.motivo || 'Reprovado tecnicamente.';
        copia.enrichedScore = op.score;
        copia.aiConfidence = 0;
        naoEnviados.push(copia);
        continue;
      }
      
      // 📰 ENRIQUECIMENTO DE NOTÍCIAS: Busca notícias reais para ativos promissores
      // Apenas para candidatos que passaram na triagem técnica (score >= 40)
      if (notaSegura >= 40 && typeof NewsFetcher !== 'undefined') {
        try {
          var newsSummary = NewsFetcher.getNewsSummary(op.ticker, 3);
          if (newsSummary) {
            op.news = newsSummary;
            console.log('   📰 [' + op.ticker + '] Notícias: ' + newsSummary.substring(0, 120) + (newsSummary.length > 120 ? '...' : ''));
          }
        } catch (e) {
          console.warn('⚠️ [NewsFetcher] Falha ao buscar notícias para ' + op.ticker + ': ' + e.message);
        }
      }

      // Se o setup indica descartar ou score é muito baixo, não envia para IA
      if (notaSegura >= 40 && op.setup !== '⏸️ SCORE BAIXO (DESCARTAR)' && op.setup !== '⛔ RISCO ALTO (RR < 1.5)' && op.setup !== '⚠️ SEM DADOS') {
        candidatosIA.push(op);
      } else {
        var copia = {};
        for (var key in op) { copia[key] = op[key]; }
        copia.sentiment = 'DESCARTADO_PRETRIAGEM';
        copia.motivo = op.motivo || 'Descartado na pré-triagem de score.';
        copia.enrichedScore = op.score;
        copia.aiConfidence = 0;
        naoEnviados.push(copia);
      }
    }

    console.log("🤖 Pré-triagem IA: " + candidatosIA.length + " de " + lista.length + " enviados.");

    var aiEnsemble = CoreRegistry.get('AIEnsemble');
    if (aiEnsemble) {
      if (candidatosIA.length === 0) {
        console.log("🤖 AIEnsemble: Nenhum candidato qualificado para enriquecer. Pulando chamada.");
        return naoEnviados;
      }
      try {
        console.log("🤖 Executando AIEnsemble em " + candidatosIA.length + " ativos...");

        var enriquecida = AIEnsemble.getEnhancedScoresBatch(candidatosIA);

        if (!enriquecida || enriquecida.length === 0) {
          throw new Error("AIEnsemble retornou vazio ou lista vazia");
        }

        console.log("✅ IA aplicada com sucesso.");

        return enriquecida.concat(naoEnviados);

      } catch (e) {
        console.error("❌ AIEnsemble falhou:", e.message);

        // ✅ FALLBACK INTELIGENTE (CRÍTICO)
        return candidatosIA.map(function(op) {
          return { ...op, enrichedScore: op.score, ensembleScore: op.score, aiConfidence: 0, sentiment: "NEUTRAL", aiRationale: "Fallback técnico devido falha IA", fallback: true };
        }).concat(naoEnviados);
      }
    }

    var aiAgenticEnricher = CoreRegistry.get('AIAgenticEnricher');
    if (aiAgenticEnricher) {
      try {
        var enriquecida2 = aiAgenticEnricher.enrichOpportunities(candidatosIA);
        return (enriquecida2 || candidatosIA).concat(naoEnviados);
      } catch (e) {
        console.error("❌ Erro em _enriquecerComIA (fallback Agentic):", e.message);
      }
    }

    console.warn("⚠️ Nenhum serviço de IA disponível ou todos falharam. Retornando análise técnica pura.");
    return candidatosIA.concat(naoEnviados);
  },

  _validarSentinela: function(lista) {
    if (!lista || lista.length === 0) return [];
    var threshold = 50; // Mantido conforme versão 9.4
    var resultadosFinais = [];

    for (var i = 0; i < lista.length; i++) {
      var op = lista[i];
      
      // Se o ativo já veio reprovado preliminarmente, mantém mas marca aprovado como false
      if (op.reprovado || op.sentiment === 'DESCARTADO_PRETRIAGEM' || op.sentiment === 'DESCARTADO_TECNICO') {
        op.approved = false;
        op.decisionSource = 'TriagemPreliminar';
        op.analiseIA = op.motivo || 'Descartado antes do Sentinela.';
        resultadosFinais.push(op);
        continue;
      }

      try {
        var agentOrchestrator = CoreRegistry.get('AgentOrchestrator');
        if (!agentOrchestrator) {
          op.approved = true;
          resultadosFinais.push(op);
          continue;
        }

        var decisao = agentOrchestrator.processOpportunity(
          op,
          this._macroContext ? this._macroContext.regime : "NEUTRAL"
        );

        // ✅ PROTEÇÃO ADICIONAL: Rejeita se a decisão for nula/inválida
        if (!decisao || typeof decisao !== 'object') {
          console.warn("⚠️ [Sentinela] Decisão inválida para " + op.ticker + ". Ativo reprovado.");
          op.approved = false;
          op.motivo = 'Falha na resposta do Sentinela.';
          resultadosFinais.push(op);
          continue;
        }

        var scoreDecisao = isFinite(Number(decisao.score)) ? Number(decisao.score) : -1;

        if (decisao.status === 'APPROVED' && scoreDecisao >= threshold) {
          var sectorCorrelationFilter = CoreRegistry.get('SectorCorrelationFilter');
          if (sectorCorrelationFilter) {
            var correlation = sectorCorrelationFilter.validateSectorExposure(op.ticker);
            if (!correlation.allowed) {
              console.warn("⛔ " + op.ticker + " rejeitado por correlação: " + correlation.reason);
              op.approved = false;
              op.setup = "❌ VETADO (CORRELAÇÃO)";
              op.motivo = "Rejeitado por correlação: " + correlation.reason;
              op.score = scoreDecisao;
              resultadosFinais.push(op);
              continue;
            }
          }
          op.approved = true;
          op.motivo = decisao.motivo || op.motivo;
          op.score = scoreDecisao;
          op.decisionSource = decisao.decisionSource || 'AgentOrchestrator';
          op.decisionAudit = decisao.auditTrail || [];
          op.analiseIA = this._resumirAuditoriaDecisao(decisao);
          resultadosFinais.push(op);
        } else {
          // Vetado ou reprovado pelo Sentinela
          op.approved = false;
          op.setup = "❌ REPROVADO";
          op.motivo = decisao.motivo || "Veto de risco ou pontuação baixa no Sentinela.";
          op.score = scoreDecisao;
          op.decisionSource = decisao.decisionSource || 'AgentOrchestrator';
          op.analiseIA = this._resumirAuditoriaDecisao(decisao);
          resultadosFinais.push(op);
        }
      } catch (e) {
        console.warn("⚠️ Erro ao validar " + (op.ticker || '?') + ": " + e.message);
        op.approved = false;
        op.motivo = "Erro no Sentinela: " + e.message;
        resultadosFinais.push(op);
      }
    }
    var totalAprovados = resultadosFinais.filter(function(x) { return x.approved === true; }).length;
    console.log("🎯 Sentinela: " + totalAprovados + " aprovados de " + resultadosFinais.length);
    return resultadosFinais;
  },

  _resumirAuditoriaDecisao: function(decisao) {
    if (!decisao || !decisao.auditTrail || !decisao.auditTrail.length) {
      return decisao && decisao.motivo ? decisao.motivo : '';
    }

    return decisao.auditTrail.map(function(item) {
      if (item.stage === 'MEMORY') {
        return 'MEMORY ' + item.scoreBefore + (item.delta >= 0 ? '+' : '') + item.delta + '=' + item.scoreAfter;
      }
      if (item.stage === 'SCORE') {
        return 'SCORE final=' + item.scoreFinal + ' ai=' + item.aiScore + ' bonus=' + item.sentimentBonus;
      }
      if (item.stage === 'RISK') {
        return 'RISK ' + (item.approved ? 'OK' : 'VETO') + (item.reason ? ' ' + item.reason : '');
      }
      if (item.stage === 'THRESHOLD') {
        return 'THRESHOLD ' + item.scoreFinal + '/' + item.threshold;
      }
      if (item.stage === 'FINAL') {
        return 'FINAL APPROVED';
      }
      return item.stage + (item.reason ? ' ' + item.reason : '');
    }).join(' | ');
  },

  _processarSaidasFinais: function(listaCompleta, aprovadosElite) {
    if (!listaCompleta || listaCompleta.length === 0) {
      console.log("🏁 Nenhum ativo disponível para gravação.");
      var sheetWriter = CoreRegistry.get('SheetWriter');
      if (sheetWriter && typeof sheetWriter.clearSheet === 'function') {
        sheetWriter.clearSheet();
      }
      return;
    }

    // ✅ OTIMIZAÇÃO: Preços já foram extraídos dos resultados do scanner técnico.
    // Removida chamada _atualizarPrecosLote que duplicava requisições à API.

    var sheetWriter = CoreRegistry.get('SheetWriter');
    if (sheetWriter) {
      try { sheetWriter.saveAnalysisResults(listaCompleta); }
      catch (e) { console.error("❌ SheetWriter falhou:", e.message); }
    }
    
    // 1º) Gera aba Oportunidades (consolidada e filtrada para o usuário)
    var processarOportunidadesFinal = CoreRegistry.get('PROCESSAR_OPORTUNIDADES_FINAL');
    if (typeof processarOportunidadesFinal === 'function') {
      try { processarOportunidadesFinal(); }
      catch (e) { console.error("❌ PROCESSAR_OPORTUNIDADES_FINAL falhou:", e.message); }
    }
    
    // 2º) Ranker lê da aba Oportunidades (já atualizada) para gerar Resumo_Trades_Aprovados
    var processarCarteiraFinal = CoreRegistry.get('PROCESSAR_CARTEIRA_FINAL');
    if (typeof processarCarteiraFinal === 'function') {
      try { processarCarteiraFinal(); }
      catch (e) { console.error("❌ PROCESSAR_CARTEIRA_FINAL falhou:", e.message); }
    }
    
    // 3º) Atualiza dashboard
    var atualizarDashboard = CoreRegistry.get('ATUALIZAR_DASHBOARD');
    if (typeof atualizarDashboard === 'function') {
      try { atualizarDashboard(); }
      catch (e) { console.error("❌ ATUALIZAR_DASHBOARD falhou:", e.message); }
    }
  },

  _encerrarVazio: function() {
    console.log("🏁 Scanner retornou 0 candidatos. Pipeline encerrado.");
    // ✅ CORREÇÃO: Limpa a planilha se o scanner técnico não encontrar nada
    var sheetWriter = CoreRegistry.get('SheetWriter');
    if (sheetWriter && typeof sheetWriter.clearSheet === 'function') {
      sheetWriter.clearSheet();
    }
  }
};

/**
 * Verifica se o modo de depuração está ativo via Script Properties ou CONFIG.
 * @returns {boolean}
 */
function isDebugModeEnabled() {
  try {
    const mode = (typeof CONFIG !== 'undefined') ? CONFIG.get('DEBUG_MODE') : PropertiesService.getScriptProperties().getProperty('DEBUG_MODE');
    const override = PropertiesService.getScriptProperties().getProperty('DEBUG_MODE_OVERRIDE');
    return mode === true || mode === "true" || override === "true";
  } catch (e) {
    return false;
  }
}

function FORCAR_EXECUCAO() {
  if (!isDebugModeEnabled()) {
    throw new Error('FORCAR_EXECUCAO bloqueado em produção. Ative DEBUG_MODE=true nas Script Properties.');
  }

  console.log("🚨 FORÇANDO EXECUÇÃO (IGNORANDO BLOQUEIOS DE HORÁRIO E MACRO)");

  // Salva as referências originais
  var originalMacroBlock = Orchestrator._bloqueioCalendarioMacro;
  var originalCompliance = null;

  // Aplica o bypass
  Orchestrator._bloqueioCalendarioMacro = function() { return false; };

  if (typeof ComplianceUnified !== 'undefined') {
    originalCompliance = ComplianceUnified.verificarHorarioOperacional;
    ComplianceUnified.verificarHorarioOperacional = function() { return true; };
  }

  // Executa o pipeline
  try {
    executarRoboB3();
  } finally {
    // Restaura a segurança original
    Orchestrator._bloqueioCalendarioMacro = originalMacroBlock;
    if (typeof ComplianceUnified !== 'undefined' && originalCompliance) {
      ComplianceUnified.verificarHorarioOperacional = originalCompliance;
    }
  }
}
