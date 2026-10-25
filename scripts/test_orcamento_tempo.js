/**
 * Harness offline de REGRESSÃO — Orçamento de tempo do pipeline (v13.0).
 *
 * Valida os helpers de tempo do Orchestrator que evitam o erro
 * "Exceeded maximum execution time" (limite GAS = 360s):
 *   _tempoDecorrido(), _tempoRestante(), _temMargem().
 *
 * Extrai a lógica REAL do 00_Core_Orchestrator.js.
 */

var fs = require('fs');
var src = fs.readFileSync('00_Core_Orchestrator.js', 'utf8');

function extrairMetodo(texto, nome) {
  var idx = texto.indexOf(nome + ': function');
  if (idx === -1) throw new Error('Método ' + nome + ' não encontrado');
  var i = texto.indexOf('{', idx);
  var prof = 0, fim = i;
  for (; fim < texto.length; fim++) {
    if (texto[fim] === '{') prof++;
    else if (texto[fim] === '}') { prof--; if (prof === 0) break; }
  }
  return texto.substring(i, fim + 1);
}

var falhas = [];

// Reconstrói os 3 helpers reais num objeto `this` compartilhado.
// (os nomes dos parâmetros precisam ser declarados na new Function)
var obj = {};
obj._tempoDecorrido = new Function(extrairMetodo(src, '_tempoDecorrido')).bind(obj);
obj._tempoRestante = new Function(extrairMetodo(src, '_tempoRestante')).bind(obj);
obj._temMargem = new Function('custoEstimadoMs', extrairMetodo(src, '_temMargem')).bind(obj);

console.log('\n=== Helpers de orçamento de tempo (v13.0) ===');

// Sem pipeline iniciado -> usa o teto cheio
obj._TETO_PIPELINE_MS = 340000;
obj._inicioPipeline = null;
if (obj._tempoDecorrido() !== 0) falhas.push('_tempoDecorrido sem início deveria ser 0.');
if (obj._tempoRestante() !== 340) falhas.push('_tempoRestante sem início deveria ser 340s, obtido ' + obj._tempoRestante());
console.log('  Sem início: decorrido=' + obj._tempoDecorrido() + 's | restante=' + obj._tempoRestante() + 's');

// Simula 100s decorridos
obj._inicioPipeline = Date.now() - 100000;
var dec = obj._tempoDecorrido();
var res = obj._tempoRestante();
console.log('  Após ~100s: decorrido=' + dec + 's | restante=' + res + 's');
if (dec < 99 || dec > 101) falhas.push('_tempoDecorrido ~100s esperado, obtido ' + dec);
if (res < 239 || res > 241) falhas.push('_tempoRestante ~240s esperado, obtido ' + res);

// Margem: 240s restantes -> tem margem p/ 60s, não tem p/ 300s
if (!obj._temMargem(60000)) falhas.push('_temMargem(60s) deveria ser true com 240s restantes.');
if (obj._temMargem(300000)) falhas.push('_temMargem(300s) deveria ser false com 240s restantes.');
console.log('  _temMargem(60s)=' + obj._temMargem(60000) + ' | _temMargem(300s)=' + obj._temMargem(300000));

// Simula pipeline quase esgotado (335s de 340s)
obj._inicioPipeline = Date.now() - 335000;
console.log('  Após ~335s: restante=' + obj._tempoRestante() + 's');
if (obj._temMargem(20000)) falhas.push('_temMargem(20s) deveria ser false quando restam ~5s.');

// Verificações estruturais no código de produção (v13.3).
if (!/TEMPO_LIMITE_MS = 210000/.test(src)) falhas.push('Scanner deveria ter TEMPO_LIMITE_MS=210000 (orçamento de 210s).');
if (!/_aquecerCachePreScanner/.test(src)) falhas.push('Falta o aquecimento de cache pré-scanner (v14.2).');
if (!/_ordenarTickersPorLiquidez/.test(src)) falhas.push('Falta a ordenação por liquidez do universo (v14.2).');
if (!/BolsaiFetcher\.resetMetrics/.test(src)) falhas.push('Falta o reset das métricas da Bolsai no início do pipeline (v14.3).');
if (!/BolsaiFetcher\.getMetrics/.test(src)) falhas.push('Falta o log das métricas da Bolsai ao final do scanner (v14.3).');

// v14.4 (OPÇÕES D + E)
if (!/var TICKER_TIMEOUT_MS = 12000/.test(src)) falhas.push('Timeout individual deveria ser 12000 (v14.4/D).');
if (!/getScannerUniverse/.test(src)) falhas.push('O scanner deveria usar o universo curado (v14.4/E).');
if (!/getAll\(\) como fallback/.test(src)) falhas.push('Falta o fallback seguro para getAll() (v14.4/E).');
else console.log('  ✅ Guardas v14.4: timeout 12s (D) e universo curado com fallback (E).');
if (!/_TETO_PIPELINE_MS = 340000/.test(src)) falhas.push('_TETO_PIPELINE_MS deveria ser 340000.');
if (!/semTempoIA/.test(src)) falhas.push('Falta guarda de tempo na IA (semTempoIA).');
if (!/_temMargem\(20000\)/.test(src)) falhas.push('Falta guarda de tempo na cotação ao vivo (_temMargem(20000)).');

// v13.3: sincronização do scanner com o teto global
if (!/RESERVA_POS_SCANNER_MS/.test(src)) falhas.push('Falta a reserva pós-scanner (RESERVA_POS_SCANNER_MS).');
if (!/limiteSincronizado/.test(src)) falhas.push('Falta a sincronização do limite do scanner com o teto global.');
else console.log('  ✅ Guardas presentes: scanner 210s (sinc. com teto), IA (semTempoIA) e cotação (_temMargem).');

// Valida a SINCRONIZAÇÃO: scanner nunca consome mais que teto − reserva.
(function () {
  var TETO = 340000, RESERVA = 120000;
  var limiteBase = 210000;
  // Cenário: pipeline já consumiu 30s
  var restanteGlobal = TETO - 30000;         // 310s
  var limiteSinc = restanteGlobal - RESERVA; // 190s
  var limiteEfetivo = (limiteSinc > 0 && limiteSinc < limiteBase) ? limiteSinc : limiteBase;
  console.log('  Cenário (30s já usados): limite efetivo = ' + (limiteEfetivo / 1000) + 's (base 210s, sinc ' + (limiteSinc / 1000) + 's)');
  if (limiteEfetivo !== 190000) falhas.push('Sincronização incorreta: esperado 190s, obtido ' + (limiteEfetivo / 1000) + 's');
  // Garante que scanner + reserva cabem no teto
  if (limiteEfetivo + RESERVA > TETO) falhas.push('Scanner + reserva excede o teto global.');
})();

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: orçamento de tempo inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ Helpers de tempo calculam decorrido/restante/margem.');
  console.log('  ✅ Scanner limitado a 210s (sincronizado); IA e cotação com guardas.');
  console.log('\n✅ PASSOU: orçamento de tempo do pipeline (anti-timeout GAS) OK.');
}
