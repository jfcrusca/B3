// ===== 33_Data_SheetManager.gs =====

var SheetManager = {

  // ... (funções getTickers e cleanupOldSheets permanecem iguais)

  appendToSheet: function(sheetName, data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);

    if (data.length === 0) return;

    // --- DETETIVE DE DADOS ---
    // Esta parte garante que pegamos o valor certo, mesmo com nomes diferentes
    const processedData = data.map(row => {
      const findVal = (options) => {
        const key = Object.keys(row).find(k => options.includes(k.trim()));
        return key ? row[key] : null;
      };

      // Tenta pegar os valores (com e sem acento/maiúsculas)
      let preco = findVal(['Preço', 'Preco', 'preco', 'price']) || 0;
      let rsi = findVal(['RSI', 'rsi', 'Rsi']) || 0;
      let ema21 = findVal(['EMA21', 'ema21', 'Média 21']) || 1;
      let rr = findVal(['R/R', 'rr', 'RR']) || 1.5;
      let fib = findVal(['Fibonacci', 'fib', 'Fib']) || 0;

      // Log para debug (aparecerá no console do script)
      if (i === 0) console.log("🔍 Chaves detectadas:", Object.keys(row));

      // Só calcula se encontrou o básico
      if (preco > 0 && rsi > 0) {
        let ranking = 80 + (60 - rsi) - (((preco / ema21) - 1) * 100) + ((rr - 1.5) * 10);
        row['Ranking'] = Math.round(ranking * 10) / 10;

        let dist = (preco / ema21) - 1;
        let tipo = "TENDÊNCIA";
        if (dist <= 0.02) tipo = "PULLBACK";
        else if (dist > 0.05 && rsi > 60) tipo = "MOMENTUM";
        else if (preco > fib && dist < 0.04) tipo = "ROMPIMENTO";
        row['Tipo Setup'] = tipo;
      } else {
        row['Ranking'] = "";
        row['Tipo Setup'] = "DADOS INSUF.";
      }
      return row;
    });

    // --- ESCRITA NA PLANILHA ---
    // Pegamos os cabeçalhos que JÁ ESTÃO na planilha para garantir a ordem
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Mapeia os dados para as colunas certas
    const values = processedData.map(row => {
      return headers.map(header => {
        // Se o dado existe no objeto, coloca. Se não, deixa vazio.
        return row[header] !== undefined ? row[header] : "";
      });
    });

    // Grava tudo de uma vez (muito mais rápido)
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);

    // Aplica as cores se a função existir
    if (this.applyVisualScaling) this.applyVisualScaling(sheet);
  },

  /**
   * Aplica regras de cores baseadas no Setup para facilitar a leitura rápida
   */
  applyVisualScaling: function(sheet) {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return;

    const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
    
    // Limpa regras anteriores para não acumular
    sheet.clearConditionalFormatRules();
    const rules = [];

    // Regra PULLBACK: Verde (Oportunidade de Compra com Desconto)
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("PULLBACK")
      .setBackground("#B7E1CD") // Verde pastel
      .setRanges([range])
      .build());

    // Regra MOMENTUM: Amarelo/Laranja (Tendência Forte, Cuidado com a Esticada)
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("MOMENTUM")
      .setBackground("#FCE8B2") // Amarelo pastel
      .setRanges([range])
      .build());

    // Regra ROMPIMENTO: Roxo (Quebra de barreira Fibonacci/Pivot)
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("ROMPIMENTO")
      .setBackground("#D9D2E9") // Roxo pastel
      .setRanges([range])
      .build());

    sheet.setConditionalFormatRules(rules);
    
    // Auto-ajuste das colunas para ficar elegante
    sheet.autoResizeColumns(1, lastCol);
  }
};