/**
 * 59_Simulation_Manager.gs — MOTOR DE PAPER TRADING (v1.0)
 * =============================================================================
 * ✅ PAPEL: Simular a execução de TODOS os trades aprovados pelo Sentinela.
 * ✅ MÉTRICAS: Gera estatísticas de performance "Ghost" para feedback do motor.
 */

var SimulationManager = (function() {
  'use strict';
  const SHEET_ACTIVE = 'Simulacao_Ativa';
  const SHEET_LOG = 'Log_Simulado';

  function _buildEntryKey(entry) {
    const ticker = String(entry.ticker || '').trim().toUpperCase();
    const setup = String(entry.setup || '').trim();
    const price = _parseNumber(entry.price);
    return `${ticker}::${setup}::${price}`;
  }

  function _parseNumber(value) {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  }

  /** Registra novas entradas sugeridas que passaram pelo crivo do Sentinela */
  function registerEntries(lista) {
    if (!lista || lista.length === 0) return;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_ACTIVE);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    const existingKeys = lastRow > 1
      ? sheet.getRange(2, 2, lastRow - 1, 5).getValues().map(row => _buildEntryKey({
          ticker: row[0],
          price: row[1],
          setup: row[4]
        }))
      : [];
    const seenKeys = new Set(existingKeys);

    const newRows = lista
      .map(op => ({
        date: new Date(),
        ticker: String(op.ticker || '').trim().toUpperCase(),
        price: _parseNumber(op.price),
        stopLoss: _parseNumber(op.stopLoss),
        target1: _parseNumber(op.target1),
        setup: String(op.setup || '').trim(),
        score: _parseNumber(op.score)
      }))
      .filter(op => op.ticker && op.price > 0)
      .filter(op => {
        const key = _buildEntryKey(op);
        return !seenKeys.has(key);
      })
      .map(op => [
        op.date,
        op.ticker,
        op.price,
        op.stopLoss,
        op.target1,
        op.setup,
        op.score
      ]);

    if (newRows.length > 0) {
      sheet.getRange(lastRow + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
      console.log(`🎮 [Simulação] ${newRows.length} novos trades virtuais registrados.`);
    }
  }

  /** Varre os trades ativos e fecha aqueles que bateram no Stop ou Alvo */
  function monitorExits() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetActive = ss.getSheetByName(SHEET_ACTIVE);
    const sheetLog = ss.getSheetByName(SHEET_LOG);
    if (!sheetActive || !sheetLog || sheetActive.getLastRow() < 2) return;

    const lastRow = sheetActive.getLastRow();
    const lastCol = sheetActive.getLastColumn();
    const data = sheetActive.getRange(1, 1, lastRow, lastCol).getValues();
    // 🔧 CORREÇÃO: Remove tickers duplicados para evitar URLs malformadas no BRAPI
    const tickers = [...new Set(
      data.slice(1).map(r => String(r[1] || '').trim()).filter(Boolean)
    )];
    const prices = (typeof DataService !== 'undefined' && typeof DataService.getPrecosAtuaisEmLote === 'function')
      ? DataService.getPrecosAtuaisEmLote(tickers)
      : {};

    const remaining = [];
    const closed = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const ticker = String(row[1] || '').trim();
      const entryPrice = _parseNumber(row[2]);
      const stop = _parseNumber(row[3]);
      const target = _parseNumber(row[4]);
      const setup = String(row[5] || '').trim();

      const live = prices[ticker] || {};
      const livePrice = _parseNumber(live.price || live.preco || live.lastTrade || live.last);
      if (!livePrice || entryPrice <= 0 || (!stop && !target)) {
        remaining.push(row);
        continue;
      }

      let status = "";
      if (livePrice <= stop) status = "STOP 🔴";
      else if (livePrice >= target) status = "GAIN 🟢";

      if (status) {
        const resPerc = entryPrice > 0 ? (livePrice / entryPrice) - 1 : 0;
        closed.push([
          row[0], // Data entrada
          ticker,
          entryPrice,
          new Date(), // Data saída
          livePrice,
          resPerc,
          status,
          setup
        ]);
      } else {
        remaining.push(row);
      }
    }

    sheetActive.getRange(2, 1, Math.max(0, lastRow - 1), lastCol).clearContent();
    if (remaining.length > 0) {
      sheetActive.getRange(2, 1, remaining.length, remaining[0].length).setValues(remaining);
    }
    if (closed.length > 0) {
      sheetLog.getRange(sheetLog.getLastRow() + 1, 1, closed.length, closed[0].length).setValues(closed);
    }
  }

  /** 
   * Calcula estatísticas de performance da simulação para análise de eficácia 
   * @returns {Object} Métricas de Win Rate e Lucro Médio Virtual
   */
  function getGhostStatistics() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetLog = ss.getSheetByName(SHEET_LOG);
    if (!sheetLog || sheetLog.getLastRow() < 2) return null;

    const data = sheetLog.getRange(2, 6, sheetLog.getLastRow() - 1, 2).getValues(); // Col F (Resultado %), G (Status)
    
    let total = data.length;
    let wins = 0;
    let sumReturn = 0;
    let validCount = 0;

    data.forEach(r => {
      const res = parseFloat(r[0]);
      if (!isNaN(res)) {
        sumReturn += res;
        validCount++;
      }
      if (String(r[1] || '').includes("GAIN")) wins++;
    });

    const stats = {
      total: total,
      validCount: validCount,
      winRate: total > 0 ? (wins / total * 100).toFixed(1) + "%" : "0.0%",
      avgReturn: validCount > 0 ? (sumReturn / validCount * 100).toFixed(2) + "%" : "0.00%",
      timestamp: new Date()
    };

    console.log(`📊 [Análise Robô] WinRate Virtual: ${stats.winRate} | Amostragem: ${total}`);
    return stats;
  }

  /** Limpa o log de simulação se ficar muito pesado (Housekeeping) */
  function houseKeeping() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_LOG);
    if (sheet && sheet.getLastRow() > 1000) {
      // Mantém apenas os últimos 200 trades para não travar a planilha
      const rowsToDelete = sheet.getLastRow() - 201;
      sheet.deleteRows(2, rowsToDelete);
      console.log("🧹 [Simulação] Limpeza de log executada.");
    }
  }

  /** 
   * Função de diagnóstico para validar o funcionamento do motor.
   * Dispara um registro fictício e foca na aba para conferência.
   */
  function TESTAR_SISTEMA() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const mock = [{
      ticker: "PETR4", // Usamos um ticker real para testar o monitor de saídas depois
      price: 20.00,    // Preço fictício baixo para forçar um "GAIN" se o preço real for maior
      stopLoss: 18.00,
      target1: 25.00,
      setup: "DEBUG_MOCK",
      score: 95
    }];
    
    console.log("🧪 [Simulação] Iniciando teste unitário de registro...");
    registerEntries(mock);
    
    const sheet = ss.getSheetByName(SHEET_ACTIVE);
    if (sheet) SpreadsheetApp.setActiveSheet(sheet);
    ss.toast("Trade fictício registrado com sucesso!", "🤖 Simulação", 5);
  }

  return { registerEntries, monitorExits, getGhostStatistics, houseKeeping, TESTAR_SISTEMA };
})();

/** 
 * Função ponte para tornar o teste visível na interface da planilha 
 */
function MENU_TESTAR_SISTEMA_SIMULACAO() {
  if (typeof SimulationManager !== 'undefined') {
    SimulationManager.TESTAR_SISTEMA();
  }
}