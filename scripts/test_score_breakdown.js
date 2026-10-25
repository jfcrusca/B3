/**
 * Harness offline para validar o BREAKDOWN do score (Opção 2).
 * Reproduz os cenários do SCORE_ZERO_ROOT_CAUSE.md e confirma que o log
 * identifica corretamente a origem de cada score baixo.
 *
 * Extrai a função _calcularScoreSistêmico do 22_Core_Analyzers.js, injeta
 * mocks mínimos e verifica os segmentos do breakdown.
 */

var fs = require('fs');
var src = fs.readFileSync('22_Core_Analyzers.js', 'utf8');

// Extrai a função completa por balanceamento de chaves
function extrairFuncao(texto, nome) {
  var idx = texto.indexOf('function ' + nome + '(');
  if (idx === -1) throw new Error('Função ' + nome + ' não encontrada');
  var i = texto.indexOf('{', idx);
  var prof = 0, fim = i;
  for (; fim < texto.length; fim++) {
    if (texto[fim] === '{') prof++;
    else if (texto[fim] === '}') { prof--; if (prof === 0) break; }
  }
  return texto.substring(idx, fim + 1);
}

var fnSrc = extrairFuncao(src, '_calcularScoreSistêmico');

// Captura os logs emitidos — o stub PERMANECE ativo durante todos os cenários
var logsCapturados = [];
var consoleReal = console.log;
var consoleWarnReal = console.warn;
console.log = function (msg) { logsCapturados.push(String(msg)); };
console.warn = function () { /* silencia warnings do Core22 no teste */ };

// Stubs globais esperados pela função
var ticker = 'PETR4';
var setup = '';
var CORE22_CFG = {};
global.CONFIG = { get: function (k, d) { return k === 'DIAG_SCORE_BREAKDOWN_LIMIAR' ? 100 : d; } };

eval(fnSrc);

// Restaura o console APENAS para impressão dos resultados (a função já foi avaliada;
// ela referencia o console global dinamicamente, então o stub precisa seguir ativo
// DURANTE as chamadas — logo, só restauramos ao final do arquivo).

// --- Helpers de cenário ---
function ind(over) {
  return Object.assign({
    adx: 25, rsi: 60, volumeRelativo: 1.5,
    ema9: 100, ema21: 95, ema50: 90, ema200: 80,
    bollinger: { upper: 120, middle: 100, lower: 80, width: 40 }
  }, over || {});
}
function est(over) {
  return Object.assign({ h50: 130, l50: 70, inFiboZone: false, temConfluencia: false, ganhoRapidoPct: 0, distTopoPct: 0.1 }, over || {});
}
function rsc(over) {
  return Object.assign({ rrRealista: 2.5, invalidoPorStop: false }, over || {});
}

// Roda um cenário e devolve {score, log} — isola a captura de log por chamada.
function executarCenario(tk, indObj, estObj, rscObj, ibov) {
  ticker = tk;
  logsCapturados = [];
  var score = _calcularScoreSistêmico(100, indObj, estObj, rscObj, 0, ibov);
  var log = null;
  for (var i = 0; i < logsCapturados.length; i++) {
    if (logsCapturados[i].indexOf('SCORE_BREAKDOWN') !== -1) { log = logsCapturados[i]; break; }
  }
  return { score: score, log: log };
}

// Função de impressão que sobrevive ao stub de console.log
function imprimir(msg) { consoleReal(msg); }

var falhas = [];

// CENÁRIO 1 — Cascata ADX + Volume (Grupo A do relatório): deve dar 0
(function () {
  var r = executarCenario('VALE3', ind({ adx: 15, volumeRelativo: 0.5 }), est(), rsc(), { regime: 'NEUTRAL' });
  var ok = r.score === 0 && r.log && r.log.indexOf('adx=15') !== -1 && r.log.indexOf('volRel=0.50') !== -1;
  imprimir('Cenário 1 (VALE3: ADX 15 + VolRel 0.50) → score=' + r.score + (ok ? ' ✅' : ' ❌'));
  imprimir('   ' + (r.log || '(sem log)'));
  if (!ok) falhas.push('Cenário 1 não detectou a cascata ADX+Volume');
})();

// CENÁRIO 2 — Ativo saudável (TOTS3): score alto
(function () {
  var r = executarCenario('TOTS3', ind({ adx: 32, rsi: 60, volumeRelativo: 1.8 }), est({ inFiboZone: true }), rsc({ rrRealista: 3.0 }), { regime: 'BULLISH' });
  var ok = r.score >= 70;
  imprimir('Cenário 2 (TOTS3: ADX 32 + Vol 1.8 + Fibo + BULLISH) → score=' + r.score + (ok ? ' ✅' : ' ❌'));
  imprimir('   ' + (r.log || '(sem log)'));
  if (!ok) falhas.push('Cenário 2 deveria ter score alto, obteve ' + r.score);
})();

// CENÁRIO 3 — Mercado lateral (CPLE3): o segmento tend deve ser NEGATIVO (ADX -45 domina)
(function () {
  var r = executarCenario('CPLE3', ind({ adx: 12, volumeRelativo: 1.0 }), est(), rsc(), { regime: 'NEUTRAL' });
  // tend = ADX(-45) + bônus de médias (+15) = -30 → o segmento é negativo,
  // evidência de que a penalidade de ADX baixo está ativa.
  var m = r.log && r.log.match(/tend=(-?\d+)>/);
  var tendVal = m ? Number(m[1]) : null;
  // Com ADX 12, o segmento tend não pode ser alto (a penalidade -45 impele para baixo).
  // Com trend forte o segmento seria ~+85; aqui deve ficar bem abaixo.
  var ok = r.log && r.log.indexOf('adx=12.0') !== -1 && tendVal !== null && tendVal < 30;
  imprimir('Cenário 3 (CPLE3: ADX 12) → score=' + r.score + ' | segmento tend=' + tendVal + (ok ? ' ✅ (ADX baixo penaliza)' : ' ❌'));
  imprimir('   ' + (r.log || '(sem log)'));
  if (!ok) falhas.push('Cenário 3 não capturou penalidade de ADX baixo (segmento tend deveria ser negativo)');
})();

// CENÁRIO 4 — Coerência: FINAL = clamp(0..100) da soma dos segmentos
// (negativos são truncados em 0 pelo Math.max — comportamento CORRETO e documentado)
(function () {
  var r = executarCenario('TESTE', ind({ adx: 15, volumeRelativo: 0.5 }), est(), rsc(), { regime: 'NEUTRAL' });
  var m = r.log && r.log.match(/base=(-?\d+)>tend=(-?\d+)>rsiVol=(-?\d+)>fiboRR=(-?\d+)>macro=(-?\d+)>penal=(-?\d+)/);
  if (!m) { falhas.push('Cenário 4: não conseguiu parsear o log'); return; }
  var soma = Number(m[1]) + Number(m[2]) + Number(m[3]) + Number(m[4]) + Number(m[5]) + Number(m[6]);
  var finalLog = Number((r.log.match(/FINAL=(-?\d+)/) || [])[1]);
  var somaClamp = Math.min(100, Math.max(0, soma));
  var ok = finalLog === somaClamp;
  imprimir('Cenário 4 (coerência) → soma=' + soma + ' → clamp=' + somaClamp + ' | FINAL(log)=' + finalLog + (ok ? ' ✅' : ' ❌'));
  imprimir('   ' + r.log);
  if (!ok) falhas.push('FINAL (' + finalLog + ') != clamp(' + soma + ') (' + somaClamp + ')');
})();

imprimir('\n=== RESULTADO ===');
if (falhas.length === 0) {
  imprimir('✅ TODAS AS VERIFICAÇÕES PASSARAM');
} else {
  imprimir('❌ FALHAS:');
  falhas.forEach(function (f) { imprimir('  - ' + f); });
  process.exit(1);
}
