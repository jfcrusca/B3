/**
 * Harness offline para validar o diagnóstico de VOLUME (Opção 1).
 * Investiga se volRel baixo é REAL ou ARTEFATO (candle parcial/intraday).
 *
 * Reproduz o caso PETR4 (volRel=0.59) em duas hipóteses:
 *   A) Volume REAL baixo (dia calmo) — todos os candles têm volume completo
 *   B) ARTEFATO — último candle é intraday/parcial (volume incompleto)
 */

// --- Cópia fiel de _core_getMedian e _core_getVolumeRelativo COM A GUARDA (Abordagem 2) ---
function _core_getMedian(arr) {
  var a = [];
  for (var i = 0; i < arr.length; i++) {
    var n = Number(arr[i]);
    if (isFinite(n)) a.push(n);
  }
  if (a.length === 0) return 0;
  a.sort(function (x, y) { return x - y; });
  var mid = Math.floor(a.length / 2);
  if (a.length % 2 === 0) return (a[mid - 1] + a[mid]) / 2;
  return a[mid];
}

var logsCapturados = [];
var consoleReal = console.log;
var consoleWarnReal = console.warn;
console.log = function (msg) { logsCapturados.push(String(msg)); };
console.warn = function (msg) { logsCapturados.push(String(msg)); };

var ticker = 'PETR4';

function _core_getVolumeRelativo(candles, period) {
  period = period || 20;
  if (!candles || candles.length < period + 1) return 1.0;

  var start = Math.max(0, candles.length - period - 1);
  var vols = [];
  for (var i = start; i < candles.length - 1; i++) {
    var v = Number(candles[i].volume || 0);
    if (v > 0) vols.push(v);
  }
  if (!vols.length) return 1.0;

  var lastVol = Number(candles[candles.length - 1].volume || 0);
  var median = _core_getMedian(vols);
  var somaVols = 0, maxVols = 0, minVols = Infinity;
  for (var iv = 0; iv < vols.length; iv++) {
    somaVols += vols[iv];
    if (vols[iv] > maxVols) maxVols = vols[iv];
    if (vols[iv] < minVols) minVols = vols[iv];
  }
  var mediaVols = somaVols / vols.length;
  if (minVols === Infinity) minVols = 0;
  if (median === 0) return 1.0;

  var BASE_SUSPEITA = median > (minVols * 1.5);
  var baseUsada = median;
  if (BASE_SUSPEITA) {
    var volsOrdenados = vols.slice().sort(function (a, b) { return a - b; });
    var k = Math.max(1, Math.round(volsOrdenados.length * 0.3));
    var somaMenores = 0;
    for (var im = 0; im < k; im++) somaMenores += volsOrdenados[im];
    baseUsada = somaMenores / k;
  }
  if (!(baseUsada > 0)) return 1.0;

  var volRel = parseFloat((lastVol / baseUsada).toFixed(3));

  try {
    var _ult = candles[candles.length - 1];
    console.log('🔍VOL_DIAG|' + ticker +
      '|volHoje=' + lastVol +
      '|base=' + Math.round(baseUsada) +
      '|baseSuspeita=' + (BASE_SUSPEITA ? 'SIM(mediana corrigida)' : 'nao') +
      '|mediana20=' + median +
      '|media20=' + Math.round(mediaVols) +
      '|max20=' + maxVols +
      '|min20=' + minVols +
      '|volRel=' + volRel);
  } catch (e) {}

  return volRel;
}

// --- Constrói série de candles ---
function serieVolumes(volsDias, volUltimo, dataUltimo) {
  var candles = [];
  var base = new Date(2024, 0, 1);
  volsDias.forEach(function (v, idx) {
    candles.push({
      date: new Date(base.getTime() + idx * 86400000),
      open: 40, high: 41, low: 39, close: 40, volume: v
    });
  });
  candles.push({
    date: dataUltimo || new Date(base.getTime() + volsDias.length * 86400000),
    open: 49, high: 49.5, low: 48.5, close: 49, volume: volUltimo
  });
  return candles;
}

var falhas = [];

// 20 dias com volume típico de ~27M (PETR4 real)
var volsTipicos = [];
for (var i = 0; i < 20; i++) volsTipicos.push(27000000 + (i * 100000));

// CENÁRIO A — Volume REAL baixo (série LIMPA): último dia com 16M, sem picos
(function () {
  logsCapturados = [];
  var c = serieVolumes(volsTipicos, 16000000, new Date(2024, 1, 1));
  var vr = _core_getVolumeRelativo(c, 20);
  var log = logsCapturados.find(function (l) { return l.indexOf('VOL_DIAG') !== -1; });
  // Série limpa (min~27M, mediana~28M): guarda NÃO deve ativar, volRel ~0.57
  var ok = Math.abs(vr - 0.572) < 0.02 && log && log.indexOf('baseSuspeita=nao') !== -1;
  consoleReal('Cenário A (volume REAL baixo, série limpa): volRel=' + vr + (ok ? ' ✅ (guarda inativa)' : ' ❌'));
  consoleReal('   ' + log);
  if (!ok) falhas.push('Cenário A: série limpa não deve ativar a guarda');
})();

// CENÁRIO B — ARTEFATO PETR4 (produção): volumes duplicados inflam a mediana
// Dados reais: volHoje=27,6M | mediana20=46,9M | max20=85,9M | min20=29,1M
(function () {
  logsCapturados = [];
  // Reproduz: min20=29,1M; metade normal (~27-32M), metade inflada (~66-86M)
  var vols = [];
  for (var i = 0; i < 10; i++) vols.push(29125700 + i * 500000);          // ~29-34M
  for (var j = 0; j < 10; j++) vols.push(70000000 + j * 1700000);          // ~70-86M
  var c = serieVolumes(vols, 27610000, new Date());
  var vr = _core_getVolumeRelativo(c, 20);
  var log = logsCapturados.find(function (l) { return l.indexOf('VOL_DIAG') !== -1; });
  // A guarda DEVE ativar (mediana ~46M > min 29,1M * 1.5 = 43,7M) e corrigir volRel
  var ok = log && log.indexOf('baseSuspeita=SIM') !== -1 && vr > 0.85;
  consoleReal('Cenário B (PETR4 real: volumes duplicados): volRel=' + vr + (ok ? ' ✅ (guarda corrigiu → ~0.9+)' : ' ❌'));
  consoleReal('   ' + log);
  if (!ok) falhas.push('Cenário B: guarda deveria ativar e corrigir o volRel do PETR4');
})();

// CENÁRIO C — ARTEFATO VALE3 (produção): max20=33M, min20=10M, mediana=18,9M
// volHoje=12,2M. Mediana 18,9M > min 10,0M * 1.5 = 15,0M → guarda deve ativar
(function () {
  logsCapturados = [];
  var vols = [];
  for (var i = 0; i < 8; i++) vols.push(10007400 + i * 400000);            // ~10-13M
  for (var j = 0; j < 12; j++) vols.push(22000000 + j * 900000);           // ~22-32M
  var c = serieVolumes(vols, 12231700, new Date());
  var vr = _core_getVolumeRelativo(c, 20);
  var log = logsCapturados.find(function (l) { return l.indexOf('VOL_DIAG') !== -1; });
  var ok = log && log.indexOf('baseSuspeita=SIM') !== -1 && vr > 0.85;
  consoleReal('Cenário C (VALE3 real: volumes duplicados): volRel=' + vr + (ok ? ' ✅ (guarda corrigiu)' : ' ❌'));
  consoleReal('   ' + log);
  if (!ok) falhas.push('Cenário C: guarda deveria ativar e corrigir o volRel do VALE3');
})();

// CENÁRIO D — Série SAUDÁVEL com variação natural: guarda NÃO deve ativar
(function () {
  logsCapturados = [];
  var volsSaudaveis = [];
  for (var i = 0; i < 20; i++) volsSaudaveis.push(27000000 + (i % 4) * 1500000); // 27-31,5M
  var c = serieVolumes(volsSaudaveis, 27500000, new Date(2024, 1, 1));
  var vr = _core_getVolumeRelativo(c, 20);
  var log = logsCapturados.find(function (l) { return l.indexOf('VOL_DIAG') !== -1; });
  var ok = log && log.indexOf('baseSuspeita=nao') !== -1 && Math.abs(vr - 1.0) < 0.15;
  consoleReal('Cenário D (série saudável): volRel=' + vr + (ok ? ' ✅ (guarda inativa)' : ' ❌'));
  consoleReal('   ' + log);
  if (!ok) falhas.push('Cenário D: série saudável não deve ativar a guarda');
})();

// CENÁRIO E — Série com 1 outlier isolado (mercado real): guarda deve tolerar
(function () {
  logsCapturados = [];
  var volsReal = [];
  for (var i = 0; i < 19; i++) volsReal.push(27000000 + (i % 3) * 800000); // 27-28,6M
  volsReal.push(45000000); // 1 dia de alta (resultado/notícia) — legítimo
  var c = serieVolumes(volsReal, 28000000, new Date(2024, 1, 1));
  var vr = _core_getVolumeRelativo(c, 20);
  var log = logsCapturados.find(function (l) { return l.indexOf('VOL_DIAG') !== -1; });
  // mediana ~27,8M; min ~27M; 27,8M NAO > 27M*1.5=40,5M → guarda inativa (correto)
  var ok = log && log.indexOf('baseSuspeita=nao') !== -1;
  consoleReal('Cenário E (1 outlier isolado): volRel=' + vr + (ok ? ' ✅ (guarda tolera outlier único)' : ' ❌'));
  consoleReal('   ' + log);
  if (!ok) falhas.push('Cenário E: um único outlier não deve ativar a guarda');
})();

consoleReal('\n=== RESULTADO ===');
if (falhas.length === 0) {
  consoleReal('✅ TODAS AS VERIFICAÇÕES PASSARAM');
} else {
  consoleReal('❌ FALHAS:');
  falhas.forEach(function (f) { consoleReal('  - ' + f); });
  process.exit(1);
}
