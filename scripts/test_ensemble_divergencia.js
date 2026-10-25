/**
 * Harness offline do CONSENSO/DIVERGÊNCIA do AIEnsemble (08_AI_Ensemble.js).
 *
 * Cobre as duas regressões reais encontradas no log de produção (25/10/2026):
 *
 *  BUG 3 (v10.4) — a penalidade por divergência era aplicada em `finalScore`,
 *    mas quem propaga para o Sentinela é `aiScore` (derivado de `iaConsenso`
 *    ANTES da penalidade). Resultado: punição descartada.
 *    Log real: ITUB4 Gemini 82 / DeepSeek 35 → consenso 73 → ai_score=73
 *    chegava intacto ao Sentinela, que aprovava com score 100.
 *    Esperado agora: aiScore=62 (73 * 0.85 = 62,05).
 *
 *  BUG 2 (v10.5) — o bloco "Conflito extremo de convicção... Vetando operação"
 *    marcava `conflitoBloqueante`, que zerava `rejected` — mas o Sentinela NÃO
 *    consome esse `rejected`; ele reavalia cada ativo no seu próprio
 *    DecisionEngine (#34). O log prometia um veto que nunca era aplicado.
 *    Esperado agora: nenhum veto próprio; a punição vai para o consenso.
 *
 * Os pesos usados abaixo são os REAIS de `_ajustarPesosDinamicos`
 * (ADX>25 → Gemini 0.60 / DeepSeek 0.15), não pesos iguais.
 */

var fs = require('fs');
var path = require('path');

var ARQUIVO = path.join(__dirname, '..', '08_AI_Ensemble.js');
var src = fs.readFileSync(ARQUIVO, 'utf8');

var falhas = [];
function checar(cond, msg) { if (!cond) falhas.push(msg); }

// ---------------------------------------------------------------------------
// 1. CONTRATO ESTÁTICO — garante que a correção não seja revertida por engano
// ---------------------------------------------------------------------------
// Remove comentários para não casar com o próprio texto explicativo da correção.
var srcSemComentarios = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

(function validarContratoEstatico() {
  checar(srcSemComentarios.indexOf('conflitoBloqueante') === -1,
    'conflitoBloqueante ainda é ativado (Bug 2 regrediu: log de veto falso de volta)');

  checar(/var rejected = finalScore < threshold;/.test(srcSemComentarios),
    'gate de `rejected` não é mais apenas por score (Bug 2 regrediu)');

  // Gate não pode voltar a considerar o conflito de IA.
  checar(!/rejected\s*=\s*[^;]*conflito/i.test(srcSemComentarios),
    'gate de `rejected` voltou a incluir a flag de conflito (Bug 2 regrediu)');

  // A penalidade PRECISA recalcular scoreIA depois de aplicar o multiplicador.
  var idxPenal = srcSemComentarios.indexOf('iaConsenso *= 0.85');
  checar(idxPenal !== -1, 'penalidade de divergência forte (0.85) não encontrada');
  if (idxPenal !== -1) {
    var trecho = srcSemComentarios.substring(idxPenal, idxPenal + 1500);
    checar(/scoreIA = Math\.max\(0, Math\.min\(100, Math\.round\(iaConsenso\)\)\);/.test(trecho),
      'scoreIA não é recalculado após a penalidade (Bug 3 regrediu)');
    checar(/finalScore = iaConsenso;/.test(trecho),
      'finalScore não é sincronizado com iaConsenso após a penalidade');
  }
})();


// ---------------------------------------------------------------------------
// 2. SIMULAÇÃO NUMÉRICA — replica a cadeia de cálculo do 08_
// ---------------------------------------------------------------------------
/**
 * Pesos REAIS de `_ajustarPesosDinamicos` (regime macro NEUTRAL/DEFENSIVE).
 *   ADX > 25 → Gemini 0.60 / DeepSeek 0.15
 *   ADX < 20 → Gemini 0.15 / DeepSeek 0.60
 *   senão    → Gemini 0.35 / DeepSeek 0.35
 * @param {number} adx
 * @returns {{G:number, D:number}}
 */
function pesosPorAdx(adx) {
  if (adx > 25) return { G: 0.60, D: 0.15 };
  if (adx < 20) return { G: 0.15, D: 0.60 };
  return { G: 0.35, D: 0.35 };
}

/**
 * Replica exatamente a cadeia: iaConsenso → diff → penalidade → scoreIA.
 * @param {number} gS score Gemini (0-100)
 * @param {number} dS score DeepSeek (0-100)
 * @param {string} regime regime macro efetivo
 * @param {number} techScore score técnico de referência
 * @param {number} adx ADX do ativo (define os pesos)
 * @returns {{consensoBruto:number, diff:number, aiScore:number, fator:number}}
 */
function simular(gS, dS, regime, techScore, adx) {
  var w = pesosPorAdx(adx);
  var total = w.G + w.D;
  var iaConsenso = ((w.G * gS) + (w.D * dS)) / total;
  var consensoBruto = iaConsenso;          // valor que VAZAVA antes do fix
  var diff = Math.abs(gS - dS);
  var fator = 1.0;

  if (diff > 35) {
    fator = 0.85;
  } else if (diff > 20) {
    fator = (regime === 'BEARISH' && techScore >= 70) ? 0.95 : 0.90;
  }
  iaConsenso *= fator;
  var aiScore = Math.max(0, Math.min(100, Math.round(iaConsenso)));

  return {
    consensoBruto: Math.round(consensoBruto),
    diff: diff,
    aiScore: aiScore,
    fator: fator
  };
}

// Casos extraídos do log de produção de 25/10/2026.
// Formato: [ticker, Gemini, DeepSeek, regime, techRef, ADX, consensoBrutoEsperado, aiScoreEsperado]
// O ADX define os pesos (ver pesosPorAdx) — é o que explica CMIG4 ter consenso 47
// com G=35/D=58: ADX 20.04 cai na faixa de transição (0.35/0.35).
var CASOS = [
  ['ITUB4',  82, 35, 'NEUTRAL', 95, 32.62, 73, 62],  // diff 47 → 0.85 → 62,05 → 62
  ['BBAS3',  85, 35, 'NEUTRAL', 95, 29.24, 75, 64],  // diff 50 → 0.85 → 63,75 → 64
  ['BBDC4',  65, 35, 'NEUTRAL', 95, 30.29, 59, 53],  // diff 30 → 0.90 → 53,10 → 53
  ['VIVA3',  65, 35, 'NEUTRAL', 95, 32.45, 59, 53],  // diff 30 → 0.90 → 53,10 → 53
  ['SBSP3',  85, 78, 'NEUTRAL', 95, 30.45, 84, 84],  // diff  7 → sem penalidade
  ['TAEE11', 55, 58, 'NEUTRAL', 95, 38.56, 56, 56],  // diff  3 → sem penalidade
  ['HYPE3',  85, 35, 'NEUTRAL', 95, 34.58, 75, 64],  // diff 50 → 0.85
  ['SAPR11', 88, 35, 'NEUTRAL', 95, 29.80, 77, 66],  // diff 53 → 0.85 → 66,30 → 66
  ['CMIG4',  35, 58, 'NEUTRAL', 77, 20.04, 47, 42],  // ADX transição 0.35/0.35; diff 23 → 0.90
  ['ISAE4',  45, 35, 'NEUTRAL', 87, 27.94, 43, 43]   // diff 10 → sem penalidade
];

CASOS.forEach(function (c) {
  var tk = c[0], gS = c[1], dS = c[2], regime = c[3], tech = c[4], adx = c[5];
  var brutoEsp = c[6], aiEsp = c[7];
  var r = simular(gS, dS, regime, tech, adx);

  checar(r.consensoBruto === brutoEsp,
    tk + ': consenso bruto ' + r.consensoBruto + ' != log real ' + brutoEsp);
  checar(r.aiScore === aiEsp,
    tk + ': aiScore ' + r.aiScore + ' != esperado ' + aiEsp +
    ' (bruto=' + r.consensoBruto + ', fator=' + r.fator + ')');
});

console.log('--- Casos de produção (25/10) ---');
CASOS.forEach(function (c) {
  var r = simular(c[1], c[2], c[3], c[4], c[5]);
  var marca = r.fator === 1.0 ? '(sem penalidade)' : '(x' + r.fator + ')';
  console.log('  ' + c[0] + ': G=' + c[1] + ' D=' + c[2] + ' ADX=' + c[5] +
    ' → bruto=' + r.consensoBruto + ' ' + marca + ' → aiScore=' + r.aiScore);
});

// ---------------------------------------------------------------------------
// 3. FRONTEIRAS — os limiares 20 e 35 não podem ter histerese
// ---------------------------------------------------------------------------
(function validarFronteiras() {
  // diff EXATAMENTE 20 → não penaliza (condição é `> 20`)
  var r20 = simular(70, 50, 'NEUTRAL', 90, 30);
  checar(r20.fator === 1.0, 'diff=20 deveria ficar sem penalidade, aplicou ' + r20.fator);

  // diff EXATAMENTE 35 → cai na faixa moderada (condição é `> 35`)
  var r35 = simular(70, 35, 'NEUTRAL', 90, 30);
  checar(r35.fator === 0.90, 'diff=35 deveria aplicar 0.90, aplicou ' + r35.fator);

  // diff 36 → penalidade forte
  var r36 = simular(71, 35, 'NEUTRAL', 90, 30);
  checar(r36.fator === 0.85, 'diff=36 deveria aplicar 0.85, aplicou ' + r36.fator);

  // Regime BEARISH + técnico alto → penalidade atenuada (0.95)
  var rBear = simular(65, 35, 'BEARISH', 85, 30);
  checar(rBear.fator === 0.95, 'BEARISH + tech>=70 deveria atenuar para 0.95, aplicou ' + rBear.fator);

  // Regime BEARISH + técnico baixo → penalidade padrão (0.90)
  var rBearBaixo = simular(65, 35, 'BEARISH', 60, 30);
  checar(rBearBaixo.fator === 0.90, 'BEARISH + tech<70 deveria usar 0.90, aplicou ' + rBearBaixo.fator);

  // Sanidade dos pesos por ADX (regressão silenciosa nos pesos mudaria tudo)
  var wForte = pesosPorAdx(30), wLateral = pesosPorAdx(15), wTrans = pesosPorAdx(22);
  checar(wForte.G === 0.60 && wForte.D === 0.15, 'ADX>25 deveria ser 0.60/0.15');
  checar(wLateral.G === 0.15 && wLateral.D === 0.60, 'ADX<20 deveria ser 0.15/0.60');
  checar(wTrans.G === 0.35 && wTrans.D === 0.35, 'ADX 20-25 deveria ser 0.35/0.35');
})();

// ---------------------------------------------------------------------------
// 4. IMPACTO NO DECISION ENGINE (ScorePolicy: final = tecnico + ajusteIA)
// ---------------------------------------------------------------------------
(function validarImpactoNoSentinela() {
  // ScorePolicy: ajuste = round(clamp((aiScore - 50) * 0.30, -15, +15))
  function ajusteIA(aiScore) {
    return Math.round(Math.min(15, Math.max(-15, (aiScore - 50) * 0.30)));
  }

  // Antes do fix, ITUB4 chegava ao Sentinela com 73 → ajuste +7 → 95 + 7 = 100 (teto).
  var antes = ajusteIA(73);
  // Depois do fix, chega com 62 → ajuste +4.
  var depois = ajusteIA(62);

  checar(antes === 7, 'ajuste para aiScore=73 deveria ser +7 (valor pré-fix), é ' + antes);
  checar(depois === 4, 'ajuste para aiScore=62 deveria ser +4 (valor pós-fix), é ' + depois);
  checar(depois < antes, 'a penalidade deve REDUZIR o ajuste de IA no Sentinela');

  console.log('\n--- Impacto no Sentinela (ScorePolicy) ---');
  console.log('  ITUB4 antes:  aiScore=73 → ajuste +' + antes + ' → técnico 95 → 100');
  console.log('  ITUB4 depois: aiScore=62 → ajuste +' + depois + ' → técnico 95 → 99');
})();

// ---------------------------------------------------------------------------
// RESULTADO
// ---------------------------------------------------------------------------
console.log('\n=== RESULTADO ===');
if (falhas.length === 0) {
  console.log('✅ TODAS AS VERIFICAÇÕES PASSARAM');
} else {
  console.log('❌ FALHAS:');
  falhas.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}

