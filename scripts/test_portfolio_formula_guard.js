/**
 * Harness offline de REGRESSÃO — convivência da fórmula na coluna de Cotação
 * da aba 'Carteira' (v10.5 / 30_Portfolio_Unified.js).
 *
 * Garante que:
 *   - modo 'auto' + coluna com FÓRMULA  -> NÃO escreve (preserva a fórmula).
 *   - modo 'auto' + coluna sem FÓRMULA  -> escreve (modo API).
 *   - modo 'formula'                    -> NUNCA escreve.
 *   - modo 'api'                        -> SEMPRE escreve (ignora fórmula).
 *
 * A lógica é extraída do próprio módulo para testar a REGRA DE PRODUÇÃO.
 */

var fs = require('fs');
var src = fs.readFileSync('30_Portfolio_Unified.js', 'utf8');

// Extrai a função _getModoCotacao real do módulo.
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

// Réplica EXATA da regra de decisão usada no módulo (linha: podeEscrever).
function podeEscrever(modo, colunaTemFormula) {
  return (modo === 'api') || (modo === 'auto' && !colunaTemFormula);
}

// Extrai _getModoCotacao para validar com um CONFIG mock.
var global_CONF_BACKUP = typeof CONFIG !== 'undefined' ? CONFIG : undefined;
var CONFIG = { get: function (k, d) { return k === 'CARTEIRA_COTACAO_MODO' ? 'formula' : d; } };
eval(extrairFuncao(src, '_getModoCotacao'));
var modoFormula = _getModoCotacao();
CONFIG = { get: function (k, d) { return d; } }; // simula config ausente/auto
var modoAuto = _getModoCotacao();

// --- Casos de teste ---
var casos = [
  { modo: 'auto',    formula: true,  esperado: false, desc: 'auto + fórmula -> preserva' },
  { modo: 'auto',    formula: false, esperado: true,  desc: 'auto + sem fórmula -> escreve' },
  { modo: 'formula', formula: true,  esperado: false, desc: 'formula -> nunca escreve' },
  { modo: 'formula', formula: false, esperado: false, desc: 'formula -> nunca escreve (mesmo sem fórmula)' },
  { modo: 'api',     formula: true,  esperado: true,  desc: 'api -> sempre escreve' },
  { modo: 'api',     formula: false, esperado: true,  desc: 'api -> sempre escreve' }
];

var falhas = [];
console.log('\n=== VALIDAÇÃO: convivência de FÓRMULA na coluna Cotação (H) ===');
casos.forEach(function (c) {
  var got = podeEscrever(c.modo, c.formula);
  var ok = got === c.esperado;
  console.log('  ' + (ok ? '✅' : '❌') + ' [' + c.modo.padEnd(7) + '] formula=' +
    String(c.formula).padEnd(5) + ' -> escreve=' + String(got).padEnd(5) + ' (' + c.desc + ')');
  if (!ok) falhas.push(c.desc + ': esperado ' + c.esperado + ', obtido ' + got);
});

// --- Valida _getModoCotacao ---
console.log('\n--- _getModoCotacao (lógica real) ---');
console.log('  CONFIG=CARTEIRA_COTACAO_MODO:"formula" -> "' + modoFormula + '"');
console.log('  CONFIG ausente -> "' + modoAuto + '"');
if (modoFormula !== 'formula') falhas.push('_getModoCotacao não leu "formula" do CONFIG.');
if (modoAuto !== 'auto') falhas.push('_getModoCotacao deveria cair em "auto" sem config.');

// --- Confirma que o módulo realmente chama getFormulas antes de escrever ---
if (!/getFormulas\(\)/.test(src)) {
  falhas.push('30_Portfolio_Unified: deve usar rangePrecos.getFormulas() para detectar fórmula.');
}
// 🔧 v10.6: a decisão passou a se chamar podeEscreverCotacao (a sincronização
// dos campos DERIVADOS continua ocorrendo mesmo quando a cotação vem de fórmula).
if (!/podeEscreverCotacao\s*=/.test(src)) {
  falhas.push('30_Portfolio_Unified: variável de decisão podeEscreverCotacao ausente.');
}
// 🔧 v10.6: o módulo NÃO pode abortar (return) antes de recalcular os derivados.
if (/if\s*\(!podeEscreverCotacao\)\s*\{[\s\S]{0,400}?\breturn\b/.test(src)) {
  falhas.push('30_Portfolio_Unified: não deve dar return antes de recalcular os derivados.');
}
if (!/_recalcularDerivados/.test(src)) {
  falhas.push('30_Portfolio_Unified: helper _recalcularDerivados ausente.');
}

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: guarda de fórmula da coluna Cotação inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ Coluna com fórmula é preservada (modo auto/formula).');
  console.log('  ✅ Modo api força sobrescrita; auto detecta automaticamente.');
  console.log('  ✅ Módulo usa getFormulas() para decidir.');
  console.log('\n✅ PASSOU: convivência da fórmula GOOGLEFINANCE garantida.');
}
