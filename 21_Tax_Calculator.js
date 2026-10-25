/**
 * =============================================================================
 * 21_Tax_Calculator.gs — MOTOR CONTÁBIL & DISTRIBUIDOR FISCAL (V4.0)
 * =============================================================================
 * 1. Lê a aba 'Notas de Corretagem' (layout real importado via IMPORTRANGE,
 *    cabeçalho A..AF — ver TAX_CONFIG.COL_NAMES).
 * 2. Apura, POR MERCADO (Swing / Day Trade / FII / ETF), impostos, prejuízos,
 *    compensações e créditos de IR retido a maior.
 * 3. Exponibiliza o objeto 'TaxCalculator' para o gerador de DARF (Arquivo 30),
 *    o validador de consistência (Arquivo 31) e o dashboard anual (Arquivo 54).
 *
 * ── MUDANÇAS v4.0 (correções contábeis) ──────────────────────────────────────
 *  [F1] Compensação reescrita com "pool" de prejuízo positivo e ordem legal:
 *       apura mês → acumula prejuízo do mês → abate pool anterior (se tributável)
 *       → aplica isenção dos R$ 20k (SÓ ações, SÓ swing) → tributa → abate
 *       IR-Fonte DO MESMO MERCADO → verifica mínimo de R$ 10 (arraste).
 *  [F2] IR-Fonte segregado por mercado usando as colunas da fonte
 *       'IR Normal' / 'IR Day Trade' / 'IR FII' / 'IR ETF' (com fallback para
 *       'IR na Fonte' quando as segregadas estiverem vazias).
 *  [F3] Crédito de IR retido a maior passa a ser carregado entre meses
 *       (antes era simplesmente perdido em meses isentos).
 *  [F4] ETF deixa de ser tratado como Swing (não tem isenção de R$ 20k;
 *       alíquota 15%).
 *  [F5] Parsing de mês robusto (Date, serial, dd/mm/aaaa, mm/aaaa, mmm/aaaa,
 *       mmm./aaaa, aaaa-mm, 'Setembro/2020').
 *  [F6] Trilha de auditoria completa por mês (bases, abatimentos, créditos).
 *  [F7] Relatórios com cabeçalho garantido, formatação em lote e linha de TOTAL.
 */

/** Configuração fiscal central. */
const TAX_CONFIG = {
  SHEETS: {
    SOURCE: 'Notas de Corretagem',
    TARGET_ANUAL: 'IRPF_Resumo_Anual',
    TARGET_DARF: 'DARF_Mensal',
    TARGET_EXEC: 'Resumo_Executivo_IRPF',
    AUDITORIA: 'Auditoria_Fiscal'
  },
  // Alíquotas vigentes (RFB). Day Trade e FII: 20%. Swing/ETF: 15%.
  ALIQUOTA_SWING: 0.15,
  ALIQUOTA_DT: 0.20,
  ALIQUOTA_FII: 0.20,
  ALIQUOTA_ETF: 0.15, // ETF de renda variável: 15% (sem isenção de R$ 20k)
  // Teto de isenção mensal para VENDAS DE AÇÕES em swing trade.
  ISENCAO_VENDAS_ACOES: 20000,
  // Valor mínimo de DARF (abaixo disso o imposto é arrastado para o mês seguinte).
  MINIMO_DARF: 10,
  // 'max' = a coluna 'Vendas no Mês (Tipo Ação)' já traz o total acumulado do mês
  //         repetido em cada linha (comportamento da planilha de origem).
  // 'soma' = a coluna traz o valor incremental por nota.
  MODO_VENDAS_MES: 'max',
  // Tolerância (R$) para conferência de Lucro/Prejuízo da fonte vs recálculo.
  TOLERANCIA_VALIDACAO: 0.05,
  /**
   * Mapeamento do cabeçalho REAL da aba 'Notas de Corretagem' (A..AF).
   * Cada chave aceita ALIASES — o primeiro que casar (match exato, depois
   * normalizado) é usado. Isso blinda o motor contra acentos, emojis,
   * maiúsculas e pequenas variações de nomenclatura.
   */
  COL_NAMES: {
    DATA:            ['Data'],
    HORARIO:         ['Horário', 'Horario'],
    OPERACAO:        ['Operação', 'Operacao'],
    MODALIDADE:      ['Modalidade'],
    PAPEL:           ['Papel'],
    TIPO_PAPEL:      ['Tipo Papel'],
    QUANTIDADE:      ['Quantidade'],
    PRECO:           ['Preço', 'Preco'],
    CUSTO_CORRETAGEM:['Custo Corretagem'],
    VALOR_BRUTO:     ['Valor Bruto'],
    TX_LIQUIDACAO:   ['Tx Liquidação', 'Tx Liquidacao'],
    EMOLUMENTOS:     ['Emolumentos'],
    ISS:             ['ISS'],
    IR_FONTE:        ['IR na Fonte'],
    CUSTO_TOTAL:     ['Custo Total'],
    VALOR_LIQUIDO:   ['Valor Líquido', 'Valor Liquido'],
    PRECO_MEDIO:     ['Preço Médio Ordem', 'Preco Medio Ordem'],
    SALDO_POSICAO:   ['Saldo Posição', 'Saldo Posicao'],
    ESTOQUE:         ['Estoque'],
    LUCRO_PREJUIZO:  ['Lucro/Prejuízo', 'Lucro/Prejuizo', 'L/P'],
    IR_FII:          ['IR FII'],
    IR_ETF:          ['IR ETF'],
    IR_NORMAL:       ['IR Normal'],
    IR_DAY_TRADE:    ['IR Day Trade'],
    MES_REF:         ['Mês Referência', 'Mes Referencia', 'Mês Ref', 'Mes Ref'],
    VENDAS_MES:      ['Vendas no Mês (Tipo Ação)', 'Vendas no Mes (Tipo Acao)'],
    TAXA_TTA:        ['Taxa TTA (Swing)', 'Taxa TTA']
  }
};

/** Motores de apuração reconhecidos. */
const TAX_MERCADOS = ['SWING', 'DT', 'FII', 'ETF'];

// =============================================================================
// HELPERS DE PARSE (puros — reaproveitados pelos testes offline)
// =============================================================================

/** Normaliza um texto de cabeçalho (remove acentos, emojis, espaços extras). */
function taxNormalizarCabecalho(txt) {
  if (txt === null || txt === undefined) return '';
  return String(txt)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove diacríticos
    .replace(/[^\w\/\(\)\s\-\.]/g, '') // remove emojis e símbolos
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Converte qualquer valor monetário/texto em número (aceita "1.234,56", "(123)"). */
function taxParaNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return isFinite(valor) ? valor : 0;
  if (valor instanceof Date) return 0;
  let str = String(valor).trim();
  if (str === '-' || str === '') return 0;
  // Notação contábil: (1.234,56) => -1234.56
  const negativo = /^\(.*\)$/.test(str);
  if (negativo) str = str.slice(1, -1);
  str = str.replace(/[R$\s%]/g, '');
  // Formato pt-BR com vírgula decimal
  if (str.indexOf(',') !== -1) str = str.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(str);
  if (!isFinite(n)) return 0;
  return negativo ? -n : n;
}

/**
 * Converte o conteúdo de 'Mês Referência' em uma chave canônica 'AAAA-MM'.
 * Aceita: Date, serial numérico do Sheets, 'dd/mm/aaaa', 'mm/aaaa', 'mmm/aaaa',
 * 'mmm./aaaa', 'aaaa-mm', 'aaaa-mm-dd' e nomes de mês por extenso/abreviados.
 * @return {string} 'AAAA-MM' ou '' se não for possível interpretar.
 */
function taxChaveMes(valor) {
  if (valor === null || valor === undefined || valor === '') return '';

  const MESES = {
    jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
    jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12'
  };
  const pad = n => String(n).padStart(2, '0');

  // 1) Date nativo do Sheets
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return `${valor.getFullYear()}-${pad(valor.getMonth() + 1)}`;
  }

  // 2) Serial numérico do Google Sheets (dias desde 30/12/1899)
  if (typeof valor === 'number' && isFinite(valor) && valor > 1000 && valor < 100000) {
    const ms = Math.round((valor - 25569) * 86400 * 1000); // 25569 = dias até 1970-01-01
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  }

  const str = String(valor).trim();
  if (!str) return '';

  // 3) ISO: aaaa-mm ou aaaa-mm-dd  (aceita também com '/' final)
  let m = str.match(/^(\d{4})[-\/](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}`;

  // 4) dd/mm/aaaa
  m = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}`;

  // 5) mm/aaaa
  m = str.match(/^(\d{1,2})[-\/](\d{4})$/);
  if (m) return `${m[2]}-${pad(m[1])}`;

  // 6) mmm/aaaa ou mmm./aaaa  ('set./2020')
  m = str.match(/^([A-Za-zÀ-ÿ]{3,})\.?[-\/\s]+(\d{4})$/);
  if (m) {
    const mes = MESES[m[1].substring(0, 3).toLowerCase()];
    if (mes) return `${m[2]}-${mes}`;
  }

  // 7) aaaa + nome do mês ('2020 Setembro')
  m = str.match(/^(\d{4})[-\/\s]+([A-Za-zÀ-ÿ]{3,})\.?$/);
  if (m) {
    const mes = MESES[m[2].substring(0, 3).toLowerCase()];
    if (mes) return `${m[1]}-${mes}`;
  }

  // 8) Último recurso: qualquer nome de mês + qualquer ano de 4 dígitos
  const nomeMes = MESES[str.substring(0, 3).toLowerCase()];
  const anoAny = str.match(/(\d{4})/);
  if (nomeMes && anoAny) return `${anoAny[1]}-${nomeMes}`;

  return '';
}

/**
 * Classifica a linha em um dos 4 motores: SWING | DT | FII | ETF.
 * Regra: FII/ETF são identificados por 'Tipo Papel'; DT por 'Modalidade'.
 * @return {string} chave do mercado.
 */
function taxClassificarMercado(tipoPapel, modalidade) {
  const tp = String(tipoPapel || '').toUpperCase();
  const mod = String(modalidade || '').toUpperCase();

  // FII (fundos imobiliários) — sem isenção de R$ 20k
  if (tp.includes('FII') || tp.includes('IMOBILIARIO') || tp.includes('IMOBILIÁRIO')) return 'FII';
  // ETF — sem isenção de R$ 20k
  if (tp.includes('ETF') || tp.includes('ÍNDICE') || tp.includes('INDICE')) return 'ETF';
  // Day Trade — detectado pela modalidade (evita falso-positivo com 'DT' solto)
  if (/\bDAY\b/.test(mod) || /\bDT\b/.test(mod) || mod.includes('DAY TRADE') || mod.includes('DAY-TRADE')) return 'DT';
  // Padrão: swing trade em ações
  return 'SWING';
}

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

  /**
   * Localiza o índice (0-based) de uma coluna a partir dos ALIASES configurados.
   * Estratégia: (1) match EXATO normalizado; (2) match por inclusão normalizada.
   * @param {Array} headers cabeçalho da linha 1.
   * @param {Array<string>} aliases nomes aceitos.
   * @return {number} índice 0-based ou -1.
   */
  _indiceColuna(headers, aliases) {
    if (!Array.isArray(headers) || !Array.isArray(aliases)) return -1;
    const normalizados = headers.map(h => taxNormalizarCabecalho(h));
    for (const alias of aliases) {
      const alvo = taxNormalizarCabecalho(alias);
      if (!alvo) continue;
      const exato = normalizados.indexOf(alvo);
      if (exato !== -1) return exato;
    }
    for (const alias of aliases) {
      const alvo = taxNormalizarCabecalho(alias);
      if (!alvo) continue;
      const parcial = normalizados.findIndex(n => n && n.indexOf(alvo) === 0);
      if (parcial !== -1) return parcial;
    }
    return -1;
  }

  /** Monta o mapa {CAMPO: índice} a partir do cabeçalho real. */
  _mapearColunas(headers) {
    const mapa = {};
    Object.entries(TAX_CONFIG.COL_NAMES).forEach(([campo, aliases]) => {
      mapa[campo] = this._indiceColuna(headers, aliases);
    });
    return mapa;
  }

  /**
   * Acumula 'Vendas no Mês (Tipo Ação)' respeitando MODO_VENDAS_MES.
   * 'max' (padrão) = a fonte repete o total do mês em cada linha.
   * 'soma'         = a fonte traz o valor incremental por nota.
   */
  _acumularVendas(acumulado, valorLinha) {
    if (!valorLinha) return acumulado;
    if (TAX_CONFIG.MODO_VENDAS_MES === 'soma') return acumulado + valorLinha;
    return Math.max(acumulado, valorLinha);
  }

  _lerEAgregar() {
    const sheet = this.ss.getSheetByName(TAX_CONFIG.SHEETS.SOURCE);
    if (!sheet) throw new Error(`Aba '${TAX_CONFIG.SHEETS.SOURCE}' não encontrada.`);

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data[0];

    // Mapeamento dinâmico por ALIASES (tolerante a acentos/variações)
    this.map = this._mapearColunas(headers);

    if (this.map.LUCRO_PREJUIZO === -1 || this.map.MES_REF === -1) {
      throw new Error(
        "Colunas críticas não encontradas na aba '" + TAX_CONFIG.SHEETS.SOURCE +
        "'. Esperado: 'Lucro/Prejuízo' e 'Mês Referência'. " +
        "Cabeçalho lido: " + headers.filter(h => h !== '').join(' | ')
      );
    }

    const meses = {};
    const avisos = [];

    // =======================================================================
    // 1. AGREGAÇÃO POR MÊS × MERCADO (SWING | DT | FII | ETF)
    // =======================================================================
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const mesRef = row[this.map.MES_REF];
      if (mesRef === '' || mesRef === null || mesRef === undefined) continue;

      const chaveMes = taxChaveMes(mesRef);
      if (!chaveMes) {
        avisos.push(`Linha ${i + 1}: 'Mês Referência' não interpretável ("${mesRef}").`);
        continue;
      }

      if (!meses[chaveMes]) {
        const partes = chaveMes.split('-');
        meses[chaveMes] = {
          chave: chaveMes,
          ano: parseInt(partes[0], 10),
          mes: parseInt(partes[1], 10),
          // Resultado bruto da fonte (coluna 'Lucro/Prejuízo'), por mercado
          resSwing: 0, resDT: 0, resFII: 0, resETF: 0,
          // Vendas por mercado (isenção dos R$ 20k = SÓ ações)
          vendasAcoes: 0, vendasFII: 0, vendasETF: 0,
          // IR retido na fonte, segregado por mercado
          irFonteSwing: 0, irFonteDT: 0, irFonteFII: 0, irFonteETF: 0,
          irFonteTotal: 0,
          custosTotais: 0
        };
      }
      const m = meses[chaveMes];
      const alias = k => (this.map[k] > -1 ? row[this.map[k]] : '');

      const lucro = taxParaNumero(alias('LUCRO_PREJUIZO'));
      const mercado = taxClassificarMercado(alias('TIPO_PAPEL'), alias('MODALIDADE'));
      const vendasLinha = taxParaNumero(alias('VENDAS_MES'));

      // IR-Fonte: prioriza as colunas SEGREGADAS; cai no genérico se vazias.
      const irNormal   = taxParaNumero(alias('IR_NORMAL'));
      const irDT       = taxParaNumero(alias('IR_DAY_TRADE'));
      const irFII      = taxParaNumero(alias('IR_FII'));
      const irETF      = taxParaNumero(alias('IR_ETF'));
      const irGenerico = taxParaNumero(alias('IR_FONTE'));
      const temSegregado = (irNormal + irDT + irFII + irETF) !== 0;

      if (mercado === 'FII') {
        m.resFII += lucro;
        m.vendasFII = Math.max(m.vendasFII, vendasLinha);
        m.irFonteFII += temSegregado ? irFII : irGenerico;
      } else if (mercado === 'ETF') {
        m.resETF += lucro;
        m.vendasETF = Math.max(m.vendasETF, vendasLinha);
        m.irFonteETF += temSegregado ? irETF : irGenerico;
      } else if (mercado === 'DT') {
        m.resDT += lucro;
        m.irFonteDT += temSegregado ? irDT : irGenerico;
      } else {
        m.resSwing += lucro;
        m.vendasAcoes = this._acumularVendas(m.vendasAcoes, vendasLinha);
        m.irFonteSwing += temSegregado ? irNormal : irGenerico;
      }

      m.irFonteTotal += irGenerico; // auditoria (soma da coluna 'IR na Fonte')
      m.custosTotais += taxParaNumero(alias('CUSTO_CORRETAGEM')) +
                        taxParaNumero(alias('EMOLUMENTOS')) +
                        taxParaNumero(alias('ISS')) +
                        taxParaNumero(alias('TAXA_TTA'));
    }

    if (avisos.length > 0) {
      console.warn(`⚠️ [TaxProcessor] ${avisos.length} linha(s) ignorada(s):`);
      avisos.slice(0, 10).forEach(a => console.warn('   • ' + a));
    }

    return this._apurarImpostos(meses);
  }

  /**
   * Motor de apuração cronológica. Ordem legal aplicada por mês e por mercado:
   *   1) resultado do mês entra no pool de prejuízo
   *   2) abate pool de prejuízo anterior (somente se houver base tributável)
   *   3) isenção dos R$ 20k (SÓ ações, SÓ swing) — em mês isento o prejuízo NÃO é abatido
   *   4) imposto bruto pela alíquota do mercado
   *   5) abate crédito de IR acumulado + IR-Fonte DO MESMO MERCADO
   *   6) IR retido a maior vira crédito futuro (não é perdido)
   *   7) mínimo de R$ 10 (o excedente arrasta para o mês seguinte)
   * @param {Object} meses mapa {AAAA-MM: bucket bruto}.
   * @return {Array<Object>} histórico mensal ordenado cronologicamente.
   */
  _apurarImpostos(meses) {
    const chavesOrdenadas = Object.keys(meses).sort();

    // Pools de prejuízo — SEMPRE valores positivos (a compensar)
    const prejuizo = { SWING: 0, DT: 0, FII: 0, ETF: 0 };
    // Crédito de IR retido a maior, ainda não compensado
    const creditoIr = { SWING: 0, DT: 0, FII: 0, ETF: 0 };
    let darfArrastado = 0;

    const resultadoFinal = [];

    for (const k of chavesOrdenadas) {
      const m = meses[k];
      const apuracao = {};

      const resultados = { SWING: m.resSwing, DT: m.resDT, FII: m.resFII, ETF: m.resETF };
      const irFonteMercado = {
        SWING: m.irFonteSwing, DT: m.irFonteDT, FII: m.irFonteFII, ETF: m.irFonteETF
      };
      const aliquotas = {
        SWING: TAX_CONFIG.ALIQUOTA_SWING,
        DT: TAX_CONFIG.ALIQUOTA_DT,
        FII: TAX_CONFIG.ALIQUOTA_FII,
        ETF: TAX_CONFIG.ALIQUOTA_ETF
      };

      // ---- Passo 1: o prejuízo do mês alimenta o pool ----
      TAX_MERCADOS.forEach(mk => {
        if (resultados[mk] < 0) prejuizo[mk] += Math.abs(resultados[mk]);
      });

      // ---- Passos 2, 3, 4 e 5 ----
      TAX_MERCADOS.forEach(mk => {
        let base = resultados[mk];
        let abatido = 0;
        let isento = false;

        if (base > 0) {
          if (mk === 'SWING' && m.vendasAcoes > 0 &&
              m.vendasAcoes < TAX_CONFIG.ISENCAO_VENDAS_ACOES) {
            isento = true; // ganho isento: prejuízo acumulado NÃO é consumido
          } else if (prejuizo[mk] > 0) {
            abatido = Math.min(base, prejuizo[mk]);
            base -= abatido;
            prejuizo[mk] -= abatido;
          }
        }

        const impostoBruto = (base > 0 && !isento) ? base * aliquotas[mk] : 0;

        let impostoDevido = impostoBruto;
        let creditoUsado = 0;
        let irFonteUsado = 0;

        if (impostoDevido > 0) {
          creditoUsado = Math.min(impostoDevido, creditoIr[mk]);
          impostoDevido -= creditoUsado;
          creditoIr[mk] -= creditoUsado;
        }
        if (impostoDevido > 0) {
          irFonteUsado = Math.min(impostoDevido, irFonteMercado[mk]);
          impostoDevido -= irFonteUsado;
        }

        // IR retido a maior => crédito para meses futuros do MESMO mercado
        const irFonteSobra = Math.max(0, irFonteMercado[mk] - irFonteUsado);
        if (irFonteSobra > 0) creditoIr[mk] += irFonteSobra;

        apuracao[mk] = {
          mercado: mk,
          resultado: resultados[mk],
          prejuizoAbatido: abatido,
          baseTributavel: base > 0 ? base : 0,
          isento: isento,
          aliquota: aliquotas[mk],
          impostoBruto: impostoBruto,
          creditoUsado: creditoUsado,
          irFonte: irFonteMercado[mk],
          irFonteUsado: irFonteUsado,
          irFonteSobra: irFonteSobra,
          impostoDevido: impostoDevido,
          creditoFinal: creditoIr[mk]
        };
      });

      // ---- Passo 6 e 7: DARF do mês + mínimo de R$ 10 com arraste ----
      const impostoMes = TAX_MERCADOS.reduce((s, mk) => s + apuracao[mk].impostoDevido, 0);
      const arrasteAnterior = darfArrastado;
      const totalComArraste = impostoMes + arrasteAnterior;

      let valorDARF = 0;
      let statusDARF = 'OK';
      if (totalComArraste >= TAX_CONFIG.MINIMO_DARF) {
        valorDARF = totalComArraste;
        darfArrastado = 0;
        statusDARF = 'A PAGAR';
      } else if (totalComArraste > 0) {
        valorDARF = totalComArraste; // exibido para conferência, mas NÃO pago
        darfArrastado = totalComArraste;
        statusDARF = 'ACUMULAR';
      }

      // ---- Consolidação do registro mensal ----
      m.prejuSwingFinal = prejuizo.SWING;
      m.prejuDTFinal = prejuizo.DT;
      m.prejuFIIFinal = prejuizo.FII;
      m.prejuETF = prejuizo.ETF;

      m.creditoSwing = creditoIr.SWING;
      m.creditoDT = creditoIr.DT;
      m.creditoFII = creditoIr.FII;
      m.creditoETF = creditoIr.ETF;

      m.detalhe = apuracao;
      m.impostoBruto = TAX_MERCADOS.reduce((s, mk) => s + apuracao[mk].impostoBruto, 0);
      m.impostoDevidoMes = impostoMes;
      m.darfArrastadoAnterior = arrasteAnterior;
      m.valorDARF = valorDARF;
      m.statusDARF = statusDARF;
      m.irFonteCompensado = TAX_MERCADOS.reduce((s, mk) => s + apuracao[mk].irFonteUsado, 0);
      m.creditoIRGerado = TAX_MERCADOS.reduce((s, mk) => s + apuracao[mk].irFonteSobra, 0);
      m.prejuizoAcumuladoTotal = prejuizo.SWING + prejuizo.DT + prejuizo.FII + prejuizo.ETF;
      m.prejuizoAbatidoTotal = TAX_MERCADOS.reduce((s, mk) => s + apuracao[mk].prejuizoAbatido, 0);

      resultadoFinal.push(m);
    }

    return resultadoFinal;
  }


  _escreverRelatorios(dados) {
  this._escreverDARFMensal(dados);
  this._escreverResumoAnual(dados);
  this._escreverResumoExecutivo(dados); // Garante a execução do resumo
}

  /**
   * Resumo Executivo — painel de 1 clique sobre o mês mais recente E o acumulado
   * do ano. Corrige o rótulo enganoso "DARF A PAGAR" (que exibia o valor
   * acumulado/arrastado como se fosse dívida do mês).
   */
  _escreverResumoExecutivo(dados) {
    const sheet = this.ss.getSheetByName(TAX_CONFIG.SHEETS.TARGET_EXEC);
    if (!sheet) return;

    const ultimo = dados[dados.length - 1];
    if (!ultimo) return;

    const mesFormatado = (isNaN(ultimo.mes) || isNaN(ultimo.ano))
      ? "Aguardando Dados"
      : `${String(ultimo.mes).padStart(2, '0')}/${ultimo.ano}`;

    const agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    const det = ultimo.detalhe || {};

    // Acumulado do ano do último mês processado
    const doAno = dados.filter(d => d.ano === ultimo.ano);
    const somaAno = campo => doAno.reduce((s, d) => s + (d[campo] || 0), 0);

    const valor = mk => (det[mk] ? det[mk].resultado : 0);
    const base = mk => (det[mk] ? det[mk].baseTributavel : 0);
    const imp = mk => (det[mk] ? det[mk].impostoBruto : 0);
    const abat = mk => (det[mk] ? det[mk].prejuizoAbatido : 0);
    const isento = mk => (det[mk] && det[mk].isento ? "ISENTO (vendas < R$ 20k)" : "TRIBUTADO");

    const matrizResumo = [
      ["GERADO EM", agora],
      ["MÊS DE REFERÊNCIA", mesFormatado],

      ["── RESULTADO DO MÊS ──", ""],
      ["Resultado Swing (ações)", valor('SWING')],
      ["Resultado Day Trade", valor('DT')],
      ["Resultado FII", valor('FII')],
      ["Resultado ETF", valor('ETF')],
      ["RESULTADO LÍQUIDO DO MÊS", ultimo.resSwing + ultimo.resDT + ultimo.resFII + ultimo.resETF],

      ["── BASES TRIBUTÁVEIS ──", ""],
      ["Base Swing (após compensação)", base('SWING')],
      ["Base Day Trade (após compensação)", base('DT')],
      ["Base FII (após compensação)", base('FII')],
      ["Base ETF (após compensação)", base('ETF')],
      ["Situação do Swing (açőes)", isento('SWING')],

      ["── IMPOSTO ──", ""],
      ["Imposto Bruto Swing (15%)", imp('SWING')],
      ["Imposto Bruto Day Trade (20%)", imp('DT')],
      ["Imposto Bruto FII (20%)", imp('FII')],
      ["Imposto Bruto ETF (15%)", imp('ETF')],
      ["IMPOSTO DEVIDO NO MÊS", ultimo.impostoDevidoMes || 0],
      ["IR-Fonte compensado no mês", ultimo.irFonteCompensado || 0],
      ["Arraste de meses anteriores", ultimo.darfArrastadoAnterior || 0],
      ["VALOR DA DARF DO MÊS", ultimo.statusDARF === 'A PAGAR' ? ultimo.valorDARF : 0],
      ["Situação", ultimo.statusDARF],

      ["── SALDOS A COMPENSAR ──", ""],
      ["Prejuízo Acumulado Swing", ultimo.prejuSwingFinal || 0],
      ["Prejuízo Acumulado Day Trade", ultimo.prejuDTFinal || 0],
      ["Prejuízo Acumulado FII", ultimo.prejuFIIFinal || 0],
      ["Prejuízo Acumulado ETF", ultimo.prejuETF || 0],
      ["PREJUÍZO TOTAL A COMPENSAR", ultimo.prejuizoAcumuladoTotal || 0],
      ["Crédito de IR a compensar (total)", (ultimo.creditoSwing || 0) + (ultimo.creditoDT || 0) +
                                             (ultimo.creditoFII || 0) + (ultimo.creditoETF || 0)],

      ["── ACUMULADO DO ANO ──", `${ultimo.ano}`],
      ["Vendas de ações no mês", ultimo.vendasAcoes || 0],
      ["Imposto bruto total do ano", somaAno('impostoBruto')],
      ["DARF total paga no ano", doAno
        .filter(d => d.statusDARF === 'A PAGAR')
        .reduce((s, d) => s + (d.valorDARF || 0), 0)],
      ["Prejuízo abatido no ano", somaAno('prejuizoAbatidoTotal')]
    ];

    // Cabeçalho
    sheet.getRange(1, 1, 1, 2).setValues([["INDICADOR", "VALOR"]])
      .setFontWeight("bold").setBackground("#0c343d").setFontColor("white");
    sheet.getRange(2, 1, matrizResumo.length, 2).setValues(matrizResumo);

    // Formatação em lote (não célula a célula)
    const formatos = matrizResumo.map(r => ['@', '@']);
    const negritos = matrizResumo.map(r => [false, false]);
    const fundos = matrizResumo.map(r => [null, null]);

    matrizResumo.forEach((linha, i) => {
      const rotulo = linha[0];
      const ehSecao = rotulo.indexOf('──') === 0;
      const ehDestaque = /^(RESULTADO LÍQUIDO|IMPOSTO DEVIDO|VALOR DA DARF|PREJUÍZO TOTAL|Crédito de IR|Base |Prejuízo Acumulado|Imposto Bruto|Situação do|Vendas de)/.test(rotulo);

      if (ehSecao) {
        negritos[i] = [true, true];
        fundos[i] = ["#d9e2f3", "#d9e2f3"];
        return;
      }
      negritos[i] = [ehDestaque, ehDestaque];

      // Coluna B com formato numérico (exceto textos de situação/data)
      if (typeof linha[1] === 'number') {
        const ehPercentual = false;
        formatos[i] = ['@', ehPercentual ? '0.00%' : '"R$ "#,##0.00'];
      }
      // Semaforização do resultado/imposto
      if (/^(RESULTADO LÍQUIDO|IMPOSTO DEVIDO|VALOR DA DARF|Imposto Bruto)/.test(rotulo)) {
        fundos[i] = [null, linha[1] > 0 ? "#f4cccc" : "#d9ead3"];
      }
    });

    const rangeTotal = sheet.getRange(2, 1, matrizResumo.length, 2);
    rangeTotal.setNumberFormats(formatos);
    rangeTotal.setFontWeights(negritos);
    rangeTotal.setBackgrounds(fundos);
    sheet.getRange(2, 2).setFontColor("#666666");
    sheet.setColumnWidth(1, 300);
    sheet.setColumnWidth(2, 200);

    console.log("✅ Aba Resumo_Executivo_IRPF atualizada com sucesso.");
  }

  /**
   * DARF_Mensal — 23 colunas com trilha de auditoria completa, cabeçalho
   * garantido, formatação em lote e bloco de TOTAIS por ano.
   */
  _escreverDARFMensal(dados) {
    const sheet = this.ss.getSheetByName(TAX_CONFIG.SHEETS.TARGET_DARF);
    if (!sheet) return;

    const headers = [
      "Mês/Ano", "Vendas Ações (R$)",
      "Result. Swing", "Prej. Abatido Swing", "Base Swing", "Imposto Swing 15%",
      "Result. Day Trade", "Prej. Abatido DT", "Base DT", "Imposto DT 20%",
      "Result. FII", "Prej. Abatido FII", "Base FII", "Imposto FII 20%",
      "Result. ETF", "Base ETF", "Imposto ETF 15%",
      "Imposto Devido no Mês", "IR-Fonte Compensado", "Arraste Anterior",
      "Valor DARF do Mês", "Crédito IR Gerado", "Situação"
    ];
    const N = headers.length;

    // Cabeçalho (garantido a cada execução)
    sheet.getRange(1, 1, 1, N).setValues([headers])
      .setFontWeight("bold").setBackground("#0c343d").setFontColor("white")
      .setHorizontalAlignment("center").setWrap(true);
    sheet.setFrozenRows(1);

    // Limpa corpo e totalizadores anteriores
    const linhasAntigas = sheet.getLastRow() - 1;
    if (linhasAntigas > 0) {
      sheet.getRange(2, 1, linhasAntigas, N).clearContent().clearFormat().setBackground(null);
    }
    if (dados.length === 0) return;

    const rows = dados.map(d => {
      const det = d.detalhe || {};
      const g = mk => det[mk] || { resultado: 0, prejuizoAbatido: 0, baseTributavel: 0, impostoBruto: 0 };
      const sw = g('SWING'), dt = g('DT'), fii = g('FII'), etf = g('ETF');

      return [
        `${String(d.mes).padStart(2, '0')}/${d.ano}`,
        d.vendasAcoes || 0,
        sw.resultado, sw.prejuizoAbatido, sw.baseTributavel, sw.impostoBruto,
        dt.resultado, dt.prejuizoAbatido, dt.baseTributavel, dt.impostoBruto,
        fii.resultado, fii.prejuizoAbatido, fii.baseTributavel, fii.impostoBruto,
        etf.resultado, etf.baseTributavel, etf.impostoBruto,
        d.impostoDevidoMes || 0,
        d.irFonteCompensado || 0,
        d.darfArrastadoAnterior || 0,
        d.valorDARF || 0,
        d.creditoIRGerado || 0,
        d.statusDARF || 'OK'
      ];
    });

    const rangeDados = sheet.getRange(2, 1, rows.length, N);
    rangeDados.setValues(rows);

    // Formatação em lote: A e W são texto; o resto é monetário
    const formatos = rows.map(() => {
      const f = new Array(N).fill('"R$ "#,##0.00');
      f[0] = '@';
      f[N - 1] = '@';
      return f;
    });
    rangeDados.setNumberFormats(formatos);
    sheet.getRange(2, 1, rows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, N, rows.length, 1).setHorizontalAlignment("center");

    // Semaforização da coluna Situação
    const cores = rows.map(r => {
      const status = r[N - 1];
      const cor = status === 'A PAGAR' ? '#d9ead3' : (status === 'ACUMULAR' ? '#fff2cc' : '#f3f3f3');
      const linha = new Array(N).fill(null);
      linha[N - 1] = cor;
      return linha;
    });
    sheet.getRange(2, 1, rows.length, N).setBackgrounds(cores);

    // Bloco de totais por ano
    this._escreverTotaisAnuais(sheet, dados, N);

    console.log(`✅ DARF_Mensal atualizada: ${rows.length} meses, ${N} colunas.`);
  }

  /**
   * Acrescenta, abaixo da tabela mensal, os totais consolidados por ano.
   */
  _escreverTotaisAnuais(sheet, dados, nCols) {
    const anos = {};
    dados.forEach(d => {
      if (!anos[d.ano]) {
        anos[d.ano] = {
          vendas: 0, resultado: 0, base: 0, impostoDevido: 0,
          irCompensado: 0, darfPaga: 0, prejuizoAbatido: 0
        };
      }
      const a = anos[d.ano];
      const det = d.detalhe || {};
      const mk = ['SWING', 'DT', 'FII', 'ETF'];

      a.vendas += d.vendasAcoes || 0;
      a.resultado += mk.reduce((s, k) => s + (det[k] ? det[k].resultado : 0), 0);
      a.base += mk.reduce((s, k) => s + (det[k] ? det[k].baseTributavel : 0), 0);
      a.impostoDevido += d.impostoDevidoMes || 0;
      a.irCompensado += d.irFonteCompensado || 0;
      a.prejuizoAbatido += d.prejuizoAbatidoTotal || 0;
      if (d.statusDARF === 'A PAGAR') a.darfPaga += d.valorDARF || 0;
    });

    const listaAnos = Object.keys(anos).sort((a, b) => b - a);
    const inicio = dados.length + 3;

    const titulo = new Array(nCols).fill('');
    titulo[0] = "── TOTAIS POR ANO ──";

    const cabec = new Array(nCols).fill('');
    cabec[0] = "Ano";
    cabec[1] = "Vendas Ações";
    cabec[5] = "Base Tributável";
    cabec[9] = "Imposto Devido";
    cabec[17] = "Resultado do Ano";
    cabec[18] = "IR-Fonte Comp.";
    cabec[20] = "DARF Paga";
    cabec[22] = "Prej. Abatido";

    const blocos = [titulo, cabec];
    listaAnos.forEach(ano => {
      const a = anos[ano];
      const l = new Array(nCols).fill('');
      l[0] = `TOTAL ${ano}`;
      l[1] = a.vendas;
      l[5] = a.base;
      l[9] = a.impostoDevido;
      l[17] = a.resultado;
      l[18] = a.irCompensado;
      l[20] = a.darfPaga;
      l[22] = a.prejuizoAbatido;
      blocos.push(l);
    });

    sheet.getRange(inicio, 1, blocos.length, nCols).setValues(blocos);
    sheet.getRange(inicio, 1, 1, nCols).setFontWeight("bold").setBackground("#d9e2f3");
    sheet.getRange(inicio + 1, 1, blocos.length - 1, nCols)
      .setFontWeight("bold").setBackground("#f3f3f3");

    if (listaAnos.length > 0) {
      const fmt = listaAnos.map(() => {
        const f = new Array(nCols).fill('"R$ "#,##0.00');
        f[0] = '@';
        return f;
      });
      sheet.getRange(inicio + 2, 1, listaAnos.length, nCols).setNumberFormats(fmt);
    }
  }


  /**
   * IRPF_Resumo_Anual — resumo mensal auditável (21 colunas) com semaforização.
   */
  _escreverResumoAnual(dados) {
    const sheet = this.ss.getSheetByName(TAX_CONFIG.SHEETS.TARGET_ANUAL);
    if (!sheet) return;

    const headers = [
      "Ano", "Mês", "Mês/Ano",
      "Result. Swing", "Base Swing", "Imp. Swing 15%",
      "Result. DT", "Base DT", "Imp. DT 20%",
      "Result. FII", "Base FII", "Imp. FII 20%",
      "Result. ETF", "Base ETF", "Imp. ETF 15%",
      "Prejuízo SWING", "Prejuízo DT", "Prejuízo FII",
      "IR-Fonte Compensado", "Valor DARF", "Situação"
    ];
    const N = headers.length;

    sheet.getRange(1, 1, 1, N).setValues([headers])
      .setFontWeight("bold").setBackground("#0c343d").setFontColor("white")
      .setHorizontalAlignment("center").setWrap(true);
    sheet.setFrozenRows(1);

    const linhasAntigas = sheet.getLastRow() - 1;
    if (linhasAntigas > 0) {
      sheet.getRange(2, 1, linhasAntigas, N).clearContent().clearFormat().setBackground(null);
    }
    if (dados.length === 0) return;

    const rows = dados.map(d => {
      const det = d.detalhe || {};
      const g = mk => det[mk] || { resultado: 0, baseTributavel: 0, impostoBruto: 0 };
      const sw = g('SWING'), dt = g('DT'), fii = g('FII'), etf = g('ETF');

      return [
        d.ano, d.mes, `${String(d.mes).padStart(2, '0')}/${d.ano}`,
        sw.resultado, sw.baseTributavel, sw.impostoBruto,
        dt.resultado, dt.baseTributavel, dt.impostoBruto,
        fii.resultado, fii.baseTributavel, fii.impostoBruto,
        etf.resultado, etf.baseTributavel, etf.impostoBruto,
        d.prejuSwingFinal || 0, d.prejuDTFinal || 0, d.prejuFIIFinal || 0,
        d.irFonteCompensado || 0, d.valorDARF || 0, d.statusDARF || 'OK'
      ];
    });

    const rangeDados = sheet.getRange(2, 1, rows.length, N);
    rangeDados.setValues(rows);

    // Formatação em lote
    const formatos = rows.map(() => {
      const f = new Array(N).fill('"R$ "#,##0.00');
      f[0] = '0';
      f[1] = '00';
      f[2] = '@';
      f[N - 1] = '@';
      return f;
    });
    rangeDados.setNumberFormats(formatos);
    sheet.getRange(2, 1, rows.length, 3).setHorizontalAlignment("center");
    sheet.getRange(2, N, rows.length, 1).setHorizontalAlignment("center");

    // Semaforização
    const cores = rows.map(r => {
      const status = r[N - 1];
      const cor = status === 'A PAGAR' ? '#d9ead3' : (status === 'ACUMULAR' ? '#fff2cc' : '#f3f3f3');
      const linha = new Array(N).fill(null);
      linha[N - 1] = cor;
      return linha;
    });
    sheet.getRange(2, 1, rows.length, N).setBackgrounds(cores);

    console.log(`✅ IRPF_Resumo_Anual atualizada: ${rows.length} meses, ${N} colunas.`);
  }
}

/**
 * Retorna a posição da carteira em 31/12 do ano informado, para a ficha de
 * Bens e Direitos do IRPF. Percorre as notas cronologicamente atualizando
 * QUANTIDADE, CUSTO MÉDIO e CUSTO TOTAL por ticker.
 *
 * Regra: compras aumentam o custo médio ponderado; vendas reduzem a
 * quantidade AO CUSTO MÉDIO (sem alterar o preço médio remanescente) —
 * exatamente como a RFB exige para a ficha de Bens e Direitos.
 *
 * @param {number} anoDataCorte ano de referência (posição em 31/12).
 * @return {Array<Object>} lista de posições abertas com quantidade e custo.
 */
function taxPosicaoBensEDireitos(anoDataCorte) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TAX_CONFIG.SHEETS.SOURCE);
  if (!sheet) throw new Error(`Aba '${TAX_CONFIG.SHEETS.SOURCE}' não encontrada.`);

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const map = new TaxProcessor()._mapearColunas(data[0]);
  if (map.PAPEL === -1 || map.DATA === -1) {
    throw new Error("Colunas 'Papel' e/ou 'Data' não encontradas nas Notas de Corretagem.");
  }

  const limites = new Date(anoDataCorte, 11, 31, 23, 59, 59);
  const carteira = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const papel = String(row[map.PAPEL] || '').trim().toUpperCase();
    if (!papel) continue;

    const dt = row[map.DATA];
    if (!(dt instanceof Date) || dt > limites) continue;

    const operacao = String(map.OPERACAO > -1 ? row[map.OPERACAO] : '').toUpperCase();
    const qtdMov = Math.abs(taxParaNumero(map.QUANTIDADE > -1 ? row[map.QUANTIDADE] : 0));
    if (qtdMov <= 0) continue;

    if (!carteira[papel]) {
      carteira[papel] = {
        ticker: papel,
        tipo: String(map.TIPO_PAPEL > -1 ? row[map.TIPO_PAPEL] : '').trim(),
        quantidade: 0,
        custoTotal: 0
      };
    }
    const pos = carteira[papel];

    // Custo unitário: prioriza 'Custo Total'/'Quantidade'; fallback 'Preço'
    const custoTotalMov = Math.abs(taxParaNumero(map.CUSTO_TOTAL > -1 ? row[map.CUSTO_TOTAL] : 0));
    const precoUnit = Math.abs(taxParaNumero(map.PRECO > -1 ? row[map.PRECO] : 0));
    const custoUnit = (custoTotalMov > 0 && qtdMov > 0) ? custoTotalMov / qtdMov : precoUnit;

    if (operacao.indexOf('COMPRA') !== -1) {
      pos.quantidade += qtdMov;
      pos.custoTotal += custoUnit * qtdMov;
    } else if (operacao.indexOf('VENDA') !== -1) {
      const qtdBaixada = Math.min(pos.quantidade, qtdMov);
      if (pos.quantidade > 0) {
        const custoMedioAtual = pos.custoTotal / pos.quantidade;
        pos.custoTotal -= custoMedioAtual * qtdBaixada;
      }
      pos.quantidade -= qtdBaixada;
      if (pos.quantidade <= 0) { pos.quantidade = 0; pos.custoTotal = 0; }
    }
  }

  return Object.values(carteira)
    .filter(p => p.quantidade > 0)
    .map(p => ({
      ticker: p.ticker,
      tipo: p.tipo,
      quantidade: p.quantidade,
      custoMedio: p.custoTotal / p.quantidade,
      custoTotal: p.custoTotal
    }))
    .sort((a, b) => b.custoTotal - a.custoTotal);
}

// =============================================================================
// ADAPTADOR GLOBAL (A PEÇA QUE FALTAVA)
// =============================================================================
// Este objeto conecta o Motor (TaxProcessor) com a Interface (DARFGenerator)
var TaxCalculator = {

  /**
   * Calcula o imposto de um mês específico, processando todo o histórico
   * para garantir que os prejuízos acumulados estejam corretos.
   *
   * Compatibilidade: mantém os campos legados `impostoTotal`, `lucroLiquido`
   * e `prejuizoAcumulado` (usados por 30_DARF_Generator) e ADICIONA o
   * detalhamento completo por mercado para relatórios e auditoria.
   *
   * @param {number} mes mês 1-12.
   * @param {number} ano ano com 4 dígitos.
   * @return {Object|null} detalhamento ou null se o mês não tiver notas.
   */
  calculateMonthlyTax: function(mes, ano) {
    try {
      const processador = new TaxProcessor();
      const historicoCompleto = processador.obterDadosMensais();

      const dadosMes = historicoCompleto.find(d => d.mes === mes && d.ano === ano);
      if (!dadosMes) return null;

      const det = dadosMes.detalhe || {};
      const mercados = ['SWING', 'DT', 'FII', 'ETF'];

      const detalhePorMercado = {};
      mercados.forEach(mk => {
        detalhePorMercado[mk] = det[mk] || {
          resultado: 0, prejuizoAbatido: 0, baseTributavel: 0,
          isento: false, aliquota: 0, impostoBruto: 0,
          irFonte: 0, irFonteUsado: 0, irFonteSobra: 0,
          impostoDevido: 0, creditoFinal: 0
        };
      });

      const lucroLiquido = mercados.reduce((s, mk) => s + detalhePorMercado[mk].resultado, 0);

      return {
        // ── Campos legados (contrato com 30_DARF_Generator) ──
        impostoTotal: dadosMes.statusDARF === 'A PAGAR' ? dadosMes.valorDARF : 0,
        lucroLiquido: lucroLiquido,
        prejuizoAcumulado: dadosMes.prejuizoAcumuladoTotal || 0,

        // ── Detalhamento novo ──
        mes: mes,
        ano: ano,
        statusDARF: dadosMes.statusDARF,
        valorDARF: dadosMes.valorDARF,
        impostoDevidoMes: dadosMes.impostoDevidoMes || 0,
        impostoBruto: dadosMes.impostoBruto || 0,
        irFonteCompensado: dadosMes.irFonteCompensado || 0,
        creditoIRGerado: dadosMes.creditoIRGerado || 0,
        darfArrastadoAnterior: dadosMes.darfArrastadoAnterior || 0,
        vendasAcoes: dadosMes.vendasAcoes || 0,
        detalhe: detalhePorMercado,
        // Saldos a compensar
        prejuizoSwing: dadosMes.prejuSwingFinal || 0,
        prejuizoDT: dadosMes.prejuDTFinal || 0,
        prejuizoFII: dadosMes.prejuFIIFinal || 0,
        prejuizoETF: dadosMes.prejuETF || 0,
        creditoSwing: dadosMes.creditoSwing || 0,
        creditoDT: dadosMes.creditoDT || 0,
        creditoFII: dadosMes.creditoFII || 0,
        creditoETF: dadosMes.creditoETF || 0
      };
    } catch (e) {
      console.error("Erro no TaxCalculator:", e);
      throw e;
    }
  },

  /**
   * Posição da carteira em 31/12 do ano informado (ficha de Bens e Direitos).
   * @param {number} ano ano de referência.
   * @return {Array<Object>} posições abertas com quantidade e custo.
   */
  getBensEDireitos: function(ano) {
    return taxPosicaoBensEDireitos(ano);
  },

  /**
   * Retorna o histórico mensal completo já apurado (sem escrever na planilha).
   * Útil para o validador (Arquivo 31) e para o dashboard anual.
   * @return {Array<Object>} histórico mensal.
   */
  getHistoricoApurado: function() {
    return new TaxProcessor().obterDadosMensais();
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
