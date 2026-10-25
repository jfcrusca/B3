/**
 * =============================================================================
 * scripts/test_calculo_fiscal.js — HARNESS OFFLINE DE REGRESSÃO CONTÁBIL
 * =============================================================================
 * Valida, sem Google Apps Script, o motor de apuração do Arquivo 21:
 *   - parsing de 'Mês Referência' (8 formatos + serial do Sheets)
 *   - classificação de mercado (SWING | DT | FII | ETF)
 *   - isenção dos R$ 20k (SÓ ações, SÓ swing)
 *   - compensação de prejuízo entre meses
 *   - arraste do mínimo de R$ 10,00
 *   - segregação de IR-Fonte por mercado (não compensar DT contra Swing)
 *   - crédito de IR retido a maior
 *   - ETF sem isenção
 *
 * Padrão dos demais testes do projeto: extrai as funções REAIS por
 * balanceamento de chaves e as executa via `eval`/`Function`.
 *
 * Uso:  node scripts/test_calculo_fiscal.js
 * =============================================================================
 */

var fs = require('fs');
var path = require('path');

// Os módulos ficam na raiz do projeto; este arquivo em scripts/.
var RAIZ = path.join(__dirname, '..');
var src = fs.readFileSync(path.join(RAIZ, '21_Tax_Calculator.js'), 'utf8');

// ---------------------------------------------------------------------------
// Extrai uma função/método por balanceamento de chaves.
// Suporta tanto `function nome(` quanto métodos de classe `nome(...) {`.
// ---------------------------------------------------------------------------
function extrairFuncao(texto, nome) {
  var idx = texto.indexOf('function ' + nome + '(');
  if (idx === -1) {
    // Método de classe: '  _apurarImpostos(meses) {'
    var re = new RegExp('(^|\\n)\\s*' + nome + '\\s*\\([^)]*\\)\\s*\\{');
    var m = texto.match(re);
    if (!m) throw new Error('Função ' + nome + ' não encontrada');
    idx = m.index + (m[1] ? m[1].length : 0);
  }
  var i = texto.indexOf('{', idx);
  var depth = 0;
  var fim = -1;
  for (var j = i; j < texto.length; j++) {
    var c = texto[j];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { fim = j; break; }
    }
  }
  if (fim === -1) throw new Error('Não foi possível delimitar ' + nome);
  return texto.substring(idx, fim + 1);
}

// ---------------------------------------------------------------------------
// Carrega os pedaços REAIS do módulo 21
// ---------------------------------------------------------------------------
var consoleReal = console.log;
var warnReal = console.warn;
console.log = function () {};
console.warn = function () {};

// TAX_CONFIG real (converte 'const' em atribuição global para que as closures
// criadas via new Function/Function possam enxergá-lo).
var mConf = src.match(/const TAX_CONFIG = (\{[\s\S]*?\n\});/);
if (!mConf) throw new Error('TAX_CONFIG não encontrado no módulo 21');
var TAX_CONFIG = eval('(' + mConf[1] + ')');

// TAX_MERCADOS real
var mMerc = src.match(/const TAX_MERCADOS = (\[[^\]]*\]);/);
if (!mMerc) throw new Error('TAX_MERCADOS não encontrado no módulo 21');
var TAX_MERCADOS = eval('(' + mMerc[1] + ')');

// Funções puras reais
eval(extrairFuncao(src, 'taxNormalizarCabecalho'));
eval(extrairFuncao(src, 'taxParaNumero'));
eval(extrairFuncao(src, 'taxChaveMes'));
eval(extrairFuncao(src, 'taxClassificarMercado'));

// _apurarImpostos é um método de classe => extrai o corpo e reconstrói.
var corpoApurar = extrairFuncao(src, '_apurarImpostos');
var abreChave = corpoApurar.indexOf('{');
var corpoInterno = corpoApurar.substring(abreChave + 1, corpoApurar.lastIndexOf('}'));

var _fnApurar = new Function('meses', 'TAX_CONFIG', 'TAX_MERCADOS',
  corpoInterno);
var apurar = function (meses) { return _fnApurar(meses, TAX_CONFIG, TAX_MERCADOS); };

console.log = consoleReal;
console.warn = warnReal;

// ---------------------------------------------------------------------------
// Helpers de teste
// ---------------------------------------------------------------------------
var falhas = [];
var passou = 0;

function check(nome, real, esperado, tolerancia) {
  tolerancia = tolerancia === undefined ? 0.005 : tolerancia;
  var ok = (typeof real === 'number' && typeof esperado === 'number')
    ? Math.abs(real - esperado) <= tolerancia
    : real === esperado;

  if (ok) {
    passou++;
    console.log('  \u2705 ' + nome);
  } else {
    falhas.push(nome + ' \u2014 esperado ' + esperado + ', obtido ' + real);
    console.log('  \u274C ' + nome + ' \u2014 esperado ' + esperado + ', obtido ' + real);
  }
}

/** Cria um bucket mensal cru como o produzido por _lerEAgregar. */
function bucket(ano, mes, dados) {
  dados = dados || {};
  return Object.assign({
    chave: ano + '-' + String(mes).padStart(2, '0'),
    ano: ano,
    mes: mes,
    resSwing: 0, resDT: 0, resFII: 0, resETF: 0,
    vendasAcoes: 0, vendasFII: 0, vendasETF: 0,
    irFonteSwing: 0, irFonteDT: 0, irFonteFII: 0, irFonteETF: 0,
    irFonteTotal: 0, custosTotais: 0
  }, dados);
}

function titulo(t) {
  console.log('\n=============================================================');
  console.log(' ' + t);
  console.log('=============================================================');
}

// ---------------------------------------------------------------------------
titulo('TESTE 1 — Parsing de "Mês Referência" (taxChaveMes)');
// ---------------------------------------------------------------------------
check('Date nativo',           taxChaveMes(new Date(2020, 8, 15)), '2020-09');
check('"set./2020"',           taxChaveMes('set./2020'),           '2020-09');
check('"Set/2020"',            taxChaveMes('Set/2020'),            '2020-09');
check('"Setembro/2020"',       taxChaveMes('Setembro/2020'),       '2020-09');
check('"09/2020"',             taxChaveMes('09/2020'),             '2020-09');
check('"15/09/2020"',          taxChaveMes('15/09/2020'),          '2020-09');
check('"2020-09"',             taxChaveMes('2020-09'),             '2020-09');
check('"2020-09-15"',          taxChaveMes('2020-09-15'),          '2020-09');
check('"2020 Setembro"',       taxChaveMes('2020 Setembro'),       '2020-09');
check('"set/2020"',            taxChaveMes('set/2020'),            '2020-09');
check('Vazio => ""',           taxChaveMes(''),                    '');
check('Lixo => ""',            taxChaveMes('abacaxi'),             '');
check('"jan./2026"',           taxChaveMes('jan./2026'),           '2026-01');
check('"dez./2019"',           taxChaveMes('dez./2019'),           '2019-12');

// ---------------------------------------------------------------------------
titulo('TESTE 2 — Classificação de mercado (taxClassificarMercado)');
// ---------------------------------------------------------------------------
check('Acao + Swing Trade',    taxClassificarMercado('Ação', 'Swing Trade'), 'SWING');
check('Acao + Day Trade',      taxClassificarMercado('Ação', 'Day Trade'),   'DT');
check('Acao + "DAY"',          taxClassificarMercado('Ação', 'DAY'),         'DT');
check('FII + Swing Trade',     taxClassificarMercado('FII', 'Swing Trade'),  'FII');
check('FII tem precedencia',   taxClassificarMercado('FII', 'Day Trade'),    'FII');
check('ETF + Swing Trade',     taxClassificarMercado('ETF', 'Swing Trade'),  'ETF');
check('ETF Indice',            taxClassificarMercado('ETF Índice', ''),      'ETF');
check('Subscricao => SWING',   taxClassificarMercado('Subscrição', 'Swing'), 'SWING');
check('"DTC" NAO e DT',        taxClassificarMercado('Ação', 'DTC'),         'SWING');

// ---------------------------------------------------------------------------
titulo('TESTE 3 — Isencao dos R$ 20k (SO acoes, SO swing)');
// ---------------------------------------------------------------------------
var rA = apurar({ '2026-01': bucket(2026, 1, { resSwing: 5000, vendasAcoes: 19000 }) })[0];
check('Vendas 19.000 => isento',      rA.detalhe.SWING.isento, true);
check('Vendas 19.000 => imposto 0',   rA.detalhe.SWING.impostoBruto, 0);
check('Vendas 19.000 => status OK',   rA.statusDARF, 'OK');

var rB = apurar({ '2026-01': bucket(2026, 1, { resSwing: 5000, vendasAcoes: 21000 }) })[0];
check('Vendas 21.000 => NAO isento',  rB.detalhe.SWING.isento, false);
check('Vendas 21.000 => imposto 750', rB.detalhe.SWING.impostoBruto, 750);
check('Vendas 21.000 => DARF 750',    rB.valorDARF, 750);
check('Vendas 21.000 => A PAGAR',     rB.statusDARF, 'A PAGAR');

var rC = apurar({ '2026-01': bucket(2026, 1, { resFII: 5000, vendasFII: 1000 }) })[0];
check('FII sem isencao',              rC.detalhe.FII.isento, false);
check('FII 20% sobre 5000 = 1000',    rC.detalhe.FII.impostoBruto, 1000);

var rD = apurar({ '2026-01': bucket(2026, 1, { resETF: 4000, vendasETF: 500 }) })[0];
check('ETF sem isencao',              rD.detalhe.ETF.isento, false);
check('ETF 15% sobre 4000 = 600',     rD.detalhe.ETF.impostoBruto, 600);

// Fronteira exata de R$ 20.000: a lei isenta vendas ATE 20 mil (exclusive).
var rE = apurar({ '2026-01': bucket(2026, 1, { resSwing: 1000, vendasAcoes: 20000 }) })[0];
check('Vendas exatas 20.000 => tributado', rE.detalhe.SWING.isento, false);
check('Imposto sobre 1000 = 150',     rE.detalhe.SWING.impostoBruto, 150);

// ---------------------------------------------------------------------------
titulo('TESTE 4 — Compensacao de prejuizo entre meses');
// ---------------------------------------------------------------------------
var h4 = apurar({
  '2026-01': bucket(2026, 1, { resSwing: -2000, vendasAcoes: 30000 }),
  '2026-02': bucket(2026, 2, { resSwing: 5000,  vendasAcoes: 30000 })
});
check('Jan: prejuizo acumulado 2000',  h4[0].prejuSwingFinal, 2000);
check('Jan: sem DARF',                 h4[0].valorDARF, 0);
check('Fev: abateu 2000',              h4[1].detalhe.SWING.prejuizoAbatido, 2000);
check('Fev: base = 3000',              h4[1].detalhe.SWING.baseTributavel, 3000);
check('Fev: imposto = 450',            h4[1].detalhe.SWING.impostoBruto, 450);
check('Fev: prejuizo zerado',          h4[1].prejuSwingFinal, 0);

// Mes isento NAO consome o prejuizo acumulado
var h5 = apurar({
  '2026-01': bucket(2026, 1, { resSwing: -2000, vendasAcoes: 30000 }),
  '2026-02': bucket(2026, 2, { resSwing: 5000,  vendasAcoes: 15000 }),
  '2026-03': bucket(2026, 3, { resSwing: 5000,  vendasAcoes: 30000 })
});
check('Fev isento preserva prejuizo',  h5[1].prejuSwingFinal, 2000);
check('Fev isento => sem imposto',     h5[1].detalhe.SWING.impostoBruto, 0);
check('Mar abate o prejuizo de Jan',   h5[2].detalhe.SWING.prejuizoAbatido, 2000);
check('Mar base = 3000',               h5[2].detalhe.SWING.baseTributavel, 3000);

// Prejuizo maior que o lucro: consome parcialmente e sobra saldo
var h5b = apurar({
  '2026-01': bucket(2026, 1, { resSwing: -8000, vendasAcoes: 30000 }),
  '2026-02': bucket(2026, 2, { resSwing: 3000,  vendasAcoes: 30000 })
});
check('Fev abate apenas 3000',         h5b[1].detalhe.SWING.prejuizoAbatido, 3000);
check('Fev base zerada',               h5b[1].detalhe.SWING.baseTributavel, 0);
check('Fev sem imposto',               h5b[1].detalhe.SWING.impostoBruto, 0);
check('Fev sobram 5000 de prejuizo',   h5b[1].prejuSwingFinal, 5000);

// ---------------------------------------------------------------------------
titulo('TESTE 5 — Arraste do minimo de R$ 10,00');
// ---------------------------------------------------------------------------
// Jan: 40 * 15% = 6,00 (abaixo do minimo) => ACUMULAR
// Fev: ~33,34 * 15% = ~5,00 => total ~11,00 => A PAGAR
var h6 = apurar({
  '2026-01': bucket(2026, 1, { resSwing: 40, vendasAcoes: 30000 }),
  '2026-02': bucket(2026, 2, { resSwing: 33.34, vendasAcoes: 30000 })
});
check('Jan: imposto 6,00 => ACUMULAR', h6[0].statusDARF, 'ACUMULAR');
check('Jan: valor 6,00 nao pago',      h6[0].valorDARF, 6, 0.01);
check('Fev: arraste anterior 6,00',    h6[1].darfArrastadoAnterior, 6, 0.01);
check('Fev: soma >= 10 => A PAGAR',    h6[1].statusDARF, 'A PAGAR');
check('Fev: DARF ~11,00',              h6[1].valorDARF, 11, 0.02);

var h7 = apurar({ '2026-01': bucket(2026, 1, { resSwing: 66.6, vendasAcoes: 30000 }) });
check('Imposto 9,99 => ACUMULAR',      h7[0].statusDARF, 'ACUMULAR');
check('Imposto 9,99 NAO e pago',       h7[0].statusDARF !== 'A PAGAR', true);

// Encadeamento de 3 meses abaixo do minimo
var h7b = apurar({
  '2026-01': bucket(2026, 1, { resSwing: 40, vendasAcoes: 30000 }),  // 6,00
  '2026-02': bucket(2026, 2, { resSwing: 20, vendasAcoes: 30000 }),  // 3,00 => 9,00
  '2026-03': bucket(2026, 3, { resSwing: 20, vendasAcoes: 30000 })   // 3,00 => 12,00
});
check('Jan/Mar: Jan acumula 6,00',     h7b[0].statusDARF, 'ACUMULAR');
check('Jan/Mar: Fev acumula 9,00',     h7b[1].statusDARF, 'ACUMULAR');
check('Jan/Mar: Fev valor 9,00',       h7b[1].valorDARF, 9, 0.01);
check('Jan/Mar: Mar paga 12,00',       h7b[2].statusDARF, 'A PAGAR');
check('Jan/Mar: Mar valor 12,00',      h7b[2].valorDARF, 12, 0.02);

// ---------------------------------------------------------------------------
titulo('TESTE 6 — Segregacao de IR-Fonte por mercado');
// ---------------------------------------------------------------------------
// IR-Fonte de DT (200) NAO pode abater imposto de Swing (750)
var h8 = apurar({
  '2026-01': bucket(2026, 1, {
    resSwing: 5000, vendasAcoes: 30000, irFonteSwing: 0,
    resDT: 0, irFonteDT: 200
  })
});
check('Swing deve 750 (DT nao abate)', h8[0].detalhe.SWING.impostoDevido, 750);
check('DT: IR retido vira credito',    h8[0].creditoDT, 200);
check('DT: IR-Fonte nao compensado',   h8[0].detalhe.DT.irFonteUsado, 0);
check('DARF total ainda 750',          h8[0].valorDARF, 750);

// IR-Fonte DO MESMO mercado abate corretamente
var h9 = apurar({
  '2026-01': bucket(2026, 1, {
    resSwing: 5000, vendasAcoes: 30000, irFonteSwing: 300
  })
});
check('Swing: IR-Fonte 300 compensado', h9[0].detalhe.SWING.irFonteUsado, 300);
check('Swing: imposto cai para 450',    h9[0].impostoDevidoMes, 450);
check('Swing: DARF = 450',              h9[0].valorDARF, 450);

// ---------------------------------------------------------------------------
titulo('TESTE 7 — Credito de IR retido a maior (antes era perdido)');
// ---------------------------------------------------------------------------
// Jan: swing ISENTO com IR-Fonte retido 100 => vira CREDITO
// Fev: swing lucro 5.000 tributado => abate os 100 de credito
var h10 = apurar({
  '2026-01': bucket(2026, 1, { resSwing: 5000, vendasAcoes: 15000, irFonteSwing: 100 }),
  '2026-02': bucket(2026, 2, { resSwing: 5000, vendasAcoes: 30000 })
});
check('Jan isento: credito gerado 100', h10[0].creditoIRGerado, 100);
check('Jan isento: credito acumulado',  h10[0].creditoSwing, 100);
check('Fev: credito usado 100',         h10[1].detalhe.SWING.creditoUsado, 100);
check('Fev: imposto cai para 650',      h10[1].impostoDevidoMes, 650, 0.01);
check('Fev: credito zerado',            h10[1].creditoSwing, 0, 0.01);

// ---------------------------------------------------------------------------
titulo('TESTE 8 — Cenario combinado (4 mercados no mesmo mes)');
// ---------------------------------------------------------------------------
var h11 = apurar({
  '2026-03': bucket(2026, 3, {
    resSwing: 10000, vendasAcoes: 50000,
    resDT: 3000, resFII: 2000, resETF: 1000
  })
});
check('Swing 15% = 1500',      h11[0].detalhe.SWING.impostoBruto, 1500);
check('DT 20% = 600',          h11[0].detalhe.DT.impostoBruto, 600);
check('FII 20% = 400',         h11[0].detalhe.FII.impostoBruto, 400);
check('ETF 15% = 150',         h11[0].detalhe.ETF.impostoBruto, 150);
check('Imposto total = 2650',  h11[0].impostoDevidoMes, 2650);
check('DARF = 2650',           h11[0].valorDARF, 2650);
check('Resultado total 16000',
  h11[0].resSwing + h11[0].resDT + h11[0].resFII + h11[0].resETF, 16000);

// ---------------------------------------------------------------------------
titulo('TESTE 9 — Fonte de verdade: Lucro/Prejuizo da planilha');
// ---------------------------------------------------------------------------
var h12 = apurar({
  '2026-01': bucket(2026, 1, { resSwing: 123.45, vendasAcoes: 25000, custosTotais: 999 })
});
check('Usa o L/P da fonte (123,45)',   h12[0].detalhe.SWING.resultado, 123.45);
check('Imposto 15% = 18,5175',         h12[0].detalhe.SWING.impostoBruto, 18.5175, 0.001);
check('Custos nao alteram o imposto',  h12[0].detalhe.SWING.baseTributavel, 123.45, 0.001);

// ---------------------------------------------------------------------------
console.log('\n=============================================================');
if (falhas.length) {
  console.log('\u274C FALHOU: ' + falhas.length + ' assercao(oes) incorreta(s) de ' +
    (passou + falhas.length) + '.');
  falhas.forEach(function (f) { console.log('   \u2022 ' + f); });
  process.exitCode = 1;
} else {
  console.log('\u2705 PASSOU: ' + passou + ' assercoes contabeis validadas.');
  console.log('   \u2022 Parsing de mes: 8 formatos + serial do Sheets + lixo.');
  console.log('   \u2022 Market split: SWING / DT / FII / ETF com aliquotas corretas.');
  console.log('   \u2022 Isencao dos R$ 20k aplicada SO a swing de ACOES.');
  console.log('   \u2022 Compensacao de prejuizo cronologica, preservada em mes isento.');
  console.log('   \u2022 Arraste do minimo de R$ 10,00 funcionando em cadeia.');
  console.log('   \u2022 IR-Fonte segregado por mercado (DT nao abate Swing).');
  console.log('   \u2022 Credito de IR retido a maior carregado entre meses.');
  console.log('   \u2022 Lucro/Prejuizo da FONTE e a base (nao recalculado de precos).');
}
console.log('=============================================================\n');
