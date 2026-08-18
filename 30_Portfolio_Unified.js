//
// 30_Portfolio_Unified.js — Sincronização de Carteira (v10.4 - Dynamic Batch I/O)
//

var PortfolioUnified = (function() {
  'use strict';

  function syncPortfolio() {
    console.log("🔄 [PORTFOLIO] Iniciando sincronização Rápida em Lote...");

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // Tenta buscar a aba "Carteira" (padrão do Setup) ou "Portfolio"
    const sheet = ss.getSheetByName("Carteira") || ss.getSheetByName("Portfolio"); 

    if (!sheet) {
      console.error("❌ [PORTFOLIO] Aba de carteira não encontrada.");
      return;
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return;

    // 1. MAPEAMENTO DINÂMICO DE COLUNAS (Evita quebra se o usuário mover colunas)
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase());

    // Procura por variações comuns de nomenclatura no cabeçalho
    const colTickerIdx = headers.findIndex(h => h === 'papel' || h === 'ticker' || h === 'ativo');
    const colPrecoIdx = headers.findIndex(h => h === 'cotação atual' || h === 'preço atual' || h === 'preço');

    if (colTickerIdx === -1 || colPrecoIdx === -1) {
      console.error("❌ [PORTFOLIO] Colunas de Ticker ou Preço não encontradas no cabeçalho.");
      return;
    }

    // 2. LEITURA EM BLOCO
    const rangeTickers = sheet.getRange(2, colTickerIdx + 1, lastRow - 1, 1);
    const tickersValues = rangeTickers.getValues();

    // Filtro com tipagem segura (evita erro se a célula for número/data)
    const tickersFlat = tickersValues
      .map(row => row[0])
      .filter(t => typeof t === 'string' && t.trim() !== "");

    if (tickersFlat.length === 0) {
      console.log("⚠️ [PORTFOLIO] Nenhum ticker válido encontrado para sincronizar.");
      return;
    }

    // 3. REQUISIÇÃO EXTERNA EM LOTE
    let cotacoesEmLote = {};
    if (typeof DataService !== 'undefined' && typeof DataService.getPrecosAtuaisEmLote === 'function') {
       cotacoesEmLote = DataService.getPrecosAtuaisEmLote(tickersFlat);
    } else {
       console.error("❌ [PORTFOLIO] DataService.getPrecosAtuaisEmLote não disponível.");
       return;
    }

    // 4. PROCESSAMENTO NA MEMÓRIA
    const rangePrecos = sheet.getRange(2, colPrecoIdx + 1, lastRow - 1, 1);
    const matrizPrecosAtuais = rangePrecos.getValues(); 

    let atualizados = 0;
    for (let i = 0; i < tickersValues.length; i++) {
      let ticker = tickersValues[i][0];

      if (typeof ticker === 'string' && ticker.trim() !== "") {
        let tickerLimpo = ticker.trim();
        if (cotacoesEmLote[tickerLimpo] && cotacoesEmLote[tickerLimpo].price) {
          matrizPrecosAtuais[i][0] = cotacoesEmLote[tickerLimpo].price;
          atualizados++;
        }
      }
    }

    // 5. ESCRITA EM BLOCO
    if (atualizados > 0) {
      rangePrecos.setValues(matrizPrecosAtuais);
      console.log(`✅ [PORTFOLIO] Sincronização finalizada! ${atualizados} ativos atualizados.`);
      SpreadsheetApp.getActiveSpreadsheet().toast(`Sincronizados ${atualizados} ativos em Lote.`, "B3 PRO", 4);
    } else {
      console.log("⚠️ [PORTFOLIO] Nenhuma cotação nova retornada pela API.");
    }
  }

  return {
    syncPortfolio: syncPortfolio
  };

})();

// A declaração MENU_SYNC_PORTFOLIO foi removida daqui para respeitar o 00_Menu_Manager.js