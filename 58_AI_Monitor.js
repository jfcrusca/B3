/**DASHBOARD DE MONITORAMENTO DAS IAs
//58_AL_Monitor.gs
*/


function MONITORAR_IA_STATUS() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Monitor_IA");
  if (!sheet) sheet = ss.insertSheet("Monitor_IA");
  
  const status = [
    ["FONTE", "STATUS", "ÚLTIMA CONSULTA", "TEMPO MÉDIO (ms)", "TAXA DE SUCESSO"],
    ["Gemini", _checkGeminiStatus(), new Date(), "N/A", "N/A"],
    ["Copilot (Manual)", "AGUARDANDO INPUT", "N/A", "N/A", "N/A"],
    ["Inner IA", "CSV IMPORTADO", "N/A", "N/A", "N/A"],
    ["Macro Dados", _checkMacroStatus(), new Date(), "N/A", "N/A"]
  ];
  
  sheet.getRange(1, 1, status.length, 5).setValues(status);
  sheet.getRange("A1:E1").setBackground("#0c343d").setFontColor("white");
  sheet.autoResizeColumns(1, 5);
  
  SpreadsheetApp.getUi().alert("✅ Monitor de IA atualizado!");
}

function _checkGeminiStatus() {
  try {
    const test = AI_Connector.callGemini("Responda OK", { jsonMode: false });
    return test ? "✅ ONLINE" : "⚠️ INSTÁVEL";
  } catch(e) {
    return "❌ OFFLINE";
  }
}

function _checkMacroStatus() {
  try {
    const context = MacroFetcher.getMacroContext();
    return context ? "✅ ONLINE" : "⚠️ SEM DADOS";
  } catch(e) {
    return "❌ OFFLINE";
  }
}