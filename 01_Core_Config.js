/**
 * =============================================================================
 * 01_Core_Config.gs   GESTOR UNIFICADO DE CONFIGURAÇÕES B3-v10
 * =============================================================================
 * Hierarquia de Verdade: 
 * 1. Aba "Configurações" (Prioridade máxima e fácil de mudar)
 * 2. Script Properties (Segurança para API Keys)
 * 3. DEFAULTS (Garante que o robô não pare se a planilha sumir)
 */

var CONFIG = (function() {

  const NOME_ABA = "Configurações";
  const CACHE_KEY = "B3_V10_UNIFIED_SETTINGS";
  
  // VALORES PADRÃO (Ajustados para Julho 2026 — v11)
  const DEFAULTS = {
    GEMINI_MODEL: 'gemini-2.0-flash-lite', 
    MAX_EXECUTION_TIME: 280,
    VOLUM_MEDIO_MINIMO: 5000000,
    IA_SCORE_MINIMO: 55,
    TELEGRAM_CHAT_ID: '',
    STRATEGY_RISK_LEVEL: 'MODERATE',
    SCORE_EXECUTAR: 55,
    CAPITAL_TOTAL: 50000,
    RISCO_POR_TRADE: 0.02,
    MAX_POSITIONS: 8,   // 🔧 v11: Reduzido de 12 para 8 (otimizado para capital de R$ 50K)
    MAX_PER_SECTOR: 2,
    RISK_MANAGER_ELITE_SCORE: 92,
    RISK_MANAGER_REDUCED_SIZE_SCORE: 80,
    RISK_MANAGER_MAX_VOL_FACTOR: 4.5,
    // 🔧 v11: Threshold principal mantido em 55. Flex removido para BEARISH (agora é veto direto com macro BEARISH)
    DECISION_DEFAULT_THRESHOLD: 55,
    DECISION_FLEX_BEARISH_THRESHOLD: 55,
    DECISION_FLEX_BEARISH_MIN_SCORE: 50,
    DECISION_FLEX_BEARISH_MIN_ADX: 22,  // 🔧 v11: Aumentado de 20 para 22 (exigência mais forte para flex)

    DECISION_TECH_WEIGHT: 0.7,
    DECISION_AI_WEIGHT: 0.3,
    DECISION_FLEX_TECH_WEIGHT: 0.8,
    DECISION_FLEX_AI_WEIGHT: 0.2,
    SENTIMENT_BONUS_EXCELLENT: 15,
    SENTIMENT_BONUS_BULLISH: 10,
    SENTIMENT_BONUS_POSITIVE: 5,
    SENTIMENT_BONUS_OTIMISTA: 5,
    // 🔧 v11: Penalidades recalibradas:
    // CAUTELA mantida em -10 (penalidade leve para dubiedade)
    // BEARISH não é mais penalidade isolada — agora é veto direto quando macro confirma (via DecisionEngine)
    SENTIMENT_PENALTY_CAUTELA: -10,
    SENTIMENT_PENALTY_BEARISH: -20,  // 🔧 v11: Volta para -20 (aplica-se apenas se passou pelo veto)

    SENTIMENT_PENALTY_TERRIBLE: -100,
    WIN_RATE_CRITICO: 35,
    WIN_RATE_ALERTA: 45,
    WIN_RATE_NORMAL: 55,
    PREJUIZO_BAD_TICKER: -100,
    LUCRO_GOOD_TICKER: 50,
    PENALTY_DRAWDOWN_LEVE: -5,     // 🔧 v11: Aumentado de -3 para -5 (drawdown é risco real)
    PENALTY_DRAWDOWN_MODERADO: -10, // 🔧 v11: Aumentado de -8 para -10
    PENALTY_DRAWDOWN_CRITICO: -20,  // 🔧 v11: Aumentado de -15 para -20
    PENALTY_BAD_TICKER: -15,        // 🔧 v11: Aumentado de -10 para -15
    BONUS_GOOD_TICKER: 5,
    PENALTY_TICKER_WINRATE_LOW: -5,
    BONUS_TICKER_WINRATE_HIGH: 5,
    TICKER_WINRATE_LOW: 45,
    TICKER_WINRATE_HIGH: 65,
    HORA_ABERTURA: 10,
    HORA_FECHAMENTO: 16,
    MINUTO_FECHAMENTO: 55,
    PERDA_MAXIMA_DIARIA: -2000,
    IGNORAR_FERIADOS: false,
    RANKER_RESUMO_SHEET: 'Resumo_Trades_Aprovados',
    RANKER_RISK_LEVEL: 0.02
  };

  function parseValue(value) {
    if (value === null || value === undefined) return value;
    if (value === true || value === false) return value;

    const text = String(value).trim();
    if (text === 'TRUE' || text === 'true') return true;
    if (text === 'FALSE' || text === 'false') return false;
    if (text !== '' && !isNaN(text)) return Number(text);

    if ((text.charAt(0) === '[' && text.charAt(text.length - 1) === ']') ||
        (text.charAt(0) === '{' && text.charAt(text.length - 1) === '}')) {
      try { return JSON.parse(text); } catch (e) {}
    }

    return value;
  }

  function readSheetConfig() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOME_ABA);
    if (!sheet) return {};

    const data = sheet.getDataRange().getValues();
    const configMap = {};

    data.forEach((row, i) => {
      if (i > 0 && row[0]) {
        configMap[row[0].toString().trim()] = parseValue(row[1]);
      }
    });

    return configMap;
  }

  function getCachedConfig() {
    try {
      if (typeof Cache !== 'undefined') {
        let cached = Cache.get('CONFIG', {key: CACHE_KEY});
        if (cached) return cached;
      }
    } catch (e) {
      console.warn("Aviso Cache: Usando fallback direto.");
    }
    return null;
  }

  function putCachedConfig(configMap) {
    try {
      if (typeof Cache !== 'undefined') {
        Cache.put('CONFIG', configMap, {key: CACHE_KEY}, 21600);
      }
    } catch (e) {
      console.warn("Aviso Cache: Não foi possível atualizar cache de CONFIG.");
    }
  }

  function isEnforcementActive() {
    if (typeof isSecretEnforcementActive === 'function') {
      return isSecretEnforcementActive();
    }
    return PropertiesService.getScriptProperties().getProperty('ENFORCE_SECRET_MANAGEMENT_OVERRIDE') === 'true';
  }

  function isBlockedSheetSecret(key) {
    return isEnforcementActive() &&
      typeof isSecretKeyName === 'function' &&
      isSecretKeyName(key);
  }

  function readSecretFromProviders(key) {
    try {
      if (typeof Secrets !== 'undefined' && typeof Secrets.getSecret === 'function') {
        const secret = Secrets.getSecret(key);
        if (secret !== null && secret !== undefined && secret !== '') return secret;
      }
    } catch (e) {
      console.warn("⚠️ CONFIG: Provedor Secrets falhou para " + key + ".");
    }

    const prop = PropertiesService.getScriptProperties().getProperty(key);
    if (prop !== null && prop !== '') return parseValue(prop);

    return null;
  }

  return {
    /**
     * Obtém uma configuração de forma inteligente e tipada
     */
    get: function(chave, fallback) {
      const props = PropertiesService.getScriptProperties();
      const override = props.getProperty(chave + '_OVERRIDE');
      if (override !== null) return parseValue(override);

      let cached = getCachedConfig();
      if (!cached) {
        try {
          cached = readSheetConfig();
          putCachedConfig(cached);
        } catch (e) {
          console.warn("⚠️ CONFIG: Falha ao ler planilha. Usando propriedades e defaults. " + e.message);
          cached = {};
        }
      }

      if (!isBlockedSheetSecret(chave) && cached && cached[chave] !== undefined && cached[chave] !== '') {
        return cached[chave];
      }

      let prop = props.getProperty(chave);
      if (prop !== null) return parseValue(prop);

      if (DEFAULTS[chave] !== undefined) return DEFAULTS[chave];
      return fallback !== undefined ? fallback : null;
    },

    /**
     * Alias para buscar chaves sensíveis
     */
    getSecret: function(key) {
      const fromProviders = readSecretFromProviders(key);
      if (fromProviders !== null && fromProviders !== '') return fromProviders;

      if (isBlockedSheetSecret(key)) {
        console.warn("⚠️ CONFIG: Secret " + key + " bloqueada na planilha (enforcement ativo).");
        return null;
      }

      return this.get(key);
    },

    isEnforcementActive: isEnforcementActive,

    /**
     * Recarrega as configurações da aba Planilha para o Cache
     */
    refresh: function() {
      try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOME_ABA);
        if (!sheet) {
          console.warn(`⚠️ Aba "${NOME_ABA}" não encontrada. Usando propriedades e defaults.`);
          return;
        }

        const configMap = readSheetConfig();

        // Salva no cache unificado do Módulo 03 por 6 horas
        putCachedConfig(configMap);
        console.log("✅ CONFIG: Cache da planilha atualizado com sucesso.");
      } catch (e) {
        console.error("❌ Erro no Refresh de Config: " + e.message);
      }
    },

    reload: function() {
      return this.refresh();
    },

    enforceSecretManagement: function(value) {
      PropertiesService.getScriptProperties().setProperty('ENFORCE_SECRET_MANAGEMENT_OVERRIDE', String(value === true));
    },

    hasSecret: function(key) {
      return !!this.getSecret(key);
    }
  };
})();
