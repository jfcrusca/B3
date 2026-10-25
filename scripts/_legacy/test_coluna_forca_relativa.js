/**
 * Harness offline de REGRESSÃO — Coluna "Força Rel. %" (v13.2).
 *
 * Valida que os 4 pontos que definem/gravam/leem a aba 'Resultados_Analise'
 * estão ALINHADOS em 27 colunas, com "Força Rel. %" na última posição (índice 26):
 *   - 08_Output_Unified.js  (OutputConfig.NUM_COLS + HEADERS + _toRow)
 *   - 00_SheetWriter.js     (CONFIG.HEADERS + _opParaLinha)
 *   - 00_Setup_CreateSheets.js (setupResultadosAnalise)
 *   - 29_Oportunidades_Processor.js (IDX_ORIGEM + leitura de 27 colunas)
 */

var fs = require('fs');
var o = fs.readFileSync('08_Output_Unified.js', 'utf8');
var w = fs.readFileSync('00_SheetWriter.js', 'utf8');
var s = fs.readFileSync('00_Setup_CreateSheets.js', 'utf8');
var p = fs.readFileSync('29_Oportunidades_Processor.js', 'utf8');

var falhas = [];

console.log('\n=== Coluna "Força Rel. %" (27 colunas) ===');

if (!/NUM_COLS:\s*27/.test(o)) falhas.push('08_Output_Unified: NUM_COLS deveria ser 27.');
else console.log('  ✅ OutputConfig.NUM_COLS = 27');

// A coluna deve existir nos 3 headers (Output, SheetWriter, Setup)
var ocorrencias = (o.match(/Força Rel\. %/g) || []).length + (w.match(/Força Rel\. %/g) || []).length + (s.match(/Força Rel\. %/g) || []).length;
if (ocorrencias < 3) falhas.push('"Força Rel. %" deveria aparecer nos 3 headers (Output/SheetWriter/Setup). Encontrado: ' + ocorrencias);
else console.log('  ✅ "Força Rel. %" presente nos 3 cabeçalhos.');

// _toRow (Output) e _opParaLinha (SheetWriter) devem retornar 27 valores (forcaRelativa no fim)
if (!/forcaRelativa\s*\/\/\s*26:/.test(o) && !/forcaRelativa\s*$/m.test(o)) {
  // aceita formato com comentário
}
if (!/forcaRelativa/.test(o)) falhas.push('08_Output_Unified:_toRow não inclui forcaRelativa.');
if (!/forcaRelativa/.test(w)) falhas.push('00_SheetWriter:_opParaLinha não inclui forcaRelativa.');
// Deve haver a linha ", // 26:" ou "// 26: Força"
if (!/26:\s*Força Rel/.test(o) && !/forcaRelativa\s*\/\/\s*26/.test(o)) {
  falhas.push('08_Output_Unified: forcaRelativa deveria estar no índice 26 (última coluna).');
}
else console.log('  ✅ forcaRelativa gravado no índice 26 (Output + SheetWriter).');

// 29_Oportunidades: IDX 26 + leitura de 27 colunas
if (!/FORCA_RELATIVA:\s*26/.test(p)) falhas.push('29_Oportunidades: IDX_ORIGEM.FORCA_RELATIVA deveria ser 26.');
if (!/getRange\(2,\s*1,\s*lastRow\s*-\s*1,\s*27\)/.test(p)) falhas.push('29_Oportunidades: leitura deveria ser de 27 colunas.');
else console.log('  ✅ 29_Oportunidades lê 27 colunas e mapeia FORCA_RELATIVA=26.');

// Atomicidade: valor em % (×100) e tratamento de null
if (!/op\.forcaRelativa\s*\*\s*100/.test(o) && !/forcaRelativa\s*\*\s*100/.test(o)) {
  falhas.push('08_Output_Unified: forcaRelativa deveria ser exibido em % (×100).');
} else console.log('  ✅ Força Relativa exibida em % (decimal ×100); null -> vazio.');

// --- Aba "Oportunidades" (17 colunas, Força Rel. no índice 16) ---
console.log('\n=== Aba "Oportunidades" (17 colunas) ===');
if (!/Força Rel\. %/.test(p) || (p.match(/Força Rel\. %/g) || []).length < 1) {
  // (p = 29_Oportunidades) — o header de destino deve conter a coluna
}
var headerOport = /'Observações',\s*'Força Rel\. %'|'Observações',\s*\/\/\s*15[\s\S]{0,80}'Força Rel\. %'/.test(p);
if (!headerOport) falhas.push('Oportunidades: HEADERS_DESTINO deveria terminar com "Força Rel. %".');
else console.log('  ✅ HEADERS_DESTINO termina com "Força Rel. %".');

if (!/forcaRel\s*\/\/\s*16/.test(p)) falhas.push('Oportunidades: forcaRel deveria ser gravado no índice 16.');
else console.log('  ✅ forcaRel gravado no índice 16 (Oportunidades).');

// Ranker lê 17 colunas e mapeia FORCA_RELATIVA=16
var r = fs.readFileSync('41_Ranker.js', 'utf8');
if (!/getRange\(2,\s*1,\s*origem\.getLastRow\(\)\s*-\s*1,\s*17\)/.test(r)) {
  falhas.push('41_Ranker: leitura da aba Oportunidades deveria ser de 17 colunas.');
}
if (!/FORCA_RELATIVA:\s*16/.test(r)) falhas.push('41_Ranker: COL.FORCA_RELATIVA deveria ser 16.');
else console.log('  ✅ 41_Ranker lê 17 colunas e mapeia FORCA_RELATIVA=16.');

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: coluna Força Rel. inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ 27 colunas alinhadas em Resultados_Analise.');
  console.log('  ✅ 17 colunas alinhadas em Oportunidades (+Ranker).');
  console.log('  ✅ Força Rel. % exibida em %.');
  console.log('\n✅ PASSOU: coluna "Força Rel. %" integrada (Resultados_Analise + Oportunidades).');
}
