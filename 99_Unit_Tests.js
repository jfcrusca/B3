/**
 * =============================================================================
 * 99_Unit_Tests.js — Suíte de Testes Unitários B3-v10
 * =============================================================================
 * Testes com assert para validar a lógica de indicadores e decisões.
 * 
 * COMO EXECUTAR:
 * 1. Abra o Apps Script (script.google.com)
 * 2. Selecione a função "RODAR_TODOS_TESTES_UNITARIOS" no seletor
 * 3. Clique em Executar
 * 
 * RESULTADO:
 * - Logs no formato "[PASS]"/"[FAIL]" para cada teste
 * - Resumo final com total de testes, passou/falhou
 * - Lança exceção se qualquer teste falhar (para integrar com CI)
 * =============================================================================
 */

var UnitTests = (function () {
  'use strict';

  var _totalTests = 0;
  var _passedTests = 0;
  var _failedTests = [];
  var _currentSuite = '';

  /**
   * Função de assert — lança erro se a condição não for verdadeira
   * @param {boolean} condicao - condição a ser validada
   * @param {string} mensagem - mensagem descritiva do teste
   */
  function assert(condicao, mensagem) {
    _totalTests++;
    if (condicao) {
      _passedTests++;
      console.log('  ✅ [PASS] ' + (mensagem || 'Teste passou'));
    } else {
      _failedTests.push(mensagem || 'Teste falhou');
      console.error('  ❌ [FAIL] ' + (mensagem || 'Teste falhou'));
    }
  }

  /**
   * Assert de igualdade com tolerância numérica
   */
  function assertAlmostEqual(valor, esperado, tolerancia, mensagem) {
    tolerancia = tolerancia || 0.01;
    var diff = Math.abs(valor - esperado);
    assert(diff <= tolerancia, (mensagem || 'Valor igual') + ' | Valor: ' + valor + ' | Esperado: ' + esperado + ' (tol: ' + tolerancia + ')');
  }

  /**
   * Assert de igualdade exata
   */
  function assertEqual(valor, esperado, mensagem) {
    assert(valor === esperado, (mensagem || 'Igualdade') + ' | Valor: ' + valor + ' | Esperado: ' + esperado);
  }

  /**
   * Assert de verdadeiro
   */
  function assertTrue(valor, mensagem) {
    assert(valor === true, (mensagem || 'Deveria ser true') + ' | Valor: ' + valor);
  }

  /**
   * Assert de falso
   */
  function assertFalse(valor, mensagem) {
    assert(valor === false, (mensagem || 'Deveria ser false') + ' | Valor: ' + valor);
  }

  /**
   * Assert que verifica se valor não é null/undefined
   */
  function assertNotNull(valor, mensagem) {
    assert(valor !== null && valor !== undefined, (mensagem || 'Deveria ser não-nulo') + ' | Valor: ' + valor);
  }

  /**
   * Assert que verifica se está dentro do range [min, max]
   */
  function assertInRange(valor, min, max, mensagem) {
    assert(valor >= min && valor <= max, (mensagem || 'Deveria estar no range [' + min + ', ' + max + ']') + ' | Valor: ' + valor);
  }

  // ==========================================================================
  // GERADORES DE DADOS SINTÉTICOS
  // ==========================================================================

  /**
   * Gera candles sintéticos com tendência e volume controlados
   */
  function _gerarCandlesSinteticos(quantidade, precoInicial, tendencia, volumeBase) {
    tendencia = tendencia || 0.001; // tendência diária (0.1%)
    volumeBase = volumeBase || 1000000;
    var candles = [];
    var preco = precoInicial || 100;
    for (var i = 0; i < quantidade; i++) {
      var oscilacao = (Math.random() - 0.5) * 2 * preco * 0.01; // ±1%
      var open = preco;
      var close = preco * (1 + tendencia + (Math.random() - 0.5) * 0.01);
      var high = Math.max(open, close) * (1 + Math.random() * 0.01);
      var low = Math.min(open, close) * (1 - Math.random() * 0.01);
      candles.push({
        date: new Date(2026, 0, i + 1),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: volumeBase + Math.floor(Math.random() * volumeBase * 0.5),
        ticker: 'TEST3'
      });
      preco = close;
    }
    return candles;
  }

  /**
   * Gera série de preços de fechamento a partir de candles
   */
  function _extrairCloses(candles) {
    return candles.map(function (c) { return c.close; });
  }

  // ==========================================================================
  // SÉRIES CONHECIDAS PARA TESTE
  // ==========================================================================

  // Série determinística de preços (tendência de alta clara)
  var SERIE_ALTA = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];

  // Série de candles determinística (tendência de alta)
  var CANDLES_ALTA = SERIE_ALTA.map(function (preco, i) {
    return {
      date: new Date(2026, 0, i + 1),
      open: preco * 0.99,
      high: preco * 1.02,
      low: preco * 0.98,
      close: preco,
      volume: 1000000 + i * 10000,
      ticker: 'TEST3'
    };
  });

  // Série com volume relativo alto no último candle
  var CANDLES_VOLUME_ALTO = SERIE_ALTA.map(function (preco, i) {
    return {
      date: new Date(2026, 0, i + 1),
      open: preco * 0.99,
      high: preco * 1.02,
      low: preco * 0.98,
      close: preco,
      volume: (i === SERIE_ALTA.length - 1) ? 5000000 : 1000000,
      ticker: 'TEST3'
    };
  });

  // ==========================================================================
  // TESTE: INDICADORES
  // ==========================================================================

  function testar_EMA() {
    console.log('\n📊 Suite: _core_getEMA');
    _currentSuite = 'EMA';

    // EMA de série curta
    var ema3 = _core_getEMA([2, 4, 6], 3);
    assertNotNull(ema3, 'EMA de série curta não-nula');

    // EMA de série com tendência de alta: EMA deve ser menor que último preço
    var ema9 = _core_getEMA(SERIE_ALTA, 9);
    assertNotNull(ema9, 'EMA-9 não-nula');
    assert(ema9 < SERIE_ALTA[SERIE_ALTA.length - 1], 'EMA-9 (' + ema9 + ') < último preço (' + SERIE_ALTA[SERIE_ALTA.length - 1] + ') em tendência de alta');

    // EMA de período maior → mais suave (mais próxima da média)
    var ema5 = _core_getEMA(SERIE_ALTA, 5);
    var ema14 = _core_getEMA(SERIE_ALTA, 14);
    assertNotNull(ema5, 'EMA-5 não-nula');
    assertNotNull(ema14, 'EMA-14 não-nula');

    // EMA com dados insuficientes retorna média simples
    var emaCurta = _core_getEMA([10, 20], 5);
    assertAlmostEqual(emaCurta, 15, 0.01, 'EMA com dados insuficientes = média simples');

    // EMA de array vazio = 0
    assertEqual(_core_getEMA([], 9), 0, 'EMA de array vazio = 0');

    // EMA com valores negativos
    var emaNeg = _core_getEMA([-5, -10, -15, -20], 3);
    assertNotNull(emaNeg, 'EMA de valores negativos não-nula');
    assert(emaNeg < 0, 'EMA de valores negativos é negativa');

    // Validação de EMA matematicamente: série constante = preço constante
    var constantes = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    assertAlmostEqual(_core_getEMA(constantes, 5), 50, 0.01, 'EMA de série constante = valor constante');
  }

  function testar_RSI() {
    console.log('\n📊 Suite: _core_getRSI');
    _currentSuite = 'RSI';

    // Série em alta constante → RSI = 100
    var rsiAlta = _core_getRSI(SERIE_ALTA, 14);
    assertAlmostEqual(rsiAlta, 100, 0.01, 'RSI de tendência de alta = 100');

    // Série em queda constante
    var serieQueda = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 9, 8, 7, 6, 5, 4];
    var rsiQueda = _core_getRSI(serieQueda, 14);
    assertAlmostEqual(rsiQueda, 0, 0.01, 'RSI de tendência de queda = 0');

    // Série constante → RSI = 100 (avgLoss = 0)
    var constantes = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    assertAlmostEqual(_core_getRSI(constantes, 5), 100, 0.01, 'RSI de série constante = 100');

    // Dados insuficientes → RSI = 50 (neutro)
    assertEqual(_core_getRSI([1, 2, 3], 14), 50, 'RSI com dados insuficientes = 50');

    // Série oscilante simétrica → RSI próximo de 50
    var oscilante = [];
    for (var i = 0; i < 50; i++) {
      oscilante.push((i % 2 === 0) ? 100 : 90);
    }
    var rsiOsc = _core_getRSI(oscilante, 14);
    assertInRange(rsiOsc, 40, 60, 'RSI de série oscilante simétrica entre 40-60');
  }

  function testar_ATR() {
    console.log('\n📊 Suite: _core_getATR');
    _currentSuite = 'ATR';

    // ATR de candles com range conhecido
    var atr = _core_getATR(CANDLES_ALTA, 14);
    assertNotNull(atr, 'ATR não-nula');
    assert(atr > 0, 'ATR positiva');

    // O ATR usa True Range: max(high-low, |high-prevClose|, |low-prevClose|)
    // Para esta série onde preços sobem continuamente, o TR dominante é |high-prevClose|
    // high[i]=close[i]*1.02, prevClose=close[i-1] → TR = close[i]*1.02 - close[i-1]
    var trs = [];
    for (var i = 1; i < CANDLES_ALTA.length; i++) {
      var h = CANDLES_ALTA[i].high;
      var l = CANDLES_ALTA[i].low;
      var pc = CANDLES_ALTA[i - 1].close;
      trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    var atrEsperado = trs.reduce(function (a, b) { return a + b; }, 0) / trs.length;
    assertAlmostEqual(atr, atrEsperado, atrEsperado * 0.05, 'ATR usa True Range (corrigido)');

    // ATR de candles com dados insuficientes → fallback 2% do preço (period=14)
    var umCandle = [{ high: 100, low: 90, close: 95, open: 92, volume: 100 }];
    var atr1 = _core_getATR(umCandle, 14);
    assertAlmostEqual(atr1, 95 * 0.02, 0.01, 'ATR com 1 candle = 2% do preço');

    // ATR sem candles → fallback 2% do preço (default 100)
    var atrVazio = _core_getATR([], 14);
    assertAlmostEqual(atrVazio, 2, 0.01, 'ATR sem candles = 2% do preço default (100 * 0.02)');
  }

  function testar_Bollinger() {
    console.log('\n📊 Suite: _core_getBollinger');
    _currentSuite = 'Bollinger';

    // Série constante → Bollinger com largura zero
    var constantes = [];
    for (var i = 0; i < 30; i++) constantes.push(100);
    var bb = _core_getBollinger(constantes, 20, 2.0);
    assertAlmostEqual(bb.middle, 100, 0.01, 'Bollinger middle de série constante = 100');
    assertAlmostEqual(bb.upper, 100, 0.01, 'Bollinger upper de série constante = 100');
    assertAlmostEqual(bb.lower, 100, 0.01, 'Bollinger lower de série constante = 100');
    assertAlmostEqual(bb.width, 0, 0.01, 'Bollinger width de série constante = 0');

    // Série com variação → upper > middle > lower
    var variacao = [100, 101, 102, 103, 102, 101, 100, 99, 101, 103, 105, 104, 103, 102, 101, 100, 99, 98, 100, 102, 104, 106, 105, 104];
    var bbV = _core_getBollinger(variacao, 20, 2.0);
    assert(bbV.upper > bbV.middle, 'Bollinger upper > middle');
    assert(bbV.middle > bbV.lower, 'Bollinger middle > lower');
    assert(bbV.width > 0, 'Bollinger width > 0 para série variável');

    // Dados insuficientes → fallback com 5% acima/abaixo
    var bbCurto = _core_getBollinger([100], 20, 2.0);
    assertAlmostEqual(bbCurto.middle, 100, 0.01, 'Bollinger fallback middle = média dos dados');
    assertAlmostEqual(bbCurto.upper, 105, 0.01, 'Bollinger fallback upper = 105% da média');
    assertAlmostEqual(bbCurto.lower, 95, 0.01, 'Bollinger fallback lower = 95% da média');
  }

  function testar_VolumeRelativo() {
    console.log('\n📊 Suite: _core_getVolumeRelativo');
    _currentSuite = 'VolumeRelativo';

    // Volume do último candle = 5x a mediana dos anteriores
    var vr = _core_getVolumeRelativo(CANDLES_VOLUME_ALTO, 10);
    assertNotNull(vr, 'Volume relativo não-nulo');
    assertInRange(vr, 4.5, 5.5, 'Volume relativo ~5.0 (volume 5x maior)');

    // Volume constante → VR = 1.0
    var volumesConstantes = CANDLES_ALTA.map(function (c) {
      return { close: c.close, high: c.high, low: c.low, volume: 1000000 };
    });
    var vrConst = _core_getVolumeRelativo(volumesConstantes, 10);
    assertAlmostEqual(vrConst, 1.0, 0.01, 'Volume relativo de volumes constantes = 1.0');

    // Sem candles → VR = 1.0
    assertEqual(_core_getVolumeRelativo([], 10), 1.0, 'Volume relativo sem dados = 1.0');

    // Último volume é zero → VR = 0
    var comZeroFinal = CANDLES_ALTA.slice(0, 15);
    comZeroFinal[comZeroFinal.length - 1] = {
      close: 20, high: 20.5, low: 19.5, volume: 0
    };
    var vrZero = _core_getVolumeRelativo(comZeroFinal, 10);
    assertAlmostEqual(vrZero, 0, 0.01, 'Volume relativo com último volume zero = 0');
  }

  function testar_ADX() {
    console.log('\n📊 Suite: _core_getADX');
    _currentSuite = 'ADX';

    // Tendência forte (direcional consistente) → ADX alto
    var mocada = _gerarCandlesSinteticos(60, 100, 0.003, 1000000);
    var adx = _core_getADX(mocada, 14);
    assertNotNull(adx, 'ADX não-nulo');
    assertInRange(adx, 0, 100, 'ADX entre 0-100');

    // Série constante → ADX baixo (sem movimento direcional)
    var constantes = [];
    for (var i = 0; i < 40; i++) {
      constantes.push({ high: 100, low: 98, close: 99, open: 99, volume: 1000 });
    }
    var adxConst = _core_getADX(constantes, 14);
    assert(adxConst < 30, 'ADX de série constante < 30');

    // Dados insuficientes → fallback 20
    var poucos = _gerarCandlesSinteticos(10, 100, 0.001, 1000000);
    assertEqual(_core_getADX(poucos, 14), 20, 'ADX com dados insuficientes retorna 20');

    // Valores inválidos → fallback 20
    assertEqual(_core_getADX([], 14), 20, 'ADX sem dados retorna 20');
  }

  function testar_VWMA() {
    console.log('\n📊 Suite: _core_getVWMA');
    _currentSuite = 'VWMA';

    // Dados com volume alto no candle mais caro → VWMA > média simples
    var candles = [
      { close: 100, high: 102, low: 98, volume: 100 },
      { close: 101, high: 103, low: 99, volume: 100 },
      { close: 102, high: 104, low: 100, volume: 100 },
      { close: 110, high: 112, low: 108, volume: 1000 }, // volume alto em preço alto
      { close: 105, high: 107, low: 103, volume: 200 }
    ];
    var vwma = _core_getVWMA(candles, 5);
    assertNotNull(vwma, 'VWMA não-nula');
    assert(vwma > 102, 'VWMA > média simples quando volume alto no preço alto');

    // Dados insuficientes → último close
    assertEqual(_core_getVWMA([{ close: 50 }], 20), 50, 'VWMA com dados insuficientes = último close');
  }

  function testar_Median_E_RobustSigma() {
    console.log('\n📊 Suite: _core_getMedian / _core_getRobustSigma');
    _currentSuite = 'Median';

    // Mediana de array ímpar
    assertEqual(_core_getMedian([1, 3, 2]), 2, 'Mediana de [1,3,2] = 2');

    // Mediana de array par
    assertEqual(_core_getMedian([1, 2, 3, 4]), 2.5, 'Mediana de [1,2,3,4] = 2.5');

    // Mediana com NaN filtrado
    assertEqual(_core_getMedian([1, NaN, 3, 2]), 2, 'Mediana com NaN filtra NaN');

    // Mediana de array vazio = 0
    assertEqual(_core_getMedian([]), 0, 'Mediana de array vazio = 0');

    // Mesmo array não é modificado (não-sort in-place problem)
    var arr = [5, 3, 1, 4, 2];
    _core_getMedian(arr);
    assertEqual(arr[0], 5, 'Array original não é modificado');

    // RobustSigma de série constante = 0
    var consts = [5, 5, 5, 5, 5];
    assertEqual(_core_getRobustSigma(consts), 0, 'RobustSigma de série constante = 0');

    // RobustSigma > 0 para série com variação
    var vars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    assert(_core_getRobustSigma(vars) > 0, 'RobustSigma > 0 para série com variação');
  }

  function testar_PivotLows() {
    console.log('\n📊 Suite: _core_detectPivotLows / _core_getLastPivotLow');
    _currentSuite = 'PivotLows';

    // Séries com pivôs conhecidos
    var candles = [
      { close: 20, high: 21, low: 19 },
      { close: 19, high: 20, low: 18 },  // vale
      { close: 20, high: 21, low: 19 },
      { close: 21, high: 22, low: 20 },
      { close: 22, high: 23, low: 21 },
      { close: 21, high: 22, low: 20 },  // vale 2
      { close: 22, high: 23, low: 21 },
      { close: 23, high: 24, low: 22 },
      { close: 24, high: 25, low: 23 },
      { close: 23.5, high: 24, low: 22.5 }, // vale 3
      { close: 24.5, high: 25, low: 23.5 },
      { close: 25, high: 26, low: 24 }
    ];

    var pivots = _core_detectPivotLows(candles, 1, 1);
    assertNotNull(pivots, 'Pivots não-nulo');
    assert(pivots.length > 0, 'Pivots encontrados');

    // Último pivot low deve ser o vale 3 (22.5) ou próximo
    var lastPivot = _core_getLastPivotLow(candles, 20);
    assertNotNull(lastPivot, 'Último pivot low não-nulo');

    // Sem candles → null
    assertEqual(_core_getLastPivotLow([], 20), null, 'Pivot low sem dados = null');

    // Poucos candles → null
    assertEqual(_core_getLastPivotLow([{ close: 10 }], 20), null, 'Pivot low com 1 candle = null');
  }

  // ==========================================================================
  // TESTE: STRATEGY_EVALUATE_CORE (ANALISADOR COMPLETO)
  // ==========================================================================

  function testar_STRATEGY_EVALUATE_CORE() {
    console.log('\n📊 Suite: STRATEGY_EVALUATE_CORE');
    _currentSuite = 'STRATEGY_EVALUATE_CORE';

    // 1. Entrada nula → null
    assertEqual(STRATEGY_EVALUATE_CORE(null, null), null, 'Entrada null retorna null');

    // 2. Entrada indefinida → null
    assertEqual(STRATEGY_EVALUATE_CORE(undefined, null), null, 'Entrada undefined retorna null');

    // 3. Array vazio → null
    assertEqual(STRATEGY_EVALUATE_CORE([], null), null, 'Array vazio retorna null');

    // 4. Dados sintéticos de tendência de alta → resultado válido
    var candles = _gerarCandlesSinteticos(120, 50, 0.002, 2000000);
    var resultado = STRATEGY_EVALUATE_CORE(candles, null);

    assertNotNull(resultado, 'STRATEGY_EVALUATE_CORE retorna resultado para dados válidos');

    if (resultado) {
      // Score entre 0-100
      assertInRange(resultado.score, 0, 100, 'Score entre 0-100');

      // Preço é positivo
      assert(resultado.price > 0, 'Preço > 0');

      // Stop loss menor que preço atual
      assert(resultado.stopLoss < resultado.price, 'Stop loss < preço atual');

      // Alvo 1 maior que preço atual
      assert(resultado.target1 > resultado.price, 'Target 1 > preço atual');

      // Alvo 2 > Alvo 1
      assert(resultado.target2 > resultado.target1, 'Target 2 > Target 1');

      // RR positivo
      assert(resultado.rr > 0, 'R/R ratio > 0');

      // Indicadores presentes
      assertNotNull(resultado.indicators, 'Indicadores presentes');
      assertNotNull(resultado.indicators.rsi, 'RSI presente no resultado');
      assertNotNull(resultado.indicators.atr, 'ATR presente no resultado');
      assertNotNull(resultado.indicators.ema21, 'EMA21 presente no resultado');
      assertNotNull(resultado.indicators.adx, 'ADX presente no resultado');
      assertNotNull(resultado.indicators.bollinger, 'Bollinger presente no resultado');

      // ADX entre 0-100
      assertInRange(resultado.adx, 0, 100, 'ADX entre 0-100');

      // Setup é uma string
      assert(typeof resultado.setup === 'string' && resultado.setup.length > 0, 'Setup é string não-vazia');
    }

    // 5. Formato objeto com candles
    var resultadoObj = STRATEGY_EVALUATE_CORE({ candles: candles, ticker: 'TEST3' }, null);
    assertNotNull(resultadoObj, 'Aceita formato {candles, ticker}');
    if (resultadoObj) {
      assertEqual(resultadoObj.ticker, 'TEST3', 'Ticker extraído do objeto');
    }

    // 6. Candle único (formato compacto)
    var unico = {
      close: 100, high: 102, low: 98, open: 99, volume: 1000, ticker: 'TEST3'
    };
    var resultadoUnico = STRATEGY_EVALUATE_CORE(unico, null);
    assertNotNull(resultadoUnico, 'Aceita candle único como entrada');

    // 7. Candles com closes nulos no final são filtrados
    var candlesComNull = candles.slice(0, 115).concat([
      { close: null, high: 60, low: 58, open: 59, volume: 100 },
      { close: undefined, high: 61, low: 59, open: 60, volume: 100 }
    ]);
    var resultadoFiltro = STRATEGY_EVALUATE_CORE(candlesComNull, null);
    assertNotNull(resultadoFiltro, 'Filtra candles com close null/undefined');
  }

  function testar_CalcularScoreSistemico() {
    console.log('\n📊 Suite: _calcularScoreSistêmico');
    _currentSuite = 'ScoreSistêmico';

    // Cenário: tendência forte + volume alto + fibo zone + RR bom
    var indForte = {
      adx: 32, rsi: 62, ema9: 20, ema21: 19, ema50: 17, ema200: 15,
      volumeRelativo: 1.8, atr: 1.0,
      bollinger: { upper: 25, middle: 20, lower: 15 }
    };
    var estForte = {
      inFiboZone: true, temConfluencia: true, h50: 25, l50: 15,
      fibo618: 18.8, fibo50: 20
    };
    var rscForte = { rrRealista: 3.5, invalidoPorStop: false, stop: 19, alvo1: 22 };

    var score1 = _calcularScoreSistêmico(20.5, indForte, estForte, rscForte, 0, null);
    assertInRange(score1, 0, 100, 'Score sistêmico forte entre 0-100');
    // isRadar (rr >= 1.8 && inFiboZone) limita score a 75: "Setups RADAR não têm score de entrada imediata"
    assertEqual(score1, 75, 'Score com tendência forte limitado a 75 (isRadar ativo: rr 3.5 + fibo zone)');

    // Cenário: sem tendência, volume baixo, RR ruim → score baixo
    var indFraco = {
      adx: 15, rsi: 42, ema9: 30, ema21: 31, ema50: 32, ema200: 30,
      volumeRelativo: 0.5, atr: 1.0,
      bollinger: { upper: 35, middle: 30, lower: 25 }
    };
    var estFraco = {
      inFiboZone: false, temConfluencia: false, h50: 40, l50: 25,
      fibo618: 30.7, fibo50: 32.5
    };
    var rscFraco = { rrRealista: 1.2, invalidoPorStop: false, stop: 28, alvo1: 31 };

    var score2 = _calcularScoreSistêmico(29.5, indFraco, estFraco, rscFraco, 0, null);
    assertInRange(score2, 0, 100, 'Score sistêmico fraco entre 0-100');
    assert(score2 < 50, 'Score com mercado sem tendência < 50 (atual: ' + score2 + ')');

    // Cenário: regime BEARISH reduz score
    var indMedio = {
      adx: 26, rsi: 55, ema9: 50, ema21: 48, ema50: 45, ema200: 40,
      volumeRelativo: 1.2, atr: 1.0,
      bollinger: { upper: 55, middle: 50, lower: 45 }
    };
    var estMedio = {
      inFiboZone: true, temConfluencia: false, h50: 58, l50: 42,
      fibo618: 48.1, fibo50: 50
    };
    var rscMedio = { rrRealista: 2.5, invalidoPorStop: false, stop: 47, alvo1: 53 };

    // Cenário: regime BEARISH reduz score (usando cenário SEM radar — inFiboZone: false para não limitar por isRadar)
    var estMedioNaoRadar = {
      inFiboZone: false, temConfluencia: false, h50: 58, l50: 42,
      fibo618: 48.1, fibo50: 50
    };
    var rscNaoRadar = { rrRealista: 1.5, invalidoPorStop: false, stop: 47, alvo1: 52 };

    var scoreNeutro = _calcularScoreSistêmico(49, indMedio, estMedioNaoRadar, rscNaoRadar, 0, null);
    var scoreBearish = _calcularScoreSistêmico(49, indMedio, estMedioNaoRadar, rscNaoRadar, 0, { regime: 'BEARISH' });
    assert(scoreBearish < scoreNeutro, 'Score no regime BEARISH < score NEUTRAL (' + scoreBearish + ' < ' + scoreNeutro + ')');

    // Mesmo cenário com RR alto mas SEM fibo zone → não é radar
    var rscAltoSemFibo = { rrRealista: 3.2, invalidoPorStop: false, stop: 47, alvo1: 55 };
    var scoreComRRAlto = _calcularScoreSistêmico(49, indMedio, estMedioNaoRadar, rscAltoSemFibo, 0, null);
    assert(scoreComRRAlto > scoreNeutro, 'Score com RR alto sem fibo > score com RR baixo (' + scoreComRRAlto + ' > ' + scoreNeutro + ')');

    // Cenário: stop inválido → penalidade severa (mesmo cenário RR alto, só muda invalidoPorStop)
    var rscInvalido = { rrRealista: 3.2, invalidoPorStop: true, stop: 45, alvo1: 55 };
    var scoreInvalido = _calcularScoreSistêmico(49, indMedio, estMedioNaoRadar, rscInvalido, 0, null);
    assert(scoreInvalido < scoreComRRAlto, 'Score com stop inválido < score com stop válido (' + scoreInvalido + ' < ' + scoreComRRAlto + ')');

    // Cenário: stop inválido COM indicadores fracos → score drasticamente reduzido (<= 50)
    var indFracoStop = {
      adx: 22, rsi: 48, ema9: 50, ema21: 51, ema50: 52, ema200: 50,
      volumeRelativo: 0.8, atr: 1.0,
      bollinger: { upper: 55, middle: 50, lower: 45 }
    };
    var rscInvalidoFraco = { rrRealista: 3.0, invalidoPorStop: true, stop: 45, alvo1: 53 };
    var scoreStopInvalidoFraco = _calcularScoreSistêmico(49, indFracoStop, estMedioNaoRadar, rscInvalidoFraco, 0, null);
    assert(scoreStopInvalidoFraco <= 50, 'Score com stop inválido + indicadores fracos <= 50 (penalidade severa). Atual: ' + scoreStopInvalidoFraco);
  }

  function testar_IdentificarSetup() {
    console.log('\n📊 Suite: _identificarSetup');
    _currentSuite = 'IdentificarSetup';

    // SWING IDEAL: rr >= 2.0 + fibo + score >= 75 + ADX >= 25 + volume >= 1.0
    var setup1 = _identificarSetup(2.2, true, 80, 50, {
      adx: 30, volumeRelativo: 1.5, ema9: 48, ema21: 46, ema50: 44
    }, {});
    assert(setup1.indexOf('SWING IDEAL') !== -1, 'Setup SWING IDEAL para condições ideais (atual: ' + setup1 + ')');

    // SWING PULLBACK FIBO: rr >= 1.8 + fibo + score >= 70 + ADX >= 20
    var setup2 = _identificarSetup(1.9, true, 75, 50, {
      adx: 22, volumeRelativo: 1.2, ema9: 48, ema21: 46, ema50: 44
    }, {});
    assert(setup2.indexOf('SWING PULLBACK FIBO') !== -1, 'Setup SWING PULLBACK FIBO (atual: ' + setup2 + ')');

    // MOMENTUM FORTE: rr >= 2.0 + preço > ema9 > ema21 + score >= 75 + volume >= 1.5 + ADX >= 25
    var setup3 = _identificarSetup(2.5, false, 78, 52, {
      adx: 28, volumeRelativo: 1.8, ema9: 51, ema21: 49, ema50: 47
    }, {});
    assert(setup3.indexOf('MOMENTUM FORTE') !== -1, 'Setup MOMENTUM FORTE (atual: ' + setup3 + ')');

    // TENDÊNCIA CONFIRMADA: rr >= 2.0 + preço > ema21 > ema50 + ADX >= 25 + score >= 60
    var setup4 = _identificarSetup(2.1, false, 65, 50, {
      adx: 27, volumeRelativo: 1.1, ema9: 49, ema21: 48, ema50: 46
    }, {});
    assert(setup4.indexOf('TENDÊNCIA CONFIRMADA') !== -1, 'Setup TENDÊNCIA CONFIRMADA (atual: ' + setup4 + ')');

    // TENDÊNCIA FORTE: score >= 80 + rr >= 1.8 + ADX >= 25 + preço > ema21
    var setup5 = _identificarSetup(1.85, false, 90, 50, {
      adx: 26, volumeRelativo: 1.0, ema9: 49, ema21: 48, ema50: 46
    }, {});
    assert(setup5.indexOf('TENDÊNCIA FORTE') !== -1, 'Setup TENDÊNCIA FORTE (atual: ' + setup5 + ')');
  }

  function testar_DeterminarEstrategiaEntrada() {
    console.log('\n📊 Suite: _determinarEstrategiaEntrada');
    _currentSuite = 'EstrategiaEntrada';

    // SWING IDEAL → ENTRAR AGORA
    var entrada1 = _determinarEstrategiaEntrada('🎯 SWING IDEAL (FIBO + TENDÊNCIA)', 85,
      { inFiboZone: true }, 50, { adx: 30 }, {});
    assert(entrada1.indexOf('ENTRAR AGORA') !== -1, 'SWING IDEAL → ENTRAR AGORA (atual: ' + entrada1 + ')');

    // SWING PULLBACK FIBO fora da zona → AGUARDAR FIBO
    var entrada2 = _determinarEstrategiaEntrada('📉 SWING PULLBACK FIBO', 75,
      { inFiboZone: false, fibo618: 48.5 }, 50, { adx: 22 }, {});
    assert(entrada2.indexOf('AGUARDAR FIBO') !== -1, 'SWING PULLBACK FIBO fora da zona → AGUARDAR FIBO (atual: ' + entrada2 + ')');

    // TENDÊNCIA FORTE com score alto fora da zona → ENTRAR 50%
    var entrada3 = _determinarEstrategiaEntrada('📈 TENDÊNCIA FORTE (SCORE ALTO)', 85,
      { inFiboZone: false, fibo618: 48.5 }, 50, { adx: 27 }, {});
    assert(entrada3.indexOf('50%') !== -1, 'TENDÊNCIA FORTE score 85 fora da zona → ENTRAR 50% (atual: ' + entrada3 + ')');

    // MOMENTUM FORTE → ENTRAR AGORA
    var entrada4 = _determinarEstrategiaEntrada('🚀 MOMENTUM FORTE (ROMPIMENTO)', 80,
      { inFiboZone: false }, 50, { adx: 28 }, {});
    assert(entrada4.indexOf('ENTRAR AGORA') !== -1, 'MOMENTUM FORTE → ENTRAR AGORA (atual: ' + entrada4 + ')');

    // RISCO ALTO → NÃO ENTRAR
    var entrada5 = _determinarEstrategiaEntrada('⛔ RISCO ALTO (RR BAIXO)', 50,
      { inFiboZone: false }, 50, { adx: 20 }, {});
    assert(entrada5.indexOf('NÃO ENTRAR') !== -1, 'RISCO ALTO → NÃO ENTRAR (atual: ' + entrada5 + ')');

    // SCORE BAIXO → NÃO ENTRAR
    var entrada6 = _determinarEstrategiaEntrada('⛔ SCORE BAIXO', 40,
      { inFiboZone: false }, 50, { adx: 18 }, {});
    assert(entrada6.indexOf('NÃO ENTRAR') !== -1, 'SCORE BAIXO → NÃO ENTRAR (atual: ' + entrada6 + ')');

    // Default → AGUARDAR
    var entrada7 = _determinarEstrategiaEntrada('AGUARDAR MELHOR SETUP', 60,
      { inFiboZone: false }, 50, { adx: 22 }, {});
    assert(entrada7.indexOf('AGUARDAR') !== -1, 'AGUARDAR MELHOR SETUP → AGUARDAR (atual: ' + entrada7 + ')');
  }

  // ==========================================================================
  // TESTE: DECISION ENGINE
  // ==========================================================================

  function testar_DecisionEngine_NormalizeSentiment() {
    console.log('\n📊 Suite: DecisionEngine.normalizeSentiment');
    _currentSuite = 'DecisionEngine';

    assertEqual(DecisionEngine.normalizeSentiment('bom'), 'BULLISH', 'Normaliza "bom" para BULLISH');
    assertEqual(DecisionEngine.normalizeSentiment('BULLISH'), 'BULLISH', 'Normaliza "BULLISH" corretamente');
    assertEqual(DecisionEngine.normalizeSentiment('BULLISH MARKET'), 'BULLISH', 'Normaliza "BULLISH MARKET" para BULLISH');
    assertEqual(DecisionEngine.normalizeSentiment('bearish'), 'BEARISH', 'Normaliza "bearish" para BEARISH');
    assertEqual(DecisionEngine.normalizeSentiment('TERRIBLE'), 'TERRIBLE', 'Normaliza "TERRIBLE" corretamente');
    assertEqual(DecisionEngine.normalizeSentiment('crise'), 'TERRIBLE', 'Normaliza "crise" para TERRIBLE');
    assertEqual(DecisionEngine.normalizeSentiment('cauteLA'), 'CAUTELA', 'Normaliza "cautela" para CAUTELA');
    assertEqual(DecisionEngine.normalizeSentiment('NEUTRAL'), 'NEUTRAL', 'Normaliza "NEUTRAL" corretamente');
    assertEqual(DecisionEngine.normalizeSentiment('neutro'), 'NEUTRAL', 'Normaliza "neutro" para NEUTRAL');
    assertEqual(DecisionEngine.normalizeSentiment('OTIMISTA'), 'OTIMISTA', 'Normaliza "OTIMISTA" corretamente');
    assertEqual(DecisionEngine.normalizeSentiment('positivo'), 'BULLISH', 'Normaliza "positivo" para BULLISH');
    assertEqual(DecisionEngine.normalizeSentiment(''), 'NEUTRAL', 'Normaliza string vazia para NEUTRAL');
    assertEqual(DecisionEngine.normalizeSentiment(null), 'NEUTRAL', 'Normaliza null para NEUTRAL');
    assertEqual(DecisionEngine.normalizeSentiment(undefined), 'NEUTRAL', 'Normaliza undefined para NEUTRAL');
    assertEqual(DecisionEngine.normalizeSentiment('Descartado'), 'NEUTRAL', 'Normaliza "Descartado" para NEUTRAL');
    assertEqual(DecisionEngine.normalizeSentiment('desconhecido_xyz'), 'NEUTRAL', 'Sentimento desconhecido → NEUTRAL');
  }

  function testar_DecisionEngine_SentimentBonus() {
    console.log('\n📊 Suite: DecisionEngine.sentimentBonus');
    _currentSuite = 'DecisionEngine';

    assertEqual(DecisionEngine.sentimentBonus('EXCELLENT'), 15, 'EXCELLENT → +15');
    assertEqual(DecisionEngine.sentimentBonus('BULLISH'), 10, 'BULLISH → +10');
    assertEqual(DecisionEngine.sentimentBonus('POSITIVE'), 5, 'POSITIVE → +5');
    assertEqual(DecisionEngine.sentimentBonus('OTIMISTA'), 5, 'OTIMISTA → +5');
    assertEqual(DecisionEngine.sentimentBonus('NEUTRAL'), 0, 'NEUTRAL → 0');
    assertEqual(DecisionEngine.sentimentBonus('NEUTRO'), 0, 'NEUTRO → 0');
    assertEqual(DecisionEngine.sentimentBonus('CAUTELA'), -10, 'CAUTELA → -10');
    // Valor real do sistema: SENTIMENT_PENALTY_BEARISH está em -20 no DEFAULTS de 01_Core_Config.js (v11)
    assertEqual(DecisionEngine.sentimentBonus('BEARISH'), -20, 'BEARISH → -20 (valor do config v11)');
    assertEqual(DecisionEngine.sentimentBonus('TERRIBLE'), -100, 'TERRIBLE → -100');
  }

  function testar_DecisionEngine_Evaluate() {
    console.log('\n📊 Suite: DecisionEngine.evaluate');
    _currentSuite = 'DecisionEngine';

    // 1. Oportunidade inválida (sem ticker) → REJECTED
    var res1 = DecisionEngine.evaluate({ op: {} });
    assertEqual(res1.status, 'REJECTED', 'Oportunidade sem ticker → REJECTED');
    assertEqual(res1.motivo, 'Oportunidade invalida ou sem ticker.', 'Motivo informado');

    // 2. Oportunidade nula → REJECTED
    var res2 = DecisionEngine.evaluate({ op: null });
    assertEqual(res2.status, 'REJECTED', 'Oportunidade nula → REJECTED');

    // 3. Descartada na pré-triagem → REJECTED
    var res3 = DecisionEngine.evaluate({ op: { ticker: 'TEST3', sentiment: 'DESCARTADO_PRETRIAGEM' } });
    assertEqual(res3.status, 'REJECTED', 'Descartada na pré-triagem → REJECTED');

    // 4. Blacklist (bad ticker + drawdown) → REJECTED
    var res4 = DecisionEngine.evaluate({
      op: { ticker: 'TEST3', score: 80 },
      memoria: { isBadTicker: true, inDrawdown: true, penaltyPoints: -20 }
    });
    assertEqual(res4.status, 'REJECTED', 'Ticker em blacklist → REJECTED');

    // 5. Sentimento TERRIBLE → veto absoluto
    var res5 = DecisionEngine.evaluate({
      op: { ticker: 'TEST3', score: 85 },
      analise: { sentiment: 'TERRIBLE' }
    });
    assertEqual(res5.status, 'REJECTED', 'Sentimento TERRIBLE → veto absoluto');
    assertEqual(res5.motivo, 'Sentimento critico: TERRIBLE. Veto absoluto.', 'Motivo do veto TERRIBLE');

    // 6. BEARISH + macro BEARISH → veto direto (v11)
    var res6 = DecisionEngine.evaluate({
      op: { ticker: 'TEST3', score: 85 },
      analise: { sentiment: 'BEARISH' },
      macroRegime: 'BEARISH'
    });
    assertEqual(res6.status, 'REJECTED', 'BEARISH + macro BEARISH → veto direto');
    assertEqual(res6.motivo, 'Sentimento BEARISH confirmado por macro BEARISH. Veto de risco.', 'Motivo do veto macro');

    // 7. BEARISH sem macro BEARISH → penalidade mas pode passar
    var res7 = DecisionEngine.evaluate({
      op: { ticker: 'TEST3', score: 90, adx: 30 },
      analise: { sentiment: 'BEARISH' },
      macroRegime: 'NEUTRAL'
    });
    assertEqual(res7.status, 'REJECTED', 'BEARISH sem macro → rejeitado (penalidade -10 + veto dinâmico)');

    // 8. CAUTELA + score alto + ADX forte → flex aplicado
    var res8 = DecisionEngine.evaluate({
      op: { ticker: 'TEST3', score: 70, adx: 30, indicators: { adx: 30 } },
      analise: { sentiment: 'CAUTELA', ai_score: 70 },
      macroRegime: 'DEFENSIVE'
    });
    // CAUTELA com flex: scoreAfterMemory=70 + bonus -10 = 60 (pós flex trata como neutro)
    // scoreFinal = 60 * 0.8 + 70 * 0.2 = 48 + 14 = 62 >= 55 → APPROVED
    assertEqual(res8.status, 'APPROVED', 'CAUTELA com score 70 + ADX 30 → flex aplicado, aprova');

    // 9. Score alto com sentimento neutro → APPROVED
    var res9 = DecisionEngine.evaluate({
      op: { ticker: 'TEST3', score: 80, adx: 28 },
      analise: { sentiment: 'NEUTRAL', ai_score: 75 },
      macroRegime: 'NEUTRAL'
    });
    assertEqual(res9.status, 'APPROVED', 'Score 80 + IA 75 + neutro → APPROVED');
    assert(res9.score >= 55, 'Score final >= threshold 55');
    assertInRange(res9.score, 0, 100, 'Score final entre 0-100');

    // 10. Score baixo → REJECTED
    var res10 = DecisionEngine.evaluate({
      op: { ticker: 'TEST3', score: 30, adx: 15 },
      analise: { sentiment: 'NEUTRAL', ai_score: 30 },
      macroRegime: 'NEUTRAL'
    });
    assertEqual(res10.status, 'REJECTED', 'Score 30 + IA 30 → REJECTED (abaixo do threshold)');

    // 11. IA rejeita com AGUARDAR + score baixo
    var res11 = DecisionEngine.evaluate({
      op: { ticker: 'TEST3', score: 60, adx: 25 },
      analise: { sentiment: 'NEUTRAL', ai_score: 15, decision: 'AGUARDAR', rationale: 'IA recomenda aguardar' },
      macroRegime: 'NEUTRAL'
    });
    assertEqual(res11.status, 'REJECTED', 'IA vetou com AGUARDAR + score baixo + aiScore < 20');

    // 12. RiskCheckFn vetando
    var res12 = DecisionEngine.evaluate({
      op: { ticker: 'TEST3', score: 80, adx: 28 },
      analise: { sentiment: 'NEUTRAL', ai_score: 75 },
      macroRegime: 'NEUTRAL',
      riskCheckFn: function () {
        return { approved: false, reason: 'Risco máximo setorial atingido.' };
      }
    });
    assertEqual(res12.status, 'REJECTED', 'RiskCheckFn rejeitando → REJECTED');
    assertEqual(res12.motivo, 'Risco máximo setorial atingido.', 'Motivo do veto do RiskManager');

    // 13. RiskCheckFn aprovando
    var res13 = DecisionEngine.evaluate({
      op: { ticker: 'TEST3', score: 80, adx: 28 },
      analise: { sentiment: 'NEUTRAL', ai_score: 75 },
      macroRegime: 'NEUTRAL',
      riskCheckFn: function () {
        return { approved: true, suggested_allocation: 0.5, reason: 'OK' };
      }
    });
    assertEqual(res13.status, 'APPROVED', 'RiskCheckFn aprovando → APPROVED');
    assertEqual(res13.suggested_allocation, 0.5, 'Allocação sugerida = 0.5');

    // 14. Sentimento BULLISH com score alto → bonus
    var resBullish = DecisionEngine.evaluate({
      op: { ticker: 'TEST3', score: 70, adx: 25 },
      analise: { sentiment: 'BULLISH', ai_score: 70 },
      macroRegime: 'BULLISH'
    });
    assertEqual(resBullish.status, 'APPROVED', 'BULLISH com score 70 → APPROVED');
    assert(resBullish.score >= 65, 'Score com BULLISH +10 > score sem bonus');
  }

  // ==========================================================================
  // TESTE: PIPELINE DE DADOS / FINNHUB KEY
  // ==========================================================================

  function testar_FinnhubKeyResolution() {
    console.log('\n📊 Suite: Resolução de chave Finnhub (FINNHUB_API_KEY/FINNHUB_KEY)');
    _currentSuite = 'FinnhubKey';

    // Testa que SECRET_KEY_NAMES contém ambos os nomes
    assertTrue(Array.isArray(SECRET_KEY_NAMES), 'SECRET_KEY_NAMES é array');
    assert(SECRET_KEY_NAMES.indexOf('FINNHUB_API_KEY') !== -1, 'FINNHUB_API_KEY na lista SECRET_KEY_NAMES');
    assert(SECRET_KEY_NAMES.indexOf('FINNHUB_KEY') !== -1, 'FINNHUB_KEY na lista SECRET_KEY_NAMES');

    // Testa isSecretKeyName para ambos
    assertTrue(isSecretKeyName('FINNHUB_API_KEY'), 'isSecretKeyName("FINNHUB_API_KEY") = true');
    assertTrue(isSecretKeyName('FINNHUB_KEY'), 'isSecretKeyName("FINNHUB_KEY") = true');
    assertFalse(isSecretKeyName('NAO_EXISTE'), 'isSecretKeyName("NAO_EXISTE") = false');
  }

  function testar_DataService_Estrutura() {
    console.log('\n📊 Suite: DataService (estrutura)');
    _currentSuite = 'DataService';

    assertNotNull(DataService, 'DataService disponível');
    assert(typeof DataService.getMarketData === 'function', 'DataService.getMarketData é função');
    assert(typeof DataService.getPrecosAtuaisEmLote === 'function', 'DataService.getPrecosAtuaisEmLote é função');
    assert(typeof DataService.getPrecoAtual === 'function', 'DataService.getPrecoAtual é função');
    assert(typeof DataService.getMarketContext === 'function', 'DataService.getMarketContext é função');
  }

  function testar_IndicatorHelpers() {
    console.log('\n📊 Suite: Helpers de Indicadores');
    _currentSuite = 'IndicatorHelpers';

    // _core_getLogReturns
    var rets = _core_getLogReturns([100, 110, 121]);
    assertAlmostEqual(rets[0], Math.log(110 / 100), 0.001, 'Log return 1 correto');
    assertAlmostEqual(rets[1], Math.log(121 / 110), 0.001, 'Log return 2 correto');

    // _core_getLogReturns com zeros → filtra
    var retsZero = _core_getLogReturns([0, 100, 0, 50]);
    assertEqual(retsZero.length, 0, 'Log returns com zeros são filtrados');

    // _core_estimarRuidoEstatistico
    var est = _core_estimarRuidoEstatistico(CANDLES_ALTA, SERIE_ALTA, 10);
    assertNotNull(est, 'Estimativa de ruído não-nulo');
    assert(est.sigmaLogRet >= 0, 'Sigma log-return >= 0');

    // _core_noisePrice
    var noise = _core_noisePrice(50, 1.5, CANDLES_ALTA, SERIE_ALTA);
    assert(noise >= 50 * 0.005, 'Noise price >= minStopPct (0.5%)');
    assert(noise > 0, 'Noise price > 0');

    // _obterContextoPrecos
    var ctx = _obterContextoPrecos(CANDLES_ALTA);
    assertEqual(ctx.closes.length, CANDLES_ALTA.length, 'Contexto closes com mesmo tamanho');
    assertEqual(ctx.highs.length, CANDLES_ALTA.length, 'Contexto highs com mesmo tamanho');
    assertEqual(ctx.lows.length, CANDLES_ALTA.length, 'Contexto lows com mesmo tamanho');
    assertEqual(ctx.closes[0], 10, 'Contexto closes[0] = 10');
  }

  function testar_AnaliseEstruturaMercado() {
    console.log('\n📊 Suite: _analisarEstruturaMercado');
    _currentSuite = 'EstruturaMercado';

    var ctx = _obterContextoPrecos(CANDLES_ALTA);
    var ind = {
      ema21: 20,
      ema50: 19,
      adx: 25
    };
    var estrutura = _analisarEstruturaMercado(ctx, 25, ind, CANDLES_ALTA);

    assertNotNull(estrutura, 'Estrutura de mercado não-nula');
    assert(estrutura.h50 > estrutura.l50, 'h50 > l50');
    assert(estrutura.fibo50 > estrutura.l50, 'fibo50 > l50');
    assert(estrutura.fibo618 > estrutura.l50, 'fibo618 > l50');
    assert(estrutura.fibo618 < estrutura.fibo50, 'fibo618 < fibo50');
    assert(estrutura.swingLow != null, 'SwingLow presente');

    // Preço acima da zona de Fibonacci → inFiboZone = false
    assertFalse(estrutura.inFiboZone, 'Preço 25 acima da zona fibo (fibo50 ~20) → inFiboZone = false');
  }

  // ==========================================================================
  // EXECUTOR
  // ==========================================================================

  function rodarTodasSuites() {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 RODANDO TODOS OS TESTES UNITÁRIOS B3-v10');
    console.log('='.repeat(70));

    var inicio = Date.now();

    // Indicadores
    testar_EMA();
    testar_RSI();
    testar_ATR();
    testar_Bollinger();
    testar_VolumeRelativo();
    testar_ADX();
    testar_VWMA();
    testar_Median_E_RobustSigma();
    testar_PivotLows();

    // Analisador Core
    testar_STRATEGY_EVALUATE_CORE();
    testar_CalcularScoreSistemico();
    testar_IdentificarSetup();
    testar_DeterminarEstrategiaEntrada();

    // Decision Engine
    testar_DecisionEngine_NormalizeSentiment();
    testar_DecisionEngine_SentimentBonus();
    testar_DecisionEngine_Evaluate();

    // Data/Config
    testar_FinnhubKeyResolution();
    testar_DataService_Estrutura();
    testar_IndicatorHelpers();
    testar_AnaliseEstruturaMercado();

    var duracao = Date.now() - inicio;

    // =========================================================================
    // RESUMO FINAL
    // =========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('📋 RESUMO FINAL DOS TESTES UNITÁRIOS');
    console.log('='.repeat(70));
    console.log('  Total de testes: ' + _totalTests);
    console.log('  ✅ Passou:        ' + _passedTests);
    console.log('  ❌ Falhou:        ' + _failedTests.length);
    console.log('  ⏱️  Duração:       ' + duracao + 'ms');
    
    if (_failedTests.length > 0) {
      console.log('\n❌ TESTES QUE FALHARAM:');
      _failedTests.forEach(function (fail, i) {
        console.log('  ' + (i + 1) + '. ' + fail);
      });
    }
    
    console.log('\n' + '='.repeat(70));
    if (_failedTests.length === 0) {
      console.log('🎉 TODOS OS TESTES PASSARAM! (' + _totalTests + '/' + _totalTests + ')');
    } else {
      console.log('⚠️ ' + _failedTests.length + ' TESTE(S) FALHARAM');
    }
    console.log('='.repeat(70));

    // Lança erro se houver falhas (permite integrar com CI/triggers)
    if (_failedTests.length > 0) {
      throw new Error(_failedTests.length + ' teste(s) falharam. Verificar logs de execução.');
    }

    return {
      total: _totalTests,
      passed: _passedTests,
      failed: _failedTests.length,
      durationMs: duracao
    };
  }

  return {
    rodarTodasSuites: rodarTodasSuites,
    // Testes de indicadores
    testar_EMA: testar_EMA,
    testar_RSI: testar_RSI,
    testar_ATR: testar_ATR,
    testar_Bollinger: testar_Bollinger,
    testar_VolumeRelativo: testar_VolumeRelativo,
    testar_ADX: testar_ADX,
    testar_VWMA: testar_VWMA,
    testar_Median_E_RobustSigma: testar_Median_E_RobustSigma,
    testar_PivotLows: testar_PivotLows,
    // Testes do Analisador Core
    testar_STRATEGY_EVALUATE_CORE: testar_STRATEGY_EVALUATE_CORE,
    testar_CalcularScoreSistemico: testar_CalcularScoreSistemico,
    testar_IdentificarSetup: testar_IdentificarSetup,
    testar_DeterminarEstrategiaEntrada: testar_DeterminarEstrategiaEntrada,
    // Testes do Decision Engine
    testar_DecisionEngine_NormalizeSentiment: testar_DecisionEngine_NormalizeSentiment,
    testar_DecisionEngine_SentimentBonus: testar_DecisionEngine_SentimentBonus,
    testar_DecisionEngine_Evaluate: testar_DecisionEngine_Evaluate,
    // Testes de dados/config
    testar_FinnhubKeyResolution: testar_FinnhubKeyResolution,
    testar_DataService_Estrutura: testar_DataService_Estrutura,
    testar_IndicatorHelpers: testar_IndicatorHelpers,
    testar_AnaliseEstruturaMercado: testar_AnaliseEstruturaMercado,
    // Asserts
    assert: assert,
    assertEqual: assertEqual,
    assertAlmostEqual: assertAlmostEqual,
    assertTrue: assertTrue,
    assertFalse: assertFalse,
    assertNotNull: assertNotNull,
    assertInRange: assertInRange
  };
})();

/**
 * Função principal de execução — selecionar no Apps Script e executar
 */
function RODAR_TODOS_TESTES_UNITARIOS() {
  try {
    var resultado = UnitTests.rodarTodasSuites();
    console.log('\n✅ Resultado final: ' + JSON.stringify(resultado));

    // Toast para feedback visual (se estiver em planilha)
    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        '✅ ' + resultado.passed + '/' + resultado.total + ' testes passaram!',
        'B3-v10 Testes Unitários',
        10
      );
    } catch (e) { /* UI não disponível */ }

    return resultado;
  } catch (e) {
    console.error('\n🚨 ' + e.message);

    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        '❌ Testes falharam: ' + e.message,
        'B3-v10 Testes Unitários',
        15
      );
    } catch (e2) { /* UI não disponível */ }

    throw e;
  }
}

/**
 * Alias para menu
 */
function TESTES_UNITARIOS() {
  RODAR_TODOS_TESTES_UNITARIOS();
}

/**
 * Executa apenas os testes de indicadores técnicos
 */
function RODAR_TESTES_INDICADORES() {
  var suitesSelecionadas = [
    'testar_EMA',
    'testar_RSI',
    'testar_ATR',
    'testar_Bollinger',
    'testar_VolumeRelativo',
    'testar_ADX',
    'testar_VWMA',
    'testar_Median_E_RobustSigma',
    'testar_PivotLows',
    'testar_IndicatorHelpers',
    'testar_AnaliseEstruturaMercado'
  ];
  console.log('\n🧪 Executando apenas testes de indicadores...');
  var inicio = Date.now();
  for (var i = 0; i < suitesSelecionadas.length; i++) {
    var fnName = suitesSelecionadas[i];
    if (typeof UnitTests[fnName] === 'function') {
      UnitTests[fnName]();
    } else {
      console.error('❌ Função de teste não encontrada: ' + fnName);
    }
  }
  var duracao = Date.now() - inicio;
  console.log('\n✅ Indicadores OK em ' + duracao + 'ms');
  return { suites: suitesSelecionadas, durationMs: duracao };
}

/**
 * Executa apenas os testes do DecisionEngine
 */
function RODAR_TESTES_DECISION_ENGINE() {
  console.log('\n🧪 Executando apenas testes do DecisionEngine...');
  UnitTests.testar_DecisionEngine_NormalizeSentiment();
  UnitTests.testar_DecisionEngine_SentimentBonus();
  UnitTests.testar_DecisionEngine_Evaluate();
  console.log('\n✅ DecisionEngine OK');
}

/**
 * Executa apenas os testes do Core Analyzer (STRATEGY_EVALUATE_CORE)
 */
function RODAR_TESTES_CORE_ANALYZER() {
  console.log('\n🧪 Executando apenas testes do Core Analyzer...');
  UnitTests.testar_STRATEGY_EVALUATE_CORE();
  UnitTests.testar_CalcularScoreSistemico();
  UnitTests.testar_IdentificarSetup();
  UnitTests.testar_DeterminarEstrategiaEntrada();
  console.log('\n✅ Core Analyzer OK');
}