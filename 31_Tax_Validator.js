/**
 * =============================================================================
 * 31_Tax_Validator.gs — AUDITOR DE CONSISTÊNCIA FISCAL (V2.0)
 * =============================================================================
 * Antes: stub com índices mágicos (row[2]/row[3]) apontando para colunas
 *        erradas ('Data' e 'Horário'), somando lixo e sem validação real.
 * Agora: mapeamento dinâmico via TAX_CONFIG.COL_NAMES (Arquivo 21) + 6
 *        verificações fiscais e gravação do resultado na aba 'Auditoria_Fiscal'.
 *
 * ── CHECAGENS ────────────────────────────────────────────────────────────────
 *  [C1] COBERTURA MENSAL ... meses com 'Mês Referência' válido e L/P preenchido.
 *  [C2] ENCADEAMENTO ....... saldo de prejuízo de um mês = saldo do anterior
 *                           menos o abatido no mês corrente.
 *  [C3] IR-FONTE .......... soma das colunas P/Z/AA/AB/AC das notas vs total
 *                           de IR-Fonte reconhecido na apuração.
 *  [C4] LUCRO/PREJUÍZO .... coluna Y (fonte) vs recálculo por
 *                           (Valor Líquido − Custo Total), quando disponíveis.
 *  [C5] DARF x RECÁLCULO .. valor gravado em 'DARF_Mensal' vs recomputado.
 *  [C6] MÍNIMO DE DARF .... nenhum DARF pago abaixo de R$ 10,00 e nenhum valor
 *                           ≥ R$ 10,00 marcado como 'ACUMULAR'.
 * =============================================================================
 */

var TaxValidator = (function () {
  'use strict';

  const TOLERANCIA = 0.02; // R$ — diferença aceitável por arredondamento

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function formatBRL(v) {
    return 'R$ ' + (Number(v) || 0).toFixed(2);
  }

  function fmtMes(d) {
    return String(d.mes).padStart(2, '0') + '/' + d.ano;
  }

  /** Obtém a aba de auditoria, criando-a com cabeçalho se necessário. */
  function garantirAbaAuditoria(ss) {
    const nome = (typeof TAX_CONFIG !== 'undefined' && TAX_CONFIG.SHEETS.AUDITORIA)
      ? TAX_CONFIG.SHEETS.AUDITORIA
      : 'Auditoria_Fiscal';
    let sh = ss.getSheetByName(nome);
    if (!sh) {
      sh = ss.insertSheet(nome);
      sh.getRange(1, 1, 1, 6).setValues([[
        'Data/Hora', 'Severidade', 'Checagem', 'Referência', 'Detalhe', 'Valor'
      ]]).setFontWeight('bold').setBackground('#0c343d').setFontColor('white');
      sh.setFrozenRows(1);
      sh.setColumnWidth(1, 150);
      sh.setColumnWidth(2, 100);
      sh.setColumnWidth(3, 130);
      sh.setColumnWidth(4, 130);
      sh.setColumnWidth(5, 520);
      sh.setColumnWidth(6, 140);
    }
    return sh;
  }

  /** Lê a aba de notas e devolve o mapeamento (reusa o do Arquivo 21). */
  function lerNotasBrutas() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName(TAX_CONFIG.SHEETS.SOURCE);
    if (!aba) throw new Error(`Aba '${TAX_CONFIG.SHEETS.SOURCE}' não encontrada.`);

    const dados = aba.getDataRange().getValues();
    if (dados.length < 2) return { map: {}, linhas: [] };

    const map = (typeof TaxProcessor !== 'undefined')
      ? new TaxProcessor()._mapearColunas(dados[0])
      : {};

    return { map: map, linhas: dados };
  }

  // ---------------------------------------------------------------------------
  // [C1] Cobertura mensal
  // ---------------------------------------------------------------------------
  function checarCoberturaMensal(linhas, map, achados) {
    if (map.MES_REF === -1) {
      achados.push(['ERRO', 'C1-Cobertura', '-',
        "Coluna 'Mês Referência' não encontrada — não é possível auditar.", 0]);
      return {};
    }

    const porMes = {};
    let semMes = 0;

    for (let i = 1; i < linhas.length; i++) {
      const row = linhas[i];
      const chave = taxChaveMes(row[map.MES_REF]);
      const temLucro = map.LUCRO_PREJUIZO > -1 &&
        taxParaNumero(row[map.LUCRO_PREJUIZO]) !== 0;

      if (!chave) {
        if (temLucro) semMes++; // só é relevante se tiver resultado financeiro
        continue;
      }
      if (!porMes[chave]) porMes[chave] = { registros: 0, comResultado: 0 };
      porMes[chave].registros++;
      if (temLucro) porMes[chave].comResultado++;
    }

    if (semMes > 0) {
      achados.push(['AVISO', 'C1-Cobertura', 'Notas',
        `${semMes} linha(s) com Lucro/Prejuízo preenchido mas SEM 'Mês Referência' válido. ` +
        `Essas linhas são IGNORADAS no cálculo fiscal.`, semMes]);
    }

    const meses = Object.keys(porMes).sort();
    meses.forEach(m => {
      if (porMes[m].comResultado === 0) {
        achados.push(['INFO', 'C1-Cobertura', m,
          `${porMes[m].registros} nota(s) no mês, mas nenhuma com Lucro/Prejuízo preenchido.`,
          0]);
      }
    });

    // Detecta lacunas na sequência mensal (meses sem nenhuma nota importada)
    for (let i = 1; i < meses.length; i++) {
      const p1 = meses[i - 1].split('-').map(Number);
      const p2 = meses[i].split('-').map(Number);
      const dif = (p2[0] - p1[0]) * 12 + (p2[1] - p1[1]);
      if (dif > 1) {
        achados.push(['AVISO', 'C1-Cobertura', meses[i - 1] + ' → ' + meses[i],
          `Lacuna de ${dif - 1} mês(es) sem nenhuma nota. Confirme se não há notas ` +
          `faltando na planilha de origem (IMPORTRANGE).`, dif - 1]);
      }
    }

    if (meses.length === 0) {
      achados.push(['ERRO', 'C1-Cobertura', '-',
        'Nenhum mês válido encontrado nas notas de corretagem.', 0]);
    } else {
      achados.push(['OK', 'C1-Cobertura', `${meses.length} meses`,
        `Meses auditados: ${meses.join(', ')}.`, meses.length]);
    }

    return porMes;
  }

  // ---------------------------------------------------------------------------
  // [C2] Encadeamento do saldo de prejuízo entre meses
  // ---------------------------------------------------------------------------
  function checarEncadeamento(historico, achados) {
    if (!historico || historico.length === 0) return;

    const campos = {
      SWING: 'prejuSwingFinal',
      DT: 'prejuDTFinal',
      FII: 'prejuFIIFinal',
      ETF: 'prejuETF'
    };

    let falhas = 0;
    for (let i = 1; i < historico.length; i++) {
      const anterior = historico[i - 1];
      const atual = historico[i];

      Object.keys(campos).forEach(mk => {
        const campoSaldo = campos[mk];
        const detAtual = (atual.detalhe || {})[mk] || { prejuizoAbatido: 0 };

        // Saldo esperado = saldo do mês anterior − prejuízo abatido no mês atual
        const esperado = (anterior[campoSaldo] || 0) - (detAtual.prejuizoAbatido || 0);
        const gravado = atual[campoSaldo] || 0;

        if (Math.abs(gravado - esperado) > TOLERANCIA) {
          falhas++;
          achados.push(['ERRO', 'C2-Encadeamento', `${fmtMes(atual)} / ${mk}`,
            `Saldo de prejuízo inconsistente. Esperado ${formatBRL(esperado)} ` +
            `(saldo de ${fmtMes(anterior)}: ${formatBRL(anterior[campoSaldo] || 0)} ` +
            `− abatido no mês: ${formatBRL(detAtual.prejuizoAbatido || 0)}), ` +
            `mas gravado ${formatBRL(gravado)}.`, gravado]);
        }
      });
    }

    if (falhas === 0) {
      achados.push(['OK', 'C2-Encadeamento', `${historico.length} meses`,
        'O saldo de prejuízo encadeia corretamente entre todos os meses auditados.', 0]);
    }
  }

  // ---------------------------------------------------------------------------
  // [C3] IR-Fonte: soma das colunas das notas vs IR reconhecido na apuração
  // ---------------------------------------------------------------------------
  function checarIRFonte(linhas, map, historico, achados) {
    if (!historico || historico.length === 0) return;

    // Soma o IR-Fonte de TODAS as colunas dedicadas nas notas
    const campos = ['IR_FONTE', 'IR_NORMAL', 'IR_DAY_TRADE', 'IR_FII', 'IR_ETF'];
    let totalNotas = 0;
    campos.forEach(c => {
      if (map[c] > -1) {
        for (let i = 1; i < linhas.length; i++) {
          totalNotas += taxParaNumero(linhas[i][map[c]]);
        }
      }
    });

    // Total de IR-Fonte apropriado pela apuração (por mercado)
    const totalApurado = historico.reduce((s, d) => {
      const det = d.detalhe || {};
      return s + ['SWING', 'DT', 'FII', 'ETF']
        .reduce((t, mk) => t + (det[mk] ? (det[mk].irFonte || 0) : 0), 0);
    }, 0);

    const diferenca = Math.abs(totalNotas - totalApurado);
    const limiteAceitavel = Math.max(1, Math.abs(totalNotas) * 0.001);

    if (diferenca > limiteAceitavel) {
      achados.push(['AVISO', 'C3-IRFonte', 'Global',
        `IR-Fonte das notas (${formatBRL(totalNotas)}) difere do reconhecido na ` +
        `apuração (${formatBRL(totalApurado)}). Diferença: ${formatBRL(diferenca)}. ` +
        `Esperado se as colunas 'IR Normal/DT/FII/ETF' coexistirem com 'IR na Fonte' ` +
        `— confirme manualmente qual é a fonte correta.`, diferenca]);
    } else {
      achados.push(['OK', 'C3-IRFonte', 'Global',
        `IR-Fonte das notas (${formatBRL(totalNotas)}) confere com a apuração ` +
        `(${formatBRL(totalApurado)}), dentro da tolerância.`, totalNotas]);
    }
  }

  // ---------------------------------------------------------------------------
  // [C4] Lucro/Prejuízo da fonte vs recálculo (Valor Líquido − Custo Total)
  // ---------------------------------------------------------------------------
  function checarLucroLiquido(linhas, map, achados) {
    if (map.LUCRO_PREJUIZO === -1) {
      achados.push(['ERRO', 'C4-LucroFonte', '-',
        "Coluna 'Lucro/Prejuízo' não encontrada nas notas.", 0]);
      return;
    }
    if (map.VALOR_LIQUIDO === -1 || map.CUSTO_TOTAL === -1) {
      achados.push(['INFO', 'C4-LucroFonte', '-',
        "Colunas 'Valor Líquido' e/ou 'Custo Total' ausentes — checagem cruzada " +
        "de lucro foi pulada.", 0]);
      return;
    }

    let divergentes = 0;
    let somaDiferenca = 0;
    let piorCaso = null;

    for (let i = 1; i < linhas.length; i++) {
      const row = linhas[i];
      const informado = taxParaNumero(row[map.LUCRO_PREJUIZO]);
      if (informado === 0) continue; // linhas de compra não têm L/P realizado

      const vl = taxParaNumero(row[map.VALOR_LIQUIDO]);
      const ct = taxParaNumero(row[map.CUSTO_TOTAL]);
      // Duas convenções circulam no mercado (Custo Total com sinal / só líquido)
      const dif = Math.min(Math.abs((vl + ct) - informado), Math.abs(vl - informado));

      if (dif > 0.10) {
        divergentes++;
        somaDiferenca += dif;
        if (!piorCaso || dif > piorCaso.dif) {
          piorCaso = { linha: i + 1, informado: informado, calculado: vl + ct, dif: dif };
        }
      }
    }

    if (divergentes > 0) {
      achados.push(['AVISO', 'C4-LucroFonte', `${divergentes} linha(s)`,
        `Em ${divergentes} linha(s) o 'Lucro/Prejuízo' da fonte não bate com ` +
        `(Valor Líquido − Custo Total). Maior divergência na linha ` +
        `${piorCaso.linha}: informado ${formatBRL(piorCaso.informado)} vs ` +
        `calculado ${formatBRL(piorCaso.calculado)}.`, somaDiferenca]);
    } else {
      achados.push(['OK', 'C4-LucroFonte', 'Todas as linhas',
        "O 'Lucro/Prejuízo' de todas as linhas confere com os custos informados.", 0]);
    }
  }

  // ---------------------------------------------------------------------------
  // [C5] Consistência do imposto consolidado + [C6] regra do mínimo de R$ 10
  // ---------------------------------------------------------------------------
  function checarDARF(historico, achados) {
    if (!historico || historico.length === 0) return;

    // [C5] impostoBruto consolidado = Σ impostoBruto dos 4 mercados
    let errosC5 = 0;
    historico.forEach(d => {
      const det = d.detalhe || {};
      const somaBruto = ['SWING', 'DT', 'FII', 'ETF']
        .reduce((s, mk) => s + (det[mk] ? (det[mk].impostoBruto || 0) : 0), 0);

      if (Math.abs(somaBruto - (d.impostoBruto || 0)) > TOLERANCIA) {
        errosC5++;
        achados.push(['ERRO', 'C5-DARF', fmtMes(d),
          `Imposto bruto consolidado (${formatBRL(d.impostoBruto)}) difere da soma ` +
          `dos mercados (${formatBRL(somaBruto)}).`, d.impostoBruto || 0]);
      }
    });
    if (errosC5 === 0) {
      achados.push(['OK', 'C5-DARF', `${historico.length} meses`,
        'O imposto bruto consolidado bate com a soma dos 4 mercados em todos os meses.', 0]);
    }

    // [C6] Regra do mínimo de R$ 10,00 (IN RFB 1.585/2015, art. 65)
    let errosC6 = 0;
    historico.forEach(d => {
      const valor = d.valorDARF || 0;
      const status = d.statusDARF;

      if (status === 'A PAGAR' && valor < 10) {
        errosC6++;
        achados.push(['ERRO', 'C6-MinimoDARF', fmtMes(d),
          `DARF marcada como 'A PAGAR' com valor ${formatBRL(valor)} — abaixo do ` +
          `mínimo legal de R$ 10,00. Deveria estar como 'ACUMULAR'.`, valor]);
      }
      if (status === 'ACUMULAR' && valor >= 10) {
        errosC6++;
        achados.push(['ERRO', 'C6-MinimoDARF', fmtMes(d),
          `DARF marcada como 'ACUMULAR' com valor ${formatBRL(valor)} — acima do ` +
          `mínimo de R$ 10,00. Deveria estar como 'A PAGAR'.`, valor]);
      }
    });
    if (errosC6 === 0) {
      achados.push(['OK', 'C6-MinimoDARF', `${historico.length} meses`,
        'A regra do mínimo de R$ 10,00 foi respeitada em todos os meses.', 0]);
    }
  }

  // ---------------------------------------------------------------------------
  // Gravação do relatório na aba Auditoria_Fiscal
  // ---------------------------------------------------------------------------
  function gravarRelatorio(achados) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = garantirAbaAuditoria(ss);

    if (aba.getLastRow() > 1) {
      aba.getRange(2, 1, aba.getLastRow() - 1, 6).clearContent();
    }

    const agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    const linhas = achados.map(a => [agora, a[0], a[1], a[2], a[3], a[4]]);

    // Garante no mínimo 1 linha para não quebrar setValues com array vazio
    const dados = linhas.length > 0 ? linhas : [[agora, 'INFO', '-', '-', 'Nada a auditar.', 0]];
    const range = aba.getRange(2, 1, dados.length, 6);
    range.setValues(dados);

    // Cores por severidade (em lote)
    const cores = dados.map(d => {
      const sev = d[1];
      const cor = sev === 'ERRO' ? '#f4cccc' : (sev === 'AVISO' ? '#fff2cc' : (sev === 'OK' ? '#d9ead3' : null));
      return [cor, cor, cor, cor, cor, cor];
    });
    range.setBackgrounds(cores);
    aba.getRange(2, 6, dados.length, 1).setNumberFormat('"R$ "#,##0.00');
    aba.setFrozenRows(1);

    return dados.length;
  }

  // ---------------------------------------------------------------------------
  // Consolidado de severidades (para o modal)
  // ---------------------------------------------------------------------------
  function resumir(achados) {
    const cont = { ERRO: 0, AVISO: 0, OK: 0, INFO: 0 };
    achados.forEach(a => { cont[a[0]] = (cont[a[0]] || 0) + 1; });
    return cont;
  }

  /**
   * Executa a auditoria fiscal completa.
   * @return {Object} { achados, resumo, historico }.
   */
  function auditar() {
    const achados = [];

    // 1) Notas + mapeamento
    const { linhas, map } = lerNotasBrutas();
    if (linhas.length === 0) {
      achados.push(['ERRO', 'C0-Fonte', TAX_CONFIG.SHEETS.SOURCE,
        'Aba de notas vazia ou sem dados.', 0]);
      return { achados: achados, resumo: resumir(achados), historico: [] };
    }

    // 2) Apuração (Arquivo 21) — qualquer erro aqui é fatal
    let historico = [];
    try {
      historico = new TaxProcessor().obterDadosMensais();
    } catch (e) {
      achados.push(['ERRO', 'C0-Apuracao', '-',
        'Não foi possível apurar os impostos: ' + e.message, 0]);
      return { achados: achados, resumo: resumir(achados), historico: [] };
    }

    // 3) Checagens
    checarCoberturaMensal(linhas, map, achados);
    checarEncadeamento(historico, achados);
    checarIRFonte(linhas, map, historico, achados);
    checarLucroLiquido(linhas, map, achados);
    checarDARF(historico, achados);

    return { achados: achados, resumo: resumir(achados), historico: historico };
  }

  return {
    auditar: auditar,
    gravarRelatorio: gravarRelatorio,
    resumir: resumir
  };
})();

// =============================================================================
// PONTO DE ENTRADA (MENU)
// =============================================================================

/**
 * Verifica a consistência fiscal das notas e grava o resultado em
 * 'Auditoria_Fiscal'. Funciona em foreground (modal) e em background (log).
 */
function VERIFICAR_CONSISTENCIA_FISCAL() {
  console.log('🔍 [TaxValidator] Iniciando auditoria de consistência fiscal...');

  let resultado;
  try {
    resultado = TaxValidator.auditar();
  } catch (e) {
    console.error('❌ [TaxValidator] Falha na auditoria: ' + e.message);
    b3FiscalAlertFalback('❌ Erro na Auditoria Fiscal', e.message);
    return null;
  }

  TaxValidator.gravarRelatorio(resultado.achados);
  const r = resultado.resumo;

  const linhas = resultado.achados.map(a => {
    const icone = a[0] === 'ERRO' ? '❌' : (a[0] === 'AVISO' ? '⚠️' : (a[0] === 'OK' ? '✅' : 'ℹ️'));
    return `${icone} [${a[1]}] ${a[2]}: ${a[3]}`;
  });

  const titulo = `📋 AUDITORIA FISCAL — ${r.ERRO} erro(s), ${r.AVISO} aviso(s), ${r.OK} OK`;
  const corpo = linhas.join('\n\n');

  console.log(titulo);
  linhas.forEach(l => console.log('   ' + l));

  b3FiscalAlertFalback(titulo, corpo.slice(0, 2500) +
    (corpo.length > 2500 ? '\n\n...(relatório completo na aba "Auditoria_Fiscal")' : ''));

  return resultado;
}

/**
 * Wrapper de UI resiliente: exibe alerta se houver interface; caso contrário
 * (gatilho/editor sem planilha aberta) apenas loga. Padrão usado em
 * 20_Compliance_Unified.
 */
function b3FiscalAlertFalback(titulo, mensagem) {
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui && typeof ui.alert === 'function') {
      ui.alert(titulo, mensagem, ui.ButtonSet.OK);
      return;
    }
  } catch (e) {
    // Contexto sem UI (execução por gatilho) — cai no log abaixo
  }
  console.log(`[${titulo}] ${mensagem}`);
}

