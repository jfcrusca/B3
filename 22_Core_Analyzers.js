/******************************************************************************/
// 📦 MÓDULO/ARQUIVO: 22_Core_Analyzers.js
// 🛠️  TECNOLOGIA: JAVASCRIPT (V8 / Google Apps Script)
// 📌  VERSÃO: 22.12 — ADX E BOLLINGER CORRIGIDOS + FALLBACKS ROBUSTOS
/******************************************************************************/

const CORE22_CFG = {
  structureLookback: 30,
  swingLookback: 25,
  pivotLeftBars: 2,
  pivotRightBars: 2,
  noisePeriod: 20,
  kNoiseMinDist: 1.5,
  kSwingBuffer: 1.0,
  minStopPctFloor: 0.005,
  maxStopPct: 0.30,
  t1R: 2.0,
  t2R: 3.0,
  penaltyInvalidStop: 40,
  fiboZoneSlackTop: 1.005,
  fiboZoneSlackBot: 0.995,
  confluenceMaxDist: 0.005
};

function STRATEGY_EVALUATE_CORE(data, ibovContext) {
  // =========================================================================
  // 1. NORMALIZAÇÃO ROBUSTA DE ENTRADA
  // =========================================================================
  if (!data) {
    console.error("❌ STRATEGY_EVALUATE_CORE: data é nulo ou indefinido");
    return null;
  }
  
  var candles = null;
  var ticker = 'UNKNOWN';
  var price = 0;
  
  // Caso 1: Array puro de candles
  if (Array.isArray(data)) {
    candles = data;
    if (candles.length > 0 && candles[0] && typeof candles[0] === 'object') {
      ticker = candles[0].ticker || 'UNKNOWN';
      price = candles[candles.length - 1]?.close || 0;
    }
  }
  // Caso 2: Objeto com propriedade candles
  else if (data.candles && Array.isArray(data.candles)) {
    candles = data.candles;
    ticker = data.ticker || (candles[0]?.ticker) || 'UNKNOWN';
    price = data.price || (candles[candles.length - 1]?.close || 0);
  }
  // Caso 3: Objeto que representa um único candle
  else if (typeof data === 'object' && data.close !== undefined) {
    candles = [data];
    ticker = data.ticker || 'UNKNOWN';
    price = data.close;
  }
  // Caso 4: Tentativa de extrair de formato desconhecido
  else {
    console.error("❌ STRATEGY_EVALUATE_CORE: Formato de dados não reconhecido");
    console.log("   Tipo: " + typeof data);
    if (data) console.log("   Chaves: " + Object.keys(data).join(", "));
    return null;
  }
  
  // =========================================================================
  // 2. VALIDAÇÃO DE QUANTIDADE DE CANDLES
  // =========================================================================
  if (!candles || candles.length === 0) {
    console.warn("⚠️ STRATEGY_EVALUATE_CORE: Nenhum candle disponível para " + ticker);
    return null;
  }
  
  if (candles.length < 50) {
    console.warn("⚠️ STRATEGY_EVALUATE_CORE: Apenas " + candles.length + " candles para " + ticker + " (mínimo recomendado: 50)");
    // Continua mesmo assim, mas com advertência
  }
  
  // =========================================================================
  // 3. EXTRAÇÃO DO ÚLTIMO CANDLE (filtrando candle incompleto do dia atual)
  // =========================================================================
  // A Brapi pode retornar o candle do pregão atual com close=null enquanto
  // o mercado ainda está aberto. Filtramos candles sem close válido.
  var candlesValidos = candles.filter(function(c) {
    return c && typeof c.close === 'number' && c.close > 0;
  });
  if (candlesValidos.length === 0) {
    console.error("❌ STRATEGY_EVALUATE_CORE: Nenhum candle com close válido para " + ticker);
    return null;
  }
  if (candlesValidos.length < candles.length) {
    console.warn("⚠️ STRATEGY_EVALUATE_CORE: " + (candles.length - candlesValidos.length) +
      " candle(s) com close inválido removido(s) para " + ticker +
      " (provavelmente candle intraday em aberto)");
  }
  candles = candlesValidos;
  var last = candles[candles.length - 1];
  if (!last || !last.close || last.close <= 0) {
    console.error("❌ STRATEGY_EVALUATE_CORE: Último candle inválido para " + ticker);
    return null;
  }
  
  // =========================================================================
  // 4. CÁLCULO DOS INDICADORES (COM FALLBACKS GARANTIDOS)
  // =========================================================================
  var context = _obterContextoPrecos(candles);
  var ind = _calcularIndicadoresTecnicos(candles, context.closes);
  
  // ✅ GARANTIR QUE ADX EXISTA
  if (ind.adx === undefined || ind.adx === null || isNaN(ind.adx)) {
    ind.adx = 25;
    console.log("   ℹ️ ADX fallback para " + ticker + ": 25");
  }
  
  // ✅ GARANTIR QUE BOLLINGER EXISTA
  if (!ind.bollinger || ind.bollinger.upper === undefined || isNaN(ind.bollinger.upper)) {
    var lastPrice = last.close;
    ind.bollinger = {
      upper: parseFloat((lastPrice * 1.05).toFixed(4)),
      middle: parseFloat(lastPrice.toFixed(4)),
      lower: parseFloat((lastPrice * 0.95).toFixed(4)),
      width: 0.1
    };
    console.log("   ℹ️ Bollinger fallback para " + ticker + ": baseado no preço " + lastPrice);
  }
  
  // ✅ GARANTIR QUE EMA200 EXISTA
  if (ind.ema200 === undefined || ind.ema200 === null || ind.ema200 === 0) {
    ind.ema200 = ind.ema50 || ind.ema21 || last.close;
    console.log("   ℹ️ EMA200 fallback para " + ticker + ": " + ind.ema200);
  }
  
  // =========================================================================
  // 5. ANÁLISE DE PADRÕES (CANDLE PATTERN SCANNER)
  // =========================================================================
  var pa = { bonus: 0, reason: "" };
  if (typeof CandlePatternScanner !== "undefined" && typeof CandlePatternScanner.analyze === "function") {
    try {
      pa = CandlePatternScanner.analyze(candles);
    } catch(e) {
      console.warn("⚠️ CandlePatternScanner falhou para " + ticker + ": " + e.message);
    }
  }
  
  // =========================================================================
  // 6. ANÁLISE DE ESTRUTURA DE MERCADO
  // =========================================================================
  var estrutura = _analisarEstruturaMercado(context, last.close, ind, candles);
  
  // =========================================================================
  // 7. GESTÃO DE RISCO (STOP, ALVOS, RR)
  // =========================================================================
  var risco = _processarGestaoRisco(last.close, ind.atr, estrutura, candles, context.closes);
  
  // =========================================================================
  // 8. CÁLCULO DO SCORE SISTÊMICO
  // =========================================================================
  var scoreFinal = _calcularScoreSistêmico(last.close, ind, estrutura, risco, pa.bonus, ibovContext);
  
  // =========================================================================
  // 9. IDENTIFICAÇÃO DO SETUP
  // =========================================================================
  var setupNome = _identificarSetup(risco.rrRealista, estrutura.inFiboZone, scoreFinal, last.close, ind, risco);
  
  // =========================================================================
  // 10. MONTAGEM DO OBJETO DE RETORNO
  // =========================================================================
  var resultado = {
    ticker: ticker,
    price: parseFloat(last.close.toFixed(2)),
    score: parseFloat(Math.min(100, Math.max(0, scoreFinal)).toFixed(2)),
    rr: parseFloat((risco.rrRealista || 0).toFixed(2)),
    riscoPercent: (risco.stop > 0 && last.close > 0) ? parseFloat(((last.close - risco.stop) / last.close * 100).toFixed(2)) : 0,
    volFactor: parseFloat((risco.volFactor || 0).toFixed(2)),
    setup: setupNome,
    stopLoss: parseFloat((risco.stop || 0).toFixed(2)),
    target1: parseFloat((risco.alvo1 || 0).toFixed(2)),
    target2: parseFloat((risco.alvo2 || 0).toFixed(2)),
    indicators: ind,
    volume: last.volume || 0,
    pivot: parseFloat(((estrutura.h50 + estrutura.l50 + last.close) / 3).toFixed(2)),
    fiboPrice: parseFloat((estrutura.fibo618 || 0).toFixed(2)),
    isWeeklyBullish: last.close > (ind.ema200 || last.close),
    paReason: pa.reason,
    riskDebug: risco.debug || {},
    volumeRelativo: parseFloat((ind.volumeRelativo || 1.0).toFixed(3)),
    volumeStatus: !ind.volumeRelativo ? 'N/A' : ind.volumeRelativo < 0.50 ? 'SECO' : ind.volumeRelativo < 0.70 ? 'FRACO' : ind.volumeRelativo >= 1.50 ? 'FORTE' : ind.volumeRelativo >= 1.20 ? 'ACIMA' : 'NORMAL',
    // ✅ CAMPOS EXPLÍCITOS PARA A IA
    adx: ind.adx,
    bollingerUpper: ind.bollinger?.upper || 0,
    bollingerMiddle: ind.bollinger?.middle || 0,
    bollingerLower: ind.bollinger?.lower || 0,
    // 🔧 CORREÇÃO v9.1: Estratégia de entrada escalonada
    estrategiaEntrada: _determinarEstrategiaEntrada(setupNome, scoreFinal, estrutura, last.close, ind, risco),
    // 🔧 CORREÇÃO v10.2: Campos para IA/DecisionEngine detectarem "perto do topo"
    topo50: parseFloat((estrutura.h50 || 0).toFixed(2)),
    ganhoRapidoPct: estrutura.ganhoRapidoPct || 0,
    distTopoPct: estrutura.distTopoPct || 0
  };
  
  // Log de diagnóstico para debug (opcional - remove em produção)

  if (scoreFinal >= 70) {
    console.log("   🎯 " + ticker + " | Score: " + resultado.score + " | Setup: " + setupNome + " | ADX: " + ind.adx);
  }
  
  return resultado;
}

function _obterContextoPrecos(candles) {
  return {
    closes: candles.map(function(c) { return c.close; }),
    highs: candles.map(function(c) { return (c.high != null ? c.high : c.close); }),
    lows: candles.map(function(c) { return (c.low != null ? c.low : c.close); })
  };
}

function _calcularIndicadoresTecnicos(candles, closes) {
  // Volume Relativo (robusto: mediana dos volumes anteriores)
  var period = 20;
  var volumeRelativo = _core_getVolumeRelativo(candles, period);

  // ✅ CALCULAR ADX (com fallback garantido)
  var adx = _core_getADX(candles, 14);
  if (adx === null || adx === undefined || isNaN(adx)) {
    adx = 25; // Fallback neutro
    console.warn("⚠️ ADX não pôde ser calculado, usando fallback: 25");
  }

  // ✅ CALCULAR BOLLINGER (com fallback garantido)
  var bollinger = _core_getBollinger(closes, 20, 2.0);
  if (!bollinger || bollinger.upper === null || isNaN(bollinger.upper)) {
    var lastPrice = closes[closes.length - 1] || 100;
    bollinger = {
      upper: parseFloat((lastPrice * 1.05).toFixed(4)),
      middle: parseFloat(lastPrice.toFixed(4)),
      lower: parseFloat((lastPrice * 0.95).toFixed(4)),
      width: 0.1
    };
    console.warn("⚠️ Bollinger não pôde ser calculado, usando fallback baseado no preço atual");
  }

  return {
    ema9: _core_getEMA(closes, 9),
    ema21: _core_getEMA(closes, 21),
    ema50: _core_getEMA(closes, 50),
    ema200: _core_getEMA(closes, 200),
    rsi: _core_getRSI(closes, 14),
    atr: _core_getATR(candles, 14),
    vwma20: _core_getVWMA(candles, 20),
    adx: adx,
    bollinger: bollinger,
    volumeRelativo: parseFloat(volumeRelativo.toFixed(3))
  };
}

function _analisarEstruturaMercado(ctx, preco, ind, candles) {
  var lb = CORE22_CFG.structureLookback;
  var h50 = Math.max.apply(null, ctx.highs.slice(-lb));
  var l50 = Math.min.apply(null, ctx.lows.slice(-lb));
  var range50 = h50 - l50;
  var fibo618 = h50 - (range50 * 0.618);
  var fibo50 = h50 - (range50 * 0.50);
  var inFiboZone = (preco <= (fibo50 * CORE22_CFG.fiboZoneSlackTop) && preco >= (fibo618 * CORE22_CFG.fiboZoneSlackBot));
  var distEMA21 = fibo618 > 0 ? (Math.abs(fibo618 - ind.ema21) / fibo618) : 1;
  var distEMA50 = fibo618 > 0 ? (Math.abs(fibo618 - ind.ema50) / fibo618) : 1;
  var temConfluencia = inFiboZone && (distEMA21 <= CORE22_CFG.confluenceMaxDist || distEMA50 <= CORE22_CFG.confluenceMaxDist);
  var swingLow = _core_getLastPivotLow(candles);
  
  // 🔧 CORREÇÃO v10.2: GANHO RÁPIDO ACUMULADO (lookback 10 candles)
  // Detecta movimento acelerado (ex: +12% pós-resultado) — subida vertical curta
  var ganhoRapidoPct = 0;
  try {
    var idxRef = Math.max(0, candles.length - 11);
    var precoRef = Number(candles[idxRef] && candles[idxRef].close) || 0;
    if (precoRef > 0) {
      ganhoRapidoPct = (preco - precoRef) / precoRef;
    }
  } catch(e) {
    console.warn("⚠️ [Core22] Falha ao calcular ganho rápido: " + e.message);
  }
  
  return {
    h50: h50,
    l50: l50,
    fibo618: fibo618,
    fibo50: fibo50,
    inFiboZone: inFiboZone,
    temConfluencia: temConfluencia,
    swingLow: (swingLow != null ? swingLow : l50),
    ganhoRapidoPct: parseFloat(ganhoRapidoPct.toFixed(4)),
    distTopoPct: h50 > 0 ? parseFloat(((h50 - preco) / h50).toFixed(4)) : 0
  };
}

function _processarGestaoRisco(preco, atr, estrutura, candles, closes) {
  var maxStopDist = Math.abs(preco) * CORE22_CFG.maxStopPct;
  var noisePrice = _core_noisePrice(preco, atr, candles, closes);
  var swingStop = _core_getLastPivotLow(candles, CORE22_CFG.swingLookback);
  var stopDistTecnico = (swingStop != null && swingStop < preco) ? (preco - swingStop) : null;
  if (stopDistTecnico != null && stopDistTecnico < noisePrice) {
    stopDistTecnico = noisePrice;
  } else if (stopDistTecnico == null) {
    stopDistTecnico = noisePrice;
  }
  var minStopDist = Math.abs(preco) * CORE22_CFG.minStopPctFloor;
  var stopDist = Math.max(stopDistTecnico, minStopDist);
  var invalidoPorStop = false;
  if (stopDist > maxStopDist) {
    stopDist = maxStopDist;
    invalidoPorStop = true;
  }
  var stop = preco - stopDist;
  var precoAtual = preco;
  var h50 = estrutura.h50;
  var l50 = estrutura.l50;
  var fibo50 = estrutura.fibo50;
  var fibo618 = estrutura.fibo618;
  var range50 = h50 - l50;
  var h50_ext1 = h50 + (range50 * 0.272);
  var h50_ext2 = h50 + (range50 * 0.618);
  var niveis = [h50, fibo618, fibo50, h50_ext1, h50_ext2];
  niveis = niveis.filter(function(n) { return n != null && n > 0; });
  niveis.sort(function(a, b) { return a - b; });
  var alvo1 = preco + stopDist * CORE22_CFG.t1R;
  var alvo2 = preco + stopDist * CORE22_CFG.t2R;
  var rrRealista = (alvo1 - preco) / stopDist;
  var alvoSource = 'FIXO_MULTIPLO';
  function _selecionarAlvo(niveisDisponiveis, precoAtual, stopDist, minRR) {
    minRR = minRR || 1.0;
    for (var n = 0; n < niveisDisponiveis.length; n++) {
      var nivel = niveisDisponiveis[n];
      if (nivel > precoAtual * 1.003) {
        var rrCandidato = (nivel - precoAtual) / stopDist;
        if (rrCandidato >= minRR) {
          var source = 'TECNICO_GENERICO';
          if (nivel === h50) source = 'H50';
          else if (nivel === fibo618) source = 'FIBO618';
          else if (nivel === fibo50) source = 'FIBO50';
          else if (nivel === h50_ext1) source = 'H50_EXT1';
          else if (nivel === h50_ext2) source = 'H50_EXT2';
          return { alvo: nivel, rr: rrCandidato, source: source };
        }
      }
    }
    return { alvo: null, rr: 0, source: null };
  }
  var selecaoAlvo = _selecionarAlvo(niveis, precoAtual, stopDist, 1.0);
  if (selecaoAlvo.alvo != null) {
    alvo1 = selecaoAlvo.alvo;
    rrRealista = selecaoAlvo.rr;
    alvoSource = selecaoAlvo.source;
    var niveisParaAlvo2 = niveis.filter(function(n) { return n > alvo1 * 1.003; });
    var selecaoAlvo2 = _selecionarAlvo(niveisParaAlvo2, precoAtual, stopDist, rrRealista + 0.5);
    if (selecaoAlvo2.alvo != null) {
      alvo2 = selecaoAlvo2.alvo;
    } else {
      alvo2 = alvo1 + (alvo1 - stop) * 0.5;
    }
  } else {
    alvo1 = preco + stopDist * CORE22_CFG.t1R;
    alvo2 = preco + stopDist * CORE22_CFG.t2R;
    rrRealista = (alvo1 - preco) / stopDist;
    alvoSource = 'FIXO_MULTIPLO_FALLBACK';
  }
  return {
    stop: stop,
    alvo1: alvo1,
    alvo2: alvo2,
    rrRealista: parseFloat(rrRealista.toFixed(2)),
    volFactor: 1.0,
    debug: {
      precoAtual: preco,
      atr: atr,
      noisePrice: noisePrice,
      swingStop: swingStop,
      maxStopDist: maxStopDist,
      minStopDist: minStopDist,
      stopDistTecnico: stopDistTecnico,
      stopDistFinal: stopDist,
      invalidoPorStop: invalidoPorStop,
      stopSource: (swingStop != null && swingStop < preco) ? 'SWING_PIVOT' : 'ATR_FALLBACK',
      alvoSource: alvoSource,
      h50: h50,
      l50: l50,
      fibo50: fibo50,
      fibo618: fibo618,
      h50_ext1: h50_ext1,
      h50_ext2: h50_ext2,
      rrDinamico: parseFloat(rrRealista.toFixed(2))
    }
  };
}

function _calcularScoreSistêmico(preco, ind, est, rsc, bonusPA, ibov) {
  var s = 30;

  // ✅ NOVO: Flag para identificar se é um setup de RADAR
  var isRadar = false;
  if (rsc && rsc.rrRealista >= 1.8 && est.inFiboZone) {
      isRadar = true;
  }

  // =========================================================================
  // 1. CONFIRMAÇÃO DE TENDÊNCIA (ADX OTIMIZADO)
  // =========================================================================
  if (ind.adx >= 30) {
    s += 25;  // Tendência forte
  } else if (ind.adx >= 25) {
    s += 20;  // Tendência confirmada
  } else if (ind.adx >= 22) {
    s += 12;  // Tendência nascente (NOVO)
  } else if (ind.adx >= 20) {
    s += 5;   // Tendência fraca
  } else {
    s -= 45;  // 🚨 PENALIDADE AUMENTADA: Impede score alto em mercado sem tendência
  }
  
  // Preço acima das médias móveis
  if (preco > ind.ema21) s += 10;
  if (ind.ema21 > ind.ema50) s += 10;
  if (preco > ind.ema200 && ind.ema200 > 0) s += 10;
  
  // Alinhamento completo das médias
  if (preco > ind.ema21 && ind.ema21 > ind.ema50 && ind.ema50 > ind.ema200) {
    s += 15;
  }

  // =========================================================================
  // 2. MOMENTUM (RSI COM COMPENSAÇÃO DE ADX)
  // =========================================================================
  if (ind.rsi >= 55 && ind.rsi <= 70) {
    s += 20;  // Zona ideal
  } else if (ind.rsi >= 50 && ind.rsi < 55) {
    // ADX forte compensa RSI neutro
    if (ind.adx >= 28) {
      s += 10;
    } else {
      s += 5;
    }
  } else if (ind.rsi >= 45 && ind.rsi < 50) {
    if (ind.adx >= 30) {
      s += 5;  // ADX muito forte compensa
    }
  } else if (ind.rsi > 70) {
    s -= 20;  // Sobrecomprado
  } else if (ind.rsi < 40) {
    s -= 15;
  }

  // =========================================================================
  // 3. VOLUME (CONFIRMAÇÃO) — MELHORADO v11
  // =========================================================================
  if (ind.volumeRelativo >= 2.0) {
    s += 25;  // Volume muito forte: bônus extra
  } else if (ind.volumeRelativo >= 1.5) {
    s += 20;
  } else if (ind.volumeRelativo >= 1.2) {
    s += 12;
  } else if (ind.volumeRelativo >= 1.0) {
    s += 5;
  } else if (ind.volumeRelativo >= 0.7) {
    s -= 15;  // 🔧 AUMENTADO de -10 para -15
  } else {
    s -= 30;  // 🔧 AUMENTADO de -20 para -30 (volume muito baixo)
  }
  
  // 🚨 NOVO: Se volume relativo < 0.6, penalidade severa (mata o score)
  // Volume baixo para swing trade = iliquidez = risco de não conseguir executar
  if (ind.volumeRelativo < 0.6) {
    s -= 30; // Penalidade adicional cumulativa
  }

  // =========================================================================
  // 4. CONFLUÊNCIA FIBONACCI E VOLUME RELATIVO (OTIMIZADA)
  // =========================================================================
  // Score de Confluência: Sinergia entre níveis Fibo e Volume Forte
  if (est.inFiboZone) {
    s += 20;
    // Bônus se Volume for forte na zona de Fibonacci
    if (ind.volumeRelativo >= 1.2) s += 15;
  }
  
  if (est.temConfluencia) {
    s += 25;
    // Bônus extra por alta confluência e volume
    if (ind.volumeRelativo >= 1.5) s += 10;
  }

  // =========================================================================
  // 5. RISCO/REWARD (OTIMIZADO v11: MÍNIMO EFETIVO 2.0, GAMA MAIS RIGOROSA)
  // =========================================================================
  // Para swing trade, RR mínimo aceito é 2.0 (já filtrado no Orchestrator)
  // Aqui refinamos a pontuação dentro dos aprovados
  if (rsc && rsc.rrRealista >= 4.0) {
    s += 20;  // Excelente
  } else if (rsc && rsc.rrRealista >= 3.0) {
    s += 15;
  } else if (rsc && rsc.rrRealista >= 2.5) {
    s += 10;
  } else if (rsc && rsc.rrRealista >= 2.0) {
    s += 5;   // Aceitável (mas sem bônus máximo)
  } else if (rsc && rsc.rrRealista >= 1.8) {
    s -= 10;  // Penalidade leve (só entra com ADX forte)
  } else if (rsc && rsc.rrRealista < 1.8) {
    s -= 50;  // 🚨 PENALIDADE SEVERA
  }

  // =========================================================================
  // 6. PADRÕES DE PRICE ACTION
  // =========================================================================
  s += (bonusPA || 0);

  // =========================================================================
  // 7. CONTEXTO MACRO
  // =========================================================================
  var regime = (ibov && ibov.regime) ? ibov.regime : "NEUTRAL";
  if (regime === "BULLISH") s += 15;
  if (regime === "DEFENSIVE") s -= 10; // Penalidade leve em mercado instável/defensivo para permitir boas oportunidades
  if (regime === "BEARISH") s -= 30;

  // =========================================================================
  // 7.1 🔧 CORREÇÃO v10.1: PENALIDADE POR EXTENSÃO (DISTÂNCIA DA EMA21)
  // Mede o quanto o preço está "esticado" acima da média
  // ⚠️ LIMITAÇÃO v10.1: Em subida vertical (pós-resultado), a EMA21 "persegue"
  // o preço rapidamente, subestimando a extensão. A v10.2 adiciona métricas
  // de topo recente (h50) e ganho acumulado rápido (seções 7.2 e 7.3).
  // =========================================================================
  if (ind.ema21 > 0 && preco > ind.ema21) {
    var extPctCore = (preco - ind.ema21) / ind.ema21;
    if (extPctCore > 0.10) {
      s -= 25;  // Esticado demais
      console.warn("⚠️ [Core22] Preço esticado " + (extPctCore * 100).toFixed(1) + "% acima da EMA21 — penalidade -25 (timing ruim)");
    } else if (extPctCore > 0.07) {
      s -= 15;
      console.warn("⚠️ [Core22] Preço esticado " + (extPctCore * 100).toFixed(1) + "% acima da EMA21 — penalidade -15");
    } else if (extPctCore > 0.04) {
      s -= 8;
      console.log("ℹ️ [Core22] Preço levemente esticado " + (extPctCore * 100).toFixed(1) + "% acima da EMA21 — penalidade -8");
    }
  }

  // =========================================================================
  // 7.2 🔧 CORREÇÃO v10.2: PREÇO COLADO NO TOPO RECENTE (H50)
  // Se o preço está nos 3% abaixo da máxima de 30 candles, comprar agora
  // significa pagar preço cheio do movimento — alto risco de pullback
  // =========================================================================
  if (est.h50 > 0 && preco > 0) {
    var distTopoCore = (est.h50 - preco) / est.h50;
    if (distTopoCore < 0.01) {
      s -= 20;  // Preço no topo (dentro de 1%)
      console.warn("⚠️ [Core22] Preço NO TOPO recente (distância " + (distTopoCore * 100).toFixed(1) + "% da máxima) — penalidade -20");
    } else if (distTopoCore < 0.03) {
      s -= 12;  // Preço muito próximo do topo (dentro de 3%)
      console.warn("⚠️ [Core22] Preço próximo ao TOPO recente (distância " + (distTopoCore * 100).toFixed(1) + "% da máxima) — penalidade -12");
    } else if (distTopoCore < 0.05) {
      s -= 6;   // Preço relativamente próximo do topo (dentro de 5%)
      console.log("ℹ️ [Core22] Preço a " + (distTopoCore * 100).toFixed(1) + "% do topo recente — penalidade leve -6");
    }
  }

  // =========================================================================
  // 7.3 🔧 CORREÇÃO v10.2: GANHO RÁPIDO ACUMULADO (MOVIMENTO ACELERADO)
  // Deteta subida vertical curta (ex: +12% pós-resultado em poucos candles)
  // Mesmo se a EMA21 alcançou o preço, o movimento rápido cria risco de
  // realização de lucros / exhaustion gap
  // =========================================================================
  if (est.ganhoRapidoPct > 0) {
    if (est.ganhoRapidoPct > 0.12) {
      s -= 25;  // Subida de mais de 12% em 10 sessões = esticado vertical
      console.warn("⚠️ [Core22] GANHO RÁPIDO de " + (est.ganhoRapidoPct * 100).toFixed(1) + "% em 10 candles (movimento acelerado) — penalidade -25");
    } else if (est.ganhoRapidoPct > 0.08) {
      s -= 15;
      console.warn("⚠️ [Core22] GANHO RÁPIDO de " + (est.ganhoRapidoPct * 100).toFixed(1) + "% em 10 candles — penalidade -15");
    } else if (est.ganhoRapidoPct > 0.05) {
      s -= 8;
      console.log("ℹ️ [Core22] Ganho de " + (est.ganhoRapidoPct * 100).toFixed(1) + "% em 10 candles — penalidade leve -8");
    }
  }

  // =========================================================================
  // 8. BOLLINGER BANDS — ENTRY TIMING QUALITY (CALIBRADO v12.1)
  // =========================================================================
  // ⚠️ NOTA: Ativos em tendência forte NORMALMENTE negociam nos 30% superiores
  // da banda. Penalidades excessivas matam scores de ativos com ADX forte.
  // A calibragem abaixo só pune situações EXTREMAS.
  if (ind.bollinger) {
    var bbUpper = ind.bollinger.upper;
    var bbLower = ind.bollinger.lower;
    var bbMiddle = ind.bollinger.middle;
    var bbWidth = bbUpper - bbLower;
    
    // Penalidade APENAS se preço está ACIMA ou COLADO na Banda Superior
    // (entrar aqui é pagar "preço cheio" de uma esticada)
    // A penalidade é REDUZIDA se ADX for forte (tendência madura justifica)
    if (preco > bbUpper) {
      s -= 15;  // Acima da banda = esticado demais (penalidade alta)
    } else if (preco >= bbUpper * 0.98) {
      s -= (ind.adx >= 25) ? 5 : 10;  // Nos 2% superiores: penalidade leve se tendência forte
    } else if (preco >= bbUpper * 0.95) {
      s -= (ind.adx >= 30) ? 0 : 5;  // Nos 5% superiores: só penaliza se ADX fraco
    }
    
    // Posição relativa dentro das Bandas (0 = inferior, 1 = superior)
    if (bbWidth > 0 && preco >= bbLower && preco <= bbUpper) {
      var bbPosition = (preco - bbLower) / bbWidth;
      // Só penaliza se estiver no topo E RSI sobrecomprado E ADX fraco (topo de mercado)
      if (bbPosition > 0.80 && ind.rsi > 70 && ind.adx < 30) {
        s -= 8; // Topo de banda sem tendência forte = distribuição
      }
      // Na parte inferior com RSI baixo e tendência de alta = pullback comprável
      if (bbPosition < 0.25 && ind.rsi < 40 && ind.adx >= 20) {
        s += 10; // Pullback na banda inferior com tendência
      }
    }
    
    // Preço abaixo da banda inferior com tendência de alta = pullback COMPRÁVEL
    if (preco < bbLower && preco > ind.ema200 && ind.adx >= 20) {
      s += 12; // Pullback extremo dentro de tendência de alta
    }
  }

  // =========================================================================
  // 9. STOP INVIÁVEL
  // =========================================================================
  if (rsc && rsc.invalidoPorStop) s -= 50;

  // =========================================================================
  // 10. BÔNUS MACRO
  // =========================================================================
  if (rsc && rsc.macroMultiplier && rsc.macroMultiplier > 1) {
    s = s * rsc.macroMultiplier;
  }

  // ✅ CORREÇÃO CRÍTICA: Teto de score para setups de RADAR para evitar contradição lógica.
  // Um setup que pede para "AGUARDAR" não deve ter score de entrada imediata (> 85).
  if (isRadar) {
    s = Math.min(s, 75);
  }

  return Math.min(100, Math.max(0, Math.round(s)));
}

function _identificarSetup(rr, inFibo, score, preco, ind, risco) {
  // =========================================================================
  // NÍVEL 1: SETUP IDEAL PARA SWING TRADE
  // =========================================================================
  
  // SWING IDEAL: Pullback na zona de Fibonacci + tendência forte + R/R >= 2.0
  if (rr >= 2.0 && inFibo && score >= 75 && ind.adx >= 25 && ind.volumeRelativo >= 1.0) {
    return "🎯 SWING IDEAL (FIBO + TENDÊNCIA)";
  }
  
  // SWING PULLBACK FIBO: Pullback na zona de Fibonacci + score alto
  // 🔧 CORREÇÃO v9.1: RR reduzido de 2.0 para 1.8 para capturar setups de alta qualidade
  // com RR marginal (ex: WEGE3 score 92, RR 1.81). Score alto + ADX forte compensam RR ligeiramente abaixo de 2.0
  if (rr >= 1.8 && inFibo && score >= 70 && ind.adx >= 20) {
    return "📉 SWING PULLBACK FIBO";
  }

  
  // =========================================================================
  // NÍVEL 2: SETUPS DE ALTA QUALIDADE
  // =========================================================================
  
  // MOMENTUM FORTE: Rompimento com volume e tendência
  if (rr >= 2.0 && preco > ind.ema9 && ind.ema9 > ind.ema21 && score >= 75 && ind.volumeRelativo >= 1.5 && ind.adx >= 25) {
    return "🚀 MOMENTUM FORTE (ROMPIMENTO)";
  }
  
  // TENDÊNCIA CONFIRMADA: Médias alinhadas + ADX forte
  // 🔧 CORREÇÃO v9: Threshold reduzido de 65 para 60 (alinhado com DecisionEngine)
  if (rr >= 2.0 && preco > ind.ema21 && ind.ema21 > ind.ema50 && ind.adx >= 25 && score >= 60) {
    return "📈 TENDÊNCIA CONFIRMADA";
  }

  // 🔧 CORREÇÃO v9.1: TENDÊNCIA FORTE (score alto + ADX forte, mesmo sem Fibo)
  // Captura ativos como WEGE3 (score 92, RR 1.81, ADX 27) que têm qualidade excepcional
  // mas não estão exatamente na zona de Fibonacci
  if (score >= 80 && rr >= 1.8 && ind.adx >= 25 && preco > ind.ema21) {
    return "📈 TENDÊNCIA FORTE (SCORE ALTO)";
  }

  // =========================================================================
  // NÍVEL 3: SETUPS EM OBSERVAÇÃO (RADAR)
  // =========================================================================

  
  // RADAR PULLBACK: Quase na zona Fibo, aguardar confirmação
  // ✅ CORREÇÃO v9: Threshold reduzido de 60 para 55 (alinhado com DecisionEngine)
  if (rr >= 1.8 && inFibo && score >= 55) {
    if (score > 70) {
       // Se o score for muito alto, mas ainda for radar, indica que algo falta para a entrada imediata
       return "🔭 RADAR PULLBACK (ALTA CONVICÇÃO - AGUARDAR)";
    }
    return "🔭 RADAR PULLBACK (AGUARDAR)";
  }
  
  // RADAR TENDÊNCIA: Tendência boa, mas falta volume ou ADX
  // ✅ CORREÇÃO v9: Threshold reduzido de 60 para 55 (alinhado com DecisionEngine)
  if (rr >= 2.0 && preco > ind.ema21 && score >= 55 && ind.adx >= 20) {
    return "🔭 RADAR TENDÊNCIA (AGUARDAR VOLUME)";
  }

  
  // =========================================================================
  // NÍVEL 4: DESCARTAR
  // =========================================================================
  
  // Risco muito alto (R/R baixo)
  if (rr < 1.5) {
    return "⛔ RISCO ALTO (RR < 1.5)";
  }
  
  // Stop inviável
  if (risco && risco.invalidoPorStop) {
    return "🛑 STOP INVIÁVEL";
  }
  
  // Score muito baixo
  if (score < 50) {
    return "⏸️ SCORE BAIXO (DESCARTAR)";
  }
  
  // Padrão padrão
  return "⏸️ AGUARDAR MELHOR SETUP";
}

// ============================================================================
// FUNÇÕES DE CÁLCULO DE INDICADORES (COM FALLBACKS ROBUSTOS)
// ============================================================================

function _core_getATR(candles, period) {
  if (!candles || candles.length < period + 1) {
    var lastClose = candles && candles.length > 0 ? candles[candles.length - 1].close : 100;
    return lastClose * 0.02; // Fallback: 2% do preço
  }
  var trs = [];
  for (var i = 1; i < candles.length; i++) {
    var curr = candles[i], prev = candles[i - 1];
    var h = (curr.high != null) ? curr.high : curr.close;
    var l = (curr.low != null) ? curr.low : curr.close;
    var pc = prev.close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (trs.length < period) return trs[trs.length - 1] || 0;
  var atr = 0;
  for (var j = 0; j < period; j++) atr += trs[j];
  atr = atr / period;
  for (var k = period; k < trs.length; k++) {
    atr = ((atr * (period - 1)) + trs[k]) / period;
  }
  return parseFloat(atr.toFixed(4));
}

function _core_getEMA(values, period) {
  var v = [];
  for (var i = 0; i < values.length; i++) {
    if (typeof values[i] === "number" && !isNaN(values[i])) v.push(values[i]);
  }
  if (v.length < period) {
    if (v.length > 0) {
      var sum = 0;
      for (var i = 0; i < v.length; i++) sum += v[i];
      return parseFloat((sum / v.length).toFixed(2));
    }
    return 0;
  }
  var k = 2 / (period + 1);
  var ema = v[0];
  for (var i = 1; i < v.length; i++) ema = (v[i] * k) + (ema * (1 - k));
  return parseFloat(ema.toFixed(2));
}

function _core_getRSI(values, period) {
  period = period || 14;
  if (!values || values.length <= period) return 50;
  var gains = 0, losses = 0;
  for (var i = 1; i <= period; i++) {
    var diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  var avgGain = gains / period, avgLoss = losses / period;
  for (var i = period + 1; i < values.length; i++) {
    var diff = values[i] - values[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }
  if (avgLoss === 0) return 100;
  var rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function _core_getVWMA(candles, period) {
  if (!candles || candles.length < period) {
    var lastCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
    return lastCandle ? lastCandle.close : 0;
  }
  var sumVP = 0, sumVolume = 0;
  for (var i = candles.length - period; i < candles.length; i++) {
    var c = candles[i];
    var h = (c.high != null) ? c.high : c.close;
    var l = (c.low != null) ? c.low : c.close;
    var v = (c.volume != null) ? c.volume : 0;
    sumVP += ((h + l + c.close) / 3) * v;
    sumVolume += v;
  }
  if (sumVolume === 0) return candles[candles.length - 1].close;
  return sumVP / sumVolume;
}

function _core_getADX(candles, period) {
  period = period || 14;
  
  // Verifica se há dados suficientes
  if (!candles || candles.length < period * 2) {
    console.warn("⚠️ ADX: Dados insuficientes (" + (candles?.length || 0) + " candles), usando fallback 20");
    return 20;  // Fallback conservador (tendência fraca)
  }
  
  var tr = [], plusDM = [], minusDM = [];
  
  for (var i = 1; i < candles.length; i++) {
    var cur = candles[i], prev = candles[i - 1];
    var hC = cur.high != null ? cur.high : cur.close;
    var lC = cur.low != null ? cur.low : cur.close;
    var hP = prev.high != null ? prev.high : prev.close;
    var lP = prev.low != null ? prev.low : prev.close;
    var cP = prev.close;
    var upMove = hC - hP, downMove = lP - lC;
    
    plusDM.push((upMove > downMove && upMove > 0) ? upMove : 0);
    minusDM.push((downMove > upMove && downMove > 0) ? downMove : 0);
    tr.push(Math.max(hC - lC, Math.abs(hC - cP), Math.abs(lC - cP)));
  }
  
  function wilderSmooth(arr) {
    if (arr.length < period) return [];
    var result = [];
    var seed = 0;
    for (var j = 0; j < period; j++) seed += arr[j];
    result[period - 1] = seed;
    for (var k = period; k < arr.length; k++) {
      result[k] = result[k - 1] - (result[k - 1] / period) + arr[k];
    }
    return result;
  }
  
  var sTR = wilderSmooth(tr);
  var sDMp = wilderSmooth(plusDM);
  var sDMn = wilderSmooth(minusDM);
  
  if (!sTR.length || !sDMp.length || !sDMn.length) {
    console.warn("⚠️ ADX: Smoothing falhou, usando fallback 20");
    return 20;
  }
  
  var plusDI = [], minusDI = [];
  for (var i = period - 1; i < tr.length; i++) {
    var t = sTR[i] || 0;
    plusDI.push(t === 0 ? 0 : (sDMp[i] / t) * 100);
    minusDI.push(t === 0 ? 0 : (sDMn[i] / t) * 100);
  }
  
  var dx = [];
  for (var i = 0; i < plusDI.length; i++) {
    var sum = plusDI[i] + minusDI[i];
    dx.push(sum === 0 ? 0 : (Math.abs(plusDI[i] - minusDI[i]) / sum) * 100);
  }
  
  if (dx.length < period) {
    console.warn("⚠️ ADX: Dados insuficientes após cálculo, usando fallback 20");
    return 20;
  }
  
  var adx = 0;
  for (var i = 0; i < period; i++) adx += dx[i];
  adx = adx / period;
  
  for (var i = period; i < dx.length; i++) {
    adx = (adx * (period - 1) + dx[i]) / period;
  }
  
  if (adx === null || isNaN(adx) || !isFinite(adx)) {
    console.warn("⚠️ ADX: Valor inválido, usando fallback 20");
    return 20;
  }
  
  return parseFloat(adx.toFixed(2));
}
function _core_getBollinger(closes, period, mult) {
  period = period || 20;
  mult = mult || 2.0;
  
  if (!closes || closes.length < period) {
    var avg = 0;
    for (var i = 0; i < closes.length; i++) avg += closes[i];
    avg = avg / (closes.length || 1);
    return {
      upper: parseFloat((avg * 1.05).toFixed(4)),
      middle: parseFloat(avg.toFixed(4)),
      lower: parseFloat((avg * 0.95).toFixed(4)),
      width: 0.1
    };
  }
  
  var slice = closes.slice(-period);
  var sum = 0;
  for (var i = 0; i < slice.length; i++) sum += slice[i];
  var sma = sum / period;
  var variance = 0;
  for (var j = 0; j < slice.length; j++) variance += Math.pow(slice[j] - sma, 2);
  var std = Math.sqrt(variance / period);
  
  return {
    upper: parseFloat((sma + mult * std).toFixed(4)),
    middle: parseFloat(sma.toFixed(4)),
    lower: parseFloat((sma - mult * std).toFixed(4)),
    width: parseFloat((sma > 0 ? ((2 * mult * std) / sma) : 0).toFixed(4))
  };
}

function _core_getLogReturns(closes) {
  var rets = [];
  for (var i = 1; i < closes.length; i++) {
    var a = closes[i - 1], b = closes[i];
    if (a > 0 && b > 0) rets.push(Math.log(b / a));
  }
  return rets;
}

function _core_getMedian(arr) {
  var a = [];
  for (var i = 0; i < arr.length; i++) {
    if (typeof arr[i] === "number" && !isNaN(arr[i])) a.push(arr[i]);
  }
  a.sort(function(x, y) { return x - y; });
  if (!a.length) return 0;
  var m = Math.floor(a.length / 2);
  return (a.length % 2) ? a[m] : (a[m - 1] + a[m]) / 2;
}

function _core_getRobustSigma(arr) {
  var med = _core_getMedian(arr);
  var dev = [];
  for (var i = 0; i < arr.length; i++) dev.push(Math.abs(arr[i] - med));
  return 1.4826 * _core_getMedian(dev);
}

function _core_estimarRuidoEstatistico(candles, closes, period) {
  period = period || 20;
  var tailCloses = (closes || []).slice(-Math.max(period + 1, 2));
  var rets = _core_getLogReturns(tailCloses);
  return { sigmaLogRet: _core_getRobustSigma(rets) };
}

function _core_noisePrice(preco, atr, candles, closes) {
  var est = _core_estimarRuidoEstatistico(candles, closes, CORE22_CFG.noisePeriod);
  var sigma = est?.sigmaLogRet || 0;
  var sigmaP = Math.abs(preco) * sigma;
  var base = Math.max(Math.abs(atr || 0), sigmaP);
  var floorAbs = Math.abs(preco) * CORE22_CFG.minStopPctFloor;
  return Math.max(base, floorAbs);
}

function _core_detectPivotLows(candles, leftBars, rightBars) {
  leftBars = leftBars || CORE22_CFG.pivotLeftBars;
  rightBars = rightBars || CORE22_CFG.pivotRightBars;
  var pivots = [];
  if (!candles || candles.length < (leftBars + rightBars + 1)) return pivots;
  for (var i = leftBars; i < candles.length - rightBars; i++) {
    var low = (candles[i].low != null) ? candles[i].low : candles[i].close;
    var ok = true;
    for (var l = 1; l <= leftBars; l++) {
      var prevLow = (candles[i - l].low != null) ? candles[i - l].low : candles[i - l].close;
      if (low > prevLow) { ok = false; break; }
    }
    if (!ok) continue;
    for (var r = 1; r <= rightBars; r++) {
      var nextLow = (candles[i + r].low != null) ? candles[i + r].low : candles[i + r].close;
      if (low > nextLow) { ok = false; break; }
    }
    if (ok) pivots.push({ index: i, price: low });
  }
  return pivots;
}

function _core_getLastPivotLow(candles, lookback, leftBars, rightBars) {
  lookback = lookback || CORE22_CFG.swingLookback;
  leftBars = leftBars || CORE22_CFG.pivotLeftBars;
  rightBars = rightBars || CORE22_CFG.pivotRightBars;
  if (!candles || candles.length < 10) return null;
  var start = Math.max(0, candles.length - lookback);
  var slice = candles.slice(start);
  var pivots = _core_detectPivotLows(slice, leftBars, rightBars);
  if (!pivots.length) return null;
  return pivots[pivots.length - 1].price;
}




function _core_getVolumeRelativo(candles, period) {
  period = period || 20;
  
  if (!candles || candles.length < period + 1) {
    console.warn("⚠️ Volume Relativo: Dados insuficientes, usando 1.0");
    return 1.0;
  }
  
  // Coletar volumes anteriores (exclui o último candle)
  var start = Math.max(0, candles.length - period - 1);
  var vols = [];
  for (var i = start; i < candles.length - 1; i++) {
    var v = Number(candles[i].volume || 0);
    if (v > 0) vols.push(v);
  }

  if (!vols.length) return 1.0;

  // Usar mediana para robustez contra outliers
  var median = _core_getMedian(vols);
  var lastVol = Number(candles[candles.length - 1].volume || 0);

  if (median === 0) return 1.0;
  return parseFloat((lastVol / median).toFixed(3));
}




// ============================================================================
// FUNÇÃO: ESTRATÉGIA DE ENTRADA ESCALONADA (v9.1)
// ============================================================================
// Determina a recomendação de entrada baseada no setup e indicadores:
// - "ENTRAR AGORA" → entrada total imediata
// - "ENTRAR 50% AGORA + AGUARDAR FIBO" → entrada parcial + reentrada no Fibo
// - "AGUARDAR FIBO" → esperar correção até zona Fibonacci
// - "AGUARDAR CONFIRMAÇÃO" → esperar mais indicadores
// ============================================================================

function _determinarEstrategiaEntrada(setup, score, estrutura, preco, ind, risco) {
  // 🔧 CORREÇÃO v10.2: PREÇO COLADO NO TOPO RECENTE (H50)
  // Se preço está dentro de 3% da máxima de 30 candles → está "perto do topo"
  if (estrutura && estrutura.h50 > 0 && preco > 0 && estrutura.h50 > preco) {
    var distTopoEntrada = (estrutura.h50 - preco) / estrutura.h50;
    if (distTopoEntrada < 0.01) {
      return "⏳ AGUARDAR PULLBACK (PREÇO NO TOPO RECENTE R$" + estrutura.h50.toFixed(2) + ")";
    }
    if (distTopoEntrada < 0.03) {
      return "🟡 ENTRAR 50% AGORA + AGUARDAR PULLBACK (PREÇO A " + (distTopoEntrada * 100).toFixed(1) + "% DO TOPO)";
    }
  }
  
  // 🔧 CORREÇÃO v10.2: GANHO RÁPIDO ACUMULADO (MOVIMENTO ACELERADO)
  // Detecta subida vertical (ex: +12% pós-resultado) mesmo se EMA21 "perseguiu" o preço
  if (estrutura && estrutura.ganhoRapidoPct > 0.08) {
    return "⏳ AGUARDAR PULLBACK (GANHO RÁPIDO +" + (estrutura.ganhoRapidoPct * 100).toFixed(1) + "% EM 10 SESSÕES)";
  }
  
  // 🔧 CORREÇÃO v10.1: SE PREÇO ESTICADO ACIMA DA EMA21 → AGUARDAR PULLBACK
  if (ind && ind.ema21 > 0 && preco > ind.ema21) {
    var extPct = (preco - ind.ema21) / ind.ema21;
    if (extPct > 0.07) {
      return "⏳ AGUARDAR PULLBACK (PREÇO ESTICADO +" + (extPct * 100).toFixed(0) + "% ACIMA DA MÉDIA)";
    }
    if (extPct > 0.04 && setup.indexOf("FIBO") === -1) {
      return "🟡 ENTRAR 50% AGORA + AGUARDAR PULLBACK (PREÇO LEVEMENTE ESTICADO)";
    }
  }
  
  // Setup de COMPRA IMEDIATA (score alto, tendência forte)
  if (setup.indexOf("SWING IDEAL") !== -1) {
    return "✅ ENTRAR AGORA (FIBO + TENDÊNCIA)";
  }
  
  if (setup.indexOf("SWING PULLBACK FIBO") !== -1) {
    if (estrutura.inFiboZone) {
      return "✅ ENTRAR AGORA (NA ZONA FIBO)";
    }
    return "⏳ AGUARDAR FIBO (PREÇO ACIMA DA ZONA)";
  }
  
  if (setup.indexOf("MOMENTUM FORTE") !== -1) {
    return "✅ ENTRAR AGORA (ROMPIMENTO)";
  }
  
  if (setup.indexOf("TENDÊNCIA CONFIRMADA") !== -1) {
    return "✅ ENTRAR AGORA (TENDÊNCIA CONFIRMADA)";
  }
  
  // 🔧 CORREÇÃO v9.1: TENDÊNCIA FORTE — entrada escalonada
  if (setup.indexOf("TENDÊNCIA FORTE") !== -1) {
    if (estrutura.inFiboZone) {
      return "✅ ENTRAR AGORA (NA ZONA FIBO)";
    }
    // Score altíssimo + tendência forte: entrada parcial agora + aguardar Fibo
    if (score >= 80 && ind.adx >= 25) {
      return "🟡 ENTRAR 50% AGORA + AGUARDAR FIBO R$" + (estrutura.fibo618 ? estrutura.fibo618.toFixed(2) : "N/A");
    }
    return "✅ ENTRAR AGORA (TENDÊNCIA FORTE)";
  }
  
  // Setups de RADAR (observação)
  if (setup.indexOf("RADAR PULLBACK") !== -1) {
    if (score > 70) {
      return "🔭 AGUARDAR CONFIRMAÇÃO (ALTA CONVICÇÃO)";
    }
    return "🔭 AGUARDAR FIBO + VOLUME";
  }
  
  if (setup.indexOf("RADAR TENDÊNCIA") !== -1) {
    return "🔭 AGUARDAR VOLUME + ADX";
  }
  
  if (setup.indexOf("AGUARDAR MELHOR SETUP") !== -1) {
    if (score >= 70) {
      return "🟡 ENTRAR 50% AGORA + AGUARDAR MELHOR PONTO";
    }
    return "⏳ AGUARDAR MELHOR SETUP";
  }
  
  // Setups de DESCARTE
  if (setup.indexOf("RISCO ALTO") !== -1) return "⛔ NÃO ENTRAR (RR BAIXO)";
  if (setup.indexOf("STOP INVIÁVEL") !== -1) return "⛔ NÃO ENTRAR (STOP LONGE)";
  if (setup.indexOf("SCORE BAIXO") !== -1) return "⛔ NÃO ENTRAR (SCORE BAIXO)";
  
  return "⏳ AGUARDAR";
}

// ============================================================================
// FUNÇÃO DE DIAGNÓSTICO PARA VERIFICAR INDICADORES (CORRIGIDA)
// ============================================================================


function DIAGNOSTICAR_INDICADORES(ticker) {
  ticker = ticker || "PETR4";
  console.log("🔍 DIAGNOSTICANDO INDICADORES PARA: " + ticker);
  
  try {
    var resultado = DataService.getMarketData(ticker);
    
    // Verifica a estrutura retornada
    var candles = null;
    if (resultado && Array.isArray(resultado)) {
      candles = resultado;
    } else if (resultado && resultado.candles && Array.isArray(resultado.candles)) {
      candles = resultado.candles;
    } else {
      console.error("❌ Estrutura de dados inesperada para " + ticker);
      console.log("   Tipo retornado: " + typeof resultado);
      if (resultado) console.log("   Chaves: " + Object.keys(resultado).join(", "));
      return;
    }
    
    if (!candles || candles.length === 0) {
      console.error("❌ Sem candles para " + ticker);
      return;
    }
    
    console.log("   ✅ " + candles.length + " candles obtidos");
    
    var context = _obterContextoPrecos(candles);
    var ind = _calcularIndicadoresTecnicos(candles, context.closes);
    
    console.log("📊 RESULTADOS:");
    console.log("  - ADX: " + (ind.adx !== undefined && ind.adx !== null ? ind.adx : "NÃO CALCULADO"));
    console.log("  - Bollinger Upper: " + (ind.bollinger?.upper || "NÃO CALCULADO"));
    console.log("  - Bollinger Middle: " + (ind.bollinger?.middle || "NÃO CALCULADO"));
    console.log("  - Bollinger Lower: " + (ind.bollinger?.lower || "NÃO CALCULADO"));
    console.log("  - RSI: " + (ind.rsi || "NÃO CALCULADO"));
    console.log("  - ATR: " + (ind.atr || "NÃO CALCULADO"));
    console.log("  - Volume Relativo: " + (ind.volumeRelativo || "NÃO CALCULADO"));
    console.log("  - EMA9: " + (ind.ema9 || "NÃO CALCULADO"));
    console.log("  - EMA21: " + (ind.ema21 || "NÃO CALCULADO"));
    console.log("  - EMA50: " + (ind.ema50 || "NÃO CALCULADO"));
    console.log("  - EMA200: " + (ind.ema200 || "NÃO CALCULADO"));
    
    return ind;
    
  } catch (e) {
    console.error("❌ Erro no diagnóstico: " + e.message);
    console.error(e.stack);
  }
}







function TESTAR_FUNCAO_CORE() {
  var tickers = ["PETR4", "VALE3", "WEGE3", "ITUB4"];
  
  for (var i = 0; i < tickers.length; i++) {
    var t = tickers[i];
    console.log("\n" + "=".repeat(40));
    console.log("TESTANDO: " + t);
    
    var data = DataService.getMarketData(t);
    var resultado = STRATEGY_EVALUATE_CORE(data, null);
    
    if (resultado) {
      console.log("✅ Score: " + resultado.score);
      console.log("   Setup: " + resultado.setup);
      console.log("   ADX: " + resultado.adx);
      console.log("   Bollinger: " + resultado.bollingerUpper + " / " + resultado.bollingerMiddle + " / " + resultado.bollingerLower);
      console.log("   RR: " + resultado.rr);
    } else {
      console.log("❌ Falha ao processar " + t);
    }
  }
}







function LIMPAR_CACHE_E_TESTAR() {
  console.log("🧹 Iniciando limpeza de cache...");
  console.log("=".repeat(50));
  
  var totalLimpo = 0;
  
  // 1. Limpar ScriptProperties (configurações em cache)
  try {
    var props = PropertiesService.getScriptProperties();
    var todasProps = props.getProperties();
    var keysToDelete = [];
    
    for (var key in todasProps) {
      if (key.indexOf("B3_") === 0 || key.indexOf("CACHE") !== -1 || key.indexOf("B3V10") !== -1) {
        keysToDelete.push(key);
      }
    }
    
    for (var i = 0; i < keysToDelete.length; i++) {
      props.deleteProperty(keysToDelete[i]);
      totalLimpo++;
    }
    
    console.log("✅ ScriptProperties: " + keysToDelete.length + " propriedades removidas");
  } catch(e) {
    console.warn("⚠️ ScriptProperties: " + e.message);
  }
  
  // 2. Limpar UserProperties
  try {
    var userProps = PropertiesService.getUserProperties();
    var userKeys = userProps.getKeys();
    var userToDelete = [];
    
    for (var i = 0; i < userKeys.length; i++) {
      if (userKeys[i].indexOf("B3_") === 0 || userKeys[i].indexOf("CACHE") !== -1) {
        userToDelete.push(userKeys[i]);
      }
    }
    
    for (var i = 0; i < userToDelete.length; i++) {
      userProps.deleteProperty(userToDelete[i]);
      totalLimpo++;
    }
    
    console.log("✅ UserProperties: " + userToDelete.length + " propriedades removidas");
  } catch(e) {
    console.warn("⚠️ UserProperties: " + e.message);
  }
  
  // 3. Forçar recarga de configurações
  try {
    if (typeof CONFIG !== 'undefined' && typeof CONFIG.refresh === 'function') {
      CONFIG.refresh();
      console.log("✅ CONFIG recarregado da planilha");
    }
  } catch(e) {
    console.warn("⚠️ CONFIG.refresh: " + e.message);
  }
  
  console.log("=".repeat(50));
  console.log("✅ Limpeza concluída! Total de itens limpos: " + totalLimpo);
  console.log("🚀 Executando scanner novamente...");
  console.log("=".repeat(50));
  
  // Executar o robô
  executarRoboB3();
}