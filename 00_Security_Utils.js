/**
 * 00_Security_Utils.js — Utilitários de segurança compartilhados
 */

var SECRET_KEY_NAMES = [
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'DEEPSEEK_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_TOKEN',
  'TELEGRAM_CHAT_ID',
  'BRAPI_TOKEN',
  'ALPHA_VANTAGE_API_KEY',
  'COPILOT_WEBHOOK_URL',
  'RAPIDAPI_KEY',
  'GCP_PROJECT_ID',
  'FINNHUB_API_KEY',
  'FINNHUB_KEY'
];

function isSecretKeyName(key) {
  return SECRET_KEY_NAMES.indexOf(String(key)) !== -1;
}

function isDebugModeEnabled() {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty('DEBUG_MODE_OVERRIDE') === 'true') return true;
    if (props.getProperty('DEBUG_MODE') === 'true') return true;
  } catch (e) {}
  return false;
}

function isSecretEnforcementActive() {
  try {
    return PropertiesService.getScriptProperties().getProperty('ENFORCE_SECRET_MANAGEMENT_OVERRIDE') === 'true';
  } catch (e) {
    return false;
  }
}

function assertWebAppAuthorized() {
  var activeEmail = '';
  try {
    activeEmail = Session.getActiveUser().getEmail();
  } catch (e) {
    throw new Error('Acesso negado: usuário não autenticado.');
  }

  if (!activeEmail) {
    throw new Error('Acesso negado: sessão inválida.');
  }

  var ownerEmail = '';
  try {
    ownerEmail = Session.getEffectiveUser().getEmail();
  } catch (e) {}

  if (ownerEmail && activeEmail !== ownerEmail) {
    throw new Error('Acesso negado: apenas o proprietário pode executar esta ação.');
  }

  return activeEmail;
}
