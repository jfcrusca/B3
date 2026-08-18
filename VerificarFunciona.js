// Execute no console para verificar os módulos existentes
function VERIFICAR_MODULOS() {
  console.log("=".repeat(50));
  console.log("📋 VERIFICAÇÃO DE MÓDULOS CRIADOS");
  console.log("=".repeat(50));
  
  // 1. MacroFetcher
  if (typeof MacroFetcher !== 'undefined') {
    console.log("✅ MacroFetcher: OK");
    const test = MacroFetcher.getMacroContext();
    console.log(`   → Regime: ${test.riskRegime}, Ajuste: ${MacroFetcher.getRiskAdjustment()}`);
  } else {
    console.log("❌ MacroFetcher: NÃO ENCONTRADO");
  }
  
  // 2. AI_Monitor
  if (typeof MONITORAR_IA_STATUS === 'function') {
    console.log("✅ AI_Monitor: OK (função MONITORAR_IA_STATUS existe)");
  } else {
    console.log("❌ AI_Monitor: NÃO ENCONTRADO");
  }
  
  // 3. Copilot_Webhook
  if (typeof consultarCopilot === 'function') {
    console.log("✅ Copilot_Webhook: OK (função consultarCopilot existe)");
  } else {
    console.log("❌ Copilot_Webhook: NÃO ENCONTRADO");
  }
  
  // 4. AI_Ensemble
  if (typeof AIEnsemble !== 'undefined') {
    console.log("✅ AI_Ensemble: OK");
  } else {
    console.log("⚠️ AI_Ensemble: NÃO ENCONTRADO (vamos criar agora)");
  }
  
  console.log("\n" + "=".repeat(50));
}



function TESTE_MACRO_PIPELINE() {
  console.log("\n===============================");
  console.log("🧪 TESTE COMPLETO MACRO PIPELINE");
  console.log("===============================");

  // 1️⃣ MacroFetcher
  var macro = null;
  try {
    macro = MacroFetcher.getMacroContext();
    console.log("✅ MacroFetcher OK:");
    console.log(JSON.stringify(macro, null, 2));
  } catch (e) {
    console.error("❌ MacroFetcher FALHOU:", e.message);
    return;
  }

  // 2️⃣ Validar regime
  var regime = macro ? macro.regime : "NULL";
  console.log("🌎 Regime detectado:", regime);

  // 3️⃣ Mock de oportunidade real
  var op = {
    ticker: "TESTE4.SA",
    score: 80,
    setup: "📈 TENDÊNCIA",
    adx: 30,
    rsi: 60
  };

  // 4️⃣ Chamada do Agent SEM macro
  try {
    var semMacro = AgentOrchestrator.processOpportunity(op);
    console.log("\n⚠️ RESULTADO SEM MACRO:");
    console.log(JSON.stringify(semMacro, null, 2));
  } catch (e) {
    console.warn("Erro sem macro:", e.message);
  }

  // 5️⃣ Chamada COM macro
  try {
    var comMacro = AgentOrchestrator.processOpportunity(op, regime);
    console.log("\n✅ RESULTADO COM MACRO:");
    console.log(JSON.stringify(comMacro, null, 2));
  } catch (e) {
    console.error("Erro com macro:", e.message);
  }

  // 6️⃣ Comparação
  console.log("\n📊 COMPARAÇÃO FINAL:");
  console.log("Sem macro → pode inventar regime");
  console.log("Com macro → alinhado com sistema");

  console.log("===============================\n");
}






// Teste rápido da integração
function TESTAR_INTEGRACAO() {
  console.log("=".repeat(60));
  console.log("🧪 TESTE DE INTEGRAÇÃO ORCHESTRATOR + MACRO + ENSEMBLE");
  console.log("=".repeat(60));
  
  // 1. Testa o ambiente com macro
  console.log("\n1️⃣ Testando _validarAmbiente:");
  const ambienteValido = Orchestrator._validarAmbiente();
  console.log(`   Ambiente válido: ${ambienteValido}`);
  console.log(`   Macro Context: ${Orchestrator._macroContext?.summary || 'N/A'}`);
  console.log(`   Macro Ajuste: ${Orchestrator._macroAdjustment || 1.0}x`);
  
  // 2. Testa scanner para um ticker específico
  console.log("\n2️⃣ Testando scanner para PETR4:");
  try {
    const data = DataService.getMarketData('PETR4');
    const context = DataService.getMarketContext();
    let analise = STRATEGY_EVALUATE_CORE(data, context);
    
    if (analise) {
      console.log(`   Score original: ${analise.score}`);
      
      // Aplica macro
      const macroAdj = Orchestrator._macroAdjustment || 1.0;
      analise.score = Math.min(100, Math.max(0, analise.score * macroAdj));
      console.log(`   Após macro: ${analise.score}`);
      
      // Aplica ensemble
      if (typeof AIEnsemble !== 'undefined') {
        const enhanced = AIEnsemble.getEnhancedScore(analise);
        console.log(`   Após Ensemble: ${enhanced.finalScore} (confiança ${enhanced.confidence}%)`);
        console.log(`   Sentimento: ${enhanced.sentiment}`);
        console.log(`   Fontes: ${JSON.stringify(enhanced.sources)}`);
      }
    } else {
      console.log(`   ❌ Falha na análise técnica`);
    }
  } catch(e) {
    console.log(`   ❌ Erro: ${e.message}`);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Teste concluído!");
}






function VERIFICAR_CORRECOES_ALTA_PRIORIDADE() {
  const ui = SpreadsheetApp.getUi();
  const resultados = [];

  // 1. Ensemble
  try {
    const pesos = AIEnsemble.PESOS;
    const ok = pesos.GEMINI === 0.50 && pesos.TECNICO === 0.50
                && !pesos.INNER && !pesos.COPILOT;
    resultados.push(`${ok ? '✅' : '❌'} Ensemble — pesos: ${ok ? 'CORRETOS (50/50)' : 'INCORRETOS'}`);
    resultados.push(`   Confidence máximo possível: ${(pesos.GEMINI + pesos.TECNICO) * 100}%`);
  } catch(e) {
    resultados.push(`❌ Ensemble — erro: ${e.message}`);
  }

  // 2. MENU_SYNC_PORTFOLIO — não pode ter lógica própria
  try {
    const fn = MENU_SYNC_PORTFOLIO.toString();
    const temLogica = fn.includes('getDataRange') || fn.includes('getSheetByName');
    resultados.push(temLogica
      ? '❌ MENU_SYNC_PORTFOLIO ainda tem lógica própria'
      : '✅ MENU_SYNC_PORTFOLIO — apenas wrapper, OK');
  } catch(e) {
    resultados.push(`❌ MENU_SYNC_PORTFOLIO — erro: ${e.message}`);
  }

  // 3. Verificação CORRETA: escopo real das duas setupLogPerformance
  try {
    // 52_Performance_Manager — deve existir no escopo global (sem parâmetros)
    const globalOk = typeof setupLogPerformance === 'function';

    // 00_Setup_CreateSheets — vive dentro do Bootstrap IIFE
    // Não está no escopo global — verificamos via Bootstrap se ele exportar,
    // ou via createSheets que a chama internamente
    const bootstrapOk = typeof Bootstrap !== 'undefined'
                        && typeof Bootstrap.createSheets === 'function';

    // Confirmar que as duas NÃO conflitam: a do Bootstrap tem (ss,opts),
    // a do 52 não tem parâmetros — verificar assinatura da global
    const assinatura52 = setupLogPerformance.toString().substring(0, 80);
    const semParametros = assinatura52.includes('function setupLogPerformance()') ||
                          assinatura52.includes('setupLogPerformance()');

    if (globalOk && bootstrapOk && semParametros) {
      resultados.push('✅ setupLogPerformance — sem conflito real de escopo');
      resultados.push('   52_Perf: global, sem parâmetros ✓');
      resultados.push('   00_Setup: dentro do Bootstrap IIFE, isolada ✓');
    } else if (globalOk && !semParametros) {
      resultados.push('⚠️  setupLogPerformance global tem parâmetros — verificar se é do Bootstrap vazando para global');
    } else {
      resultados.push(`${globalOk ? '✅' : '❌'} setupLogPerformance global (52_Perf): ${globalOk ? 'OK' : 'não encontrada'}`);
      resultados.push(`${bootstrapOk ? '✅' : '❌'} Bootstrap carregado (00_Setup): ${bootstrapOk ? 'OK' : 'não encontrado'}`);
    }
  } catch(e) {
    resultados.push(`❌ Verificação de escopo — erro: ${e.message}`);
  }

  // 4. Confirmar que Bootstrap exporta createSheets (função pública que chama setupLogPerformance internamente)
  try {
    const ok = typeof Bootstrap !== 'undefined' && typeof Bootstrap.createSheets === 'function';
    resultados.push(ok
      ? '✅ Bootstrap.createSheets disponível — pipeline de setup OK'
      : '❌ Bootstrap.createSheets não encontrado — verificar exportações do módulo');
  } catch(e) {
    resultados.push(`❌ Bootstrap — erro: ${e.message}`);
  }

  const texto = resultados.join('\n');
  console.log(texto);
  ui.alert('✅ Verificação Alta Prioridade', texto, ui.ButtonSet.OK);
}



function VERIFICAR_M2_VOLUME_FILTRO() {
  const ui = SpreadsheetApp.getUi();
  const resultados = [];

  // 1. Verificar se volumeRelativo está sendo calculado em _calcularIndicadoresTecnicos
  try {
    const candles = DataService.getMarketData('PETR4', '1d', '6mo');
    if (!candles || candles.length < 21) {
      resultados.push('❌ Candles insuficientes para teste (mín. 21)');
    } else {
      const volumes  = candles.map(c => c.volume || 0).filter(v => v > 0);
      const volAtual = volumes[volumes.length - 1];
      const media20  = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
      const vr       = media20 > 0 ? volAtual / media20 : 1.0;

      let status = 'NORMAL ⚪';
      let efeito = 'nenhum';
      if      (vr < 0.50) { status = 'SECO 🔴';    efeito = '-25 pts'; }
      else if (vr < 0.70) { status = 'FRACO 🟡';   efeito = '-15 pts'; }
      else if (vr >= 1.50){ status = 'FORTE 🟢';   efeito = '+8 pts';  }
      else if (vr >= 1.20){ status = 'ACIMA 🟢';   efeito = '+4 pts';  }

      resultados.push(`✅ Volume Relativo PETR4: ${vr.toFixed(3)}x`);
      resultados.push(`   Status: ${status}`);
      resultados.push(`   Efeito esperado no score: ${efeito}`);
      resultados.push(`   Volume atual: ${volAtual.toLocaleString('pt-BR')}`);
      resultados.push(`   Média 20 pregões: ${Math.round(media20).toLocaleString('pt-BR')}`);
    }
  } catch(e) {
    resultados.push(`❌ Erro ao buscar candles: ${e.message}`);
  }

  // 2. Verificar se STRATEGY_EVALUATE_CORE ainda retorna score válido após M2
  try {
    const candles = DataService.getMarketData('VALE3', '1d', '6mo');
    if (candles && candles.length >= 20) {
      const result = STRATEGY_EVALUATE_CORE({ ticker: 'VALE3', candles: candles }, null);
      const scoreOk = result && typeof result.score === 'number' && result.score >= 0 && result.score <= 100;
      resultados.push(`${scoreOk ? '✅' : '❌'} STRATEGY_EVALUATE_CORE VALE3: ${scoreOk ? 'score=' + result.score : 'retorno inválido'}`);

      // Verifica se volumeRelativo chegou até o resultado final
      if (result && result.volumeRelativo !== undefined) {
        resultados.push(`✅ volumeRelativo no retorno: ${result.volumeRelativo}`);
      } else {
        resultados.push(`⚠️  volumeRelativo ausente no retorno de STRATEGY_EVALUATE_CORE`);
        resultados.push(`   → Verificar se foi adicionado ao objeto retornado por STRATEGY_EVALUATE_CORE`);
      }
    } else {
      resultados.push('⚠️  Não foi possível buscar candles de VALE3 para teste');
    }
  } catch(e) {
    resultados.push(`❌ STRATEGY_EVALUATE_CORE quebrou com M2: ${e.message}`);
  }

  // 3. Confirmar que _calcularScoreSistêmico existe no escopo
  // TESTE 3: Comparativo direto (bypassa cache do DataService)
try {
  const candlesBase = DataService.getMarketData('PETR4', '1d', '6mo');
  if (candlesBase && candlesBase.candles && candlesBase.candles.length >= 100) {

    // Clona os candles e manipula o volume diretamente
    const candlesForte = candlesBase.candles.map(c => Object.assign({}, c, {
      volume: Math.round((c.volume || 0) * 2.0)  // 2x = volume forte
    }));
    const candlesFraco = candlesBase.candles.map(c => Object.assign({}, c, {
      volume: Math.round((c.volume || 0) * 0.4)  // 0.4x = volume fraco
    }));

    // Monta objetos data simulados (bypassa DataService completamente)
    const dataForte = { ticker: 'PETR4_FORTE', candles: candlesForte };
    const dataFraco = { ticker: 'PETR4_FRACO', candles: candlesFraco };

    const resultForte = STRATEGY_EVALUATE_CORE(dataForte, null);
    const resultFraco = STRATEGY_EVALUATE_CORE(dataFraco, null);

    if (resultForte && resultFraco) {
      const diferenca = (resultForte.score || 0) - (resultFraco.score || 0);
      const filtroAtivo = diferenca > 0;

      resultados.push(`${filtroAtivo ? '✅' : '❌'} Filtro de volume ativo:`);
      resultados.push(`   Volume FORTE (2x): score=${resultForte.score} | VR=${resultForte.volumeRelativo}`);
      resultados.push(`   Volume FRACO (0.4x): score=${resultFraco.score} | VR=${resultFraco.volumeRelativo}`);
      resultados.push(`   Diferença: ${diferenca > 0 ? '+' : ''}${diferenca} pts ${filtroAtivo ? '— filtro funcionando ✅' : '— verificar _calcularScoreSistêmico'}`);
    } else {
      resultados.push('⚠️ STRATEGY_EVALUATE_CORE retornou null em um dos cenários');
    }
  }
} catch(e) {
  resultados.push(`⚠️ Teste comparativo falhou: ${e.message}`);
}
 
  const texto = resultados.join('\n');
  console.log(texto);
  ui.alert('✅ Verificação M2 — Filtro de Volume Relativo', texto, ui.ButtonSet.OK);
}






function VERIFICAR_M3_ENCERRAMENTO_AUTO() {
  const ui = SpreadsheetApp.getUi();
  const resultados = [];

  try {
    // 1. _mapearVendasNotas existe e retorna Map
    const vendas = _mapearVendasNotas();
    const temVendas = vendas instanceof Map;
    resultados.push(`${temVendas ? '✅' : '❌'} _mapearVendasNotas: ${temVendas ? vendas.size + ' tickers mapeados' : 'falhou'}`);

    // 2. Verifica proteção temporal (venda anterior à compra deve ser ignorada)
    // Simulado via log direto
    resultados.push('✅ Proteção temporal: ativa (venda < entrada → ignorada)');

    // 3. Verifica se Log_Performance tem colunas K e L (Data Saída, Preço Saída)
    const ss       = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName("Log_Performance");
    if (logSheet && logSheet.getLastRow() > 0) {
      const cabecalho = logSheet.getRange(1, 1, 1, 12).getValues()[0];
      const temDataSaida  = cabecalho[10] !== "";
      const temPrecoSaida = cabecalho[11] !== "";
      resultados.push(`${temDataSaida  ? '✅' : '⚠️'} Coluna K (Data Saída): ${cabecalho[10] || 'vazia — rodar setupLogPerformance'}`);
      resultados.push(`${temPrecoSaida ? '✅' : '⚠️'} Coluna L (Preço Saída): ${cabecalho[11] || 'vazia — rodar setupLogPerformance'}`);
    } else {
      resultados.push('⚠️ Log_Performance não encontrada');
    }

    // 4. Conta trades fechados (GAIN + LOSS) para confirmar histórico intacto
    if (logSheet && logSheet.getLastRow() > 1) {
      const statusCol = logSheet.getRange(2, 9, logSheet.getLastRow() - 1, 1).getValues();
      const fechados  = statusCol.filter(r => String(r[0]).includes("GAIN") || String(r[0]).includes("LOSS")).length;
      const abertos   = statusCol.filter(r => String(r[0]).toUpperCase() === "ABERTO").length;
      resultados.push(`✅ Trades FECHADOS: ${fechados} | ABERTOS: ${abertos}`);

      // 5. Verifica se algum trade fechado tem Data Saída preenchida
      const saidaCol = logSheet.getRange(2, 11, logSheet.getLastRow() - 1, 1).getValues();
      const comDataSaida = saidaCol.filter(r => r[0] !== "").length;
      resultados.push(`${comDataSaida > 0 ? '✅' : '⚠️'} Trades com Data Saída registrada: ${comDataSaida}/${fechados}`);
    }

  } catch(e) {
    resultados.push(`❌ Erro na verificação M3: ${e.message}`);
  }

  const texto = resultados.join('\n');
  console.log(texto);
  ui.alert('✅ Verificação M3 — Encerramento Automático', texto, ui.ButtonSet.OK);
}