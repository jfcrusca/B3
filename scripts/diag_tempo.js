/**
 * =============================================================================
 * scripts/diag_tempo.js — DIAGNÓSTICO DO ORÇAMENTO DE TEMPO DO PIPELINE
 * =============================================================================
 * Reconstrói a linha do tempo a partir de um log de execução e aponta gargalos.
 *
 * Uso:  node scripts/diag_tempo.js
 * =============================================================================
 */

var fs = require('fs');
var path = require('path');
var RAIZ = path.join(__dirname, '..');

function titulo(t) {
  console.log('\n=============================================================');
  console.log(' ' + t);
  console.log('=============================================================');
}

function seg(hms) {
  var p = hms.split(':');
  return (+p[0]) * 3600 + (+p[1]) * 60 + (+p[2]);
}

// ---------------------------------------------------------------------------
titulo('1. ORÇAMENTO DECLARADO NO CÓDIGO');

var srcOrq = fs.readFileSync(path.join(RAIZ, '00_Core_Orchestrator.js'), 'utf8');

function extrair(regex) {
  var m = srcOrq.match(regex);
  return m ? m[1] : null;
}

var teto = extrair(/_TETO_PIPELINE_MS\s*=\s*(\d+)/);
// ⚠️ TEMPO_LIMITE_MS é declarado em MILISSEGUNDOS (ex: 210000 = 210s)
var scanner = extrair(/var TEMPO_LIMITE_MS\s*=\s*(\d+)/);
var reserva = extrair(/RESERVA_POS_SCANNER_MS\s*=\s*(\d+)/);
var tickerTo = extrair(/var TICKER_TIMEOUT_MS\s*=\s*(\d+)/);
var globalMs = extrair(/var TEMPO_GLOBAL_MS\s*=\s*(\d+)/);

console.log('  _TETO_PIPELINE_MS ........... ' + (teto / 1000) + 's');
console.log('  TEMPO_LIMITE_MS (scanner) ... ' + (scanner / 1000) + 's');
console.log('  RESERVA_POS_SCANNER_MS ...... ' + (reserva / 1000) + 's');
console.log('  TICKER_TIMEOUT_MS ........... ' + (tickerTo / 1000) + 's');
console.log('  TEMPO_GLOBAL_MS (emergência)  ' + (globalMs / 1000) + 's');
console.log('  Limite real do GAS .......... 360s');
console.log('');
console.log('  scanner + reserva = ' + ((+scanner + +reserva) / 1000) + 's ' +
  (Math.abs(+scanner + +reserva - +teto) < 1000 ? '(== teto OK)' : '(!= teto ATENCAO)'));

// ---------------------------------------------------------------------------
titulo('2. LINHA DO TEMPO DO LOG REAL (21/09/2026)');

var SEGMENTOS = [
  { t: '20:12:16', nome: 'Precos atualizados (26 ativos)' },
  { t: '20:12:17', nome: 'SheetWriter - FALHA 27 vs 26' },
  { t: '20:12:18', nome: 'Oportunidades OK (684ms)' },
  { t: '20:12:20', nome: 'Ranker concluido' },
  { t: '20:12:22', nome: 'GOOGLEFINANCE - 35 cotacoes' },
  { t: '20:12:29', nome: 'BRAPI 404 NEOE3' },
  { t: '20:12:30', nome: 'BRAPI 404 CRFB3' },
  { t: '20:13:02', nome: 'Dashboard Integrado OK' },
  { t: '20:13:55', nome: 'TIMEOUT GAS (360s)' }
];

var t0 = seg(SEGMENTOS[0].t);
console.log('  (t0 = ' + SEGMENTOS[0].t + ')');
console.log('');
console.log('  DELTA   EVENTO');
console.log('  -----   ----------------------------------------');
SEGMENTOS.forEach(function (s) {
  var d = seg(s.t) - t0;
  console.log('  +' + String(d).padStart(3) + 's   ' + s.nome);
});

// ---------------------------------------------------------------------------
titulo('3. GARGALOS - BLOCOS SEM LOG');

var gargalos = [];
for (var i = 1; i < SEGMENTOS.length; i++) {
  var d = seg(SEGMENTOS[i].t) - seg(SEGMENTOS[i - 1].t);
  if (d >= 3) {
    gargalos.push({
      de: SEGMENTOS[i - 1].nome,
      para: SEGMENTOS[i].nome,
      seg: d,
      inicio: seg(SEGMENTOS[i - 1].t) - t0,
      fim: seg(SEGMENTOS[i].t) - t0
    });
  }
}

gargalos.sort(function (a, b) { return b.seg - a.seg; });
gargalos.forEach(function (g) {
  console.log('  ' + String(g.seg).padStart(3) + 's  (+' + g.inicio + 's a +' + g.fim + 's)');
  console.log('       ' + g.de);
  console.log('         -> ' + g.para);
});

var totalGargalo = gargalos.reduce(function (s, g) { return s + g.seg; }, 0);
console.log('');
console.log('  Total em blocos sem log: ' + totalGargalo + 's de ' +
  (seg(SEGMENTOS[SEGMENTOS.length - 1].t) - t0) + 's');

// ---------------------------------------------------------------------------
titulo('4. AUDITORIA - BLACKLIST vs. FETCH DE COTACAO');

var srcTicker = fs.readFileSync(path.join(RAIZ, '05_B3V10_TickerManager.js'), 'utf8');
var srcData = fs.readFileSync(path.join(RAIZ, '05_Data_Service.js'), 'utf8');

var mDead = srcTicker.match(/_deadTickers\s*=\s*\{([\s\S]*?)\n\s*\};/);
var deadTickers = [];
if (mDead) {
  var re = /"([A-Z0-9]{4,7})"\s*:/g;
  var mm;
  while ((mm = re.exec(mDead[1])) !== null) deadTickers.push(mm[1]);
}
console.log('  Tickers na _deadTickers: ' + deadTickers.length);
console.log('  ' + deadTickers.join(', '));

var mFn = srcData.match(/function getPrecosAtuaisEmLote[\s\S]*?\n  \}/);
var corpoFn = mFn ? mFn[0] : '';
var consultaBlacklist = /_deadTickers|isDeadTicker|blacklist|_isDead/i.test(corpoFn);
console.log('');
console.log('  getPrecosAtuaisEmLote consulta a blacklist? ' +
  (consultaBlacklist ? 'SIM' : 'NAO'));

if (!consultaBlacklist) {
  console.log('');
  console.log('  BUG CONFIRMADO: tickers da blacklist entram no fetch de cotacao.');
  console.log('    Fluxo: GoogleFinance (35) -> missing (~11) -> HGBrasil -> BRAPI -> Bolsai');
  console.log('    NEOE3 e CRFB3 estao MORTOS mas sao tentados em TODAS as fontes.');
  console.log('    Custo: ate ' + (deadTickers.length * 3) +
    ' requisicoes HTTP desperdicadas por execucao (3 fontes x ' + deadTickers.length + ').');
}

// ---------------------------------------------------------------------------
titulo('5. VEREDITO');

var tempoLogico = 46;
var totalLog = seg(SEGMENTOS[SEGMENTOS.length - 1].t) - t0;

console.log('  Pipeline LOGICO concluiu em ....... ~' + tempoLogico + 's');
console.log('  Timeout do GAS ocorreu em ......... ~' + totalLog + 's');
console.log('  Diferenca (sem log) ............... ~' + (totalLog - tempoLogico) + 's');
console.log('');
console.log('  O pipeline terminou as +46s (Dashboard e a ULTIMA etapa de');
console.log('  _processarSaidasFinais). Os ~53s seguintes NAO executam logica');
console.log('  de negocio visivel.');
console.log('');
console.log('  FATO RELEVANTE: o log NAO contem a linha');
console.log('    "Tempo Total Execucao: Xs"  (console.timeEnd na linha 119)');
console.log('  nem "SISTEMA B3-V10 FINALIZADO" (linha 120).');
console.log('  => A execucao foi CORTADA ANTES de completar executar().');
console.log('  => Logo, os 53s finais SAO trabalho real do pipeline, nao ocioso.');

// ---------------------------------------------------------------------------
console.log('\n=============================================================');
console.log(' CAUSAS DO TIMEOUT, em ordem de impacto:');
console.log('');
console.log('  1) BLACKLIST IGNORADA no fetch de cotacao.');
console.log('     ' + deadTickers.length + ' tickers mortos tentados em 3 fontes = ate ' +
  (deadTickers.length * 3) + ' HTTP inuteis.');
console.log('     Cada 404 custa 1-3s (fetch + retry com backoff).');
console.log('');
console.log('  2) A EXCECAO do SheetWriter abortou o fluxo antes do console.timeEnd.');
console.log('     _registrarFalha() capturou, mas o erro pode ter deixado');
console.log('     operacoes de escrita pendentes no buffer do GAS.');
console.log('');
console.log('  3) Scanner com orcamento de ' + (scanner / 1000) + 's + reserva de ' +
  (reserva / 1000) + 's = ' + ((+scanner + +reserva) / 1000) + 's,');
console.log('     mas o GAS mata em 360s. Margem real: ' +
  (360 - (+teto / 1000)) + 's apenas.');
console.log('=============================================================\n');
