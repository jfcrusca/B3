/**
 * 00_SheetWriter.js
 * =============================================================================
 * MÓDULO DE ESCRITA EM PLANILHA — v2.0 (CONSOLIDADO)
 * =============================================================================
 * Responsabilidade: Gravar os resultados do scanner na aba "Resultados_Analise"
 * e limpar a aba quando necessário.
 *
 * 🔧 CORREÇÃO v10.2+: Este módulo foi **CONSOLIDADO** ao padrão de 26 colunas
 *    do 08_Output_Unified.js (OutputManager). Antes possuía 23-24 colunas com
 *    nomes OBSOLETOS ('Stop', 'Alvo1', 'Risco', 'Estratégia', 'Observações'),
 *    causando DESLOCAMENTO dos dados quando a planilha já possuía 26 cabeçalhos.
 *
 * Integração:
 *   - Registrado no CoreRegistry como 'SheetWriter'
 *   - Chamado pelo Orchestrator._processarSaidasFinais()
 * =============================================================================
 */

'use strict';

var SheetWriter = (function () {

  var CONFIG = {
    SHEET_NAME: 'Resultados_Analise',
    // 🔧 v2.0: HEADERS = 26 colunas, idêntico ao OutputConfig (08_Output_Unified.js)
    HEADERS: [
      'Data', 'Ticker', 'Preço', 'Score', 'Setup', 'Motivo', 'Stop Loss',
      'Alvo 1', 'Alvo 2', 'R/R', 'Risco %', 'RSI', 'EMA21', 'EMA50', 'EMA200',
      'ATR', 'Volume', 'Pivot', 'Fibonacci', 'Análise IA', 'Ranking',
      'Tipo Setup', 'Alerta Segurança',
      // 🔧 v10.2: Novas métricas de "perto do topo"
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
      // Apenas cabeçalhos (26 cols), sem formatação extra
      sheet.getRange(1, 1, 1, CONFIG.HEADERS.length)
           .setValues([CONFIG.HEADERS]);
    }
    return sheet;
  }

  /**
   * Converte um objeto de oportunidade em uma linha (array) para a planilha.
   * 🔧 v2.0: Retorna exatamente 26 posições alinhadas ao cabeçalho do OutputConfig.
   * @param {Object} op
   * @returns {Array} Array com 26 posições
   */
  function _opParaLinha(op) {
    if (!op) {
      var linhaVazia = [];
      for (var i = 0; i < CONFIG.HEADERS.length; i++) linhaVazia.push('');
      return linhaVazia;
    }

    var ind = op.indicators || {};

    // ─── DADOS BASE ───────────────────────────────────────────────────────
    var ticker = op.ticker || '';
    var score  = op.score !== undefined ? op.score : 0;
    var setup  = op.setup || op.setupType || '';
    var motivo = op.reason || op.motivo || op.paReason || '';
    var stop   = op.stopLoss || op.stop || 0;
    var alvo1  = op.target1 || 0;
    var alvo2  = op.target2 || 0;
    var rr     = (op.rr !== undefined && op.rr !== null) ? op.rr
              : ((op.riskReward !== undefined && op.riskReward !== null) ? op.riskReward : 0);

    // ─── PREÇO (com overrides e cotação ao vivo) ──────────────────────────
    var precoOriginal = (op.price !== undefined && op.price !== null) ? op.price : op.Preço || 0;
    var preco = precoOriginal;

    if (ticker && typeof DataService !== 'undefined' && typeof DataService.getPrecoOverride === 'function') {
      try {
        var overridePreco = DataService.getPrecoOverride(ticker);
        if (overridePreco && overridePreco > 0) preco = overridePreco;
      } catch (e) { /* fallback */ }
    }
    if (op.livePrice && op.livePrice > 0) preco = op.livePrice;
    if (!preco || preco <= 0) preco = precoOriginal || 0;

    // ─── INDICADORES ──────────────────────────────────────────────────────
    var rsi    = ind.rsi    || op.rsi    || 50;
    var ema21  = ind.ema21  || op.ema21  || 0;
    var ema50  = ind.ema50  || op.ema50  || 0;
    var ema200 = ind.ema200 || op.ema200 || 0;
    var atr    = ind.atr    || op.atr    || 0;
    // 🔧 v12.1: ATR mínimo estimado se vazio
    if (atr <= 0 && preco > 0) atr = parseFloat((preco * 0.015).toFixed(4));

    var volume = op.volume || ind.volume || 0;
    var pivot  = op.pivot  || ind.pivot  || 0;
    var fib    = op.fiboPrice || op.fibo || op.fibonacci || ind.fibonacci || 0;
    var aiText = op.aiRationale || op.aiCommentary || op.analiseIA || '';

    // ─── RISCO PERCENTUAL ─────────────────────────────────────────────────
    var riscoPct = 0;
    if (op.riscoPercent && op.riscoPercent > 0) riscoPct = op.riscoPercent;
    if (riscoPct === 0 && preco > 0 && stop > 0) {
      if (stop < preco)      riscoPct = parseFloat(((preco - stop) / preco * 100).toFixed(2));
      else if (stop > preco) riscoPct = parseFloat(((stop  - preco) / preco * 100).toFixed(2));
    }

    // ─── RANKING ──────────────────────────────────────────────────────────
    var ranking = 0;
    if (ema21 > 0.1 && preco > 0 && rsi > 0) {
      ranking = 80 + (60 - rsi) - (((preco / ema21) - 1) * 100) + ((rr - 1.5) * 10);
      ranking = parseFloat(ranking.toFixed(1));
      ranking = Math.min(200, Math.max(0, ranking));
    }

    // ─── TIPO DE SETUP ────────────────────────────────────────────────────
    var distMedia = ema21 > 0 ? (preco / ema21) - 1 : 0;
    var tipoSetup = 'TENDÊNCIA';
    if (distMedia <= 0.02 && distMedia >= -0.02) {
      tipoSetup = 'PULLBACK';
    } else if (distMedia > 0.05 && rsi > 60) {
      tipoSetup = 'MOMENTUM';
    } else if (fib > 0 && preco > fib && distMedia < 0.04) {
      tipoSetup = 'ROMPIMENTO';
    } else if (distMedia < -0.05 && rsi < 40) {
      tipoSetup = 'REVERSÃO';
    }
    // Fallback: extrai do nome do setup
    if ((tipoSetup === 'TENDÊNCIA' || !tipoSetup) && setup && typeof setup === 'string') {
      if (setup.indexOf('PULLBACK') !== -1) tipoSetup = 'PULLBACK';
      else if (setup.indexOf('MOMENTUM') !== -1) tipoSetup = 'MOMENTUM';
      else if (setup.indexOf('ROMPIMENTO') !== -1) tipoSetup = 'ROMPIMENTO';
      else if (setup.indexOf('REVERSÃO') !== -1) tipoSetup = 'REVERSÃO';
    }

    // ─── ALERTA DE SEGURANÇA ──────────────────────────────────────────────
    var alertaMsg = op.alertaLive || op.alerta || '-';
    if (!alertaMsg || typeof alertaMsg !== 'string') alertaMsg = '-';

    // ─── MÉTRICAS DE "PERTO DO TOPO" (v10.2) ──────────────────────────────
    var topo50         = op.topo50 || 0;
    var ganhoRapidoPct = (op.ganhoRapidoPct !== undefined && op.ganhoRapidoPct !== null) ? op.ganhoRapidoPct : 0;
    var distTopoPct    = (op.distTopoPct !== undefined && op.distTopoPct !== null) ? op.distTopoPct : 0;

    // ─── DATA ─────────────────────────────────────────────────────────────
    var dataAtual = op.data || new Date();
    if (!(dataAtual instanceof Date)) dataAtual = new Date(dataAtual);

    // ─── RETORNA 26 COLUNAS (alinhado ao OutputConfig v10.2) ──────────────
    return [
      dataAtual,          // 0: Data
      ticker,             // 1: Ticker
      preco,              // 2: Preço
      score,              // 3: Score
      setup,              // 4: Setup
      motivo,             // 5: Motivo
      stop,               // 6: Stop Loss
      alvo1,              // 7: Alvo 1
      alvo2,              // 8: Alvo 2
      rr,                 // 9: R/R
      riscoPct,           // 10: Risco %
      rsi,                // 11: RSI
      ema21,              // 12: EMA21
      ema50,              // 13: EMA50
      ema200,             // 14: EMA200
      atr,                // 15: ATR
      volume,             // 16: Volume
      pivot,              // 17: Pivot
      fib,                // 18: Fibonacci
      aiText,             // 19: Análise IA
      ranking,            // 20: Ranking
      tipoSetup,          // 21: Tipo Setup
      alertaMsg,          // 22: Alerta Segurança
      topo50,             // 23: Topo50
      ganhoRapidoPct,     // 24: GanhoRapido%
      distTopoPct         // 25: DistTopo%
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

    console.log('📝 [SheetWriter] Salvando ' + listaCompleta.length + ' resultados em "' + CONFIG.SHEET_NAME + '" (26 cols)...');

    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = _getSheet(ss);

      var ultimaLinha = sheet.getLastRow();
      // 🔧 v2.0: limpeza em 26 colunas + remove cores residuais
      if (ultimaLinha > 1) {
        sheet.getRange(2, 1, ultimaLinha - 1, CONFIG.HEADERS.length).clearContent().setBackground(null);
      }

      if (listaCompleta.length === 0) {
        console.log('ℹ️ [SheetWriter] Lista vazia — aba limpa.');
        return;
      }

      var linhas = listaCompleta.map(_opParaLinha);
      // 🔧 v2.0: Validação de segurança — garante exatamente 26 valores por linha
      for (var li = 0; li < linhas.length; li++) {
        var rowV = linhas[li];
        if (!rowV) { rowV = []; for (var kk = 0; kk < CONFIG.HEADERS.length; kk++) rowV.push(''); }
        while (rowV.length < CONFIG.HEADERS.length) rowV.push('');
        linhas[li] = rowV.slice(0, CONFIG.HEADERS.length);
      }

      // Grava dados em bloco (26 colunas)
      sheet.getRange(2, 1, linhas.length, CONFIG.HEADERS.length).setValues(linhas);

      // Formatação numérica mínima p/ leitura clara
      try {
        var nr = linhas.length;
        sheet.getRange(2, 3, nr, 1).setNumberFormat('"R$ "#,##0.00');
        sheet.getRange(2, 7, nr, 3).setNumberFormat('"R$ "#,##0.00');
        sheet.getRange(2, 10, nr, 1).setNumberFormat('0.00');
        sheet.getRange(2, 11, nr, 1).setNumberFormat('0.00"%"');
      } catch (fmtErr) {
        console.warn('⚠️ [SheetWriter] Formatação numérica opcional: ' + fmtErr.message);
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
        sheet.getRange(2, 1, sheet.getLastRow() - 1, CONFIG.HEADERS.length).clearContent().setBackground(null);
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