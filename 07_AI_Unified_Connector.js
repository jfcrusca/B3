/******************************************************************************
// 📦 MÓDULO/ARQUIVO: 07_AI_Unified_Connector.js
// 🛠️  TECNOLOGIA: JAVASCRIPT
// 📌  VERSÃO: 3.4 — DEEPSEEK + FALLBACK COMPLETO RESILIENTE
/******************************************************************************/

/**
 * CONECTOR CENTRAL DE IA
 * =============================================================================
 * ✅ Gemini (principal)
 * ✅ DeepSeek (fallback automático)
 * ✅ Retry inteligente
 * ✅ Sanitização JSON robusta
 * ✅ Controle de RateLimiter
 * ✅ Proteção contra travamento
 * =============================================================================
 */

const AI_Config = {
  DEFAULT_MODEL: "gemini-3.1-flash-lite",
  ADVANCED_MODEL: "gemini-3.5-flash",
  MAX_RETRIES: 2,
  TIMEOUT_MS: 30000
};

class AI_Connector {
  
  // ===============================
  // 🔐 CHAVES
  // ===============================

  static getGeminiKey() {
    let key = null;

    if (typeof SecureKeyService !== 'undefined') {
      key = SecureKeyService.getKey("GEMINI_API_KEY");
    }

    if (!key) {
      key = (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') ? CONFIG.getSecret("GEMINI_API_KEY") : null;
    }

    // 🔧 Normalização: remove espaços/quebras de linha que corrompem a autenticação
    if (key) key = String(key).trim().replace(/[\r\n]+/g, '');

    if (!key || key.includes("MIGRATED") || key.includes("YOUR_")) {
      throw new Error("❌ GEMINI_API_KEY inválida");
    }

    // 🔧 Diagnóstico seguro (NÃO expõe a chave completa)
    // Formatos válidos emitidos pelo Google AI Studio:
    //   'AIza...' — standard key (formato antigo)
    //   'AQ.xxx'  — authorization key / auth key (novo formato padrão, desde 2026)
    const prefixo = key.substring(0, 4);
    const tamanho = key.length;
    if (!/^(AIza|AQ\.)/i.test(key)) {
      console.warn(`⚠️ [AI_Connector] GEMINI_API_KEY com formato incomum (prefixo '${prefixo}', ${tamanho} chars). Formatos válidos: 'AIza...' (standard) ou 'AQ....' (auth key do AI Studio). Verifique o valor em ⚙️ Propriedades do Script.`);
    }

    return key;
  }

  static getDeepSeekKey() {
    let key = null;

    if (typeof SecureKeyService !== 'undefined') {
      key = SecureKeyService.getKey("DEEPSEEK_API_KEY");
    }

    if (!key) {
      key = (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') ? CONFIG.getSecret("DEEPSEEK_API_KEY") : null;
    }

    if (!key) {
      console.warn("⚠️ [DeepSeek] API Key ausente.");
      return null;
    }

    return key;
  }

  // ===============================
  // 🔁 FALLBACK CENTRALIZADO (NOVO)
  // ===============================

  static tryFallback(prompt, options) {
  console.warn("⚠️ [Fallback] Tentando DeepSeek...");

  try {
    const safeOptions = {
      ...options,
      model: "deepseek-chat"
    };

    const res = AI_Connector.callDeepSeek(prompt, safeOptions);

    if (res) {
      console.log("✅ [Fallback] DeepSeek respondeu com sucesso.");
      return res;
    }

    console.warn("⚠️ [Fallback] DeepSeek falhou.");
    return null;

  } catch (e) {
    console.error("❌ [Fallback] Erro DeepSeek:", e.message);
    return null;
  }
}

  // ===============================
  // 🧠 GEMINI (CONSTRUTOR DE REQUISIÇÃO)
  // ===============================

  static buildGeminiRequest(prompt, options = {}) {
    const model = options.model || (typeof CONFIG !== 'undefined' ? CONFIG.get('GEMINI_MODEL') : AI_Config.DEFAULT_MODEL);
    const temperature = options.temperature !== undefined ? options.temperature : 0.2;

    let apiKey;
    try {
      apiKey = this.getGeminiKey();
    } catch (e) {
      console.warn("⚠️ [AI_Connector] Gemini API Key inválida, não construindo requisição Gemini.");
      return null;
    }

    // 🔧 v3.5: chave na query string (?key=) E no header x-goog-api-key.
    // A query string evita o erro 401 ACCESS_TOKEN_TYPE_UNSUPPORTED quando o
    // Apps Script injeta o header Authorization (token OAuth do script) em
    // URLs *.googleapis.com, conflitando com a autenticação por API key.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 1024,
        response_mime_type: options.jsonMode ? "application/json" : "text/plain"
      }
    };

    // 🔧 v3.6: auth keys (prefixo 'AQ.') também serão tentadas via
    // header Authorization: Bearer, caso o backend rejeite o x-goog-api-key
    // com ACCESS_TOKEN_TYPE_UNSUPPORTED.
    const isAuthKey = /^AQ\./i.test(apiKey);

    return {
      url: url,
      params: {
        method: "post",
        contentType: "application/json",
        headers: { "x-goog-api-key": apiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        timeout: AI_Config.TIMEOUT_MS
      },
      type: 'GEMINI',
      isAuthKey: isAuthKey,
      apiKey: apiKey,
      prompt: prompt,
      options: options
    };
  }

  // ===============================
  // 🧠 GEMINI (COM FALLBACK)
  // ===============================

  static callGemini(prompt, options = {}) {
    const model = options.model || (typeof CONFIG !== 'undefined' ? CONFIG.get('GEMINI_MODEL') : AI_Config.DEFAULT_MODEL);
    const temperature = options.temperature !== undefined ? options.temperature : 0.2;

    const request = this.buildGeminiRequest(prompt, options);
    if (!request) {
      return this.tryFallback(prompt, options);
    }

    // 🔧 v3.6: modos de autenticação em cascata.
    // 'apiKey' = x-goog-api-key + query string ?key= (método oficial do SDK google-genai)
    // 'bearer' = Authorization: Bearer (alternativa p/ auth keys 'AQ.' rejeitadas no modo apiKey)
    const modos = request.isAuthKey ? ['apiKey', 'bearer'] : ['apiKey'];

    for (let m = 0; m < modos.length; m++) {
      const modo = modos[m];

      for (let i = 0; i < AI_Config.MAX_RETRIES; i++) {
        try {
          console.log(`📡 [Gemini] Enviando requisição (auth: ${modo})...`);

          let url = request.url;
          let params = request.params;

          if (modo === 'bearer') {
            // Remove a chave da query string e autentica apenas via header
            url = request.url.split('?key=')[0];
            params = Object.assign({}, request.params, {
              headers: { Authorization: 'Bearer ' + request.apiKey }
            });
          }

          const response = UrlFetchApp.fetch(url, params);

          const code = response.getResponseCode();
          const text = response.getContentText();

          if (code === 200) {
            const json = JSON.parse(text);

            if (json.candidates &&
                json.candidates[0] &&
                json.candidates[0].content &&
                json.candidates[0].content.parts &&
                json.candidates[0].content.parts[0]) {

              let output =
                json.candidates[0].content.parts[0].text ||
                JSON.stringify(json.candidates[0].content.parts[0]);

              console.log("✅ [Gemini] Resposta recebida.");
              return options.jsonMode
                ? this.cleanJsonBlock(output)
                : output;
            }

            console.error("❌ [Gemini] Estrutura inválida.");
            return this.tryFallback(prompt, options);

          } else if (code === 429) {
            console.warn(`⚠️ [Gemini] Rate limit tentativa ${i + 1}`);
            Utilities.sleep(Math.pow(2, i) * 1000);
            continue;

          } else if ((code === 401 || code === 403) && m < modos.length - 1) {
            // 🔧 Auth key rejeitada no modo atual: tenta o próximo modo de autenticação
            console.warn(`⚠️ [Gemini] HTTP ${code} no modo '${modo}'. Tentando autenticação alternativa...`);
            break;

          } else {
            console.error(`❌ [Gemini] HTTP ${code}: ${text}`);
            return this.tryFallback(prompt, options);
          }

        } catch (e) {
          console.error(`❌ [Gemini] Erro: ${e.message}`);
          Utilities.sleep(Math.pow(2, i) * 1000);
        }
      }
    }

    console.error("❌ [Gemini] Falha total.");
    return this.tryFallback(prompt, options);
  }

  // ===============================
  // 🧠 DEEPSEEK (CONSTRUTOR DE REQUISIÇÃO)
  // ===============================

  static buildDeepSeekRequest(prompt, options = {}) {
    const apiKey = this.getDeepSeekKey();
    if (!apiKey) {
      console.warn("⚠️ [AI_Connector] DeepSeek API Key ausente, não construindo requisição DeepSeek.");
      return null;
    }

    // Check daily limit before building the request for DeepSeek
    const bucketName = 'DEEPSEEK';
    const config = RateLimiter.CONFIG[bucketName];
    const cache = CacheService.getScriptCache();
    const counterKey = `rate_limit_count_${bucketName}`;
    if (Number(cache.get(counterKey)) >= config.dailyLimit) {
      console.warn(`⚠️ [AI_Connector] Limite diário de ${bucketName} atingido, não construindo requisição DeepSeek.`);
      return null;
    }

    const model = options.model || "deepseek-chat";
    const temperature = options.temperature !== undefined ? options.temperature : 0.2;

    const url = "https://api.deepseek.com/v1/chat/completions";

    const payload = { model: model, messages: [{ role: "system", content: "You are a professional trading analyst." }, { role: "user", content: prompt }], temperature: temperature, max_tokens: 1024 };

    return { url: url, params: { method: "post", contentType: "application/json", headers: { Authorization: `Bearer ${apiKey}` }, payload: JSON.stringify(payload), muteHttpExceptions: true, timeout: AI_Config.TIMEOUT_MS }, type: 'DEEPSEEK', prompt: prompt, options: options };
  }

  // ===============================
  // 🧠 DEEPSEEK (COM RATE LIMIT)
  // ===============================

  static callDeepSeek(prompt, options = {}) {
    const apiKey = this.getDeepSeekKey();
    if (!apiKey) return null;

    const model = options.model || "deepseek-chat";
    const temperature = options.temperature !== undefined ? options.temperature : 0.2;

    const url = "https://api.deepseek.com/v1/chat/completions";

    const payload = {
      model: model,
      messages: [
        { role: "system", content: "You are a professional trading analyst." },
        { role: "user", content: prompt }
      ],
      temperature: temperature,
      max_tokens: 1024
    };

    const params = {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: AI_Config.TIMEOUT_MS
    };

    return RateLimiter.execute('DEEPSEEK', () => {

      for (let i = 0; i < AI_Config.MAX_RETRIES; i++) {
        try {
          console.log("📡 [DeepSeek] Enviando requisição...");

          const response = UrlFetchApp.fetch(url, params);
          const code = response.getResponseCode();
          const text = response.getContentText();

          if (code === 200) {
            const json = JSON.parse(text);

            if (json.choices &&
                json.choices[0] &&
                json.choices[0].message) {

              console.log("✅ [DeepSeek] Resposta recebida.");

              let output = json.choices[0].message.content;

              if (options.jsonMode && (!output || output.trim() === "")) console.warn("⚠️ [DeepSeek] Conteúdo da mensagem vazio ou nulo recebido.");
              return options.jsonMode
                ? this.cleanJsonBlock(output)
                : output;
            }

            console.error("❌ [DeepSeek] Estrutura inválida.");
            return null;
          }

          if (code === 429) {
            console.warn("⚠️ [DeepSeek] Rate limit.");
            Utilities.sleep(Math.pow(2, i) * 1000);
            continue;
          }

          console.error(`❌ [DeepSeek] HTTP ${code}: ${text}`);
          return null;

        } catch (e) {
          console.error("❌ [DeepSeek] Erro:", e.message);
          Utilities.sleep(Math.pow(2, i) * 1000);
        }
      }

      console.error("❌ [DeepSeek] Falha total.");
      return null;

    });
  }

  // ===============================
  // 🧹 LIMPEZA DE JSON
  // ===============================

  static cleanJsonBlock(text) {
    if (!text || typeof text !== 'string') return null;

    let cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '') // Remove blocos de raciocínio da DeepSeek R1
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    let startIdx = -1;
    let endIdx = -1;

    if (firstBrace !== -1 && lastBrace !== -1 &&
        (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      endIdx = lastBrace + 1;
    } else if (firstBracket !== -1 && lastBracket !== -1) {
      startIdx = firstBracket;
      endIdx = lastBracket + 1;
    }

    if (startIdx === -1 || endIdx === -1) {
      console.error("❌ JSON não encontrado.");
      return null;
    }

    cleaned = cleaned.substring(startIdx, endIdx);

    try {
      return JSON.stringify(JSON.parse(cleaned));
    } catch (e) {
      cleaned = cleaned
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[\n\r\t]/g, ' ');

      try {
        return JSON.stringify(JSON.parse(cleaned));
      } catch (e2) {
        console.error("❌ JSON inválido.");
        return null;
      }
    }
  }
}




function TESTAR_DEEPSEEK() {
  const prompt = "Responda em JSON: {\"ok\": true}";
  
  const resultado = AI_Connector.callDeepSeek(prompt, {
    jsonMode: true
  });

  console.log("🧠 DeepSeek resposta:", resultado);
}

function TESTAR_DEEPSEEK_ISOLADO() {
  console.log("🚀 Teste DeepSeek iniciado");

  const res = AI_Connector.callDeepSeek(
    "Responda JSON: {\"ok\": true}",
    { jsonMode: true }
  );

  console.log("✅ Resultado DeepSeek:", res);
}



function TESTAR_CONEXAO_DEEPSEEK() {
  const apiKey = (typeof CONFIG !== 'undefined' && typeof CONFIG.getSecret === 'function') ? CONFIG.getSecret("DEEPSEEK_API_KEY") : null;

  const res = UrlFetchApp.fetch("https://api.deepseek.com/v1/models", {
    method: "get",
    headers: {
      Authorization: "Bearer " + apiKey
    },
    muteHttpExceptions: true
  });

  console.log("Status:", res.getResponseCode());
  console.log("Body:", res.getContentText());
}

/**
 * 🧭 Analisa o corpo de erro da API Gemini e orienta a correção.
 * @param {string} txt Corpo da resposta HTTP (JSON de erro).
 */
function _logErroGemini(txt) {
  if (!txt) return;
  console.error("   " + txt);

  if (txt.indexOf("API_KEY_SERVICE_BLOCKED") !== -1) {
    console.log("   👉 A chave de API é VÁLIDA, mas o serviço Generative Language API está BLOQUEADO para ela.");
    console.log("   🔧 SOLUÇÃO:");
    console.log("      1) Habilite a Generative Language API no projeto:");
    console.log("         https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com");
    console.log("         (selecione o projeto correto e clique em 'Habilitar/Enable')");
    console.log("      2) Confira as restrições da chave:");
    console.log("         https://console.cloud.google.com/apis/credentials → clique na chave → 'API restrictions'");
    console.log("         → marque 'Generative Language API' como permitida (ou 'Don't restrict key').");
    console.log("      3) No Google AI Studio (aistudio.google.com/apikey), confira se a chave não está 'Blocked'. Se estiver, gere outra.");
  } else if (txt.indexOf("API_KEY_INVALID") !== -1 || txt.indexOf("API key not valid") !== -1) {
    console.log("   👉 A chave de API é INVÁLIDA. Gere uma nova em https://aistudio.google.com/apikey");
  } else if (txt.indexOf("NOT_FOUND") !== -1) {
    console.log("   👉 Modelo não encontrado. Verifique o valor de GEMINI_MODEL configurado.");
  } else if (txt.indexOf("PERMISSION_DENIED") !== -1) {
    console.log("   👉 Permissão negada. Verifique a conta/projeto vinculado à chave de API.");
  } else if (txt.indexOf("API_KEY_INVALID") === -1 && txt.indexOf("429") === -1) {
    console.log("   👉 Verifique o erro acima no Google AI Studio / Cloud Console.");
  }
}

/**
 * 🧪 DIAGNÓSTICO DE CONEXÃO COM A API GEMINI
 * Executa testes de autenticação sem expor a chave completa.
 * Mostra: formato da chave, listagem de modelos e geração de conteúdo.
 */
function TESTAR_CONEXAO_GEMINI() {
  console.log("🚀 TESTE DE CONEXÃO GEMINI INICIADO");
  console.log("=".repeat(60));

  // 1. Verificação da chave (sem expor o valor completo)
  let key = null;
  try {
    key = AI_Connector.getGeminiKey();
  } catch (e) {
    console.error("❌ " + e.message);
    console.log("👉 Acesse ⚙️ Propriedades do Script e configure GEMINI_API_KEY com uma chave válida do https://aistudio.google.com/apikey");
    return;
  }

  const prefixo = key.substring(0, 4);
  const tamanho = key.length;
  const formatoValido = /^(AIza|AQ\.)/i.test(key);
  console.log(`🔑 Chave encontrada: prefixo '${prefixo}' | ${tamanho} caracteres | formato válido (AIza ou AQ.): ${formatoValido}`);
  if (!formatoValido) {
    console.warn("⚠️ ATENÇÃO: A chave tem formato incomum. Formatos válidos: 'AIza...' (standard) ou 'AQ....' (auth key do AI Studio).");
  }

  // 2. Teste de listagem de modelos (GET simples, valida a chave)
  console.log("\n1️⃣ Testando GET /models (valida a chave de API)...");
  try {
    const resLista = UrlFetchApp.fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(key),
      { method: "get", muteHttpExceptions: true }
    );
    console.log(`   Status HTTP: ${resLista.getResponseCode()}`);
    const txt = resLista.getContentText();
    if (resLista.getResponseCode() === 200) {
      const json = JSON.parse(txt);
      const modelos = (json.models || []).map(function(m) { return m.name; });
      console.log(`   ✅ Chave VÁLIDA! ${modelos.length} modelos disponíveis.`);
      console.log("   Exemplos: " + modelos.slice(0, 6).join(", "));
    } else {
      console.error("   ❌ Falha na autenticação:");
      _logErroGemini(txt);
    }
  } catch (e) {
    console.error("   ❌ Erro de rede: " + e.message);
  }

  // 3. Teste de geração de conteúdo (POST generateContent)
  console.log("\n2️⃣ Testando POST generateContent...");
  try {
    const model = (typeof CONFIG !== 'undefined' && CONFIG.get('GEMINI_MODEL')) || "gemini-2.0-flash-lite";
    let resGer = UrlFetchApp.fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key),
      {
        method: "post",
        contentType: "application/json",
        headers: { "x-goog-api-key": key },
        payload: JSON.stringify({ contents: [{ parts: [{ text: "Responda apenas: OK" }] }] }),
        muteHttpExceptions: true
      }
    );

    // 🔧 Auth key ('AQ.'): tenta Authorization: Bearer se rejeitada no modo apiKey
    if (/^AQ\./i.test(key) && (resGer.getResponseCode() === 401 || resGer.getResponseCode() === 403)) {
      console.warn("   ⚠️ Rejeitada com x-goog-api-key. Tentando Authorization: Bearer...");
      resGer = UrlFetchApp.fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
        {
          method: "post",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + key },
          payload: JSON.stringify({ contents: [{ parts: [{ text: "Responda apenas: OK" }] }] }),
          muteHttpExceptions: true
        }
      );
    }

    console.log(`   Modelo testado: ${model}`);
    console.log(`   Status HTTP: ${resGer.getResponseCode()}`);
    const txtGer = resGer.getContentText();
    if (resGer.getResponseCode() === 200) {
      console.log("   ✅ Geração de conteúdo funcionou!");
    } else {
      console.error("   ❌ Falha no modelo " + model + ":");
      _logErroGemini(txtGer);
    }
  } catch (e) {
    console.error("   ❌ Erro de rede: " + e.message);
  }

  console.log("\n✅ DIAGNÓSTICO GEMINI CONCLUÍDO");
}

/**
 * 🔑 CONFIGURA A CHAVE DE API GEMINI
 * Pede a chave ao usuário, valida o formato (AIza... ou AQ....),
 * salva nas Propriedades do Script e testa a conexão.
 */
function CONFIGURAR_GEMINI_KEY() {
  const ui = SpreadsheetApp.getUi();

  const resposta = ui.prompt(
    '🔑 Configurar Chave Gemini',
    'Cole a chave de API Gemini do Google AI Studio (https://aistudio.google.com/apikey).\n\n'
      + 'Formatos válidos: "AIza..." (standard key) ou "AQ...." (auth key, novo padrão).\n'
      + 'NÃO use tokens OAuth (prefixos "ya29", "ya32", "1//", etc.).',
    ui.ButtonSet.OK_CANCEL
  );

  if (resposta.getSelectedButton() !== ui.Button.OK) return;

  let novaChave = resposta.getResponseText().trim().replace(/[\r\n]+/g, '');

  if (!novaChave) {
    ui.alert('❌ Nenhuma chave informada.');
    return;
  }

  if (!/^(AIza|AQ\.)/i.test(novaChave)) {
    const confirmar = ui.alert(
      '⚠️ Formato Suspeito',
      'A chave informada tem formato incomum. Formatos válidos do Google AI Studio: "AIza..." (standard) ou "AQ...." (auth key).\n\nDeseja salvar mesmo assim?',
      ui.ButtonSet.YES_NO
    );
    if (confirmar !== ui.Button.YES) return;
  }

  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', novaChave);

  // Limpa o cache do Secrets Manager para não usar o valor antigo
  if (typeof Secrets !== 'undefined' && typeof Secrets.clearCache === 'function') {
    try { Secrets.clearCache(); } catch (e) {}
  }

  ui.alert('✅ Chave Gemini salva com sucesso! Executando teste de conexão...');

  try {
    TESTAR_CONEXAO_GEMINI();
  } catch (e) {
    console.error('❌ Erro no teste: ' + e.message);
  }
}

/**
 * 🔍 DIAGNÓSTICO DA ORIGEM DA CHAVE GEMINI
 * Mostra de onde o valor de GEMINI_API_KEY está vindo
 * (Script Properties, User Properties, Secret Manager ou aba Configurações).
 */
function DIAGNOSTICO_ORIGEM_CHAVE_GEMINI() {
  console.log('🔍 DIAGNÓSTICO DA ORIGEM DA CHAVE GEMINI');
  console.log('='.repeat(60));

  function resumo(valor, nome) {
    if (!valor) return '❌ ' + nome + ': vazio/ausente';
    const prefixo = valor.length > 4 ? String(valor).substring(0, 4) : String(valor);
    const ok = /^(AIza|AQ\.)/i.test(String(valor)) ? '✅ (formato OK)' : '⚠️ (formato INVALIDO)';
    return nome + ': ' + ok + ' | prefixo \'' + prefixo + '\' | ' + String(valor).length + ' chars';
  }

  const sp = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const up = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
  console.log(resumo(sp, 'Script Properties'));
  console.log(resumo(up, 'User Properties'));

  if (typeof Secrets !== 'undefined' && typeof Secrets.clearCache === 'function') {
    try {
      Secrets.clearCache();
      const doSecret = Secrets.getSecret('GEMINI_API_KEY');
      console.log(resumo(doSecret, 'Secret Manager (GCP)'));
    } catch (e) {
      console.log('❌ Secret Manager: erro ao consultar - ' + e.message);
    }
  }

  // Aba Configurações da planilha
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Configurações');
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      let achou = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0] || '').trim() === 'GEMINI_API_KEY') {
          achou = true;
          const val = data[i][1];
          const prefixo = val ? String(val).substring(0, 4) : '(vazio)';
          const tamanho = val ? String(val).length : 0;
          const ok = val && /^(AIza|AQ\.)/i.test(String(val));
          console.log('Aba "Configurações": ' + (ok ? '✅ (formato OK)' : '⚠️ (formato INVALIDO)') + ' | prefixo \'' + prefixo + '\' | ' + tamanho + ' chars');
        }
      }
      if (!achou) console.log('Aba "Configurações": linha GEMINI_API_KEY não encontrada');
    } else {
      console.log('Aba "Configurações": não existe');
    }
  } catch (e) {
    console.log('❌ Aba Configurações: erro ao consultar - ' + e.message);
  }

  console.log('✅ DIAGNÓSTICO DE ORIGEM CONCLUÍDO');
}





function TESTAR_FALLBACK() {
  const prompt = "Responda em JSON: {\"modelo\": \"ok\"}";

  const res = AI_Connector.callGemini(prompt, {
    jsonMode: true,
    model: "modelo_inexistente" // força erro Gemini
  });

  console.log("Resultado fallback:", res);
}
