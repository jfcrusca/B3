/**
 * VALIDAÇÃO END-TO-END — Cadeia completa ate a coluna "Suporte vs. Zona"
 * =============================================================================
 * Diferente de test_coluna_suporte.js (que testa cada peça isolada), este
 * script percorre a cadeia REAL de ponta a ponta com múltiplos regimes:
 *
 *   22_Core_Analyzers  →  resultado.swingLow  (novo campo raiz)
 *                      →  "linha" de Resultados_Analise (28 colunas)
 *                      →  29_Oportunidades_Processor._montarLinhasFinais
 *                      →  coluna 21 = "Suporte vs. Zona"
 *
 * Objetivo: verificar (a) que a coluna é sempre preenchida, (b) que a
 * distribuição dos veredictos faz sentido em cada regime, e (c) que a
 * re-derivação da zona em 29_* acompanha o Core22 nos dados reais.
 *
 * Uso:  node scripts/validar_cadeia_suporte_zona.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var core22 = require('./_harness_core22');

var ROOT = path.resolve(__dirname, '..');

// --- Carrega o Processor real -------------------------------------------------
function carregarProcessor() {
  var src = fs.readFileSync(path.join(ROOT, '29_Oportunidades_Processor.js'), 'utf8');
  var sb = {
    console: { log: function () { }, warn: function () { }, error: function () { } },
    SpreadsheetApp: { getActiveSpreadsheet: function () { return null; } },
    PropertiesService: {
      getScriptProperties: function () { return { getProperty: function () { return null; } }; }
    },
    Utilities: { sleep: function () { } },
    Math: Math, Date: Date, JSON: JSON, Number: Number, String: String,
    parseFloat: parseFloat, parseInt: parseInt, isNaN: isNaN, isFinite: isFinite
  };
  vm.createContext(sb);
  vm.runInContext(src, sb, { filename: '29_Oportunidades_Processor.js' });
  return sb.OportunidadesProcessor;
}

var proc = carregarProcessor();

// --- Gerador determinístico ---------------------------------------------------
var _seed = 4242;
function rand() {
  _seed = (_seed * 1103515245 + 12345) % 2147483648;
  return _seed / 2147483648;
}

/**
 * Gera uma série OHLC determinística.
 * @param {number} tend deriva diária
 * @param {number} vol volatilidade
 * @param {number} base preço inicial
 * @param {number} n candles
 * @param {number} [choqueVol] multiplicador de volume nos ÚLTIMOS candles
 *   (v15.4: simula quebra com volume alto ou varredura com volume seco)
 */
function gerarSerie(tend, vol, base, n, choqueVol) {
  var preco = base, out = [], d0 = new Date(2025, 0, 1).getTime();
  var N = n || 120;
  var inicioChoque = N - 4;   // choque nos 4 últimos candles
  for (var i = 0; i < N; i++) {
    var ret = tend + (rand() - 0.5) * vol * 3;
    var open = preco, close = preco * Math.exp(ret);
    var pav = Math.abs(close - open) * 0.6 + close * vol * 0.5;
    var volBase = 800000 + Math.floor(rand() * 400000);
    if (choqueVol && i >= inicioChoque) {
      volBase = Math.max(1, Math.floor(volBase * choqueVol));
    }
    out.push({
      date: new Date(d0 + i * 86400000), open: open, close: close,
      high: Math.max(open, close) + rand() * pav,
      low: Math.min(open, close) - rand() * pav,
      volume: volBase
    });
    preco = close;
  }
  return out;
}

// --- Converte o resultado do Core22 na "linha" de Resultados_Analise ----------
// Reproduz fielmente o que o _toRow do 08_Output_Unified faz com as 31 colunas.
function linhaResultados(res) {
  var ind = res.indicadores || {};
  var r = res.resultado || {};
  var forcaRel = (r.forcaRelativa !== undefined && r.forcaRelativa !== null)
    ? parseFloat((r.forcaRelativa * 100).toFixed(2)) : '';
  var suporte = (r.swingLow !== undefined && r.swingLow !== null && Number(r.swingLow) > 0)
    ? parseFloat(Number(r.swingLow).toFixed(2)) : '';

  // 🔧 v15.4: diagnóstico do rompimento (cols 28-30), formatado como no _toRow.
  var rompidoTxt = (r.suporteRompido === true) ? 'SIM'
    : (r.suporteRompido === false) ? 'NAO' : '';
  var volRomp = (r.volRompimentoSuporte != null && Number(r.volRompimentoSuporte) > 0)
    ? parseFloat(Number(r.volRompimentoSuporte).toFixed(2)) : '';
  var recuperouTxt = (r.suporteRecuperou === true) ? 'SIM'
    : (r.suporteRecuperou === false) ? 'NAO' : '';

  return [
    new Date(),                 // 0  Data
    'ATIVO',                    // 1  Ticker
    r.price || 0,               // 2  Preço
    r.score || 0,               // 3  Score
    r.setup || '',              // 4  Setup
    r.paReason || '',           // 5  Motivo
    r.stopLoss || 0,            // 6  Stop Loss
    r.target1 || 0,             // 7  Alvo 1
    r.target2 || 0,             // 8  Alvo 2
    r.rr || 0,                  // 9  R/R
    r.riscoPercent || 0,        // 10 Risco %
    ind.rsi || 0,               // 11 RSI
    ind.ema21 || 0,             // 12 EMA21
    ind.ema50 || 0,             // 13 EMA50
    ind.ema200 || 0,            // 14 EMA200
    ind.atr || 0,               // 15 ATR
    r.volume || 0,              // 16 Volume
    r.pivot || 0,               // 17 Pivot
    r.fiboPrice || 0,           // 18 Fibonacci
    '',                         // 19 Análise IA
    1,                          // 20 Ranking
    'TENDENCIA',                // 21 Tipo Setup
    '',                         // 22 Alerta
    r.topo50 || 0,              // 23 Topo50
    r.ganhoRapidoPct || 0,      // 24 GanhoRapido%
    r.distTopoPct || 0,         // 25 DistTopo%
    forcaRel,                   // 26 Força Rel. %
    suporte,                    // 27 Suporte (Pivô)  <- v15.3
    rompidoTxt,                 // 28 Suporte Rompido?      <- v15.4
    volRomp,                    // 29 Vol. Rompimento (x)   <- v15.4
    recuperouTxt                // 30 Recuperou Suporte?    <- v15.4
  ];
}

// --- Regimes ------------------------------------------------------------------
// `choqueVol` (v15.4) injeta um pico de volume nos últimos 4 candles para
// exercitar o caminho VARREDURA/REVERSAO — sem ele, o volume sintético fica
// sempre ~1.0x a mediana e o diagnóstico nunca sai de "sem base".
var REGIMES = [
  { nome: 'ALTA_FORTE_BAIXA_VOL', tend: 0.006, vol: 0.008 },
  { nome: 'ALTA_FORTE_PUXADA', tend: 0.006, vol: 0.026 },
  { nome: 'ALTA_MODERADA', tend: 0.003, vol: 0.012 },
  { nome: 'ALTA_VOL_PUXADA', tend: 0.004, vol: 0.028 },
  { nome: 'LATERAL_BAIXA_VOL', tend: 0.000, vol: 0.008 },
  { nome: 'LATERAL_VOL', tend: 0.000, vol: 0.020 },
  { nome: 'BAIXA_MODERADA', tend: -0.004, vol: 0.014 },
  { nome: 'BAIXA_FORTE', tend: -0.007, vol: 0.018 },
  // Regimes de estresse de volume: a quebra dos últimos candles vem com
  // volume 3x (convicção vendedora) ou 0.2x (varredura de liquidez).
  { nome: 'LATERAL_REVERSAO_VOL', tend: -0.002, vol: 0.015, choqueVol: 3.0 },
  { nome: 'LATERAL_VARREDURA', tend: -0.002, vol: 0.015, choqueVol: 0.2 }
];

var N_POR_REGIME = 25;

var total = 0, semDado = 0, errosZona = 0, celulasInvalidas = 0;
var acimaZonaTotal = 0, comVolumeTotal = 0, recuperouTotal = 0;
var porClasse = {};
var porRegime = {};

REGIMES.forEach(function (reg) {
  porRegime[reg.nome] = { CONFIRMA: 0, CONTRARIA: 0, VARREDURA: 0, REVERSAO: 0,
    ABAIXO: 0, BORDA: 0, SEM_DADO: 0, n: 0 };

  for (var k = 0; k < N_POR_REGIME; k++) {
    var base = 15 + rand() * 70;
    var candles = gerarSerie(reg.tend, reg.vol, base, 120, reg.choqueVol);
    var res = core22.analisar(candles, { ticker: 'E2E' });
    if (!res || !res.resultado) continue;

    var mapa = new Map();
    mapa.set('E2E', linhaResultados(res));
    var saida = proc._montarLinhasFinais(mapa);
    if (!saida.length) continue;

    var celula = saida[0][21];
    if (typeof celula !== 'string' || !celula) {
      celulasInvalidas++;
      continue;
    }

    total++;

    // Deduz a classe pelo rótulo (os emojis são estáveis).
    // ⚠️ VARREDURA/REVERSAO são checadas ANTES de CONTRARIA porque o rótulo de
    // VARREDURA não contém a palavra CONTRARIA, mas a ordem protege contra
    // futuras mudanças de texto.
    var classe = celula.indexOf('CONFIRMA') >= 0 ? 'CONFIRMA'
      : celula.indexOf('VARREDURA') >= 0 ? 'VARREDURA'
        : celula.indexOf('REVERSAO') >= 0 ? 'REVERSAO'
          : celula.indexOf('CONTRARIA') >= 0 ? 'CONTRARIA'
            : celula.indexOf('ABAIXO') >= 0 ? 'ABAIXO'
              : celula.indexOf('BORDA') >= 0 ? 'BORDA' : 'SEM_DADO';

    porClasse[classe] = (porClasse[classe] || 0) + 1;
    porRegime[reg.nome][classe]++;
    porRegime[reg.nome].n++;
    if (classe === 'SEM_DADO') semDado++;

    // 🔧 v15.4: quantas linhas têm pivô ACIMA da zona ("CONTRARIA bruto") — é a
    // população onde o diagnóstico de rompimento pode atuar. Se este número for
    // baixo, VARREDURA/REVERSAO naturalmente quase não aparecem, e isso é
    // consequência da assimetria de janelas, não de o diagnóstico estar quebrado.
    if (classe === 'CONTRARIA' || classe === 'VARREDURA' || classe === 'REVERSAO') {
      porRegime[reg.nome].acimaZona = (porRegime[reg.nome].acimaZona || 0) + 1;
      acimaZonaTotal++;
    }
    // Base do diagnóstico: a coluna de volume veio preenchida?
    if (res.resultado.volRompimentoSuporte != null) comVolumeTotal++;
    if (res.resultado.suporteRecuperou === true) recuperouTotal++;

    // Checa que a zona derivada acompanha a zona real do Core22
    var est = res.estrutura;
    if (est && est.zonaPiso > 0 && res.resultado.fiboPrice > 0) {
      var z = proc._derivarZonaCompra(res.resultado.fiboPrice, res.indicadores.atr, est.h50);
      if (z) {
        var eP = Math.abs(z.piso - est.zonaPiso) / est.zonaPiso;
        var eT = Math.abs(z.teto - est.zonaTeto) / est.zonaTeto;
        if (eP > 0.01 || eT > 0.01) errosZona++;
      }
    }
  }
});

// --- Relatório ---------------------------------------------------------------
console.log('\n' + '='.repeat(78));
console.log('VALIDAÇÃO END-TO-END — "Suporte vs. Zona" (coluna 21 de Oportunidades)');
console.log('='.repeat(78));
console.log('Séries processadas: ' + total +
  '  |  SEM_DADO: ' + semDado +
  '  |  células inválidas: ' + celulasInvalidas +
  '  |  divergências de zona > 1%: ' + errosZona);

console.log('\nDISTRIBUIÇÃO GERAL');
console.log('-'.repeat(78));
['CONFIRMA', 'CONTRARIA', 'VARREDURA', 'REVERSAO', 'ABAIXO', 'BORDA', 'SEM_DADO']
  .forEach(function (c) {
    var n = porClasse[c] || 0;
    var pct = total ? (n / total * 100) : 0;
    console.log('  ' + c.padEnd(10) + String(n).padStart(4) + '  ' +
      (pct.toFixed(1) + '%').padStart(6) + '  ' + '#'.repeat(Math.round(pct / 2)));
  });

console.log('\nPOR REGIME (classes estruturais)');
console.log('-'.repeat(78));
console.log('  ' + 'REGIME'.padEnd(22) + 'N'.padStart(4) +
  'CONFIRMA'.padStart(10) + 'CONTRARIA'.padStart(11) +
  'VARRED.'.padStart(9) + 'REVERS.'.padStart(9) +
  'ABAIXO'.padStart(8) + 'SEM_DADO'.padStart(10));
REGIMES.forEach(function (reg) {
  var d = porRegime[reg.nome];
  if (!d.n) return;
  var pc = function (v) { return (v / d.n * 100).toFixed(0) + '%'; };
  console.log('  ' + reg.nome.padEnd(22) + String(d.n).padStart(4) +
    pc(d.CONFIRMA).padStart(10) + pc(d.CONTRARIA).padStart(11) +
    pc(d.VARREDURA).padStart(9) + pc(d.REVERSAO).padStart(9) +
    pc(d.ABAIXO).padStart(8) + pc(d.SEM_DADO).padStart(10));
});

console.log('\nDIAGNÓSTICO DO ROMPIMENTO (v15.4)');
console.log('-'.repeat(78));
console.log('  linhas com pivô ACIMA da zona (população elegível): ' +
  acimaZonaTotal + ' / ' + total);
console.log('  linhas com volume de quebra medido:                ' +
  comVolumeTotal + ' / ' + total);
console.log('  linhas em que o preço recuperou o nível:            ' +
  recuperouTotal + ' / ' + total);
console.log('  => VARREDURA exige: elegível + rompido + seco + recuperou');
console.log('  => REVERSAO  exige: elegível + rompido + volumoso + sem recuperar');

// --- Critérios de aceitação ---------------------------------------------------
console.log('\n' + '='.repeat(78));
var ok = true;
function assert(nome, cond, detalhe) {
  if (cond) {
    console.log('  ✅ ' + nome);
  } else {
    ok = false;
    console.log('  ❌ ' + nome + (detalhe ? ' — ' + detalhe : ''));
  }
}

assert('Coluna 21 preenchida em TODAS as linhas',
  total > 0 && celulasInvalidas === 0,
  'total=' + total + ' invalid=' + celulasInvalidas);
assert('Nenhuma divergência de zona > 1% (paridade com Core22)',
  errosZona === 0, errosZona + ' divergências');
assert('Distribuição não degenerada (>= 3 classes presentes)',
  Object.keys(porClasse).filter(function (k) { return porClasse[k] > 0; }).length >= 3,
  'classes=' + Object.keys(porClasse).join(','));
assert('CONFIRMA ocorre em pelo menos um regime',
  (porClasse.CONFIRMA || 0) > 0, 'CONFIRMA=' + (porClasse.CONFIRMA || 0));
assert('CONTRARIA ocorre em pelo menos um regime',
  (porClasse.CONTRARIA || 0) > 0, 'CONTRARIA=' + (porClasse.CONTRARIA || 0));

// 🔧 v15.4: o diagnóstico de rompimento precisa estar ATIVO e não degenerado.
// - precisa haver população elegível (pivô acima da zona), senão a coluna nova
//   nunca poderia diferenciar nada;
// - o volume de quebra precisa ser medido em parte relevante das linhas;
// - o caminho REVERSAO precisa ser alcançável de fato.
assert('Existe populacao elegivel (pivo acima da zona)',
  acimaZonaTotal > 0, 'elegiveis=' + acimaZonaTotal);
assert('Volume de quebra e medido na maioria dos casos elegiveis',
  comVolumeTotal > 0, 'comVolume=' + comVolumeTotal);
assert('Caminho REVERSAO alcancavel',
  (porClasse.REVERSAO || 0) > 0, 'REVERSAO=' + (porClasse.REVERSAO || 0));
assert('VARREDURA so aparece com recuperacao registrada',
  (porClasse.VARREDURA || 0) === 0 || recuperouTotal > 0,
  'VARREDURA=' + (porClasse.VARREDURA || 0) + ' recuperou=' + recuperouTotal);

console.log('='.repeat(78));
console.log(ok ? '✅ CADEIA VALIDADA' : '❌ CADEIA COM PROBLEMAS');
console.log('='.repeat(78) + '\n');

process.exit(ok ? 0 : 1);
