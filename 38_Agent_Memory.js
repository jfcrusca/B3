/******************************************************************************/
// 📦 MÓDULO/ARQUIVO: 38_Agent_Memory.gs
// 🛠️  TECNOLOGIA: JAVASCRIPT (V8 / Google Apps Script)
// 📌  VERSÃO: 39.1 — INTEGRAÇÃO COM PERFORMANCE_MANAGER (MÓDULO 52)
// =============================================================================
// CORREÇÕES v39.1 (Integração B3-v10):
//   ✅ Busca de performance alinhada ao Módulo 52 (lê Linha 2 de Log_Performance)
//   ✅ Parsing robusto para converter "90.96%" em float.
//   ✅ Inclusão do Total de Trades no contexto descritivo para o LLM.
//   ✅ Mantidos todos os paradigmas v39.0 (sem comandos imperativos, 
//      penalidades diretas, e drawdown com 3 níveis).
// =============================================================================
/******************************************************************************/

var AgentMemory = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // CONFIGURAÇÕES
  // ---------------------------------------------------------------------------

  const CFG = {
    // Limites de Win Rate para classificação do regime
    WIN_RATE_CRITICO  : 35.0,   // Abaixo → CRITICO
    WIN_RATE_ALERTA   : 45.0,   // Abaixo → MODERADO
    WIN_RATE_NORMAL   : 55.0,   // Abaixo → LEVE, acima → NORMAL

    // Limites de P&L por ticker para bias na aba 'Carteira'
    PREJUIZO_BAD      : -100.0, // R$ → marca ticker como BAD
    LUCRO_GOOD        :  +50.0, // R$ → marca ticker como GOOD

    // Penalidades em pontos de score (aplicadas pelo módulo 35, não pelo LLM)
    PENALTY_DRAWDOWN_LEVE    :  -3,
    PENALTY_DRAWDOWN_MODERADO: -8,
    PENALTY_DRAWDOWN_CRITICO : -15,
    PENALTY_BAD_TICKER       : -10,
    BONUS_GOOD_TICKER        :  +5,

    // Planilhas
    ABA_CARTEIRA : 'Carteira',
    COL_TICKER   : 1,   // índice na linha (0-based após getValues)
    COL_LUCRO    : 8,   // índice na linha (0-based após getValues)
    ABA_LOG_PERF : 'Log_Performance'
  };

  function _cfg(key, fallback) {
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function') ? CONFIG.get(key, fallback) : fallback;
  }

  // ---------------------------------------------------------------------------
  // API PÚBLICA
  // ---------------------------------------------------------------------------

  /**
   * Retorna o contexto histórico do ativo para consumo pelo módulo 35.
   *
   * CONTRATO DE RETORNO:
   * {
   * text          : string   — fatos históricos descritivos (vai ao LLM como contexto)
   * isBadTicker   : boolean  — ticker com prejuízo recorrente
   * isGoodTicker  : boolean  — ticker com histórico positivo
   * inDrawdown    : boolean  — portfólio em regime de alerta ou pior
   * drawdownLevel : string   — 'NORMAL' | 'LEVE' | 'MODERADO' | 'CRITICO'
   * winRate       : number   — win rate atual em %
   * penaltyPoints : number   — delta a aplicar no score (negativo = penalidade)
   * }
   *
   * @param {string} ticker
   * @param {string} [setupType]
   */
  function getContext(ticker, setupType) {
    console.log(`🧠 [Agent Memory] Recuperando contexto para ${ticker}...`);

    const perf       = _getRecentPerformance();
    const tickerBias = _getTickerBias(ticker);
    const tickerWR = _getTickerWinRate(ticker);
    const level      = _classifyDrawdown(perf.winRate);
    const inDrawdown = (level !== 'NORMAL');

    // ------------------------------------------------------------------
    // TEXTO DESCRITIVO — fatos, nunca ordens
    // O LLM usa isso como contexto informativo para calibrar o ai_score.
    // NÃO deve conter verbos imperativos nem regras de veto.
    // ------------------------------------------------------------------
    const linhas = [];
    
    // Frase base enriquecida com a amostragem de trades (se disponível)
    if (perf.totalTrades > 0) {
        linhas.push(`Portfólio: Win Rate atual = ${perf.winRate}% em ${perf.totalTrades} operações validadas (regime ${level}).`);
    } else {
        linhas.push(`Portfólio: Win Rate atual = ${perf.winRate}% (regime ${level}).`);
    }

    if (level === 'CRITICO') {
      linhas.push(`Histórico recente indica fase de drawdown crítico. Cautela elevada esperada no mercado.`);
    } else if (level === 'MODERADO') {
      linhas.push(`Portfólio em drawdown moderado. O mercado exige maior confirmação de volume.`);
    } else if (level === 'LEVE') {
      linhas.push(`Portfólio levemente abaixo da média histórica. Cenário pede monitoramento das novas posições.`);
    } else {
      linhas.push(`Portfólio operando em regime normal de performance.`);
    }

    if (tickerBias === 'BAD') {
      linhas.push(`${ticker}: histórico de prejuízo recente (> R$ ${Math.abs(Number(_cfg('PREJUIZO_BAD_TICKER', CFG.PREJUIZO_BAD)))}). O histórico indica baixo índice de acerto neste ativo.`);
    } else if (tickerBias === 'GOOD') {
      linhas.push(`${ticker}: histórico positivo recente (lucro > R$ ${Number(_cfg('LUCRO_GOOD_TICKER', CFG.LUCRO_GOOD))}). Ativo apresenta boa aderência operacional recente.`);
    } else {
      linhas.push(`${ticker}: sem histórico operacional relevante registrado na carteira.`);
    }

    // ------------------------------------------------------------------
    // PENALIDADE EM PONTOS — calculada aqui, aplicada pelo módulo 35
    // Totalmente fora do contexto que vai ao LLM
    // ------------------------------------------------------------------
    let penaltyPoints = 0;

    if (level === 'LEVE')     penaltyPoints += Number(_cfg('PENALTY_DRAWDOWN_LEVE', CFG.PENALTY_DRAWDOWN_LEVE));
    if (level === 'MODERADO') penaltyPoints += Number(_cfg('PENALTY_DRAWDOWN_MODERADO', CFG.PENALTY_DRAWDOWN_MODERADO));
    if (level === 'CRITICO')  penaltyPoints += Number(_cfg('PENALTY_DRAWDOWN_CRITICO', CFG.PENALTY_DRAWDOWN_CRITICO));

    if (tickerBias === 'BAD')  penaltyPoints += Number(_cfg('PENALTY_BAD_TICKER', CFG.PENALTY_BAD_TICKER));
    if (tickerBias === 'GOOD') penaltyPoints += Number(_cfg('BONUS_GOOD_TICKER', CFG.BONUS_GOOD_TICKER));

        // ✅ Histórico estatístico do ativo (Win Rate)
    if (tickerWR) {
    if (tickerWR.winRate < Number(_cfg('TICKER_WINRATE_LOW', 45)))  penaltyPoints += Number(_cfg('PENALTY_TICKER_WINRATE_LOW', -5));
    if (tickerWR.winRate > Number(_cfg('TICKER_WINRATE_HIGH', 65)))  penaltyPoints += Number(_cfg('BONUS_TICKER_WINRATE_HIGH', 5));
    }

    return {
      text          : linhas.join(' '),
      isBadTicker   : (tickerBias === 'BAD'),
      isGoodTicker  : (tickerBias === 'GOOD'),
      inDrawdown    : inDrawdown,
      drawdownLevel : level,
      winRate       : perf.winRate,
      penaltyPoints : penaltyPoints
    };
  }

  // ---------------------------------------------------------------------------
  // PRIVADOS
  // ---------------------------------------------------------------------------

  /**
   * Classifica o regime de drawdown baseado no win rate.
   * @param {number} winRate
   * @returns {'NORMAL'|'LEVE'|'MODERADO'|'CRITICO'}
   */
  function _classifyDrawdown(winRate) {
    if (winRate < Number(_cfg('WIN_RATE_CRITICO', CFG.WIN_RATE_CRITICO)))  return 'CRITICO';
    if (winRate < Number(_cfg('WIN_RATE_ALERTA', CFG.WIN_RATE_ALERTA)))   return 'MODERADO';
    if (winRate < Number(_cfg('WIN_RATE_NORMAL', CFG.WIN_RATE_NORMAL)))   return 'LEVE';
    return 'NORMAL';
  }

  /**
   * Lê a última atualização do Log_Performance (gerado pelo Módulo 52).
   * Fallback neutro (50%) se a aba não existir ou estiver vazia.
   * @returns {{ winRate: number, totalTrades: number }}
   */
  function _getRecentPerformance() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CFG.ABA_LOG_PERF);

    if (!sheet || sheet.getLastRow() < 2) {
      console.warn(
        `⚠️ [AgentMemory] Aba '${CFG.ABA_LOG_PERF}' não encontrada ou sem dados. Usando Win Rate 50%.`
      );
      return { winRate: 50, totalTrades: 0 };
    }

    // ✅ Primeiro: lê os valores
    const valores = sheet.getRange(2, 1, 1, 6).getValues()[0];

    // valores esperados:
    // [0]=Data, [1]=Total Trades, [2]=Vitórias, [3]=Derrotas, [4]=Empates, [5]=Win Rate %
    const totalTrades = parseInt(valores[1], 10);

    // ✅ Validação estrutural
    if (isNaN(totalTrades) || totalTrades < 0) {
      console.warn(
        `⚠️ [AgentMemory] Linha 2 inválida em '${CFG.ABA_LOG_PERF}'. Usando Win Rate 50%.`
      );
      return { winRate: 50, totalTrades: 0 };
    }

    const rawWR = valores[5];
    let winRate;

    if (typeof rawWR === 'string' && rawWR.includes('%')) {
      winRate = parseFloat(rawWR.replace('%', '').replace(',', '.'));
    } else if (typeof rawWR === 'number') {
      winRate = rawWR <= 1 ? rawWR * 100 : rawWR;
    } else {
      winRate = 50;
    }

    if (isNaN(winRate)) winRate = 50;

    return {
      winRate: parseFloat(winRate.toFixed(2)),
      totalTrades: totalTrades
    };

  } catch (e) {
    console.warn(`⚠️ [AgentMemory] Falha ao ler performance: ${e.message}`);
    return { winRate: 50, totalTrades: 0 };
  }
}

  /**
   * Identifica o bias histórico de um ticker na aba Carteira.
   * Considera todas as linhas do ticker (não apenas a primeira ocorrência).
   * @param {string} ticker
   * @returns {'BAD'|'GOOD'|'NEUTRAL'}
   */
  function _getTickerBias(ticker) {
    try {
      const ss    = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(CFG.ABA_CARTEIRA);
      if (!sheet) return 'NEUTRAL';

      const data           = sheet.getDataRange().getValues();
      const tickerUpper    = ticker.toUpperCase();
      let   lucroAcumulado = 0;
      let   encontrou      = false;

      // Ignora cabeçalho (i=1), acumula P&L de todas as linhas do ticker
      for (let i = 1; i < data.length; i++) {
        const papel = String(data[i][CFG.COL_TICKER]).trim().toUpperCase();
        if (papel !== tickerUpper) continue;

        encontrou = true;
        const pl  = parseFloat(data[i][CFG.COL_LUCRO]) || 0;
        lucroAcumulado += pl;
      }

      if (!encontrou) return 'NEUTRAL';

      if (lucroAcumulado < Number(_cfg('PREJUIZO_BAD_TICKER', CFG.PREJUIZO_BAD))) return 'BAD';
      if (lucroAcumulado > Number(_cfg('LUCRO_GOOD_TICKER', CFG.LUCRO_GOOD)))   return 'GOOD';
      return 'NEUTRAL';

    } catch (e) {
      console.warn(`⚠️ [AgentMemory] Falha ao ler bias de ${ticker}: ${e.message}`);
      return 'NEUTRAL';
    }
  }
function _getTickerWinRate(ticker) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CFG.ABA_LOG_PERF);
    if (!sheet || sheet.getLastRow() < 3) return null;

    const data = sheet
      // Linha 3 em diante: ignora cabeçalho (1) e resumo (2)
      .getRange(3, 1, sheet.getLastRow() - 2, sheet.getLastColumn())
      .getValues();

    const tickerUp = ticker.toUpperCase();
    let total = 0;
    let wins  = 0;

    // 🔁 Janela rolling 12 meses
    const hoje = new Date();
    const limite = new Date(hoje);
    limite.setMonth(limite.getMonth() - 12);

    for (let i = 0; i < data.length; i++) {
      const dataEntrada = data[i][0]; // Coluna A — Data Entrada
      const papel       = String(data[i][1]).toUpperCase(); // Coluna B — Ticker
      const status      = String(data[i][8]).toUpperCase(); // Coluna I — Status

      // Validações básicas
      if (!(dataEntrada instanceof Date)) continue;
      if (dataEntrada < limite) continue;
      if (papel !== tickerUp) continue;

      total++;
      if (status === 'GAIN') wins++;
    }

    // Mínimo estatístico
    if (total < 5) return null;

    return {
      total,
      winRate: parseFloat(((wins / total) * 100).toFixed(2)),
      window: '12M'
    };

  } catch (e) {
    console.warn(
      `⚠️ [AgentMemory] Falha no Win Rate rolling 12M de ${ticker}: ${e.message}`
    );
    return null;
  }
}
  // ---------------------------------------------------------------------------
  // EXPORT
  // ---------------------------------------------------------------------------

  return {
    getContext,
    // Expostos para testes
    _classifyDrawdown,
    _getRecentPerformance
  };

})();







function TESTAR_INTEGRACAO_MEMORIA() {
  const ui = SpreadsheetApp.getUi();
  try {
    // Finge que o robô está analisando PETR4
    const contexto = AgentMemory.getContext('PETR4');
    
    let msg = "✅ DIAGNÓSTICO DO AGENT MEMORY B3-v10\n\n";
    
    msg += "1️⃣ Texto que será enviado para o LLM (IA):\n";
    msg += "« " + contexto.text + " »\n\n";
    
    msg += "2️⃣ Impacto Matemático (Invisível para a IA):\n";
    msg += "• Regime de Risco: " + contexto.drawdownLevel + "\n";
    msg += "• Pontos de Penalidade/Bônus no Score: " + contexto.penaltyPoints + " pts\n";
    msg += "• Ativo Bom (Good Ticker)? " + (contexto.isGoodTicker ? "Sim" : "Não") + "\n";
    msg += "• Ativo Ruim (Bad Ticker)? " + (contexto.isBadTicker ? "Sim" : "Não");
    
    ui.alert("Resultado da Integração", msg, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert("❌ Erro no teste: " + e.message);
  }
}
