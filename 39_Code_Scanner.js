/**
 * @file 39_Code_Scanner.js
 * @description Scanner de integridade de código para o projeto B3-v10.
 * Detecta automaticamente o uso de funções legadas (como fetchCandles) e sugere 
 * a migração para métodos modernos (getHistory), garantindo a evolução do sistema. [5]
 * @version 1.0
 */

/**
 * Executa a varredura em todos os arquivos do projeto via API do Google Scripts.
 * @returns {Object} Relatório com o número de ocorrências encontradas ou erro. [6, 7]
 */
function validarChamadasLegadas() {
  try {
    const projectId = ScriptApp.getScriptId();
    const token = ScriptApp.getOAuthToken();
    const url = `https://script.googleapis.com/v1/projects/${projectId}/content`;

    // A requisição agora está dentro do try
    const res = UrlFetchApp.fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true // Evita que o fetch lance exceção em erros 4xx/5xx
    });

    if (res.getResponseCode() !== 200) {
      console.error('❌ Code Scanner: Erro na API do Script: ' + res.getContentText());
      return { findings: 0, error: true };
    }

    const content = JSON.parse(res.getContentText());
    const files = content.files || [];
    
    const rules = getLegacyRules();
    const findings = [];

    files.forEach(file => {
      // Analisamos apenas arquivos de script (.gs)
      if (file.type !== 'SERVER_JS') return;

      const source = file.source;
      rules.forEach(rule => {
        rule.regex.lastIndex = 0; // Reinicia o ponteiro para regex globais
        let match;
        
        while ((match = rule.regex.exec(source)) !== null) {
          // Calcula a linha contando quebras de linha até a posição do match
          const lineNum = source.substring(0, match.index).split('\n').length;
          const args = match[1] || "";
          const suggestion = rule.suggestExact ? rule.suggestExact(args) : {};

          findings.push({
            file: file.name,
            line: lineNum,
            snippet: match[0],
            rule: rule.id,
            description: rule.description,
            suggestion: rule.suggestion,
            exact: suggestion.exact || "",
            notes: suggestion.notes || ""
          });
        }
      });
    });

    logSummary(findings);
    writeReport(findings);

    return { findings: findings.length, error: false };

  } catch (e) {
    // Captura erros de rede, timeout ou permissão
    console.error('🔴 Falha crítica no Code Scanner: ' + e.message);
    if (typeof LogService !== 'undefined') {
      LogService.error('SCANNER', 'Falha na varredura de código: ' + e.message);
    }
    return { findings: 0, error: true };
  }
}

/**
 * Define as regras de detecção de código legado utilizando Regex.
 * @returns {Array<Object>} Lista de regras contendo regex, descrição e sugestão de correção. [8]
 */
function getLegacyRules() {
  return [
    {
      id: 'YF_fetchCandles',
      description: 'Uso legado de YahooFetcher.fetchCandles(...)',
      regex: /YahooFetcher\.fetchCandles\s*\(([^)]*)\)/g,
      suggestion: 'Trocar por YahooFetcher.getHistory(ticker, interval, range).',
      suggestExact: (args) => inferGetHistory(args)
    },
    {
      id: 'YF_fetchQuote',
      description: 'Uso legado de YahooFetcher.fetchQuote(...)',
      regex: /YahooFetcher\.fetchQuote\s*\(([^)]*)\)/g,
      suggestion: 'Trocar por YahooFetcher.getQuote(ticker).',
      suggestExact: (args) => ({ exact: `YahooFetcher.getQuote(${args})` })
    },
    {
      id: 'GAS_Loop_Set',
      description: 'Chamada de setBackground/setValue dentro de loop (Gargalo de Performance)',
      regex: /\.(?:setValues?|setBackgrounds?|setFontWeights?)\s*\(.*\)[\s\S]*?(?:for|while|forEach)/g,
      suggestion: 'Utilize matrizes 2D e aplique a formatação em lote (batch) fora do loop.',
      notes: 'Padrão detectado no Módulo 08 v12.0 para otimização.'
    },
    {
      id: 'UNSAFE_JSON_PARSE',
      description: 'JSON.parse direto em conteúdo de URL sem validação de tipo ou erro',
      regex: /JSON\.parse\s*\(\s*[a-zA-Z0-9_$]+\.getContentText\(\)\s*\)/g,
      suggestion: 'Validar getResponseCode() e conferir se o Content-Type é JSON antes do parse.',
      notes: 'Evita erros como o "Resposta XML inesperada" visto no log do BCB.'
    },
    {
      id: 'LEGACY_LOGGER',
      description: 'Uso de Logger.log em vez de AI_Logger',
      regex: /Logger\.log\s*\(/g,
      suggestion: 'Utilizar AI_Logger.info(), .warn() ou .error() para logs persistentes.',
      suggestExact: () => ({ exact: 'AI_Logger.info(' })
    },
    {
      id: 'MISSING_JSDOC',
      description: 'Função detectada sem documentação JSDoc (@param/@returns)',
      regex: /^(?!\/\*\*[\s\S]*?\*\/)\s*function\s+([a-zA-Z0-9_$]+)/gm,
      suggestion: 'Adicione um bloco de documentação /** ... */ acima da função para melhorar o suporte a tipos.',
      notes: 'Essencial para o funcionamento do IntelliSense e validação de contratos entre módulos.'
    },
    {
      id: 'COMPLEX_FUNCTION',
      description: 'Função possivelmente muito longa (mais de 80 linhas)',
      regex: /function\s+[a-zA-Z0-9_$]+\s*\([^)]*\)\s*\{[\s\S]{3000,}/g, 
      suggestion: 'Refatorar a função em submódulos menores para reduzir a complexidade detectada pelo analisador Python.',
      notes: 'O relatório apontou complexidade > 200 no Core_Analyzers.'
    },
    {
      id: 'COMPLEX_FUNCTION_SIZE',
      description: 'Função excessivamente longa (potencial complexidade alta)',
      regex: /function\s+[a-zA-Z0-9_$]+\s*\([^)]*\)\s*\{[\s\S]{3500,}/g, 
      suggestion: 'O arquivo Core_Analyzers atingiu complexidade 204. Quebre esta função em subtarefas.',
      notes: 'Funções com mais de 3500 caracteres de corpo costumam esconder múltiplos fluxos de decisão.'
    }
  ];
}

/**
 * Analisa os argumentos de uma função legada para sugerir a nova assinatura getHistory.
 * @param {string} argsText - Texto contendo os argumentos originais da função.
 * @returns {Object} Sugestão exata de código ou notas explicativas sobre a migração. [9, 10]
 */
function inferGetHistory(argsText) {
  const args = argsText.split(',').map(s => s.trim());
  if (args.length < 3) {
    return { notes: 'Não foi possível inferir. Assinatura correta: getHistory(ticker, interval, range).' };
  }
  const [ticker, a1, a2] = args;
  const a1i = isInterval(a1), a1r = isRange(a1);
  const a2i = isInterval(a2), a2r = isRange(a2);

  // Já correto
  if (a1i && a2r) {
    return { exact: `YahooFetcher.getHistory(${ticker}, ${a1}, ${a2})`, notes: 'Apenas troca do nome da função.' };
  }
  // Invertido (legado comum)
  if (a1r && a2i) {
    return { exact: `YahooFetcher.getHistory(${ticker}, ${a2}, ${a1})`, notes: 'Argumentos invertidos corrigidos.' };
  }
  return { notes: 'Ordem não inferida com segurança. Use getHistory(ticker, interval, range).' };
}

function isInterval(s) {
  return ['1m','2m','5m','15m','30m','60m','90m','1h','1d','5d','1wk','1mo','3mo']
    .includes(strip(s).toLowerCase());
}
function isRange(s) {
  return ['1d','5d','1mo','3mo','6mo','1y','2y','5y','ytd']
    .includes(strip(s).toLowerCase());
}
function strip(s) {
  const t = (s||'').trim();
  return (t.startsWith('"')||t.startsWith("'")) ? t.slice(1,-1) : t;
}

/**
 * Gera o relatório visual de validação na aba "Validação_Código".
 * @param {Array<Array>} rows - Linhas de dados contendo as falhas detectadas. [11, 12]
 */
function writeReport(rows) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Validação_Código');
  if (!sh) sh = ss.insertSheet('Validação_Código');
  sh.clear();

  const headers = ['Data/Hora','Arquivo','Linha','Trecho','Regra','Descrição','Sugestão','Sugestão Exata','Notas'];
  sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#EEEEEE');
  sh.setFrozenRows(1);

  if (rows.length) {
    const now = new Date();
    const data = rows.map(r => [now, r.file, r.line, r.snippet, r.rule, r.description, r.suggestion, r.exact, r.notes]);
    sh.getRange(2,1,data.length,headers.length).setValues(data);
    sh.getRange(2,1,data.length,1).setNumberFormat('dd/MM/yyyy HH:mm');
  }

  sh.setColumnWidths(1, headers.map((_,i)=>[150,220,60,600,140,280,360,360,360][i]));
}

function logSummary(rows) {
  console.log('='.repeat(50));
  console.log('🔎 Validação de Código — Resumo');
  if (!rows.length) {
    console.log('✅ Nenhuma chamada legada encontrada.');
    return;
  }
  const byRule = rows.reduce((a,r)=>{a[r.rule]=(a[r.rule]||0)+1;return a;},{});
  Object.keys(byRule).forEach(k=>console.log(`• ${k}: ${byRule[k]}`));
  console.log(`Total: ${rows.length}`);
}
``
