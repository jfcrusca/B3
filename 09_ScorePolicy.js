/**
 * =============================================================================
 * 09_ScorePolicy.js — POLÍTICA ÚNICA DE CONSOLIDAÇÃO DE SCORE (B2)
 * =============================================================================
 * PROBLEMA (B2): o mesmo ativo exibia ATÉ 4 valores diferentes rotulados "Score",
 * porque quatro módulos aplicavam blends matemáticos distintos e sobrescreviam
 * `op.score` em sequência:
 *
 *   1. 22_Core_Analyzers  → score técnico puro           (ex.: 76)
 *   2. 08_AI_Ensemble     → 0.4*tech + 0.6*ia            (ex.: 52) [fantasma]
 *   3. AIEnsemble.analisar→ blend dinâmico GEMINI/DEEP  (recálculo)
 *   4. 34_DecisionEngine  → 0.7*tech + 0.3*ia            (ex.: 69)
 *
 * RESULTADO: técnico 76 / IA 35 / ensemble 52 / final 69 — números incoerentes
 * para o MESMO ativo, sem rastreabilidade.
 *
 * SOLUÇÃO: uma FONTE ÚNICA DE VERDADE. O motor deste sistema é o TÉCNICO
 * (calibrado no v22.13); a IA é um MODIFICADOR LIMITADO (±cap pts), nunca 30%
 * a 60% do peso. A fórmula canônica é:
 *
 *     scoreFinal = clamp(  scoreTecnicoPenalizado  +  ajusteIA  )
 *     ajusteIA   = round( (scoreIA - 50) * 0.30 )   →  ±15 pts no extremo
 *
 * Pacote de saída (contrato estável para Sheets/Ranker/UI):
 *   {
 *     scoreFinal,   // canônico — É o número exibido como "Score"
 *     scoreTecnico, // entrada técnica (após penalizações do DecisionEngine)
 *     scoreIA,      // IA crua (0-100) ou null quando indisponível
 *     ajusteIA,     // delta aplicado pela IA
 *     origemIA,     // 'IA' | 'FALLBACK'
 *     motivo        // string curta para auditoria/Coluna Observações
 *   }
 *
 * Compatível com Google Apps Script V8 (sem import/export; escopo global).
 * =============================================================================
 */

var ScorePolicy = (function () {
  'use strict';

  // -------------------------------------------------------------------------
  // CONFIG (via CONFIG global com fallback; NUNCA hardcode credenciais)
  // -------------------------------------------------------------------------
  function _cfg(key, fallback) {
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function')
      ? CONFIG.get(key, fallback)
      : fallback;
  }

  /** Peso do desvio da IA em relação ao neutro (0.30 → no máx ±15 pts). */
  function _pesoIA() {
    var w = Number(_cfg('SCORE_POLICY_IA_WEIGHT_SWING', 0.30));
    return isFinite(w) && w >= 0 ? w : 0.30;
  }

  /** Valor neutro da IA (ponto de equilíbrio, acima/abaixo empurra o score). */
  function _neutroIA() {
    var n = Number(_cfg('SCORE_POLICY_IA_NEUTRO', 50));
    return isFinite(n) ? n : 50;
  }

  /** Cap absoluto do ajuste da IA (pontos). Segurança contra IA ruidosa. */
  function _capIA() {
    var c = Number(_cfg('SCORE_POLICY_IA_CAP', 15));
    return isFinite(c) && c >= 0 ? c : 15;
  }

  function _clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function _arred(v) {
    return Math.round(Number(v) || 0);
  }

  /**
   * Calcula o ajuste trazido pela IA de forma LIMITADA.
   * A IA só empurra o score para cima/baixo proporcionalmente ao quanto ela se
   * afasta do neutro (50), respeitando o cap. Nunca domina a decisão.
   *
   * @param {number|null} scoreIA — score cru da IA (0-100) ou null/undefined
   * @returns {{ajuste:number, origem:string}}
   */
  function _ajusteIA(scoreIA) {
    var n = Number(scoreIA);
    if (scoreIA === null || scoreIA === undefined || !isFinite(n)) {
      // Sem IA → não altera o score técnico (fallback neutro).
      return { ajuste: 0, origem: 'FALLBACK' };
    }
    var neutro = _neutroIA();
    var cap = _capIA();
    var peso = _pesoIA();
    var bruto = (n - neutro) * peso;
    return { ajuste: _arred(_clamp(bruto, -cap, cap)), origem: 'IA' };
  }

  /**
   * Consolida o score FINAL único para um ativo.
   *
   * @param {number}      scoreTecnico — score técnico já penalizado (DecisionEngine)
   * @param {number|null} scoreIA      — score cru da IA (0-100) ou null
   * @returns {Object} pacote canônico { scoreFinal, scoreTecnico, scoreIA, ajusteIA, origemIA, motivo }
   */
  function consolidar(scoreTecnico, scoreIA) {
    var tech = _clamp(_arred(scoreTecnico), 0, 100);
    var iaInfo = _ajusteIA(scoreIA);
    var final = _clamp(tech + iaInfo.ajuste, 0, 100);

    var motivo;
    if (iaInfo.origem === 'FALLBACK') {
      motivo = 'Score tecnico ' + tech + ' (IA indisponivel)';
    } else {
      var sinal = iaInfo.ajuste >= 0 ? '+' : '';
      motivo = 'Score tecnico ' + tech + ' ' + sinal + iaInfo.ajuste +
        ' (IA ' + _arred(scoreIA) + ') = ' + final;
    }

    return {
      scoreFinal: final,
      scoreTecnico: tech,
      scoreIA: (iaInfo.origem === 'IA') ? _arred(scoreIA) : null,
      ajusteIA: iaInfo.ajuste,
      origemIA: iaInfo.origem,
      motivo: motivo
    };
  }

  /**
   * Conveniência: consolida direto de uma oportunidade `op`, lendo
   * op.scoreTecnico/op.score como técnico e op.scoreIA/op.aiScore como IA,
   * e RETORNA UMA CÓPIA de `op` com os campos canônicos preenchidos (sem
   * sobrescrever o campo técnico original, que fica em scoreTecnico).
   *
   * @param {Object} op
   * @returns {Object} op enriquecida com scoreFinal/scoreTecnico/scoreIA/scoreMotivo
   */
  function aplicarEm(op) {
    if (!op || typeof op !== 'object') return op;

    var tech = (typeof op.scoreTecnico === 'number') ? op.scoreTecnico
             : (typeof op.score === 'number') ? op.score : 50;
    var ia = (typeof op.scoreIA === 'number') ? op.scoreIA
           : (typeof op.aiScore === 'number') ? op.aiScore
           : null;

    var pacote = consolidar(tech, ia);

    var out = {};
    for (var k in op) {
      if (Object.prototype.hasOwnProperty.call(op, k)) out[k] = op[k];
    }
    out.scoreTecnico = pacote.scoreTecnico;
    out.scoreIA = pacote.scoreIA;
    out.scoreFinal = pacote.scoreFinal;
    out.scoreMotivo = pacote.motivo;
    out.scoreOrigemIA = pacote.origemIA;
    return out;
  }

  return {
    consolidar: consolidar,
    aplicarEm: aplicarEm,
    // Expostos para testes/diagnóstico
    _ajusteIA: _ajusteIA
  };
})();

