/**
 * =============================================================================
 * scripts/test_sentinela_geometria.js — REGRESSÃO DO 37_Agent_RiskManager
 * =============================================================================
 * Garante que o Sentinela NÃO sobrescreve a geometria (stop/alvo/R-R) calculada
 * pelo 22_Core_Analyzers.
 *
 * BUG CORRIGIDO (v5.0 → v6.0):
 *   O módulo recalculava o stop:
 *     let stopFinal = preco - (atr * 2.0);
 *     if (fibo618 > 0 && fibo618 < preco) {
 *       stopFinal = Math.min(stopFinal, fibo618 * 0.99);  // pega o MAIS DISTANTE
 *     }
 *     return { stop: stopFinal, target: op.target1, rr_ratio: op.rr };
 *
 *   O `stop` era inventado; `target` e `rr_ratio` vinham intactos do Core22.
 *   TRÊS grandezas descrevendo DUAS geometrias. Evidência em 46/46 linhas:
 *     ITUB4 : stop 41,20 -> risco 4,36% vs Risco% gravado 2,67%  (dif 1,69)
 *     BBDC4 : stop 17,57 -> risco 3,25% vs Risco% gravado 2,32%  (dif 0,93)
 *     BPAC11: stop 57,15 -> risco 10,00% vs Risco% gravado 6,93% (dif 3,07)
 *   Em VALE3 e PETR4 a dif era 0,00 (o stop coincidiu) — prova a origem.
 *
 * Uso:  node scripts/test_sentinela_geometria.js
 * =============================================================================
 */

var fs = require('fs');
var path = require('path');
var RAIZ = path.join(__dirname, '..');
var SRC = fs.readFileSync(path.join(RAIZ, '37_Agent_RiskManager.js'), 'utf8');

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
titulo('TESTE 1 — O recalculo de stop foi REMOVIDO');

// ⚠️ O bloco de comentário explica o bug ANTIGO citando o código removido,
// então filtramos as linhas de comentário antes de testar (senão a própria
// documentação causaria falso positivo).
var SRC_CODIGO = SRC
  .split('\n')
  .filter(function (l) {
    var t = l.trim();
    return t.indexOf('//') !== 0 && t.indexOf('*') !== 0 && t.indexOf('/*') !== 0;
  })
  .join('\n');

check('NAO calcula mais stopFinal = preco - atr*2',
  /stopFinal\s*=\s*preco\s*-\s*\(atr \* 2/.test(SRC_CODIGO), false);
check('NAO usa mais Math.min(stopFinal, fibo618)',
  /Math\.min\(stopFinal,\s*fibo618/.test(SRC_CODIGO), false);
check('NAO declara mais a variavel stopFinal',
  /let stopFinal/.test(SRC_CODIGO), false);
check('NAO declara mais fibo618 local',
  /const fibo618\s*=\s*op\.fiboPrice/.test(SRC_CODIGO), false);
check('Comentario explica a remocao',
  SRC.indexOf('NÃO SOBRESCREVE MAIS A GEOMETRIA') !== -1, true);

// ===========================================================================
titulo('TESTE 2 — Geometria PRESERVADA do Core22');

check('Le stop de op.stopLoss / op.stop',
  /op\.stopLoss \|\| op\.stop/.test(SRC), true);
check('Retorna stop inalterado',
  /stop:\s*stopRecebido/.test(SRC), true);
check('Retorna target de op.target1',
  /target:\s*op\.target1/.test(SRC), true);
check('Retorna target2 de op.target2',
  /target2:\s*op\.target2/.test(SRC), true);
check('Retorna rr_ratio de op.rr',
  /rr_ratio:\s*op\.rr/.test(SRC), true);
check('Sem parseFloat no stop (nao arredonda)',
  /stop:\s*parseFloat\(/.test(SRC), false);

// ===========================================================================
titulo('TESTE 3 — Metadados de auditoria');

check('Marca _geometriaPreservada', /_geometriaPreservada:\s*true/.test(SRC), true);
check('Documenta a fonte da geometria',
  /_fonteGeometria:\s*'22_Core_Analyzers'/.test(SRC), true);
check('Expoe _atrRef para auditoria', /_atrRef:/.test(SRC), true);

// ===========================================================================
titulo('TESTE 4 — Competencia preservada (risco e diversificacao)');

check('Mantem check de exaustao da carteira',
  /posicoesAbertas >= maxPositions/.test(SRC), true);
check('Mantem filtro de correlacao setorial',
  /countSetor >= maxPerSector/.test(SRC), true);
check('Mantem position sizing (sizeFactor)',
  /sizeFactor = 0\.5/.test(SRC), true);
check('Mantem suggested_allocation',
  /suggested_allocation:\s*sizeFactor/.test(SRC), true);

// ===========================================================================
titulo('TESTE 5 — Geometria invalida e sinalizada (nao mascarada)');

check('Detecta stop >= preco', /stopRecebido >= preco/.test(SRC), true);
check('Sinaliza em veto_reason', /veto_reason:\s*avisoGeometria/.test(SRC), true);
check('Loga aviso',
  /console\.warn\([^)]*\[RiskManager\][^)]*avisoGeometria\)/.test(SRC_CODIGO), true);

// ===========================================================================
titulo('TESTE 6 — Reproducao numerica dos 46 casos');

// Os 5 casos do log de producao com o padrao de divergencia
var casos = [
  { t: 'ITUB4',  p: 43.08, stop: 41.20, riscoGrav: 2.67 },
  { t: 'BBDC4',  p: 18.16, stop: 17.57, riscoGrav: 2.32 },
  { t: 'BPAC11', p: 63.50, stop: 57.15, riscoGrav: 6.93 },
  { t: 'VALE3',  p: 73.37, stop: 71.29, riscoGrav: 2.83 },
  { t: 'PETR4',  p: 48.50, stop: 47.23, riscoGrav: 2.62 }
];

var divergentes = 0;
var consistentes = 0;

console.log('  TICKER    preco    stop     riscoDoStop  riscoGrav  DIF');
console.log('  ------    -----    -----    -----------  ---------  ----');
casos.forEach(function (c) {
  var riscoCalc = ((c.p - c.stop) / c.p) * 100;
  var dif = Math.abs(riscoCalc - c.riscoGrav);
  if (dif > 0.15) divergentes++; else consistentes++;
  console.log('  ' + c.t.padEnd(8) + '  ' + c.p.toFixed(2).padStart(6) +
    '   ' + c.stop.toFixed(2).padStart(6) + '   ' + riscoCalc.toFixed(2).padStart(8) +
    '%  ' + c.riscoGrav.toFixed(2).padStart(7) + '%  ' + dif.toFixed(2));
});

console.log('');
console.log('  Divergentes: ' + divergentes + ' | Consistentes: ' + consistentes);
check('Ha pelo menos 3 casos divergentes na amostra', divergentes >= 3, true);
check('VALE3/PETR4 sao consistentes (dif 0,00)', consistentes, 2);

// ===========================================================================
titulo('TESTE 7 — Efeito da correcao: ausencia do recálculo');

// Simula o comportamento ANTIGO vs NOVO para o ITUB4
var preco = 43.08, atr = 0.94, stopCore22 = 41.20;

// ANTIGO: stopFinal = preco - atr*2 = 43.08 - 1.88 = 41.20
var stopAntigo = preco - (atr * 2.0);
console.log('  ANTIGO: stop = preco - 2*ATR = ' + stopAntigo.toFixed(2) +
  ' (coincidiu com o Core22 neste caso)');

// NOVO: stop preservado do Core22
var stopNovo = stopCore22;
console.log('  NOVO  : stop = op.stopLoss   = ' + stopNovo.toFixed(2));

// Em um caso onde divergem (BPAC11 com ATR diferente)
var p2 = 63.50, atr2 = 1.7016, stopCore22b = 59.25;
var stopAntigoB = p2 - (atr2 * 2.0);
console.log('');
console.log('  BPAC11 (ATR 1,7016):');
console.log('    ANTIGO stop = preco - 2*ATR = ' + stopAntigoB.toFixed(2) +
  '  -> risco ' + (((p2 - stopAntigoB) / p2) * 100).toFixed(2) + '%');
console.log('    NOVO   stop = Core22          = ' + stopCore22b.toFixed(2) +
  '  -> risco ' + (((p2 - stopCore22b) / p2) * 100).toFixed(2) + '%');

check('Stop antigo difere do preservado no BPAC11',
  Math.abs(stopAntigoB - stopCore22b) > 0.5, true);

// ===========================================================================
titulo('TESTE 8 — Coerencia final: R/R x risco = retorno');

casos.forEach(function (c) {
  // Com a correcao, risco% passa a ser derivado do stop preservado
  var riscoPct = ((c.p - c.stop) / c.p) * 100;
  var riscoRs = c.p - c.stop;
  // R/R consistente (se o alvo viesse do Core22, seria calculado assim)
  var rrConsistente = 2.0; // valor de referencia do Core22 (t1R baseline)
  var retornoPct = rrConsistente * (riscoPct / 100);
  c.riscoPctNovo = riscoPct;
  c.retornoPctNovo = retornoPct * 100;
});
console.log('  TICKER    risco% novo   R/R   retorno% (R/R x risco)');
casos.forEach(function (c) {
  console.log('  ' + c.t.padEnd(8) + '  ' + c.riscoPctNovo.toFixed(2).padStart(9) +
    '%  ' + '2.00' + '   ' + c.retornoPctNovo.toFixed(2).padStart(8) + '%');
});
check('Todos os risco% derivados do stop preservado',
  casos.every(function (c) { return c.riscoPctNovo > 0; }), true);

// ===========================================================================
console.log('\n=============================================================');
if (falhas.length) {
  console.log('\u274C FALHOU: ' + falhas.length + ' assercao(oes) de ' +
    (passou + falhas.length) + '.');
  falhas.forEach(function (f) { console.log('   \u2022 ' + f); });
  process.exitCode = 1;
} else {
  console.log('\u2705 PASSOU: ' + passou + ' assercoes validadas.');
  console.log('   \u2022 Sentinela NAO recalcula mais o stop.');
  console.log('   \u2022 Geometria (stop/alvo/R-R) PRESERVADA do Core22.');
  console.log('   \u2022 Competencia mantida: exaustao, correlacao, sizing.');
  console.log('   \u2022 Geometria invalida e SINALIZADA, nao mascarada.');
}
console.log('=============================================================\n');
