/**
 * Harness offline — valida a MIGRAÇÃO DE CABEÇALHO da 'Resultados_Analise' (v13.2).
 * Garante que planilhas antigas (26 colunas) sejam atualizadas para 27 com a
 * coluna "Força Rel. %", evitando a aba ficar sem a coluna nova.
 */

var fs = require('fs');
var w = fs.readFileSync('00_SheetWriter.js', 'utf8');

var falhas = [];

console.log('\n=== Migração de cabeçalho (00_SheetWriter v13.2) ===');

// Deve existir a lógica de validação/atualização do cabeçalho
if (!/precisaAtualizar/.test(w)) falhas.push('Falta a lógica precisaAtualizar no cabeçalho.');
if (!/setValues\(\[CONFIG\.HEADERS\]\)/.test(w)) falhas.push('Falta a reescrita do cabeçalho (setValues).');
if (!/Cabeçalho atualizado para/.test(w)) falhas.push('Falta o log de cabeçalho atualizado.');
else console.log('  ✅ Lógica de migração de cabeçalho presente.');

// O log de console deve ser DINÂMICO (não mais "26 cols" hardcoded).
// Verifica apenas dentro de console.log(...), ignorando comentários.
var logsHardcoded = (w.match(/console\.log\([^)]*26 cols/g) || []);
if (logsHardcoded.length > 0) falhas.push('Ainda há console.log hardcoded com "26 cols".');
else console.log('  ✅ Nenhum console.log com "(26 cols)" hardcoded.');
// Confirma que o log de salvamento é dinâmico
if (!/Salvando '\s*\+\s*listaCompleta\.length[\s\S]{0,120}CONFIG\.HEADERS\.length/.test(w)) {
  falhas.push('Log de salvamento não usa CONFIG.HEADERS.length.');
} else console.log('  ✅ Log de salvamento usa CONFIG.HEADERS.length (dinâmico).');

// CONFIG.HEADERS tem 27
var m = w.match(/HEADERS:\s*\[([\s\S]*?)\]/);
var n = (m[1].match(/'/g) || []).length / 2;
console.log('  CONFIG.HEADERS count = ' + n);
if (n !== 27) falhas.push('CONFIG.HEADERS deveria ter 27 colunas, mas tem ' + n + '.');
if (!/Força Rel\. %/.test(w)) falhas.push('CONFIG.HEADERS não inclui "Força Rel. %".');

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: migração de cabeçalho inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ Cabeçalho migrado automaticamente (26 -> 27).');
  console.log('  ✅ Log dinâmico; headers com Força Rel. %.');
  console.log('\n✅ PASSOU: migração de cabeçalho OK.');
}
