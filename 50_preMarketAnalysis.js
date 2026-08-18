/**
 * =============================================================================
 * 50_preMarketAnalysis.gs — v5.1 (SNIPER EDITION FIXED)
 * =============================================================================
 * ✅ CORREÇÃO: Argumentos passados corretamente para o HTML.
 * ✅ FEATURE: Cálculo automático de % de Lucro e Cores de Status.
 * ✅ FEATURE: Sugestões automáticas de Trailing Stop (Breakeven).
 */

// --- FUNÇÃO PARA O BOTÃO/MENU ---
function VISUALIZAR_MONITORAMENTO() {
  preMarketAnalysis_Inteligente(true);
}

// --- FUNÇÃO PRINCIPAL ---
function preMarketAnalysis_Inteligente(forcarVisual = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Carteira');
  if (!sheet) return; // Segurança

  const ui = forcarVisual ? SpreadsheetApp.getUi() : null;
  const valores = sheet.getDataRange().getValues();
  
  const analises = [];
  const sugestoes = [];
  let lucroTotalCarteira = 0;

  // LOOP COM ÂNCORA INTERNA
  // Assumindo cabeçalho na linha 1, dados começam na linha 2 (índice 1)
  for (let i = 1; i < valores.length; i++) {
    const row = valores[i];
    
    // Mapeamento de Colunas (Ajuste se necessário)
    const ticker     = String(row[1]).trim(); // Col B
    const precoMedio = parseFloat(row[5]) || 0; // Col F (Necessário para calcular %)
    const precoAtual = parseFloat(row[7]) || 0; // Col H
    const lucroReais = parseFloat(row[8]) || 0; // Col I
    
    // Colunas de Gestão (OCO)
    const stopReal   = parseFloat(row[15]) || 0; // P
    const alvo1      = parseFloat(row[16]) || 0; // Q
    const alvo2      = parseFloat(row[17]) || 0; // R

    if (!ticker || ticker === "Papel" || precoAtual <= 0) continue;

    // 1. Acumula Lucro Total
    lucroTotalCarteira += lucroReais;

    // 2. Cálculos de Distância
    const distStop = stopReal > 0 ? ((precoAtual - stopReal) / precoAtual) * 100 : 0;
    
    // Define qual o próximo alvo (Dinâmica de Parciais)
    let labelAlvo = "Alvo 1";
    let proxAlvo = alvo1;
    
    // Se já passou do Alvo 1, mira no Alvo 2
    if (precoAtual > alvo1 && alvo2 > 0) {
        proxAlvo = alvo2;
        labelAlvo = "Alvo 2";
    }
    
    const distAlvo = proxAlvo > 0 ? ((proxAlvo - precoAtual) / precoAtual) * 100 : 0;
    
    // 3. Cálculo de % de Lucro (Se PM existir, senão 0)
    const lucroPerc = precoMedio > 0 ? ((precoAtual / precoMedio) - 1) * 100 : 0;

    // 4. Definição de Cores e Status
    let status = "OK";
    let statusCor = "#2ecc71"; // Verde

    if (distStop < 2 && distStop > 0) {
        status = "PERIGO 🚨";
        statusCor = "#e74c3c"; // Vermelho
    } else if (distStop < 5) {
        status = "ATENÇÃO ⚠️";
        statusCor = "#f39c12"; // Laranja
    }

    // 5. Lógica de Sugestão (Trailing Stop Simples)
    // Se lucro > 3% e o Stop ainda está abaixo do Preço Médio (Prejuízo), sugere Breakeven
    if (lucroPerc > 3 && stopReal < precoMedio) {
        sugestoes.push({
            papel: ticker,
            novoStop: precoMedio * 1.01 // Sugere 1% acima do preço médio
        });
    }

    analises.push({
      papel: ticker,
      precoAtual: precoAtual,
      lucroReais: lucroReais,
      lucroPerc: lucroPerc, // Faltava isso
      distStop: distStop,
      distAlvo: distAlvo.toFixed(1),
      labelAlvo: labelAlvo, // Faltava isso
      status: status,
      statusCor: statusCor  // Faltava isso
    });
  }

  // Objeto de Estatísticas Gerais
  const stats = {
      lucroTotal: lucroTotalCarteira
  };

  if (ui && analises.length > 0) {
    // Agora passamos os 3 argumentos corretamente
    const html = construirHtmlSniper(analises, stats, sugestoes); 
    ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(900).setHeight(700), "🎯 Monitor Sniper v5.1");
  } else if (ui) {
    ui.alert("Nenhum ativo monitorável encontrado na Carteira (Verifique colunas H, P, Q).");
  }
}

/**
 * --- CONSTRUÇÃO DO HTML (VISUAL SNIPER) ---
 */
function construirHtmlSniper(analises, stats, sugestoes) {
  const corBase = stats.lucroTotal >= 0 ? '#28a745' : '#dc3545';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 20px; background: #f4f7f6; }
        .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${corBase}; padding-bottom: 10px; }
        .stat-val { font-size: 24px; font-weight: bold; color: ${corBase}; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; background: white; }
        th { background: #34495e; color: white; padding: 12px; text-align: left; font-size: 12px; }
        td { padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
        .badge { padding: 5px 10px; border-radius: 4px; color: white; font-weight: bold; font-size: 11px; }
        .target-box { color: #2980b9; font-weight: bold; }
        .stop-dist { font-weight: bold; }
        li { margin-bottom: 5px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div><h2 style="margin:0;">🎯 Monitoramento Sniper</h2></div>
          <div style="text-align:right;">
            <div style="font-size:12px; color:#666;">RESULTADO CARTEIRA</div>
            <div class="stat-val">R$ ${stats.lucroTotal.toFixed(2)}</div>
          </div>
        </div>
      </div>

      ${sugestoes.length > 0 ? `
        <div class="card" style="border-left: 5px solid #f39c12; background: #fff9f0;">
          <strong style="color: #e67e22;">💡 PROTEÇÃO DE LUCRO (TRAILING STOP):</strong>
          <ul style="margin: 10px 0; font-size: 13px; padding-left: 20px;">
            ${sugestoes.map(s => `<li><strong>${s.papel}:</strong> Subir Stop para <span style="color:#27ae60">R$ ${s.novoStop.toFixed(2)}</span> (Breakeven)</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="card">
        <table>
          <thead>
            <tr>
              <th>ATIVO</th>
              <th>PREÇO ATUAL</th>
              <th>LUCRO</th>
              <th>DIST. STOP</th>
              <th>PRÓX. ALVO</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${analises.map(a => `
              <tr>
                <td><strong>${a.papel}</strong></td>
                <td>R$ ${a.precoAtual.toFixed(2)}</td>
                <td style="color: ${a.lucroReais >= 0 ? '#27ae60' : '#c0392b'}">
                  <b>${a.lucroPerc.toFixed(1)}%</b><br>
                  <span style="font-size:11px">R$ ${a.lucroReais.toFixed(2)}</span>
                </td>
                <td class="stop-dist" style="color: ${a.statusCor}">
                  ${a.distStop.toFixed(1)}%
                </td>
                <td class="target-box">
                  <span style="font-size:10px; color:#7f8c8d">${a.labelAlvo}</span><br>
                  ${a.distAlvo}%
                </td>
                <td><span class="badge" style="background:${a.statusCor}">${a.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p style="font-size:10px; color:#999; text-align:center;">Monitorando colunas H, I (Resultado) e P, Q, R (Setup OCO)</p>
    </body>
    </html>
  `;
}