/**
 * 00_Utils.gs - Funções Globais de Suporte
 * Resolve os erros: parseNumberBR_, formatBRL_ e diagnosticarResumo
 */

if (typeof QuotaTracker === 'undefined') {
  var QuotaTracker = {
    fetchCount: 0,
    fetchBatchCount: 0,
    fetchHosts: {},
    sheetAccessCount: 0,
    recordFetch: function(url, type) {
      this.fetchCount += 1;
      if (type === 'batch') this.fetchBatchCount += 1;
      var host = String(url || '').replace(/^https?:\/\//, '').split('/')[0];
      if (host) this.fetchHosts[host] = (this.fetchHosts[host] || 0) + 1;
    },
    recordSheetAccess: function() {
      this.sheetAccessCount += 1;
    },
    report: function() {
      return {
        fetchCount: this.fetchCount,
        fetchBatchCount: this.fetchBatchCount,
        fetchHosts: this.fetchHosts,
        sheetAccessCount: this.sheetAccessCount
      };
    }
  };
}

if (typeof SpreadsheetApp !== 'undefined' && typeof SpreadsheetApp.getActiveSpreadsheet === 'function') {
  const _originalGetActiveSpreadsheet = SpreadsheetApp.getActiveSpreadsheet.bind(SpreadsheetApp);
  const _originalOpenById = SpreadsheetApp.openById ? SpreadsheetApp.openById.bind(SpreadsheetApp) : null;
  const _originalOpenByUrl = SpreadsheetApp.openByUrl ? SpreadsheetApp.openByUrl.bind(SpreadsheetApp) : null;

  function _wrapRange(range) {
    if (!range || typeof range !== 'object') return range;
    return new Proxy(range, {
      get(target, prop) {
        const value = target[prop];
        if (typeof value === 'function') {
          return function(...args) {
            QuotaTracker.recordSheetAccess();
            return value.apply(target, args);
          };
        }
        return value;
      }
    });
  }

  function _wrapSheet(sheet) {
    if (!sheet || typeof sheet !== 'object') return sheet;
    return new Proxy(sheet, {
      get(target, prop) {
        const value = target[prop];
        if (prop === 'getRange' && typeof value === 'function') {
          return function(...args) {
            QuotaTracker.recordSheetAccess();
            return _wrapRange(value.apply(target, args));
          };
        }
        if (prop === 'getDataRange' && typeof value === 'function') {
          return function(...args) {
            QuotaTracker.recordSheetAccess();
            return _wrapRange(value.apply(target, args));
          };
        }
        if (prop === 'getSheetByName' && typeof value === 'function') {
          return function(...args) {
            QuotaTracker.recordSheetAccess();
            return _wrapSheet(value.apply(target, args));
          };
        }
        if (typeof value === 'function') {
          return value.bind(target);
        }
        return value;
      }
    });
  }

  function _wrapSpreadsheet(spreadsheet) {
    if (!spreadsheet || typeof spreadsheet !== 'object') return spreadsheet;
    return new Proxy(spreadsheet, {
      get(target, prop) {
        const value = target[prop];
        if (prop === 'getSheetByName' && typeof value === 'function') {
          return function(...args) {
            QuotaTracker.recordSheetAccess();
            return _wrapSheet(value.apply(target, args));
          };
        }
        if (prop === 'getSheets' && typeof value === 'function') {
          return function(...args) {
            QuotaTracker.recordSheetAccess();
            return value.apply(target, args).map(_wrapSheet);
          };
        }
        if (prop === 'getDataRange' && typeof value === 'function') {
          return function(...args) {
            QuotaTracker.recordSheetAccess();
            return _wrapRange(value.apply(target, args));
          };
        }
        if (typeof value === 'function') {
          return value.bind(target);
        }
        return value;
      }
    });
  }

  SpreadsheetApp.getActiveSpreadsheet = function() {
    return _wrapSpreadsheet(_originalGetActiveSpreadsheet());
  };
  if (_originalOpenById) {
    SpreadsheetApp.openById = function(id) {
      return _wrapSpreadsheet(_originalOpenById(id));
    };
  }
  if (_originalOpenByUrl) {
    SpreadsheetApp.openByUrl = function(url) {
      return _wrapSpreadsheet(_originalOpenByUrl(url));
    };
  }
}

function QUOTA_TRACKER_REPORT() {
  const report = (typeof QuotaTracker !== 'undefined') ? QuotaTracker.report() : null;
  console.log('📊 QuotaTracker report:', JSON.stringify(report, null, 2));
  return report;
}

// 1. Resolve: parseNumberBR_ ❌ FALTANDO
function parseNumberBR_(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).replace(/[^\d,.\-]/g, "");
  if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.indexOf(",") >= 0) {
    s = s.replace(",", ".");
  }
  return parseFloat(s) || 0;
}

// 2. Resolve: formatBRL_ ❌ FALTANDO
function formatBRL_(n) {
  return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

// 3. Resolve: ReferenceError: diagnosticarResumo is not defined ❌
function diagnosticarResumo() {
  // Tenta carregar a config do Ranker
  const config = AgenticRanker.loadConfig();
  // Tenta rodar a geração (mesmo que retorne 0 trades)
  const total = AgenticRanker.gerarResumoTradesAprovados();
  
  return {
    status: "OK",
    capital: config.capital,
    risco: config.riscoPct,
    trades: total
  };
}


/**
 * Avalia a qualidade do rompimento e gera alertas visuais para a Planilha.
 */
function avaliarRompimentoSeguro(precoAtual, bandaSuperior, volumeAtual, volumeMedio20, macdHistograma) {
  let isAbaixoResistencia = precoAtual < bandaSuperior;
  let isFaltaVolume = volumeAtual < (volumeMedio20 * 1.2); 
  let isMacdFraco = macdHistograma < 0; 

  let status = {
    tagOriginal: "ROMPIMENTO", // Fallback
    tagFinal: "📈 ROMPIMENTO",
    alerta: "✅ Setup validado",
    corFundo: "#c8e6c9" // Verde claro
  };

  if (isAbaixoResistencia && (isFaltaVolume || isMacdFraco)) {
    status.tagFinal = "⏳ PRÉ-ROMPIMENTO";
    let motivos = [];
    if (isFaltaVolume) motivos.push("Volume Baixo");
    if (isMacdFraco) motivos.push("MACD Fraco");
    status.alerta = `⚠️ Aguardar (${motivos.join(" + ")})`;
    status.corFundo = "#fff9c4"; // Amarelo
  } 
  else if (!isAbaixoResistencia && (isFaltaVolume && isMacdFraco)) {
    status.tagFinal = "🚨 FALSO ROMPIMENTO";
    status.alerta = "⚠️ Rompeu sem volume e sem força";
    status.corFundo = "#ffcdd2"; // Vermelho
  }

  return status;
}