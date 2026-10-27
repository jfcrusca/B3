/**
 * =============================================================================
 * scripts/diag_fibonacci.js — AUDITORIA DO ENCADEAMENTO FIBONACCI
 * =============================================================================
 * FINALIDADE:
 *   Para UM ticker, imprimir todo o encadeamento que o robô percorre entre o
 *   candle bruto e a linha final da aba 'Oportunidades':
 *
 *     1. RANGE        h50 / l50 / rangePct e a SANIDADE (5%–35%)
 *     2. NÍVEIS       38,2% / 50% / 61,8% e as extensões
 *     3. ZONA         61,8%→50% ± 0,6 ATR; preço dentro?
 *     4. CONFLUÊNCIA  EMA21/EMA50 a ≤2% do 61,8%
 *     5. SCORE        breakdown por bloco (quanto veio de Fibo)
 *     6. SETUP        nome identificado + por que
 *     7. ENTRADA      gatilho executável (banda ±3%) vs. cotação
 *     8. GEOMETRIA    stop < entrada < alvo
 *
 *   A pergunta que ele responde é: "por que este ativo NÃO entrou (ou entrou
 *   com este preço)?" — sem precisar ler 8 abas da planilha.
 *
 * COMO FUNCIONA:
 *   Executa o 22_Core_Analyzers.js REAL via scripts/_harness_core22.js (sandbox
 *   vm), não uma cópia da lógica. Se os parâmetros de CORE22_CFG mudarem, o
 *   diagnóstico acompanha automaticamente.
 *
 * LIMITAÇÃO DECLARADA:
 *   Offline. Não chama a B3. Use --demo (série sintética que reproduz o caso
 *   didático do guia) ou --csv para apontar um arquivo de candles exportado.
 *
 * USO:
 *   node scripts/diag_fibonacci.js --demo
 *   node scripts/diag_fibonacci.js --demo --json
 *   node scripts/diag_fibonacci.js --csv candles.csv --ticker PETR4
 *   node scripts/diag_fibonacci.js --demo --verbose   (mostra logs do Core22)
 *
 * FORMATO DO CSV: date,open,high,low,close,volume  (com cabeçalho)
 *
 * @see scripts/_harness_core22.js   (carrega o módulo 22 real)
 * @see 22_Core_Analyzers.js         (fonte da verdade de todos os números)
 * =============================================================================
 */

var fs = require('fs');
var path = require('path');
var core22 = require('./_harness_core22');

// Limite de banda para o gatilho virar preço executável — espelha
// OportunidadesProcessor.CONFIG.LIMITE_ENTRADA_FIBO (29_Oportunidades_Processor.js).
var LIMITE_ENTRADA_FIBO = 0.03;

var argv = process.argv.slice(2);

/**
 * Lê uma flag booleana da linha de comando.
 * @param {string} nome ex.: '--json'
 * @return {boolean}
 */
function temFlag(nome) {
  return argv.indexOf(nome) !== -1;
}

/**
 * Lê o valor de uma flag com argumento.
 * @param {string} nome ex.: '--csv'
 * @return {string|null}
 */
function valorFlag(nome) {
  var i = argv.indexOf(nome);
  if (i === -1 || i + 1 >= argv.length) return null;
  return argv[i + 1];
}

/**
 * Gera a série sintética do caso didático do guia:
 *   h50=60,71 / l50=43,86 (range 16,85 = 31,5%) / preço final 53,50.
 *
 * Construção: 60 candles subindo de l50 a h50 (o swing estrutural), seguidos
 * de candles de correção/consolidação em torno do preço final. Volume elevado
 * nos últimos candles para exercitar o bônus de volume no score.
 *
 * @param {number} [nFinal] candles de consolidação no fim (padrão 20).
 * @return {Array} candles no formato do projeto.
 */
function gerarSerieDemo(nFinal) {
  var H50 = 60.71;
  var L50 = 43.86;
  var PRECO = 53.50;
  // A janela do Fibo é `structureLookback` (60). Como a consolidação final entra
  // nessa janela, a perna de alta é desenhada para preencher as (60 − nf)
  // primeiras posições da janela: assim l50 = L50 exato e h50 = H50 exato,
  // reproduzindo o range do caso didático.
  var nf = nFinal || 12;
  var n = 60 - nf;
  var candles = [];
  var i, p;

  // Perna de alta: L50 -> H50 em (60 − nf) sessões. `high`/`low` colados no
  // `close` para que h50/l50 sejam exatamente H50/L50 (sem pavios extras).
  for (i = 0; i < n; i++) {
    p = L50 + ((H50 - L50) * (i / (n - 1)));
    candles.push({
      date: new Date(2025, 0, 1 + i),
      open: p,
      high: p,
      low: p,
      close: p,
      volume: 1000000 + (i * 8000)
    });
  }

  // Consolidação curta em torno de 53,50 (dentro da zona 61,8%→50%), com
  // oscilação de ±0,7% para produzir ATR saudável.
  for (i = 0; i < nf; i++) {
    var osc = (i % 4 === 0) ? 1.007 : (i % 4 === 2) ? 0.993 : 1.0;
    p = PRECO * osc;
    candles.push({
      date: new Date(2025, 1, 1 + i),
      open: p * 0.998,
      high: p * 1.005,
      low: p * 0.995,
      close: p,
      volume: 1300000
    });
  }

  return candles;
}

/**
 * Lê candles de um CSV (date,open,high,low,close,volume) com cabeçalho.
 *
 * Aceita separador `,` ou `;` e datas em ISO (`2025-01-10`) ou BR (`10/01/2025`).
 * Linhas inválidas são descartadas com aviso — não interrompem a leitura.
 *
 * @param {string} caminho caminho do CSV.
 * @return {Array} candles no formato do projeto.
 */
function lerCandlesCsv(caminho) {
  var abs = path.resolve(process.cwd(), caminho);
  if (!fs.existsSync(abs)) {
    throw new Error('CSV nao encontrado: ' + abs);
  }

  var linhas = fs.readFileSync(abs, 'utf8').split(/\r?\n/).filter(function (l) {
    return l.trim().length > 0;
  });
  if (linhas.length < 2) throw new Error('CSV vazio: ' + abs);

  var sep = linhas[0].indexOf(';') !== -1 ? ';' : ',';
  var cabecalho = linhas[0].split(sep).map(function (c) {
    return c.trim().toLowerCase();
  });
  var idx = {
    date: cabecalho.indexOf('date'),
    open: cabecalho.indexOf('open'),
    high: cabecalho.indexOf('high'),
    low: cabecalho.indexOf('low'),
    close: cabecalho.indexOf('close'),
    volume: cabecalho.indexOf('volume')
  };
  if (idx.close === -1) {
    throw new Error('CSV sem coluna "close". Colunas encontradas: ' + cabecalho.join(', '));
  }

  var candles = [];
  var descartadas = 0;
  for (var i = 1; i < linhas.length; i++) {
    var cols = linhas[i].split(sep);
    var close = Number(String(cols[idx.close]).replace(',', '.'));
    if (!isFinite(close) || close <= 0) { descartadas++; continue; }

    var high = idx.high !== -1 ? Number(String(cols[idx.high]).replace(',', '.')) : close;
    var low = idx.low !== -1 ? Number(String(cols[idx.low]).replace(',', '.')) : close;
    var open = idx.open !== -1 ? Number(String(cols[idx.open]).replace(',', '.')) : close;
    var vol = idx.volume !== -1 ? Number(String(cols[idx.volume]).replace(',', '.')) : 0;

    candles.push({
      date: idx.date !== -1 ? String(cols[idx.date]).trim() : new Date(2025, 0, 1 + i),
      open: isFinite(open) ? open : close,
      high: isFinite(high) ? high : close,
      low: isFinite(low) ? low : close,
      close: close,
      volume: isFinite(vol) ? vol : 0
    });
  }

  if (descartadas > 0) {
    console.warn('⚠️  ' + descartadas + ' linha(s) descartada(s) por close invalido.');
  }
  if (candles.length === 0) {
    throw new Error('CSV sem candles validos: ' + abs);
  }
  return candles;
}


/**
 * Monta o diagnóstico completo do encadeamento Fibonacci para um ticker.
 *
 * Tudo aqui é DERIVADO do que o Core22 real já calculou — nenhum número é
 * recalculado localmente, exceto as classificações de rótulo (dentro/fora da
 * zona, banda do gatilho), que não alteram decisão alguma.
 *
 * @param {Array} candles série de candles.
 * @param {Object} [opts] { ticker, verbose, ibovContext }
 * @return {Object} diagnóstico estruturado, pronto para texto ou JSON.
 */
function montarDiagnostico(candles, opts) {
  var o = opts || {};
  var ticker = o.ticker || 'DEMO';

  var saida = core22.analisar(candles, {
    ticker: ticker,
    verbose: !!o.verbose,
    ibovContext: o.ibovContext || null
  });

  var res = saida.resultado;
  if (!res) {
    throw new Error('Core22 retornou null para ' + ticker + ' (candles insuficientes?).');
  }

  var est = saida.estrutura || {};
  var dbg = res.riskDebug || {};
  var ind = res.indicators || {};
  var cfg = saida.cfg || {};

  var preco = Number(res.price) || 0;
  var fibo = Number(res.fiboPrice) || 0;

  // --- 1. RANGE / SANIDADE ------------------------------------------------
  var range50 = (est.h50 != null && est.l50 != null) ? (est.h50 - est.l50) : 0;
  var rangePct = est.rangePct != null ? est.rangePct : 0;
  var rangeStatus = est.fiboConfiavel === true ? 'OK'
    : (rangePct < (cfg.minRangePct || 0.05) ? 'ESTREITO' : 'EXCESSIVO');

  // --- 3. ZONA ------------------------------------------------------------
  var zonaPiso = est.zonaPiso;
  var zonaTeto = est.zonaTeto;
  var inZone = !!est.inFiboZone;
  var posicaoZona;
  if (inZone) {
    posicaoZona = 'DENTRO DA ZONA';
  } else if (preco > zonaTeto) {
    posicaoZona = 'ACIMA DA ZONA (ainda nao retraiu)';
  } else {
    posicaoZona = 'ABAIXO DA ZONA (retracao profunda)';
  }
  var distZonaPct = est.distZonaPct != null ? est.distZonaPct : 0;

  // --- 4. CONFLUÊNCIA -----------------------------------------------------
  var distEma21Pct = (fibo > 0 && ind.ema21) ? (Math.abs(fibo - ind.ema21) / fibo) : null;
  var distEma50Pct = (fibo > 0 && ind.ema50) ? (Math.abs(fibo - ind.ema50) / fibo) : null;
  var limiteConfl = cfg.confluenceMaxDist || 0.02;
  var ema21Proxima = distEma21Pct != null && distEma21Pct <= limiteConfl;
  var ema50Proxima = distEma50Pct != null && distEma50Pct <= limiteConfl;

  // --- 7. ENTRADA EXECUTÁVEL ---------------------------------------------
  var dentroBanda = fibo > 0 && preco >= fibo * (1 - LIMITE_ENTRADA_FIBO) &&
    preco <= fibo * (1 + LIMITE_ENTRADA_FIBO);
  var entradaSugerida = dentroBanda ? fibo : preco;
  var gapGatilhoPct = fibo > 0 ? ((preco - fibo) / fibo) : 0;

  // --- 8. GEOMETRIA -------------------------------------------------------
  var stop = Number(res.stopLoss) || 0;
  var t1 = Number(res.target1) || 0;
  var t2 = Number(res.target2) || 0;
  var geometriaOk = (stop > 0 && entradaSugerida > 0 && t1 > 0) &&
    (stop < entradaSugerida) && (entradaSugerida < t1) && (t1 <= t2 + 1e-9);

  var diag = {
    ticker: ticker,
    candles: candles.length,
    preco: preco,

    range: {
      lookback: est.lookbackUsado != null ? est.lookbackUsado : cfg.structureLookback,
      h50: est.h50,
      l50: est.l50,
      range50: Number(range50.toFixed(4)),
      rangePct: rangePct,
      rangePctFmt: (rangePct * 100).toFixed(1) + '%',
      faixaSanidade: ((cfg.minRangePct || 0) * 100) + '% a ' + ((cfg.maxRangePct || 0) * 100) + '%',
      fiboConfiavel: !!est.fiboConfiavel,
      status: rangeStatus,
      motivo: est.motivoFibo || ''
    },

    niveis: {
      fibo382: est.fibo382,
      fibo50: est.fibo50,
      fibo618: est.fibo618,
      ext1: dbg.h50_ext1 != null ? dbg.h50_ext1 : null,
      ext2: dbg.h50_ext2 != null ? dbg.h50_ext2 : null
    },

    zona: {
      piso: zonaPiso,
      teto: zonaTeto,
      centro: est.centroZona,
      larguraAtr: cfg.fiboZoneSlackAtr,
      atr: ind.atr,
      inFiboZone: inZone,
      posicao: posicaoZona,
      distCentroPct: distZonaPct,
      distCentroFmt: (distZonaPct * 100).toFixed(2) + '%'
    },

    confluencia: {
      temConfluencia: !!est.temConfluencia,
      limitePct: limiteConfl,
      ema21: ind.ema21,
      ema50: ind.ema50,
      distEma21Pct: distEma21Pct,
      distEma50Pct: distEma50Pct,
      ema21Proxima: ema21Proxima,
      ema50Proxima: ema50Proxima
    },

    forca: {
      adx: ind.adx,
      rsi: ind.rsi,
      volumeRelativo: ind.volumeRelativo,
      volumeStatus: res.volumeStatus
    },

    score: res.score,
    setup: res.setup,
    estrategiaEntrada: res.estrategiaEntrada,

    entrada: {
      fiboPrice: fibo,
      dentroBanda: dentroBanda,
      limiteBanda: LIMITE_ENTRADA_FIBO,
      entradaSugerida: entradaSugerida,
      fonte: dentroBanda ? 'FIBO' : 'COTACAO',
      gapGatilhoPct: gapGatilhoPct,
      gapGatilhoFmt: (gapGatilhoPct * 100).toFixed(2) + '%'
    },

    geometria: {
      stop: stop,
      alvo1: t1,
      alvo2: t2,
      rr: res.rr,
      riscoPercent: res.riscoPercent,
      ok: geometriaOk,
      stopSource: dbg.stopSource || null,
      alvoSource: dbg.alvoSource || null,
      stopEmAtr: dbg.stopEmAtr != null ? dbg.stopEmAtr : null,
      alvo1EmAtr: dbg.alvo1EmAtr != null ? dbg.alvo1EmAtr : null,
      reancoradoPorAtr: !!dbg.reancoradoPorAtr,
      stopCortadoPorAtr: !!dbg.stopCortadoPorAtr
    },

    warns: saida.warns
  };

  diag.veredito = construirVeredito(diag);
  return diag;
}

/**
 * Sintetiza em uma frase por que o ativo entrou / não entrou.
 *
 * A ordem das checagens espelha a ordem real de decisão do pipeline:
 * sanidade do range -> zona -> gatilho -> setup -> geometria.
 *
 * @param {Object} d diagnóstico de montarDiagnostico().
 * @return {Object} { codigo, texto, bloqueios[] }.
 */
function construirVeredito(d) {
  var bloqueios = [];

  if (!d.range.fiboConfiavel) {
    bloqueios.push('Range de ' + d.range.rangePctFmt + ' fora da faixa ' +
      d.range.faixaSanidade + ' — alvos/stop deveriam vir do ATR' +
      (d.geometria.reancoradoPorAtr ? ' (reancoracao APLICADA)' : ' (reancoracao NAO aplicada)'));
  }
  if (!d.zona.inFiboZone) {
    bloqueios.push('Preco fora da zona de compra (' + d.zona.piso + ' a ' + d.zona.teto + '): ' + d.zona.posicao);
  }
  if (!d.entrada.dentroBanda) {
    bloqueios.push('Gatilho nao executavel: preco a ' + d.entrada.gapGatilhoFmt +
      ' do Fibo (banda +/-' + (d.entrada.limiteBanda * 100) + '%) — entrada vira a cotacao');
  }
  if (d.setup && String(d.setup).indexOf('RISCO ALTO') !== -1) {
    bloqueios.push('Setup vetado por R/R insuficiente (' + d.geometria.rr + ')');
  }
  if (!d.geometria.ok) {
    bloqueios.push('Geometria invalida: exige stop < entrada < alvo1 (stop ' + d.geometria.stop +
      ' | entrada ' + Number(d.entrada.entradaSugerida.toFixed(2)) + ' | alvo1 ' + d.geometria.alvo1 + ')');
  }

  var codigo, texto;
  if (bloqueios.length === 0) {
    codigo = 'ENTRAVEL';
    texto = 'Setup completo: na zona, com confluencia, gatilho executavel e geometria valida.';
  } else if (bloqueios.length >= 3) {
    codigo = 'DESCARTADO';
    texto = 'Multiplos bloqueios: o Fibonacci nao sustenta entrada neste ativo hoje.';
  } else if (!d.zona.inFiboZone && d.range.fiboConfiavel && bloqueios.length === 1) {
    codigo = 'AGUARDAR_RETRACAO';
    texto = 'Estrutura saudavel; falta apenas o preco retrair ate a zona.';
  } else {
    codigo = 'PARCIAL';
    texto = 'Alguns criterios atendidos, mas faltam ' + bloqueios.length + ' condicao(oes).';
  }

  return { codigo: codigo, texto: texto, bloqueios: bloqueios };
}

// ---------------------------------------------------------------------------
// RENDERIZAÇÃO EM TEXTO
// ---------------------------------------------------------------------------

/** Formata número com casas decimais fixas; '—' se ausente. */
function fmt(v, dec) {
  if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return '—';
  var n = Number(v);
  if (!isFinite(n)) return '—';
  return n.toFixed(dec == null ? 2 : dec);
}

/** Formata percentual a partir de decimal (0.02 -> "2.00%"). */
function pct(v, dec) {
  if (v == null || !isFinite(Number(v))) return '—';
  return (Number(v) * 100).toFixed(dec == null ? 2 : dec) + '%';
}

/** Marca ok/falha com símbolo. */
function marca(cond) {
  return cond ? '✅' : '❌';
}

/** Linha de seção. */
function secao(titulo) {
  return '\n' + titulo + '\n' + '─'.repeat(66);
}

/**
 * Renderiza o diagnóstico em texto legível no terminal.
 * @param {Object} d diagnóstico de montarDiagnostico().
 * @return {string}
 */
function renderTexto(d) {
  var L = [];

  L.push('');
  L.push('═'.repeat(66));
  L.push('  DIAGNÓSTICO FIBONACCI — ' + d.ticker);
  L.push('  Preço: R$ ' + fmt(d.preco) + '   |   Candles: ' + d.candles);
  L.push('═'.repeat(66));

  // 1. RANGE
  L.push(secao('1. ESTRUTURA (range de ' + d.range.lookback + ' sessões)'));
  L.push('   Topo (h50)      R$ ' + fmt(d.range.h50));
  L.push('   Fundo (l50)     R$ ' + fmt(d.range.l50));
  L.push('   Range           R$ ' + fmt(d.range.range50) + '  (' + d.range.rangePctFmt + ' do preço)');
  L.push('   Faixa sadia     ' + d.range.faixaSanidade);
  L.push('   Confiável?      ' + marca(d.range.fiboConfiavel) + '  ' + d.range.status);
  if (d.range.motivo) L.push('   ⚠️  ' + d.range.motivo);

  // 2. NÍVEIS
  L.push(secao('2. NÍVEIS DE RETRAÇÃO (calculados a partir de h50)'));
  L.push('   38,2%   R$ ' + fmt(d.niveis.fibo382) + '   (descarte: correção rasa demais)');
  L.push('   50,0%   R$ ' + fmt(d.niveis.fibo50) + '   ← teto da zona');
  L.push('   61,8%   R$ ' + fmt(d.niveis.fibo618) + '   ← âncora / coluna "Fibonacci"');
  L.push('   Ext+27,2% R$ ' + fmt(d.niveis.ext1) + '   (alvo de extensão)');
  L.push('   Ext+61,8% R$ ' + fmt(d.niveis.ext2) + '   (alvo de extensão)');

  // 3. ZONA
  L.push(secao('3. ZONA DE COMPRA (61,8% → 50% ± ' + d.zona.larguraAtr + ' ATR)'));
  L.push('   ATR        R$ ' + fmt(d.zona.atr));
  L.push('   Piso       R$ ' + fmt(d.zona.piso) + '   (fibo618 − ' + d.zona.larguraAtr + '×ATR)');
  L.push('   Teto       R$ ' + fmt(d.zona.teto) + '   (fibo50  + ' + d.zona.larguraAtr + '×ATR)');
  L.push('   Centro     R$ ' + fmt(d.zona.centro));
  L.push('   Preço      R$ ' + fmt(d.preco) + '  →  ' + marca(d.zona.inFiboZone) + ' ' + d.zona.posicao);
  L.push('   Dist. centro ' + d.zona.distCentroFmt + '  (usado no score sistêmico)');

  // 4. CONFLUÊNCIA
  L.push(secao('4. CONFLUÊNCIA COM MÉDIAS (limite ' + pct(d.confluencia.limitePct, 0) + ' do 61,8%)'));
  L.push('   EMA21   R$ ' + fmt(d.confluencia.ema21) + '   distância ' + pct(d.confluencia.distEma21Pct) + '  ' + marca(d.confluencia.ema21Proxima));
  L.push('   EMA50   R$ ' + fmt(d.confluencia.ema50) + '   distância ' + pct(d.confluencia.distEma50Pct) + '  ' + marca(d.confluencia.ema50Proxima));
  L.push('   Confluência? ' + marca(d.confluencia.temConfluencia) +
    '  (exige zona + EMA próxima => +25 no score)');

  // 5. FORÇA
  L.push(secao('5. FORÇA E FLUXO'));
  L.push('   ADX       ' + fmt(d.forca.adx));
  L.push('   RSI       ' + fmt(d.forca.rsi));
  L.push('   Volume    ' + fmt(d.forca.volumeRelativo) + 'x  (' + (d.forca.volumeStatus || '—') + ')');

  // 6. SCORE / SETUP
  L.push(secao('6. SCORE E SETUP IDENTIFICADO'));
  L.push('   Score     ' + fmt(d.score) + ' / 100');
  L.push('   Setup     ' + (d.setup || '—'));
  L.push('   Estratégia de entrada: ' + (d.estrategiaEntrada || '—'));

  // 7. ENTRADA
  L.push(secao('7. GATILHO EXECUTÁVEL (banda ±' + (d.entrada.limiteBanda * 100) + '% do Fibo)'));
  L.push('   Fibo (61,8%)     R$ ' + fmt(d.entrada.fiboPrice));
  L.push('   Gap até o Fibo   ' + d.entrada.gapGatilhoFmt);
  L.push('   Dentro da banda? ' + marca(d.entrada.dentroBanda));
  L.push('   Entrada Sugerida R$ ' + fmt(d.entrada.entradaSugerida) + '   [fonte: ' + d.entrada.fonte + ']');

  // 8. GEOMETRIA
  L.push(secao('8. GEOMETRIA (stop < entrada < alvo1 ≤ alvo2)'));
  L.push('   Stop     R$ ' + fmt(d.geometria.stop) + '   (fonte: ' + (d.geometria.stopSource || '—') +
    (d.geometria.stopEmAtr != null ? ', ' + d.geometria.stopEmAtr + ' ATR' : '') + ')');
  L.push('   Alvo 1   R$ ' + fmt(d.geometria.alvo1) + '   (fonte: ' + (d.geometria.alvoSource || '—') +
    (d.geometria.alvo1EmAtr != null ? ', ' + d.geometria.alvo1EmAtr + ' ATR' : '') + ')');
  L.push('   Alvo 2   R$ ' + fmt(d.geometria.alvo2));
  L.push('   R/R      ' + fmt(d.geometria.rr) + '   |   Risco ' + fmt(d.geometria.riscoPercent) + '%');
  L.push('   Válida?  ' + marca(d.geometria.ok));
  if (d.geometria.reancoradoPorAtr) {
    L.push('   🔧 Reancorado no ATR (range fora da faixa sadia)');
  }

  // VEREDITO
  L.push(secao('VEREDITO: ' + d.veredito.codigo));
  L.push('   ' + d.veredito.texto);
  if (d.veredito.bloqueios.length > 0) {
    L.push('');
    L.push('   Bloqueios detectados:');
    d.veredito.bloqueios.forEach(function (b, i) {
      L.push('   ' + (i + 1) + '. ' + b);
    });
  }

  if (d.warns && d.warns.length > 0) {
    L.push(secao('AVISOS DO CORE22 (' + d.warns.length + ')'));
    d.warns.slice(0, 8).forEach(function (w) {
      L.push('   ⚠️  ' + w);
    });
    if (d.warns.length > 8) L.push('   ... +' + (d.warns.length - 8) + ' aviso(s)');
  }

  L.push('');
  L.push('═'.repeat(66));
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

/** Imprime o cabeçalho de uso. */
function mostrarAjuda() {
  console.log([
    '',
    'diag_fibonacci.js — auditoria do encadeamento Fibonacci do B3-v10',
    '',
    'Uso:',
    '  node scripts/diag_fibonacci.js --demo',
    '  node scripts/diag_fibonacci.js --demo --json',
    '  node scripts/diag_fibonacci.js --demo --verbose',
    '  node scripts/diag_fibonacci.js --csv <arquivo> [--ticker ATIVO]',
    '',
    'Opções:',
    '  --demo       usa a série sintética didática (h50 60,71 / l50 43,86 / preço 53,50)',
    '  --csv <arq>  lê candles de um CSV: date,open,high,low,close,volume',
    '  --ticker X   rótulo do ativo no relatório',
    '  --json       saída estruturada (para diff/pipe)',
    '  --verbose    repassa os logs internos do 22_Core_Analyzers.js',
    '  --help       esta ajuda',
    ''
  ].join('\n'));
}

function main() {
  if (temFlag('--help') || temFlag('-h')) {
    mostrarAjuda();
    return;
  }

  var csv = valorFlag('--csv');
  var usarDemo = temFlag('--demo') || !csv;
  var ticker = valorFlag('--ticker') || (csv ? path.basename(csv, '.csv').toUpperCase() : 'DEMO');
  var querJson = temFlag('--json');
  var verbose = temFlag('--verbose');

  var candles;
  try {
    candles = usarDemo ? gerarSerieDemo(20) : lerCandlesCsv(csv);
  } catch (e) {
    console.error('❌ Falha ao carregar candles: ' + e.message);
    process.exitCode = 1;
    return;
  }

  // O Core22 exige 50+ candles; abaixo disso o diagnóstico não representa nada.
  if (candles.length < 50) {
    console.error('❌ Série com ' + candles.length + ' candles. O Core22 exige no mínimo 50 ' +
      '(structureLookback padrão = 60). Forneça mais histórico.');
    process.exitCode = 1;
    return;
  }

  var diag;
  try {
    diag = montarDiagnostico(candles, { ticker: ticker, verbose: verbose });
  } catch (e) {
    console.error('❌ Falha ao executar o Core22: ' + e.message);
    if (verbose) console.error(e.stack);
    process.exitCode = 1;
    return;
  }

  if (querJson) {
    console.log(JSON.stringify(diag, null, 2));
  } else {
    console.log(renderTexto(diag));
  }

  if (usarDemo && !querJson) {
    console.log('ℹ️  Série DEMO (sintética). Para dado real: exporte candles em CSV e use --csv.');
  }

  // Código de saída reflete o veredito, útil para automação/CI.
  if (diag.veredito.codigo === 'ENTRAVEL') process.exitCode = 0;
  else if (diag.veredito.codigo === 'DESCARTADO') process.exitCode = 2;
  else process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  gerarSerieDemo: gerarSerieDemo,
  lerCandlesCsv: lerCandlesCsv,
  montarDiagnostico: montarDiagnostico,
  construirVeredito: construirVeredito,
  renderTexto: renderTexto,
  LIMITE_ENTRADA_FIBO: LIMITE_ENTRADA_FIBO
};
