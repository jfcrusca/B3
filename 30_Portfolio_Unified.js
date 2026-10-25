//
// 30_Portfolio_Unified.js — Sincronização de Carteira (v10.5 - Dynamic Batch I/O)
// 🔧 v10.5: CONVIVÊNCIA COM FÓRMULA NA COLUNA DE COTAÇÃO (ex: GOOGLEFINANCE).
//   Se a coluna "Cotação Atual" (H) contiver FÓRMULAS do usuário (ex.: =GOOGLEFINANCE
//   ou =IF(...) que puxa da aba Cotacoes_Live), o robô NÃO sobrescreve essa coluna —
//   caso contrário a fórmula seria destruída pelo valor. A sincronização é feita
//   apenas quando a coluna contém valores puros (modo API).
//   Override manual: CONFIG 'CARTEIRA_COTACAO_MODO' = 'formula' | 'api' | 'auto'
//   (padrão 'auto' = detecta fórmula automaticamente).
//

var PortfolioUnified = (function() {
  'use strict';

  /** Lê o modo de cotação da config (auto/formula/api). */
  function _getModoCotacao() {
    try {
      if (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function') {
        var m = String(CONFIG.get('CARTEIRA_COTACAO_MODO', 'auto') || 'auto').toLowerCase();
        if (m === 'formula' || m === 'api' || m === 'auto') return m;
      }
    } catch (e) { /* fallback */ }
    return 'auto';
  }

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

    // 🔧 v10.5: CONVIVÊNCIA COM FÓRMULA — decide se pode escrever na coluna de cotação.
    const modo = _getModoCotacao();
    let colunaTemFormula = false;
    if (modo !== 'api') {
      try {
        const formulas = rangePrecos.getFormulas();
        colunaTemFormula = formulas.some(r => r[0] && String(r[0]).charAt(0) === '=');
      } catch (e) {
        console.warn('⚠️ [PORTFOLIO] Falha ao ler fórmulas da coluna de cotação: ' + e.message);
      }
    }

    // Em modo 'formula' (ou 'auto' com fórmula detectada) NÃO escrevemos a
    // cotação, para preservar a fórmula do usuário (ex.: =GOOGLEFINANCE).
    // 🔧 v10.6: mesmo nesse caso, SEGUIMOS para recalcular os campos derivados
    // (Lucro/Prejuízo, Lucro/Prejuízo % e Participação) — antes o módulo
    // abortava por completo e a carteira ficava com os agregados desatualizados.
    const podeEscreverCotacao = (modo === 'api') || (modo === 'auto' && !colunaTemFormula);
    if (!podeEscreverCotacao) {
      console.log("ℹ️ [PORTFOLIO] Coluna de cotação é alimentada por FÓRMULA (modo=" + modo +
        "). Escrita da cotação pulada; recalculando os campos derivados.");
    }

    const matrizPrecosAtuais = rangePrecos.getValues();

    let atualizados = 0;
    if (podeEscreverCotacao) {
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
      if (atualizados > 0) rangePrecos.setValues(matrizPrecosAtuais);
    }

    // 🔧 v10.6: RECÁLCULO DOS DERIVADOS (em lote, sem tocar na coluna H)
    const linhasDerivadas = _recalcularDerivados(sheet, lastRow, headers, matrizPrecosAtuais);
    if (linhasDerivadas > 0) {
      console.log(`✅ [PORTFOLIO] ${linhasDerivadas} linha(s) com agregados recalculados ` +
        `(Lucro/Prejuízo, % e Participação).`);
    }

    // 5. ESCRITA EM BLOCO / FEEDBACK
    if (atualizados > 0) {
      console.log(`✅ [PORTFOLIO] Sincronização finalizada! ${atualizados} ativos atualizados.`);
      SpreadsheetApp.getActiveSpreadsheet().toast(`Sincronizados ${atualizados} ativos em Lote.`, "B3 PRO", 4);
    } else if (podeEscreverCotacao) {
      console.log("⚠️ [PORTFOLIO] Nenhuma cotação nova retornada pela API.");
    }
  }

  /**
   * Recalcula, em lote, as colunas derivadas da aba 'Carteira':
   *   I  = Lucro/Prejuízo (R$)      = (Cotação − Preço Médio) × Qtd
   *   K  = Lucro/Prejuízo (%)       = (Cotação / Preço Médio) − 1
   *   L  = Participação na Carteira = (Qtd × Cotação) / Total
   *
   * 🔧 v10.6: NÃO toca na coluna H (cotação) — preserva fórmulas do usuário
   * (ex.: =GOOGLEFINANCE). Todas as leituras/gravações são em lote, conforme
   * a regra de otimização de planilhas do projeto.
   *
   * @param {Sheet} sheet aba 'Carteira'.
   * @param {number} lastRow última linha com dados.
   * @param {Array<string>} headers cabeçalho já normalizado (minúsculo).
   * @param {Array<Array>} matrizPrecos matriz [ [cotação], ... ] já resolvida.
   * @return {number} quantidade de linhas efetivamente recalculadas.
   */
  function _recalcularDerivados(sheet, lastRow, headers, matrizPrecos) {
    const idxQtd = headers.findIndex(h => h === 'qtd' || h === 'quantidade');
    const idxPM  = headers.findIndex(h =>
      h.indexOf('preço médio') === 0 || h.indexOf('preco medio') === 0);
    const idxLucroRS = headers.findIndex(h =>
      h.indexOf('lucro/prejuízo') === 0 || h.indexOf('lucro/prejuizo') === 0);
    const idxLucroPct = headers.findIndex(h =>
      h.indexOf('lucro/prejuízo %') === 0 || h.indexOf('lucro/prejuizo %') === 0);
    const idxPart = headers.findIndex(h =>
      h.indexOf('participação') === 0 || h.indexOf('participacao') === 0);

    if (idxQtd === -1 || idxPM === -1 || idxLucroRS === -1) {
      console.log('ℹ️ [PORTFOLIO] Colunas de Qtd/Preço Médio/Lucro não encontradas — ' +
        'recálculo de derivados pulado.');
      return 0;
    }

    const nLinhas = lastRow - 1;
    if (nLinhas <= 0) return 0;

    // 1. LEITURA EM BLOCO
    const qtds = sheet.getRange(2, idxQtd + 1, nLinhas, 1).getValues();
    const pms  = sheet.getRange(2, idxPM + 1, nLinhas, 1).getValues();

    // 1ª passada: resolve as cotações e o total da carteira
    const precos = [];
    let totalCarteira = 0;
    for (let i = 0; i < nLinhas; i++) {
      const pr = parseFloat(matrizPrecos[i] ? matrizPrecos[i][0] : 0) || 0;
      const qtd = parseFloat(qtds[i][0]) || 0;
      precos.push(pr);
      totalCarteira += qtd * pr;
    }

    // 2. PROCESSAMENTO NA MEMÓRIA
    const outLucroRS = [];
    const outLucroPct = [];
    const outPart = [];
    let recalculadas = 0;

    for (let i = 0; i < nLinhas; i++) {
      const qtd = parseFloat(qtds[i][0]) || 0;
      const pm  = parseFloat(pms[i][0]) || 0;
      const pr  = precos[i];

      // Linha inválida (sem Qtd, sem PM ou sem cotação) => limpa os derivados
      if (!(qtd > 0 && pm > 0 && pr > 0)) {
        outLucroRS.push(['']);
        outLucroPct.push(['']);
        outPart.push(['']);
        continue;
      }

      const lucroRS = (pr - pm) * qtd;
      const lucroPct = (pr / pm) - 1;
      const part = totalCarteira > 0 ? ((qtd * pr) / totalCarteira) : 0;

      outLucroRS.push([lucroRS]);
      outLucroPct.push([lucroPct]);
      outPart.push([part]);
      recalculadas++;
    }

    // 3. ESCRITA EM BLOCO (uma chamada por coluna)
    sheet.getRange(2, idxLucroRS + 1, nLinhas, 1).setValues(outLucroRS);
    if (idxLucroPct > -1) sheet.getRange(2, idxLucroPct + 1, nLinhas, 1).setValues(outLucroPct);
    if (idxPart > -1) sheet.getRange(2, idxPart + 1, nLinhas, 1).setValues(outPart);

    // 4. FORMATAÇÃO EM BLOCO
    sheet.getRange(2, idxLucroRS + 1, nLinhas, 1).setNumberFormat('"R$ "#,##0.00');
    if (idxLucroPct > -1) sheet.getRange(2, idxLucroPct + 1, nLinhas, 1).setNumberFormat('0.00%');
    if (idxPart > -1) sheet.getRange(2, idxPart + 1, nLinhas, 1).setNumberFormat('0.00%');

    return recalculadas;
  }

  return {
    syncPortfolio: syncPortfolio
  };

})();

// A declaração MENU_SYNC_PORTFOLIO foi removida daqui para respeitar o 00_Menu_Manager.js