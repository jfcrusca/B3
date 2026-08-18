/**
 * 37_Agent_RiskManager.gs — GESTOR INTEGRADO DE RISCO E PORTFÓLIO V5.0
 * =============================================================================
 * ✅ PAPEL: Filtro final de decisão. Valida correlação, exaustão e tamanho da mão.
 * ✅ INTEGRAÇÃO: Fusão do RiskManager com SectorCorrelationFilter.
 */
var AgentRiskManager = (function() {
  'use strict';

  // --- CONFIGURAÇÕES DE RISCO ---
  const MAX_POSITIONS = 12;      // Limite máximo de ativos na carteira [1, 2]
  const MAX_PER_SECTOR = 2;      // Máximo de ativos por setor B3 [Proposta Agêntica]
  const RISK_PER_TRADE = 0.02;   // Arriscar 2% do capital por trade [3, 4]

  function _cfg(key, fallback) {
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function') ? CONFIG.get(key, fallback) : fallback;
  }
  
  // 🔧 v11: Mapa de setores centralizado no TickerManager (fonte única de verdade)
  // Evita duplicação de manutenção entre arquivos
  function _getSectorMap() {
    if (typeof B3V10_TICKER_MANAGER !== 'undefined' && typeof B3V10_TICKER_MANAGER.getSectorMap === 'function') {
      return B3V10_TICKER_MANAGER.getSectorMap();
    }
    // Fallback para compatibilidade
    return {};
  }

  return {
    /**
     * Valida a oportunidade sob a ótica de risco e diversificação.
     * @param {Object} op Oportunidade (score, price, atr, fiboPrice)
     * @param {Object} portfolioContext Dados da carteira atual (totalPositions)
     */
    validateAndSize: function(op, portfolioContext) {
      const ticker = op.ticker;
      const score = op.score || 0;
      const maxPositions = Number(_cfg('MAX_POSITIONS', MAX_POSITIONS));
      const maxPerSector = Number(_cfg('MAX_PER_SECTOR', MAX_PER_SECTOR));
      const eliteScore = Number(_cfg('RISK_MANAGER_ELITE_SCORE', 92));

      // 1. CHECK DE EXAUSTÃO DA CARTEIRA [1, 6]
      // Se carteira cheia, exige score de Elite absoluta
      const posicoesAbertas = portfolioContext?.totalPositions || this._getOpenPositionsCount();
      if (posicoesAbertas >= maxPositions && score < eliteScore) {
        return { approved: false, reason: `Carteira Cheia (${posicoesAbertas}). Exige Score > ${eliteScore}.` };
      }

      // 2. FILTRO DE CORRELAÇÃO SETORIAL
      const sectorMap = _getSectorMap();
      const setorNovo = sectorMap[ticker] || "Outros";
      const ativosAtuais = this._getOpenTickersFromPortfolio();
      let countSetor = 0;
      ativosAtuais.forEach(t => {
        var setorAtivo = sectorMap[t] || "Outros";
        if (setorAtivo === setorNovo) countSetor++;
      });

      if (countSetor >= maxPerSector) {
        return { approved: false, reason: `Veto Setorial: Já possui ${countSetor} ativos em [${setorNovo}].` };
      }

      // 3. CALCULO DE POSITION SIZING DINÂMICO [1, 7]
      // Define o "Tamanho da Mão" baseado na qualidade e volatilidade
      let sizeFactor = 1.0;
      const volFactor = op.volFactor || 0;

      // Penaliza exposição em ativos muito voláteis ou setups duvidosos
      if (score < Number(_cfg('RISK_MANAGER_REDUCED_SIZE_SCORE', 80)) || volFactor > Number(_cfg('RISK_MANAGER_MAX_VOL_FACTOR', 4.5))) {
        sizeFactor = 0.5; // Reduz mão para 50% do lote padrão
      }

      // 4. GESTÃO DE STOP SNIPER (ATR + FIBO)
      const preco = op.price;
      const atr = op.indicators?.atr || (preco * 0.03);
      const fibo618 = op.fiboPrice || 0;

      // Stop técnico protegido: 2x ATR ou Fibo 61.8%
      let stopFinal = preco - (atr * 2.0);
      if (fibo618 > 0 && fibo618 < preco) {
        stopFinal = Math.min(stopFinal, fibo618 * 0.99); // Esconde 1% abaixo do Fibo
      }

      return {
        approved: true,
        suggested_allocation: sizeFactor,
        stop: parseFloat(stopFinal.toFixed(2)),
        target: op.target1,
        rr_ratio: op.rr,
        veto_reason: ""
      };
    },

    /** 
     * Busca os tickers das posições abertas na aba Carteira.
     * Ajustado para o layout Sniper V10: Papel(B)=1, Qtd(C)=2. [8, 9]
     */
    _getOpenTickersFromPortfolio: function() {
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName('Carteira');
        if (!sheet) return [];
        
        const data = sheet.getDataRange().getValues();
        const tickers = [];
        
        for (let i = 1; i < data.length; i++) {
          const ticker = String(data[i][1]).trim().toUpperCase(); // Coluna B (índice 1)
          const qtd = parseFloat(data[i][2]) || 0;               // Coluna C (índice 2)
          if (ticker && ticker !== "PAPEL" && qtd > 0) tickers.push(ticker);
        }
        return tickers;
      } catch (e) {
        console.error("Erro ao ler carteira para filtro setorial: " + e.message);
        return [];
      }
    },

    _getOpenPositionsCount: function() {
      return this._getOpenTickersFromPortfolio().length;
    }
  };
})();
