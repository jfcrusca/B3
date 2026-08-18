/**
 * 03_Cache_Unified.gs — V3.1 (MODULAR & SLIM)
 * =============================================================================
 * Finalidade: Gestão centralizada de cache para evitar excesso de chamadas de API.
 * Refatoração: Correção da condição de corrida na exclusão de chaves (Eviction).
 * =============================================================================
 */

var Cache = (function() {
  'use strict';

  const scriptCache = CacheService.getScriptCache();
  const CONFIG = {
    PREFIX: 'B3V10_',
    INDEX_KEY: 'B3_CACHE_IDX',
    DEFAULT_TTL: 3600, // 1h
    MAX_KEYS: 100
  };

  // --- MOTORES INTERNOS (PRIVATE) ---

  const _engine = {
    /** Gera chave simples e rápida */
    genKey: (type, params) => {
      const pStr = typeof params === 'string' ? params : JSON.stringify(params || {});
      return (CONFIG.PREFIX + type + '_' + pStr).substring(0, 200);
    },

    /** Gerencia o índice de chaves com política de expiração segura */
    updateIndex: (key, type, expires) => {
      let idx = _engine.getIndex();
      idx[key] = { type, expires };

      const keys = Object.keys(idx);

      // Garante limite de tamanho removendo a chave mais antiga/próxima de expirar
      if (keys.length > CONFIG.MAX_KEYS) {
        const oldestKey = keys.reduce((oldest, current) => {
          return idx[current].expires < idx[oldest].expires ? current : oldest;
        });
        delete idx[oldestKey];
      } 

      scriptCache.put(CONFIG.INDEX_KEY, JSON.stringify(idx), 21600);
    },

    getIndex: () => {
      try {
        const raw = scriptCache.get(CONFIG.INDEX_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (e) { return {}; }
    }
  };

  // --- API PÚBLICA ---

  return {
    put: function(type, value, params = {}, ttl = CONFIG.DEFAULT_TTL) {
      if (!value) return false;
      const key = _engine.genKey(type, params);
      const expires = Date.now() + (ttl * 1000);

      try {
        scriptCache.put(key, JSON.stringify(value), ttl);
        _engine.updateIndex(key, type, expires);
        return true;
      } catch (e) {
        console.error(`❌ Erro Cache.put: ${e.message}`);
        return false;
      }
    },

    get: function(type, params = {}) {
      const key = _engine.genKey(type, params);
      const cached = scriptCache.get(key);
      return cached ? JSON.parse(cached) : null;
    },

    clearByType: function(typePattern) {
      const idx = _engine.getIndex();
      let count = 0;
      Object.keys(idx).forEach(k => {
        if (idx[k].type === typePattern || typePattern === 'all') {
          scriptCache.remove(k);
          delete idx[k];
          count++;
        }
      });
      scriptCache.put(CONFIG.INDEX_KEY, JSON.stringify(idx), 21600);
      console.log(`🧹 Cache: ${count} itens removidos (${typePattern}).`);
    },

    // --- ADAPTADORES DE CONVENIÊNCIA (MANTÊM COMPATIBILIDADE) ---

    cacheYahoo: function(ticker, data) {
      return this.put('yahoo', data, ticker, 300);
    },
    getCachedYahoo: function(ticker) {
      return this.get('yahoo', ticker);
    },

    cacheTechnical: function(ticker, data) {
      return this.put('tech', data, ticker, 1800);
    },
    getCachedTechnical: function(ticker) {
      return this.get('tech', ticker);
    },

    getStats: function() {
      const idx = _engine.getIndex();
      return {
        status: 'ACTIVE',
        totalItems: Object.keys(idx).length,
        system: 'V3.1_SLIM'
      };
    }
  };
})();

/** Funções Globais de Menu */
function LIMPAR_CACHE_COMPLETO() { Cache.clearByType('all'); }
function VERIFICAR_STATUS_CACHE() { 
  const s = Cache.getStats();
  SpreadsheetApp.getUi().alert(`📊 Status: ${s.status}\n📦 Itens: ${s.totalItems}\n⚙️ Versão: ${s.system}`);
}