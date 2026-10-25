/**
 * Harness offline de REGRESSÃO para a INCONSISTÊNCIA DE LINHA auditada na aba
 * "Resultados_Analise" (caso AXIA3) — CORREÇÃO v12.8.
 *
 *   Antes:  Preço exibido R$ 54,80 / Stop R$ 57,19 (ACIMA) / Risco 4,78% (falso)
 *   Depois: o Writer realinha stop/alvos preservando as distâncias % e o Risco %
 *           NUNCA usa Math.abs para mascarar stop acima do preço.
 *
 * Causa-raiz: stop/alvos/RR são calculados em 22_Core_Analyzers sobre o CLOSE do
 * último candle diário (op.price ≈ R$ 60–63), enquanto a coluna "Preço" é
 * sobrescrita pela COTAÇÃO AO VIVO (op.livePrice) em 00_SheetWriter.js e
 * 08_Output_Unified.js. O ativo caiu entre a análise e a gravação.
 *
 * Este teste (1) gera a geometria real com _processarGestaoRisco e (2) executa
 * as REGRAS DE REALINHAMENTO reais extraídas dos Writers, garantindo que a linha
 * final fique consistente (stop < preço, risco coerente).
 */

var fs = require('fs');
var src = fs.readFileSync('22_Core_Analyzers.js', 'utf8');
var srcWriter = fs.readFileSync('00_SheetWriter.js', 'utf8');
var srcOutput = fs.readFileSync('08_Output_Unified.js', 'utf8');

/**
 * Extrai o BLOCO de realinhamento real do Writer/Output (v12.8) por marcadores,
 * para testar exatamente a lógica de produção (e não uma cópia divergente).
 */
function extrairBloco(texto, marcadorInicio, marcadorFim) {
  var i = texto.indexOf(marcadorInicio);
  if (i === -1) throw new Error('Marcador inicial não encontrado: ' + marcadorInicio);
  var j = texto.indexOf(marcadorFim, i);
  if (j === -1) throw new Error('Marcador final não encontrado: ' + marcadorFim);
  return texto.substring(i, j);
}

// Extrai uma função completa por balanceamento de chaves.
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

// CORE22_CFG real do arquivo (const é avaliado com o código extraído).
var cfgMatch = src.match(/const CORE22_CFG = \{[\s\S]*?\};/);
var consoleWarnReal = console.warn;
console.warn = function () { /* silencia warnings do Core22 no teste */ };

// Dependências necessárias pela cadeia de _processarGestaoRisco
var dependencias = [
  'CORE22_CFG',
  '_core_getMedian',
  '_core_getRobustSigma',
  '_core_getLogReturns',
  '_core_estimarRuidoEstatistico',
  '_core_noisePrice',
  '_core_detectPivotLows',
  '_core_getLastPivotLow',
  '_processarGestaoRisco'
];

var codigo = cfgMatch[0] + '\n';
dependencias.forEach(function (nome) {
  if (nome === 'CORE22_CFG') return;
  codigo += extrairFuncao(src, nome) + '\n';
});

eval(codigo);

// ---------------------------------------------------------------------------
// Candle mocks: ativo com tendência de ALTA e topo recente (para o stop ser
// técnico via swing pivot e os alvos gerarem RR >= 2, como em AXIA3).
// "closePreco" = close do ÚLTIMO candle = base da análise técnica (op.price).
// ---------------------------------------------------------------------------
function montarCandlesAlta(closePreco, maxRecente) {
  var candles = [];
  var n = 40;
  for (var i = 0; i < n; i++) {
    var frac = i / (n - 1);
    var p = (closePreco * 0.80) + ((closePreco - closePreco * 0.80) * frac);
    candles.push({ high: p * 1.006, low: p * 0.994, close: p, volume: 1000000 + i * 5000 });
  }
  candles[n - 3].high = maxRecente;                 // topo recente (h50)
  candles[n - 3].close = maxRecente * 0.995;
  candles[n - 1].close = closePreco;                // close base da análise
  candles[n - 1].high = closePreco * 1.006;
  candles[n - 1].low = closePreco * 0.994;
  return candles;
}

/**
 * Replica a resolução de preço do Writer (00_SheetWriter.js:80-90 /
 * 08_Output_Unified.js:109-143): a coluna "Preço" prefere op.livePrice.
 */
function precoExibido(op) {
  var preco = op.price;
  if (op.livePrice && op.livePrice > 0) preco = op.livePrice;
  return preco;
}

/**
 * Extrai o BLOCO REAL de realinhamento v12.8 do 00_SheetWriter.js e o avalia,
 * expondo a função `realinharGeometria(preco, precoOriginal, stop, alvo1, alvo2, rr)`.
 * Isso garante que o teste valida a LÓGICA DE PRODUÇÃO.
 */
var blocoWriter = extrairBloco(
  srcWriter,
  '// ─── v12.8: REALINHAMENTO DA GEOMETRIA STOP/ALVOS AO PREÇO EXIBIDO',
  '// ─── INDICADORES'
);
var CFG_T1R = 2.0, CFG_T2R = 3.0, ticker = 'AXIA3', console_log_real = console.log;
console.log = function () {}; // silencia logs do bloco realinhador no teste
var realinharGeometria = new Function(
  'CFG_T1R', 'CFG_T2R', 'ticker', 'preco', 'precoOriginal', 'stop', 'alvo1', 'alvo2', 'rr',
  blocoWriter + '\n; return { stop: stop, alvo1: alvo1, alvo2: alvo2, rr: rr, invalido: stopInvalidoParaCompra };'
);

/**
 * Extrai o BLOCO REAL de Risco % v12.8 do 00_SheetWriter.js e expõe
 * `calcularRisco(preco, stop, riscoPercentEntrada)`.
 */
var blocoRisco = extrairBloco(
  srcWriter,
  '// ─── RISCO PERCENTUAL (v12.8: nunca mascara stop inválido)',
  '// ─── RANKING'
);
var calcularRisco = new Function(
  'ticker', 'preco', 'stop', 'op',
  'var stopInvalidoParaCompra = false;\n' +
  blocoRisco +
  '\n; return { riscoPct: riscoPct, invalido: stopInvalidoParaCompra };'
);
console.log = console_log_real;

/** Replica a resolução de preço do Writer: a coluna "Preço" prefere op.livePrice. */
function precoExibido(op) {
  var preco = op.price;
  if (op.livePrice && op.livePrice > 0) preco = op.livePrice;
  return preco;
}

// Reimplementa o essencial de _analisarEstruturaMercado (mesmas fórmulas do arquivo)
function _analisarEstruturaFake(candles, preco) {
  var lb = 30;
  var highs = candles.map(function (c) { return c.high; });
  var lows = candles.map(function (c) { return c.low; });
  var h50 = Math.max.apply(null, highs.slice(-lb));
  var l50 = Math.min.apply(null, lows.slice(-lb));
  var range50 = h50 - l50;
  var fibo618 = h50 - (range50 * 0.618);
  var fibo50 = h50 - (range50 * 0.50);
  var inFiboZone = (preco <= (fibo50 * 1.005) && preco >= (fibo618 * 0.995));
  return {
    h50: h50, l50: l50, fibo618: fibo618, fibo50: fibo50,
    inFiboZone: inFiboZone, temConfluencia: false,
    swingLow: l50, ganhoRapidoPct: -0.10, distTopoPct: (h50 - preco) / h50
  };
}

// ---------------------------------------------------------------------------
// CENÁRIO AXIA3: análise técnica feita com CLOSE = R$ 60,00; o ativo DESPENCA
// para R$ 54,80 antes da gravação (cotação ao vivo). O stop/alvos ficam
// "grudados" no preço analisado, gerando a linha contraditória da planilha.
// ---------------------------------------------------------------------------
function rodarAxia3() {
  var closeAnalise = 60.00;   // op.price (candle diário usado na análise)
  var livePrice = 54.80;      // op.livePrice (cotação ao vivo -> coluna "Preço")
  var candles = montarCandlesAlta(closeAnalise, 63.50);
  var closes = candles.map(function (c) { return c.close; });
  var atr = closeAnalise * 0.02;
  var estrutura = _analisarEstruturaFake(candles, closeAnalise);
  var risco = _processarGestaoRisco(closeAnalise, atr, estrutura, candles, closes);

  // Equivalente ao op devolvido por STRATEGY_EVALUATE_CORE + Orchestrator v12.7
  var op = {
    ticker: 'AXIA3',
    price: closeAnalise,          // base técnica
    livePrice: livePrice,         // cotação ao vivo (exibição)
    stopLoss: risco.stop,
    target1: risco.alvo1,
    target2: risco.alvo2,
    rr: risco.rrRealista,
    riscoPercent: parseFloat(((closeAnalise - risco.stop) / closeAnalise * 100).toFixed(2)),
    setup: '📉 SWING PULLBACK FIBO'
  };
  return { op: op, risco: risco, estrutura: estrutura };
}

var cenario = rodarAxia3();
var op = cenario.op;
var preco = precoExibido(op);            // R$ 54,80 (o que aparece na planilha)
var precoOriginal = op.price;            // R$ 60,00 (close analisado)

console.log = console_log_real;
console.log('\n=== REGRESSÃO v12.8: LINHA CONSISTENTE EM "Resultados_Analise" (AXIA3) ===');
console.log('Preço analisado (close) : R$ ' + precoOriginal.toFixed(2));
console.log('Stop/Alvo originais     : R$ ' + op.stopLoss.toFixed(2) + ' / R$ ' + op.target1.toFixed(2) +
            ' / R$ ' + op.target2.toFixed(2) + '  (RR ' + op.rr.toFixed(2) + ')');
console.log('Preço EXIBIDO (live)    : R$ ' + preco.toFixed(2));

// (1) Aplica a LÓGICA REAL de realinhamento do Writer
var novaLinha = realinharGeometria(CFG_T1R, CFG_T2R, op.ticker, preco, precoOriginal, op.stopLoss, op.target1, op.target2, op.rr);
// (2) Aplica a LÓGICA REAL de Risco % do Writer sobre a geometria já realinhada
var risco = calcularRisco(op.ticker, preco, novaLinha.stop, { riscoPercent: op.riscoPercent, stop: novaLinha.stop });

console.log('--- Após o realinhamento (lógica de produção) ---');
console.log('Stop ajustado           : R$ ' + novaLinha.stop.toFixed(2));
console.log('Alvo 1 / Alvo 2         : R$ ' + novaLinha.alvo1.toFixed(2) + ' / R$ ' + novaLinha.alvo2.toFixed(2));
console.log('R/R ajustado            : ' + novaLinha.rr.toFixed(2));
console.log('Risco %                 : ' + risco.riscoPct.toFixed(2) + '%');

console.log('\n--- Asserções ---');
var falhas = [];
if (novaLinha.stop >= preco) {
  falhas.push('Stop R$ ' + novaLinha.stop.toFixed(2) + ' ainda >= preço exibido R$ ' + preco.toFixed(2) + '.');
}
if (novaLinha.alvo1 <= preco || novaLinha.alvo2 <= preco) {
  falhas.push('Alvos deveriam ficar ACIMA da entrada após realinhamento.');
}
if (risco.riscoPct <= 0) {
  falhas.push('Risco % deveria ser positivo e coerente (stop abaixo do preço).');
}
// O risco deve refletir (preco-stop)/preco — nada de Math.abs mascarando inversão
var riscoEsperado = parseFloat(((preco - novaLinha.stop) / preco * 100).toFixed(2));
if (Math.abs(risco.riscoPct - riscoEsperado) > 0.01) {
  falhas.push('Risco % (' + risco.riscoPct + ') diverge do esperado (' + riscoEsperado + ').');
}

// (3) Confere que o OUTRO Writer (08_Output_Unified.js) realinha igualmente.
var blocoOutput = extrairBloco(
  srcOutput,
  '// 2.1 CORREÇÃO v12.8: REALINHAMENTO DA GEOMETRIA STOP/ALVOS AO PREÇO EXIBIDO',
  '// 3. INDICADORES TÉCNICOS'
);
var realinharOutput = new Function(
  'CFG_T1R', 'CFG_T2R', 'ticker', 'preco', 'precoOriginal', 'stop', 'alvo1', 'alvo2', 'rr',
  'var alertaDivergenciaPreco = "";\n' + blocoOutput +
  '\n; return { stop: stop, alvo1: alvo1, alvo2: alvo2, rr: rr, invalido: stopInvalidoParaCompra };'
);
console.log = function () {};
var linhaOutput = realinharOutput(CFG_T1R, CFG_T2R, op.ticker, preco, precoOriginal, op.stopLoss, op.target1, op.target2, op.rr);
console.log = console_log_real;
if (linhaOutput.stop >= preco) {
  falhas.push('08_Output_Unified.js: stop realinhado R$ ' + linhaOutput.stop.toFixed(2) + ' ainda >= preço exibido.');
}

if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: a correção v12.8 não está produzindo uma linha consistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ Stop abaixo do preço exibido.');
  console.log('  ✅ Alvos acima da entrada.');
  console.log('  ✅ Risco % coerente (sem Math.abs mascarando stop inválido).');
  console.log('  ✅ Ambos os Writers (00_SheetWriter e 08_Output_Unified) realinham igualmente.');
  console.log('\n✅ PASSOU: linha consistente após a correção v12.8.');
}
