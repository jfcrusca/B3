/**
 * @file 41_Ranker.js
 * @description Módulo de ranqueamento e gestão de carteira recomendada (Smart Hold).
 * ✅ v5: Lê da aba "Oportunidades" (única para o usuário) em vez de "Resultados_Analise".
 * ✅ Mapeamento de colunas sincronizado com 29_Oportunidades_Processor v5 (16 colunas).
 * ✅ INTEGRADO: Position Sizing baseado no Risco por Trade (2%).
 * 🔧 v12.8: (a) descarta trades com stop >= preço (geometria inválida para compra);
 *           (b) Position Sizing SEM Math.abs; (c) teto por trade (25%) e teto
 *           AGREGADO da carteira teórica (95%) para não ultrapassar o capital.
 *           Configurável via RANKER_MAX_TRADE_ALLOCATION / RANKER_MAX_TOTAL_ALLOCATION.
 * 🔧 v15.0 (Bug 4): o teto agregado deixou de ser um "guloso cego": o capital é
 *           DISTRIBUÍDO proporcionalmente ao score (peso = score − 50) entre
 *           TODOS os elegíveis, em vez de atender a fila por ordem e descartar
 *           o resto. Cada trade respeita o teto de 25%, e quem ficar abaixo do
 *           piso de utilidade (RANKER_MIN_LOTE_VALUE) é descartado com motivo
 *           explícito, devolvendo o capital ao pote.
 * 🔧 v15.1: o `qtd` do Position Sizing é TETO de risco (nunca é aumentado).
 *           O score só ordena a fila quando o capital não cobre todos; se
 *           cobrir, cada trade recebe exatamente o tamanho do seu risco.
 *           Desligável via RANKER_ALOCACAO_POR_SCORE.
 */

function PROCESSAR_CARTEIRA_FINAL() {
  var ss = SpreadsheetApp.getActive();
  var origem = ss.getSheetByName("Oportunidades");

  if (!origem || origem.getLastRow() < 2) {
    console.warn("⚠️ Aba 'Oportunidades' vazia ou inexistente. Ranker não executado.");
    try {
      var resumo = ss.getSheetByName("Resumo_Trades_Aprovados");
      if (resumo && resumo.getLastRow() > 6) {
        resumo.getRange(7, 1, Math.max(0, resumo.getLastRow() - 6), resumo.getLastColumn()).clearContent().clearFormat();
      }
    } catch (e) {
      console.warn('Não foi possível limpar Resumo_Trades_Aprovados: ' + e.message);
    }
    return 0;
  }

  // =========================================================================
  // 1. MAPA DE SETORES (Centralizado)
  // =========================================================================
  var SECTOR_MAP = {
    'VALE3':'Mineração', 'PETR4':'Energia', 'PETR3':'Energia', 'PRIO3':'Energia',
    'ITUB4':'Bancos', 'BBAS3':'Bancos', 'BBDC4':'Bancos', 'BPAC11':'Bancos',
    'RENT3':'Locação', 'WEGE3':'Industrial', 'SBSP3':'Saneamento', 'VIVT3':'Telecom',
    'GGBR4':'Siderurgia', 'CSNA3':'Siderurgia', 'ABEV3':'Consumo', 'HYPE3':'Saúde',
    'JBSS32':'Alimentos', 'B3SA3':'Financeiro', 'AXIA3':'Elétrica', 'CPLE3':'Elétrica', 'RAIL3':'Logística',
    'SUZB3':'Papel e Celulose', 'VBBR3':'Energia', 'RDOR3':'Saúde', 'EQTL3':'Elétrica',
    'RADL3':'Saúde', 'LREN3':'Varejo', 'MGLU3':'Varejo'
  };

  // =========================================================================
  // 2. MAPEAMENTO DE COLUNAS (Aba Oportunidades v7 — 19 colunas)
  // =========================================================================
  var COL = {
    DATA: 0, TICKER: 1, PRECO: 2, ENTRADA: 3, STOP: 4,
    ALVO1: 5, ALVO2: 6, RR: 7, RISCO: 8, RECOMENDACAO: 9,
    SCORE: 10, SETUP: 11, TIPO_SETUP: 12, ANALISE_TEC: 13, ANALISE_IA: 14, OBS: 15,
    FORCA_RELATIVA: 16,          // 🔧 v13.2
    ALVO_PCT_ENTRADA: 17,        // 🔧 v14.5
    ALVO_PCT_COTACAO: 18         // 🔧 v14.5
  };

  // 🔧 v14.5: lê 19 colunas (17 originais + Alvo % Entrada + Alvo % Cotação).
  // Se a aba ainda tiver apenas 17 colunas (layout antigo), cai para 17 e o
  // Position Sizing continua funcionando — apenas as colunas novas ficam vazias.
  var nCols = Math.max(17, Math.min(19, origem.getLastColumn()));
  var data = origem.getRange(2, 1, origem.getLastRow() - 1, nCols).getValues();
  if (nCols < 19) {
    console.log('ℹ️ [Ranker] Aba Oportunidades com ' + nCols +
      ' colunas (layout antigo). Rode o Scanner para gerar as colunas "Alvo %".');
  }

  var CFG = {
    RESUMO_SHEET: "Resumo_Trades_Aprovados",
    RISK_LEVEL: 0.02  // 2% de risco por operação
  };
  function _cfg(key, fallback) {
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function') ? CONFIG.get(key, fallback) : fallback;
  }
  CFG.RESUMO_SHEET = _cfg('RANKER_RESUMO_SHEET', CFG.RESUMO_SHEET);
  CFG.RISK_LEVEL = Number(_cfg('RANKER_RISK_LEVEL', _cfg('RISCO_POR_TRADE', CFG.RISK_LEVEL)));
  // 🔧 v12.8: tetos de alocação (por trade e agregado da carteira teórica)
  CFG.MAX_TRADE_ALLOCATION = Number(_cfg('RANKER_MAX_TRADE_ALLOCATION', 0.25));
  CFG.MAX_TOTAL_ALLOCATION = Number(_cfg('RANKER_MAX_TOTAL_ALLOCATION', 0.95));
  if (!(CFG.MAX_TRADE_ALLOCATION > 0 && CFG.MAX_TRADE_ALLOCATION <= 1)) CFG.MAX_TRADE_ALLOCATION = 0.25;
  if (!(CFG.MAX_TOTAL_ALLOCATION > 0 && CFG.MAX_TOTAL_ALLOCATION <= 1)) CFG.MAX_TOTAL_ALLOCATION = 0.95;
  // 🔧 v15.0: piso de utilidade do lote (absoluto, em R$)
  CFG.MIN_LOTE_VALUE = Number(_cfg('RANKER_MIN_LOTE_VALUE', 500));
  if (!(CFG.MIN_LOTE_VALUE > 0)) CFG.MIN_LOTE_VALUE = 500;
  // 🔧 v15.1: modo de distribuição do capital entre os trades
  //   true  = score decide a fila quando o capital não cobre todos (padrão)
  //   false = cada trade recebe o tamanho do próprio risco, nada mais
  CFG.ALOCACAO_POR_SCORE = (_cfg('RANKER_ALOCACAO_POR_SCORE', true) !== false);

  // =========================================================================
  // 3. CAPITAL TOTAL
  // =========================================================================
  var capital = 100000;
  try {
    var capitalVal = _cfg("CAPITAL_TOTAL", 100000);
    capital = parseFloat(capitalVal) || 100000;
  } catch(e) {
    console.warn("Usando capital padrão: R$ 100.000");
  }

  // =========================================================================
  // 4. ORDENAÇÃO POR SCORE (Decrescente)
  // =========================================================================
  data.sort(function(a, b) {
    return (Number(b[COL.SCORE]) || 0) - (Number(a[COL.SCORE]) || 0);
  });

  // =========================================================================
  // 5. PROCESSAR TRADES (dados já filtrados pela aba Oportunidades)
  // =========================================================================
  var trades = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var ticker = String(r[COL.TICKER] || "").trim().toUpperCase();
    if (!ticker) continue;

    var recomendacao = String(r[COL.RECOMENDACAO] || "");
    // Só processa trades com recomendação positiva ou em observação
    if (recomendacao.indexOf('⛔') !== -1) continue;

    var preco = Number(r[COL.PRECO]) || 0;
    var score = Number(r[COL.SCORE]) || 0;
    var stop = Number(r[COL.STOP]) || 0;
    var entrada = Number(r[COL.ENTRADA]) || preco;
    var alvo1 = Number(r[COL.ALVO1]) || 0;
    var alvo2 = Number(r[COL.ALVO2]) || 0;

    // 🔧 CORREÇÃO v12.8: descarta trades com geometria inválida para COMPRA
    // (stop >= preço). Um Math.abs(preco - stop) mascararia a inversão e
    // calcularia um position size errado (caso AXIA3: stop 57,19 > preço 54,80).
    if (preco <= 0 || stop <= 0 || stop >= preco) {
      console.warn("⚠️ [Ranker] " + ticker + ": geometria inválida para compra (stop=" + stop +
        " >= preco=" + preco + ") — trade descartado.");
      continue;
    }

    // =====================================================================
    // 🔧 v14.5: GEOMETRIA CENTRALIZADA (28_Position_Geometry)
    // ---------------------------------------------------------------------
    // Antes: `distStop = preco - stop` era usado no sizing, mas o campo `rr`
    // exibido vinha do analisador (medido contra a ENTRADA Fibo). Duas bases
    // diferentes → tamanho da posição incoerente com o R/R anunciado.
    // Agora risco, R/R e quantidade compartilham a MESMA base (preço atual).
    // =====================================================================
    var geo = (typeof PositionGeometry !== 'undefined')
      ? PositionGeometry.calcular({
          precoAtual: preco,
          entradaIdeal: entrada,
          stop: stop,
          alvo1: alvo1,
          alvo2: alvo2
        })
      : null;

    // Position Sizing coerente (mesma base do risco exibido)
    var distStop = preco - stop; // stop sempre abaixo do preço (validado acima)
    var qtd = 0;
    var riscoRsDaPosicao = 0;
    if (typeof PositionGeometry !== 'undefined') {
      var dim = PositionGeometry.dimensionar({
        capital: capital,
        riscoPctAlvo: CFG.RISK_LEVEL,
        precoReferencia: preco,
        stop: stop,
        maxTradeAlloc: CFG.MAX_TRADE_ALLOCATION,
        maxTotalAlloc: CFG.MAX_TOTAL_ALLOCATION
      });
      qtd = dim.quantidade;
      riscoRsDaPosicao = dim.riscoRS;
    } else if (distStop > 0 && preco > 0) {
      qtd = Math.floor((capital * CFG.RISK_LEVEL) / distStop);
      var maxQtdTrade = Math.floor((capital * CFG.MAX_TRADE_ALLOCATION) / preco);
      if (qtd > maxQtdTrade) qtd = maxQtdTrade;
      riscoRsDaPosicao = qtd * distStop;
    }

    // STATUS baseado na recomendação + score
    var status = recomendacao.indexOf('✅') !== -1 ? '🚀 COMPRAR' : '🔭 RADAR';

    var setup = String(r[COL.SETUP] || "");
    var estrategia = String(r[COL.TIPO_SETUP] || "");

    // 🔧 v14.5: avisa quando a entrada ideal já foi ultrapassada — o usuário
    // precisa saber que o R/R anunciado é da geometria, não da execução dele.
    if (geo && geo.entradaAtrasada) {
      console.log("   ⚠️ [Ranker] " + ticker + ": preço +" +
        (geo.atrasoPct * 100).toFixed(1) + "% acima da zona de compra. R/R real " +
        geo.rr.toFixed(2) + " (geometria " + geo.rrAnalisador.toFixed(2) + ").");
    }

    trades.push({
      status: status,
      ticker: ticker,
      preco: preco,
      fibo: entrada,          // "Entrada Sugerida" faz o papel do FIBO
      stop: stop,
      alvo: alvo1,
      qtd: qtd,
      alocacao: capital > 0 ? (qtd * preco) / capital : 0,
      // 🔧 v14.5: R/R coerente (mesma base do risco) + R/R da geometria original
      rr: geo ? geo.rr : (Number(r[COL.RR]) || 0),
      rrGeometria: geo ? geo.rrAnalisador : (Number(r[COL.RR]) || 0),
      riscoRs: riscoRsDaPosicao,
      zonaCompra: geo ? geo.zonaCompra : null,
      dentroDaZona: geo ? geo.dentroDaZona : null,
      atrasoPct: geo ? geo.atrasoPct : 0,
      alvo1PctAtual: geo ? geo.alvo1PctAtual : 0,
      alvo2PctAtual: geo ? geo.alvo2PctAtual : 0,
      score: score,
      setup: setup,
      setor: SECTOR_MAP[ticker] || "Outros",
      estrategia: estrategia
    });

  }

  // Filtrar apenas trades com score >= 50 que foram APROVADOS (STATUS COMPRAR ou RADAR)
  trades = trades.filter(function(t) { 
    return t.score >= 50 && (t.status === "🚀 COMPRAR" || t.status === "🔭 RADAR"); 
  });

  // =========================================================================
  // 5.1 v15.1: ALOCAÇÃO RESPEITANDO O POSITION SIZING + SCORE
  // -------------------------------------------------------------------------
  // ANTES (v12.8, "guloso cego"): o capital era consumido na ordem do score e,
  // quando acabava, o resto era DESCARTADO. Consequências reais (log 25/10,
  // 13 aprovados): 8 trades com score 95-100 (TAEE11, VIVA3, BBAS3, SAPR11,
  // HYPE3, CMIG4, ISAE4, RADL3) caíam enquanto os piores sobravam; ITSA4 ficou
  // com qtd=1 (R$ 35, "posição-token") e o `riscoRs` do trade trimado NÃO era
  // recalculado (o risco agregado reportado mentia).
  //
  // v15.0: distribuição proporcional ao score (peso = score − 50), teto de 25%
  //        por trade, piso de utilidade absoluto em R$ e ciclos de devolução
  //        de capital. Corrigiu o guloso, mas faltava um ingrediente.
  //
  // 🔧 v15.1 (bug encontrado no 1º log de produção da v15.0): a cota do trade
  //        era `disponivel × peso/somaPesos`, ignorando o `qtd` do Position
  //        Sizing. Efeito: papel com stop largo (ISAE4, R$ 2,26/ação) recebia
  //        a mesma cota em R$ de um papel apertado (SBSP3, R$ 1,24/ação) —
  //        comprando 5× mais ações e 5× mais risco. Pior: o Ranker podia
  //        AUMENTAR a quantidade acima do que o sizing aprovou.
  //
  // AGORA a cota é MISTA e o `qtd` do sizing é TETO (nunca é inflado):
  //   pisoRisco = qtd_sizing × preço      (capital que gasta o risco-alvo)
  //   cotaScore = disponível × peso/Σpesos (score 100 pesa 2,5× o score 70)
  //   cota      = clamp(cotaScore, pisoRisco × escala, teto de 25%)
  // Regras:
  //   1) teto por trade (MAX_TRADE_ALLOCATION) — nunca concentra demais;
  //   2) teto de risco: qtdFinal ≤ qtd do Position Sizing (risco ≤ 2%/trade);
  //   3) piso de utilidade absoluto (MIN_LOTE_VALUE R$). Quem não atinge é
  //      descartado com motivo explícito e seu capital volta ao pote;
  //   4) ciclos de devolução de capital (máx. 8) redistribuem a sobra;
  //   5) `riscoRs`/`alocacao` são RECALCULADOS após a quantidade final.
  // =========================================================================

  var maxTotalValue = capital * CFG.MAX_TOTAL_ALLOCATION;
  var maxTradeValue = capital * CFG.MAX_TRADE_ALLOCATION;
  var tradesCapados = [];
  var tradesDescartados = [];   // { ticker, motivo }

  // Só participam trades com quantidade > 0 (qtd 0 = sizing já não alocou nada)
  var elegiveis = [];
  for (var e = 0; e < trades.length; e++) {
    if (trades[e].qtd > 0 && trades[e].preco > 0) {
      elegiveis.push(trades[e]);
    } else {
      tradesDescartados.push({ ticker: trades[e].ticker, motivo: 'quantidade nula no position sizing' });
    }
  }

  // 🔧 v15.1: `qtd` do Position Sizing é um TETO, nunca um piso.
  // Cada trade traz qtd = floor(risco × capital / distStop). Isso é o tamanho
  // que gasta EXATAMENTE o risco-alvo (2%) — qualquer quantidade maior
  // estoura o risco por trade. O Ranker só pode REDUZIR (por teto de 25% ou
  // por cota de score), jamais aumentar.
  // Normaliza distStop > 0 (inclusive ≥ preço: o sizing já aceitou).
  for (var n = 0; n < elegiveis.length; n++) {
    var d = elegiveis[n].preco - elegiveis[n].stop;
    elegiveis[n]._distStop = (d > 0) ? d : 0;
  }

  // `qtd` do Position Sizing AINDA pode exceder o teto de 25% quando o rápido
  // de risco é apertado (stop perto): dimensionar() capa por
  // `capital × MAX_TRADE_ALLOCATION / preço`. Para o Ranker, o teto efetivo é
  // o MENOR entre a quantidade do sizing e a que caiba em 25% do capital.
  // O valor de referência para calibrar o score é esse teto efetivo — se a
  // soma dos tetos já cabe no capital, ninguém precisa ser cortado.
  var somaCapEfetivo = 0;
  for (var k = 0; k < elegiveis.length; k++) {
    var qMaxTrade = Math.floor(maxTradeValue / elegiveis[k].preco);
    if (qMaxTrade < elegiveis[k].qtd) elegiveis[k]._qtdTeto = qMaxTrade;
    else elegiveis[k]._qtdTeto = elegiveis[k].qtd;
    somaCapEfetivo += elegiveis[k]._qtdTeto * elegiveis[k].preco;
  }

  // Peso = score − 50 (o filtro acima já garante score ≥ 50). Piso 1 evita peso 0.
  function _pesoScore(t) {
    var p = (Number(t.score) || 0) - 50;
    return p > 1 ? p : 1;
  }

  /**
   * Distribui `pool` (R$) proporcional ao peso de score, respeitando:
   *   • teto por trade e o teto de risco do próprio trade (`qtd` inicial);
   *   • alvo-alvo do trade = min(tetoScore, maxTradeValue, capital × MAX_TRADE_ALLOCATION).
   * NÃO devolve descartes: apenas quantidades (o piso é tratado depois).
   * @param {Array} lista trades com `_distStop`.
   * @param {number} pool capital do ciclo.
   * @return {Object} mapa ticker -> quantidade inteira.
   */
  function _distribuir(lista, pool) {
    var somaPesos = 0;
    for (var a = 0; a < lista.length; a++) somaPesos += _pesoScore(lista[a]);
    var out = {};
    if (somaPesos <= 0) return out;
    for (var b = 0; b < lista.length; b++) {
      var tb = lista[b];
      var cota = pool * (_pesoScore(tb) / somaPesos);
      var alvoTrade = Math.min(cota, maxTradeValue);
      var q = Math.floor(alvoTrade / tb.preco);
      // TETO DE RISCO: nunca passar do tamanho que o position sizing aprovou
      if (q > tb.qtd) q = tb.qtd;
      out[tb.ticker] = q > 0 ? q : 0;
    }
    return out;
  }

  var alvo = {};            // ticker -> R$ fixado para o trade
  var vivos = elegiveis.slice();
  var valorAlocado = 0;

  for (var ciclo = 0; ciclo < 8 && vivos.length > 0; ciclo++) {
    // Capital deste ciclo = teto agregado menos o que já foi fixado
    var disponivel = maxTotalValue - valorAlocado;
    if (disponivel <= 0) break;

    var pendentes = vivos.filter(function (x) { return alvo[x.ticker] === undefined; });
    if (pendentes.length === 0) break;

    var somaPesosCiclo = 0;
    for (var c = 0; c < pendentes.length; c++) somaPesosCiclo += _pesoScore(pendentes[c]);
    if (somaPesosCiclo <= 0) break;

    // FASE 1: simula a distribuição e separa quem NÃO tem lote executável.
    // (O capital dos descartados ainda não foi consumido, então todos usam a
    //  mesma base `disponivel` — só os sobreviventes são fixados na FASE 2.)
    var sobreviventes = [];
    var descartadosCiclo = [];

    // ── COTA DE CADA TRADE (v15.1) ─────────────────────────────────────────
    // Na v15.0 cada trade recebia `disponivel × peso/somaPesos`, ignorando o
    // `qtd` do Position Sizing. Efeitos ruins medidos no 1º log de produção:
    //   • papel de stop largo (ISAE4, R$ 2,26/ação) recebia a mesma cota em R$
    //     de um papel apertado (SBSP3, R$ 1,24/ação) → 5× mais ações e 5× mais
    //     risco, estourando o risco-alvo de 2% por trade;
    //   • o Ranker podia AUMENTAR a quantidade acima do que o sizing aprovou
    //     (na simulação, ITUB4 subia de 103 para 452 ações).
    //   • a cota era "pote × peso": com 13 trades bons, o peso relativo já
    //     embutia o fator 1/13 duas vezes e ninguém chegava ao teto de 25%.
    //
    // AGORA a cota é MISTA:
    //   pisoRisco = valor da posição que gasta o risco-alvo (qtd do sizing)
    //   cotaScore = distribuição do capital pelo peso (score − 50)
    //   cota      = clamp(cotaScore, pisoRisco × escalaRisco, maxTradeValue)
    // Dois regimes:
    //   (a) TUDO CABE (soma dos tetos ≤ teto agregado): não há disputa. Cada
    //       trade recebe o tamanho do próprio risco — cortá-lo por score só
    //       deixaria capital ocioso sem melhorar nenhum risco.
    //   (b) APERTO: o capital é distribuído pelo peso (score − 50). O score
    //       alto recebe cota maior; `qtd` do sizing continua sendo o teto de
    //       RISCO (nunca é ultrapassado), mas não é um "direito a gastar".
    var escalaRisco = (somaCapEfetivo > 0) ? Math.min(1, disponivel / somaCapEfetivo) : 1;
    var usaScore = (somaCapEfetivo > disponivel) && (CFG.ALOCACAO_POR_SCORE !== false);

    for (var m = 0; m < pendentes.length; m++) {
      var tv = pendentes[m];
      var cotaTrade;
      if (!usaScore) {
        // Cabe todo mundo: cada trade recebe o teto do seu risco, nada mais.
        var pisoRisco = tv._qtdTeto * tv.preco * escalaRisco;
        cotaTrade = Math.min(pisoRisco, maxTradeValue);
      } else {
        // Aperto: o score define a cota em R$, proporcionalmente ao capital
        // e limitada ao teto de 25%. O teto de risco é aplicado depois
        // (`qtdAlvo > _qtdTeto`), independente da cota.
        cotaTrade = Math.min(disponivel * (_pesoScore(tv) / somaPesosCiclo), maxTradeValue);
      }

      // TETO DE RISCO: nunca maior que o teto efetivo do sizing
      var qtdAlvo = Math.floor(cotaTrade / tv.preco);
      if (qtdAlvo > tv._qtdTeto) qtdAlvo = tv._qtdTeto;
      if (qtdAlvo < 0) qtdAlvo = 0;

      // PISO DE UTILIDADE (absoluto, em R$):
      //   (a) o lote precisa valer ao menos MIN_LOTE_VALUE — evita
      //       "posição-token" (R$ 56 em 3 ações) que a corretagem consome;
      //   (b) EXCEÇÃO: se 1 única ação já vale >= o piso (ativo caro), aceita
      //       a posição — não punir o papel por ser caro.
      var valorPosicao = qtdAlvo * tv.preco;
      var ehAtivoCaro = (tv.preco >= CFG.MIN_LOTE_VALUE);
      var pisoExigido = ehAtivoCaro ? 0 : CFG.MIN_LOTE_VALUE;

      if (qtdAlvo >= 1 && valorPosicao >= pisoExigido) {
        sobreviventes.push({ t: tv, qtd: qtdAlvo });
      } else {
        var motivo = (qtdAlvo < 1)
          ? 'capital insuficiente (1 ação = R$ ' + tv.preco.toFixed(2) + ' > cota R$ ' + cotaTrade.toFixed(2) + ')'
          : 'abaixo do piso de utilidade (R$ ' + valorPosicao.toFixed(2) + ' < R$ ' + CFG.MIN_LOTE_VALUE.toFixed(0) + ')';
        descartadosCiclo.push({ t: tv, motivo: motivo });
      }
    }

    // Remove os descartados (o capital deles volta ao pote do próximo ciclo)
    if (descartadosCiclo.length > 0) {
      vivos = vivos.filter(function (x) {
        for (var d = 0; d < descartadosCiclo.length; d++) {
          if (descartadosCiclo[d].t.ticker === x.ticker) return false;
        }
        return true;
      });
      for (var dd = 0; dd < descartadosCiclo.length; dd++) {
        tradesDescartados.push({ ticker: descartadosCiclo[dd].t.ticker, motivo: descartadosCiclo[dd].motivo });
      }
      // Houve descarte => repete o ciclo com o capital devolvido
      continue;
    }

    // FASE 2: sem descartes, fixa as posições e encerra.
    for (var s = 0; s < sobreviventes.length; s++) {
      var ts = sobreviventes[s].t;
      var qtdS = sobreviventes[s].qtd;
      alvo[ts.ticker] = qtdS * ts.preco;
      valorAlocado += alvo[ts.ticker];
      tradesCapados.push(ts);
    }
    break;
  }

  // Aplica as quantidades finais e RECALCULA risco/alocação (v15.0)
  for (var f = 0; f < tradesCapados.length; f++) {
    var tf = tradesCapados[f];
    var qtdFinal = Math.floor(alvo[tf.ticker] / tf.preco);
    var qtdOriginal = tf.qtd;

    tf.qtd = qtdFinal;
    tf.alocacao = capital > 0 ? (qtdFinal * tf.preco) / capital : 0;

    // Risco da posição SEMPRE coerente com a quantidade final (stop < preço garantido)
    var distStopFinal = tf.preco - tf.stop;
    tf.riscoRs = (distStopFinal > 0) ? qtdFinal * distStopFinal : 0;

    if (qtdFinal !== qtdOriginal) {
      console.log("   ✂️ [Ranker] " + tf.ticker + ": qtd " + qtdOriginal + " → " + qtdFinal +
        " (alocação proporcional ao score; teto agregado de " +
        (CFG.MAX_TOTAL_ALLOCATION * 100).toFixed(0) + "% do capital)");
    }
  }

  // Total efetivo (pode variar por arredondamento de lote)
  valorAlocado = 0;
  for (var g = 0; g < tradesCapados.length; g++) {
    valorAlocado += tradesCapados[g].qtd * tradesCapados[g].preco;
  }

  // Carteira final na ordem de prioridade da aba (score desc)
  tradesCapados.sort(function (a, b) { return (Number(b.score) || 0) - (Number(a.score) || 0); });

  if (tradesDescartados.length > 0) {
    console.warn("   ⚠️ [Ranker] " + tradesDescartados.length +
      " trade(s) descartado(s) por insuficiência de capital / piso de utilidade:");
    for (var h = 0; h < tradesDescartados.length; h++) {
      console.warn("      • " + tradesDescartados[h].ticker + ": " + tradesDescartados[h].motivo);
    }
  }
  if (tradesCapados.length === 0 && trades.length > 0) {
    console.warn("   ⚠️ [Ranker] Nenhum trade coube no teto agregado de " +
      (CFG.MAX_TOTAL_ALLOCATION * 100).toFixed(0) + "% (capital R$ " + capital.toFixed(2) + ").");
  }
  console.log("   💼 [Ranker] Alocação total: R$ " + valorAlocado.toFixed(2) +
    " / R$ " + capital.toFixed(2) + " (teto R$ " + maxTotalValue.toFixed(2) + " = " +
    (CFG.MAX_TOTAL_ALLOCATION * 100).toFixed(0) + "%) | Trades na carteira: " +
    tradesCapados.length + "/" + trades.length);

  trades = tradesCapados;

  // =========================================================================
  // 6. ESCREVER TABELA RANKER
  // =========================================================================
  _escreverTabelaRanker(ss, trades, CFG.RESUMO_SHEET);
  
  return trades.length;
}

// ============================================================================
// FUNÇÃO AUXILIAR: Determinar STATUS baseado no SETUP (SINCRONIZADA)
// ============================================================================
function _determinarStatusPorSetup(setup, score) {
  // Nível 1: COMPRAR (setups de alta qualidade com score adequado)
  // 🔧 CORREÇÃO v9: Thresholds reduzidos em 5 pts para compensar adjustment macro
  // Com adjustment 0.8x-0.95x, scores técnicos perdem 5-20% antes de chegar aqui
  
  // SWING IDEAL (melhor setup possível)
  if (setup.indexOf("SWING IDEAL") !== -1 && score >= 65) {
    return "🚀 COMPRAR";
  }
  
  // TENDÊNCIA CONFIRMADA (setup de alta qualidade)
  if (setup.indexOf("TENDÊNCIA CONFIRMADA") !== -1 && score >= 65) {
    return "🚀 COMPRAR";
  }
  
  // 🔧 CORREÇÃO v9.1: TENDÊNCIA FORTE (score alto, ADX forte, mesmo sem Fibo)
  if (setup.indexOf("TENDÊNCIA FORTE") !== -1 && score >= 65) {
    return "🚀 COMPRAR";
  }
  
  // MOMENTUM FORTE (rompimento com volume)

  if (setup.indexOf("MOMENTUM FORTE") !== -1 && score >= 65) {
    return "🚀 COMPRAR";
  }
  
  // SWING PULLBACK FIBO (clássico swing trade)
  if (setup.indexOf("SWING PULLBACK FIBO") !== -1 && score >= 70) {
    return "🚀 COMPRAR";
  }
  
  // PULLBACK FIBO (versão simplificada)
  if (setup.indexOf("PULLBACK FIBO") !== -1 && score >= 70) {
    return "🚀 COMPRAR";
  }

  
  // Nível 2: RADAR (aguardar confirmação)
  // 🔧 CORREÇÃO v9: Alinhado com DecisionEngine.DEFAULT_THRESHOLD (55)
  // O Ranker usava threshold 60 próprio, mas o DecisionEngine agora aprova com 55
  var radarThreshold = 55;

  
  // RADAR TENDÊNCIA (aguardar volume)
  if (setup.indexOf("RADAR TENDÊNCIA") !== -1 && score >= radarThreshold) {
    return "🔭 RADAR";
  }
  
  // RADAR PULLBACK (aguardar confirmação)
  if (setup.indexOf("RADAR PULLBACK") !== -1 && score >= radarThreshold) {
    return "🔭 RADAR";
  }
  
  // AGUARDAR MELHOR SETUP (setup incompleto)
  if (setup.indexOf("AGUARDAR") !== -1 && score >= radarThreshold) {
    return "🔭 RADAR";
  }
  
  // TENDÊNCIA (sem confirmação completa)
  if (setup.indexOf("TENDÊNCIA") !== -1 && score >= 70 && score < 80 && setup.indexOf("CONFIRMADA") === -1) {
    return "🔭 RADAR";
  }
  
  // PULLBACK (genérico, sem Fibo)
  if (setup.indexOf("PULLBACK") !== -1 && score >= 70 && score < 75 && setup.indexOf("FIBO") === -1) {
    return "🔭 RADAR";
  }
  
  // Nível 3: NEUTRO (não comprar)
  
  // RISCO ALTO (RR baixo)
  if (setup.indexOf("RISCO ALTO") !== -1) {
    return "🛡️ NEUTRO (RR BAIXO)";
  }
  
  // STOP INVIÁVEL
  if (setup.indexOf("STOP INVIÁVEL") !== -1) {
    return "🛡️ NEUTRO";
  }
  
  // SCORE BAIXO
  if (setup.indexOf("SCORE BAIXO") !== -1) {
    return "🛡️ NEUTRO";
  }
  
  // DESCARTAR
  if (setup.indexOf("DESCARTAR") !== -1) {
    return "🛡️ NEUTRO";
  }
  
  // Fallback: usa apenas o score (último recurso)
  if (score >= 85) return "🚀 COMPRAR";
  if (score >= 70) return "🔭 RADAR";
  return "🛡️ NEUTRO";
}

// ============================================================================
// FUNÇÃO: Escrever Tabela Ranker
// ============================================================================
function _escreverTabelaRanker(ss, trades, sheetName) {
  var dest = ss.getSheetByName(sheetName);
  if (!dest) {
    dest = ss.insertSheet(sheetName);
  }

  // Desenhar glossário (cabeçalhos)
  _desenharGlossario(dest);

  // Limpar dados antigos (manter cabeçalho)
  if (dest.getLastRow() > 6) {
    dest.getRange(7, 1, dest.getLastRow() - 6, 14).clearContent().clearFormat();
  }

  if (trades.length > 0) {
    var agora = new Date();
    var rows = [];
    
    for (var i = 0; i < trades.length; i++) {
      var t = trades[i];
      // 🔧 v14.5: a coluna ALVO agora mostra o ALVO 1 e, ao lado (ESTRATÉGIA),
      // o retorno REAL até ele a partir da COTAÇÃO — que é o número que importa
      // para quem entra hoje. Quando o preço está fora da zona, o aviso aparece
      // no início da ESTRATÉGIA para não passar batido.
      var avisoZona = '';
      if (t.dentroDaZona === false && t.atrasoPct > 0) {
        avisoZona = '⚠️ FORA DA ZONA (+' + (t.atrasoPct * 100).toFixed(1) + '%) · ';
      }
      var retornoReal = (t.alvo1PctAtual > 0)
        ? 'Alvo1 a +' + (t.alvo1PctAtual * 100).toFixed(1) + '% da cotação · '
        : '';
      var rrTexto = 'R/R ' + (t.rr || 0).toFixed(2);
      if (t.rrGeometria && Math.abs(t.rrGeometria - t.rr) > 0.05) {
        rrTexto += ' (geom. ' + t.rrGeometria.toFixed(2) + ')';
      }

      rows.push([
        agora, t.status, t.ticker, t.setor, t.setup, t.preco,
        t.fibo, t.stop, t.alvo, t.qtd, t.alocacao, t.rr, t.score,
        avisoZona + retornoReal + rrTexto +
          (t.estrategia ? ' · ' + t.estrategia : '')
      ]);
    }

    var rangeDados = dest.getRange(7, 1, rows.length, 14);
    // 🔧 v14.4: Preenche apenas os dados, sem formatação automática.
    rangeDados.setValues(rows);
  }
}

// ============================================================================
// FUNÇÃO: Desenhar Glossário e Cabeçalhos
// ============================================================================
function _desenharGlossario(sheet) {
  // 🔧 v14.4: Preenche apenas os DADOS (título, glossário e cabeçalhos),
  // sem formatação automática. A formatação fica por conta do usuário.
  sheet.getRange("A1:N6").clearContent();

  // Título Principal (apenas o texto, sem estilização)
  sheet.getRange("A1:N1").merge().setValue("CARTEIRA RECOMENDADA B3-V10 (SMART HOLD) — PAINEL DE INTELIGÊNCIA");

  // Definição do Glossário
  var glossario = [
    ["🚀 COMPRAR", "Setup de alta qualidade + IA favorável (Score ≥ 65)", "🎯 SWING IDEAL", "Pullback Fibo + Tendência Forte + RR ≥ 1.5"],
    ["🔭 RADAR", "Setup promissor, aguardar confirmação (Score 55-69)", "📈 OBV UP", "Acumulação institucional silenciosa (fluxo comprador forte)"],
    ["🛡️ NEUTRO", "Setup de baixo score, stop inviável ou fora do timing", "📉 OBV DOWN", "Distribuição institucional silenciosa (alerta de rompimento falso)"],
    ["❌ VETADO", "Risco excessivo (RR baixo, correlação extrema ou Compliance)", "🚨 BTC ALTO", "Alto saldo de aluguel de ações (forte pressão de short-sellers B3)"]
  ];

  // Aplica apenas os textos (Linhas 2 a 5), sem estilização
  for (var i = 0; i < glossario.length; i++) {
    var row = i + 2;
    sheet.getRange(row, 1).setValue(glossario[i][0]);
    sheet.getRange(row, 2).setValue(glossario[i][1]);
    sheet.getRange(row, 4).setValue(glossario[i][2]);
    sheet.getRange(row, 5).setValue(glossario[i][3]);
  }

  // Cabeçalhos da Tabela (Linha 6) — apenas valores
  var headers = ["DATA/HORA", "STATUS", "TICKER", "SETOR", "SETUP", "PREÇO ATUAL", "ENTRADA FIBO", "STOP", "ALVO", "QTD", "ALOCAÇÃO %", "R/R", "SCORE", "ESTRATÉGIA"];
  var headerRange = sheet.getRange(6, 1, 1, headers.length);
  headerRange.setValues([headers]);
}
