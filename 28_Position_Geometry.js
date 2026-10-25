/**
 * =============================================================================
 * 28_Position_Geometry.js — GEOMETRIA DE ENTRADA, RISCO E ZONA DE COMPRA (v1.0)
 * =============================================================================
 * PROBLEMA QUE ESTE MÓDULO RESOLVE
 * -----------------------------------------------------------------------------
 * Antes, cada módulo media o risco contra uma base de preço DIFERENTE:
 *   • 22_Core_Analyzers  → alvos e R/R medidos contra a ENTRADA (Fibo)
 *   • 41_Ranker          → position sizing medido contra o PREÇO ATUAL
 *   • 29_Oportunidades   → Risco % medido contra o PREÇO ATUAL
 *
 * Resultado (caso BPAC11): preço R$ 63,50, entrada Fibo R$ 53,98, stop R$ 52,84.
 *   - Risco anunciado ....... 13,94% (contra o preço)  → 100 ações = R$ 1.066
 *   - R/R anunciado ......... 2,00  (contra a entrada)
 *   - Tamanho sugerido ...... calculado com risco de R$ 1,14/ação → 9,35x errado
 *
 * A "Tríade BPAC11": três números coerentes entre si, mas incompatíveis com a
 * realidade da posição. Este módulo centraliza TODA a matemática de geometria
 * para que os três módulos consumam a MESMA verdade.
 *
 * ── CONCEITOS ────────────────────────────────────────────────────────────────
 *  • ZONA DE COMPRA: faixa [piso, teto] em torno da entrada ideal. Um único
 *    preço-ponto é irreal — o mercado frequentemente já ultrapassou o gatilho.
 *  • RISCO: SEMPRE medido contra o PREÇO DE REFERÊNCIA DA EXECUÇÃO
 *    (o preço que o usuário realmente paga hoje), não contra o gatilho Fibo.
 *  • R/R: SEMPRE medido contra o MESMO preço de referência do risco.
 *  • POSITION SIZING: idem — mesmo `precoReferencia`.
 *  • ALVO %: informado nas DUAS bases (entrada ideal e cotação atual) para que
 *    o usuário veja o retorno real da posição que ele está abrindo.
 *
 * @see scripts/test_geometria_posicao.js
 * =============================================================================
 */

var PositionGeometry = (function () {
  'use strict';

  var CFG = {
    /**
     * Meia-largura da zona de compra em torno da entrada ideal.
     * 1,5% é o mesmo limiar já usado em 29_Oportunidades_Processor para
     * considerar o preço "fora da zona".
     */
    ZONA_MEIA_LARGURA: 0.015,

    /**
     * Acima deste desvio (%), a entrada ideal é considerada "atrasada":
     * o R/R anunciado não se aplica mais à realidade da execução.
     */
    LIMITE_ATRASO: 0.03,

    /** R/R mínimo para considerar que o trade ainda vale a pena FORA da zona. */
    RR_MINIMO_FORA_ZONA: 1.5,

    /** Teto absoluto do risco acima do qual o trade é geometricamente inviável. */
    RISCO_MAXIMO_PCT: 0.15
  };

  // ---------------------------------------------------------------------------
  // Helpers numéricos
  // ---------------------------------------------------------------------------
  function _num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function _round2(v) {
    return Math.round((_num(v) + Number.EPSILON) * 100) / 100;
  }

  function _round4(v) {
    return Math.round((_num(v) + Number.EPSILON) * 10000) / 10000;
  }

  /**
   * Define o preço de referência da execução.
   * Regra: o preço que o usuário efetivamente desembolsa hoje (cotação atual).
   * Quando a cotação está ausente/inválida, cai para a entrada ideal.
   *
   * @param {number} precoAtual cotação atual.
   * @param {number} entradaIdeal gatilho (Fibo).
   * @return {number} preço de referência.
   */
  function _precoReferencia(precoAtual, entradaIdeal) {
    var p = _num(precoAtual);
    if (p > 0) return p;
    return _num(entradaIdeal);
  }

  /**
   * Calcula a ZONA DE COMPRA em torno da entrada ideal.
   * @param {number} entradaIdeal gatilho (Fibo).
   * @param {number} [meiaLargura] default CFG.ZONA_MEIA_LARGURA.
   * @return {{piso:number, teto:number, centro:number}} faixa de compra.
   */
  function zonaDeCompra(entradaIdeal, meiaLargura) {
    var centro = _num(entradaIdeal);
    var h = (meiaLargura === undefined || meiaLargura === null)
      ? CFG.ZONA_MEIA_LARGURA : _num(meiaLargura);
    if (centro <= 0) return { piso: 0, teto: 0, centro: 0 };
    return {
      piso: _round2(centro * (1 - h)),
      teto: _round2(centro * (1 + h)),
      centro: _round2(centro)
    };
  }

  /**
   * Geometria completa da posição — o ponto de entrada ÚNICO da matemática.
   *
   * @param {Object} p
   * @param {number} p.precoAtual    cotação atual.
   * @param {number} p.entradaIdeal  gatilho Fibo (centro da zona de compra).
   * @param {number} p.stop          stop loss (absoluto).
   * @param {number} p.alvo1         primeiro alvo (absoluto).
   * @param {number} p.alvo2         segundo alvo (absoluto).
   * @param {number} [p.stopDist]    distância de stop calculada pelo analisador.
   * @return {Object} geometria consolidada + diagnóstico.
   */
  function calcular(p) {
    p = p || {};

    var precoAtual = _num(p.precoAtual);
    var entradaIdeal = _num(p.entradaIdeal);
    var stop = _num(p.stop);
    var alvo1 = _num(p.alvo1);
    var alvo2 = _num(p.alvo2);
    var stopDistAnalisador = _num(p.stopDist);

    var ref = _precoReferencia(precoAtual, entradaIdeal);
    var zona = zonaDeCompra(entradaIdeal > 0 ? entradaIdeal : ref);

    // ── Risco: SEMPRE contra o preço de referência da execução ──────────────
    var riscoRS = (ref > 0 && stop > 0 && stop < ref) ? (ref - stop) : 0;
    var riscoPct = (ref > 0 && riscoRS > 0) ? (riscoRS / ref) : 0;

    // ── R/R: SEMPRE contra o MESMO preço de referência ─────────────────────
    // Guardamos o R/R do analisador apenas para auditoria/comparação.
    var rrReal = (riscoRS > 0 && alvo1 > ref) ? ((alvo1 - ref) / riscoRS) : 0;
    var rrAlvo2 = (riscoRS > 0 && alvo2 > ref) ? ((alvo2 - ref) / riscoRS) : 0;
    var rrAnalisador = (stopDistAnalisador > 0 && entradaIdeal > 0 && alvo1 > entradaIdeal)
      ? ((alvo1 - entradaIdeal) / stopDistAnalisador)
      : ((entradaIdeal > 0 && stop > 0 && stop < entradaIdeal && alvo1 > entradaIdeal)
        ? ((alvo1 - entradaIdeal) / (entradaIdeal - stop)) : 0);

    // ── Distância até os alvos nas DUAS bases ──────────────────────────────
    var alvo1PctEntrada = (entradaIdeal > 0 && alvo1 > 0) ? ((alvo1 - entradaIdeal) / entradaIdeal) : 0;
    var alvo2PctEntrada = (entradaIdeal > 0 && alvo2 > 0) ? ((alvo2 - entradaIdeal) / entradaIdeal) : 0;
    var alvo1PctAtual = (precoAtual > 0 && alvo1 > 0) ? ((alvo1 - precoAtual) / precoAtual) : 0;
    var alvo2PctAtual = (precoAtual > 0 && alvo2 > 0) ? ((alvo2 - precoAtual) / precoAtual) : 0;

    // ── Atraso da entrada: quanto o preço subiu além do gatilho ─────────────
    var atrasoPct = (entradaIdeal > 0 && precoAtual > 0)
      ? ((precoAtual - entradaIdeal) / entradaIdeal) : 0;

    // ── Posição do preço em relação à zona ─────────────────────────────────
    var dentroDaZona = (zona.piso > 0 && precoAtual > 0)
      ? (precoAtual >= zona.piso && precoAtual <= zona.teto) : false;
    var abaixoDaZona = (zona.piso > 0 && precoAtual > 0) ? (precoAtual < zona.piso) : false;
    var acimaDaZona = (zona.teto > 0 && precoAtual > 0) ? (precoAtual > zona.teto) : false;

    var entradaAtrasada = atrasoPct > CFG.LIMITE_ATRASO;
    var stopInvalido = (stop > 0 && ref > 0 && stop >= ref);
    var riscoExcessivo = riscoPct > CFG.RISCO_MAXIMO_PCT;

    // ── Diagnóstico textual (alimenta a coluna Observações) ────────────────
    var diagnostico = '';
    var severidade = 'OK';

    if (stopInvalido) {
      severidade = 'CRITICO';
      diagnostico = '⛔ STOP INVÁLIDO: R$ ' + _round2(stop).toFixed(2) +
        ' está ACIMA do preço de referência R$ ' + _round2(ref).toFixed(2) + '.';
    } else if (riscoExcessivo) {
      severidade = 'CRITICO';
      diagnostico = '🛑 RISCO DE ' + (riscoPct * 100).toFixed(1) +
        '% (máx. ' + (CFG.RISCO_MAXIMO_PCT * 100).toFixed(0) + '%) — stop longe demais da entrada.';
    } else if (entradaAtrasada) {
      if (rrReal >= CFG.RR_MINIMO_FORA_ZONA) {
        severidade = 'AVISO';
        diagnostico = '⚠️ FORA DA ZONA DE COMPRA em +' + (atrasoPct * 100).toFixed(1) +
          '% — alvos agora a +' + (alvo1PctAtual * 100).toFixed(1) + '% / +' +
          (alvo2PctAtual * 100).toFixed(1) + '%. R/R real: ' + _round2(rrReal).toFixed(2) +
          ' (anunciado ' + _round2(rrAnalisador || rrReal).toFixed(2) + ').';
      } else {
        severidade = 'CRITICO';
        diagnostico = '⛔ FORA DA ZONA E R/R REAL INSUFICIENTE (' +
          _round2(rrReal).toFixed(2) + ' < ' + CFG.RR_MINIMO_FORA_ZONA +
          '). Aguarde pullback até R$ ' + _round2(zona.teto).toFixed(2) + '.';
      }
    } else if (abaixoDaZona) {
      severidade = 'AVISO';
      diagnostico = '🟢 Preço ABAIXO da zona de compra — aguarde confirmação de suporte.';
    } else if (dentroDaZona) {
      severidade = 'OK';
      diagnostico = '✅ Preço DENTRO da zona de compra (R$ ' + _round2(zona.piso).toFixed(2) +
        ' – R$ ' + _round2(zona.teto).toFixed(2) + '). Geometria válida.';
    }

    return {
      precoReferencia: _round2(ref),
      entradaIdeal: _round2(entradaIdeal),
      zonaCompra: zona,

      riscoRS: _round2(riscoRS),
      riscoPct: _round4(riscoPct),

      rr: _round2(rrReal),
      rrAlvo2: _round2(rrAlvo2),
      rrAnalisador: _round2(rrAnalisador),
      alvo1PctEntrada: _round4(alvo1PctEntrada),
      alvo2PctEntrada: _round4(alvo2PctEntrada),
      alvo1PctAtual: _round4(alvo1PctAtual),
      alvo2PctAtual: _round4(alvo2PctAtual),

      atrasoPct: _round4(atrasoPct),
      dentroDaZona: dentroDaZona,
      abaixoDaZona: abaixoDaZona,
      acimaDaZona: acimaDaZona,
      entradaAtrasada: entradaAtrasada,
      stopInvalido: stopInvalido,
      riscoExcessivo: riscoExcessivo,

      severidade: severidade,
      diagnostico: diagnostico
    };
  }

  /**
   * Position sizing coerente: usa SEMPRE o risco medido contra o preço de
   * referência da execução (o preço que o usuário realmente paga).
   *
   * Antes (41_Ranker):
   *   distStop = preco - stop           → risco correto
   *   qtd      = (capital * risco) / distStop
   *   MAS o R/R exibido vinha de OUTRA base (a entrada Fibo) — daí a incoerência.
   * Aqui risco, R/R e quantidade compartilham a MESMA base.
   *
   * @param {Object} p
   * @param {number} p.capital          capital total.
   * @param {number} p.riscoPctAlvo     fração do capital a arriscar (ex.: 0.02).
   * @param {number} p.precoReferencia  preço de execução.
   * @param {number} p.stop             stop loss.
   * @param {number} [p.maxTradeAlloc]  teto por trade (fração do capital).
   * @param {number} [p.maxTotalAlloc]  teto agregado (fração do capital).
   * @param {number} [p.valorJaAlocado] valor já consumido da carteira teórica.
   * @return {Object} { quantidade, valorTrade, riscoRS, alocacao, motivo }.
   */
  function dimensionar(p) {
    p = p || {};

    var capital = _num(p.capital);
    var riscoPctAlvo = _num(p.riscoPctAlvo);
    var ref = _num(p.precoReferencia);
    var stop = _num(p.stop);
    var maxTrade = _num(p.maxTradeAlloc) || 0.25;
    var maxTotal = _num(p.maxTotalAlloc) || 0.95;
    var jaAlocado = _num(p.valorJaAlocado);

    var vazio = { quantidade: 0, valorTrade: 0, riscoRS: 0, alocacao: 0, riscoPct: 0, motivo: '' };

    if (capital <= 0 || ref <= 0) {
      vazio.motivo = 'capital ou preço inválido';
      return vazio;
    }
    if (stop <= 0 || stop >= ref) {
      vazio.motivo = 'geometria inválida (stop >= preço)';
      return vazio;
    }

    var riscoUnitario = ref - stop;                 // 🔑 MESMA base do R/R
    var riscoTotalAlvo = capital * riscoPctAlvo;

    // 1) Quantidade pelo risco
    var qtd = Math.floor(riscoTotalAlvo / riscoUnitario);

    // 2) Teto por trade
    var qtdMaxTrade = Math.floor((capital * maxTrade) / ref);
    var capouTrade = false;
    if (qtd > qtdMaxTrade) { qtd = qtdMaxTrade; capouTrade = true; }

    // 3) Teto agregado da carteira teórica
    var restante = Math.max(0, (capital * maxTotal) - jaAlocado);
    var qtdMaxRestante = Math.floor(restante / ref);
    var capouTotal = false;
    if (qtd > qtdMaxRestante) { qtd = qtdMaxRestante; capouTotal = true; }

    if (qtd < 0) qtd = 0;

    var valorTrade = qtd * ref;
    return {
      quantidade: qtd,
      valorTrade: _round2(valorTrade),
      riscoRS: _round2(qtd * riscoUnitario),
      riscoPct: _round4(riscoUnitario / ref),
      alocacao: capital > 0 ? _round4(valorTrade / capital) : 0,
      motivo: [capouTrade ? 'teto por trade' : '', capouTotal ? 'teto agregado' : '']
        .filter(Boolean).join(' + ')
    };
  }

  /**
   * Formata o diagnóstico para anexar na coluna Observações da aba Oportunidades.
   * @param {Object} geo resultado de `calcular`.
   * @return {string} texto pronto.
   */
  function textoObservacao(geo) {
    if (!geo || !geo.diagnostico) return '';
    var extra = '';
    if (geo.zonaCompra && geo.zonaCompra.teto > 0) {
      extra = ' | Zona de compra: R$ ' + geo.zonaCompra.piso.toFixed(2) +
        ' – R$ ' + geo.zonaCompra.teto.toFixed(2);
    }
    return geo.diagnostico + extra;
  }

  return {
    CFG: CFG,
    calcular: calcular,
    zonaDeCompra: zonaDeCompra,
    dimensionar: dimensionar,
    textoObservacao: textoObservacao
  };
})();
