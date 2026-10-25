/********************************************************************************/
/* 📦 MÓDULO/ARQUIVO: 00_Core_Orchestrator.js                                   */
/* 🛠️  TECNOLOGIA: JAVASCRIPT (V8 / Google Apps Script)                         */
/* 📌  VERSÃO: 9.6 — LOCK DE CONCORRÊNCIA + ERRO FATAL VISÍVEL                  */
/*                                                                              */
/* 🔧 v9.6 (21/09/2026):                                                        */
/*   [A] LockService exclusivo por pipeline — impede execuções concorrentes.    */
/*   [B] Guard de idempotência (via execucaoId) contra gravações atrasadas.     */
/*   [C] Erro fatal do pipeline agora é PROPAGADO (não engolido).              */
/*   [D] releaseLock() garantido em finally (nunca trava o pipeline).          */
/*                                                                              */
/*   MOTIVO: a linha do BPAC11 em 'Resultados_Analise' apareceu com valores     */
/*   impossíveis (Stop 57,15 + Alvo1 61,67 + Risco 6,93% + R/R 0,06) porque    */
/*   DUAS execuções se sobrepuseram:                                            */
/*     21:50:36  MENU_ATUALIZAR_ESTATISTICAS (gatilho)                          */
/*     21:58:28  scanner manual                                                 */
/*   O par clear() → setValues() do OutputManager._forceWrite não é atômico.   */
/*                                                                              */
/* ⚠️ MARCADOR DE VERIFICAÇÃO DE DEPLOY:                                        */
/*   Se o log NÃO contiver a linha                                             */
/*     "🚀 [ORCHESTRATOR v9.6] INICIANDO PIPELINE MODULAR..."                    */
/*   então este push NÃO foi publicado.                                         */
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
    register('ScorePolicy', typeof ScorePolicy !== 'undefined' ? ScorePolicy : null);
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
    console.log("🚀 [ORCHESTRATOR v9.6] INICIANDO PIPELINE MODULAR...");

    // =======================================================================
    // 🔧 v14.7 [AÇÃO 4]: LOCK DE CONCORRÊNCIA — CORREÇÃO DA CAUSA RAIZ
    // -----------------------------------------------------------------------
    // EVIDÊNCIA DE PRODUÇÃO (21/09/2026):
    //   21:50:36  MENU_ATUALIZAR_ESTATISTICAS  (execução A, gatilho)
    //   21:58:28  scanner manual               (execução B)
    //   22:00:55  scanner manual concluído
    //
    // As execuções se sobrepuseram. Ambas escreveram em 'Resultados_Analise' e o
    // par clear() → setValues() do OutputManager._forceWrite NÃO é atômico.
    // Resultado: a linha do BPAC11 ficou com valores IMPOSSÍVEIS:
    //   Stop  = R$ 57,15   (de uma execução)
    //   Alvo1 = R$ 61,67   (de outra)  ← o valor CORRETO do nosso fix
    //   Risco = 6,93%      (corresponde a um stop de R$ 59,10 — terceiro estado)
    //   R/R   = 0,06       (alvo de uma ÷ risco de outra)
    //
    // Este é o TERCEIRO sintoma da mesma causa nesta investigação:
    //   1ª vez: Risco 13,94% + R/R 2,00
    //   2ª vez: Fibonacci 53,98 + Topo50 61,67
    //   3ª vez: Stop 57,15 + Alvo1 61,67
    //
    // AGORA: um LockService exclusivo por pipeline. Se outra execução já estiver
    // rodando, esta aborta ANTES de tocar qualquer planilha.
    // =======================================================================
    var lock = null;
    try {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(30000)) {
        console.warn("⛔ [Orchestrator] Outra execução já está em andamento (aguardei 30s " +
          "pelo lock). ABORTANDO para evitar corrupção de dados.");
        console.warn("   Verifique os gatilhos em 47_Automacao_Triggers.js e evite disparar " +
          "o scanner manualmente enquanto um gatilho estiver ativo.");
        try {
          SpreadsheetApp.getActiveSpreadsheet().toast(
            "⛔ Pipeline já em execução. Aguarde o término.", "B3 PRO", 5);
        } catch (eToast) { /* contexto sem UI */ }
        console.timeEnd("⏱️ Tempo Total Execução");
        return;
      }
      console.log("🔒 [Orchestrator] Lock adquirido. Execução exclusiva garantida.");
    } catch (eLock) {
      // Se o LockService falhar (contexto restrito), seguimos SEM lock mas avisamos.
      // Abortar aqui bloquearia produção por um erro de infraestrutura.
      console.warn("⚠️ [Orchestrator] LockService indisponível (" + eLock.message +
        "). Prosseguindo SEM proteção de concorrência.");
      lock = null;
    }

    // 🔑 A partir daqui tudo está em try/finally para garantir que o lock seja
    // liberado mesmo em exceção (senão o pipeline ficaria travado até expirar).
    try {
      this._inicioPipeline = Date.now();
      this._TETO_PIPELINE_MS = 340000;
      this._falhasPipeline = [];
      this._execucaoId = (typeof Utilities !== 'undefined' && Utilities.getUuid)
        ? Utilities.getUuid() : String(Date.now());
      console.log("🆔 [Orchestrator] Execução ID: " + this._execucaoId);

      // 🔧 v14.3 (OPÇÃO C): zera a instrumentação de rede da Bolsai para que o log
      // final reflita apenas esta execução (corte de desperdício mensurável).
      if (typeof BolsaiFetcher !== 'undefined' && typeof BolsaiFetcher.resetMetrics === 'function') {
        BolsaiFetcher.resetMetrics();
      }

      this._updateLog(10, "Inicializando módulos...");
      CoreRegistry.init();

      if (!this._validarAmbiente(forcado)) return;

      this._updateLog(20, "Rodando scanner técnico...");
      var analisesTecnicas = this._rodarScannerTecnico();
      if (!analisesTecnicas || analisesTecnicas.length === 0) {
        return this._encerrarVazio();
      }
      console.log("⏳ [Orchestrator] Tempo após scanner: " + this._tempoDecorrido() + "s (teto " +
        (this._TETO_PIPELINE_MS / 1000) + "s).");

      this._updateLog(50, "Enriquecendo com IA...");
      var analisesIA = this._enriquecerComIA(analisesTecnicas);

      this._updateLog(70, "Validando via Sentinela...");
      var listaCompleta = this._validarSentinela(analisesIA);

      // Extrai os ativos realmente aprovados pelo Sentinela de risco
      var aprovadosElite = listaCompleta.filter(function(x) { return x.approved === true; });

      // 🚀 Registra os aprovados para simulação de performance futura
      var simulationManager = CoreRegistry.get('SimulationManager');
      if (simulationManager && typeof simulationManager.registerEntries === 'function') {
        simulationManager.registerEntries(aprovadosElite);
      }

      // Grava TODA a lista (aprovados + reprovados) em Resultados_Analise.
      // Em seguida: Oportunidades → Ranker → Dashboard.
      this._processarSaidasFinais(listaCompleta, aprovadosElite);

      this._updateLog(100, "Finalizado. Aprovados: " + aprovadosElite.length);
      console.log("✅ SISTEMA B3-V10 FINALIZADO. Aprovados: " + aprovadosElite.length);

    } catch (ePipeline) {
      // 🔧 v14.7: erro fatal do pipeline precisa ser VISÍVEL (não engolido).
      console.error("❌ [Orchestrator] FALHA FATAL no pipeline: " + ePipeline.message);
      console.error("   stack: " + String(ePipeline.stack || '').split('\n').slice(0, 4).join(' | '));
      try {
        SpreadsheetApp.getActiveSpreadsheet().toast(
          "❌ Pipeline falhou: " + ePipeline.message, "B3 PRO", 10);
      } catch (eToast2) { /* sem UI */ }
      throw ePipeline;

    } finally {
      // 🔑 LIBERA O LOCK SEMPRE — inclusive em exceção.
      if (lock) {
        try {
          lock.releaseLock();
          console.log("🔓 [Orchestrator] Lock liberado.");
        } catch (eRelease) {
          console.warn("⚠️ [Orchestrator] Falha ao liberar lock: " + eRelease.message);
        }
      }
      console.timeEnd("⏱️ Tempo Total Execução");
    }
  },

  _updateLog: function(progress, message) {
    var log = CacheService.getScriptCache().get("process_log");
    log = log ? JSON.parse(log) : { progress: 0, messages: [] };
    log.progress = progress;
    log.messages.push(message);
    if (log.messages.length > 5) log.messages.shift();
    CacheService.getScriptCache().put("process_log", JSON.stringify(log));
  },

  /** 🔧 v13.0: Segundos decorridos desde o início do pipeline. */
  _tempoDecorrido: function() {
    if (!this._inicioPipeline) return 0;
    return Math.round((Date.now() - this._inicioPipeline) / 1000);
  },

  /** 🔧 v13.0: Segundos restantes até o teto do pipeline (pode ser negativo). */
  _tempoRestante: function() {
    if (!this._inicioPipeline) return this._TETO_PIPELINE_MS / 1000;
    return Math.round((this._TETO_PIPELINE_MS - (Date.now() - this._inicioPipeline)) / 1000);
  },

  /** 🔧 v13.0: true se houver margem para uma fase que estima `custoEstimadoMs`. */
  _temMargem: function(custoEstimadoMs) {
    return this._tempoRestante() * 1000 > (custoEstimadoMs || 0);
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

  /**
   * 🔧 v12.9: FILTROS DE PRÉ-TRIAGEM (liquidez + volatilidade).
   * Aplica cortes rápidos ANTES do score, usando os candles JÁ baixados pelo
   * scanner (zero chamadas extras à API). Retorna null se o ativo passa, ou um
   * objeto { reprovado:true, setup, motivo } se deve ser descartado.
   * @param {Object} data Resultado de DataService.getMarketData()
   * @returns {Object|null}
   */
  _avaliarFiltrosPreTriagem: function(data) {
    try {
      if (typeof CONFIG === 'undefined' || typeof CONFIG.get !== 'function') return null;
      var candles = (data && data.candles) ? data.candles : (Array.isArray(data) ? data : null);
      if (!candles || candles.length < 15) return null;

      var ultimo = candles[candles.length - 1];
      var preco = (ultimo && ultimo.close) || (data && data.price) || 0;
      if (!(preco > 0)) return null;

      // ── 1. LIQUIDEZ (volume médio diário em R$) ──────────────────────────
      if (CONFIG.get('LIQUIDEZ_ATIVA', true)) {
        var volMin = Number(CONFIG.get('LIQUIDEZ_VOLUME_MINIMO', 2000000)) || 0;
        if (volMin > 0) {
          var dias = Number(CONFIG.get('LIQUIDEZ_DIAS_MEDIA', 20)) || 20;
          var inicio = Math.max(0, candles.length - dias);
          var somaValor = 0, n = 0;
          for (var i = inicio; i < candles.length; i++) {
            var c = candles[i];
            var v = (c && typeof c.volume === 'number') ? c.volume : 0;
            var cl = (c && typeof c.close === 'number') ? c.close : 0;
            if (v > 0 && cl > 0) { somaValor += v * cl; n++; }
          }
          var volMedioRs = n > 0 ? (somaValor / n) : 0;
          if (volMedioRs > 0 && volMedioRs < volMin) {
            return {
              reprovado: true,
              setup: "💧 LIQUIDEZ BAIXA",
              motivo: "Volume médio R$ " + (volMedioRs / 1e6).toFixed(2) + "M < mínimo R$ " + (volMin / 1e6).toFixed(1) + "M"
            };
          }
        }
      }

      // ── 2. VOLATILIDADE (ATR% = ATR / preço) ─────────────────────────────
      if (CONFIG.get('VOLATILIDADE_ATIVA', true)) {
        var atrMax = Number(CONFIG.get('ATR_MAX_PCT', 0.10)) || 0;
        var atrMin = Number(CONFIG.get('ATR_MIN_PCT', 0.005)) || 0;
        if (atrMax > 0 || atrMin > 0) {
          var atr = _core_getATR(candles, 14); // reaproveita o ATR do módulo 22
          if (atr > 0) {
            var atrPct = atr / preco;
            if (atrMax > 0 && atrPct > atrMax) {
              return {
                reprovado: true,
                setup: "🌊 VOLATILIDADE EXCESSIVA",
                motivo: "ATR " + (atrPct * 100).toFixed(1) + "% > teto " + (atrMax * 100).toFixed(0) + "%"
              };
            }
            if (atrMin > 0 && atrPct < atrMin) {
              return {
                reprovado: true,
                setup: "😴 VOLATILIDADE BAIXA",
                motivo: "ATR " + (atrPct * 100).toFixed(2) + "% < piso " + (atrMin * 100).toFixed(1) + "%"
              };
            }
          }
        }
      }

      return null; // passou nos filtros
    } catch (e) {
      console.warn("⚠️ _avaliarFiltrosPreTriagem falhou (seguindo sem filtro): " + e.message);
      return null;
    }
  },

  /**
   * 🔧 v14.2 (ANTI-TIMEOUT): Ordena o universo de tickers por prioridade de
   * liquidez ANTES de entregá-lo ao scanner.
   *
   * Motivo: o scanner tem orçamento FIXO (TEMPO_LIMITE_MS = 210s). Com ~70 ativos
   * e custo real de 9-18s/ticker (cascata GoogleFinance → Bolsai → BRAPI), é
   * impossível processar a lista inteira em cache frio. Antes desta ordenação,
   * o robô seguia a ordem literal de CATEGORIES e os ÚLTIMOS grupos da lista
   * (TACTICAL/HEALTHCARE/CONSUMER/FINANCIAL) eram sistematicamente abandonados
   * com "⏱️ TIMEOUT" — exatamente o que produzia as linhas 37-71 com CASH3.
   *
   * Agora os ativos de maior liquidez (blue chips) são SEMPRE analisados
   * primeiro; se o tempo acabar, a perda recai sobre ativos menos relevantes.
   *
   * @param {Array<string>} tickers Lista bruta (já filtrada de dead tickers).
   * @returns {Array<string>} Lista priorizada por liquidez.
   */
  _ordenarTickersPorLiquidez: function(tickers) {
    if (!Array.isArray(tickers) || tickers.length === 0) return tickers || [];
    var tm = (typeof B3V10_TICKER_MANAGER !== 'undefined') ? B3V10_TICKER_MANAGER : null;
    if (!tm || typeof tm.getOrdered !== 'function') {
      console.warn('⚠️ [Orchestrator] TickerManager.getOrdered indisponível — mantendo ordem original.');
      return tickers;
    }

    // Constrói o índice de prioridade a partir da ordem canônica do TickerManager.
    var ordenado = tm.getOrdered();
    var posicao = {};
    for (var i = 0; i < ordenado.length; i++) posicao[ordenado[i]] = i;

    // Ordena apenas os tickers recebidos, preservando a precedência da categoria.
    // Tickers fora do mapa canônico (ex.: vindos da Carteira) vão para o fim,
    // mantendo a ordem relativa original entre si.
    var copia = tickers.slice();
    copia.sort(function(a, b) {
      var pa = (posicao[a] !== undefined) ? posicao[a] : Number.MAX_SAFE_INTEGER;
      var pb = (posicao[b] !== undefined) ? posicao[b] : Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return 0; // estável: preserva a ordem de entrada
    });

    var mudou = 0;
    for (var k = 0; k < copia.length; k++) {
      if (copia[k] !== tickers[k]) { mudou++; }
    }
    if (mudou > 0) {
      console.log('🔀 [Orchestrator] Universo reordenado por liquidez: primeiros 10 → ' +
        copia.slice(0, 10).join(', '));
    }
    return copia;
  },

  /**
   * 🔧 v14.2 (ANTI-TIMEOUT): AQUEÇA O CACHE antes do scanner (opção A).
   *
   * O custo por ticker dentro de getMarketData() é dominado por 2 chamadas de rede
   * obrigatórias (GoogleFinance na aba Cotacoes_Live + Bolsai getHistory). Em cache
   * FRIO isso custa ~9-18s/ticker, o que estoura os 210s após ~20-35 ativos.
   *
   * Repovoar a aba 'Cotacoes_Live' ANTES do scan faz com que:
   *   1) getPrecosGoogleFinance() encontre o preço já calculado (1 leitura de aba);
   *   2) o pipeline rode com o SpreadsheetApp.flush() aplicado (valores frescos).
   * O ganho é indireto (evita #N/A e reescalonamento), mas relevante: o preço vivo
   * encontrado no aquecimento evita descartar séries por "_serieDesatualizada" —
   * descarte esse que hoje força uma 2ª requisição (BRAPI) para o mesmo ticker.
   *
   * Best-effort: qualquer falha aqui NÃO pode derrubar o scan.
   *
   * @param {Array<string>} tickers Lista que será processada pelo scanner.
   * @returns {boolean} true se a aba foi repovoada com sucesso.
   */
  _aquecerCachePreScanner: function(tickers) {
    var dataService = CoreRegistry.get('DataService');
    if (!dataService || typeof dataService.prepararAbaCotacoesLive !== 'function') {
      console.log('ℹ️ [Aquecimento] DataService.prepararAbaCotacoesLive indisponível — pulando.');
      return false;
    }
    try {
      var t0 = Date.now();
      var ok = dataService.prepararAbaCotacoesLive(tickers);
      // Força o recálculo das fórmulas GOOGLEFINANCE antes do scanner ler a aba.
      try { SpreadsheetApp.flush(); } catch (eFlush) { /* aceitável em execução headless */ }
      console.log('🔥 [Aquecimento] Cotacoes_Live repovoada em ' +
        Math.round((Date.now() - t0) / 1000) + 's (' +
        (ok ? 'ok' : 'sem alteração') + ') para ' + (tickers ? tickers.length : 0) + ' tickers.');
      return !!ok;
    } catch (e) {
      console.warn('⚠️ [Aquecimento] Falha ao repovoar Cotacoes_Live (seguindo sem aquecimento): ' + e.message);
      return false;
    }
  },

  _rodarScannerTecnico: function() {
    // 🔧 v13.3: ORÇAMENTO DE TEMPO REALISTA (limite GAS = 360s).
    // Medição real (scan anterior): scanner ~128s + IA/Sentinela ~75s + gravação
    // ~30s ≈ 240s no total. Havia folga, mas o scanner de 150s abandonava tickers
    // em dias mais lentos (13 pendentes → "TIMEOUT"). Elevamos o scanner para 210s,
    // mantendo ~130s para as fases seguintes (IA + cotação + gravação).
    var TEMPO_LIMITE_MS = 210000; // 🔧 v13.3: 150s → 210s (processa a lista inteira)
    var TEMPO_GLOBAL_MS = 330000; // Limite global de emergência (segurança absoluta)
    var inicio = Date.now();
    var BATCH_SIZE = 5;
    var PAUSE_BETWEEN_BATCHES_MS = 500; // 🔧 v13.3: 700ms → 500ms (rate limit ainda seguro)
    
    // 🔧 v14.4 (OPÇÃO D): Timeout individual AGRESSIVO.
    // Antes: 35s por ticker = 17% de todo o orçamento útil (203s) em UM ativo.
    // Com 3 tickers lentos, 52% do orçamento ia embora. O custo real da cascata
    // (GoogleFinance + Bolsai + BRAPI) é 9-18s, então 12s cobre o caminho normal
    // com folga e corta cedo o ativo problemático. Há um piso: o timeout nunca
    // pode ser menor que o custo razoável da cascata.
    var TICKER_TIMEOUT_MS = 12000; // 🔧 v14.4: 35s → 12s (corta ativo travado cedo)

    // 🔧 v13.3: SINCRONIZA o limite do scanner com o orçamento GLOBAL do pipeline.
    // O scanner nunca deve consumir mais que (teto global − RESERVA_POS_SCANNER),
    // onde a reserva (~120s) cobre IA + cotação ao vivo + gravação + dashboard.
    var RESERVA_POS_SCANNER_MS = 120000;
    if (this._inicioPipeline && this._TETO_PIPELINE_MS) {
      var restanteGlobal = this._TETO_PIPELINE_MS - (Date.now() - this._inicioPipeline);
      var limiteSincronizado = restanteGlobal - RESERVA_POS_SCANNER_MS;
      if (limiteSincronizado > 0 && limiteSincronizado < TEMPO_LIMITE_MS) {
        TEMPO_LIMITE_MS = limiteSincronizado;
      }
    }
    console.log("⏱️ [Scanner] Limite de tempo desta fase: " + Math.round(TEMPO_LIMITE_MS / 1000) + "s");

    // 🔧 v14.4 (OPÇÃO E): USA O UNIVERSO CURADO DO SCANNER (~40 ativos em 2 tiers)
    // em vez de getAll() (~70 ativos). O custo real é 9-18s/ticker contra um
    // orçamento de 210s: varrer 70 ativos era estruturalmente impossível e
    // produzia as linhas "⏱️ TIMEOUT" (caso CASH3). CATEGORIES segue intacto
    // como fonte de verdade para setores/Ranker/Carteira.
    var universoConfig = null;
    var tickers = [];
    if (typeof B3V10_TICKER_MANAGER !== 'undefined') {
      if (typeof B3V10_TICKER_MANAGER.getScannerUniverse === 'function') {
        tickers = B3V10_TICKER_MANAGER.getScannerUniverse();
        if (typeof B3V10_TICKER_MANAGER.getScannerUniverseConfig === 'function') {
          universoConfig = B3V10_TICKER_MANAGER.getScannerUniverseConfig();
        }
      } else {
        // Fallback seguro: mantém o comportamento anterior se o módulo for antigo.
        console.warn("⚠️ [Scanner] getScannerUniverse indisponível — usando getAll() como fallback.");
        tickers = (typeof B3V10_TICKER_MANAGER.getAll === 'function') ? B3V10_TICKER_MANAGER.getAll() : [];
      }
    }
    if (!tickers || tickers.length === 0) {
      console.warn("⚠️ Nenhum ticker disponível em B3V10_TICKER_MANAGER.");
      return [];
    }
    if (universoConfig) {
      var nT3 = (universoConfig.TIER3 || []).length;
      console.log("🎯 [Scanner] Universo curado: " + tickers.length + " ativos (Tier1=" +
        universoConfig.TIER1.length + " | Tier2=" + universoConfig.TIER2.length +
        " | Tier3=" + nT3 + ").");
    }

    // 🚀 NOVO: Filtra tickers inativos/alterados para não desperdiçar chamadas de API
    if (typeof B3V10_TICKER_MANAGER.filterDead === 'function') {
      tickers = B3V10_TICKER_MANAGER.filterDead(tickers);
    }

    // 🔧 v14.2 (ANTI-TIMEOUT - OPÇÃO B): ORDENA POR LIQUIDEZ antes do scan.
    // Com orçamento fixo de 210s e custo de 9-18s/ticker, os últimos ativos da
    // lista eram abandonados com "⏱️ TIMEOUT" (caso CASH3, linhas 37-71).
    // Priorizando blue chips, a perda (se houver) recai sobre ativos ilíquidos.
    tickers = this._ordenarTickersPorLiquidez(tickers);

    // 🔧 v14.2 (ANTI-TIMEOUT - OPÇÃO A): AQUECE O CACHE antes do scan.
    // Só executa se houver margem de tempo confortável (~30s), pois o aquecimento
    // consome orçamento do pipeline. Best-effort: falha aqui não derruba o scan.
    if (!this._inicioPipeline || this._temMargem(30000)) {
      this._aquecerCachePreScanner(tickers);
    } else {
      console.warn("⏱️ [Aquecimento] Sem margem de tempo (restante " + this._tempoRestante() +
        "s). Pulando aquecimento e seguindo direto para o scanner.");
    }

    // Recalcula o limite do scanner após o aquecimento: o tempo consumido pelo
    // aquecimento é descontado do orçamento, preservando a RESERVA pós-scanner.
    if (this._inicioPipeline && this._TETO_PIPELINE_MS) {
      var restantePosAq = this._TETO_PIPELINE_MS - (Date.now() - this._inicioPipeline);
      var limitePosAq = restantePosAq - RESERVA_POS_SCANNER_MS;
      if (limitePosAq > 0 && limitePosAq < TEMPO_LIMITE_MS) {
        TEMPO_LIMITE_MS = limitePosAq;
        console.log("⏱️ [Scanner] Limite reajustado pós-aquecimento: " +
          Math.round(TEMPO_LIMITE_MS / 1000) + "s");
      }
    }

    console.log("📊 Iniciando scanner com " + tickers.length + " tickers (batch size: " + BATCH_SIZE + ")");
    var context = null;
    var dataService = CoreRegistry.get('DataService');
    if (dataService) {
      context = dataService.getMarketContext();
      // 🔧 v13.2: FORÇA RELATIVA — baixa o benchmark (BOVA11) 1x e injeta o
      // retorno de 21d no contexto. Usado no score para premiar ativos que
      // batem o índice (Momentum Relativo). Best-effort: se falhar, não afeta.
      try {
        var bench = dataService.getMarketData('BOVA11', '1d', '3mo');
        var bc = (bench && bench.candles) ? bench.candles : null;
        if (bc && bc.length >= 22) {
          var bLast = bc[bc.length - 1].close;
          var bPast = bc[bc.length - 22].close;
          if (bLast > 0 && bPast > 0) {
            context.benchmarkTicker = 'BOVA11';
            context.benchmarkReturn21d = (bLast / bPast) - 1;
            this._benchmarkReturn21d = context.benchmarkReturn21d; // 🔧 v13.3: p/ normalização final
            console.log('📈 [Força Relativa] Benchmark BOVA11 retorno 21d: ' +
              (context.benchmarkReturn21d * 100).toFixed(2) + '%');
          }
        } else {
          console.warn('⚠️ [Força Relativa] Benchmark BOVA11 indisponível — score sem ajuste relativo.');
        }
      } catch (eBench) {
        console.warn('⚠️ [Força Relativa] Falha ao obter benchmark: ' + eBench.message);
      }
    }
    var resultados = [];
    var totalProcessados = 0;
    var totalBatches = Math.ceil(tickers.length / BATCH_SIZE);
    var falhasConsecutivas = 0;
    // 🔧 v14.0: FALHA_MAXIMA aumentado para não matar o scanner quando
    // APIs estão com quota esgotada (ex: 429 global). 3 era agressivo demais
    // e interrompia o pipeline com 73 tickers restantes após 3 falhas.
    // Agora só interrompe se TODOS os tickers da lista falharem seguidos (>50%).
    var FALHA_MAXIMA = Math.ceil(tickers.length * 0.5) || 5;

    // 🔧 v14.1: Garante transparência total na aba de resultados.
    // Antes, um break por timeout descartava silenciosamente os tickers restantes
    // (nem reprovados, nem aprovados) — o usuário não sabia se o ativo falhou no
    // modelo ou apenas não deu tempo de testá-lo. Agora marcamos os pendentes
    // como "⏱️ TIMEOUT" para que apareçam explicitamente na lista final.
    var tickersJaRegistrados = {};
    var batchTemTimeoutGlobal = false;
    var _marcarPendentesComoTimeout = function() {
      // Varre TODA a lista e marca como TIMEOUT qualquer ticker que ainda não
      // tenha sido registrado (nem processado, nem reprovado). Robusto contra
      // lacunas: cobre o ticker atual interrompido e todos os lotes futuros.
      var pendentes = 0;
      for (var p = 0; p < tickers.length; p++) {
        var tk = tickers[p];
        if (tickersJaRegistrados[tk]) continue;
        tickersJaRegistrados[tk] = true;
        resultados.push({
          ticker: tk,
          price: 0,
          score: 0,
          setup: "⏱️ TIMEOUT",
          motivo: "Não processado: limite global de tempo do scanner atingido (" + Math.round(TEMPO_LIMITE_MS/1000) + "s)",
          rr: 0,
          rsi: 50,
          adx: 25,
          reprovado: true
        });
        pendentes++;
      }
      if (pendentes > 0) {
        console.log("⏱️ " + pendentes + " ticker(s) não processado(s) marcados como TIMEOUT para transparência na planilha.");
      }
    };

    for (var batchIndex = 0; batchIndex < tickers.length; batchIndex += BATCH_SIZE) {
      var elapsed = Date.now() - inicio;
      if (elapsed > TEMPO_LIMITE_MS) {
        console.warn("⏱️ Timeout atingido (" + Math.round(elapsed/1000) + "s). Processados " + totalProcessados + " de " + tickers.length + " tickers.");
        _marcarPendentesComoTimeout();
        break;
      }

      var batch = tickers.slice(batchIndex, batchIndex + BATCH_SIZE);
      var batchNum = Math.floor(batchIndex / BATCH_SIZE) + 1;
      console.log("📦 Processando lote " + batchNum + "/" + totalBatches + ": " + batch.join(', '));

      for (var t = 0; t < batch.length; t++) {
        var ticker = batch[t];
        if (Date.now() - inicio > TEMPO_LIMITE_MS) {
          console.warn("⏱️ Timeout durante processamento de " + ticker + ". Interrompendo...");
          // Marca o ticker atual e TODOS os seguintes (deste lote e dos lotes
          // posteriores) como TIMEOUT antes de interromper os laços.
          _marcarPendentesComoTimeout();
          batchTemTimeoutGlobal = true;
          break;
        }

        // 🔧 NOVO: Timeout individual por ticker
        var inicioTicker = Date.now();

        // Marca este ticker como registrado assim que começa a ser processado,
        // evitando que o helper de timeout global o duplique depois.
        tickersJaRegistrados[ticker] = true;

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

          // 🔧 v12.9: FILTROS DE PRÉ-TRIAGEM (liquidez + volatilidade).
          // Cortes rápidos ANTES do score, usando os candles já baixados.
          var filtro = this._avaliarFiltrosPreTriagem(data);
          if (filtro) {
            var precoFiltro = data.candles ? data.candles[data.candles.length - 1].close : 0;
            resultados.push({
              ticker: ticker,
              price: precoFiltro,
              score: 0,
              setup: filtro.setup,
              motivo: filtro.motivo,
              rr: 0,
              rsi: 50,
              adx: 25,
              reprovado: true
            });
            console.log("🚫 [Scanner] " + ticker + ": " + filtro.setup + " — " + filtro.motivo);
            continue;
          }

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

          // 🔧 CORREÇÃO v12.8: GUARDA DE GEOMETRIA — stop inválido para COMPRA.
          // Um setup de compra com stop >= preço é logicamente impossível (alvo e
          // risco invertidos). Não deve ser aprovado mesmo com RR alto. (Caso AXIA3.)
          var stopGeometriaInvalida = (analise.stopLoss > 0 && analise.price > 0 && analise.stopLoss >= analise.price);

          // Mantém reprovados na lista final para visualização na aba Resultados_Analise
          if (!stopGeometriaInvalida && analise.rr >= minRR) {
            analise.reprovado = false;
            resultados.push(analise);
            console.log(`✅ [Scanner] ${ticker}: score=${parseFloat(analise.score).toFixed(2)} | RR=${parseFloat(analise.rr).toFixed(2)} (min ${minRR}) | setup=${analise.setup}`);
          } else {
            analise.reprovado = true;
            if (stopGeometriaInvalida) {
              analise.setup = "🛑 STOP INVIÁVEL (acima do preço)";
              analise.motivo = "Stop Loss R$ " + parseFloat(analise.stopLoss).toFixed(2) +
                " está ACIMA do preço R$ " + parseFloat(analise.price).toFixed(2) + " — geometria inválida para compra";
              console.log("🛑 [Scanner] " + ticker + ": stop inválido para compra (stop=" +
                parseFloat(analise.stopLoss).toFixed(2) + " >= preco=" + parseFloat(analise.price).toFixed(2) + ")");
            } else {
              // 🔧 v12.8: usa o minRR EFETIVO (pode ter sido flexibilizado para 1.8)
              analise.setup = "⛔ RISCO ALTO (RR < " + minRR + ")";
              analise.motivo = "Retorno-Risco de " + parseFloat(analise.rr).toFixed(2) + " é menor que o limite mínimo de " + minRR;
              console.log("📊 [Scanner] " + ticker + ": score=" + parseFloat(analise.score).toFixed(2) + " | RR=" + parseFloat(analise.rr).toFixed(2) + " — abaixo do filtro");
            }
            resultados.push(analise);
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

      if (batchTemTimeoutGlobal) {
        console.warn("⏱️ Interrompendo laço de lotes: timeout global já sinalizado.");
        break;
      }

      if (batchIndex + BATCH_SIZE < tickers.length && Date.now() - inicio < TEMPO_LIMITE_MS) {
        console.log("⏸️ Pausa de " + PAUSE_BETWEEN_BATCHES_MS + "ms antes do próximo lote...");
        Utilities.sleep(PAUSE_BETWEEN_BATCHES_MS);
      }
    }

    var tempoTotal = Math.round((Date.now() - inicio) / 1000);
    var candidatosRR = resultados.filter(function(r) { return r.rr >= 2; }).length;
    var totalTimeout = resultados.filter(function(r) { return r.setup === "⏱️ TIMEOUT"; }).length;

    // 🔧 v14.3 (OPÇÃO C): relatório do corte de desperdício na API Bolsai.
    if (typeof BolsaiFetcher !== 'undefined' && typeof BolsaiFetcher.getMetrics === 'function') {
      try {
        var bm = BolsaiFetcher.getMetrics();
        console.log("📉 [Bolsai] Requisições de rede: " + bm.requests +
          " | Round-trips evitados (404 em cache): " + bm.missesEvitados);
      } catch (eM) { /* métrica é opcional */ }
    }

    console.log("📊 Scanner concluído em " + tempoTotal + "s. Processados: " + totalProcessados + "/" + tickers.length + " tickers. Candidatos com RR≥2: " + candidatosRR + " (total na lista: " + resultados.length + ", timeouts: " + totalTimeout + ")");
    
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

    // 🔧 CORREÇÃO v12.7: CONCILIAÇÃO DE PREÇO COM COTAÇÃO AO VIVO (EM LOTE)
    // O op.price vem do close do ÚLTIMO CANDLE DIÁRIO do histórico (getMarketData),
    // que pode estar defasado (cache de 10/30 min, candle do dia sem close, evento
    // corporativo tipo grupamento/desdobramento — ex: ONCO3 exibindo R$5,20 com a
    // cotação real em R$1,21). Fazemos 1 chamada em lote (getPrecosAtuaisEmLote) e
    // usamos a cotação ao vivo como op.livePrice (APENAS para exibição). O op.price
    // permanece intacto para os cálculos técnicos (indicadores/score). Quando a
    // divergência é forte (>15%), marcamos op.alertaLive para sinalizar na planilha.

    var tickersParaCotar = [];
    var mapaIdx = {};
    var precosReferencia = {};
    lista.forEach(function(op, idx) {
      if (!op || !op.ticker) return;
      if (op.price && op.price > 0) {
        if (!mapaIdx[op.ticker]) {
          mapaIdx[op.ticker] = [];
          tickersParaCotar.push(op.ticker);
          precosReferencia[op.ticker] = op.price; // 1ª ocorrência = referência do candle
        }
        mapaIdx[op.ticker].push(idx);
      }
    });

    // 🔧 v12.7: OVERRIDE MANUAL — força o preço exibido (Script Property PRECO_OVERRIDE_<TICKER>).
    // Útil quando as fontes de mercado retornam preço defasado (ex: ONCO3 0,92 vs real 1,20).
    if (tickersParaCotar.length > 0 && typeof DataService !== 'undefined' && typeof DataService.getPrecoOverride === 'function') {
      var tickersOverride = {};
      for (var oi = 0; oi < tickersParaCotar.length; oi++) {
        var tkOverride = tickersParaCotar[oi];
        var precoOverride = DataService.getPrecoOverride(tkOverride);
        if (precoOverride && precoOverride > 0) {
          var idxLista = mapaIdx[tkOverride] || [];
          for (var oi2 = 0; oi2 < idxLista.length; oi2++) {
            var opOv = lista[idxLista[oi2]];
            if (!opOv) continue;
            opOv.livePrice = precoOverride;
            opOv.precoOverrideUsado = true;
            atualizados++;
            console.log('   🔧 [Orchestrator] Override manual de preço ' + tkOverride + ': R$ ' + precoOverride.toFixed(2));
          }
          tickersOverride[tkOverride] = true;
        }
      }
      if (Object.keys(tickersOverride).length > 0) {
        // Remove do lote de cotação os tickers que já têm override manual
        tickersParaCotar = tickersParaCotar.filter(function(t) { return !tickersOverride[t]; });
      }
    }

    // 🔧 v13.0: GUARDA DE TEMPO — se o pipeline já consumiu quase todo o orçamento,
    // PULA a cotação ao vivo (usa o close do candle). Isso evita estourar os 360s.
    if (this._inicioPipeline && !this._temMargem(20000)) {
      console.warn("⏱️ [Orchestrator] Sem margem de tempo para cotação ao vivo (restante " +
        this._tempoRestante() + "s). Usando close do candle como preço exibido.");
      return;
    }

    if (tickersParaCotar.length > 0 && typeof DataService !== 'undefined' && typeof DataService.getPrecosAtuaisEmLote === 'function') {
      try {
        // Passa a referência (close do candle) para a verificação cruzada de cotações suspeitas
        var cotacoes = DataService.getPrecosAtuaisEmLote(tickersParaCotar, { precosReferencia: precosReferencia });
        if (cotacoes && typeof cotacoes === 'object') {
          for (var tk in cotacoes) {
            if (!Object.prototype.hasOwnProperty.call(cotacoes, tk)) continue;
            var q = cotacoes[tk];
            if (!q || !q.price || !(q.price > 0)) continue;
            var indices = mapaIdx[tk] || [];
            for (var i = 0; i < indices.length; i++) {
              var op = lista[indices[i]];
              if (!op || !op.price) continue;
              op.livePrice = q.price; // Preço exibido = cotação ao vivo (ou close do candle se sinalizado corrompido)
              // 🔧 v12.9: Se o DataService marcou a cotação como corrompida (preço divergente >35% do candle),
              // propagamos alerta para o usuário saber que aquele preço veio do candle diário, não da cotação ao vivo.
              if (q.corrompido) {
                op.alertaLive = '🚨 Fonte (' + (q.source || '?') + ') retornou preço divergente (R$ ' + (q.precoRealSuspeito || 0).toFixed(2) + '). Usado close do candle (R$ ' + q.price.toFixed(2) + ').';
              }
              var diffPct = Math.abs(q.price - op.price) / op.price;
              if (diffPct > 0.005) {
                console.log('   🔄 Preço ao vivo ' + tk + ': R$ ' + op.price.toFixed(2) + ' → R$ ' + q.price.toFixed(2) + ' (candle diário vs cotação)');
              }
              // 🚨 Divergência forte indica dado defasado / evento corporativo
              if (diffPct > 0.15) {
                op.alertaLive = '🚨 Preço do candle (R$ ' + op.price.toFixed(2) + ') diverge ' + (diffPct * 100).toFixed(0) + '% da cotação ao vivo (R$ ' + q.price.toFixed(2) + ') — análise possivelmente defasada';
              }
              atualizados++;
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ [Orchestrator] Falha ao reconciliar preços ao vivo: ' + e.message);
      }
    }

    // Fallback seguro: se a cotação ao vivo não estiver disponível, mantém o preço do candle
    if (atualizados === 0) {
      lista.forEach(function(op) {
        if (op && op.price && op.price > 0) {
          op.livePrice = op.price;
          atualizados++;
        }
      });
    }

    console.log('💰 Preços reconciliados com cotação ao vivo: ' + atualizados + '/' + lista.length + ' ativos');
  },


  _enriquecerComIA: function(lista) {
    if (!lista || lista.length === 0) return [];
    var candidatosIA = [];
    var naoEnviados = [];

    // 🔧 v13.0: GUARDA DE TEMPO — a IA (LLM) é a fase mais lenta. Se não houver
    // margem suficiente (~60s), pula o enriquecimento e usa o score técnico.
    var semTempoIA = this._inicioPipeline && !this._temMargem(60000);
    if (semTempoIA) {
      console.warn("⏱️ [Orchestrator] Sem margem de tempo para IA (restante " +
        this._tempoRestante() + "s). Usando apenas o score técnico.");
    }

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

    // 🔧 v13.0: Se não houver tempo para IA, devolve os candidatos com score TÉCNICO
    // (fallback), preservando o restante. Evita o pipeline estourar os 360s.
    if (semTempoIA) {
      return candidatosIA.map(function(op) {
        return Object.assign({}, op, {
          enrichedScore: op.score, ensembleScore: op.score, aiConfidence: 0,
          sentiment: 'NEUTRAL', aiRationale: 'IA pulada por orçamento de tempo', fallback: true
        });
      }).concat(naoEnviados);
    }

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
        return 'SCORE final=' + item.scoreFinal + ' ai=' + item.aiScore +
          ' ajuste=' + (item.ajusteIA !== undefined ? item.ajusteIA : 0) +
          ' bonus=' + item.sentimentBonus;
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
      var sheetWriterVazio = CoreRegistry.get('SheetWriter');
      if (sheetWriterVazio && typeof sheetWriterVazio.clearSheet === 'function') {
        sheetWriterVazio.clearSheet();
      }
      return;
    }

    // 🔧 v13.3: NORMALIZAÇÃO DEFENSIVA da Força Relativa.
    // Alguns objetos podem perder `forcaRelativa` ao passar pelas fases de IA/
    // Sentinela (reconstrução de objeto). Garantimos que a coluna fique coerente:
    // se `forcaRelativa` faltar MAS tivermos `retorno21d` + benchmark, recalculamos.
    var _bench21d = this._benchmarkReturn21d;
    var _corrigidosFR = 0;
    for (var _fi = 0; _fi < listaCompleta.length; _fi++) {
      var _op = listaCompleta[_fi];
      if (!_op) continue;
      var _frAusente = (_op.forcaRelativa === undefined || _op.forcaRelativa === null);
      if (_frAusente && typeof _bench21d === 'number' && typeof _op.retorno21d === 'number') {
        _op.forcaRelativa = parseFloat((_op.retorno21d - _bench21d).toFixed(4));
        _corrigidosFR++;
      }
    }
    if (_corrigidosFR > 0) {
      console.log("📈 [Força Relativa] " + _corrigidosFR + " linha(s) com Força Rel. recalculada no fechamento.");
    }

    // ✅ OTIMIZAÇÃO: Preços já foram extraídos dos resultados do scanner técnico.
    // Removida chamada _atualizarPrecosLote que duplicava requisições à API.

    // =====================================================================
    // GRAVAÇÃO — AÇÃO 3 (v14.6): ERROS NÃO SÃO MAIS ENGOLIDOS
    // ---------------------------------------------------------------------
    // ANTES: `catch (e) { console.error(...) }` silenciava falhas de gravação.
    // Isso permitia que 'Resultados_Analise' ficasse com dados PARCIAIS (ou de
    // execuções anteriores) sem que o usuário soubesse — foi assim que a linha
    // do BPAC11 ficou com Fibonacci 53,98 e Topo50 61,67 incompatíveis.
    //
    // AGORA: a falha é (a) registrada com stack trace, (b) acumulada em
    // `this._falhasPipeline` e (c) exibida no final em um alerta. O pipeline
    // continua (para não travar o usuário), mas o problema fica VISÍVEL.
    // =====================================================================
    if (!this._falhasPipeline) this._falhasPipeline = [];

    var sheetWriter = CoreRegistry.get('SheetWriter');
    if (sheetWriter) {
      try {
        var gravou = sheetWriter.saveAnalysisResults(listaCompleta);
        if (gravou === false) {
          this._registrarFalha('SheetWriter', 'Gravação retornou false — ' +
            'verifique se o OutputManager (08_Output_Unified.js) está carregado.');
        }
      } catch (e) {
        this._registrarFalha('SheetWriter', e.message, e.stack);
      }
    } else {
      this._registrarFalha('SheetWriter', 'Módulo SheetWriter NÃO encontrado no CoreRegistry. ' +
        'Nenhuma linha foi gravada em "Resultados_Analise" — os dados exibidos podem ser de execuções anteriores.');
    }
    
    // 1º) Gera aba Oportunidades (consolidada e filtrada para o usuário)
    var processarOportunidadesFinal = CoreRegistry.get('PROCESSAR_OPORTUNIDADES_FINAL');
    if (typeof processarOportunidadesFinal === 'function') {
      try { processarOportunidadesFinal(); }
      catch (e) { this._registrarFalha('Oportunidades_Processor', e.message, e.stack); }
    } else {
      this._registrarFalha('Oportunidades_Processor',
        'PROCESSAR_OPORTUNIDADES_FINAL não encontrado — a aba "Oportunidades" pode estar desatualizada.');
    }
    
    // 2º) Ranker lê da aba Oportunidades (já atualizada) para gerar Resumo_Trades_Aprovados
    var processarCarteiraFinal = CoreRegistry.get('PROCESSAR_CARTEIRA_FINAL');
    if (typeof processarCarteiraFinal === 'function') {
      try { processarCarteiraFinal(); }
      catch (e) { this._registrarFalha('Ranker', e.message, e.stack); }
    } else {
      this._registrarFalha('Ranker',
        'PROCESSAR_CARTEIRA_FINAL não encontrado — "Resumo_Trades_Aprovados" pode estar desatualizado.');
    }
    
    // 3º) Atualiza dashboard
    var atualizarDashboard = CoreRegistry.get('ATUALIZAR_DASHBOARD');
    if (typeof atualizarDashboard === 'function') {
      try { atualizarDashboard(); }
      catch (e) { this._registrarFalha('Dashboard', e.message, e.stack); }
    }

    // 🔧 v14.6: reporta as falhas acumuladas ao final de _processarSaidasFinais
    this._reportarFalhas();
  },

  /**
   * 🔧 v14.6: acumula uma falha de etapa para reporte consolidado.
   * @param {string} etapa nome da etapa que falhou.
   * @param {string} mensagem mensagem de erro.
   * @param {string} [stack] stack trace opcional.
   */
  _registrarFalha: function(etapa, mensagem, stack) {
    if (!this._falhasPipeline) this._falhasPipeline = [];
    var registro = etapa + ': ' + mensagem;
    // Evita duplicatas em retries
    if (this._falhasPipeline.indexOf(registro) === -1) {
      this._falhasPipeline.push(registro);
    }
    console.error('❌ [Pipeline] Falha em "' + etapa + '": ' + mensagem);
    if (stack) console.error('   stack: ' + String(stack).split('\n').slice(0, 3).join(' | '));
  },

  /**
   * 🔧 v14.6: exibe as falhas acumuladas no final do pipeline.
   * Funciona em foreground (alerta) e em background (log).
   */
  _reportarFalhas: function() {
    var falhas = this._falhasPipeline || [];
    if (falhas.length === 0) return;

    var titulo = '⚠️ ' + falhas.length + ' ETAPA(S) FALHARAM NO PIPELINE';
    var corpo = falhas.map(function(f, i) { return (i + 1) + ') ' + f; }).join('\n') +
      '\n\n⚠️ As abas citadas podem conter dados DESATUALIZADOS ou PARCIAIS. ' +
      'Não confie nos números até resolver as falhas acima.';

    console.error('══════════════════════════════════════════════════');
    console.error(titulo);
    corpo.split('\n').forEach(function(l) { console.error('   ' + l); });
    console.error('══════════════════════════════════════════════════');

    try {
      var ui = SpreadsheetApp.getUi();
      if (ui && typeof ui.alert === 'function') {
        ui.alert(titulo, corpo, ui.ButtonSet.OK);
      }
    } catch (e) {
      // Contexto sem UI (gatilho/background) — o log acima já registrou.
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
