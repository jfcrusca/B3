/**
 * 27_Abas_Cabecalhos.gs - Versão com Fórmulas como Texto
 * 
 * EXIBE:
 * - Todas as fórmulas como TEXTO PLANO (não executáveis)
 * - Links também como texto (opcional)
 */

function colToLetter_(col) {
  let temp, letter = "";
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}

function relacionarAbasDetalhado() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nomeAbaIndice = "Índice Detalhado";
  let abaIndice = ss.getSheetByName(nomeAbaIndice);
  
  if (!abaIndice) {
    abaIndice = ss.insertSheet(nomeAbaIndice);
  } else {
    abaIndice.clear();
    if (abaIndice.getMaxColumns() < 6) {
      abaIndice.insertColumnsAfter(abaIndice.getMaxColumns(), 6 - abaIndice.getMaxColumns());
    }
  }
  
  const relatorioFormulas = [["Aba", "Célula", "Coluna", "Cabeçalho", "Fórmula (texto)", "Valor Atual"]];
  const relatorioCabecalhos = [["Aba", "Coluna", "Cabeçalho", "Fórmula no Cabeçalho"]];
  
  const todasAbas = ss.getSheets();
  
  todasAbas.forEach(aba => {
    const nome = aba.getName();
    if (nome === nomeAbaIndice) return;

    // Mapeamento de cabeçalhos
    const ultimaColuna = aba.getLastColumn();
    const ultimaLinha = aba.getLastRow();
    const cabecalhos = [];
    
    if (ultimaColuna > 0) {
      const rangeCabecalho = aba.getRange(1, 1, 1, ultimaColuna);
      const valoresCabecalho = rangeCabecalho.getValues()[0];
      const formulasCabecalho = rangeCabecalho.getFormulas()[0];

      for (let i = 0; i < ultimaColuna; i++) {
        const letraColuna = colToLetter_(i + 1);
        const conteudo = (valoresCabecalho[i] !== "" && valoresCabecalho[i] !== undefined) ? valoresCabecalho[i] : "(Vazio)";
        const formula = formulasCabecalho[i] ? formulasCabecalho[i] : "Não";
        
        cabecalhos[i] = conteudo;
        relatorioCabecalhos.push([nome, letraColuna, conteudo, formula]);
      }
    }
    
    // Capturar TODAS as células com fórmulas
    if (ultimaLinha > 0 && ultimaColuna > 0) {
      const rangeTotal = aba.getRange(1, 1, ultimaLinha, ultimaColuna);
      const formulas = rangeTotal.getFormulas();
      const valores = rangeTotal.getValues();
      
      for (let linha = 0; linha < ultimaLinha; linha++) {
        for (let col = 0; col < ultimaColuna; col++) {
          const formula = formulas[linha][col];
          
          if (formula && formula !== "") {
            const linhaReal = linha + 1;
            const colReal = col + 1;
            const letraColuna = colToLetter_(colReal);
            const celulaRef = letraColuna + linhaReal;
            const cabecalho = cabecalhos[col] || "(Sem cabeçalho)";
            const valorAtual = valores[linha][col];
            
            relatorioFormulas.push([
              nome,
              celulaRef,
              letraColuna,
              cabecalho,
              formula,  // Já é texto, não será executado
              valorAtual
            ]);
          }
        }
      }
    }
  });
  
  if (relatorioFormulas.length > 1 || relatorioCabecalhos.length > 1) {
    criarRelatorioComoTexto(abaIndice, relatorioFormulas, relatorioCabecalhos);
    console.log(`✅ Relatório gerado: ${relatorioFormulas.length-1} fórmulas encontradas.`);
  }
}

/**
 * Cria relatório com fórmulas como TEXTO PLANO (não executáveis)
 */
function criarRelatorioComoTexto(abaIndice, relatorioFormulas, relatorioCabecalhos) {
  let linhaAtual = 1;
  
  // Seção 1: Todas as Fórmulas (como texto)
  if (relatorioFormulas.length > 1) {
    // Título da seção
    abaIndice.getRange(linhaAtual, 1, 1, 6)
      .setValue("📊 TODAS AS FÓRMULAS (EXIBIDAS COMO TEXTO)")
      .merge()
      .setFontWeight("bold")
      .setFontSize(14)
      .setBackground("#0c343d")
      .setFontColor("white")
      .setHorizontalAlignment("center");
    
    linhaAtual += 2;
    
    // Cabeçalho
    const cabecalhoRange = abaIndice.getRange(linhaAtual, 1, 1, 6);
    cabecalhoRange.setValues([relatorioFormulas[0]])
      .setFontWeight("bold")
      .setBackground("#f3f3f3");
    
    linhaAtual++;
    
    // Dados - TODOS como texto usando setValue()
    if (relatorioFormulas.length > 1) {
      const numLinhas = relatorioFormulas.length - 1;
      const dadosRange = abaIndice.getRange(linhaAtual, 1, numLinhas, 6);
      const dados = relatorioFormulas.slice(1);
      
      // Matrizes para escrita em lote
      const matrixValues = [];
      const matrixNotes = [];
      const matrixColors = [];
      const matrixFamilies = [];

      for (let i = 0; i < dados.length; i++) {
        const rowValues = [];
        const rowNotes = Array(6).fill(null);
        const rowColors = Array(6).fill(null);
        const rowFamilies = Array(6).fill(null);

        for (let j = 0; j < dados[i].length; j++) {
          let valor = dados[i][j];
          if (valor === undefined || valor === null) valor = "";
          else if (typeof valor === 'string' && valor.startsWith('=')) valor = "'" + valor;
          else valor = valor.toString();
          
          rowValues.push(valor);
          
          // Formatação para Colunas E (Fórmula) e F (Valor)
          if (j === 4) { // Coluna E
             rowColors[j] = '#0b5394';
             rowFamilies[j] = 'Courier New';
             rowNotes[j] = `Original: ${dados[i][0]}!${dados[i][1]}`;
          } else if (j === 5) { // Coluna F
             rowColors[j] = '#38761d';
             rowFamilies[j] = 'Courier New';
          }
        }
        matrixValues.push(rowValues);
        matrixNotes.push(rowNotes);
        matrixColors.push(rowColors);
        matrixFamilies.push(rowFamilies);
      }
      
      dadosRange.setValues(matrixValues);
      dadosRange.setNotes(matrixNotes);
      dadosRange.setFontColors(matrixColors);
      dadosRange.setFontFamilies(matrixFamilies);
      
      linhaAtual += numLinhas + 2;
    }
  }
  
  // Seção 2: Cabeçalhos
  if (relatorioCabecalhos.length > 1) {
    abaIndice.getRange(linhaAtual, 1, 1, 4)
      .setValue("📋 CABEÇALHOS DAS ABAS")
      .merge()
      .setFontWeight("bold")
      .setFontSize(14)
      .setBackground("#0c343d")
      .setFontColor("white")
      .setHorizontalAlignment("center");
    
    linhaAtual += 2;
    
    abaIndice.getRange(linhaAtual, 1, 1, 4)
      .setValues([relatorioCabecalhos[0]])
      .setFontWeight("bold")
      .setBackground("#f3f3f3");
    
    linhaAtual++;
    
    if (relatorioCabecalhos.length > 1) {
      const rangeCabecalhos = abaIndice.getRange(linhaAtual, 1, relatorioCabecalhos.length - 1, 4);
      const dadosC = relatorioCabecalhos.slice(1);
      rangeCabecalhos.setValues(dadosC);
      
      // Formatação em lote para fórmulas nos cabeçalhos
      const colorC = [];
      const familyC = [];
      for (let i = 0; i < dadosC.length; i++) {
        const hasFormula = dadosC[i][3] !== "Não";
        colorC.push([null, null, null, hasFormula ? '#0b5394' : null]);
        familyC.push([null, null, null, hasFormula ? 'Courier New' : null]);
        }
      if (colorC.length > 0) {
        rangeCabecalhos.setFontColors(colorC);
        rangeCabecalhos.setFontFamilies(familyC);
      }
    }
  }
  
  // Formatação final
  abaIndice.autoResizeColumns(1, 6);
  abaIndice.setFrozenRows(3);
  
  // Instruções no topo
  abaIndice.getRange('A1').setNote(
    'As fórmulas são exibidas como TEXTO.\n' +
    'Para copiar uma fórmula, selecione a célula e use Ctrl+C.'
  );
}

/**
 * Função extra: Exportar apenas as fórmulas como CSV/texto
 */
function exportarFormulasComoCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nomeAbaSaida = "Exportação Fórmulas";
  let abaSaida = ss.getSheetByName(nomeAbaSaida) || ss.insertSheet(nomeAbaSaida);
  abaSaida.clear();
  
  const relatorio = [["Arquivo", "Aba", "Célula", "Fórmula Completa"]];
  const nomeArquivo = ss.getName();
  const todasAbas = ss.getSheets();
  
  todasAbas.forEach(aba => {
    if (aba.getName() === nomeAbaSaida) return;
    
    const ultimaLinha = aba.getLastRow();
    const ultimaColuna = aba.getLastColumn();
    
    if (ultimaLinha > 0 && ultimaColuna > 0) {
      const formulas = aba.getRange(1, 1, ultimaLinha, ultimaColuna).getFormulas();
      
      for (let linha = 0; linha < ultimaLinha; linha++) {
        for (let col = 0; col < ultimaColuna; col++) {
          const f = formulas[linha][col];
          if (f && f !== "") {
            const celula = aba.getRange(linha+1, col+1).getA1Notation();
            relatorio.push([
              nomeArquivo,
              aba.getName(),
              celula,
              formulas[linha][col]
            ]);
          }
        }
      }
    }
  });
  
  if (relatorio.length > 1) {
    const range = abaSaida.getRange(1, 1, relatorio.length, 4);
    range.setValues(relatorio);
    abaSaida.autoResizeColumns(1, 4);
    
    // Tudo como texto plano
    const dataRange = abaSaida.getDataRange();
    dataRange.setNumberFormat('@'); // Formato texto
    
    SpreadsheetApp.getUi().alert(
      `Exportação concluída!\n${relatorio.length-1} fórmulas encontradas.`
    );
  }
}

// Funções de atalho
function GERAR_RELATORIO_TEXTO() {
  relacionarAbasDetalhado();
}

function EXPORTAR_FORMULAS_CSV() {
  exportarFormulasComoCSV();
}