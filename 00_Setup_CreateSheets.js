/**
 * 00_Setup_CreateSheets.gs — KIT DE RESGATE (V4 - Completo)
 * =============================================================================
 * Recria a estrutura de TODAS as abas, incluindo as que sumiram.
 * NÃO apaga dados se eles já existirem (Modo Seguro Ativado).
 */

var Bootstrap = (function () {
  'use strict';

  // ========== UTILITÁRIOS ==========
  function ensureSheet(ss, name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    return sh;
  }

  function styleHeader(range) {
    range.setFontWeight('bold')
         .setBackground('#0c343d') // Azul Profundo (Padrão B3 PRO)
         .setFontColor('white')
         .setHorizontalAlignment('center')
         .setVerticalAlignment('middle')
         .setWrap(true);
  }

  function setHeaders(sh, headers, opts) {
    const options = Object.assign({ forceReset: false, freeze: 1 }, opts || {});

    // Se a aba estiver vazia ou forçada, recria
    if (sh.getLastRow() < 1 || options.forceReset) {
      sh.clear(); // Limpa tudo para garantir
      if (headers.length > 0) {
        const range = sh.getRange(1, 1, 1, headers.length);
        range.setValues([headers]);
        styleHeader(range);
      }
      if (options.freeze) sh.setFrozenRows(options.freeze);
    }
  }

  // ========== SETUP DAS ABAS PERDIDAS ==========

  function setupResumoTrades(ss, opts) {
    const sh = ensureSheet(ss, 'Resumo_Trades_Aprovados');
    const headers = [
      "Data", "Ticker", "Setup", "Preço Entrada", "Stop Loss", "Alvo", 
      "Risco %", "Score", "Status", "Resultado Final"
    ];
    setHeaders(sh, headers, opts);
    sh.getRange("A:A").setNumberFormat("dd/MM/yyyy");
    sh.getRange("D:F").setNumberFormat("R$ #,##0.00");
    return sh;
  }

  function setupRelatorioRebal(ss, opts) {
    const sh = ensureSheet(ss, 'Relatorio_Rebalanceamento');
    const headers = [
      "Data", "Ação", "Operação", "Quantidade", "Preço Médio", 
      "Valor Total", "Motivo", "Saldo Novo"
    ];
    setHeaders(sh, headers, opts);
    sh.getRange("A:A").setNumberFormat("dd/MM/yyyy HH:mm");
    sh.getRange("E:F").setNumberFormat("R$ #,##0.00");
    return sh;
  }

  function setupLogPerformance(ss, opts) {
    const sh = ensureSheet(ss, 'Log_Performance');
    const headers = [
      "Data", "Ticker", "Setor", "Setup", "Preço Entrada", 
      "Stop Loss", "Alvo", "Score", "Status", "Resultado %"
    ];
    setHeaders(sh, headers, opts);
    sh.getRange("A:A").setNumberFormat("dd/MM/yyyy");
    sh.getRange("E:G").setNumberFormat("R$ #,##0.00");
    sh.getRange("J:J").setNumberFormat("0.00%");
    return sh;
  }

  function setupCarteira(ss, opts) {
    const sh = ensureSheet(ss, 'Carteira');
    const headers = [
      'Tipo','Papel','Qtd','Valor Líquido','1ª Compra','Última Compra',
      'Preço Médio','Cotação Atual','Lucro/Prejuízo','Proventos',
      'Lucro/Prejuízo %','Participação %','Status','Ação Sugerida','Atualização'
    ];
    setHeaders(sh, headers, opts);
    sh.getRange("D:D").setNumberFormat("R$ #,##0.00");
    sh.getRange("G:J").setNumberFormat("R$ #,##0.00");
    sh.getRange("K:L").setNumberFormat("0.00%");
    return sh;
  }

  function setupConfiguracoes(ss, opts) {
    const sh = ensureSheet(ss, 'Configurações');
    const headers = ['Parâmetro (Chave)', 'Valor Atual', 'Descrição / Nota'];
    setHeaders(sh, headers, opts);
    // Reconstrói configs padrão se estiver vazio
    if (sh.getLastRow() < 2) {
      const defaults = [
        ["CAPITAL_TOTAL", "50000", "Capital disponível para o robô"],
        ["RISCO_POR_TRADE", "0.02", "2% do capital por operação"],
        ["MAX_POSICOES", "5", "Máximo de ativos simultâneos"],
        ["STOP_GLOBAL_DIA", "-2000", "Perda máxima diária (R$)"],
        ["FINNHUB_API_KEY", "", "Chave Finnhub (opcional). Deixe vazio para usar Google News/Brapi/Yahoo. Chaves expostas em código público são revogadas (HTTP 403)."],
        ["FINNHUB_KEY", "", "Chave Finnhub alternativa (aceita ambos os nomes)."]
      ];
      sh.getRange(2, 1, defaults.length, 3).setValues(defaults);
    }
    return sh;
  }

  function setupDashboard(ss, opts) {
    const sh = ensureSheet(ss, 'Dashboard');
    // Se estiver vazio ou reset forçado, recria o layout
    if (sh.getLastRow() < 2 || (opts && opts.forceReset)) {
      sh.clear();

      // Título
      sh.getRange("B2").setValue("🚀 B3 PRO V10 - DASHBOARD DE COMANDO")
        .setFontSize(18).setFontWeight("bold").setFontColor("#0c343d");

      // Cards de Resumo (Placeholders)
      const cards = [
        ["PATRIMÔNIO", "R$ 0,00"],
        ["LUCRO MÊS", "R$ 0,00"],
        ["POSIÇÕES ABERTAS", "0"],
        ["WIN RATE", "0%"]
      ];

      sh.getRange("B4:E4").setValues([cards.map(c => c[0])])
        .setBackground("#efefef").setFontWeight("bold").setHorizontalAlignment("center");
      sh.getRange("B5:E5").setValues([cards.map(c => c[1])])
        .setFontSize(14).setHorizontalAlignment("center").setBorder(true, true, true, true, true, true);

      // Área de Gráficos (Placeholder)
      sh.getRange("B7").setValue("📊 Performance Recente").setFontWeight("bold");
      sh.getRange("B8:E15").setBackground("#f9f9f9").setBorder(true, true, true, true, true, true)
        .merge().setValue("(Gráfico será gerado aqui automaticamente)");

      sh.setHiddenGridlines(true);
    }
    return sh;
  }

  // ... (Mantém as outras funções padrão: Tickers, Resultados, etc.) ...
  function setupResultadosAnalise(ss, opts) {
    const sh = ensureSheet(ss, 'Resultados_Analise');
    const headers = [
      "Data", "Ticker", "Preço", "Score", "Setup", "Motivo", "Stop Loss", 
      "Alvo 1", "Alvo 2", "R/R", "Risco %", "RSI", "EMA21", "EMA50", 
      "EMA200", "ATR", "Volume", "Pivot", "Fibonacci", "Análise IA", 
      "Ranking", "Tipo Setup", "Alerta Segurança"
    ];
    setHeaders(sh, headers, opts);
    return sh;
  }

  function setupOportunidades(ss, opts) {
    const sh = ensureSheet(ss, 'Oportunidades');
    const headers = [
      'Data', 'Ticker', 'Preço Atual', 'Entrada Sugerida', 'Stop Loss',
      'Alvo 1', 'Alvo 2', 'R/R', 'Risco %', 'Recomendação',
      'Score', 'Setup', 'Tipo Setup', 'Análise Técnica', 'Análise IA', 'Observações'
    ];
    setHeaders(sh, headers, opts);
    return sh;
  }

  function setupLogs(ss, opts) {
    const sh = ensureSheet(ss, 'Logs');
    const headers = ['Data/Hora','Nível','Origem','Mensagem'];
    setHeaders(sh, headers, opts);
    return sh;
  }

  function setupSimulation(ss, opts) {
    const sh = ensureSheet(ss, 'Simulacao_Ativa');
    const headers = ["Data Entrada", "Ticker", "Preço Entrada", "Stop Loss", "Alvo", "Setup", "Score"];
    setHeaders(sh, headers, opts);
    return sh;
  }

  function setupSimulationLog(ss, opts) {
    const sh = ensureSheet(ss, 'Log_Simulado');
    const headers = ["Data Entrada", "Ticker", "Preço Entrada", "Data Saída", "Preço Saída", "Resultado %", "Status", "Setup"];
    setHeaders(sh, headers, opts);
    return sh;
  }

  // ========== ENTRYPOINT ==========

  function createSheets(options) {
    const opts = options || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Recria todas as abas
    setupDashboard(ss, opts);
    setupCarteira(ss, opts);
    setupConfiguracoes(ss, opts);
    setupLogPerformance(ss, opts);
    setupResumoTrades(ss, opts);      // <--- Recuperada
    setupRelatorioRebal(ss, opts);    // <--- Recuperada
    setupResultadosAnalise(ss, opts);
    setupOportunidades(ss, opts);
    setupLogs(ss, opts);
    setupSimulation(ss, opts);
    setupSimulationLog(ss, opts);

    // Abas auxiliares
    ensureSheet(ss, 'Tickers');
    ensureSheet(ss, 'Portfolio');
    ensureSheet(ss, 'IRPF_Resumo_Anual');
    ensureSheet(ss, 'DARF_Mensal');

    SpreadsheetApp.flush();
  }

  return {
    createSheets: createSheets,
    // Atalho para recriar APENAS o que está vazio (Seguro)
    rescue: function() { createSheets({ forceReset: false }); }
  };
})();


// ==========================================
// FUNÇÕES GATILHO PARA APARECER NO MENU
// ==========================================

function RODAR_SETUP_COMPLETO() {
  // Isso força a recriação das abas vazias ou com erro
  Bootstrap.createSheets({ forceReset: true });
  SpreadsheetApp.getActiveSpreadsheet().toast("Setup executado com sucesso!", "B3 PRO");
}

function RECUPERAR_ABAS_PERDIDAS() {
  // Modo seguro: recria apenas o que sumiu, sem apagar dados
  Bootstrap.rescue();
  SpreadsheetApp.getActiveSpreadsheet().toast("Abas recuperadas!", "B3 PRO");
}
