// =============================================================================
// 52_Performance_Manager.js - Versão Expandida (Trade Detail + Summary)
// =============================================================================

var PerformanceManager = (function() {
  'use strict';

  const NOME_ABA_NOTAS = "Notas de Corretagem";
  const NOME_ABA_LOG   = "Log_Performance";

  // Cabeçalhos da aba de log detalhado
  const CABECALHOS_LOG = [
    "Data Entrada", "Ticker", "Setor", "Setup",
    "Preço Entrada", "Stop Loss", "Alvo",
    "Score", "Status", "Resultado %",
    "Data Saída", "Preço Saída"
  ];

  // Mapeamento de setores (pode ser ampliado)
  const MAPA_SETORES = {
    'VALE3':'Mineração', 'PETR4':'Energia', 'ITUB4':'Bancos',
    'BBAS3':'Bancos', 'WEGE3':'Industrial', 'PRIO3':'Energia'
  };

  // -------------------------------------------------------------------------
  // Utilitários
  // -------------------------------------------------------------------------
  function converterParaNumero(valor) {
    if (valor === null || valor === undefined || valor === "") return NaN;
    if (typeof valor === "number") return valor;
    let str = String(valor).trim();
    if (str.startsWith("(") && str.endsWith(")")) {
      str = "-" + str.substring(1, str.length - 1);
    }
    str = str.replace(/[R$\s]/g, "");
    if (str.indexOf(",") !== -1) {
      str = str.replace(/\./g, "").replace(",", ".");
    }
    return parseFloat(str);
  }

  // Busca o índice de uma coluna por palavras‑chave
  function encontrarIndiceColuna(cabecalho, palavrasChave) {
    for (let i = 0; i < cabecalho.length; i++) {
      const nomeCol = String(cabecalho[i]).toLowerCase();
      if (palavrasChave.some(palavra => nomeCol.includes(palavra))) {
        return i;
      }
    }
    return -1;
  }

  // -------------------------------------------------------------------------
  // Leitura e interpretação das Notas de Corretagem
  // -------------------------------------------------------------------------
  function lerNotas() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const abaNotas = ss.getSheetByName(NOME_ABA_NOTAS);
    if (!abaNotas) throw new Error(`Aba '${NOME_ABA_NOTAS}' não encontrada.`);

    const dados = abaNotas.getDataRange().getValues();
    if (dados.length < 2) return [];

    const cabecalho = dados[0];
    const idxData      = encontrarIndiceColuna(cabecalho, ["data"]);
    const idxOperacao  = encontrarIndiceColuna(cabecalho, ["operação", "operacao", "tipo"]);
    const idxPapel     = encontrarIndiceColuna(cabecalho, ["papel", "ticker", "ativo"]);
    const idxQtd       = encontrarIndiceColuna(cabecalho, ["quantidade", "qtd"]);
    const idxPreco     = encontrarIndiceColuna(cabecalho, ["preço", "preco", "price"]);
    const idxLucro     = encontrarIndiceColuna(cabecalho, ["lucro/prejuízo", "l/p", "resultado"]);

    if (idxData === -1 || idxOperacao === -1 || idxPapel === -1 || idxQtd === -1 || idxPreco === -1) {
      throw new Error("Colunas obrigatórias não encontradas nas Notas de Corretagem.");
    }

    const operacoes = [];
    for (let i = 1; i < dados.length; i++) {
      const row = dados[i];
      const data = row[idxData];
      if (!(data instanceof Date)) continue;
      const tipo = String(row[idxOperacao]).toUpperCase();
      if (tipo !== "COMPRA" && tipo !== "VENDA") continue;

      operacoes.push({
        data: data,
        tipo: tipo,
        ticker: String(row[idxPapel]).trim().toUpperCase(),
        quantidade: Math.abs(parseFloat(row[idxQtd]) || 0),
        preco: parseFloat(row[idxPreco]) || 0,
        lucro: converterParaNumero(row[idxLucro])
      });
    }
    return operacoes;
  }

  // -------------------------------------------------------------------------
  // Identificação de trades (FIFO)
  // -------------------------------------------------------------------------
  function identificarTrades(operacoes) {
    // Agrupar por ticker
    const porTicker = new Map();
    for (const op of operacoes) {
      if (!porTicker.has(op.ticker)) porTicker.set(op.ticker, []);
      porTicker.get(op.ticker).push(op);
    }

    const trades = [];
    for (let [ticker, lista] of porTicker.entries()) {
      // Ordenar por data
      lista.sort((a,b) => a.data - b.data);

      const filaCompras = []; // FIFO
      for (const op of lista) {
        if (op.tipo === "COMPRA") {
          filaCompras.push(op);
        } else if (op.tipo === "VENDA") {
          let quantidadeVenda = op.quantidade;
          while (quantidadeVenda > 0 && filaCompras.length) {
            const compra = filaCompras[0];
            const qtdTrade = Math.min(compra.quantidade, quantidadeVenda);
            const valorCompra = qtdTrade * compra.preco;
            const valorVenda  = qtdTrade * op.preco;
            const lucroTrade = valorVenda - valorCompra;

            trades.push({
              ticker: ticker,
              dataEntrada: compra.data,
              precoEntrada: compra.preco,
              dataSaida: op.data,
              precoSaida: op.preco,
              quantidade: qtdTrade,
              lucro: lucroTrade,
              resultadoPercentual: (lucroTrade / valorCompra) * 100
            });

            compra.quantidade -= qtdTrade;
            if (compra.quantidade === 0) filaCompras.shift();
            quantidadeVenda -= qtdTrade;
          }
          if (quantidadeVenda > 0) {
            console.warn(`Venda sem compra correspondente para ${ticker} em ${op.data}`);
          }
        }
      }
    }
    return trades;
  }

  // -------------------------------------------------------------------------
  // Escrita na aba Log_Performance (detalhado)
  // -------------------------------------------------------------------------
  function garantirAbaLog(ss) {
    let aba = ss.getSheetByName(NOME_ABA_LOG);
    if (!aba) {
      aba = ss.insertSheet(NOME_ABA_LOG);
      aba.getRange(1, 1, 1, CABECALHOS_LOG.length).setValues([CABECALHOS_LOG]);
      aba.getRange(1, 1, 1, CABECALHOS_LOG.length).setFontWeight("bold").setBackground("#f3f3f3");
      aba.setFrozenRows(1);
    }
    return aba;
  }

  function escreverTradesDetalhados(ss, trades) {
    const aba = garantirAbaLog(ss);
    // Limpa dados antigos (mantém cabeçalho e resumo na linha 2)
    if (aba.getLastRow() > 2) {
      aba.getRange(3, 1, aba.getLastRow() - 2, CABECALHOS_LOG.length).clearContent();
    }
    if (trades.length === 0) return;

    const linhas = trades.map(t => {
      const setor = MAPA_SETORES[t.ticker] || "Outros";
      const status = t.lucro >= 0 ? "GAIN" : "LOSS";
      return [
        t.dataEntrada, t.ticker, setor, "", // Setup vazio
        t.precoEntrada, "", "",             // Stop e Alvo vazios
        "", status, t.resultadoPercentual.toFixed(2),
        t.dataSaida, t.precoSaida
      ];
    });

    aba.getRange(3, 1, linhas.length, CABECALHOS_LOG.length).setValues(linhas);
    // Formatação
    aba.getRange(3, 5, linhas.length, 1).setNumberFormat('"R$ "#,##0.00');
    aba.getRange(3, 12, linhas.length, 1).setNumberFormat('"R$ "#,##0.00');
    aba.getRange(3, 10, linhas.length, 1).setNumberFormat('0.00"%"');
    aba.getRange(3, 1, linhas.length, 1).setNumberFormat('dd/mm/yyyy');
    aba.getRange(3, 11, linhas.length, 1).setNumberFormat('dd/mm/yyyy');
    aba.autoResizeColumns(1, CABECALHOS_LOG.length);
  }

  // -------------------------------------------------------------------------
  // Resumo estatístico (baseado nos trades identificados)
  // -------------------------------------------------------------------------
  function atualizarResumoEstatistico(ss, trades) {
  let aba = ss.getSheetByName(NOME_ABA_LOG);
  if (!aba) aba = garantirAbaLog(ss);

  const total     = trades.length;
  const vitorias  = trades.filter(t => t.lucro > 0).length;
  const derrotas  = trades.filter(t => t.lucro < 0).length;
  const empates   = trades.filter(t => t.lucro === 0).length;
  const winRate   = total ? (vitorias / total) * 100 : 0;

  const agora = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "dd/MM/yyyy HH:mm:ss"
  );

  // ✅ Linha 2 sempre reservada para o resumo
  aba.getRange(2, 1, 1, 6).clearContent();
  aba.getRange(2, 1, 1, 6).setValues([[
    agora,
    total,
    vitorias,
    derrotas,
    empates,
    winRate.toFixed(2) + "%"
  ]]);
}

  // -------------------------------------------------------------------------
  // Função principal (substitui a antiga executar)
  // -------------------------------------------------------------------------
  function executar() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const operacoes = lerNotas();
      if (operacoes.length === 0) {
        console.log("Nenhuma operação encontrada nas notas.");
        return null;
      }

      const trades = identificarTrades(operacoes);
      escreverTradesDetalhados(ss, trades);
      atualizarResumoEstatistico(ss, trades);

      console.log(`✅ Log_Performance atualizada: ${trades.length} trades detalhados, resumo estatístico gerado.`);
      return { total: trades.length, winRate: trades.length ? (trades.filter(t=>t.lucro>0).length / trades.length)*100 : 0 };
    } catch (e) {
      console.error("Erro no PerformanceManager: " + e.message);
      throw e;
    }
  }

  return { executar: executar };
})();

// Função global para ser chamada pelo menu
function ATUALIZAR_ESTATISTICAS() {
  const isBot = (typeof AutomacaoBot !== 'undefined');
  
  try {
    const resultado = PerformanceManager.executar();
    if (resultado) {
      const msg = "📊 Performance B3 Atualizada\n\n" +
                  "Total de Trades Fechados: " + resultado.total + "\n" +
                  "Win Rate: " + resultado.winRate.toFixed(2) + "%";
      
      try {
        SpreadsheetApp.getUi().alert(msg);
      } catch (uiErr) {
        console.log("ℹ️ [Performance] Execução em background: " + msg.replace(/\n/g, ' | '));
      }
    } else {
      try {
        SpreadsheetApp.getUi().alert("Nenhum trade encontrado nas notas de corretagem.");
      } catch (uiErr) {
        console.warn("⚠️ [Performance] Nenhum trade identificado para processamento.");
      }
    }
  } catch (e) {
    console.error("❌ Erro em ATUALIZAR_ESTATISTICAS: " + e.message);
    try {
      SpreadsheetApp.getUi().alert("❌ Erro: " + e.message);
    } catch (uiErr) { /* ignora erro de UI no catch */ }
  }
}





function TESTAR_WINRATE_ROLLING_12M() {
  const ui = SpreadsheetApp.getUi();
  const tickerTeste = 'PETR4'; // ajuste se quiser

  try {
    console.log(`🧪 [TESTE] Iniciando teste Win Rate rolling 12M para ${tickerTeste}`);

    // ⚠️ acesso indireto via getContext (contrato real)
    const contexto = AgentMemory.getContext(tickerTeste);

    if (!contexto) {
      throw new Error('Contexto retornou null');
    }

    console.log('📊 Contexto completo:', contexto);

    // Validações mínimas
    if (typeof contexto.winRate !== 'number') {
      throw new Error('Win Rate global inválido ou ausente');
    }

    // Detecta se o texto menciona Win Rate do ativo
    const mencionaWRAtivo = contexto.text.includes('Win Rate histórico');

    let resultado = `✅ TESTE WIN RATE ROLLING 12M\n\n`;
    resultado += `Ticker: ${tickerTeste}\n`;
    resultado += `Win Rate Global: ${contexto.winRate}%\n\n`;

    if (mencionaWRAtivo) {
      resultado += `✅ Win Rate por ATIVO (12M) detectado no texto.\n`;
    } else {
      resultado += `⚠️ Win Rate por ATIVO (12M) NÃO detectado.\n`;
      resultado += `Possíveis causas:\n`;
      resultado += `• menos de 5 trades no período\n`;
      resultado += `• nenhum trade nos últimos 12 meses\n`;
    }

    resultado += `\nRegime Global: ${contexto.drawdownLevel}\n`;
    resultado += `Penalty Points: ${contexto.penaltyPoints}`;

    ui.alert('Resultado do Teste B3‑v11.1', resultado, ui.ButtonSet.OK);

  } catch (e) {
    ui.alert(
      '❌ TESTE FALHOU',
      `Erro: ${e.message}`,
      ui.ButtonSet.OK
    );
    throw e;
  }
}