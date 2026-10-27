/**
 * HARNESS OFFLINE — v15.2 (Opção C)
 * -----------------------------------------------------------------------------
 * Valida a coluna "Entrada Sugerida (Fibo/Cotação)" + as colunas novas
 * "Gatilho Fibo" e "Dist. Gatilho %" na aba Oportunidades.
 *
 * CONTEXTO DO BUG:
 *   A usuária observou que em 13/13 linhas "Preço Atual" era IDÊNTICO a
 *   "Entrada Sugerida". Causa: `_montarLinhasFinais` só usa o Fibo como entrada
 *   quando `setupPullback` (nome do setup contém TENDÊNCIA/PULLBACK) E o preço
 *   está na banda de ±3% do Fibo. Fora disso `entrada = preco` — o que é o
 *   estado NORMAL, pois o Fibo 61,8% fica longe por construção.
 *
 * O QUE ESTE TESTE GARANTE:
 *   1. Os 3 headers (Processor, Setup, e os do Ranker) estão alinhados.
 *   2. As colunas novas ficam no FIM (índices 19/20) — sem deslocar o Ranker.
 *   3. `entrada` é a cotação quando fora da banda, e o Fibo quando dentro.
 *   4. O bugfix da comparação estrita de floats (EPS_ENTRADA) está aplicado.
 *   5. `Dist. Gatilho %` tem sinal correto (+ acima / – abaixo) e é vazio
 *      quando não há Fibo.
 *
 * Executa o código REAL de 29_Oportunidades_Processor.js em sandbox `vm`.
 */

var vm = require('vm');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var falhas = [];
var ok = [];

function checar(cond, msg, detalhe) {
  if (cond) { ok.push(msg); }
  else { falhas.push(msg + (detalhe ? ' → ' + detalhe : '')); }
}

function ler(rel) {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf8');
}

var srcProcessor = ler('29_Oportunidades_Processor.js');
var srcSetup = ler('00_Setup_CreateSheets.js');
var srcRanker = ler('41_Ranker.js');

// =============================================================================
// 1) ALINHAMENTO DE CABEÇALHOS
// =============================================================================
console.log('--- 1. Alinhamento de cabeçalhos ---');

function extrairHeaders(src, marcador) {
  var i = src.indexOf(marcador);
  if (i < 0) return null;
  var j = src.indexOf(']', i);
  var seg = src.slice(i, j);
  // Remove comentários de linha para não capturar strings em comentários
  seg = seg.replace(/\/\/[^\n]*/g, '');
  return (seg.match(/'[^']*'/g) || []).map(function (s) {
    return s.slice(1, -1);
  });
}

var hProcessor = extrairHeaders(srcProcessor, 'HEADERS_DESTINO: [');
checar(!!hProcessor, 'HEADERS_DESTINO localizado no Processor');
checar(hProcessor && hProcessor.length === 22,
  'Processor declara 22 colunas (19 + 3 de transparencia)',
  hProcessor ? 'encontrado ' + hProcessor.length : 'n/a');

var hSetup = extrairHeaders(srcSetup, 'function setupOportunidades(ss, opts)');
checar(!!hSetup, 'setupOportunidades localizado em 00_Setup_CreateSheets');
if (hSetup && hProcessor) {
  // O primeiro item capturado em setupOportunidades é o nome da aba.
  var hSetupSheet = hSetup.filter(function (h) { return h !== 'Oportunidades'; });
  checar(hSetupSheet.length === hProcessor.length,
    'Setup e Processor declaram a MESMA quantidade de colunas',
    'setup=' + hSetupSheet.length + ' | processor=' + hProcessor.length);
  var divergentes = [];
  for (var k = 0; k < Math.min(hSetupSheet.length, hProcessor.length); k++) {
    if (hSetupSheet[k] !== hProcessor[k]) {
      divergentes.push('campo ' + k + ': setup="' + hSetupSheet[k] +
        '" vs processor="' + hProcessor[k] + '"');
    }
  }
  checar(divergentes.length === 0,
    'Colunas do Setup batem com o Processor, uma a uma',
    divergentes.join(' ; '));
}

if (hProcessor) {
  checar(hProcessor[16] === 'Força Rel. %',
    'índice 16 continua "Força Rel. %" (Ranker FORCA_RELATIVA)', hProcessor[16]);
  checar(hProcessor[17] === 'Alvo % (Entrada)',
    'índice 17 continua "Alvo % (Entrada)"', hProcessor[17]);
  checar(hProcessor[18] === 'Alvo % (Cotação)',
    'índice 18 continua "Alvo % (Cotação)"', hProcessor[18]);
  checar(hProcessor[19] === 'Gatilho Fibo',
    'índice 19 = "Gatilho Fibo" (novo, no FIM)', hProcessor[19]);
  checar(hProcessor[20] === 'Dist. Gatilho %',
    'índice 20 = "Dist. Gatilho %" (novo, no FIM)', hProcessor[20]);
}

// O Ranker trava em 19 colunas: as novas NÃO podem cair dentro do intervalo
// que ele lê, senão COL.* apontaria para outra coisa.
var mRanker = srcRanker.match(/var nCols = Math\.max\((\d+),\s*Math\.min\((\d+)/);
checar(!!mRanker, '41_Ranker delimita nCols (leitura por índice fixo)');
if (mRanker) {
  var maxRanker = Number(mRanker[2]);
  checar(maxRanker === 19,
    'Ranker lê no máximo 19 colunas — novas em 19/20 ficam fora',
    'max=' + maxRanker);
}

// =============================================================================
// 2) SANDBOX COM O PROCESSADOR REAL
// =============================================================================
console.log('\n--- 2. Montagem da linha (código real em sandbox vm) ---');

function criarSandbox() {
  function _noop() {}
  var sandbox = {
    console: { log: _noop, warn: _noop, error: _noop },
    Logger: { log: _noop },
    SpreadsheetApp: {
      getActive: function () { return null; },
      getActiveSpreadsheet: function () {
        return { getSheetByName: function () { return null; } };
      }
    },
    PropertiesService: {
      getScriptProperties: function () {
        return { getProperty: function () { return null; } };
      }
    },
    Utilities: { formatDate: function () { return ''; } },
    CacheService: {
      getScriptCache: function () {
        return { get: function () { return null; }, put: _noop, remove: _noop };
      }
    },
    Date: Date, Math: Math, Number: Number, String: String,
    Array: Array, Object: Object, JSON: JSON, Map: Map, Set: Set,
    isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt
  };
  sandbox.global = sandbox;
  vm.createContext(sandbox);

  // Carrega a geometria REAL (28_Position_Geometry.js) no MESMO contexto, como
  // no GAS onde tudo compartilha o escopo global. Sem isso o Processor quebra em
  // PositionGeometry.textoObservacao() (linha ~635).
  vm.runInContext(
    fs.readFileSync(path.resolve(ROOT, '28_Position_Geometry.js'), 'utf8'),
    sandbox, { filename: '28_Position_Geometry.js' }
  );
  vm.runInContext(srcProcessor, sandbox, { filename: '29_Oportunidades_Processor.js' });
  return sandbox;
}

var sandbox = criarSandbox();
var Processor = sandbox.OportunidadesProcessor || sandbox.Oportunidades;
checar(!!Processor, 'OportunidadesProcessor exposto pelo sandbox');
checar(typeof sandbox.PositionGeometry !== 'undefined' &&
  typeof sandbox.PositionGeometry.textoObservacao === 'function',
  'PositionGeometry real carregado (textoObservacao disponível)');

/**
 * Monta uma linha de saída a partir de um cenário sintético.
 * `mapa` é um Map<number, Array>, como o Processor espera.
 */
function montarLinha(cenario) {
  // Índices espelhando OportunidadesProcessor.CONFIG.IDX_ORIGEM (linhas 47-77).
  var IDX = {
    TICKER: 1, PRECO: 2, SCORE: 3, SETUP: 4, MOTIVO: 5,
    STOP: 6, ALVO1: 7, ALVO2: 8, RR: 9, RISCO: 10,
    FIBO: 18, TIPO_SETUP: 21, ALERTA: 22, FORCA_RELATIVA: 26
  };
  var row = [];
  row[IDX.TICKER] = cenario.ticker || 'TEST3';
  row[IDX.PRECO] = cenario.preco;
  row[IDX.SCORE] = cenario.score !== undefined ? cenario.score : 80;
  row[IDX.SETUP] = cenario.setup;
  row[IDX.MOTIVO] = '-';
  row[IDX.STOP] = cenario.stop;
  row[IDX.ALVO1] = cenario.alvo1;
  row[IDX.ALVO2] = cenario.alvo2;
  row[IDX.RR] = cenario.rr !== undefined ? cenario.rr : 2.5;
  row[IDX.RISCO] = cenario.risco !== undefined ? cenario.risco : 3.0;
  row[IDX.FIBO] = cenario.fibo;
  row[IDX.TIPO_SETUP] = cenario.setup;
  row[IDX.ALERTA] = '-';
  row[IDX.FORCA_RELATIVA] = 0;

  var mapa = new Map();
  mapa.set(1, row);
  var out = Processor._montarLinhasFinais(mapa);
  return out.length ? out[0] : null;
}

// =============================================================================
// 3) CENÁRIO A: preço FORA da banda → entrada = cotação, gatilho informado
// =============================================================================
var casoFora = {
  ticker: 'FORA3',
  preco: 53.50,
  fibo: 50.30,
  stop: 48.00,
  alvo1: 62.00,
  alvo2: 68.00,
  setup: '📈 TENDÊNCIA CONFIRMADA',
  score: 82
};
var linhaFora = montarLinha(casoFora);
checar(!!linhaFora, 'linha gerada no cenário "preço acima do gatilho"');

if (linhaFora) {
  checar(linhaFora.length === 22,
    'linha tem 22 campos (19 + 3 de transparencia)', 'tem ' + linhaFora.length);

  checar(linhaFora[3] === casoFora.preco,
    'entrada = COTAÇÃO quando preço está 6,36% acima do gatilho',
    'entrada=' + linhaFora[3]);

  checar(linhaFora[19] === casoFora.fibo,
    'coluna 19 "Gatilho Fibo" traz o nível 61,8%', 'valor=' + linhaFora[19]);

  var distEsperada = ((casoFora.preco - casoFora.fibo) / casoFora.fibo) * 100;
  checar(typeof linhaFora[20] === 'number' &&
    Math.abs(linhaFora[20] - distEsperada) < 1e-9,
    'coluna 20 "Dist. Gatilho %" = +6,36%',
    'valor=' + linhaFora[20] + ' esperado=' + distEsperada);

  checar(linhaFora[20] > 0,
    'sinal POSITIVO quando preço está acima do gatilho');

  checar(String(linhaFora[15]).indexOf('Entrada = cotação') >= 0,
    'Observações explicam que a entrada é a cotação',
    String(linhaFora[15]).slice(0, 110));
}

// =============================================================================
// 4) CENÁRIO B: preço NA banda do Fibo → entrada = Fibo
// =============================================================================
var linhaBanda = montarLinha({
  ticker: 'BANDA3',
  preco: 50.30,
  fibo: 50.30,
  stop: 47.50,
  alvo1: 58.00,
  alvo2: 63.00,
  setup: '📉 SWING PULLBACK FIBO',
  score: 78
});
checar(!!linhaBanda, 'linha gerada no cenário "preço no gatilho"');

if (linhaBanda) {
  checar(Math.abs(linhaBanda[3] - 50.30) < 1e-9,
    'entrada = FIBO quando preço está NA banda', 'entrada=' + linhaBanda[3]);

  checar(Math.abs(linhaBanda[20]) < 1e-9,
    'Dist. Gatilho % ≈ 0 quando preço já está no gatilho',
    'valor=' + linhaBanda[20]);

  checar(String(linhaBanda[15]).indexOf('Entrada = gatilho Fibo') >= 0,
    'Observações confirmam "Entrada = gatilho Fibo"',
    String(linhaBanda[15]).slice(0, 110));
}

// =============================================================================
// 5) CENÁRIO C: preço ABAIXO do gatilho → distância NEGATIVA
// =============================================================================
var linhaAbaixo = montarLinha({
  ticker: 'ABAIX3',
  preco: 47.00,
  fibo: 50.30,
  stop: 44.00,
  alvo1: 56.00,
  alvo2: 60.00,
  setup: '📉 SWING PULLBACK FIBO',
  score: 70
});
if (linhaAbaixo) {
  checar(linhaAbaixo[20] < 0,
    'sinal NEGATIVO quando preço está abaixo do gatilho',
    'dist=' + linhaAbaixo[20]);
  checar(linhaAbaixo[3] === 47.00,
    'entrada = COTAÇÃO quando preço caiu além da banda',
    'entrada=' + linhaAbaixo[3]);
}

// =============================================================================
// 6) CENÁRIO D: sem Fibo válido → colunas novas vazias (não "undefined")
// =============================================================================
var linhaSemFibo = montarLinha({
  ticker: 'SEMFIBO3',
  preco: 30.00,
  fibo: 0,
  stop: 28.00,
  alvo1: 36.00,
  alvo2: 40.00,
  setup: '⏸️ AGUARDAR MELHOR SETUP',
  score: 60
});
if (linhaSemFibo) {
  checar(linhaSemFibo[19] === '',
    'Gatilho Fibo vazio quando o ativo não tem Fibo',
    'valor=' + JSON.stringify(linhaSemFibo[19]));
  checar(linhaSemFibo[20] === '',
    'Dist. Gatilho % vazio quando o ativo não tem Fibo',
    'valor=' + JSON.stringify(linhaSemFibo[20]));
}

// =============================================================================
// 7) BUGFIX: comparação estrita de floats
// =============================================================================
console.log('\n--- 3. Bugfix da comparação estrita (entrada !== preco) ---');

// Remove comentários de linha antes de checar o CÓDIGO (a string aparece no
// comentário explicativo do bugfix, mas não deve mais existir em código ativo).
var srcSemComentarios = srcProcessor
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map(function (linha) { return linha.replace(/(^|\s)\/\/.*$/, '$1'); })
  .join('\n');

checar(srcSemComentarios.indexOf('entrada !== preco') < 0,
  'a comparação frágil `entrada !== preco` não existe mais em código ativo');

checar(/const EPS_ENTRADA = 0\.005/.test(srcSemComentarios),
  'EPS_ENTRADA definido em 0.005 (meio centavo)');

checar(/Math\.abs\(entrada - preco\) > EPS_ENTRADA/.test(srcSemComentarios),
  'comparação por diferença absoluta com tolerância');

var a = 0.1 + 0.2;
var b = 0.3;
checar(a !== b, 'demonstração: 0.1+0.2 !== 0.3 em float (o bug era real)');
checar(Math.abs(a - b) <= 0.005,
  'com EPS de 0.005 a mesma dupla é considerada IGUAL (bugfix efetivo)');

// =============================================================================
// 8) RELATÓRIO
// =============================================================================
console.log('\n--- 4. Resultado ---');
ok.forEach(function (m) { console.log('  ✅ ' + m); });
if (falhas.length) {
  console.log('');
  falhas.forEach(function (m) { console.log('  ❌ ' + m); });
  console.log('\n❌ FALHOU: ' + falhas.length + ' asserção(ões) | ' +
    ok.length + ' passaram.');
  process.exit(1);
}

console.log('\n✅ PASSOU: ' + ok.length + '/' + ok.length +
  ' asserções — colunas "Gatilho Fibo"/"Dist. Gatilho %" e bugfix EPS validados.');
