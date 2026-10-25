/**
 * =============================================================================
 * scripts/test_oportunidades_geometria.js — REGRESSÃO v14.7 (A1 + B)
 * =============================================================================
 * Garante que a aba "Oportunidades" NUNCA mais exiba geometria incoerente:
 *
 *   A1) A "Entrada Sugerida" só usa o gatilho Fibo quando ele é EXECUTÁVEL, ou
 *       seja, quando o preço está na banda em torno dele:
 *         fibo*(1-LIMITE) <= preço <= fibo*(1+LIMITE).
 *       Se o preço já subiu além do gatilho (ou caiu abaixo da zona), a entrada
 *       exibida passa a ser a COTAÇÃO e o Fibo vira referência de pullback.
 *
 *   B)  Defesa final: se o stop ficar ACIMA (ou igual) à entrada exibida, a
 *       entrada é forçada para a cotação. O stop jamais fica >= entrada.
 *
 * Casos reais da planilha reproduzidos:
 *   SMTO3: preço 19,81 / Fibo 16,66 / stop 18,52 → antes: stop ACIMA da entrada
 *   SUZB3: preço 41,99 / Fibo 43,37 / stop 40,92 → antes: entrada acima do preço
 *
 * Uso:  node scripts/test_oportunidades_geometria.js
 * =============================================================================
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var RAIZ = path.join(__dirname, '..');

// Dependências globais exigidas pelo 29_Oportunidades_Processor (não usadas
// nos caminhos de geometria, mas referenciadas pelo módulo).
function _noop() {}
var sandbox = {
  console: console,
  Logger: { log: _noop },
  SpreadsheetApp: {
    getActiveSpreadsheet: function () { return { getSheetByName: function () { return null; } }; }
  },
  Date: Date, Math: Math, Number: Number, String: String, Array: Array, Object: Object,
  isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt, Map: Map, Set: Set
};
vm.createContext(sandbox);

// Carrega a geometria real (funções puras) e o processador real no MESMO
// contexto, para que um enxergue o outro (caso contrário, no GAS eles
// compartilham o escopo global — aqui reproduzimos isso com o sandbox).
vm.runInContext(fs.readFileSync(path.join(RAIZ, '28_Position_Geometry.js'), 'utf8'), sandbox, { filename: '28_Position_Geometry.js' });
vm.runInContext(fs.readFileSync(path.join(RAIZ, '29_Oportunidades_Processor.js'), 'utf8'), sandbox, { filename: '29_Oportunidades_Processor.js' });

var PositionGeometry = sandbox.PositionGeometry;
var OportunidadesProcessor = sandbox.OportunidadesProcessor;



// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
var falhas = [];
var passou = 0;

function check(nome, condicao) {
  if (condicao) { passou++; console.log('  \u2705 ' + nome); }
  else { falhas.push(nome); console.log('  \u274C ' + nome); }
}

function titulo(t) {
  console.log('\n=============================================================');
  console.log(' ' + t);
  console.log('=============================================================');
}

var IDX = OportunidadesProcessor.CONFIG.IDX_ORIGEM;

/**
 * Monta uma linha de origem (Resultados_Analise, 27 colunas) com os campos
 * relevantes da geometria e executa o _montarLinhasFinais real.
 */
function processar(linhaParcial) {
  var row = new Array(27).fill('');
  row[IDX.DATA] = new Date();
  row[IDX.TICKER] = linhaParcial.ticker || 'TEST3';
  row[IDX.PRECO] = linhaParcial.preco;
  row[IDX.SCORE] = linhaParcial.score || 70;
  row[IDX.SETUP] = linhaParcial.setup || '\u{1F52D} RADAR TEND\u00CANCIA';
  row[IDX.MOTIVO] = '-';
  row[IDX.STOP] = linhaParcial.stop;
  row[IDX.ALVO1] = linhaParcial.alvo1;
  row[IDX.ALVO2] = linhaParcial.alvo2;
  row[IDX.RR] = linhaParcial.rr || 0;
  row[IDX.RISCO] = linhaParcial.riscoPct || 0;
  row[IDX.RSI] = 38;
  row[IDX.EMA21] = linhaParcial.ema21 || 0;
  row[IDX.EMA50] = linhaParcial.ema50 || 0;
  row[IDX.EMA200] = linhaParcial.ema200 || 0;
  row[IDX.ATR] = linhaParcial.atr || 0.5;
  row[IDX.FIBO] = linhaParcial.fibo;
  row[IDX.ANALISE_IA] = '-';
  row[IDX.TIPO_SETUP] = 'TEND\u00CANCIA';
  row[IDX.ALERTA] = linhaParcial.alerta || '-';
  row[IDX.TOPO50] = linhaParcial.topo50 || 0;
  row[IDX.GANHO_RAPIDO] = 0;
  row[IDX.DIST_TOPO] = 0;
  row[IDX.FORCA_RELATIVA] = '';

  var mapa = new Map();
  mapa.set(row[IDX.TICKER], row);

  var logOrig = console.log;
  console.log = _noop;
  var out = OportunidadesProcessor._montarLinhasFinais(mapa);
  console.log = logOrig;
  return out[0];
}

// Índices da saída (colunas da aba Oportunidades)
var OUT = { PRECO: 2, ENTRADA: 3, STOP: 4, ALVO1: 5, ALVO2: 6, RR: 7, RISCO: 8, REC: 9, OBS: 15 };


// ===========================================================================
titulo('CASO A \u2014 SMTO3: pre\u00E7o 19,81 / Fibo 16,66 / stop 18,52 (stop ACIMA do Fibo)');
var smto3 = processar({
  ticker: 'SMTO3', preco: 19.81, fibo: 16.66, stop: 18.52, alvo1: 20.99, alvo2: 21.81,
  rr: 0.91, riscoPct: 6.51, ema21: 19.10, ema50: 19.50, ema200: 20.00, topo50: 20.60
});
console.log('  Entrada exibida : R$ ' + smto3[OUT.ENTRADA].toFixed(2));
console.log('  Pre\u00E7o           : R$ ' + smto3[OUT.PRECO].toFixed(2));
console.log('  Stop            : R$ ' + smto3[OUT.STOP].toFixed(2));
console.log('  Observa\u00E7\u00F5es     : ' + smto3[OUT.OBS]);
check('A1: entrada N\u00C3O \u00E9 mais o Fibo descolado (deve ser a cota\u00E7\u00E3o 19,81)',
  Math.abs(smto3[OUT.ENTRADA] - 19.81) < 0.01);
check('B: stop N\u00C3O fica acima/igual \u00E0 entrada exibida',
  smto3[OUT.STOP] < smto3[OUT.ENTRADA]);
check('Observa\u00E7\u00F5es citam o Fibo como refer\u00EAncia de pullback',
  String(smto3[OUT.OBS]).indexOf('Fibo') !== -1 || String(smto3[OUT.OBS]).indexOf('pullback') !== -1);

// ===========================================================================
titulo('CASO B \u2014 SUZB3: pre\u00E7o 41,99 / Fibo 43,37 (Fibo ACIMA do pre\u00E7o)');
var suzb3 = processar({
  ticker: 'SUZB3', preco: 41.99, fibo: 43.37, stop: 40.92, alvo1: 45.00, alvo2: 46.50,
  rr: 1.20, riscoPct: 2.55, ema21: 41.00, ema50: 40.50, ema200: 39.00, topo50: 44.00
});
console.log('  Entrada exibida : R$ ' + suzb3[OUT.ENTRADA].toFixed(2));
console.log('  Pre\u00E7o           : R$ ' + suzb3[OUT.PRECO].toFixed(2));
console.log('  Stop            : R$ ' + suzb3[OUT.STOP].toFixed(2));
check('A1: entrada N\u00C3O fica acima da cota\u00E7\u00E3o (Fibo 43,37 mas pre\u00E7o 41,99)',
  suzb3[OUT.ENTRADA] <= suzb3[OUT.PRECO] * 1.03);
check('B: stop abaixo da entrada exibida',
  suzb3[OUT.STOP] < suzb3[OUT.ENTRADA]);
check('Observa\u00E7\u00F5es informam que o pre\u00E7o est\u00E1 ABAIXO do gatilho Fibo',
  String(suzb3[OUT.OBS]).indexOf('abaixo') !== -1);

// ===========================================================================
titulo('CASO C \u2014 Pre\u00E7o NA zona Fibo: entrada DEVE continuar sendo o Fibo');
var naZona = processar({
  ticker: 'VALE3', preco: 62.00, fibo: 61.50, stop: 58.50, alvo1: 70.00, alvo2: 75.00,
  rr: 2.00, riscoPct: 5.65, ema21: 61.80, ema50: 60.00, ema200: 58.00, topo50: 68.00,
  setup: '\u2705 TEND\u00CANCIA CONFIRMADA'
});
console.log('  Entrada exibida : R$ ' + naZona[OUT.ENTRADA].toFixed(2) + ' (Fibo 61,50)');
check('Entrada preservada como Fibo quando o pre\u00E7o est\u00E1 na zona execut\u00E1vel',
  Math.abs(naZona[OUT.ENTRADA] - 61.50) < 0.01);
check('Stop abaixo da entrada (geometria v\u00E1lida)',
  naZona[OUT.STOP] < naZona[OUT.ENTRADA]);

// ===========================================================================
titulo('CASO D \u2014 Invariante global: stop < entrada em TODOS os cen\u00E1rios');
[smto3, suzb3, naZona].forEach(function (linha, i) {
  check('Cen\u00E1rio ' + (i + 1) + ': stop (' + linha[OUT.STOP].toFixed(2) + ') < entrada (' +
    linha[OUT.ENTRADA].toFixed(2) + ')', linha[OUT.STOP] < linha[OUT.ENTRADA]);
});

// ===========================================================================
console.log('\n=============================================================');
if (falhas.length) {
  falhas.forEach(function (f) { console.log('  \u274C ' + f); });
  console.log('\n\u274C FALHOU: ' + falhas.length + ' asser\u00E7\u00E3o(\u00F5es) \u2014 geometria ainda incoerente.');
  process.exitCode = 1;
} else {
  console.log('\u2705 PASSOU: ' + passou + ' asser\u00E7\u00F5es \u2014 aba Oportunidades com geometria coerente (v14.7).');
  console.log('   \u2022 Entrada Fibo s\u00F3 quando execut\u00E1vel (A1).');
  console.log('   \u2022 Stop nunca >= entrada (B).');
  console.log('   \u2022 Fibo descolado vira refer\u00EAncia de pullback nas Observa\u00E7\u00F5es.');
}
console.log('=============================================================');
