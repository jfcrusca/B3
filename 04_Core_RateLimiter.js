/**
// ===== 04_Core_RateLimiter.gs =====
// Gestor de Limites de API (Anti-Bloqueio e Controlo de Custos)
*/
var RateLimiter = {
  
  // Definição dos limites por balde (bucket)
  CONFIG: {
    'BRAPI': { 
      dailyLimit: 500,      // 15.000 mês / 30 dias = 500/dia
      minIntervalMs: 1000   // Intervalo de 1s para respeitar o plano Free
    },
    'YAHOO': { 
      dailyLimit: 2000, 
      minIntervalMs: 500 
    },
    'GEMINI': { 
      dailyLimit: 1500, 
      minIntervalMs: 2000   // Proteção contra Erro 429
    },
    'DEEPSEEK': { 
      dailyLimit: 1000,     // Limite de segurança para controlar saldo
      minIntervalMs: 1500   // Intervalo para evitar sobrecarga
    },
    'RAPIDAPI': {
      dailyLimit: 500,      // Ajuste conforme seu plano no RapidAPI
      minIntervalMs: 1500   // Aumentado para 1.5s para garantir estabilidade no plano Free
    }
  },

  /**
   * Executa uma função se houver quota disponível
   * @param {string} bucketName - Nome da API (ex: 'BRAPI', 'DEEPSEEK')
   * @param {function} callback - A função a ser executada
   */
  execute: function(bucketName, callback) {
    const config = this.CONFIG[bucketName];
    if (!config) return callback(); 

    const cache = CacheService.getScriptCache();
    const counterKey = `rate_limit_count_${bucketName}`;
    const lastCallKey = `rate_limit_last_${bucketName}`;
    
    // 1. Verificar intervalo mínimo entre chamadas (Anti-Spam)
    const now = Date.now();
    const lastCall = Number(cache.get(lastCallKey)) || 0;
    if (now - lastCall < config.minIntervalMs) {
      const waitTime = config.minIntervalMs - (now - lastCall);
      if (typeof Logger !== 'undefined') Logger.warn(`⏳ [RateLimiter] Pausando ${waitTime}ms para ${bucketName}`);
      Utilities.sleep(waitTime);
    }

    // 2. Verificar limite diário (Controlo de Quota/Custo)
    let currentCount = Number(cache.get(counterKey)) || 0;
    if (currentCount >= config.dailyLimit) {
      if (typeof Logger !== 'undefined') {
        Logger.error(`🚫 [RateLimiter] LIMITE DIÁRIO ATINGIDO para ${bucketName} (${config.dailyLimit})`);
      }
      throw new Error(`Quota diária de ${bucketName} esgotada.`);
    }

    // 3. Executar a tarefa e atualizar contadores
    try {
      const result = callback();
      
      // Atualiza os contadores no Cache (expira em 24h automaticamente)
      cache.put(counterKey, (currentCount + 1).toString(), 86400);
      cache.put(lastCallKey, Date.now().toString(), 86400);
      
      return result;
    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.error(`❌ Erro na execução em ${bucketName}: ${e.message}`);
      throw e;
    }
  },

  /**
   * Reseta manualmente os contadores de quota de um serviço específico
   */
  resetBucket: function(bucketName) {
    const cache = CacheService.getScriptCache();
    cache.remove(`rate_limit_count_${bucketName}`);
    cache.remove(`rate_limit_last_${bucketName}`);
    if (typeof Logger !== 'undefined') Logger.info(`🔄 [RateLimiter] Bucket ${bucketName} reiniciado com sucesso.`);
  }
};