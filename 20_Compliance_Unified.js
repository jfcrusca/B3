/**
 * 20_Compliance_Unified.gs — V5.0 (MODULAR & SNIPER COMPLIANT)
 * =============================================================================
 * Finalidade: Guardião de regras, horários e travas de risco.
 * Refatoração: Encapsulamento total para compatibilidade com Orchestrator v9.0.
 * =============================================================================
 */

var ComplianceUnified = {
  CONFIG: {
    HORA_ABERTURA: 10,
    HORA_FECHAMENTO: 16,
    MINUTO_FECHAMENTO: 55,
    PERDA_MAXIMA_DIARIA: -2000,
    IGNORAR_FERIADOS: false
  },

  _cfg: function(key, fallback) {
    return (typeof CONFIG !== 'undefined' && typeof CONFIG.get === 'function') ? CONFIG.get(key, fallback) : fallback;
  },

  /** 
 * Valida se o robô pode operar no momento.
 * Chamada pelo Orchestrator v9.0
 * ✅ CORRIGIDO: Modo teste removido, lógica real restaurada
 */
verificarHorarioOperacional: function() {
  const statusInfo = this._validarTempo(new Date());
  const stopAtivado = this._verificarStopGlobal();
  
  // Log interno para depuração
  if (stopAtivado) console.warn("⛔ Compliance: Stop Global Diário atingido.");
  
  // ✅ CORREÇÃO: Removeu o "return true" fixo do modo teste
  return statusInfo.status === "✅ OPERACIONAL" && !stopAtivado;
},



  /** Interface para o Menu de Auditoria */
  executarAuditoriaCompleta: function() {
    const agora = new Date();
    const infoTempo = this._validarTempo(agora);
    const infoStop = this._verificarStopGlobal() ? "🛑 ATINGIDO" : "✅ DENTRO DO LIMITE";
    
    const relatorio = `🛡️ RELATÓRIO DE COMPLIANCE\n` +
                      `=========================\n` +
                      `⏰ STATUS: ${infoTempo.status}\n` +
                      `📝 DETALHE: ${infoTempo.detalhes}\n` +
                      `📊 RISCO DIÁRIO: ${infoStop}\n` +
                      `[Hora: ${agora.toLocaleTimeString('pt-BR')}]`;
                      
    SpreadsheetApp.getUi().alert("⚖️ AUDITORIA DE RISCO", relatorio, SpreadsheetApp.getUi().ButtonSet.OK);
  },

  // --- MOTORES PRIVADOS ---

  _validarTempo: function(agora) {
    const diaSemana = agora.getDay();
    const hora = agora.getHours();
    const minuto = agora.getMinutes();

    if (diaSemana === 0 || diaSemana === 6) return { status: "⛔ FECHADO", detalhes: "Fim de semana." };
    if (this._ehFeriado(agora)) return { status: "🏖️ FERIADO", detalhes: "B3 fechada." };
    const horaAbertura = Number(this._cfg('HORA_ABERTURA', this.CONFIG.HORA_ABERTURA));
    const horaFechamento = Number(this._cfg('HORA_FECHAMENTO', this.CONFIG.HORA_FECHAMENTO));
    const minutoFechamento = Number(this._cfg('MINUTO_FECHAMENTO', this.CONFIG.MINUTO_FECHAMENTO));

    if (hora < horaAbertura) return { status: "💤 AGUARDANDO", detalhes: "Abre às " + String(horaAbertura).padStart(2, '0') + ":00." };
    if (hora > horaFechamento || (hora === horaFechamento && minuto >= minutoFechamento)) {
      return { status: "💤 FECHADO", detalhes: "Pregão encerrado." };
    }
    return { status: "✅ OPERACIONAL", detalhes: "Horário de negociação ativo." };
  },

  _ehFeriado: function(data) {
    if (this._cfg('IGNORAR_FERIADOS', this.CONFIG.IGNORAR_FERIADOS)) return false;
    const diaMes = `${data.getDate()}/${data.getMonth() + 1}`;
    const feriados = ["1/1", "25/1", "21/4", "1/5", "7/9", "12/10", "2/11", "15/11", "25/12"];
    return feriados.includes(diaMes);
  },

  _verificarStopGlobal: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Performance_Diaria");
    if (!sheet) return false;
    const resultado = sheet.getRange("B2").getValue();
    return (typeof resultado === 'number' && resultado <= Number(this._cfg('PERDA_MAXIMA_DIARIA', this.CONFIG.PERDA_MAXIMA_DIARIA)));
  }
};

/** Pontes de compatibilidade globais */
function COMPLIANCE_CHECK() { ComplianceUnified.executarAuditoriaCompleta(); }
// Esta função global abaixo agora apenas delega para o objeto, resolvendo o erro do Orquestrador
function verificarHorarioOperacional() { return ComplianceUnified.verificarHorarioOperacional(); }
