/**
 * 51_SecureKeyService.gs — v3.1 (REFATORADO: IIFE em vez de class ES6)
 * =============================================================================
 * ✅ CONEXÃO TOTAL: Lê as senhas das Propriedades do Script.
 * ✅ RELATÓRIO HTML: Mostra visualmente o status de cada chave.
 * ✅ CORREÇÃO: GAS V8 não suporta 'class' no escopo global — refatorado para IIFE.
 */

var SecureKeyService = (function() {
  'use strict';

  /**
   * Busca a chave nas Propriedades do Script (Engrenagem ⚙️)
   */
  function getKey(keyName, defaultValue) {
    defaultValue = defaultValue || null;
    try {
      var scriptProps = PropertiesService.getScriptProperties();
      var value = scriptProps.getProperty(keyName);

      // Se não achar, tenta nas propriedades do usuário (backup)
      if (!value) {
        value = PropertiesService.getUserProperties().getProperty(keyName);
      }

      return value || defaultValue;
    } catch (e) {
      console.error('Erro ao ler chave ' + keyName + ': ' + e.message);
      return defaultValue;
    }
  }

  /**
   * 📊 GERA O RELATÓRIO VISUAL (HTML) PARA O MENU
   * Chamado por: "TESTAR LEITURA DO COFRE"
   */
  function testarLeitura() {
    var ui = SpreadsheetApp.getUi();

    // Lista de chaves vitais para o sistema B3 PRO
    var chavesCriticas = [
      'OPENAI_API_KEY',
      'GEMINI_API_KEY',
      'DEEPSEEK_API_KEY',
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_CHAT_ID',
      'BRAPI_TOKEN'
    ];

    var htmlContent = ''
      + '<style>'
      + 'body { font-family: "Segoe UI", sans-serif; padding: 10px; background-color: #f4f4f4; }'
      + '.card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }'
      + 'h3 { margin-top: 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }'
      + '.item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }'
      + '.key-name { font-weight: bold; color: #555; }'
      + '.status-ok { color: #27ae60; font-weight: bold; }'
      + '.status-err { color: #c0392b; font-weight: bold; }'
      + '.value-preview { font-family: monospace; color: #7f8c8d; font-size: 0.9em; margin-left: 10px; }'
      + '</style>'
      + '<div class="card">'
      + '<h3>🔐 Diagnóstico do Cofre</h3>';

    var chavesEncontradas = 0;

    chavesCriticas.forEach(function(key) {
      var valor = getKey(key);
      var statusIcon = valor ? '✅ OK' : '❌ AUSENTE';
      var statusClass = valor ? 'status-ok' : 'status-err';
      var preview = valor ? '(configurada)' : '---';

      if (valor) chavesEncontradas++;

      htmlContent += ''
        + '<div class="item">'
        + '<span class="key-name">' + key + '</span>'
        + '<div>'
        + '<span class="' + statusClass + '">' + statusIcon + '</span>'
        + '<span class="value-preview">' + preview + '</span>'
        + '</div>'
        + '</div>';
    });

    htmlContent += ''
      + '<div style="margin-top: 15px; text-align: center; font-size: 0.9em; color: #666;">'
      + '<strong>Resumo:</strong> ' + chavesEncontradas + ' de ' + chavesCriticas.length + ' chaves configuradas.'
      + '</div>'
      + '</div>';

    // Exibe o Modal HTML
    var htmlOutput = HtmlService.createHtmlOutput(htmlContent)
      .setWidth(450)
      .setHeight(400);

    ui.showModalDialog(htmlOutput, '🛡️ B3 PRO: Status de Segurança');

    return "Diagnóstico visual exibido.";
  }

  // API pública
  return {
    getKey: getKey,
    testarLeitura: testarLeitura
  };
})();
