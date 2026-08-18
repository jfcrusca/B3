/**
 * =============================================================================
 * 24_Secrets_Manager.gs — Gestão Avançada de Chaves (GCP + Fallback)
 * =============================================================================
 * Este módulo é o provedor de alta segurança para o objeto CONFIG.
 */

  var Secrets = (function(){
    'use strict';
  
  var CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  var secretCache = {};
  var lastFetch = 0;

  
  /**
   * Obtém múltiplos secrets de uma vez com lógica de Cache e GCP
   */
  function getSecrets(secretNames) {
    if (!Array.isArray(secretNames) || secretNames.length === 0) return null;
    
    var now = Date.now();
    // 1. Verificar Cache em Memória
    if (now - lastFetch < CACHE_DURATION && Object.keys(secretCache).length > 0) {
      var cachedResult = {};
      var allCached = true;
      
      for (var i = 0; i < secretNames.length; i++) {
        var name = secretNames[i];
        if (secretCache[name] !== undefined) {
          cachedResult[name] = secretCache[name];
        } else {
          allCached = false;
          break;
        }
      }
      if (allCached) return cachedResult;
    }
    
    // 2. Tentar GCP Secret Manager (Protocolo de Alta Segurança)
    var projectId = getProjectId();
    if (projectId) {
      try {
        var secrets = fetchFromGcp(projectId, secretNames);
        if (secrets) {
          Object.assign(secretCache, secrets);
          lastFetch = Date.now();
          return secrets;
        }
      } catch (error) {
        console.warn('⚠️ GCP Secret Manager falhou, tentando fallback local...');
      }
    }
    
    // 3. Fallback para Script Properties (Onde ficam suas chaves hoje)
    var fallbackSecrets = fetchFromScriptProperties(secretNames);
    if (fallbackSecrets) {
      Object.assign(secretCache, fallbackSecrets);
      lastFetch = Date.now();
    }
    
    return fallbackSecrets;
  }

  function getSecret(name) {
    var secrets = getSecrets([name]);
    return secrets ? secrets[name] : null;
  }


  /**
   * Obtém o Project ID sem depender do módulo CONFIG (Evita Loop)
   */
  function getProjectId() {
    // Busca direto no serviço nativo do Google
    return PropertiesService.getScriptProperties().getProperty('GCP_PROJECT_ID') || '';
  }

  function fetchFromGcp(projectId, secretNames) {
    var results = {};
    var token = ScriptApp.getOAuthToken();
    
    for (var i = 0; i < secretNames.length; i++) {
      var name = secretNames[i];
      try {
        var url = 'https://secretmanager.googleapis.com/v1/projects/' + projectId + '/secrets/' + encodeURIComponent(name) + '/versions/latest:access';
        var response = UrlFetchApp.fetch(url, {
          method: 'get',
          headers: { 'Authorization': 'Bearer ' + token },
          muteHttpExceptions: true
        });
        
        if (response.getResponseCode() === 200) {
          var data = JSON.parse(response.getContentText());
          var payload = data && data.payload && data.payload.data;
          if (payload) {
            results[name] = Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString();
          }
        }
      } catch (e) {
        console.error('❌ Erro no GCP Secret (' + name + '): ' + e.message);
      }
    }
    return Object.keys(results).length > 0 ? results : null;
  }

  function fetchFromScriptProperties(secretNames) {
    var props = PropertiesService.getScriptProperties();
    var results = {};
    for (var i = 0; i < secretNames.length; i++) {
      var name = secretNames[i];
      var value = props.getProperty(name);
      if (value) results[name] = value;
    }
    return Object.keys(results).length > 0 ? results : null;
  }


  return {
    getSecrets: getSecrets,
    getSecret: getSecret,
    clearCache: function() { secretCache = {}; lastFetch = 0; },
    getProjectId: getProjectId
  };

})();