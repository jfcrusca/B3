/**
 * 14_Dashboard_PainelMercado.gs — v14.1 (REFACTORED: PERFORMANCE FIX)
 * =============================================================================
 * ✅ GESTÃO: Adicionado Bloco de Saúde da Carteira (Lucro Real e Risco R$).
 * ✅ MERCADO: Mantém o Painel de Oportunidades do Scanner.
 * ✅ PERFORMANCE: Correção na escala de porcentagem (Real vs Simulado).
 */

var DashboardUI = (function () {
  const DASHBOARD_SHEET = 'Dashboard';
  const CARTEIRA_SHEET = 'Carteira';
  const ANALISE_SHEET = 'Resultados_Analise';
  const LOG_REAL = 'Log_Performance';
  const LOG_SIMULADO = 'Log_Simulado';

  /** Helper para converter valores de células em números puros, tratando vírgulas e símbolos */
  function _parseNum(val) {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === "number") return val; // Se o GAS já retornar número, não processa string
    
    let str = String(val).trim().replace('R$', '').replace('%', '').trim();
    
    // Se contiver vírgula e ponto (ex: 1.234,56), limpa o ponto e converte a vírgula
    if (str.includes(',') && str.includes('.')) {
      if (str.indexOf('.') < str.indexOf(',')) { 
        str = str.replace(/\./g, '').replace(',', '.');
      }
    } else if (str.includes(',')) { // Formato "26,50"
      str = str.replace(',', '.');
    }
    // Note: se for "-91.68", o parseFloat já resolve corretamente agora
    return parseFloat(str) || 0;
  }

  function updateDashboardCompleto() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 🔄 Tenta encerrar trades virtuais antes de ler os dados
    if (typeof SimulationManager !== 'undefined') {
      SimulationManager.monitorExits();
    }

    let dash = ss.getSheetByName(DASHBOARD_SHEET) || ss.insertSheet(DASHBOARD_SHEET);
    
    dash.clear();
    dash.clearConditionalFormatRules();

    // 1. HEADER SNIPER
    dash.getRange('A1:I1').merge().setValue('🎯 ESTRATÉGIA SNIPER 20 - COMANDO INTEGRADO')
      .setFontWeight('bold').setFontSize(18).setBackground('#0c343d').setFontColor('white')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    dash.setRowHeight(1, 50);

    // --- BLOCO A: SAÚDE DA CARTEIRA REAL (NOVO) ---
    const sheetCarteira = ss.getSheetByName(CARTEIRA_SHEET);
    let kpiCarteira = ["-", "-", "-"];
    
    if (sheetCarteira) {
      const dataC = sheetCarteira.getDataRange().getValues();
      let totalAtual = 0;
      let lucroTotal = 0;
      let riscoTotal = 0;

      for(let i = 1; i < dataC.length; i++) {
        totalAtual += (parseFloat(dataC[i][2]) * parseFloat(dataC[i][7])) || 0; // Qtd * Cotação
        lucroTotal += parseFloat(dataC[i][8]) || 0; // Col I
        riscoTotal += parseFloat(dataC[i][19]) || 0; // Col T (Risco R$)
      }
      kpiCarteira = [totalAtual, lucroTotal, riscoTotal];
    }

    dash.getRange('A3:C3').setValues([['💰 PATRIMÔNIO ATUAL (R$)', '📈 LUCRO/PREJ. TOTAL', '⚠️ RISCO EM ABERTO']])
        .setFontWeight('bold').setBackground('#2c3e50').setFontColor('white').setHorizontalAlignment('center');
    
    const rangeKPI = dash.getRange('A4:C4');
    rangeKPI.setValues([kpiCarteira]).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
    
    // Aplica formatação de moeda nos KPIs
    dash.getRange('A4:C4').setNumberFormat('"R$ "#,##0.00');
    // Cor condicional simples para o Lucro Total
    dash.getRange('B4').setFontColor(kpiCarteira[1] >= 0 ? '#27ae60' : '#c0392b');
    dash.getRange('C4').setFontColor('#e67e22'); // Laranja para Risco

    // --- BLOCO B: MÉTRICAS DE MERCADO (SCANNER) ---
    const dataSheet = ss.getSheetByName(ANALISE_SHEET);
    if (dataSheet && dataSheet.getLastRow() >= 2) {
      const data = dataSheet.getDataRange().getValues().slice(1);
      
      const safety = ["VALE3", "PETR4", "ITUB4", "BBAS3", "WEGE3"];
      const growth = ["PRIO3", "RENT3", "BPAC11", "VBBR3", "HYPE3"];

      const calcAvg = (list) => {
        const filtered = data.filter(r => list.indexOf(r[2]) !== -1);
        return filtered.length > 0 ? (filtered.reduce((a, b) => a + b[4], 0) / filtered.length).toFixed(0) : "0";
      };

      dash.getRange('E3:F3').setValues([['🛡️ SCORE SEGURANÇA', '🚀 SCORE GROWTH']])
          .setFontWeight('bold').setBackground('#f3f3f3').setHorizontalAlignment('center');
      dash.getRange('E4:F4').setValues([[calcAvg(safety), calcAvg(growth)]])
          .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');

      // --- BLOCO C: TOP 10 OPORTUNIDADES ---
      dash.getRange('A7:I7').setValues([['RANK', 'TICKER', 'PREÇO', 'SCORE', 'SETUP', 'STOP LOSS', 'ALVO 1', 'POTENCIAL %', 'STATUS']])
          .setBackground('#134f5c').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center');

      // --- BLOCO C: TOP 10 OPORTUNIDADES (CORRIGIDO) ---
const tableData = data.slice(0, 10).map(r => {
    const ticker = r[1];           // Coluna B
    const preco = parseFloat(r[2]) || 0; // Coluna C
    const score = r[3];            // Coluna D
    const setup = r[6];            // Coluna G
    const stopLoss = r[8];         // Coluna I
    const alvo = parseFloat(r[9]) || 0;  // Coluna J (Alvo 1)
    
    const potencial = preco > 0 ? (alvo - preco) / preco : 0;
    const status = score >= 85 ? "💎 ELITE" : "✅ OK";

    // Retorna na ordem exata das colunas do Dashboard:
    // [RANK, TICKER, PREÇO, SCORE, SETUP, STOP LOSS, ALVO 1, POTENCIAL %, STATUS]
    return [r[0], ticker, preco, score, setup, stopLoss, alvo, potencial, status];
});

      if (tableData.length > 0) {
        const rangeTable = dash.getRange(8, 1, tableData.length, 9);
        rangeTable.setValues(tableData).setHorizontalAlignment('center');
        
        // 🔽 TODAS AS FORMATAÇÕES AUTOMÁTICAS FORAM REMOVIDAS 🔽
        // Agora você pode formatar manualmente como preferir
        
        // REMOVIDO: dash.getRange(8, 8, tableData.length, 1).setNumberFormat('0.0%');
        // REMOVIDO: dash.getRange(8, 3, tableData.length, 1).setNumberFormat('"R$ "#,##0.00');
        // REMOVIDO: dash.getRange(8, 6, tableData.length, 2).setNumberFormat('"R$ "#,##0.00');
        
        // Regra de Cor para Score (OPCIONAL - remova se também quiser fazer manualmente)
        let rule = SpreadsheetApp.newConditionalFormatRule()
            .whenNumberGreaterThanOrEqualTo(85)
            .setBackground('#b6d7a8')
            .setRanges([dash.getRange(8, 4, tableData.length, 1)])
            .build();
        dash.setConditionalFormatRules([rule]);
      }
    }
    
    // --- BLOCO D: COMPARATIVO REAL VS SIMULADO (NOVO) ---
    _drawComparisonBlock(dash, 20); 
    _drawWinRateChart(dash, 20); 

    console.log("✅ Dashboard Integrado v14.1 atualizado e calibrado.");
  }

  /** Desenha a tabela comparativa de performance */
  function _drawComparisonBlock(dash, startRow) {
    dash.getRange(startRow, 1, 1, 4).setValues([['📊 PERFORMANCE', 'MÉTRICA', 'OPERACIONAL REAL', 'ESTRATÉGIA SIMULADA']])
        .setBackground('#2c3e50').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center');

    const statsReal = _getRealStats();
    const statsSim = _getSimStats(); 

    const rows = [
      ['📈 EFICIÊNCIA', 'Win Rate', statsReal.winRate, statsSim.winRate],
      ['💰 RESULTADO', 'Avg. Retorno', statsReal.avgProfit, statsSim.avgProfit],
      ['⚖️ EXPOSIÇÃO', 'Total Trades', statsReal.total, statsSim.total]
    ];

    dash.getRange(startRow + 1, 1, rows.length, 4).setValues(rows).setHorizontalAlignment('center');
    
    dash.getRange(startRow + 1, 3, rows.length, 1).setBackground('#e1f5fe'); // Azul claro
    dash.getRange(startRow + 1, 4, rows.length, 1).setBackground('#fff9c4'); // Amarelo claro
  }

  /** Desenha o gráfico de evolução de Win Rate */
  function _drawWinRateChart(dash, startRow) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(LOG_REAL);
    if (!sh || sh.getLastRow() < 3) return;

    // Pega Data Entrada(0) e Status(8) - pulando cabeçalho(1) e resumo(2)
    const data = sh.getRange(3, 1, sh.getLastRow() - 2, 9).getValues();
    const trades = data.filter(r => String(r[8]).includes("GAIN") || String(r[8]).includes("LOSS"));
    
    if (trades.length < 2) return;

    let wins = 0;
    const chartData = [["Trade #", "Win Rate %"]];
    trades.forEach((r, i) => {
      if (String(r[8]).includes("GAIN")) wins++;
      chartData.push([i + 1, (wins / (i + 1)) * 100]);
    });

    // A aba CHART_DATA não é necessária se o gráfico for gerado de outra forma,
    // mas se for usada, mantenha a lógica. Caso contrário, pode ser removida.
    // Como solicitado, não há funções críticas que dependam exclusivamente dela
    // a menos que o DashboardUI dependa dela para plotar gráficos.
    let tempSh = ss.getSheetByName("CHART_DATA") || ss.insertSheet("CHART_DATA");
    tempSh.hideSheet().clear().getRange(1, 1, chartData.length, 2).setValues(chartData);

    const charts = dash.getCharts();
    charts.forEach(c => {
      if (c.getOptions().get('title') === '📈 EVOLUÇÃO WIN RATE (%)') dash.removeChart(c);
    });

    const chart = dash.newChart()
        .setChartType(Charts.ChartType.LINE)
        .addRange(tempSh.getRange(1, 1, chartData.length, 2))
        .setPosition(startRow, 6, 0, 0) // Posiciona na coluna F (6)
        .setOption('title', '📈 EVOLUÇÃO WIN RATE (%)')
        .setOption('vAxis', { minValue: 0, maxValue: 100 })
        .setOption('legend', { position: 'none' })
        .setOption('width', 400)
        .setOption('height', 200)
        .build();

    dash.insertChart(chart);
  }

  function _getRealStats() {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_REAL);
    if (!sh || sh.getLastRow() < 3) return { total: 0, winRate: "0,00%", avgProfit: "0,00%" };
    
    // Resumo da Linha 2: [Data, Total, Wins, Losses, Draws, WR%]
    const summary = sh.getRange(2, 1, 1, 6).getValues()[0]; 
    const trades = sh.getRange(3, 10, Math.max(1, sh.getLastRow() - 2), 1).getValues().flat(); // Col J (Resultado %)
    
    let sumPct = 0;
    let count = 0;
    trades.forEach(v => {
      if (v !== "") { // Verifica se a célula não está vazia em vez de n != 0
        sumPct += _parseNum(v);
        count++;
      }
    });

    return {
      total: summary[1] || count || 0,
      winRate: (typeof summary[5] === 'string') ? summary[5] : (summary[5] > 1 ? summary[5] : summary[5]*100).toFixed(2) + "%",
      avgProfit: count > 0 ? (sumPct / count).toFixed(2) + "%" : "0,00%"
    };
  }

  function _getSimStats() {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SIMULADO);
    if (!sh || sh.getLastRow() < 2) return { total: 0, winRate: "0,00%", avgProfit: "0,00%" };

    const data = sh.getRange(2, 6, sh.getLastRow() - 1, 2).getValues(); // Col F (Resultado %), G (Status)
    const total = data.length;
    const wins = data.filter(r => String(r[1]).includes("GAIN")).length;
    
    let sumPct = 0;
    let count = 0;
    data.forEach(r => {
      let n = _parseNum(r[0]);
      if (n !== 0) { sumPct += n; count++; }
    });

    // Nota: O SimulationManager grava como decimal (0.05). Multiplicamos por 100 para o Dashboard.
    return {
      total: total,
      winRate: ((wins / total) * 100).toFixed(2) + "%",
      avgProfit: count > 0 ? (sumPct / count * 100).toFixed(2) + "%" : "0,00%"
    };
  }

  return { updateDashboardCompleto };
})();

function ATUALIZAR_DASHBOARD() {
  DashboardUI.updateDashboardCompleto();
}