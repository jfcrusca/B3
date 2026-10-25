/**
 * =============================================================================
 * 60_Diagnostico_OportunidadePerdida.gs — DIAGNÓSTICO DE CUSTO DE OPORTUNIDADE
 * =============================================================================
 * FINALIDADE:
 *   Medir, com dados reais da B3, quanto o robô B3-v10 deixa de ganhar por não
 *   operar duas famílias de setup que hoje ele NÃO implementa:
 *     1. Reversão à média por IFR-2 (modelo Larry Connors)
 *        - Entrada: IFR(2) < 10 no diário + tendência semanal de alta (close > SMA200 semanal)
 *        - Saída:   fechamento acima da SMA5 diária
 *     2. Rastreamento de tendência por Rompimento de Canal de Donchian (20/10)
 *        - Entrada: fechamento acima da máxima dos últimos 20 dias
 *        - Saída:   fechamento abaixo da mínima dos últimos 10 dias (trailing)
 *
 * COMO FUNCIONA:
 *   - Para cada ticker, baixa o histórico diário via DataService.getMarketData()
 *   - Roda um backtest bar-a-bar (sem look-ahead) das duas estratégias
 *   - Compara os sinais gerados com o que o robô APROVOU de fato
 *     (lendo a aba 'Resultados_Analise' e o log de simulação)
 *   - Reporta o "custo de oportunidade": trades lucrativos que o robô não capturou
 *
 * IMPORTANTE (limitações declaradas):
 *   - Este módulo é SOMENTE LEITURA + escrita em abas próprias:
 *       'Diag_Oportunidade'      → relatório detalhado da ÚLTIMA execução (snapshot);
 *       'Diag_Oportunidade_Hist' → SÉRIE TEMPORAL (append por execução);
 *       'Diag_Oportunidade_Chart'→ apoio para o gráfico de evolução (v1.2).
 *     Não altera score, pipeline, carteira nem qualquer decisão do robô.
 *   - Backtest com preços de fechamento (sem intraday). Custos operacionais são
 *     parametrizáveis via CFG.CUSTO_BPS e descontados do resultado.
 *   - 🔧 v1.4: FILTRO DE OUTLIERS — trades com retorno absoluto acima de
 *     CFG.OUTLIER_MAX_RETORNO (padrão 300%) são removidos da amostra e listados
 *     à parte, pois provavelmente decorrem de eventos corporativos não ajustados
 *     (grupamento/desdobramento) ou dados corrompidos. Sem isso, um único trade
 *     anômalo (ex.: +1733%) distorcia toda a média da estratégia.
 *   - A comparação temporal com 'Resultados_Analise' é aproximada: aquela aba é um
 *     SNAPSHOT (reescrita a cada execução), portanto só enxerga a última varredura.
 *
 * @see 22_Core_Analyzers.js  (_core_getRSI reaproveitado com period=2)
 * @see 05_Data_Service.js    (fonte de candles)
 * =============================================================================
 */

var DiagnosticoOportunidadePerdida = (function () {
  'use strict';

  var CFG = {
    SHEET_DESTINO: 'Diag_Oportunidade',
    // 🔧 v1.1: aba de SÉRIE TEMPORAL — cada execução faz APPEND (1 linha por
    // estratégia) com data/hora, permitindo acompanhar o custo de oportunidade
    // evoluir ao longo do tempo (antes o relatório era um snapshot descartável).
    SHEET_HISTORICO: 'Diag_Oportunidade_Hist',
    HIST_MAX_LINHAS: 5000,       // teto de segurança para a aba de histórico
    // 🔧 v1.2: aba de apoio para o gráfico de evolução (tabela "wide" por data).
    SHEET_CHART_DATA: 'Diag_Oportunidade_Chart',
    CHART_TITULO: '📈 CUSTO DE OPORTUNIDADE — EVOLUÇÃO (soma %)',
    SHEET_ORIGEM_ROBO: 'Resultados_Analise',
    SHEET_LOG_SIMULADO: 'Log_Simulado',
    RANGE: '1y',                 // histórico solicitado ao DataService
    MAX_TICKERS: 40,             // teto de segurança para não estourar o tempo do GAS
    PAUSA_LOTE_MS: 1000,         // pausa entre lotes (regra do projeto: min 1000ms)
    BATCH_SIZE: 5,               // tickers por lote
    CUSTO_BPS: 0.0005,           // 0,05% por perna (corretagem + spread + slippage estimados)
    // 🔧 v1.4: FILTRO DE OUTLIERS — protege o backtest de eventos corporativos
    // (grupamento/desdobramento) e dados corrompidos que inflam o sumRet de forma
    // irreal (ex.: um trade de +1733% distorce toda a média). Trades cujo retorno
    // ABSOLUTO (decimal) ultrapasse OUTLIER_MAX_RETORNO são descartados da amostra
    // e contados separadamente. 3.0 = 300% numa única operação.
    OUTLIER_MAX_RETORNO: 3.0,
    OUTLIER_MAX_BARRAS: 0,       // 0 = desligado; se >0, também descarta trades com barras > valor
    // 🔧 v1.6: EXECUÇÃO NO OPEN DO DIA SEGUINTE. O sinal (IFR-2 / rompimento)
    // é gerado no FECHAMENTO do dia i; a ordem real só pode ser executada na
    // ABERTURA do dia i+1. Isso torna o backtest REALISTA (elimina o look-ahead
    // de "comprar no close que só conhecemos depois"). false = usa o close do
    // próprio dia (comportamento antigo, otimista).
    EXECUCAO_NO_OPEN_SEGUINTE: true,
    // 🔧 v1.5: EXCLUIR BDRs/ETFs internacionais do diagnóstico (opt-in).
    // PADRÃO = false: NÃO exclui genericamente, pois há BDRs com histórico BOM
    // (ex.: RDXO34 = Rede D'Or). A proteção principal contra BDRs problemáticos
    // (ex.: ACNB34, com datas invertidas) é o FILTRO DE INTEGRIDADE em
    // _filtrarOutliers (rejeita dataSaida < dataEntrada e preços inválidos).
    // Ative = true se quiser um universo estritamente de AÇÕES da B3.
    EXCLUIR_BDR: false,
    // --- Parâmetros Estratégia 1 (Connors / IFR-2) ---
    CONNORS_IFR_PERIOD: 2,
    CONNORS_IFR_ENTRADA: 10,     // IFR(2) < 10 → sobrevenda extrema
    CONNORS_SMA_SAIDA: 5,        // vende quando fechar acima da SMA5
    CONNORS_SMA_TENDENCIA: 200,  // filtro de tendência semanal (SMA200 semanal)
    CONNORS_MAX_HOLD: 20,        // corte de segurança em barras
    // --- Parâmetros Estratégia 2 (Donchian 20/10) ---
    DONCHIAN_ENTRADA: 20,        // rompe máxima dos últimos 20 dias
    DONCHIAN_SAIDA: 10,          // vende abaixo da mínima dos últimos 10 dias
    DONCHIAN_MAX_HOLD: 60        // corte de segurança em barras
  };

  /**
   * Estrutura padrão de retorno de um trade de backtest.
   * @typedef {Object} TradeDiagnostico
   * @property {string} ticker
   * @property {string} estrategia       'CONNORS_IFR2' | 'DONCHIAN_20_10'
   * @property {string} dataEntrada
   * @property {string} dataSaida
   * @property {number} precoEntrada
   * @property {number} precoSaida
   * @property {number} resultadoPct      Já líquido de custos (CUSTO_BPS x 2)
   * @property {number} barras
   * @property {string} motivoSaida
   */

  /**
   * Arredonda com segurança para 2 casas.
   * @param {number} v
   * @returns {number}
   */
  function _r2(v) {
    var n = Number(v);
    return isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  /**
   * Arredonda para 4 casas (percentuais internos).
   * @param {number} v
   * @returns {number}
   */
  function _r4(v) {
    var n = Number(v);
    return isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
  }

  /**
   * Lê um valor numérico tolerando string com vírgula decimal (pt-BR).
   * @param {*} v
   * @returns {number}
   */
  function _toNum(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (v === null || v === undefined) return 0;
    var s = String(v).trim().replace('%', '').replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  /**
   * Média Móvel Simples dos últimos `period` valores de um índice `idx` (inclusive).
   * Usa apenas dados até `idx` (sem look-ahead).
   * @param {number[]} serie
   * @param {number} idx
   * @param {number} period
   * @returns {number|null}
   */
  function _smaAte(serie, idx, period) {
    if (!serie || idx + 1 < period || period <= 0) return null;
    var soma = 0;
    for (var i = idx - period + 1; i <= idx; i++) soma += serie[i];
    return soma / period;
  }

  // =========================================================================
  // MOTOR DE BACKTEST — ESTRATÉGIA 1: REVERSÃO À MÉDIA POR IFR-2 (CONNORS)
  // =========================================================================

  /**
   * Agrega candles diários em candles semanais (segunda→sexta).
   * Usado para o filtro de tendência de médio prazo (SMA200 semanal).
   * @param {Array<Object>} candles Diários ordenados ascendentemente
   * @returns {Array<Object>} Candles semanais {date, open, high, low, close}
   */
  function _montarCandlesSemanais(candles) {
    if (!Array.isArray(candles) || candles.length === 0) return [];
    var semanas = [];
    var atual = null;
    var semanaRef = null;

    for (var i = 0; i < candles.length; i++) {
      var c = candles[i];
      if (!c || typeof c.close !== 'number' || c.close <= 0) continue;
      var d = c.date ? new Date(c.date) : null;
      if (!d || isNaN(d.getTime())) continue;

      // Chave da semana: ano + semana aproximada pelo dia do ano
      var inicioAno = new Date(d.getFullYear(), 0, 1);
      var semanaAno = Math.floor(((d - inicioAno) / 86400000 + inicioAno.getDay()) / 7);
      var chave = d.getFullYear() + '-' + semanaAno;

      if (chave !== semanaRef) {
        if (atual) semanas.push(atual);
        semanaRef = chave;
        atual = {
          date: c.date,
          open: _toNum(c.open != null ? c.open : c.close),
          high: _toNum(c.high != null ? c.high : c.close),
          low: _toNum(c.low != null ? c.low : c.close),
          close: _toNum(c.close)
        };
      } else if (atual) {
        var hi = _toNum(c.high != null ? c.high : c.close);
        var lo = _toNum(c.low != null ? c.low : c.close);
        if (hi > atual.high) atual.high = hi;
        if (lo < atual.low) atual.low = lo;
        atual.close = _toNum(c.close); // close da última barra da semana
      }
    }
    if (atual) semanas.push(atual);
    return semanas;
  }

  /**
   * Converte a data de um candle em string ISO curta (YYYY-MM-DD).
   * @param {Object} candle
   * @returns {string}
   */
  function _dataStr(candle) {
    try {
      var d = new Date(candle.date);
      if (isNaN(d.getTime())) return '';
      var mm = ('0' + (d.getMonth() + 1)).slice(-2);
      var dd = ('0' + d.getDate()).slice(-2);
      return d.getFullYear() + '-' + mm + '-' + dd;
    } catch (e) {
      return '';
    }
  }

  /**
   * 🔧 v1.6: Resolve o PREÇO DE EXECUÇÃO de uma ordem gerada por sinal no
   * fechamento do candle `idxSinal`.
   *   - Modo realista (padrão): retorna o OPEN do candle seguinte (idxSinal+1).
   *     Se não houver dia seguinte (sinal no último candle), retorna null.
   *   - Modo legado (EXECUCAO_NO_OPEN_SEGUINTE=false): retorna o CLOSE do próprio
   *     candle de sinal.
   * @param {Array<Object>} candles
   * @param {number} idxSinal Índice do candle onde o sinal foi gerado (close).
   * @returns {{idx: number, preco: number, data: string}|null}
   */
  function _precoExecucao(candles, idxSinal) {
    if (!Array.isArray(candles) || idxSinal < 0 || idxSinal >= candles.length) return null;
    if (CFG.EXECUCAO_NO_OPEN_SEGUINTE) {
      var idxExec = idxSinal + 1;
      if (idxExec >= candles.length) return null; // sinal no último candle: não há como executar
      var cExec = candles[idxExec];
      // Usa o open; se ausente/inválido, cai para o close do dia de execução.
      var preco = _toNum(cExec && cExec.open != null ? cExec.open : (cExec ? cExec.close : 0));
      if (!(preco > 0)) return null;
      return { idx: idxExec, preco: preco, data: _dataStr(cExec) };
    }
    // Modo legado: executa no close do próprio candle de sinal.
    var cSinal = candles[idxSinal];
    var precoC = _toNum(cSinal && cSinal.close);
    if (!(precoC > 0)) return null;
    return { idx: idxSinal, preco: precoC, data: _dataStr(cSinal) };
  }

  /**
   * Backtest da estratégia Connors (IFR-2 + tendência semanal + saída na SMA5).
   * Sem look-ahead: em cada barra `i`, todos os indicadores usam apenas barras <= i.
   * @param {string} ticker
   * @param {Array<Object>} candles Diários ordenados ascendentemente
   * @returns {Array<Object>} Lista de trades (TradeDiagnostico)
   */
  function _backtestConnors(ticker, candles) {
    var trades = [];
    if (!Array.isArray(candles) || candles.length < 30) return trades;

    var closes = [];
    for (var k = 0; k < candles.length; k++) {
      var cl = _toNum(candles[k].close);
      closes.push(cl > 0 ? cl : null);
    }

    // Filtro de tendência: close > SMA200 SEMANAL (carry-forward para o diário)
    var semanas = _montarCandlesSemanais(candles);
    var closesSemanais = semanas.map(function (s) { return s.close; });
    var tendenciaPorSemana = [];
    for (var w = 0; w < semanas.length; w++) {
      var sma200w = _smaAte(closesSemanais, w, CFG.CONNORS_SMA_TENDENCIA);
      // Sem SMA200 semanal (histórico curto), seja permissivo
      tendenciaPorSemana.push(sma200w === null ? true : (closesSemanais[w] > sma200w));
    }
    function _tendenciaNaBarra(idxDiario) {
      if (tendenciaPorSemana.length === 0) return true;
      var d = new Date(candles[idxDiario].date);
      if (isNaN(d.getTime())) return true;
      var idxSem = 0;
      for (var s = 0; s < semanas.length; s++) {
        var ds = new Date(semanas[s].date);
        if (isNaN(ds.getTime())) continue;
        if (ds <= d) idxSem = s; else break;
      }
      return tendenciaPorSemana[idxSem];
    }

    var emPosicao = false;
    var entradaIdx = -1;      // índice do candle de EXECUÇÃO da entrada
    var precoEntrada = 0;

    for (var i = 1; i < candles.length; i++) {
      if (closes[i] === null) continue;

      if (!emPosicao) {
        // 1) Gatilho Connors: IFR(2) < 10 — reutiliza _core_getRSI do módulo 22
        var ifr2 = (typeof _core_getRSI === 'function')
          ? _core_getRSI(closes.slice(0, i + 1), CFG.CONNORS_IFR_PERIOD)
          : null;
        if (ifr2 === null) continue;
        // 2) Filtro de tendência semanal
        var tendOk = _tendenciaNaBarra(i);
        if (ifr2 < CFG.CONNORS_IFR_ENTRADA && tendOk) {
          // 🔧 v1.6: sinal no close de `i`; executa no open de `i+1`.
          var exec = _precoExecucao(candles, i);
          if (!exec) continue; // sem dia seguinte para executar
          emPosicao = true;
          entradaIdx = exec.idx;
          precoEntrada = exec.preco;
          i = exec.idx; // salta para o candle de execução (evita reprocessar)
        }
      } else {
        // Precisa haver barras suficientes desde a execução
        if (i <= entradaIdx) continue;
        // 3) Sinal de SAÍDA no close de `i` (SMA5 ou time stop)
        var sma5 = _smaAte(closes, i, CFG.CONNORS_SMA_SAIDA);
        var barras = i - entradaIdx;
        var saiu = false;
        var motivo = '';
        if (sma5 !== null && closes[i] > sma5) { saiu = true; motivo = 'Fechou acima da SMA5'; }
        else if (barras >= CFG.CONNORS_MAX_HOLD) { saiu = true; motivo = 'Time stop (' + CFG.CONNORS_MAX_HOLD + ' barras)'; }

        if (saiu) {
          // 🔧 v1.6: executa a venda no open do dia seguinte ao sinal de saída.
          var execS = _precoExecucao(candles, i);
          var precoSaida = execS ? execS.preco : closes[i];
          var idxSaida = execS ? execS.idx : i;
          var bruto = (precoSaida / precoEntrada) - 1;
          var liquido = bruto - (CFG.CUSTO_BPS * 2);
          trades.push({
            ticker: ticker,
            estrategia: 'CONNORS_IFR2',
            dataEntrada: _dataStr(candles[entradaIdx]),
            dataSaida: _dataStr(candles[idxSaida]),
            precoEntrada: _r2(precoEntrada),
            precoSaida: _r2(precoSaida),
            resultadoPct: _r4(liquido),
            barras: idxSaida - entradaIdx,
            motivoSaida: motivo
          });
          emPosicao = false;
          if (execS) i = idxSaida; // continua a partir do dia de execução da venda
        }
      }
    }
    return trades;
  }

  /**
   * Backtest da estratégia Donchian 20/10 (rompimento com trailing de mínima).
   * Entrada: close[i] > max(high[i-20 .. i-1]).
   * Saída:   close[i] < min(low[i-10 .. i-1])  OU time stop.
   * Sem look-ahead: as janelas excluem a barra corrente.
   * @param {string} ticker
   * @param {Array<Object>} candles Diários ordenados ascendentemente
   * @returns {Array<Object>} Lista de trades (TradeDiagnostico)
   */
  function _backtestDonchian(ticker, candles) {
    var trades = [];
    var N_ENT = CFG.DONCHIAN_ENTRADA;
    var N_SAI = CFG.DONCHIAN_SAIDA;
    if (!Array.isArray(candles) || candles.length < (N_ENT + 2)) return trades;

    function _maxHigh(a, b) { // máximo dos highs em [a, b) sem incluir b
      var m = -Infinity;
      for (var i = a; i < b; i++) {
        var h = _toNum(candles[i].high != null ? candles[i].high : candles[i].close);
        if (h > m) m = h;
      }
      return m === -Infinity ? null : m;
    }
    function _minLow(a, b) { // mínimo dos lows em [a, b) sem incluir b
      var m = Infinity;
      for (var i = a; i < b; i++) {
        var l = _toNum(candles[i].low != null ? candles[i].low : candles[i].close);
        if (l < m) m = l;
      }
      return m === Infinity ? null : m;
    }

    var emPosicao = false;
    var entradaIdx = -1;
    var precoEntrada = 0;

    for (var i = N_ENT; i < candles.length; i++) {
      var closeI = _toNum(candles[i].close);
      if (closeI <= 0) continue;

      if (!emPosicao) {
        var max20 = _maxHigh(i - N_ENT, i); // máxima dos 20 dias ANTERIORES
        if (max20 !== null && closeI > max20) {
          // 🔧 v1.6: sinal (rompimento) no close de `i`; executa no open de `i+1`.
          var execD = _precoExecucao(candles, i);
          if (!execD) continue; // sem dia seguinte para executar
          emPosicao = true;
          entradaIdx = execD.idx;
          precoEntrada = execD.preco;
          i = execD.idx; // salta para o candle de execução
        }
      } else {
        if (i <= entradaIdx) continue;
        var min10 = _minLow(Math.max(0, i - N_SAI), i); // mínima dos 10 anteriores
        var barras = i - entradaIdx;
        var saiu = false;
        var motivo = '';
        if (min10 !== null && closeI < min10) { saiu = true; motivo = 'Fechou abaixo da mínima de ' + N_SAI + 'd'; }
        else if (barras >= CFG.DONCHIAN_MAX_HOLD) { saiu = true; motivo = 'Time stop (' + CFG.DONCHIAN_MAX_HOLD + ' barras)'; }

        if (saiu) {
          // 🔧 v1.6: executa a venda no open do dia seguinte ao sinal de saída.
          var execDS = _precoExecucao(candles, i);
          var precoSaida = execDS ? execDS.preco : closeI;
          var idxSaida = execDS ? execDS.idx : i;
          var bruto = (precoSaida / precoEntrada) - 1;
          var liquido = bruto - (CFG.CUSTO_BPS * 2);
          trades.push({
            ticker: ticker,
            estrategia: 'DONCHIAN_20_10',
            dataEntrada: _dataStr(candles[entradaIdx]),
            dataSaida: _dataStr(candles[idxSaida]),
            precoEntrada: _r2(precoEntrada),
            precoSaida: _r2(precoSaida),
            resultadoPct: _r4(liquido),
            barras: idxSaida - entradaIdx,
            motivoSaida: motivo
          });
          emPosicao = false;
          if (execDS) i = idxSaida;
        }
      }
    }
    return trades;
  }

  /**
   * Consolida estatísticas de uma lista de trades de backtest.
   * 🔧 v1.3: TODAS as métricas de retorno são normalizadas em PERCENTUAL (%),
   * para ficarem consistentes com o rótulo das colunas ('... %'). Antes, avgRet/
   * sumRet/best/worst vinham em DECIMAL (ex.: 0.0441 = 4,41%) enquanto winRate já
   * estava ×100, misturando escalas na mesma linha.
   * @param {Array<Object>} trades
   * @returns {Object} {n, wins, losses, winRate, avgRet, sumRet, best, worst, expectancy}
   */
  function _estatisticas(trades) {
    var st = { n: 0, wins: 0, losses: 0, winRate: 0, avgRet: 0, sumRet: 0, best: 0, worst: 0, expectancy: 0 };
    if (!Array.isArray(trades) || trades.length === 0) return st;
    var soma = 0;
    var best = -Infinity, worst = Infinity;
    for (var i = 0; i < trades.length; i++) {
      var r = Number(trades[i].resultadoPct) || 0;
      soma += r;
      if (r > 0) st.wins++; else st.losses++;
      if (r > best) best = r;
      if (r < worst) worst = r;
    }
    st.n = trades.length;
    // Conversão decimal -> percentual (×100) para todas as métricas "de %".
    st.sumRet = _r4(soma * 100);
    st.avgRet = _r4((soma / trades.length) * 100);
    st.best = (best === -Infinity) ? 0 : _r4(best * 100);
    st.worst = (worst === Infinity) ? 0 : _r4(worst * 100);
    st.winRate = _r2((st.wins / trades.length) * 100);
    st.expectancy = st.avgRet; // média por trade (já líquida de custos), em %
    return st;
  }

  /**
   * 🔧 v1.4/v1.5: FILTRO DE SANIDADE de trades — remove trades inválidos ou
   * que distorcem a estatística. Um trade é descartado quando:
   *   (a) INCONSISTENTE: dataSaida < dataEntrada  (série desordenada/corrompida
   *       — ex.: ACNB34, em que a saída saiu "no passado"); OU
   *   (b) preço de entrada/saída inválido (<= 0); OU
   *   (c) OUTLIER: |resultadoPct| > OUTLIER_MAX_RETORNO (ex.: 3.0 = ±300%); OU
   *   (d) barras > OUTLIER_MAX_BARRAS (quando configurado > 0).
   * @param {Array<Object>} trades
   * @returns {{validos: Array, removidos: Array, n: number}}
   */
  function _filtrarOutliers(trades) {
    var validos = [];
    var removidos = [];
    if (!Array.isArray(trades)) return { validos: validos, removidos: removidos, n: 0 };
    var maxRet = Math.abs(_toNum(CFG.OUTLIER_MAX_RETORNO));
    var maxBarras = _toNum(CFG.OUTLIER_MAX_BARRAS);
    for (var i = 0; i < trades.length; i++) {
      var t = trades[i];
      var ret = Math.abs(_toNum(t.resultadoPct));
      var barras = _toNum(t.barras);
      var pEntrada = _toNum(t.precoEntrada);
      var pSaida = _toNum(t.precoSaida);

      // 🔧 v1.5: GUARDAS DE INTEGRIDADE — rejeitam trade logicamente impossível.
      var motivo = '';
      if (!(pEntrada > 0) || !(pSaida > 0)) {
        motivo = 'INVÁLIDO (preço <= 0)';
      } else if (!_datasCoerentes(t.dataEntrada, t.dataSaida)) {
        motivo = 'INVÁLIDO (saída ' + t.dataSaida + ' < entrada ' + t.dataEntrada + ')';
      } else if (maxRet > 0 && ret > maxRet) {
        motivo = 'OUTLIER (ret ' + _r2(ret * 100) + '%)' +
          (maxBarras > 0 && barras > maxBarras ? ', ' + barras + ' barras' : '');
      } else if (maxBarras > 0 && barras > maxBarras) {
        motivo = 'OUTLIER (' + barras + ' barras)';
      }

      if (motivo) {
        // Anexa o motivo para rastreabilidade (aparece no relatório detalhado).
        t.outlierMotivo = motivo;
        removidos.push(t);
      } else {
        validos.push(t);
      }
    }
    return { validos: validos, removidos: removidos, n: removidos.length };
  }

  /**
   * 🔧 v1.5: Verifica se as datas de entrada/saída de um trade são coerentes
   * (saída >= entrada). Protege contra séries desordenadas/corrompidas que
   * geram trades impossíveis (ex.: ACNB34 com saída em 2021 e entrada em 2022).
   * Datas vazias/ilegíveis NÃO bloqueiam (retorna true) para não descartar trades
   * legítimos sem data — o filtro de retorno continua valendo.
   * @param {string} dataEntrada 'YYYY-MM-DD'
   * @param {string} dataSaida   'YYYY-MM-DD'
   * @returns {boolean}
   */
  function _datasCoerentes(dataEntrada, dataSaida) {
    if (!dataEntrada || !dataSaida) return true;
    var e = String(dataEntrada).trim();
    var s = String(dataSaida).trim();
    // Comparação lexicográfica funciona para o formato ISO YYYY-MM-DD.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e) || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
    return s >= e;
  }

  /**
   * Lê a lista de tickers a analisar.
   * Ordem de preferência: SheetManager.getTickers() → aba 'Tickers' → fallback fixo.
   * @returns {string[]}
   */
  function _obterTickers() {
    var tickers = [];
    try {
      if (typeof SheetManager !== 'undefined' && typeof SheetManager.getTickers === 'function') {
        tickers = SheetManager.getTickers() || [];
      }
    } catch (e) { /* segue para fallback */ }

    if ((!tickers || tickers.length === 0) && typeof SpreadsheetApp !== 'undefined') {
      try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sh = ss.getSheetByName('Tickers');
        if (sh && sh.getLastRow() > 1) {
          var vals = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(1, sh.getLastColumn())).getValues();
          for (var i = 0; i < vals.length; i++) {
            for (var j = 0; j < vals[i].length; j++) {
              var t = String(vals[i][j] || '').trim().toUpperCase();
              if (t && /^[A-Z]{4}\d{1,2}$/.test(t)) { tickers.push(t); break; }
            }
          }
        }
      } catch (e2) { /* ignora */ }
    }

    // 🔧 v1.5: EXCLUI BDRs / ETFs internacionais — ativos cujo histórico costuma
    // vir corrompido/desatualizado das fontes (ex.: ACNB34 gerava trades com datas
    // invertidas e preços irrealistas, poluindo o diagnóstico). Configurável.
    if (CFG.EXCLUIR_BDR) {
      var antesBDR = tickers.length;
      if (typeof B3V10_TICKER_MANAGER !== 'undefined' && typeof B3V10_TICKER_MANAGER.filterBDRs === 'function') {
        tickers = B3V10_TICKER_MANAGER.filterBDRs(tickers);
      } else {
        // Fallback local: mesmo padrão de BDR do TickerManager.
        var _bdr = /^\w{4}(3[2-9])$/;
        tickers = tickers.filter(function (t) { return !_bdr.test(String(t).toUpperCase().trim()); });
      }
      var removidosBDR = antesBDR - tickers.length;
      if (removidosBDR > 0) {
        console.log('⏭️ [DIAG] ' + removidosBDR + ' BDR(s)/ETF(s) internacional(is) excluído(s) do diagnóstico.');
      }
    }

    // Dedup + teto de segurança
    var vistos = {};
    var limpos = [];
    for (var k = 0; k < tickers.length; k++) {
      var tk = String(tickers[k] || '').trim().toUpperCase();
      if (!tk || vistos[tk]) continue;
      vistos[tk] = true;
      limpos.push(tk);
      if (limpos.length >= CFG.MAX_TICKERS) break;
    }
    return limpos;
  }

  /**
   * Pausa sincronamente (rate limiting entre lotes de tickers).
   * @param {number} ms
   */
  function _pausa(ms) {
    try {
      var fim = Date.now() + ms;
      while (Date.now() < fim) { /* busy wait — Apps Script não tem sleep nativo */ }
    } catch (e) { /* ignora */ }
  }

  /**
   * 🔧 v1.1: Cabeçalho canônico da aba de histórico (série temporal).
   * @returns {Array<string>}
   */
  function _cabecalhoHistorico() {
    return [
      'Timestamp', 'Data', 'Tickers Analisados', 'Tickers sem Dados',
      'Tickers Cobertos Robô', 'Estratégia', 'Trades', 'Win Rate %',
      'Ret Médio %', 'Ret Soma %', 'Melhor %', 'Pior %',
      'Oport. Perdida (soma %)', 'Nº Trades Perdidos', 'Outliers Removidos'
    ];
  }

  /**
   * 🔧 v1.1: Garante que a aba de histórico exista com o cabeçalho correto.
   * @returns {Sheet|null}
   */
  function _garantirAbaHistorico() {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sh = ss.getSheetByName(CFG.SHEET_HISTORICO);
      if (!sh) sh = ss.insertSheet(CFG.SHEET_HISTORICO);
      var cab = _cabecalhoHistorico();
      // 🔧 v1.4: (re)escreve o cabeçalho se ainda não existe OU se mudou a
      // quantidade de colunas (ex.: migração 14 → 15 colunas com "Outliers").
      var cabAtual = [];
      if (sh.getLastRow() >= 1) {
        try {
          var linhaCab = sh.getRange(1, 1, 1, sh.getMaxColumns()).getValues();
          cabAtual = (linhaCab && linhaCab[0]) ? linhaCab[0] : [];
        } catch (e2) { cabAtual = []; }
      }
      var precisaCabecalho = (sh.getLastRow() < 1) || (cabAtual.length < cab.length) ||
        (String(cabAtual[0] || '').trim() === '');
      if (precisaCabecalho) {
        sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
        sh.setFrozenRows(1);
      }
      return sh;
    } catch (e) {
      console.error('❌ [DIAG] Falha ao garantir aba de histórico: ' + e.message);
      return null;
    }
  }

  /**
   * 🔧 v1.1/v1.3: Persiste 1 linha por estratégia na aba de histórico.
   * v1.3 — UPSERT por dia: se já existirem linhas do MESMO dia, elas são
   * substituídas (evita duplicatas quando o diagnóstico roda várias vezes no
   * mesmo dia — que poluíam a série temporal com pontos idênticos).
   * @param {Object} resumo Saída de executar()
   * @returns {boolean}
   */
  function _persistirHistorico(resumo) {
    if (!resumo || !resumo.connors || !resumo.donchian) return false;
    try {
      var sh = _garantirAbaHistorico();
      if (!sh) return false;

      var agora = new Date();
      var ts = agora.toISOString();
      // Data curta YYYY-MM-DD (mesmo formato de _dataStr, mas a partir de Date).
      var mm = ('0' + (agora.getMonth() + 1)).slice(-2);
      var dd = ('0' + agora.getDate()).slice(-2);
      var dataStr = agora.getFullYear() + '-' + mm + '-' + dd;

      function linha(estrategia, bloco) {
        var st = bloco.stats || {};
        return [
          ts, dataStr, resumo.tickersAnalisados, resumo.tickersSemDados,
          resumo.aprovadosRobo, estrategia, st.n, st.winRate,
          st.avgRet, st.sumRet, st.best, st.worst,
          bloco.oportunidadePerdida, bloco.tradesLucrativosPerdidos,
          bloco.outliersRemovidos || 0
        ];
      }
      var novas = [
        linha('CONNORS_IFR2', resumo.connors),
        linha('DONCHIAN_20_10', resumo.donchian)
      ];
      var nCols = novas[0].length;

      // 🔧 v1.3: UPSERT por dia — remove linhas do dia atual antes de inserir.
      // Assim, rodar várias vezes no mesmo dia mantém APENAS a última execução.
      var ultima = sh.getLastRow();
      if (ultima >= 2) {
        var existentes = sh.getRange(2, 1, ultima - 1, nCols).getValues();
        // Percorre de baixo para cima removendo as linhas do mesmo dia (seguro p/ índices).
        for (var r = existentes.length - 1; r >= 0; r--) {
          var dataLinha = String(existentes[r][1] || '').trim(); // col B = Data
          if (dataLinha === dataStr) {
            sh.deleteRow(r + 2); // +2: 1 p/ header, 1 p/ 1-based
          }
        }
      }

      // Append em bloco (1 escrita). Nunca dentro de loop.
      sh.getRange(sh.getLastRow() + 1, 1, novas.length, nCols).setValues(novas);

      // Teto de segurança: mantém apenas as últimas HIST_MAX_LINHAS (remove o topo antigo).
      var totalDados = sh.getLastRow() - 1; // exclui cabeçalho
      if (totalDados > CFG.HIST_MAX_LINHAS) {
        var excedente = totalDados - CFG.HIST_MAX_LINHAS;
        sh.deleteRows(2, excedente);
        console.log('🧹 [DIAG] Histórico truncado em ' + CFG.HIST_MAX_LINHAS + ' linhas (removidas ' + excedente + ').');
      }

      console.log('📈 [DIAG] Histórico persistido em "' + CFG.SHEET_HISTORICO + '" (+2 linhas).');
      return true;
    } catch (e) {
      console.error('❌ [DIAG] Falha ao persistir histórico: ' + e.message);
      return false;
    }
  }

  /**
   * Monta a matriz bidimensional do relatório e delega a escrita na aba.
   * Estrutura: [Resumo] → [Stats por Estratégia] → [Oportunidades Perdidas] → [Outliers].
   * @param {Object} resumo
   * @param {Array<Object>} tradesConnors
   * @param {Array<Object>} tradesDonchian
   * @param {Array<Object>} perdidosConnors
   * @param {Array<Object>} perdidosDonchian
   * @param {Array<Object>} [outliers] Trades descartados pelo filtro de sanidade (v1.4)
   */
  function _montarEescreverRelatorio(resumo, tradesConnors, tradesDonchian, perdidosConnors, perdidosDonchian, outliers) {
    var linhas = [];

    // Bloco 1 — Resumo do diagnóstico
    linhas.push(['DIAGNÓSTICO DE OPORTUNIDADE PERDIDA', 'B3-v10']);
    linhas.push(['Gerado em', new Date().toISOString()]);
    linhas.push(['Tickers analisados', resumo.tickersAnalisados]);
    linhas.push(['Tickers sem dados', resumo.tickersSemDados]);
    linhas.push(['Tickers cobertos pelo robô', resumo.aprovadosRobo]);
    linhas.push(['Filtro de outliers (> ' + (CFG.OUTLIER_MAX_RETORNO * 100).toFixed(0) + '%)',
      'Connors: ' + (resumo.connors.outliersRemovidos || 0) + ' | Donchian: ' + (resumo.donchian.outliersRemovidos || 0)]);
    linhas.push([]);

    // Bloco 2 — Estatísticas comparativas
    linhas.push(['ESTRATÉGIA', 'TRADES', 'WIN RATE %', 'RET MÉDIO %', 'RET SOMA %', 'MELHOR %', 'PIOR %', 'OPORT. PERDIDA (soma %)', 'Nº TRADES PERDIDOS', 'OUTLIERS REMOVIDOS']);
    linhas.push(['CONNORS_IFR2',
      resumo.connors.stats.n, resumo.connors.stats.winRate, resumo.connors.stats.avgRet,
      resumo.connors.stats.sumRet, resumo.connors.stats.best, resumo.connors.stats.worst,
      resumo.connors.oportunidadePerdida, resumo.connors.tradesLucrativosPerdidos,
      resumo.connors.outliersRemovidos || 0]);
    linhas.push(['DONCHIAN_20_10',
      resumo.donchian.stats.n, resumo.donchian.stats.winRate, resumo.donchian.stats.avgRet,
      resumo.donchian.stats.sumRet, resumo.donchian.stats.best, resumo.donchian.stats.worst,
      resumo.donchian.oportunidadePerdida, resumo.donchian.tradesLucrativosPerdidos,
      resumo.donchian.outliersRemovidos || 0]);
    linhas.push([]);

    // Bloco 3 — Lista detalhada de oportunidades perdidas
    linhas.push(['OPORTUNIDADES PERDIDAS — TRADES LUCRATIVOS NÃO CAPTURADOS PELO ROBÔ']);
    linhas.push(['Estratégia', 'Ticker', 'Entrada', 'Data Entrada', 'Saída', 'Data Saída', 'Resultado %', 'Barras', 'Motivo Saída', 'Status no Robô']);
    var perdidos = perdidosConnors.concat(perdidosDonchian);
    perdidos.sort(function (a, b) { return b.resultadoPct - a.resultadoPct; });
    for (var i = 0; i < perdidos.length; i++) {
      var p = perdidos[i];
      // 🔧 v1.3: resultadoPct está em decimal no trade — exibe em % (×100).
      var resultadoPctTela = _r4((Number(p.resultadoPct) || 0) * 100);
      linhas.push([p.estrategia, p.ticker, p.precoEntrada, p.dataEntrada, p.precoSaida, p.dataSaida,
        resultadoPctTela, p.barras, p.motivoSaida, p.statusRobo || '']);
    }
    linhas.push([]);

    // Bloco 4 — Outliers REMOVIDOS pelo filtro de sanidade (v1.4).
    // Auditável: mostra o que foi descartado e por quê (útil para investigar
    // eventos corporativos / dados corrompidos).
    linhas.push(['OUTLIERS REMOVIDOS (prováveis eventos corporativos / dados corrompidos)']);
    linhas.push(['Estratégia', 'Ticker', 'Entrada', 'Data Entrada', 'Saída', 'Data Saída', 'Resultado %', 'Barras', 'Motivo Saída', 'Motivo Descarte']);
    var outs = (outliers || []).slice();
    outs.sort(function (a, b) { return Math.abs(b.resultadoPct) - Math.abs(a.resultadoPct); });
    for (var o = 0; o < outs.length; o++) {
      var x = outs[o];
      linhas.push([x.estrategia, x.ticker, x.precoEntrada, x.dataEntrada, x.precoSaida, x.dataSaida,
        _r4((Number(x.resultadoPct) || 0) * 100), x.barras, x.motivoSaida, x.outlierMotivo || 'OUTLIER']);
    }

    if (linhas.length === 0 || linhas[0].length === 0) linhas[0] = ['Diagnóstico sem dados'];
    _normalizarLargura(linhas);
    _escreverRelatorio(linhas);
  }

  /**
   * Normaliza todas as linhas para a mesma largura (requisito do setValues).
   * @param {Array<Array>} linhas
   */
  function _normalizarLargura(linhas) {
    var max = 0;
    for (var i = 0; i < linhas.length; i++) {
      if (linhas[i] && linhas[i].length > max) max = linhas[i].length;
    }
    for (var j = 0; j < linhas.length; j++) {
      if (!linhas[j]) { linhas[j] = []; }
      while (linhas[j].length < max) linhas[j].push('');
    }
  }

  /**
   * FUNÇÃO PRINCIPAL — executa o diagnóstico de oportunidade perdida.
   * Fluxo: tickers → candles → backtest (Connors + Donchian) → comparação
   * com o que o robô aprovou → relatório na aba CFG.SHEET_DESTINO.
   * @returns {Object} Resumo do diagnóstico
   */
  function executar() {
    console.time('⏱️ Diagnóstico Oportunidade Perdida');
    console.log('🔍 [DIAG] Iniciando diagnóstico de oportunidade perdida...');

    var tickers = _obterTickers();
    if (!tickers || tickers.length === 0) {
      console.warn('⚠️ [DIAG] Nenhum ticker disponível. Verifique a aba "Tickers".');
      return { erro: 'sem_tickers' };
    }
    console.log('📋 [DIAG] ' + tickers.length + ' tickers a analisar.');

    var aprovadosRobo = _lerAprovadosRobo();
    var todosConnors = [];
    var todosDonchian = [];
    var processados = 0;
    var semDados = 0;

    for (var bi = 0; bi < tickers.length; bi += CFG.BATCH_SIZE) {
      var lote = tickers.slice(bi, bi + CFG.BATCH_SIZE);
      for (var ti = 0; ti < lote.length; ti++) {
        var ticker = lote[ti];
        var data = null;
        try {
          if (typeof DataService !== 'undefined' && typeof DataService.getMarketData === 'function') {
            data = DataService.getMarketData(ticker, '1d', CFG.RANGE);
          }
        } catch (e) {
          console.warn('⚠️ [DIAG] Falha de dados para ' + ticker + ': ' + e.message);
        }
        var candles = (data && data.candles) ? data.candles : (Array.isArray(data) ? data : null);
        if (!candles || candles.length < 30) { semDados++; continue; }

        var tConnors = _backtestConnors(ticker, candles);
        var tDonchian = _backtestDonchian(ticker, candles);
        todosConnors = todosConnors.concat(tConnors);
        todosDonchian = todosDonchian.concat(tDonchian);
        processados++;
      }
      // Rate limit entre lotes (regra do projeto: >= 1000ms)
      if (bi + CFG.BATCH_SIZE < tickers.length) _pausa(CFG.PAUSA_LOTE_MS);
    }

    // 🔧 v1.4: FILTRO DE OUTLIERS — remove trades com retorno absurdo (eventos
    // corporativos / dados corrompidos) ANTES de estatizar. Sem isso, um único
    // trade de +1733% distorce o sumRet e engana a conclusão sobre a estratégia.
    var filtConnors = _filtrarOutliers(todosConnors);
    var filtDonchian = _filtrarOutliers(todosDonchian);
    var outliersConnors = filtConnors.removidos;
    var outliersDonchian = filtDonchian.removidos;
    todosConnors = filtConnors.validos;
    todosDonchian = filtDonchian.validos;

    if (outliersConnors.length > 0 || outliersDonchian.length > 0) {
      console.warn('🧹 [DIAG] Outliers removidos — Connors: ' + outliersConnors.length +
        ' | Donchian: ' + outliersDonchian.length +
        ' (teto ' + (CFG.OUTLIER_MAX_RETORNO * 100).toFixed(0) + '%)');
    }

    var stConnors = _estatisticas(todosConnors);
    var stDonchian = _estatisticas(todosDonchian);
    var opConnors = _calcularOportunidadePerdida(todosConnors, aprovadosRobo);
    var opDonchian = _calcularOportunidadePerdida(todosDonchian, aprovadosRobo);

    var resumo = {
      tickersAnalisados: processados,
      tickersSemDados: semDados,
      connors: {
        stats: stConnors, oportunidadePerdida: opConnors.custoPctAcumulado,
        tradesLucrativosPerdidos: opConnors.perdidos.length,
        outliersRemovidos: outliersConnors.length
      },
      donchian: {
        stats: stDonchian, oportunidadePerdida: opDonchian.custoPctAcumulado,
        tradesLucrativosPerdidos: opDonchian.perdidos.length,
        outliersRemovidos: outliersDonchian.length
      },
      aprovadosRobo: Object.keys(aprovadosRobo).length
    };

    _montarEescreverRelatorio(resumo, todosConnors, todosDonchian, opConnors.perdidos, opDonchian.perdidos,
      outliersConnors.concat(outliersDonchian));

    // 🔧 v1.1: persiste a série temporal (append) — 1 linha por estratégia.
    resumo.historicoPersistido = _persistirHistorico(resumo);

    console.log('✅ [DIAG] Concluído. Connors: ' + stConnors.n + ' trades (' + stConnors.winRate + '% WR) | Donchian: ' + stDonchian.n + ' trades (' + stDonchian.winRate + '% WR)');
    console.timeEnd('⏱️ Diagnóstico Oportunidade Perdida');
    return resumo;
  }

  /**
   * TESTE ISOLADO — roda as duas estratégias em PETR4 e imprime no console.
   * Serve para validar o motor sem depender da planilha inteira.
   */
  function TESTAR_ESTRATEGIAS() {
    var ticker = 'PETR4';
    console.log('🧪 [DIAG] Testando estratégias em ' + ticker + '...');
    var data = DataService.getMarketData(ticker, '1d', CFG.RANGE);
    var candles = (data && data.candles) ? data.candles : null;
    if (!candles) { console.error('❌ Sem candles para ' + ticker); return; }

    var tc = _backtestConnors(ticker, candles);
    var td = _backtestDonchian(ticker, candles);
    console.log('📊 Candles: ' + candles.length);
    console.log('📊 Connors IFR-2: ' + JSON.stringify(_estatisticas(tc)));
    console.log('📊 Donchian 20/10: ' + JSON.stringify(_estatisticas(td)));
    console.log('📋 Trades Connors:', JSON.stringify(tc));
    console.log('📋 Trades Donchian:', JSON.stringify(td));
  }

  /**
   * Lê os tickers/setups que o robô APROVOU (aba Resultados_Analise).
   * Retorna um mapa ticker -> {score, setup, tipoSetup}.
   * @returns {Object}
   */
  function _lerAprovadosRobo() {
    var mapa = {};
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sh = ss.getSheetByName(CFG.SHEET_ORIGEM_ROBO);
      if (!sh || sh.getLastRow() < 2) return mapa;
      var dados = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(26, sh.getLastColumn())).getValues();
      for (var i = 0; i < dados.length; i++) {
        var row = dados[i];
        var ticker = String(row[1] || '').trim().toUpperCase();
        if (!ticker) continue;
        mapa[ticker] = {
          score: _toNum(row[3]),
          setup: String(row[4] || ''),
          tipoSetup: String(row[21] || '')
        };
      }
    } catch (e) {
      console.warn('⚠️ [Diag] Falha ao ler ' + CFG.SHEET_ORIGEM_ROBO + ': ' + e.message);
    }
    return mapa;
  }

  /**
   * Compara cada trade do backtest com o que o robô aprovou para o ticker.
   * Um trade é "oportunidade perdida" quando foi LUCRATIVO e o robô não
   * tinha aquele ticker como aprovado/aprovável na mesma janela.
   * @param {Array<Object>} trades
   * @param {Object} aprovadosRobo Mapa ticker -> info
   * @returns {Object} {perdidos: Array, custoPctAcumulado: number}
   */
  function _calcularOportunidadePerdida(trades, aprovadosRobo) {
    var perdidos = [];
    var custoAcumulado = 0;
    for (var i = 0; i < trades.length; i++) {
      var t = trades[i];
      if (t.resultadoPct <= 0) continue; // só interessa o que teria dado lucro
      var info = aprovadosRobo[t.ticker];
      var roboCobriu = !!info; // o robô viu/mencionou o ticker
      if (!roboCobriu) {
        t.statusRobo = 'NÃO COBERTO';
        custoAcumulado += t.resultadoPct;
        perdidos.push(t);
      } else if (info.setup && /DESCART|AGUARDAR|RISCO ALTO|STOP INVI|SCORE BAIXO|TIMEOUT/i.test(info.setup)) {
        t.statusRobo = 'DESCARTADO PELO ROBO (' + info.setup + ')';
        custoAcumulado += t.resultadoPct;
        perdidos.push(t);
      }
    }
    // 🔧 v1.3: custoAcumulado é a soma de resultadoPct (decimal) — normaliza em %.
    return { perdidos: perdidos, custoPctAcumulado: _r4(custoAcumulado * 100) };
  }

  /**
   * Escreve (ou substitui) a aba de relatório do diagnóstico.
   * @param {Array<Array>} linhas Matriz bidimensional já formatada
   */
  function _escreverRelatorio(linhas) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sh = ss.getSheetByName(CFG.SHEET_DESTINO);
      if (!sh) sh = ss.insertSheet(CFG.SHEET_DESTINO);
      sh.clear();
      if (!linhas || linhas.length === 0) return;
      // Escrita em lote (regra do projeto: nunca setValues dentro de loop)
      sh.getRange(1, 1, linhas.length, linhas[0].length).setValues(linhas);
      sh.getRange(1, 1, 1, linhas[0].length).setFontWeight('bold');
      sh.setFrozenRows(1);
    } catch (e) {
      console.error('❌ [Diag] Falha ao escrever relatório: ' + e.message);
    }
  }

  /**
   * 🔧 v1.2: Converte o histórico (formato "long": 1 linha por estratégia/execução)
   * em uma tabela "wide" por data — Data | CONNORS_IFR2 | DONCHIAN_20_10 — para
   * alimentar um único gráfico de linhas com 2 séries.
   * Quando há múltiplas execuções no mesmo dia, mantém a ÚLTIMA de cada dia.
   * @param {Array<Array>} linhasHist Matriz da aba de histórico (sem cabeçalho)
   * @returns {Array<Array>} Tabela wide ordenada por data asc (com cabeçalho)
   */
  function _pivotarHistorico(linhasHist) {
    var COL = { DATA: 1, ESTRATEGIA: 5, OPORT_PERDIDA: 12 };
    var porData = {};   // data -> { CONNORS_IFR2, DONCHIAN_20_10 }
    var ordem = [];     // preserva a ordem de aparição

    for (var i = 0; i < linhasHist.length; i++) {
      var linha = linhasHist[i];
      if (!linha) continue;
      var data = String(linha[COL.DATA] || '').trim();
      var estrategia = String(linha[COL.ESTRATEGIA] || '').trim();
      if (!data || !estrategia) continue;
      var valor = _toNum(linha[COL.OPORT_PERDIDA]);

      if (!porData[data]) { porData[data] = {}; ordem.push(data); }
      porData[data][estrategia] = valor; // última execução do dia prevalece
    }

    var tabela = [['Data', 'CONNORS_IFR2', 'DONCHIAN_20_10']];
    for (var j = 0; j < ordem.length; j++) {
      var d = ordem[j];
      tabela.push([d, porData[d]['CONNORS_IFR2'] || 0, porData[d]['DONCHIAN_20_10'] || 0]);
    }
    return tabela;
  }

  /**
   * 🔧 v1.2 (MENU): Gera o gráfico de linhas da evolução do custo de oportunidade
   * a partir da aba 'Diag_Oportunidade_Hist'.
   *   1) lê o histórico; se vazio, orienta rodar o diagnóstico 2+ vezes;
   *   2) monta a tabela wide numa aba de apoio ('Diag_Oportunidade_Chart');
   *   3) (re)insere o gráfico de linhas com 2 séries (Connors + Donchian).
   * Idempotente: remove o gráfico anterior antes de recriar.
   * @returns {boolean}
   */
  function gerarGraficoHistorico() {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var hist = ss.getSheetByName(CFG.SHEET_HISTORICO);
      if (!hist || hist.getLastRow() < 2) {
        var msgVazio = '⚠️ A aba "' + CFG.SHEET_HISTORICO + '" está vazia. Rode o Diagnóstico de Oportunidade Perdida (menu 🧠 B3: CÉREBRO/AUTOMAÇÃO) ao menos 2 vezes para gerar a série temporal.';
        console.warn('[DIAG] ' + msgVazio);
        if (typeof b3UiAlert === 'function') b3UiAlert('Gráfico do Histórico', msgVazio);
        return false;
      }

      var dados = hist.getRange(2, 1, hist.getLastRow() - 1, _cabecalhoHistorico().length).getValues();
      var tabela = _pivotarHistorico(dados);

      if (tabela.length < 2) { // só cabeçalho -> nenhuma execução válida
        var msgPouco = '⚠️ Há apenas 1 ponto na série. Rode o diagnóstico mais vezes para o gráfico fazer sentido.';
        console.warn('[DIAG] ' + msgPouco);
        if (typeof b3UiAlert === 'function') b3UiAlert('Gráfico do Histórico', msgPouco);
        return false;
      }

      // Aba de apoio (dados "wide") — oculta para não poluir a UI.
      var chartData = ss.getSheetByName(CFG.SHEET_CHART_DATA);
      if (!chartData) chartData = ss.insertSheet(CFG.SHEET_CHART_DATA);
      chartData.clear();
      chartData.getRange(1, 1, tabela.length, tabela[0].length).setValues(tabela);
      try { chartData.hideSheet(); } catch (e) { /* já oculta ou sem permissão */ }

      // Objetivo: ancorar o gráfico na aba de histórico (onde o usuário olha).
      var destino = hist;
      // Remove gráficos anteriores com o mesmo título (idempotência).
      destino.getCharts().forEach(function (c) {
        try { if (c.getOptions().get('title') === CFG.CHART_TITULO) destino.removeChart(c); } catch (e) {}
      });

      var rangeGrafico = chartData.getRange(1, 1, tabela.length, tabela[0].length);
      var chart = destino.newChart()
        .setChartType(Charts.ChartType.LINE)
        .addRange(rangeGrafico)
        .setPosition(2, 16, 0, 0) // coluna P (16), abaixo do cabeçalho
        .setNumHeaders(1)
        .setOption('title', CFG.CHART_TITULO)
        .setOption('legend', { position: 'bottom' })
        .setOption('curveType', 'function')
        .setOption('width', 640)
        .setOption('height', 320)
        .setOption('vAxis', { title: 'Custo de oportunidade (soma %)' })
        .setOption('hAxis', { title: 'Data', format: 'yyyy-MM-dd' })
        .build();

      destino.insertChart(chart);
      console.log('📊 [DIAG] Gráfico gerado em "' + CFG.SHEET_HISTORICO + '" a partir de ' + (tabela.length - 1) + ' datas.');
      if (typeof b3UiAlert === 'function') {
        b3UiAlert('Gráfico do Histórico', '✅ Gráfico gerado na aba "' + CFG.SHEET_HISTORICO + '" (' + (tabela.length - 1) + ' datas).');
      }
      return true;
    } catch (e) {
      console.error('❌ [DIAG] Falha ao gerar gráfico do histórico: ' + e.message);
      if (typeof b3UiAlert === 'function') b3UiAlert('Gráfico do Histórico', '❌ Falha: ' + e.message);
      return false;
    }
  }

  return {
    CFG: CFG,
    _pivotarHistorico: _pivotarHistorico,
    gerarGraficoHistorico: gerarGraficoHistorico,
    _smaAte: _smaAte,
    _toNum: _toNum,
    _r2: _r2,
    _r4: _r4,
    _montarCandlesSemanais: _montarCandlesSemanais,
    _dataStr: _dataStr,
    _precoExecucao: _precoExecucao,
    _backtestConnors: _backtestConnors,
    _backtestDonchian: _backtestDonchian,
    _estatisticas: _estatisticas,
    _filtrarOutliers: _filtrarOutliers,
    _datasCoerentes: _datasCoerentes,
    _obterTickers: _obterTickers,
    _pausa: _pausa,
    _lerAprovadosRobo: _lerAprovadosRobo,
    _calcularOportunidadePerdida: _calcularOportunidadePerdida,
    _escreverRelatorio: _escreverRelatorio,
    _montarEescreverRelatorio: _montarEescreverRelatorio,
    _normalizarLargura: _normalizarLargura,
    // 🔧 v1.1: histórico (série temporal)
    _cabecalhoHistorico: _cabecalhoHistorico,
    _garantirAbaHistorico: _garantirAbaHistorico,
    _persistirHistorico: _persistirHistorico,
    executar: executar,
    TESTAR_ESTRATEGIAS: TESTAR_ESTRATEGIAS
  };
})();

/**
 * Ponte de menu — expõe o diagnóstico na interface da planilha.
 * Delega para o método público do módulo (definido no trecho seguinte do arquivo).
 */
function MENU_DIAGNOSTICO_OPORTUNIDADE_PERDIDA() {
  if (typeof DiagnosticoOportunidadePerdida !== 'undefined' &&
      typeof DiagnosticoOportunidadePerdida.executar === 'function') {
    DiagnosticoOportunidadePerdida.executar();
  } else {
    var msg = '⚠️ Módulo 60_Diagnostico_OportunidadePerdida não carregado.';
    try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.error(msg); }
  }
}

/**
 * Ponte de menu — gera o GRÁFICO da evolução do custo de oportunidade
 * a partir da aba 'Diag_Oportunidade_Hist' (série temporal).
 */
function MENU_GERAR_GRAFICO_DIAG() {
  if (typeof DiagnosticoOportunidadePerdida !== 'undefined' &&
      typeof DiagnosticoOportunidadePerdida.gerarGraficoHistorico === 'function') {
    DiagnosticoOportunidadePerdida.gerarGraficoHistorico();
  } else {
    var msg = '⚠️ Módulo 60_Diagnostico_OportunidadePerdida não carregado.';
    if (typeof b3UiAlert === 'function') b3UiAlert('Gráfico do Histórico', msg);
    else console.error(msg);
  }
}
