/**
 * @file 41_Ranker.js
 * @description Módulo de ranqueamento e gestão de carteira recomendada (Smart Hold).
 * ✅ v5: Lê da aba "Oportunidades" (única para o usuário) em vez de "Resultados_Analise".
 * ✅ Mapeamento de colunas sincronizado com 29_Oportunidades_Processor v5 (16 colunas).
 * ✅ INTEGRADO: Position Sizing baseado no Risco por Trade (2%).
 * 🔧 v12.8: (a) descarta trades com stop >= preço (geometria inválida para compra);
 *           (b) Position Sizing SEM Math.abs; (c) teto por trade (25%) e teto
 *           AGREGADO da carteira teórica (95%) para não ultrapassar o capital.
 *           Configurável via RANKER_MAX_TRADE_ALLOCATION / RANKER_MAX_TOTAL_ALLOCATION.
 */

function PROCESSAR_CARTEIRA_FINAL() {
  var ss = SpreadsheetApp.getActive();
  var origem = ss.getSheetByName("Oportunidades");

  if (!origem || origem.getLastRow() < 2) {
    console.warn("⚠️ Aba 'Oportunidades' vazia ou inexistente. Ranker não executado.");
    try {
      var resumo = ss.getSheetByName("Resumo_Trades_Aprovados");
      if (resumo && resumo.getLastRow() > 6) {
        resumo.getRange(7, 1, Math.max(0, resumo.getLastRow() - 6), resumo.getLastColumn()).clearContent().clearFormat();
      }
    } catch (e) {
      console.warn('Não foi possível limpar Resumo_Trades_Aprovados: ' + e.message);
    }
    return 0;
  }

  // =========================================================================
  // 1. MAPA DE SETORES (Centralizado)
  // =========================================================================
  var SECTOR_MAP = {
    'VALE3':'Mineração', 'PETR4':'Energia', 'PETR3':'Energia', 'PRIO3':'Energia',
    'ITUB4':'Bancos', 'BBAS3':'Bancos', 'BBDC4':'Bancos', 'BPAC11':'Bancos',
    'RENT3':'Locação', 'WEGE3':'Industrial', 'SBSP3':'Saneamento', 'VIVT3':'Telecom',
    'GGBR4':'Siderurgia', 'CSNA3':'Siderurgia', 'ABEV3':'Consumo', 'HYPE3':'Saúde',
    'JBSS32':'Alimentos', 'B3SA3':'Financeiro', 'AXIA3':'Elétrica', 'CPLE3':'Elétrica', 'RAIL3':'Logística',
    'SUZB3':'Papel e Celulose', 'VBBR3':'Energia', 'RDOR3':'Saúde', 'EQTL3':'Elétrica',
    'RADL3':'Saúde', 'LREN3':'Varejo', 'MGLU3':'Varejo'
  };

  // =========================================================================
  // 2. MAPEAMENTO DE COLUNAS (Aba Oportunidades v7 — 19 colunas)
  // =========================================================================
  var COL = {
    DATA: 0, TICKER: 1, PRECO: 2, ENTRADA: 3, STOP: 4,
    ALVO1: 5, ALVO2: 6, RR: 7, RISCO: 8, RECOMENDACAO: 9,
    SCORE: 10, SETUP: 11, TIPO_SETUP: 12, ANALISE_TEC: 13, ANALISE_IA: 14, OBS: 15,
    FORCA_RELATIVA: 16,          // 🔧 v13.2
    ALVO_PCT_ENTRADA: 17,        // 🔧 v14.5
    ALVO_PCT_COTACAO: 18         // 🔧 v14.5
  };

  // 🔧 v14.5: lê 19 colunas (17 originais + Alvo % Entrada + Alvo % Cotação).
  // Se a aba ainda tiver apenas 17 colunas (layout antigo), cai para 17 e o
  // Position Sizing continua funcionando — apenas as colunas novas ficam vazias.
  var nCols = Math.max(17, Math.min(19, origem.getLastColumn()));
  var data = origem.getRange(2, 1, origem.getLastRow() - 1, nCols).getValues();
  if (nCols < 19) {
    console.log('ℹ️ [Ranker] Aba Oportunidades com ' + nCols +
      ' colunas (layout antigo). Rode o Scanner para gerar as colunas "Alvo %".');
  }

  var CFG = {
    RESUMO_SHEET: "Resumo_Trades_Aprovados",
    RISK_LEVEL: 0.02  // 2% de risco por operação
  };
  function _cfg(key, fallback) {
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function') ? CONFIG.get(key, fallback) : fallback;
  }
  CFG.RESUMO_SHEET = _cfg('RANKER_RESUMO_SHEET', CFG.RESUMO_SHEET);
  CFG.RISK_LEVEL = Number(_cfg('RANKER_RISK_LEVEL', _cfg('RISCO_POR_TRADE', CFG.RISK_LEVEL)));
  // 🔧 v12.8: tetos de alocação (por trade e agregado da carteira teórica)
  CFG.MAX_TRADE_ALLOCATION = Number(_cfg('RANKER_MAX_TRADE_ALLOCATION', 0.25));
  CFG.MAX_TOTAL_ALLOCATION = Number(_cfg('RANKER_MAX_TOTAL_ALLOCATION', 0.95));
  if (!(CFG.MAX_TRADE_ALLOCATION > 0 && CFG.MAX_TRADE_ALLOCATION <= 1)) CFG.MAX_TRADE_ALLOCATION = 0.25;
  if (!(CFG.MAX_TOTAL_ALLOCATION > 0 && CFG.MAX_TOTAL_ALLOCATION <= 1)) CFG.MAX_TOTAL_ALLOCATION = 0.95;

  // =========================================================================
  // 3. CAPITAL TOTAL
  // =========================================================================
  var capital = 100000;
  try {
    var capitalVal = _cfg("CAPITAL_TOTAL", 100000);
    capital = parseFloat(capitalVal) || 100000;
  } catch(e) {
    console.warn("Usando capital padrão: R$ 100.000");
  }

  // =========================================================================
  // 4. ORDENAÇÃO POR SCORE (Decrescente)
  // =========================================================================
  data.sort(function(a, b) {
    return (Number(b[COL.SCORE]) || 0) - (Number(a[COL.SCORE]) || 0);
  });

  // =========================================================================
  // 5. PROCESSAR TRADES (dados já filtrados pela aba Oportunidades)
  // =========================================================================
  var trades = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var ticker = String(r[COL.TICKER] || "").trim().toUpperCase();
    if (!ticker) continue;

    var recomendacao = String(r[COL.RECOMENDACAO] || "");
    // Só processa trades com recomendação positiva ou em observação
    if (recomendacao.indexOf('⛔') !== -1) continue;

    var preco = Number(r[COL.PRECO]) || 0;
    var score = Number(r[COL.SCORE]) || 0;
    var stop = Number(r[COL.STOP]) || 0;
    var entrada = Number(r[COL.ENTRADA]) || preco;
    var alvo1 = Number(r[COL.ALVO1]) || 0;
    var alvo2 = Number(r[COL.ALVO2]) || 0;

    // 🔧 CORREÇÃO v12.8: descarta trades com geometria inválida para COMPRA
    // (stop >= preço). Um Math.abs(preco - stop) mascararia a inversão e
    // calcularia um position size errado (caso AXIA3: stop 57,19 > preço 54,80).
    if (preco <= 0 || stop <= 0 || stop >= preco) {
      console.warn("⚠️ [Ranker] " + ticker + ": geometria inválida para compra (stop=" + stop +
        " >= preco=" + preco + ") — trade descartado.");
      continue;
    }

    // =====================================================================
    // 🔧 v14.5: GEOMETRIA CENTRALIZADA (28_Position_Geometry)
    // ---------------------------------------------------------------------
    // Antes: `distStop = preco - stop` era usado no sizing, mas o campo `rr`
    // exibido vinha do analisador (medido contra a ENTRADA Fibo). Duas bases
    // diferentes → tamanho da posição incoerente com o R/R anunciado.
    // Agora risco, R/R e quantidade compartilham a MESMA base (preço atual).
    // =====================================================================
    var geo = (typeof PositionGeometry !== 'undefined')
      ? PositionGeometry.calcular({
          precoAtual: preco,
          entradaIdeal: entrada,
          stop: stop,
          alvo1: alvo1,
          alvo2: alvo2
        })
      : null;

    // Position Sizing coerente (mesma base do risco exibido)
    var distStop = preco - stop; // stop sempre abaixo do preço (validado acima)
    var qtd = 0;
    var riscoRsDaPosicao = 0;
    if (typeof PositionGeometry !== 'undefined') {
      var dim = PositionGeometry.dimensionar({
        capital: capital,
        riscoPctAlvo: CFG.RISK_LEVEL,
        precoReferencia: preco,
        stop: stop,
        maxTradeAlloc: CFG.MAX_TRADE_ALLOCATION,
        maxTotalAlloc: CFG.MAX_TOTAL_ALLOCATION
      });
      qtd = dim.quantidade;
      riscoRsDaPosicao = dim.riscoRS;
    } else if (distStop > 0 && preco > 0) {
      qtd = Math.floor((capital * CFG.RISK_LEVEL) / distStop);
      var maxQtdTrade = Math.floor((capital * CFG.MAX_TRADE_ALLOCATION) / preco);
      if (qtd > maxQtdTrade) qtd = maxQtdTrade;
      riscoRsDaPosicao = qtd * distStop;
    }

    // STATUS baseado na recomendação + score
    var status = recomendacao.indexOf('✅') !== -1 ? '🚀 COMPRAR' : '🔭 RADAR';

    var setup = String(r[COL.SETUP] || "");
    var estrategia = String(r[COL.TIPO_SETUP] || "");

    // 🔧 v14.5: avisa quando a entrada ideal já foi ultrapassada — o usuário
    // precisa saber que o R/R anunciado é da geometria, não da execução dele.
    if (geo && geo.entradaAtrasada) {
      console.log("   ⚠️ [Ranker] " + ticker + ": preço +" +
        (geo.atrasoPct * 100).toFixed(1) + "% acima da zona de compra. R/R real " +
        geo.rr.toFixed(2) + " (geometria " + geo.rrAnalisador.toFixed(2) + ").");
    }

    trades.push({
      status: status,
      ticker: ticker,
      preco: preco,
      fibo: entrada,          // "Entrada Sugerida" faz o papel do FIBO
      stop: stop,
      alvo: alvo1,
      qtd: qtd,
      alocacao: capital > 0 ? (qtd * preco) / capital : 0,
      // 🔧 v14.5: R/R coerente (mesma base do risco) + R/R da geometria original
      rr: geo ? geo.rr : (Number(r[COL.RR]) || 0),
      rrGeometria: geo ? geo.rrAnalisador : (Number(r[COL.RR]) || 0),
      riscoRs: riscoRsDaPosicao,
      zonaCompra: geo ? geo.zonaCompra : null,
      dentroDaZona: geo ? geo.dentroDaZona : null,
      atrasoPct: geo ? geo.atrasoPct : 0,
      alvo1PctAtual: geo ? geo.alvo1PctAtual : 0,
      alvo2PctAtual: geo ? geo.alvo2PctAtual : 0,
      score: score,
      setup: setup,
      setor: SECTOR_MAP[ticker] || "Outros",
      estrategia: estrategia
    });

  }

  // Filtrar apenas trades com score >= 50 que foram APROVADOS (STATUS COMPRAR ou RADAR)
  trades = trades.filter(function(t) { 
    return t.score >= 50 && (t.status === "🚀 COMPRAR" || t.status === "🔭 RADAR"); 
  });

  // =========================================================================
  // 5.1 v12.8: TETO AGREGADO DE ALOCAÇÃO (carteira teórica ≤ X% do capital)
  // -------------------------------------------------------------------------
  // Os trades já vêm ordenados por SCORE desc. Consumimos capital na ordem de
  // prioridade; quando o próximo trade não couber, ele é TRIMADO (reduz a qtd
  // para caber no restante) ou descartado se o restante for insuficiente.
  // Evita que a soma das alocações ultrapasse 100% do capital.
  // =========================================================================
  var maxTotalValue = capital * CFG.MAX_TOTAL_ALLOCATION;
  var valorAlocado = 0;
  var tradesCapados = [];
  var tradesDescartados = [];

  for (var j = 0; j < trades.length; j++) {
    var tj = trades[j];
    var valorTrade = tj.qtd * tj.preco;

    if (valorTrade <= 0) { continue; }

    if (valorAlocado + valorTrade <= maxTotalValue) {
      // Cabe integralmente
      valorAlocado += valorTrade;
      tradesCapados.push(tj);
    } else {
      // Não cabe: tenta TRIMAR a quantidade para caber no restante
      var restante = maxTotalValue - valorAlocado;
      var qtdCabivel = Math.floor(restante / tj.preco);
      if (qtdCabivel > 0) {
        tj.qtd = qtdCabivel;
        tj.alocacao = capital > 0 ? (qtdCabivel * tj.preco) / capital : 0;
        valorAlocado += qtdCabivel * tj.preco;
        tradesCapados.push(tj);
        console.log("   ✂️ [Ranker] " + tj.ticker + ": qtd reduzida para " + qtdCabivel +
          " (teto agregado de " + (CFG.MAX_TOTAL_ALLOCATION * 100).toFixed(0) + "% do capital)");
      } else {
        tradesDescartados.push(tj.ticker);
      }
    }
  }

  if (tradesDescartados.length > 0) {
    console.warn("   ⚠️ [Ranker] " + tradesDescartados.length + " trade(s) descartado(s) por teto agregado: " +
      tradesDescartados.join(", "));
  }
  console.log("   💼 [Ranker] Alocação total: R$ " + valorAlocado.toFixed(2) +
    " / R$ " + capital.toFixed(2) + " (" + (capital > 0 ? (valorAlocado / capital * 100).toFixed(1) : 0) +
    "%) | Trades na carteira: " + tradesCapados.length + "/" + trades.length);

  trades = tradesCapados;

  // =========================================================================
  // 6. ESCREVER TABELA RANKER
  // =========================================================================
  _escreverTabelaRanker(ss, trades, CFG.RESUMO_SHEET);
  
  return trades.length;
}

// ============================================================================
// FUNÇÃO AUXILIAR: Determinar STATUS baseado no SETUP (SINCRONIZADA)
// ============================================================================
function _determinarStatusPorSetup(setup, score) {
  // Nível 1: COMPRAR (setups de alta qualidade com score adequado)
  // 🔧 CORREÇÃO v9: Thresholds reduzidos em 5 pts para compensar adjustment macro
  // Com adjustment 0.8x-0.95x, scores técnicos perdem 5-20% antes de chegar aqui
  
  // SWING IDEAL (melhor setup possível)
  if (setup.indexOf("SWING IDEAL") !== -1 && score >= 65) {
    return "🚀 COMPRAR";
  }
  
  // TENDÊNCIA CONFIRMADA (setup de alta qualidade)
  if (setup.indexOf("TENDÊNCIA CONFIRMADA") !== -1 && score >= 65) {
    return "🚀 COMPRAR";
  }
  
  // 🔧 CORREÇÃO v9.1: TENDÊNCIA FORTE (score alto, ADX forte, mesmo sem Fibo)
  if (setup.indexOf("TENDÊNCIA FORTE") !== -1 && score >= 65) {
    return "🚀 COMPRAR";
  }
  
  // MOMENTUM FORTE (rompimento com volume)

  if (setup.indexOf("MOMENTUM FORTE") !== -1 && score >= 65) {
    return "🚀 COMPRAR";
  }
  
  // SWING PULLBACK FIBO (clássico swing trade)
  if (setup.indexOf("SWING PULLBACK FIBO") !== -1 && score >= 70) {
    return "🚀 COMPRAR";
  }
  
  // PULLBACK FIBO (versão simplificada)
  if (setup.indexOf("PULLBACK FIBO") !== -1 && score >= 70) {
    return "🚀 COMPRAR";
  }

  
  // Nível 2: RADAR (aguardar confirmação)
  // 🔧 CORREÇÃO v9: Alinhado com DecisionEngine.DEFAULT_THRESHOLD (55)
  // O Ranker usava threshold 60 próprio, mas o DecisionEngine agora aprova com 55
  var radarThreshold = 55;

  
  // RADAR TENDÊNCIA (aguardar volume)
  if (setup.indexOf("RADAR TENDÊNCIA") !== -1 && score >= radarThreshold) {
    return "🔭 RADAR";
  }
  
  // RADAR PULLBACK (aguardar confirmação)
  if (setup.indexOf("RADAR PULLBACK") !== -1 && score >= radarThreshold) {
    return "🔭 RADAR";
  }
  
  // AGUARDAR MELHOR SETUP (setup incompleto)
  if (setup.indexOf("AGUARDAR") !== -1 && score >= radarThreshold) {
    return "🔭 RADAR";
  }
  
  // TENDÊNCIA (sem confirmação completa)
  if (setup.indexOf("TENDÊNCIA") !== -1 && score >= 70 && score < 80 && setup.indexOf("CONFIRMADA") === -1) {
    return "🔭 RADAR";
  }
  
  // PULLBACK (genérico, sem Fibo)
  if (setup.indexOf("PULLBACK") !== -1 && score >= 70 && score < 75 && setup.indexOf("FIBO") === -1) {
    return "🔭 RADAR";
  }
  
  // Nível 3: NEUTRO (não comprar)
  
  // RISCO ALTO (RR baixo)
  if (setup.indexOf("RISCO ALTO") !== -1) {
    return "🛡️ NEUTRO (RR BAIXO)";
  }
  
  // STOP INVIÁVEL
  if (setup.indexOf("STOP INVIÁVEL") !== -1) {
    return "🛡️ NEUTRO";
  }
  
  // SCORE BAIXO
  if (setup.indexOf("SCORE BAIXO") !== -1) {
    return "🛡️ NEUTRO";
  }
  
  // DESCARTAR
  if (setup.indexOf("DESCARTAR") !== -1) {
    return "🛡️ NEUTRO";
  }
  
  // Fallback: usa apenas o score (último recurso)
  if (score >= 85) return "🚀 COMPRAR";
  if (score >= 70) return "🔭 RADAR";
  return "🛡️ NEUTRO";
}

// ============================================================================
// FUNÇÃO: Escrever Tabela Ranker
// ============================================================================
function _escreverTabelaRanker(ss, trades, sheetName) {
  var dest = ss.getSheetByName(sheetName);
  if (!dest) {
    dest = ss.insertSheet(sheetName);
  }

  // Desenhar glossário (cabeçalhos)
  _desenharGlossario(dest);

  // Limpar dados antigos (manter cabeçalho)
  if (dest.getLastRow() > 6) {
    dest.getRange(7, 1, dest.getLastRow() - 6, 14).clearContent().clearFormat();
  }

  if (trades.length > 0) {
    var agora = new Date();
    var rows = [];
    
    for (var i = 0; i < trades.length; i++) {
      var t = trades[i];
      // 🔧 v14.5: a coluna ALVO agora mostra o ALVO 1 e, ao lado (ESTRATÉGIA),
      // o retorno REAL até ele a partir da COTAÇÃO — que é o número que importa
      // para quem entra hoje. Quando o preço está fora da zona, o aviso aparece
      // no início da ESTRATÉGIA para não passar batido.
      var avisoZona = '';
      if (t.dentroDaZona === false && t.atrasoPct > 0) {
        avisoZona = '⚠️ FORA DA ZONA (+' + (t.atrasoPct * 100).toFixed(1) + '%) · ';
      }
      var retornoReal = (t.alvo1PctAtual > 0)
        ? 'Alvo1 a +' + (t.alvo1PctAtual * 100).toFixed(1) + '% da cotação · '
        : '';
      var rrTexto = 'R/R ' + (t.rr || 0).toFixed(2);
      if (t.rrGeometria && Math.abs(t.rrGeometria - t.rr) > 0.05) {
        rrTexto += ' (geom. ' + t.rrGeometria.toFixed(2) + ')';
      }

      rows.push([
        agora, t.status, t.ticker, t.setor, t.setup, t.preco,
        t.fibo, t.stop, t.alvo, t.qtd, t.alocacao, t.rr, t.score,
        avisoZona + retornoReal + rrTexto +
          (t.estrategia ? ' · ' + t.estrategia : '')
      ]);
    }

    var rangeDados = dest.getRange(7, 1, rows.length, 14);
    // 🔧 v14.4: Preenche apenas os dados, sem formatação automática.
    rangeDados.setValues(rows);
  }
}

// ============================================================================
// FUNÇÃO: Desenhar Glossário e Cabeçalhos
// ============================================================================
function _desenharGlossario(sheet) {
  // 🔧 v14.4: Preenche apenas os DADOS (título, glossário e cabeçalhos),
  // sem formatação automática. A formatação fica por conta do usuário.
  sheet.getRange("A1:N6").clearContent();

  // Título Principal (apenas o texto, sem estilização)
  sheet.getRange("A1:N1").merge().setValue("CARTEIRA RECOMENDADA B3-V10 (SMART HOLD) — PAINEL DE INTELIGÊNCIA");

  // Definição do Glossário
  var glossario = [
    ["🚀 COMPRAR", "Setup de alta qualidade + IA favorável (Score ≥ 65)", "🎯 SWING IDEAL", "Pullback Fibo + Tendência Forte + RR ≥ 1.5"],
    ["🔭 RADAR", "Setup promissor, aguardar confirmação (Score 55-69)", "📈 OBV UP", "Acumulação institucional silenciosa (fluxo comprador forte)"],
    ["🛡️ NEUTRO", "Setup de baixo score, stop inviável ou fora do timing", "📉 OBV DOWN", "Distribuição institucional silenciosa (alerta de rompimento falso)"],
    ["❌ VETADO", "Risco excessivo (RR baixo, correlação extrema ou Compliance)", "🚨 BTC ALTO", "Alto saldo de aluguel de ações (forte pressão de short-sellers B3)"]
  ];

  // Aplica apenas os textos (Linhas 2 a 5), sem estilização
  for (var i = 0; i < glossario.length; i++) {
    var row = i + 2;
    sheet.getRange(row, 1).setValue(glossario[i][0]);
    sheet.getRange(row, 2).setValue(glossario[i][1]);
    sheet.getRange(row, 4).setValue(glossario[i][2]);
    sheet.getRange(row, 5).setValue(glossario[i][3]);
  }

  // Cabeçalhos da Tabela (Linha 6) — apenas valores
  var headers = ["DATA/HORA", "STATUS", "TICKER", "SETOR", "SETUP", "PREÇO ATUAL", "ENTRADA FIBO", "STOP", "ALVO", "QTD", "ALOCAÇÃO %", "R/R", "SCORE", "ESTRATÉGIA"];
  var headerRange = sheet.getRange(6, 1, 1, headers.length);
  headerRange.setValues([headers]);
}
