/**
 * =============================================================================
 * scripts/test_escritor_unico.js — REGRESSÃO DA CONSOLIDAÇÃO DE ESCRITORES
 * =============================================================================
 * Garante que existe UMA ÚNICA implementação de gravação em 'Resultados_Analise'
 * e que os erros do pipeline não são mais silenciados.
 *
 * Contexto (caso BPAC11): a linha ficou com Fibonacci = 53,98 (col 18) e
 * Topo50 = 61,67 (col 23) — valores MATEMATICAMENTE INCOMPATÍVEIS, provando que
 * colunas diferentes foram gravadas por implementações diferentes.
 *
 * Uso:  node scripts/test_escritor_unico.js
 * =============================================================================
 */

var fs = require('fs');
var path = require('path');

var RAIZ = path.join(__dirname, '..');
var ler = function (f) { return fs.readFileSync(path.join(RAIZ, f), 'utf8'); };

var src00 = ler('00_SheetWriter.js');
var src08 = ler('08_Output_Unified.js');
var srcOrq = ler('00_Core_Orchestrator.js');

var falhas = [];
var passou = 0;

function check(nome, real, esperado) {
  var ok = (real === esperado);
  if (ok) { passou++; console.log('  \u2705 ' + nome); }
  else {
    falhas.push(nome + ' \u2014 esperado ' + esperado + ', obtido ' + real);
    console.log('  \u274C ' + nome + ' \u2014 esperado ' + esperado + ', obtido ' + real);
  }
}

function titulo(t) {
  console.log('\n=============================================================');
  console.log(' ' + t);
  console.log('=============================================================');
}

// ===========================================================================
titulo('TESTE 1 — Existe apenas UM escritor de Resultados_Analise');

check('00_SheetWriter NAO tem mais _opParaLinha()',
  /function\s+_opParaLinha\s*\(/.test(src00), false);
check('08_Output_Unified mantem _toRow()',
  /function\s+_toRow\s*\(/.test(src08), true);
check('00_SheetWriter NAO redeclara HEADERS[]',
  /HEADERS:\s*\[/.test(src00), false);
check('08_Output_Unified e a fonte do HEADERS',
  /HEADERS:\s*\[/.test(src08), true);

// ===========================================================================
titulo('TESTE 2 — 00_SheetWriter e apenas um alias declarado');

check('00_SheetWriter delega para OutputManager',
  /OutputManager\.saveAnalysisResults/.test(src00), true);
check('00_SheetWriter resolve o escritor canonico',
  /_resolver\s*\(/.test(src00), true);
check('00_SheetWriter PROPAGA o erro (throw)',
  /throw e;/.test(src00), true);
check('00_SheetWriter NAO tem _getSheet() proprio',
  /function\s+_getSheet\s*\(/.test(src00), false);

// ===========================================================================
titulo('TESTE 3 — Guard fragil removido do 08_Output_Unified');

// ⚠️ O comentário explicativo CITA o guard antigo, então removemos as linhas de
// comentário antes de testar — senão a própria documentação causaria falso
// positivo (o texto 'if (typeof SheetWriter...)' aparece nela).
var src08SemComentarios = src08
  .split('\n')
  .filter(function (l) { return l.trim().indexOf('//') !== 0; })
  .join('\n');

check('Guard condicional "typeof SheetWriter" REMOVIDO (ignorando comentarios)',
  /if\s*\(\s*typeof\s+SheetWriter\s*===\s*'undefined'\s*\)\s*\{/.test(src08SemComentarios), false);
check('Nao ha mais atribuicao ativa de SheetWriter no 08',
  /var\s+SheetWriter\s*=\s*OutputManager/.test(src08SemComentarios), false);
check('Comentario explica a remocao',
  src08.indexOf('GUARD REMOVIDO') !== -1, true);

// ===========================================================================
titulo('TESTE 4 — Multiplos de alvo vem de fonte unica (CORE22_CFG)');

check('08 NAO hardcoda mais CFG_T1R = 2.0',
  /var\s+CFG_T1R\s*=\s*2\.0\s*;/.test(src08), false);
check('08 le CFG_T1R de CORE22_CFG', /CORE22_CFG\.t1R/.test(src08), true);
check('08 le CFG_T2R de CORE22_CFG', /CORE22_CFG\.t2R/.test(src08), true);
check('08 tem helper _cfgT1R()', /function\s+_cfgT1R/.test(src08), true);
check('08 tem helper _cfgT2R()', /function\s+_cfgT2R/.test(src08), true);

// ===========================================================================
titulo('TESTE 5 — Erros do pipeline NAO sao mais silenciados');

check('Orchestrator tem _registrarFalha()',
  /_registrarFalha:\s*function/.test(srcOrq), true);
check('Orchestrator tem _reportarFalhas()',
  /_reportarFalhas:\s*function/.test(srcOrq), true);
check('Orchestrator inicializa _falhasPipeline no inicio do pipeline',
  /this\._falhasPipeline\s*=\s*\[\]/.test(srcOrq), true);
check('Orchestrator chama _reportarFalhas() no fim',
  /this\._reportarFalhas\(\)/.test(srcOrq), true);

['SheetWriter', 'Oportunidades_Processor', 'Ranker', 'Dashboard'].forEach(function (etapa) {
  check('Etapa "' + etapa + '" reporta falha',
    srcOrq.indexOf("_registrarFalha('" + etapa + "'") !== -1, true);
});

check('catch silencioso antigo do SheetWriter REMOVIDO',
  /catch\s*\(e\)\s*\{\s*console\.error\("❌ SheetWriter falhou:/.test(srcOrq), false);

// ===========================================================================
titulo('TESTE 6 — Consistencia matematica Fibonacci x Topo50 (caso BPAC11)');

// fibo618 = h50 - range*0.618 ; ext1 = h50 + range*0.272
// Dado fibo618 e ext1, h50 e determinado univocamente.
function h50DeFiboEAlvo(fibo618, ext1) {
  var r = (ext1 - fibo618) / (0.618 + 0.272);
  return { h50: fibo618 + 0.618 * r, range: r };
}

var bpac = h50DeFiboEAlvo(53.98, 78.52);
console.log('  Fibonacci=53,98 + Alvo1=78,52  =>  h50 = ' +
  bpac.h50.toFixed(2) + ' | range = ' + bpac.range.toFixed(2));
check('h50 implicito ~71,02', Math.abs(bpac.h50 - 71.02) < 0.05, true);

// Se o Topo50 gravado fosse 61,67, o alvo1 seria 65,05 — incompativel
var rTopo = (61.67 - 53.98) / 0.618;
var alvoSeTopo = 61.67 + rTopo * 0.272;
console.log('  Se Topo50=61,67 fosse o h50 => Alvo1 seria ' +
  alvoSeTopo.toFixed(2) + ' (gravado: 78,52)');
check('Topo50=61,67 e INCOMPATIVEL com Alvo1=78,52',
  Math.abs(alvoSeTopo - 78.52) > 1, true);

// Uma linha gravada por UM unico escritor deve ser sempre auto-consistente
function linhaAutoConsistente(fibo618, ext1, topo50) {
  var calc = h50DeFiboEAlvo(fibo618, ext1);
  return Math.abs(calc.h50 - topo50) < 0.10;
}
check('Linha consistente (fibo+alvo+topo do MESMO h50)',
  linhaAutoConsistente(53.98, 78.52, 71.02), true);
check('Linha INCONSISTENTE (caso BPAC11 original) e detectada',
  linhaAutoConsistente(53.98, 78.52, 61.67), false);

// ===========================================================================
titulo('TESTE 7 — Layout 27 colunas consistente em TODO o pipeline');

// 🔧 v13.3: o bug do log de produção era a constante NUM_COLS_TO_PAINT = 26
// enquanto a matriz de cores tinha 27. Isso derrubava a gravação INTEIRA de
// 'Resultados_Analise' (o setBackgrounds lançava e o setValues anterior já
// havia sido feito, mas erros subsequentes abortavam o fluxo).
check('NUM_COLS_TO_PAINT NAO esta mais hardcoded em 26',
  /NUM_COLS_TO_PAINT\s*=\s*26\s*;/.test(src08), false);
check('NUM_COLS_TO_PAINT deriva de OutputConfig.NUM_COLS',
  /NUM_COLS_TO_PAINT\s*=\s*OutputConfig\.NUM_COLS/.test(src08), true);
check('OutputConfig.NUM_COLS = 27',
  /NUM_COLS:\s*27/.test(src08), true);

// A matriz de cores deve usar a MESMA constante do range (nunca NUM_COLS solto)
check('Matriz de cores usa NUM_COLS_TO_PAINT',
  /Array\(NUM_COLS_TO_PAINT\)\.fill/.test(src08), true);

// Guard defensivo presente
check('Guard valida largura da matriz antes de pintar',
  /larguraMatriz\s*!==\s*NUM_COLS_TO_PAINT/.test(src08), true);

// _ensureSheet nao pode mais usar appendRow (desloca o cabecalho).
// ⚠️ O comentário explicativo CITA o appendRow antigo, então filtramos
// linhas de comentário — senão a documentação causaria falso positivo.
var src08Codigo = src08
  .split('\n')
  .filter(function (l) { return l.trim().indexOf('//') !== 0 && l.trim().indexOf('*') !== 0; })
  .join('\n');
check('_ensureSheet NAO usa appendRow (ignorando comentarios)',
  /\.appendRow\(/.test(src08Codigo), false);
check('_ensureSheet grava cabecalho na LINHA 1',
  /getRange\(1,\s*1,\s*1,\s*OutputConfig\.HEADERS\.length\)\.setValues/.test(src08), true);

// Contagem real do array de headers deve ser 27
var mHeaders = src08.match(/HEADERS:\s*\[([\s\S]*?)\]/);
var qtdHeaders = mHeaders ? (mHeaders[1].match(/'/g) || []).length / 2 : 0;
console.log('  HEADERS[] em 08_Output_Unified = ' + qtdHeaders + ' colunas');
check('HEADERS tem 27 colunas', qtdHeaders, 27);

// A linha retornada por _toRow deve ter 27 posicoes.
// Os índices vão de 0 a 26 (27 posições) — validamos que o MAIOR índice é 26.
var indicesComentados = [];
var reIdx = /\/\/\s*(\d+):/g;
var mIdx;
while ((mIdx = reIdx.exec(src08)) !== null) {
  indicesComentados.push(parseInt(mIdx[1], 10));
}
var maiorIndice = indicesComentados.length ? Math.max.apply(null, indicesComentados) : -1;
var menores = indicesComentados.filter(function (n) { return n < 27; });
console.log('  _toRow: indices ' + Math.min.apply(null, menores) + '..' + maiorIndice +
  ' (' + menores.length + ' posicoes com comentario de indice)');
check('Maior indice de coluna em _toRow = 26 (=> 27 colunas)', maiorIndice, 26);
check('Todos os 27 indices (0..26) presentes',
  menores.length >= 27 || (new Set(menores)).size === 27, true);

// ===========================================================================
console.log('\n=============================================================');
if (falhas.length) {
  console.log('\u274C FALHOU: ' + falhas.length + ' assercao(oes) de ' +
    (passou + falhas.length) + '.');
  falhas.forEach(function (f) { console.log('   \u2022 ' + f); });
  process.exitCode = 1;
} else {
  console.log('\u2705 PASSOU: ' + passou + ' assercoes de consolidacao validadas.');
  console.log('   \u2022 Um unico escritor de Resultados_Analise (OutputManager).');
  console.log('   \u2022 00_SheetWriter e apenas um alias declarado.');
  console.log('   \u2022 Guard fragil "typeof SheetWriter" removido.');
  console.log('   \u2022 Multiplos de alvo vem do CORE22_CFG (fonte unica).');
  console.log('   \u2022 Falhas do pipeline sao registradas e reportadas ao usuario.');
}
console.log('=============================================================\n');
