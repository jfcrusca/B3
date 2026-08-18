/**
 * =============================================================================
 * 34_AI_Prompts.gs — Configurações, Constantes e Estado
 * =============================================================================
 * Responsável por manter os thresholds, pesos e o estado global do diagnóstico.
 * v6.0 - Adicionado suporte a NLP e análise de sentimento.
 */

var SistemaDiagnostico = {
  CONFIG: criarConfiguracaoPadrao(),
  stats: {
    totalAnalises:        0,
    divergenciasDetectadas: 0,
    oportunidadesValidadas: 0,
    historicoDivergencias:  []
  },
  historicoCalibracao: []
};

function criarConfiguracaoPadrao() {
  return {
    RSI_BLOQUEIO:   72,
    RSI_ALERTA:     70,
    RSI_IDEAL_MIN:  62,
    RSI_IDEAL_MAX:  68,
    ATR_BLOQUEIO:   6.0,
    ATR_ALERTA:     4.0,
    VOLUME_MINIMO:  1.0,
    VOLUME_IDEAL:   2.0,
    SCORE_MINIMO:   65,
    SCORE_EXECUTAR: 75,
    PESOS: {
      RSI:    25,
      VOLUME: 20,
      ATR:    15,
      TREND:  25,
      SETUP:  15
    },
    NLP_PROMPT_SENTIMENTO: `Analise as notícias abaixo e defina o sentimento para o ativo.
    Retorne estritamente um JSON: {"sentimento": "BULLISH"|"BEARISH"|"NEUTRAL", "confianca": 0-100, "rationale": "Breve justificativa"}.
    Regra: Se não houver notícias, retorne NEUTRAL.`
  };
}

function criarTestesCalibracao() {
  return [
    {
      nome: "ATR > 6% deve DESCARTAR",
      dados: { ticker: "CALIB_ATR_ALTO", score: 90, setupType: "MOMENTUM_BREAKOUT", trend: "ALTA", indicators: { rsi: 55, volumeRatio: 2.0, atr: 6.5 } },
      resultadoEsperado: "DESCARTAR"
    },
    {
      nome: "Setup ideal deve EXECUTAR",
      dados: { ticker: "CALIB_IDEAL", score: 85, setupType: "MOMENTUM_BREAKOUT", trend: "ALTA", indicators: { rsi: 65, volumeRatio: 2.2, atr: 3.5 } },
      resultadoEsperado: "EXECUTAR"
    },
    {
      nome: "Tendência indefinida deve AGUARDAR",
      dados: { ticker: "CALIB_TEND_INDEF", score: 78, setupType: "PULLBACK_EMA50", trend: "INDEFINIDO", indicators: { rsi: 60, volumeRatio: 1.5, atr: 4.0 } },
      resultadoEsperado: "AGUARDAR"
    },
    {
      nome: "RSI > 72 deve DESCARTAR",
      dados: { ticker: "CALIB_RSI_ALTO", score: 88, setupType: "MOMENTUM_BREAKOUT", trend: "ALTA", indicators: { rsi: 73, volumeRatio: 1.8, atr: 3.0 } },
      resultadoEsperado: "DESCARTAR"
    },
    {
      nome: "Score < 65 deve DESCARTAR",
      dados: { ticker: "CALIB_SCORE_BAIXO", score: 60, setupType: "REVERSAL_BULLISH", trend: "ALTA", indicators: { rsi: 58, volumeRatio: 1.2, atr: 4.0 } },
      resultadoEsperado: "DESCARTAR"
    },
    {
      nome: "Volume muito baixo deve AGUARDAR",
      dados: { ticker: "CALIB_VOL_BAIXO", score: 75, setupType: "MOMENTUM_BREAKOUT", trend: "ALTA", indicators: { rsi: 62, volumeRatio: 0.6, atr: 3.8 } },
      resultadoEsperado: "AGUARDAR"
    }
  ];
}
