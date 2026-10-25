/**
 * Harness offline para validar as GUARDAS NÍVEL 1 de _ajustarCandlesPorEventoCorporativo.
 * Reproduz os casos reais do log do robô + um evento corporativo legítimo.
 */

// --- Cópia fiel das funções auxiliares (05_Data_Service.js) ---
function _getLastPrice(candles) {
  if (!Array.isArray(candles)) return null;
  for (var i = candles.length - 1; i >= 0; i--) {
    var c = candles[i];
    if (c && typeof c.close === 'number' && c.close > 0) return c.close;
  }
  return null;
}

// --- Cópia da função ALVO (com as guardas Nível 1) ---
function _ajustarCandlesPorEventoCorporativo(candles, precoVivo) {
  if (!candles || !Array.isArray(candles) || candles.length === 0) return candles;
  var ultimoClose = _getLastPrice(candles);
  if (!(ultimoClose > 0) || !(precoVivo > 0)) return candles;
  var diffPct = Math.abs(precoVivo - ultimoClose) / ultimoClose;
  if (diffPct <= 0.15) return candles;

  var fator = precoVivo / ultimoClose;

  for (var i = 1; i < candles.length; i++) {
    var dPrev = candles[i - 1] && candles[i - 1].date ? new Date(candles[i - 1].date) : null;
    var dCur = candles[i] && candles[i].date ? new Date(candles[i].date) : null;
    if (!dPrev || !dCur || isNaN(dPrev.getTime()) || isNaN(dCur.getTime())) continue;
    if (dCur <= dPrev) {
      return { __abortado: 'SERIE_DESORDENADA', candles: candles };
    }
  }

  if (fator > 3 || fator < 0.33) {
    return { __abortado: 'FATOR_IMPLAUSIVEL', fator: fator, candles: candles };
  }

  var ajustados = candles.map(function (c) {
    if (!c) return c;
    var novo = {};
    for (var k in c) { if (c.hasOwnProperty(k)) novo[k] = c[k]; }
    if (typeof novo.open === 'number') novo.open = novo.open * fator;
    if (typeof novo.high === 'number') novo.high = novo.high * fator;
    if (typeof novo.low === 'number') novo.low = novo.low * fator;
    if (typeof novo.close === 'number') novo.close = novo.close * fator;
    return novo;
  });
  return { __abortado: null, fator: fator, candles: ajustados };
}

// --- Helpers de construção ---
function serie(precos, inicio) {
  var out = [];
  for (var i = 0; i < precos.length; i++) {
    out.push({
      date: new Date(inicio.getTime() + i * 86400000),
      open: precos[i] * 0.99, high: precos[i] * 1.02,
      low: precos[i] * 0.98, close: precos[i], volume: 1000000
    });
  }
  return out;
}

var falhas = [];
console.log('=== VALIDAÇÃO DAS GUARDAS NÍVEL 1 ===\n');

// CASO 1 — HAPV3 do log: últimoClose≈6.49, fator relatado 0.1728 → vivo≈1.12
(function () {
  var c = serie([10, 9, 8, 7, 6.49], new Date(2024, 0, 1));
  var r = _ajustarCandlesPorEventoCorporativo(c, 1.12);
  var ok = r.__abortado === 'FATOR_IMPLAUSIVEL' && r.candles[0].close === 10;
  console.log('HAPV3 (fator ~0.17, implausível) → ' + (ok ? '✅ ABORTADO (histórico intacto)' : '❌ FALHOU'));
  if (!ok) falhas.push('HAPV3 não abortou');
})();

// CASO 2 — SBSP3 do log: fator relatado 0.2310
(function () {
  var c = serie([100, 95, 90, 85, 80], new Date(2024, 0, 1));
  var r = _ajustarCandlesPorEventoCorporativo(c, 80 * 0.231032);
  var ok = r.__abortado === 'FATOR_IMPLAUSIVEL';
  console.log('SBSP3 (fator ~0.23, implausível) → ' + (ok ? '✅ ABORTADO' : '❌ FALHOU'));
  if (!ok) falhas.push('SBSP3 não abortou');
})();

// CASO 3 — PETR4 do log: fator relatado 1.6102 (dentro de 0.33-3 → NÃO aborta por fator)
(function () {
  var c = serie([40, 39, 38, 37, 36], new Date(2024, 0, 1));
  var r = _ajustarCandlesPorEventoCorporativo(c, 36 * 1.610253);
  var ok = r.__abortado === null; // 1.61 é plausível → passa (por design)
  console.log('PETR4 (fator 1.61, plausível) → ' + (ok ? '⚠️ PASSA (dentro do limite, guarda 1b não cobre)' : '❌ FALHOU'));
  // Este caso só será resolvido no Nível 2 (detecção de série desatualizada)
})();

// CASO 4 — Série desordenada (bug AMZO34): datas fora de ordem
(function () {
  var c = serie([10, 11, 12, 13, 14], new Date(2024, 0, 1));
  // Inverte a última data para trás
  c[4].date = new Date(2023, 11, 1);
  var r = _ajustarCandlesPorEventoCorporativo(c, 40); // fator 2.86 (plausível isolado)
  var ok = r.__abortado === 'SERIE_DESORDENADA';
  console.log('AMZO34 (datas invertidas) → ' + (ok ? '✅ ABORTADO' : '❌ FALHOU'));
  if (!ok) falhas.push('AMZO34 não abortou');
})();

// CASO 5 — Evento corporativo LEGÍTIMO: grupamento ~2x (fator 2.0)
(function () {
  var c = serie([10, 10.5, 11, 11.5, 12], new Date(2024, 0, 1));
  var r = _ajustarCandlesPorEventoCorporativo(c, 24); // fator ~2.0
  var ok = r.__abortado === null && Math.abs(r.candles[0].close - 20) < 0.001;
  console.log('Grupamento 2:1 legítimo → ' + (ok ? '✅ APLICADO (histórico reescalonado)' : '❌ FALHOU'));
  if (!ok) falhas.push('Grupamento legítimo foi abortado indevidamente');
})();

// CASO 6 — Divergência pequena (<15%): não deve nem entrar nas guardas
(function () {
  var c = serie([10, 10.5, 11, 11.5, 12], new Date(2024, 0, 1));
  var r = _ajustarCandlesPorEventoCorporativo(c, 13); // +8.3%
  var ok = r === c; // retorna a MESMA referência (não reescalona)
  console.log('Divergência +8% (<15%) → ' + (ok ? '✅ IGNORADO (sem ajuste)' : '❌ FALHOU'));
  if (!ok) falhas.push('Divergência pequena não foi ignorada');
})();

console.log('\n=== RESULTADO ===');
if (falhas.length === 0) {
  console.log('✅ TODAS AS VERIFICAÇÕES PASSARAM');
} else {
  console.log('❌ FALHAS:');
  falhas.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
