/**
 * =============================================================================
 * 30_DARF_Generator.gs — PAINEL FISCAL & INTERFACE (V2.1)
 * =============================================================================
 * Interface visual para o Motor Contábil.
 * - Botão para gerar DARF manual
 * - Gatilho para rodar automático todo dia 01
 */

// Mudei de 'const' para 'var' para garantir visibilidade global no Menu
var DARFGenerator = (function() {

  // Função chamada pelo Menu ou Botão
  function emitirGuiaMensal(mes, ano) {
    const ui = SpreadsheetApp.getUi();

    // Se não passar mês/ano, assume o mês anterior ao atual
    if (!mes || !ano) {
      const data = new Date();
      mes = data.getMonth(); // Mês atual (0-11)
      ano = data.getFullYear();

      // Se estamos em Janeiro (0), queremos o DARF de Dezembro do ano passado
      if (mes === 0) { 
        mes = 12; 
        ano--; 
      }
      // Se estamos em Fev (1), queremos Jan (1), etc.
      // Nota: O TaxCalculator geralmente espera mês 1-12.
    }

    // Validação: Impedir emissão de meses não finalizados ou futuros
    const agora = new Date();
    const mesAtual = agora.getMonth() + 1; // 1-12
    const anoAtual = agora.getFullYear();

    if (ano > anoAtual || (ano === anoAtual && mes >= mesAtual)) {
      ui.alert("🚫 Validação Fiscal", 
        `O mês ${mes}/${ano} ainda não terminou ou é uma data futura. \nAguarde o início do próximo mês para apurar os resultados definitivos.`, 
        ui.ButtonSet.OK);
      return;
    }

    // Proteção contra falta do motor de cálculo
    if (typeof TaxCalculator === 'undefined') {
      ui.alert("⚠️ Erro Crítico", "O módulo 'TaxCalculator' (Arquivo 21) não foi encontrado.", ui.ButtonSet.OK);
      return;
    }

    const resultado = TaxCalculator.calculateMonthlyTax(mes, ano); // Chama o Motor V3.0

    if (!resultado) {
      ui.alert(`⚠️ Sem dados fiscais encontrados para ${mes}/${ano}.`);
      return;
    }

    // Se tiver imposto a pagar (>= R$ 10,00 conforme regra da RFB)
    if (resultado.impostoTotal >= 10) {
      const html = `
        <div style="font-family: sans-serif; padding: 20px; text-align: center;">
          <h2 style="color: #c00;">🏛️ DARF A PAGAR</h2>
          <p>Referência: <strong>${mes}/${ano}</strong></p>
          <div style="background: #fce8e6; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <span style="font-size: 24px; font-weight: bold; color: #c00;">
              R$ ${resultado.impostoTotal.toFixed(2)}
            </span>
          </div>
          <p>Código Receita: <strong>6015</strong> (Pessoa Física)</p>
          <p style="font-size: 12px; color: #666;">
            Vencimento: Último dia útil do mês seguinte.
          </p>
          <hr>
          <p style="font-size: 11px;">✅ Os dados foram salvos na aba 'DARF_Mensal'.</p>
        </div>
      `;
      _exibirModal(html, "Guia de Recolhimento", 350, 400);
    } else {
      // Se for isento ou acumulou prejuízo
      const html = `
        <div style="font-family: sans-serif; padding: 20px; text-align: center;">
          <h2 style="color: #38761d;">✅ ISENTO / ACUMULAR</h2>
          <p>Referência: <strong>${mes}/${ano}</strong></p>
          <p>Lucro Líquido: R$ ${resultado.lucroLiquido ? resultado.lucroLiquido.toFixed(2) : '0.00'}</p>
          <p>Prejuízo Acumulado: <span style="color: red;">R$ ${resultado.prejuizoAcumulado ? resultado.prejuizoAcumulado.toFixed(2) : '0.00'}</span></p>
          <div style="background: #d9ead3; padding: 10px; border-radius: 8px; margin: 15px 0;">
            <strong>A PAGAR: R$ 0,00</strong>
          </div>
          <p style="font-size: 11px;">✅ Histórico atualizado na aba 'DARF_Mensal'.</p>
        </div>
      `;
      _exibirModal(html, "Relatório Fiscal", 350, 400);
    }
  }

  /**
   * Envia o resumo fiscal por e-mail
   */
  function enviarDarfPorEmail() {
    const agora = new Date();
    // Se não for o primeiro dia útil, encerra
    if (!_isPrimeiroDiaUtil(agora)) {
      console.log("📅 Hoje não é o primeiro dia útil do mês. Envio de e-mail cancelado.");
      return;
    }

    // Calcula o mês anterior
    let mes = agora.getMonth(); 
    let ano = agora.getFullYear();
    if (mes === 0) { mes = 12; ano--; }

    const resultado = TaxCalculator.calculateMonthlyTax(mes, ano);
    if (!resultado) return;

    const emailUser = Session.getActiveUser().getEmail();
    const assunto = `🏛️ Resumo Fiscal B3 - ${mes}/${ano}`;
    
    let corpoHtml = `
      <div style="font-family: sans-serif; max-width: 500px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #0c343d;">Sniper B3: Relatório Fiscal</h2>
        <p>Mês de Referência: <b>${mes}/${ano}</b></p>
        <hr>
        <p>Lucro Líquido: <b>R$ ${resultado.lucroLiquido.toFixed(2)}</b></p>
        <p>Prejuízo Acumulado: <b style="color: #c00;">R$ ${resultado.prejuizoAcumulado.toFixed(2)}</b></p>
        <div style="background: ${resultado.impostoTotal >= 10 ? '#fce8e6' : '#d9ead3'}; padding: 15px; text-align: center; border-radius: 8px;">
          <span style="font-size: 18px;">IMPOSTO DEVIDO:</span><br>
          <span style="font-size: 24px; font-weight: bold;">R$ ${resultado.impostoTotal.toFixed(2)}</span>
        </div>
        <p style="font-size: 12px; color: #666; margin-top: 15px;">
          ${resultado.impostoTotal >= 10 ? '⚠️ Gere seu DARF pelo Sicalc com o código 6015.' : '✅ Não há necessidade de emitir DARF este mês (valor inferior a R$ 10,00 ou isento).'}
        </p>
      </div>
    `;

    GmailApp.sendEmail(emailUser, assunto, "Seu cliente de e-mail não suporta HTML.", { htmlBody: corpoHtml });
    console.log(`✅ E-mail fiscal enviado para ${emailUser}`);
  }

  /**
   * Verifica se hoje é o primeiro dia útil do mês
   */
  function _isPrimeiroDiaUtil(data) {
    const diaSemana = data.getDay(); // 0=Dom, 6=Sab
    if (diaSemana === 0 || diaSemana === 6) return false;
    
    if (typeof ComplianceUnified !== 'undefined' && ComplianceUnified._ehFeriado(data)) return false;

    // Verifica se existiu algum dia útil antes de hoje no mesmo mês
    for (let d = 1; d < data.getDate(); d++) {
      let diaAnterior = new Date(data.getFullYear(), data.getMonth(), d);
      if (diaAnterior.getDay() !== 0 && diaAnterior.getDay() !== 6) {
        if (typeof ComplianceUnified === 'undefined' || !ComplianceUnified._ehFeriado(diaAnterior)) {
          return false; // Já houve um dia útil este mês
        }
      }
    }
    return true;
  }

  function _exibirModal(html, titulo, w, h) {
    const output = HtmlService.createHtmlOutput(html).setWidth(w).setHeight(h);
    SpreadsheetApp.getUi().showModalDialog(output, titulo);
  }

  return { 
    emitirGuiaMensal: emitirGuiaMensal,
    enviarDarfPorEmail: enviarDarfPorEmail,
    // ALIAS: O menu chama 'gerarRelatorio', então apontamos para a mesma função
    gerarRelatorio: emitirGuiaMensal 
  };
})();

// --- FUNÇÕES DE MENU (LEGADO) ---

function MENU_FISCAL_CALCULAR_MES_ANTERIOR() {
  DARFGenerator.emitirGuiaMensal();
}

function MENU_FISCAL_RECALCULAR_TUDO() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("⚠️ Recalcular Todo o Histórico?", 
    "Isso vai apagar e refazer as abas 'IRPF_Resumo_Anual' e 'DARF_Mensal' com base nas Notas de Corretagem.\nDeseja continuar?", 
    ui.ButtonSet.YES_NO);

  if (resp == ui.Button.YES) {
    if (typeof EXECUTAR_CALCULO_FISCAL !== 'undefined') {
       EXECUTAR_CALCULO_FISCAL(); 
    } else {
       ui.alert("Função EXECUTAR_CALCULO_FISCAL não encontrada.");
    }
  }
}

/**
 * Ponto de entrada para o Gatilho Automático
 */
function ENVIAR_DARF_MENSAL_AUTOMATICO() {
  DARFGenerator.enviarDarfPorEmail();
}
