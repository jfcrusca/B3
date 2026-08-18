/**
 * Função para validar a conexão com a RapidAPI.
 * Use para verificar se o Host e a Key estão corretos sem precisar rodar o robô inteiro.
 */
function TESTAR_CONEXAO_RAPIDAPI_DIRETO() {
  console.log("🚀 [DIAGNÓSTICO] Iniciando Teste de Integração RapidAPI...");

  const tickerUnitario = "PETR4";
  const listaLote = ["VALE3", "ITUB4", "ABEV3"];

  // 1. Validar se a Chave está configurada
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('RAPIDAPI_KEY');
  const host = props.getProperty('RAPIDAPI_HOST') || "yh-finance.p.rapidapi.com";

  if (!key) {
    console.warn("⚠️ RAPIDAPI_KEY não encontrada nas Propriedades do Script.");
    console.log("💡 Usando chave fallback inserida no código...");
  } else {
    console.log(`✅ Chave detectada. Usando Host: ${host}`);
  }

  // 2. Testar busca de Histórico (OHLCV)
  console.log(`\n1️⃣ Testando Histórico Individual (${tickerUnitario})...`);
  try {
    const hist = YahooFetcher.getHistoryRapidAPI(tickerUnitario, '1d', '5d');
    if (hist && hist.length > 0) {
      console.log(`✅ SUCESSO: Recebidos ${hist.length} candles.`);
      console.log(`   Último Preço: R$ ${hist[hist.length - 1].close}`);
    } else {
      console.error("❌ FALHA: O Histórico retornou nulo ou vazio.");
    }
  } catch (e) {
    console.error(`❌ ERRO NO HISTÓRICO: ${e.message}`);
  }

  // 3. Testar busca de Cotações em Lote (Preço Atual)
  console.log(`\n2️⃣ Testando Cotações em Lote (${listaLote.join(', ')})...`);
  try {
    // Adicionamos .SA automaticamente para o teste
    const simbolosSA = listaLote.map(s => s.endsWith('.SA') ? s : s + ".SA");
    const quotes = YahooFetcher.getQuoteBatchRapidAPI(simbolosSA);
    const keysFound = Object.keys(quotes);

    if (keysFound.length > 0) {
      console.log(`✅ SUCESSO: Dados recuperados para ${keysFound.length} ativos.`);
      keysFound.forEach(k => {
        console.log(`   - ${k}: R$ ${quotes[k].price} (${quotes[k].change.toFixed(2)}%)`);
      });
    } else {
      console.error("❌ FALHA: O Lote retornou um objeto vazio.");
    }
  } catch (e) {
    console.error(`❌ ERRO NO LOTE: ${e.message}`);
  }

  console.log("\n🏁 Fim do Teste.");
}




function DIAGNOSTICO_BRAPI_YAHOO() {
  const results = [];
  
  // 1. Verificar token BRAPI
  const token = PropertiesService.getScriptProperties().getProperty('BRAPI_TOKEN');
  if (!token) {
    results.push('❌ BRAPI_TOKEN não configurado!');
    results.push('   → Adicione: Script Properties → BRAPI_TOKEN = sua_chave');
  } else {
    results.push(`✅ BRAPI_TOKEN configurado (${token.substring(0, 8)}...)`);
  }
  
  // 2. Teste rápido BRAPI
  if (token) {
    try {
      const testUrl = `https://brapi.dev/api/quote/PETR4?token=${token}`;
      const resp = UrlFetchApp.fetch(testUrl, { muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) {
        const json = JSON.parse(resp.getContentText());
        const price = json.results?.[0]?.regularMarketPrice || 'N/A';
        results.push(`✅ BRAPI: Conexão OK - PETR4: R$ ${price}`);
      } else {
        results.push(`⚠️ BRAPI: HTTP ${resp.getResponseCode()} - verifique token`);
      }
    } catch(e) {
      results.push(`❌ BRAPI: ${e.message}`);
    }
  }
  
  // 3. Teste Yahoo com headers corrigidos
  try {
    const options = {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    };
    const resp = UrlFetchApp.fetch('https://query1.finance.yahoo.com/v7/finance/quote?symbols=PETR4.SA', options);
    if (resp.getResponseCode() === 200) {
      const json = JSON.parse(resp.getContentText());
      const price = json.quoteResponse?.result?.[0]?.regularMarketPrice || 'N/A';
      results.push(`✅ Yahoo: HTTP 200 - PETR4: R$ ${price}`);
    } else {
      results.push(`⚠️ Yahoo: HTTP ${resp.getResponseCode()} - pode estar bloqueando`);
    }
  } catch(e) {
    results.push(`❌ Yahoo: ${e.message}`);
  }
  
  // 4. Exibir resultados no console (sempre disponível)
  console.log("🔍 DIAGNÓSTICO BRAPI/YAHOO\n" + "=".repeat(40));
  results.forEach(r => console.log(r));
  console.log("=".repeat(40));
  
  // Se houver UI (planilha aberta), exibe alerta também
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert('🔍 Diagnóstico APIs', results.join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    // Sem UI, apenas log já foi feito
    console.log("ℹ️ (Sem interface gráfica - resultados apenas no console)");
  }
}