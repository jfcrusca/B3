/**
 * Harness offline para validar o pipeline da aba "Resumo_Trades_Aprovados"
 * (41_Ranker.js / PROCESSAR_CARTEIRA_FINAL) após a correção v12.8.
 *
 * Objetivo: confirmar que
 *   (1) uma linha AXIA3-like com stop >= preço (geometria inválida para COMPRA)
 *       é DESCARTADA e NÃO chega ao Resumo_Trades_Aprovados;
 *   (2) trades válidos (stop < preço) são mantidos com Position Sizing correto;
 *   (3) o Position Sizing NÃO usa Math.abs (não infla/inverte o risco).
 *
 * Replica o mapeamento de colunas de 41_Ranker.js e a lógica de descarte v12.8.
 */

// Mapeamento idêntico ao COL de 41_Ranker.js (aba Oportunidades, 16 colunas)
var COL = {
  DATA: 0, TICKER: 1, PRECO: 2, ENTRADA: 3, STOP: 4,
  ALVO1: 5, ALVO2: 6, RR: 7, RISCO: 8, RECOMENDACAO: 9,
  SCORE: 10, SETUP: 11, TIPO_SETUP: 12, ANALISE_TEC: 13, ANALISE_IA: 14, OBS: 15
};

var SECTOR_MAP = { 'AXIA3': 'Elétrica', 'RDXO34': 'Saúde', 'PETR4': 'Energia' };
var CAPITAL = 100000;
var RISK_LEVEL = 0.02;
var MAX_TRADE_ALLOCATION = 0.25; // teto por trade (v12.8, configurável)
var MAX_TOTAL_ALLOCATION = 0.95; // teto agregado (v12.8)

/** Cria uma linha no formato da aba Oportunidades. */
function linha(ticker, preco, entrada, stop, alvo1, rr, score, rec, setup) {
  var r = [];
  for (var i = 0; i < 16; i++) r.push('');
  r[COL.TICKER] = ticker;
  r[COL.PRECO] = preco;
  r[COL.ENTRADA] = entrada;
  r[COL.STOP] = stop;
  r[COL.ALVO1] = alvo1;
  r[COL.RR] = rr;
  r[COL.RECOMENDACAO] = rec;
  r[COL.SCORE] = score;
  r[COL.SETUP] = setup;
  r[COL.TIPO_SETUP] = 'PULLBACK';
  return r;
}

/** Replica o núcleo do laço de PROCESSAR_CARTEIRA_FINAL (v12.8). */
function processarRanker(data) {
  data = data.slice().sort(function(a, b) {
    return (Number(b[COL.SCORE]) || 0) - (Number(a[COL.SCORE]) || 0);
  });

  var trades = [];
  var descartados = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var ticker = String(r[COL.TICKER] || "").trim().toUpperCase();
    if (!ticker) continue;

    var recomendacao = String(r[COL.RECOMENDACAO] || "");
    if (recomendacao.indexOf('⛔') !== -1) continue;

    var preco = Number(r[COL.PRECO]) || 0;
    var score = Number(r[COL.SCORE]) || 0;
    var stop = Number(r[COL.STOP]) || 0;
    var entrada = Number(r[COL.ENTRADA]) || preco;

    // 🔧 v12.8 (lógica de produção): descarta geometria inválida para compra
    if (preco <= 0 || stop <= 0 || stop >= preco) {
      descartados.push(ticker + ' (stop=' + stop + ' >= preco=' + preco + ')');
      continue;
    }

    var distStop = preco - stop; // sem Math.abs

    var qtd = 0;
    if (distStop > 0 && preco > 0) {
      qtd = Math.floor((CAPITAL * RISK_LEVEL) / distStop);
      var maxQtdTrade = Math.floor((CAPITAL * MAX_TRADE_ALLOCATION) / preco);
      if (qtd > maxQtdTrade) qtd = maxQtdTrade;
    }

    var status = recomendacao.indexOf('✅') !== -1 ? '🚀 COMPRAR' : '🔭 RADAR';
    var setup = String(r[COL.SETUP] || "");
    var estrategia = String(r[COL.TIPO_SETUP] || "");

    trades.push({
      status: status, ticker: ticker, preco: preco,
      fibo: entrada, stop: stop, alvo: Number(r[COL.ALVO1]) || 0,
      qtd: qtd, alocacao: CAPITAL > 0 ? (qtd * preco) / CAPITAL : 0,
      rr: Number(r[COL.RR]) || 0, score: score, setup: setup,
      setor: SECTOR_MAP[ticker] || "Outros", estrategia: estrategia
    });
  }

  trades = trades.filter(function(t) {
    return t.score >= 50 && (t.status === "🚀 COMPRAR" || t.status === "🔭 RADAR");
  });

  // 🔧 v12.8: TETO AGREGADO DE ALOCAÇÃO (réplica da produção)
  var maxTotalValue = CAPITAL * MAX_TOTAL_ALLOCATION;
  var valorAlocado = 0;
  var tradesCapados = [];
  var tradesCapadosDescarte = [];
  for (var j = 0; j < trades.length; j++) {
    var tj = trades[j];
    var valorTrade = tj.qtd * tj.preco;
    if (valorTrade <= 0) continue;

    if (valorAlocado + valorTrade <= maxTotalValue) {
      valorAlocado += valorTrade;
      tradesCapados.push(tj);
    } else {
      var restante = maxTotalValue - valorAlocado;
      var qtdCabivel = Math.floor(restante / tj.preco);
      if (qtdCabivel > 0) {
        tj.qtd = qtdCabivel;
        tj.alocacao = CAPITAL > 0 ? (qtdCabivel * tj.preco) / CAPITAL : 0;
        valorAlocado += qtdCabivel * tj.preco;
        tradesCapados.push(tj);
      } else {
        tradesCapadosDescarte.push(tj.ticker);
      }
    }
  }

  return {
    trades: tradesCapados,
    descartados: descartados,
    descartadosCap: tradesCapadosDescarte,
    valorAlocado: valorAlocado,
    maxTotalValue: maxTotalValue
  };
}

// ---------------------------------------------------------------------------
// Dataset mock: RDXO34 (válido) + AXIA3 (inválido, stop acima do preço)
// ---------------------------------------------------------------------------
var dataset = [
  linha('RDXO34', 12.45, 12.45, 11.98, 13.88, 3.04, 81, '✅ ENTRAR AGORA (NA ZONA FIBO)', '📉 SWING PULLBACK FIBO'),
  linha('AXIA3', 54.80, 54.80, 57.19, 58.87, 1.85, 84.4, '⏳ AGUARDAR (R/R < 2)', '⛔ RISCO ALTO (RR < 2)')
];

var res = processarRanker(dataset);

console.log('\n=== VALIDAÇÃO: aba "Resumo_Trades_Aprovados" (v12.8) ===');
console.log('Linhas de entrada (Oportunidades)   : ' + dataset.length);
console.log('Descartadas por geometria inválida  : ' + res.descartados.length + (res.descartados.length ? ' -> ' + res.descartados.join(', ') : ''));
console.log('Trades aprovados no Resumo          : ' + res.trades.length);

console.log('\n--- Tabela que iria para o Resumo ---');
res.trades.forEach(function(t) {
  console.log('  ' + t.ticker + ' | ' + t.status + ' | preco ' + t.preco.toFixed(2) +
    ' | entrada ' + t.fibo.toFixed(2) + ' | stop ' + t.stop.toFixed(2) +
    ' | alvo ' + t.alvo.toFixed(2) + ' | RR ' + t.rr + ' | score ' + t.score +
    ' | qtd ' + t.qtd + ' | aloc ' + (t.alocacao * 100).toFixed(2) + '%');
});
console.log('  Alocação agregada: R$ ' + res.valorAlocado.toFixed(2) + ' / ' + res.maxTotalValue.toFixed(2) +
  ' (' + (res.valorAlocado / CAPITAL * 100).toFixed(1) + '% do capital, teto ' + (MAX_TOTAL_ALLOCATION * 100) + '%)');

console.log('\n--- Asserções ---');
var falhas = [];
var tickers = res.trades.map(function(t) { return t.ticker; });
if (tickers.indexOf('AXIA3') !== -1) {
  falhas.push('AXIA3 (stop acima do preço) NÃO deveria estar no Resumo.');
}
var rdx = res.trades.filter(function(t) { return t.ticker === 'RDXO34'; })[0];
if (!rdx) {
  falhas.push('RDXO34 (válido) deveria estar no Resumo.');
} else {
  if (rdx.stop >= rdx.preco) falhas.push('RDXO34 com stop >= preço.');
  // Position Sizing esperado: risco 2% / distStop, LIMITADO a 25% do capital por trade.
  var qtdRisco = Math.floor((CAPITAL * RISK_LEVEL) / (rdx.preco - rdx.stop));
  var qtdEsperada = (qtdRisco * rdx.preco) > (CAPITAL * 0.25)
    ? Math.floor((CAPITAL * 0.25) / rdx.preco)
    : qtdRisco;
  if (rdx.qtd !== qtdEsperada) falhas.push('Position Sizing divergente: ' + rdx.qtd + ' != ' + qtdEsperada);
  if (rdx.alocacao > 0.2501) falhas.push('Alocação acima do teto de 25%: ' + (rdx.alocacao * 100).toFixed(2) + '%');
}

// --- Cenário 2: MUITOS trades válidos → teto agregado de 95% deve limitar ---
console.log('\n=== CENÁRIO 2: Teto agregado de alocação (carteira teórica) ===');
var datasetGrande = [];
for (var k = 1; k <= 10; k++) {
  // Cada trade isolado pode alocar até 25%; 10 trades estourariam 250% do capital.
  datasetGrande.push(linha('AAA' + k + '3', 10.00, 10.00, 9.50, 12.00, 3.0, 90 - k, '✅ ENTRAR AGORA (NA ZONA FIBO)', '📈 TENDÊNCIA CONFIRMADA'));
}
var resGrande = processarRanker(datasetGrande);
console.log('  Trades elegíveis   : ' + datasetGrande.length);
console.log('  Trades na carteira : ' + resGrande.trades.length);
console.log('  Valor alocado      : R$ ' + resGrande.valorAlocado.toFixed(2) +
  ' (' + (resGrande.valorAlocado / CAPITAL * 100).toFixed(1) + '%)');
if (resGrande.valorAlocado > CAPITAL * MAX_TOTAL_ALLOCATION + 0.01) {
  falhas.push('Alocação agregada ' + (resGrande.valorAlocado / CAPITAL * 100).toFixed(1) +
    '% excedeu o teto de ' + (MAX_TOTAL_ALLOCATION * 100) + '%');
}
// A soma das alocações dos trades finais deve respeitar o teto
var somaFinal = resGrande.trades.reduce(function(s, t) { return s + t.qtd * t.preco; }, 0);
if (somaFinal > CAPITAL * MAX_TOTAL_ALLOCATION + 0.01) {
  falhas.push('Soma das alocações finais excede o teto: R$ ' + somaFinal.toFixed(2));
}

if (falhas.length) {
  falhas.forEach(function(a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: o Resumo_Trades_Aprovados conteria dados inconsistentes.');
  process.exitCode = 1;
} else {
  console.log('  ✅ AXIA3 (geometria inválida) descartado — não vaza para o Resumo.');
  console.log('  ✅ RDXO34 mantido com stop abaixo do preço.');
  console.log('  ✅ Position Sizing correto (sem Math.abs).');
  console.log('  ✅ Teto agregado de ' + (MAX_TOTAL_ALLOCATION * 100) + '% respeitado na carteira teórica.');
  console.log('\n✅ PASSOU: Resumo_Trades_Aprovados consistente após v12.8 (geometria + teto agregado).');
}
