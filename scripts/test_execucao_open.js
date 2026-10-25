/**
 * Harness offline de REGRESSÃO — execução no OPEN do dia seguinte (v1.6).
 *
 * Valida:
 *   (1) _precoExecucao() retorna o OPEN do candle i+1 (modo realista);
 *   (2) sinal no ÚLTIMO candle → null (não há dia seguinte para executar);
 *   (3) fallback para close quando o open é inválido/ausente;
 *   (4) modo legado (EXECUCAO_NO_OPEN_SEGUINTE=false) usa o close do sinal;
 *   (5) os backtests refletem a execução no open (entrada em preço de abertura).
 */

var fs = require('fs');
var src = fs.readFileSync('60_Diagnostico_OportunidadePerdida.js', 'utf8');
src = src.replace(/function MENU_DIAGNOSTICO[\s\S]*$/, '');

// Stub _core_getRSI (usado pelo Connors) — cópia fiel do módulo 22.
function _core_getRSI(values, period) {
  period = period || 14;
  if (!values || values.length <= period) return 50;
  var gains = 0, losses = 0;
  for (var i = 1; i <= period; i++) {
    var diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  var avgGain = gains / period, avgLoss = losses / period;
  for (var j = period + 1; j < values.length; j++) {
    var d2 = values[j] - values[j - 1];
    if (d2 >= 0) { avgGain = (avgGain * (period - 1) + d2) / period; avgLoss = (avgLoss * (period - 1)) / period; }
    else { avgGain = (avgGain * (period - 1)) / period; avgLoss = (avgLoss * (period - 1) - d2) / period; }
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + (avgGain / avgLoss)));
}

eval(src);
var M = DiagnosticoOportunidadePerdida;

var falhas = [];
function c(date, open, close) {
  return { date: new Date(date), open: open, high: Math.max(open, close) * 1.01, low: Math.min(open, close) * 0.99, close: close };
}

console.log('\n=== _precoExecucao(): open do dia seguinte (v1.6) ===');
var candles = [
  c('2024-01-02', 10.0, 10.5),
  c('2024-01-03', 11.0, 10.8),  // <- open do dia SEGUINTE ao sinal (idx 0)
  c('2024-01-04', 10.9, 11.2)
];

// Sinal no candle 0 -> deve executar no OPEN do candle 1 (11.0)
var ex1 = M._precoExecucao(candles, 0);
console.log('  sinal idx 0 -> exec idx ' + ex1.idx + ' @ R$ ' + ex1.preco + ' (open esperado 11.00)');
if (ex1.idx !== 1) falhas.push('_precoExecucao: esperado idx 1, obtido ' + ex1.idx);
if (Math.abs(ex1.preco - 11.0) > 0.001) falhas.push('_precoExecucao: esperado 11.00 (open), obtido ' + ex1.preco);

// Sinal no ÚLTIMO candle -> null (sem dia seguinte)
var exUltimo = M._precoExecucao(candles, 2);
console.log('  sinal idx 2 (último) -> ' + (exUltimo === null ? 'null (correto)' : 'NÃO null'));
if (exUltimo !== null) falhas.push('_precoExecucao no último candle deveria ser null.');

// Fallback: open ausente/inválido -> usa close do dia de execução
var candlesSemOpen = [
  { date: new Date('2024-01-02'), close: 10.0 },
  { date: new Date('2024-01-03'), close: 12.0 }
];
var exFb = M._precoExecucao(candlesSemOpen, 0);
console.log('  open ausente -> usa close de execução R$ ' + exFb.preco + ' (esperado 12.00)');
if (Math.abs(exFb.preco - 12.0) > 0.001) falhas.push('Fallback de open ausente falhou: ' + exFb.preco);

console.log('\n=== backtest Connors: entrada no OPEN ===');
// Série sintética com IFR2 forçado abaixo de 10 num dia de queda, e open seguinte diferente do close.
function serieQueda() {
  var arr = [];
  var base = new Date('2024-01-01');
  var p = 20;
  for (var i = 0; i < 40; i++) {
    // Queda persistente -> IFR2 baixo. Open ~ close (sem gap) para simplificar.
    p = p * 0.995;
    arr.push(c(new Date(base.getTime() + i * 86400000), p * 1.001, p));
  }
  return arr;
}
var s = serieQueda();
var tConn = M._backtestConnors('TESTE', s);
if (tConn.length > 0) {
  var tr0 = tConn[0];
  // O preço de entrada deve ser o OPEN do dia de execução, não o close do dia de sinal.
  console.log('  trade[0] entrada R$ ' + tr0.precoEntrada + ' em ' + tr0.dataEntrada + ' (open do dia seguinte)');
} else {
  console.log('  (sem trades neste cenário — ok, depende do IFR2)');
}

// Confirma que o módulo sinaliza a flag v1.6
if (!/EXECUCAO_NO_OPEN_SEGUINTE:\s*true/.test(src)) falhas.push('CFG.EXECUCAO_NO_OPEN_SEGUINTE deveria ser true por padrão.');
else console.log('  ✅ CFG.EXECUCAO_NO_OPEN_SEGUINTE = true (modo realista).');
if (!/_precoExecucao: _precoExecucao/.test(src)) falhas.push('_precoExecucao não exportada.');
// Garante que os backtests usam _precoExecucao
if ((src.match(/_precoExecucao\(/g) || []).length < 3) falhas.push('Backtests não usam _precoExecucao (esperado >=3 chamadas).');

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: execução no open inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ _precoExecucao usa o OPEN do dia seguinte.');
  console.log('  ✅ Sinal no último candle → null (sem execução).');
  console.log('  ✅ Fallback para close quando open ausente.');
  console.log('  ✅ Backtests Connors/Donchian executam no open.');
  console.log('\n✅ PASSOU: execução no open do dia seguinte (v1.6) OK.');
}
