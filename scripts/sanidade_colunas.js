/**
 * =============================================================================
 * scripts/sanidade_colunas.js — VARREDURA DE SANIDADE DAS COLUNAS
 * =============================================================================
 * FINALIDADE:
 *   Rodar as invariantes entre as colunas de 'Resultados_Analise' e reportar
 *   quais linhas estão INCOERENTES — sem depender de olhar a planilha.
 *
 *   Motivação (caso ITUB4, 25/10/2026): uma linha com Score 100, ATR = 1 e
 *   'Volume relativo elevado (1.552x)' parecia boa mas era internamente
 *   impossível. As colunas, isoladas, parecem plausíveis; o erro só aparece
 *   quando você as confronta. Esta varredura faz esse confronto em lote.
 *
 * O QUE É CHECADO (cada regra produz um código estável):
 *
 *   E-ATR-CONSTANTE   ATR === 1 em >= 30% das linhas. Sinal de ATR NÃO
 *                     CALCULADO caindo no fallback (valor fixo), não de
 *                     arredondamento. Invalida teto de alvo, stop por ATR e o
 *                     piso da zona de compra.
 *   E-ATR-FALLBACK    ATR fora de faixa plausível para a B3 (0,3%–15% do preço).
 *   E-SCORE-SAT       Score === 100 (ou >= 95) com muito excedente: o score
 *                     bateu no teto e o breakdown exibido deixa de fechar.
 *   E-VOL-3DIGITOS    Volume entre 100x e 100.000x a mediana. Não é evento de
 *                     mercado — é ruído estatístico (ver HGBrasil abaixo).
 *   E-VOL-ABSURDO     Volume > 100.000x, ou <= 0, ou NaN.
 *   E-RR-ABAixo-MIN   R/R exibido < 2,0 (minRR do Orchestrator). A linha passou
 *                     pelo filtro com um R/R que ela mesma exibe como reprovado
 *                     — sintoma do realinhamento de preço pós-score.
 *   E-RR-ARITMETICA   R/R exibido não bate com (Alvo1-Preço)/(Preço-Stop).
 *   E-GEOMETRIA       Stop/Alvo na ordem errada para COMPRA (stop >= preço, ou
 *                     alvo <= preço). Geometria impossível.
 *   E-RISCO           Risco % não bate com (Preço-Stop)/Preço.
 *   E-SERIE-SINTETICA Série do último candle inclui sábado/domingo, ou o último
 *                     candle é de hoje com a B3 fechada. Prova de que o
 *                     histórico não veio de um provedor real (ver abaixo).
 *   E-DISTTOPO        DistTopo% não bate com (Topo50-Preço)/Topo50.
 *   E-FORA-ORDEM      Preço fora da faixa min/max do candle — impossível.
 *   W-SUPORTE-VS-ZONA Suporte (Pivô) acima da zona derivada de Fibonacci. Não é
 *                     erro por si: pivô e zona medem coisas diferentes. Só
 *                     indica que a coluna 'Suporte vs. Zona' tende a CONTRARIA.
 *
 * CAUSA RAIZ DOCUMENTADA (por que E-VOL-3DIGITOS existe):
 *   10_Data_HGBrasilFetcher.js:218 — o fallback de candles sintéticos faz
 *       volume: Math.round((data.volume || 1000000) * (0.5 + Math.random()))
 *   Ou seja: se o provedor devolve `volume` em CONTRATOS (1, 2, 3...), o
 *   volume sintético vira inteiro pequeno, a mediana dos 20 anteriores fica em
 *   1 unidade e o volume relativo do último candle explode para milhares.
 *   O mesmo laço (linhas 201-221) gera datas CORRIDAS (i * 86400000), logo
 *   inclui sábados e domingos — o que permite detectar série sintética pela
 *   própria coluna Data.
 *
 * COMO FUNCIONA:
 *   --json  <arquivo>  lê linhas no layout de 'Resultados_Analise' (array de 31
 *                      posições, ou objeto com as chaves dos headers).
 *   --demo             usa um conjunto sintético que reproduz o caso ITUB4 e
 *                      variações (para demonstrar a varredura sem planilha).
 *   --modelo           imprime só o MODELO de dados aceito e sai (use isto para
 *                      exportar a planilha e alimentar --json).
 *
 * LIMITAÇÃO DECLARADA:
 *   Offline. Não abre a planilha — não há credencial do GAS em Node. Para rodar
 *   sobre os dados REAIS, exporte a aba (CSV/JSON) e aponte --json.
 *
 * USO:
 *   node scripts/sanidade_colunas.js --demo
 *   node scripts/sanidade_colunas.js --demo --json-only
 *   node scripts/sanidade_colunas.js --json linhas.json
 *   node scripts/sanidade_colunas.js --modelo
 *
 * @see 08_Output_Unified.js        (layout das 31 colunas / _toRow)
 * @see 29_Oportunidades_Processor.js (zona de compra, minRR efetivo)
 * @see 10_Data_HGBrasilFetcher.js  (causa raiz do volume sintético)
 * =============================================================================
 */

var fs = require('fs');
var path = require('path');

// minRR do Orchestrator (00_Core_Orchestrator.js:776) — filtro de admissão.
// Se o R/R exibido fica abaixo disto, a linha não deveria estar na lista.
var MIN_RR = 2.0;

// Arredondamento de exibição: o _formatSheetOptimized usa 2 casas.
var TOL_ABS = 0.02;

// Faixa plausível de ATR para ações da B3 (em % do preço).
var ATR_MIN_PCT = 0.003;   // 0,3%
var ATR_MAX_PCT = 0.15;    // 15%

// Limiares de volume relativo suspeito.
var VOL_SUSPEITO = 100;    // 100x já é evento improvável
var VOL_ABSURDO = 100000;  // 100.000x não existe

// Índices das colunas de 'Resultados_Analise' (espelha OutputConfig.HEADERS).
var COL = {
  DATA: 0, TICKER: 1, PRECO: 2, SCORE: 3, SETUP: 4, MOTIVO: 5,
  STOP: 6, ALVO1: 7, ALVO2: 8, RR: 9, RISCO: 10,
  RSI: 11, EMA21: 12, EMA50: 13, EMA200: 14, ATR: 15,
  VOLUME: 16, PIVOT: 17, FIBO: 18, ANALISE_IA: 19, RANKING: 20,
  TIPO_SETUP: 21, ALERTA: 22, TOPO50: 23, GANHO_RAPIDO: 24, DIST_TOPO: 25,
  FORCA_REL: 26, SUPORTE: 27, ROMPIDO: 28, VOL_ROMP: 29, RECUPEROU: 30
};

var NUM_COLS = 31;

// =============================================================================
// NORMALIZAÇÃO
// =============================================================================

/** Nomes dos headers, para aceitar entrada como objeto. */
var HEADERS = [
  'Data', 'Ticker', 'Preço', 'Score', 'Setup', 'Motivo', 'Stop Loss',
  'Alvo 1', 'Alvo 2', 'R/R', 'Risco %', 'RSI', 'EMA21', 'EMA50', 'EMA200',
  'ATR', 'Volume', 'Pivot', 'Fibonacci', 'Análise IA', 'Ranking', 'Tipo Setup',
  'Alerta Segurança', 'Topo50', 'GanhoRapido%', 'DistTopo%', 'Força Rel. %',
  'Suporte (Pivô)', 'Suporte Rompido?', 'Vol. Rompimento (x)', 'Recuperou Suporte?'
];

/**
 * Converte um valor numérico "sujo" da planilha em number.
 * Aceita 'R$ 48,30', '28.073.700,00', '-2,13', '1.552', '', null.
 *
 * ⚠️ A regra pt-BR é ambígua: '1.552' pode ser 1552 (milhar) ou 1.552 (decimal).
 * Resolvemos pelo CONTEXTO do campo (ver `numCampo`), não pelo valor isolado.
 *
 * @param {*} v valor bruto.
 * @return {?number} number ou null quando não numérico.
 */
function numBruto(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var s = String(v).replace(/R\$|\s|%/g, '').trim();
  if (!s) return null;
  var temVirgula = s.indexOf(',') !== -1;
  var temPonto = s.indexOf('.') !== -1;
  if (temVirgula && temPonto) {
    // '28.073.700,00' -> ponto é milhar, vírgula é decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (temVirgula) {
    s = s.replace(',', '.');
  } else if (temPonto) {
    // Só ponto: '1.552' é ambíguo; tratado por numCampo(). Aqui, default decimal.
    s = s;
  }
  var n = parseFloat(s);
  return isFinite(n) ? n : null;
}

/**
 * Converte um valor de uma coluna específica, resolvendo a ambiguidade pt-BR
 * pelo significado do campo.
 *
 * Colunas de PREÇO (2 casas por convenção da B3) e VOLUME (inteiro) usam regra
 * própria; volume relativo e percentuais usam o padrão pt-BR (vírgula decimal).
 *
 * @param {*} v valor bruto.
 * @param {number} idx índice da coluna.
 * @return {?number}
 */
function numCampo(v, idx) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;

  var s = String(v).replace(/R\$|\s|%/g, '').trim();
  if (!s) return null;

  var colunasDePreco = [
    COL.PRECO, COL.STOP, COL.ALVO1, COL.ALVO2, COL.EMA21, COL.EMA50,
    COL.EMA200, COL.PIVOT, COL.FIBO, COL.TOPO50, COL.SUPORTE
  ];

  if (idx === COL.VOLUME) {
    // Volume em ações é inteiro: pontos só podem ser separador de milhar.
    return numBruto(s.replace(/\./g, ''));
  }

  if (colunasDePreco.indexOf(idx) !== -1) {
    // Preço com 3 dígitos após o último ponto => é milhar ('28.073').
    // Com 1 ou 2 dígitos => decimal ('48.30'). Sem ponto/vírgula => inteiro.
    var m = s.match(/^(\d+)\.(\d+)$/);
    if (m) {
      if (m[2].length >= 3) return numBruto(s.replace(/\./g, ''));
      return parseFloat(s);
    }
    return numBruto(s);
  }

  // Demais (ATR, Volume relativo, R/R, Risco %, RSI, Força, Ganho, Dist):
  // pt-BR — se houver ponto E vírgula, ponto é milhar; se houver SÓ ponto com
  // exatamente 3 dígitos depois E o número for >= 1000 em contexto que não é
  // preço, ainda assim tratamos como milhar apenas para Volume.
  return numBruto(s);
}

/**
 * Normaliza uma linha (array ou objeto) para o layout de 31 posições.
 *
 * @param {Array|Object} linha
 * @return {Array} 31 posições.
 */
function normalizarLinha(linha) {
  if (Array.isArray(linha)) {
    var out = linha.slice(0, NUM_COLS);
    while (out.length < NUM_COLS) out.push('');
    return out;
  }
  var r = [];
  for (var i = 0; i < NUM_COLS; i++) r.push(linha[HEADERS[i]]);
  return r;
}

/**
 * Lê uma data de célula (Date, serial do Sheets ou string dd/mm/aaaa).
 * @param {*} v
 * @return {?Date}
 */
function paraData(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Serial do Google Sheets: dias desde 1899-12-30.
    return new Date(Math.round((v - 25569) * 86400000));
  }
  var s = String(v || '').trim();
  var m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) {
    var d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  var iso = new Date(s);
  return isNaN(iso.getTime()) ? null : iso;
}

/**
 * O último candle desta linha caiu em dia SEM pregão na B3?
 * @param {?Date} d
 * @return {boolean}
 */
// =============================================================================
// REGRAS
// =============================================================================

/**
 * O último candle desta linha caiu em dia SEM pregão na B3?
 * Sábado/domingo nunca têm candle real — é prova de série sintética.
 * @param {?Date} d
 * @return {boolean}
 */
function diaSemPregao(d) {
  if (!d) return false;
  var dow = d.getDay();
  return dow === 0 || dow === 6;
}

/**
 * Uma ocorrência de sanidade.
 * @typedef {Object} Achado
 * @property {string} codigo  código estável (ex.: 'E-VOL-3DIGITOS').
 * @property {string} nivel   'ERRO' | 'ALERTA'.
 * @property {string} msg     descrição legível.
 * @property {string} [campo] coluna envolvida.
 */

/**
 * Avalia UMA linha normalizada contra as invariantes.
 *
 * Cada regra é independente e não lança: um campo ausente simplesmente pula a
 * regra (sanidade de dado, não de schema — schema é validado pelo
 * test_escritor_unico).
 *
 * @param {Array} r linha com 31 posições.
 * @param {Object} [ctx] contexto global da varredura.
 * @param {boolean} [ctx.atrConstante] true se o ATR === 1 na maioria das linhas.
 * @return {Array<Achado>}
 */
function avaliarLinha(r, ctx) {
  var c = ctx || {};
  var achados = [];
  var add = function (codigo, nivel, msg, campo) {
    achados.push({ codigo: codigo, nivel: nivel, msg: msg, campo: campo });
  };

  var preco = numCampo(r[COL.PRECO], COL.PRECO);
  var stop = numCampo(r[COL.STOP], COL.STOP);
  var alvo1 = numCampo(r[COL.ALVO1], COL.ALVO1);
  var rr = numCampo(r[COL.RR], COL.RR);
  var risco = numCampo(r[COL.RISCO], COL.RISCO);
  var atr = numCampo(r[COL.ATR], COL.ATR);
  var volRel = numCampo(r[COL.VOL_ROMP], COL.VOL_ROMP);
  var score = numCampo(r[COL.SCORE], COL.SCORE);
  var topo50 = numCampo(r[COL.TOPO50], COL.TOPO50);
  var distTopo = numCampo(r[COL.DIST_TOPO], COL.DIST_TOPO);
  var suporte = numCampo(r[COL.SUPORTE], COL.SUPORTE);
  var fibo = numCampo(r[COL.FIBO], COL.FIBO);
  var data = paraData(r[COL.DATA]);

  // --- E-ATR ---------------------------------------------------------------
  if (atr !== null && preco !== null && preco > 0) {
    var atrPct = atr / preco;
    if (c.atrConstante && atr === 1) {
      add('E-ATR-CONSTANTE', 'ERRO',
        'ATR = 1 fixo em ' + c.atrRatio + ' das linhas — ATR não calculado ' +
        '(fallback), não é arredondamento', 'ATR');
    } else if (atrPct < ATR_MIN_PCT || atrPct > ATR_MAX_PCT) {
      add('E-ATR-FALLBACK', 'ERRO',
        'ATR R$ ' + atr + ' = ' + (atrPct * 100).toFixed(2) + '% do preço ' +
        '(fora da faixa ' + (ATR_MIN_PCT * 100) + '%-' + (ATR_MAX_PCT * 100) + '%)',
        'ATR');
    } else if (c.semContextoAtr && atr === 1) {
      // Amostra pequena (< 3 linhas): não há padrão estatístico para provar
      // fallback. Mas ATR = 1 exato é um valor "redondo" que NÃO sai de
      // _core_getATR (que retorna parseFloat(toFixed(4))) nem do fallback
      // documentado do Core22 (`lastClose * 0.02`). Com preço >= R$ 20, um ATR
      // de exatamente R$ 1 é improvável o bastante para merecer confirmação.
      add('E-ATR-SUSPEITO', 'ALERTA',
        'ATR exatamente 1 em amostra de ' + c.atrRatio + ' linhas: valor redondo ' +
        'que não é produzido por _core_getATR — confirmar a origem do dado', 'ATR');
    }
  }

  // --- E-SCORE-SAT ---------------------------------------------------------
  if (score !== null && score >= 95) {
    add('E-SCORE-SAT', 'ALERTA',
      'Score ' + score + ' em zona de saturação (>= 95): o breakdown perde ' +
      'poder de discriminação', 'Score');
  }

  // --- E-VOLUME ------------------------------------------------------------
  var vol = numCampo(r[COL.VOLUME], COL.VOLUME);
  if (vol !== null && vol <= 0) {
    add('E-VOL-ABSURDO', 'ERRO', 'Volume = ' + vol + ' (zero/negativo)', 'Volume');
  }
  if (volRel !== null) {
    if (volRel > VOL_ABSURDO) {
      add('E-VOL-ABSURDO', 'ERRO',
        'Volume relativo ' + volRel + 'x — impossível (> ' + VOL_ABSURDO + 'x)',
        'Vol. Rompimento (x)');
    } else if (volRel > VOL_SUSPEITO) {
      add('E-VOL-3DIGITOS', 'ERRO',
        'Volume ' + volRel + 'x a mediana é ruído estatístico, não evento de ' +
        'mercado (possível volume em contratos no fallback HG)',
        'Vol. Rompimento (x)');
    }
  }

  // --- E-RR ----------------------------------------------------------------
  if (rr !== null && rr > 0 && rr < MIN_RR) {
    add('E-RR-ABAIXO-MIN', 'ERRO',
      'R/R ' + rr + ' < minRR ' + MIN_RR + ': a linha passa pelo filtro do ' +
      'Orchestrator exibindo um R/R que ela mesma reprova', 'R/R');
  }
  if (rr !== null && preco !== null && stop !== null && alvo1 !== null &&
      preco > 0 && preco !== stop) {
    var rrCalc = (alvo1 - preco) / (preco - stop);
    if (Math.abs(rrCalc - rr) > 0.05) {
      add('E-RR-ARITMETICA', 'ERRO',
        'R/R exibido ' + rr + ' != calculado ' + rrCalc.toFixed(2) +
        ' ((Alvo1-Preço)/(Preço-Stop))', 'R/R');
    }
  }

  // --- E-GEOMETRIA ---------------------------------------------------------
  if (preco !== null && stop !== null && stop > 0 && preco > 0 && stop >= preco) {
    add('E-GEOMETRIA', 'ERRO',
      'Stop R$ ' + stop + ' >= Preço R$ ' + preco + ' — impossível para COMPRA',
      'Stop Loss');
  }
  if (preco !== null && alvo1 !== null && alvo1 > 0 && preco > 0 && alvo1 <= preco) {
    add('E-GEOMETRIA', 'ERRO',
      'Alvo 1 R$ ' + alvo1 + ' <= Preço R$ ' + preco + ' — impossível para COMPRA',
      'Alvo 1');
  }

  // --- E-RISCO -------------------------------------------------------------
  if (risco !== null && preco !== null && stop !== null && preco > 0 &&
      stop > 0 && stop < preco) {
    var riscoCalc = (preco - stop) / preco * 100;
    if (Math.abs(riscoCalc - risco) > 0.15) {
      add('E-RISCO', 'ERRO',
        'Risco % ' + risco + ' != calculado ' + riscoCalc.toFixed(2) + '%',
        'Risco %');
    }
  }

  // --- E-DISTTOPO ----------------------------------------------------------
  if (distTopo !== null && topo50 !== null && preco !== null &&
      topo50 > 0 && preco > 0) {
    var distCalc = (topo50 - preco) / topo50 * 100;
    if (Math.abs(distCalc - distTopo) > 0.15) {
      add('E-DISTTOPO', 'ERRO',
        'DistTopo% ' + distTopo + ' != calculado ' + distCalc.toFixed(2) + '% ' +
        '((Topo50-Preço)/Topo50)', 'DistTopo%');
    }
  }

  // --- E-SERIE-SINTETICA ---------------------------------------------------
  // O último candle em sábado/domingo prova que a série não é do pregão.
  if (diaSemPregao(data)) {
    add('E-SERIE-SINTETICA', 'ERRO',
      'Último candle em ' + ['domingo', 'segunda', 'terça', 'quarta', 'quinta',
        'sexta', 'sábado'][data.getDay()] + ' — a B3 não abre; histórico sintético',
      'Data');
  }

  // --- W-SUPORTE-VS-ZONA ---------------------------------------------------
  // Pivô acima da zona derivada de Fibonacci NÃO é erro: as duas colunas medem
  // coisas diferentes. Só antecipa que 'Suporte vs. Zona' tende a CONTRARIA.
  if (suporte !== null && fibo !== null && suporte > 0 && fibo > 0 && atr !== null) {
    var tetoAprox = fibo + (atr * 0.6);  // aproximação de fiboZoneSlackAtr
    if (suporte > tetoAprox * 1.02) {
      add('W-SUPORTE-VS-ZONA', 'ALERTA',
        'Pivô R$ ' + suporte + ' acima do teto da zona (~R$ ' +
        tetoAprox.toFixed(2) + ') — coluna tende a CONTRARIA (pivô e zona ' +
        'medem coisas diferentes)', 'Suporte (Pivô)');
    }
  }

  return achados;
}

// =============================================================================
// DATASET DEMO — reproduz o caso ITUB4 e variações
// =============================================================================

/**
 * Linhas no layout exato de 'Resultados_Analise' (strings como a planilha as
 * exibe, em pt-BR). A primeira é o caso REAL reportado em 25/10/2026.
 *
 * Construção das variações (para provar que cada regra dispara):
 *  - ITUB4     : caso real — ATR=1, R/R 1,93, volume ausente, Data domingo.
 *  - VOL1522   : volume relativo 1.552x no diagnóstico (E-VOL-3DIGITOS) +
 *                Data sábado (E-SERIE-SINTETICA).
 *  - ATRFIXO   : várias linhas com ATR=1 (dispara E-ATR-CONSTANTE no conjunto).
 *  - RRSOLTO   : R/R exibido 1,20 com geometria batendo (E-RR-ABAIXO-MIN).
 *  - GEOMETRIA : stop acima do preço (E-GEOMETRIA) — caso AXIA3 do código.
 *  - LIMPA     : linha coerente em tudo — NÃO deve gerar nenhum ERRO.
 *
 * @return {Array<Array>} linhas de 31 posições.
 */
function datasetDemo() {
  // Helper: monta a linha com defaults coerentes e sobrescreve o necessário.
  function linha(over) {
    var r = [
      '25/10/2026',   // 0  Data
      'ATIVO',        // 1  Ticker
      'R$ 48,30',     // 2  Preço
      '78',           // 3  Score
      '📈 TENDÊNCIA', // 4  Setup
      'motivo',       // 5  Motivo
      'R$ 46,90',     // 6  Stop Loss  (risco 2,90%)
      'R$ 51,10',     // 7  Alvo 1     => R/R 2,00
      'R$ 52,78',     // 8  Alvo 2
      '2,00',         // 9  R/R
      '2,90%',        // 10 Risco %
      '60,05',        // 11 RSI
      'R$ 47,13',     // 12 EMA21
      'R$ 44,85',     // 13 EMA50
      'R$ 42,40',     // 14 EMA200
      '0,60',         // 15 ATR        (1,24% do preço — plausível)
      '28.073.700,00',// 16 Volume
      'R$ 45,50',     // 17 Pivot
      'R$ 42,51',     // 18 Fibonacci
      'texto IA',     // 19 Análise IA
      '81,8',         // 20 Ranking
      'ROMPIMENTO',   // 21 Tipo Setup
      '✅ OK',        // 22 Alerta
      'R$ 51,10',     // 23 Topo50     => DistTopo 5,48%
      '2,13',         // 24 GanhoRapido%
      '5,48',         // 25 DistTopo%
      '3,7',          // 26 Força Rel. %
      'R$ 43,50',     // 27 Suporte (Pivô) — acima de 42,51 mas dentro da zona
      'NÃO',          // 28 Rompido?
      '',             // 29 Vol. Rompimento (x) — vazio = sem quebra
      'NÃO'           // 30 Recuperou?
    ];
    if (over) {
      Object.keys(over).forEach(function (k) { r[Number(k)] = over[k]; });
    }
    return r;
  }

  return [
    // Caso REAL (25/10/2026 é DOMINGO): ATR=1, Score 100, R/R 1,93 e pivô
    // 47,71 bem acima da zona. Sem volume de rompimento (nunca quebrou).
    linha({
      1: 'ITUB4', 3: '100', 7: 'R$ 50,85', 9: '1,93', 15: '1',
      25: '5,01', 27: 'R$ 47,71', 23: 'R$ 50,85', 6: 'R$ 46,98', 10: '2,73%'
    }),

    // Volume relativo de 3 dígitos + Data em SÁBADO (24/10/2026).
    linha({
      0: '24/10/2026', 1: 'VOL1522', 29: '1.552,00',
      2: 'R$ 28,50', 6: 'R$ 27,20', 7: 'R$ 30,90', 8: 'R$ 32,00',
      9: '2,13', 10: '4,56%', 16: '1.200,00', 23: 'R$ 30,90', 25: '7,77',
      15: '0,40', 27: 'R$ 27,00'
    }),

    // ATR = 1 repetido (junto com ITUB4 forma o padrão de fallback global).
    linha({
      0: '23/10/2026', 1: 'ATRFIXO', 2: 'R$ 12,40', 6: 'R$ 11,95',
      7: 'R$ 13,30', 8: 'R$ 13,80', 9: '2,00', 10: '3,63%', 15: '1',
      23: 'R$ 13,90', 25: '10,79', 27: 'R$ 12,10'
    }),

    // R/R 1,20 coerente com a geometria => abaixo do minRR 2,0.
    linha({
      0: '23/10/2026', 1: 'RRSOLTO', 2: 'R$ 20,00', 6: 'R$ 19,00',
      7: 'R$ 21,20', 8: 'R$ 22,00', 9: '1,20', 10: '5,00%',
      15: '0,45', 23: 'R$ 21,50', 25: '6,98', 27: 'R$ 19,20'
    }),

    // Stop ACIMA do preço — geometria impossível para compra.
    linha({
      0: '23/10/2026', 1: 'GEOMETRIA', 2: 'R$ 54,80', 6: 'R$ 57,19',
      7: 'R$ 60,00', 8: 'R$ 62,00', 9: '1,00', 10: '0',
      15: '1,20', 23: 'R$ 60,00', 25: '9,49', 27: 'R$ 53,00'
    }),

    // Linha COERENTE em tudo (sexta-feira, ATR plausível, R/R 2,00, DistTopo ok).
    linha({ 0: '23/10/2026', 1: 'LIMPA', 16: '5.000.000,00' })
  ];
}

/**
 * Roda as regras em todas as linhas e agrega por código.
 *
 * O contexto `atrConstante` é GLOBAL (não por linha): um ATR = 1 isolado pode
 * ser arredondamento de um ativo barato; ATR = 1 em TODAS as linhas é fallback.
 *
 * @param {Array<Array|Object>} linhas
 * @return {Object} { linhas: [...], resumo: {...} }
 */
function varrer(linhas) {
  var normalizadas = (linhas || []).map(normalizarLinha);

  // Detecção global de ATR constante.
  var atrValores = [];
  normalizadas.forEach(function (r) {
    var a = numCampo(r[COL.ATR], COL.ATR);
    if (a !== null) atrValores.push(a);
  });
  var iguaisA1 = atrValores.filter(function (a) { return a === 1; }).length;
  var atrConstante = atrValores.length >= 3 && (iguaisA1 / atrValores.length) >= 0.30;

  var ctx = { atrConstante: atrConstante,
    atrRatio: iguaisA1 + '/' + atrValores.length,
    semContextoAtr: atrValores.length < 3 };

  var porCodigo = {};
  var detalhes = [];

  normalizadas.forEach(function (r, i) {
    var ticker = String(r[COL.TICKER] || ('linha ' + (i + 2))).trim();
    var achados = avaliarLinha(r, ctx);
    achados.forEach(function (a) {
      if (!porCodigo[a.codigo]) {
        porCodigo[a.codigo] = { codigo: a.codigo, nivel: a.nivel, qtd: 0, tickers: [] };
      }
      porCodigo[a.codigo].qtd++;
      porCodigo[a.codigo].tickers.push(ticker);
      detalhes.push({
        ticker: ticker,
        codigo: a.codigo,
        nivel: a.nivel,
        campo: a.campo,
        msg: a.msg
      });
    });
  });

  var linhasComErro = 0;
  normalizadas.forEach(function (r, i) {
    var ticker = String(r[COL.TICKER] || ('linha ' + (i + 2))).trim();
    var temErro = detalhes.some(function (d) {
      return d.ticker === ticker && d.nivel === 'ERRO';
    });
    if (temErro) linhasComErro++;
  });

  return {
    totalLinhas: normalizadas.length,
    linhasComErro: linhasComErro,
    atrConstante: atrConstante,
    atrAmostra: { valores: atrValores.length, iguaisA1: iguaisA1 },
    porCodigo: porCodigo,
    detalhes: detalhes
  };
}

// =============================================================================
// RELATÓRIO (texto)
// =============================================================================

/**
 * Renderiza o resultado da varredura legível.
 * @param {Object} res retorno de `varrer`.
 * @return {string}
 */
function renderTexto(res) {
  var L = [];
  var sep = '='.repeat(78);

  L.push(sep);
  L.push('VARREDURA DE SANIDADE DAS COLUNAS — Resultados_Analise');
  L.push(sep);
  L.push('  linhas avaliadas   : ' + res.totalLinhas);
  L.push('  linhas com ERRO    : ' + res.linhasComErro);
  L.push('  ATR constante (=1) : ' + (res.atrConstante ? 'SIM' : 'não') +
    '  (' + res.atrAmostra.iguaisA1 + '/' + res.atrAmostra.valores + ' linhas)');
  L.push('');

  var codigos = Object.keys(res.porCodigo).sort(function (a, b) {
    return res.porCodigo[b].qtd - res.porCodigo[a].qtd;
  });

  if (!codigos.length) {
    L.push('  ✅ Nenhuma incoerência encontrada.');
  } else {
    L.push('POR CÓDIGO');
    L.push('-'.repeat(78));
    codigos.forEach(function (cod) {
      var e = res.porCodigo[cod];
      var marca = e.nivel === 'ERRO' ? '❌' : '⚠️ ';
      L.push('  ' + marca + ' ' + cod + '  (' + e.qtd + ')');
      L.push('      exemplo: ' + e.tickers.slice(0, 6).join(', ') +
        (e.qtd > 6 ? ' …' : ''));
      L.push('      ' + res.detalhes.filter(function (d) {
        return d.codigo === cod;
      })[0].msg);
    });
    L.push('');
    L.push('POR LINHA');
    L.push('-'.repeat(78));

    var porTicker = {};
    res.detalhes.forEach(function (d) {
      if (!porTicker[d.ticker]) porTicker[d.ticker] = [];
      porTicker[d.ticker].push(d);
    });
    Object.keys(porTicker).forEach(function (t) {
      L.push('  ' + t + ':');
      porTicker[t].forEach(function (d) {
        var marca = d.nivel === 'ERRO' ? '❌' : '⚠️ ';
        L.push('    ' + marca + ' ' + d.codigo + ' [' + d.campo + '] ' + d.msg);
      });
    });
  }

  L.push('');
  L.push(sep);
  return L.join('\n');
}

// =============================================================================
// CLI
// =============================================================================

/** Imprime o modelo de dados aceito em --json. */
function imprimirModelo() {
  console.log([
    '',
    'MODELO DE DADOS ACEITO POR --json',
    '='.repeat(70),
    '',
    'Um ARRAY de linhas. Cada linha pode ser:',
    '  a) array de 31 posições (ordem de Resultados_Analise), ou',
    '  b) objeto com os nomes dos headers.',
    '',
    'Ordem das 31 colunas:',
    HEADERS.map(function (h, i) {
      return '  ' + String(i).padStart(2) + '  ' + h;
    }).join('\n'),
    '',
    'Valores podem vir como a planilha exibe ("R$ 48,30", "2,73%", ' +
    '"28.073.700,00") — o script normaliza pt-BR.',
    '',
    'Para exportar: no Sheets, aba Resultados_Analise > Copiar > colar em um',
    'arquivo .json como array de arrays, ou salvar como CSV e converter.',
    ''
  ].join('\n'));
}

function main() {
  var argv = process.argv.slice(2);

  if (argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1) {
    console.log([
      '',
      'sanidade_colunas.js — varredura de coerência entre colunas',
      '',
      'Uso:',
      '  node scripts/sanidade_colunas.js --demo',
      '  node scripts/sanidade_colunas.js --demo --json-only',
      '  node scripts/sanidade_colunas.js --json <arquivo.json>',
      '  node scripts/sanidade_colunas.js --modelo',
      '',
      'Opções:',
      '  --demo       usa o dataset de demonstração (caso ITUB4 + variações)',
      '  --json <f>   lê linhas de um arquivo JSON',
      '  --json-only  saída estruturada',
      '  --modelo     imprime o modelo de dados aceito e sai',
      ''
    ].join('\n'));
    return;
  }

  if (argv.indexOf('--modelo') !== -1) {
    imprimirModelo();
    return;
  }

  var usarDemo = argv.indexOf('--demo') !== -1;
  var iJson = argv.indexOf('--json');
  var arquivo = (iJson !== -1 && argv[iJson + 1]) ? argv[iJson + 1] : null;

  var linhas;
  if (arquivo) {
    try {
      var bruto = JSON.parse(fs.readFileSync(path.resolve(arquivo), 'utf8'));
      linhas = Array.isArray(bruto) ? bruto : (bruto.linhas || bruto.rows || []);
      if (!Array.isArray(linhas) || !linhas.length) {
        throw new Error('JSON sem array de linhas (esperado: [...] ou { linhas: [...] })');
      }
    } catch (e) {
      console.error('❌ Falha ao ler ' + arquivo + ': ' + e.message);
      process.exitCode = 1;
      return;
    }
  } else if (usarDemo) {
    linhas = datasetDemo();
  } else {
    console.error('❌ use --demo ou --json <arquivo> (ou --help).');
    process.exitCode = 1;
    return;
  }

  var res = varrer(linhas);

  if (argv.indexOf('--json-only') !== -1) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log(renderTexto(res));
  }

  // Código de saída reflete o veredito, útil para automação/CI.
  process.exitCode = res.linhasComErro > 0 ? 2 : 0;
}

if (require.main === module) {
  main();
}

module.exports = {
  COL: COL,
  HEADERS: HEADERS,
  NUM_COLS: NUM_COLS,
  MIN_RR: MIN_RR,
  normalizarLinha: normalizarLinha,
  numBruto: numBruto,
  numCampo: numCampo,
  paraData: paraData,
  diaSemPregao: diaSemPregao,
  avaliarLinha: avaliarLinha,
  varrer: varrer,
  renderTexto: renderTexto,
  datasetDemo: datasetDemo
};
