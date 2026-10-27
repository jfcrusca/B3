/**
 * EXPERIMENTO OFFLINE — Impacto do `swingLow` (suporte) na decisão
 * =============================================================================
 * PERGUNTA: se o `swingLow` — hoje calculado em `_analisarEstruturaMercado`
 * (linha 367) e NUNCA lido — fosse usado para validar o pullback, quantos
 * ativos mudariam de decisão?
 *
 * MÉTODO (sem tocar no código de produção):
 *   1. Roda o pipeline REAL do 22_Core_Analyzers (via _harness_core22).
 *   2. Gera milhares de séries sintéticas cobrindo regimes distintos
 *      (tendência de alta/baixa, lateral, alta volatilidade, baixa vol.).
 *   3. Mede, para cada série, a distância entre `swingLow` e a zona de compra
 *      Fibonacci (`[zonaPiso, zonaTeto]`).
 *   4. Classifica o cenário em 3 resultados possíveis:
 *        CONFIRMA   — swingLow CAI DENTRO da zona (suporte valida o pullback)
 *        PROXIMO    — swingLow está a <= X% da zona (suporte quase lá)
 *        CONTRARIA  — swingLow está LONGE, acima da zona (o pullback Fibo
 *                     fica ABAIXO do último fundo => comprar no rompimento
 *                     de um suporte, sinal de fraqueza)
 *        NEUTRO     — swingLow abaixo da zona (suporte mais profundo; o
 *                     pullback Fibo é apenas uma parada intermediária)
 *   5. Quantifica quantos setups/score mudariam se `inFiboZone` fosse
 *      reforçado por suporte (thresholds reais: inFiboZone +20, confluência +25).
 *
 * IMPORTANTE: isto é MEDIÇÃO. Nenhuma regra de produção é alterada.
 *
 * Uso:  node scripts/exp_swinglow_impacto.js [--verbose] [--series N]
 */

var core22 = require('./_harness_core22');

var VERBOSE = process.argv.indexOf('--verbose') !== -1;
var NFiltro = (function () {
  var i = process.argv.indexOf('--series');
  return (i !== -1) ? Number(process.argv[i + 1]) : 400;
})();

// =============================================================================
// 1) GERADOR DE SÉRIES SINTÉTICAS
// =============================================================================
// Semente determinística (LCG) para o experimento ser REPRODUTÍVEL.
// Math.random() daria números diferentes a cada execução — inútil para medir.
var _seed = 12345;
function rand() {
  _seed = (_seed * 1103515245 + 12345) % 2147483648;
  return _seed / 2147483648;
}
function randNormal() {
  // Box-Muller
  var u = Math.max(rand(), 1e-9), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Gera uma série OHLC de 90 candles simulando um regime de mercado.
 *
 * @param {Object} p
 * @param {number} p.tendencia    drift por candle (ex.: +0.004 = +0.4%/dia)
 * @param {number} p.vol          volatilidade por candle (desvio do log-retorno)
 * @param {number} p.pullback     fração da tendência devolvida nos últimos candles
 * @param {number} p.nPullback    quantos candles finais fazem o pullback
 * @param {number} p.base         preço inicial
 * @return {Array} candles { date, open, high, low, close, volume }
 */
function gerarSerie(p) {
  var n = 90;
  var preco = p.base || 50;
  var candles = [];
  var d0 = new Date(2025, 0, 1).getTime();

  for (var i = 0; i < n; i++) {
    // Nos últimos `nPullback` candles, inverte o drift (correção).
    var emPullback = (i >= n - p.nPullback);
    var drift = emPullback ? (-p.tendencia * p.pullback) : p.tendencia;

    var ret = drift + randNormal() * p.vol;
    var open = preco;
    var close = preco * Math.exp(ret);

    // Pavio proporcional à volatilidade do regime (amplitude realista).
    var pavio = Math.abs(close - open) * 0.6 + close * p.vol * 0.5;
    var high = Math.max(open, close) + Math.abs(randNormal()) * pavio;
    var low = Math.min(open, close) - Math.abs(randNormal()) * pavio;

    candles.push({
      date: new Date(d0 + i * 86400000),
      open: open,
      high: high,
      low: low,
      close: close,
      volume: 1000000 * (0.7 + rand() * 0.6)
    });

    preco = close;
  }
  return candles;
}

/**
 * Produz um lote de cenários cobrindo os regimes relevantes.
 * A ideia é ter massa estatística em cada arquétipo, não só em tendência de alta.
 */
function gerarCenarios(qtd) {
  var regIm = [
    // nome,                   tendencia, vol,    pullback, nPullback
    ['ALTA_FORTE_PUXADA',       0.006,  0.014,  0.55,  6],
    ['ALTA_MODERADA_PUXADA',    0.003,  0.012,  0.45,  8],
    ['ALTA_FRACA_PUXADA',       0.0015, 0.010,  0.40, 10],
    ['ALTA_VOL_PUXADA',         0.005,  0.028,  0.60,  5],
    ['ALTA_BAIXA_VOL',          0.004,  0.006,  0.35,  7],
    ['LATERAL',                 0.000,  0.012,  0.50,  8],
    ['LATERAL_VOL',             0.000,  0.022,  0.50,  6],
    ['BAIXA_PUXADA',           -0.004,  0.014,  0.40,  8],
    ['ALTA_SEM_PULLBACK',       0.005,  0.013,  0.00,  0],
    ['ALTA_PULLBACK_PROFUNDO',  0.005,  0.013,  1.10,  8],
    ['ALTA_PULLBACK_LEVE',      0.005,  0.013,  0.18,  6]
  ];

  var out = [];
  var porRegime = Math.ceil(qtd / regIm.length);
  regIm.forEach(function (r) {
    for (var k = 0; k < porRegime; k++) {
      out.push({
        regime: r[0],
        candles: gerarSerie({
          tendencia: r[1], vol: r[2], pullback: r[3],
          nPullback: r[4], base: 20 + rand() * 60
        })
      });
    }
  });
  return out;
}

// =============================================================================
// 2) CLASSIFICAÇÃO DO RELACIONAMENTO swingLow x ZONA DE COMPRA
// =============================================================================
// Tolerância para considerar o suporte "na borda" da zona.
// 1,5% é próximo do LIMITE_ENTRADA_FIBO (3%) usado no 29_*, mas mais rígido:
// queremos medir alinhamento estrutural, não a banda de execução.
var TOL_BORDA_PCT = 0.015;

/**
 * Classifica como o `swingLow` se relaciona com a zona de compra Fibonacci.
 *
 * A zona de compra é `[zonaPiso, zonaTeto]` onde (visto em 22_Core_Analyzers):
 *   zonaPiso = fibo618 - ATR*0.5   (piso, mais profundo)
 *   zonaTeto = fibo50  + ATR*0.5   (teto, mais raso)
 * Preço ABAIXO de zonaPiso = abaixo da zona. Preço ACIMA de zonaTeto = acima.
 *
 * @param {number} swingLow último pivô de fundo (suporte estrutural)
 * @param {Object} est      estrutura retornada por _analisarEstruturaMercado
 * @return {Object} { classe, distPct }
 */
function classificarSuporte(swingLow, est) {
  var piso = est.zonaPiso, teto = est.zonaTeto;

  // Sem pivô válido não há como julgar.
  if (swingLow == null || !isFinite(swingLow) || swingLow <= 0) {
    return { classe: 'SEM_PIVOT', distPct: null };
  }

  // DENTRO da zona: o suporte coincide com a faixa de compra => pullback validado.
  if (swingLow >= piso && swingLow <= teto) {
    return { classe: 'CONFIRMA', distPct: 0 };
  }

  // ACIMA da zona: o fundo está mais alto que o pullback Fibo.
  // Comprar no Fibo significa comprar DEPOIS de perder o último suporte.
  if (swingLow > teto) {
    var acimaPct = (swingLow - teto) / teto;
    return {
      classe: (acimaPct <= TOL_BORDA_PCT) ? 'PROXIMO_ACIMA' : 'CONTRARIA',
      distPct: acimaPct
    };
  }

  // ABAIXO da zona: há um suporte mais profundo. O Fibo é parada intermediária.
  var abaixoPct = (piso - swingLow) / piso;
  return {
    classe: (abaixoPct <= TOL_BORDA_PCT) ? 'PROXIMO_ABAIXO' : 'NEUTRO_ABAIXO',
    distPct: abaixoPct
  };
}

// =============================================================================
// 3) EXECUÇÃO DO EXPERIMENTO
// =============================================================================
function executar(qtd) {
  var cenarios = gerarCenarios(qtd);
  var linhas = [];
  var falhas = 0;

  cenarios.forEach(function (c) {
    var r;
    try {
      r = core22.analisar(c.candles, { ticker: 'EXP' });
    } catch (e) {
      falhas++;
      if (VERBOSE) console.error('falha: ' + e.message);
      return;
    }
    var est = r.estrutura;
    if (!est || est.fibo618 == null) return;

    var cls = classificarSuporte(est.swingLow, est);

    linhas.push({
      regime: c.regime,
      preco: c.candles[c.candles.length - 1].close,
      swingLow: est.swingLow,
      zonaPiso: est.zonaPiso,
      zonaTeto: est.zonaTeto,
      fibo618: est.fibo618,
      inFiboZone: est.inFiboZone,
      temConfluencia: est.temConfluencia,
      classe: cls.classe,
      distPct: cls.distPct,
      // O swingLow pode ter caído no fallback l50 (sem pivô detectado)?
      usouFallback: Math.abs(est.swingLow - est.l50) < 1e-9,
      rr: r.risco ? r.risco.rrRealista : null,
      score: r.resultado ? r.resultado.score : null,
      setup: r.resultado ? r.resultado.setup : null
    });
  });

  return { linhas: linhas, falhas: falhas, total: cenarios.length };
}

// =============================================================================
// 4) RELATÓRIO
// =============================================================================
function pct(a, b) {
  if (!b) return '  0,0%';
  return ((a / b) * 100).toFixed(1).replace('.', ',') + '%';
}
function titulo(t) {
  console.log('\n' + '='.repeat(78));
  console.log(' ' + t);
  console.log('='.repeat(78));
}

function relatorio(res) {
  var L = res.linhas;
  var n = L.length;

  titulo('AMOSTRA');
  console.log('  Cenarios gerados : ' + res.total);
  console.log('  Analisados       : ' + n + '   (falhas: ' + res.falhas + ')');
  console.log('  Regimes          : ' + Object.keys(L.reduce(function (a, x) {
    a[x.regime] = 1; return a; }, {})).length);

  // ---------------- 4.1 Distribuição das classes ----------------
  titulo('4.1  RELACAO ENTRE swingLow (SUPORTE) E A ZONA DE COMPRA FIBO');
  var classes = {};
  L.forEach(function (x) { classes[x.classe] = (classes[x.classe] || 0) + 1; });

  var ordem = ['CONFIRMA', 'PROXIMO_ACIMA', 'PROXIMO_ABAIXO', 'CONTRARIA',
    'NEUTRO_ABAIXO', 'SEM_PIVOT'];
  var desc = {
    CONFIRMA:       'Suporte DENTRO da zona de compra (pullback validado)',
    PROXIMO_ACIMA:  'Suporte logo ACIMA da zona (<=1,5% acima do teto)',
    PROXIMO_ABAIXO: 'Suporte logo ABAIXO da zona (<=1,5% abaixo do piso)',
    CONTRARIA:      'Suporte ACIMA da zona (Fibo abaixo do ultimo fundo)',
    NEUTRO_ABAIXO:  'Suporte bem ABAIXO da zona (Fibo = parada intermediaria)',
    SEM_PIVOT:      'Nenhum pivo de fundo detectado'
  };
  ordem.forEach(function (k) {
    var v = classes[k] || 0;
    console.log('  ' + k.padEnd(14) + String(v).padStart(4) + '  ' +
      pct(v, n).padStart(7) + '   ' + desc[k]);
  });

  // ---------------- 4.2 Distribuição por regime ----------------
  titulo('4.2  ONDE O SUPORTE CAI, POR REGIME');
  var regs = {};
  L.forEach(function (x) {
    regs[x.regime] = regs[x.regime] || { CONFIRMA: 0, CONTRARIA: 0, PROXIMO_ACIMA: 0,
      PROXIMO_ABAIXO: 0, NEUTRO_ABAIXO: 0, SEM_PIVOT: 0, tot: 0 };
    regs[x.regime][x.classe]++;
    regs[x.regime].tot++;
  });
  console.log('  ' + 'REGIME'.padEnd(24) + 'CONFIRMA'.padStart(9) + 'CONTRAR.'.padStart(9) +
    'PROX_AC'.padStart(9) + 'PROX_AB'.padStart(9) + 'NEUTR.AB'.padStart(10));
  console.log('  ' + '-'.repeat(70));
  Object.keys(regs).sort().forEach(function (k) {
    var g = regs[k];
    console.log('  ' + k.padEnd(24) +
      pct(g.CONFIRMA, g.tot).padStart(9) +
      pct(g.CONTRARIA, g.tot).padStart(9) +
      pct(g.PROXIMO_ACIMA, g.tot).padStart(9) +
      pct(g.PROXIMO_ABAIXO, g.tot).padStart(9) +
      pct(g.NEUTRO_ABAIXO, g.tot).padStart(10));
  });

  // ---------------- 4.3 Magnitude da distância ----------------
  titulo('4.3  QUAO LONGE O SUPORTE ESTA DA ZONA');
  var dias = L.filter(function (x) { return x.distPct != null && x.distPct > 0; })
    .map(function (x) { return x.distPct * 100; })
    .sort(function (a, b) { return a - b; });
  if (dias.length) {
    var q = function (f) {
      return dias[Math.min(dias.length - 1, Math.floor(dias.length * f))]
        .toFixed(2).replace('.', ',');
    };
    console.log('  Casos com suporte FORA da zona: ' + dias.length +
      ' (' + pct(dias.length, n) + ')');
    console.log('     Mediana : ' + q(0.5) + '%');
    console.log('     P25     : ' + q(0.25) + '%');
    console.log('     P75     : ' + q(0.75) + '%');
    console.log('     P95     : ' + q(0.95) + '%');
    console.log('     Maxima  : ' + dias[dias.length - 1].toFixed(2).replace('.', ',') + '%');
  }

  // ---------------- 4.4 Qualidade do pivô ----------------
  var fb = L.filter(function (x) { return x.usouFallback; }).length;
  titulo('4.4  QUALIDADE DO PIVO');
  console.log('  swingLow == l50 (fallback, SEM pivo real): ' + fb + '  ' + pct(fb, n));
  console.log('  Pivo real detectado                      : ' + (n - fb) + '  ' + pct(n - fb, n));
  if (fb > 0) {
    console.log('  => Nestas ' + fb + ' series o swingLow NAO carrega informacao estrutural');
    console.log('     (usa a minima de 60d como fallback).');
  }

  // ---------------- 4.5 Impacto potencial na decisão ----------------
  titulo('4.5  IMPACTO POTENCIAL NA DECISAO (se o suporte fosse exigido)');
  var confirma = classes.CONFIRMA || 0;
  var proxAc = classes.PROXIMO_ACIMA || 0;
  var proxAb = classes.PROXIMO_ABAIXO || 0;
  var estrito = confirma;
  var tolerante = confirma + proxAc + proxAb;

  console.log('  Regra ESTRITA   (swingLow dentro da zona) .......' +
    String(estrito).padStart(5) + '  ' + pct(estrito, n).padStart(7) + '  passariam');
  console.log('  Regra TOLERANTE (+/-' + (TOL_BORDA_PCT * 100).toFixed(1).replace('.', ',') +
    '% em volta da zona) ...' + String(tolerante).padStart(5) + '  ' +
    pct(tolerante, n).padStart(7) + '  passariam');
  console.log('  Hoje (sem suporte) .............................' +
    String(n).padStart(5) + '  100,0%');
  console.log('');
  console.log('  => Exigir suporte na zona ELIMINARIA ' + pct(n - estrito, n) + ' dos cenarios.');
  console.log('  => Regra tolerante elimina ' + pct(n - tolerante, n) + '.');

  var inZone = L.filter(function (x) { return x.inFiboZone; }).length;
  console.log('');
  console.log('  Contexto: hoje inFiboZone=true em ' + inZone + ' series (' + pct(inZone, n) + ').');
  var inZoneConf = L.filter(function (x) {
    return x.inFiboZone && x.classe === 'CONFIRMA'; }).length;
  var inZoneSem = inZone - inZoneConf;
  console.log('  Dessas, ' + inZoneConf + ' tem suporte na zona e ' + inZoneSem +
    ' NAO tem (' + pct(inZoneSem, inZone) + ').');

  // ---------------- 4.6 Impacto no score ----------------
  titulo('4.6  IMPACTO NO SCORE (pesos reais do 22_Core_Analyzers)');
  console.log('  inFiboZone     : +20  (linha 751)  + 15 se volume >= 1.2');
  console.log('  temConfluencia : +25  (linha 757)  + 10 se volume >= 1.5');
  console.log('');
  var semConf = L.filter(function (x) {
    return !x.temConfluencia && x.classe === 'CONFIRMA'; }).length;
  console.log('  Se "suporte na zona" compusesse temConfluencia:');
  console.log('    ' + semConf + ' series ganhariam +25 (' + pct(semConf, n) + ' da amostra).');
  var comConf = L.filter(function (x) { return x.temConfluencia; }).length;
  console.log('    ' + comConf + ' series ja tem confluencia por EMA (' + pct(comConf, n) + ').');
  console.log('');
  console.log('  Se "sem suporte" passasse a ANULAR inFiboZone:');
  console.log('    ' + (n - confirma) + ' series perderiam +20 (' + pct(n - confirma, n) + ').');

  // ---------------- 4.7 Setups ----------------
  titulo('4.7  SETUPS GERADOS HOJE vs. CLASSE DE SUPORTE');
  var setups = {};
  L.forEach(function (x) {
    var s = (x.setup || 'NULL');
    setups[s] = setups[s] || { tot: 0, confirma: 0 };
    setups[s].tot++;
    if (x.classe === 'CONFIRMA') setups[s].confirma++;
  });
  Object.keys(setups).sort(function (a, b) { return setups[b].tot - setups[a].tot; })
    .forEach(function (k) {
      var g = setups[k];
      console.log('  ' + k.substring(0, 34).padEnd(36) + String(g.tot).padStart(4) +
        '  (suporte na zona: ' + pct(g.confirma, g.tot) + ')');
    });
}

// =============================================================================
// 5) MAIN
// =============================================================================
(function main() {
  console.log('\n>>> EXPERIMENTO: impacto do swingLow (suporte) no pullback');
  console.log('>>> Fonte: 22_Core_Analyzers.js REAL via _harness_core22');

  var res = executar(NFiltro);
  relatorio(res);

  titulo('VEREDITO');
  var L = res.linhas, n = L.length;
  var conf = L.filter(function (x) { return x.classe === 'CONFIRMA'; }).length;
  var contra = L.filter(function (x) { return x.classe === 'CONTRARIA'; }).length;
  console.log('  Amostra: ' + n + ' series | Suporte na zona: ' + pct(conf, n) +
    ' | Suporte acima da zona (contra): ' + pct(contra, n));
  console.log('');
  console.log('  Esta medicao apenas QUANTIFICA. Nenhuma regra de producao foi alterada.');
  console.log('');
})();

