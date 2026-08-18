/**
 * 00_SheetWriter.js
 * =============================================================================
 * MÓDULO DE ESCRITA EM PLANILHA — v1.0
 * =============================================================================
 * Responsabilidade: Gravar os resultados do scanner na aba "Resultados_Analise"
 * e limpar a aba quando necessário.
 *
 * Integração:
 *   - Registrado no CoreRegistry como 'SheetWriter'
 *   - Chamado pelo Orchestrator._processarSaidasFinais()
 *   - Lido pelo OportunidadesProcessor (29) para consolidar a aba "Oportunidades"
 * =============================================================================
 */

'use strict';

var SheetWriter = (function () {

  var CONFIG = {
    SHEET_NAME: 'Resultados_Analise',
    HEADERS: [
      'Data', 'Ticker', 'Preço', 'Score', 'Setup', 'Motivo',
      'Stop', 'Alvo1', 'Alvo2', 'R/R', 'Risco',
      'RSI', 'EMA21', 'EMA50', 'EMA200', 'ATR',
      'Volume', 'Pivot', 'Fibonacci', 'Estratégia', 'Observações',
      // 🔧 CORREÇÃO v10.2: Novas métricas de "perto do topo"
      'Topo50', 'GanhoRapido%', 'DistTopo%'
    ]

  };

  /**
   * Obtém ou cria a aba de destino.
   * @param {SpreadsheetApp.Spreadsheet} ss
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function _getSheet(ss) {
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);
      sheet.getRange(1, 1, 1, CONFIG.HEADERS.length)
           .setValues([CONFIG.HEADERS])
           .setFontWeight('bold')
           .setBackground('#EFEFEF');
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  /**
   * Converte um objeto de oportunidade em uma linha (array) para a planilha.
   * @param {Object} op
   * @returns {Array} Array com 20 posições
   */
  function _opParaLinha(op) {
    if (!op) {
      var linhaVazia = [];
      for (var i = 0; i < CONFIG.HEADERS.length; i++) linhaVazia.push('');
      return linhaVazia;
    }

    var ind = op.indicators || {};

    return [
      op.data || new Date(),
      op.ticker || '',
      op.price || op.livePrice || 0,
      op.score !== undefined ? op.score : 0,
      op.setup || op.setupType || '',
      op.motivo || '',
      op.stopLoss || op.stop || 0,
      op.alvo1 || op.target1 || 0,
      op.alvo2 || op.target2 || 0,
      op.rr || op.riskReward || 0,
      op.risco || op.risk || 0,
      op.rsi || ind.rsi || 0,
      op.ema21 || ind.ema21 || 0,
      op.ema50 || ind.ema50 || 0,
      op.ema200 || ind.ema200 || 0,
      op.atr || ind.atr || 0,
      op.volume || ind.volume || 0,
      op.pivot || ind.pivot || 0,
      op.fibonacci || op.fiboPrice || ind.fibonacci || 0,
      op.estrategiaEntrada || '',
      op.observacoes || op.obs || op.aiRationale || '',
      // 🔧 CORREÇÃO v10.2: Novas métricas de "perto do topo"
      op.topo50 || 0,
      op.ganhoRapidoPct || 0,
      op.distTopoPct || 0
    ];
  }

  // ---------------------------------------------------------------------------
  // API PÚBLICA
  // ---------------------------------------------------------------------------

  /**
   * Salva a lista completa de resultados na aba "Resultados_Analise".
   * Modo SNAPSHOT: apaga tudo e reescreve.
   * @param {Array} listaCompleta
   */
  function saveAnalysisResults(listaCompleta) {
    if (!listaCompleta || !Array.isArray(listaCompleta)) {
      console.warn('⚠️ [SheetWriter] Lista inválida para saveAnalysisResults');
      return;
    }

    console.log('📝 [SheetWriter] Salvando ' + listaCompleta.length + ' resultados em "' + CONFIG.SHEET_NAME + '"...');

    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = _getSheet(ss);

      var ultimaLinha = sheet.getLastRow();
      if (ultimaLinha > 1) {
        sheet.getRange(2, 1, ultimaLinha - 1, CONFIG.HEADERS.length).clearContent();
      }

      if (listaCompleta.length === 0) {
        console.log('ℹ️ [SheetWriter] Lista vazia — aba limpa.');
        return;
      }

      var linhas = listaCompleta.map(_opParaLinha);
      sheet.getRange(2, 1, linhas.length, CONFIG.HEADERS.length).setValues(linhas);

      try {
        sheet.getRange(2, 3, linhas.length, 1).setNumberFormat('"R$" #,##0.00');
        sheet.getRange(2, 7, linhas.length, 3).setNumberFormat('"R$" #,##0.00');
        sheet.getRange(2, 1, linhas.length, 1).setNumberFormat('dd/MM HH:mm');
        try { sheet.autoResizeColumns(1, CONFIG.HEADERS.length); } catch (e) {}
      } catch (eFmt) {
        console.warn('⚠️ [SheetWriter] Erro de formatação: ' + eFmt.message);
      }

      console.log('✅ [SheetWriter] ' + listaCompleta.length + ' linhas escritas em "' + CONFIG.SHEET_NAME + '".');

    } catch (e) {
      console.error('❌ [SheetWriter] Erro ao salvar resultados: ' + e.message);
    }
  }

  /**
   * Limpa a aba "Resultados_Analise" (preserva cabeçalho).
   */
  function clearSheet() {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
      if (sheet && sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, CONFIG.HEADERS.length).clearContent();
        console.log('🧹 [SheetWriter] Aba "' + CONFIG.SHEET_NAME + '" limpa.');
      }
    } catch (e) {
      console.warn('⚠️ [SheetWriter] Erro ao limpar aba: ' + e.message);
    }
  }

  return {
    saveAnalysisResults: saveAnalysisResults,
    clearSheet: clearSheet
  };

})();