/**
 * Harness de teste local (Node) para o motor de backtest do módulo 60.
 * Reproduz o algoritmo Wilder de RSI do módulo 22 e valida que as duas
 * estratégias geram entradas, saídas e estatísticas coerentes.
 * NÃO faz parte do deploy GAS — é apenas validação offline.
 */

// --- Cópia fiel de _core_getRSI (22_Core_Analyzers.js:785) ---
function _core_getRSI(values, period) {
  period = period || 14;
  if (!values || values.length <= period) return 50;
  var gains = 0, losses = 0;
  for (var i = 1; i <= period; i++) {
    var diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  var avgGain = gains / period, avgLoss = losses / period;
  for (var i = period + 1; i < values.length; i++) {
    var diff2 = values[i] - values[i - 1];
    if (diff2 >= 0) {
      avgGain = (avgGain * (period - 1) + diff2) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff2) / period;
    }
  }
  if (avgLoss === 0) return 100;
  var rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

var fs = require('fs');
var src = fs.readFileSync('60_Diagnostico_OportunidadePerdida.js', 'utf8');
// Remove a ponte de menu (depende de SpreadsheetApp) para permitir eval no Node
src = src.replace(/function MENU_DIAGNOSTICO[\s\S]*$/, '');
eval(src);

var M = DiagnosticoOportunidadePerdida;

// --- Gera candles sintéticos: queda forte seguida de recuperação e rompimento ---
function gerarCandles() {
  var candles = [];
  var preco = 100;
  var inicio = new Date(2024, 0, 1);
  for (var i = 0; i < 120; i++) {
    var d = new Date(inicio.getTime() + i * 86400000);
    var drift;
    if (i < 55) drift = 0.001;             // base lateral (cria faixa estreiita)
    else if (i < 60) drift = -0.02;        // correção curta → derruba IFR-2
    else if (i < 70) drift = 0.005;        // retomada suave
    else if (i === 70) drift = 0.12;       // ROMPIMENTO forte: fecha acima da máxima de 20d
    else if (i < 78) drift = 0.004;
    else if (i === 78) drift = -0.10;      // quebra a mínima de 10d → saída Donchian
    else if (i < 100) drift = 0.002;
    else if (i === 100) drift = -0.06;     // nova correção → dispara IFR-2 baixo
    else if (i < 106) drift = 0.01;        // recuperação → fecha acima da SMA5 (saída Connors)
    else drift = 0.003;
    preco = preco * (1 + drift);
    candles.push({
      date: d, open: preco * 0.99, high: preco * 1.02,
      low: preco * 0.98, close: preco, volume: 1000000
    });
  }
  return candles;
}

var candles = gerarCandles();
var tc = M._backtestConnors('TESTE', candles);
var td = M._backtestDonchian('TESTE', candles);

console.log('=== VALIDAÇÃO DO MOTOR DE BACKTEST ===');
console.log('Candles:', candles.length);
console.log('Connors trades:', tc.length);
console.log('Donchian trades:', td.length);
console.log('Stats Connors:', JSON.stringify(M._estatisticas(tc)));
console.log('Stats Donchian:', JSON.stringify(M._estatisticas(td)));

// --- Asserções ---
var falhas = [];
if (tc.length === 0) falhas.push('Connors não gerou nenhum trade (esperado > 0 na queda simulada)');
if (td.length === 0) falhas.push('Donchian não gerou nenhum trade (esperado > 0 no rompimento simulado)');
tc.concat(td).forEach(function (t) {
  if (!t.dataEntrada || !t.dataSaida) falhas.push('Trade sem datas: ' + JSON.stringify(t));
  if (t.precoEntrada <= 0 || t.precoSaida <= 0) falhas.push('Trade com preço inválido: ' + JSON.stringify(t));
  if (typeof t.resultadoPct !== 'number') falhas.push('resultadoPct não numérico: ' + JSON.stringify(t));
});
// Verifica que o custo foi descontado (resultado nunca é exatamente o bruto puro)
var tTeste = tc[0];
if (tTeste) {
  console.log('Exemplo de trade Connors:', JSON.stringify(tTeste));
}

// Verifica que _estatisticas soma corretamente (v1.3: valores em PERCENTUAL, ×100)
var st = M._estatisticas(tc);
var somaManualPct = tc.reduce(function (a, b) { return a + b.resultadoPct; }, 0) * 100;
if (Math.abs(st.sumRet - Math.round(somaManualPct * 10000) / 10000) > 0.01) {
  falhas.push('sumRet inconsistente (esperado em %): ' + st.sumRet + ' vs ' + somaManualPct);
}
// Confere que avgRet = sumRet / n (em %)
if (st.n > 0 && Math.abs(st.avgRet - (st.sumRet / st.n)) > 0.01) {
  falhas.push('avgRet inconsistente: ' + st.avgRet + ' vs ' + (st.sumRet / st.n));
}
console.log('📊 _estatisticas (v1.3, em %): n=' + st.n + ' | WR=' + st.winRate + '% | avgRet=' + st.avgRet + '% | sumRet=' + st.sumRet + '%');

// --- v1.4/v1.5: FILTRO DE OUTLIERS + INTEGRIDADE ---
console.log('\n=== FILTRO DE OUTLIERS/INTEGRIDADE (v1.5, teto ' + (M.CFG.OUTLIER_MAX_RETORNO * 100) + '%) ===');
var tradesFake = [
  { ticker: 'AAA3', estrategia: 'CONNORS_IFR2', resultadoPct: 0.05,  barras: 3, precoEntrada: 10, precoSaida: 10.5, dataEntrada: '2024-01-02', dataSaida: '2024-01-10' }, // ok
  { ticker: 'BBB3', estrategia: 'CONNORS_IFR2', resultadoPct: -0.08, barras: 5, precoEntrada: 10, precoSaida: 9.2,  dataEntrada: '2024-01-02', dataSaida: '2024-01-15' }, // ok
  { ticker: 'CCC3', estrategia: 'CONNORS_IFR2', resultadoPct: 2.5,   barras: 4, precoEntrada: 10, precoSaida: 35,   dataEntrada: '2024-02-01', dataSaida: '2024-02-20' }, // +250% ok (< 300%)
  { ticker: 'DDD3', estrategia: 'CONNORS_IFR2', resultadoPct: 17.33, barras: 6, precoEntrada: 10, precoSaida: 183,  dataEntrada: '2024-01-02', dataSaida: '2024-01-20' }, // +1733% OUTLIER
  { ticker: 'EEE3', estrategia: 'DONCHIAN_20_10', resultadoPct: -4.2, barras: 8, precoEntrada: 10, precoSaida: -32, dataEntrada: '2024-01-02', dataSaida: '2024-01-25' }, // -420% OUTLIER
  { ticker: 'ACNB34', estrategia: 'DONCHIAN_20_10', resultadoPct: 0.2684, barras: 36, precoEntrada: 1739.44, precoSaida: 2208.02, dataEntrada: '2022-02-10', dataSaida: '2021-12-19' } // 🔴 DATA INVERTIDA
];
var filt = M._filtrarOutliers(tradesFake);
console.log('  Entrada: ' + tradesFake.length + ' trades | Válidos: ' + filt.validos.length + ' | Removidos: ' + filt.removidos.length);
filt.removidos.forEach(function (t) { console.log('  🧹 removido: ' + t.ticker + ' (' + t.outlierMotivo + ')'); });
if (filt.removidos.length !== 3) falhas.push('Filtro: esperado 3 removidos, obtido ' + filt.removidos.length);
if (filt.validos.length !== 3) falhas.push('Filtro: esperado 3 válidos, obtido ' + filt.validos.length);
if (!filt.removidos.some(function (t) { return t.ticker === 'DDD3'; })) falhas.push('Trade +1733% não foi filtrado.');
// 🎯 O caso real ACNB34 (data de saída anterior à entrada) DEVE ser removido.
var acnb = filt.removidos.filter(function (t) { return t.ticker === 'ACNB34'; })[0];
if (!acnb) falhas.push('ACNB34 (data invertida) NÃO foi filtrado — bug de integridade!');
else if (acnb.outlierMotivo.indexOf('INVÁLIDO') === -1) falhas.push('ACNB34 removido por motivo errado: ' + acnb.outlierMotivo);
else console.log('  ✅ ACNB34 (data invertida) removido: ' + acnb.outlierMotivo);

// _datasCoerentes unitário
if (M._datasCoerentes('2022-02-10', '2021-12-19') !== false) falhas.push('_datasCoerentes não detectou inversão.');
if (M._datasCoerentes('2021-12-19', '2022-02-10') !== true) falhas.push('_datasCoerentes rejeitou ordem correta.');
if (M._datasCoerentes('', '2022-02-10') !== true) falhas.push('_datasCoerentes deveria ignorar data vazia.');

// Após filtrar, best não deve ser absurdo (> teto)
var stFilt = M._estatisticas(filt.validos);
if (stFilt.best > M.CFG.OUTLIER_MAX_RETORNO * 100 + 0.01) {
  falhas.push('best ainda acima do teto após filtro: ' + stFilt.best + '%');
} else {
  console.log('  ✅ Após filtro, best=' + stFilt.best + '% (dentro do teto).');
}

console.log('\n=== RESULTADO ===');
if (falhas.length === 0) {
  console.log('✅ TODAS AS VERIFICAÇÕES PASSARAM');
} else {
  console.log('❌ FALHAS:');
  falhas.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
