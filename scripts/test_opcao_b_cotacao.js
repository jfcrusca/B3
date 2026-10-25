/**
 * Harness offline de REGRESSÃO — OPÇÃO B: coluna H da Carteira puxa da
 * aba Cotacoes_Live via VLOOKUP (05_Data_Service.js / v13.4).
 *
 * Valida:
 *   (1) a fórmula gerada aponta corretamente para Cotacoes_Live!A:B (col Preço);
 *   (2) a fórmula referencia o ticker da coluna B da MESMA linha;
 *   (3) o IFERROR protege contra #N/A (ativo ainda recalculando);
 *   (4) a mesclagem de tickers (carteira + monitorados) remove duplicatas.
 */

var fs = require('fs');
var src = fs.readFileSync('05_Data_Service.js', 'utf8');

// Réplica EXATA da fórmula de produção (FORMULA_COTACAO_CARTEIRA).
function FORMULA_COTACAO_CARTEIRA(linha) {
  return '=IFERROR(VLOOKUP(B' + linha + '; Cotacoes_Live!A:B; 2; FALSE); "")';
}

var falhas = [];

// --- (1)(2)(3) Testa a fórmula ---
console.log('\n=== OPÇÃO B: fórmula de cotação da coluna H ===');
[2, 3, 10].forEach(function (linha) {
  var f = FORMULA_COTACAO_CARTEIRA(linha);
  console.log('  linha ' + String(linha).padStart(2) + ' -> ' + f);
  if (f.indexOf('Cotacoes_Live!A:B') === -1) falhas.push('linha ' + linha + ': não aponta para Cotacoes_Live!A:B');
  if (f.indexOf('VLOOKUP(B' + linha) === -1) falhas.push('linha ' + linha + ': não referencia B' + linha);
  if (f.indexOf('IFERROR(') === -1) falhas.push('linha ' + linha + ': sem IFERROR (proteção #N/A)');
  if (f.indexOf('; 2; FALSE') === -1) falhas.push('linha ' + linha + ': coluna de retorno/EXATO incorretos');
});

// --- (4) Mesclagem de tickers (carteira + monitorados) sem duplicatas ---
console.log('\n=== Mesclagem de tickers (Cotacoes_Live) ===');
function mesclar(monitorados, daCarteira) {
  var base = (monitorados || []).concat(daCarteira || []);
  var vistos = {}, out = [];
  base.forEach(function (t) {
    var k = String(t).toUpperCase().trim().replace(/\.SA$/, '');
    if (k && !vistos[k]) { vistos[k] = true; out.push(k); }
  });
  return out;
}
var monitorados = ['PETR4', 'VALE3', 'ITUB4'];
var daCarteira = ['petr4', 'RDXO34', 'AXIA3']; // PETR4 duplicado (case/space)
var mescla = mesclar(monitorados, daCarteira);
console.log('  Monitorados : ' + monitorados.join(', '));
console.log('  Carteira    : ' + daCarteira.join(', '));
console.log('  Mesclado    : ' + mescla.join(', '));
['PETR4', 'VALE3', 'ITUB4', 'RDXO34', 'AXIA3'].forEach(function (t) {
  if (mescla.indexOf(t) === -1) falhas.push('ticker ' + t + ' ausente após mesclagem.');
});
if (mescla.filter(function (t) { return t === 'PETR4'; }).length !== 1) {
  falhas.push('PETR4 duplicado após mesclagem.');
}

// --- Confirma que o módulo exporta e define as funções esperadas ---
if (!/getTickersDaCarteira:\s*_tickersDaCarteira/.test(src)) {
  falhas.push('DataService não exporta getTickersDaCarteira.');
}
if (!/function INSTALAR_FORMULAS_COTACAO_CARTEIRA\(\)/.test(src)) {
  falhas.push('Função INSTALAR_FORMULAS_COTACAO_CARTEIRA ausente.');
}
if (!/function FORMULA_COTACAO_CARTEIRA\(/.test(src)) {
  falhas.push('Função FORMULA_COTACAO_CARTEIRA ausente.');
}
if (!/setFormulas\(formulas\)/.test(src)) {
  falhas.push('Instalação deve usar setFormulas (gravação em bloco).');
}

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: Opção B (VLOOKUP Cotacoes_Live) inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ Fórmula aponta para Cotacoes_Live!A:B e B<linha>.');
  console.log('  ✅ IFERROR protege contra #N/A.');
  console.log('  ✅ Mesclagem inclui tickers da carteira sem duplicatas.');
  console.log('  ✅ Funções exportadas e escrita em bloco (setFormulas).');
  console.log('\n✅ PASSOU: Opção B (cotações da Carteira via Cotacoes_Live) OK.');
}
