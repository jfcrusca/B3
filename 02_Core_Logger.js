// =============================================================================
// 02_Core_Logger.gs — Logger com Buffer e Persistência na Planilha
// =============================================================================



 var LogService = (function() {
  var _logBuffer = []; // Renomeado para evitar conflito com 'logBuffer' no escopo global
  var MAX_BUFFER_SIZE = 500;
  var SHEET_NAME = 'Logs';
  var MAX_LOGS_RETENTION = 1000; // Definindo a constante aqui, se não estiver em Config

  // Função interna para adicionar ao buffer
  function _addBuffer(level, modulo, mensagem) {
    var timestamp = new Date();
    var logEntry = [timestamp, level, modulo, mensagem];
    _logBuffer.push(logEntry);

    // Opcional: Flush automático se o buffer atingir um tamanho crítico
    if (_logBuffer.length >= MAX_BUFFER_SIZE) {
      // flush(); // Descomente se quiser flush automático em buffer cheio
    }
  }

  // Funções de log públicas
  function info(modulo, mensagem) { _addBuffer('INFO', modulo, mensagem); }
  function warn(modulo, mensagem) { _addBuffer('WARN', modulo, mensagem); }
  function error(modulo, mensagem) {
    _addBuffer('ERROR', modulo, mensagem);
    // Para erros, é crucial tentar persistir imediatamente
    flush(); // Tenta salvar logs de erro imediatamente
  }
  function debug(modulo, mensagem) { _addBuffer('DEBUG', modulo, mensagem); }

  // Função para persistir os logs na planilha
  function flush() {
    if (_logBuffer.length === 0) {
      return;
    }

    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(SHEET_NAME);

      if (!sheet) {
        console.warn(`Aba de log "${SHEET_NAME}" não encontrada. Tentando criar...`);
        sheet = ss.insertSheet(SHEET_NAME);
        // Adiciona cabeçalhos se a aba foi recém-criada
        sheet.appendRow(['Timestamp', 'Level', 'Module', 'Message']);
        // Pode chamar setupLogs do 00_Setup_CreateSheets.js aqui se quiser formatação completa
        // if (typeof Setup_CreateSheets !== 'undefined' && typeof Setup_CreateSheets.setupLogs === 'function') {
        //   Setup_CreateSheets.setupLogs(ss, { forceReset: false });
        // }
      }

      // Determina a linha de início para a escrita
      // Se a planilha estiver vazia (apenas cabeçalho), lastRow será 1. Queremos começar na linha 2.
      // Se já tiver dados, lastRow será a última linha com dados. Queremos começar na próxima.
      const lastRow = sheet.getLastRow();
      const startRow = lastRow + 1;

      // Escreve os logs usando getRange().setValues()
      // O logBuffer é um array de arrays, perfeito para setValues
      sheet.getRange(startRow, 1, _logBuffer.length, _logBuffer[0].length).setValues(_logBuffer);

      // 2. Limpeza Automática (Housekeeping) - Lógica do seu código original
      // Se tiver mais de MAX_LOGS_RETENTION linhas (contando com o cabeçalho), apaga as antigas do topo
      // lastRow + _logBuffer.length é o número total de linhas após a escrita
      const totalRowsAfterWrite = lastRow + _logBuffer.length;
      if (totalRowsAfterWrite > MAX_LOGS_RETENTION + 1) { // +1 para o cabeçalho
        const rowsToDelete = totalRowsAfterWrite - (MAX_LOGS_RETENTION + 1);
        if (rowsToDelete > 0) {
           sheet.deleteRows(2, rowsToDelete); // Começa a apagar da linha 2 (após o cabeçalho)
        }
      }

      _logBuffer = []; // Limpa o buffer após a escrita bem-sucedida

    } catch (e) {
      console.error("FATAL_LOG_FLUSH", "Falha crítica ao escrever logs na planilha: " + e.message + " Stack: " + e.stack);
      // O buffer não é limpo aqui, para tentar novamente no próximo flush
    }
  }

  return {
    info: info,
    warn: warn,
    error: error,
    debug: debug,
    flush: flush
  };
})();
