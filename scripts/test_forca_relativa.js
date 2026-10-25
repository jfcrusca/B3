/**
 * Harness offline de REGRESSÃO — Força Relativa vs. Benchmark (BOVA11) — v13.2.
 *
 * Valida o bloco de "Momentum Relativo" no _calcularScoreSistêmico:
 *   - ativo que BATE o índice (RS +) recebe BÔNUS;
 *   - ativo que PERDE do índice (RS -) recebe PENALIDADE;
 *   - SEM benchmark (benchmarkReturn21d ausente) -> SEM ajuste (fail-open);
 *   - retorno21d presente na estrutura _analisarEstruturaMercado.
 *
 * Extrai a lógica REAL do 22_Core_Analyzers.js.
 */

var fs = require('fs');
var src = fs.readFileSync('22_Core_Analyzers.js', 'utf8');

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

// Stubs globais exigidos pela função.
var ticker = 'TESTE';
var setup = '';
var CORE22_CFG = {};
global.CONFIG = { get: function (k, d) { return d; } };
var _realLog = console.log, _realWarn = console.warn;
console.warn = function () {};
console.log = function () {};   // silencia logs internos durante o eval/chamadas

eval(extrairFuncao(src, '_calcularScoreSistêmico'));

// Restaura o console para o TESTE imprimir (a função usa console dinamicamente).
console.log = _realLog;

var falhas = [];

// Helper de indicadores "neutros" (sem bônus/penalidade de tendência etc.)
function ind() { return { adx: 22, rsi: 50, volumeRelativo: 1.0, ema9: 100, ema21: 100, ema50: 100, ema200: 100, bollinger: { upper: 120, middle: 100, lower: 80, width: 40 } }; }
function est(over) { return Object.assign({ h50: 130, l50: 70, inFiboZone: false, temConfluencia: false, ganhoRapidoPct: 0, distTopoPct: 0.1, retorno21d: 0 }, over || {}); }
function rsc() { return { rrRealista: 2.0, invalidoPorStop: false }; }

// Calcula só o DELTA da força relativa (isolando os outros fatores).
function deltaRS(retornoAtivo, retornoBench) {
  var ibov = { regime: 'NEUTRAL', benchmarkReturn21d: retornoBench };
  var base = _calcularScoreSistêmico(100, ind(), est({ retorno21d: retornoAtivo }), rsc(), 0, { regime: 'NEUTRAL' });
  var comRS = _calcularScoreSistêmico(100, ind(), est({ retorno21d: retornoAtivo }), rsc(), 0, ibov);
  return comRS - base;
}

console.log('\n=== FORÇA RELATIVA vs. BENCHMARK (v13.2) ===');
var casos = [
  { ativo: 0.15, bench: 0.03, esp: 12, d: 'ativo +15% vs bench +3% (RS +12p.p.) -> +12' },
  { ativo: 0.09, bench: 0.03, esp: 8,  d: 'ativo +9%  vs bench +3% (RS +6p.p.)  -> +8' },
  { ativo: 0.06, bench: 0.03, esp: 4,  d: 'ativo +6%  vs bench +3% (RS +3p.p.)  -> +4' },
  { ativo: 0.00, bench: 0.00, esp: 0,  d: 'ativo = bench (RS 0)                 -> 0' },
  { ativo: -0.03, bench: 0.00, esp: -4, d: 'ativo -3% vs bench 0 (RS -3p.p.)     -> -4' },
  { ativo: -0.05, bench: 0.00, esp: -8, d: 'ativo -5% vs bench 0 (RS -5p.p.)     -> -8' },
  { ativo: -0.09, bench: 0.00, esp: -8, d: 'ativo -9% vs bench 0 (RS -9p.p.)     -> -8' },
  { ativo: -0.20, bench: 0.00, esp: -12, d: 'ativo -20% vs bench 0 (RS -20p.p.)   -> -12' }
];
casos.forEach(function (c) {
  var d = deltaRS(c.ativo, c.bench);
  var ok = d === c.esp;
  console.log('  ' + (ok ? '✅' : '❌') + ' ' + c.d + ' (obtido: ' + d + ')');
  if (!ok) falhas.push('RS: esperado ' + c.esp + ', obtido ' + d + ' [' + c.d + ']');
});

// Sem benchmark -> sem ajuste (fail-open)
console.log('\n=== Fail-open (sem benchmark) ===');
var semBench = _calcularScoreSistêmico(100, ind(), est({ retorno21d: 0.15 }), rsc(), 0, { regime: 'NEUTRAL' });
var semBenchNull = _calcularScoreSistêmico(100, ind(), est({ retorno21d: 0.15 }), rsc(), 0, null);
if (semBench !== semBenchNull) falhas.push('Sem benchmark (ou null) deveria dar o mesmo score.');
else console.log('  ✅ Sem benchmark: score inalterado (' + semBench + ').');

// Estrutura: retorno21d existe no retorno de _analisarEstruturaMercado
if (!/retorno21d:\s*parseFloat/.test(src)) falhas.push('_analisarEstruturaMercado não retorna retorno21d.');
if (!/aposForcaRelativa/.test(src)) falhas.push('Falta o snap de diagnóstico aposForcaRelativa.');
if (!/benchmarkReturn21d/.test(src)) falhas.push('Falta uso de benchmarkReturn21d no score.');
else console.log('  ✅ Estrutura e snap de diagnóstico presentes.');

// Orchestrator baixa BOVA11
var srcOrq = fs.readFileSync('00_Core_Orchestrator.js', 'utf8');
if (!/getMarketData\('BOVA11'/.test(srcOrq)) falhas.push('Orchestrator não baixa BOVA11.');
else console.log('  ✅ Orchestrator baixa BOVA11 como benchmark.');

// 🔧 v13.3: normalização defensiva da Força Relativa antes da gravação
if (!/_corrigidosFR/.test(srcOrq)) falhas.push('Falta a normalização defensiva da Força Relativa (_corrigidosFR).');
if (!/this\._benchmarkReturn21d/.test(srcOrq)) falhas.push('Orchestrator não guarda _benchmarkReturn21d.');
else console.log('  ✅ Normalização defensiva presente (recalcula Força Rel. se ausente).');

// Simula a normalização: op sem forcaRelativa + retorno21d + bench => recalculado
(function () {
  var bench = 0.05;
  var lista = [
    { ticker: 'A', retorno21d: 0.10 },                 // sem forcaRelativa -> recalcula
    { ticker: 'B', retorno21d: 0.02, forcaRelativa: -0.03 } // já tem -> mantém
  ];
  for (var i = 0; i < lista.length; i++) {
    var op = lista[i];
    var ausente = (op.forcaRelativa === undefined || op.forcaRelativa === null);
    if (ausente && typeof bench === 'number' && typeof op.retorno21d === 'number') {
      op.forcaRelativa = parseFloat((op.retorno21d - bench).toFixed(4));
    }
  }
  console.log('  Normalização: A.forcaRelativa=' + lista[0].forcaRelativa + ' (esperado 0.05) | B.forcaRelativa=' + lista[1].forcaRelativa + ' (esperado -0.03)');
  if (lista[0].forcaRelativa !== 0.05) falhas.push('Normalização: A deveria ser 0.05, obtido ' + lista[0].forcaRelativa);
  if (lista[1].forcaRelativa !== -0.03) falhas.push('Normalização: B não deveria ser alterado.');
})();

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: força relativa inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ Bônus/penalidade corretos por faixa de força relativa.');
  console.log('  ✅ Fail-open sem benchmark.');
  console.log('  ✅ Orchestrator integra BOVA11; estrutura expõe retorno21d.');
  console.log('\n✅ PASSOU: Força Relativa vs. BOVA11 (v13.2) OK.');
}
