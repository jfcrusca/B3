/**
 * 31_Portfolio_Rebalancer.gs — v6.1 (SINCRONIA TOTAL DE ALVOS E STOPS)
 * =============================================================================
 * Finalidade: Cruzar a Carteira Real com a Recomendada e atualizar colunas M..T.
 * 🔧 v6.1: Mapa de colunas (1-based getRange) alinhado ao cabeçalho REAL da aba
 *          'Carteira' (A..S / 19 colunas):
 *          M(13)=🤖 SUGESTÃO | N(14)=🛑 STOP IDEAL | O(15)=🎯 ALVO IDEAL
 *          P(15→16)=🛡️ SEU STOP (OCO) [NÃO sobrepor] | Q(17)=🏁 ALVO 1 | R(18)=🏁 ALVO 2
 *          S(19)=📊 ALVO MÉDIO | T(20)=💸 RISCO R$
 *          Correções: (a) preenchimento em lote no ramo "limpar";
 *                     (b) preenche ALVO MÉDIO (S) e RISCO R$ (T).
 * =============================================================================
 */

var PortfolioRebalancer = (function() {
  'use strict';

  const CONFIG = {
    SHEET_REAL: "Carteira",
    SHEET_IDEAL: "Resumo_Trades_Aprovados",
    SHEET_RELATORIO: "Relatorio_Rebalanceamento",
    COL_TICKER_REAL: 1, // B
    COL_QTD_REAL: 2,    // C
    COL_TICKER_IDEAL: 1,// B
    LINE_START_IDEAL: 6 // Pula painel educativo do Módulo 30 [1]
  };

  return {
     /** Função principal de sincronização (Versão Resiliente) */
    executarSincronizacao: function() {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      
      // Função auxiliar para encontrar aba ignorando espaços e maiúsculas
      const getSheetRobust = (name) => {
        return ss.getSheetByName(name) || 
               ss.getSheets().find(s => s.getName().trim().toUpperCase() === name.toUpperCase());
      };

      const sheetReal = getSheetRobust(CONFIG.SHEET_REAL);
      const sheetIdeal = getSheetRobust(CONFIG.SHEET_IDEAL);

      if (!sheetReal || !sheetIdeal) {
        const erroMsg = !sheetReal ? CONFIG.SHEET_REAL : CONFIG.SHEET_IDEAL;
        console.error(`❌ Erro Fatal: Aba [${erroMsg}] não encontrada. Verifique espaços no nome da aba.`);
        return;
      }

      // 1. MAPEIA RECOMENDAÇÕES (O que o robô quer) [2, 3]
      // 🔧 CORREÇÃO v12.8: alinhado com o layout REAL gravado por 41_Ranker.js
      //   (linha 6 = cabeçalho; dados a partir da linha 7). Índices 0-based:
      //   A(0)=DATA/HORA, B(1)=STATUS, C(2)=TICKER, D(3)=SETOR, E(4)=SETUP,
      //   F(5)=PREÇO ATUAL, G(6)=ENTRADA FIBO, H(7)=STOP, I(8)=ALVO,
      //   J(9)=QTD, K(10)=ALOCAÇÃO %, L(11)=R/R, M(12)=SCORE, N(13)=ESTRATÉGIA.
      const IDX_IDEAL = { TICKER: 2, STOP: 7, ALVO: 8, QTD: 9, ESTRATEGIA: 13 };
      const dataIdeal = sheetIdeal.getDataRange().getValues();
      const mapaIdeal = {};

      for (let i = CONFIG.LINE_START_IDEAL - 1; i < dataIdeal.length; i++) {
        const t = String(dataIdeal[i][IDX_IDEAL.TICKER]).trim().toUpperCase();
        if (t && t.length > 2) {
          mapaIdeal[t] = {
            stop: dataIdeal[i][IDX_IDEAL.STOP],
            alvo: dataIdeal[i][IDX_IDEAL.ALVO],
            qtdSugerida: dataIdeal[i][IDX_IDEAL.QTD],
            instrucao: dataIdeal[i][IDX_IDEAL.ESTRATEGIA]
          };
        }
      }

      // 🔧 v6.1: GUARDA — se o Resumo_Trades_Aprovados estiver VAZIO (Ranker nunca
      // rodou), abortar. Sem isso, TODOS os ativos da carteira seriam marcados
      // injustamente como "VENDER (SAIU DO RADAR)" — falso positivo perigoso.
      if (Object.keys(mapaIdeal).length === 0) {
        console.warn('⚠️ [Rebalancer] Resumo_Trades_Aprovados vazio (dados a partir da linha ' +
          CONFIG.LINE_START_IDEAL + '). Rode primeiro o Ranker (🏆 Executar Ranker Manual). ' +
          'Sincronização de stops/alvos ABORTADA para não marcar ativos como VENDER indevidamente.');
        if (typeof b3UiAlert === 'function') {
          b3UiAlert('Rebalancer', '⚠️ A aba "Resumo_Trades_Aprovados" está vazia. Rode o Ranker (menu 🧠 B3: CÉREBRO > 🏆 Executar Ranker Manual) antes de sincronizar a carteira.');
        }
        return;
      }

      // 2. PROCESSA CARTEIRA REAL (O que você tem) [9, 10]
      const dataReal = sheetReal.getDataRange().getValues();
      const updates = [];
      const ordensParaRelatorio = [];

      for (let i = 1; i < dataReal.length; i++) {
        const ticker = String(dataReal[i][CONFIG.COL_TICKER_REAL]).trim().toUpperCase();
        if (!ticker || ticker === "PAPEL") continue;

        const qtdAtual = parseFloat(dataReal[i][CONFIG.COL_QTD_REAL]) || 0;
        const ideal = mapaIdeal[ticker];
        const row = i + 1;

        let acao = "MANTER ✅";
        let stop = "-";
        let alvo = "-";

        if (ideal) {
          // Ativo está no radar de compra/manutenção
          stop = ideal.stop;
          alvo = ideal.alvo;
          
          if (ideal.qtdSugerida > qtdAtual * 1.1) acao = "AUMENTAR 📈";
          else if (ideal.qtdSugerida < qtdAtual * 0.9 && qtdAtual > 0) acao = "REDUZIR 📉";
          else if (qtdAtual === 0) acao = "NOVA COMPRA 🚀";
          
          updates.push({ row, acao, stop, alvo, qtd: qtdAtual });
        } else if (qtdAtual > 0) {
          // Ativo não é mais recomendado (Saiu do Radar Sniper)
          acao = "VENDER (SAIU DO RADAR) ⚠️";
          updates.push({ row, acao, stop: "---", alvo: "---", qtd: qtdAtual });
        }
        
        if (acao.includes("VENDER") || acao.includes("AUMENTAR") || acao.includes("NOVA")) {
           // Substitua a linha que cria ordensParaRelatorio por:

if (acao.includes("VENDER") || acao.includes("AUMENTAR") || acao.includes("NOVA")) {
  ordensParaRelatorio.push([
    new Date(),                    // A: Data
    ticker,                        // B: Ação (ticker)
    acao,                          // C: Situação
    qtdAtual,                      // D: Qtd. Atual
    ideal ? ideal.qtdSugerida : 0, // E: Qtd. Sugerida
    "-",                           // F: Preço Atual
    "-",                           // G: Preço Médio
    "Ajuste Sniper"                // H: Observação
  ]);
}
        }
      }

      // 3. ESCRITA CIRÚRGICA — colunas de GESTÃO do robô (1-based getRange).
      //    M=13 SUGESTÃO | N=14 STOP IDEAL | O=15 ALVO IDEAL | Q=17 ALVO1 | R=18 ALVO2
      //    S=19 ALVO MÉDIO | T=20 RISCO R$.  P=16 é o SEU STOP (OCO) — NÃO sobrepor.
      const FMT_BRL = '"R$ "#,##0.00';
      updates.forEach(up => {
        // M (13) = SUGESTÃO (ação recomendada)
        sheetReal.getRange(up.row, 13).setValue(up.acao).setFontWeight("bold");

        if (typeof up.stop === "number" && up.stop > 0) {
          const alvo1 = up.alvo;
          const alvo2 = up.alvo * 1.10;               // Swing longo: +10% sobre o Alvo 1
          const alvoMedio = (alvo1 + alvo2) / 2;      // 📊 ALVO MÉDIO = média dos parciais
          // 💸 RISCO R$ = (cotação atual - stop) * quantidade.
          // 🔧 v6.1: a cotação (col H) pode ser uma FÓRMULA do usuário (ex.: GOOGLEFINANCE)
          // e estar momentaneamente vazia/#N/A. Nesse caso, cai para a cotação do DataService.
          let cotacaoAtual = parseFloat(sheetReal.getRange(up.row, 8).getValue()) || 0;
          if (cotacaoAtual <= 0 && typeof DataService !== 'undefined' && typeof DataService.getPrecoAtual === 'function') {
            try {
              const q = DataService.getPrecoAtual(ticker);
              if (q && q.price > 0) cotacaoAtual = q.price;
            } catch (e) { /* mantém 0 */ }
          }
          const riscoRs = (cotacaoAtual > 0 && up.qtd > 0) ? Math.max(0, (cotacaoAtual - up.stop) * up.qtd) : 0;

          sheetReal.getRange(up.row, 14).setValue(up.stop).setNumberFormat(FMT_BRL);   // N STOP IDEAL
          sheetReal.getRange(up.row, 15).setValue(alvo1).setNumberFormat(FMT_BRL);     // O ALVO IDEAL
          sheetReal.getRange(up.row, 17).setValue(alvo1).setNumberFormat(FMT_BRL);     // Q ALVO 1 (50%)
          sheetReal.getRange(up.row, 18).setValue(alvo2).setNumberFormat(FMT_BRL);     // R ALVO 2 (50%)
          sheetReal.getRange(up.row, 19).setValue(alvoMedio).setNumberFormat(FMT_BRL); // S ALVO MÉDIO
          sheetReal.getRange(up.row, 20).setValue(riscoRs).setNumberFormat(FMT_BRL);   // T RISCO R$

          sheetReal.getRange(up.row, 13, 1, 8).setBackground("#f3f3f3"); // Feedback visual (M..T)
        } else {
          // Limpa campos de gestão (N..T) — preenchimento EM LOTE (não só a 1ª célula)
          const vazio = [['-', '-', '-', '-', '-', '-', '-']]; // N,O,P,Q,R,S,T
          sheetReal.getRange(up.row, 14, 1, 7).setValues(vazio);
        }
      });

      this._gerarRelatorioFinal(ss, ordensParaRelatorio);
      console.log("✅ [Rebalancer] Colunas N, Q e R sincronizadas com sucesso.");
    },

    /** Gera o log de movimentações na aba de Relatório [11, 12] */
    _gerarRelatorioFinal: function(ss, rows) {
      const sheet = ss.getSheetByName(CONFIG.SHEET_RELATORIO);
      if (!sheet || rows.length === 0) return;
      
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, 8).setValues(rows);
    }
  };
})();

/** Ponto de entrada global para o Menu Triade [13] */
function EXECUTAR_SINCRONIZACAO_CARTEIRAS() {
  PortfolioRebalancer.executarSincronizacao();
}