/**
 * =============================================================================
 * 46_Debug_System.gs — Diagnóstico Dedicado (Versão Core Analyzers)
 * =============================================================================
 */

function verificarSaudeSistema() {
  console.log("🏥 INICIANDO CHECK-UP (Alvo: STRATEGY_EVALUATE_CORE)...");
  let statusGeral = true;

  // 1. TESTE DE DADOS (DATA SERVICE)
  try {
    if (typeof DataService === 'undefined') throw new Error("DataService não encontrado.");
    const dadosReais = DataService.getMarketData('PETR4');
    if (!dadosReais || !dadosReais.candles) throw new Error("API de Dados falhou.");
    console.log("✅ API de Dados: FUNCIONANDO");
  } catch (e) {
    console.error(`❌ FALHA NOS DADOS: ${e.message}`);
    statusGeral = false; // Não falha o teste de lógica, mas avisa
  }

  // 2. TESTE DE LÓGICA (STRATEGY_EVALUATE_CORE)
  try {
    if (typeof STRATEGY_EVALUATE_CORE === 'undefined') {
      throw new Error("Função STRATEGY_EVALUATE_CORE não encontrada no escopo global.");
    }

    // Criamos dados falsos (Mock) para garantir que testamos A LÓGICA, não o mercado
    const dadosMock = gerarDadosMock();
    
    // Executa a estratégia
    const analise = STRATEGY_EVALUATE_CORE(dadosMock, null);

    if (!analise) throw new Error("Estratégia retornou null para dados válidos.");
    if (typeof analise.score !== 'number') throw new Error("Score não calculado.");
    
    console.log(`✅ Lógica Core: OK (Setup detectado: ${analise.setup})`);
    console.log(`   📊 Score: ${analise.score}`);
    
    // Validação Específica do Fibo Fix
    if (analise.fiboPrice && analise.fiboPrice > 0) {
      console.log(`   ✨ FiboPrice Calculado: ${analise.fiboPrice} (OK)`);
    } else {
      console.warn("   ⚠️ Aviso: fiboPrice zerado ou ausente.");
    }


    if (analise.riskDebug) {
  console.log(`   🔒 Stop Source: ${analise.riskDebug.stopSource}`);
  console.log(`   ⚠️ Stop Inviável: ${analise.riskDebug.invalidoPorStop}`);
}



    // Validação de Risco
    if (analise.stopLoss >= analise.price && analise.setup.includes('MOMENTUM')) {
       console.warn("   ⚠️ Aviso Lógico: Stop Loss acima do preço em setup de compra.");
    }

  } catch (e) {
    console.error(`❌ FALHA NA LÓGICA: ${e.message}`);
    statusGeral = false;
  }

  // 3. RESULTADO FINAL
  if (statusGeral) {
    console.log("\n🚀 SISTEMA PRONTO. Lógica Matemática Validada.");
  } else {
    console.error("\n🛑 SISTEMA COM PROBLEMAS. Verifique os logs acima.");
  }
  
  return statusGeral;
}

/**
 * DEBUGGER UNITÁRIO
 * Use isso para ver o que o robô pensa de uma ação específica agora.
 */
function debugarAtivo(ticker = "PETR4") {
  console.log(`\n🔍 DEBUGANDO ${ticker}...`);
  try {
    const dados = DataService.getMarketData(ticker);
    const resultado = STRATEGY_EVALUATE_CORE(dados, null);
    
    if (!resultado) {
      console.log("❌ Sem resultado (Dados insuficientes?).");
      return;
    }

    console.log(`TICKER: ${resultado.ticker}`);
    console.log(`PREÇO:  ${resultado.price}`);
    console.log(`SCORE:  ${resultado.score}`);
    console.log(`SETUP:  ${resultado.setup}`);
    console.log(`FIBO:   ${resultado.fiboPrice}`);
    console.log(`RSI:    ${resultado.indicators ? resultado.indicators.rsi : 'N/A'}`);
    console.log(`EMA21:  ${resultado.indicators ? resultado.indicators.ema21 : 'N/A'}`); 

  } catch (e) {
    console.error(`Erro ao debugar: ${e.message}`);
  }
}

/**
 * HELPER: Gera 200 candles falsos para teste de estresse da lógica
 */
function gerarDadosMock() {
  const candles = [];
  let price = 100;
  for (let i = 0; i < 200; i++) {
    // Simula uma tendência de alta leve
    const move = (Math.random() - 0.45) * 2; 
    price += move;
    candles.push({
      close: price,
      high: price + 1,
      low: price - 1,
      open: price - 0.5,
      volume: 1000000 + (Math.random() * 500000)
    });
  }
  return { ticker: 'MOCK3', candles: candles };
}

function debugarCandles(ticker = 'USIM5') {
  if (!ticker || typeof ticker !== 'string') {
    console.log("❌ Ticker inválido.");
    return;
  }
  const dados = DataService.getMarketData(ticker);
  
  const amostra = dados.candles.slice(-5);
  amostra.forEach((c, i) => {
    console.log(`[${i}] close: ${c.close} | high: ${c.high} | low: ${c.low}`);
  });
}