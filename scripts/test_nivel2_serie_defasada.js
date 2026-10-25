/**
 * Harness offline para validar as GUARDAS NÍVEL 1 + NÍVEL 2.
 * Reproduz os casos REAIS da planilha Resultados_Analise (planilha de 11/09 21:04).
 *
 * Nível 1: guardas de série desordenada e fator implausível (dentro do ajuste).
 * Nível 2: detecção de série DEFASADA que descarta a fonte (em vez de reescalonar).
 */

// --- Cópia fiel das funções de 05_Data_Service.js ---
function _getLastPrice(candles) {
  if (!Array.isArray(candles)) return null;
  for (var i = candles.length - 1; i >= 0; i--) {
    var c = candles[i];
    if (c && typeof c.close === 'number' && c.close > 0) return c.close;
  }
  return null;
}

function _serieDesatualizada(candles, precoVivo) {
  if (!candles || !Array.isArray(candles) || candles.length === 0) return false;
  if (!(precoVivo > 0)) return false;
  var ultimoClose = _getLastPrice(candles);
  if (!(ultimoClose > 0)) return true;
  var diffPct = Math.abs(precoVivo - ultimoClose) / ultimoClose;
  return diffPct > 0.15;
}

// --- Dados reais extraídos da planilha (candle close vs preço ao vivo) ---
// Formato: { ticker, candleClose, precoVivo, divergenciaRelatada }
var CASOS_REAIS = [
  { ticker: 'SBSP3', candleClose: 117.04, precoVivo: 27.04, div: '77%' },
  { ticker: 'DASA3', candleClose: 1.26,   precoVivo: 2.65,  div: '110%' },
  { ticker: 'PETR4', candleClose: 30.43,  precoVivo: 49.00, div: '61%' },
  { ticker: 'BHIA3', candleClose: 3.05,   precoVivo: 0.76,  div: '75%' },
  { ticker: 'USIM5', candleClose: 4.18,   precoVivo: 7.38,  div: '77%' },
  { ticker: 'ITUB4', candleClose: 36.95,  precoVivo: 42.73, div: '16%' },
  { ticker: 'WEGE3', candleClose: 37.59,  precoVivo: 51.49, div: '37%' },
  { ticker: 'CPLE3', candleClose: 11.18,  precoVivo: 15.96, div: '43%' },
  // Um ativo SAUDÁVEL (divergência pequena) para garantir que NÃO descartamos bons dados
  { ticker: 'SAUD3', candleClose: 10.00,  precoVivo: 10.30,  div: '3%' }
];

function serieCom(closeFinal) {
  return [
    { date: new Date(2024, 0, 1), close: closeFinal * 0.95, high: closeFinal, low: closeFinal * 0.9 },
    { date: new Date(2024, 0, 2), close: closeFinal * 0.98, high: closeFinal, low: closeFinal * 0.9 },
    { date: new Date(2024, 0, 3), close: closeFinal,        high: closeFinal, low: closeFinal * 0.9 }
  ];
}

var falhas = [];
console.log('=== VALIDAÇÃO NÍVEL 2 (detecção de série defasada) ===\n');
console.log('Ticker | candle | vivo   | div%  | DESCARTADA?');
console.log('-------|--------|--------|-------|------------');

CASOS_REAIS.forEach(function (c) {
  var descartar = _serieDesatualizada(serieCom(c.candleClose), c.precoVivo);
  var esperado = parseFloat(c.div) > 15; // > 15% deve descartar
  var ok = descartar === esperado;
  console.log(
    c.ticker.padEnd(6) + ' | ' +
    String(c.candleClose).padEnd(6) + ' | ' +
    String(c.precoVivo).padEnd(6) + ' | ' +
    c.div.padEnd(5) + ' | ' +
    (descartar ? 'SIM (fonte trocada)' : 'não (aceita)') + (ok ? ' ✅' : ' ❌')
  );
  if (!ok) falhas.push(c.ticker + ': esperado ' + (esperado ? 'descartar' : 'aceitar') + ', obteve ' + (descartar ? 'descartar' : 'aceitar'));
});

console.log('\n=== RESULTADO ===');
var bonsMantidos = !_serieDesatualizada(serieCom(10.00), 10.30);
console.log('Ativo saudável (SAUD3, +3%) mantido: ' + (bonsMantidos ? '✅' : '❌'));
if (!bonsMantidos) falhas.push('Ativo saudável foi descartado indevidamente');

if (falhas.length === 0) {
  console.log('✅ TODAS AS VERIFICAÇÕES PASSARAM');
} else {
  console.log('❌ FALHAS:');
  falhas.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
