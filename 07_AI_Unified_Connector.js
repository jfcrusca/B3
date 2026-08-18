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

    if (!key || key.includes("MIGRATED")) {
      throw new Error("❌ GEMINI_API_KEY inválida");
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 1024,
        response_mime_type: options.jsonMode ? "application/json" : "text/plain"
      }
    };

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

    for (let i = 0; i < AI_Config.MAX_RETRIES; i++) {
      try {
        console.log("📡 [Gemini] Enviando requisição...");
        const response = UrlFetchApp.fetch(request.url, request.params);

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

        } else {
          console.error(`❌ [Gemini] HTTP ${code}: ${text}`);
          return this.tryFallback(prompt, options);
        }

      } catch (e) {
        console.error(`❌ [Gemini] Erro: ${e.message}`);
        Utilities.sleep(Math.pow(2, i) * 1000);
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





function TESTAR_FALLBACK() {
  const prompt = "Responda em JSON: {\"modelo\": \"ok\"}";

  const res = AI_Connector.callGemini(prompt, {
    jsonMode: true,
    model: "modelo_inexistente" // força erro Gemini
  });

  console.log("Resultado fallback:", res);
}
