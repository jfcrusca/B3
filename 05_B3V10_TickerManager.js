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
    "PCAR3":  "Inativo (Pão de Açúcar sem dados de mercado disponíveis)",
    "ELET3":  "Alterado para AXIA3 (ações ordinárias)",
    "ARZZ3":  "Alterado para AZZA3",
    "BIDI11": "Alterado para INBR32",
    "TRPL3":  "Alterado para ISAE3 (ISA Energia — ações ordinárias/ON)",
    "TRPL4":  "Alterado para ISAE4 (ISA Energia — ações preferenciais/PN)",
    "VIIA3":  "Alterado para BHIA3 (Via → BH)",
    "JBSS3":  "Alterado para JBSS32 (BDR da JBS)"
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
    "MRFG3":  "JBSS32",  // Alimentos (mesmo setor)
    "BTG11":  "BPAC11",  // BTG exposure via BPAC11 (já incluso)
    "BRFS3":  "MBRF3",   // Código correto atualizado
    "ELET3":  "AXIA3",   // Substituído por AXIA3 (Eletrobras)
    "ARZZ3":  "AZZA3",   // Substituído por AZZA3 (Azzas)
    "BIDI11": "INBR32",  // Inter migrou para BDR INBR32
    "TRPL3":  "ISAE3",   // ISA Energia — ações ordinárias (ON)
    "TRPL4":  "ISAE4",   // ISA Energia — ações preferenciais (PN)
    "VIIA3":  "BHIA3",   // Via → BH
    "JBSS3":  "JBSS32"   // BDR da JBS (código atual na B3)
  };

  // 🔧 v14.3: ALIASES — mapeia tickers alternativos/códigos antigos para o
  // ticker canônico usado pelo sistema. Ex: JBSS3 (ação ordinária antiga) é
  // convertido para JBSS32 (BDR da JBS, código atual na B3 desde jun/2025).
  // O alias garante que fontes que retornem o código antigo sejam normalizadas.
  var _tickerAliases = {
    "JBSS3": "JBSS32",   // JBS migrou de ações ordinárias (JBSS3) para BDR (JBSS32)
    "NBR32": "INBR32",   // Alias para facilidade de digitação/caso o usuário utilize
    "TRPL3": "ISAE3",    // Transmissão Paulista ON → ISA Energia (ISAE3)
    "TRPL4": "ISAE4",    // Transmissão Paulista PN → ISA Energia (ISAE4)
    "VIIA3": "BHIA3"     // Via → BH (BHIA3)
  };

  // === LISTAS CONSOLIDADAS (Julho 2026) — Expandidas para ~80 tickers líquidos ===
  // Critério: Volume médio diário > R$ 5M nos últimos 3 meses
  // ⚠️ Tickers inativos/alterados foram removidos: LZPS3, NVDC33, ENBR3, BANB11, NUBR33, ODPV3
  const CATEGORIES = {
    // ── Blue Chips: Resiliência e Fluxo (Tier 1 principal) ──
    SAFETY: [
      "VALE3", "PETR4", "ITUB4", "BBAS3", "WEGE3",
      "ABEV3", "BBDC4", "BPAC11", "B3SA3", "SUZB3",
      "AXIA3", "VIVT3", "SBSP3", "EQTL3", "CSAN3"
    ],
    
    // ── Cíclicas: Commodities e Juros (Swing Trade Tático) ──
    CYCLICAL: [
      "GGBR4", "RAIL3", "PRIO3", "CMIG4", "CSNA3",
      "USIM5", "BRAP4", "RANI3", "GOAU4", "RECV3"
    ],
    
    // ── Growth/Vol: Beta Alto para Momentum ──
    GROWTH: [
      "RENT3", "MGLU3", "HYPE3", "RDOR3", "RADL3",
      "LREN3", "AZZA3", "POMO4", "TOTS3", "LOGG3",
      "CASH3", "NVDC34", "MELI34", "ALOS3"
    ],
    
    // ── Tactical: Setores Estáveis (Defensivo/Dividendos) ──
    TACTICAL: [
      "CPLE3", "TAEE11", "ISAE4", "EGIE3",
      "SAPR11", "AURE3", "ENGI11"
    ],
    
    // ── Saúde: Setor com forte momentum em 2026 ──
    HEALTHCARE: [
      "FLRY3", "HAPV3", "QUAL3", "MATD3", "ONCO3",
      "DASA3", "AALR3", "KEPL3", "PFRM3"
    ],
    
    // ── Consumo: Varejo e Alimentos ──
    CONSUMER: [
      "JBSS32", "SMTO3", "KLBN11", "MBRF3",
      "BHIA3", "CEAB3", "VIVA3"
    ],
    
    // ── Financeiro: Bancos e Serviços Financeiros ──
    FINANCIAL: [
      "SANB11", "ITSA4", "BRSR6", "BMGB4", "BBSE3",
      "ROXO34", "XPBR31", "INBR32"
    ]
  };

  /**
   * 🔧 v14.4 (OPÇÃO E — ANTI-TIMEOUT): UNIVERSO CURADO DO SCANNER.
   *
   * Motivo: o custo real por ticker é 9-18s (cascata GoogleFinance → Bolsai →
   * BRAPI) contra um orçamento de 210s. Os 70 ativos de CATEGORIES eram
   * estruturalmente impossíveis de varrer — o que gerava as linhas
   * "⏱️ TIMEOUT" na Resultados_Analise (caso CASH3, linhas 37-71).
   *
   * Estratégia de 2 tiers (~40 ativos), aprovada pelo usuário:
   *   TIER 1 (30) — alta liquidez/líderes: SEMPRE varridos.
   *   TIER 2 (10) — complementares de qualidade: varridos se houver tempo.
   *
   * CATEGORIES permanece intacto (fonte de verdade para setores, Ranker,
   * Carteira e Simulação) — apenas o SCANNER usa o universo curado.
   */
  var SCANNER_UNIVERSE = {
    // ── TIER 1 (30): blue chips + alta liquidez — prioridade máxima ──
    TIER1: [
      "VALE3", "PETR4", "ITUB4", "BBAS3", "WEGE3",
      "ABEV3", "BBDC4", "BPAC11", "B3SA3", "SUZB3",
      "AXIA3", "VIVT3", "SBSP3", "EQTL3", "CSAN3",
      "GGBR4", "RAIL3", "PRIO3", "CMIG4", "RENT3",
      "MGLU3", "HYPE3", "RDOR3", "RADL3", "LREN3",
      "SANB11", "ITSA4", "CPLE3", "TAEE11", "JBSS32"
    ],
    // ── TIER 2 (10): complementares de qualidade — se houver tempo ──
    TIER2: [
      "TOTS3", "CSNA3", "USIM5", "EGIE3", "FLRY3",
      "HAPV3", "QUAL3", "MBRF3", "BBSE3", "SMTO3"
    ],
    /**
     * ── TIER 3 (8, v14.5): ATIVOS ESCOLHIDOS POR TESE DE SWING TRADE ──
     *
     * Critério de seleção (auditado sobre os 30 ativos que ficaram fora do
     * universo na v14.4):
     *   ✓ Liquidez alta/altíssima (entrada/saída sem slippage);
     *   ✓ Tese de swing trade concreta (tendência, dividendo, turnaround);
     *   ✓ SEM sobreposição com o que já está nos Tiers 1/2;
     *   ✗ DESCARTA problemáticos conhecidos: DASA3 / ONCO3 / HAPV3 já tratados
     *     (séries defasadas que disparam "Nível 2"), BRSR6 / BMGB4 / AALR3 /
     *     PFRM3 / AURE3 (liquidez baixa), BRAP4 (espelha VALE3, que já está no
     *     Tier 1 — seria duplicar exposição).
     */
    TIER3: [
      "KLBN11",  // Papel e Celulose — unit de liquidez altíssima, exportadora
      "ISAE4",   // Elétrico/Transmissão — receita previsível, bom pagador
      "ENGI11",  // Elétrico — defensivo consolidado, boa liquidez
      "SAPR11",  // Saneamento — dividendos fortes, defensivo
      "AZZA3",   // Varejo — ex-ARZZ3, momentum de consumo
      "VIVA3",   // Varejo — joias, margem alta, tendência de alta
      "ROXO34",  // BDR Nubank — banco digital, liquidez alta
      "ALOS3"    // Shoppings — fundo de tijolo com tese de juros
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

    /** 🔧 v14.3: Normaliza um ticker via alias (ex: JBSS3 -> JBSS32) para o ticker canônico.
     *  Se não houver alias/arquivo regex, retorna o próprio ticker (upper case). */
    resolveTicker: function(ticker) {
      if (!ticker) return ticker;
      var t = String(ticker).toUpperCase().replace(/\.SA$/, '').trim();
      if (_tickerAliases[t]) return _tickerAliases[t];
      return t;
    },

    /** 🔧 v14.3: Normaliza uma lista de tickers (aplica resolveTicker em cada um). */
    resolveTickerList: function(tickers) {
      if (!Array.isArray(tickers)) return tickers;
      return tickers.map(function(t) { return this.resolveTicker(t); }, this);
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

    /**
     * 🔧 v12.8: Detecta se um ticker é BDR (Brazilian Depositary Receipt) ou
     * ETF internacional — ativos cujo histórico costuma vir problemático/
     * desatualizado das fontes (ex.: ACNB34, NVDC34). BDRs têm sufixo 32..39
     * (ex.: 32=JBS, 33=Nubank, 34=ACNB/Nvidia). ETFs internacionais: prefixos
     * conhecidos (IVVB, BOVA, XINA, NASD, SPXI, etc.).
     * @param {string} ticker
     * @returns {boolean}
     */
    isBDR: function(ticker) {
      if (!ticker) return false;
      var t = String(ticker).toUpperCase().replace(/\.SA$/, '').trim();
      // BDR: 4 letras + terminação 32..39 (32=JBS, 33=Nubank, 34=ACNB/Nvidia, ...)
      if (/^\w{4}(3[2-9])$/.test(t)) return true;
      // ETFs internacionais comumente problemáticos no histórico
      if (/^(IVVB|BOVA|SMAL|XINA|NASD|SPXI|HASH|BITH|QDFI|ECOO|GOLD|ISPU|EURP|ACWI|WRLD|BIOM|FIND|DIVO|PIBB)\d*/.test(t)) return true;
      return false;
    },

    /**
     * 🔧 v12.8: Filtra BDRs/ETF internacionais de uma lista, logando os removidos.
     * @param {Array<string>} tickers
     * @returns {Array<string>}
     */
    filterBDRs: function(tickers) {
      if (!Array.isArray(tickers)) return [];
      var self = this;
      var removidos = [];
      var filtrados = tickers.filter(function(t) {
        if (self.isBDR(t)) { removidos.push(t); return false; }
        return true;
      });
      if (removidos.length > 0) {
        console.log("⏭️ [TickerManager] " + removidos.length + " BDR(s)/ETF(s) internacional(is) removido(s): " + removidos.join(", "));
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

    /**
     * 🔧 v14.4/14.5 (OPÇÃO E): UNIVERSO CURADO DO SCANNER (~48 ativos em 3 tiers).
     * Substitui getAll() no scanner. Mantém CATEGORIES intacto para setores/
     * Ranker/Carteira, mas limita o que é efetivamente varrido por execução —
     * compatível com o orçamento de 210s (custo real 9-18s por ticker).
     * v14.5: + TIER3 (8 ativos por tese de swing trade) → 48 no total, ainda
     *        com 4,28s/ticker de fôlego (vs. 2,91s do problema original).
     * @returns {Array<string>} TIER1 + TIER2 + TIER3, sem duplicatas.
     */
    getScannerUniverse: function() {
      return this._juntarTiers([SCANNER_UNIVERSE.TIER1, SCANNER_UNIVERSE.TIER2, SCANNER_UNIVERSE.TIER3]);
    },

    /**
     * 🔧 v14.5: Concatena tiers removendo vazios e duplicatas, preservando a
     * ordem de prioridade (Tier 1 → Tier 2 → Tier 3).
     * @param {Array<Array<string>>} tiers
     * @returns {Array<string>}
     */
    _juntarTiers: function(tiers) {
      var vistos = {};
      var out = [];
      for (var k = 0; k < tiers.length; k++) {
        var arr = tiers[k] || [];
        for (var i = 0; i < arr.length; i++) {
          var t = arr[i];
          if (!t || vistos[t]) continue;
          vistos[t] = true;
          out.push(t);
        }
      }
      return out;
    },

    /**
     * 🔧 v14.4 (OPÇÃO E): Apenas o TIER 1 (30 ativos de alta liquidez).
     * Usado quando o orçamento está apertado e só os líderes cabem na varredura.
     * @returns {Array<string>} Lista do Tier 1 (sem duplicatas).
     */
    getScannerTier1: function() {
      return [...new Set(SCANNER_UNIVERSE.TIER1 || [])];
    },

    /**
     * 🔧 v14.5 (OPÇÃO E): Universo reduzido para cenário de orçamento apertado —
     * somente Tier 1 + Tier 2 (40 ativos). Útil como fallback se o aquecimento
     * de cache consumir tempo demais ou as APIs estiverem lentas.
     * @returns {Array<string>} Lista dos Tiers 1 e 2 (sem duplicatas).
     */
    getScannerUniverseReduzido: function() {
      return this._juntarTiers([SCANNER_UNIVERSE.TIER1, SCANNER_UNIVERSE.TIER2]);
    },

    /**
     * 🔧 v14.4/14.5 (OPÇÃO E): Exposto para auditoria/teste da composição.
     * @returns {{TIER1: Array<string>, TIER2: Array<string>, TIER3: Array<string>}}
     */
    getScannerUniverseConfig: function() {
      return {
        TIER1: (SCANNER_UNIVERSE.TIER1 || []).slice(),
        TIER2: (SCANNER_UNIVERSE.TIER2 || []).slice(),
        TIER3: (SCANNER_UNIVERSE.TIER3 || []).slice()
      };
    },

    /**
     * 🔧 v14.2 (ANTI-TIMEOUT): Prioridade de categorias para o scanner.
     * O scanner tem orçamento FIXO de tempo (210s). Quando o universo (~70 ativos)
     * não cabe no orçamento, os últimos tickers da fila eram abandonados com
     * "⏱️ TIMEOUT" (ex.: CASH3 na linha 37 da Resultados_Analise). Ordenar por
     * prioridade de liquidez garante que os ativos mais negociados sejam SEMPRE
     * analisados primeiro, e que a perda (se houver) recaia sobre ativos ilíquidos.
     * Ordem: SAFETY (blue chips) → CYCLICAL → GROWTH → FINANCIAL → HEALTHCARE
     *        → CONSUMER → TACTICAL (defensivos/dividendos, menos críticos p/ swing).
     * @type {Array<string>}
     */
    CATEGORY_PRIORITY: ['SAFETY', 'CYCLICAL', 'GROWTH', 'FINANCIAL', 'HEALTHCARE', 'CONSUMER', 'TACTICAL'],

    /**
     * 🔧 v14.2 (ANTI-TIMEOUT): Retorna o universo ordenado por liquidez/prioridade.
     * Diferente de getAll() (ordem literal do objeto CATEGORIES), esta função
     * agrupa por categoria seguindo CATEGORY_PRIORITY, de modo que o scanner
     * consuma primeiro os ativos de maior liquidez. Se o tempo acabar no meio,
     * os TIMEOUTs serão de ativos menos relevantes — e não de blue chips.
     * @returns {Array<string>} Lista de tickers priorizada, sem duplicatas.
     */
    getOrdered: function() {
      var ordered = [];
      var vistos = {};
      var self = this;
      var prioridade = self.CATEGORY_PRIORITY || [];

      // 1) Percorre as categorias na ordem de prioridade definida.
      for (var p = 0; p < prioridade.length; p++) {
        var cAT = CATEGORIES[prioridade[p]] || [];
        for (var i = 0; i < cAT.length; i++) {
          var t = cAT[i];
          if (!t || vistos[t]) continue;
          vistos[t] = true;
          ordered.push(t);
        }
      }

      // 2) Rede de segurança: inclui qualquer categoria nova que não esteja em
      // CATEGORY_PRIORITY (evita perder ativos se uma categoria for adicionada).
      Object.keys(CATEGORIES).forEach(function(catName) {
        if (prioridade.indexOf(catName) !== -1) return;
        var arr = CATEGORIES[catName] || [];
        for (var j = 0; j < arr.length; j++) {
          var tk = arr[j];
          if (!tk || vistos[tk]) continue;
          vistos[tk] = true;
          ordered.push(tk);
        }
      });

      return ordered;
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
        'B3SA3':'Financeiro', 'XPBR31':'Financeiro', 'INBR32':'Financeiro', 'NBR32':'Financeiro',
        'BTG11':'Financeiro', 'KOF33':'Financeiro',
        // Elétrico / Saneamento
        'SBSP3':'Saneamento', 'AXIA3':'Elétrico', 'EQTL3':'Elétrico',
        'CPLE3':'Elétrico', 'TAEE11':'Elétrico', 'ISAE3':'Elétrico',
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
        'ABEV3':'Consumo', 'JBSS32':'Alimentos', 'MRFG3':'Alimentos',
        'BRFS3':'Alimentos', 'SMTO3':'Consumo', 'KLBN11':'Papel e Celulose',
        'SUZB3':'Papel e Celulose', 'WEGE3':'Industrial', 'MGLU3':'Varejo',
        'LREN3':'Varejo', 'AZZA3':'Varejo', 'PCAR3':'Varejo',
        'AMER3':'Varejo', 'BHIA3':'Varejo', 'CEAB3':'Varejo',
        'VIVA3':'Varejo',
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
     * 🔧 v12.9: Filtra tickers por LIQUIDEZ usando o VOLUME MÉDIO dos candles
     * (via DataService.getMarketData) — NÃO depende de API de quote inexistente.
     * Volume médio diário em R$ = média(volume × close) na janela configurada.
     * @param {Array} tickers - Lista opcional (usa getAll() se vazio)
     * @returns {Array} Tickers com volume médio >= LIQUIDEZ_VOLUME_MINIMO
     */
    filtrarPorLiquidez: function(tickers) {
      tickers = tickers || this.getAll();
      if (!Array.isArray(tickers) || tickers.length === 0) return [];
      try {
        var cfg = (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function') ? CONFIG : null;
        var volMin = cfg ? Number(cfg.get('LIQUIDEZ_VOLUME_MINIMO', 2000000)) : 2000000;
        var dias = cfg ? Number(cfg.get('LIQUIDEZ_DIAS_MEDIA', 20)) : 20;
        if (typeof DataService === 'undefined' || typeof DataService.getMarketData !== 'function') {
          return tickers; // sem fonte de dados: não filtra
        }
        var filtrados = [];
        for (var t = 0; t < tickers.length; t++) {
          var tk = tickers[t];
          var data = DataService.getMarketData(tk, '1d', '3mo');
          var candles = (data && data.candles) ? data.candles : null;
          if (!candles || candles.length < 5) continue; // sem dados: descarta
          var inicio = Math.max(0, candles.length - dias);
          var soma = 0, n = 0;
          for (var i = inicio; i < candles.length; i++) {
            var c = candles[i];
            var v = (c && typeof c.volume === 'number') ? c.volume : 0;
            var cl = (c && typeof c.close === 'number') ? c.close : 0;
            if (v > 0 && cl > 0) { soma += v * cl; n++; }
          }
          var volMedioRs = n > 0 ? (soma / n) : 0;
          if (volMedioRs >= volMin) filtrados.push(tk);
        }
        if (filtrados.length > 0) {
          console.log('📊 Liquidez: ' + filtrados.length + '/' + tickers.length +
            ' tickers com volume médio >= R$ ' + (volMin / 1e6).toFixed(1) + 'M');
          return filtrados;
        }
        console.warn('⚠️ [Liquidez] Nenhum ticker passou no filtro — retornando lista completa (fallback).');
      } catch (e) {
        console.warn('⚠️ Não foi possível filtrar por liquidez: ' + e.message);
      }
      return tickers; // Fallback: retorna lista completa
    }
  };
})();