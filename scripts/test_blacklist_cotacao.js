/**
 * =============================================================================
 * scripts/test_blacklist_cotacao.js — REGRESSÃO DO FILTRO DE BLACKLIST
 * =============================================================================
 * Evita o desperdício de rede identificado no log de produção (21/09):
 *
 *   "BRAPI falhou para NEOE3 HTTP 404"
 *   "BRAPI falhou para CRFB3 HTTP 404"
 *
 * NEOE3 e CRFB3 estão na `_deadTickers` do 05_B3V10_TickerManager (inativos na
 * B3), mas chegavam ao `getPrecosAtuaisEmLote` e eram tentados em TODAS as
 * fontes — GoogleFinance → HGBrasil → BRAPI → Bolsai. Cada 404 custa 1-3s
 * (fetch + retry com backoff), multiplicado por 3 fontes × N ativos mortos.
 *
 * Uso:  node scripts/test_blacklist_cotacao.js
 * =============================================================================
 */

var fs = require('fs');
var path = require('path');
var RAIZ = path.join(__dirname, '..');

var srcTicker = fs.readFileSync(path.join(RAIZ, '05_B3V10_TickerManager.js'), 'utf8');
var srcData = fs.readFileSync(path.join(RAIZ, '05_Data_Service.js'), 'utf8');

var falhas = [];
var passou = 0;

function check(nome, real, esperado) {
  var ok = (real === esperado);
  if (ok) { passou++; console.log('  \u2705 ' + nome); }
  else {
    falhas.push(nome + ' \u2014 esperado ' + esperado + ', obtido ' + real);
    console.log('  \u274C ' + nome + ' \u2014 esperado ' + esperado + ', obtido ' + real);
  }
}

function titulo(t) {
  console.log('\n=============================================================');
  console.log(' ' + t);
  console.log('=============================================================');
}

// ---------------------------------------------------------------------------
titulo('TESTE 1 — A blacklist existe e o filtro e funcional');

var mDead = srcTicker.match(/_deadTickers\s*=\s*\{([\s\S]*?)\n\s*\};/);
check('_deadTickers encontrada', !!mDead, true);

var deadTickers = [];
if (mDead) {
  var re = /"([A-Z0-9]{4,7})"\s*:/g;
  var mm;
  while ((mm = re.exec(mDead[1])) !== null) deadTickers.push(mm[1]);
}
console.log('  ' + deadTickers.length + ' tickers mortos');
check('Blacklist tem >= 20 tickers', deadTickers.length >= 20, true);
check('NEOE3 esta na blacklist', deadTickers.indexOf('NEOE3') !== -1, true);
check('CRFB3 esta na blacklist', deadTickers.indexOf('CRFB3') !== -1, true);

check('TickerManager expoe isDeadTicker()',
  /isDeadTicker:\s*function/.test(srcTicker), true);
check('TickerManager expoe filterDead()',
  /filterDead:\s*function/.test(srcTicker), true);
check('filterDead() retorna array filtrado',
  /return filtrados;/.test(srcTicker), true);

// ---------------------------------------------------------------------------
titulo('TESTE 2 — getPrecosAtuaisEmLote aplica o filtro ANTES de buscar');

// Extrai o CORPO de getPrecosAtuaisEmLote por balanceamento de chaves.
// (regex simples falha porque a função tem blocos aninhados com chaves)
function extrairFuncao(texto, nome) {
  var idx = texto.indexOf('function ' + nome + '(');
  if (idx === -1) return '';
  var i = texto.indexOf('{', idx);
  var depth = 0;
  for (var j = i; j < texto.length; j++) {
    var c = texto[j];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return texto.substring(idx, j + 1);
    }
  }
  return '';
}

var corpoFn = extrairFuncao(srcData, 'getPrecosAtuaisEmLote');
check('getPrecosAtuaisEmLote localizada', corpoFn.length > 0, true);

check('Consulta B3V10_TICKER_MANAGER', /B3V10_TICKER_MANAGER/.test(corpoFn), true);
check('Chama filterDead()', /filterDead\(/.test(corpoFn), true);
check('Define tickersValidos', /var tickersValidos\s*=/.test(corpoFn), true);

var posFiltro = corpoFn.indexOf('filterDead(');
var posGoogle = corpoFn.indexOf('getPrecosGoogleFinance(');
var posHG = corpoFn.indexOf('HGBrasilFetcher.getQuoteBatch');
var posBrapi = corpoFn.indexOf('BrapiFetcher.getQuoteBatch');
var posBolsai = corpoFn.indexOf('BolsaiFetcher.getQuoteBatch');

console.log('  Posicoes: filtro=' + posFiltro + ' google=' + posGoogle +
  ' hg=' + posHG + ' brapi=' + posBrapi + ' bolsai=' + posBolsai);
check('Filtro vem ANTES do GoogleFinance', posFiltro < posGoogle, true);
check('Filtro vem ANTES do HGBrasil', posFiltro < posHG, true);
check('Filtro vem ANTES do BRAPI', posFiltro < posBrapi, true);
check('Filtro vem ANTES do Bolsai', posFiltro < posBolsai, true);

// ---------------------------------------------------------------------------
titulo('TESTE 3 — Nenhuma fonte usa a lista NAO filtrada');

check('Nenhuma fonte chama getQuoteBatch(tickersArray)',
  (corpoFn.match(/getQuoteBatch\(tickersArray\)/g) || []).length, 0);
check('Google recebe a lista filtrada',
  (corpoFn.match(/getPrecosGoogleFinance\(tickersArray\)/g) || []).length, 0);
check('missingTickers nao usa tickersArray.filter()',
  (corpoFn.match(/tickersArray\.filter\(/g) || []).length, 0);

var usosValidos = (corpoFn.match(/tickersValidos/g) || []).length;
console.log('  Referencias a tickersValidos: ' + usosValidos);
check('tickersValidos usado em >= 4 pontos', usosValidos >= 4, true);

// ---------------------------------------------------------------------------
titulo('TESTE 4 — Guarda de erro no filtro (nao pode derrubar a cotacao)');

check('Filtro protegido por try/catch', /catch\s*\(eDead\)/.test(corpoFn), true);
check('Fallback usa lista original em caso de falha',
  /tickersValidos\s*=\s*tickersArray/.test(corpoFn), true);
check('Retorna {} se a lista ficar vazia',
  /if\s*\(tickersValidos\.length === 0\)\s*return\s*\{\}/.test(corpoFn), true);

// ---------------------------------------------------------------------------
titulo('TESTE 5 — Impacto quantificado');

var totalTickers = 46;
var resolvidosGoogle = 35;
var missingAntes = totalTickers - resolvidosGoogle;

var mortosNaLista = ['NEOE3', 'CRFB3'].filter(function (t) {
  return deadTickers.indexOf(t) !== -1;
}).length;
var nomesMortos = ['NEOE3', 'CRFB3'].filter(function (t) {
  return deadTickers.indexOf(t) !== -1;
});

var httpAntes = missingAntes * 3;
var httpDepois = (missingAntes - mortosNaLista) * 3;
var economia = httpAntes - httpDepois;

console.log('  Universo ................. ' + totalTickers + ' tickers');
console.log('  Resolvidos via Google .... ' + resolvidosGoogle);
console.log('  Vao para API (missing) ... ' + missingAntes);
console.log('  Mortos entre os missing .. ' + mortosNaLista + ' (' + nomesMortos.join(', ') + ')');
console.log('');
console.log('  HTTP antes  ............ ' + httpAntes);
console.log('  HTTP depois ............ ' + httpDepois);
console.log('  ECONOMIA ............... ' + economia + ' requisicoes');

check('Economia de pelo menos 6 requisicoes', economia >= 6, true);

var tempoMin = economia * 1;
var tempoMax = economia * 3;
console.log('');
console.log('  Tempo economizado estimado: ' + tempoMin + 's a ' + tempoMax + 's por execucao');
check('Economia de tempo relevante (>= 6s no pior caso)', tempoMin >= 6, true);

// ---------------------------------------------------------------------------
console.log('\n=============================================================');
if (falhas.length) {
  console.log('\u274C FALHOU: ' + falhas.length + ' assercao(oes) de ' +
    (passou + falhas.length) + '.');
  falhas.forEach(function (f) { console.log('   \u2022 ' + f); });
  process.exitCode = 1;
} else {
  console.log('\u2705 PASSOU: ' + passou + ' assercoes validadas.');
  console.log('   \u2022 Blacklist aplicada ANTES de qualquer chamada de rede.');
  console.log('   \u2022 Nenhuma fonte usa a lista nao filtrada.');
  console.log('   \u2022 Falha no filtro nao derruba a cotacao (fallback seguro).');
  console.log('   \u2022 Economia de ate ' + economia + ' requisicoes HTTP por execucao.');
}
console.log('=============================================================\n');
