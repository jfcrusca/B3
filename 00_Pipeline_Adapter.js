/**
 * =============================================================================
 * 00_Pipeline_Adapter.gs (Versão Blindada V10.1 - COM CONTEXTO IBOV)
 * =============================================================================
 */

/**
 * @typedef {Object} MarketContext
 * @property {Object} ibov
 * @property {number} ibov.close - Último fechamento do IBOV
 * @property {number} ibov.change - Variação percentual
 * @property {Object} dolar
 * @property {number} dolar.close - Cotação do USD/BRL
 * @property {Array<Object>} [intradayCandles] - Candles de H1 para MTF
 * @property {boolean} isMTF - Flag indicando se análise multi-timeframe está ativa
 * @property {string} [regime] - BULLISH, BEARISH ou NEUTRAL
 */

/**
 * @typedef {Object} TradeResult
 * @property {string} ticker - Símbolo do ativo
 * @property {number} score - Pontuação final (0-100)
 * @property {string} setup - Nome do setup identificado
 * @property {number} price - Preço base da análise
 * @property {number} stopLoss - Preço de saída defensiva
 * @property {number} target1 - Primeiro alvo
 * @property {number} target2 - Segundo alvo
 * @property {number} rr - Relação Risco/Retorno
 * @property {Object} indicators - Objeto contendo indicadores calculados
 */

var PipelineAdapter = (function () {
  'use strict';

  /**
   * Processa a análise de um ativo integrando motores e contextos.
   * 
   * @param {string} ticker - O código do ativo (ex: "VALE3")
   * @param {MarketContext} ibovContext - O contexto atual de mercado
   * @returns {TradeResult|null} Resultado da análise ou null se descartado
   */
  function processarTicker(ticker, ibovContext) {
    var rawResult = null;
    var engineName = "";

    // =========================================================================
    // 🕒 MOTOR MULTI-TIMEFRAME (MTF): Buscando contexto Intradiário (H1)
    // =========================================================================
    var intradayCandles = null;
    if (typeof YahooFetcher !== 'undefined' && typeof YahooFetcher.getHistory === 'function') {
      try { // Tenta buscar dados intradiários, mas agora via DataService (BRAPI)
        // DataService agora é BRAPI-only e não suporta '1h' diretamente, então intradayCandles será null
        // Manter a estrutura para compatibilidade, mas o resultado será nulo.
        // intradayCandles = DataService.getMarketData(ticker, '1h', '1mo')?.candles; // Se DataService suportasse 1h
      } catch(e) { // Se YahooFetcher não estiver mais disponível ou falhar
        console.warn(`⚠️ Aviso: Falha ao buscar dados intradiários para ${ticker}. Seguindo apenas com o Diário.`);
      }
    }

    // Clonamos/Enriquecemos o contexto original para não sujar variáveis globais
    var contextoEnriquecido = ibovContext ? JSON.parse(JSON.stringify(ibovContext)) : {};
    contextoEnriquecido.intradayCandles = intradayCandles;
    contextoEnriquecido.isMTF = (intradayCandles && intradayCandles.length > 0);
    // =========================================================================

    // 1. Tenta usar o motor V10 (Prioridade Máxima)
    if (typeof EntryGeneratorV10 !== 'undefined') {
        engineName = "V10";
        
        // 🚀 CONEXÃO: Passando o contexto enriquecido (Diário + H1) para o Sniper
        if (typeof EntryGeneratorV10.analisarTicker === 'function') {
            rawResult = EntryGeneratorV10.analisarTicker(ticker, contextoEnriquecido);
        } else if (typeof EntryGeneratorV10.generateEntry === 'function') {
            rawResult = EntryGeneratorV10.generateEntry(ticker, contextoEnriquecido);
        }
    } 
    // 2. Fallback para motor antigo
    else if (typeof EntryGenerator !== 'undefined') {
        engineName = "Legacy";
        if (typeof EntryGenerator.analisarTicker === 'function') {
            rawResult = EntryGenerator.analisarTicker(ticker, contextoEnriquecido);
        }
    }

    // Se falhou, tenta injeção manual de dados
    if (!rawResult && typeof DataService !== 'undefined') {
        var data = DataService.getMarketData(ticker);
        if (data && typeof EntryGeneratorV10 !== 'undefined' && typeof EntryGeneratorV10.analisar === 'function') {
            // Repassa o contexto MTF também na injeção manual
            rawResult = EntryGeneratorV10.analisar(data, contextoEnriquecido);
        }
    }

    if (LogService) LogService.info('Adapter', `Processando ${ticker} | Engine: ${engineName} | MTF: ${contextoEnriquecido.isMTF}`);

    // --- O DESEMBRULHADOR (Mantido) ---
    if (!rawResult) return null;

    if (rawResult.success === true && rawResult.data) {
        if (!rawResult.data.ticker) rawResult.data.ticker = ticker;
        if (rawResult.data.score > 0) return rawResult.data;
    }

    if (rawResult.ticker && rawResult.score !== undefined) return rawResult;

    return null;
  }

  return { processarTicker: processarTicker };
})();

function testarIntegracaoAvancada() {
  console.log('🧪 TESTE FINAL V10');
  var ticker = 'VALE3';
  
  var contexto = DataService.getMarketContext();
  var resultado = PipelineAdapter.processarTicker(ticker, contexto);
  
  if (resultado) {
    console.log('✅ SUCESSO REAL!');
    console.log(`   Ticker: ${resultado.ticker}`);
    console.log(`   Score: ${resultado.score}`);
    console.log(`   Setup: ${resultado.setupType || resultado.setup}`); 



  } else {
    console.log('⚠️ Nenhum trade encontrado (mas o motor rodou).');
  }
}





function testeUnitarioV10_ComDadosFalsos() {
  console.log('🧪 TESTE UNITÁRIO V10 (Setup Perfeito)');
  
  // 1. Cria dados falsos PERFEITOS para a estratégia
  var candlesFalsos = [];
  var preco = 100;
  
  // Gera 50 candles subindo forte
  for (var i = 0; i < 50; i++) {
    candlesFalsos.push({
      open: preco,
      high: preco * 1.02,
      low: preco * 0.99,
      close: preco * 1.01, // Fecha positivo
      volume: 20000000
    });
    preco = preco * 1.01;
  }
  
  var ultimoPreco = candlesFalsos[49].close;

  var mockData = {
    ticker: 'WINNER3',
    candles: candlesFalsos,
    // AQUI O TRUQUE: Injetamos indicadores que confirmam o Setup "SUPER_MOMENTUM"
    indicators: {
       ema21: ultimoPreco * 0.98, // Preço acima da média curta
       ema50: ultimoPreco * 0.95, // Média curta acima da média média
       ema200: ultimoPreco * 0.90, // Tendência de alta longa
       rsi: 55, // RSI saudável (não esticado)
       atr: 1.5,
       // Deixe o volumeMA vazio para testar o cálculo automático de novo
    }
  };

  // 2. Injeta no motor V10
  if (typeof EntryGeneratorV10 !== 'undefined') {
    console.log('⚡ Injetando Setup Perfeito no V10...');
    var resultado = EntryGeneratorV10.analisarDados(mockData, 'WINNER3');
    
    if (resultado.success) {
      console.log('✅ SUCESSO TOTAL! O V10 aprovou o trade.');
      console.log(`   Ticker: ${resultado.data.ticker}`);
      console.log(`   Score: ${resultado.data.score}`);
      console.log(`   Setup: ${resultado.data.setupType}`); // Deve ser SUPER_MOMENTUM
      console.log(`   Status: ${resultado.data.score > 70 ? 'Aprovado' : 'Em observação'}`);
    } else {
      console.error('❌ V10 Rejeitou: ' + resultado.reason);
    }
  } else {
    console.error('❌ EntryGeneratorV10 não encontrado.');
  }
}



/**
 * Simula um cenário de queda forte no IBOV para testar a defesa do robô.
 */
function EXECUTAR_STRESS_TEST_BEAR_MARKET() {
  console.log("⚠️ [STRESS TEST] SIMULANDO MERCADO EM QUEDA LIVRE (BEAR MARKET)...");

  // 1. Criamos um contexto FALSO de pânico
  const mockIbovPânico = {
    ticker: 'IBOV',
    price: 105000, 
    regime: 'BEARISH', // Forçamos a tendência de baixa
    isRiskOn: false,    // Desligamos o apetite ao risco
    updatedAt: new Date()
  };

  const tickerTeste = 'VALE3'; // Usaremos um ticker forte
  console.log(`🔍 Analisando ${tickerTeste} durante a "crise" simulada...`);

  // 2. Rodamos o Adapter passando o pânico como contexto
  const resultado = PipelineAdapter.processarTicker(tickerTeste, mockIbovPânico);

  // 3. Verificamos o comportamento
  if (!resultado) {
    console.log("🛡️ [RESULTADO] SUCESSO: O robô barrou o trade devido ao risco do mercado!");
  } else {
    console.log(`⚠️ [RESULTADO] ALERTA: O robô ainda aprovou o trade.`);
    console.log(`   Ticker: ${resultado.ticker} | Score Final: ${resultado.score}`);
    
    if (resultado.score < 70) {
      console.log("✅ O robô reduziu o score (comportamento defensivo correto).");
    } else {
      console.error("❌ ERRO DE GESTÃO: O score continua alto mesmo com IBOV em queda!");
    }
  }
}




// =============================================================================
// Compatibilidade pública sem sobrescrever o objeto principal
// =============================================================================

var PipelineAdapterCompat = {
  processar: function(ticker, ibovContext) {
    return PipelineAdapter.processarTicker(ticker, ibovContext);
  },
  processarTicker: function(ticker, ibovContext) {
    return PipelineAdapter.processarTicker(ticker, ibovContext);
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.PipelineAdapterCompat = PipelineAdapterCompat;
}