
/**
 * Script de Teste para Normalização de Score IA (v2.0)
 */
function TESTE_NORMALIZACAO_SCORE() {
  console.log("🧪 Iniciando Bateria de Testes: Normalização de Score IA");
  
  var casos = [
    { in: 0.72, expected: 72, desc: "Escala 0-1 (Bullish)" },
    { in: 72, expected: 72, desc: "Escala 0-100 (Bullish)" },
    { in: 0.35, expected: 35, desc: "Escala 0-1 (Bearish)" },
    { in: 35, expected: 35, desc: "Escala 0-100 (Bearish)" },
    { in: 1, expected: 100, desc: "Caso Crítico: 1 (Deve ser 100)" },
    { in: 1.0, expected: 100, desc: "Caso Crítico: 1.0 (Deve ser 100)" },
    { in: 100, expected: 100, desc: "Escala 0-100 (Max)" },
    { in: 0, expected: 0, desc: "Zero absoluto" },
    { in: null, expected: null, desc: "Nulo" },
    { in: undefined, expected: null, desc: "Undefined" },
    { in: "0.85", expected: 85, desc: "String 0-1" },
    { in: "85", expected: 85, desc: "String 0-100" },
    { in: { score: 0.95 }, expected: 95, desc: "Objeto {score: 0.95}" },
    { in: { ai_score: 95 }, expected: 95, desc: "Objeto {ai_score: 95}" },
    { in: 150, expected: 100, desc: "Fora de escala (Clamp Max)" },
    { in: -10, expected: 0, desc: "Fora de escala (Clamp Min)" }
  ];

  var falhas = 0;
  var report = "# 📊 RELATÓRIO DE TESTES DE NORMALIZAÇÃO\n\n";
  report += "| Descrição | Entrada | Esperado | Resultado | Status |\n";
  report += "|-----------|---------|----------|-----------|--------|\n";

  // Verificação de segurança
  if (typeof AIEnsemble === 'undefined' || typeof AIEnsemble.normalizeAIScore !== 'function') {
    console.error("❌ ERRO CRÍTICO: AIEnsemble.normalizeAIScore não está disponível para o script de teste.");
    return "ERRO: normalizeAIScore não exportado";
  }

  casos.forEach(function(c) {
    var res = AIEnsemble.normalizeAIScore(c.in, "TEST_SUITE");
    var status = (res === c.expected) ? "✅ PASS" : "❌ FAIL";
    if (res !== c.expected) falhas++;
    
    report += "| " + c.desc + " | " + JSON.stringify(c.in) + " | " + c.expected + " | " + res + " | " + status + " |\n";
  });

  console.log(report);
  
  if (falhas === 0) {
    console.log("✅ Todos os testes passaram!");
  } else {
    console.error("❌ " + falhas + " testes falharam.");
  }
  
  return report;
}
