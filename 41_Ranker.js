/**
 * @file 41_Ranker.js
 * @description Módulo de ranqueamento e gestão de carteira recomendada (Smart Hold).
 * ✅ v5: Lê da aba "Oportunidades" (única para o usuário) em vez de "Resultados_Analise".
 * ✅ Mapeamento de colunas sincronizado com 29_Oportunidades_Processor v5 (16 colunas).
 * ✅ INTEGRADO: Position Sizing baseado no Risco por Trade (2%).
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
        resumo.setFrozenRows(6);
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
    'JBSS3':'Alimentos', 'B3SA3':'Financeiro', 'AXIA3':'Elétrica', 'CPLE3':'Elétrica', 'RAIL3':'Logística',
    'SUZB3':'Papel e Celulose', 'VBBR3':'Energia', 'RDOR3':'Saúde', 'EQTL3':'Elétrica',
    'RADL3':'Saúde', 'LREN3':'Varejo', 'MGLU3':'Varejo'
  };

  // =========================================================================
  // 2. MAPEAMENTO DE COLUNAS (Aba Oportunidades v5 — 16 colunas)
  // =========================================================================
  var COL = {
    DATA: 0, TICKER: 1, PRECO: 2, ENTRADA: 3, STOP: 4,
    ALVO1: 5, ALVO2: 6, RR: 7, RISCO: 8, RECOMENDACAO: 9,
    SCORE: 10, SETUP: 11, TIPO_SETUP: 12, ANALISE_TEC: 13, ANALISE_IA: 14, OBS: 15
  };

  // Leitura dos dados (16 colunas)
  var data = origem.getRange(2, 1, origem.getLastRow() - 1, 16).getValues();

  var CFG = {
    RESUMO_SHEET: "Resumo_Trades_Aprovados",
    RISK_LEVEL: 0.02  // 2% de risco por operação
  };
  function _cfg(key, fallback) {
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function') ? CONFIG.get(key, fallback) : fallback;
  }
  CFG.RESUMO_SHEET = _cfg('RANKER_RESUMO_SHEET', CFG.RESUMO_SHEET);
  CFG.RISK_LEVEL = Number(_cfg('RANKER_RISK_LEVEL', _cfg('RISCO_POR_TRADE', CFG.RISK_LEVEL)));

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
    var distStop = Math.abs(preco - stop);

    // Position Sizing (quantidade baseada no risco)
    var qtd = 0;
    if (distStop > 0 && preco > 0) {
      qtd = Math.floor((capital * CFG.RISK_LEVEL) / distStop);
      if ((qtd * preco) > (capital * 0.25)) {
        qtd = Math.floor((capital * 0.25) / preco);
      }
    }

    // STATUS baseado na recomendação + score
    var status = recomendacao.indexOf('✅') !== -1 ? '🚀 COMPRAR' : '🔭 RADAR';

    var setup = String(r[COL.SETUP] || "");
    var estrategia = String(r[COL.TIPO_SETUP] || "");

    trades.push({
      status: status,
      ticker: ticker,
      preco: preco,
      fibo: entrada,          // "Entrada Sugerida" faz o papel do FIBO
      stop: stop,
      alvo: Number(r[COL.ALVO1]) || 0,
      qtd: qtd,
      alocacao: capital > 0 ? (qtd * preco) / capital : 0,
      rr: Number(r[COL.RR]) || 0,
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
      rows.push([
        agora, t.status, t.ticker, t.setor, t.setup, t.preco,
        t.fibo, t.stop, t.alvo, t.qtd, t.alocacao, t.rr, t.score,
        t.estrategia || ''
      ]);
    }

    var rangeDados = dest.getRange(7, 1, rows.length, 14);
    rangeDados.setValues(rows);

    // Formatações de número
    dest.getRange(7, 1, rows.length, 1).setNumberFormat('dd/mm/yyyy HH:mm');
    dest.getRange(7, 6, rows.length, 4).setNumberFormat('"R$ "#,##0.00');
    dest.getRange(7, 11, rows.length, 1).setNumberFormat('0.0%');
    dest.getRange(7, 12, rows.length, 1).setNumberFormat('0.00');


    // Cores condicionais baseadas no STATUS
    var statusValues = dest.getRange(7, 2, rows.length, 1).getValues();
    var colors = [];
    var fontColors = [];
    var weights = [];

    for (var j = 0; j < statusValues.length; j++) {
      var s = statusValues[j][0];
      if (s === "🚀 COMPRAR") {
        colors.push(["#d9ead3"]);
        fontColors.push(["#27ae60"]);
        weights.push(["bold"]);
      } else if (s === "🔭 RADAR") {
        colors.push(["#fff2cc"]);
        fontColors.push(["#f1c40f"]);
        weights.push(["bold"]);
      } else {
        colors.push(["#ffffff"]);
        fontColors.push(["#7f8c8d"]);
        weights.push(["normal"]);
      }
    }

    dest.getRange(7, 2, rows.length, 1).setBackgrounds(colors);
    dest.getRange(7, 2, rows.length, 1).setFontColors(fontColors);
    dest.getRange(7, 2, rows.length, 1).setFontWeights(weights);
    rangeDados.setHorizontalAlignment("center");
  }

  dest.setFrozenRows(6);
}

// ============================================================================
// FUNÇÃO: Desenhar Glossário e Cabeçalhos
// ============================================================================
function _desenharGlossario(sheet) {
  // Limpa apenas o necessário para reconstruir
  sheet.getRange("A1:N6").clearContent().clearFormat();

  // Título Principal
  sheet.getRange("A1:N1").merge()

    .setValue("🏆 CARTEIRA RECOMENDADA B3-V10 (SMART HOLD) — PAINEL DE INTELIGÊNCIA")
    .setBackground("#0C343D").setFontColor("#FFFFFF").setFontWeight("bold")
    .setHorizontalAlignment("center").setVerticalAlignment("middle").setFontSize(11);

  // Definição do Glossário (Corrigido para exibir as descrições na Coluna E e incluindo OBV e BTC)
  // 🔧 CORREÇÃO v9: Thresholds atualizados para refletir adjustment macro
  var glossario = [
    ["🚀 COMPRAR", "Setup de alta qualidade + IA favorável (Score ≥ 65)", "🎯 SWING IDEAL", "Pullback Fibo + Tendência Forte + RR ≥ 1.5"],
    ["🔭 RADAR", "Setup promissor, aguardar confirmação (Score 55-69)", "📈 OBV UP", "Acumulação institucional silenciosa (fluxo comprador forte)"],

    ["🛡️ NEUTRO", "Setup de baixo score, stop inviável ou fora do timing", "📉 OBV DOWN", "Distribuição institucional silenciosa (alerta de rompimento falso)"],
    ["❌ VETADO", "Risco excessivo (RR baixo, correlação extrema ou Compliance)", "🚨 BTC ALTO", "Alto saldo de aluguel de ações (forte pressão de short-sellers B3)"]
  ];

  // Aplica os textos nas células (Linhas 2 a 5)
  for (var i = 0; i < glossario.length; i++) {
    var linha = glossario[i];
    var row = i + 2;
    sheet.getRange(row, 1).setValue(linha[0]).setFontWeight("bold").setHorizontalAlignment("left");
    sheet.getRange(row, 2).setValue(linha[1]).setFontSize(9).setHorizontalAlignment("left");
    
    sheet.getRange(row, 4).setValue(linha[2]).setFontWeight("bold").setHorizontalAlignment("left");
    sheet.getRange(row, 5).setValue(linha[3]).setFontSize(9).setHorizontalAlignment("left");
  }

  // Estilização das etiquetas
  sheet.getRange("A2:A5").setBackground("#F4F5F7").setFontColor("#1C4587");
  sheet.getRange("D2:D5").setBackground("#F4F5F7").setFontColor("#A64D79");

  // Cabeçalhos da Tabela (Linha 6)
  var headers = ["DATA/HORA", "STATUS", "TICKER", "SETOR", "SETUP", "PREÇO ATUAL", "ENTRADA FIBO", "STOP", "ALVO", "QTD", "ALOCAÇÃO %", "R/R", "SCORE", "ESTRATÉGIA"];
  var headerRange = sheet.getRange(6, 1, 1, headers.length);

  headerRange.setValues([headers]);
  headerRange.setBackground("#111111").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
}
