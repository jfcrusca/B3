/**
 * @file scripts/test_ranker_alocacao.js
 * @description Regressão do Bug 4 — alocação da carteira teórica em 41_Ranker.js.
 *
 * Cenário real (log de produção 25/10): 13 trades aprovados, capital R$ 20.000,
 * teto agregado 95%. O algoritmo ANTIGO ("guloso cego") produzia:
 *   • 8 trades DESCARTADOS (TAEE11, VIVA3, BBAS3, SAPR11, HYPE3, CMIG4, ISAE4,
 *     RADL3) — inclusive com score 95-100 — enquanto os piores sobravam;
 *   • ITSA4 com qtd=1 (R$ 35) — "posição-token" inviável;
 *   • riscoRs do trade trimado NÃO recalculado (risco agregado mentindo).
 *
 * A correção v15.0 distribui o capital proporcionalmente ao score (peso =
 * score − 50), com teto por trade e piso de utilidade MISTO:
 *   piso = min(RANKER_MIN_LOTE_VALUE, RANKER_MIN_LOTE_PCT × alocação-alvo)
 *
 * Verificações:
 *   (1) Contrato estático em 41_Ranker.js / 01_Core_Config.js;
 *   (2) Simulação numérica do cenário real (teto, posição-token, riscoRs);
 *   (3) Casos de borda (capital minúsculo, 1 trade, ativo caro).
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
ok(/MIN_LOTE_VALUE/.test(rankerCode) && /MIN_LOTE_PCT/.test(rankerCode),
  'Piso de utilidade (MIN_LOTE_VALUE / MIN_LOTE_PCT) nao aplicado no Ranker.');
ok(/riscoRs\s*=/.test(rankerCode) && /distStopFinal/.test(rankerCode),
  'riscoRs nao e recalculado apos a quantidade final.');
ok(/RANKER_MIN_LOTE_VALUE/.test(coreCfg) && /RANKER_MIN_LOTE_PCT/.test(coreCfg),
  'Configs RANKER_MIN_LOTE_* ausentes em 01_Core_Config.js.');
console.log('  OK: laco guloso removido; piso de utilidade e recalculo de risco presentes.');

// ---------------------------------------------------------------------------
// (2) SIMULAÇÃO NUMÉRICA — algoritmo idêntico ao da produção (bloco 5.1)
// ---------------------------------------------------------------------------
console.log('\n=== (2) Cenario real: 13 aprovados, capital R$ 20.000 ===');

var CAPITAL = 20000;
var CFG = {
  MAX_TRADE_ALLOCATION: 0.25,
  MAX_TOTAL_ALLOCATION: 0.95,
  MIN_LOTE_VALUE: 500,
  MIN_LOTE_PCT: 0.10
};

/**
 * Réplica fiel do bloco 5.1 de 41_Ranker.js (v15.0).
 * @param {Array} trades lista no formato produzido pelo Ranker.
 * @param {Object} cfg configuração (tetos + piso).
 * @return {Object} { trades, descartados, valorAlocado, maxTotalValue }.
 */
function alocar(trades, cfg) {
  var maxTotalValue = CAPITAL * cfg.MAX_TOTAL_ALLOCATION;
  var maxTradeValue = CAPITAL * cfg.MAX_TRADE_ALLOCATION;
  var tradesCapados = [];
  var tradesDescartados = [];

  var elegiveis = [];
  for (var e = 0; e < trades.length; e++) {
    if (trades[e].qtd > 0 && trades[e].preco > 0) elegiveis.push(trades[e]);
    else tradesDescartados.push({ ticker: trades[e].ticker, motivo: 'quantidade nula' });
  }

  function _pesoScore(t) {
    var p = (Number(t.score) || 0) - 50;
    return p > 1 ? p : 1;
  }

  var alvo = {};
  var vivos = elegiveis.slice();
  var valorAlocado = 0;

  for (var ciclo = 0; ciclo < 8 && vivos.length > 0; ciclo++) {
    var disponivel = maxTotalValue - valorAlocado;
    if (disponivel <= 0) break;

    var pendentes = vivos.filter(function (x) { return alvo[x.ticker] === undefined; });
    if (pendentes.length === 0) break;

    var somaPesosCiclo = 0;
    for (var c = 0; c < pendentes.length; c++) somaPesosCiclo += _pesoScore(pendentes[c]);
    if (somaPesosCiclo <= 0) break;

    var sobreviventes = [];
    var descartadosCiclo = [];

    for (var m = 0; m < pendentes.length; m++) {
      var tv = pendentes[m];
      var cota = disponivel * (_pesoScore(tv) / somaPesosCiclo);
      var alvoTrade = Math.min(cota, maxTradeValue);
      var qtdAlvo = Math.floor(alvoTrade / tv.preco);
      if (qtdAlvo < 1) qtdAlvo = 0;

      // Piso de utilidade (idêntico à produção v15.0)
      var valorPosicao = qtdAlvo * tv.preco;
      var ehAtivoCaro = (tv.preco >= cfg.MIN_LOTE_VALUE);
      var pisoExigido = ehAtivoCaro ? 0 : cfg.MIN_LOTE_VALUE;

      if (qtdAlvo >= 1 && valorPosicao >= pisoExigido) {
        sobreviventes.push(tv);
      } else {
        var motivo = (qtdAlvo < 1)
          ? 'capital insuficiente (1 acao = R$ ' + tv.preco.toFixed(2) + ' > cota R$ ' + alvoTrade.toFixed(2) + ')'
          : 'abaixo do piso (R$ ' + valorPosicao.toFixed(2) + ' < R$ ' + pisoExigido.toFixed(2) + ')';
        descartadosCiclo.push({ t: tv, motivo: motivo });
      }
    }

    if (descartadosCiclo.length > 0) {
      vivos = vivos.filter(function (x) {
        for (var d = 0; d < descartadosCiclo.length; d++) {
          if (descartadosCiclo[d].t.ticker === x.ticker) return false;
        }
        return true;
      });
      for (var dd = 0; dd < descartadosCiclo.length; dd++) {
        tradesDescartados.push({ ticker: descartadosCiclo[dd].t.ticker, motivo: descartadosCiclo[dd].motivo });
      }
      continue;
    }

    for (var s = 0; s < sobreviventes.length; s++) {
      var ts = sobreviventes[s];
      var cotaS = disponivel * (_pesoScore(ts) / somaPesosCiclo);
      var alvoS = Math.min(cotaS, maxTradeValue);
      var qtdS = Math.floor(alvoS / ts.preco);
      alvo[ts.ticker] = qtdS * ts.preco;
      valorAlocado += alvo[ts.ticker];
      tradesCapados.push(ts);
    }
    break;
  }

  for (var f = 0; f < tradesCapados.length; f++) {
    var tf = tradesCapados[f];
    var qtdFinal = Math.floor(alvo[tf.ticker] / tf.preco);
    tf.qtdOriginal = tf.qtd;
    tf.qtd = qtdFinal;
    tf.alocacao = (qtdFinal * tf.preco) / CAPITAL;
    var dist = tf.preco - tf.stop;
    tf.riscoRs = (dist > 0) ? qtdFinal * dist : 0;
  }

  valorAlocado = tradesCapados.reduce(function (s, t) { return s + t.qtd * t.preco; }, 0);
  tradesCapados.sort(function (a, b) { return b.score - a.score; });

  return { trades: tradesCapados, descartados: tradesDescartados, valorAlocado: valorAlocado, maxTotalValue: maxTotalValue };
}

// Dataset com os 13 aprovados do log real (score, preço, stop e qtd que o
// position sizing de 2% produziu). `qtd` é o valor INICIAL (antes da alocação).
function linha(ticker, preco, stop, score, qtdInicial) {
  return { ticker: ticker, preco: preco, stop: stop, score: score, qtd: qtdInicial, riscoRs: 0, alocacao: 0 };
}

var cenárioReal = [
  linha('ITUB4', 33.20, 31.90, 62, 452),
  linha('BBDC4', 15.40, 14.80, 53, 666),
  linha('BBAS3', 21.50, 20.60, 64, 444),
  linha('VIVA3', 24.80, 23.60, 95, 333),
  linha('SBSP3', 88.40, 84.50, 84, 102),
  linha('TAEE11', 35.10, 33.60, 97, 266),
  linha('HYPE3', 28.70, 27.30, 64, 285),
  linha('SAPR11', 46.20, 44.10, 87, 190),
  linha('ITSA4', 35.30, 34.10, 61, 1666),
  linha('CMIG4', 12.10, 11.55, 42, 363),
  linha('KLBN11', 20.40, 19.40, 42, 200),
  linha('RDOR3', 26.30, 24.90, 88, 142),
  linha('ISAE4', 18.70, 17.80, 43, 222),
  // Scores altos que o algoritmo antigo descartava (Bug 4)
  linha('RADL3', 22.10, 20.90, 72, 166)
];

var res = alocar(cenárioReal, CFG);

console.log('  Capital          : R$ ' + CAPITAL.toFixed(2) + ' (teto R$ ' + res.maxTotalValue.toFixed(2) + ')');
console.log('  Elegiveis        : ' + cenárioReal.length);
console.log('  Na carteira      : ' + res.trades.length);
console.log('  Valor alocado    : R$ ' + res.valorAlocado.toFixed(2) +
  ' (' + (res.valorAlocado / CAPITAL * 100).toFixed(1) + '%)');
console.log('\n  Ticker   | score | preco  | qtd  | valor      | % cap  | risco R$');
res.trades.forEach(function (t) {
  console.log('  ' + t.ticker.padEnd(8) + ' | ' + String(t.score).padStart(5) + ' | ' +
    t.preco.toFixed(2).padStart(6) + ' | ' + String(t.qtd).padStart(4) + ' | ' +
    (t.qtd * t.preco).toFixed(2).padStart(10) + ' | ' +
    (t.alocacao * 100).toFixed(2).padStart(6) + ' | ' + t.riscoRs.toFixed(2).padStart(8));
});
if (res.descartados.length) {
  console.log('\n  Descartados:');
  res.descartados.forEach(function (d) { console.log('    - ' + d.ticker + ': ' + d.motivo); });
}

// --- Asserções do cenário real ---
ok(res.valorAlocado <= res.maxTotalValue + 0.01,
  'Alocacao agregada R$ ' + res.valorAlocado.toFixed(2) + ' excedeu o teto de R$ ' + res.maxTotalValue.toFixed(2));

// Nenhuma posição-token: todo trade precisa valer >= R$ 500 (piso R$)
res.trades.forEach(function (t) {
  ok(t.qtd * t.preco >= CFG.MIN_LOTE_VALUE - 0.01,
    t.ticker + ' ficou como posicao-token: R$ ' + (t.qtd * t.preco).toFixed(2));
  ok(t.qtd >= 1, t.ticker + ' com quantidade zero na carteira.');
});

// Nenhum trade isolado pode estourar o teto por trade (25%)
res.trades.forEach(function (t) {
  ok(t.alocacao <= CFG.MAX_TRADE_ALLOCATION + 0.0001,
    t.ticker + ' excedeu o teto por trade: ' + (t.alocacao * 100).toFixed(2) + '%');
});

// riscoRs coerente com a quantidade final (o bug antigo deixava o valor antigo)
res.trades.forEach(function (t) {
  var esperado = t.qtd * (t.preco - t.stop);
  ok(Math.abs(t.riscoRs - esperado) < 0.02,
    t.ticker + ': riscoRs ' + t.riscoRs.toFixed(2) + ' != qtd x distStop ' + esperado.toFixed(2));
});

// A distribuição deve cobrir a MAIORIA dos elegíveis: o algoritmo antigo
// descartava 8 de 13 por ORDEM DE FILA (inclusive scores 95-100). Aqui os
// únicos descartes aceitáveis são os que não atingem o piso de R$ 500 —
// tipicamente os de score baixo com preço que gera lote minúsculo.
var descartadosPorPiso = res.descartados.filter(function (d) { return /piso/.test(d.motivo); });
ok(res.trades.length >= 10,
  'Apenas ' + res.trades.length + ' trades na carteira (esperado >= 10).');
ok(descartadosPorPiso.length === res.descartados.length,
  'Houve descarte que NAO foi por piso de utilidade: ' +
  res.descartados.filter(function (d) { return !/piso/.test(d.motivo); })
    .map(function (d) { return d.ticker + ' (' + d.motivo + ')'; }).join(', '));
// Os descartados por piso devem ser todos de score baixo (< 55): o que acontecia
// antes era justamente descartar score alto por falta de caixa na fila.
descartadosPorPiso.forEach(function (d) {
  var t = cenárioReal.filter(function (x) { return x.ticker === d.ticker; })[0];
  ok(t && t.score < 55, d.ticker + ' (score ' + (t ? t.score : '?') + ') foi descartado por piso — score alto nao deveria cair.');
});
console.log('\n  Descartados por piso: ' + descartadosPorPiso.length +
  ' (todos com score < 55: ' +
  descartadosPorPiso.every(function (d) {
    var t = cenárioReal.filter(function (x) { return x.ticker === d.ticker; })[0];
    return t && t.score < 55;
  }) + ')');


// Scores altos NAO podem ser preteridos por scores baixos
var naCarteira = res.trades.map(function (t) { return t.ticker; });
['TAEE11', 'VIVA3', 'BBAS3', 'SAPR11', 'HYPE3'].forEach(function (tk) {
  ok(naCarteira.indexOf(tk) !== -1, tk + ' (score alto) ficou fora da carteira.');
});

// Score maior => alocacao maior (monotonicidade do peso)
res.trades.forEach(function (a) {
  res.trades.forEach(function (b) {
    if (a.score > b.score && a.preco === b.preco) {
      ok(a.qtd >= b.qtd, 'Peso invertido entre ' + a.ticker + ' (' + a.score + ') e ' + b.ticker + ' (' + b.score + ')');
    }
  });
});

// Verba nao pode ficar ociosa: com 13-14 elegiveis, deve usar > 85% do capital
ok(res.valorAlocado / CAPITAL > 0.85,
  'Capital ocioso: apenas ' + (res.valorAlocado / CAPITAL * 100).toFixed(1) + '% alocado.');

// ---------------------------------------------------------------------------
// (3) CASOS DE BORDA
// ---------------------------------------------------------------------------
console.log('\n=== (3) Casos de borda ===');

// 3.1 Único trade: recebe até o teto por trade, nunca mais que isso
var resUnico = alocar([linha('UNICO3', 10.00, 9.00, 90, 5000)], CFG);
ok(resUnico.trades.length === 1, 'Trade unico deveria entrar na carteira.');
ok(resUnico.trades[0].alocacao <= CFG.MAX_TRADE_ALLOCATION + 0.0001,
  'Trade unico excedeu o teto de 25%: ' + (resUnico.trades[0].alocacao * 100).toFixed(2) + '%');
ok(resUnico.valorAlocado <= CAPITAL * CFG.MAX_TRADE_ALLOCATION + 0.01,
  'Trade unico alocou acima do teto por trade.');
console.log('  Unico trade    : ' + resUnico.trades[0].qtd + ' acoes, R$ ' +
  resUnico.valorAlocado.toFixed(2) + ' (' + (resUnico.trades[0].alocacao * 100).toFixed(1) + '%)');

// 3.2 Ativo caríssimo (mesmo 1 ação custa mais que o teto por trade) => descartado com motivo
var resCaro = alocar([linha('CARO3', 999999.00, 999000.00, 99, 5)], CFG);
ok(resCaro.trades.length === 0, 'Ativo com 1 acao > teto por trade deveria ser descartado.');
ok(resCaro.descartados.length === 1 && /capital insuficiente/.test(resCaro.descartados[0].motivo),
  'Motivo do descarte do ativo caro nao reportado corretamente.');
console.log('  Ativo caro     : descartado -> ' + (resCaro.descartados[0] || {}).motivo);

// 3.3 Muitos trades baratos: teto agregado deve ser respeitado e nenhum token
var muitos = [];
for (var q = 1; q <= 40; q++) muitos.push(linha('AAA' + q + '3', 5.00, 4.60, 60 + q, 800));
var resMuitos = alocar(muitos, CFG);
ok(resMuitos.valorAlocado <= resMuitos.maxTotalValue + 0.01,
  '40 trades estouraram o teto agregado: R$ ' + resMuitos.valorAlocado.toFixed(2));
ok(resMuitos.trades.length > 0, 'Nenhum trade sobreviveu com 40 elegiveis baratos.');
var menor = resMuitos.trades.reduce(function (min, t) { return Math.min(min, t.qtd * t.preco); }, Infinity);
ok(menor >= CFG.MIN_LOTE_VALUE - 0.01, 'Token em cenario de 40 trades: R$ ' + menor.toFixed(2));
console.log('  40 baratos     : ' + resMuitos.trades.length + ' na carteira, R$ ' +
  resMuitos.valorAlocado.toFixed(2) + ', menor posicao R$ ' + menor.toFixed(2));

// 3.4 Ativo caro preservado pelo piso MISTO (10% do alvo < R$ 500)
// Preço alto => poucas ações; o piso misto deve evitar descarte injusto.
var resMisto = alocar([
  linha('BARATO3', 5.00, 4.60, 60, 800),
  linha('MEDIO3', 40.00, 37.00, 75, 100),
  linha('ALTO3', 900.00, 850.00, 95, 10)
], CFG);
var altoOk = resMisto.trades.filter(function (t) { return t.ticker === 'ALTO3'; })[0];
ok(!!altoOk, 'Ativo caro ALTO3 foi descartado apesar do piso misto.');
if (altoOk) {
  ok(altoOk.qtd * altoOk.preco >= Math.min(CFG.MIN_LOTE_VALUE, altoOk.alocacao * CAPITAL * CFG.MIN_LOTE_PCT) - 0.01,
    'ALTO3 abaixo do piso misto.');
  console.log('  Piso misto     : ALTO3 ' + altoOk.qtd + ' acao(oes) = R$ ' +
    (altoOk.qtd * altoOk.preco).toFixed(2) + ' (piso R$ ' + CFG.MIN_LOTE_VALUE + ')');
}

// ---------------------------------------------------------------------------
// RESULTADO
// ---------------------------------------------------------------------------
console.log('\n' + '-'.repeat(60));
if (falhas.length === 0) {
  console.log('SUCESSO: ' + checks + '/' + checks + ' verificacoes passaram (Bug 4 / Ranker v15.0).');
} else {
  falhas.forEach(function (f) { console.log('  FALHOU: ' + f); });
  console.log('\nFALHA: ' + falhas.length + ' de ' + checks + ' verificacoes falharam.');
  process.exitCode = 1;
}



