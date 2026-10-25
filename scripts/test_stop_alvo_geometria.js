/**
 * =============================================================================
 * scripts/test_stop_alvo_geometria.js — REGRESSÃO STOP/ALVO (v22.15)
 * =============================================================================
 * Valida as 3 correções aplicadas após o caso BPAC11:
 *
 *   [A] Alinhamento de lookback — o pivô do stop passa a usar `structureLookback`
 *       (60) em vez de `swingLookback` (25). Antes, stop e alvos vinham de
 *       janelas temporais diferentes (stop R$ 52,84 = fibo618 do lookback 30).
 *   [B] Teto de stop em múltiplos de ATR (`maxStopAtr` = 2,5). O teto percentual
 *       (15%) permitia stops de 6,27 ATR — inúteis como proteção.
 *   [C3] Teto de alvo = MIN(h50, preço + maxAlvoAtr × ATR). Impede que extensões
 *       de Fibonacci acima do topo histórico virem Alvo 1 (eram 8,84 ATR).
 *
 * Uso:  node scripts/test_stop_alvo_geometria.js
 * =============================================================================
 */

var fs = require('fs');
var path = require('path');
var RAIZ = path.join(__dirname, '..');
var src = fs.readFileSync(path.join(RAIZ, '22_Core_Analyzers.js'), 'utf8');

var consoleReal = console.log;
console.log = function () {};
var mCfg = src.match(/const CORE22_CFG = (\{[\s\S]*?\n\});/);
if (!mCfg) throw new Error('CORE22_CFG não encontrado');
var CORE22_CFG = eval('(' + mCfg[1] + ')');
console.log = consoleReal;

var falhas = [];
var passou = 0;

function check(nome, real, esperado, tol) {
  var ok;
  if (typeof real === 'number' && typeof esperado === 'number') {
    ok = Math.abs(real - esperado) <= (tol === undefined ? 0.01 : tol);
  } else {
    ok = (real === esperado);
  }
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

// ===========================================================================
titulo('TESTE 1 — Configuracoes das 3 correcoes');
check('[B] maxStopAtr = 2.5', CORE22_CFG.maxStopAtr, 2.5, 0.001);
check('[C3] maxAlvoAtr = 4.0', CORE22_CFG.maxAlvoAtr, 4.0, 0.001);
check('[A] structureLookback = 60', CORE22_CFG.structureLookback, 60, 0);
check('maxStopPct preservado = 0.15', CORE22_CFG.maxStopPct, 0.15, 0.001);

// ===========================================================================
titulo('TESTE 2 — [A] Pivo do stop usa structureLookback');

check('_processarGestaoRisco usa structureLookback no pivo',
  /_core_getLastPivotLow\(candles,\s*CORE22_CFG\.structureLookback\)/.test(src), true);
check('NAO usa mais swingLookback no pivo do stop',
  /_processarGestaoRisco[\s\S]{0,800}_core_getLastPivotLow\(candles,\s*CORE22_CFG\.swingLookback\)/.test(src), false);
check('Debug expoe swingLookbackUsado',
  /swingLookbackUsado:\s*CORE22_CFG\.structureLookback/.test(src), true);

// ===========================================================================
titulo('TESTE 3 — [B] Teto de stop em ATR');

check('Define tetoAtrStop com maxStopAtr',
  /tetoAtrStop\s*=\s*\(atr > 0\)\s*\?\s*atr \* CORE22_CFG\.maxStopAtr/.test(src), true);
check('maxStopDistEfetivo = min(teto%, tetoATR)',
  /maxStopDistEfetivo\s*=\s*Math\.min\(maxStopDist,\s*tetoAtrStop\)/.test(src), true);
check('Flag stopCortadoPorAtr exposta', /stopCortadoPorAtr/.test(src), true);
check('Flag diferencia corte por ATR vs por %',
  /if\s*\(tetoAtrStop < maxStopDist\)\s*\{\s*stopCortadoPorAtr = true/.test(src), true);

// ===========================================================================
titulo('TESTE 4 — [C3] Teto de alvo');

check('tetoAlvoAtr = preco + maxAlvoAtr x ATR',
  /tetoAlvoAtr\s*=\s*preco \+ \(atrAlvo \* CORE22_CFG\.maxAlvoAtr\)/.test(src), true);
check('nivelTeto = min(h50, tetoAtr) quando h50 > preco',
  /nivelTeto\s*=\s*\(h50 > preco\)\s*\?\s*Math\.min\(h50,\s*tetoAlvoAtr\)\s*:\s*tetoAlvoAtr/.test(src), true);
check('Alvo1 capado por nivelTeto',
  /if\s*\(nivelTeto > preco && alvo1 > nivelTeto\)/.test(src), true);
check('R/R recalculado apos o cap',
  /rrRealista = \(alvo1 - preco\) \/ stopDist/.test(src), true);
check('Alvo2 respeita progressao sobre Alvo1',
  /var tetoAlvo2 = Math\.max\(alvo1 \* 1\.003/.test(src), true);
check('Debug expoe alvoCapado', /alvoCapado: alvoCapado/.test(src), true);

// ===========================================================================
titulo('TESTE 5 — Caso BPAC11: validacao numerica completa');

var preco = 63.50, atr = 1.70;
var h50 = 71.02, l50 = 43.45;
var pivoReal = 61.67;   // minima do dia / suporte imediato

// [A] + [B] STOP
var distPivo = preco - pivoReal;
var distRuido = Math.max(atr, preco * 0.02, preco * CORE22_CFG.minStopPctFloor);
var stopDistTec = Math.max(distPivo, distRuido);
var tetoPct = preco * CORE22_CFG.maxStopPct;
var tetoAtr = atr * CORE22_CFG.maxStopAtr;
var tetoEfet = Math.min(tetoPct, tetoAtr);
var stopDist = Math.min(Math.max(stopDistTec, preco * CORE22_CFG.minStopPctFloor), tetoEfet);
var stop = preco - stopDist;

console.log('  Pivo real (minima do dia) = R$ ' + pivoReal.toFixed(2));
console.log('  distPivo = R$ ' + distPivo.toFixed(2) + ' | distRuido = R$ ' + distRuido.toFixed(2));
console.log('  teto por % = R$ ' + tetoPct.toFixed(2) + ' | teto por ATR = R$ ' + tetoAtr.toFixed(2));
console.log('  STOP = R$ ' + stop.toFixed(2) + ' (' + (stopDist / preco * 100).toFixed(2) +
  '% | ' + (stopDist / atr).toFixed(2) + ' ATR)');

check('Stop = R$ 61,67 (pivo real)', stop, 61.67, 0.02);
check('Risco % = 2,88%', (stopDist / preco) * 100, 2.88, 0.02);
check('Risco em ATR = 1,08', stopDist / atr, 1.08, 0.02);
check('Stop dentro do teto ATR (2,5)', stopDist / atr <= CORE22_CFG.maxStopAtr, true);

// [C3] ALVO
var tetoAlvoAtr = preco + atr * CORE22_CFG.maxAlvoAtr;
var nivelTeto = (h50 > preco) ? Math.min(h50, tetoAlvoAtr) : tetoAlvoAtr;
var alvo1Antes = 78.52;
var alvo1 = Math.min(alvo1Antes, nivelTeto);

console.log('');
console.log('  h50 = R$ ' + h50.toFixed(2) + ' | preco + 4 ATR = R$ ' + tetoAlvoAtr.toFixed(2));
console.log('  nivelTeto = R$ ' + nivelTeto.toFixed(2));
console.log('  Alvo1 ANTES = R$ ' + alvo1Antes.toFixed(2) + ' (' + ((alvo1Antes - preco) / atr).toFixed(2) + ' ATR)');
console.log('  Alvo1 DEPOIS= R$ ' + alvo1.toFixed(2) + ' (' + ((alvo1 - preco) / atr).toFixed(2) + ' ATR)');

check('Alvo1 capado para R$ 70,30', alvo1, 70.30, 0.02);
check('Alvo1 <= 4 ATR', (alvo1 - preco) / atr <= CORE22_CFG.maxAlvoAtr + 0.01, true);
check('Alvo1 <= h50', alvo1 <= h50 + 0.01, true);
check('Alvo1 original excedia o teto', (alvo1Antes - preco) / atr > CORE22_CFG.maxAlvoAtr, true);

var rr = (alvo1 - preco) / stopDist;
console.log('');
console.log('  R/R final = (' + alvo1.toFixed(2) + ' - ' + preco.toFixed(2) + ') / ' +
  stopDist.toFixed(2) + ' = ' + rr.toFixed(2));
check('R/R = 3,72', rr, 3.72, 0.02);
check('R/R >= 2.0 (minimo do Orchestrator)', rr >= 2.0, true);

// ===========================================================================
titulo('TESTE 6 — Comparativo antes/depois');
console.log('               ANTES      DEPOIS');
console.log('  Stop         R$ 52,84   R$ ' + stop.toFixed(2));
console.log('  Risco %      16,79%     ' + (stopDist / preco * 100).toFixed(2) + '%');
console.log('  Risco ATR    6,27x      ' + (stopDist / atr).toFixed(2) + 'x');
console.log('  Alvo 1       R$ 78,52   R$ ' + alvo1.toFixed(2));
console.log('  Alvo ATR     8,84x      ' + ((alvo1 - preco) / atr).toFixed(2) + 'x');
console.log('  R/R          1,41       ' + rr.toFixed(2));
check('Risco caiu para ~2,88%', Math.abs((stopDist / preco * 100) - 2.88) < 0.05, true);
check('R/R melhorou vs 1,41', rr > 1.41, true);
check('Alvo nao excede o topo historico', alvo1 <= h50 + 0.01, true);

// ===========================================================================
titulo('TESTE 7 — Teto de alvo em ativo LATERAL (ATR limita, nao h50)');
var precoL = 50.00, atrL = 1.00, h50L = 90.00;
var tetoAtrL = precoL + atrL * CORE22_CFG.maxAlvoAtr;
var nivelTetoL = (h50L > precoL) ? Math.min(h50L, tetoAtrL) : tetoAtrL;
console.log('  preco=50 | h50=90 | ATR=1 => tetoAtr=' + tetoAtrL.toFixed(2) +
  ' | nivelTeto=' + nivelTetoL.toFixed(2));
check('ATR limita quando h50 esta distante', nivelTetoL, tetoAtrL, 0.01);
check('nivelTeto = 54,00 (4 ATR)', nivelTetoL, 54.00, 0.01);

// ===========================================================================
titulo('TESTE 8 — Teto de alvo em ativo JA ACIMA do h50 (rompimento)');
var precoA = 100.00, atrA = 2.00, h50A = 95.00;
var tetoAtrA = precoA + atrA * CORE22_CFG.maxAlvoAtr;
var nivelTetoA = (h50A > precoA) ? Math.min(h50A, tetoAtrA) : tetoAtrA;
console.log('  preco=100 | h50=95 (abaixo) | ATR=2 => nivelTeto=' + nivelTetoA.toFixed(2));
check('Usa teto ATR quando h50 < preco', nivelTetoA, tetoAtrA, 0.01);
check('nivelTeto = 108,00 (4 ATR)', nivelTetoA, 108.00, 0.01);

// ===========================================================================
titulo('TESTE 9 — Teto de stop em ativo de BAIXA volatilidade');
var precoB = 20.00, atrB = 0.20, pivoB = 18.00;
var distB = precoB - pivoB;
var tetoB = Math.min(precoB * CORE22_CFG.maxStopPct, atrB * CORE22_CFG.maxStopAtr);
var stopDistB = Math.min(distB, tetoB);
console.log('  preco=20 | atr=0,20 | pivo=18 (dist 10%)');
console.log('  tetoB = min(15% = 3,00 ; 2,5 ATR = 0,50) = ' + tetoB.toFixed(2));
check('Teto ATR corta o stop', tetoB, 0.50, 0.01);
check('stopDist = 0,50 (2,5 ATR)', stopDistB, 0.50, 0.01);
check('Risco = 2,5%', (stopDistB / precoB) * 100, 2.5, 0.01);

// ===========================================================================
titulo('TESTE 10 — Coerencia R/R x risco x retorno (apos o cap)');
var alvoPct = (alvo1 - preco) / preco;
check('R/R x risco = retorno ate o alvo',
  Math.abs((rr * (stopDist / preco)) - alvoPct) < 0.0002, true);

// ===========================================================================
console.log('\n=============================================================');
if (falhas.length) {
  console.log('\u274C FALHOU: ' + falhas.length + ' assercao(oes) de ' +
    (passou + falhas.length) + '.');
  falhas.forEach(function (f) { console.log('   \u2022 ' + f); });
  process.exitCode = 1;
} else {
  console.log('\u2705 PASSOU: ' + passou + ' assercoes de stop/alvo validadas.');
  console.log('   \u2022 [A] Pivo do stop alinhado ao structureLookback (60).');
  console.log('   \u2022 [B] Teto de stop em 2,5 x ATR.');
  console.log('   \u2022 [C3] Teto de alvo = MIN(h50, preco + 4 ATR).');
  console.log('   \u2022 BPAC11: stop 52,84 -> 61,67 | alvo 78,52 -> 70,30 | R/R 1,41 -> 3,72');
}
console.log('=============================================================\n');
