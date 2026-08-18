/**
 * =============================================================================
 * 23_Pivot_Fibonacci.gs — Indicadores de Pivô e Fibonacci (OTIMIZADO)
 * =============================================================================
 * Versão: 2.0
 * Melhoria: Expõe diretamente o nível 61.8% para a planilha.
 */
const PivotFibonacci = (function() {
  'use strict';
  
  console.log('📊 PivotFibonacci inicializado');
  
  // ============================================
  // CÁLCULO DE PIVÔS (CLÁSSICOS)
  // ============================================
  
  function calculateClassicPivotPoints(high, low, close) {
    const pivot = (high + low + close) / 3;
    return {
      pivot: pivot,
      r1: (2 * pivot) - low,
      r2: pivot + (high - low),
      r3: high + 2 * (pivot - low),
      s1: (2 * pivot) - high,
      s2: pivot - (high - low),
      s3: low - 2 * (high - pivot)
    };
  }
  
  function calculateWoodiePivotPoints(high, low, close) {
    const pivot = (high + low + (2 * close)) / 4;
    return {
      pivot: pivot,
      r1: (2 * pivot) - low,
      r2: pivot + (high - low),
      s1: (2 * pivot) - high,
      s2: pivot - (high - low)
    };
  }
  
  function calculateCamarillaPivotPoints(high, low, close) {
    const range = high - low;
    return {
      pivot: (high + low + close) / 3,
      r1: close + (range * 1.1 / 12),
      r2: close + (range * 1.1 / 6),
      r3: close + (range * 1.1 / 4),
      r4: close + (range * 1.1 / 2),
      s1: close - (range * 1.1 / 12),
      s2: close - (range * 1.1 / 6),
      s3: close - (range * 1.1 / 4),
      s4: close - (range * 1.1 / 2)
    };
  }
  
  // ============================================
  // CÁLCULO DE FIBONACCI
  // ============================================

  function detectSwingPoints(candles, lookback = 20) {
    if (!candles || candles.length < lookback) {
      return { swingHigh: null, swingLow: null };
    }
    
    // Pega o High mais alto e o Low mais baixo do período
    const recent = candles.slice(-lookback);
    let swingHigh = -Infinity;
    let swingLow = Infinity;
    
    for (let i = 0; i < recent.length; i++) {
      if (recent[i].high > swingHigh) swingHigh = recent[i].high;
      if (recent[i].low < swingLow) swingLow = recent[i].low;
    }
    
    return { swingHigh, swingLow };
  }
  
  function calculateAllFibonacciLevels(swingHigh, swingLow) {
    const diff = swingHigh - swingLow;
    
    // Retração (Para compras em tendência de alta)
    // Preço cai do topo até o suporte
    return {
      'F0.0':  { price: swingHigh, level: 0.0 },
      'F23.6': { price: swingHigh - (diff * 0.236), level: 0.236 },
      'F38.2': { price: swingHigh - (diff * 0.382), level: 0.382 },
      'F50.0': { price: swingHigh - (diff * 0.500), level: 0.500 },
      'F61.8': { price: swingHigh - (diff * 0.618), level: 0.618 }, // GOLDEN RATIO
      'F78.6': { price: swingHigh - (diff * 0.786), level: 0.786 },
      'F100':  { price: swingLow, level: 1.0 }
    };
  }
  
  // ============================================
  // FUNÇÃO PRINCIPAL DE ANÁLISE (A MÁGICA ACONTECE AQUI)
  // ============================================
  
  function completeAnalysis(candles) {
    if (!candles || candles.length < 2) return null;
    
    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];
    
    // 1. Pivôs
    const pivots = calculateClassicPivotPoints(
      prevCandle.high,
      prevCandle.low,
      prevCandle.close
    );
    
    // 2. Fibonacci
    const swing = detectSwingPoints(candles, 50); // Lookback maior para Fibo (50 candles)
    let fibLevels = {};
    let fib618 = 0; // Variável simples para exportação
    
    if (swing.swingHigh && swing.swingLow) {
      fibLevels = calculateAllFibonacciLevels(swing.swingHigh, swing.swingLow);
      // Extrai o valor exato que queremos na planilha
      if (fibLevels['F61.8']) {
         fib618 = fibLevels['F61.8'].price;
      }
    }
    
    // 3. Retorno Facilitado
    return {
      pivots: pivots,
      fibonacci: fibLevels,
      
      // 👇 AQUI ESTÁ A CORREÇÃO: Entregamos o valor pronto!
      fib618: fib618, 
      
      price: lastCandle.close,
      timestamp: new Date()
    };
  }
  
  // ============================================
  // EXPORTAÇÃO
  // ============================================
  
  return {
    completeAnalysis: completeAnalysis,
    // Mantém compatibilidade com chamadas antigas
    calculateClassicPivotPoints,
    detectSwingPoints
  };
})();