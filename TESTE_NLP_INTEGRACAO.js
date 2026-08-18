function TESTAR_INTEGRACAO_NLP() {
  console.log("🚀 Testando integração NLP...");
  
  const ticker = "PETR4";
  const noticia = "Notícias indicam aumento da produção de petróleo e recorde de lucros para a companhia.";
  
  // Simula o contexto que seria passado no Orquestrador
  const mockOp = {
    ticker: ticker,
    news: noticia,
    score: 80
  };
  
  // Invoca o engine
  const resultado = DecisionEngine.evaluate({
    op: mockOp
  });
  
  console.log("✅ Resultado da análise:");
  console.log(JSON.stringify(resultado, null, 2));
}

function TESTAR_NEWSFETCHER() {
  console.log("📰 Testando NewsFetcher...");
  
  if (typeof NewsFetcher === 'undefined') {
    console.error("❌ NewsFetcher não carregado!");
    return;
  }
  
  // Teste 1: Buscar notícias para PETR4
  console.log("\n=== Teste 1: Notícias PETR4 ===");
  const noticiasPetr = NewsFetcher.getNewsForTicker("PETR4", 3);
  console.log("Resultado:", JSON.stringify(noticiasPetr, null, 2));
  
  // Teste 2: Resumo para prompt
  console.log("\n=== Teste 2: Resumo Notícias PETR4 ===");
  const resumoPetr = NewsFetcher.getNewsSummary("PETR4", 3);
  console.log("Resumo:", resumoPetr);
  
  // Teste 3: Notícias VALE3
  console.log("\n=== Teste 3: Notícias VALE3 ===");
  const resumoVale = NewsFetcher.getNewsSummary("VALE3", 3);
  console.log("Resumo:", resumoVale);
  
  // Teste 4: Notícias WEGE3
  console.log("\n=== Teste 4: Notícias WEGE3 ===");
  const resumoWege = NewsFetcher.getNewsSummary("WEGE3", 3);
  console.log("Resumo:", resumoWege);
  
  // Teste 5: toSummaryText com array vazio
  console.log("\n=== Teste 5: Array vazio ===");
  console.log("Resumo vazio:", NewsFetcher.toSummaryText([]));
  
  console.log("\n✅ Testes NewsFetcher concluídos!");
}

function TESTAR_NLP_COM_NOTICIAS_REAIS() {
  console.log("🚀 Testando NLP com notícias reais via NewsFetcher...");
  
  const ticker = "PETR4";
  
  // 1. Buscar notícias reais
  const noticias = NewsFetcher.getNewsSummary(ticker, 3);
  console.log("📰 Notícias obtidas:", noticias.substring(0, 150) + "...");
  
  // 2. Simular op com notícias preenchidas
  const mockOp = {
    ticker: ticker,
    news: noticias,
    score: 80
  };
  
  // 3. Invoca o engine
  const resultado = DecisionEngine.evaluate({
    op: mockOp
  });
  
  console.log("✅ Resultado da análise com notícias reais:");
  console.log(JSON.stringify(resultado, null, 2));
}

function TESTAR_NLP_SEM_NOTICIAS() {
  console.log("🚀 Testando NLP com busca automática de notícias...");
  
  const ticker = "VALE3";
  
  // Simula op SEM notícias (como ocorre no pipeline real)
  const mockOp = {
    ticker: ticker,
    news: "Sem alertas de notícias.",
    score: 75
  };
  
  // Invoca o engine — o NLP deve buscar notícias automaticamente via NewsFetcher
  const resultado = DecisionEngine.evaluate({
    op: mockOp
  });
  
  console.log("✅ Resultado da análise (sem notícias fornecidas):");
  console.log(JSON.stringify(resultado, null, 2));
  
  // Verifica se o audit trail contém NLP_SENTIMENT
  const nlpStage = (resultado.auditTrail || []).filter(function(item) {
    return item.stage === 'NLP_SENTIMENT';
  });
  console.log("\n📋 NLP Stage no audit trail:", JSON.stringify(nlpStage, null, 2));
}