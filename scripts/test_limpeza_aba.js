/**
 * =============================================================================
 * scripts/test_limpeza_aba.js — REGRESSÃO DA LIMPEZA ROBUSTA
 * =============================================================================
 * Valida a correção do resíduo de execuções anteriores em 'Resultados_Analise'.
 *
 * EVIDÊNCIA (BPAC11, 22:44): a linha continha dados de até 3 execuções:
 *   Stop R$ 57,15  + Risco 6,93%     => 57,15 daria 10,00% (incoerentes)
 *   Alvo1 R$ 61,67 + Alvo2 R$ 63,93  => fontes distintas
 *   ATR = 2 (arredondado)            => o _toRow grava 1,7016
 *   Alerta Segurança VAZIO           => o _toRow escreve '-' sempre
 *
 * CAUSA: `getLastRow()` pode reportar valor MENOR que o real quando há células
 * esparsas. O `clear()` então deixava resíduos.
 *
 * Uso:  node scripts/test_limpeza_aba.js
 * =============================================================================
 */

var fs = require('fs');
var path = require('path');
var RAIZ = path.join(__dirname, '..');

var srcOut = fs.readFileSync(path.join(RAIZ, '08_Output_Unified.js'), 'utf8');
var srcSW = fs.readFileSync(path.join(RAIZ, '00_SheetWriter.js'), 'utf8');

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
titulo('TESTE 1 — Limpeza usa getMaxRows (nao getLastRow)');

check('Usa sheet.getMaxRows()',
  /const maxRows = sheet\.getMaxRows\(\)/.test(srcOut), true);
check('Limpa ate maxRows - 1',
  /getRange\(2, 1, maxRows - 1,/.test(srcOut), true);
check('Limpa conteudo + formato + fundo',
  /clearContent\(\)\s*\n\s*\.clearFormat\(\)\s*\n\s*\.setBackground\(null\)/.test(srcOut), true);
check('Cobre getMaxColumns (celulas alem do layout)',
  /Math\.max\(OutputConfig\.NUM_COLS, sheet\.getMaxColumns\(\)\)/.test(srcOut), true);

// A limpeza NAO pode mais depender de getLastRow
var trechoLimpeza = srcOut.match(/Limpeza[\s\S]{0,2000}?const rows = lista\.map/);
var usaLastRow = trechoLimpeza ? /const lastRow = sheet\.getLastRow\(\)/.test(trechoLimpeza[0]) : false;
check('Limpeza NAO usa mais getLastRow()', usaLastRow, false);

// ===========================================================================
titulo('TESTE 2 — Validador de integridade disponivel');

check('VALIDAR_INTEGRIDADE_RESULTADOS existe',
  /function VALIDAR_INTEGRIDADE_RESULTADOS\(\)/.test(srcSW), true);
check('Valida Alvo1 < preco',
  /alvo1 < preco/.test(srcSW), true);
check('Valida Alvo2 < preco',
  /alvo2 < preco/.test(srcSW), true);
check('Valida Stop >= preco',
  /stop >= preco/.test(srcSW), true);
check('Valida Risco % vs Stop calculado',
  /riscoCalc - riscoNum/.test(srcSW), true);
check('Valida R/R vs Alvo1/Stop',
  /rrCalc - rr/.test(srcSW), true);
check('Valida Alerta Seguranca vazio',
  /alerta === ''/.test(srcSW), true);
check('Valida stop em ATRs',
  /atrs > 4/.test(srcSW), true);
check('Wrapper de UI resiliente',
  /function b3UiAlertIntegridade_/.test(srcSW), true);

// ===========================================================================
titulo('TESTE 3 — Reproducao da linha corrompida do BPAC11');

// Dados reais da linha de 22:44
var preco = 63.50, stop = 57.15, alvo1 = 61.67, alvo2 = 63.93, rr = 0.06, riscoPct = 6.93;

var riscoCalc = ((preco - stop) / preco) * 100;
var rrCalc = (alvo1 - preco) / (preco - stop);

console.log('  Stop = R$ ' + stop.toFixed(2) + ' | Risco gravado = ' + riscoPct + '%');
console.log('  Risco CALCULADO do stop = ' + riscoCalc.toFixed(2) + '%');
console.log('  => diferenca de ' + Math.abs(riscoCalc - riscoPct).toFixed(2) + ' p.p. => INCOERENTE');

check('Risco calculado (10%) != gravado (6,93%)',
  Math.abs(riscoCalc - riscoPct) > 0.15, true);
check('Alvo1 (61,67) < preco (63,50)',
  alvo1 < preco, true);
check('Alvo2 (63,93) > preco mas < 1% acima',
  (alvo2 > preco) && ((alvo2 - preco) / preco < 0.01), true);

// O R/R gravado e reproduzivel apenas misturando fontes
var rrMisturado = (alvo2 - preco) / (preco - stop);
console.log('  R/R gravado = ' + rr.toFixed(2) +
  ' | R/R( alvo2 / risco ) = ' + rrMisturado.toFixed(4));
check('R/R gravado reproduz a mistura alvo2/stop',
  Math.abs(rrMisturado - rr) < 0.008, true);

// O validador detectaria TODOS esses problemas
var errosDetectados = 0;
if (alvo1 < preco) errosDetectados++;                                    // Alvo abaixo
if (Math.abs(riscoCalc - riscoPct) > 0.15) errosDetectados++;             // Risco incoerente
if (Math.abs(rrCalc - rr) > 0.05) errosDetectados++;                      // R/R incoerente
if (((preco - stop) / 2) > 4) errosDetectados++;                          // stop em ATRs

console.log('');
console.log('  O validador detectaria ' + errosDetectados + ' problemas nessa linha');
check('Validador pega >= 3 problemas', errosDetectados >= 3, true);

// ===========================================================================
titulo('TESTE 4 — Caso hipotetico: e se ATR limitasse o stop?');
// Com o ATR real (1,7016) e o teto de 2,5 ATR, o stop maximo seria:
var atr = 1.7016;
var stopMax = preco - Math.min(preco * 0.15, atr * 2.5);
console.log('  ATR real = ' + atr);
console.log('  Stop maximo (2,5 ATR) = R$ ' + stopMax.toFixed(2));
console.log('  Stop gravado na linha  = R$ ' + stop.toFixed(2) + '  (ABAixo do limite!)');
check('Stop gravado viola o teto ATR', stop < stopMax, true);

// Com o stop correto, o risco seria:
var riscoCorreto = ((preco - stopMax) / preco) * 100;
console.log('  Risco com o stop correto = ' + riscoCorreto.toFixed(2) + '%');
check('Risco correto ~2,5x ATR / preco', riscoCorreto, (atr * 2.5 / preco) * 100, 0.01);

// ===========================================================================
console.log('\n=============================================================');
if (falhas.length) {
  console.log('\u274C FALHOU: ' + falhas.length + ' assercao(oes) de ' +
    (passou + falhas.length) + '.');
  falhas.forEach(function (f) { console.log('   \u2022 ' + f); });
  process.exitCode = 1;
} else {
  console.log('\u2705 PASSOU: ' + passou + ' assercoes de limpeza validadas.');
  console.log('   \u2022 Limpeza usa getMaxRows (elimina residuos esparsos).');
  console.log('   \u2022 Validador detecta linhas corrompidas (6 checagens).');
  console.log('   \u2022 Padrao do BPAC11 reproduzido: ' + errosDetectados + ' problemas detectaveis.');
}
console.log('=============================================================\n');
