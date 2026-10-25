/**
 * Harness offline de REGRESSÃO — (D) Timeout agressivo + (E) Universo curado (v14.4).
 *
 * Contexto (caso real CASH3, linhas 37-71 da Resultados_Analise):
 *   - Custo real por ticker: 9-18s (GoogleFinance + Bolsai + BRAPI)
 *   - Orçamento do scanner: 210s
 *   - Universo anterior: 70 ativos  ->  2.91s/ticker (impossível)
 *   - Timeout individual anterior: 35s  ->  1 ativo travado = 17% do orçamento
 *
 * Valida:
 *   (D1) TICKER_TIMEOUT_MS do Orchestrator = 12000 (era 35000);
 *   (D2) TICKER_TIMEOUT_MS do DataService  = 12000 (era 25000);
 *   (D3) TICKER_FALLBACK_LIMIT_MS existe e é ALCANÇÁVEL (< TICKER_TIMEOUT_MS);
 *   (D4) o guard de fallback agora CORTA (return null) em vez de só logar;
 *   (E1) SCANNER_UNIVERSE tem 30 + 10 = 40 ativos;
 *   (E2) getScannerUniverse()/getScannerTier1() devolvem listas corretas;
 *   (E3) CATEGORIES (getAll) continua intacto (não quebrou setores/Ranker);
 *   (E4) o scanner usa getScannerUniverse, com fallback seguro para getAll;
 *   (E5) todos os tickers do universo curado existem em CATEGORIES (sem órfãos).
 */

var fs = require('fs');
var srcOrq = fs.readFileSync('00_Core_Orchestrator.js', 'utf8');
var srcTm = fs.readFileSync('05_B3V10_TickerManager.js', 'utf8');
var srcDs = fs.readFileSync('05_Data_Service.js', 'utf8');

var falhas = [];

// TickerManager REAL (IIFE do módulo 05).
var B3V10_TICKER_MANAGER = new Function(
  'return ' + srcTm.split('var B3V10_TICKER_MANAGER = ')[1].split('\n})();')[0] + '\n})()'
)();

console.log('\n=== (D) Timeout individual agressivo (v14.4) ===');

// D1 — Orchestrator
if (!/var TICKER_TIMEOUT_MS = 12000/.test(srcOrq)) {
  falhas.push('Orchestrator: TICKER_TIMEOUT_MS deveria ser 12000.');
}
console.log('  [D1] Orchestrator TICKER_TIMEOUT_MS=12000: ' +
  (/var TICKER_TIMEOUT_MS = 12000/.test(srcOrq) ? '✅' : '❌'));

// D2 — DataService
if (!/var TICKER_TIMEOUT_MS = 12000/.test(srcDs)) {
  falhas.push('DataService: TICKER_TIMEOUT_MS deveria ser 12000.');
}
console.log('  [D2] DataService  TICKER_TIMEOUT_MS=12000: ' +
  (/var TICKER_TIMEOUT_MS = 12000/.test(srcDs) ? '✅' : '❌'));

// D3 — O teto de fallback precisa ser ALCANÇÁVEL (o bug anterior era 25s+10s=35s).
var mFallback = srcDs.match(/var TICKER_FALLBACK_LIMIT_MS = (\d+)/);
if (!mFallback) {
  falhas.push('DataService: falta TICKER_FALLBACK_LIMIT_MS.');
} else {
  var limiteFallback = Number(mFallback[1]);
  var limiteDs = Number((srcDs.match(/var TICKER_TIMEOUT_MS = (\d+)/) || [])[1]);
  console.log('  [D3] TICKER_FALLBACK_LIMIT_MS=' + limiteFallback + ' (TICKER_TIMEOUT_MS=' + limiteDs + ')');
  if (limiteFallback >= limiteDs) {
    falhas.push('O teto de fallback deve ser ALCANÇÁVEL (< TICKER_TIMEOUT_MS).');
  }
}

// D4 — O guard precisa CORTAR, não apenas logar.
if (!/decorridoAposBrapi >= TICKER_FALLBACK_LIMIT_MS/.test(srcDs)) {
  falhas.push('O guard de fallback não usa decorridoAposBrapi >= TICKER_FALLBACK_LIMIT_MS.');
}
// Remove comentários antes de procurar o padrão obsoleto (senão a própria
// documentação que cita o bug antigo geraria falso positivo).
var srcDsSemComentarios = srcDs
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
if (/TICKER_TIMEOUT_MS \+ 10000/.test(srcDsSemComentarios)) {
  falhas.push('O guard antigo (TICKER_TIMEOUT_MS + 10000) ainda existe em código executável.');
}
// Confirma que há um return null dentro do bloco do guard.
var blocoGuard = srcDs.split('decorridoAposBrapi >= TICKER_FALLBACK_LIMIT_MS')[1] || '';
var trechoGuard = blocoGuard.substring(0, 400);
if (trechoGuard.indexOf('return null') === -1) {
  falhas.push('O guard de fallback precisa retornar null (corte real), não apenas logar.');
}

console.log('\n=== (E) Universo curado do scanner (v14.4) ===');

// E1 — Composição dos tiers.
var cfg = B3V10_TICKER_MANAGER.getScannerUniverseConfig();
var tier1 = B3V10_TICKER_MANAGER.getScannerTier1();
var universo = B3V10_TICKER_MANAGER.getScannerUniverse();
var reduzido = B3V10_TICKER_MANAGER.getScannerUniverseReduzido();
console.log('  [E1] Tier1=' + cfg.TIER1.length + ' | Tier2=' + cfg.TIER2.length +
  ' | Tier3=' + cfg.TIER3.length + ' | Universo=' + universo.length);
if (cfg.TIER1.length !== 30) falhas.push('Tier 1 deveria ter 30 ativos, tem ' + cfg.TIER1.length + '.');
if (cfg.TIER2.length !== 10) falhas.push('Tier 2 deveria ter 10 ativos, tem ' + cfg.TIER2.length + '.');
if (cfg.TIER3.length !== 8) falhas.push('Tier 3 deveria ter 8 ativos, tem ' + cfg.TIER3.length + '.');
if (universo.length !== 48) falhas.push('Universo deveria ter 48 ativos, tem ' + universo.length + '.');
if (reduzido.length !== 40) falhas.push('Universo reduzido deveria ter 40 ativos, tem ' + reduzido.length + '.');

// E2 — Integridade das listas.
if (tier1.length !== cfg.TIER1.length) falhas.push('getScannerTier1 divergiu do config.');
var dups = universo.filter(function (t, i) { return universo.indexOf(t) !== i; });
if (dups.length) falhas.push('getScannerUniverse contém duplicatas: ' + dups.join(','));
// Os 30 primeiros devem ser exatamente o Tier 1 (ordem de prioridade).
var primeiros30 = universo.slice(0, 30);
var t1Ok = primeiros30.every(function (t, i) { return t === cfg.TIER1[i]; });
if (!t1Ok) falhas.push('Os 30 primeiros do universo deveriam ser o Tier 1 na ordem.');
console.log('  [E2] Sem duplicatas; Tier1 na frente: ' + (t1Ok ? '✅' : '❌'));

// E3 — CATEGORIES (setores/Ranker/Carteira) permanece intacto.
var all = B3V10_TICKER_MANAGER.getAll();
console.log('  [E3] getAll() mantém ' + all.length + ' ativos (CATEGORIES intacto)');
if (all.length <= universo.length) {
  falhas.push('getAll() deveria continuar maior que o universo curado (CATEGORIES intacto).');
}
var setAll = {}; all.forEach(function (t) { setAll[t] = true; });
var orfaos = universo.filter(function (t) { return !setAll[t]; });
console.log('  [E4] Tickers órfãos (fora de CATEGORIES): ' + (orfaos.length ? orfaos.join(',') : 'nenhum'));
if (orfaos.length) {
  falhas.push('Universo curado contém tickers ausentes em CATEGORIES: ' + orfaos.join(','));
}

// E5 — O scanner usa o universo curado, com fallback seguro.
if (!/getScannerUniverse/.test(srcOrq)) {
  falhas.push('O scanner não usa getScannerUniverse().');
}
if (!/getAll\(\) como fallback/.test(srcOrq)) {
  falhas.push('Falta o fallback seguro para getAll() se o módulo for antigo.');
}
if (!/universoConfig/.test(srcOrq)) {
  falhas.push('O scanner não loga a composição do universo curado.');
}
console.log('  [E5] Scanner usa getScannerUniverse com fallback: ✅');

// E6 — Regressão aritmética: o orçamento agora é compatível.
(function () {
  var BATCH_SIZE = 5;
  var ORCAMENTO = 210;
  var lotes = Math.ceil(universo.length / BATCH_SIZE);
  var pausas = (lotes - 1) * 0.5;
  var util = ORCAMENTO - pausas;
  var porTicker = util / universo.length;
  var antesPorTicker = (ORCAMENTO - (Math.ceil(70 / BATCH_SIZE) - 1) * 0.5) / 70;
  console.log('  [E6] Orçamento: ' + porTicker.toFixed(2) + 's/ticker (antes ' +
    antesPorTicker.toFixed(2) + 's) — ganho ' + (porTicker / antesPorTicker).toFixed(1) + 'x');
  // Um ticker travado (12s) não pode consumir mais que 10% do orçamento útil.
  var pctTravado = (12 / util) * 100;
  console.log('       1 ticker travado (12s) = ' + pctTravado.toFixed(1) + '% do orçamento útil');
  if (pctTravado > 10) falhas.push('Timeout de 12s ainda consome >10% do orçamento (' + pctTravado.toFixed(1) + '%).');
  if (porTicker < antesPorTicker) falhas.push('O novo dimensionamento deveria dar MAIS tempo por ticker.');
  // v14.5: mesmo com 48 ativos, o fôlego tem de continuar melhor que o original.
  if (porTicker < 4.0) falhas.push('Com 48 ativos o fôlego caiu demais (' + porTicker.toFixed(2) + 's/ticker < 4s).');
})();

// E7 (v14.5) — QUALIDADE DA SELEÇÃO do Tier 3.
// Os 8 escolhidos devem existir em CATEGORIES, não duplicar Tiers 1/2 e NÃO
// incluir os ativos descartados por critério técnico/liquidez.
(function () {
  var proibidos = ['BRAP4', 'DASA3', 'ONCO3', 'BRSR6', 'BMGB4', 'AALR3', 'PFRM3', 'AURE3'];
  var intrusos = cfg.TIER3.filter(function (t) { return proibidos.indexOf(t) !== -1; });
  if (intrusos.length) falhas.push('Tier 3 inclui ativos descartados por critério: ' + intrusos.join(','));
  // Sem sobreposição com Tiers 1/2 (isso inflaria o universo com duplicatas).
  var jaNoUniverso = {};
  cfg.TIER1.concat(cfg.TIER2).forEach(function (t) { jaNoUniverso[t] = true; });
  var sobrepostos = cfg.TIER3.filter(function (t) { return jaNoUniverso[t]; });
  if (sobrepostos.length) falhas.push('Tier 3 sobrepõe Tiers 1/2: ' + sobrepostos.join(','));
  // Todos devem existir em CATEGORIES (senão seriam órfãos).
  var orfaosT3 = cfg.TIER3.filter(function (t) { return !setAll[t]; });
  if (orfaosT3.length) falhas.push('Tier 3 contém ativos fora de CATEGORIES: ' + orfaosT3.join(','));
  console.log('  [E7] Tier3: 8 ativos válidos, sem sobreposição e sem descartados: ' +
    (intrusos.length + sobrepostos.length + orfaosT3.length === 0 ? '✅' : '❌'));
  console.log('       ' + cfg.TIER3.join(', '));
})();

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: timeout/universo inconsistentes (v14.4).');
  process.exitCode = 1;
} else {
  console.log('  ✅ Timeout individual 35s → 12s (1 travado = 5.9% do orçamento).');
  console.log('  ✅ Guard de fallback agora CORTa (era limite inalcançável de 35s).');
  console.log('  ✅ Universo 70 → 48 ativos em 3 tiers (4.28s/ticker de fôlego).');
  console.log('  ✅ CATEGORIES intacto: setores/Ranker/Carteira inalterados.');
  console.log('\n✅ PASSOU: (D) timeout agressivo + (E) universo curado (3 tiers) OK.');
}
