/**
 * =============================================================================
 * 47_Automacao_Triggers.gs — GESTÃO AGÊNTICA DE GATILHOS (v12.0)
 * =============================================================================
 * ✅ INTEGRADO: Agora o gatilho principal respeita o Filtro Macro e MTF.
 * ✅ PERFORMANCE: Adicionada verificação de Trailing Stop automática.
 * ✅ SEGURANÇA: Limpeza noturna reforçada.
 */

var AutomacaoBot = (function() {

  const FUNCAO_SCANNER = "executarRoboB3";
  const FUNCAO_MONITOR = "MENU_ATUALIZAR_ESTATISTICAS"; // Onde vive o nosso Trailing Stop
  const FUNCAO_DASHBOARD = "ATUALIZAR_DASHBOARD";
  const FUNCAO_FISCAL = "ENVIAR_DARF_MENSAL_AUTOMATICO";
  const FUNCAO_CLEANUP = "realizarManutencaoMadrugada";
  const TIMEZONE = "GMT-3";

  return {
    /**
     * Instala o cronograma profissional de varredura e monitoramento
     */
    instalarCronograma: function() {
      this.removerTodos(); 

      console.log("📅 Configurando agendamentos B3-v10...");

      // 1. MONITOR DE TRAILING STOP (De hora em hora durante o pregão)
      // Verifica se precisa subir o stop no Profit enquanto você trabalha.
      ScriptApp.newTrigger(FUNCAO_MONITOR)
        .timeBased().everyHours(1).create();

      // 1.1 ATUALIZAÇÃO DO DASHBOARD (De hora em hora)
      ScriptApp.newTrigger(FUNCAO_DASHBOARD)
        .timeBased().everyHours(1).create();

      // 2. SCAN DE ABERTURA (10:40) - Pós-Leilão
      ScriptApp.newTrigger(FUNCAO_SCANNER)
        .timeBased().atHour(10).nearMinute(40).everyDays(1).inTimezone(TIMEZONE).create();

      // 3. SCAN DE MONITORAMENTO (14:30) - Meio do Dia
      ScriptApp.newTrigger(FUNCAO_SCANNER)
        .timeBased().atHour(14).nearMinute(30).everyDays(1).inTimezone(TIMEZONE).create();

      // 4. SCAN DE FECHAMENTO (16:40) - Antes do Leilão de Swing Trade
      ScriptApp.newTrigger(FUNCAO_SCANNER)
        .timeBased().atHour(16).nearMinute(40).everyDays(1).inTimezone(TIMEZONE).create();

      // 5. RELATÓRIO FISCAL (Diário às 08:00 - a função interna filtrará o dia útil)
      ScriptApp.newTrigger(FUNCAO_FISCAL)
        .timeBased().atHour(8).nearMinute(0).everyDays(1).inTimezone(TIMEZONE).create();

      // 6. MANUTENÇÃO NOTURNA (01:00 AM)
      ScriptApp.newTrigger(FUNCAO_CLEANUP)
        .timeBased().atHour(1).nearMinute(0).everyDays(1).inTimezone(TIMEZONE).create();

      console.log("🚀 Cronograma v12.1 instalado (Scanner + Monitor + Fiscal)!");
      return true;
    },

    removerTodos: function() {
      const triggers = ScriptApp.getProjectTriggers();
      let count = 0;
      const funcoesAlvo = [FUNCAO_SCANNER, FUNCAO_MONITOR, FUNCAO_DASHBOARD, FUNCAO_FISCAL, FUNCAO_CLEANUP];
      
      triggers.forEach(t => {
        if (funcoesAlvo.includes(t.getHandlerFunction())) {
          ScriptApp.deleteTrigger(t);
          count++;
        }
      });
      console.log(`🧹 Faxina: ${count} gatilhos removidos.`);
    }
  };
})();

/**
 * Wrappers para o Menu (Devem bater com os nomes no 00_Menu_Manager)
 */
function MENU_INSTALAR_AUTOMACAO() { 
  if (AutomacaoBot.instalarCronograma()) {
    SpreadsheetApp.getUi().alert("✅ Automação B3-v10 Ativada!\n\n" +
      "� Scanner: 10:40, 14:30, 16:40\n" + "📧 Relatório Fiscal: Diário (08:00)\n" +
      "️ Trailing Stop & Dashboard: Atualização a cada 1 hora.\n\n" +
      "O robô filtrará feriados e fins de semana automaticamente.");
  }
}

function MENU_DESATIVAR_AUTOMACAO() { 
  AutomacaoBot.removerTodos();
  SpreadsheetApp.getUi().alert("🛑 Automação Desligada.");
}

/**
 * Função de manutenção noturna
 */
function realizarManutencaoMadrugada() {
  console.log("🧹 [MANUTENÇÃO] Protocolo Deep Clean iniciado...");
  try {
  // 1. Limpa o Cache (via módulo 03 se disponível)
  if (typeof Cache !== 'undefined' && typeof Cache.clearByType === 'function') {
    Cache.clearByType('all');
  }
    
    // 2. Reseta contadores de erro e index de varredura
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('B3_V10_LAST_INDEX');
    
    // 🎮 [SIMULAÇÃO] Monitora saídas virtuais
    if (typeof SimulationManager !== 'undefined') {
      SimulationManager.monitorExits();
    }

    // 3. Sincronização de segurança (Garante que a planilha está salva)
    SpreadsheetApp.flush();
    
    console.log("✨ Sistema pronto para o novo pregão.");
  } catch (e) {
    console.error("❌ Erro manutenção: " + e.message);
  }
}