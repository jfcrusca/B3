/**
 * TESTE_BRAPI_BTC.js — SCRIPT DE DIAGNÓSTICO DE DADOS DE ALUGUEL (BTC) E SHORT NO BRAPI
 * =============================================================================
 * Instruções:
 * 1. Salve e envie este arquivo para o Google Apps Script (clasp push).
 * 2. No editor do Apps Script, selecione e execute a função 'TESTAR_DADOS_BTC'.
 * 3. Analise o log de execução para ver quais campos e endpoints retornam dados de aluguel.
 * =============================================================================
 */

function TESTAR_DADOS_BTC() {
  console.log("🚀 INICIANDO TESTE DE CONEXÃO E LEITURA DE BTC (ALUGUEL) VIA BRAPI...");
  
  // 1. Obtém o Token do BRAPI de forma segura
  let token = null;
  if (typeof Secrets !== 'undefined' && typeof Secrets.getSecret === 'function') {
    token = Secrets.getSecret('BRAPI_TOKEN');
  }
  if (!token && typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') {
    token = CONFIG.getSecret('BRAPI_TOKEN');
  }
  
  if (!token) {
    console.error("❌ BRAPI_TOKEN não foi encontrado nas configurações ou Secrets Manager.");
    return;
  }
  
  // Tickers de teste
  const tickers = ["VALE3", "PETR4", "ITUB4", "JBSS32"];
  
  tickers.forEach(ticker => {
    console.log(`\n------------------------------------------------------------`);
    console.log(`🔍 Investigando propriedades de cotação para: ${ticker}`);
    
    // Teste 1: Endpoint de quote padrão (tenta ler todos os metadados e estatísticas disponíveis)
    const urlQuote = `https://brapi.dev/api/quote/${ticker}?token=${token}`;
    try {
      const response = UrlFetchApp.fetch(urlQuote, { muteHttpExceptions: true });
      const code = response.getResponseCode();
      
      if (code === 200) {
        const json = JSON.parse(response.getContentText());
        const result = json.results ? json.results[0] : null;
        
        if (result) {
          console.log(`✅ [HTTP 200] Dados de Quote carregados para ${ticker}.`);
          
          // Imprime campos interessantes que o BRAPI pode retornar de acordo com o ativo
          const camposInteressantes = [
            "symbol", "regularMarketPrice", "regularMarketChangePercent",
            "marketCap", "sharesOutstanding", "shortName", "longName"
          ];
          
          camposInteressantes.forEach(campo => {
            if (result[campo] !== undefined) {
              console.log(`   👉 ${campo}: ${result[campo]}`);
            }
          });
          
          // Varre todas as chaves do resultado em busca de campos de Aluguel, Short, Empréstimo ou BTC
          console.log(`\n   🛠️ Varrendo todas as propriedades de quote em busca de dados de aluguel/shorts...`);
          let btcKeysFound = 0;
          Object.keys(result).forEach(key => {
            const lowerKey = key.toLowerCase();
            // Busca termos comuns: short, rent, loan, btc, borrow, lend
            if (lowerKey.includes("short") || lowerKey.includes("rent") || lowerKey.includes("loan") || lowerKey.includes("btc") || lowerKey.includes("borrow") || lowerKey.includes("lend")) {
              console.log(`   ⭐ CHAVE ENCONTRADA: "${key}":`, result[key]);
              btcKeysFound++;
            }
          });
          
          if (btcKeysFound === 0) {
            console.log(`   ℹ️ Nenhum campo de aluguel/short detectado diretamente no objeto de quote raiz.`);
          }
        } else {
          console.warn(`⚠️ Resposta do BRAPI sem resultados na lista para ${ticker}.`);
        }
      } else {
        console.error(`❌ Erro [HTTP ${code}] na quote de ${ticker}: ${response.getContentText().substring(0, 200)}`);
      }
    } catch (e) {
      console.error(`❌ Falha na requisição de quote para ${ticker}: ${e.message}`);
    }
  });

  // Teste 2: Tenta consultar endpoints avançados da B3 ou de mercado se suportados pelo BRAPI
  console.log(`\n============================================================`);
  console.log(`🌐 TESTANDO ENDPOINTS DE MERCADO ADICIONAIS DO BRAPI...`);
  
  // O BRAPI possui endpoints de estatísticas de B3 / rentabilidade e dados históricos
  const endpointsExperimentais = [
    { nome: "Histórico detalhado de aluguel (Experimental)", url: `https://brapi.dev/api/market/b3/rentability?token=${token}` },
    { nome: "Dados setoriais / índices B3 (Experimental)", url: `https://brapi.dev/api/market/b3/index?token=${token}` }
  ];
  
  endpointsExperimentais.forEach(ep => {
    console.log(`\n📡 Testando: ${ep.nome}`);
    try {
      const response = UrlFetchApp.fetch(ep.url, { muteHttpExceptions: true });
      const code = response.getResponseCode();
      console.log(`   Status: HTTP ${code}`);
      if (code === 200) {
        const text = response.getContentText();
        console.log(`   ✅ Dados recebidos com sucesso! Amostra do conteúdo (primeiros 500 caracteres):`);
        console.log(`   ${text.substring(0, 500)}...`);
      } else {
        console.log(`   ❌ Endpoint não disponível ou requer plano pago (HTTP ${code}).`);
      }
    } catch (e) {
      console.log(`   ❌ Erro ao conectar: ${e.message}`);
    }
  });
  
  console.log(`\n------------------------------------------------------------`);
  console.log(`🏁 FIM DO DIAGNÓSTICO DE BTC DO BRAPI.`);
}
