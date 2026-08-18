/**
 * =============================================================================
 * 05_B3V10_TickerManager.gs — GESTOR CENTRALIZADO DE ATIVOS (FUSÃO ELITE 2026 v11.0)
 * =============================================================================
 * Finalidade: Única fonte de verdade para tickers, categorias e controle de API.
 * Integração: Consolidado com listas do Módulo 11 e lógica de cache do Módulo 05.
 * Versão: 11.0 — Universo expandido para ~80+ ativos com alta liquidez (volume > R$ 5M)
 * =============================================================================
 */

var B3V10_TICKER_MANAGER = (function() {
  'use strict';

  // Intervalo de segurança para não reanalisar o mesmo ativo (2 horas) [1]
  const ANALYZE_INTERVAL_MS = 2 * 60 * 60 * 1000; 
  
  // Cache em memória para rastreio de execução no ciclo atual [5]
  const tickerAnalysisCache = {};

  // 🚀 BLACKLIST: Tickers inativos, alterados ou inexistentes na B3
  var _deadTickers = {
    "LZPS3": "Inexistente (possível erro de digitação)",
    "NVDC33": "Alterado para NVDC34 (BDR Nvidia Nível III)",
    "ENBR3":  "Deslistado (EDP fechou capital via OPA)",
    "BANB11": "Inexistente (Santander é SANB11)",
    "NUBR33": "Alterado para ROXO34 (BDR Nubank Nível I)",
    "CRFB3":  "Inativo na base",
    "MYPK3":  "Alterado",
    "ODPV3":  "Alterado",
    "LPSB3":  "Inativo",
    "KOF33":  "Inativo (Coca-Cola Femsa BDR sem liquidez)",
    "NEOE3":  "Inativo (Não encontrado na B3)",
    "MRFG3":  "Inativo (Marfrig fechou capital / sem liquidez)",
    "BTG11":  "Inativo / Fundo imobiliário encerrado (usar BPAC11 para BTG exposure)",
    "BRFS3":  "Alterado para MBRF3 (BRF mudou de ticker)",
    "AMER3":  "Inativo na base (Americanas sem dados de mercado)",
    "PCAR3":  "Inativo (Pão de Açúcar sem dados de mercado disponíveis)"
  };

  // Substituições recomendadas para tickers mortos
  var _tickerReplacements = {
    "LZPS3":  "MGLU3",   // Growth substituído por ativo do mesmo setor
    "NVDC33": "NVDC34",  // Código correto do BDR da Nvidia
    "ENBR3":  "EGIE3",   // Energia (já incluso, não duplicar)
    "BANB11": null,      // Remover (Santander já é SANB11)
    "NUBR33": "ROXO34",  // Código correto do BDR do Nubank
    "ODPV3":  "HAPV3",   // Saúde substituído
    "KOF33":  null,      // Remover (sem substituto direto)
    "NEOE3":  null,      // Remover (sem substituto direto)
    "MRFG3":  "JBSS3",   // Alimentos (mesmo setor)
    "BTG11":  "BPAC11",  // BTG exposure via BPAC11 (já incluso)
    "BRFS3":  "MBRF3"    // Código correto atualizado
  };

  // === LISTAS CONSOLIDADAS (Julho 2026) — Expandidas para ~80 tickers líquidos ===
  // Critério: Volume médio diário > R$ 5M nos últimos 3 meses
  // ⚠️ Tickers inativos/alterados foram removidos: LZPS3, NVDC33, ENBR3, BANB11, NUBR33, ODPV3
  const CATEGORIES = {
    // ── Blue Chips: Resiliência e Fluxo (Tier 1 principal) ──
    SAFETY: [
      "VALE3", "PETR4", "ITUB4", "BBAS3", "WEGE3",
      "ABEV3", "BBDC4", "BPAC11", "B3SA3", "SUZB3",
      "ELET3", "VIVT3", "SBSP3", "EQTL3", "CSAN3"
    ],
    
    // ── Cíclicas: Commodities e Juros (Swing Trade Tático) ──
    CYCLICAL: [
      "GGBR4", "RAIL3", "PRIO3", "CMIG4", "CSNA3",
      "USIM5", "BRAP4", "RANI3", "GOAU4", "RECV3"
    ],
    
    // ── Growth/Vol: Beta Alto para Momentum ──
    GROWTH: [
      "RENT3", "MGLU3", "HYPE3", "RDOR3", "RADL3",
      "LREN3", "ARZZ3", "POMO4", "TOTS3", "LOGG3",
      "CASH3", "NVDC34", "MELI34", "ALOS3"
    ],
    
    // ── Tactical: Setores Estáveis (Defensivo/Dividendos) ──
    TACTICAL: [
      "CPLE3", "TAEE11", "TRPL4", "EGIE3", "ISAE4",
      "SAPR11", "AURE3", "ENGI11"
    ],
    
    // ── Saúde: Setor com forte momentum em 2026 ──
    HEALTHCARE: [
      "FLRY3", "HAPV3", "QUAL3", "MATD3", "ONCO3",
      "DASA3", "AALR3", "KEPL3", "PFRM3"
    ],
    
    // ── Consumo: Varejo e Alimentos ──
    CONSUMER: [
      "JBSS3", "SMTO3", "KLBN11", "MBRF3",
      "VIIA3", "CEAB3", "AUAU3", " AUAU3", "VIVA3"
    ],
    
    // ── Financeiro: Bancos e Serviços Financeiros ──
    FINANCIAL: [
      "SANB11", "ITSA4", "BRSR6", "BMGB4", "BBSE3",
      "ROXO34", "XPBR31", "BIDI11"
    ]
  };

  return {
    /** 🚀 NOVO: Verifica se um ticker está na blacklist (inativo/alterado) */
    isDeadTicker: function(ticker) {
      return !!_deadTickers[ticker];
    },

    /** 🚀 NOVO: Retorna o motivo pelo qual o ticker está morto */
    getDeadReason: function(ticker) {
      return _deadTickers[ticker] || null;
    },

    /** 🚀 NOVO: Retorna o ticker de substituição se houver, ou o próprio ticker */
    getReplacement: function(ticker) {
      if (_tickerReplacements[ticker] !== undefined) return _tickerReplacements[ticker];
      if (this.isDeadTicker(ticker)) return null; // morto sem substituto
      return ticker; // ativo normal
    },

    /** 🚀 NOVO: Filtra tickers mortos de uma lista e loga os removidos */
    filterDead: function(tickers) {
      if (!Array.isArray(tickers)) return [];
      var removidos = [];
      var filtrados = tickers.filter(function(t) {
        if (_deadTickers[t]) {
          removidos.push(t + " (" + _deadTickers[t] + ")");
          return false;
        }
        return true;
      });
      if (removidos.length > 0) {
        console.log("⏭️ [TickerManager] " + removidos.length + " tickers inativos removidos: " + removidos.join(", "));
      }
      return filtrados;
    },

    /** Retorna apenas Blue Chips (Tier 1) para Day Trade e Swing Seguro */
    getTier1: function() {
      return CATEGORIES.SAFETY;
    },

    /** Retorna Mid Caps e Growth para setups de Momentum */
    getTier2: function() {
      return [...new Set([
        ...CATEGORIES.GROWTH,
        ...CATEGORIES.CYCLICAL,
        ...CATEGORIES.HEALTHCARE,
        ...CATEGORIES.CONSUMER,
        ...CATEGORIES.FINANCIAL
      ])];
    },

    /** Retorna todos os ativos monitorados sem duplicatas (~80 ativos) */
    getAll: function() {
      const all = Object.values(CATEGORIES).flat();
      return [...new Set(all)];
    },

    /** Retorna ativos por categoria específica */
    getByCategory: function(catName) {
      return CATEGORIES[catName.toUpperCase()] || [];
    },

    /** 
     * Retorna o mapa de setores para o RiskManager (evita hardcoding duplicado)
     * Cada ticker mapeia para seu setor econômico
     */
    getSectorMap: function() {
      return {
        // Mineração / Siderurgia / Metalurgia
        'VALE3':'Mineração', 'GGBR4':'Siderurgia', 'CSNA3':'Siderurgia',
        'USIM5':'Siderurgia', 'BRAP4':'Siderurgia', 'GOAU4':'Siderurgia',
        'RANI3':'Mineração', 'RECV3':'Siderurgia',
        // Energia (Petróleo & Gás)
        'PETR4':'Energia', 'PRIO3':'Energia', 'CSAN3':'Energia',
        // Bancos
        'ITUB4':'Bancos', 'BBAS3':'Bancos', 'BBDC4':'Bancos', 'BPAC11':'Bancos',
        'SANB11':'Bancos', 'ITSA4':'Bancos', 'BRSR6':'Bancos', 'BMGB4':'Bancos',
        'BANB11':'Bancos', 'NUBR33':'Bancos',
        // Financeiro (não-bancos)
        'B3SA3':'Financeiro', 'XPBR31':'Financeiro', 'BIDI11':'Financeiro',
        'BTG11':'Financeiro', 'KOF33':'Financeiro',
        // Elétrico / Saneamento
        'SBSP3':'Saneamento', 'ELET3':'Elétrico', 'EQTL3':'Elétrico',
        'CPLE3':'Elétrico', 'TAEE11':'Elétrico', 'TRPL4':'Elétrico',
        'EGIE3':'Elétrico', 'ISAE4':'Elétrico', 'SAPR11':'Elétrico',
        'NEOE3':'Elétrico', 'AURE3':'Elétrico', 'ENBR3':'Elétrico',
        'ENGI11':'Elétrico',
        // Saúde
        'HYPE3':'Saúde', 'RDOR3':'Saúde', 'RADL3':'Saúde',
        'FLRY3':'Saúde', 'HAPV3':'Saúde', 'QUAL3':'Saúde',
        'MATD3':'Saúde', 'ONCO3':'Saúde', 'DASA3':'Saúde',
        'ODPV3':'Saúde', 'AALR3':'Saúde', 'KEPL3':'Saúde',
        'PFRM3':'Saúde',
        // Telecom / Tecnologia
        'VIVT3':'Telecom', 'TOTS3':'Tecnologia', 'CASH3':'Tecnologia',
        'NVDC33':'Tecnologia', 'MELI34':'Tecnologia',
        // Consumo / Varejo / Alimentos
        'ABEV3':'Consumo', 'JBSS3':'Alimentos', 'MRFG3':'Alimentos',
        'BRFS3':'Alimentos', 'SMTO3':'Consumo', 'KLBN11':'Papel e Celulose',
        'SUZB3':'Papel e Celulose', 'WEGE3':'Industrial', 'MGLU3':'Varejo',
        'LREN3':'Varejo', 'ARZZ3':'Varejo', 'PCAR3':'Varejo',
        'AMER3':'Varejo', 'VIIA3':'Varejo', 'CEAB3':'Varejo',
        'AUAU3':'Varejo', ' AUAU3':'Varejo', 'VIVA3':'Varejo',
        // Locação / Logística / Transporte
        'RENT3':'Locação', 'RAIL3':'Logística', 'LZPS3':'Logística',
        'POMO4':'Construção',
        // Diversos
        'ALOS3':'Serviços',
        // Fiis (incluídos para contexto de portfolio)
      };
    },

    /** 
     * Obtém o setor de um ticker a partir do mapa interno
     * Útil para o RiskManager validar exposição setorial
     */
    getSector: function(ticker) {
      var map = this.getSectorMap();
      return map[ticker] || 'Outros';
    },

    /** 
     * Lógica de Proteção de API: Evita re-análise desnecessária
     */
    deveAnalisar: function(ticker, agora) {
      if (!tickerAnalysisCache[ticker]) return true;
      return (agora - tickerAnalysisCache[ticker] > ANALYZE_INTERVAL_MS);
    },

    /** Atualiza o checkpoint de análise do ativo */
    atualizarUltimaAnalise: function(ticker, timestamp) {
      tickerAnalysisCache[ticker] = timestamp;
    },

    /** Limpa o histórico de análise (chamado na manutenção da madrugada) */
    limparCache: function() {
      for (const key in tickerAnalysisCache) delete tickerAnalysisCache[key];
      console.log('🧹 Cache de Tickers reiniciado para o novo pregão.');
    },

    /**
     * Filtra tickers por volume mínimo (R$ 5M) usando dados da Brapi
     * @param {Array} tickers - Lista opcional de tickers (usa getAll() se vazio)
     * @returns {Array} Tickers filtrados por liquidez
     */
    filtrarPorLiquidez: function(tickers) {
      tickers = tickers || this.getAll();
      try {
        if (typeof BrapiFetcher !== 'undefined' && typeof BrapiFetcher.fetchTickerInfo === 'function') {
          var info = BrapiFetcher.fetchTickerInfo(tickers);
          if (info && info.length > 0) {
            var volumeMinimo = CONFIG ? CONFIG.get('VOLUM_MEDIO_MINIMO', 5000000) : 5000000;
            var filtrados = info.filter(function(t) {
              return t && t.volume && t.volume >= volumeMinimo;
            }).map(function(t) { return t.ticker; });
            if (filtrados.length > 0) {
              console.log('📊 Liquidez: ' + filtrados.length + '/' + tickers.length + ' tickers com volume > R$ ' + (volumeMinimo/1e6).toFixed(0) + 'M');
              return filtrados;
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Não foi possível filtrar por liquidez: ' + e.message);
      }
      return tickers; // Fallback: retorna lista completa
    }
  };
})();