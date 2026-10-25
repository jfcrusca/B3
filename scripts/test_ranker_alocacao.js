/**
 * @file scripts/test_ranker_alocacao.js
 * @description Regressão do Bug 4 — alocação da carteira teórica em 41_Ranker.js.
 *
 * IMPORTANTE (v15.1): este teste executa o BLOCO 5.1 REAL de 41_Ranker.js
 * (via scripts/_harness_ranker.js), não uma cópia da lógica. A versão anterior
 * replicava a alocação como função pura de (score, preço) e por isso NÃO
 * enxergava o `qtd` que o Position Sizing entrega ao Ranker — foi assim que
 * a v15.0 passou nos testes e quebrou em produção (alocações de 24% em papel
 * de stop largo e quantidades AUMENTADAS acima do sizing).
 *
 * Histórico dos bugs cobertos:
 *   v12.8 "guloso cego": consumia o capital na ordem do score e descartava o
 *     resto — 8 de 13 trades caíam, inclusive com score 95-100.
 *   v15.0: score puro ignorando o `qtd` — estourava o risco por trade.
 *   v15.1: cota respeita o `qtd` do sizing como TETO de risco; score só
 *     distribui o capital quando ele não cabe.
 *
 * Verificações:
 *   (1) Contrato estático em 41_Ranker.js / 01_Core_Config.js;
 *   (2) Caso real do log (13 aprovados, R$ 20.000) com o código de produção;
 *   (3) Casos de borda (capital apertado, 1 trade, ativo caro, 40 ativos).
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var falhas = [];
var checks = 0;

function ok(cond, msg) {
  checks++;
  if (!cond) falhas.push(msg);
}

var harness = require('./_harness_ranker.js');

// ---------------------------------------------------------------------------
// (1) CONTRATO ESTÁTICO
// ---------------------------------------------------------------------------
console.log('=== (1) Contrato estático ===');

var ranker = fs.readFileSync(path.join(ROOT, '41_Ranker.js'), 'utf8');
var coreCfg = fs.readFileSync(path.join(ROOT, '01_Core_Config.js'), 'utf8');

// Remove comentários para não casar com o texto explicativo.
function semComentarios(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}
var rankerCode = semComentarios(ranker);

ok(rankerCode.indexOf('qtd reduzida para') === -1,
  'Algoritmo guloso antigo ainda presente ("qtd reduzida para").');
ok(rankerCode.indexOf('descartado(s) por teto agregado') === -1,
  'Log antigo de descarte por teto agregado ainda presente.');
ok(/_pesoScore/.test(rankerCode),
  'Peso por score (_pesoScore) ausente — distribuicao proporcional nao implementada.');
ok(/maxTradeValue/.test(rankerCode) && /maxTotalValue/.test(rankerCode),
  'Teto agregado e/ou teto por trade nao usados na alocacao.');
ok(/MIN_LOTE_VALUE/.test(rankerCode),
  'Piso de utilidade (MIN_LOTE_VALUE) nao aplicado no Ranker.');
ok(/riscoRs\s*=/.test(rankerCode) && /distStopFinal/.test(rankerCode),
  'riscoRs nao e recalculado apos a quantidade final.');
// v15.1: o `qtd` do Position Sizing precisa ser tratado como TETO de risco.
ok(/_qtdTeto/.test(rankerCode),
  'Teto de risco do Position Sizing (_qtdTeto) ausente — Ranker pode inflar a quantidade.');
ok(/qtdAlvo > tv\._qtdTeto/.test(rankerCode),
  'Alocacao nao limita qtdAlvo ao teto de risco do position sizing.');
ok(/RANKER_MIN_LOTE_VALUE/.test(coreCfg),
  'Config RANKER_MIN_LOTE_VALUE ausente em 01_Core_Config.js.');
ok(/RANKER_ALOCACAO_POR_SCORE/.test(coreCfg) && /RANKER_ALOCACAO_POR_SCORE/.test(rankerCode),
  'Flag RANKER_ALOCACAO_POR_SCORE ausente (config ou leitura no Ranker).');
console.log('  OK: tetos, piso de utilidade, teto de risco e recalculo de risco presentes.');


// ---------------------------------------------------------------------------
// (2) CASO REAL DO LOG — executa o código de produção
// ---------------------------------------------------------------------------
console.log('\n=== (2) Cenario real do log: 13 aprovados, capital R$ 20.000 ===');

var CAPITAL = 20000;
var CFG = {
  MAX_TRADE_ALLOCATION: 0.25,
  MAX_TOTAL_ALLOCATION: 0.95,
  MIN_LOTE_VALUE: 500,
  ALOCACAO_POR_SCORE: true
};

/**
 * Reconstrói o trade como 41_Ranker.js o recebe: `qtd` = quantidade que gasta
 * o risco-alvo (2% do capital), já limitada pelo teto de 25% — exatamente o
 * que PositionGeometry.dimensionar() devolve ANTES do Ranker cortar.
 *
 * @param {string} ticker código do ativo.
 * @param {number} score score final do Sentinela.
 * @param {number} preco preço de execução.
 * @param {number} distStop distância até o stop (R$/ação).
 * @param {number} qtdLog quantidade que apareceu no log (já pós-Ranker).
 * @return {Object} trade no formato do Ranker.
 */
function trade(ticker, score, preco, distStop, qtdLog) {
  var porRisco = Math.floor((CAPITAL * 0.02) / distStop);
  var porTeto = Math.floor((CAPITAL * CFG.MAX_TRADE_ALLOCATION) / preco);
  var qtdSizing = Math.min(qtdLog, Math.max(porRisco, porTeto));
  return {
    ticker: ticker, score: score, preco: preco,
    stop: preco - distStop, qtd: qtdSizing
  };
}

// Valores do log de 25/10 (score final do Sentinela, preço, distância do stop).
var cenárioReal = [
  trade('ITUB4', 100, 33.20, 1.00, 103),
  trade('BBDC4', 100, 20.00, 1.17, 245),
  trade('SBSP3', 100, 88.40, 1.24, 156),
  trade('RDOR3', 100, 26.30, 0.65, 114),
  trade('TAEE11', 100, 35.10, 1.42, 111),
  trade('ITSA4', 94, 35.30, 0.61, 326),
  trade('VIVA3', 91, 24.80, 0.75, 184),
  trade('BBAS3', 89, 21.50, 0.42, 202),
  trade('HYPE3', 86, 28.70, 0.53, 183),
  trade('ISAE4', 86, 61.20, 2.26, 176),
  trade('SAPR11', 86, 46.20, 1.07, 119),
  trade('CMIG4', 81, 20.50, 0.61, 428),
  trade('RADL3', 74, 22.10, 1.31, 246)
];
// Guarda a quantidade de entrada para checar que o Ranker só reduz.
cenárioReal.forEach(function (t) { t._qtdInicial = t.qtd; });

var res = harness.alocarComCodigoReal(cenárioReal, CFG, CAPITAL);

var valorTotal = res.trades.reduce(function (s, t) { return s + t.qtd * t.preco; }, 0);
var riscoTotal = res.trades.reduce(function (s, t) { return s + t.riscoRs; }, 0);

console.log('  Capital          : R$ ' + CAPITAL.toFixed(2) + ' (teto R$ ' + (CAPITAL * 0.95).toFixed(2) + ')');
console.log('  Elegiveis        : ' + cenárioReal.length);
console.log('  Na carteira      : ' + res.trades.length);
console.log('\n  Ticker   | score | preco  | sizing -> rank | valor      | % cap  | risco R$');
res.trades.forEach(function (t) {
  var v = t.qtd * t.preco;
  console.log('  ' + t.ticker.padEnd(8) + ' | ' + String(t.score).padStart(5) + ' | ' +
    t.preco.toFixed(2).padStart(6) + ' | ' + String(t._qtdInicial).padStart(6) + ' -> ' +
    String(t.qtd).padStart(4) + ' | ' + v.toFixed(2).padStart(10) + ' | ' +
    (100 * v / CAPITAL).toFixed(2).padStart(6) + ' | ' + t.riscoRs.toFixed(2).padStart(8));
});
if (res.warns.length) {
  console.log('\n  Descartados:');
  res.warns.forEach(function (w) { console.log('    ' + w.trim()); });
}
console.log('\n  Agregado: R$ ' + valorTotal.toFixed(2) + ' (' + (valorTotal / CAPITAL * 100).toFixed(2) +
  '%) | risco R$ ' + riscoTotal.toFixed(2) + ' (' + (riscoTotal / CAPITAL * 100).toFixed(2) + '%)');


// --- Asserções do cenário real ---
ok(valorTotal <= CAPITAL * CFG.MAX_TOTAL_ALLOCATION + 0.01,
  'Alocacao R$ ' + valorTotal.toFixed(2) + ' estourou o teto de R$ ' + (CAPITAL * 0.95).toFixed(2));

// Nenhum trade pode ter sido AUMENTADO acima do que o position sizing aprovou
res.trades.forEach(function (t) {
  ok(t.qtd <= t._qtdInicial,
    t.ticker + ': Ranker AUMENTOU a quantidade (' + t.qtd + ' > ' + t._qtdInicial + ') — risco estourado.');
});

// Risco por trade nunca acima do risco-alvo de 2% do capital
res.trades.forEach(function (t) {
  ok(t.riscoRs <= CAPITAL * 0.02 + 0.01,
    t.ticker + ': risco R$ ' + t.riscoRs.toFixed(2) + ' acima de 2% do capital.');
});

// Teto por trade (25%)
res.trades.forEach(function (t) {
  ok(t.qtd * t.preco <= CAPITAL * CFG.MAX_TRADE_ALLOCATION + 0.01,
    t.ticker + ' excedeu o teto por trade: R$ ' + (t.qtd * t.preco).toFixed(2));
});

// Nenhuma posição-token
res.trades.forEach(function (t) {
  ok(t.qtd >= 1 && t.qtd * t.preco >= CFG.MIN_LOTE_VALUE - 0.01,
    t.ticker + ' ficou como posicao-token: R$ ' + (t.qtd * t.preco).toFixed(2));
});

// riscoRs coerente com a quantidade final
res.trades.forEach(function (t) {
  var esperado = t.qtd * (t.preco - t.stop);
  ok(Math.abs(t.riscoRs - esperado) < 0.02,
    t.ticker + ': riscoRs ' + t.riscoRs.toFixed(2) + ' != qtd x distStop ' + esperado.toFixed(2));
});

// Todos os 13 devem caber (o cenário cabe no teto de 95%)
ok(res.trades.length === cenárioReal.length,
  'Apenas ' + res.trades.length + '/' + cenárioReal.length + ' trades na carteira — ' +
  'neste cenario o capital deveria cobrir todos.');
ok(res.warns.length === 0,
  'Houve ' + res.warns.length + ' descarte(s) em cenario que cabe no capital.');

// Score alto deve alocar MAIS que score baixo (monotonicidade real, tolerando
// arredondamento de lote: 1 ação do papel mais caro)
var ordenado = res.trades.slice().sort(function (a, b) { return b.score - a.score; });
for (var i = 1; i < ordenado.length; i++) {
  var ant = ordenado[i - 1], at = ordenado[i];
  if (ant.score === at.score) continue;
  var vAnt = ant.qtd * ant.preco, vAt = at.qtd * at.preco;
  var maiorAcao = Math.max(ant.preco, at.preco);
  ok(vAnt >= vAt - maiorAcao,
    'Peso invertido: ' + ant.ticker + ' (score ' + ant.score + ', R$ ' + vAnt.toFixed(2) +
    ') alocou menos que ' + at.ticker + ' (score ' + at.score + ', R$ ' + vAt.toFixed(2) + ').');
}

// Capital não pode ficar ocioso em cenário que cabe
ok(valorTotal / CAPITAL > 0.90,
  'Capital ocioso: apenas ' + (valorTotal / CAPITAL * 100).toFixed(1) + '% alocado.');

// Risco agregado coerente (soma dos riscos, nada de número mágico)
ok(riscoTotal > 0 && riscoTotal < CAPITAL * 0.10,
  'Risco agregado fora do razoavel: R$ ' + riscoTotal.toFixed(2));


// ---------------------------------------------------------------------------
// (3) CASOS DE BORDA
// ---------------------------------------------------------------------------
console.log('\n=== (3) Casos de borda ===');

/**
 * Roda o código de produção e devolve métricas agregadas.
 * @param {string} nome rótulo do cenário.
 * @param {Array} trades lista de trades.
 * @param {number} capital capital.
 * @return {Object} { r, valor, risco }.
 */
function rodar(nome, trades, capital) {
  var r = harness.alocarComCodigoReal(JSON.parse(JSON.stringify(trades)), CFG, capital);
  var valor = r.trades.reduce(function (s, t) { return s + t.qtd * t.preco; }, 0);
  var risco = r.trades.reduce(function (s, t) { return s + t.riscoRs; }, 0);
  console.log('  ' + nome.padEnd(26) + ' trades ' + String(r.trades.length).padStart(2) +
    ' | alocado ' + (100 * valor / capital).toFixed(2).padStart(6) + '%' +
    ' | risco ' + (100 * risco / capital).toFixed(2).padStart(5) + '%' +
    ' | descartes ' + r.warns.length);
  return { r: r, valor: valor, risco: risco };
}

function mk(k, s, p, d, q) { return { ticker: k, score: s, preco: p, stop: p - d, qtd: q }; }

// 3.1 Único trade: nunca passa do teto por trade.
// Nota: o teto de RISCO (`qtd` do sizing, 5000 ações) é mais frouxo que o teto
// de capital (25%), então quem manda aqui é o de capital.
var unico = rodar('unico trade', [mk('UNI3', 90, 10.00, 1.00, 5000)], CAPITAL);
ok(unico.r.trades.length === 1, 'Trade unico deveria entrar na carteira.');
ok(unico.valor <= CAPITAL * CFG.MAX_TRADE_ALLOCATION + 0.01,
  'Trade unico alocou acima do teto por trade: R$ ' + unico.valor.toFixed(2));
// Com stop apertado o teto de 25% permite risco acima da meta de 2%/trade —
// isso é consequência do teto de capital, e precisa ser REPORTADO, não mudo.
ok(unico.risco / CAPITAL <= CFG.MAX_TRADE_ALLOCATION,
  'Risco do trade unico absurdo: ' + (unico.risco / CAPITAL * 100).toFixed(2) + '% do capital.');

// 3.2 Ativo caríssimo (1 ação > teto por trade) => descartado com motivo
var caro = rodar('ativo carissimo 999k', [mk('CARO3', 99, 999999.00, 999.00, 5)], CAPITAL);
ok(caro.r.trades.length === 0, 'Ativo com 1 acao > teto por trade deveria ser descartado.');
var descarteCaro = caro.r.warns.join('\n');
ok(/CARO3: capital insuficiente/.test(descarteCaro),
  'Motivo do descarte do ativo caro nao reportado: ' + descarteCaro);

// 3.3 Muitos ativos baratos (aperto): teto agregado respeitado, sem token
var muitos = [];
for (var q = 1; q <= 40; q++) muitos.push(mk('AAA' + q + '3', 60 + (q % 30), 5.00, 0.10, 800));
var resMuitos = rodar('40 ativos baratos', muitos, CAPITAL);
ok(resMuitos.valor <= CAPITAL * CFG.MAX_TOTAL_ALLOCATION + 0.01,
  '40 ativos estouraram o teto agregado: R$ ' + resMuitos.valor.toFixed(2));
ok(resMuitos.r.trades.length > 0, 'Nenhum trade sobreviveu com 40 elegiveis.');
ok(resMuitos.risco <= CAPITAL * CFG.MAX_TOTAL_ALLOCATION + 0.01,
  'Risco agregado absurdo no aperto: R$ ' + resMuitos.risco.toFixed(2));
var menorMuitos = resMuitos.r.trades.reduce(function (m, t) { return Math.min(m, t.qtd * t.preco); }, Infinity);
ok(menorMuitos >= CFG.MIN_LOTE_VALUE - 0.01, 'Token em cenario de 40 trades: R$ ' + menorMuitos.toFixed(2));

// 3.4 Ativo caro preservado pelo piso (1 ação já vale >= R$ 500)
var misto = rodar('caro 900 + papeis', [
  mk('BAR3', 60, 5.00, 0.40, 800),
  mk('MED3', 75, 40.00, 3.00, 100),
  mk('ALT3', 95, 900.00, 50.00, 10)
], CAPITAL);
var alvoAlto = misto.r.trades.filter(function (t) { return t.ticker === 'ALT3'; })[0];
ok(!!alvoAlto, 'Ativo caro ALT3 foi descartado (piso deveria preservar 1 acao >= R$ 500).');

// 3.5 Aperto severo: 20 ativos, capital curto — score precisa ordenar a fila
var vinte = [];
for (var w = 1; w <= 20; w++) vinte.push(mk('BBB' + w + '3', 55 + w * 2, 20.00, 0.50, 500));
var aperto = rodar('20 ativos, aperto', vinte, CAPITAL);
ok(aperto.valor <= CAPITAL * CFG.MAX_TOTAL_ALLOCATION + 0.01,
  'Aperto estourou o teto agregado: R$ ' + aperto.valor.toFixed(2));
aperto.r.trades.forEach(function (t) {
  ok(t.qtd * (t.preco - t.stop) <= CAPITAL * 0.02 + 0.01,
    t.ticker + ' estourou o risco-alvo no aperto: R$ ' +
    (t.qtd * (t.preco - t.stop)).toFixed(2));
});
// No aperto, os maiores scores devem estar dentro
var scoresNaCarteira = aperto.r.trades.map(function (t) { return t.score; });
var maiorFora = vinte.filter(function (t) { return scoresNaCarteira.indexOf(t.score) === -1; })
  .reduce(function (m, t) { return Math.max(m, t.score); }, 0);
ok(maiorFora < Math.max.apply(null, scoresNaCarteira),
  'Score ' + maiorFora + ' ficou fora enquanto score menor entrou.');

// 3.6 Cenário que expõe o bug da v15.0: papéis com distância de stop muito
// diferente. A v15.0 dava a MESMA cota em R$ para os dois, ignorando o `qtd`
// do sizing — o papel de stop largo recebia 5x mais risco.
var stops = [
  mk('APER3', 80, 20.00, 0.50, 400),   // stop apertado: risco-alvo em 400 ações
  mk('LARG3', 80, 20.00, 2.50, 80)     // stop largo:   risco-alvo em 80 ações
];
var resStops = rodar('stops desiguais', stops, CAPITAL);
var ap = resStops.r.trades.filter(function (t) { return t.ticker === 'APER3'; })[0];
var lg = resStops.r.trades.filter(function (t) { return t.ticker === 'LARG3'; })[0];
ok(!!ap && !!lg, 'Cenario de stops desiguais perdeu um dos ativos.');
if (ap && lg) {
  ok(ap.riscoRs <= CAPITAL * 0.02 + 0.01, 'APER3 estourou o risco-alvo: R$ ' + ap.riscoRs.toFixed(2));
  ok(lg.riscoRs <= CAPITAL * 0.02 + 0.01, 'LARG3 estourou o risco-alvo: R$ ' + lg.riscoRs.toFixed(2));
  ok(lg.qtd <= 80, 'LARG3 foi inflado acima do sizing (' + lg.qtd + ' > 80).');
}

// 3.7 Com a distribuição por score DESLIGADA, cada trade fica no próprio
// risco (comportamento de auditoria quando o usuário quer "risco puro").
var cfgSemScore = {
  MAX_TRADE_ALLOCATION: CFG.MAX_TRADE_ALLOCATION,
  MAX_TOTAL_ALLOCATION: CFG.MAX_TOTAL_ALLOCATION,
  MIN_LOTE_VALUE: CFG.MIN_LOTE_VALUE,
  ALOCACAO_POR_SCORE: false
};
var semScoreTrades = JSON.parse(JSON.stringify(cenárioReal));
var semScore = harness.alocarComCodigoReal(semScoreTrades, cfgSemScore, CAPITAL);
var valorSemScore = semScore.trades.reduce(function (s, t) { return s + t.qtd * t.preco; }, 0);
var riscoSemScore = semScore.trades.reduce(function (s, t) { return s + t.riscoRs; }, 0);
console.log('  ' + 'score desligado'.padEnd(26) + ' trades ' + String(semScore.trades.length).padStart(2) +
  ' | alocado ' + (100 * valorSemScore / CAPITAL).toFixed(2).padStart(6) + '%' +
  ' | risco ' + (100 * riscoSemScore / CAPITAL).toFixed(2).padStart(5) + '%');
ok(valorSemScore <= CAPITAL * CFG.MAX_TOTAL_ALLOCATION + 0.01,
  'Modo sem score estourou o teto agregado: R$ ' + valorSemScore.toFixed(2));
semScore.trades.forEach(function (t) {
  ok(t.qtd <= t._qtdInicial,
    t.ticker + ': modo sem score AUMENTOU a quantidade (' + t.qtd + ' > ' + t._qtdInicial + ').');
});

// ---------------------------------------------------------------------------
// RESULTADO
// ---------------------------------------------------------------------------
console.log('\n' + '-'.repeat(60));
if (falhas.length) {
  console.log('FALHAS (' + falhas.length + '/' + checks + '):');
  falhas.forEach(function (f) { console.log('  X ' + f); });
  process.exit(1);
}
console.log('SUCESSO: ' + checks + '/' + checks + ' verificacoes passaram (Bug 4 / Ranker v15.1).');
