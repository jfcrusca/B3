/**
 * =============================================================================
 * 21_Tax_Calculator.gs — MOTOR CONTÁBIL & DISTRIBUIDOR FISCAL (V3.1)
 * =============================================================================
 * 1. Lê a aba 'Notas de Corretagem'.
 * 2. Calcula impostos, prejuízos e compensações (Swing, DT, FII).
 * 3. Exponibiliza o objeto 'TaxCalculator' para o gerador de DARF (Arquivo 30).
 */

const TAX_CONFIG = {
  SHEETS: {
    SOURCE: 'Notas de Corretagem',
    TARGET_ANUAL: 'IRPF_Resumo_Anual',
    TARGET_DARF: 'DARF_Mensal',
    TARGET_EXEC: 'Resumo_Executivo_IRPF'
  },
  COL_NAMES: {
    DATA: 'Data',
    TIPO_PAPEL: 'Tipo Papel', 
    LUCRO_PREJUIZO: 'Lucro/Prejuízo', 
    IR_FONTE: 'IR na Fonte', 
    MES_REF: 'Mês Referência', 
    VENDAS_MES: 'Vendas no Mês (Tipo Ação)', 
    MODALIDADE: 'Modalidade' 
  }
};

// =============================================================================
// CLASSE PRINCIPAL DE PROCESSAMENTO (MOTOR)
// =============================================================================
class TaxProcessor {
  constructor() {
    this.ss = SpreadsheetApp.getActiveSpreadsheet();
    this.map = {};
  }

  executarProcessamento() {
    const dadosAgregados = this._lerEAgregar();
    this._escreverRelatorios(dadosAgregados);
    return dadosAgregados;
  }

  // Método público para ser usado pelo Adaptador
  obterDadosMensais() {
    return this._lerEAgregar();
  }

  _lerEAgregar() {
    const sheet = this.ss.getSheetByName(TAX_CONFIG.SHEETS.SOURCE);
    if (!sheet) throw new Error(`Aba '${TAX_CONFIG.SHEETS.SOURCE}' não encontrada.`);

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Mapeamento dinâmico
    this.map = {};
    Object.entries(TAX_CONFIG.COL_NAMES).forEach(([key, name]) => {
      this.map[key] = headers.findIndex(h => h && String(h).toLowerCase().trim() === name.toLowerCase().trim());
    });

    if (this.map.LUCRO_PREJUIZO === -1 || this.map.MES_REF === -1) {
      throw new Error("Colunas críticas (Lucro/Prejuízo ou Mês Ref) não encontradas na aba Notas.");
    }

    const meses = {};

    // 1. Agregação Inicial
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const mesRef = row[this.map.MES_REF];
      if (!mesRef) continue;

      let chaveMes = "";

      // 1. Se for um objeto de data real do Google Sheets
      if (mesRef instanceof Date) {
        chaveMes = `${mesRef.getFullYear()}-${(mesRef.getMonth() + 1).toString().padStart(2, '0')}`;
      } 
      // 2. BLINDAGEM: Se for o formato de texto "set./2020" ou similar
      else if (typeof mesRef === 'string') {
        const mesesMap = { 'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06', 
                           'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12' };
        
        const anoMatch = mesRef.match(/\d{4}/); // Captura 2020
        const mesAbrev = mesRef.substring(0, 3).toLowerCase(); // Captura "set"
        
        if (anoMatch && mesesMap[mesAbrev]) {
          chaveMes = `${anoMatch}-${mesesMap[mesAbrev]}`;
        }
      }

if (!chaveMes) {
  console.warn("⚠️ Data inválida ignorada: " + mesRef);
  continue;
}

      if (!meses[chaveMes]) {
        meses[chaveMes] = {
          chave: chaveMes,
          ano: parseInt(chaveMes.split('-')[0]),
          mes: parseInt(chaveMes.split('-')[1]),
          vendasAcoes: 0,
          resSwing: 0,
          resDT: 0,
          resFII: 0,
          irFonte: 0
        };
      }

      const m = meses[chaveMes];
      const lucro = parseFloat(row[this.map.LUCRO_PREJUIZO]) || 0;
      const tipoPapel = String(row[this.map.TIPO_PAPEL] || "").toUpperCase();
      const modalidade = this.map.MODALIDADE > -1 ? String(row[this.map.MODALIDADE] || "").toUpperCase() : "";
      const irFonte = parseFloat(row[this.map.IR_FONTE]) || 0;
      const vendasMes = parseFloat(row[this.map.VENDAS_MES]) || 0;

      m.irFonte += irFonte;
      if (vendasMes > m.vendasAcoes) m.vendasAcoes = vendasMes;

      if (tipoPapel.includes("FII")) {
        m.resFII += lucro;
      } else if (modalidade.includes("DAY") || modalidade.includes("DT")) {
        m.resDT += lucro;
      } else {
        m.resSwing += lucro;
      }
    }

    // 2. Cálculo Cronológico (Compensação de Prejuízos)
    const chavesOrdenadas = Object.keys(meses).sort();
    let prejuAcumSwing = 0;
    let prejuAcumDT = 0;
    let prejuAcumFII = 0;
    let darfAcumuladoAnterior = 0;

    const resultadoFinal = [];

    for (const k of chavesOrdenadas) {
      const m = meses[k];

      // --- SWING TRADE ---
      let baseSwing = m.resSwing;
      let isento = false;

      // Regra dos 20k (Apenas para lucro de ações, não abate prejuízo se for isento)
      if (m.resSwing > 0 && m.vendasAcoes < 20000) {
        isento = true; 
      } else {
        // Se não é isento, pode compensar prejuízo anterior
        if (baseSwing > 0 && prejuAcumSwing < 0) {
          const abatimento = Math.min(baseSwing, Math.abs(prejuAcumSwing));
          baseSwing -= abatimento;
          prejuAcumSwing += abatimento;
        }
      }
      // Se teve prejuízo no mês, acumula
      if (m.resSwing < 0) prejuAcumSwing += m.resSwing;

      // --- DAY TRADE ---
      let baseDT = m.resDT;
      if (baseDT > 0 && prejuAcumDT < 0) {
        const abatimento = Math.min(baseDT, Math.abs(prejuAcumDT));
        baseDT -= abatimento;
        prejuAcumDT += abatimento;
      }
      if (m.resDT < 0) prejuAcumDT += m.resDT;

      // --- FII ---
      let baseFII = m.resFII;
      if (baseFII > 0 && prejuAcumFII < 0) {
        const abatimento = Math.min(baseFII, Math.abs(prejuAcumFII));
        baseFII -= abatimento;
        prejuAcumFII += abatimento;
      }
      if (m.resFII < 0) prejuAcumFII += m.resFII;

      // --- CÁLCULO DO IMPOSTO ---
      let imposto = 0;
      if (!isento && baseSwing > 0) imposto += baseSwing * 0.15;
      if (baseDT > 0) imposto += baseDT * 0.20;
      if (baseFII > 0) imposto += baseFII * 0.20;

      // Abate IR Fonte do valor final a pagar
      let darfMes = Math.max(0, imposto - m.irFonte);
      let totalDarfCalculado = darfMes + darfAcumuladoAnterior;
      
      if (totalDarfCalculado >= 10) {
        m.valorDARF = totalDarfCalculado;
        darfAcumuladoAnterior = 0; // Zerado pois atingiu o mínimo para pagamento
      } else {
        m.valorDARF = totalDarfCalculado; // Armazena para flag "ACUMULAR" no relatório
        darfAcumuladoAnterior = totalDarfCalculado; // Carrega para o próximo mês
      }

      // Salva estado final para o relatório
      m.prejuSwingFinal = prejuAcumSwing;
      m.prejuDTFinal = prejuAcumDT;
      m.prejuFIIFinal = prejuAcumFII; // Adicionado para o adaptador

      resultadoFinal.push(m);
    }

    return resultadoFinal;
  }

  _escreverRelatorios(dados) {
  this._escreverDARFMensal(dados);
  this._escreverResumoAnual(dados);
  this._escreverResumoExecutivo(dados); // Garante a execução do resumo
}

_escreverResumoExecutivo(dados) {
  const sheet = this.ss.getSheetByName(TAX_CONFIG.SHEETS.TARGET_EXEC);
  if (!sheet) return;

  // Pega o último mês da lista (o mais recente processado)
  const ultimo = dados[dados.length - 1];
  if (!ultimo) return;

  // Formata o mês/ano com segurança para evitar NaN/NaN
  const mesFormatado = (isNaN(ultimo.mes) || isNaN(ultimo.ano)) 
    ? "Aguardando Dados" 
    : `${ultimo.mes.toString().padStart(2, '0')}/${ultimo.ano}`;

  const agora = new Date().toLocaleString('pt-BR');

  // Montagem da Matriz de Dados conforme seu layout
  const matrizResumo = [
    ["Gerado em", agora],
    ["Mês Atual", mesFormatado],
    ["Lucro/Prejuízo Swing", ultimo.resSwing || 0],
    ["Lucro/Prejuízo DT", ultimo.resDT || 0],
    ["Lucro/Prejuízo FII", ultimo.resFII || 0],
    ["Saldo Prejuízo Swing", ultimo.prejuSwingFinal || 0],
    ["DARF A PAGAR", ultimo.valorDARF || 0],
    ["Vendas totais", ultimo.vendasAcoes || 0]
  ];

  // Escreve os dados a partir da Linha 2 (Coluna A e B)
  sheet.getRange(2, 1, matrizResumo.length, 2).setValues(matrizResumo);
  
  // Formatação visual rápida
  sheet.getRange(4, 2, 5, 1).setNumberFormat('"R$ "#,##0.00'); // Valores monetários
  sheet.getRange(2, 2).setFontColor("#666666"); // Timestamp em cinza
  
  console.log("✅ Aba Resumo_Executivo_IRPF atualizada com sucesso.");
}
  _escreverDARFMensal(dados) {
    const sheet = this.ss.getSheetByName(TAX_CONFIG.SHEETS.TARGET_DARF);
    if (!sheet) return;
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow()-1, 10).clearContent();

    const rows = dados.map(d => [
      `${d.mes}/${d.ano}`, 
      d.vendasAcoes,       
      d.resSwing,          
      d.prejuSwingFinal,   
      d.resDT,             
      d.prejuDTFinal,      
      d.resFII,            
      d.irFonte,           
      d.valorDARF,         
      d.valorDARF > 10 ? "A PAGAR" : (d.valorDARF > 0 ? "ACUMULAR" : "OK")
    ]);

    if (rows.length > 0) sheet.getRange(2, 1, rows.length, 10).setValues(rows);
  }

  _escreverResumoAnual(dados) {
    const sheet = this.ss.getSheetByName(TAX_CONFIG.SHEETS.TARGET_ANUAL);
    if (!sheet) return;
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow()-1, 9).clearContent();

    const rows = dados.map(d => [
      d.ano, d.mes, d.resSwing, d.prejuSwingFinal, d.resDT, d.prejuDTFinal, d.resFII, d.irFonte, d.valorDARF
    ]);

    if (rows.length > 0) sheet.getRange(2, 1, rows.length, 9).setValues(rows);
  }
}

// =============================================================================
// ADAPTADOR GLOBAL (A PEÇA QUE FALTAVA)
// =============================================================================
// Este objeto conecta o Motor (TaxProcessor) com a Interface (DARFGenerator)
var TaxCalculator = {

  /**
   * Calcula o imposto de um mês específico, processando todo o histórico
   * para garantir que os prejuízos acumulados estejam corretos.
   */
  calculateMonthlyTax: function(mes, ano) {
    try {
      const processador = new TaxProcessor();
      const historicoCompleto = processador.obterDadosMensais();

      // Encontra o mês desejado
      const dadosMes = historicoCompleto.find(d => d.mes === mes && d.ano === ano);

      if (!dadosMes) return null;

      return {
        impostoTotal: dadosMes.valorDARF,
        lucroLiquido: dadosMes.resSwing + dadosMes.resDT + dadosMes.resFII,
        prejuizoAcumulado: dadosMes.prejuSwingFinal + dadosMes.prejuDTFinal + dadosMes.prejuFIIFinal
      };
    } catch (e) {
      console.error("Erro no TaxCalculator:", e);
      throw e;
    }
  }
};

// Função Global para recalcular tudo (usada pelo Menu de Recálculo)
function EXECUTAR_CALCULO_FISCAL() {
  try {
    const processador = new TaxProcessor();
    const resultados = processador.executarProcessamento();
    SpreadsheetApp.getUi().alert(`✅ Cálculo Fiscal Concluído! ${resultados.length} meses processados.`);
  } catch (e) {
    SpreadsheetApp.getUi().alert(`❌ Erro: ${e.message}`);
  }
}
