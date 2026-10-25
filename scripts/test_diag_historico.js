/**
 * Harness offline de REGRESSÃO — persistência do HISTÓRICO (série temporal)
 * na aba 'Diag_Oportunidade_Hist' (60_Diagnostico_OportunidadePerdida.js v1.1).
 *
 * Valida:
 *   (1) _cabecalhoHistorico() tem as colunas esperadas;
 *   (2) _garantirAbaHistorico() cria a aba + cabeçalho se não existir (idempotente);
 *   (3) _persistirHistorico() faz APPEND de 2 linhas (Connors + Donchian) SEM apagar;
 *   (4) o teto HIST_MAX_LINHAS trunca as linhas antigas.
 *
 * Usa mocks mínimos de SpreadsheetApp/Sheet (não é deploy GAS).
 */

var fs = require('fs');
var src = fs.readFileSync('60_Diagnostico_OportunidadePerdida.js', 'utf8');
src = src.replace(/function MENU_DIAGNOSTICO[\s\S]*$/, '');

// --- Mocks de planilha ---
function makeSheet(nome) {
  return {
    _nome: nome, _linhas: [], _headerBold: false,
    getName: function () { return this._nome; },
    getLastRow: function () { return this._linhas.length; },
    getMaxColumns: function () {
      var max = 0;
      for (var i = 0; i < this._linhas.length; i++) {
        if (this._linhas[i] && this._linhas[i].length > max) max = this._linhas[i].length;
      }
      return max;
    },
    getRange: function (r, c, nr, nc) {
      var self = this;
      var range = {
        setValues: function (vals) {
          for (var i = 0; i < vals.length; i++) {
            var rowIdx = r - 1 + i;
            self._linhas[rowIdx] = vals[i].slice();
          }
          return range; // permite encadeamento (.setValues(...).setFontWeight(...))
        },
        setFontWeight: function () { self._headerBold = true; return range; },
        getValues: function () { return self._linhas.slice(r - 1, r - 1 + nr); }
      };
      return range;
    },
    setFrozenRows: function () { this._frozen = true; },
    deleteRows: function (start, howMany) { this._linhas.splice(start - 1, howMany); },
    deleteRow: function (rowPos) { this._linhas.splice(rowPos - 1, 1); } // 1-based
  };
}
var _sheets = {};
var SpreadsheetApp = {
  getActiveSpreadsheet: function () {
    return {
      getSheetByName: function (n) { return _sheets[n] || null; },
      insertSheet: function (n) { _sheets[n] = makeSheet(n); return _sheets[n]; }
    };
  }
};
global.SpreadsheetApp = SpreadsheetApp;
global.console = console;

eval(src);
var M = DiagnosticoOportunidadePerdida;

var falhas = [];
console.log('\n=== HISTÓRICO: série temporal (Diag_Oportunidade_Hist) ===');

// (1) Cabeçalho
var cab = M._cabecalhoHistorico();
console.log('  Cabeçalho (' + cab.length + ' cols): ' + cab.join(' | '));
['Timestamp', 'Data', 'Estratégia', 'Oport. Perdida (soma %)', 'Nº Trades Perdidos'].forEach(function (col) {
  if (cab.indexOf(col) === -1) falhas.push('Cabeçalho sem a coluna "' + col + '".');
});

// (2) Criação idempotente — chama 2x e não deve duplicar cabeçalho
var sh1 = M._garantirAbaHistorico();
var sh2 = M._garantirAbaHistorico();
if (!sh1 || sh1.getName() !== 'Diag_Oportunidade_Hist') falhas.push('Aba de histórico não criada com nome correto.');
if (sh1.getLastRow() !== 1) falhas.push('Cabeçalho duplicado na 2ª chamada (esperado 1 linha).');
else console.log('  ✅ Aba criada com cabeçalho (idempotente; 1 linha).');

// (3) Append — 2 execuções devem gerar 2 linhas cada (4 linhas de dados)
function resumoFake(perdConnors, perdDonchian) {
  return {
    tickersAnalisados: 40, tickersSemDados: 3, aprovadosRobo: 12,
    connors: { stats: { n: 10, winRate: 60, avgRet: 1.5, sumRet: 15, best: 5, worst: -3 }, oportunidadePerdida: perdConnors, tradesLucrativosPerdidos: 4 },
    donchian: { stats: { n: 8, winRate: 50, avgRet: 1.2, sumRet: 9.6, best: 4, worst: -2 }, oportunidadePerdida: perdDonchian, tradesLucrativosPerdidos: 3 }
  };
}
// v1.3 — UPSERT por dia: 2 execuções no MESMO dia => mantém só a ÚLTIMA (2 linhas).
M._persistirHistorico(resumoFake(2.5, 1.8));  // 1ª execução do dia
M._persistirHistorico(resumoFake(3.1, 2.2));  // 2ª execução do dia (substitui)
var dados = sh1.getLastRow() - 1;
console.log('  Linhas após 2 execuções no MESMO dia: ' + dados + ' (esperado 2 — upsert)');
if (dados !== 2) falhas.push('Upsert por dia falhou: esperado 2 linhas, obtido ' + dados + '.');
var corpo = sh1._linhas;
if (String(corpo[1][5]) !== 'CONNORS_IFR2' || Number(corpo[1][12]) !== 3.1) {
  falhas.push('Upsert não manteve a ÚLTIMA execução do dia (esperado 3.1).');
} else {
  console.log('  ✅ Upsert por dia manteve apenas a última execução (3.1).');
}
if (String(corpo[2][5]) !== 'DONCHIAN_20_10') falhas.push('2ª linha deveria ser DONCHIAN_20_10.');

// Confere que DIA DIFERENTE acumula (append preservado entre dias)
(function () {
  // Força uma "data" distinta inserindo manualmente uma linha antiga.
  sh1._linhas.push(['2020-01-01T00:00:00Z', '2020-01-01', 1, 0, 0, 'CONNORS_IFR2', 1, 0, 0, 0, 0, 0, 0, 0]);
  M._persistirHistorico(resumoFake(9.9, 9.9)); // mesmo dia de hoje -> não apaga o de 2020
  var tem2020 = sh1._linhas.some(function (r) { return String(r[1]) === '2020-01-01'; });
  if (!tem2020) falhas.push('Upsert apagou indevidamente um dia diferente (2020-01-01).');
  else console.log('  ✅ Dias diferentes são preservados (série histórica cresce).');
})();

// (4) Truncamento por teto
var shBig = makeSheet('Diag_Oportunidade_Hist');
shBig._linhas.push(M._cabecalhoHistorico());
for (var i = 0; i < M.CFG.HIST_MAX_LINHAS + 10; i++) {
  shBig._linhas.push(['x', 'x', 0, 0, 0, 'CONNORS_IFR2', 0, 0, 0, 0, 0, 0, 0, 0]);
}
_sheets['Diag_Oportunidade_Hist'] = shBig;
M._persistirHistorico(resumoFake(1, 1));
var totalBig = shBig.getLastRow() - 1;
console.log('  Após teto: ' + totalBig + ' linhas (teto ' + M.CFG.HIST_MAX_LINHAS + ')');
if (totalBig > M.CFG.HIST_MAX_LINHAS) falhas.push('Truncamento falhou: ' + totalBig + ' > teto.');

// (5) Pivotagem para o gráfico (formato "wide" por data)
console.log('\n--- Pivot p/ gráfico (Data | Connors | Donchian) ---');
var COL = { DATA: 1, ESTRATEGIA: 5, OPORT_PERDIDA: 12 };
function linhaHist(data, estrategia, op) {
  var r = []; for (var i = 0; i < 14; i++) r.push('');
  r[COL.DATA] = data; r[COL.ESTRATEGIA] = estrategia; r[COL.OPORT_PERDIDA] = op;
  return r;
}
var histFake = [
  linhaHist('2025-01-02', 'CONNORS_IFR2', 2.5),
  linhaHist('2025-01-02', 'DONCHIAN_20_10', 1.8),
  linhaHist('2025-01-03', 'CONNORS_IFR2', 3.1),
  linhaHist('2025-01-03', 'DONCHIAN_20_10', 2.2),
  linhaHist('2025-01-03', 'CONNORS_IFR2', 3.9) // 2ª execução no mesmo dia -> prevalece
];
var tabela = M._pivotarHistorico(histFake);
console.log('  Cabeçalho: ' + tabela[0].join(' | '));
tabela.slice(1).forEach(function (r) { console.log('  ' + r.join(' | ')); });
if (tabela[0].join('|') !== 'Data|CONNORS_IFR2|DONCHIAN_20_10') {
  falhas.push('Cabeçalho do pivot incorreto.');
}
if (tabela.length !== 3) falhas.push('Pivot deveria ter 2 datas + cabeçalho (obtido ' + tabela.length + ').');
if (tabela[1] && String(tabela[1][0]) !== '2025-01-02') falhas.push('Ordem/primeira data do pivot incorreta.');
// A última execução do dia 2025-01-03 (3.9) deve prevalecer sobre a primeira (3.1)
var linha03 = tabela.filter(function (r) { return String(r[0]) === '2025-01-03'; })[0];
if (!linha03 || Number(linha03[1]) !== 3.9) falhas.push('Pivot não manteve a última execução do dia (esperado 3.9).');
// Confirma que o módulo exporta a função de gráfico
if (typeof M.gerarGraficoHistorico !== 'function') falhas.push('gerarGraficoHistorico não exportada.');

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: persistência/histórico inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ Cabeçalho correto e criação idempotente.');
  console.log('  ✅ Upsert por dia (sem duplicatas no mesmo dia) + preserva dias distintos.');
  console.log('  ✅ Teto HIST_MAX_LINHAS trunca o excedente.');
  console.log('  ✅ Pivot gera tabela wide (2 séries) com última execução do dia.');
  console.log('\n✅ PASSOU: histórico + gráfico (upsert com data) funcionando.');
}
