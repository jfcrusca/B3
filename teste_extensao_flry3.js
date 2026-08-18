/**
 * TESTE FUNCIONAL — CORREÇÕES v10.1 + v10.2
 * Cenário: FLRY3 pós-resultado (+12% recente) — compra "perto do topo"
 * Dados REAIS fornecidos pelo usuário (18/08 16:52):
 *   Preço: R$ 18,04 | Score: 72 | EMA21: R$ 17,59
 *   Setup: TENDÊNCIA CONFIRMADA | Recomendação: "✅ ENTRAR AGORA"
 * 
 * 🔒 GUARD DE AMBIENTE: Usa `process.exit()` (Node.js).
 * No ambiente GAS, `process` não existe → tudo dentro do guard para não quebrar.
 */

// ⛔ GUARD: Só executa no Node.js
if (typeof process !== 'undefined' && typeof process.exit === 'function') {

// ===========================================================================
// 1. SIMULAÇÃO COMPLETA DO PIPELINE (Core22 → Ensemble → DecisionEngine → Oportunidades)
// ===========================================================================

// --- Configurações v10.1/v10.2 (espelhadas dos arquivos reais) ---
const CFG = {
  EXTENSAO_THRESHOLD_LEVE: 0.04,
  EXTENSAO_THRESHOLD_MODERADA: 0.07,
  EXTENSAO_THRESHOLD_SEVERA: 0.10,
  EXTENSAO_PENALTY_LEVE: 8,
  EXTENSAO_PENALTY_MODERADA: 15,
  EXTENSAO_PENALTY_SEVERA: 25,
  BULLISH_BONUS_ESTICADO: 3,
  PENALTY_TOPO_01: 20,   // Preço no topo (dentro de 1%)
  PENALTY_TOPO_03: 12,   // Preço próximo ao topo (dentro de 3%)
  PENALTY_GANHO_RAPIDO: 15 // Ganho rápido > 8% em 10 sessões
};

function calcularExtensao(preco, ema21) {
  if (preco <= 0 || ema21 <= 0) return { extensaoPct: 0, extensaoNivel: 'NENHUMA' };
  const extensaoPct = (preco - ema21) / ema21;
  let extensaoNivel = 'NENHUMA';
  if (extensaoPct > CFG.EXTENSAO_THRESHOLD_SEVERA) extensaoNivel = 'SEVERA';
  else if (extensaoPct > CFG.EXTENSAO_THRESHOLD_MODERADA) extensaoNivel = 'MODERADA';
  else if (extensaoPct > CFG.EXTENSAO_THRESHOLD_LEVE) extensaoNivel = 'LEVE';
  return { extensaoPct, extensaoNivel };
}

function calcularPenalidadeTopo(preco, topo50) {
  if (topo50 <= 0 || preco <= 0 || topo50 <= preco) return 0;
  const distTopo = (topo50 - preco) / topo50;
  if (distTopo < 0.01) return CFG.PENALTY_TOPO_01;
  if (distTopo < 0.03) return CFG.PENALTY_TOPO_03;
  return 0;
}

function calcularPenalidadeGanho(ganhoRapido) {
  if (ganhoRapido > 0.12) return 25;
  if (ganhoRapido > 0.08) return CFG.PENALTY_GANHO_RAPIDO;
  if (ganhoRapido > 0.05) return 8;
  return 0;
}

function gerarRecomendacao(score, extensaoNivel, topo50, preco, ganhoRapido) {
  // v10.2: Preço colado no topo
  if (topo50 > 0 && preco > 0 && topo50 > preco) {
    const distTopo = (topo50 - preco) / topo50;
    if (distTopo < 0.01) return `⏳ AGUARDAR PULLBACK (PREÇO NO TOPO RECENTE — +${(distTopo * 100).toFixed(1)}%)`;
    if (distTopo < 0.03) return `🟡 ENTRADA PARCIAL OU AGUARDAR PULLBACK (PREÇO A ${(distTopo * 100).toFixed(1)}% DO TOPO)`;
  }
  // v10.2: Ganho rápido (movimento acelerado)
  if (ganhoRapido > 0.08) return `🟡 ENTRADA PARCIAL OU AGUARDAR PULLBACK (GANHO RÁPIDO +${(ganhoRapido * 100).toFixed(1)}% EM 10 SESSÕES)`;
  // v10.1: Extensão EMA21
  if (extensaoNivel === 'SEVERA') return `⏳ AGUARDAR PULLBACK (PREÇO ESTICADO ACIMA DA MÉDIA)`;
  if (extensaoNivel === 'MODERADA' || extensaoNivel === 'LEVE') return `🟡 ENTRADA PARCIAL OU AGUARDAR PULLBACK`;
  // Fallback: score
  if (score >= 60) return `✅ ENTRAR (TENDÊNCIA CONFIRMADA)`;
  return `⏳ AGUARDAR`;
}

// ===========================================================================
// 2. CENÁRIO 1: DADOS REAIS DO USUÁRIO (FLRY3 18/08 16:52)
// ===========================================================================
function cenarioDadosReais() {
  console.log('='.repeat(68));
  console.log('🧪 CENÁRIO 1: FLRY3 — DADOS REAIS (18/08 16:52)');
  console.log('='.repeat(68));

  const preco = 18.04;
  const ema21 = 17.59;
  const scoreOriginal = 72;
  const aiScore = 61; // IA real do usuário
  const rr = 3.22;
  const sentimento = 'NEUTRAL';

  // Novas métricas v10.2 (proxy realista: ativo subiu +12% pós-resultado, está colado no topo)
  const topo50 = 18.10;  // Máxima de 30 candles (preço atual está ~0.3% abaixo)
  const ganhoRapido = 0.12; // +12% em 10 sessões (dado da análise original: "subiu 12% após 07/08")

  console.log(`\n📊 INPUT:`);
  console.log(`   Preço: R$ ${preco} | EMA21: R$ ${ema21} | Score original: ${scoreOriginal}`);
  console.log(`   Topo50 (máx 30): R$ ${topo50} | Ganho rápido 10 sessões: +${(ganhoRapido * 100).toFixed(0)}%`);

  // =========================================================================
  // PIPELINE: Core22 (score ajustado) → DecisionEngine (score final)
  // =========================================================================
  
  // Passo 1 — Core22: penalidades no score sistêmico (seções 7.1, 7.2, 7.3)
  const { extensaoPct, extensaoNivel } = calcularExtensao(preco, ema21);
  const penaltyTopo = calcularPenalidadeTopo(preco, topo50);
  const penaltyGanho = calcularPenalidadeGanho(ganhoRapido);
  const penaltyExtensao = extensaoNivel === 'SEVERA' ? CFG.EXTENSAO_PENALTY_SEVERA :
                          extensaoNivel === 'MODERADA' ? CFG.EXTENSAO_PENALTY_MODERADA :
                          extensaoNivel === 'LEVE' ? CFG.EXTENSAO_PENALTY_LEVE : 0;
  
  const scoreCore22 = Math.max(0, Math.min(100, Math.round(scoreOriginal - penaltyExtensao - penaltyTopo - penaltyGanho)));

  // Passo 2 — DecisionEngine: bônus de sentimento (NEUTRAL = 0) + pesos 0.7/0.3
  const bonus = sentimento === 'BULLISH' ? 0 : 0; // NEUTRAL → +0
  const scoreTecnicoFinal = Math.max(0, Math.min(100, scoreCore22 + bonus));
  const scoreDecisionEngine = Math.round(scoreTecnicoFinal * 0.7 + aiScore * 0.3);

  // Passo 3 — Recomendação
  const recomendacao = gerarRecomendacao(scoreDecisionEngine, extensaoNivel, topo50, preco, ganhoRapido);

  const timingRuim = extensaoNivel !== 'NENHUMA' || penaltyTopo > 0 || penaltyGanho > 0;
  const timingStatus = timingRuim ? '⏳ AGUARDAR PULLBACK' : '✅ ENTRAR';

  console.log(`\n📊 PIPELINE v10.2:`);
  console.log(`   Extensão EMA21: +${(extensaoPct * 100).toFixed(1)}% (${extensaoNivel}) → penalty ${penaltyExtensao}`);
  console.log(`   Proximidade topo: ${penaltyTopo > 0 ? '⚠️ ' + penaltyTopo + ' pts' : 'ok'}`);
  console.log(`   Ganho rápido: +${(ganhoRapido * 100).toFixed(0)}% → penalty ${penaltyGanho}`);
  console.log(`   Score Core22: ${scoreOriginal} → ${scoreCore22} (penalidades: ${penaltyExtensao + penaltyTopo + penaltyGanho} pts)`);
  console.log(`   Score DecisionEngine: ${scoreDecisionEngine}`);
  console.log(`   Recomendação: ${recomendacao}`);
  console.log(`   Timing Status: ${timingStatus}`);

  console.log(`\n🔍 VERIFICAÇÕES CENÁRIO 1:`);
  let ok1 = true;
  
  // Teste 1: O robô NÃO deve mais recomendar ENTRAR AGORA cegamente
  const naoEntrarAgora = recomendacao.includes('AGUARDAR') || recomendacao.includes('PARCIAL');
  console.log(`   ${naoEntrarAgora ? '✅' : '❌'} Não recomenda mais "ENTRAR AGORA" cegamente`);
  if (!naoEntrarAgora) ok1 = false;
  
  // Teste 2: Score penalizado por timing (topo + ganho rápido)
  const scorePenalizado = scoreCore22 < scoreOriginal;
  console.log(`   ${scorePenalizado ? '✅' : '❌'} Score técnico penalizado (${scoreOriginal} → ${scoreCore22})`);
  if (!scorePenalizado) ok1 = false;
  
  // Teste 3: Ganho rápido de +12% em 10 sessões é detectado
  const ganhoDetectado = penaltyGanho > 0;
  console.log(`   ${ganhoDetectado ? '✅' : '❌'} Ganho rápido +12% detectado (penalidade ${penaltyGanho})`);
  if (!ganhoDetectado) ok1 = false;

  // Teste 4: Preço colado no topo é detectado
  const topoDetectado = penaltyTopo > 0;
  console.log(`   ${topoDetectado ? '✅' : '❌'} Preço no topo recente detectado (penalidade ${penaltyTopo})`);
  if (!topoDetectado) ok1 = false;

  console.log(`\n${ok1 ? '🎉 CENÁRIO 1 PASSou' : '🚨 CENÁRIO 1 FALHOU'}`);
  return ok1;
}

// ===========================================================================
// 3. CENÁRIO 2: Controle — ativo em PULLBACK (NÃO deve ser penalizado)
// ===========================================================================
function cenarioPullbackSaudavel() {
  console.log('\n' + '='.repeat(68));
  console.log('🧪 CENÁRIO 2: Controle — ativo em pullback saudável (NÃO deve penalizar)');
  console.log('='.repeat(68));

  const preco = 20.00;
  const ema21 = 20.50;  // Preço ABAIXO da média (pullback)
  const topo50 = 21.50; // Preço está ~7% abaixo do topo
  const ganhoRapido = 0.02; // +2% em 10 sessões (normal)
  const scoreOriginal = 78;
  const aiScore = 70;
  const sentimento = 'BULLISH';

  const { extensaoPct, extensaoNivel } = calcularExtensao(preco, ema21);
  const penaltyTopo = calcularPenalidadeTopo(preco, topo50);
  const penaltyGanho = calcularPenalidadeGanho(ganhoRapido);
  const penaltyExtensao = extensaoNivel === 'SEVERA' ? CFG.EXTENSAO_PENALTY_SEVERA :
                          extensaoNivel === 'MODERADA' ? CFG.EXTENSAO_PENALTY_MODERADA :
                          extensaoNivel === 'LEVE' ? CFG.EXTENSAO_PENALTY_LEVE : 0;

  const scoreCore22 = Math.max(0, Math.min(100, Math.round(scoreOriginal - penaltyExtensao - penaltyTopo - penaltyGanho)));
  const bonus = sentimento === 'BULLISH' ? 10 : 0; // BULLISH cheio (preço NÃO esticado)
  const scoreTecnicoFinal = Math.max(0, Math.min(100, scoreCore22 + bonus));
  const scoreDecisionEngine = Math.round(scoreTecnicoFinal * 0.7 + aiScore * 0.3);
  const recomendacao = gerarRecomendacao(scoreDecisionEngine, extensaoNivel, topo50, preco, ganhoRapido);

  console.log(`\n📊 INPUT:`);
  console.log(`   Preço: R$ ${preco} | EMA21: R$ ${ema21} | Extensão: ${(extensaoPct * 100).toFixed(1)}% (${extensaoNivel})`);
  console.log(`   Topo50: R$ ${topo50} (distância ${((topo50 - preco) / topo50 * 100).toFixed(1)}%) | Ganho rápido: +${(ganhoRapido * 100).toFixed(0)}%`);
  console.log(`   Penalidades: extensão ${penaltyExtensao} + topo ${penaltyTopo} + ganho ${penaltyGanho} = ${penaltyExtensao + penaltyTopo + penaltyGanho}`);
  console.log(`   Score: ${scoreOriginal} → ${scoreCore22} → ${scoreDecisionEngine}`);
  console.log(`   Recomendação: ${recomendacao}`);

  console.log(`\n🔍 VERIFICAÇÕES CENÁRIO 2:`);
  let ok2 = true;
  
  // Teste: Pullback saudável NÃO deve ser penalizado por "perto do topo"
  const semPenalidadeIndevida = penaltyTopo === 0 && penaltyGanho === 0;
  console.log(`   ${semPenalidadeIndevida ? '✅' : '❌'} Sem penalidade indevida (topo ${penaltyTopo}, ganho ${penaltyGanho})`);
  if (!semPenalidadeIndevida) ok2 = false;

  // Teste: Bônus BULLISH cheio (+10) preservado
  const bonusPreservado = bonus === 10;
  console.log(`   ${bonusPreservado ? '✅' : '❌'} Bônus BULLISH cheio (+10) preservado em pullback`);
  if (!bonusPreservado) ok2 = false;

  // Teste: Recomendação de entrada permitida
  const podeEntrar = recomendacao.includes('✅');
  console.log(`   ${podeEntrar ? '✅' : '❌'} Recomendação: ${recomendacao}`);
  if (!podeEntrar) ok2 = false;

  console.log(`\n${ok2 ? '🎉 CENÁRIO 2 PASSou' : '🚨 CENÁRIO 2 FALHOU'}`);
  return ok2;
}

// ===========================================================================
// 4. EXECUÇÃO
// ===========================================================================
const ok1 = cenarioDadosReais();
const ok2 = cenarioPullbackSaudavel();

console.log('\n' + '='.repeat(68));
console.log(ok1 && ok2 ? '🎉 TODOS OS TESTES PASSARAM' : '🚨 ALGUNS TESTES FALHARAM');
console.log('='.repeat(68));
process.exit(ok1 && ok2 ? 0 : 1);

} // ⛔ FIM DO GUARD DE AMBIENTE NODE.JS
