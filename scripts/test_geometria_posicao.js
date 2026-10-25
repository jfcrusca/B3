/**
 * =============================================================================
 * scripts/test_geometria_posicao.js — REGRESSÃO DA GEOMETRIA DE POSIÇÃO
 * =============================================================================
 * Valida o módulo 28_Position_Geometry contra o caso REAL que originou a
 * correção: BPAC11, entrada de 100 ações em 21/09.
 *
 *   Preço Atual ...... R$ 63,50
 *   Entrada Sugerida . R$ 53,98   (gatilho Fibo, −15% da cotação)
 *   Stop Loss ........ R$ 52,84
 *   Alvo 1 ........... R$ 78,52
 *   Alvo 2 ........... R$ 87,08
 *
 * ── BUG ORIGINAL ("Tríade BPAC11") ─────────────────────────────────────────
 *   Risco %  = 13,94%  → medido contra a COTAÇÃO
 *   R/R      = 2,00    → medido contra a ENTRADA
 *   Alvo 1   = +23,7%  → a partir da COTAÇÃO (o número que o usuário vive)
 *
 * Os três números eram coerentes entre si, mas NÃO com a execução real: quem
 * entra a R$ 63,50 assume R$ 1.066 de risco (100 ações), não os R$ 114 que a
 * geometria sugere. E o "R/R 2,00" só vale para quem entra a R$ 53,98.
 *
 * Uso:  node scripts/test_geometria_posicao.js
 * =============================================================================
 */

var fs = require('fs');
var path = require('path');

var RAIZ = path.join(__dirname, '..');
var SRC = fs.readFileSync(path.join(RAIZ, '28_Position_Geometry.js'), 'utf8');

var consoleReal = console.log;
console.log = function () {};
// Executa o módulo real no escopo global do Node
eval(SRC);
console.log = consoleReal;

if (typeof PositionGeometry === 'undefined') {
  console.error('❌ PositionGeometry não pôde ser carregado.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
var falhas = [];
var passou = 0;

function check(nome, real, esperado, tolerancia) {
  tolerancia = tolerancia === undefined ? 0.01 : tolerancia;
  var ok = (typeof real === 'number' && typeof esperado === 'number')
    ? Math.abs(real - esperado) <= tolerancia
    : real === esperado;

  if (ok) {
    passou++;
    console.log('  \u2705 ' + nome);
  } else {
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
// CASO REAL — BPAC11
// ===========================================================================
var BPAC11 = {
  precoAtual: 63.50,
  entradaIdeal: 53.98,
  stop: 52.84,
  alvo1: 78.52,
  alvo2: 87.08
};

titulo('CASO 1 — BPAC11: o bug relatado pelo usuário');
var g = PositionGeometry.calcular(BPAC11);

console.log('  Preço de referência (execução): R$ ' + g.precoReferencia.toFixed(2));
console.log('  Zona de compra ................ R$ ' + g.zonaCompra.piso.toFixed(2) +
  ' – R$ ' + g.zonaCompra.teto.toFixed(2));
console.log('  Risco por ação ................ R$ ' + g.riscoRS.toFixed(2));
console.log('  Risco % ....................... ' + (g.riscoPct * 100).toFixed(2) + '%');
console.log('  R/R real ...................... ' + g.rr.toFixed(2));
console.log('  R/R da geometria .............. ' + g.rrAnalisador.toFixed(2));
console.log('  Alvo 1 % da cotação ........... +' + (g.alvo1PctAtual * 100).toFixed(2) + '%');
console.log('  Alvo 2 % da cotação ........... +' + (g.alvo2PctAtual * 100).toFixed(2) + '%');
console.log('  Atraso da entrada ............. +' + (g.atrasoPct * 100).toFixed(2) + '%');
console.log('  Diagnóstico ................... ' + g.severidade);
console.log('  → ' + g.diagnostico.replace(/\n/g, '\n    '));

// A) Risco deve ser medido contra a COTAÇÃO (63,50 − 52,84 = 10,66)
check('Risco por ação = R$ 10,66', g.riscoRS, 10.66);
check('Risco % = 16,79%', g.riscoPct * 100, 16.79, 0.02);

// B) R/R real deve ser bem MENOR que o anunciado (2,00)
//    (78,52 − 63,50) / 10,66 = 1,4090
check('R/R real ~ 1,41 (não 2,00)', g.rr, 1.41, 0.02);
check('R/R da geometria = 21,60', g.rrAnalisador, 21.60, 0.5);
check('R/R real < R/R da geometria', g.rr < g.rrAnalisador, true);

// C) Retorno real até o alvo, partindo da cotação
check('Alvo 1 = +23,65% da cotação', g.alvo1PctAtual * 100, 23.65, 0.05);
check('Alvo 2 = +37,13% da cotação', g.alvo2PctAtual * 100, 37.13, 0.05);

// D) Zona de compra: 53,98 ± 1,5% → [53,17 ; 54,79]
check('Piso da zona = R$ 53,17', g.zonaCompra.piso, 53.17, 0.01);
check('Teto da zona = R$ 54,79', g.zonaCompra.teto, 54.79, 0.01);
check('Centro = R$ 53,98', g.zonaCompra.centro, 53.98, 0.01);

// E) Estado: preço MUITO acima da zona (63,50 > 54,79)
check('Preço ACIMA da zona', g.acimaDaZona, true);
check('Preço NÃO está na zona', g.dentroDaZona, false);
check('Entrada atrasada detectada', g.entradaAtrasada, true);
check('Atraso = +17,63%', g.atrasoPct * 100, 17.63, 0.05);
check('Stop é válido (abaixo do preço)', g.stopInvalido, false);

// F) Severidade: risco 16,79% excede o teto de 15% → CRÍTICO por RISCO
//    (a checagem de risco tem precedência sobre a de R/R, pois é mais grave)
check('Severidade CRITICO', g.severidade, 'CRITICO');
check('Diagnóstico menciona RISCO EXCESSIVO',
  g.diagnostico.indexOf('RISCO DE 16.8%') !== -1, true);

// F.2) Um caso com risco dentro do teto mas entrada atrasada deve acusar R/R
//      Capital 50.000, risco 2% = 1.000 → aqui só verificamos a mensagem.
//      stop a 5% do preço (dentro do teto) e alvo próximo → R/R real baixo.
var gRrBaixo = PositionGeometry.calcular({
  precoAtual: 100, entradaIdeal: 90, stop: 95, alvo1: 106, alvo2: 110
});
// risco real = 5% (ok), atraso = +11,1%, R/R real = (106−100)/5 = 1,20 < 1,5
check('Risco dentro do teto (5%)', gRrBaixo.riscoPct, 0.05, 0.001);
check('R/R real = 1,20', gRrBaixo.rr, 1.20, 0.01);
check('Entrada atrasada detectada', gRrBaixo.entradaAtrasada, true);
check('Diagnóstico acusa R/R insuficiente',
  gRrBaixo.diagnostico.indexOf('R/R REAL INSUFICIENTE') !== -1, true);
check('Severidade CRITICO', gRrBaixo.severidade, 'CRITICO');

// ===========================================================================
// CASO 2 — Zona de compra (a causa raiz)
// ===========================================================================
titulo('CASO 2 — Zona de compra: preço DENTRO da faixa');

// Preço exatamente no centro da zona (a entrada ideal)
var gCentro = PositionGeometry.calcular({
  precoAtual: 53.98, entradaIdeal: 53.98, stop: 52.84, alvo1: 78.52, alvo2: 87.08
});
check('No centro => dentro da zona', gCentro.dentroDaZona, true);
check('No centro => não atrasada', gCentro.entradaAtrasada, false);
check('No centro => severidade OK', gCentro.severidade, 'OK');
check('No centro => R/R = 21,60', gCentro.rr, 21.60, 0.5);

// Preço no TETO da zona (54,79) ainda é válido
var gTeto = PositionGeometry.calcular({
  precoAtual: 54.79, entradaIdeal: 53.98, stop: 52.84, alvo1: 78.52, alvo2: 87.08
});
check('No teto => dentro da zona', gTeto.dentroDaZona, true);
check('No teto => ainda válido', gTeto.severidade, 'OK');

// Preço logo acima do teto (55,00) — 1,9% de atraso: NÃO atrasado (< 3%)
var gLimite = PositionGeometry.calcular({
  precoAtual: 55.00, entradaIdeal: 53.98, stop: 52.84, alvo1: 78.52, alvo2: 87.08
});
check('55,00 => fora da zona', gLimite.dentroDaZona, false);
check('55,00 => sem atraso (<3%)', gLimite.entradaAtrasada, false);
// Risco = 55,00 − 52,84 = 2,16 ; R/R = (78,52 − 55,00) / 2,16 = 10,89
check('55,00 => risco R$ 2,16', gLimite.riscoRS, 2.16, 0.01);
check('55,00 => R/R real 10,89', gLimite.rr, 10.89, 0.02);

// ===========================================================================
// CASO 3 — Stop inválido (stop acima do preço)
// ===========================================================================
titulo('CASO 3 — Stop acima do preço (geometria impossível)');
var gInvalido = PositionGeometry.calcular({
  precoAtual: 54.80, entradaIdeal: 54.80, stop: 57.19, alvo1: 58.87, alvo2: 60.00
});
check('Stop inválido detectado', gInvalido.stopInvalido, true);
check('Severidade CRITICO', gInvalido.severidade, 'CRITICO');
check('Risco ZERADO (não mascarado)', gInvalido.riscoPct, 0);
check('R/R ZERADO', gInvalido.rr, 0);

// ===========================================================================
// CASO 4 — Risco excessivo
// ===========================================================================
titulo('CASO 4 — Risco acima do teto (15%)');
// 100 → 80 = 20% de risco
var gRisco = PositionGeometry.calcular({
  precoAtual: 100, entradaIdeal: 100, stop: 80, alvo1: 150, alvo2: 180
});
check('Risco = 20%', gRisco.riscoPct, 0.20, 0.001);
check('Risco excessivo sinalizado', gRisco.riscoExcessivo, true);
check('Severidade CRITICO', gRisco.severidade, 'CRITICO');
check('Diagnóstico menciona RISCO',
  gRisco.diagnostico.indexOf('RISCO DE') !== -1, true);

// ===========================================================================
// CASO 5 — Position Sizing coerente
// ===========================================================================
titulo('CASO 5 — Position Sizing (mesma base do risco)');

// BPAC11: capital 50.000, risco 2% = 1.000
// Risco por ação (contra a cotação) = 10,66 → 1.000 / 10,66 = 93 ações
var dim = PositionGeometry.dimensionar({
  capital: 50000,
  riscoPctAlvo: 0.02,
  precoReferencia: 63.50,
  stop: 52.84,
  maxTradeAlloc: 0.25,
  maxTotalAlloc: 0.95
});
console.log('  BPAC11 => ' + dim.quantidade + ' ações, R$ ' + dim.valorTrade.toFixed(2) +
  ', risco R$ ' + dim.riscoRS.toFixed(2) + ' (' + (dim.alocacao * 100).toFixed(2) + '%)');

check('Quantidade = 93 ações', dim.quantidade, 93, 0);
check('Risco da posição ~R$ 991', dim.riscoRS, 991.38, 1);
check('Risco <= 2% do capital', dim.riscoRS <= 50000 * 0.02, true);
check('Valor = R$ 5.905,50', dim.valorTrade, 5905.50, 0.02);
check('Alocacao = 11,81%', dim.alocacao * 100, 11.81, 0.01);

// Teto por trade: stop muito próximo geraria quantidade enorme
var dimTeto = PositionGeometry.dimensionar({
  capital: 50000,
  riscoPctAlvo: 0.02,
  precoReferencia: 100,
  stop: 99.90,          // risco de 0,10 → 1.000/0,10 = 10.000 ações
  maxTradeAlloc: 0.25,  // mas o teto é 125 ações
  maxTotalAlloc: 0.95
});
console.log('  Teto por trade => ' + dimTeto.quantidade + ' ações (motivo: ' +
  (dimTeto.motivo || 'nenhum') + ')');
check('Teto por trade aplicado', dimTeto.quantidade, 125, 0);
check('Motivo registrado', dimTeto.motivo.indexOf('teto por trade') !== -1, true);

// Teto agregado: capital quase esgotado
var dimAgregado = PositionGeometry.dimensionar({
  capital: 50000,
  riscoPctAlvo: 0.02,
  precoReferencia: 10,
  stop: 9,
  maxTradeAlloc: 1.0,
  maxTotalAlloc: 0.95,
  valorJaAlocado: 45000   // restante = 47.500 − 45.000 = 2.500 → 250 ações
});
console.log('  Teto agregado => ' + dimAgregado.quantidade + ' ações');
check('Teto agregado aplicado', dimAgregado.quantidade, 250, 0);

// Geometria inválida → quantidade 0
var dimInvalido = PositionGeometry.dimensionar({
  capital: 50000, riscoPctAlvo: 0.02, precoReferencia: 50, stop: 55
});
check('Stop inválido => 0 ações', dimInvalido.quantidade, 0);
check('Motivo = geometria inválida',
  dimInvalido.motivo.indexOf('geometria inválida') !== -1, true);

// ===========================================================================
// CASO 6 — Coerência interna: risco, R/R e retorno andam juntos
// ===========================================================================
titulo('CASO 6 — Coerência: R/R x risco = retorno ate o alvo');
// Os campos de saída são arredondados (rr a 2 casas, riscoPct a 4 casas,
// percentuais a 4 casas), então a tolerância precisa cobrir esse arredondamento.
var cenarios = [
  { precoAtual: 63.50, entradaIdeal: 53.98, stop: 52.84, alvo1: 78.52, alvo2: 87.08 },
  { precoAtual: 40.00, entradaIdeal: 38.00, stop: 36.50, alvo1: 46.00, alvo2: 50.00 },
  { precoAtual: 25.00, entradaIdeal: 25.00, stop: 23.75, alvo1: 30.00, alvo2: 33.00 },
  { precoAtual: 100, entradaIdeal: 90, stop: 95, alvo1: 106, alvo2: 110 }
];
var coerentes = 0;
cenarios.forEach(function (c, i) {
  var gc = PositionGeometry.calcular(c);
  var esperado = gc.rr * gc.riscoPct;
  var tol = 0.001; // arredondamento de rr (2 casas) × riscoPct (4 casas)
  var ok = Math.abs(esperado - gc.alvo1PctAtual) <= tol;
  console.log('  Cenario ' + (i + 1) + ': R/R ' + gc.rr.toFixed(4) + ' x risco ' +
    (gc.riscoPct * 100).toFixed(2) + '% = ' + (esperado * 100).toFixed(2) +
    '% | alvo1 % da cotacao = ' + (gc.alvo1PctAtual * 100).toFixed(2) + '% ' +
    (ok ? '\u2705' : '\u274C'));
  if (ok) coerentes++;
});
check('Todos os ' + cenarios.length + ' cenarios coerentes', coerentes, cenarios.length, 0);

// ===========================================================================
// CASO 7 — Sem regressão: o risco SEMPRE bate com (preço − stop) / preço
// ===========================================================================
titulo('CASO 7 — Risco sempre medido contra o preço de referência');
var casosRisco = [
  { precoAtual: 63.50, stop: 52.84 },
  { precoAtual: 100.00, stop: 95.00 },
  { precoAtual: 25.00, stop: 23.75 },
  { precoAtual: 12.34, stop: 11.00 }
];
var riscoOk = 0;
casosRisco.forEach(function (c) {
  var gr = PositionGeometry.calcular({
    precoAtual: c.precoAtual, entradaIdeal: c.precoAtual,
    stop: c.stop, alvo1: c.precoAtual * 2, alvo2: c.precoAtual * 2.2
  });
  var esperado = (c.precoAtual - c.stop) / c.precoAtual;
  var ok = Math.abs(gr.riscoPct - esperado) <= 0.0001;
  console.log('  Preco ' + c.precoAtual + ' / stop ' + c.stop + ' => risco ' +
    (gr.riscoPct * 100).toFixed(2) + '% (esperado ' + (esperado * 100).toFixed(2) +
    '%) ' + (ok ? '\u2705' : '\u274C'));
  if (ok) riscoOk++;
});
check('Risco consistente em ' + casosRisco.length + ' casos', riscoOk, casosRisco.length, 0);

// Preço vazio → cai para a entrada ideal
var gSemPreco = PositionGeometry.calcular({
  precoAtual: 0, entradaIdeal: 50, stop: 47.5, alvo1: 60, alvo2: 65
});
check('Sem cotação => usa entrada ideal', gSemPreco.precoReferencia, 50, 0.01);
check('Sem cotação => risco 5%', gSemPreco.riscoPct, 0.05, 0.0001);

// ===========================================================================
console.log('\n=============================================================');
if (falhas.length) {
  console.log('\u274C FALHOU: ' + falhas.length + ' assercao(oes) de ' +
    (passou + falhas.length) + '.');
  falhas.forEach(function (f) { console.log('   \u2022 ' + f); });
  process.exitCode = 1;
} else {
  console.log('\u2705 PASSOU: ' + passou + ' assercoes de geometria validadas.');
  console.log('   \u2022 BPAC11: risco real = R$ 10,66/acao (nao R$ 1,14).');
  console.log('   \u2022 R/R real 1,41 vs. anunciado 2,00 — divergencia exposta.');
  console.log('   \u2022 Zona de compra [53,17 ; 54,79] e deteccao de atraso.');
  console.log('   \u2022 Position sizing na MESMA base do risco exibido.');
  console.log('   \u2022 Teto por trade e teto agregado preservados.');
  console.log('   \u2022 Coerencia: R/R x risco = retorno ate o alvo.');
}
console.log('=============================================================\n');
