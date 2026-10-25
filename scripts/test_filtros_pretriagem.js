/**
 * Harness offline de REGRESSÃO — Filtros de PRÉ-TRIAGEM (v12.9).
 *   • Liquidez: volume médio diário (R$) mínimo
 *   • Volatilidade: corte por ATR% (ATR / preço)
 *
 * Extrai a regra REAL do 00_Core_Orchestrator.js e o _core_getATR do 22.
 */

var fs = require('fs');
var srcOrq = fs.readFileSync('00_Core_Orchestrator.js', 'utf8');
var srcCore = fs.readFileSync('22_Core_Analyzers.js', 'utf8');

// Extrai uma função por balanceamento de chaves.
function extrairFuncao(texto, nome) {
  var idx = texto.indexOf('function ' + nome + '(');
  if (idx === -1) throw new Error('Função ' + nome + ' não encontrada');
  var i = texto.indexOf('{', idx);
  var prof = 0, fim = i;
  for (; fim < texto.length; fim++) {
    if (texto[fim] === '{') prof++;
    else if (texto[fim] === '}') { prof--; if (prof === 0) break; }
  }
  return texto.substring(idx, fim + 1);
}

// _core_getATR real (módulo 22)
eval(extrairFuncao(srcCore, '_core_getATR'));

// Extrai o CORPO do método _avaliarFiltrosPreTriagem (método de objeto).
function extrairMetodo(texto, nome) {
  var idx = texto.indexOf(nome + ': function');
  if (idx === -1) throw new Error('Método ' + nome + ' não encontrado');
  var i = texto.indexOf('{', idx);
  var prof = 0, fim = i;
  for (; fim < texto.length; fim++) {
    if (texto[fim] === '{') prof++;
    else if (texto[fim] === '}') { prof--; if (prof === 0) break; }
  }
  return texto.substring(i, fim + 1); // o CORPO do método (com chaves)
}

var corpoMetodo = extrairMetodo(srcOrq, '_avaliarFiltrosPreTriagem');
// Injeta _core_getATR como parâmetro (a new Function não enxerga o escopo do eval).
var _avaliarFiltrosPreTriagem = new Function('data', '_core_getATR', corpoMetodo);
var _callFiltro = function (data) {
  return _avaliarFiltrosPreTriagem(data, _core_getATR);
};

var falhas = [];

// -------------------- Helpers de cenário --------------------
function candles(preco, volumePorDia, n) {
  n = n || 25;
  var arr = [];
  var base = new Date('2024-01-01');
  for (var i = 0; i < n; i++) {
    var px = preco * (1 + (i % 2 === 0 ? 0.01 : -0.01));
    arr.push({ date: new Date(base.getTime() + i * 86400000), open: px, high: px * 1.01, low: px * 0.99, close: px, volume: volumePorDia });
  }
  return arr;
}

function setConfig(cfg) {
  global.CONFIG = { get: function (k, d) { return (cfg[k] !== undefined) ? cfg[k] : d; } };
}

console.log('\n=== FILTRO DE LIQUIDEZ ===');
// A) Baixa liquidez: 100k ações x R$10 = R$1M/dia < R$2M -> REPROVA
setConfig({ LIQUIDEZ_ATIVA: true, LIQUIDEZ_VOLUME_MINIMO: 2000000, LIQUIDEZ_DIAS_MEDIA: 20, VOLATILIDADE_ATIVA: false });
var rA = _callFiltro({ candles: candles(10, 100000) });
console.log('  A) vol R$1M/dia -> ' + (rA ? rA.setup + ' | ' + rA.motivo : 'APROVADO'));
if (!rA || rA.setup.indexOf('LIQUIDEZ') === -1) falhas.push('A) baixa liquidez deveria reprovar.');

// B) Alta liquidez: 1M ações x R$10 = R$10M/dia >= R$2M -> APROVA
var rB = _callFiltro({ candles: candles(10, 1000000) });
console.log('  B) vol R$10M/dia -> ' + (rB ? rB.setup : 'APROVADO'));
if (rB) falhas.push('B) alta liquidez não deveria reprovar (' + rB.setup + ').');

// C) Liquidez desligada -> sempre aprova
setConfig({ LIQUIDEZ_ATIVA: false, VOLATILIDADE_ATIVA: false });
var rC = _callFiltro({ candles: candles(10, 100000) });
if (rC) falhas.push('C) com filtro desligado não deveria reprovar.');
else console.log('  C) filtro desligado -> APROVADO');

console.log('\n=== FILTRO DE VOLATILIDADE (ATR%) ===');
function candlesVolateis(preco, amp) {
  var arr = []; var base = new Date('2024-01-01');
  for (var i = 0; i < 25; i++) {
    var hi = preco * (1 + amp), lo = preco * (1 - amp);
    arr.push({ date: new Date(base.getTime() + i * 86400000), open: preco, high: hi, low: lo, close: preco, volume: 5000000 });
  }
  return arr;
}
// D) ATR ~30% -> REPROVA
setConfig({ LIQUIDEZ_ATIVA: false, VOLATILIDADE_ATIVA: true, ATR_MAX_PCT: 0.10, ATR_MIN_PCT: 0.005 });
var rD = _callFiltro({ candles: candlesVolateis(10, 0.30) });
console.log('  D) ATR ~30% -> ' + (rD ? rD.setup + ' | ' + rD.motivo : 'APROVADO'));
if (!rD || rD.setup.indexOf('EXCESSIVA') === -1) falhas.push('D) volatilidade alta deveria reprovar.');

// E) ATR ~0,1% com piso 2% -> REPROVA
setConfig({ LIQUIDEZ_ATIVA: false, VOLATILIDADE_ATIVA: true, ATR_MAX_PCT: 0.10, ATR_MIN_PCT: 0.02 });
var rE = _callFiltro({ candles: candlesVolateis(10, 0.001) });
console.log('  E) ATR ~0,1% (piso 2%) -> ' + (rE ? rE.setup : 'APROVADO'));
if (!rE || rE.setup.indexOf('BAIXA') === -1) falhas.push('E) volatilidade baixa deveria reprovar.');

// F) ATR ~4% (piso 0,5% / teto 10%) -> APROVA
setConfig({ LIQUIDEZ_ATIVA: false, VOLATILIDADE_ATIVA: true, ATR_MAX_PCT: 0.10, ATR_MIN_PCT: 0.005 });
var rF = _callFiltro({ candles: candlesVolateis(10, 0.02) });
console.log('  F) ATR ~4% -> ' + (rF ? rF.setup : 'APROVADO'));
if (rF) falhas.push('F) volatilidade saudável não deveria reprovar (' + rF.setup + ').');

console.log('\n=== ROBUSTEZ ===');
if (_callFiltro(null) !== null) falhas.push('null deveria retornar null.');
else console.log('  G) data null -> null OK');
if (_callFiltro({ candles: [] }) !== null) falhas.push('candles vazios deveria retornar null.');
else console.log('  H) candles vazios -> null OK');

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: filtros de pré-triagem inconsistentes.');
  process.exitCode = 1;
} else {
  console.log('  ✅ Liquidez: reprova baixa, aprova alta, respeita flag.');
  console.log('  ✅ Volatilidade: reprova excessiva/baixa, aprova saudável.');
  console.log('  ✅ Robusto a dados nulos/vazios.');
  console.log('\n✅ PASSOU: filtros de pré-triagem (liquidez + volatilidade) OK.');
}
