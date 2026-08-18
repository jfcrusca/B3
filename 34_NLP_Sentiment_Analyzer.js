/******************************************************************************
// 📦 MÓDULO/ARQUIVO: 34_NLP_Sentiment_Analyzer.js
// 🛠️  TECNOLOGIA: JAVASCRIPT
// 📌  DESCRIÇÃO: Analisador de sentimento de notícias usando IA
// 🔧 v2.0 — INTEGRAÇÃO COM NEWSFETCHER: Busca notícias reais automaticamente
/******************************************************************************/

var NLPSentimentAnalyzer = {

  /**
   * Busca notícias reais para o ticker via NewsFetcher
   * @param {string} ticker — Ticker do ativo
   * @returns {string} Texto de notícias ou marcador padrão
   * @private
   */
  _buscarNoticias: function(ticker) {
    try {
      if (typeof NewsFetcher !== 'undefined' && typeof NewsFetcher.getNewsSummary === 'function' && ticker) {
        var noticias = NewsFetcher.getNewsSummary(ticker, 3);
        if (noticias && noticias !== 'Sem alertas de notícias.') {
          console.log('📰 [NLP] Notícias reais obtidas via NewsFetcher para ' + ticker);
          return noticias;
        }
      }
    } catch (e) {
      console.warn('⚠️ [NLP] NewsFetcher falhou para ' + ticker + ': ' + e.message);
    }
    return '';
  },

  /**
   * Analisa o sentimento de um texto (notícia) usando o conector de IA
   * @param {string} newsText — Texto da notícia
   * @param {string} ticker — Ticker do ativo
   * @returns {Object} {sentimento: "BULLISH"|"BEARISH"|"NEUTRAL", confianca: number, rationale: string}
   */
  analyze: function(newsText, ticker) {
    // 🔧 v2.0: Se não houver notícias, tenta buscar via NewsFetcher
    var textoAnalise = newsText;
    var newsAtrasada = false;

    if (!newsText || newsText.trim() === "" || newsText === "N/A" || newsText === "Sem alertas de notícias.") {
      textoAnalise = this._buscarNoticias(ticker);
      if (!textoAnalise) {
        return { sentimento: "NEUTRAL", confianca: 100, rationale: "Sem notícias para analisar." };
      }
      newsAtrasada = true;
    }

    const prompt = SistemaDiagnostico.CONFIG.NLP_PROMPT_SENTIMENTO + "\n\nNotícia sobre " + ticker + ": " + textoAnalise;
    
    console.log("🧠 [NLP] Analisando sentimento para " + ticker + "..." + (newsAtrasada ? " (notícias buscadas automaticamente)" : ""));

    const resultadoRaw = AI_Connector.callGemini(prompt, {
      jsonMode: true,
      temperature: 0.1
    });

    if (!resultadoRaw) {
      console.warn("⚠️ [NLP] Falha ao analisar sentimento, usando NEUTRAL.");
      return { sentimento: "NEUTRAL", confianca: 0, rationale: "Falha na análise de IA." };
    }

    try {
      const resultado = JSON.parse(resultadoRaw);
      return {
        sentimento: resultado.sentimento || "NEUTRAL",
        confianca: resultado.confianca || 0,
        rationale: (resultado.rationale || "N/A") + (newsAtrasada ? " | Fonte: NewsFetcher automático" : "")
      };
    } catch (e) {
      console.error("❌ [NLP] Erro ao parsear JSON de sentimento: " + e.message);
      return { sentimento: "NEUTRAL", confianca: 0, rationale: "Erro de parse no JSON." };
    }
  }
};