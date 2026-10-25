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
      'Entrada Sugerida (Fibo/Cotação)', // 3: Preço ideal para entrar — Fibo se executável, senão cotação
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
      'Observações',              // 15: Alerta de segurança + motivo + diagnóstico de zona
      'Força Rel. %',             // 16: 🔧 v13.2 — Força Relativa vs. BOVA11 (21d)
      'Alvo % (Entrada)',         // 17: 🔧 v14.5 — retorno de Alvo 1 a partir da entrada ideal
      'Alvo % (Cotação)'          // 18: 🔧 v14.5 — retorno de Alvo 1 a partir do preço atual
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
      DIST_TOPO: 25,
      // 🔧 v13.2: Força Relativa vs. benchmark (BOVA11) em %
      FORCA_RELATIVA: 26
    },

    // =======================================================================
    // 🔧 v14.7 (A1): LIMIAR DE ADERÊNCIA DA ENTRADA FIBO AO PREÇO.
    // -----------------------------------------------------------------------
    // A "Entrada Sugerida" só pode ser o Fibo quando o preço está NA banda em
    // torno dele (fibo*(1-LIMIAR) <= preço <= fibo*(1+LIMIAR)) — ou seja,
    // quando o gatilho ainda é executável. Se o preço já subiu além disso (já
    // passou do gatilho) OU caiu abaixo da zona, a entrada exibida passa a ser
    // a COTAÇÃO e o Fibo vira referência de pullback nas Observações. Isso
    // elimina as linhas incoerentes do SMTO3 (entrada 16,66 / preço 19,81 /
    // stop 18,52) e do SUZB3 (entrada 43,37 acima do preço 41,99).
    // =======================================================================
    LIMITE_ENTRADA_FIBO: 0.03
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

    // 🔧 v13.2: Lê 27 colunas (inclui Topo50, GanhoRapido%, DistTopo%, Força Rel. %)
    return sheet.getRange(2, 1, lastRow - 1, 27).getValues();
  },

  _consolidarPorTicker: function(dados) {
    const mapa = new Map();
    const IDX = this.CONFIG.IDX_ORIGEM;

    dados.forEach(row => {
      const ticker = String(row[IDX.TICKER] || '').trim().toUpperCase();
      if (!ticker) return;

      const setup = String(row[IDX.SETUP] || '');
      // ✅ FILTRO: Remove reprovados, risco alto, stop inviável, sem dados, descartar, erro
      // 🔧 v12.8: inclui STOP INVIÁVEL (geometria de compra inválida — stop acima do preço)
      if (setup.indexOf("REPROVADO") !== -1 || setup.indexOf("RISCO ALTO") !== -1 ||
          setup.indexOf("STOP INVIÁVEL") !== -1 ||
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
   * Gera a "Recomendação" SEMPRE respeitando o comando do Setup.
   * 🔧 v11: Reparo vínculo entre as colunas Setup e Recomendação — não existe mais
   * o caso "Setup=RADAR/AGUARDAR" com "Recomendação=✅ ENTRAR" (ex: POMO4).
   * A decisão final passa a derivar do tipo de setup do analisador técnico.
   * @param {number} score          Score consolidado (técnico + IA)
   * @param {string} setup          Setup (22_Core_Analyzers)
   * @param {string} tipoSetup      PULLBACK/TENDÊNCIA/MOMENTUM/ROMPIMENTO/REVERSÃO
   * @param {string} alerta         🚨/⏳/✅
   * @param {number} rr             R/R
   * @param {number} preco          Preço atual
   * @param {number} ema21          EMA21
   * @param {number} topo50         H50
   * @param {number} ganhoRapido    Ganho 10 sessões
   * @param {number} entradaSugerida Zona de entrada (FIBO)
   * @param {Object} [geo] Geometria consolidada (28_Position_Geometry)
   * @param {boolean} [stopAcimaDaEntrada] Stop >= entrada Fibo (geometria inviável na entrada)
   * @param {number|string} [forcaRel] Força Relativa vs. BOVA11 (%), ou '' se ausente
   */
  _gerarRecomendacao: function(score, setup, tipoSetup, alerta, rr, preco, ema21, topo50, ganhoRapido, entradaSugerida, geo, stopAcimaDaEntrada, forcaRel) {
    setup = String(setup || '');
    alerta = String(alerta || '');

    // 1) Alertas de segurança têm precedência absoluta
    if (alerta.indexOf('🚨') !== -1) return '⛔ NÃO ENTRAR (FALSO ROMPIMENTO)';
    if (alerta.indexOf('⏳') !== -1) return '⏳ AGUARDAR (PRÉ-ROMPIMENTO)';

    // 1.1) 🔧 CORREÇÃO v14.6 (B1): STOP ACIMA DA ENTRADA FIBO.
    // Se o stop está acima do gatilho Fibo, entrar na entrada ideal garante
    // perda — a geometria só é válida entrando na cotação. Como a coluna
    // "Entrada Sugerida" aponta o Fibo, rebaixamos para observação explícita.
    if (stopAcimaDaEntrada) {
      return '⏳ AGUARDAR (STOP ACIMA DA ENTRADA FIBO — ENTRAR SÓ NA COTAÇÃO)';
    }

    // 2) v10.2: Preço colado no topo recente (H50)
    if (topo50 > 0 && preco > 0 && topo50 > preco) {
      var distTopoCalc = (topo50 - preco) / topo50;
      if (distTopoCalc < 0.01) {
        return '⏳ AGUARDAR PULLBACK (PREÇO NO TOPO RECENTE)';
      }
      if (distTopoCalc < 0.03 && !this._setupExigeAguardar(setup)) {
        return '🟡 ENTRAR 50% AGORA + AGUARDAR PULLBACK (PREÇO A ' + (distTopoCalc * 100).toFixed(1) + '% DO TOPO)';
      }
    }

    // 3) v10.2: Ganho rápido acumulado
    if (ganhoRapido > 0.08) {
      return '⏳ AGUARDAR PULLBACK (GANHO RÁPIDO +' + (ganhoRapido * 100).toFixed(1) + '% EM 10 SESSÕES)';
    }

    // 4) v10.1: Preço esticado acima da EMA21
    if (preco > 0 && ema21 > 0 && preco > ema21) {
      var extPctCalc = (preco - ema21) / ema21;
      if (extPctCalc > 0.10) {
        return '⏳ AGUARDAR PULLBACK (PREÇO +' + (extPctCalc * 100).toFixed(0) + '% ACIMA DA MÉDIA — ESTICADO)';
      }
      if (extPctCalc > 0.07 && !this._setupPermiteEntradaDireta(setup)) {
        return '🟡 ENTRAR 50% AGORA + AGUARDAR PULLBACK (PREÇO +' + (extPctCalc * 100).toFixed(0) + '% ACIMA DA MÉDIA)';
      }
    }

    // 5) v11: Setup RADAR/AGUARDAR é VINCULANTE → jamais ENTRAR
    if (this._setupExigeAguardar(setup)) {
      return this._diretivaRadar(setup, score);
    }

    // 6) v11: Pullback só entra se preço já estiver NA zona de entrada
    if (preco > 0 && entradaSugerida > 0 &&
        preco > entradaSugerida * 1.015 &&
        this._setupMencionaPullback(setup)) {
      return '⏳ AGUARDAR PULLBACK ATÉ R$ ' + entradaSugerida.toFixed(2) +
             ' (PREÇO ' + preco.toFixed(2) + ' ACIMA DA ZONA)';
    }

    // 6.1) 🔧 v14.5: VETO de geometria — preço FORA da zona de compra com
    //      R/R REAL insuficiente. Antes, o R/R exibido vinha da base da entrada
    //      ideal (Fibo) e permanecia "bonito" mesmo com o preço já 20% acima do
    //      gatilho — o caso BPAC11. Aqui aplicamos o R/R medido contra a
    //      cotação atual (a base em que o usuário realmente executa).
    if (geo) {
      if (geo.stopInvalido) {
        return '⛔ NÃO ENTRAR (STOP ACIMA DO PREÇO)';
      }
      if (geo.riscoExcessivo) {
        return '⛔ NÃO ENTRAR (RISCO ' + (geo.riscoPct * 100).toFixed(1) + '% — STOP MUITO LONGE)';
      }
      if (geo.entradaAtrasada &&
          !geo.dentroDaZona &&
          geo.rr < PositionGeometry.CFG.RR_MINIMO_FORA_ZONA) {
        return '⛔ NÃO ENTRAR (FORA DA ZONA + R/R REAL ' + geo.rr.toFixed(2) + ')';
      }
      // Preço esticado mas R/R real ainda aceitável: entra em 50% e aguarda
      if (geo.entradaAtrasada && geo.rr >= PositionGeometry.CFG.RR_MINIMO_FORA_ZONA) {
        if (!this._setupMencionaEntradaDireta(setup)) {
          return '🟡 ENTRAR 50% + AGUARDAR PULLBACK (PREÇO +' +
                 (geo.atrasoPct * 100).toFixed(1) + '% DA ZONA · R/R REAL ' +
                 geo.rr.toFixed(2) + ')';
        }
      }
    }

    // 7) Mínimos de score/R-R e veto de reversão.
    //    O piso de R/R é DERIVADO do setup: SWING/TENDÊNCIA FORTE aceitam rr>=1.8
    //    (idêntico ao 22_Core_Analyzers) já TENDÊNCIA CONFIRMADA/SWING IDEAL exigem >=2.0.
    if (score < 30) return '⛔ NÃO ENTRAR (SCORE BAIXO)';
    if (score < 60) return '⏳ AGUARDAR (SCORE MODERADO)';
    const rrMin = this._rrMinimoDoSetup(setup);
    if (rr > 0 && rr < rrMin) return '⏳ AGUARDAR (R/R < ' + rrMin + ')';
    if (tipoSetup && tipoSetup.indexOf('REVERSÃO') !== -1) return '⏳ AGUARDAR (REVERSÃO NÃO CONFIRMADA)';

    // 7.1) 🔧 CORREÇÃO v14.6 (B3): FORÇA RELATIVA NEGATIVA vs. BOVA11.
    // A coluna Força Rel. % era coletada mas não decidia nada. Ativo que perde
    // significativamente do índice tende a continuar fraco (entrar é "comprar
    // o que caiu" sem confirmação). Aqui usamos o dado para rebaixar a entrada
    // direta a observação quando a ação está bem abaixo do benchmark.
    var forcaRelNum = (forcaRel === '' || forcaRel === null || forcaRel === undefined)
      ? null : Number(forcaRel);
    var forcaRelFraca = (forcaRelNum !== null && isFinite(forcaRelNum) && forcaRelNum <= -5.0);

    // 8) v11: Entrada direta só para setups que autorizam compra imediata
    if (this._setupMencionaEntradaDireta(setup)) {
      if (forcaRelFraca) {
        return '🔭 ENTRAR SÓ COM FORÇA REL. (FRACO vs BOVA11 ' + forcaRelNum.toFixed(1) + '%)';
      }
      return '✅ ENTRAR (' + this._nomeCurtoEntrada(setup) + ')';
    }
    // SWING PULLBACK FIBO totalmente na zona Fibo
    if (setup.indexOf('SWING PULLBACK FIBO') !== -1 &&
        entradaSugerida > 0 && preco > 0 && preco <= entradaSugerida * 1.015) {
      if (forcaRelFraca) {
        return '🔭 ENTRAR SÓ COM FORÇA REL. (FRACO vs BOVA11 ' + forcaRelNum.toFixed(1) + '%)';
      }
      return '✅ ENTRAR AGORA (NA ZONA FIBO)';
    }

    // 9) Fallback conservador
    return setup ? '🔭 AGUARDAR CONFIRMAÇÃO' : '⏳ AGUARDAR';
  },

  /**
   * Indica se o Setup manda aguardar (RADAR/AGUARDAR/descartes compatíveis).
   * Aqui os rótulos são VINCULANTES: se retornar true, a recomendação jamais vira ENTRAR.
   */
  _setupExigeAguardar: function(setup) {
    setup = String(setup || '');
    if (!setup) return false;
    return setup.indexOf('RADAR') !== -1 ||
           setup.indexOf('AGUARDAR') !== -1 ||
           setup.indexOf('SCORE BAIXO') !== -1 ||
           setup.indexOf('RISCO ALTO') !== -1 ||
           setup.indexOf('STOP INVIÁVEL') !== -1 ||
           setup.indexOf('REPROVADO') !== -1 ||
           setup.indexOf('VETADO') !== -1;
  },

  /** Traduz um Setup RADAR/AGUARDAR para uma recomendação coerente de observação. */
  _diretivaRadar: function(setup, score) {
    setup = String(setup || '');
    if (setup.indexOf('RADAR PULLBACK') !== -1) {
      return score > 70
        ? '🔭 RADAR PULLBACK (ALTA CONVICÇÃO - AGUARDAR CONFIRMAÇÃO)'
        : '🔭 RADAR PULLBACK (AGUARDAR CONFIRMAÇÃO)';
    }
    if (setup.indexOf('RADAR TENDÊNCIA') !== -1) {
      return '🔭 RADAR TENDÊNCIA (AGUARDAR VOLUME + ADX)';
    }
    var rotulo = setup.split('(')[0].replace(/[🔭⏳⏸🛑⛔✅]/g, '').trim();
    return rotulo ? '🔭 AGUARDAR (' + rotulo + ')' : '🔭 AGUARDAR';
  },

  /** O Setup menciona pullback/Fibo? (exige preço já na zona de entrada) */
  _setupMencionaPullback: function(setup) {
    setup = String(setup || '');
    return setup.indexOf('PULLBACK') !== -1 || setup.indexOf('FIBO') !== -1;
  },

  /** Setups que autorizam compra imediata (entrada direta AGORA). */
  _setupMencionaEntradaDireta: function(setup) {
    setup = String(setup || '');
    return setup.indexOf('SWING IDEAL') !== -1 ||
           setup.indexOf('MOMENTUM FORTE') !== -1 ||
           setup.indexOf('TENDÊNCIA CONFIRMADA') !== -1 ||
           setup.indexOf('TENDÊNCIA FORTE') !== -1 ||
           setup.indexOf('ROMPIMENTO') !== -1;
  },

  /** Alias semântico (facilita leitura nas checagens de extensão). */
  _setupPermiteEntradaDireta: function(setup) {
    return this._setupMencionaEntradaDireta(setup);
  },

  /** Nome curto exibido entre parênteses na recomendação de entrada. */
  _nomeCurtoEntrada: function(setup) {
    setup = String(setup || '');
    if (setup.indexOf('SWING IDEAL') !== -1) return 'FIBO + TENDÊNCIA';
    if (setup.indexOf('MOMENTUM FORTE') !== -1) return 'ROMPIMENTO';
    if (setup.indexOf('TENDÊNCIA FORTE') !== -1) return 'TENDÊNCIA FORTE';
    if (setup.indexOf('ROMPIMENTO') !== -1) return 'ROMPIMENTO';
    return 'TENDÊNCIA CONFIRMADA';
  },

  /** Piso de R/R aceitável para o Setup (espelha os thresholds do 22_Core_Analyzers). */
  _rrMinimoDoSetup: function(setup) {
    setup = String(setup || '');
    if (setup.indexOf('SWING IDEAL') !== -1) return 2.0;
    if (setup.indexOf('SWING PULLBACK FIBO') !== -1) return 1.8;
    if (setup.indexOf('MOMENTUM FORTE') !== -1) return 2.0;
    if (setup.indexOf('TENDÊNCIA CONFIRMADA') !== -1) return 2.0;
    if (setup.indexOf('TENDÊNCIA FORTE') !== -1) return 1.8;
    if (setup.indexOf('RADAR PULLBACK') !== -1) return 1.8;
    if (setup.indexOf('RADAR TENDÊNCIA') !== -1) return 2.0;
    return 2.0; // conservador para rótulos genéricos
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
    // 🔧 CORREÇÃO v14.6: o split anterior (/\.\s*/) quebrava em PONTOS DECIMAIS
    // ("1.01", "1.97"), fazendo a frase exibida começar no MEIO (RADL3 = "01 com
    // ADX em 20"; KLBN11 = "97 e volume relativo elevado (1"). Agora só tratamos
    // como fim de frase o ponto NÃO precedido por dígito (ponto final real),
    // seguido de espaço/fim — preservando os decimais.
    var frases = texto.split(/(?<!\d)\.(?=\s|$)/);
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
      let fiboUsadoComoEntrada = false;
      let fiboVirouReferencia = false;

      // =====================================================================
      // 🔧 v14.7 (A1): ENTRADA FIBO SÓ SE O GATILHO AINDA FOR EXECUTÁVEL.
      // ---------------------------------------------------------------------
      // Antes, o Fibo virava "Entrada Sugerida" sempre que o setup era
      // TENDÊNCIA/PULLBACK — mesmo com o preço já 20% acima do gatilho. O
      // stop (ancorado no PREÇO pelo 22_Core_Analyzers) ficava então ACIMA da
      // entrada exibida (caso SMTO3: preço 19,81 / entrada 16,66 / stop 18,52).
      // Regra nova: o Fibo só é a entrada quando o preço está NA banda em torno
      // dele (nem acima, já passou do gatilho; nem abaixo, o ativo caiu além da
      // zona e a entrada ficaria ACIMA da cotação). Fora disso, a entrada
      // exibida passa a ser a COTAÇÃO (execução hoje) e o Fibo é citado como
      // referência de pullback nas Observações.
      // =====================================================================
      const limiteFibo = (this.CONFIG.LIMITE_ENTRADA_FIBO !== undefined)
        ? this.CONFIG.LIMITE_ENTRADA_FIBO : 0.03;
      const setupPullback = (setup.includes("TENDÊNCIA") || setup.includes("PULLBACK"));
      // Gatilho Fibo só é executável quando o preço está NA banda em torno dele
      // (nem muito acima — já passou do gatilho — nem muito abaixo — o ativo
      // caiu além da zona e a entrada ficaria ACIMA da cotação, irreal).
      const fiboExecutavel = (fiboValue > 0) &&
        (preco >= fiboValue * (1 - limiteFibo)) &&
        (preco <= fiboValue * (1 + limiteFibo));

      if (setupPullback && fiboValue > 0) {
        if (fiboExecutavel) {
          entrada = fiboValue;
          fiboUsadoComoEntrada = true;
        } else {
          // Preço fora da banda do Fibo (acima do gatilho ou abaixo da zona):
          // executa na cotação; o Fibo vira referência de pullback.
          entrada = preco;
          fiboVirouReferencia = true;
        }
      }
      
      const stop = Number(row[IDX.STOP]) || 0;
      const alvo1 = Number(row[IDX.ALVO1]) || 0;
      const alvo2 = Number(row[IDX.ALVO2]) || 0;

      // =====================================================================
      // 🔧 CORREÇÃO v14.7 (B): VETO DE GEOMETRIA INVIÁVEL (STOP >= ENTRADA).
      // ---------------------------------------------------------------------
      // Defesa final: se por qualquer motivo o stop ficar ACIMA (ou igual) à
      // entrada exibida, ela não pode ser o Fibo. Forçamos entrada = cotação,
      // que sempre mantém stop < preço (< entrada). Sem isso, quem seguisse o
      // gatilho Fibo pagaria acima do stop → perda garantida.
      // =====================================================================
      let stopAcimaDaEntrada = (stop > 0 && entrada > 0 && stop >= entrada);
      if (stopAcimaDaEntrada && entrada !== preco) {
        entrada = preco;
        fiboUsadoComoEntrada = false;
        fiboVirouReferencia = (fiboValue > 0);
        stopAcimaDaEntrada = (stop > 0 && entrada > 0 && stop >= entrada);
      }

      // =====================================================================
      // 🔧 v14.5: GEOMETRIA CENTRALIZADA (28_Position_Geometry)
      // ---------------------------------------------------------------------
      // Antes: `riscoReal` era medido contra o PREÇO ATUAL enquanto `rr` vinha
      // do analisador medido contra a ENTRADA (Fibo). Duas bases diferentes no
      // mesmo registro geravam a "Tríade BPAC11" (risco, R/R e alvo
      // mutuamente incoerentes). Agora risco, R/R e alvo% compartilham a
      // MESMA base — o preço de execução — e a zona de compra é calculada.
      // =====================================================================
      const geo = (typeof PositionGeometry !== 'undefined')
        ? PositionGeometry.calcular({
            precoAtual: preco,
            entradaIdeal: entrada,
            stop: stop,
            alvo1: alvo1,
            alvo2: alvo2
          })
        : null;

      // Risco % e R/R coerentes (fallback defensivo se o módulo não estiver carregado)
      const riscoReal = geo ? geo.riscoPct * 100 : riscoPct;
      const rrCoerente = geo ? geo.rr : rr;
      const alvo1PctEntrada = geo ? geo.alvo1PctEntrada : 0;
      const alvo1PctAtual = geo ? geo.alvo1PctAtual : 0;

      // 🔧 v14.7: `stopAcimaDaEntrada` foi calculado no bloco (B) acima e já foi
      // usado para corrigir a entrada. Revalidamos aqui como defesa final (caso
      // o bloco B tenha sido pulado por `entrada === preco` na primeira passada).
      stopAcimaDaEntrada = (stop > 0 && entrada > 0 && stop >= entrada);
      
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

      // 🔧 v13.2: Força Relativa vs. BOVA11 (%) — preserva vazio quando ausente.
      const forcaRelRaw = (row[IDX.FORCA_RELATIVA] !== '' && row[IDX.FORCA_RELATIVA] !== undefined && row[IDX.FORCA_RELATIVA] !== null)
        ? Number(row[IDX.FORCA_RELATIVA]) : null;
      const forcaRel = (forcaRelRaw !== null && isFinite(forcaRelRaw)) ? forcaRelRaw : '';
      
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

      // 🔧 v14.5: Diagnóstico de ZONA DE COMPRA + coerência risco/R-R/alvo.
      // É aqui que a "Tríade BPAC11" fica visível para o usuário: se o preço
      // já passou da zona, o texto informa o retorno REAL (a partir da cotação).
      if (geo && geo.diagnostico) {
        var avisoGeo = (typeof PositionGeometry !== 'undefined')
          ? PositionGeometry.textoObservacao(geo)
          : geo.diagnostico;
        observacoes = observacoes === '-' ? avisoGeo : observacoes + ' | ' + avisoGeo;
      }

      // 🔧 v14.7 (A1): o gatilho Fibo não é executável hoje (preço fora da
      // banda) — a entrada exibida é a COTAÇÃO e o Fibo fica como referência.
      if (fiboVirouReferencia && fiboValue > 0 && preco > 0) {
        var distFiboPct = ((preco - fiboValue) / fiboValue) * 100;
        var relFibo = (distFiboPct >= 0)
          ? distFiboPct.toFixed(1) + '% acima'
          : Math.abs(distFiboPct).toFixed(1) + '% abaixo';
        var avisoFibo = '🔭 Entrada = cotação (R$ ' + preco.toFixed(2) + '); preço ' +
          relFibo + ' do gatilho Fibo (R$ ' + fiboValue.toFixed(2) +
          ') — gatilho não executável hoje (referência de pullback)';
        observacoes = observacoes === '-' ? avisoFibo : observacoes + ' | ' + avisoFibo;
      }

      // 🔧 v14.7 (B): defesa final — se ainda restar stop ACIMA (ou igual) à
      // entrada, a linha é geometricamente inviável e é sinalizada como tal.
      if (stopAcimaDaEntrada) {
        var avisoStop = '⛔ STOP (R$ ' + stop.toFixed(2) + ') ACIMA DA ENTRADA (R$ ' +
          entrada.toFixed(2) + ') — geometria inviável; não entrar nesta linha.';
        observacoes = observacoes === '-' ? avisoStop : observacoes + ' | ' + avisoStop;
      }

      // 🔧 v14.7 (A1): quando o Fibo É a entrada (gatilho ainda executável),
      // confirma explicitamente na observação para o usuário não confundir os
      // dois cenários (entrada Fibo vs entrada na cotação).
      if (fiboUsadoComoEntrada && fiboValue > 0) {
        var avisoEntradaFibo = '🎯 Entrada = gatilho Fibo (R$ ' + fiboValue.toFixed(2) +
          ') — preço na zona executável.';
        observacoes = observacoes === '-' ? avisoEntradaFibo : observacoes + ' | ' + avisoEntradaFibo;
      }

      // Recomendação (🔧 v10.2: inclui topo50 e ganhoRapido; 🔧 v11: inclui entradaSugerida
      // para garantir consistência com o Setup e com a zona de entrada).
      // 🔧 v14.5: recebe a geometria completa (zona + R/R real) para poder vetar
      // entradas fora da zona cujo R/R real já não compensa.
      const recomendacao = this._gerarRecomendacao(
        score, setup, tipoSetup, alerta, rrCoerente, preco, ema21, topo50,
        ganhoRapido, entrada, geo, stopAcimaDaEntrada, forcaRel
      );

      output.push([
        new Date(),       // 0: Data da geração
        ticker,           // 1: Ticker
        preco,            // 2: Preço Atual
        entrada,          // 3: Entrada Sugerida
        stop,             // 4: Stop Loss
        alvo1,            // 5: Alvo 1
        alvo2,            // 6: Alvo 2
        rrCoerente,       // 7: R/R (🔧 v14.5: mesma base do risco)
        riscoReal,        // 8: Risco % (🔧 v14.5: mesma base do R/R)
        recomendacao,     // 9: Recomendação (✅ / ⏳ / ⛔)
        score,            // 10: Score
        setup,            // 11: Setup
        tipoSetup,        // 12: Tipo Setup
        analiseTecnica,   // 13: Análise Técnica resumida
        analiseIA,        // 14: Análise IA resumida
        observacoes,      // 15: Observações + diagnóstico de zona
        forcaRel,         // 16: Força Rel. % (vs. BOVA11) — 🔧 v13.2
        alvo1PctEntrada,  // 17: Alvo % (Entrada) — 🔧 v14.5
        alvo1PctAtual     // 18: Alvo % (Cotação) — 🔧 v14.5
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

    // Escreve tudo de uma vez (dados + cabeçalho), sem formatação automática
    sheet.getRange(1, 1, tudo.length, tudo[0].length).setValues(tudo);
  },
  
  _limparDestino: function(ss) {
    const sheet = ss.getSheetByName(this.CONFIG.DESTINO);
    if (sheet) {
      sheet.clear();
      this._escreverCabecalho(sheet);
    }
  },
  
  _escreverCabecalho: function(sheet) {
    // 🔧 v14.4: Apenas dados (cabeçalhos), sem formatação automática.
    sheet.getRange(1, 1, 1, this.CONFIG.HEADERS_DESTINO.length)
         .setValues([this.CONFIG.HEADERS_DESTINO]);
  },

  // 🔧 v14.4: Formatação automática desativada — o usuário cuida da formatação manualmente.
  _formatarPlanilha: function(sheet, numRows) {
    // Intencionalmente vazio. A formatação fica por conta do usuário.
  }
};

/**
 * GATILHO GLOBAL (Para ser chamado pelo Orquestrador ou Menu)
 */
function PROCESSAR_OPORTUNIDADES_FINAL() {
  OportunidadesProcessor.executar();
}