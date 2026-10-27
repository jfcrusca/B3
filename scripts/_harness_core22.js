/**
 * @file scripts/_harness_core22.js
 * @description Harness que executa o 22_Core_Analyzers.js REAL (não uma cópia)
 * em sandbox `vm`, para fins de diagnóstico e teste offline.
 *
 * MOTIVO: os harnesses antigos replicavam as fórmulas de Fibonacci manualmente.
 * Isso significava que uma mudança em CORE22_CFG (ex.: structureLookback 30 -> 60)
 * ou na lógica de zona podia divergir do que roda em produção sem nenhum teste
 * perceber. Este harness carrega o arquivo-fonte inteiro, com stubs mínimos, e
 * expõe o resultado do pipeline real: estrutura -> risco -> score -> setup.
 *
 * Diferença em relação aos testes: aqui não há asserção, apenas extração.
 * O objetivo é AUDITAR o que o código decidiu para um ticker.
 *
 * Uso:
 *   var core22 = require('./_harness_core22');
 *   var r = core22.analisar(candles, { ticker: 'PETR4' });
 *
 * @see 22_Core_Analyzers.js  (STRATEGY_EVALUATE_CORE)
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var CORE22_PATH = path.resolve(__dirname, '..', '22_Core_Analyzers.js');

/**
 * Carrega o código-fonte do 22_Core_Analyzers.js.
 * @return {string} fonte completa.
 */
function lerFonte() {
  var src = fs.readFileSync(CORE22_PATH, 'utf8');
  if (!src || src.indexOf('function STRATEGY_EVALUATE_CORE') === -1) {
    throw new Error('22_Core_Analyzers.js invalido: STRATEGY_EVALUATE_CORE nao encontrada.');
  }
  return src;
}


/**
 * Cria um sandbox com o módulo 22 carregado.
 *
 * Stubs injetados (todos opcionais no GAS, mas necessários para rodar fora):
 *  - CONFIG      : espelha PropertiesService (usado pelo breakdown do score).
 *  - console     : silencioso por padrão; verbose=true reencaminha ao real.
 *  - SpreadsheetApp / PropertiesService : mínimos, para nenhum caminho de log
 *    tentar tocar serviços do GAS e explodir.
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.verbose] se true, encaminha logs do módulo ao console.
 * @param {Object}  [opts.configExtra] overrides de CONFIG.get.
 * @return {Object} sandbox com STRATEGY_EVALUATE_CORE e CORE22_CFG.
 */
function criarSandbox(opts) {
  var o = opts || {};
  var logs = [];
  var warns = [];

  var consoleStub = {
    log: function () {
      var m = Array.prototype.slice.call(arguments).join(' ');
      logs.push(m);
      if (o.verbose) console.log(m);
    },
    warn: function () {
      var m = Array.prototype.slice.call(arguments).join(' ');
      warns.push(m);
      if (o.verbose) console.warn(m);
    },
    error: function () {
      var m = Array.prototype.slice.call(arguments).join(' ');
      warns.push(m);
      if (o.verbose) console.error(m);
    }
  };

  var extra = o.configExtra || {};
  var configStub = {
    get: function (chave, padrao) {
      if (Object.prototype.hasOwnProperty.call(extra, chave)) return extra[chave];
      return padrao;
    },
    refresh: function () { /* no-op fora do GAS */ }
  };

  var sandbox = {
    console: consoleStub,
    CONFIG: configStub,
    // Serviços do GAS — stubs inertes (o caminho de análise não os usa).
    SpreadsheetApp: { getActiveSpreadsheet: function () { return null; } },
    PropertiesService: {
      getScriptProperties: function () { return { getProperty: function () { return null; } }; }
    },
    Utilities: { sleep: function () { } },
    // Sem CandlePatternScanner: o módulo 22 tem guarda `typeof !== 'undefined'`
    // e simplesmente ignora o bônus de candle patterns (bônus 0).
    Math: Math,
    Date: Date,
    JSON: JSON,
    parseFloat: parseFloat,
    parseInt: parseInt,
    isNaN: isNaN,
    isFinite: isFinite
  };

  vm.createContext(sandbox);
  vm.runInContext(lerFonte(), sandbox, { filename: '22_Core_Analyzers.js' });

  // `CORE22_CFG` é declarado com `const`, portanto NÃO vira propriedade do objeto
  // sandbox (fica no escopo lexical da VM). Extraímos a referência explicitamente.
  try {
    sandbox.__cfg = vm.runInContext('(typeof CORE22_CFG !== "undefined") ? CORE22_CFG : null', sandbox);
  } catch (e) {
    sandbox.__cfg = null;
  }

  sandbox.__logs = logs;
  sandbox.__warns = warns;
  return sandbox;
}

/**
 * Analisa uma série de candles pelo pipeline REAL do módulo 22.
 *
 * @param {Array} candles candles no formato do projeto:
 *        { date, open, high, low, close, volume }. Mínimo de 60 para o Fibo.
 * @param {Object} [opts]
 * @param {string} [opts.ticker] ticker (usado em logs e no breakdown).
 * @param {Object} [opts.ibovContext] contexto de mercado (benchmarkReturn21d, regime).
 * @param {boolean} [opts.verbose] encaminha logs do módulo ao console.
 * @param {Object} [opts.configExtra] overrides de CONFIG.get.
 * @return {Object} { resultado, estrutura, risco, indicadores, logs, warns, cfg }.
 */
function analisar(candles, opts) {
  var o = opts || {};
  if (!Array.isArray(candles) || candles.length === 0) {
    throw new Error('analisar(): candles vazio ou invalido.');
  }

  var sb = criarSandbox({ verbose: o.verbose, configExtra: o.configExtra });

  // O módulo aceita Array puro ou { candles, ticker }.
  var entrada = (o.ticker) ? { candles: candles, ticker: o.ticker } : candles;

  var resultado = sb.STRATEGY_EVALUATE_CORE(entrada, o.ibovContext || null);

  // Recalcula estrutura/risco/indicadores isoladamente para expor campos internos
  // que o retorno público não exporta (zonaPiso, zonaTeto, centroZona,
  // distZonaPct, motivoFibo, lookbackUsado...).
  var estrutura = null;
  var risco = null;
  var indicadores = null;

  try {
    var ctx = sb._obterContextoPrecos(candles);
    var closes = ctx.closes;
    var preco = closes[closes.length - 1];

    indicadores = sb._calcularIndicadoresTecnicos(candles, closes, o.ticker || 'UNKNOWN');
    estrutura = sb._analisarEstruturaMercado(ctx, preco, indicadores, candles);
    risco = sb._processarGestaoRisco(preco, indicadores.atr, estrutura, candles, closes);
  } catch (e) {
    // Caminhos internos não são o objetivo principal; o resultado público basta.
    sb.__warns.push('harness: falha ao recalcular internos: ' + e.message);
  }

  return {
    resultado: resultado,
    estrutura: estrutura,
    risco: risco,
    indicadores: indicadores,
    logs: sb.__logs,
    warns: sb.__warns,
    cfg: sb.__cfg
  };
}

/**
 * Expõe a config REAL do módulo 22 (não uma cópia).
 * @return {Object} CORE22_CFG.
 */
function obterConfig() {
  return criarSandbox({}).__cfg;
}

/**
 * 🔧 v15.4 — Chama `_core_analisarRompimentoSuporte` do módulo 22 REAL.
 * O sandbox compartilha o escopo global do GAS, então qualquer função
 * declarada no arquivo fica acessível.
 * @return {?Object} diagnóstico do rompimento.
 */
function rompimento(candles, idxPivo, precoPivo) {
  var sb = criarSandbox({});
  return sb._core_analisarRompimentoSuporte(candles, idxPivo, precoPivo);
}

/**
 * 🔧 v15.4 — Índice do último pivô de fundo, segundo o módulo 22 REAL.
 * Usa os mesmos lookbacks default do Core22 (evita duplicar a lógica).
 * @return {number} índice na série completa, ou -1.
 */
function getPivotIndex(candles) {
  var sb = criarSandbox({});
  return sb._core_getLastPivotLowIndex(candles);
}

module.exports = {
  analisar: analisar,
  obterConfig: obterConfig,
  criarSandbox: criarSandbox,
  lerFonte: lerFonte,
  rompimento: rompimento,
  getPivotIndex: getPivotIndex
};

