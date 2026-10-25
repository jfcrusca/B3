/**
 * @file scripts/_harness_ranker.js
 * @description Harness de teste que executa o bloco 5.1 (alocacao) REAL de
 * 41_Ranker.js, em vez de uma copia da logica.
 *
 * Motivo: o teste anterior replicava a alocacao como uma FUNCAO PURA de
 * (score, preco), mas a producao PARTE de um `trades[].qtd` ja dimensionado
 * pelo Position Sizing (2% de risco). Nenhum teste enxergava esse `qtd`
 * inicial — foi assim que a divergencia entre teste (94% e 4 descartes)
 * e producao (122% de capital e 0 descartes) passou despercebida.
 *
 * Estrategia: extrai o trecho `===== 5.1 ...` ate `_escreverTabelaRanker(`
 * do arquivo real (sem reescrever a logica) e injeta um escopo controlado:
 * capital, CFG, trades, console e o stub `_escreverTabelaRanker`.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var RANKER_PATH = path.resolve(__dirname, '..', '41_Ranker.js');

/**
 * Extrai o corpo do bloco 5.1 do codigo-fonte do Ranker.
 * @return {string} codigo JS do bloco de alocacao (usa `trades` e `capital` do escopo).
 */
function extrairBlocoAlocacao() {
  var src = fs.readFileSync(RANKER_PATH, 'utf8');
  var inicio = src.indexOf('var maxTotalValue = capital');
  var fim = src.indexOf('_escreverTabelaRanker(ss, trades, CFG.RESUMO_SHEET)');
  if (inicio === -1 || fim === -1 || fim <= inicio) {
    throw new Error('Nao foi possivel extrair o bloco de alocacao de 41_Ranker.js (ancoras nao encontradas).');
  }
  // `trades = tradesCapados;` encerra a alocacao; o resto e escrita na planilha.
  return src.slice(inicio, fim);
}

/**
 * Executa o bloco de alocacao real do Ranker.
 *
 * @param {Array} trades trades no formato de 41_Ranker.js: { ticker, preco, stop, score, qtd }.
 * @param {Object} cfg CFG com MAX_TRADE_ALLOCATION / MAX_TOTAL_ALLOCATION / MIN_LOTE_VALUE.
 * @param {number} capital capital total.
 * @return {Object} { trades, logs, warns }.
 */
function alocarComCodigoReal(trades, cfg, capital) {
  var logs = [];
  var warns = [];
  var fakeConsole = {
    log: function () { logs.push(Array.prototype.slice.call(arguments).join(' ')); },
    warn: function () { warns.push(Array.prototype.slice.call(arguments).join(' ')); },
    error: function () { warns.push(Array.prototype.slice.call(arguments).join(' ')); }
  };

  var sandbox = {
    capital: capital,
    CFG: cfg,
    trades: trades,
    console: fakeConsole,
    _escreverTabelaRanker: function () { /* stub: nao escreve planilha */ }
  };
  vm.createContext(sandbox);
  vm.runInContext(extrairBlocoAlocacao(), sandbox, { filename: '41_Ranker.js#bloco5.1' });

  return { trades: sandbox.trades, logs: logs, warns: warns };
}

module.exports = { alocarComCodigoReal: alocarComCodigoReal, extrairBlocoAlocacao: extrairBlocoAlocacao };
