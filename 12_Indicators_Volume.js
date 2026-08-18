/**
 * 12_Indicators_Volume.gs — V10.0 (REFATORAÇÃO MODULAR)
 * =============================================================================
 * Finalidade: Cálculos avançados de Volume e Fluxo de Dinheiro.
 * Refatoração: Extração de lógica matemática para redução de complexidade.
 * Estratégia Sniper: Preserva o cálculo de Volume Ratio de 2.0x.
 * =============================================================================
 */

var VolumeIndicators = {
  
  /** Interface Pública: SMA do Volume */
  smaVolume: function(candles, period) {
    if (!this._validar(candles)) return [];
    return this._processarJanela(candles, period, (sum) => sum / period);
  },

  /** Interface Pública: Volume Ratio (O Filtro Sniper) */
  calculateVolumeRatio: function(candles, period) {
    const sma = this.smaVolume(candles, period);
    return candles.map((c, i) => {
      const base = sma[i];
      return (base && base !== 0) ? (c.volume / base) : null;
    });
  },

  /** Interface Pública: MFI (Money Flow Index) */
  calculateMFI: function(candles, period) {
    if (!this._validar(candles, period + 1)) return [];
    return this._engine_MFI(candles, period);
  },

  /** Interface Pública: OBV (On-Balance Volume) */
  calculateOBV: function(candles) {
    if (!this._validar(candles, 2)) return [];
    
    const obv = new Array(candles.length).fill(null);
    obv[0] = Number(candles[0].volume || 0);

    for (let i = 1; i < candles.length; i++) {
      const closeCur = Number(candles[i].close || 0);
      const closePrev = Number(candles[i-1].close || 0);
      const volumeCur = Number(candles[i].volume || 0);

      if (closeCur > closePrev) {
        obv[i] = obv[i-1] + volumeCur;
      } else if (closeCur < closePrev) {
        obv[i] = obv[i-1] - volumeCur;
      } else {
        obv[i] = obv[i-1];
      }
    }
    return obv;
  },

  /** Retorna leitura de tendência descritiva do OBV para a IA */
  getOBVTrendLabel: function(candles) {
    const obv = this.calculateOBV(candles);
    if (!obv || obv.length < 10) return "Neutro";

    const len = obv.length;
    const obvAtual = obv[len - 1];
    const obv10d = obv[len - 10];

    let sum10 = 0;
    for (let i = len - 10; i < len; i++) {
      sum10 += obv[i];
    }
    const obvSma10 = sum10 / 10;

    if (obvAtual > obvSma10 && obvAtual > obv10d) {
      return "Acumulação (BULLISH) — OBV subindo forte, fluxo comprador institucional silencioso";
    } else if (obvAtual < obvSma10 && obvAtual < obv10d) {
      return "Distribuição (BEARISH) — OBV em queda, saída de grandes players e fraqueza de fluxo";
    } else {
      return "Neutro — OBV lateralizado, fluxo sem direção de acúmulo clara";
    }
  },

  // ===========================================================================
  // SUB-MOTORES PRIVADOS (REDUÇÃO DE COMPLEXIDADE)
  // ===========================================================================

  /** @private Validação básica de dados */
  _validar: function(c, min = 1) {
    return Array.isArray(c) && c.length >= min;
  },

  /** @private Motor genérico de processamento de janela deslizante */
  _processarJanela: function(candles, period, transform) {
    const result = new Array(candles.length).fill(null);
    let sum = 0;
    for (let i = 0; i < candles.length; i++) {
      sum += Number(candles[i].volume || 0);
      if (i >= period) sum -= Number(candles[i - period].volume || 0);
      if (i >= period - 1) result[i] = transform(sum);
    }
    return result;
  },

  /** @private Motor de Cálculo do MFI (Refatorado para ser linear) */
  _engine_MFI: function(candles, period) {
    const result = new Array(candles.length).fill(null);
    let posFlow = [], negFlow = [];

    for (let i = 1; i < candles.length; i++) {
      const tpCur = (candles[i].high + candles[i].low + candles[i].close) / 3;
      const tpPrev = (candles[i-1].high + candles[i-1].low + candles[i-1].close) / 3;
      const rawMF = tpCur * (candles[i].volume || 0);

      posFlow.push(tpCur > tpPrev ? rawMF : 0);
      negFlow.push(tpCur < tpPrev ? rawMF : 0);

      if (posFlow.length > period) { posFlow.shift(); negFlow.shift(); }

      if (posFlow.length === period) {
        const sPos = posFlow.reduce((a, b) => a + b, 0);
        const sNeg = negFlow.reduce((a, b) => a + b, 0);
        result[i] = sNeg === 0 ? 100 : 100 - (100 / (1 + (sPos / sNeg)));
      }
    }
    return result;
  }
};