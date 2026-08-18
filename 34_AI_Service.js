/**
 * 34_AI_Service.gs — V6.1 (ORQUESTRAÇÃO MODULAR + ADX + BOLLINGER)
 * =============================================================================
 * Finalidade: Controlador central de Inteligência e Diagnóstico.
 * Lógica Técnica: Thresholds e pesos preservados integralmente.
 *
 * V6.1 — Acréscimo (sem alteração da lógica existente):
 *   • _engine_processarRegras: bloco isolado de guilhotinas ADX e Bollinger
 *     adicionado após as 4 regras originais. Nenhuma regra anterior alterada.
 * =============================================================================
 */

var AIService = {

  /**
   * Diagnostica uma oportunidade buscando divergências técnicas.
   * Sem alteração V6.1.
   */
  diagnosticarOportunidade: function(op) {
    if (!op || !op.indicators) return this._erroDiagnostico(op);
    const diagnostico = this._engine_processarRegras(op);
    return diagnostico;
  },

  // ===========================================================================
  // SUB-MOTORES PRIVADOS
  // ===========================================================================

  /**
   * @private
   * Motor de Regras Técnicas.
   * V6.1: Guilhotinas ADX e Bollinger adicionadas como bloco isolado
   *        após as 4 regras originais. Nenhuma regra anterior foi alterada.
   */
  _engine_processarRegras: function(op) {
    const motivos = [];
    const ind     = op.indicators;
    const cfg     = SistemaDiagnostico.CONFIG;

    // ── REGRAS ORIGINAIS (intactas) ───────────────────────────────────────────

    // Regra 1: Momentum Breakout (RSI/Volume)
    if (op.setupType === "MOMENTUM_BREAKOUT") {
      if (ind.rsi > (cfg.RSI_BLOQUEIO || 72))
        motivos.push("RSI sobrecomprado");
      if (ind.rsi > 65 && ind.volumeRatio < (cfg.VOLUME_IDEAL || 1.8))
        motivos.push("RSI elevado sem volume");
    }

    // Regra 2: Reversal Bullish
    if (op.setupType === "REVERSAL_BULLISH" && ind.rsi > (cfg.RSI_ALERTA || 70))
      motivos.push("RSI alto demais para REVERSAL");

    // Regras Gerais (ATR e Score)
    if (ind.atr   > (cfg.ATR_BLOQUEIO   || 5.0)) motivos.push("ATR excessivo");
    if (op.score  < (cfg.SCORE_EXECUTAR || 80))  motivos.push("Score insuficiente");

    // ── V6.1: GUILHOTINAS ADX e BOLLINGER ────────────────────────────────────
    // Bloco isolado — não interfere nas regras acima.
    // null = candles insuficientes → não penaliza (comportamento seguro).

    // Guilhotina ADX: médias alinhadas em lateralização geram sinais falsos
    if (ind.adx !== null && ind.adx !== undefined && ind.adx < 20)
      motivos.push("ADX < 20: mercado lateral, tendência sem força");

    // Guilhotina Bollinger: evita comprar exaustão no topo da banda superior
    // Exceção: em zona Fibo confirmada pode ser rompimento legítimo → não penaliza
    if (
      ind.bollinger !== null &&
      ind.bollinger !== undefined &&
      op.preco > ind.bollinger.upper &&
      !(op.estrutura && op.estrutura.inFiboZone)
    ) {
      motivos.push("Preço acima da Banda Superior de Bollinger: possível exaustão");
    }
    // ─────────────────────────────────────────────────────────────────────────

    return {
      temDivergencia: motivos.length > 0,
      motivos:        motivos,
      ticker:         op.ticker || "N/A"
    };
  }

};
