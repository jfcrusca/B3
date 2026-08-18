/*28_ativarEnforcement.gs*/
// Ativar enforcement quando estiver pronto

function ativarEnforcementProducao() {
  console.log('🔒 ATIVANDO ENFORCEMENT PARA PRODUÇÃO');

  // Método 1: Ativar via código
  CONFIG.enforceSecretManagement(true); // CORRIGIDO: Era Config, agora é CONFIG
  console.log('✅ Enforcement ativado via código');

  // Método 2: Ativar via configuração
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ENFORCE_SECRET_MANAGEMENT_OVERRIDE', 'true');
  CONFIG.reload(); // CORRIGIDO: Era Config, agora é CONFIG
  console.log('✅ Enforcement ativado via configuração');
}



function executarAnaliseReal() {
  console.log('🤖 EXECUTANDO ANÁLISE IA REAL');
  
  const ticker = 'PETR4';
  const dadosTecnicos = {
    price: 34.85,
    setupType: 'Momentum Positivo',
    volumeRelative: 1.8,
    indicators: {
      rsi: 65,
      sma20: 33.50,
      sma50: 32.80
    },
    comments: 'Rompeu resistência em 34.50 com volume acima da média'
  };
  
  const resultado = AIApiUtils.analyzeOpportunity(ticker, dadosTecnicos);
  console.log(`Análise ${ticker}: ${resultado}`);
  
  return resultado;
}



// Configurar ambiente de produção
function configurarProducao() {
  console.log('⚙️ CONFIGURANDO AMBIENTE DE PRODUÇÃO');
  
  // 1. Verificar todas as secrets necessárias
  const secretsRequeridas = [
    'GEMINI_API_KEY',
    'DEEPSEEK_API_KEY', 
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID'
  ];
  
  secretsRequeridas.forEach(secret => {
    const possui = CONFIG.hasSecret(secret);
    console.log(`${secret}: ${possui ? '✅ Configurada' : '❌ FALTANDO'}`);
  });
  
  // 2. Configurar parâmetros de produção
  const props = PropertiesService.getScriptProperties();
  
  // Otimizar para produção
  props.setProperty('LOG_LEVEL_OVERRIDE', 'INFO'); // Reduzir logs em produção
  props.setProperty('DEBUG_MODE_OVERRIDE', 'false');
  props.setProperty('MAX_TICKERS_PER_BATCH_OVERRIDE', '15'); // Mais conservador
  
  // 3. Recarregar configurações
  CONFIG.reload();
  
  console.log('✅ Ambiente de produção configurado');
}



function planoEmergenciaEnforcement() {
  console.log('🚨 PLANO DE EMERGÊNCIA - ENFORCEMENT');
  
  // Opção 1: Desativar enforcement imediatamente
  if (typeof _restaurarPropertiesService === 'function') {
    _restaurarPropertiesService();
    console.log('✅ Enforcement desativado via função de emergência');
  }
  
  // Opção 2: Via propriedade de script
  PropertiesService.getScriptProperties().setProperty('ENFORCE_SECRET_MANAGEMENT_OVERRIDE', 'false');
  
  // Opção 3: Recarregar a página do Apps Script
  console.log('🔄 Recarregue a página do Apps Script para restaurar PropertiesService original');
  
  // Opção 4: Reverter código manualmente
  console.log('📝 REVERSÃO MANUAL:');
  console.log('1. Abra 01_Core_CONFIG.gs');
  console.log('2. Comente ou remova a linha: enforceSecretManagement(true);');
  console.log('3. Salve e execute novamente');
}
