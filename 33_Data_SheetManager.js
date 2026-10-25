// ===== 33_Data_SheetManager.gs =====

var SheetManager = {

  /**
   * Lê a lista de tickers da aba 'Tickers'.
   *
   * 🔧 v10.1 (CORREÇÃO): esta função havia sido substituída por um comentário
   * ("funções getTickers e cleanupOldSheets permanecem iguais") e nunca foi
   * reimplementada. Qualquer módulo que chamasse SheetManager.getTickers()
   * lançava "SheetManager.getTickers is not a function".
   *
   * Comportamento: varre TODAS as colunas de cada linha e usa o primeiro valor
   * que case com o padrão de ticker da B3 (4 letras + 1-2 dígitos), sem supor
   * que a coluna seja a A ou a G (a aba evoluiu e há colunas de apoio).
   *
   * @param {string} [sheetName='Tickers'] Nome da aba de origem.
   * @returns {Array<string>} Tickers únicos em maiúsculas, na ordem da planilha.
   */
  getTickers: function(sheetName) {
    var nomeAba = sheetName || 'Tickers';
    var tickers = [];
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) return tickers;
      var sh = ss.getSheetByName(nomeAba);
      if (!sh) {
        console.warn('[SheetManager] Aba "' + nomeAba + '" não encontrada.');
        return tickers;
      }

      var lastRow = sh.getLastRow();
      var lastCol = sh.getLastColumn();
      if (lastRow < 2 || lastCol < 1) return tickers;

      // Leitura em lote único (regra do projeto: nunca getValue dentro de loop).
      var vals = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
      var vistos = {};
      var padraoTicker = /^[A-Z]{4}\d{1,2}$/;

      for (var r = 0; r < vals.length; r++) {
        for (var c = 0; c < vals[r].length; c++) {
          var t = String(vals[r][c] == null ? '' : vals[r][c]).trim().toUpperCase();
          if (t && padraoTicker.test(t) && !vistos[t]) {
            vistos[t] = true;
            tickers.push(t);
            break; // achou o ticker desta linha; passa para a próxima
          }
        }
      }
    } catch (e) {
      console.error('[SheetManager] Falha ao ler tickers da aba "' + nomeAba + '": ' + e.message);
    }
    return tickers;
  },

  /**
   * Remove abas antigas de saída cujo nome contenha um dos padrões informados.
   *
   * 🔧 v10.1: reimplementada junto com getTickers (o marcador "permanecem
   * iguais" deixou ambas de existir). Mantida conservadora: só apaga abas que
   * casem com os padrões e nunca a aba ativa. A lista de abas é lida em uma
   * única chamada, antes do loop.
   *
   * @param {Array<string>} [padroes] Substrings (case-insensitive) dos nomes a remover.
   * @param {number} [manterUltimas=0] Quantas das abas encontradas preservar.
   * @returns {number} Quantidade de abas removidas.
   */
  cleanupOldSheets: function(padroes, manterUltimas) {
    var listaPadroes = padroes || ['Backtest_', 'Temp_', 'Simulacao_Old'];
    var manter = parseInt(manterUltimas, 10);
    if (isNaN(manter) || manter < 0) manter = 0;

    var removidas = 0;
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) return 0;
      var ativa = ss.getActiveSheet();
      var abas = ss.getSheets();
      var alvos = [];

      for (var i = 0; i < abas.length; i++) {
        var nome = abas[i].getName();
        var casa = false;
        for (var p = 0; p < listaPadroes.length; p++) {
          var pad = String(listaPadroes[p] || '');
          if (pad && nome.toLowerCase().indexOf(pad.toLowerCase()) !== -1) { casa = true; break; }
        }
        if (casa) alvos.push(abas[i]);
      }

      // Preserva as últimas N abas encontradas
      if (manter > 0) alvos = alvos.slice(0, Math.max(0, alvos.length - manter));

      for (var k = 0; k < alvos.length; k++) {
        if (alvos[k].getSheetId() === ativa.getSheetId()) continue; // nunca apaga a aba ativa
        try { ss.deleteSheet(alvos[k]); removidas++; } catch (e2) { /* ignora */ }
      }
      if (removidas > 0) console.log('[SheetManager] ' + removidas + ' aba(s) antiga(s) removida(s).');
    } catch (e) {
      console.error('[SheetManager] Falha em cleanupOldSheets: ' + e.message);
    }
    return removidas;
  },

  appendToSheet: function(sheetName, data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);

    if (data.length === 0) return;

    // --- DETETIVE DE DADOS ---
    // Esta parte garante que pegamos o valor certo, mesmo com nomes diferentes
    // 🔧 v10.1: o callback recebe (row, i) — antes referenciava `i` sem recebê-lo,
    // o que lançava "i is not defined" na primeira linha em modo estrito.
    const processedData = data.map((row, i) => {
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