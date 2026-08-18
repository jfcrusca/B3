
/** 42_HistoricalContext.gs */


var HistoricalContext = {

  CONFIG: {
    CACHE_DURATION_SEC: 3600, // Cache 1 hora
    MIN_TRADES_FOR_ANALYSIS: 5, // Mínimo de negociações históricas
    MAX_LOOKBACK_MONTHS: 24 // Últimos 2 anos apenas
  },

  // ===== MÉTODO PRINCIPAL =====
  getEnrichedContext: function(ticker) {
    const cacheKey = `hist_${ticker}`;
    const cache = CacheService.getScriptCache();

    let cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Busca apenas dados relevantes
    const trades = this._fetchRelevantTrades(ticker);

    if (!trades || trades.length < this.CONFIG.MIN_TRADES_FOR_ANALYSIS) {
      return { hasHistory: false, message: "Dados históricos insuficientes" };
    }

    const context = {
      hasHistory: true,
      ticker: ticker,

      // PERFORMANCE
      totalTrades: trades.length,
      winRate: this._calculateWinRate(trades),
      avgProfitWin: this._calculateAvgProfit(trades, 'WIN'),
      avgLossLoss: this._calculateAvgProfit(trades, 'LOSS'),
      profitFactor: this._calculateProfitFactor(trades),

      // RISCO
      maxDrawdown: this._calculateMaxDrawdown(trades),
      avgVolatility: this._calculateVolatility(trades),
      riskScore: this._assessRiskLevel(trades), // 1-10

      // COMPORTAMENTO
      preferredMode: this._getPreferredMode(trades), // "SWING" ou "DAY"
      seasonality: this._detectSeasonality(trades),

      // TIMESTAMPS
      lastTradeDate: this._getLastTradeDate(trades),
      analysisDate: new Date()
    };

    // Salva no cache
    cache.put(cacheKey, JSON.stringify(context), this.CONFIG.CACHE_DURATION_SEC);

    return context;
  },

  // ===== BUSCA OTIMIZADA =====
  _fetchRelevantTrades: function(ticker) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Notas de Corretagem');

    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // Busca apenas colunas necessárias: Data(C), Operação(E), Papel(G), Preço(J), L/P(Y)
    const range = sheet.getRange(2, 1, lastRow - 1, 25); // A até Y
    const data = range.getValues();

    // Filtra por ticker e últimos 24 meses
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - this.CONFIG.MAX_LOOKBACK_MONTHS);

    return data.filter(row => {
      const papel = row[6]; // Coluna G
      const data = row[2]; // Coluna C

      return papel === ticker && 
             data instanceof Date && 
             data >= cutoffDate;
    });
  },

  // ===== CÁLCULOS =====
  _calculateWinRate: function(trades) {
    const vendas = trades.filter(t => t[4] === 'VENDA'); // Coluna E
    const lucros = vendas.filter(t => t[24] > 0); // Coluna Y (L/P)

    return vendas.length > 0 ? 
      ((lucros.length / vendas.length) * 100).toFixed(1) : 0;
  },

  _calculateVolatility: function(trades) {
    const precos = trades.map(t => t[9]); // Coluna J (Preço)

    if (precos.length < 2) return 0;

    const retornos = [];
    for (let i = 1; i < precos.length; i++) {
      retornos.push((precos[i] - precos[i-1]) / precos[i-1]);
    }

    // Desvio padrão dos retornos
    const media = retornos.reduce((a, b) => a + b, 0) / retornos.length;
    const variancia = retornos.reduce((acc, val) => 
      acc + Math.pow(val - media, 2), 0) / retornos.length;

    return Math.sqrt(variancia) * 100; // Em %
  },

  _assessRiskLevel: function(trades) {
    const volatility = this._calculateVolatility(trades);
    const winRate = parseFloat(this._calculateWinRate(trades));

    // Score 1-10 (10 = mais arriscado)
    let riskScore = 5;

    if (volatility > 5) riskScore += 2;
    if (volatility > 8) riskScore += 2;
    if (winRate < 40) riskScore += 2;
    if (winRate < 30) riskScore += 1;

    return Math.min(10, riskScore);
  }
};
