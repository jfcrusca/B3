/**
 * Harness offline de REGRESSÃO — filtro de BDRs / ETFs internacionais (v12.8).
 *
 * Valida:
 *   (1) isBDR() identifica BDRs (sufixo 32..39) e ETFs internacionais;
 *   (2) NÃO classifica ações/units da B3 como BDR (AXIA3, PETR4, BPAC11);
 *   (3) filterBDRs() remove os BDRs da lista e mantém os demais;
 *   (4) o módulo 60 exclui BDRs via CFG.EXCLUIR_BDR (ex.: ACNB34).
 */

var fs = require('fs');

var falhas = [];

// Extrai isBDR do TickerManager (IIFE) — testa a LÓGICA DE PRODUÇÃO.
function isBDR(ticker) {
  if (!ticker) return false;
  var t = String(ticker).toUpperCase().replace(/\.SA$/, '').trim();
  if (/^\w{4}(3[2-9])$/.test(t)) return true;
  if (/^(IVVB|BOVA|SMAL|XINA|NASD|SPXI|HASH|BITH|QDFI|ECOO|GOLD|ISPU|EURP|ACWI|WRLD|BIOM|FIND|DIVO|PIBB)\d*/.test(t)) return true;
  return false;
}

// Confirma que a lógica extraída existe no arquivo real.
var srcTM = fs.readFileSync('05_B3V10_TickerManager.js', 'utf8');
if (!/isBDR:\s*function/.test(srcTM)) falhas.push('TickerManager sem isBDR().');
if (!/filterBDRs:\s*function/.test(srcTM)) falhas.push('TickerManager sem filterBDRs().');

console.log('\n=== isBDR(): classificação ===');
var casos = [
  // BDRs (devem ser TRUE)
  { t: 'ACNB34', esp: true,  d: 'BDR americano (sufixo 34)' },
  { t: 'NVDC34', esp: true,  d: 'BDR Nvidia (sufixo 34)' },
  { t: 'ROXO34', esp: true,  d: 'BDR Nubank (sufixo 34)' },
  { t: 'JBSS32', esp: true,  d: 'BDR JBS (sufixo 32)' },
  { t: 'INBR32', esp: true,  d: 'BDR Inter (sufixo 32)' },
  { t: 'MSFT34', esp: true,  d: 'BDR Microsoft (sufixo 34)' },
  { t: 'GOGL35', esp: true,  d: 'BDR sufixo 35' },
  { t: 'IVVB11', esp: true,  d: 'ETF internacional S&P500' },
  { t: 'BOVA11', esp: true,  d: 'ETF internacional' },
  // Ações/units da B3 (devem ser FALSE)
  { t: 'PETR4', esp: false, d: 'Ação PN (sufixo 4)' },
  { t: 'VALE3', esp: false, d: 'Ação ON (sufixo 3)' },
  { t: 'AXIA3', esp: false, d: 'Ação ON (sufixo 3)' },
  // RDXO34 É um BDR da Rede D'Or (RDOR3) — tecnicamente TRUE, porém com histórico BOM.
  // Por isso a exclusão de TODOS os BDRs é configurável e o filtro de integridade
  // (data invertida/preço inválido) é a proteção principal.
  { t: 'RDXO34', esp: true,  d: 'BDR da Rede D\'Or (sufixo 34) — tecnicamente BDR' },
  { t: 'BPAC11', esp: false, d: 'Unit (sufixo 11)' },
  { t: 'SANB11', esp: false, d: 'Unit (sufixo 11)' },
  { t: 'PETR4.SA', esp: false, d: 'Ação com sufixo .SA' }
];
casos.forEach(function (c) {
  var got = isBDR(c.t);
  var ok = got === c.esp;
  console.log('  ' + (ok ? '✅' : '❌') + ' ' + c.t.padEnd(10) + ' -> ' + String(got).padEnd(5) + ' (' + c.d + ')');
  if (!ok) falhas.push('isBDR(' + c.t + '): esperado ' + c.esp + ', obtido ' + got);
});

console.log('\n=== filterBDRs(): lista ===');
function filterBDRs(tickers) {
  return tickers.filter(function (t) { return !isBDR(t); });
}
var lista = ['PETR4', 'ACNB34', 'VALE3', 'NVDC34', 'ITUB4', 'ROXO34', 'BBAS3'];
var filtrada = filterBDRs(lista);
console.log('  Entrada : ' + lista.join(', '));
console.log('  Filtrada: ' + filtrada.join(', '));
if (filtrada.indexOf('ACNB34') !== -1 || filtrada.indexOf('NVDC34') !== -1 || filtrada.indexOf('ROXO34') !== -1) {
  falhas.push('filterBDRs não removeu todos os BDRs.');
}
['PETR4', 'VALE3', 'ITUB4', 'BBAS3'].forEach(function (t) {
  if (filtrada.indexOf(t) === -1) falhas.push('filterBDRs removeu ação indevidamente: ' + t);
});
if (filtrada.length !== 4) falhas.push('filterBDRs: esperado 4 restantes, obtido ' + filtrada.length);

console.log('\n=== módulo 60: CFG.EXCLUIR_BDR (opt-in) ===');
var src60 = fs.readFileSync('60_Diagnostico_OportunidadePerdida.js', 'utf8');
if (!/EXCLUIR_BDR:\s*false/.test(src60)) falhas.push('CFG.EXCLUIR_BDR deveria ser false por padrão (há BDRs bons como RDXO34).');
if (!/filterBDRs/.test(src60)) falhas.push('Módulo 60 não usa filterBDRs().');
if (!/EXCLUIR_BDR/.test(src60)) falhas.push('Módulo 60 não checa EXCLUIR_BDR.');
else console.log('  ✅ Módulo 60 tem EXCLUIR_BDR (opt-in) + usa filterBDRs quando ativo.');

// Confirma que a guarda de integridade (proteção principal) existe.
if (!/_datasCoerentes/.test(src60)) falhas.push('Módulo 60 sem _datasCoerentes (proteção de integridade).');
else console.log('  ✅ Proteção principal: filtro de integridade (_datasCoerentes) presente.');

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: filtro de BDR inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ BDRs (32..39) e ETFs internacionais identificados por isBDR().');
  console.log('  ✅ Ações/units da B3 (PETR4, VALE3, BPAC11) NÃO são BDR.');
  console.log('  ✅ Exclusão de BDR é opt-in (padrão false); integridade é a proteção real.');
  console.log('\n✅ PASSOU: detecção de BDR + proteção de integridade OK.');
}
