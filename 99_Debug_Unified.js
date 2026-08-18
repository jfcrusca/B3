/**
 * =============================================================================
 * 99_Debug_Unified.gs — v4.0 (LÓGICA PURA)
 * =============================================================================
 * ⚠️ ATENÇÃO: Este arquivo contém APENAS a lógica (Objeto DebugTools).
 * As funções de Menu (UI) foram REMOVIDAS daqui para não conflitarem com
 * o arquivo 01_Menu_Principal.gs.
 */

var DebugTools = {

  /**
   * Verifica Saúde do Sistema (Cache + API Externa)
   */
  verificarSaude: function() {
    let msg = "🏥 CHECK-UP DO SISTEMA:\n\n";

    // 1. Teste de Cache (Assume que 'Cache' é sua biblioteca global personalizada)
    const tStart = new Date().getTime();
    try {
      if (typeof Cache !== 'undefined') {
        // Tenta gravar e ler para garantir que o sistema de cache está respondendo
        Cache.put("TEST_HEALTH", "OK", { type: 'SYSTEM' }, 60);
        const read = Cache.get("TEST_HEALTH", { type: 'SYSTEM' });

        if (read === "OK") {
           msg += `✅ Cache Unificado: ONLINE (${new Date().getTime() - tStart}ms)\n`;
        } else {
           msg += `⚠️ Cache Unificado: Gravou mas não retornou o valor esperado.\n`;
        }
      } else {
        msg += "⚠️ Objeto 'Cache' global não encontrado (verifique se 03_Cache_Unified.gs existe).\n";
      }
    } catch(e) { 
      msg += `❌ Erro Crítico no Cache: ${e.message}\n`; 
    }

    // 2. Teste de Conectividade Externa (Yahoo Finance)
    try {
      // Adicionado User-Agent para evitar bloqueio 403 do Yahoo
      const params = {
        muteHttpExceptions: true,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36" }
      };
      // Teste leve (apenas 1 dia) para verificar conexão
      const resp = UrlFetchApp.fetch("https://query1.finance.yahoo.com/v8/finance/chart/PETR4.SA?range=1d&interval=1m", params);

      if (resp.getResponseCode() === 200) {
        msg += `✅ Yahoo Finance API: ONLINE (HTTP 200)\n`;
      } else {
        msg += `⚠️ Yahoo Finance API: Instável (HTTP ${resp.getResponseCode()})\n`;
      }
    } catch(e) { 
      msg += `❌ API Externa falhou: ${e.message}\n`; 
    }

    return msg; 
  },

  /**
   * Debuga PETR4 e retorna o relatório em texto para o Menu
   */
  debugarAtivo: function(ticker) {
    let logBuffer = [];
    // Helper para formatar hora no log
    const time = () => new Date().toLocaleTimeString('pt-BR');
    const log = (texto) => logBuffer.push(`[${time()}] ${texto}`);

    log(`🔍 INICIANDO DEBUG: ${ticker}`);

    // 1. Verifica Dependências Críticas
    if (typeof DataService === 'undefined') {
      log("❌ ERRO: Módulo 'DataService' não carregado.");
      return logBuffer.join('\n');
    }
    if (typeof STRATEGY_EVALUATE_CORE === 'undefined') {
      log("❌ ERRO: Função 'STRATEGY_EVALUATE_CORE' não encontrada.");
      return logBuffer.join('\n');
    }

    // 2. Busca Dados (Protegido por Try/Catch para não travar o script)
    try {
      log("⏳ Solicitando dados ao DataService...");
      const data = DataService.getMarketData(ticker);

      if (!data || !data.price) {
        log("❌ FALHA: DataService retornou dados vazios ou nulos.");
        return logBuffer.join('\n');
      }
      log(`✅ Dados Recebidos: Preço R$ ${data.price} | Candles: ${data.candles ? data.candles.length : 0}`);

      // 3. Executa Core Strategy
      log("⚙️ Executando Estratégia (Simulação)...");

      // Cria um contexto padrão caso o orquestrador não tenha passado
      const context = { trend: 'NEUTRAL', volatility: 'LOW' };
      const result = STRATEGY_EVALUATE_CORE(data, context);

      log("\n📊 --- RELATÓRIO TÉCNICO ---");
      if (result) {
        log(`🎯 Score Calculado: ${result.score || 0} / 100`);
        log(`📈 Setup Identificado: ${result.setup || 'Nenhum'}`);
        if (result.stopLoss) log(`🛑 Stop Loss Sugerido: R$ ${result.stopLoss}`);
        if (result.target1) log(`🏁 Alvo Principal: R$ ${result.target1}`);
        if (result.indicators) log(`📉 RSI Atual: ${result.indicators.rsi || 'N/A'}`);
      } else {
        log("⚠️ A estratégia retornou 'null' (sem sinal claro ou dados insuficientes).");
      }

    } catch (e) {
      log(`❌ ERRO FATAL DURANTE EXECUÇÃO: ${e.message}`);
      log(`Stack: ${e.stack}`);
    }

    return logBuffer.join('\n');
  }
};

// =============================================================================
// 🛑 NÃO ADICIONE FUNÇÕES "MENU_..." AQUI!
// Elas já existem no arquivo 01_Menu_Principal.gs e causariam conflito.
// =============================================================================
