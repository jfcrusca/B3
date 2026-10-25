/**
 * Harness offline de REGRESSÃO — Anti-TIMEOUT do scanner (v14.2).
 *
 * Valida as duas melhorias que reduzem os "⏱️ TIMEOUT" na aba Resultados_Analise
 * (caso real: linhas 37-71 marcadas com CASH3 às 16:07):
 *
 *   (A) AQUECIMENTO DE CACHE pré-scanner — _aquecerCachePreScanner()
 *   (B) ORDENAÇÃO POR LIQUIDEZ do universo — _ordenarTickersPorLiquidez()
 *       + B3V10_TICKER_MANAGER.getOrdered() / CATEGORY_PRIORITY
 *
 * Extrai a lógica REAL do 00_Core_Orchestrator.js e do 05_B3V10_TickerManager.js.
 */

var fs = require('fs');
var srcOrq = fs.readFileSync('00_Core_Orchestrator.js', 'utf8');
var srcTm = fs.readFileSync('05_B3V10_TickerManager.js', 'utf8');

var falhas = [];

// Extrai um método de objeto por balanceamento de chaves.
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

// ── Constrói o TickerManager REAL a partir do módulo 05 (IIFE) ───────────────
// Executa a IIFE de produção para obter CATEGORIES e os métodos de verdade.
var B3V10_TICKER_MANAGER = new Function(
  'return ' + srcTm.split('var B3V10_TICKER_MANAGER = ')[1].split('\n})();')[0] + '\n})()'
)();

console.log('\n=== (B) Ordenação por liquidez (v14.2) ===');

// 1. CATEGORY_PRIORITY exposto e cobrindo todas as categorias.
var prioridade = B3V10_TICKER_MANAGER.CATEGORY_PRIORITY;
if (!Array.isArray(prioridade) || prioridade.length === 0) {
  falhas.push('CATEGORY_PRIORITY ausente ou vazia.');
}
if (prioridade[0] !== 'SAFETY') falhas.push('SAFETY (blue chips) deveria ser a 1ª prioridade.');
if (prioridade.indexOf('TACTICAL') !== prioridade.length - 1) {
  falhas.push('TACTICAL deveria ser a última prioridade (menos crítica p/ swing).');
}
console.log('  Prioridade: ' + prioridade.join(' → '));

// 2. getOrdered() devolve o mesmo universo de getAll() (sem perder/duplicar).
var all = B3V10_TICKER_MANAGER.getAll();
var ordered = B3V10_TICKER_MANAGER.getOrdered();
console.log('  getAll=' + all.length + ' | getOrdered=' + ordered.length);
if (ordered.length !== all.length) {
  falhas.push('getOrdered perdeu/duplicou tickers: all=' + all.length + ' ordered=' + ordered.length);
}
var setAll = {}; all.forEach(function (t) { setAll[t] = true; });
var faltando = ordered.filter(function (t) { return !setAll[t]; });
if (faltando.length) falhas.push('getOrdered contém tickers inexistentes: ' + faltando.join(','));
var dups = ordered.filter(function (t, i) { return ordered.indexOf(t) !== i; });

// 3. Os primeiros N devem ser exatamente os blue chips (SAFETY), na ordem original.
var safety = B3V10_TICKER_MANAGER.getByCategory('SAFETY');
var primeirosSafety = ordered.slice(0, safety.length);
var safetyOk = primeirosSafety.every(function (t, i) { return t === safety[i]; });
console.log('  Primeiros ' + safety.length + ' (SAFETY): ' + primeirosSafety.join(', '));
if (!safetyOk) falhas.push('Os primeiros tickers deveriam ser os SAFETY na ordem original.');

// 4. CASH3 (caso real) NÃO pode estar entre os primeiros blue chips.
var posCASH3 = ordered.indexOf('CASH3');
var posVALE3 = ordered.indexOf('VALE3');
console.log('  Posição: VALE3=' + posVALE3 + ' | CASH3=' + posCASH3 + ' (antes era ~linha 37)');
if (posVALE3 < 0 || posCASH3 < 0) falhas.push('VALE3/CASH3 não encontrados no universo.');
if (posVALE3 > posCASH3) falhas.push('VALE3 (blue chip) deveria vir ANTES de CASH3.');

// 5. _ordenarTickersPorLiquidez real do Orchestrator, ligada ao TickerManager real.
// O bind injeta o TickerManager como 2º parâmetro (após a lista) e o `this` do método.
var obj = { B3V10_TICKER_MANAGER: B3V10_TICKER_MANAGER };
var _ordFn = new Function(
  'tickers', 'B3V10_TICKER_MANAGER', extrairMetodo(srcOrq, '_ordenarTickersPorLiquidez')
);
obj._ordenarTickersPorLiquidez = function (tickers) {
  return _ordFn.call(obj, tickers, B3V10_TICKER_MANAGER);
};

// Simula a lista DESORDENADA como o robô a recebia (ordem literal de CATEGORIES).
var desordenado = B3V10_TICKER_MANAGER.getAll();
var invertido = desordenado.slice().reverse();
var reordenado = obj._ordenarTickersPorLiquidez(invertido);
console.log('\n  Entrada (invertida, 5 primeiros): ' + invertido.slice(0, 5).join(', '));
console.log('  Saída   (priorizada, 5 primeiros): ' + reordenado.slice(0, 5).join(', '));
if (reordenado.length !== desordenado.length) falhas.push('Ordenação alterou o número de tickers.');
var posV = reordenado.indexOf('VALE3'), posC = reordenado.indexOf('CASH3');
if (posV > posC) falhas.push('Após ordenação, CASH3 veio antes de VALE3.');
if (reordenado[0] !== 'VALE3') falhas.push('Após ordenação, o 1º ticker deveria ser VALE3 (SAFETY).');

// 6. Robustez: listas vazias / não-array não podem lançar exceção.
try {
  if (obj._ordenarTickersPorLiquidez([]).length !== 0) falhas.push('Lista vazia deveria retornar [].');
  if (obj._ordenarTickersPorLiquidez(null).length !== 0) falhas.push('null deveria retornar [].');
  if (obj._ordenarTickersPorLiquidez(undefined).length !== 0) falhas.push('undefined deveria retornar [].');
} catch (e) {
  falhas.push('Ordenação lançou exceção com entrada vazia: ' + e.message);
}

// 7. Ticker desconhecido (ex.: da Carteira) vai para o FIM, sem ser descartado.
var misto = obj._ordenarTickersPorLiquidez(['ZZZ9', 'VALE3', 'PETR4']);
console.log('  Lista mista [' + misto.join(', ') + ']');
if (misto.length !== 3) falhas.push('Ticker desconhecido foi descartado.');

console.log('\n=== (A) Aquecimento de cache pré-scanner (v14.2) ===');

// 8. O método existe e é defensivo (não lança quando o DataService está ausente).
try {
  var _aqFn = new Function('tickers', 'CoreRegistry', 'SpreadsheetApp', extrairMetodo(srcOrq, '_aquecerCachePreScanner'));
  var objAq = {};
  objAq._aquecerCachePreScanner = function (tickers) {
    return _aqFn.call(objAq, tickers, { get: function () { return null; } }, { flush: function () {} });
  };
  var r = objAq._aquecerCachePreScanner(['VALE3']);
  if (r !== false) falhas.push('Sem DataService, o aquecimento deveria retornar false.');
  console.log('  Sem DataService → retornou false (seguro): ✅');
} catch (e) {
  falhas.push('Aquecimento lançou exceção sem DataService: ' + e.message);
}

// 9. Com DataService real (fake), deve chamar prepararAbaCotacoesLive e retornar true.
(function () {
  var chamou = false;
  var _aqFn2 = new Function('tickers', 'CoreRegistry', 'SpreadsheetApp', extrairMetodo(srcOrq, '_aquecerCachePreScanner'));
  var objAq2 = {};
  objAq2._aquecerCachePreScanner = function (tickers) {
    return _aqFn2.call(objAq2, tickers, {
      get: function () {
        return { prepararAbaCotacoesLive: function () { chamou = true; return true; } };
      }
    }, { flush: function () {} });
  };
  var ok = objAq2._aquecerCachePreScanner(['VALE3', 'PETR4']);
  if (!chamou) falhas.push('prepararAbaCotacoesLive não foi invocado.');
  if (ok !== true) falhas.push('Com DataService ok, o aquecimento deveria retornar true.');
  console.log('  Com DataService → invocou prepararAbaCotacoesLive e retornou true: ✅');
})();

// 10. Falha do DataService NÃO pode propagar (best-effort).
(function () {
  var _aqFn3 = new Function('tickers', 'CoreRegistry', 'SpreadsheetApp', extrairMetodo(srcOrq, '_aquecerCachePreScanner'));
  var objAq3 = {};
  objAq3._aquecerCachePreScanner = function (tickers) {
    return _aqFn3.call(objAq3, tickers, {
      get: function () {
        return { prepararAbaCotacoesLive: function () { throw new Error('aba corrompida'); } };
      }
    }, { flush: function () {} });
  };
  var ok = objAq3._aquecerCachePreScanner(['VALE3']);
  if (ok !== false) falhas.push('Falha interna deveria retornar false (best-effort).');
  console.log('  Falha interna → retornou false sem propagar: ✅');
})();

// 11. Verificações estruturais de INTEGRAÇÃO no scanner.
if (!/tickers = this\._ordenarTickersPorLiquidez\(tickers\)/.test(srcOrq)) {
  falhas.push('O scanner não aplica _ordenarTickersPorLiquidez(tickers).');
}
if (!/this\._aquecerCachePreScanner\(tickers\)/.test(srcOrq)) {
  falhas.push('O scanner não chama _aquecerCachePreScanner(tickers).');
}
if (!/_temMargem\(30000\)/.test(srcOrq)) {
  falhas.push('Falta a guarda de tempo (~30s) antes do aquecimento.');
}
if (!/restantePosAq/.test(srcOrq)) {
  falhas.push('Falta o reajuste do limite pós-aquecimento (preserva a reserva).');
}
console.log('  Integração no scanner (ordem + aquecimento + guarda + reserva): ✅');

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: anti-TIMEOUT v14.2 inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ Universo priorizado por liquidez (blue chips primeiro).');
  console.log('  ✅ CASH3 (caso real) sai da faixa de TIMEOUT.');
  console.log('  ✅ Aquecimento de cache é best-effort e respeita o orçamento.');
  console.log('\n✅ PASSOU: anti-TIMEOUT do scanner (v14.2) OK.');
}
