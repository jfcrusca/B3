/**
 * =============================================================================
 * 51_Sentinela_Gringo.gs — v1.1 (ADR & PRE-MARKET MONITOR)
 * =============================================================================
 * ✅ OBJETIVO: Prever o "Humor" da abertura B3 olhando para Nova York.
 * ✅ LÓGICA: Se ADR (NY) cai > 1.5%, a probabilidade de Gap de Baixa aqui é 90%.
 * ✅ UPDATE: Prevenção de erro em gatilhos automáticos e envio integrado de e-mail.
 */

// 🟢 FUNÇÃO PARA O BOTÃO DA PLANILHA (Exibe Pop-up)
function VISUALIZAR_SENTINELA_GRINGO() {
  SentinelaGringo.executar(true);
}

// 🟢 NOVA FUNÇÃO PARA O GATILHO DE HORÁRIO (Envia E-mail)
function RODAR_SENTINELA_AUTOMATICO() {
  SentinelaGringo.executar(false);
}

var SentinelaGringo = {
  
  // Mapeamento: Ticker Brasil -> Ticker USA (ADR)
  PARES: {
    'PETR4': 'PBR',
    'VALE3': 'VALE',
    'ITUB4': 'ITUB',
    'BBDC4': 'BBD',
    'GGBR4': 'GGB',   // Gerdau
    'CSNA3': 'SID',   // Siderurgica Nacional
    'ABEV3': 'ABEV',
    'PBR':   'PBR',   // Caso já esteja monitorando direto
    'EWZ':   'EWZ'    // ETF Brazil (O Pai de todos)
  },

  executar: function(visual = false) {
    let ui = null;
    
    // Proteção cirúrgica: só invoca a UI se visual for true E se houver interface ativa.
    if (visual) {
      try {
        ui = SpreadsheetApp.getUi();
      } catch (e) {
        // Se falhar (ex: rodando pelo editor de código ou gatilho errado), muda para modo automático
        console.warn("⚠️ Interface não detectada. Trocando para o modo de envio por e-mail.");
        visual = false;
      }
    }
    
    // 1. Obter Dados de Nova York
    const dados = this._fetchUSData();
    if (!dados || dados.length === 0) {
      if (ui) {
        ui.alert("❌ Mercado Americano Fechado ou Dados Indisponíveis.");
      } else {
        console.error("❌ Mercado Americano Fechado ou Dados Indisponíveis. E-mail cancelado.");
      }
      return;
    }

    // 2. Análise de Sentimento
    let sentimentoGeral = "NEUTRO";
    let corGeral = "#f1c40f"; // Amarelo
    
    // O EWZ dita o ritmo. Se EWZ cai, o Brasil cai.
    const ewz = dados.find(d => d.ticker === 'EWZ');
    if (ewz) {
      if (ewz.changeP < -1.0) { 
        sentimentoGeral = "🔴 PÂNICO / QUEDA"; 
        corGeral = "#c0392b"; 
      } else if (ewz.changeP > 1.0) { 
        sentimentoGeral = "🟢 OTIMISMO / ALTA"; 
        corGeral = "#27ae60"; 
      }
    }

    // 3. Gerar Relatório Visual (Criamos o HTML independente de ser pop-up ou e-mail)
    let macroInfo = null;
    if (typeof MacroFetcher !== 'undefined') {
        macroInfo = MacroFetcher.getMacroContext();
    }
    const html = this._construirHtml(dados, sentimentoGeral, corGeral, macroInfo);

    if (ui) {
      // MODO MANUAL: Pop-up na Planilha
      ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(600).setHeight(600), "🌎 Radar Pré-Market (NY vs B3)");
    } else {
      // MODO AUTOMÁTICO: Envia por e-mail
      const emailUser = Session.getActiveUser().getEmail();
      const assunto = `🌎 Radar B3 (Pré-Market): ${sentimentoGeral}`;
      
      GmailApp.sendEmail(emailUser, assunto, "Seu cliente de e-mail não suporta HTML.", { htmlBody: html });
      console.log(`✅ Relatório enviado com sucesso para ${emailUser}.`);

      // Integração segura com seu Módulo 17 para enviar um resumo rápido no Telegram
      if (typeof NotificationService !== 'undefined' && typeof NotificationService.enviarAlertaRisco === 'function') {
        NotificationService.enviarAlertaRisco(`🌎 *RADAR B3 ABERTO*\nSentimento em NY: *${sentimentoGeral}*\nVerifique seu e-mail para ver a tabela completa dos ADRs!`);
      }
    }
  },

  /**
   * Retorna os dados processados para o Web App (Dashboard)
   */
  getData: function() {
    const dados = this._fetchUSData();
    if (!dados || dados.length === 0) return null;

    let sentimentoGeral = "NEUTRO";
    let corGeral = "#f1c40f"; 
    
    const ewz = dados.find(d => d.ticker === 'EWZ');
    if (ewz) {
      if (ewz.changeP < -1.0) { 
        sentimentoGeral = "🔴 PÂNICO / QUEDA"; 
        corGeral = "#c0392b"; 
      } else if (ewz.changeP > 1.0) { 
        sentimentoGeral = "🟢 OTIMISMO / ALTA"; 
        corGeral = "#27ae60"; 
      }
    }

    return { dados, sentimento: sentimentoGeral, cor: corGeral };
  },

  _fetchUSData: function() {
    const tickersUS = Object.values(this.PARES);
    const uniqueTickers = [...new Set(tickersUS)];
    
    const options = {
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        }
    
    };
    
    // 🚨 ADD: includePrePost=true para o Yahoo entregar os dados fora do horário comercial
    const requests = uniqueTickers.map(ticker => ({
      url: `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d&includePrePost=true`,
      ...options
    }));
    
    try {
      const responses = UrlFetchApp.fetchAll(requests);
      const resultados = [];

      responses.forEach((resp, index) => {
        if (resp.getResponseCode() === 200) {
          const json = JSON.parse(resp.getContentText());
          
          if (json.chart && json.chart.result && json.chart.result.length > 0) {
            const meta = json.chart.result[0].meta;
            
            // 1. Tenta pegar o Pré-market/After-market primeiro; se não tiver, usa o preço regular
            const price = meta.preMarketPrice || meta.postMarketPrice || meta.regularMarketPrice || 0;
            
            // 2. 🚨 FIX: A chave correta da API V8 para o fechamento anterior é 'chartPreviousClose'
            const prevClose = meta.chartPreviousClose || meta.previousClose || price;
            
            // 3. Calcula a variação real
            const changeP = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

            resultados.push({
              ticker: uniqueTickers[index],
              price: price,
              changeP: changeP,
              state: meta.preMarketPrice ? 'PRE-MARKET' : 'REGULAR'
            });
          }
        }
      });

      return resultados;
    } catch (e) {
      console.error("❌ Erro Sentinela Gringo (V8 Bypass): " + e.message);
      return [];
    }
  },

  _construirHtml: function(dados, sentimento, cor, macroInfo) {
    let macroHtml = "";
    if (macroInfo) {
        macroHtml = `
            <div style="margin-top: 15px; font-size: 12px; border: 1px solid #ddd; padding: 10px; border-radius: 5px; background-color: #f9f9f9;">
                <strong>📊 Cenário Macro (Mensal):</strong><br>
                ${macroInfo.summary.replace(/ \| /g, '<br>')}
            </div>
        `;
    }

    // Mapeia de volta para mostrar qual ação BR é afetada
    const linhas = dados.map(d => {
      // Descobre qual ativo BR corresponde a esse ADR
      const ativoBR = Object.keys(this.PARES).find(key => this.PARES[key] === d.ticker) || d.ticker;
      
      const corTexto = d.changeP >= 0 ? '#27ae60' : '#c0392b';
      const seta = d.changeP >= 0 ? '▲' : '▼';
      
      // Destaque para EWZ
      const destaque = d.ticker === 'EWZ' ? 'background-color: #f0f0f0; font-weight:bold; border: 2px solid #ccc;' : '';

      return `
        <tr style="${destaque}">
          <td>${ativoBR} <span style="font-size:10px; color:#777">(${d.ticker})</span></td>
          <td style="text-align:right;">$ ${d.price.toFixed(2)}</td>
          <td style="text-align:right; color:${corTexto}; font-weight:bold;">
            ${seta} ${d.changeP.toFixed(2)}%
          </td>
        </tr>
      `;
    }).join('');

    return `
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 10px; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 20px; background:${cor}; color:white; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; color: #555; font-size: 12px; border-bottom: 1px solid #eee; padding: 5px; }
          td { padding: 8px 5px; border-bottom: 1px solid #eee; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2 style="margin:0">SENTIMENTO: ${sentimento}</h2>
          <p style="margin:5px 0 0 0; font-size:12px;">Impacto direto na abertura da B3</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>ATIVO (BR / US)</th>
              <th style="text-align:right">PREÇO (US$)</th>
              <th style="text-align:right">VARIAÇÃO %</th>
            </tr>
          </thead>
          <tbody>
            ${linhas}
          </tbody>
        </table>
        
        ${macroHtml}
        
        <div style="margin-top: 20px; font-size: 11px; color: #666; background: #fff3cd; padding: 10px; border-radius: 5px;">
          <strong>💡 DICA DE OURO:</strong><br>
          Se o <b>EWZ</b> cair mais de <b>-1.5%</b>, cancele ordens de compra na abertura. 
          Se sua ação (ex: VALE) estiver caindo lá fora, espere Gap de Baixa aqui.
        </div>
      </body>
      </html>
    `;
  }
};

function TESTAR_YAHOO_BLOQUEIO() {
  const url = "https://query2.finance.yahoo.com/v7/finance/quote?symbols=EWZ";
  
  const options = {
    muteHttpExceptions: true,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5"
    }
  };
  
  Logger.log("📡 A enviar pedido para o Yahoo Finance...");
  const resp = UrlFetchApp.fetch(url, options);
  const code = resp.getResponseCode();
  const text = resp.getContentText();
  
  Logger.log("Código HTTP: " + code);
  Logger.log("Primeiros 500 caracteres da resposta:");
  Logger.log(text.substring(0, 500));
}

function TESTAR_SENTINELA_V8_DIRETO() {
  Logger.log("🚀 Iniciando Teste Direto (Bypass V8)...");
  SentinelaGringo.executar(true);
}