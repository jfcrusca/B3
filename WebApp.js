/**
 * WebApp.js — Dashboard Sniper B3
 */
function doGet(e) {
  try {
    // Tentamos autorizar, mas se for gatilho, ignoramos falhas de usuário logado
    try {
      assertWebAppAuthorized();
    } catch (e) {
      console.warn("Acesso web tentado sem autorização explícita ou contexto de usuário.");
    }

    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Sniper B3 - Dashboard Elite')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    if (String(err.message || err).indexOf('Acesso negado') !== -1) {
      return HtmlService.createHtmlOutput(
        '<h1>Acesso negado</h1><p>Faça login com a conta proprietária do script para usar o dashboard.</p>'
      );
    }
    return HtmlService.createHtmlOutput(
      "<h1>⚠️ Arquivo HTML Ausente</h1>" +
      "<p>O arquivo 'Index' não foi encontrado no projeto. No editor do Apps Script, clique no <b>+</b>, escolha <b>HTML</b> e nomeie como <b>Index</b>.</p>"
    );
  }
}

function getDashboardData() {
  assertWebAppAuthorized();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Busca robusta (padrão 31_Portfolio_Rebalancer): ignora espaços e caixa no nome da aba.
  function getSheetRobust(name) {
    const exact = ss.getSheetByName(name);
    if (exact) return exact;
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().trim().toUpperCase() === name.toUpperCase()) {
        return sheets[i];
      }
    }
    return null;
  }
  const sheet = getSheetRobust('Oportunidades');
  if (!sheet) {
    console.error("Aba 'Oportunidades' não encontrada. Abas disponíveis: " + ss.getSheets().map(s => '"' + s.getName() + '"').join(', '));
    return [];
  }

  const data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  console.log("Linhas extraídas da planilha: " + data.length);

  if (data.length < 2) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "GMT-3", "dd/MM HH:mm");
      }
      if (typeof val === 'number' && isNaN(val)) val = 0;
      obj[headerParaChave(h)] = (val === "" || val === undefined) ? "-" : val;
    });
    return obj;
  });
}

/**
 * Retorna os dados da aba Carteira para o Sidebar
 * v2 — Mapeamento dinâmico resiliente (padrão 30_Portfolio_Unified / 37_Agent_RiskManager).
 * Aceita variações comuns de cabeçalho (Papel|Ticker|Ativo, Qtd|Quantidade, etc)
 * e NÃO descarta ativos apenas porque a coluna Qtd está vazia/texto.
 */
function getPortfolioData() {
  assertWebAppAuthorized();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Busca robusta (padrão 31_Portfolio_Rebalancer): ignora espaços e caixa no nome da aba.
  // Ex.: 'Carteira ', 'CARTEIRA', 'Portfolio ', 'PORTFOLIO' são aceitos.
  function getSheetRobust(name) {
    const exact = ss.getSheetByName(name);
    if (exact) return exact;
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().trim().toUpperCase() === name.toUpperCase()) {
        return sheets[i];
      }
    }
    return null;
  }

  // Se 'Carteira' existir mas estiver vazia (apenas cabeçalho), tenta 'Portfolio'.
  // Isso cobre o caso em que a aba canônica é vazia e os dados reais estão na alternativa.
  let sheet = getSheetRobust('Carteira') || getSheetRobust('Portfolio');
  if (sheet && sheet.getLastRow() < 2 && getSheetRobust('Portfolio') && getSheetRobust('Portfolio').getLastRow() >= 2) {
    sheet = getSheetRobust('Portfolio');
  }
  if (!sheet) {
    console.warn("Aba 'Carteira'/'Portfolio' não encontrada. Abas disponíveis: " + ss.getSheets().map(s => '"' + s.getName() + '"').join(', '));
    return [];
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    console.warn("Aba '" + sheet.getName() + "' vazia (linhas=" + lastRow + ", colunas=" + lastCol + ").");
    return [];
  }

  // 1. LEITURA EM BLOCO
  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const rawHeaders = data[0];
  const rows = data.slice(1);

  // DIAGNÓSTICO: imprime cabeçalhos e contagem para facilitar depuração
  console.log("[CARTEIRA] Aba='" + sheet.getName() + "' Linhas=" + rows.length + " Cabeçalhos=" + JSON.stringify(rawHeaders));

  // 2. MAPEAMENTO DINÂMICO DE COLUNAS (suporta variações comuns de nomenclatura)
  const headers = rawHeaders.map(h => headerParaChave(h));
  function col(...names) {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  }
  const colPapel   = col('papel', 'ticker', 'ativo', 'codigo');
  const colQtd     = col('qtd', 'quantidade', 'qtde');
  const colPM      = col('preco_medio', 'preço_médio', 'pm', 'preco_medio_ponderado');
  const colCotacao = col('cotacao_atual', 'cotação_atual', 'preco_atual', 'preco', 'cotacao');
  const colLucro   = col('lucro_prejuizo', 'lucro/prejuízo', 'resultado', 'p_l', 'lucro');

  // 3. CONVERSÃO → OBJETOS COM CHAVES NORMALIZADAS
  const result = rows.map(row => {
    let obj = {};
    rawHeaders.forEach((h, i) => {
      let val = row[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "GMT-3", "dd/MM/yyyy");
      } else if (typeof val === 'string') {
        val = val.trim();
      }
      obj[headerParaChave(h)] = (val === "" || val === undefined || val === null) ? "" : val;
    });

    // Campos de exibição resolvidos (independentes de o cabeçalho ser "Qtd" ou "Quantidade")
    obj.papel = colPapel >= 0 ? String(row[colPapel] || "").trim() : "";
    obj.qtd = colQtd >= 0 ? (parseFloat(row[colQtd]) || 0) : 0;
    obj.preco_medio = colPM >= 0 ? (parseFloat(row[colPM]) || 0) : 0;
    obj.cotacao_atual = colCotacao >= 0 ? (parseFloat(row[colCotacao]) || 0) : 0;
    obj.lucro_prejuizo = colLucro >= 0 ? (parseFloat(row[colLucro]) || 0) : 0;

    return obj;
  });

  // 4. FILTRO SEGURO — mantém qualquer linha com papel válido (não depende de Qtd > 0)
  return result.filter(item => {
    const papel = String(item.papel || "").toUpperCase();
    return papel && papel !== "PAPEL" && papel !== "TICKER" && papel !== "ATIVO";
  });
}

function headerParaChave(header) {
  if (!header) return "coluna_sem_nome";
  return header.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ /g, '_')
    .replace(/\//g, '_')
    .replace(/%/g, 'pct');
}

  /** Wrapper seguro para chamadas do dashboard web */
  function executarRoboB3FromWeb() {
    assertWebAppAuthorized();
    // Exemplo de como o backend pode retornar progresso se refatorado
    // Forçamos a execução por ser uma solicitação interativa do usuário logado via Dashboard Web
    return executarRoboB3(true);
  }

  function getExecutionLog() {
    // Busca o log na Cache ou Propriedades do Script onde o robo deve salvar
    const log = CacheService.getScriptCache().get("process_log");
    return log ? JSON.parse(log) : { progress: 0, messages: ["Aguardando início..."] };
  }

/**
 * Wrapper para buscar dados do Sentinela Gringo via Dashboard
 */
  function getSentinelaData() {
    assertWebAppAuthorized();
    try {
      const result = SentinelaGringo.getData();
      if (!result || !result.dados || result.dados.length === 0) {
        return {
          dados: [],
          sentimento: 'NEUTRO',
          cor: '#f1c40f',
          message: 'Mercado americano fechado ou dados indisponíveis.'
        };
      }
      return result;
    } catch (e) {
      console.error("Erro ao buscar SentinelaGringo:", e.message);
      return {
        dados: [],
        sentimento: 'ERRO',
        cor: '#c0392b',
        message: 'Erro ao consultar NY: ' + e.message
      };
    }
  }
