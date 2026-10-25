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

      // =======================================================================
      // 🔧 v6.0 [CORREÇÃO]: O SENTINELA NÃO SOBRESCREVE MAIS A GEOMETRIA
      // -----------------------------------------------------------------------
      // BUG ANTERIOR (linhas 73-91 da v5.0): este módulo RECALCULAVA o stop:
      //
      //     let stopFinal = preco - (atr * 2.0);
      //     if (fibo618 > 0 && fibo618 < preco) {
      //       stopFinal = Math.min(stopFinal, fibo618 * 0.99);  // pega o MAIS DISTANTE
      //     }
      //     return { stop: stopFinal, target: op.target1, rr_ratio: op.rr };
      //
      // O stop era INVENTADO aqui, mas `target` e `rr_ratio` vinham intactos do
      // 22_Core_Analyzers — ou seja, TRÊS grandezas medindo DUAS geometrias
      // diferentes. Resultado observado em 46 de 46 linhas de 'Resultados_Analise':
      //
      //   ITUB4  : stop 41,20 -> risco 4,36%  mas Risco% gravado 2,67%  (dif 1,69)
      //   BBDC4  : stop 17,57 -> risco 3,25%  mas Risco% gravado 2,32%  (dif 0,93)
      //   BPAC11 : stop 57,15 -> risco 10,00% mas Risco% gravado 6,93%  (dif 3,07)
      //
      // Em VALE3 e PETR4 a diferença era 0,00 — justamente onde o stop calculado
      // aqui coincidiu com o do Core22. Isso PROVA que a divergência vem daqui.
      //
      // Também era um erro conceitual: `Math.min` escolhe o stop MAIS DISTANTE,
      // ou seja, o MAIOR risco — o oposto de um "stop sniper" (proteção apertada).
      //
      // AGORA: a geometria (stop / alvo / R-R / risco%) é responsabilidade EXCLUSIVA
      // do 22_Core_Analyzers (que já aplica teto de 2,5×ATR na v22.15) +
      // 28_Position_Geometry (que garante a coerência entre as métricas).
      // Este módulo atua APENAS no que é sua competência:
      //   • exaustão da carteira, correlação setorial e tamanho da mão.
      // =======================================================================
      const preco = op.price;
      const stopRecebido = op.stopLoss || op.stop || 0;
      // ATR apenas para o metadado de auditoria `_atrRef` (não recalcula nada).
      const atr = (op.indicators && op.indicators.atr) || (preco > 0 ? preco * 0.03 : 0);

      // Diagnóstico: avisa se o stop recebido for geometricamente inválido para
      // compra (stop >= preço). NÃO corrige — apenas sinaliza em veto_reason para
      // que o problema fique visível em vez de ser mascarado.
      let avisoGeometria = '';
      if (preco > 0 && stopRecebido > 0 && stopRecebido >= preco) {
        avisoGeometria = 'Geometria inválida recebida (stop >= preço) — revisar Core22.';
        console.warn('⚠️ [RiskManager] ' + ticker + ': ' + avisoGeometria);
      }

      return {
        approved: true,
        suggested_allocation: sizeFactor,
        // ── Geometria PRESERVADA (fonte: 22_Core_Analyzers + 28_Position_Geometry)
        stop: stopRecebido,
        target: op.target1 || 0,
        target2: op.target2 || 0,
        rr_ratio: op.rr || 0,
        // ── Metadados de auditoria (não alteram o cálculo a jusante)
        _geometriaPreservada: true,
        _fonteGeometria: '22_Core_Analyzers',
        _atrRef: atr,
        veto_reason: avisoGeometria
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
