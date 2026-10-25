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
  NUM_COLS: 27, // 🔧 v13.2: 26 → 27 (nova coluna "Força Rel. %")
  HEADERS: [
    'Data', 'Ticker', 'Preço', 'Score', 'Setup', 'Motivo', 'Stop Loss', 
    'Alvo 1', 'Alvo 2', 'R/R', 'Risco %', 'RSI', 'EMA21', 'EMA50', 'EMA200', 
    'ATR', 'Volume', 'Pivot', 'Fibonacci', 'Análise IA', 'Ranking', 'Tipo Setup',
    'Alerta Segurança',
    // 🔧 CORREÇÃO v10.2: Novas métricas de "perto do topo"
    'Topo50', 'GanhoRapido%', 'DistTopo%',
    // 🔧 v13.2: Força Relativa vs. benchmark (BOVA11) em % (21d)
    'Força Rel. %'
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

    // =======================================================================
    // 🔧 v13.4: GUARD DE IDEMPOTÊNCIA (defesa em profundidade)
    // -----------------------------------------------------------------------
    // O lock do Orchestrator (00_Core_Orchestrator.executar) impede execuções
    // concorrentes. ESTE guard cobre o caso residual: uma gravação que chega
    // ATRASADA de uma execução antiga (ex.: retry interno do GAS), que
    // sobrescreveria dados mais recentes com dados velhos.
    //
    // Mecanismo: o Orchestrator marca `Orchestrator._execucaoId`. Gravamos esse
    // ID numa propriedade do documento; se um write chegar com um ID ANTERIOR
    // ao já registrado, é descartado.
    // =======================================================================
    try {
      var execIdAtual = (typeof Orchestrator !== 'undefined' && Orchestrator._execucaoId)
        ? Orchestrator._execucaoId : null;

      if (execIdAtual) {
        var props = PropertiesService.getDocumentProperties();
        var ultimoId = props.getProperty('ULTIMA_GRAVACAO_EXEC_ID');
        var ultimoTs = Number(props.getProperty('ULTIMA_GRAVACAO_TS') || 0);
        var agora = Date.now();

        // Mesma execução gravando 2x em < 3s => provável retry/duplicata
        if (ultimoId === execIdAtual && (agora - ultimoTs) < 3000) {
          console.warn('⏭️ [Output] Gravação duplicada da execução ' + execIdAtual.substring(0, 8) +
            ' detectada (' + (agora - ultimoTs) + 'ms desde a última) — ignorada.');
          return;
        }

        props.setProperty('ULTIMA_GRAVACAO_EXEC_ID', execIdAtual);
        props.setProperty('ULTIMA_GRAVACAO_TS', String(agora));
        console.log('📝 [Output] Gravando execução ' + execIdAtual.substring(0, 8) +
          ' (' + lista.length + ' linhas).');
      }
    } catch (eGuard) {
      // Guard é opcional — nunca deve impedir a gravação legítima.
      console.warn('⚠️ [Output] Guard de idempotência indisponível: ' + eGuard.message);
    }

    // =======================================================================
    // 🔧 v13.5 [CORREÇÃO]: LIMPEZA ROBUSTA DA ABA
    // -----------------------------------------------------------------------
    // BUG: `getLastRow()` considera apenas a ÚLTIMA linha com conteúdo. Se a
    // aba tiver linhas com células ESPARSAS (ex.: a coluna 22 vazia mas a 27
    // preenchida), o valor retornado pode ser MENOR que o real — e o `clear()`
    // deixa resíduos de execuções anteriores.
    //
    // EVIDÊNCIA (BPAC11, 22:44): a linha continha dados de 3 execuções
    // diferentes misturados:
    //   Stop = R$ 57,15   Risco = 6,93%  => incoerentes entre si (57,15 daria 10%)
    //   Alvo1 = R$ 61,67  Alvo2 = R$ 63,93  Alvo/R/R de fontes distintas
    //   ATR = 2 (arredondado) e Alerta VAZIO => o _toRow grava 1,7016 e nunca vazio
    //
    // SOLUÇÃO: limpar TODAS as linhas abaixo do cabeçalho até `getMaxRows()`,
    // não apenas até `getLastRow()`. O custo é o mesmo (1 chamada de rede) e
    // elimina a classe inteira de resíduos.
    // =======================================================================
    const maxRows = sheet.getMaxRows();
    if (maxRows > 1) {
      sheet.getRange(2, 1, maxRows - 1, Math.max(OutputConfig.NUM_COLS, sheet.getMaxColumns()))
        .clearContent()
        .clearFormat()
        .setBackground(null);
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

  /** Múltiplos de alvo — lidos do CORE22_CFG com fallback local.
   * 🔧 v13.3: antes eram constantes duplicadas aqui (e no antigo 00_SheetWriter),
   * o que permitia que os dois escritores divergissem silenciosamente.
   * Agora a fonte é única (22_Core_Analyzers.CORE22_CFG). */
  function _cfgT1R() {
    return (typeof CORE22_CFG !== 'undefined' && CORE22_CFG.t1R) ? CORE22_CFG.t1R : 2.0;
  }
  function _cfgT2R() {
    return (typeof CORE22_CFG !== 'undefined' && CORE22_CFG.t2R) ? CORE22_CFG.t2R : 3.0;
  }

 function _toRow(op) {
  // Múltiplos padrão de alvo (fonte única: CORE22_CFG em 22_Core_Analyzers)
  var CFG_T1R = _cfgT1R();
  var CFG_T2R = _cfgT2R();

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
  var precoDeOverride = false;

  // 🔧 v12.7: OVERRIDE MANUAL (Script Property PRECO_OVERRIDE_<TICKER>) — prioridade máxima
  if (ticker && typeof DataService !== 'undefined' && typeof DataService.getPrecoOverride === 'function') {
    var overridePreco = DataService.getPrecoOverride(ticker);
    if (overridePreco && overridePreco > 0) {
      preco = overridePreco;
      precoDeOverride = true;
      console.log("   🔧 Preço com override manual " + ticker + ": R$ " + preco.toFixed(2));
    }
  }

  if (!precoDeOverride) {
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
  }
  
  // 🔧 CORREÇÃO v12.7: DETECÇÃO DE DEFASAGEM ENTRE PREÇO EXIBIDO E PREÇO ANALISADO
  // Se o preço final (cotação ao vivo) divergir mais de 15% do preço do candle usado
  // na análise técnica (op.price), o setup/score provavelmente estão defasados.
  // Sinalizamos no campo de alerta de segurança (coluna 'Alerta Segurança').
  var alertaDivergenciaPreco = '';
  if (!precoDeOverride && preco > 0 && precoOriginal > 0 && Math.abs(preco - precoOriginal) > 0.005) {
    var diffPctPreco = Math.abs(preco - precoOriginal) / precoOriginal;
    if (diffPctPreco > 0.15) {
      alertaDivergenciaPreco = '🚨 Cotação ao vivo R$ ' + preco.toFixed(2) + ' diverge ' + (diffPctPreco * 100).toFixed(0) + '% do preço analisado R$ ' + precoOriginal.toFixed(2) + ' — análise possivelmente defasada';
    }
  }
  // Se a reconciliação do Orchestrator já marcou a divergência, preserva a mensagem original
  if (!alertaDivergenciaPreco && op.alertaLive) {
    alertaDivergenciaPreco = op.alertaLive;
  }

  // =========================================================================
  // 2.1 CORREÇÃO v12.8: REALINHAMENTO DA GEOMETRIA STOP/ALVOS AO PREÇO EXIBIDO
  // -------------------------------------------------------------------------
  // O stop/alvos/RR são calculados em 22_Core_Analyzers sobre o CLOSE do último
  // candle diário (precoOriginal). Quando a cotação ao vivo (preco) cai abaixo do
  // stop, a linha fica geometricamente inválida para COMPRA (stop ACIMA do preço)
  // — ex: AXIA3 (R$ 54,80 exibido / stop R$ 57,19). Aqui realinhamos a geometria
  // para o preço exibido preservando as DISTÂNCIAS percentuais originais
  // (stopDistPct e multiplicadores de alvo), mantendo a coerência da linha.
  var stopInvalidoParaCompra = false;
  if (preco > 0 && precoOriginal > 0 && stop > 0 && preco !== precoOriginal) {
    var stopDistPctRef = (precoOriginal - stop) / precoOriginal; // distância % do stop no candle
    // Só realinhamos quando a defasagem torna o stop inválido OU distorce a geometria
    if (stop >= preco) {
      stopInvalidoParaCompra = true;
      if (stopDistPctRef > 0 && stopDistPctRef < 0.5) {
        var distStopReajustada = preco * stopDistPctRef;
        var alvoMult1 = (alvo1 > precoOriginal && stopDistPctRef > 0) ? (alvo1 - precoOriginal) / (precoOriginal * stopDistPctRef) : CFG_T1R;
        var alvoMult2 = (alvo2 > precoOriginal && stopDistPctRef > 0) ? (alvo2 - precoOriginal) / (precoOriginal * stopDistPctRef) : CFG_T2R;
        stop  = parseFloat((preco - distStopReajustada).toFixed(2));
        alvo1 = parseFloat((preco + distStopReajustada * alvoMult1).toFixed(2));
        alvo2 = parseFloat((preco + distStopReajustada * alvoMult2).toFixed(2));
        rr    = parseFloat(alvoMult1.toFixed(2));
        console.log("   🔧 " + ticker + ": Geometria realinhada ao preço exibido R$ " + preco.toFixed(2) +
          " (stop R$ " + stop.toFixed(2) + ", alvo1 R$ " + alvo1.toFixed(2) + ") — evitando stop acima do preço");
        alertaDivergenciaPreco = (alertaDivergenciaPreco ? alertaDivergenciaPreco + ' | ' : '') +
          '🔄 Stop/alvos realinhados ao preço exibido (análise técnica era de R$ ' + precoOriginal.toFixed(2) + ')';
        stopInvalidoParaCompra = false; // já corrigido — deixa de ser inválido
      }
    }
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
  
  // Prioridade 1: Usar riscoPercent já calculado pelo Analyzer (mais preciso).
  // 🔧 CORREÇÃO v12.8: só é aceito se a geometria for válida para COMPRA
  // (stop < preco). Caso contrário, é recalculado/zerado abaixo.
  if (op.riscoPercent && op.riscoPercent > 0 && stop > 0 && preco > 0 && stop < preco) {
    riscoPct = op.riscoPercent;
  }

  // Prioridade 2: Recalcular a partir do stop para o preço EXIBIDO.
  // 🔧 CORREÇÃO v12.8: NUNCA usa Math.abs para "fingir" risco quando o stop está
  // ACIMA do preço (geometria inválida para compra) — nesse caso, risco = 0 e
  // sinalizamos o problema em vez de mascarar com um valor positivo.
  if (riscoPct === 0 && preco > 0 && stop > 0) {
    if (stop < preco) {
      riscoPct = parseFloat(((preco - stop) / preco * 100).toFixed(2));
    } else if (stop > preco) {
      // Stop acima do preço em setup de COMPRA = inválido. Não mascarar.
      stopInvalidoParaCompra = true;
      riscoPct = 0;
      console.warn("⚠️ " + ticker + ": Stop (R$ " + stop + ") ACIMA do preço (R$ " + preco +
        ") — impossível para compra. Risco classificado como 0 (inválido).");
    }
  }

  // 🔧 LOG DE DIAGNÓSTICO: Se stop existe mas riscoPct ainda é 0
  if (riscoPct === 0 && stop > 0 && preco > 0 && !stopInvalidoParaCompra) {
    console.warn("⚠️ " + ticker + ": Risco% = 0 com Stop=" + stop + " e Preco=" + preco + ". Verificar cálculo.");
  }

  // 🔧 CORREÇÃO v12.8: Marca explicitamente a linha inválida no alerta de segurança
  if (stopInvalidoParaCompra) {
    alertaDivergenciaPreco = (alertaDivergenciaPreco ? alertaDivergenciaPreco + ' | ' : '') +
      '🚨 STOP INVÁLIDO (acima do preço) — revisar entrada';
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

  // 🔧 CORREÇÃO v12.7: ANEXA ALERTA DE DEFASAGEM DE PREÇO AO ALERTA DE SEGURANÇA
  if (alertaDivergenciaPreco) {
    alertaMsg = (alertaMsg && alertaMsg !== '-') ? alertaMsg + ' | ' + alertaDivergenciaPreco : alertaDivergenciaPreco;
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

  // 🔧 v13.2: FORÇA RELATIVA vs. benchmark (BOVA11) — exibida em % (decimal × 100).
  // null => sem benchmark disponível (mostra vazio/'-').
  var forcaRelativa = (op.forcaRelativa !== undefined && op.forcaRelativa !== null)
    ? parseFloat((op.forcaRelativa * 100).toFixed(2)) : '';

  // =========================================================================
  // 9. RETORNAR ARRAY COM 27 COLUNAS (CORREÇÃO v13.2)
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
    distTopoPct,         // 25: DistTopo% (distância da máxima)
    forcaRelativa        // 26: Força Rel. % (vs. BOVA11, 21d)
  ];
}

  /**
   * ✅ O SEGREDO DA PERFORMANCE: MATRIZES DE FORMATAÇÃO
   * Em vez de formatar linha por linha, constrói uma matriz 2D na memória e
   * aplica tudo de uma vez.
   *
   * 🔧 v13.3 — CORREÇÃO CRÍTICA (falha de gravação silenciosa):
   * A constante NUM_COLS_TO_PAINT ficou presa em 26 quando a v13.2 adicionou a
   * coluna 'Força Rel. %' (26 → 27). Como a matriz de cores era montada com
   * OutputConfig.NUM_COLS (27) mas o range pedia 26, o setBackgrounds lançava:
   *
   *   "The number of columns in the data does not match the number of columns
   *    in the range. The data has 27 but the range has 26."
   *
   * Isso fazia 'Resultados_Analise' NÃO ser gravada — os dados exibidos eram de
   * execuções anteriores (foi assim que o BPAC11 apareceu com R/R=2,00 e
   * Risco%=13,94% defasados, e com Fibonacci/Topo50 inconsistentes).
   *
   * AGORA: a constante é DERIVADA de OutputConfig.NUM_COLS — impossível
   * divergir de novo, mesmo que colunas sejam adicionadas no futuro.
   */
  function _formatSheetOptimized(sheet, startRow, numRows, rowsSanitized) {
    if (numRows <= 0) return;

    // Fonte única de verdade: o número de colunas do layout.
    const NUM_COLS_TO_PAINT = OutputConfig.NUM_COLS;

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

      // 🔧 v13.3: a matriz é construída com EXATAMENTE o mesmo número de colunas
      // que o range usará — elimina a classe inteira do erro "27 vs 26".
      const rowColorsArray = Array(NUM_COLS_TO_PAINT).fill(rowColor);
      backgroundMatrix.push(rowColorsArray);
    }

    // 🚀 A MÁGICA: Aplica as cores em 100% da tabela com UM ÚNICO comando HTTP.
    // Guard defensivo: se por qualquer motivo as dimensões divergirem, aborta a
    // PINTURA (cosmética) em vez de derrubar a gravação dos DADOS (essencial).
    const larguraMatriz = backgroundMatrix[0] ? backgroundMatrix[0].length : 0;
    if (larguraMatriz !== NUM_COLS_TO_PAINT) {
      console.warn('⚠️ [Output] Matriz de cores com ' + larguraMatriz +
        ' colunas, esperado ' + NUM_COLS_TO_PAINT + ' — pintura ignorada (dados preservados).');
      return;
    }
    sheet.getRange(startRow, 1, numRows, NUM_COLS_TO_PAINT).setBackgrounds(backgroundMatrix);
  }

  /**
   * Garante que a aba exista com o cabeçalho correto.
   * 🔧 v13.3: antes usava `appendRow(HEADERS)`, que ADICIONA uma linha em vez de
   * definir a linha 1 — podendo deixar a aba com o cabeçalho deslocado.
   */
  function _ensureSheet(ss) {
    let sh = ss.getSheetByName(OutputConfig.SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(OutputConfig.SHEET_NAME);
    }
    // Grava o cabeçalho na LINHA 1 (idempotente) e valida a contagem de colunas.
    try {
      const cabAtual = sh.getRange(1, 1, 1, OutputConfig.NUM_COLS).getValues()[0];
      const igual = OutputConfig.HEADERS.every(function (h, i) {
        return String(cabAtual[i] || '').trim() === h;
      });
      if (!igual) {
        sh.getRange(1, 1, 1, OutputConfig.HEADERS.length).setValues([OutputConfig.HEADERS]);
        console.log('📝 [Output] Cabeçalho de "' + OutputConfig.SHEET_NAME +
          '" (re)gravado com ' + OutputConfig.HEADERS.length + ' colunas.');
      }
    } catch (eCab) {
      console.warn('⚠️ [Output] Falha ao validar cabeçalho: ' + eCab.message);
    }
    sh.setFrozenRows(1);
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

// =============================================================================
// 🔧 v13.3: GUARD REMOVIDO — SheetWriter agora é um ALIAS EXPLÍCITO declarado
// em 00_SheetWriter.js, que delega para o OutputManager deste arquivo.
//
// ANTES (causava corrupção de dados):
//     if (typeof SheetWriter === 'undefined') { var SheetWriter = OutputManager; }
//
// O guard era frágil: como o Apps Script avalia todos os arquivos no MESMO
// escopo global e ambos usavam `var`, a atribuição podia ser reavaliada e o
// `SheetWriter` do 00_SheetWriter.js (com implementação PRÓPRIA de escrita)
// competia com este alias. O Orchestrator fazia CoreRegistry.get('SheetWriter')
// sem saber qual das duas implementações recebia — resultado: colunas gravadas
// por códigos diferentes na mesma linha (caso BPAC11: Fibonacci 53,98
// incompatível com Topo50 61,67).
//
// AGORA: UMA única implementação de escrita (este arquivo). O 00_SheetWriter.js
// apenas repassa a chamada. Não reintroduza o alias condicional abaixo.
// =============================================================================


// (O restante do arquivo: TextFormatter, OutputFormatter, CORRIGIR_FORMATACAO_AGORA permanecem iguais)
const TextFormatter = (function () { /* ... seu código existente intacto ... */ })();
var OutputFormatter = TextFormatter;
var OutputManagers  = OutputManager;
function CORRIGIR_FORMATACAO_AGORA() { /* ... seu código existente intacto ... */ }