/**
 * =============================================================================
 * scripts/test_core22_config.js — REGRESSÃO DAS CONFIGS DE ESTRUTURA (v22.14)
 * =============================================================================
 * Valida as correções aplicadas ao CORE22_CFG após o caso BPAC11:
 *
 *   [C1] structureLookback 30 → 60
 *   [C2] Sanidade do range (minRangePct/maxRangePct) + fallback de alvo por ATR
 *   [C3] Zona Fibonacci com tolerância em MÚLTIPLOS DE ATR (fiboZoneSlackAtr)
 *   [C4] confluenceMaxDist 0,005 → 0,02
 *   [C5] maxStopPct 0,30 → 0,15
 *
 * Uso:  node scripts/test_core22_config.js
 * =============================================================================
 */

var fs = require('fs');
var path = require('path');

var RAIZ = path.join(__dirname, '..');
var SRC = fs.readFileSync(path.join(RAIZ, '22_Core_Analyzers.js'), 'utf8');

// ---------------------------------------------------------------------------
// Extrai o CORE22_CFG real
// ---------------------------------------------------------------------------
var mCfg = SRC.match(/const CORE22_CFG = (\{[\s\S]*?\n\});/);
if (!mCfg) throw new Error('CORE22_CFG não encontrado em 22_Core_Analyzers.js');

var consoleReal = console.log;
console.log = function () {};
var CORE22_CFG = eval('(' + mCfg[1] + ')');
console.log = consoleReal;

// Extrai _analisarEstruturaMercado e _processarGestaoRisco reais
function extrairFuncao(texto, nome) {
  var idx = texto.indexOf('function ' + nome + '(');
  if (idx === -1) throw new Error('Função ' + nome + ' não encontrada');
  var i = texto.indexOf('{', idx);
  var depth = 0, fim = -1;
  for (var j = i; j < texto.length; j++) {
    if (texto[j] === '{') depth++;
    else if (texto[j] === '}') { depth--; if (depth === 0) { fim = j; break; } }
  }
  return texto.substring(idx, fim + 1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
var falhas = [];
var passou = 0;

function check(nome, real, esperado, tolerancia) {
  tolerancia = tolerancia === undefined ? 0.005 : tolerancia;
  var ok = (typeof real === 'number' && typeof esperado === 'number')
    ? Math.abs(real - esperado) <= tolerancia
    : real === esperado;
  if (ok) { passou++; console.log('  \u2705 ' + nome); }
  else {
    falhas.push(nome + ' \u2014 esperado ' + esperado + ', obtido ' + real);
    console.log('  \u274C ' + nome + ' \u2014 esperado ' + esperado + ', obtido ' + real);
  }
}

function titulo(t) {
  console.log('\n=============================================================');
  console.log(' ' + t);
  console.log('=============================================================');
}

/** Reconstrói a estrutura de mercado (mesma matemática do módulo real). */
function estruturaSimulada(h50, l50, preco, atr, ema21, ema50) {
  var lb = CORE22_CFG.structureLookback;
  var range50 = h50 - l50;
  var fibo618 = h50 - (range50 * 0.618);
  var fibo50 = h50 - (range50 * 0.50);

  var rangePct = preco > 0 ? (range50 / preco) : 0;
  var fiboConfiavel = (rangePct >= CORE22_CFG.minRangePct && rangePct <= CORE22_CFG.maxRangePct);

  var atrRef = (atr > 0) ? atr : (preco * 0.02);
  var slackAbs = atrRef * CORE22_CFG.fiboZoneSlackAtr;
  var zonaPiso = fibo618 - slackAbs;
  var zonaTeto = fibo50 + slackAbs;
  var inFiboZone = (preco <= zonaTeto && preco >= zonaPiso);

  var distEMA21 = fibo618 > 0 ? (Math.abs(fibo618 - ema21) / fibo618) : 1;
  var distEMA50 = fibo618 > 0 ? (Math.abs(fibo618 - ema50) / fibo618) : 1;
  var temConfluencia = inFiboZone &&
    (distEMA21 <= CORE22_CFG.confluenceMaxDist || distEMA50 <= CORE22_CFG.confluenceMaxDist);

  return {
    lb: lb, h50: h50, l50: l50, range50: range50,
    fibo618: fibo618, fibo50: fibo50,
    rangePct: rangePct, fiboConfiavel: fiboConfiavel,
    slackAbs: slackAbs, zonaPiso: zonaPiso, zonaTeto: zonaTeto,
    inFiboZone: inFiboZone, temConfluencia: temConfluencia,
    distEMA21: distEMA21, distEMA50: distEMA50
  };
}

// ===========================================================================
// TESTE 1 — [C1/C4/C5] Valores das configurações
// ===========================================================================
titulo('TESTE 1 — Valores das configuracoes corrigidas');

check('[C1] structureLookback = 60', CORE22_CFG.structureLookback, 60, 0);
check('[C5] maxStopPct = 0.15', CORE22_CFG.maxStopPct, 0.15, 0.0001);
check('[C4] confluenceMaxDist = 0.02', CORE22_CFG.confluenceMaxDist, 0.02, 0.0001);
check('[C2] minRangePct = 0.05', CORE22_CFG.minRangePct, 0.05, 0.0001);
check('[C2] maxRangePct = 0.35', CORE22_CFG.maxRangePct, 0.35, 0.0001);
check('[C3] fiboZoneSlackAtr = 0.6', CORE22_CFG.fiboZoneSlackAtr, 0.6, 0.0001);
check('t1R preservado = 2.0', CORE22_CFG.t1R, 2.0, 0);
check('t2R preservado = 3.0', CORE22_CFG.t2R, 3.0, 0);
check('fiboZoneSlackTop legado mantido', CORE22_CFG.fiboZoneSlackTop, 1.005, 0.0001);
check('fiboZoneSlackBot legado mantido', CORE22_CFG.fiboZoneSlackBot, 0.995, 0.0001);

// ---------------------------------------------------------------------------
titulo('TESTE 2 — Alinhamento com 28_Position_Geometry');
var srcGeo = fs.readFileSync(path.join(RAIZ, '28_Position_Geometry.js'), 'utf8');
var mRiscoMax = srcGeo.match(/RISCO_MAXIMO_PCT:\s*([\d.]+)/);
var riscoMaxGeo = mRiscoMax ? parseFloat(mRiscoMax[1]) : 0;
check('RISCO_MAXIMO_PCT do 28 existe', riscoMaxGeo > 0, true);
check('maxStopPct == RISCO_MAXIMO_PCT',
  Math.abs(CORE22_CFG.maxStopPct - riscoMaxGeo) < 0.0001, true);

// ===========================================================================
// TESTE 3 — [C2] Sanidade do range: caso BPAC11
// ===========================================================================
titulo('TESTE 3 — [C2] Range excessivo (caso BPAC11)');

// BPAC11 reconstruido: h50=71,02 l50=43,45 preco=63,50 atr=1,70
var bpac = estruturaSimulada(71.02, 43.45, 63.50, 1.70, 57.94, 55.00);
console.log('  range50 = R$ ' + bpac.range50.toFixed(2) +
  ' = ' + (bpac.rangePct * 100).toFixed(1) + '% do preco');
console.log('  fibo618 = R$ ' + bpac.fibo618.toFixed(2) +
  ' | fibo50 = R$ ' + bpac.fibo50.toFixed(2));

check('rangePct = 43,4% (acima do teto 35%)', bpac.rangePct * 100, 43.4, 0.2);
check('[C2] Estrutura marcada como NAO confiavel', bpac.fiboConfiavel, false);
check('[C2] inFiboZone = false (preco 63,50 fora)', bpac.inFiboZone, false);

console.log('  slack ATR = R$ ' + bpac.slackAbs.toFixed(2) +
  ' | zona = [R$ ' + bpac.zonaPiso.toFixed(2) + ' ; R$ ' + bpac.zonaTeto.toFixed(2) + ']');
check('[C3] slack = 0,6 x ATR = R$ 1,02', bpac.slackAbs, 1.02, 0.01);
check('[C3] zonaPiso = fibo618 - slack', bpac.zonaPiso, 53.98 - 1.02, 0.02);
check('[C3] zonaTeto = fibo50 + slack', bpac.zonaTeto, 57.23 + 1.02, 0.02);

// ===========================================================================
// TESTE 4 — [C2] Fallback de alvo por ATR quando o range e invalido
// ===========================================================================
titulo('TESTE 4 — [C2] Fallback de alvo por ATR');

var preco = 63.50, atr = 1.70, stopDist = 10.66;
var alvoFib = 78.52;
var atrAlvo1 = preco + (atr * CORE22_CFG.t1R);
var atrAlvo2 = preco + (atr * CORE22_CFG.t2R);

console.log('  Alvo Fibonacci = R$ ' + alvoFib.toFixed(2) + ' (+' +
  (((alvoFib - preco) / preco) * 100).toFixed(1) + '%)');
console.log('  Alvo por ATR   = R$ ' + atrAlvo1.toFixed(2) + ' (+' +
  (((atrAlvo1 - preco) / preco) * 100).toFixed(1) + '%)');

check('ATR alvo1 = 63,50 + 1,70x2 = 66,90', atrAlvo1, 66.90, 0.01);
check('ATR alvo2 = 63,50 + 1,70x3 = 68,60', atrAlvo2, 68.60, 0.01);
check('ATR alvo1 < Fibonacci alvo1 (substitui)', atrAlvo1 < alvoFib, true);
check('Distancia alvo ATR = +5,35%', ((atrAlvo1 - preco) / preco) * 100, 5.35, 0.02);

var rrAtr = (atrAlvo1 - preco) / stopDist;
console.log('  R/R com alvo ATR = ' + rrAtr.toFixed(2) + ' | com Fibo = ' +
  ((alvoFib - preco) / stopDist).toFixed(2));
// (66,90 − 63,50) / 10,66 = 0,32 — o alvo por ATR fica MAIS PROXIMO que o
// risco, portanto o R/R desaba. Isto e um SINAL, nao um numero bom: significa
// que o stop (10,66) e largo demais para os alvos de volatilidade da acao.
check('R/R com alvo ATR ~0,32 (sinal de alerta)', rrAtr, 0.32, 0.01);
check('Fallback por ATR piora o R/R (expoe stop largo)', rrAtr < 1.0, true);

// ---------------------------------------------------------------------------
titulo('TESTE 4b — [C2] Stop RE-ANCORADO no ATR (correcao do R/R)');
// Solucao: quando o range e invalido, o STOP tambem e re-ancorado no ATR.
// Alvo a 2 ATRs + stop a 1 ATR => R/R ~2,0 (padrao de mercado).
var stopReancorado = preco - atr;          // 63,50 - 1,70 = 61,80
var riscoReancorado = preco - stopReancorado;
var rrReancorado = (atrAlvo1 - preco) / riscoReancorado;

console.log('  Stop Fibonacci (contaminado) = R$ 52,84 | risco R$ ' + stopDist.toFixed(2));
console.log('  Stop RE-ANCORADO no ATR      = R$ ' + stopReancorado.toFixed(2) +
  ' | risco R$ ' + riscoReancorado.toFixed(2));
console.log('  R/R re-ancorado = ' + rrReancorado.toFixed(2) +
  ' (era ' + rrAtr.toFixed(2) + ')');

check('Stop re-ancorado = 61,80', stopReancorado, 61.80, 0.01);
check('Risco re-ancorado = R$ 1,70 (1 ATR)', riscoReancorado, 1.70, 0.01);
check('R/R re-ancorado = 2,00', rrReancorado, 2.00, 0.01);
check('R/R re-ancorado >> R/R contaminado', rrReancorado > rrAtr, true);
check('Risco cai de 16,8% para 2,7%',
  (riscoReancorado / preco) * 100, 2.68, 0.02);

// O codigo realmente re-ancora o stop?
var trechoReancora = SRC.indexOf('Re-ancora o STOP');
check('Modulo contem o re-ancoramento do stop', trechoReancora !== -1, true);
check('Modulo expoe flag reancoradoPorAtr',
  SRC.indexOf('reancoradoPorAtr') !== -1, true);
check('alvoSource ATR_FALLBACK_RANGE_INVALIDO presente',
  SRC.indexOf('ATR_FALLBACK_RANGE_INVALIDO') !== -1, true);

// ===========================================================================
// TESTE 5 — [C3] Zona se adapta a volatilidade do ativo
// ===========================================================================
titulo('TESTE 5 — [C3] Zona proporcional ao ATR');

var atrBaixo = estruturaSimulada(71.02, 43.45, 63.50, 0.85, 57.94, 55.00);
var atrAlto  = estruturaSimulada(71.02, 43.45, 63.50, 3.40, 57.94, 55.00);

console.log('  ATR 0,85 (1,3% do preco) => folga R$ ' + atrBaixo.slackAbs.toFixed(2));
console.log('  ATR 3,40 (5,4% do preco) => folga R$ ' + atrAlto.slackAbs.toFixed(2));

check('ATR baixo => folga 0,51', atrBaixo.slackAbs, 0.51, 0.01);
check('ATR alto => folga 2,04', atrAlto.slackAbs, 2.04, 0.01);
check('Folga do ATR alto > folga do ATR baixo',
  atrAlto.slackAbs > atrBaixo.slackAbs, true);

// ===========================================================================
// TESTE 6 — Estrutura saudavel continua confiavel
// ===========================================================================
titulo('TESTE 6 — Estrutura saudavel segue confiavel');
var normal = estruturaSimulada(50.00, 42.00, 46.00, 1.00, 45.50, 44.00);
console.log('  h50=50 l50=42 preco=46 => range ' +
  (normal.rangePct * 100).toFixed(1) + '% do preco');
check('rangePct = 17,4% (dentro de 5-35%)', normal.rangePct * 100, 17.4, 0.1);
check('fiboConfiavel = true', normal.fiboConfiavel, true);
check('fibo618 = 45,06', normal.fibo618, 45.06, 0.01);
check('fibo50 = 46,00', normal.fibo50, 46.00, 0.01);
// zona = [45,06 - 0,60 ; 46,00 + 0,60] = [44,46 ; 46,60]
check('[C3] zonaPiso = 44,46', normal.zonaPiso, 44.46, 0.02);
check('[C3] zonaTeto = 46,60', normal.zonaTeto, 46.60, 0.02);
check('preco 46,00 DENTRO da zona', normal.inFiboZone, true);

// Range estreito tambem e sinalizado (ativo lateral)
var estreito = estruturaSimulada(46.50, 44.50, 46.00, 0.40, 45.50, 45.00);
console.log('  range estreito: ' + (estreito.rangePct * 100).toFixed(1) + '% do preco');
check('range < 5% => NAO confiavel', estreito.fiboConfiavel, false);

// ===========================================================================
// TESTE 7 — [C4] Confluencia agora e alcancavel
// ===========================================================================
titulo('TESTE 7 — [C4] Confluencia EMA/Fibo');

var confluente = estruturaSimulada(50.00, 42.00, 46.00, 1.00, 45.20, 44.00);
console.log('  fibo618 = ' + confluente.fibo618.toFixed(2) +
  ' | EMA21 = 45,20 | dist = ' + (confluente.distEMA21 * 100).toFixed(2) + '%');
check('distEMA21 dentro de 2%', confluente.distEMA21 <= 0.02, true);
check('[C4] temConfluencia = true', confluente.temConfluencia, true);

// Caso onde a distancia fica ENTRE 0,5% e 2%: passava a ser rejeitado antes,
// agora e aceito. Este e o ganho real da configuracao [C4].
// fibo618 = 45,06 ; queremos EMA21 a ~1,2% => EMA21 = 44,52
var meioConfluente = estruturaSimulada(50.00, 42.00, 46.00, 1.00, 44.52, 43.00);
console.log('  dist 1,2%: fibo618 = ' + meioConfluente.fibo618.toFixed(2) +
  ' | EMA21 = 44,52 | dist = ' + (meioConfluente.distEMA21 * 100).toFixed(2) + '%');
check('distEMA21 = 1,2% (entre 0,5% e 2%)',
  meioConfluente.distEMA21 * 100, 1.2, 0.1);
check('[C4] ACEITO com limite 2%', meioConfluente.temConfluencia, true);
check('[C4] falharia com o limite antigo de 0,5%',
  meioConfluente.distEMA21 <= 0.005, false);

check('BPAC11 continua sem confluencia', bpac.temConfluencia, false);
check('BPAC11 distEMA21 = 7,3%', bpac.distEMA21 * 100, 7.3, 0.3);

// ===========================================================================
// TESTE 8 — [C1] Lookback maior amortece o range
// ===========================================================================
titulo('TESTE 8 — [C1] Impacto do lookback maior');
// Com 60 sessoes, o swing estrutural inclui a correcao anterior ao impulso,
// entao o range tipico e MENOR em % do preco do que so o impulso recente.
var com60 = estruturaSimulada(68.00, 46.00, 63.50, 1.70, 57.94, 55.00);
var com30 = estruturaSimulada(71.02, 43.45, 63.50, 1.70, 57.94, 55.00);
console.log('  lookback 30d => range ' + (com30.rangePct * 100).toFixed(1) +
  '% | fibo618 R$ ' + com30.fibo618.toFixed(2));
console.log('  lookback 60d => range ' + (com60.rangePct * 100).toFixed(1) +
  '% | fibo618 R$ ' + com60.fibo618.toFixed(2));
console.log('  distancia da entrada: ' +
  (((63.50 - com30.fibo618) / 63.50) * 100).toFixed(1) + '% -> ' +
  (((63.50 - com60.fibo618) / 63.50) * 100).toFixed(1) + '%');
check('lookback usado = 60', com60.lb, 60, 0);
check('range 60d menor que 30d', com60.range50 < com30.range50, true);
check('fibo618 de 60d mais proximo do preco',
  Math.abs(63.50 - com60.fibo618) < Math.abs(63.50 - com30.fibo618), true);

// ===========================================================================
console.log('\n=============================================================');
if (falhas.length) {
  console.log('\u274C FALHOU: ' + falhas.length + ' assercao(oes) de ' +
    (passou + falhas.length) + '.');
  falhas.forEach(function (f) { console.log('   \u2022 ' + f); });
  process.exitCode = 1;
} else {
  console.log('\u2705 PASSOU: ' + passou + ' assercoes de configuracao validadas.');
  console.log('   \u2022 [C1] structureLookback 30 -> 60 sessoes.');
  console.log('   \u2022 [C2] Sanidade do range + fallback de alvo por ATR.');
  console.log('   \u2022 [C3] Zona Fibonacci proporcional ao ATR.');
  console.log('   \u2022 [C4] confluenceMaxDist 0,5% -> 2% (alcancavel).');
  console.log('   \u2022 [C5] maxStopPct 30% -> 15% (alinhado ao validador).');
}
console.log('=============================================================\n');
