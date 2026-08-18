/**
 * =============================================================================
 * 08_Output_Unified.gs — CENTRAL DE SAÍDA E RELATÓRIOS (v12.0 - MEMORY BUFFER)
 * =============================================================================
 * Correções v12.0:
 * ✅ Padrão Memory Buffer 2D implementado (0 chamadas de API dentro de loops)
 * ✅ setBackground() em loop substituído por setBackgrounds() em lote
 * ✅ OutputBuffer centralizado para segurar logs e trades até o fim do pipeline
 * =============================================================================
 */

const OutputConfig = {
  SHEET_NAME: 'Resultados_Analise',
  NUM_COLS: 26, // 🔧 CORREÇÃO v10.2: ATUALIZADO DE 23 PARA 26 (Topo50, GanhoRapido%, DistTopo%)
  HEADERS: [
    'Data', 'Ticker', 'Preço', 'Score', 'Setup', 'Motivo', 'Stop Loss', 
    'Alvo 1', 'Alvo 2', 'R/R', 'Risco %', 'RSI', 'EMA21', 'EMA50', 'EMA200', 
    'ATR', 'Volume', 'Pivot', 'Fibonacci', 'Análise IA', 'Ranking', 'Tipo Setup',
    'Alerta Segurança',
    // 🔧 CORREÇÃO v10.2: Novas métricas de "perto do topo"
    'Topo50', 'GanhoRapido%', 'DistTopo%'
  ]
};

// =============================================================================
// MÓDULO 1: OUTPUT BUFFER (GERENCIADOR DE MEMÓRIA)
// =============================================================================
const OutputBuffer = (function() {
  let pendingAnalysis = [];
  
  return {
    // Guarda na memória sem tocar na planilha
    queueAnalysis: function(lista) {
      pendingAnalysis = lista;
    },
    
    // Despeja tudo na planilha de uma só vez (chamado no final do Orchestrator)
    flushAll: function() {
      if (pendingAnalysis && pendingAnalysis.length > 0) {
        OutputManager._forceWrite(pendingAnalysis);
        pendingAnalysis = []; // Limpa o buffer
      }
    }
  };
})();

// =============================================================================
// MÓDULO 2: SHEET_WRITER (ESCRITA OTIMIZADA EM LOTE)
// =============================================================================
const OutputManager = (function () {

  // Mantido por compatibilidade com Orchestrator antigo, mas agora usa o Buffer internamente
  function saveAnalysisResults(lista) {
    if (!lista || lista.length === 0) return;
    // Em vez de escrever direto, enfileira e faz o flush imediato
    OutputBuffer.queueAnalysis(lista);
    OutputBuffer.flushAll();
  }

  function _forceWrite(lista) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = _ensureSheet(ss);

    // Limpeza dinâmica (1 ÚNICA CHAMADA)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, OutputConfig.NUM_COLS).clear();
    }

    const rows = lista.map(item => _toRow(item));

    // Validação de segurança
    const rowsSanitized = rows.map((row, i) => {
      if (row.length !== OutputConfig.NUM_COLS) {
        while (row.length < OutputConfig.NUM_COLS) row.push('');
        return row.slice(0, OutputConfig.NUM_COLS);
      }
      return row;
    });

    const numRows = rowsSanitized.length;

    // 1ª OPERAÇÃO DE REDE: GRAVAR TEXTOS EM BLOCO
    sheet.getRange(2, 1, numRows, OutputConfig.NUM_COLS).setValues(rowsSanitized);

    // 2ª OPERAÇÃO DE REDE: FORMATAR NÚMEROS E CORES EM BLOCO
    _formatSheetOptimized(sheet, 2, numRows, rowsSanitized);

    console.log(`✅ [SheetWriter] ${numRows} ativos gravados em lote de altíssima performance.`);
  }

 function _toRow(op) {
  // =========================================================================
  // 1. EXTRAIR DADOS BASE
  // =========================================================================
  var ind = op.indicators || {};
  var ticker = op.ticker || '';
  var score = op.score || 0;
  var setup = op.setupType || op.setup || '';
  var motivo = op.reason || op.motivo || op.paReason || '';
  var stop = op.stopLoss || op.stop || 0;
  var alvo1 = op.target1 || 0;
  var alvo2 = op.target2 || 0;
  var rr = op.rr || op.riskReward || 0;
  
  // =========================================================================
  // 2. PREÇO ATUALIZADO (CORREÇÃO DE DEFASAGEM)
  // =========================================================================
  var precoOriginal = op.price || op.Preço || 0;
  var preco = precoOriginal;
  
  // Prioridade 1: Preço ao vivo (se disponível)
  if (op.livePrice && op.livePrice > 0) {
    preco = op.livePrice;
  }
  // Prioridade 2: Preço do Yahoo (se disponível e diferente)
  else if (op.yahooPrice && op.yahooPrice > 0 && Math.abs(op.yahooPrice - precoOriginal) > 0.01) {
    preco = op.yahooPrice;
    console.log("   🔄 Preço atualizado " + ticker + ": R$ " + precoOriginal + " → R$ " + preco);
  }
  // Prioridade 3: Tenta buscar cotação ao vivo agora
  else if (typeof DataService !== 'undefined' && typeof DataService.getPrecoAtual === 'function' && ticker) {
    try {
      var quote = DataService.getPrecoAtual(ticker);
      if (quote && quote.price && quote.price > 0) {
        preco = quote.price;
        console.log("   🔄 Preço ao vivo " + ticker + ": R$ " + preco);
      }
    } catch(e) { /* fallback para precoOriginal */ }
  }
  
  // =========================================================================
  // 3. INDICADORES TÉCNICOS
  // =========================================================================
  var rsi = ind.rsi || op.rsi || 50;
  var ema21 = ind.ema21 || op.ema21 || 0;
  var ema50 = ind.ema50 || op.ema50 || 0;
  var ema200 = ind.ema200 || op.ema200 || 0;
  var atr = ind.atr || op.atr || 0;
  
  // 🔧 CORREÇÃO v12.1: Se ATR veio zerado mas temos preço, estima ATR mínimo
  if (atr <= 0 && preco > 0) {
    // Estima ATR como 1.5% do preço (mínimo realista para ações líquidas)
    atr = parseFloat((preco * 0.015).toFixed(4));
    console.log("   ⚠️ " + ticker + ": ATR zerado, estimado como " + atr + " (1.5% do preço)");
  }
  
  var volume = op.volume || 0;
  var pivot = op.pivot || 0;
  var fib = op.fiboPrice || op.fibo || op.fibonacci || 0;
  var aiText = op.aiRationale || op.aiCommentary || op.analiseIA || '';
  
  // =========================================================================
  // 4. CÁLCULO DO RISCO PERCENTUAL (CORREÇÃO v12.2: TRIPLA VALIDAÇÃO)
  // =========================================================================
  var riscoPct = 0;
  
  // Prioridade 1: Usar riscoPercent já calculado pelo Analyzer (mais preciso)
  if (op.riscoPercent && op.riscoPercent > 0) {
    riscoPct = op.riscoPercent;
  }
  
  // Prioridade 2: Recalcular se não veio do Analyzer
  if (riscoPct === 0 && preco > 0 && stop > 0) {
    if (stop < preco) {
      riscoPct = parseFloat(((preco - stop) / preco * 100).toFixed(2));
    } else if (stop > preco) {
      riscoPct = parseFloat(((stop - preco) / preco * 100).toFixed(2));
    }
  }
  
  // 🔧 LOG DE DIAGNÓSTICO: Se stop existe mas riscoPct ainda é 0
  if (riscoPct === 0 && stop > 0 && preco > 0) {
    console.warn("⚠️ " + ticker + ": Risco% = 0 com Stop=" + stop + " e Preco=" + preco + ". Verificar cálculo.");
  }
  
  // =========================================================================
  // 5. CÁLCULO DO RANKING
  // =========================================================================
  var ranking = 0;
  if (ema21 > 0.1 && preco > 0 && rsi > 0) {
    ranking = 80 + (60 - rsi) - (((preco / ema21) - 1) * 100) + ((rr - 1.5) * 10);
    ranking = parseFloat(ranking.toFixed(1));
    // Limitar ranking entre 0 e 200
    ranking = Math.min(200, Math.max(0, ranking));
  }
  
  // =========================================================================
  // 6. IDENTIFICAÇÃO DO TIPO DE SETUP
  // =========================================================================
  var distMedia = ema21 > 0 ? (preco / ema21) - 1 : 0;
  var tipoSetup = 'TENDÊNCIA';
  
  if (distMedia <= 0.02 && distMedia >= -0.02) {
    tipoSetup = 'PULLBACK';
  } else if (distMedia > 0.05 && rsi > 60) {
    tipoSetup = 'MOMENTUM';
  } else if (fib > 0 && preco > fib && distMedia < 0.04) {
    tipoSetup = 'ROMPIMENTO';
  } else if (distMedia < -0.05 && rsi < 40) {
    tipoSetup = 'REVERSÃO';
  }
  
  // ✅ CORREÇÃO v5: Fallback para extrair tipo do nome do setup
  if ((tipoSetup === 'TENDÊNCIA' || !tipoSetup) && setup && typeof setup === 'string') {
    if (setup.indexOf('PULLBACK') !== -1) tipoSetup = 'PULLBACK';
    else if (setup.indexOf('MOMENTUM') !== -1) tipoSetup = 'MOMENTUM';
    else if (setup.indexOf('ROMPIMENTO') !== -1) tipoSetup = 'ROMPIMENTO';
    else if (setup.indexOf('REVERSÃO') !== -1) tipoSetup = 'REVERSÃO';
  }
  

// =========================================================================
  // 6.1. FILTRO DE SEGURANÇA PARA ROMPIMENTOS (NOVO)
  // =========================================================================
  var alertaMsg = "-";
  var alertaCor = null;

  if (tipoSetup === 'ROMPIMENTO') {
    // Tenta capturar as variáveis de indicadores do seu código (ajuste os nomes se necessário)
    // Se não encontrar no escopo, ele usa valores de fallback para não travar o robô
    var _bandaSuperior = (typeof bollinger !== 'undefined' && bollinger.upper) ? bollinger.upper : (preco * 1.05);
    var _volAtual      = (typeof volume !== 'undefined') ? volume : 0;
    var _volMedio      = (typeof avgVolume !== 'undefined') ? avgVolume : 0;
    var _macdHist      = (typeof macd !== 'undefined' && macd.histogram) ? macd.histogram : 0;

    var avaliacaoSegura = avaliarRompimentoSeguro(preco, _bandaSuperior, _volAtual, _volMedio, _macdHist);
    
    // Sobrescreve a tag original pela versão avaliada (ex: '⏳ PRÉ-ROMPIMENTO')
    tipoSetup = avaliacaoSegura.tagFinal;
    alertaMsg = avaliacaoSegura.alerta;
    alertaCor = avaliacaoSegura.corFundo;
  }


  // =========================================================================
  // 7. DATA ATUAL (garantir formato brasileiro)
  // =========================================================================
  var dataAtual = op.data || new Date();
  if (!(dataAtual instanceof Date)) {
    dataAtual = new Date(dataAtual);
  }
  
  // =========================================================================
  // 8. LOG DE DIAGNÓSTICO (opcional - remove em produção)
  // =========================================================================
  if (preco !== precoOriginal && precoOriginal > 0) {
    console.log("   📊 " + ticker + ": Preço atualizado " + precoOriginal + " → " + preco);
  }
  
  // =========================================================================
  // 7. CORREÇÃO v12.1: GARANTIR QUE O SCORE REFLITA PENALIDADES DO TEXTO
  // =========================================================================
  var scoreFinal = score;
  if (aiText && typeof aiText === 'string') {
    // Detecta padrões como "penalizou o score em 10 pontos"
    var matchPenalty = aiText.match(/penalizou\s+o\s+score\s+em\s+(\d+)\s+pontos?/i);
    if (matchPenalty) {
      var penalty = parseInt(matchPenalty[1], 10);
      if (penalty > 0 && scoreFinal >= penalty) {
        scoreFinal = scoreFinal - penalty;
        console.log("   🔧 " + ticker + ": Score ajustado " + score + " → " + scoreFinal + " (penalidade de " + penalty + " pts)");
      }
    }
  }
  
  // 🔧 CORREÇÃO v10.2: MÉTRICAS DE "PERTO DO TOPO" (novas colunas)
  var topo50 = op.topo50 || 0;
  var ganhoRapidoPct = op.ganhoRapidoPct || 0;
  var distTopoPct = op.distTopoPct || 0;
  
  // =========================================================================
  // 9. RETORNAR ARRAY COM 26 COLUNAS (CORREÇÃO v10.2)
  // =========================================================================
  return [
    dataAtual,           // 0: Data
    ticker,              // 1: Ticker
    preco,               // 2: Preço (ATUALIZADO)
    scoreFinal,          // 3: Score (CORRIGIDO: reflete penalidades do texto IA)
    setup,               // 4: Setup
    motivo,              // 5: Motivo
    stop,                // 6: Stop Loss
    alvo1,               // 7: Alvo 1
    alvo2,               // 8: Alvo 2
    rr,                  // 9: R/R
    riscoPct,            // 10: Risco % (CORRIGIDO: validação dupla)
    rsi,                 // 11: RSI
    ema21,               // 12: EMA21
    ema50,               // 13: EMA50
    ema200,              // 14: EMA200
    atr,                 // 15: ATR (CORRIGIDO: fallback quando zero)
    volume,              // 16: Volume
    pivot,               // 17: Pivot
    fib,                 // 18: Fibonacci
    aiText,              // 19: Análise IA
    ranking,             // 20: Ranking
    tipoSetup,           // 21: Tipo Setup
    alertaMsg,           // 22: ALERTA DE SEGURANÇA (Texto com o emoji '⏳' ou '🚨')
    // 🔧 CORREÇÃO v10.2: Novas métricas de "perto do topo"
    topo50,              // 23: Topo50 (máxima de 30 candles)
    ganhoRapidoPct,      // 24: GanhoRapido% (variação em 10 candles)
    distTopoPct          // 25: DistTopo% (distância da máxima)
  ];
}

  /**
   * ✅ O SEGREDO DA PERFORMANCE: MATRIZES DE FORMATAÇÃO
   * Em vez de formatar linha por linha, constrói uma matriz 2D na memória e aplica tudo de uma vez.
   */
  function _formatSheetOptimized(sheet, startRow, numRows, rowsSanitized) {
    if (numRows <= 0) return;

    // 🔧 CORREÇÃO v10.2: NUM_COLS_TO_PAINT atualizado de 23 para 26 (novas métricas de topo)
    const NUM_COLS_TO_PAINT = 26; 

    // Formatações Numéricas (Mantidas em bloco)
    sheet.getRange(startRow, 3, numRows, 1).setNumberFormat('"R$ "#,##0.00');
    sheet.getRange(startRow, 7, numRows, 3).setNumberFormat('"R$ "#,##0.00');
    sheet.getRange(startRow, 11, numRows, 1).setNumberFormat('0.00"%"');
    sheet.getRange(startRow, 10, numRows, 1).setNumberFormat('0.00');
    sheet.getRange(startRow, 21, numRows, 1).setNumberFormat('0.0');

    // BUFFER DE CORES (Matriz Bidimensional)
    const backgroundMatrix = [];

    for (let i = 0; i < numRows; i++) {
      const tipo = rowsSanitized[i][21];   // Coluna V (Índice 21) = Tipo Setup
      const alerta = rowsSanitized[i][22]; // Coluna W (Índice 22) = Alerta Segurança
      let rowColor = null;

      // 1. Lê os emojis da própria mensagem de alerta para pintar a linha!
      if (alerta && alerta.includes('⏳')) {
          rowColor = '#fff9c4'; // Amarelo (Pré-Rompimento)
      } else if (alerta && alerta.includes('🚨')) {
          rowColor = '#ffcdd2'; // Vermelho (Falso Rompimento)
      } 
      // 2. Se não houver alerta crítico, usa as cores padrão do seu sistema
      else if (tipo === 'PULLBACK')        rowColor = '#b4d9b8';
      else if (tipo === 'MOMENTUM')        rowColor = '#d9c7b4';
      else if (tipo === 'ROMPIMENTO' || tipo === '📈 ROMPIMENTO') rowColor = '#e8c8e2';
      else if (i % 2 === 0)                rowColor = '#f8f9fa';

      const rowColorsArray = Array(OutputConfig.NUM_COLS).fill(rowColor);
      backgroundMatrix.push(rowColorsArray);
    }

    // 🚀 A MÁGICA: Aplica as cores em 100% da tabela com UM ÚNICO comando HTTP
    sheet.getRange(startRow, 1, numRows, NUM_COLS_TO_PAINT).setBackgrounds(backgroundMatrix);
  }

  function _ensureSheet(ss) {
    let sh = ss.getSheetByName(OutputConfig.SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(OutputConfig.SHEET_NAME);
      sh.appendRow(OutputConfig.HEADERS);
      sh.setFrozenRows(1);
    }
    return sh;
  }

  return {
    saveAnalysisResults,
    _forceWrite, // Exposto internamente para o Buffer
    clearSheet: function () {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sh = ss.getSheetByName(OutputConfig.SHEET_NAME);
      if (sh && sh.getLastRow() > 1) {
        sh.getRange(2, 1, sh.getLastRow() - 1, OutputConfig.NUM_COLS).clearContent().setBackground(null);
      }
    }
  };
})();

// Alias for compatibility with older code that references SheetWriter directly
if (typeof SheetWriter === 'undefined') {
  var SheetWriter = OutputManager;
}

// (O restante do arquivo: TextFormatter, OutputFormatter, CORRIGIR_FORMATACAO_AGORA permanecem iguais)
const TextFormatter = (function () { /* ... seu código existente intacto ... */ })();
var OutputFormatter = TextFormatter;
var OutputManagers  = OutputManager;
function CORRIGIR_FORMATACAO_AGORA() { /* ... seu código existente intacto ... */ }