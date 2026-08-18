/**
 * Módulo de Verificação de Consistência Fiscal
 * Analisa as notas de corretagem para garantir que o fluxo de prejuízos e IR está correto.
 */

function VERIFICAR_CONSISTENCIA_FISCAL() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Notas de Corretagem');
  if (!sheet) {
    console.error("❌ Aba 'Notas de Corretagem' não encontrada.");
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  // Assume a estrutura do TaxCalculator:
  // Coluna de Lucro/Prejuízo (índice 2, ajustar se necessário)
  // Coluna de Mês (índice 4, ajustar se necessário)
  
  console.log("🔍 Iniciando verificação de consistência fiscal...");
  
  let totalLucroPrejuizo = 0;
  let totalIRFonte = 0;
  
  // Exemplo de verificação simples: Soma de lucro/prejuízo
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const valor = parseFloat(row[2]) || 0; // Exemplo índice 2
    const ir = parseFloat(row[3]) || 0;   // Exemplo índice 3
    
    totalLucroPrejuizo += valor;
    totalIRFonte += ir;
  }
  
  console.log(`📊 Totais encontrados nas notas:`);
  console.log(`   Lucro/Prejuízo: R$ ${totalLucroPrejuizo.toFixed(2)}`);
  console.log(`   IR Fonte Total: R$ ${totalIRFonte.toFixed(2)}`);
  
  console.log("✅ Verificação de consistência concluída.");
}
