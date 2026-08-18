/**
 * =============================================================================
 * 32_Automacao_Setup.gs — O MAESTRO DA AUTOMAÇÃO B3-v10
 * =============================================================================
 */

const AutomacaoSetup = (function() {
  
  // O NOME DA FUNÇÃO QUE DEVE SER DISPARADA (Sincronizado com o Orquestrador)
  const FUNCAO_ALVO = "executarRoboB3";

  return {
    instalar: function() {
      console.log("🚀 Iniciando instalação da Automação de Elite...");
      this.desinstalar(); // Limpa tudo antes de começar

      try {
        // 1. VARREDURA DE ABERTURA (10:30)
        ScriptApp.newTrigger(FUNCAO_ALVO)
          .timeBased().atHour(10).nearMinute(30).everyDays(1).inTimezone("GMT-3").create();

        // 2. VARREDURA DE FECHAMENTO (17:15) - A mais importante para Swing Trade
        ScriptApp.newTrigger(FUNCAO_ALVO)
          .timeBased().atHour(17).nearMinute(15).everyDays(1).inTimezone("GMT-3").create();

        // 3. ATUALIZAÇÃO DO RESUMO (09:45) - Consolida os trades para o dia
        if (typeof gerarResumoTradesAprovados === 'function') {
          ScriptApp.newTrigger("gerarResumoTradesAprovados")
            .timeBased().atHour(9).nearMinute(45).everyDays(1).inTimezone("GMT-3").create();
        }

        // 3.1 ATUALIZAÇÃO DO DASHBOARD (De hora em hora)
        ScriptApp.newTrigger("ATUALIZAR_DASHBOARD")
          .timeBased().everyHours(1).create();

        // 4. MANUTENÇÃO (01:00 AM) - Reseta checkpoints e limpa cache
        ScriptApp.newTrigger("realizarManutencaoMadrugada")
          .timeBased().atHour(1).everyDays(1).inTimezone("GMT-3").create();

        console.log("✅ Cronograma B3-v10 instalado com sucesso!");
        return true;
      } catch (e) {
        console.error("❌ Falha ao instalar gatilhos: " + e.message);
        return false;
            }
        // Adicione isto no AutomacaoSetup.instalar()
      ScriptApp.newTrigger("enviarStatusSaudeSemanal")
        .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).nearMinute(30).create();


    },

    desinstalar: function() {
      const triggers = ScriptApp.getProjectTriggers();
      triggers.forEach(t => ScriptApp.deleteTrigger(t));
      console.log("🧹 Todos os gatilhos foram removidos.");
    }
  };
})();

// Funções de ponte para o Menu
function instalarAutomacao() { AutomacaoSetup.instalar(); SpreadsheetApp.getUi().alert("🚀 Robô em modo AUTOMÁTICO!"); }
function desinstalarAutomacao() { AutomacaoSetup.desinstalar(); SpreadsheetApp.getUi().alert("🛑 Robô em modo MANUAL."); }
