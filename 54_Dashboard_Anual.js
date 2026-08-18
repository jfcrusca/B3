/** =========================================================================
// 54_Dashboard_Anual.gs  --  MOTOR DE INTELIGÊNCIA: HISTÓRICO ANUAL (2019 - 2026)
// =========================================================================
*/
function GERAR_DASHBOARD_ANUAL() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNotas = ss.getSheetByName("Notas de Corretagem");
  
  if (!sheetNotas) {
    SpreadsheetApp.getUi().alert("❌ Aba 'Notas de Corretagem' não encontrada.");
    return;
  }

  // 1. Coleta os dados brutos da Nota
  const dados = sheetNotas.getDataRange().getValues();
  const cabecalho = dados[0];
  
  const idxData = cabecalho.indexOf("Data");
  const idxLucro = cabecalho.indexOf("Lucro/Prejuízo");
  
  if (idxData === -1 || idxLucro === -1) {
    SpreadsheetApp.getUi().alert("❌ Colunas 'Data' ou 'Lucro/Prejuízo' não encontradas nas Notas.");
    return;
  }

  // 2. Processa e Agrupa por Ano
  let historico = {}; // Objeto para armazenar { "2019": { trades: 10, gains: 6, lucroTotal: 500 }, ... }

  for (let i = 1; i < dados.length; i++) {
    let linha = dados[i];
    let data = linha[idxData];
    let lucroStr = linha[idxLucro];
    
    // Filtra apenas linhas que tenham data válida e um resultado financeiro preenchido
    if (data && data instanceof Date && lucroStr !== "" && !isNaN(parseFloat(lucroStr))) {
      let ano = data.getFullYear();
      let lucro = parseFloat(lucroStr);
      
      if (!historico[ano]) {
        historico[ano] = { trades: 0, gains: 0, losses: 0, lucroTotal: 0 };
      }
      
      historico[ano].trades += 1;
      historico[ano].lucroTotal += lucro;
      
      if (lucro > 0) historico[ano].gains += 1;
      if (lucro < 0) historico[ano].losses += 1;
    }
  }

  // 3. Prepara a aba de Destino (Dashboard_Anual)
  let sheetDash = ss.getSheetByName("Dashboard_Anual");
  if (!sheetDash) {
    sheetDash = ss.insertSheet("Dashboard_Anual");
  } else {
    sheetDash.clear(); // Limpa para atualizar
  }

  // 4. Monta a Interface Visual do Dashboard
  sheetDash.getRange("B2").setValue("🏆 HISTÓRICO DE PERFORMANCE (DESDE 2019)")
           .setFontSize(14).setFontWeight("bold").setFontColor("#0c343d");
           
  const headers = ["ANO", "TOTAL TRADES", "VITÓRIAS", "DERROTAS", "WIN RATE", "RESULTADO LÍQUIDO (R$)"];
  sheetDash.getRange(4, 2, 1, headers.length).setValues([headers])
           .setBackground("#0c343d").setFontColor("white").setFontWeight("bold").setHorizontalAlignment("center");

  // 5. Converte os dados processados para a tabela
  let anosOrdenados = Object.keys(historico).sort((a, b) => b - a); // Do mais recente para o mais antigo
  let linhasTabela = [];
  let cores = [];

  anosOrdenados.forEach(ano => {
    let h = historico[ano];
    let winRate = h.trades > 0 ? (h.gains / h.trades) : 0;
    
    linhasTabela.push([ano, h.trades, h.gains, h.losses, winRate, h.lucroTotal]);
    
    // Pinta a linha de Verde se o ano foi positivo, Vermelho se negativo
    if (h.lucroTotal > 0) cores.push(["#d9ead3", "#d9ead3", "#d9ead3", "#d9ead3", "#d9ead3", "#d9ead3"]);
    else cores.push(["#f4cccc", "#f4cccc", "#f4cccc", "#f4cccc", "#f4cccc", "#f4cccc"]);
  });

  if (linhasTabela.length > 0) {
    let rangeDados = sheetDash.getRange(5, 2, linhasTabela.length, headers.length);
    rangeDados.setValues(linhasTabela);
    rangeDados.setBackgrounds(cores);
    
    // Formatações Específicas
    sheetDash.getRange(5, 6, linhasTabela.length, 1).setNumberFormat('0.00%'); // Win Rate
    sheetDash.getRange(5, 7, linhasTabela.length, 1).setNumberFormat('"R$ "#,##0.00'); // Financeiro
    
    rangeDados.setHorizontalAlignment("center").setBorder(true, true, true, true, true, true);
  }

  // Ajustes estéticos finais
  sheetDash.setHiddenGridlines(true);
  sheetDash.autoResizeColumns(2, 7);
  SpreadsheetApp.getActiveSpreadsheet().toast("Dashboard Histórico Gerado!", "B3 PRO");
}