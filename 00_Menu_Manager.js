/**
 * =============================================================================
 * 00_Menu_Manager.js — v14.2 (TRÍADE DE COMANDO - ELITE)
 * =============================================================================
 * ✅ MELHORIA: Menus renomeados e organizados por funcionalidade clara e separação
 * de contextos (Cérebro, Cofre, Automação, Manutenção, Contábil).
 */

function onOpen() {
  MenuTriade.build();
}

var MenuTriade = (function () {
  'use strict';

  function build() {
    const ui = SpreadsheetApp.getUi();

    // MENU 1: 🧠 CÉREBRO (Estratégia e IA)
    ui.createMenu("🧠 B3: CÉREBRO")
      .addItem("▶️ Rodar Scanner B3 (Filtro Macro/MTF)", "executarRoboB3")
      .addItem("👁️ Monitor Sniper (Pré-Market)", "VISUALIZAR_MONITORAMENTO")
      .addItem("🗽 Sentinela Gringo (NY)", "VISUALIZAR_SENTINELA_GRINGO")
      .addSeparator()
      .addItem("🏆 Executar Ranker Manual", "MENU_RANKER")
      .addItem("🤖 Analisar Divergências (IA)", "MENU_AGENT_ANALYST")
      .addItem("🤖 Atualizar Cotações ", "ATUALIZAR_COTACOES_LIVE")
      .addToUi();

    // MENU 2: 💰 COFRE (Gestão de Portfólio)
    ui.createMenu("💰 B3: COFRE")
      .addItem("🛡️ Executar Trailing Stop & Estatísticas", "MENU_ATUALIZAR_ESTATISTICAS")
      .addItem("⚖️ Sincronizar Carteira (Stops e Alvos)", "MENU_SYNC_PORTFOLIO")
      .addSeparator()
      .addItem("🚨 Verificar Compliance e Risco", "MENU_COMPLIANCE")
      .addToUi();

    // MENU 3: ⚙️ AUTOMAÇÃO (Triggers e Config)
    ui.createMenu("⚙️ B3: AUTOMAÇÃO")
      .addItem("✅ LIGAR Robô (Criar Triggers)", "MENU_INSTALAR_AUTOMACAO")
      .addItem("🛑 DESLIGAR Robô (Remover Triggers)", "MENU_DESATIVAR_AUTOMACAO")
      .addSeparator()
      .addItem("🧪 Testar Motor de Simulação", "MENU_TESTAR_SISTEMA_SIMULACAO")
      .addToUi();

    // MENU 4: 🛠️ MANUTENÇÃO (Testes e Debug)
    ui.createMenu("🛠️ B3: MANUTENÇÃO")
      .addItem("🔑 Configurar Chave Gemini", "CONFIGURAR_GEMINI_KEY")
      .addItem("🔑 Testar Leitura do Cofre", "TESTAR_LEITURA_DO_COFRE")
      .addItem("🤖 Testar Conexão Gemini", "TESTAR_CONEXAO_GEMINI")
      .addItem("🔍 Origem da Chave Gemini", "DIAGNOSTICO_ORIGEM_CHAVE_GEMINI")
      .addItem("📨 Disparar Relatório Telegram", "MENU_TELEGRAM")
      .addItem("🔔 Testar Alerta de Risco (Telegram)", "MENU_TESTAR_ALERTA_RISCO")
      .addSeparator()
      .addItem("🏥 Health Check (Saúde)", "MENU_DEBUG_SAUDE")
      .addItem("🔍 Debug Unitário (PETR4)", "MENU_DEBUG_PETR4")
      .addItem("🧹 Limpar Cache Unificado", "MENU_LIMPAR_CACHE")
      .addToUi();

    // MENU 5: 📊 CONTÁBIL E IMPOSTOS
    ui.createMenu("📊 B3: CONTÁBIL")
      .addItem("📜 Gerar DARF (Impostos)", "MENU_DARF")
      .addItem("📈 Gerar Dashboard Anual", "GERAR_DASHBOARD_ANUAL")
      .addItem("💵 Executar Cálculo Fiscal Completo", "EXECUTAR_CALCULO_FISCAL")
      .addToUi();
                       
  }

  return { build };
})();

// =============================================================================
// --- PONTES DE COMANDO (WRAPPERS SEGUROS) ---
// =============================================================================

// =============================================================================
// HELPERS DE INTERFACE (UI) — compartilhados entre arquivos (escopo global GAS)
// =============================================================================
// Em Apps Script, SpreadsheetApp.getUi() só pode ser usado quando há uma interface
// de usuário (rodando por menu/edição numa planilha aberta). Em gatilhos de tempo
// ou execução pelo editor "Run", getUi() lança "Cannot call SpreadsheetApp.getUi()
// from this context", derrubando funções que só queriam rodar em segundo plano.
// Estes helpers blindam essa chamada e caem para log via console quando não há UI.

/** Retorna o objeto Ui se houver interface, ou null caso contrário (nunca lança). */
function b3ObterUi() {
  try {
    if (typeof SpreadsheetApp !== 'undefined' && typeof SpreadsheetApp.getUi === 'function') {
      return SpreadsheetApp.getUi();
    }
  } catch (e) { /* sem contexto de interface */ }
  return null;
}

/**
 * Exibe um alerta SE houver interface de usuário; caso contrário loga no console.
 * @param {string} titulo Título exibido no topo do alerta.
 * @param {string} mensagem Conteúdo do alerta.
 * @param {boolean} [optarSimNao] Se true, usa botões SIM/NÃO (retorna true/false).
 * @returns {boolean|null} Resultado do botão, ou null quando sem UI.
 */
function b3UiAlert(titulo, mensagem, optarSimNao) {
  const ui = b3ObterUi();
  if (!ui) {
    console.warn('ℹ️ [UI] Sem interface (background). Título: ' + String(titulo || '') + ' | ' + String(mensagem || '').replace(/\s+/g, ' ').slice(0, 300));
    return null;
  }
  try {
    if (optarSimNao) return ui.alert(String(titulo || 'Atenção'), String(mensagem || ''), ui.ButtonSet.YES_NO) === ui.Button.YES;
    ui.alert(String(titulo || 'B3 V10'), String(mensagem || ''), ui.ButtonSet.OK);
    return true;
  } catch (e) {
    console.warn('ℹ️ [UI] Falha ao exibir alerta (background): ' + e.message);
    return null;
  }
}

function MENU_RANKER() { 
  if (typeof PROCESSAR_CARTEIRA_FINAL === 'function') PROCESSAR_CARTEIRA_FINAL();
  else b3UiAlert('Módulo Ranker', '❌ Módulo Ranker não encontrado.');
}

function MENU_ATUALIZAR_ESTATISTICAS() {
  if (typeof ATUALIZAR_ESTATISTICAS === 'function') {
    ATUALIZAR_ESTATISTICAS();
  } else {
    const err = "❌ Módulo Performance_Manager não encontrado.";
    console.error(err);
    try {
      SpreadsheetApp.getUi().alert(err);
    } catch(e) {
      console.warn("⚠️ Ambiente sem UI: Módulo Performance não encontrado.");
    }
  }
}

function MENU_SYNC_PORTFOLIO() {
  if (typeof PortfolioUnified !== 'undefined' && typeof PortfolioUnified.syncPortfolio === 'function') {
    PortfolioUnified.syncPortfolio();
  } else {
    SpreadsheetApp.getUi().alert(
      '⚠️ Erro',
      'Módulo 30_Portfolio_Unified não carregado. Verifique os arquivos do projeto.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

function MENU_TELEGRAM() { 
  if (typeof EXECUTAR_NOTIFICACAO_DIARIA === 'function') {
    EXECUTAR_NOTIFICACAO_DIARIA();
    SpreadsheetApp.getUi().alert("📨 Relatório Diário disparado!");
  } else {
    SpreadsheetApp.getUi().alert("❌ Módulo Notification_Manager não encontrado.");
  }
}

function MENU_TESTAR_ALERTA_RISCO() {
  if (typeof NotificationService !== 'undefined' && typeof NotificationService.enviarAlertaRisco === 'function') {
    NotificationService.enviarAlertaRisco("🔔 *TESTE DE SISTEMA B3-V10*\nSua conexão com o alerta de Risco e Trailing Stop está a funcionar perfeitamente!");
    SpreadsheetApp.getUi().alert("✅ Alerta de teste enviado para o seu Telegram!");
  } else {
    SpreadsheetApp.getUi().alert("❌ Função enviarAlertaRisco não encontrada no NotificationService.");
  }
}

function MENU_DARF() { 
  if (typeof MENU_FISCAL_RECALCULAR_TUDO === 'function') MENU_FISCAL_RECALCULAR_TUDO();
  else SpreadsheetApp.getUi().alert("❌ Módulo DARF não encontrado ou em implementação.");
}

function MENU_COMPLIANCE() { 
  if (typeof COMPLIANCE_CHECK === 'function') COMPLIANCE_CHECK(); 
  else SpreadsheetApp.getUi().alert("⚙️ Módulo Compliance requer configuração.");
}

function TESTAR_LEITURA_DO_COFRE() {
  if (typeof SecureKeyService !== 'undefined') {
    const res = SecureKeyService.testarLeitura();
    if (res) SpreadsheetApp.getUi().alert(res);
  } else {
    SpreadsheetApp.getUi().alert("❌ Módulo SecureKeyService não encontrado.");
  }
}

function MENU_DEBUG_SAUDE() {
  if (typeof DebugTools !== 'undefined') SpreadsheetApp.getUi().alert(DebugTools.verificarSaude());
  else if (typeof verificarSaudeSistema === 'function') verificarSaudeSistema(); 
  else SpreadsheetApp.getUi().alert("❌ Ferramentas de Saúde não encontradas.");
}

function MENU_DEBUG_PETR4() { // 🔧 UI segura (funciona em gatilho/editor sem interação)
  if (typeof DebugTools !== 'undefined' && typeof DebugTools.debugarAtivo === 'function') {
    const relatorio = DebugTools.debugarAtivo('PETR4');
    b3UiAlert('Debug PETR4', relatorio || "✅ Debug PETR4 executado (verifique o log).");
  }
  else if (typeof debugarAtivo === 'function') {
    debugarAtivo('PETR4');
    b3UiAlert('Debug PETR4', "🔍 Debug executado no console.");
  }
  else {
    b3UiAlert('Debug PETR4', "❌ Módulo Debug não encontrado.");
  }
}

function MENU_LIMPAR_CACHE() {
  if (typeof Cache !== 'undefined' && typeof Cache.clearByType === 'function') {
    Cache.clearByType('all');
    b3UiAlert('Cache', '✅ Cache Limpo!');
  } else if (typeof LIMPAR_CACHE_COMPLETO === 'function') {
    LIMPAR_CACHE_COMPLETO();
    b3UiAlert('Cache', '✅ Cache Limpo!');
  } else {
    b3UiAlert('Cache', '❌ Módulo Cache não encontrado.');
  }
}

/**
 * Wrapper para a Previsão do Agente (Módulo 36)
 */
function MENU_AGENT_ANALYST() { // 🔧 UI segura (evita "Cannot call getUi() from this context" em background)
  if (typeof AgentAnalyst === 'undefined') {
    b3UiAlert('Analista IA', '⚠️ Módulo 36_Agent_Analyst não encontrado.');
    return;
  }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Resumo_Trades_Aprovados");
    const ticker = sheet ? sheet.getRange("C7").getValue() : null;

    if (!ticker) {
      b3UiAlert('Analista IA', "🔭 Ranking vazio ou aba 'Resumo_Trades_Aprovados' não encontrada.");
      return;
    }

    const mockData = {
      score: 80,
      setupType: "MOMENTUM",
      price: 0,
      indicators: { rsi: 65, volume: "Acima da Média", atr: 0.5 },
      macro: "Neutro", news: "N/A", memory: "N/A"
    };

    const analise = AgentAnalyst.analyze(ticker, mockData);

    const decisao = analise?.decision || "INDETERMINADA";
    const scoreIA = analise?.ai_score || "N/A";
    const modo    = analise?.entry_strategy?.mode || "N/A";
    const razao   = analise?.entry_strategy?.reason || "Sem detalhes.";
    const resumo  = analise?.rationale || "A IA não retornou uma justificativa clara.";

    const msg = `🔮 INSIGHT DO HEAD TRADER: ${ticker}\n\n` +
                `Decisão: ${decisao}\n` +
                `Score IA: ${scoreIA}\n` +
                `Estratégia: ${modo}\n` +
                `Gatilho: ${razao}\n\n` +
                `Justificativa: ${resumo}`;

    b3UiAlert('🧠 ANALISTA DE MOMENTUM', msg);

  } catch (e) {
    b3UiAlert('Analista IA', '❌ Erro no Processamento: ' + e.message);
  }
}
