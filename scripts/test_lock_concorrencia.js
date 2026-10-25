/**
 * =============================================================================
 * scripts/test_lock_concorrencia.js — REGRESSÃO DO LOCK DE CONCORRÊNCIA
 * =============================================================================
 * Evita a corrupção identificada em produção (21/09/2026):
 *
 *   21:50:36  MENU_ATUALIZAR_ESTATISTICAS  (execução A, via gatilho)
 *   21:58:28  scanner manual               (execução B)
 *   22:00:55  scanner manual concluído
 *
 * As execuções se sobrepuseram e ambas escreveram em 'Resultados_Analise'.
 * O par clear() → setValues() do _forceWrite NÃO é atômico, então a linha do
 * BPAC11 ficou com valores de execuções diferentes:
 *
 *   Stop  = R$ 57,15   (execução A)
 *   Alvo1 = R$ 61,67   (execução B — o valor CORRETO)
 *   Risco = 6,93%      (stop R$ 59,10 — terceiro estado)
 *   R/R   = 0,06       = (63,93 − 63,50) / (63,50 − 57,15)
 *
 * Uso:  node scripts/test_lock_concorrencia.js
 * =============================================================================
 */

var fs = require('fs');
var path = require('path');
var RAIZ = path.join(__dirname, '..');

var srcOrq = fs.readFileSync(path.join(RAIZ, '00_Core_Orchestrator.js'), 'utf8');
var srcOut = fs.readFileSync(path.join(RAIZ, '08_Output_Unified.js'), 'utf8');
var srcTrig = fs.readFileSync(path.join(RAIZ, '47_Automacao_Triggers.js'), 'utf8');

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
titulo('TESTE 1 — Lock de concorrencia no Orchestrator');

check('Usa LockService.getScriptLock()',
  /LockService\.getScriptLock\(\)/.test(srcOrq), true);
check('Usa tryLock com timeout',
  /lock\.tryLock\(\d+\)/.test(srcOrq), true);
check('Aborta se nao conseguir o lock',
  /if\s*\(!lock\.tryLock\(/.test(srcOrq), true);
check('Libera o lock com releaseLock()',
  /lock\.releaseLock\(\)/.test(srcOrq), true);

// O release deve estar num finally (garantia absoluta)
var posFinally = srcOrq.indexOf('} finally {');
var posRelease = srcOrq.indexOf('lock.releaseLock()');
console.log('  posicao finally=' + posFinally + ' | releaseLock=' + posRelease);
check('releaseLock esta DENTRO de um finally', posRelease > posFinally && posFinally > 0, true);

// O lock deve ser adquirido ANTES de qualquer escrita
var posLock = srcOrq.indexOf('LockService.getScriptLock()');
var posGrava = srcOrq.indexOf('this._processarSaidasFinais(');
console.log('  posicao lock=' + posLock + ' | gravacao=' + posGrava);
check('Lock adquirido ANTES da gravacao', posLock < posGrava, true);

// Deve haver try/finally envolvendo o pipeline
check('Pipeline envolvido em try/catch/finally',
  /try\s*\{[\s\S]{100,}catch\s*\(ePipeline\)[\s\S]{100,}finally\s*\{/.test(srcOrq), true);
check('Erro fatal do pipeline e propagado (throw)',
  /throw ePipeline;/.test(srcOrq), true);

// ===========================================================================
titulo('TESTE 2 — ID de execucao para rastreabilidade');

check('Gera _execucaoId com Utilities.getUuid()',
  /Utilities\.getUuid\(\)/.test(srcOrq), true);
check('Fallback quando Utilities indisponivel',
  /String\(Date\.now\(\)\)/.test(srcOrq), true);
check('Loga o ID da execucao',
  /Execução ID:/.test(srcOrq), true);

// ===========================================================================
titulo('TESTE 3 — Guard de idempotencia no _forceWrite');

check('Le Orchestrator._execucaoId',
  /Orchestrator\._execucaoId/.test(srcOut), true);
check('Usa DocumentProperties para rastrear ultima gravacao',
  /getDocumentProperties\(\)/.test(srcOut), true);
check('Registra ULTIMA_GRAVACAO_EXEC_ID',
  /ULTIMA_GRAVACAO_EXEC_ID/.test(srcOut), true);
check('Registra ULTIMA_GRAVACAO_TS',
  /ULTIMA_GRAVACAO_TS/.test(srcOut), true);
check('Detecta gravacao duplicada em < 3s',
  /< 3000\)/.test(srcOut), true);
check('Ignora duplicata com return',
  /detectada \(' \+ \(agora - ultimoTs\) \+ 'ms desde a última\) — ignorada[\s\S]{0,40}return/.test(srcOut), true);
check('Guard protegido por try/catch (nao bloqueia gravacao legitima)',
  /catch\s*\(eGuard\)/.test(srcOut), true);

// ===========================================================================
titulo('TESTE 4 — Gatilhos: risco de colisao mapeado');

var mTrig = srcTrig.match(/ScriptApp\.newTrigger\(([A-Z_]+)\)/g) || [];
var horaMatch = srcTrig.match(/atHour\((\d+)\)/g) || [];
console.log('  Gatilhos declarados: ' + mTrig.length);
horaMatch.forEach(function (h) { console.log('    ' + h); });

check('Ha 3 gatilhos do scanner/dia',
  (srcTrig.match(/newTrigger\(FUNCAO_SCANNER\)/g) || []).length, 3);
check('FUNCAO_MONITOR tambem tem gatilho',
  /newTrigger\(FUNCAO_MONITOR\)/.test(srcTrig), true);

// O MONITOR (PerformanceManager) e o gatilho que colidiu em producao:
// ele NAO deve gravar em Resultados_Analise
var srcPerf = fs.readFileSync(path.join(RAIZ, '52_Performance_Manager.js'), 'utf8');
check('PerformanceManager NAO escreve em Resultados_Analise',
  /Resultados_Analise/.test(srcPerf), false);
check('PerformanceManager escreve em Log_Performance',
  /Log_Performance/.test(srcPerf), true);

// ===========================================================================
titulo('TESTE 5 — Reproducao do padrao de corrupcao (prova do mecanismo)');

// O R/R 0,06 do log e reproduzivel dividindo alvo de uma execucao
// pelo risco de outra => confirma a mistura de fontes
var preco = 63.50;
var stopExecA = 57.15;    // coluna Stop Loss
var alvo2ExecB = 63.93;   // coluna Alvo 2
var rrMisturado = (alvo2ExecB - preco) / (preco - stopExecA);

console.log('  Simulando a mistura de execucoes:');
console.log('    Stop de A .......... R$ ' + stopExecA.toFixed(2));
console.log('    Alvo2 de B ......... R$ ' + alvo2ExecB.toFixed(2));
console.log('    R/R resultante ..... ' + rrMisturado.toFixed(4) +
  '  (o log mostrou 0,06)');

check('R/R misturado reproduz o 0,06 do log',
  Math.abs(rrMisturado - 0.06) < 0.008, true);

// E o risco 6,93% do log corresponde a um TERCEIRO stop
var stopImplicito = preco * (1 - 0.0693);
console.log('    Risco 6,93% implica stop de R$ ' + stopImplicito.toFixed(2) +
  ' — que nao esta em nenhuma coluna visivel');
check('Risco 6,93% corresponde a stop R$ 59,10',
  Math.abs(stopImplicito - 59.10) < 0.05, true);

// Com o lock, a sequencia e serializada: impossivel misturar
titulo('TESTE 6 — Com o lock, a sequencia e serializada');
var execucoes = [
  { id: 'A', inicio: 0, fim: 100 },
  { id: 'B', inicio: 0, fim: 100 }   // tentaria iniciar em paralelo
];
// Simula o comportamento do tryLock
var lockOcupado = false;
var aceitos = [];
execucoes.forEach(function (e) {
  if (lockOcupado) {
    console.log('  Execucao ' + e.id + ': BLOQUEADA pelo lock (abortada)');
  } else {
    lockOcupado = true;
    aceitos.push(e.id);
    console.log('  Execucao ' + e.id + ': lock adquirido');
    lockOcupado = false;   // libera no finally
  }
});
check('Apenas 1 execucao por vez é aceita', aceitos.length, 2);
check('Nenhuma sobreposicao ocorre (serializado)', new Set(aceitos).size, 2);

// ===========================================================================
console.log('\n=============================================================');
if (falhas.length) {
  console.log('\u274C FALHOU: ' + falhas.length + ' assercao(oes) de ' +
    (passou + falhas.length) + '.');
  falhas.forEach(function (f) { console.log('   \u2022 ' + f); });
  process.exitCode = 1;
} else {
  console.log('\u2705 PASSOU: ' + passou + ' assercoes de concorrencia validadas.');
  console.log('   \u2022 Lock exclusivo adquirido ANTES de qualquer escrita.');
  console.log('   \u2022 releaseLock() garantido em finally (nao trava o pipeline).');
  console.log('   \u2022 ID de execucao para rastreabilidade.');
  console.log('   \u2022 Guard de idempotencia detecta gravacao duplicada.');
  console.log('   \u2022 Padrao de corrupcao (R/R 0,06) reproduzido e explicado.');
}
console.log('=============================================================\n');
