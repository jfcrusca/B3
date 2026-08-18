/**
 * 29_Oportunidades_Processor.gs — V5.0 (ABA ÚNICA PARA O USUÁRIO)
 * =============================================================================
 * ✅ RESPONSABILIDADE: Ler "Resultados_Analise", consolidar por Ticker e gerar
 * a aba final "Oportunidades" com 16 colunas ricas para tomada de decisão.
 * ✅ UNIFICA: Substitui as 3 abas concorrentes (Resultados_Analise bruto,
 *    Oportunidades simplificada, Resumo_Trades_Aprovados) por UMA aba definitiva.
 * ✅ MODO: SNAPSHOT (Apaga e reescreve a aba de destino a cada execução).
 * =============================================================================
 */

var OportunidadesProcessor = {

  CONFIG: {
    ORIGEM: 'Resultados_Analise',
    DESTINO: 'Oportunidades',
    HEADERS_DESTINO: [
      'Data',                     // 0: Data/Hora da geração
      'Ticker',                   // 1: Código do ativo
      'Preço Atual',              // 2: Cotação atual
      'Entrada Sugerida',         // 3: Preço ideal para entrar (FIBO ou preço)
      'Stop Loss',                // 4: Onde cortar perda
      'Alvo 1',                   // 5: Primeiro alvo (realização parcial)
      'Alvo 2',                   // 6: Segundo alvo
      'R/R',                      // 7: Retorno/Risco
      'Risco %',                  // 8: Porcentagem de risco
      'Recomendação',             // 9: ✅ ENTRAR / ⏳ AGUARDAR / ⛔ NÃO ENTRAR
      'Score',                    // 10: Nota do robô (0-100)
      'Setup',                    // 11: Estratégia identificada
      'Tipo Setup',               // 12: PULLBACK / TENDÊNCIA / MOMENTUM / ROMPIMENTO
      'Análise Técnica',          // 13: Resumo em 1 linha (ex: "RSI 48, EMA21 R$75,36, ATR R$1,13")
      'Análise IA',               // 14: Frase-chave extraída da IA
      'Observações'               // 15: Alerta de segurança + motivo
    ],
    IDX_ORIGEM: {
      DATA: 0,
      TICKER: 1,
      PRECO: 2,
      SCORE: 3,
      SETUP: 4,
      MOTIVO: 5,
      STOP: 6,
      ALVO1: 7,
      ALVO2: 8,
      RR: 9,
      RISCO: 10,
      RSI: 11,
      EMA21: 12,
      EMA50: 13,
      EMA200: 14,
      ATR: 15,
      VOLUME: 16,
      PIVOT: 17,
      FIBO: 18,
      ANALISE_IA: 19,
      RANKING: 20,
      TIPO_SETUP: 21,
      ALERTA: 22,
      // 🔧 CORREÇÃO v10.2: Novas métricas de "perto do topo"
      TOPO50: 23,
      GANHO_RAPIDO: 24,
      DIST_TOPO: 25
    }
  },

  /**
   * FUNÇÃO PRINCIPAL (PÚBLICA)
   */
  executar: function() {
    console.time("⏱️ Processamento Oportunidades v5");
    console.log("🚀 [OPORTUNIDADES v5] Consolidando para aba única do usuário...");

    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      
      // 1. Ler Dados Brutos de Resultados_Analise
      const dadosBrutos = this._lerOrigem(ss);
      if (dadosBrutos.length === 0) {
        console.log("ℹ️ Sem dados em 'Resultados_Analise'. Limpando painel...");
        this._limparDestino(ss);
        return;
      }

      // 2. Consolidar por ticker
      const mapaConsolidado = this._consolidarPorTicker(dadosBrutos);
      
      // 3. Montar linhas com 16 colunas ricas
      const linhasFinais = this._montarLinhasFinais(mapaConsolidado);

      // 4. Escrever no destino
      this._escreverDestino(ss, linhasFinais);

      console.log(`✅ Sucesso! ${linhasFinais.length} oportunidades publicadas na aba "${this.CONFIG.DESTINO}".`);

    } catch (e) {
      console.error(`❌ ERRO NO PROCESSADOR v5: ${e.message}`);
      console.error(e.stack);
    }
    console.timeEnd("⏱️ Processamento Oportunidades v5");
  },

  // ===========================================================================
  // MÉTODOS PRIVADOS (AUXILIARES)
  // ===========================================================================

  _lerOrigem: function(ss) {
    const sheet = ss.getSheetByName(this.CONFIG.ORIGEM);
    if (!sheet) {
      console.error(`❌ Aba de origem "${this.CONFIG.ORIGEM}" não encontrada.`);
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // 🔧 CORREÇÃO v10.2: Lê 26 colunas (inclui Topo50, GanhoRapido%, DistTopo%)
    return sheet.getRange(2, 1, lastRow - 1, 26).getValues();
  },

  _consolidarPorTicker: function(dados) {
    const mapa = new Map();
    const IDX = this.CONFIG.IDX_ORIGEM;

    dados.forEach(row => {
      const ticker = String(row[IDX.TICKER] || '').trim().toUpperCase();
      if (!ticker) return;

      const setup = String(row[IDX.SETUP] || '');
      // ✅ FILTRO: Remove reprovados, risco alto, sem dados, descartar, erro
      if (setup.indexOf("REPROVADO") !== -1 || setup.indexOf("RISCO ALTO") !== -1 || 
          setup.indexOf("SEM DADOS") !== -1 || setup.indexOf("DESCARTAR") !== -1 || 
          setup.indexOf("ERRO") !== -1) {
        return;
      }

      const dataRow = row[IDX.DATA] instanceof Date ? row[IDX.DATA] : new Date();
      const score = Number(row[IDX.SCORE]) || 0;

      if (mapa.has(ticker)) {
        const existente = mapa.get(ticker);
        const dataExistente = existente[IDX.DATA] instanceof Date ? existente[IDX.DATA] : new Date(0);

        if (dataRow > dataExistente) {
          mapa.set(ticker, row);
        }
        else if (dataRow.getTime() === dataExistente.getTime() && score > Number(existente[IDX.SCORE])) {
          mapa.set(ticker, row);
        }
      } else {
        mapa.set(ticker, row);
      }
    });

    return mapa;
  },

  /**
   * Gera uma recomendação textual clara baseada em score, setup e alertas
   * 🔧 CORREÇÃO v10.1: Inclui verificação de extensão (preço esticado acima da média)
   * 🔧 CORREÇÃO v10.2: Inclui métricas de topo recente (Topo50) e ganho rápido acumulado
   */
  _gerarRecomendacao: function(score, setup, tipoSetup, alerta, rr, preco, ema21, topo50, ganhoRapido) {
    // Se tem alerta de segurança crítico
    if (alerta && (alerta.includes('🚨') || alerta.includes('⏳'))) {
      if (alerta.includes('🚨')) return '⛔ NÃO ENTRAR (FALSO ROMPIMENTO)';
      return '⏳ AGUARDAR (PRÉ-ROMPIMENTO)';
    }
    
    // 🔧 CORREÇÃO v10.2: PREÇO COLADO NO TOPO RECENTE (TOP050)
    // Se o preço está dentro de 3% da máxima de 30 candles → está "perto do topo"
    if (topo50 > 0 && preco > 0 && topo50 > preco) {
      var distTopoPctCalc = (topo50 - preco) / topo50;
      if (distTopoPctCalc < 0.01) {
        return '⏳ AGUARDAR PULLBACK (PREÇO NO TOPO RECENTE — +' + (distTopoPctCalc * 100).toFixed(1) + '%)';
      }
      if (distTopoPctCalc < 0.03) {
        return '🟡 ENTRADA PARCIAL OU AGUARDAR PULLBACK (PREÇO A ' + (distTopoPctCalc * 100).toFixed(1) + '% DO TOPO)';
      }
    }
    
    // 🔧 CORREÇÃO v10.2: GANHO RÁPIDO ACUMULADO (MOVIMENTO ACELERADO)
    // Detecta subida vertical (ex: +12% pós-resultado em 10 candles)
    if (ganhoRapido > 0.08) {
      return '🟡 ENTRADA PARCIAL OU AGUARDAR PULLBACK (GANHO RÁPIDO +' + (ganhoRapido * 100).toFixed(1) + '% EM 10 SESSÕES)';
    }
    
    // 🔧 CORREÇÃO v10.1: SE PREÇO ESTICADO ACIMA DA EMA21 → AGUARDAR PULLBACK
    // Ativo que subiu forte recentemente está "perto do topo" — timing ruim de entrada
    if (preco > 0 && ema21 > 0 && preco > ema21) {
      var extPct = (preco - ema21) / ema21;
      if (extPct > 0.10) {
        return '⏳ AGUARDAR PULLBACK (PREÇO +' + (extPct * 100).toFixed(0) + '% ACIMA DA MÉDIA — ESTICADO)';
      }
      if (extPct > 0.07) {
        return '🟡 ENTRADA PARCIAL OU AGUARDAR PULLBACK (PREÇO +' + (extPct * 100).toFixed(0) + '% ACIMA DA MÉDIA)';
      }
    }
    
    // Se score é muito baixo
    if (score < 30) return '⛔ NÃO ENTRAR (SCORE BAIXO)';
    if (score < 60) return '⏳ AGUARDAR (SCORE MODERADO)';
    
    // Se RR < 2, mesmo com score alto, alerta
    if (rr > 0 && rr < 2) return '⏳ AGUARDAR (R/R < 2)';
    
    // Se for reversão, exige cautela
    if (tipoSetup && tipoSetup.indexOf('REVERSÃO') !== -1) return '⏳ AGUARDAR (REVERSÃO NÃO CONFIRMADA)';
    
    // Se score >= 60 e RR >= 2
    if (score >= 60 && rr >= 2) return '✅ ENTRAR (TENDÊNCIA CONFIRMADA)';
    
    return '⏳ AGUARDAR';
  },

  /**
   * Gera resumo de análise técnica em 1 linha
   */
  _gerarAnaliseTecnica: function(rsi, ema21, ema50, ema200, atr, preco) {
    var partes = [];
    
    // RSI
    if (rsi > 0) {
      var rsiLabel = 'RSI ' + rsi.toFixed(1);
      if (rsi > 70) rsiLabel += ' (sobrecompra)';
      else if (rsi < 30) rsiLabel += ' (sobrevenda)';
      partes.push(rsiLabel);
    }
    
    // Posição do preço vs EMAs
    if (ema21 > 0 && preco > 0) {
      var dist21 = ((preco / ema21) - 1) * 100;
      var emaLabel = 'Preço ' + (dist21 > 0 ? '+' : '') + dist21.toFixed(1) + '% da EMA21';
      partes.push(emaLabel);
    }
    
    // EMA50
    if (ema50 > 0 && preco > 0) {
      var pos50 = preco >= ema50 ? 'acima' : 'abaixo';
      partes.push(pos50 + ' da EMA50');
    }
    
    // EMA200
    if (ema200 > 0 && preco > 0) {
      var pos200 = preco >= ema200 ? 'acima' : 'abaixo';
      partes.push(pos200 + ' da EMA200');
    }
    
    // ATR
    if (atr > 0) {
      partes.push('ATR R$' + atr.toFixed(2));
    }
    
    return partes.join(' | ') || 'Indisponível';
  },

  /**
   * Extrai a frase-chave mais relevante da análise da IA
   */
  _extrairFraseIA: function(textoIA) {
    if (!textoIA || textoIA === '' || textoIA === '-') return '-';
    
    var texto = String(textoIA);
    
    // Tenta extrair primeira frase significativa (até primeiro ponto final ou 120 chars)
    var frases = texto.split(/\.\s*/);
    for (var i = 0; i < frases.length; i++) {
      var f = frases[i].trim();
      if (f.length > 15 && f.length < 200) {
        // Remove scores, RR, números grandes - queremos a conclusão
        if (f.indexOf('Score') === -1 && f.indexOf('R/R') === -1 && f.indexOf('Risco') === -1) {
          return f.charAt(0).toUpperCase() + f.slice(1);
        }
      }
    }
    
    // Fallback: pega os primeiros 150 caracteres
    return texto.substring(0, 150).trim() + (texto.length > 150 ? '...' : '');
  },

  _montarLinhasFinais: function(mapa) {
    const output = [];
    const IDX = this.CONFIG.IDX_ORIGEM;

    mapa.forEach(row => {
      const ticker = row[IDX.TICKER];
      const preco = Number(row[IDX.PRECO]) || 0;
      const setup = String(row[IDX.SETUP] || '');
      const tipoSetup = String(row[IDX.TIPO_SETUP] || '');
      const score = Number(row[IDX.SCORE]) || 0;
      const rr = Number(row[IDX.RR]) || 0;
      const riscoPct = Number(row[IDX.RISCO]) || 0;
      const alerta = String(row[IDX.ALERTA] || '');
      
      // Entrada Sugerida: FIBO se tendência/pullback, senão preço
      const fiboValue = Number(row[IDX.FIBO]) || 0;
      let entrada = preco;
      if ((setup.includes("TENDÊNCIA") || setup.includes("PULLBACK")) && fiboValue > 0) {
        entrada = fiboValue;
      }
      
      const stop = Number(row[IDX.STOP]) || 0;
      const alvo1 = Number(row[IDX.ALVO1]) || 0;
      const alvo2 = Number(row[IDX.ALVO2]) || 0;
      
      // 🔧 DIAGNÓSTICO + RECÁLCULO: Se riscoPct veio 0 mas stop e preco existem, recalcula
      let riscoReal = riscoPct;
      if (riscoReal === 0 && preco > 0 && stop > 0 && stop < preco) {
        riscoReal = parseFloat(((preco - stop) / preco * 100).toFixed(2));
        console.log("   🔧 " + ticker + ": Risco% recalculado " + riscoPct + " → " + riscoReal + "% (preco=" + preco + ", stop=" + stop + ")");
      }
      
      // Análise Técnica resumida
      const rsi = Number(row[IDX.RSI]) || 0;
      const ema21 = Number(row[IDX.EMA21]) || 0;
      const ema50 = Number(row[IDX.EMA50]) || 0;
      const ema200 = Number(row[IDX.EMA200]) || 0;
      const atr = Number(row[IDX.ATR]) || 0;
      const analiseTecnica = this._gerarAnaliseTecnica(rsi, ema21, ema50, ema200, atr, preco);
      
      // Análise IA resumida
      const analiseIA = this._extrairFraseIA(row[IDX.ANALISE_IA]);
      
      // Observações: alerta + motivo
      let observacoes = '';
      if (alerta && alerta !== '-' && alerta !== '') observacoes = alerta;
      const motivo = String(row[IDX.MOTIVO] || '');
      if (motivo && motivo !== '' && motivo !== '-') {
        observacoes = observacoes ? observacoes + ' | ' + motivo : motivo;
      }
      if (observacoes === '') observacoes = '-';
      
      // 🔧 CORREÇÃO v10.2: Novas métricas de "perto do topo"
      const topo50 = Number(row[IDX.TOPO50]) || 0;
      const ganhoRapido = Number(row[IDX.GANHO_RAPIDO]) || 0;
      const distTopo = Number(row[IDX.DIST_TOPO]) || 0;
      
      // Observações: adiciona aviso de "perto do topo"
      if (topo50 > 0 && preco > 0 && topo50 > preco) {
        var distTopoCalc = ((topo50 - preco) / topo50) * 100;
        if (distTopoCalc < 3) {
          var avisoTopo = '⚠️ Preço a ' + distTopoCalc.toFixed(1) + '% do topo recente (R$ ' + topo50.toFixed(2) + ') — risco de pullback';
          observacoes = observacoes === '-' ? avisoTopo : observacoes + ' | ' + avisoTopo;
        }
      }
      if (ganhoRapido > 0.08) {
        var avisoGanho = '📈 Subiu ' + (ganhoRapido * 100).toFixed(1) + '% em 10 sessões — movimento acelerado';
        observacoes = observacoes === '-' ? avisoGanho : observacoes + ' | ' + avisoGanho;
      }
      
      // Recomendação (🔧 v10.2: inclui topo50 e ganhoRapido)
      const recomendacao = this._gerarRecomendacao(score, setup, tipoSetup, alerta, rr, preco, ema21, topo50, ganhoRapido);

      output.push([
        new Date(),       // 0: Data da geração
        ticker,           // 1: Ticker
        preco,            // 2: Preço Atual
        entrada,          // 3: Entrada Sugerida
        stop,             // 4: Stop Loss
        alvo1,            // 5: Alvo 1
        alvo2,            // 6: Alvo 2
        rr,               // 7: R/R
        riscoReal,        // 8: Risco % (CORRIGIDO: recalcula se veio 0)
        recomendacao,     // 9: Recomendação (✅ / ⏳ / ⛔)
        score,            // 10: Score
        setup,            // 11: Setup
        tipoSetup,        // 12: Tipo Setup
        analiseTecnica,   // 13: Análise Técnica resumida
        analiseIA,        // 14: Análise IA resumida
        observacoes       // 15: Observações
      ]);
    });

    // Ordenar: Score Decrescente (coluna 10)
    return output.sort((a, b) => b[10] - a[10]);
  },

  _escreverDestino: function(ss, dados) {
    let sheet = ss.getSheetByName(this.CONFIG.DESTINO);
    
    // Cria aba se não existir
    if (!sheet) {
      sheet = ss.insertSheet(this.CONFIG.DESTINO);
    }

    // Escreve cabeçalho + dados em lote
    const cabecalho = [this.CONFIG.HEADERS_DESTINO];
    const tudo = cabecalho.concat(dados);
    
    // Limpa toda a aba antes
    sheet.clear();
    
    if (tudo.length === 0) return;

    // Escreve tudo de uma vez
    sheet.getRange(1, 1, tudo.length, tudo[0].length).setValues(tudo);
    sheet.setFrozenRows(1);
    
    this._formatarPlanilha(sheet, dados.length);
  },
  
  _limparDestino: function(ss) {
    const sheet = ss.getSheetByName(this.CONFIG.DESTINO);
    if (sheet) {
      sheet.clear();
      this._escreverCabecalho(sheet);
    }
  },
  
  _escreverCabecalho: function(sheet) {
    sheet.getRange(1, 1, 1, this.CONFIG.HEADERS_DESTINO.length)
         .setValues([this.CONFIG.HEADERS_DESTINO])
         .setFontWeight("bold")
         .setBackground("#1a1a2e")
         .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  },

  _formatarPlanilha: function(sheet, numRows) {
    try {
      // Cabeçalho estilizado
      sheet.getRange(1, 1, 1, this.CONFIG.HEADERS_DESTINO.length)
           .setFontWeight("bold")
           .setBackground("#1a1a2e")
           .setFontColor("#ffffff")
           .setHorizontalAlignment("center");
      
      if (numRows <= 0) return;
      
      // Formatação de Moeda (Colunas C=C, D, E, F, G -> Índices 3,4,5,6,7)
      sheet.getRange(2, 3, numRows, 5).setNumberFormat('"R$" #,##0.00');
      
      // Formatação de Risco % (Coluna I -> Índice 9)
      sheet.getRange(2, 9, numRows, 1).setNumberFormat('0.00"%"');
      
      // Formatação de R/R (Coluna H -> Índice 8)
      sheet.getRange(2, 8, numRows, 1).setNumberFormat('0.00');
      
      // Formatação de Score (Coluna K -> Índice 11)
      sheet.getRange(2, 11, numRows, 1).setNumberFormat('0');
      
      // Formatação de Data (Coluna A)
      sheet.getRange(2, 1, numRows, 1).setNumberFormat('dd/MM HH:mm');
      
      // Cores condicionais por recomendação
      for (var i = 0; i < numRows; i++) {
        var linha = i + 2; // linha na planilha
        var rec = sheet.getRange(linha, 10).getValue(); // Coluna J = Recomendação
        var bgColor = '#f8f9fa';
        
        if (rec && rec.indexOf('✅') !== -1) {
          bgColor = '#d4edda'; // Verde claro
        } else if (rec && rec.indexOf('⏳') !== -1) {
          bgColor = '#fff3cd'; // Amarelo claro
        } else if (rec && rec.indexOf('⛔') !== -1) {
          bgColor = '#f8d7da'; // Vermelho claro
        }
        
        sheet.getRange(linha, 1, 1, 16).setBackground(bgColor);
      }
      
      // Alinhamento vertical
      sheet.getRange(2, 1, numRows, 16).setVerticalAlignment("middle");
      
      // Auto-Fit
      try { sheet.autoResizeColumns(1, 16); } catch(e){}
    } catch (e) {
      console.warn("⚠️ Erro na formatação visual: " + e.message);
    }
  }
};

/**
 * GATILHO GLOBAL (Para ser chamado pelo Orquestrador ou Menu)
 */
function PROCESSAR_OPORTUNIDADES_FINAL() {
  OportunidadesProcessor.executar();
}