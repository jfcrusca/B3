/**
 * TESTE_REFACTOR_CORE.js
 * =============================================================================
 * TESTE DE REGRESSÃO — REFATORAÇÃO DE STRATEGY_EVALUATE_CORE
 * =============================================================================
 * Objetivo: garantir que a refatoração de 22_Core_Analyzers.js (divisão de
 * funções internas) manteve o comportamento 100% IDÊNTICO.
 *
 * Estratégia:
 *   - STRATEGY_EVALUATE_CORE_ORIGINAL = cópia VERBATIM da função ANTES da
 *     refatoração (snapshot de referência).
 *   - STRATEGY_EVALUATE_CORE = versão refatorada (carregada de 22_Core_Analyzers.js).
 *   - Executa AMBAS com os MESMOS dados de entrada e compara TODOS os campos
 *     do objeto de retorno (deep compare).
 *
 * Critérios de aprovação:
 *   - score, thresholds, parâmetros e todos os campos de saída IDÊNTICOS.
 *   - Nenhuma divergência em nenhum cenário de teste.
 *
 * Como executar (GAS):
 *   function TESTAR_REFACTOR_CORE() { ... }  → roda a suíte completa.
 * =============================================================================
 */

// =============================================================================
// SNAPSHOT ORIGINAL (ANTES DA REFATORAÇÃO) — NÃO ALTERAR
// =============================================================================
function STRATEGY_EVALUATE_CORE_ORIGINAL(data, ibovContext) {
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
    estrategiaEntrada: _determinarEstrategiaEntrada(setupNome, scoreFinal, estrutura, last.close, ind, risco)
  };
  
  // Log de diagnóstico para debug (opcional - remove em produção)

  if (scoreFinal >= 70) {
    console.log("   🎯 " + ticker + " | Score: " + resultado.score + " | Setup: " + setupNome + " | ADX: " + ind.adx);
  }
  
  return resultado;
}

// =============================================================================
// UTILITÁRIOS DE COMPARAÇÃO
// =============================================================================

/**
 * Deep compare de dois valores (objetos, arrays, primitivos).
 * @returns {boolean} true se idênticos
 */
function _refactorDeepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false;

  var aIsArr = Array.isArray(a);
  var bIsArr = Array.isArray(b);
  if (aIsArr !== bIsArr) return false;

  if (aIsArr) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (!_refactorDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  var aKeys = Object.keys(a);
  var bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (var j = 0; j < aKeys.length; j++) {
    var k = aKeys[j];
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!_refactorDeepEqual(a[k], b[k])) return false;
  }
  return true;
}

/**
 * Gera um array de candles sintéticos determinístico para teste.
 * @param {number} n - quantidade de candles
 * @param {number} seed - semente para variação determinística
 */
function _refactorGerarCandles(n, seed) {
  seed = seed || 1;
  var candles = [];
  var preco = 30 + (seed % 20);
  for (var i = 0; i < n; i++) {
    var variacao = Math.sin(i * 0.5 + seed) * 0.8 + ((i * 7 + seed) % 5) / 10;
    var open = preco;
    var close = preco + variacao;
    var high = Math.max(open, close) + 0.2;
    var low = Math.min(open, close) - 0.2;
    var volume = 100000 + ((i * 31 + seed * 17) % 90000);
    candles.push({
      date: new Date(2024, 0, 1 + i),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: volume,
      ticker: 'TEST' + seed
    });
    preco = close;
  }
  return candles;
}

// =============================================================================
// SUÍTE DE TESTES DE REGRESSÃO
// =============================================================================

/**
 * Executa a suíte completa de comparação antes/depois.
 * @returns {Object} resumo com contagem de cenários e divergências
 */
function TESTAR_REFACTOR_CORE() {
  console.log("🧪 === TESTE DE REGRESSÃO: STRATEGY_EVALUATE_CORE (antes vs depois) ===");

  // Verifica se a versão refatorada existe
  if (typeof STRATEGY_EVALUATE_CORE === 'undefined') {
    console.error("❌ STRATEGY_EVALUATE_CORE (refatorada) não encontrada. Carregue 22_Core_Analyzers.js.");
    return { ok: false, erro: 'STRATEGY_EVALUATE_CORE ausente' };
  }

  var cenarios = [];
  var divergencias = 0;
  var total = 0;

  // Cenário 1: Array puro de candles (tendência de alta)
  cenarios.push({
    nome: 'Array puro (alta, 120 candles)',
    data: _refactorGerarCandles(120, 1),
    ibov: { regime: 'BULLISH', ibov: { close: 125000, change: 1.2 } }
  });

  // Cenário 2: Objeto com candles (tendência de baixa)
  cenarios.push({
    nome: 'Objeto com candles (baixa, 90 candles)',
    data: { ticker: 'VALE3', candles: _refactorGerarCandles(90, 2) },
    ibov: { regime: 'BEARISH', ibov: { close: 118000, change: -1.5 } }
  });

  // Cenário 3: Objeto com candles + price explícito
  cenarios.push({
    nome: 'Objeto com candles + price (lateral, 70 candles)',
    data: { ticker: 'WEGE3', price: 42.5, candles: _refactorGerarCandles(70, 3) },
    ibov: { regime: 'NEUTRAL', ibov: { close: 122000, change: 0.1 } }
  });

  // Cenário 4: Poucos candles (abaixo de 50 → warning)
  cenarios.push({
    nome: 'Poucos candles (30, abaixo do mínimo)',
    data: _refactorGerarCandles(30, 4),
    ibov: { regime: 'NEUTRAL' }
  });

  // Cenário 5: Candle único (objeto com close)
  cenarios.push({
    nome: 'Candle único (objeto com close)',
    data: { ticker: 'ITUB4', close: 35.2, high: 35.5, low: 34.9, open: 35.0, volume: 500000 },
    ibov: { regime: 'BULLISH' }
  });

  // Cenário 6: Dados nulos (deve retornar null em ambos)
  cenarios.push({
    nome: 'Dados nulos (null)',
    data: null,
    ibov: { regime: 'NEUTRAL' }
  });

  // Cenário 7: Array vazio (deve retornar null em ambos)
  cenarios.push({
    nome: 'Array vazio',
    data: [],
    ibov: { regime: 'NEUTRAL' }
  });

  // Cenário 8: Formato desconhecido (deve retornar null em ambos)
  cenarios.push({
    nome: 'Formato desconhecido',
    data: { foo: 'bar' },
    ibov: { regime: 'NEUTRAL' }
  });

  // Cenário 9: Candles com closes inválidos (filtro)
  var candlesComInvalidos = _refactorGerarCandles(60, 5);
  candlesComInvalidos[10] = { close: 0, high: 0, low: 0, open: 0, volume: 0 };
  candlesComInvalidos[20] = { close: -5, high: 0, low: 0, open: 0, volume: 0 };
  cenarios.push({
    nome: 'Candles com closes inválidos (filtro)',
    data: candlesComInvalidos,
    ibov: { regime: 'BEARISH' }
  });

  // Cenário 10: Regime macro variado (impacto no score)
  cenarios.push({
    nome: 'Regime macro DEFENSIVE',
    data: _refactorGerarCandles(100, 6),
    ibov: { regime: 'DEFENSIVE', ibov: { close: 120000, change: -0.4 } }
  });

  // Executa cada cenário comparando antes vs depois
  for (var c = 0; c < cenarios.length; c++) {
    var cenario = cenarios[c];
    total++;

    var antes = null;
    var depois = null;
    var erroAntes = null;
    var erroDepois = null;

    try {
      antes = STRATEGY_EVALUATE_CORE_ORIGINAL(cenario.data, cenario.ibov);
    } catch (e) {
      erroAntes = e.message;
    }
    try {
      depois = STRATEGY_EVALUATE_CORE(cenario.data, cenario.ibov);
    } catch (e) {
      erroDepois = e.message;
    }

    // Compara erros
    if (erroAntes !== erroDepois) {
      divergencias++;
      console.log("❌ [" + cenario.nome + "] Divergência de ERRO: antes='" + erroAntes + "' depois='" + erroDepois + "'");
      continue;
    }
    if (erroAntes) {
      console.log("✅ [" + cenario.nome + "] Ambos lançaram o mesmo erro: " + erroAntes);
      continue;
    }

    // Compara null vs objeto
    if (antes === null || depois === null) {
      if (antes === null && depois === null) {
        console.log("✅ [" + cenario.nome + "] Ambos retornaram null");
      } else {
        divergencias++;
        console.log("❌ [" + cenario.nome + "] Divergência de null: antes=" + (antes === null ? 'null' : 'objeto') + " depois=" + (depois === null ? 'null' : 'objeto'));
      }
      continue;
    }

    // Deep compare completo
    if (_refactorDeepEqual(antes, depois)) {
      console.log("✅ [" + cenario.nome + "] Resultados IDÊNTICOS (score=" + depois.score + ", setup=" + depois.setup + ")");
    } else {
      divergencias++;
      console.log("❌ [" + cenario.nome + "] RESULTADOS DIVERGENTES!");
      _refactorLogarDivergencias(antes, depois, '');
    }
  }

  console.log("==============================================");
  console.log("📊 RESUMO: " + (total - divergencias) + "/" + total + " cenários idênticos | " + divergencias + " divergência(s)");
  if (divergencias === 0) {
    console.log("🎉 REFATORAÇÃO VALIDADA: comportamento 100% idêntico.");
  } else {
    console.log("🚨 REFATORAÇÃO COM DIVERGÊNCIAS: revisar antes de publicar.");
  }
  console.log("==============================================");

  return { ok: divergencias === 0, total: total, divergencias: divergencias };
}

/**
 * Loga as divergências campo a campo entre dois objetos.
 */
function _refactorLogarDivergencias(a, b, prefixo) {
  prefixo = prefixo || '';
  var aKeys = a ? Object.keys(a) : [];
  var bKeys = b ? Object.keys(b) : [];
  var todas = {};
  aKeys.forEach(function(k) { todas[k] = true; });
  bKeys.forEach(function(k) { todas[k] = true; });

  Object.keys(todas).forEach(function(k) {
    var av = a ? a[k] : undefined;
    var bv = b ? b[k] : undefined;
    if (!_refactorDeepEqual(av, bv)) {
      if (av && bv && typeof av === 'object' && typeof bv === 'object') {
        console.log("   ⚠️ " + prefixo + k + ":");
        _refactorLogarDivergencias(av, bv, prefixo + "   ");
      } else {
        console.log("   ❌ " + prefixo + k + ": antes=" + JSON.stringify(av) + " depois=" + JSON.stringify(bv));
      }
    }
  });
}
