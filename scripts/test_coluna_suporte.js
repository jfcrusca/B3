/**
 * TESTE — Coluna "Suporte vs. Zona" (v15.3)
 * =============================================================================
 * Valida a terceira coluna de transparência do pullback, que cruza o último
 * pivô de fundo (`swingLow`, campo que era morto no Core22) com a zona de
 * compra Fibonacci.
 *
 * O QUE ESTE TESTE GARANTE
 *   1. PARIDADE DA ZONA — `_derivarZonaCompra` (29_*) reconstrói a mesma
 *      `zonaPiso`/`zonaTeto` que o 22_Core_Analyzers calcula de verdade.
 *      Esta é a asserção mais importante: se a fórmula divergir, a coluna
 *      inteira mente. Rodado contra o Core22 REAL via _harness_core22.
 *   2. CLASSIFICAÇÃO — cada veredito (CONFIRMA / CONTRARIA / ABAIXO / BORDA /
 *      SEM DADO) nos seus casos de borda.
 *   3. INTEGRAÇÃO — `_montarLinhasFinais` grava a coluna 22 no índice certo e
 *      mantém o comprimento da linha.
 *   4. CONTRATOS DE COLUNA — headers do Processor, do Setup das abas e do
 *      08_Output_Unified todos com o mesmo número de colunas.
 *   5. NÃO-REGRESSÃO — as colunas 19/20 (Gatilho Fibo / Dist. Gatilho %)
 *      continuam nos índices originais.
 *
 * Uso:  node scripts/test_coluna_suporte.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var core22 = require('./_harness_core22');

var ROOT = path.resolve(__dirname, '..');

var passou = 0;
var falhou = 0;
var falhasDetalhe = [];

function check(nome, obtido, esperado) {
  var ok;
  if (typeof esperado === 'number' && typeof obtido === 'number') {
    ok = Math.abs(obtido - esperado) < 1e-6;
  } else {
    ok = (obtido === esperado);
  }
  if (ok) {
    passou++;
    console.log('  ✅ ' + nome);
  } else {
    falhou++;
    falhasDetalhe.push(nome + ' | obtido=' + obtido + ' esperado=' + esperado);
    console.log('  ❌ ' + nome + '\n       obtido=' + obtido + '  esperado=' + esperado);
  }
}

function checkRange(nome, obtido, min, max) {
  var ok = (obtido >= min && obtido <= max);
  if (ok) {
    passou++;
    console.log('  ✅ ' + nome + ' (' + (obtido * 100).toFixed(3) + '%)');
  } else {
    falhou++;
    falhasDetalhe.push(nome + ' | obtido=' + obtido);
    console.log('  ❌ ' + nome + ' — obtido=' + (obtido * 100).toFixed(3) +
      '% fora de [' + (min * 100) + '%, ' + (max * 100) + '%]');
  }
}

function titulo(t) {
  console.log('\n' + '─'.repeat(76));
  console.log(t);
  console.log('─'.repeat(76));
}

// =============================================================================
// CARREGADOR DO 29_OPORTUNIDADES_PROCESSOR
// =============================================================================
// Carrega o módulo REAL em sandbox vm. O Processor é uma IIFE que atribui a
// global OportunidadesProcessor. Stubs mínimos de GAS.
function carregarProcessor() {
  var src = fs.readFileSync(path.join(ROOT, '29_Oportunidades_Processor.js'), 'utf8');
  if (src.indexOf('OportunidadesProcessor') === -1) {
    throw new Error('29_Oportunidades_Processor.js invalido: OportunidadesProcessor nao encontrada.');
  }
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
  return sb;
}

// =============================================================================
// TESTE 1 — CONTRATOS DE COLUNA (headers alinhados)
// =============================================================================
titulo('TESTE 1 — Contratos de coluna entre os modulos');

var P = carregarProcessor();
var proc = P.OportunidadesProcessor;

check('Processor carregou', typeof proc, 'object');
check('HEADERS_DESTINO tem 22 colunas', proc.CONFIG.HEADERS_DESTINO.length, 22);
check('Coluna 19 = Gatilho Fibo', proc.CONFIG.HEADERS_DESTINO[19], 'Gatilho Fibo');
check('Coluna 20 = Dist. Gatilho %', proc.CONFIG.HEADERS_DESTINO[20], 'Dist. Gatilho %');
check('Coluna 21 = Suporte vs. Zona', proc.CONFIG.HEADERS_DESTINO[21], 'Suporte vs. Zona');
check('IDX_ORIGEM.SUPORTE = 27', proc.CONFIG.IDX_ORIGEM.SUPORTE, 27);
check('IDX_ORIGEM.ATR = 15 (inalterado)', proc.CONFIG.IDX_ORIGEM.ATR, 15);
check('IDX_ORIGEM.TOPO50 = 23 (inalterado)', proc.CONFIG.IDX_ORIGEM.TOPO50, 23);

// ⚠️ A leitura de origem tem `getRange(2, 1, lastRow - 1, N)` com N HARDCODED.
// Se N < 31, as colunas 27-30 (Suporte e diagnóstico do rompimento) são
// truncadas e "Suporte vs. Zona" sai "SEM DADO"/sem VARREDURA e REVERSAO em
// 100% das linhas, SEM erro visível. Esta asserção trava o acoplamento.
var procSrc = fs.readFileSync(path.join(ROOT, '29_Oportunidades_Processor.js'), 'utf8');
var mLeitura = procSrc.match(/lastRow\s*-\s*1\s*,\s*(\d+)\s*\)\s*\.getValues/);
check('_lerOrigem localizado', !!mLeitura, true);
if (mLeitura) {
  var nlidas = Number(mLeitura[1]);
  check('_lerOrigem le >= SUPORTE_RECUPEROU+1 colunas',
    nlidas >= proc.CONFIG.IDX_ORIGEM.SUPORTE_RECUPEROU + 1,
    true);
  check('_lerOrigem le exatamente 31 colunas', nlidas, 31);
}

// Índices do diagnóstico de rompimento (v15.4).
check('IDX_ORIGEM.SUPORTE_ROMPIDO = 28', proc.CONFIG.IDX_ORIGEM.SUPORTE_ROMPIDO, 28);
check('IDX_ORIGEM.VOL_ROMPIMENTO = 29', proc.CONFIG.IDX_ORIGEM.VOL_ROMPIMENTO, 29);
check('IDX_ORIGEM.SUPORTE_RECUPEROU = 30', proc.CONFIG.IDX_ORIGEM.SUPORTE_RECUPEROU, 30);

// Headers da aba Oportunidades criada pelo 00_Setup_CreateSheets devem ter o
// MESMO comprimento do HEADERS_DESTINO. Se divergirem, as colunas desalinham
// (foi exatamente o bug da v15.2 com 'Força Rel. %' faltando).
var setupSrc = fs.readFileSync(path.join(ROOT, '00_Setup_CreateSheets.js'), 'utf8');
var mOport = setupSrc.match(/function setupOportunidades[\s\S]*?const headers = \[([\s\S]*?)\];/);
check('setupOportunidades() localizado', !!mOport, true);

if (mOport) {
  // Remove comentários antes de contar as strings do array.
  var corpoOport = mOport[1].replace(/\/\/[^\n]*/g, '');
  var strsOport = corpoOport.match(/'[^']*'/g) || [];
  check('setupOportunidades declara 22 headers', strsOport.length, 22);
  check('setupOportunidades termina com "Suporte vs. Zona"',
    strsOport[strsOport.length - 1], "'Suporte vs. Zona'");
}

// Aba Resultados_Analise deve casar com o 08_Output_Unified.
var uniSrc = fs.readFileSync(path.join(ROOT, '08_Output_Unified.js'), 'utf8');
var mNum = uniSrc.match(/NUM_COLS:\s*(\d+)/);
check('08_Output_Unified.NUM_COLS = 31', mNum && Number(mNum[1]), 31);

var mRes = setupSrc.match(/function setupResultadosAnalise[\s\S]*?const headers = \[([\s\S]*?)\];/);
check('setupResultadosAnalise() localizado', !!mRes, true);
if (mRes && mNum) {
  var corpoRes = mRes[1].replace(/\/\/[^\n]*/g, '');
  var strsRes = corpoRes.match(/"[^"]*"/g) || [];
  check('setupResultadosAnalise casa com NUM_COLS',
    strsRes.length, Number(mNum[1]));
}

// =============================================================================
// TESTE 2 — PARIDADE DA ZONA (o teste mais importante)
// =============================================================================
// `_derivarZonaCompra` reconstrói zonaPiso/zonaTeto a partir de Fibonacci, ATR
// e Topo50 — que é tudo o que a planilha tem. Comparado com o Core22 REAL em
// 60 séries de regimes variados. Se a fórmula divergir, a coluna mente.
titulo('TESTE 2 — Paridade da zona derivada vs. 22_Core_Analyzers REAL');

var _seed = 987;
function rand() {
  _seed = (_seed * 1103515245 + 12345) % 2147483648;
  return _seed / 2147483648;
}
function gerarSerie(tend, vol, base) {
  var preco = base, out = [], d0 = new Date(2025, 0, 1).getTime();
  for (var i = 0; i < 90; i++) {
    var ret = tend + (rand() - 0.5) * vol * 3;
    var open = preco, close = preco * Math.exp(ret);
    var pav = Math.abs(close - open) * 0.6 + close * vol * 0.5;
    out.push({
      date: new Date(d0 + i * 86400000), open: open, close: close,
      high: Math.max(open, close) + rand() * pav,
      low: Math.min(open, close) - rand() * pav,
      volume: 1000000
    });
    preco = close;
  }
  return out;
}

var regs = [
  [0.006, 0.014], [0.003, 0.012], [0.0015, 0.010], [0.005, 0.028],
  [0.004, 0.006], [0.000, 0.012], [0.000, 0.022], [-0.004, 0.014]
];

var piorErroPiso = 0, piorErroTeto = 0, casos = 0, errosAcima1pc = 0;

regs.forEach(function (r) {
  for (var k = 0; k < 8; k++) {
    var candles = gerarSerie(r[0], r[1], 20 + rand() * 60);
    var res = core22.analisar(candles, { ticker: 'PARIDADE' });
    var est = res.estrutura;
    if (!est || !(est.fibo618 > 0) || !(est.zonaPiso > 0)) continue;

    // Só o que a planilha entrega: Fibonacci (col 18), ATR (col 15),
    // Topo50 (col 23 = h50) e o swingLow (col 27).
    var zonaDerivada = proc._derivarZonaCompra(est.fibo618, res.indicadores.atr, est.h50);
    if (!zonaDerivada) continue;

    casos++;

    var errPiso = Math.abs(zonaDerivada.piso - est.zonaPiso) / est.zonaPiso;
    var errTeto = Math.abs(zonaDerivada.teto - est.zonaTeto) / est.zonaTeto;
    if (errPiso > piorErroPiso) piorErroPiso = errPiso;
    if (errTeto > piorErroTeto) piorErroTeto = errTeto;
    if (errPiso > 0.01 || errTeto > 0.01) errosAcima1pc++;
  }
});

console.log('  Series comparadas: ' + casos);
checkRange('Piso derivado (pior erro)', piorErroPiso, 0, 0.01);
checkRange('Teto derivado (pior erro)', piorErroTeto, 0, 0.01);
check('Series com erro > 1%', errosAcima1pc, 0);

// =============================================================================
// TESTE 3 — CLASSIFICACAO
// =============================================================================
titulo('TESTE 3 — Classificacao Suporte vs. Zona (casos de borda)');

// Zona fixa de referência: piso 95,00 / teto 100,00.
var ZONA = { piso: 95, teto: 100 };

check('Pivo no MEIO da zona => CONFIRMA',
  proc._classificarSuporteVsZona(97.5, ZONA, true).classe, 'CONFIRMA');
check('Pivo exatamente no PISO => CONFIRMA',
  proc._classificarSuporteVsZona(95, ZONA, true).classe, 'CONFIRMA');
check('Pivo exatamente no TETO => CONFIRMA',
  proc._classificarSuporteVsZona(100, ZONA, true).classe, 'CONFIRMA');

// Acima: 1% acima do teto (100,00) = 101,00 -> dentro da tolerancia de 2%
check('Pivo 1% acima do teto => BORDA',
  proc._classificarSuporteVsZona(101, ZONA, true).classe, 'BORDA');
check('Pivo 5% acima do teto => CONTRARIA',
  proc._classificarSuporteVsZona(105, ZONA, true).classe, 'CONTRARIA');
check('Pivo muito acima (120) => CONTRARIA',
  proc._classificarSuporteVsZona(120, ZONA, true).classe, 'CONTRARIA');

// Abaixo: 1% abaixo do piso (95,00) = 94,05 -> BORDA
check('Pivo 1% abaixo do piso => BORDA',
  proc._classificarSuporteVsZona(94.05, ZONA, true).classe, 'BORDA');
check('Pivo bem abaixo (80) => ABAIXO',
  proc._classificarSuporteVsZona(80, ZONA, true).classe, 'ABAIXO');

// Sem dados
check('Sem pivo (0) => SEM_DADO',
  proc._classificarSuporteVsZona(0, ZONA, true).classe, 'SEM_DADO');
check('Sem pivo (null) => SEM_DADO',
  proc._classificarSuporteVsZona(null, ZONA, true).classe, 'SEM_DADO');
check('Sem Fibonacci => SEM_DADO',
  proc._classificarSuporteVsZona(97, ZONA, false).classe, 'SEM_DADO');
check('Sem zona => SEM_DADO',
  proc._classificarSuporteVsZona(97, null, true).classe, 'SEM_DADO');

// Rotulos exatos (a planilha exibe esta string)
check('Rotulo CONFIRMA', proc._classificarSuporteVsZona(97, ZONA, true).rotulo, '✅ CONFIRMA');
check('Rotulo CONTRARIA', proc._classificarSuporteVsZona(110, ZONA, true).rotulo, '🔴 CONTRARIA');
check('Rotulo ABAIXO', proc._classificarSuporteVsZona(80, ZONA, true).rotulo, '🟢 ABAIXO (fundo + profundo)');
check('Rotulo SEM_DADO', proc._classificarSuporteVsZona(0, ZONA, true).rotulo, '— SEM DADO');

// Sinal da distancia: positivo acima, negativo abaixo
check('Dist positiva quando pivo acima',
  proc._classificarSuporteVsZona(110, ZONA, true).distPct > 0, true);
check('Dist negativa quando pivo abaixo',
  proc._classificarSuporteVsZona(80, ZONA, true).distPct < 0, true);

// _derivarZonaCompra: casos degenerados
check('_derivarZonaCompra sem Fibo => null',
  proc._derivarZonaCompra(0, 1, 50), null);
check('_derivarZonaCompra sem Fibo (null) => null',
  proc._derivarZonaCompra(null, 1, 50), null);
var zSemAtr = proc._derivarZonaCompra(50, 0, 70);
check('_derivarZonaCompra sem ATR => piso == fibo',
  Math.abs(zSemAtr.piso - 50) < 1e-9, true);

// Sem Topo50 (h50), o teto deve SUBESTIMAR a zona (fallback conservador):
var zSemTopo = proc._derivarZonaCompra(50, 1, 0);
check('_derivarZonaCompra sem Topo50 => teto conservador',
  zSemTopo.teto <= zSemAtr.teto + 1e-9, true);

// =============================================================================
// TESTE 3-B — VARREDURA vs REVERSAO (v15.4): so o volume da quebra separa
// =============================================================================
titulo('TESTE 3-B — Varredura de liquidez vs. reversao (volume da quebra)');

// ZONA = { piso: 96, teto: 102 }; pivo 110 => acima da zona => CONTRARIA base.
var PIVO_ACIMA = 110;
var N_CONTRARIA = proc._classificarSuporteVsZona(
  PIVO_ACIMA, ZONA, true, { rompido: false, volRompimento: null, recuperou: false });
check('Caso 1: fundo intacto => CONTRARIA',
  N_CONTRARIA.classe, 'CONTRARIA');

var VARREDURA = proc._classificarSuporteVsZona(
  PIVO_ACIMA, ZONA, true, { rompido: true, volRompimento: 0.45, recuperou: true });
check('Caso 2: quebra seca + recuperou => VARREDURA',
  VARREDURA.classe, 'VARREDURA');
check('Caso 2 mantem a distancia', VARREDURA.distPct > 0, true);

var REVERSAO = proc._classificarSuporteVsZona(
  PIVO_ACIMA, ZONA, true, { rompido: true, volRompimento: 2.1, recuperou: false });
check('Caso 3: quebra c/ volume + nao recuperou => REVERSAO',
  REVERSAO.classe, 'REVERSAO');

// Fronteiras do veredito — cada combinacao precisa cair no lugar certo.
check('Rompido seco SEM recuperar => CONTRARIA (nao e varredura)',
  proc._classificarSuporteVsZona(PIVO_ACIMA, ZONA, true,
    { rompido: true, volRompimento: 0.45, recuperou: false }).classe, 'CONTRARIA');
check('Rompido com volume MAS recuperou => CONTRARIA (reversao falhou)',
  proc._classificarSuporteVsZona(PIVO_ACIMA, ZONA, true,
    { rompido: true, volRompimento: 2.1, recuperou: true }).classe, 'CONTRARIA');
check('Rompido sem base de volume => CONTRARIA (conservador)',
  proc._classificarSuporteVsZona(PIVO_ACIMA, ZONA, true,
    { rompido: true, volRompimento: null, recuperou: true }).classe, 'CONTRARIA');
check('Diagnostico ausente (compat v15.3) => CONTRARIA',
  proc._classificarSuporteVsZona(PIVO_ACIMA, ZONA, true, undefined).classe, 'CONTRARIA');

// Limiar de volume seco = 0.70 (mesmo vocabulario do Core22: < 0.70 => FRACO)
check('vol 0.69 conta como seco', proc._lerRompimento({ volRompimento: 0.69 }).volumeSeco, true);
check('vol 0.70 NAO conta como seco', proc._lerRompimento({ volRompimento: 0.70 }).volumeSeco, false);
check('vol null => volumeSeco false', proc._lerRompimento({ volRompimento: null }).volumeSeco, false);
check('_lerRompimento tolera undefined', proc._lerRompimento(undefined).rompido, false);

// O diagnostico NAO pode alterar os casos que nao envolvem perda de suporte:
// pivo ABAIXO da zona continua ABAIXO mesmo com quebra violenta registrada.
check('Pivo abaixo da zona ignora o diagnostico',
  proc._classificarSuporteVsZona(80, ZONA, true,
    { rompido: true, volRompimento: 3.0, recuperou: false }).classe, 'ABAIXO');
// Pivo DENTRO da zona continua CONFIRMA.
check('Pivo na zona ignora o diagnostico',
  proc._classificarSuporteVsZona(97, ZONA, true,
    { rompido: true, volRompimento: 3.0, recuperou: false }).classe, 'CONFIRMA');

// Rotulos exatos das novas classes
check('Rotulo VARREDURA', VARREDURA.rotulo, '🟠 VARREDURA (seca + recuperou)');
check('Rotulo REVERSAO', REVERSAO.rotulo, '⛔ REVERSAO (quebra c/ volume)');

// =============================================================================
// TESTE 4 — INTEGRACAO com _montarLinhasFinais
// =============================================================================
titulo('TESTE 4 — Integracao: coluna 21 gravada no indice correto');

// Monta uma linha de ORIGEM (Resultados_Analise, 31 colunas) pelo IDX_ORIGEM.
function linhaOrigem(over) {
  var o = over || {};
  var r = new Array(31).fill('');
  var I = proc.CONFIG.IDX_ORIGEM;
  r[I.DATA] = new Date();
  r[I.TICKER] = o.ticker || 'TEST3';
  r[I.PRECO] = o.preco !== undefined ? o.preco : 100;
  r[I.SCORE] = o.score !== undefined ? o.score : 75;
  r[I.SETUP] = o.setup || '📈 TENDÊNCIA CONFIRMADA';
  r[I.MOTIVO] = 'motivo';
  r[I.STOP] = o.stop !== undefined ? o.stop : 92;
  r[I.ALVO1] = o.alvo1 !== undefined ? o.alvo1 : 120;
  r[I.ALVO2] = o.alvo2 !== undefined ? o.alvo2 : 135;
  r[I.RR] = o.rr !== undefined ? o.rr : 2.5;
  r[I.RISCO] = 8;
  r[I.RSI] = 55;
  r[I.EMA21] = 99; r[I.EMA50] = 97; r[I.EMA200] = 90;
  r[I.ATR] = o.atr !== undefined ? o.atr : 2;
  r[I.VOLUME] = 1000000;
  r[I.PIVOT] = 100;
  r[I.FIBO] = o.fibo !== undefined ? o.fibo : 98;
  r[I.ANALISE_IA] = 'ia';
  r[I.RANKING] = 1;
  r[I.TIPO_SETUP] = 'TENDÊNCIA';
  r[I.ALERTA] = '✅';
  r[I.TOPO50] = o.topo50 !== undefined ? o.topo50 : 130;
  r[I.GANHO_RAPIDO] = 0.02;
  r[I.DIST_TOPO] = 0.20;
  r[I.FORCA_RELATIVA] = 1.5;
  r[I.SUPORTE] = o.suporte !== undefined ? o.suporte : 97;
  // 🔧 v15.4: diagnostico do rompimento (default = fundo intacto).
  r[I.SUPORTE_ROMPIDO] = (o.rompido === undefined) ? 'NÃO' : o.rompido;
  r[I.VOL_ROMPIMENTO] = (o.volRompimento === undefined) ? '' : o.volRompimento;
  r[I.SUPORTE_RECUPEROU] = (o.recuperou === undefined) ? 'NÃO' : o.recuperou;
  return r;
}

function gerarLinha(over) {
  var mapa = new Map();
  mapa.set((over && over.ticker) || 'TEST3', linhaOrigem(over));
  var out = proc._montarLinhasFinais(mapa);
  return out[0];
}

var linha = gerarLinha({});
check('Linha gerada', Array.isArray(linha), true);
check('Linha tem 22 colunas', linha.length, 22);
check('Coluna 19 continua Gatilho Fibo', linha[19], 98);
check('Coluna 20 continua Dist. Gatilho % (numerico)',
  typeof linha[20], 'number');
check('Coluna 21 preenchida', typeof linha[21], 'string');
check('Coluna 22 NAO existe (sem coluna extra)', linha[22], undefined);

// Cenario CONFIRMA: pivo 97 dentro da zona.
// zona: fibo618=98, ATR=2 => slack=1.2 => piso=96.8
//       h50=130 => range=(130-98)/0.618=51.78 => fibo50=130-25.89=104.11
//       teto=104.11+1.2=105.31  => 97 esta entre 96.8 e 105.31 => CONFIRMA
var lConf = gerarLinha({ suporte: 97, fibo: 98, atr: 2, topo50: 130 });
check('Pivo 97 / zona 96,8-105,3 => CONFIRMA', lConf[21], '✅ CONFIRMA');

// Cenario CONTRARIA: pivo 120 (acima do teto 105,31).
var lContra = gerarLinha({ suporte: 120, fibo: 98, atr: 2, topo50: 130 });
check('Pivo 120 / zona 96,8-105,3 => CONTRARIA', lContra[21], '🔴 CONTRARIA');

// 🔧 v15.4: mesmas colunas de origem, mas com diagnostico de quebra.
// Prova que as colunas 28-30 CHEGAM ao veredito (e nao ficam so na planilha).
var lVarre = gerarLinha({
  suporte: 120, fibo: 98, atr: 2, topo50: 130,
  rompido: 'SIM', volRompimento: 0.42, recuperou: 'SIM'
});
check('Origem "SIM/seco/SIM" => col 21 VARREDURA',
  lVarre[21], '🟠 VARREDURA (seca + recuperou)');

var lReversao = gerarLinha({
  suporte: 120, fibo: 98, atr: 2, topo50: 130,
  rompido: 'SIM', volRompimento: 2.4, recuperou: 'NÃO'
});
check('Origem "SIM/2.4x/NAO" => col 21 REVERSAO',
  lReversao[21], '⛔ REVERSAO (quebra c/ volume)');

// Celula vazia na coluna de volume (provedor sem volume) => null, nao 0.
var lSemVol = gerarLinha({
  suporte: 120, fibo: 98, atr: 2, topo50: 130,
  rompido: 'SIM', volRompimento: '', recuperou: 'SIM'
});
check('Sem volume medido => CONTRARIA (conservador)', lSemVol[21], '🔴 CONTRARIA');

// Cenario ABAIXO: pivo 80 (bem abaixo do piso 96,8).
var lAbaixo = gerarLinha({ suporte: 80, fibo: 98, atr: 2, topo50: 130 });
check('Pivo 80 / zona 96,8-105,3 => ABAIXO', lAbaixo[21], '🟢 ABAIXO (fundo + profundo)');

// Cenario SEM DADO: sem pivo.
var lSem = gerarLinha({ suporte: 0, fibo: 98, atr: 2, topo50: 130 });
check('Sem pivo => SEM DADO', lSem[21], '— SEM DADO');

// Cenario SEM DADO: sem Fibonacci na linha de origem.
var lSemFibo = gerarLinha({ suporte: 97, fibo: 0, atr: 2, topo50: 130 });
check('Sem Fibonacci => SEM DADO', lSemFibo[21], '— SEM DADO');
check('Sem Fibonacci => Gatilho Fibo vazio', lSemFibo[19], '');

// A coluna 21 e string sempre (nunca undefined) — evita celula vazia "suja"
check('Coluna 21 e sempre string', typeof lSemFibo[21], 'string');

// =============================================================================
// TESTE 6 — _core_analisarRompimentoSuporte (medicao real de volume, v15.4)
// =============================================================================
titulo('TESTE 6 — Core22: quebra seca vs. quebra com volume');

// Serie base: patamar ~100, fundo de referencia no indice 25 (low 95), alta
// depois e, em seguida, a quebra. O pivô é PASSADO EXPLICITAMENTE ao teste:
// num cenário real de reversão o próprio fundo quebrado vira um pivô mais
// baixo e mais recente (o detector sempre devolve o ÚLTIMO), então quem
// precisa julgar o nível é a chamada — e é exatamente isso que testamos aqui.
//
// ⚠️ Cuidado com o detector: `_core_detectPivotLows` aceita pivos com lows
// IGUAIS (usa `>` e nao `>=`); num patamar de candles identicos ele gera
// dezenas de pivos no mesmo preco.
function serieComFundo(opcoes) {
  var o = opcoes || {};
  var candles = [];
  var quebraIdx = (o.quebraIdx === undefined) ? 38 : o.quebraIdx;
  var fimQuebra = quebraIdx + 3;   // a quebra ocupa 3 candles

  // Bloco 1 (0..24): patamar ~100.
  for (var i = 0; i < 25; i++) {
    candles.push({ open: 100, high: 101, low: 99, close: 100, volume: 1000 });
  }
  // Fundo (25): low estritamente menor que os vizinhos.
  candles.push({ open: 96, high: 97, low: 95, close: 96, volume: 1000 });
  // Bloco 2 (26..37): alta — lows crescentes, sem novos fundos.
  for (var k = 26; k < quebraIdx; k++) {
    var p = 100 + (k - 26) * 0.5;
    candles.push({ open: p, high: p + 2, low: p - 0.5, close: p + 1, volume: 1000 });
  }

  // Bloco 3: rompimento (3 candles) + desfecho, até 52 candles.
  for (var j = quebraIdx; j < 52; j++) {
    if (o.quebra && j < fimQuebra) {
      // Candles da quebra: fecham abaixo do fundo (93 < 95).
      candles.push({
        open: 94, high: 95.5, low: 92, close: 93,
        volume: o.quebraVolume !== undefined ? o.quebraVolume : 1000
      });
    } else if (o.quebra && o.recupera) {
      // Recuperacao: volta a fechar acima do fundo (100 > 95).
      candles.push({ open: 96, high: 101, low: 95.8, close: 100, volume: 1000 });
    } else if (o.quebra) {
      // Reversao consumada: segue fechando abaixo do fundo.
      candles.push({ open: 93, high: 94, low: 91, close: 92, volume: 1000 });
    } else {
      // Sem quebra: segue acima do fundo.
      candles.push({ open: 100, high: 101, low: 99, close: 100, volume: 1000 });
    }
  }
  return candles;
}

// O pivô de referência é o fundo que existia ANTES da quebra (índice 25).
var PIVO_FUNDO = 25;
var NIVEL_FUNDO = 95;

// Sanidade da série-semente: garante que o cenário "sem quebra" realmente não
// tem fechamento abaixo do nível (senão os testes abaixo passariam por acidente).
check('Serie sem quebra nunca fecha abaixo do fundo',
  serieComFundo({}).every(function (c) { return c.close >= NIVEL_FUNDO; }), true);

// Nota de projeto: quem chama `_core_analisarRompimentoSuporte` no Core22 usa
// `_core_getLastPivotLowIndex`, que devolve o pivô MAIS RECENTE da janela. Num
// cenário de reversão o próprio fundo quebrado passa a ser um pivô (mais baixo e
// mais novo) — por isso aqui injetamos o índice explicitamente, isolando a
// medição de volume/recuperação do comportamento do detector.
//
// `_core_getLastPivotLowIndex` é validado à parte: precisa apontar para um low
// que realmente seja um pivô (mínima local) da série.
var idxDetectado = core22.getPivotIndex(serieComFundo({}));
check('Indice do pivo aponta para um low <= vizinhos',
  idxDetectado >= 0 &&
  serieComFundo({})[idxDetectado].low <= serieComFundo({})[idxDetectado - 1].low &&
  serieComFundo({})[idxDetectado].low <= serieComFundo({})[idxDetectado + 1].low,
  true);

// (a) fundo intacto — sem quebra, o fechamento segue acima do nível.
var rIntacto = core22.rompimento(serieComFundo({}), PIVO_FUNDO, NIVEL_FUNDO);
check('Fundo intacto => rompido false', rIntacto.rompido, false);
check('Fundo intacto => sem volume de quebra', rIntacto.volRompimento, null);

// (b) quebra SECA (volume 0.3x) + recuperacao => varredura de liquidez.
// `rompido` reflete só o fechamento MAIS RECENTE: como o preço recuperou, ele é
// false — mas `desdeRompimento > 0` e `vol/recuperou` registram que houve quebra
// e que ela foi seca. Quem decide o veredito é o conjunto.
var cSeco = serieComFundo({ quebra: true, quebraVolume: 300, recupera: true });
var rSeco = core22.rompimento(cSeco, PIVO_FUNDO, NIVEL_FUNDO);
check('Quebra seca => houve janela de rompimento', rSeco.desdeRompimento > 0, true);
check('Quebra seca => volRompimento ~0.3', Math.round(rSeco.volRompimento * 10) / 10, 0.3);
check('Quebra seca => recuperou true', rSeco.recuperou, true);
check('Quebra seca + recuperacao => rompido false (ja voltou)', rSeco.rompido, false);

// (c) quebra COM VOLUME (4x) e sem recuperacao => reversao
var cVol = serieComFundo({ quebra: true, quebraVolume: 4000, recupera: false });
var rVol = core22.rompimento(cVol, PIVO_FUNDO, NIVEL_FUNDO);
check('Quebra c/ volume => rompido true', rVol.rompido, true);
check('Quebra c/ volume => volRompimento ~4', Math.round(rVol.volRompimento), 4);
check('Quebra c/ volume => recuperou false', rVol.recuperou, false);

// (d) pivô muito recente => sem janela para quebra
var rRecente = core22.rompimento(serieComFundo({}), 46, NIVEL_FUNDO);
check('Pivo recente => rompido false', rRecente.rompido, false);
check('Pivo recente => volRompimento null', rRecente.volRompimento, null);

// (e) entradas degeneradas nao podem lancar
check('Sem candles => null', core22.rompimento([], 0, 95), null);
check('Pivo invalido (-1) => null', core22.rompimento(serieComFundo({}), -1, 95), null);
check('Preco do pivo 0 => null', core22.rompimento(serieComFundo({}), PIVO_FUNDO, 0), null);

// (f) o detector ignora os 2 candles de confirmacao do proprio pivo:
// um "furo" logo apos o fundo (26-27) nao pode contar como quebra confirmada.
// Note que esse furo, por si, ainda pode VIRAR um novo pivo mais baixo — por
// isso a asserção é sobre `rompido`, que olha o fechamento mais recente.
var cConfirm = serieComFundo({});
cConfirm[26] = { open: 96, high: 97, low: 93, close: 96.5, volume: 5000 };
cConfirm[27] = { open: 96.5, high: 101, low: 96, close: 100, volume: 5000 };
var rConfirm = core22.rompimento(cConfirm, PIVO_FUNDO, NIVEL_FUNDO);
check('Furo dentro da janela de confirmacao e ignorado', rConfirm.rompido, false);

titulo('TESTE 5 — Core22 exporta swingLow na raiz do resultado');

var amostra = core22.analisar(gerarSerie(0.004, 0.013, 50), { ticker: 'REGR' });
check('Resultado tem campo swingLow',
  Object.prototype.hasOwnProperty.call(amostra.resultado, 'swingLow'), true);
check('swingLow e finito e > 0', amostra.resultado.swingLow > 0, true);
check('swingLow == estrutura.swingLow (mesmo valor)',
  Math.abs(amostra.resultado.swingLow - amostra.estrutura.swingLow) < 0.01, true);

// Campos pre-existentes continuam intactos
['topo50', 'ganhoRapidoPct', 'distTopoPct', 'forcaRelativa', 'fiboPrice', 'pivot']
  .forEach(function (campo) {
    check('Campo "' + campo + '" preservado',
      Object.prototype.hasOwnProperty.call(amostra.resultado, campo), true);
  });

// 'Pivot' NAO deve ser confundido com o suporte (sao coisas diferentes)
check('Pivot (H+L+C)/3 != Suporte (swingLow)',
  Math.abs(amostra.resultado.pivot - amostra.resultado.swingLow) > 0.001, true);

// =============================================================================
// TESTE 6 — ASSIMETRIA DOCUMENTADA ENTRE AS JANELAS
// =============================================================================
// A zona usa structureLookback (60) e o pivo usa swingLookback (25). Isso e
// INTENCIONAL e documentado em _classificarSuporteVsZona, mas e uma armadilha
// real: em tendencia de baixa o pivo recente fica acima do fundo de 60 sessoes
// e o rotulo degenera em ABAIXO. Este teste TRAVA o comportamento para que
// ninguem trate o fenomeno como bug e "conserte" a janela sem entender.
titulo('TESTE 6 — Assimetria de janelas (structureLookback vs swingLookback)');

var cfg22 = core22.obterConfig();
check('CORE22 usa estrutura de 60 sessoes',
  cfg22.structureLookback, 60);
check('CORE22 usa swing de 25 sessoes',
  cfg22.swingLookback, 25);
check('As duas janelas SAO diferentes (por design)',
  cfg22.structureLookback !== cfg22.swingLookback, true);

// Em queda forte, o pivo recente quase nunca fica ACIMA da zona Fibo: ele fica
// ABAIXO, porque a zona repousa sobre o minimo de 60 sessoes. Validamos a
// direcao do fenomeno numa serie de queda deterministica.
var serieQueda = gerarSerie(-0.008, 0.014, 60);
var resQueda = core22.analisar(serieQueda, { ticker: 'QUEDA' });
if (resQueda.estrutura && resQueda.estrutura.zonaPiso > 0 && resQueda.resultado.swingLow > 0) {
  var zQ = proc._derivarZonaCompra(resQueda.resultado.fiboPrice,
    resQueda.indicadores.atr, resQueda.estrutura.h50);
  var cQ = proc._classificarSuporteVsZona(resQueda.resultado.swingLow, zQ, true);
  check('Em queda forte o veredito NAO e CONFIRMA',
    cQ.classe !== 'CONFIRMA', true);
  console.log('     (observado: ' + cQ.classe + ' — pivo ' + resQueda.resultado.swingLow +
    ' / zona ' + zQ.piso.toFixed(2) + '..' + zQ.teto.toFixed(2) + ')');
} else {
  console.log('  ℹ️  serie de queda sem Fibo/pivo — assercao de direcao pulada');
}

// =============================================================================
// RESUMO
// =============================================================================
console.log('\n' + '='.repeat(76));
if (falhou === 0) {
  console.log('✅ SUCESSO: ' + passou + '/' + (passou + falhou) + ' assertions passaram.');
} else {
  console.log('❌ FALHA: ' + falhou + ' de ' + (passou + falhou) + ' assertions falharam.');
  falhasDetalhe.forEach(function (d) { console.log('   • ' + d); });
}
console.log('='.repeat(76) + '\n');

process.exit(falhou === 0 ? 0 : 1);
