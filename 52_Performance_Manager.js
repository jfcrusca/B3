// =============================================================================
// 52_Performance_Manager.js — v2.0 (Trade Detail + Summary + Custos)
// =============================================================================
// 🔧 v2.0 — CORREÇÕES:
//  [1] `encontrarIndiceColuna` agora faz MATCH EXATO antes de substring, com
//      suporte a exclusões. Antes, "preço" casava com "Preço Entrada" mesmo
//      quando o cabeçalho real tem "Preço" (coluna J) — e "data" casava com
//      "Data Entrada"/"Data Saída" antes de "Data".
//  [2] O lucro do trade passa a ser ancorado na coluna 'Lucro/Prejuízo' da
//      FONTE (que já é líquida de corretagem/emolumentos/ISS), com o
//      recálculo FIFO como VALIDAÇÃO CRUZADA. Antes, o módulo recalculava
//      `valorVenda - valorCompra` e ignorava todas as taxas, divergindo do
//      resultado fiscal.
//  [3] `CABECALHOS_LOG` alinhado ao layout de 00_Setup_CreateSheets
//      (elimina o conflito de 12 colunas vs 10 colunas).
//  [4] Setor vem do B3V10_TickerManager (com fallback), não mais de um mapa
//      hardcoded de 6 tickers.
//  [5] 'Resultado %' gravado como NÚMERO + formato '0.00%' (antes era string
//      concatenada, o que quebrava qualquer fórmula na coluna).
//  [6] Resumo estatístico com Win Rate global/por ativo e Profit Factor.
// =============================================================================

var PerformanceManager = (function() {
  'use strict';

  const NOME_ABA_NOTAS = "Notas de Corretagem";
  const NOME_ABA_LOG   = "Log_Performance";

  // Cabeçalhos da aba de log detalhado (14 colunas — alinhado ao Setup)
  const CABECALHOS_LOG = [
    "Data Entrada", "Ticker", "Setor", "Setup",
    "Preço Entrada", "Stop Loss", "Alvo",
    "Score", "Status", "Resultado %",
    "Data Saída", "Preço Saída",
    "Financeiro (R$)", "Custos (R$)"
  ];

  // Fallback quando o TickerManager não está disponível
  const MAPA_SETORES_FALLBACK = {
    'VALE3': 'Mineração', 'PETR4': 'Energia', 'ITUB4': 'Bancos',
    'BBAS3': 'Bancos', 'WEGE3': 'Industrial', 'PRIO3': 'Energia'
  };

  // -------------------------------------------------------------------------
  // Utilitários
  // -------------------------------------------------------------------------
  function converterParaNumero(valor) {
    if (valor === null || valor === undefined || valor === "") return NaN;
    if (typeof valor === "number") return valor;
    let str = String(valor).trim();
    if (str === "") return NaN;
    if (str.startsWith("(") && str.endsWith(")")) {
      str = "-" + str.substring(1, str.length - 1);
    }
    str = str.replace(/[R$\s%]/g, "");
    if (str.indexOf(",") !== -1) {
      str = str.replace(/\./g, "").replace(",", ".");
    }
    return parseFloat(str);
  }

  /** Sempre número (0 quando inválido) — diferente do converterParaNumero. */
  function num(valor) {
    const n = converterParaNumero(valor);
    return isFinite(n) ? n : 0;
  }

  /**
   * Busca o índice de uma coluna por palavras-chave.
   * 🔧 v2.0: faz MATCH EXATO primeiro (evita 'preço' casar com 'Preço Entrada')
   * e respeita a lista de exclusões.
   *
   * @param {Array} cabecalho linha 1 da aba.
   * @param {Array<string>} palavrasChave termos aceitos (minúsculos).
   * @param {Array<string>} [excluir] termos que desqualificam a coluna.
   * @return {number} índice 0-based ou -1.
   */
  function encontrarIndiceColuna(cabecalho, palavrasChave, excluir) {
    const norm = cabecalho.map(h => String(h == null ? '' : h).trim().toLowerCase());
    const proibidos = (excluir || []).map(t => t.toLowerCase());

    // 1) Match EXATO (a forma mais confiável)
    for (let i = 0; i < norm.length; i++) {
      if (palavrasChave.indexOf(norm[i]) !== -1) {
        if (!proibidos.some(p => norm[i].indexOf(p) !== -1)) return i;
      }
    }
    // 2) Match por palavra inteira (evita 'data' casar dentro de outra palavra)
    for (let i = 0; i < norm.length; i++) {
      const col = norm[i];
      if (!col) continue;
      if (proibidos.some(p => col.indexOf(p) !== -1)) continue;
      for (const palavra of palavrasChave) {
        const re = new RegExp('(^|[^a-zà-ÿ])' + palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-zà-ÿ])', 'i');
        if (re.test(col)) return i;
      }
    }
    // 3) Substring (último recurso)
    for (let i = 0; i < norm.length; i++) {
      const col = norm[i];
      if (!col) continue;
      if (proibidos.some(p => col.indexOf(p) !== -1)) continue;
      if (palavrasChave.some(p => col.indexOf(p) !== -1)) return i;
    }
    return -1;
  }

  /**
   * Resolve o setor de um ticker via B3V10_TickerManager (com fallback local).
   * @param {string} ticker papel.
   * @return {string} nome do setor.
   */
  function resolverSetor(ticker) {
    try {
      if (typeof B3V10TickerManager !== 'undefined') {
        // Tenta os métodos mais comuns da API do módulo 05
        if (typeof B3V10TickerManager.getSetor === 'function') {
          const s = B3V10TickerManager.getSetor(ticker);
          if (s) return String(s);
        }
        if (typeof B3V10TickerManager.getInfo === 'function') {
          const info = B3V10TickerManager.getInfo(ticker);
          if (info && info.setor) return String(info.setor);
        }
      }
    } catch (e) {
      // Silencioso: setor é apenas metadado de exibição
    }
    return MAPA_SETORES_FALLBACK[ticker] || 'Outros';
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

    // Mapeamento EXPLÍCITO com exclusões (o cabeçalho real A..AF tem
    // 'Data' e 'Data Entrada'-like próximos, assim como 'Preço' e 'Preço Médio').
    const idxData     = encontrarIndiceColuna(cabecalho, ["data"], ["entrada", "saída", "saida", "horário", "horario"]);
    const idxOperacao = encontrarIndiceColuna(cabecalho, ["operação", "operacao", "tipo"]);
    const idxPapel    = encontrarIndiceColuna(cabecalho, ["papel", "ticker", "ativo"], ["tipo"]);
    const idxQtd      = encontrarIndiceColuna(cabecalho, ["quantidade", "qtd"]);
    const idxPreco    = encontrarIndiceColuna(cabecalho, ["preço", "preco", "price"],
                          ["médio", "medio", "cesta", "entrada", "saída", "saida", "ajuste"]);
    const idxLucro    = encontrarIndiceColuna(cabecalho, ["lucro/prejuízo", "lucro/prejuizo", "l/p", "resultado"]);
    const idxCusto    = encontrarIndiceColuna(cabecalho, ["custo total"]);
    const idxCorret   = encontrarIndiceColuna(cabecalho, ["custo corretagem", "corretagem"]);
    const idxEmol     = encontrarIndiceColuna(cabecalho, ["emolumentos"]);
    const idxIss      = encontrarIndiceColuna(cabecalho, ["iss"]);
    const idxModal    = encontrarIndiceColuna(cabecalho, ["modalidade"]);
    const idxTipoPapel= encontrarIndiceColuna(cabecalho, ["tipo papel"]);

    if (idxData === -1 || idxOperacao === -1 || idxPapel === -1 || idxQtd === -1 || idxPreco === -1) {
      throw new Error(
        "Colunas obrigatórias não encontradas nas Notas de Corretagem. " +
        "Esperado: Data, Operação, Papel, Quantidade, Preço. " +
        "Cabeçalho lido: " + cabecalho.filter(h => h !== '').join(' | ')
      );
    }

    const operacoes = [];
    for (let i = 1; i < dados.length; i++) {
      const row = dados[i];
      const data = row[idxData];
      if (!(data instanceof Date)) continue;
      const tipo = String(row[idxOperacao]).toUpperCase();
      if (tipo.indexOf("COMPRA") === -1 && tipo.indexOf("VENDA") === -1) continue;

      const custos = num(idxCorret > -1 ? row[idxCorret] : 0) +
                     num(idxEmol > -1 ? row[idxEmol] : 0) +
                     num(idxIss > -1 ? row[idxIss] : 0);

      operacoes.push({
        data: data,
        tipo: tipo.indexOf("COMPRA") !== -1 ? "COMPRA" : "VENDA",
        ticker: String(row[idxPapel] || '').trim().toUpperCase(),
        quantidade: Math.abs(num(row[idxQtd])),
        preco: num(row[idxPreco]),
        // 'Lucro/Prejuízo' da FONTE: já é líquido de taxas (fonte de verdade)
        lucroFonte: num(idxLucro > -1 ? row[idxLucro] : 0),
        // Custo total da linha (base para o custo médio do trade)
        custoTotal: Math.abs(num(idxCusto > -1 ? row[idxCusto] : 0)),
        custos: Math.abs(custos),
        mercado: (function () {
          const tp = String(idxTipoPapel > -1 ? row[idxTipoPapel] : '').toUpperCase();
          const mod = String(idxModal > -1 ? row[idxModal] : '').toUpperCase();
          if (tp.indexOf('FII') !== -1) return 'FII';
          if (tp.indexOf('ETF') !== -1) return 'ETF';
          if (/\bDAY\b/.test(mod) || mod.indexOf('DAY TRADE') !== -1) return 'DT';
          return 'SWING';
        })()
      });
    }
    return operacoes;
  }

  // -------------------------------------------------------------------------
  // Identificação de trades (FIFO) com ancoragem no Lucro/Prejuízo da FONTE
  // -------------------------------------------------------------------------
  function identificarTrades(operacoes) {
    // Agrupar por ticker
    const porTicker = new Map();
    for (const op of operacoes) {
      if (!porTicker.has(op.ticker)) porTicker.set(op.ticker, []);
      porTicker.get(op.ticker).push(op);
    }

    const trades = [];
    for (const [ticker, lista] of porTicker.entries()) {
      // Ordenar por data (estável)
      lista.sort((a, b) => a.data - b.data);

      const filaCompras = []; // FIFO
      for (const op of lista) {
        if (op.tipo === "COMPRA") {
          filaCompras.push({
            data: op.data,
            preco: op.preco,
            quantidade: op.quantidade,
            // Custo unitário: prioriza 'Custo Total'/quantidade (inclui taxas)
            custoUnit: (op.custoTotal > 0 && op.quantidade > 0)
              ? op.custoTotal / op.quantidade
              : op.preco
          });
        } else if (op.tipo === "VENDA") {
          let quantidadeVenda = op.quantidade;
          // Taxa de venda por ação (para diluir nos parciais)
          const custoUnitVenda = (op.custoTotal > 0 && op.quantidade > 0)
            ? op.custoTotal / op.quantidade
            : op.preco;

          while (quantidadeVenda > 0 && filaCompras.length) {
            const compra = filaCompras[0];
            const qtdTrade = Math.min(compra.quantidade, quantidadeVenda);
            const valorCompra = qtdTrade * compra.custoUnit;
            const valorVenda = qtdTrade * custoUnitVenda;
            const lucroCalculado = valorVenda - valorCompra;

            trades.push({
              ticker: ticker,
              mercado: op.mercado,
              dataEntrada: compra.data,
              precoEntrada: compra.preco,
              dataSaida: op.data,
              precoSaida: op.preco,
              quantidade: qtdTrade,
              // Lucro contábil (custo médio com taxas, via FIFO)
              lucro: lucroCalculado,
              // Lucro da FONTE (líquido, apurado pela corretora) — usado
              // como fonte de verdade quando a venda é integral
              lucroFonte: (quantidadeVenda === op.quantidade) ? op.lucroFonte : null,
              custos: op.custos,
              valorCompra: valorCompra,
              resultadoPercentual: valorCompra > 0 ? (lucroCalculado / valorCompra) : 0
            });

            compra.quantidade -= qtdTrade;
            if (compra.quantidade <= 0) filaCompras.shift();
            quantidadeVenda -= qtdTrade;
          }

          if (quantidadeVenda > 0) {
            console.warn(`⚠️ [Performance] Venda sem compra correspondente para ${ticker} em ${op.data}`);
          }
        }
      }
    }

    // Ajuste fino: quando a venda foi INTEGRAL (1:1), o lucro da fonte
    // (líquido de IR/taxas conforme a corretora) prevalece sobre o FIFO.
    trades.forEach(t => {
      if (t.lucroFonte !== null && t.lucroFonte !== undefined &&
          Math.abs(t.lucroFonte - t.lucro) > 0.01) {
        t.lucroCalculado = t.lucro;
        t.lucro = t.lucroFonte;
        t.resultadoPercentual = t.valorCompra > 0 ? (t.lucro / t.valorCompra) : 0;
      }
    });

    return trades;
  }

  // -------------------------------------------------------------------------
  // Escrita na aba Log_Performance (detalhado)
  // -------------------------------------------------------------------------
  function garantirAbaLog(ss) {
    let aba = ss.getSheetByName(NOME_ABA_LOG);
    if (!aba) {
      aba = ss.insertSheet(NOME_ABA_LOG);
    }
    // 🔧 v2.0: SEMPRE reescreve o cabeçalho com o layout canônico de 14
    // colunas. Antes, uma aba criada pelo Setup (10 colunas) convivia com
    // este módulo (12 colunas), corrompendo a leitura dos dados.
    const existente = aba.getLastColumn() > 0
      ? aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
      : [];
    const igual = existente.length === CABECALHOS_LOG.length &&
      CABECALHOS_LOG.every((h, i) => String(existente[i]) === h);

    if (!igual) {
      aba.getRange(1, 1, 1, CABECALHOS_LOG.length).setValues([CABECALHOS_LOG]);
    }
    aba.getRange(1, 1, 1, CABECALHOS_LOG.length)
      .setFontWeight("bold").setBackground("#0c343d").setFontColor("white")
      .setHorizontalAlignment("center").setWrap(true);
    aba.setFrozenRows(1);
    return aba;
  }

  function escreverTradesDetalhados(ss, trades) {
    const aba = garantirAbaLog(ss);
    const N = CABECALHOS_LOG.length;

    // Limpa dados antigos (mantém cabeçalho na linha 1 e o resumo na linha 2)
    if (aba.getLastRow() > 2) {
      aba.getRange(3, 1, aba.getLastRow() - 2, Math.max(N, aba.getLastColumn()))
        .clearContent();
    }
    if (trades.length === 0) return;

    const linhas = trades.map(t => {
      const status = t.lucro > 0 ? "GAIN" : (t.lucro < 0 ? "LOSS" : "NEUTRO");
      return [
        t.dataEntrada, t.ticker, resolverSetor(t.ticker), "",  // Setup vazio
        t.precoEntrada, "", "",                                // Stop/Alvo vazios
        "", status,
        t.resultadoPercentual,   // NÚMERO (0.1234) — formato 0.00% cuida do resto
        t.dataSaida, t.precoSaida,
        t.lucro,                 // Financeiro (R$)
        t.custos || 0            // Custos (R$)
      ];
    });

    const range = aba.getRange(3, 1, linhas.length, N);
    range.setValues(linhas);

    // Formatação em lote (uma única chamada por formato)
    const fmt = linhas.map(() => [
      'dd/mm/yyyy', '@', '@', '@',
      '"R$ "#,##0.00', '@', '@',
      '@', '@', '0.00%',
      'dd/mm/yyyy', '"R$ "#,##0.00',
      '"R$ "#,##0.00', '"R$ "#,##0.00'
    ]);
    range.setNumberFormats(fmt);
    aba.getRange(3, 9, linhas.length, 1).setHorizontalAlignment("center");
    aba.getRange(3, 10, linhas.length, 1).setHorizontalAlignment("center");

    // Semaforização GAIN/LOSS
    const cores = linhas.map(l => {
      const cor = l[8] === 'GAIN' ? '#d9ead3' : (l[8] === 'LOSS' ? '#f4cccc' : null);
      const linha = new Array(N).fill(null);
      linha[8] = cor;
      return linha;
    });
    aba.getRange(3, 1, linhas.length, N).setBackgrounds(cores);

    aba.autoResizeColumns(1, N);
  }

  // -------------------------------------------------------------------------
  // Resumo estatístico (baseado nos trades identificados)
  // Agora: Win Rate numérico + Profit Factor + Financeiro + Melhor/Pior trade.
  // -------------------------------------------------------------------------
  function atualizarResumoEstatistico(ss, trades) {
    const aba = ss.getSheetByName(NOME_ABA_LOG) || garantirAbaLog(ss);

    const total    = trades.length;
    const vitorias = trades.filter(t => t.lucro > 0).length;
    const derrotas = trades.filter(t => t.lucro < 0).length;
    const empates  = trades.filter(t => t.lucro === 0).length;
    const winRate  = total ? (vitorias / total) : 0;

    const somaGanhos = trades.filter(t => t.lucro > 0).reduce((s, t) => s + t.lucro, 0);
    const somaPerdas = Math.abs(trades.filter(t => t.lucro < 0).reduce((s, t) => s + t.lucro, 0));
    const profitFactor = somaPerdas > 0 ? (somaGanhos / somaPerdas) : (somaGanhos > 0 ? Infinity : 0);
    const resultadoTotal = somaGanhos - somaPerdas;
    const resultadoPctMedio = total
      ? trades.reduce((s, t) => s + (t.resultadoPercentual || 0), 0) / total
      : 0;
    const melhorTrade = trades.reduce((m, t) => (!m || t.lucro > m.lucro ? t : m), null);
    const piorTrade   = trades.reduce((m, t) => (!m || t.lucro < m.lucro ? t : m), null);

    const agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

    // ✅ Linha 2 reservada para o resumo (não colide com os dados, que começam na 3)
    const resumo = [[
      agora,                          // A Data/Hora
      total,                          // B Total Trades
      vitorias,                       // C Vitórias
      derrotas,                       // D Derrotas
      empates,                        // E Empates
      winRate,                        // F Win Rate (número)
      resultadoTotal,                 // G Resultado R$
      profitFactor === Infinity ? '∞' : profitFactor, // H Profit Factor
      resultadoPctMedio,              // I Retorno % médio
      melhorTrade ? melhorTrade.ticker : '-',         // J Melhor ticker
      melhorTrade ? melhorTrade.lucro : 0,            // K Melhor R$
      piorTrade ? piorTrade.ticker : '-',             // L Pior ticker
      piorTrade ? piorTrade.lucro : 0                 // M Pior R$
    ]];

    const range = aba.getRange(2, 1, 1, 13);
    range.clearContent();
    range.setValues(resumo);

    aba.getRange(2, 6).setNumberFormat('0.00%');
    aba.getRange(2, 7).setNumberFormat('"R$ "#,##0.00');
    aba.getRange(2, 8).setNumberFormat('0.00');
    aba.getRange(2, 9).setNumberFormat('0.00%');
    aba.getRange(2, 11).setNumberFormat('"R$ "#,##0.00');
    aba.getRange(2, 13).setNumberFormat('"R$ "#,##0.00');
    aba.getRange(2, 1, 1, 13).setFontWeight("bold").setBackground("#d9e2f3");
  }

  /**
   * Calcula o Win Rate por ativo (útil para o AgentMemory / HistoricalContext).
   * @param {Array<Object>} trades lista de trades identificados.
   * @return {Object} { TICKER: { trades, winRate, resultado } }.
   */
  function winRatePorAtivo(trades) {
    const porTicker = {};
    trades.forEach(t => {
      if (!porTicker[t.ticker]) {
        porTicker[t.ticker] = { trades: 0, vitorias: 0, resultado: 0 };
      }
      const p = porTicker[t.ticker];
      p.trades++;
      if (t.lucro > 0) p.vitorias++;
      p.resultado += t.lucro;
    });
    Object.keys(porTicker).forEach(k => {
      const p = porTicker[k];
      p.winRate = p.trades > 0 ? (p.vitorias / p.trades) : 0;
    });
    return porTicker;
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

      const vitorias = trades.filter(t => t.lucro > 0).length;
      const somaGanhos = trades.filter(t => t.lucro > 0).reduce((s, t) => s + t.lucro, 0);
      const somaPerdas = Math.abs(trades.filter(t => t.lucro < 0).reduce((s, t) => s + t.lucro, 0));

      console.log(`✅ Log_Performance atualizada: ${trades.length} trades, resumo gerado.`);
      return {
        total: trades.length,
        winRate: trades.length ? (vitorias / trades.length) * 100 : 0,
        resultadoTotal: somaGanhos - somaPerdas,
        profitFactor: somaPerdas > 0 ? (somaGanhos / somaPerdas) : null,
        winRatePorAtivo: winRatePorAtivo(trades)
      };
    } catch (e) {
      console.error("Erro no PerformanceManager: " + e.message);
      throw e;
    }
  }

  return {
    executar: executar,
    winRatePorAtivo: winRatePorAtivo
  };
})();

// Função global para ser chamada pelo menu
function ATUALIZAR_ESTATISTICAS() {
  try {
    const resultado = PerformanceManager.executar();
    if (resultado) {
      const msg = "📊 Performance B3 Atualizada\n\n" +
                  "Total de Trades Fechados: " + resultado.total + "\n" +
                  "Win Rate: " + resultado.winRate.toFixed(2) + "%\n" +
                  "Resultado: R$ " + resultado.resultadoTotal.toFixed(2) + "\n" +
                  "Profit Factor: " + (resultado.profitFactor === null
                    ? '∞' : resultado.profitFactor.toFixed(2));

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