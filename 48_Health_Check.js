/**
 * =============================================================================
 * 48_Health_Check.gs — MONITOR DE INTEGRIDADE (v10)
 * =============================================================================
 */

function enviarStatusSaudeSemanal() {
  try {
    let count = 0;
    try {
      const triggers = ScriptApp.getProjectTriggers();
      count = triggers.length;
    } catch (permErr) {
      console.warn("⚠️ Permissão insuficiente para ler gatilhos (script.scriptapp).");
      count = "Sem Acesso";
    }

    const props = PropertiesService.getScriptProperties();
    const lastTicker = props.getProperty('B3_V10_LAST_INDEX') || "Início";
    
    // Verifica se as APIs essenciais estão configuradas
    const hasGemini = !!props.getProperty('GEMINI_API_KEY');
    const hasTelegram = !!props.getProperty('TELEGRAM_BOT_TOKEN');

    // Constrói a mensagem de status
    let msg = `🛡️ *RELATÓRIO DE SAÚDE B3-v10*\n\n`;
    msg += `✅ *Status:* ONLINE\n`;
    msg += `⏰ *Gatilhos Ativos:* ${count}\n`;
    msg += `🔍 *Último Checkpoint:* ${lastTicker}\n`;
    msg += `🔑 *Cofre API:* ${hasGemini ? "OK" : "❌ ERRO"}\n`;
    msg += `🤖 *Notificações:* ${hasTelegram ? "OK" : "⚠️ OFFLINE"}\n`;
    msg += `📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    msg += `_A sentinela está de pé e pronta para o pregão._`;

    // Tenta usar o serviço de notificação unificado
    const Bot = (typeof NotificationService !== 'undefined' && typeof NotificationService.enviarAlertaRisco === 'function') 
                ? { enviarMensagem: NotificationService.enviarAlertaRisco } 
                : null;

    if (Bot && typeof Bot.enviarMensagem === 'function') {
      Bot.enviarMensagem(msg);
      console.log("✅ Status de saúde enviado para o Telegram.");
    } else {
      console.warn("⚠️ Nenhum serviço de Telegram configurado para o Health Check.");
    }
  } catch (e) {
    console.error("❌ Erro no Health Check: " + e.message);
  }
}