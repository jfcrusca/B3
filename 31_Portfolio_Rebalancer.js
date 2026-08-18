/**
 * 31_Portfolio_Rebalancer.gs — v6.0 (SINCRONIA TOTAL DE ALVOS E STOPS)
 * =============================================================================
 * Finalidade: Cruzar a Carteira Real com a Recomendada e atualizar colunas M..T.
 * Layout Carteira: M(13)=Sugestão, N(14)=Stop Ideal, O(15)=Alvo Ideal, 
 *                  Q(17)=Alvo 1, R(18)=Alvo 2.
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
      // Ticker(B)=1, Stop(F)=5, Alvo(G)=6, Qtd(H)=7, Score(K)=10, Instrução(L)=11
      const dataIdeal = sheetIdeal.getDataRange().getValues();
      const mapaIdeal = {};
      
      for (let i = CONFIG.LINE_START_IDEAL - 1; i < dataIdeal.length; i++) {
        const t = String(dataIdeal[i][4]).trim().toUpperCase();
        if (t && t.length > 2) {
          mapaIdeal[t] = {
            stop: dataIdeal[i][5],
            alvo: dataIdeal[i][6],
            qtdSugerida: dataIdeal[i][7],
            instrucao: dataIdeal[i][8]
          };
        }
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
          
          updates.push({ row, acao, stop, alvo });
        } else if (qtdAtual > 0) {
          // Ativo não é mais recomendado (Saiu do Radar Sniper)
          acao = "VENDER (SAIU DO RADAR) ⚠️";
          updates.push({ row, acao, stop: "---", alvo: "---" });
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

      // 3. ESCRITA CIRÚRGICA (Sincronizando as colunas N, Q, R solicitadas)
      updates.forEach(up => {
        // M (13) = SUGESTÃO
        sheetReal.getRange(up.row, 13).setValue(up.acao).setFontWeight("bold");

        if (typeof up.stop === "number" && up.stop > 0) {
          // N (14) = STOP IDEAL
          sheetReal.getRange(up.row, 14).setValue(up.stop).setNumberFormat('"R$ "#,##0.00');
          // O (15) = ALVO IDEAL
          sheetReal.getRange(up.row, 15).setValue(up.alvo).setNumberFormat('"R$ "#,##0.00');
          // Q (17) = ALVO 1 (Pode ser igual ao Ideal ou Alvo - 1 ATR)
          sheetReal.getRange(up.row, 17).setValue(up.alvo).setNumberFormat('"R$ "#,##0.00');
          // R (18) = ALVO 2 (10% acima do Alvo 1 para Swing longo)
          sheetReal.getRange(up.row, 18).setValue(up.alvo * 1.10).setNumberFormat('"R$ "#,##0.00');
          
          sheetReal.getRange(up.row, 13, 1, 6).setBackground("#f3f3f3"); // Feedback visual
        } else {
          // Limpa campos se não houver alvo válido
          sheetReal.getRange(up.row, 14, 1, 5).setValue("-");
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