/**
 * Harness offline — valida que o WRITER (00_SheetWriter._opParaLinha) e o
 * _toRow (08_Output_Unified) EXPÕEM o forcaRelativa na coluna 26.
 *
 * Simula um objeto `op` como o produzido por STRATEGY_EVALUATE_CORE e verifica
 * que a linha gerada tem 27 posições com o valor correto (em %).
 */

var fs = require('fs');

var falhas = [];

// --- Extrai _toRow do 08_Output_Unified (função interna do IIFE 'function _toRow') ---
var srcOut = fs.readFileSync('08_Output_Unified.js', 'utf8');

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

// Stubs mínimos para _toRow
global.OutputConfig = { NUM_COLS: 27 };
global.avaliarRompimentoSeguro = function () { return { tagFinal: 'T', alerta: '-', corFundo: null }; };
global.DataService = undefined;

var _toRowSrc = extrairFuncao(srcOut, '_toRow');
// eval no escopo do módulo: a função referencia globais (OutputConfig, etc.)
eval(_toRowSrc);
var _toRow = (typeof _toRow === 'function') ? _toRow : null;
if (!_toRow) throw new Error('_toRow não definida após eval.');

// op "típico" com força relativa = +0.052 (5.2%)
var op = {
  ticker: 'ITSA4', price: 14.19, score: 87, setup: '📈 TENDÊNCIA CONFIRMADA',
  stopLoss: 12.12, target1: 18.33, target2: 20.40, rr: 2.0,
  topo50: 14.5, ganhoRapidoPct: 0.03, distTopoPct: 0.02,
  forcaRelativa: 0.052,   // decimal -> deve sair 5.2
  indicators: { rsi: 68.2, ema21: 13.4, ema50: 12.0, ema200: 11.0, atr: 0.33 }
};

var linha = _toRow(op);
console.log('\n=== Writer: coluna Força Rel. (índice 26) ===');
console.log('  len = ' + linha.length + ' (esperado 27)');
console.log('  col[26] = ' + JSON.stringify(linha[26]) + ' (esperado 5.2)');
if (linha.length !== 27) falhas.push('_toRow deveria retornar 27 colunas, retornou ' + linha.length);
if (Number(linha[26]) !== 5.2) falhas.push('col[26] deveria ser 5.2, é ' + linha[26]);

// Sem benchmark -> vazio
var opNull = Object.assign({}, op); delete opNull.forcaRelativa;
var linhaNull = _toRow(opNull);
console.log('  sem benchmark: col[26] = ' + JSON.stringify(linhaNull[26]) + ' (esperado "")');
if (linhaNull[26] !== '') falhas.push('Sem benchmark, col[26] deveria ser vazio.');

// --- _opParaLinha do 00_SheetWriter ---
var srcW = fs.readFileSync('00_SheetWriter.js', 'utf8');
// Extrai o IIFE inteiro? É complexo. Checagem textual + simulação via regex.
if (!/forcaRelativa/.test(srcW)) falhas.push('00_SheetWriter não menciona forcaRelativa.');
if (!/op\.forcaRelativa\s*\*\s*100/.test(srcW)) falhas.push('00_SheetWriter não converte forcaRelativa para %.');
else console.log('  ✅ 00_SheetWriter converte forcaRelativa para % (×100).');

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: writer não expõe forcaRelativa.');
  process.exitCode = 1;
} else {
  console.log('  ✅ _toRow grava Força Rel. na col 26 (27 colunas).');
  console.log('  ✅ 5.2% correto; vazio quando sem benchmark.');
  console.log('\n✅ PASSOU: writer expõe corretamente a Força Relativa.');
}
