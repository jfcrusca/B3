/**
 * =============================================================================
 * 00_SheetWriter.js — ALIAS OFICIAL (v3.0 — CONSOLIDAÇÃO DEFINITIVA)
 * =============================================================================
 * 🔧 v3.0 — POR QUE ESTE ARQUIVO MUDOU
 * -----------------------------------------------------------------------------
 * HISTÓRICO DO BUG: existiam DUAS implementações independentes de gravação em
 * 'Resultados_Analise', cada uma com seu próprio código:
 *
 *   • 00_SheetWriter.js   → _opParaLinha()  + CFG_T1R/T2R locais
 *   • 08_Output_Unified.js → _toRow()       + CFG_T1R/T2R locais
 *
 * O '08' tentava resolver a colisão com um guard frágil:
 *     if (typeof SheetWriter === 'undefined') { var SheetWriter = OutputManager; }
 *
 * Como o Apps Script avalia todos os arquivos no MESMO escopo global (em ordem
 * alfabética) e ambos usam `var`, a atribuição era reavaliada/sobrescrita de
 * forma imprevisível. O Orchestrator fazia `CoreRegistry.get('SheetWriter')` e
 * NÃO SABIA qual das duas implementações recebia.
 *
 * CONSEQUÊNCIA OBSERVADA (caso BPAC11):
 *   A linha ficou com Fibonacci = 53,98 (col 18) e Topo50 = 61,67 (col 23),
 *   valores MATEMATICAMENTE INCOMPATÍVEIS entre si — prova de que colunas
 *   diferentes foram gravadas por implementações diferentes (ou em execuções
 *   diferentes), corrompendo o registro.
 *
 * SOLUÇÃO: este arquivo deixa de ter lógica de escrita. É um ALIAS EXPLÍCITO
 * para o `OutputManager` do 08_Output_Unified.js, que passa a ser a ÚNICA fonte
 * de verdade. A ordem de carregamento não importa mais porque não há segunda
 * implementação para colidir.
 *
 * ⚠️ NÃO reintroduza _opParaLinha() aqui. Qualquer ajuste de layout deve ser
 *    feito em 08_Output_Unified.js (_toRow + OutputConfig.HEADERS).
 *
 * Integração:
 *   - Registrado no CoreRegistry como 'SheetWriter' (compatibilidade)
 *   - Chamado pelo Orchestrator._processarSaidasFinais()
 * =============================================================================
 */

'use strict';

/**
 * Alias oficial. Definido como `var` para ser visível globalmente no GAS,
 * mas SEM lógica própria — apenas aponta para o OutputManager.
 */
var SheetWriter = (function () {
  'use strict';

  /** Nome canônico da aba (mantido para consumidores que consultam). */
  var SHEET_NAME = 'Resultados_Analise';

  /**
   * Resolve o escritor canônico (OutputManager de 08_Output_Unified.js).
   * @return {Object|null} OutputManager ou null se indisponível.
   */
  function _resolver() {
    if (typeof OutputManager !== 'undefined' && OutputManager &&
        typeof OutputManager.saveAnalysisResults === 'function') {
      return OutputManager;
    }
    console.error('❌ [SheetWriter] OutputManager (08_Output_Unified.js) não disponível. ' +
      'Verifique se o arquivo 08 está no projeto.');
    return null;
  }

  /**
   * Salva a lista completa em 'Resultados_Analise' (delega ao OutputManager).
   * @param {Array} listaCompleta lista de oportunidades/resultados.
   * @return {boolean} true se gravou.
   */
  function saveAnalysisResults(listaCompleta) {
    var writer = _resolver();
    if (!writer) return false;

    // Validação defensiva: o OutputManager espera um array não vazio.
    if (!listaCompleta || !Array.isArray(listaCompleta) || listaCompleta.length === 0) {
      console.log('ℹ️ [SheetWriter] Lista vazia — nada a gravar.');
      return false;
    }

    try {
      writer.saveAnalysisResults(listaCompleta);
      return true;
    } catch (e) {
      // 🔧 v3.0: erro PROPAGADO (não engolido) — o Orchestrator precisa saber.
      console.error('❌ [SheetWriter] Falha ao gravar: ' + e.message);
      throw e;
    }
  }

  /** Limpa a aba 'Resultados_Analise' (delega ao OutputManager). */
  function clearSheet() {
    var writer = _resolver();
    if (!writer || typeof writer.clearSheet !== 'function') return false;
    try {
      writer.clearSheet();
      return true;
    } catch (e) {
      console.error('❌ [SheetWriter] Falha ao limpar: ' + e.message);
      throw e;
    }
  }

  return {
    SHEET_NAME: SHEET_NAME,
    saveAnalysisResults: saveAnalysisResults,
    clearSheet: clearSheet
  };
})();

// =============================================================================
// VALIDAR_INTEGRIDADE_RESULTADOS — DIAGNÓSTICO DE LINHAS CORROMPIDAS
// =============================================================================
// Detecta a assinatura de LINHAS MISTURADAS (dados de execuções diferentes),
// o padrão que produziu a linha impossível do BPAC11:
//   Stop R$ 57,15  +  Risco 6,93%   (57,15 daria 10,00%)
//   Alvo1 R$ 61,67 +  Alvo2 R$ 63,93  (fontes distintas)
//   ATR 2 (arredondado) e Alerta Segurança VAZIO (o _toRow nunca escreve vazio)
//
// Uso: rode VALIDAR_INTEGRIDADE_RESULTADOS() pelo menu/editor.
// =============================================================================
function VALIDAR_INTEGRIDADE_RESULTADOS() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Resultados_Analise');
  if (!sheet) {
    console.error("❌ Aba 'Resultados_Analise' não encontrada.");
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    console.log("ℹ️ 'Resultados_Analise' vazia — nada a validar.");
    b3UiAlertIntegridade_('✅ Integridade OK', 'A aba está vazia. Rode o scanner para popular.');
    return;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 27).getValues();
  const problemas = [];

  // Índices (0-based) conforme OutputConfig.HEADERS
  const IDX = {
    DATA: 0, TICKER: 1, PRECO: 2, SCORE: 3, SETUP: 4,
    STOP: 6, ALVO1: 7, ALVO2: 8, RR: 9, RISCO: 10,
    ATR: 15, ALERTA: 22, TOPO50: 23
  };

  data.forEach(function (r, i) {
    const linha = i + 2;
    const ticker = String(r[IDX.TICKER] || '').trim();
    if (!ticker) return;

    const preco = Number(r[IDX.PRECO]) || 0;
    const stop = Number(r[IDX.STOP]) || 0;
    const alvo1 = Number(r[IDX.ALVO1]) || 0;
    const alvo2 = Number(r[IDX.ALVO2]) || 0;
    const rr = Number(r[IDX.RR]) || 0;
    const riscoNum = Number(String(r[IDX.RISCO] || '').replace('%', '').replace(',', '.')) || 0;
    const alerta = String(r[IDX.ALERTA] || '');
    const atr = Number(r[IDX.ATR]) || 0;

    const erros = [];

    // ── 1. Alvo ABAIXO do preço em setup de COMPRA (impossível) ────────────
    if (preco > 0 && alvo1 > 0 && alvo1 < preco) {
      erros.push('Alvo1 (R$ ' + alvo1.toFixed(2) + ') ABAIXO do preço (R$ ' + preco.toFixed(2) + ')');
    }
    if (preco > 0 && alvo2 > 0 && alvo2 < preco) {
      erros.push('Alvo2 (R$ ' + alvo2.toFixed(2) + ') ABAIXO do preço');
    }

    // ── 2. Stop ACIMA do preço (impossível para compra) ────────────────────
    if (preco > 0 && stop > 0 && stop >= preco) {
      erros.push('Stop (R$ ' + stop.toFixed(2) + ') >= preço (R$ ' + preco.toFixed(2) + ')');
    }

    // ── 3. Risco % incoerente com o Stop ───────────────────────────────────
    if (preco > 0 && stop > 0 && stop < preco && riscoNum > 0) {
      const riscoCalc = ((preco - stop) / preco) * 100;
      if (Math.abs(riscoCalc - riscoNum) > 0.15) {
        erros.push('Risco ' + riscoNum.toFixed(2) + '% != ' + riscoCalc.toFixed(2) +
          '% (stop R$ ' + stop.toFixed(2) + ')');
      }
    }

    // ── 4. R/R incoerente com Alvo1 e Stop ─────────────────────────────────
    if (preco > 0 && stop > 0 && stop < preco && alvo1 > preco && rr > 0) {
      const rrCalc = (alvo1 - preco) / (preco - stop);
      if (Math.abs(rrCalc - rr) > 0.05) {
        erros.push('R/R ' + rr.toFixed(2) + ' != ' + rrCalc.toFixed(2) +
          ' (alvo1 R$ ' + alvo1.toFixed(2) + ' / risco R$ ' + (preco - stop).toFixed(2) + ')');
      }
    }

    // ── 5. Alerta Segurança vazio (o _toRow escreve '-' sempre) ────────────
    if (alerta === '') {
      erros.push('Alerta Segurança VAZIO (deveria ser "-" ou o alerta)');
    }

    // ── 6. Stop absurdamente distante em ATR (sinal de fonte misturada) ────
    if (atr > 0 && stop > 0 && stop < preco) {
      const atrs = (preco - stop) / atr;
      if (atrs > 4) {
        erros.push('Stop a ' + atrs.toFixed(1) + ' x ATR (max. recomendado 2,5)');
      }
    }

    if (erros.length > 0) {
      problemas.push('Linha ' + linha + ' [' + ticker + ']: ' + erros.join(' | '));
    }
  });

  if (problemas.length === 0) {
    console.log('✅ [Integridade] ' + data.length + ' linhas verificadas — nenhuma inconsistência.');
    b3UiAlertIntegridade_('✅ Integridade OK',
      data.length + ' linha(s) verificada(s).\n\nNenhuma inconsistência encontrada.');
    return;
  }

  const msg = problemas.length + ' linha(s) com PROBLEMA:\n\n' + problemas.join('\n');
  console.error('🔴 [Integridade] ' + msg);
  b3UiAlertIntegridade_('🔴 LINHAS CORROMPIDAS DETECTADAS', msg.slice(0, 2500));
}

/** Wrapper de UI resiliente (funciona em menu e em gatilho). */
function b3UiAlertIntegridade_(titulo, mensagem) {
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui && typeof ui.alert === 'function') {
      ui.alert(titulo, mensagem, ui.ButtonSet.OK);
      return;
    }
  } catch (e) { /* contexto sem UI */ }
  console.log('[' + titulo + '] ' + mensagem);
}
