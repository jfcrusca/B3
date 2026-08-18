
// =============================================================================
// 00_Tools.gs — Utilitários e Diagnóstico Completo
// =============================================================================
const Tools = (function(){
  'use strict';

  function clearLogs(){
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName('Logs');
    if (!sh) return;
    const last = sh.getLastRow();
    if (last > 1) {
      try { sh.deleteRows(2, last-1); } catch(_){
        // Se deleteRows não puder (ex.: poucas linhas), usa clearContent:
        sh.getRange(2,1,last-1,sh.getLastColumn()).clearContent();
      }
    }
    Logger.info('🧹 Logs limpos.');
  }

  function runDiagnostics(){
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.info('──────────────────────────────────────────────────────────────');
    Logger.info('🧪 DIAGNÓSTICO COMPLETO');
    Logger.info('──────────────────────────────────────────────────────────────');

    // Planilha
    Logger.info(`Planilha: ${ss ? ss.getName() : '(não vinculada)'} | ID: ${ss ? ss.getId() : '(n/a)'}`);

    // Tickers
    const tickers = (typeof SheetManager !== 'undefined') ? SheetManager.getTickers() : [];
    Logger.info(`Tickers (${tickers.length}): ${tickers.join(', ') || '(vazio)'}`);

    // ✅ ATUALIZADO: Configurações de Mercado (Buscando da Aba ou Defaults)
    Logger.info(`Config: PERIOD=${CONFIG.get('DEFAULT_PERIOD') || 'D1'} | INTERVAL=${CONFIG.get('DEFAULT_INTERVAL') || '1d'} | MIN_CANDLES=${CONFIG.get('MIN_CANDLES_FOR_ANALYSIS') || 100}`);

    // ✅ CORREÇÃO: Verificação de "Saúde" das Propriedades Críticas
    // Acessamos o serviço nativo para verificar se as chaves existem no Google
    const scriptProps = PropertiesService.getScriptProperties().getProperties();
    const chavesCriticas = [
      'GEMINI_API_KEY',
      'GEMINI_SELECTED_MODEL',
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_CHAT_ID',
      'CLOUD_PROJECT_ID'
    ];

    chavesCriticas.forEach(k => {
      // Verificamos se o valor existe e não é um placeholder (como 'YOUR_KEY')
      const valor = scriptProps[k];
      const status = (valor && valor.length > 5 && !valor.includes('YOUR_')) ? '✅ OK' : '❌ FALTA';
      Logger.info(`Propriedade ${k}: ${status}`);
    });
    
    // Verifica se a aba Configurações está sincronizada no Cache
    const cacheStatus = CacheService.getScriptCache().get("B3_V10_UNIFIED_SETTINGS") ? 'Ativo' : 'Vazio (Necessita Refresh)';
    Logger.info(`Status do Cache de Configurações: ${cacheStatus}`);

    // Teste Yahoo IBOV
    try {
      const c = YahooFetcher.getHistory('IBOV','1d','3mo');
      Logger.info(`Yahoo IBOV candles: ${c ? c.length : 0}`);
    } catch(e) {
      Logger.error(`Teste Yahoo falhou: ${e.message}`);
    }

    // Atualiza Dashboard para confirmar escrita
    try {
      DashboardUI.updateMarketOverview();
      Logger.info('Dashboard atualizado.');
    } catch(e){
      Logger.error(`Erro ao atualizar Dashboard: ${e.message}`);
    }

    Logger.flush();
  }

  return { clearLogs, runDiagnostics };
})();
``


// Em 00_Tools.gs ou novo arquivo
// function monitorarRateLimits() {
//   console.log('📊 MONITORAMENTO DE RATE LIMITERS');
//   console.log('='.repeat(50));
//   
//   const stats = RateLimiter.getAllStats();
//   
//   Object.values(stats).forEach(s => {
//     console.log(`[${s.name}]`);
//     console.log(`  Tokens: ${s.tokensAvailable}/${s.max}`);
//     console.log(`  Próximo token em: ${Math.ceil(s.timeToNextToken)}ms`);
//     console.log(`  Requests (30s): ${s.requestsLast30s || 0} (${s.requestsPerSecond?.toFixed(1) || 0}/s)`);
//     
//     // Alertas
//     if (s.tokensAvailable === 0) {
//       console.log(`  ⚠️  SEM TOKENS! Aguarde ${Math.ceil(s.timeToNextToken)}ms`);
//     }
//     if (s.requestsPerSecond > (s.max / (s.window / 1000)) * 0.8) {
//       console.log(`  ⚠️  ALTA FREQUÊNCIA: ${s.requestsPerSecond.toFixed(1)} req/s`);
//     }
//   });
// }


// ===== FUNÇÃO DIAGNÓSTICO COMPLETO =====
function diagnosticoCompleto() {
  console.log('🔍 INICIANDO DIAGNÓSTICO COMPLETO DO SISTEMA');
  console.log('='.repeat(60));
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. VERIFICAÇÃO DE PLANILHA
    console.log('\n📋 VERIFICAÇÃO DE PLANILHA:');
    console.log(`Nome: ${ss.getName()}`);
    console.log(`ID: ${ss.getId()}`);
    console.log(`URL: ${ss.getUrl()}`);
    
    // 2. VERIFICAÇÃO DE ABAS
    console.log('\n📊 VERIFICAÇÃO DE ABAS:');
    const sheets = ss.getSheets();
    const requiredSheets = ['Tickers', 'Dashboard', 'Resultados_Analise', 'Oportunidades', 'Carteira', 'Portfolio'];
    
    sheets.forEach(sh => {
      const nome = sh.getName();
      const rows = sh.getLastRow();
      const cols = sh.getLastColumn();
      console.log(`  ${nome}: ${rows} linhas × ${cols} colunas ${requiredSheets.includes(nome) ? '✅' : '📝'}`);
    });
    
  //  3. VERIFICAÇÃO DE CONFIGURAÇÕES (Unificadas B3-v10)
  console.log('\n⚙️ VERIFICAÇÃO DE CONFIGURAÇÕES:');
  try {
    if (typeof CONFIG !== 'undefined') {
      console.log('  CONFIG: ✅ Módulo Unificado Detectado');
      
      // Busca os valores reais que o robô está usando agora
      const periodo = CONFIG.get('DEFAULT_PERIOD') || 'Diário (Padrão)';
      const intervalo = CONFIG.get('DEFAULT_INTERVAL') || '1d (Padrão)';
      const scoreIA = CONFIG.get('IA_SCORE_MINIMO') || 'Não definido';
      
      console.log(`  PERÍODO: ${periodo}`);
      console.log(`  INTERVALO: ${intervalo}`);
      console.log(`  SCORE MÍNIMO IA: ${scoreIA}`);
      
      // Verifica se os dados estão vindo da planilha ou do código
      const isCacheActive = CacheService.getScriptCache().get("B3_V10_UNIFIED_SETTINGS") !== null;
      console.log(`  ORIGEM DOS DADOS: ${isCacheActive ? 'Aba Planilha (Cache)' : 'Propriedades/Defaults'}`);

    } else {
      console.log('  CONFIG: ❌ Erro Crítico: Módulo CONFIG não encontrado no projeto!');
    }
  } catch (e) {
    console.log(`  CONFIG: ⚠️ Erro ao processar diagnóstico: ${e.message}`);
  }
    
    // 4. VERIFICAÇÃO DE TICKERS
    console.log('\n📈 VERIFICAÇÃO DE TICKERS:');
    try {
      if (typeof SheetManager !== 'undefined') {
        const tickers = SheetManager.getTickers();
        console.log(`  Total: ${tickers.length} tickers`);
        console.log(`  Amostra: ${tickers.slice(0, 5).join(', ')}${tickers.length > 5 ? '...' : ''}`);
      } else {
        console.log('  SheetManager: ❌ Não carregado');
      }
    } catch (e) {
      console.log(`  Tickers: ⚠️ Erro: ${e.message}`);
    }
    
    // 5. VERIFICAÇÃO DE CACHE
    console.log('\n💾 VERIFICAÇÃO DE CACHE:');
    try {
      if (typeof Cache !== 'undefined') {
        const stats = Cache.getStats();
        console.log(`  Status: ${stats.status}`);
        if (stats.stats) {
          console.log(`  Itens: ${stats.stats.total}`);
          console.log(`  Tamanho: ${Math.round(stats.stats.totalSize / 1024)}KB`);
        }
      } else {
        console.log('  Cache: ❌ Não carregado');
      }
    } catch (e) {
      console.log(`  Cache: ⚠️ Erro: ${e.message}`);
    }
    
    // 6. VERIFICAÇÃO DE MÓDULOS CRÍTICOS
    console.log('\n🧩 VERIFICAÇÃO DE MÓDULOS:');
    const modulosCriticos = [
      'YahooFetcher', 'TechnicalIndicators', 'TechnicalStrategy', 
      'EntryGenerator', 'AIApiUtils', 'DashboardUI', 'SheetWriter'
    ];
    
    modulosCriticos.forEach(mod => {
      const existe = typeof globalThis[mod] !== 'undefined';
      console.log(`  ${mod}: ${existe ? '✅' : '❌'} ${existe ? 'OK' : 'FALTANDO'}`);
    });
    
    // 7. TESTE DE YAHOO FINANCE
    console.log('\n🌐 TESTE DE CONEXÃO YAHOO:');
    try {
      if (typeof YahooFetcher !== 'undefined') {
        const teste = YahooFetcher.getHistory('IBOV', '1d', '5d');
        console.log(`  IBOV: ${teste ? `✅ ${teste.length} candles` : '❌ Falha'}`);
      } else {
        console.log('  YahooFetcher: ❌ Não disponível');
      }
    } catch (e) {
      console.log(`  Yahoo: ⚠️ Erro: ${e.message}`);
    }
    
    // 8. VERIFICAÇÃO DE PROPRIEDADES (SEM VALORES SENSITIVOS)
    console.log('\n🔑 VERIFICAÇÃO DE CREDENCIAIS (Status):');
    const props = PropertiesService.getScriptProperties().getProperties();
    const credenciais = ['GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
    
    credenciais.forEach(key => {
      const temValor = props[key] && props[key].trim() !== '' && !props[key].includes('YOUR_');
      console.log(`  ${key}: ${temValor ? '✅ Configurada' : '❌ Não configurada'}`);
    });
    
    // 9. RESUMO DO SISTEMA
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DO DIAGNÓSTICO');
    console.log('='.repeat(60));
    
    const now = new Date();
    console.log(`Data/Hora: ${now.toLocaleString('pt-BR')}`);
    console.log(`Timezone: ${Session.getScriptTimeZone()}`);
    console.log(`Usuário: ${Session.getActiveUser().getEmail()}`);
    
    // 10. RECOMENDAÇÕES
    console.log('\n💡 RECOMENDAÇÕES:');
    
    if (!props['GEMINI_API_KEY'] || props['GEMINI_API_KEY'].includes('YOUR_')) {
      console.log('  • Configure a chave da API Gemini em Propriedades do Script');
    }
    
    const tickers = SheetManager?.getTickers?.() || [];
    if (tickers.length === 0) {
      console.log('  • Adicione tickers na aba "Tickers" (coluna G)');
    }
    
    const sheetsMap = sheets.map(sh => sh.getName());
    if (!sheetsMap.includes('Resultados_Analise')) {
      console.log('  • Execute "Bootstrap.createSheets()" para criar todas as abas');
    }
    
    console.log('\n✅ DIAGNÓSTICO COMPLETO FINALIZADO');
    
    // Retorna para UI
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'Diagnóstico Completo',
      `Diagnóstico executado com sucesso!\n\nVerifique o console (Ctrl+Enter) para detalhes.`,
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    console.error(`❌ ERRO NO DIAGNÓSTICO: ${error.message}`);
    console.error(error.stack);
    
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'Erro no Diagnóstico',
      `Ocorreu um erro:\n\n${error.message}`,
      ui.ButtonSet.OK
    );
  }
}
