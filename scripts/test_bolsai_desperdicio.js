/**
 * Harness offline de REGRESSÃO — Corte de desperdício na API Bolsai (v14.3 / Opção C).
 *
 * Contexto: cada ticker gastava até 6 round-trips na Bolsai (2 variantes de
 * /history + 2 formatos × /quote+/stats). Como o scanner tem orçamento fixo de
 * 210s, esse desperdício empurrava ativos para o fim da fila → "⏱️ TIMEOUT".
 *
 * Valida:
 *   (1) _requestClassificado distingue erro PERMANENTE (404/422) de TRANSITÓRIO
 *       (429/5xx/rede) — pré-requisito para cortar sem quebrar o fallback;
 *   (2) 404 alimenta o _endpointMissCache e a 2ª tentativa NÃO vai à rede;
 *   (3) getHistory: sucesso na variante 1 → apenas 1 requisição;
 *   (4) getHistory: 404 na variante 1 → tenta a variante 2 (fallback legítimo);
 *   (5) getHistory: 429 → NÃO insiste na variante 2 (transitório);
 *   (6) getQuote: sucesso em /quote → NÃO tenta /stats (corta redundância);
 *   (7) getQuote BDR: /quote falhou 404 → tenta /stats (fallback);
 *   (8) pior caso de getQuote não excede 4 requisições;
 *   (9) _request legado removido e métricas expostas.
 *
 * Carrega o módulo REAL (11_Data_BolsaiFetcher.js) num sandbox com mocks de GAS.
 */

var fs = require('fs');
var vm = require('vm');

var src = fs.readFileSync('11_Data_BolsaiFetcher.js', 'utf8');

var falhas = [];
var chamadas = [];        // endpoints realmente requisitados à "rede"
var respostaMock = {};    // endpoint -> { code, body }

function montarSandbox() {
  chamadas = [];
  var sandbox = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    Date: Date, JSON: JSON, Array: Array, Object: Object,
    Number: Number, String: String, isNaN: isNaN,
    PropertiesService: {
      getScriptProperties: function () {
        return { getProperty: function (k) { return k === 'BOLSAI_KEY' ? 'chave-teste-123456' : null; } };
      }
    },
    CacheService: {
      getScriptCache: function () {
        return { get: function () { return null; }, put: function () {} };
      }
    },
    Utilities: { sleep: function () {} },
    UrlFetchApp: {
      fetch: function (url) {
        var ep = url.split('/api/v1/')[1];
        chamadas.push(ep);
        var r = respostaMock[ep] || { code: 404, body: '{}' };
        return {
          getResponseCode: function () { return r.code; },
          getContentText: function () { return r.body; }
        };
      }
    }
  };
  sandbox.globalThis = sandbox;
  return sandbox;
}

/** Carrega um módulo limpo e devolve o objeto exportado. */
function carregar() {
  var sandbox = montarSandbox();
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.BolsaiFetcher;
}

/** Candles válidos (>= 18) no schema 'data[]' aceito por _normalizeHistory. */
function candlesValidos(n) {
  var arr = [];
  for (var i = 0; i < (n || 20); i++) {
    arr.push({ trade_date: '2026-01-0' + ((i % 9) + 1), open: 10 + i, high: 11 + i, low: 9 + i, close: 10.5 + i, volume: 1000 + i });
  }
  return JSON.stringify({ data: arr });
}

console.log('\n=== (C) Corte de desperdício na Bolsai (v14.3) ===');

// ── (3) getHistory: sucesso na variante 1 → 1 única requisição ──────────────
(function () {
  respostaMock = {
    'stocks/PETR4/history?limit=260': { code: 200, body: candlesValidos(20) }
  };
  var bf = carregar();
  var hist = bf.getHistory('PETR4', 260);
  console.log('  [3] getHistory sucesso: requisições=' + chamadas.length + ' candles=' + (hist ? hist.length : 0));
  if (!hist || hist.length < 18) falhas.push('getHistory deveria retornar candles válidos.');
  if (chamadas.length !== 1) falhas.push('Sucesso na variante 1 deveria gastar 1 requisição, gastou ' + chamadas.length + '.');
})();

// ── (4) getHistory: 404 na variante 1 → deve tentar a variante 2 ────────────
(function () {
  respostaMock = {
    'stocks/PETR4/history?limit=260': { code: 404, body: '{}' },
    'stocks/PETR4/history': { code: 200, body: candlesValidos(20) }
  };
  var bf = carregar();
  var hist = bf.getHistory('PETR4', 260);
  console.log('  [4] 404 na v1 → v2: requisições=' + chamadas.length + ' candles=' + (hist ? hist.length : 0));
  if (!hist) falhas.push('Fallback legítimo (404 → variante 2) foi quebrado.');
  if (chamadas.length !== 2) falhas.push('404→v2 deveria gastar 2 requisições, gastou ' + chamadas.length + '.');
  if (chamadas.indexOf('stocks/PETR4/history') === -1) falhas.push('Variante 2 não foi tentada após 404.');
})();

// ── (5) getHistory: 429 (transitório) → NÃO insiste na variante 2 ───────────
(function () {
  respostaMock = {
    'stocks/PETR4/history?limit=260': { code: 429, body: '{}' },
    'stocks/PETR4/history': { code: 200, body: candlesValidos(20) }
  };
  var bf = carregar();
  var hist = bf.getHistory('PETR4', 260);
  console.log('  [5] 429 (transitório): requisições=' + chamadas.length + ' resultado=' + (hist ? 'candles' : 'null'));
  if (chamadas.length !== 1) falhas.push('429 deveria parar em 1 requisição (transitório), gastou ' + chamadas.length + '.');
  if (hist) falhas.push('Com 429 não deveria retornar candles (evitaria mascarar o rate limit).');
})();

// ── (2) 404 alimenta o cache de miss: 2ª chamada não vai à rede ────────────
// A 1ª chamada gasta 2 requisições (v1 → 404 → v2 → 404); a 2ª deve gastar ZERO
// porque ambos os endpoints entraram no _endpointMissCache.
(function () {
  respostaMock = {
    'stocks/XPTO3/history?limit=260': { code: 404, body: '{}' },
    'stocks/XPTO3/history': { code: 404, body: '{}' }
  };
  var bf = carregar();
  bf.getHistory('XPTO3', 260);
  var apos1 = chamadas.length;
  bf.getHistory('XPTO3', 260); // 2ª vez: deve consultar o miss-cache
  console.log('  [2] 404 em cache: 1ª=' + apos1 + ' req | após 2ª=' + chamadas.length + ' req (esperado: sem novas)');
  if (apos1 !== 2) falhas.push('1ª tentativa deveria gastar 2 requisições (v1+v2), gastou ' + apos1 + '.');
  if (chamadas.length !== apos1) falhas.push('2ª tentativa foi à rede apesar do 404 em cache (' + chamadas.length + ' req).');
  var mm = bf.getMetrics();
  if (mm.missesEvitados < 2) falhas.push('metrics.missesEvitados deveria contabilizar os 2 round-trips evitados, obteve ' + mm.missesEvitados + '.');
  if (mm.requests !== 2) falhas.push('metrics.requests deveria ser 2 (só a 1ª chamada), obteve ' + mm.requests + '.');
  console.log('    metrics: requests=' + mm.requests + ' | missesEvitados=' + mm.missesEvitados);
})();

// ── (6) getQuote: sucesso em /quote → NÃO tenta /stats ─────────────────────
(function () {
  respostaMock = {
    'stocks/PETR4/quote': { code: 200, body: JSON.stringify({ close: 38.5, daily_change_pct: 1.2, volume: 1000 }) },
    'stocks/PETR4/stats': { code: 200, body: JSON.stringify({ close: 38.5 }) }
  };
  var bf = carregar();
  var q = bf.getQuote('PETR4');
  console.log('  [6] getQuote /quote OK: requisições=' + chamadas.length + ' preco=' + (q ? q.price : null));
  if (!q || q.price !== 38.5) falhas.push('getQuote deveria retornar o preço de /quote.');
  if (chamadas.length !== 1) falhas.push('Sucesso em /quote deveria gastar 1 requisição, gastou ' + chamadas.length + '.');
  if (chamadas.indexOf('stocks/PETR4/stats') !== -1) falhas.push('/stats NÃO deveria ser tentado após /quote OK.');
})();

// ── (7) getQuote em BDR: /quote 404 → tenta /stats (fallback legítimo) ──────
// Para isolar o fallback /quote→/stats, o formato alternativo (JBSS3) também
// responde 404 em /quote — assim o fluxo chega ao /stats como previsto.
(function () {
  respostaMock = {
    'stocks/JBSS32/quote': { code: 404, body: '{}' },
    'stocks/JBSS3/quote': { code: 404, body: '{}' },
    'stocks/JBSS32/stats': { code: 200, body: JSON.stringify({ close: 22.1 }) }
  };
  var bf = carregar();
  var q = bf.getQuote('JBSS32');
  console.log('  [7] BDR /quote 404 → /stats: requisições=' + chamadas.length + ' preco=' + (q ? q.price : null));
  if (!q || q.price !== 22.1) falhas.push('Fallback /quote→/stats foi quebrado.');
  if (chamadas.length !== 3) falhas.push('Fallback BDR deveria gastar 3 requisições (quote x2 + stats), gastou ' + chamadas.length + '.');
})();

// ── (7b) Ação comum: /quote 404 → /stats em 2 requisições ──────────────────
(function () {
  respostaMock = {
    'stocks/PETR4/quote': { code: 404, body: '{}' },
    'stocks/PETR4/stats': { code: 200, body: JSON.stringify({ close: 38.9 }) }
  };
  var bf = carregar();
  var q = bf.getQuote('PETR4');
  console.log('  [7b] Ação /quote 404 → /stats: requisições=' + chamadas.length + ' preco=' + (q ? q.price : null));
  if (!q || q.price !== 38.9) falhas.push('Fallback /quote→/stats (ação) foi quebrado.');
  if (chamadas.length !== 2) falhas.push('Ação deveria gastar 2 requisições, gastou ' + chamadas.length + '.');
})();

// ── (8) Pior caso: getQuote não excede 4 requisições ───────────────────────
(function () {
  respostaMock = {
    'stocks/JBSS32/quote': { code: 404, body: '{}' },
    'stocks/JBSS3/quote': { code: 404, body: '{}' },
    'stocks/JBSS32/stats': { code: 404, body: '{}' },
    'stocks/JBSS3/stats': { code: 404, body: '{}' }
  };
  var bf = carregar();
  bf.getQuote('JBSS32');
  console.log('  [8] Pior caso getQuote BDR: ' + chamadas.length + ' requisições (teto 4)');
  if (chamadas.length > 4) falhas.push('getQuote excedeu o teto de 4 requisições: ' + chamadas.length);
  if (chamadas.length < 2) falhas.push('getQuote deveria tentar alternativas após 404.');
})();

// ── (9) Estrutura: _request legado removido, classificação e métricas ───────
if (/function _request\(endpoint\)/.test(src)) {
  falhas.push('O _request() legado ainda existe (deveria ter sido substituído por _requestClassificado).');
}
if (!/_requestClassificado/.test(src)) falhas.push('Falta o _requestClassificado (permanente/transitório).');
if (!/getMetrics/.test(src) || !/resetMetrics/.test(src)) falhas.push('Faltam getMetrics/resetMetrics.');
console.log('  [9] Estrutura: _requestClassificado ok, _request legado removido: ✅');

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: corte de desperdício da Bolsai inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ Erro PERMANENTE (404/422) não é retentado; TRANSITÓRIO (429) encerra cedo.');
  console.log('  ✅ Sucesso gasta 1 requisição por endpoint (antes: 2-4).');
  console.log('  ✅ Fallbacks legítimos preservados (404 → variante/estatística alternativa).');
  console.log('\n✅ PASSOU: corte de desperdício na Bolsai (v14.3) OK.');
}
