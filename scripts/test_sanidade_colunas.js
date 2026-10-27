/**
 * @file scripts/test_sanidade_colunas.js
 * @description Harness offline da varredura de sanidade entre colunas
 * (scripts/sanidade_colunas.js). Sem planilha, sem GAS: usa o dataset demo,
 * que reproduz o caso ITUB4 real (25/10/2026) e variações controladas.
 *
 * O que se garante aqui:
 *  1. Cada regra dispara EXATAMENTE nas linhas onde deveria (nem mais, nem menos);
 *  2. A linha coerente (LIMPA) não gera nenhum ERRO — evita alarme falso;
 *  3. A normalização pt-BR não tropeça em "R$ 48,30", "2,73%", "28.073.700,00";
 *  4. A detecção de ATR constante é GLOBAL (2 entre 6 linhas já é sinal);
 *  5. Sábado/domingo no último candle é tratado como série sintética;
 *  6. O layout do script é coerente com OutputConfig (08_Output_Unified).
 *
 * @see scripts/sanidade_colunas.js
 * @see 08_Output_Unified.js
 */

var fs = require('fs');
var path = require('path');
var sanit = require('./sanidade_colunas');

var COL = sanit.COL;
var falhas = [];

/**
 * Asserção simples, no padrão dos demais harnesses.
 * @param {string} nome
 * @param {*} obtido
 * @param {*} esperado
 */
function check(nome, obtido, esperado) {
  var ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) {
    console.log('  ❌ ' + nome + '  (obtido: ' + JSON.stringify(obtido) +
      ', esperado: ' + JSON.stringify(esperado) + ')');
    falhas.push(nome);
  } else {
    console.log('  ✅ ' + nome);
  }
}

var linhas = sanit.datasetDemo();
var res = sanit.varrer(linhas);

// ---------------------------------------------------------------------------
console.log('\n[1] Dataset e layout');
check('Dataset demo tem 6 linhas', linhas.length, 6);
check('Todas as linhas têm 31 colunas',
  linhas.every(function (l) { return l.length === sanit.NUM_COLS; }), true);

var src08 = fs.readFileSync(path.resolve(__dirname, '..', '08_Output_Unified.js'), 'utf8');
check('08_Output_Unified declara NUM_COLS: 31', /NUM_COLS:\s*31/.test(src08), true);
check('NUM_COLS do script é igual ao do módulo', sanit.NUM_COLS,
  Number((src08.match(/NUM_COLS:\s*(\d+)/) || [])[1]));

// ---------------------------------------------------------------------------
console.log('\n[2] Normalização pt-BR');
check('Preço "R$ 48,30"', sanit.numCampo('R$ 48,30', COL.PRECO), 48.3);
check('Preço com milhar "R$ 1.234,50"', sanit.numCampo('R$ 1.234,50', COL.PRECO), 1234.5);
check('Percentual "2,73%"', sanit.numCampo('2,73%', COL.RISCO), 2.73);
check('Volume "28.073.700,00" (ponto = milhar)',
  sanit.numCampo('28.073.700,00', COL.VOLUME), 28073700);
check('Volume relativo "1.552,00" => 1552 (não 1,552)',
  sanit.numCampo('1.552,00', COL.VOL_ROMP), 1552);
check('Number puro passa intacto', sanit.numCampo(48.3, COL.PRECO), 48.3);
check('Vazio => null', sanit.numCampo('', COL.PRECO), null);
check('Data "25/10/2026" => domingo', sanit.paraData('25/10/2026').getDay(), 0);
check('Data "24/10/2026" => sábado', sanit.paraData('24/10/2026').getDay(), 6);
check('Data "23/10/2026" => sexta-feira', sanit.paraData('23/10/2026').getDay(), 5);

// ---------------------------------------------------------------------------
console.log('\n[3] Detecção global de ATR constante');
check('2/6 linhas com ATR = 1 => atrConstante = true', res.atrConstante, true);
check('Amostra de ATR registrada', res.atrAmostra, { valores: 6, iguaisA1: 2 });

var semAtr1 = sanit.varrer([
  sanit.datasetDemo()[5],   // LIMPA: ATR 0,60 sobre 48,30 = 1,24%
  sanit.datasetDemo()[3]    // RRSOLTO: ATR 0,45 sobre 20,00 = 2,25%
]);
check('Sem ATR=1 no conjunto, atrConstante = false', semAtr1.atrConstante, false);

// Uma ÚNICA linha com ATR = 1: não há padrão global para provar fallback, mas
// ATR exatamente 1 não sai de _core_getATR (toFixed(4)) — deve gerar ALERTA,
// nunca silêncio. Sem isso, um relatório de 1 linha esconderia o problema.
var soItub = sanit.varrer([linhas[0]]);
check('Linha única com ATR=1 gera ALERTA de ATR',
  soItub.detalhes.some(function (d) {
    return d.codigo === 'E-ATR-SUSPEITO' || d.codigo === 'E-ATR-CONSTANTE' ||
      d.codigo === 'E-ATR-FALLBACK';
  }), true);

// ---------------------------------------------------------------------------
console.log('\n[4] Cada regra dispara onde deve');
function tem(ticker, codigo) {
  return res.detalhes.some(function (d) {
    return d.ticker === ticker && d.codigo === codigo;
  });
}
check('ITUB4: E-ATR-CONSTANTE', tem('ITUB4', 'E-ATR-CONSTANTE'), true);
check('ITUB4: E-SCORE-SAT (Score 100)', tem('ITUB4', 'E-SCORE-SAT'), true);
check('ITUB4: E-RR-ABAIXO-MIN (1,93 < 2,0)', tem('ITUB4', 'E-RR-ABAIXO-MIN'), true);
check('ITUB4: E-SERIE-SINTETICA (domingo)', tem('ITUB4', 'E-SERIE-SINTETICA'), true);
check('ITUB4: W-SUPORTE-VS-ZONA (pivô 47,71 > zona)', tem('ITUB4', 'W-SUPORTE-VS-ZONA'), true);
check('ITUB4: NÃO acusa E-RR-ARITMETICA (geometria bate)',
  tem('ITUB4', 'E-RR-ARITMETICA'), false);

check('VOL1522: E-VOL-3DIGITOS', tem('VOL1522', 'E-VOL-3DIGITOS'), true);
check('VOL1522: E-SERIE-SINTETICA (sábado)', tem('VOL1522', 'E-SERIE-SINTETICA'), true);
check('VOL1522: E-RR-ARITMETICA (2,13 exibido != 1,85)', tem('VOL1522', 'E-RR-ARITMETICA'), true);
check('VOL1522: geometria válida (sem E-GEOMETRIA)', tem('VOL1522', 'E-GEOMETRIA'), false);

check('ATRFIXO: E-ATR-CONSTANTE', tem('ATRFIXO', 'E-ATR-CONSTANTE'), true);
check('ATRFIXO: sem ERRO de R/R', tem('ATRFIXO', 'E-RR-ABAIXO-MIN'), false);

check('RRSOLTO: E-RR-ABAIXO-MIN', tem('RRSOLTO', 'E-RR-ABAIXO-MIN'), true);
check('RRSOLTO: sem E-ATR', tem('RRSOLTO', 'E-ATR-FALLBACK'), false);

check('GEOMETRIA: Stop >= Preço', tem('GEOMETRIA', 'E-GEOMETRIA'), true);
check('GEOMETRIA: DistTopo incoerente', tem('GEOMETRIA', 'E-DISTTOPO'), true);

// ---------------------------------------------------------------------------
console.log('\n[5] Linha coerente NÃO gera alarme falso');
var achadosLimpa = res.detalhes.filter(function (d) { return d.ticker === 'LIMPA'; });
check('LIMPA: nenhum achado (nem ERRO, nem ALERTA)', achadosLimpa.length, 0);

// ---------------------------------------------------------------------------
console.log('\n[6] Volume suspeito em escala');
/** Copia a linha LIMPA e injeta um volume relativo. */
function linhaComVolRel(valor) {
  var l = sanit.datasetDemo()[5].slice();
  l[COL.VOL_ROMP] = valor;
  return l;
}
function acusa(l, codigo) {
  return sanit.avaliarLinha(l, {}).some(function (a) { return a.codigo === codigo; });
}
check('Volume 250x => E-VOL-3DIGITOS', acusa(linhaComVolRel('250,00'), 'E-VOL-3DIGITOS'), true);
check('Volume 99x => sem alerta de volume',
  sanit.avaliarLinha(linhaComVolRel('99,00'), {}).some(function (a) {
    return a.codigo.indexOf('E-VOL') === 0;
  }), false);
check('Volume 200.000x => E-VOL-ABSURDO',
  acusa(linhaComVolRel('200.000,00'), 'E-VOL-ABSURDO'), true);
check('Volume relativo vazio => nenhum alerta de volume',
  sanit.avaliarLinha(linhaComVolRel(''), {}).some(function (a) {
    return a.codigo.indexOf('E-VOL') === 0;
  }), false);

// ---------------------------------------------------------------------------
console.log('\n[7] Contagem final');
var qtdErros = res.detalhes.filter(function (d) { return d.nivel === 'ERRO'; }).length;
var qtdAlertas = res.detalhes.filter(function (d) { return d.nivel === 'ALERTA'; }).length;
console.log('  ERROS: ' + qtdErros + ' | ALERTAS: ' + qtdAlertas +
  ' | linhas com ERRO: ' + res.linhasComErro + '/' + res.totalLinhas);
check('5 de 6 linhas com ERRO (só LIMPA passa)', res.linhasComErro, 5);
check('Todos os códigos no formato E-/W-',
  Object.keys(res.porCodigo).every(function (c) { return /^(E|W)-/.test(c); }), true);
check('Nenhum achado sem campo associado',
  res.detalhes.every(function (d) { return !!d.campo; }), true);

// ---------------------------------------------------------------------------
console.log('\n=== RESULTADO ===');
if (falhas.length === 0) {
  console.log('✅ TODAS AS VERIFICAÇÕES PASSARAM');
} else {
  console.log('❌ FALHAS:');
  falhas.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
