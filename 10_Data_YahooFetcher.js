// ===== 10_Data_YahooFetcher.js — Versão Apps Script Nativo =====

// ✅ SEM DEPENDÊNCIA DE RAPIDAPI (que exige assinatura paga)

// 10_Data_YahooFetcher.js – Versão Corrigida (sem erros de sintaxe)

var YahooFetcher = (function() {
  const MAX_RETRIES = 1; // REDUZIDO: Yahoo está bloqueando requisições, não vale retentar
  const RETRY_DELAY_MS = 2000;
  
  // Circuit breaker para evitar gastar tempo com Yahoo bloqueado
  var _circuitBreaker = {
    failures: 0,
    maxFailures: 2,
    isOpen: false,
    lastFailureTime: 0,
    cooldownMs: 600000 // 10 min (Yahoo bloqueia por longos períodos)
  };
  
  const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  ];
  
  function _getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  function _fetchWithRetry(url, options = {}) {
    // Circuit breaker check
    if (_circuitBreaker.isOpen) {
      var elapsed = Date.now() - _circuitBreaker.lastFailureTime;
      if (elapsed < _circuitBreaker.cooldownMs) {
        console.warn('⏭️ [Yahoo] Circuit breaker ABERTO. Pulando requisição (cooldown: ' + Math.round((_circuitBreaker.cooldownMs - elapsed)/1000) + 's).');
        return null;
      } else {
        _circuitBreaker.isOpen = false;
        _circuitBreaker.failures = 0;
        console.log('🔄 [Yahoo] Circuit breaker resetado após cooldown.');
      }
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const fetchOptions = {
          muteHttpExceptions: true,
          headers: {
            'User-Agent': _getRandomUserAgent(),
            'Accept': 'application/json',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Origin': 'https://finance.yahoo.com',
            'Referer': 'https://finance.yahoo.com/'
          },
          ...options
        };
        
        const response = UrlFetchApp.fetch(url, fetchOptions);
        const code = response.getResponseCode();
        
        if (code === 200) {
          return JSON.parse(response.getContentText());
        }
        
        if (code === 401 || code === 403 || code === 429) {
          console.warn(`⚠️ Yahoo bloqueou (${code}), tentativa ${attempt}/${MAX_RETRIES}`);
          // Atualiza circuit breaker
          _circuitBreaker.failures++;
          _circuitBreaker.lastFailureTime = Date.now();
          if (_circuitBreaker.failures >= _circuitBreaker.maxFailures) {
            _circuitBreaker.isOpen = true;
            console.error('🚨 [Yahoo] Circuit breaker ATIVADO após ' + _circuitBreaker.failures + ' bloqueios seguidos.');
          }
          Utilities.sleep(RETRY_DELAY_MS * attempt);
          continue;
        }
        
        console.error(`❌ Yahoo HTTP ${code} para ${url}`);
        return null;
        
      } catch (e) {
        console.warn(`⚠️ Erro Yahoo (tentativa ${attempt}): ${e.message}`);
        if (attempt < MAX_RETRIES) Utilities.sleep(RETRY_DELAY_MS);
      }
    }
    return null;
  }

  function getHistory(ticker, interval = '1d', range = '3mo') {
    const sym = ticker.toUpperCase().trim();
    const yahooSym = sym.endsWith('.SA') ? sym : sym + '.SA';
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=${interval}&range=${range}`;
    const json = _fetchWithRetry(url);
    
    if (!json?.chart?.result?.[0]) return null;
    
    const result = json.chart.result[0];
    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0] || {};
    
    return timestamps.map((ts, i) => ({
      date: new Date(ts * 1000),
      open: quote.open?.[i] || quote.close?.[i] || 0,
      high: quote.high?.[i] || quote.close?.[i] || 0,
      low: quote.low?.[i] || quote.close?.[i] || 0,
      close: quote.close?.[i] || 0,
      volume: quote.volume?.[i] || 0,
      ticker: ticker
    })).filter(c => c.close > 0);
  }

  function getQuoteBatchSmart(tickers) {
    const normalized = tickers.map(t => t.toUpperCase().trim());
    const results = {};
    
    // Tenta Yahoo primeiro
    const yahooSymbols = normalized.map(t => t.endsWith('.SA') ? t : t + '.SA');
    const joined = yahooSymbols.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}`;
    
    const json = _fetchWithRetry(url);
    if (json?.quoteResponse?.result) {
      json.quoteResponse.result.forEach(quote => {
        const originalTicker = normalized.find(t => t === quote.symbol.replace('.SA', '') || t === quote.symbol);
        if (originalTicker && quote.regularMarketPrice) {
          results[originalTicker] = {
            price: quote.regularMarketPrice,
            change: quote.regularMarketChangePercent || 0,
            volume: quote.regularMarketVolume || 0
          };
        }
      });
    }
    
    // Fallback para Brapi
    const missing = normalized.filter(t => !results[t]);
    if (missing.length > 0) {
      console.log(`🔄 Fallback Brapi para ${missing.length} ativos...`);
      const brapiResults = getQuoteBatchBrapi(missing);
      Object.assign(results, brapiResults);
    }
    
    return results;
  }

  function getQuoteBatchBrapi(tickers) {
    const token = (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') ? CONFIG.getSecret('BRAPI_TOKEN') : PropertiesService.getScriptProperties().getProperty('BRAPI_TOKEN');
    if (!token) {
      console.error('❌ BRAPI_TOKEN não configurado ou inválido para getQuoteBatchBrapi.');
      return {};
    }
    
    // 🔧 CORREÇÃO: Remove tickers duplicados para evitar URLs malformadas
    const cleanTickers = [...new Set(tickers.map(t => t.replace('.SA', '')))];
    const results = {};
    const CHUNK_SIZE = 10;
    
    for (let i = 0; i < cleanTickers.length; i += CHUNK_SIZE) {
      const chunk = cleanTickers.slice(i, i + CHUNK_SIZE);
      const url = `https://brapi.dev/api/quote/${chunk.join(',')}?token=${token}`;
      
      try {
        const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        if (response.getResponseCode() === 200) {
          const data = JSON.parse(response.getContentText());
          data.results?.forEach(item => {
            const originalTicker = tickers.find(t => t.replace('.SA', '') === item.symbol);
            if (originalTicker && item.regularMarketPrice) {
              results[originalTicker] = {
                price: item.regularMarketPrice,
                change: item.regularMarketChangePercent || 0,
                volume: item.volume || 0,
                source: 'brapi'
              };
            }
          });
        } else {
            console.warn(`⚠️ BRAPI retornou erro HTTP ${response.getResponseCode()} para chunk: ${chunk.join(',')}`);
        }
      } catch (e) {
        console.warn(`⚠️ Brapi chunk falhou: ${e.message}`);
      }
      if (i + CHUNK_SIZE < cleanTickers.length) Utilities.sleep(200);
    }
    return results;
  }

  function getQuote(ticker) {
    const batch = getQuoteBatchSmart([ticker]);
    return batch[ticker] || null;
  }

  // ✅ Retorno da IIFE – AQUI É O ÚNICO `return` VÁLIDO
  return {
    getHistory: getHistory,
    getQuote: getQuote,
    getQuoteBatch: getQuoteBatchSmart,
    getQuoteBatchSmart: getQuoteBatchSmart,
    getQuoteBatchOptimized: getQuoteBatchSmart, // alias
    getQuoteBatchBrapi: getQuoteBatchBrapi
  };
})(); // ← Fim da IIFE


/**
 * Executa um teste completo das funcionalidades do módulo YahooFetcher.
 * Valida a conexão com o Yahoo e o fallback automático para BRAPI.
 */
function TEST_YahooFetcher() {
  const tickerTeste = 'PETR4';
  const tickersBatch = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'WEGE3'];
  
  console.log('🚀 [TESTE] Iniciando Diagnóstico do Módulo YahooFetcher...');

  // Verifica o token BRAPI antes de tentar o fallback
  const brapiToken = (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') ? CONFIG.getSecret('BRAPI_TOKEN') : PropertiesService.getScriptProperties().getProperty('BRAPI_TOKEN');
  if (!brapiToken) {
    console.warn('⚠️ BRAPI_TOKEN não configurado. O fallback para BRAPI pode falhar.');
  } else {
    console.log('✅ BRAPI_TOKEN detectado.');
  }
  
  console.log('\n1️⃣ Testando Cotações em Lote (getQuoteBatchSmart):');
  try {
    const resultados = YahooFetcher.getQuoteBatchSmart(tickersBatch);
    if (Object.keys(resultados).length === 0) throw new Error("Objeto de resultados vazio.");
    
    Object.keys(resultados).forEach(t => {
      console.log(`   ✅ ${t}: R$ ${resultados[t].price} (${resultados[t].change}%)`);
    });
  } catch (e) {
    console.error('   ❌ Falha no teste de cotação em lote:', e.message);
  }

  console.log('\n2️⃣ Testando Histórico (getHistory):');
  try {
    const hist = YahooFetcher.getHistory(tickerTeste, '1d', '5d');
    if (hist && hist.length > 0) {
      console.log(`   ✅ Sucesso: ${hist.length} candles obtidos para ${tickerTeste}.`);
      console.log(`   📊 Último Fechamento: R$ ${hist[hist.length - 1].close.toFixed(2)}`);
    } else {
      console.warn(`   ⚠️ Nenhum dado retornado para ${tickerTeste}. O Yahoo pode estar bloqueando o IP.`);
    }
  } catch (e) {
    console.error('   ❌ Falha no teste de histórico:', e.message);
  }
  
  console.log('\n🏁 [FIM] Diagnóstico finalizado.');
}
