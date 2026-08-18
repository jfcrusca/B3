// ============================================================================
// 🧪 SCRIPT DE TESTE COMPLETO - Diagnóstico de Ensemble
// ============================================================================
// Execute este arquivo copiando a função desejada para o console do Apps Script
// ou adicione como função global no seu projeto

/**
 * Teste 1: Verificar se IAs estão respondendo básico
 * Execute: teste_ai_basico()
 */
function teste_ai_basico() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TESTE 1: VERIFICAÇÃO BÁSICA DE IAs");
  console.log("=".repeat(60));
  
  if (!AIEnsemble) {
    console.error("❌ AIEnsemble não disponível");
    return;
  }
  
  // Chamar função de debug do ensemble
  AIEnsemble.DEBUG_AI_FAILURE("PETR4");
}

/**
 * Teste 2: Executar o ensemble de teste (mock data)
 * Execute: teste_ensemble_mock()
 */
function teste_ensemble_mock() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TESTE 2: ENSEMBLE COM DADOS MOCK");
  console.log("=".repeat(60));
  
  if (!AIEnsemble) {
    console.error("❌ AIEnsemble não disponível");
    return;
  }
  
  AIEnsemble.TESTAR_ENSEMBLE();
}

/**
 * Teste 3: Verificar a última execução (debug logs)
 * Execute: teste_debug_logs()
 */
function teste_debug_logs() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TESTE 3: ANÁLISE DE DEBUG LOGS");
  console.log("=".repeat(60));
  
  console.log("📝 Instruções:");
  console.log("1. Abra View → Logs da execução mais recente");
  console.log("2. Procure por '🔍 [DEBUG]' para ver logs de debug do ensemble");
  console.log("3. Procure por '⚠️ [AIEnsemble]' para ver warnings");
  console.log("4. Identifique qual IA está falhando (Gemini=0 ou DeepSeek=0)");
  console.log("5. Procure por '[DEBUG _extractScore]' para ver tentativas de parsing");
}

/**
 * Teste 4: Executar robô com logging máximo
 * Execute: teste_robo_full()
 */
function teste_robo_full() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TESTE 4: ROBÔ COMPLETO COM DEBUG");
  console.log("=".repeat(60));
  
  console.log("⏱️ Iniciando execução do robô...");
  console.log("⏰ Isso pode levar 2-5 minutos");
  console.log("");
  
  try {
    executarRoboB3();
    console.log("\n✅ Execução do robô completada");
    console.log("📊 Verificar resultados nos logs do ensemble");
  } catch(e) {
    console.error("❌ Erro durante execução:", e.message);
  }
}

/**
 * Teste 5: Análise de Ensemble com dados reais
 * Execute: teste_ensemble_real()
 */
function teste_ensemble_real() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TESTE 5: ENSEMBLE COM DADOS REAIS (PETR4)");
  console.log("=".repeat(60));
  
  if (!DataService) {
    console.error("❌ DataService não disponível");
    return;
  }
  
  try {
    // Pegar dados de PETR4 usando a API pública atual do DataService
    var data = DataService.getMarketData("PETR4", "1d", "6mo");
    
    if (!data || data.length === 0) {
      console.error("❌ Não conseguiu obter dados de PETR4");
      return;
    }
    
    console.log("✅ Dados obtidos: " + data.length + " candles");
    
    // Executar análise técnica
    if (!STRATEGY_EVALUATE_CORE) {
      console.error("❌ STRATEGY_EVALUATE_CORE não disponível");
      return;
    }
    
    var tech = STRATEGY_EVALUATE_CORE(data, null);
    if (!tech) {
      console.error("❌ STRATEGY_EVALUATE_CORE retornou nulo ou inválido");
      return;
    }
    console.log("📊 Score Técnico: " + tech.score);
    
    // Executar ensemble
    if (!AIEnsemble) {
      console.error("❌ AIEnsemble não disponível");
      return;
    }
    
    var ensemble = AIEnsemble.getEnhancedScore({
      ticker: "PETR4",
      price: data[data.length - 1].close || data[data.length - 1].c || 0,
      score: tech.score,
      indicators: tech.indicators || {}
    });
    
    console.log("\n📋 Resultado do Ensemble:");
    console.log(JSON.stringify(ensemble, null, 2));
    
  } catch(e) {
    console.error("❌ Erro durante teste:", e.message);
  }
}

/**
 * Teste 6: Verificar pesos aplicados
 * Execute: teste_pesos()
 */
function teste_pesos() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TESTE 6: VERIFICAÇÃO DE PESOS");
  console.log("=".repeat(60));
  
  console.log("📋 Pesos Padrão (de 34_AI_Prompts.js):");
  
  // Simular diferentes cenários de entrada
  var cenarios = [
    { g: 0.75, d: 0.80, tech: 0.504, adx: 28, desc: "Ambas IAs OK" },
    { g: 0,    d: 0,    tech: 0.504, adx: 28, desc: "Ambas IAs falharam (BUG ORIGINAL)" },
    { g: 0,    d: 0.80, tech: 0.504, adx: 28, desc: "Apenas Gemini falhou" },
    { g: 0.75, d: 0,    tech: 0.504, adx: 28, desc: "Apenas DeepSeek falhou" }
  ];
  
  console.log("\nCenários de Teste:");
  cenarios.forEach(function(c) {
    var geminiValido = c.g !== 0 && c.g !== null;
    var deepseekValido = c.d !== 0 && c.d !== null;
    
    var pesos = { GEMINI: 0, DEEPSEEK: 0, TECH: 0 };
    
    if (!geminiValido && !deepseekValido) {
      pesos = { GEMINI: 0, DEEPSEEK: 0, TECH: 1.0 };
    } else if (!deepseekValido) {
      pesos = { GEMINI: 0.50, DEEPSEEK: 0, TECH: 0.50 };
    } else if (!geminiValido) {
      pesos = { GEMINI: 0, DEEPSEEK: 0.50, TECH: 0.50 };
    } else {
      pesos = { GEMINI: 0.40, DEEPSEEK: 0.40, TECH: 0.20 };
    }
    
    var score = (pesos.GEMINI * c.g) + (pesos.DEEPSEEK * c.d) + (pesos.TECH * c.tech);
    var scorePercent = Math.round(score * 100);
    var status = scorePercent >= 65 ? "✅ APROVADO" : "❌ REJEITADO";
    
    console.log("\n" + c.desc + ":");
    console.log("  Scores: Gemini=" + c.g.toFixed(2) + " DeepSeek=" + c.d.toFixed(2) + " Tech=" + c.tech.toFixed(2));
    console.log("  Pesos:  Gemini=" + (pesos.GEMINI * 100).toFixed(0) + "% DeepSeek=" + (pesos.DEEPSEEK * 100).toFixed(0) + "% Tech=" + (pesos.TECH * 100).toFixed(0) + "%");
    console.log("  Score Final: " + scorePercent + " " + status);
  });
}

/**
 * Teste 7: Menu Interativo
 * Execute: menu_testes()
 */
function menu_testes() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 MENU DE TESTES - Diagnóstico de Ensemble");
  console.log("=".repeat(60));
  
  console.log("\nOpções disponíveis:");
  console.log("1. teste_ai_basico()        - Verificar se IAs estão respondendo");
  console.log("2. teste_ensemble_mock()    - Testar ensemble com dados mock");
  console.log("3. teste_debug_logs()       - Instruções para analisar logs");
  console.log("4. teste_robo_full()        - Executar robô completo (LENTO)");
  console.log("5. teste_ensemble_real()    - Testar ensemble com PETR4 real");
  console.log("6. teste_pesos()            - Verificar cálculo de pesos");
  console.log("7. menu_testes()            - Mostrar este menu");
  
  console.log("\n\nExemplo de uso:");
  console.log("  No console do Apps Script, copie e execute:");
  console.log("  teste_ai_basico()");
  console.log("\nDepois de executar, abra View → Logs para ver os resultados.");
}

// Função de atalho
function _() {
  menu_testes();
}

// Chamar o menu ao executar o script
// menu_testes(); // Comentado para evitar que o menu de debug polua todos os logs de execução do sistema.
