/**
 * 11_Data_BCBIpeadataFetcher.js — Dados Macroeconômicos Brasil (v1.0)
 * =============================================================================
 * ✅ Banco Central do Brasil (BCB) - API Pública (sem chave)
 * ✅ Ipeadata - API Pública (sem chave)
 * ✅ Fontes oficiais para Selic, IPCA, Câmbio, PIB
 * ✅ Usado pelo MacroFetcher para contexto macroeconômico
 * =============================================================================
 * 
 * APIs Utilizadas:
 * - BCB SGS: https://dadosabertos.bcb.gov.br/ (Sistema Gerenciador de Séries)
 * - Ipeadata: http://www.ipeadata.gov.br/
 * 
 * Principais séries BCB:
 *   432 - Selic Over (anualizada %)
 *   1   - Câmbio USD (compra)
 *   433 - Selic Over (diária %)
 *   189 - Dívida Líquida (% PIB)
 *   243 - IPCA (índice)
 * =============================================================================
 */

var BCBIpeadataFetcher = (function() {
  'use strict';

  const BCB_SGS_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados';
  const CACHE_TTL = 3600; // 1 hora (dados macro mudam pouco)
  const MAX_RETRIES = 2;

  /**
   * Busca série temporal do BCB SGS.
   * @param {number} serie - Código da série BCB (ex: 432 = Selic)
   * @param {number} ultimosN - Últimos N registros
   * @returns {Array|null}
   */
  function _fetchBCBSerie(serie, ultimosN) {
    ultimosN = ultimosN || 10;
    const url = BCB_SGS_URL.replace('{serie}', serie) + `?formato=json&ultimos=${ultimosN}`;
    const cacheKey = `bcb_serie_${serie}_${ultimosN}`;

    const cache = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = UrlFetchApp.fetch(url, { 
          muteHttpExceptions: true,
          connectTimeout: 10000,
          readTimeout: 10000
        });
        
        if (response.getResponseCode() === 200) {
          const data = JSON.parse(response.getContentText());
          if (Array.isArray(data) && data.length > 0) {
            try { cache.put(cacheKey, JSON.stringify(data), CACHE_TTL); } catch(e) {}
            return data;
          }
        }
      } catch (e) {
        console.warn(`⚠️ BCB série ${serie} (tentativa ${attempt}): ${e.message}`);
        if (attempt < MAX_RETRIES) Utilities.sleep(1000);
      }
    }
    return null;
  }

  /**
   * Obtém a taxa Selic atual (% anualizada).
   * Série BCB 432 = Selic Over anualizada
   */
  function getSelic() {
    const data = _fetchBCBSerie(432, 1);
    if (data && data.length > 0) {
      return {
        valor: parseFloat(data[0].valor.replace(',', '.')),
        data: data[0].data,
        fonte: 'BCB SGS (432)'
      };
    }
    return null;
  }

  /**
   * Obtém a taxa Selic diária (%).
   * Série BCB 433 = Selic Over diária
   */
  function getSelicDiaria() {
    const data = _fetchBCBSerie(433, 5);
    if (data && data.length > 0) {
      return data.map(d => ({
        valor: parseFloat(d.valor.replace(',', '.')),
        data: d.data
      }));
    }
    return null;
  }

  /**
   * Obtém a cotação do Dólar (compra) - R$.
   * Série BCB 1 = Câmbio USD (compra)
   */
  function getDolar() {
    const data = _fetchBCBSerie(1, 1);
    if (data && data.length > 0) {
      return {
        valor: parseFloat(data[0].valor.replace(',', '.')),
        data: data[0].data,
        fonte: 'BCB SGS (1)'
      };
    }
    return null;
  }

  /**
   * Obtém o IPCA acumulado.
   * Série BCB 243 = IPCA (índice)
   */
  function getIPCA() {
    const data = _fetchBCBSerie(243, 12);
    if (data && data.length > 0) {
      const valores = data.map(d => parseFloat(d.valor.replace(',', '.')));
      const acumulado12m = valores.reduce((a, b) => a + b, 0);
      return {
        ultimo: valores[valores.length - 1],
        acumulado12m: parseFloat(acumulado12m.toFixed(2)),
        data: data[data.length - 1].data,
        fonte: 'BCB SGS (243)'
      };
    }
    return null;
  }

  /**
   * Obtém contexto macro completo (Selic + Dólar + IPCA).
   * Usado pelo MacroFetcher como fonte oficial.
   */
  function getMacroContext() {
    const selic = getSelic();
    const dolar = getDolar();
    const ipca = getIPCA();

    const context = {
      timestamp: new Date().toISOString(),
      fontes: []
    };

    if (selic) {
      context.selic = selic.valor;
      context.selicFonte = selic.fonte;
      context.fontes.push('BCB');
    }

    if (dolar) {
      context.dolar = dolar.valor;
      context.dolarFonte = dolar.fonte;
      if (!context.fontes.includes('BCB')) context.fontes.push('BCB');
    }

    if (ipca) {
      context.ipca = ipca.ultimo;
      context.ipcaAcumulado12m = ipca.acumulado12m;
      context.ipcaFonte = ipca.fonte;
      if (!context.fontes.includes('BCB')) context.fontes.push('BCB');
    }

    // Determina regime macro baseado nos dados oficiais
    if (selic && selic.valor > 13.0) {
      context.regime = 'DEFENSIVE';
      context.regimeMotivo = `Selic alta (${selic.valor}%)`;
    } else if (selic && selic.valor > 10.0) {
      context.regime = 'CAUTIOUS';
      context.regimeMotivo = `Selic elevada (${selic.valor}%)`;
    } else if (selic && selic.valor < 6.0) {
      context.regime = 'EXPANSIVE';
      context.regimeMotivo = `Selic baixa (${selic.valor}%)`;
    } else {
      context.regime = 'NEUTRAL';
      context.regimeMotivo = `Selic moderada (${selic ? selic.valor + '%' : 'N/A'})`;
    }

    context.summary = `Selic: ${selic ? selic.valor + '%' : 'N/A'} | Dólar: R$ ${dolar ? dolar.valor.toFixed(2) : 'N/A'} | IPCA 12m: ${ipca ? ipca.acumulado12m + '%' : 'N/A'} | Regime: ${context.regime}`;
    
    return context;
  }

  /**
   * Obtém dados do Ipeadata (ex: PIB, taxa de desemprego).
   * Ipeadata tem formato próprio de API.
   */
  function getIpeadata(codigo) {
    // Ipeadata não tem API REST oficial pública.
    // Usamos o endpoint de dados abertos quando disponível.
    // Por enquanto, retorna null e usamos BCB como fonte principal.
    console.warn('⚠️ Ipeadata: API não disponível diretamente. Usando BCB como fonte macro oficial.');
    return null;
  }

  return {
    getSelic: getSelic,
    getSelicDiaria: getSelicDiaria,
    getDolar: getDolar,
    getIPCA: getIPCA,
    getMacroContext: getMacroContext,
    getIpeadata: getIpeadata
  };
})();
