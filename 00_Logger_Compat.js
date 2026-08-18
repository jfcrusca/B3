
// =============================================================================
// 00_Logger_Compat.gs
// Compatibilidade para código legado que usa Logger.warn / Logger.info
// =============================================================================

(function () {
  'use strict';

  // Se Logger não existir (muito raro), cria
  if (typeof Logger === 'undefined') {
    this.Logger = {};
  }

  // Logger.log sempre existe, mas garantimos
  if (typeof Logger.log !== 'function') {
    Logger.log = function (msg) {
      console.log(msg);
    };
  }

  // ✅ Compatibilidade: Logger.warn
  if (typeof Logger.warn !== 'function') {
    Logger.warn = function (msg) {
      if (typeof LogService !== 'undefined' && LogService.warn) {
        LogService.warn('LEGACY', msg);
      } else {
        console.warn(msg);
      }
    };
  }

  // ✅ Compatibilidade: Logger.info
  if (typeof Logger.info !== 'function') {
    Logger.info = function (msg) {
      if (typeof LogService !== 'undefined' && LogService.info) {
        LogService.info('LEGACY', msg);
      } else {
        console.log(msg);
      }
    };
  }

  // ✅ Compatibilidade: Logger.error
  if (typeof Logger.error !== 'function') {
    Logger.error = function (msg) {
      if (typeof LogService !== 'undefined' && LogService.error) {
        LogService.error('LEGACY', msg);
      } else {
        console.error(msg);
      }
    };
  }

})();
