/**
 * 17_Notification_Manager.gs — v7.6 (INTELLIGENCE & AGENTIC)
 * =============================================================================
 * ✅ RÓTULOS: Alterado de "P/L" para "LUCRO ATUAL" para evitar confusão.
 * ✅ FILTRO: Remove ativos sem meta e sem posição (limpeza de ruído).
 * ✅ HIERARQUIA: Prioriza ações imediatas (Comprar/Vender) no topo.
 * ✅ MULTICANAL: Suporte integrado para Telegram e Gmail.
 */

var NotificationService = (function() {

  /**
   * Função principal que consolida dados e dispara os alertas.
   */
  function dispararRelatorioDiario() {
    // Recuperação de chaves de API
    const token = _getConfigSecret("TELEGRAM_BOT_TOKEN") || _getConfigSecret("TELEGRAM_TOKEN");
    const chatId = _getConfigSecret("TELEGRAM_CHAT_ID");
    const emailUser = Session.getActiveUser().getEmail();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const abaDash = ss.getSheetByName("Dashboard");
    const abaRel = ss.getSheetByName("Relatorio_Rebalanceamento");

    if (!abaDash || !abaRel) {
      console.error("❌ Erro: Abas Dashboard ou Relatorio_Rebalanceamento não encontradas.");
      return;
    }

    // 1. Captura de KPIs do Dashboard
    const patrimonio = abaDash.getRange("A4").getDisplayValue(); 
    const lucroGeral = abaDash.getRange("B4").getDisplayValue();

    // 2. Processamento da Tabela de Rebalanceamento
    // Estrutura esperada: Ticker(0), Situação(1), QtdAtual(2), Meta(3), PreçoAtual(4), PreçoMédio(5)
    const dados = abaRel.getRange(3, 1, abaRel.getLastRow() - 2, 6).getValues();
    
    let urgentes = []; 
    let mantidos = [];

    dados.forEach(r => {
      const [ticker, situacao, qtdAt, meta, precoAt, precoMed] = r;
      
      // Filtro para ignorar o que não exige atenção
      if (meta === 0 && (qtdAt === 0 || qtdAt === "")) return;

      // Cálculo de Rentabilidade Real (Lucro da Posição)
      let rentabilidade = 0;
      let rentStr = "---";
      if (precoMed > 0 && precoAt > 0) {
        rentabilidade = ((precoAt / precoMed) - 1) * 100;
        rentStr = (rentabilidade > 0 ? "+" : "") + rentabilidade.toFixed(2) + "%";
      }

      const item = { 
        ticker, 
        situacao: situacao.replace(/[✅📈📉🚀🚨⚠️]/g, "").trim(), 
        qtdAt, 
        meta, 
        precoAt: _formatBRL(precoAt),
        precoMed: _formatBRL(precoMed),
        lucroAtual: rentStr, // Termo corrigido
        isPositivo: rentabilidade >= 0
      };

      // Separação por prioridade
      if (situacao.includes("MANTER")) {
        mantidos.push(item);
      } else {
        urgentes.push(item);
      }
    });

    // Ordenação: Itens que exigem saída (Venda/Reduzir) aparecem primeiro
    urgentes.sort((a, b) => a.situacao.match(/SAIR|REDUZIR/) ? -1 : 1);

    // 3. Execução dos Disparos
    _enviarTelegram(token, chatId, patrimonio, lucroGeral, urgentes);
    _enviarGmail(emailUser, patrimonio, lucroGeral, urgentes, mantidos);
  }

  function _getConfigSecret(key) {
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') ? CONFIG.getSecret(key) : null;
  }

  /**
   * Formatação e envio para Telegram.
   */
  function _enviarTelegram(token, chatId, pat, luc, urgentes) {
    if (!token || !chatId) return;

    let msg = `📊 *SNIPER B3: RELATÓRIO*\n`;
    msg += `💰 *Patr:* ${pat} | 📈 *Resultado:* ${luc}\n`;
    msg += `──────────────────\n`;

    if (urgentes.length === 0) {
      msg += `😴 *Sem movimentações urgentes.*`;
    } else {
      urgentes.forEach(a => {
        let emoji = a.situacao.match(/COMPRA|AUMENTAR/) ? "🚀" : "🚨";
        msg += `${emoji} *${a.ticker}*: ${a.situacao}\n`;
        msg += `   └ LUCRO: ${a.lucroAtual} | Meta: ${a.meta}\n`;
      });
    }

    try {
      UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
        muteHttpExceptions: true
      });
    } catch(e) { console.error("Erro Telegram: " + e); }
  }

 /**
   * Construção do HTML e envio para Gmail.
   */
  function _enviarGmail(email, pat, luc, urgentes, mantidos) {
    const corResultado = luc.includes("-") ? "#e74c3c" : "#2ecc71";
    
    // Adicionada estrutura HTML completa com declaração rigorosa de UTF-8
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
          <div style="background: #0c343d; color: white; padding: 25px;">
            <h2 style="margin:0; font-size: 22px;">&#x1F3AF; Sniper B3 <span style="font-weight: 200;">Análise trades</span></h2>
            <p style="margin:10px 0 0 0; font-size: 14px; opacity: 0.9;">
              Patrimônio: <b>${pat}</b> | Resultado: <b style="color:${corResultado};">${luc}</b>
            </p>
          </div>
          <div style="padding: 20px; background: #ffffff;">
    `;

    if (urgentes.length > 0) {
      // Usado &#x26A1; para o emoji de Raio (⚡)
      html += `
        <h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">&#x26A1; Ações Recomendadas</h3>
        <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="font-size: 11px; color: #7f8c8d; text-transform: uppercase; background: #fdfdfd;">
            <th align="left" style="padding:10px;">Ativo</th>
            <th align="center">Ação</th>
            <th align="right">LUCRO ATUAL</th>
            <th align="right">Meta</th>
          </tr>
      `;
      
      urgentes.forEach(u => {
        const corLucro = u.isPositivo ? "#27ae60" : "#c0392b";
        html += `
          <tr style="border-bottom: 1px solid #f2f2f2;">
            <td style="padding:12px 10px;"><b>${u.ticker}</b><br><span style="font-size:10px; color:#999;">${u.precoAt}</span></td>
            <td align="center"><span style="background:#f1f3f4; padding:4px 8px; border-radius:5px; font-size:11px; font-weight:bold; color:#333;">${u.situacao}</span></td>
            <td align="right" style="color:${corLucro}; font-weight:bold;">${u.lucroAtual}</td>
            <td align="right"><b>${u.meta}</b></td>
          </tr>`;
      });
      html += `</table>`;
    } else {
      // Usado &#x1F634; para o emoji Dormindo (😴)
      html += `<div style="text-align:center; padding: 40px; color:#95a5a6;"><b>&#x1F634; Nada para operar no momento.</b></div>`;
    }

    if (mantidos.length > 0) {
      // Usado &#x1F6E1;&#xFE0F; para o emoji de Escudo (🛡️)
      html += `
        <h4 style="color: #bdc3c7; font-weight: 500; margin-top: 30px; margin-bottom: 10px;">&#x1F6E1;&#xFE0F; Carteira em Manutenção</h4>
        <table style="width:100%; font-size: 12px; color: #7f8c8d; border-top: 1px solid #eee;">
      `;
      mantidos.forEach(m => {
        html += `
          <tr>
            <td style="padding:8px 0;"><b>${m.ticker}</b></td>
            <td align="center">Qtd: ${m.qtdAt}</td>
            <td align="right" style="color:${m.isPositivo ? '#27ae60':'#c0392b'}">${m.lucroAtual}</td>
          </tr>`;
      });
      html += `</table>`;
    }

    html += `
          </div>
          <div style="background:#f8f9fa; padding:15px; text-align:center; font-size:11px; color:#bbb; border-top: 1px solid #eee;">
            Sniper B3 v7.6 • Sistema de Gestão Automatizada
          </div>
        </div>
      </body>
      </html>
    `;

    // Usado \uD83C\uDFAF (Escape Unicode) no assunto do e-mail no lugar do caractere direto do Alvo
    const subject = `[Sniper B3] Relatório: ${urgentes.length > 0 ? urgentes.length + ' ordens sugeridas' : 'Sem movimentações'}`;
    
    GmailApp.sendEmail(email, subject, "", { htmlBody: html });
  }

  function _formatBRL(val) {
    if (typeof val !== 'number' || isNaN(val)) return "R$ 0,00";
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }





/**
   * Envia alertas operacionais e de risco avulsos para o Telegram
   */
  function enviarAlertaRisco(mensagem) {
    const token = _getConfigSecret("TELEGRAM_BOT_TOKEN") || _getConfigSecret("TELEGRAM_TOKEN");
    const chatId = _getConfigSecret("TELEGRAM_CHAT_ID");

    if (!token || !chatId) return;

    try {
      UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ chat_id: chatId, text: mensagem, parse_mode: 'Markdown' }),
        muteHttpExceptions: true
      });
    } catch(e) { console.error("Erro ao enviar alerta de risco: " + e); }
  }

  // 👇 ATUALIZE O RETORNO DO MÓDULO PARA EXPOR A NOVA FUNÇÃO:
  return { dispararRelatorioDiario, enviarAlertaRisco };

})();

/**
 * Ponto de entrada para disparar manualmente ou via acionador (Triggers).
 */
function EXECUTAR_NOTIFICACAO_DIARIA() {
  NotificationService.dispararRelatorioDiario();
}
