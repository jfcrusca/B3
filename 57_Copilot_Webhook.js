
/**
 * 57_Copilot_Webhook.js — Integração com Copilot (CORRIGIDO)
 * Versão 2.0 - Com validações de segurança
 */

// Função principal corrigida
function consultarCopilot(ticker, technicalData) {
  // ⭐ VALIDAÇÃO DE SEGURANÇA
  if (!ticker) {
    console.error("❌ consultarCopilot: ticker não fornecido");
    return null;
  }
  
  if (!technicalData || typeof technicalData !== 'object') {
    console.error(`❌ consultarCopilot: technicalData inválido para ${ticker}`);
    return null;
  }
  
  // ⭐ VERIFICA CAMPOS OBRIGATÓRIOS
  const price = technicalData.price || technicalData.Preço || 0;
  if (price === 0) {
    console.warn(`⚠️ consultarCopilot: preço não disponível para ${ticker}`);
  }
  
  // Seu webhook do Power Automate (opcional - pode ficar vazio)
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('COPILOT_WEBHOOK_URL') || '';
  
  // Se não tiver webhook configurado, apenas simula/retorna null
  if (!webhookUrl || webhookUrl === '') {
    console.log(`ℹ️ Webhook do Copilot não configurado para ${ticker}. Pule ou configure COPILOT_WEBHOOK_URL`);
    return null;
  }
  
  const payload = {
    ticker: ticker,
    price: price,
    rsi: technicalData.indicators?.rsi || technicalData.rsi || null,
    volumeRatio: technicalData.volumeRatio || null,
    ema21: technicalData.indicators?.ema21 || technicalData.ema21 || null,
    ema200: technicalData.indicators?.ema200 || technicalData.ema200 || null,
    timestamp: new Date().toISOString()
  };
  
  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      console.log(`✅ Copilot respondeu para ${ticker}`);
      return result;
    } else {
      console.warn(`⚠️ Copilot webhook retornou ${response.getResponseCode()} para ${ticker}`);
      return null;
    }
  } catch (e) {
    console.error(`❌ Erro no webhook Copilot para ${ticker}: ${e.message}`);
    return null;
  }
}

// Função de teste segura
function TESTAR_COPILOT() {
  console.log("🧪 Testando módulo Copilot...");
  
  // Dados de teste
  const dadosMock = {
    ticker: 'PETR4',
    price: 36.50,
    indicators: {
      rsi: 65,
      ema21: 35.80,
      ema200: 32.50
    },
    volumeRatio: 1.5
  };
  
  const resultado = consultarCopilot('PETR4', dadosMock);
  
  if (resultado) {
    console.log("✅ Copilot respondeu:", JSON.stringify(resultado, null, 2));
  } else {
    console.log("ℹ️ Copilot não configurado ou falhou - isso é normal se você não tem webhook");
    console.log("💡 Para configurar: adicione a propriedade 'COPILOT_WEBHOOK_URL' no Script Properties");
  }
}