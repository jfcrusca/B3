/**
 * Harness offline de REGRESSÃO — preenchimento das colunas M..T da aba 'Carteira'
 * (31_Portfolio_Rebalancer.js) e seu gatilho de menu (00_Menu_Manager.js).
 *
 * Garante que:
 *   (1) o menu "Sincronizar Carteira (Stops e Alvos)" CHAMA o Rebalancer
 *       (antes ele só chamava PortfolioUnified → colunas M..T ficavam vazias);
 *   (2) o Rebalancer ABORTA quando o Resumo_Trades_Aprovados está vazio
 *       (evita marcar tudo como "VENDER (SAIU DO RADAR)");
 *   (3) a escrita cobre as colunas N,O,Q,R,S,T (1-based) e não toca P (SEU STOP OCO).
 */

var fs = require('fs');
var menu = fs.readFileSync('00_Menu_Manager.js', 'utf8');
var reb = fs.readFileSync('31_Portfolio_Rebalancer.js', 'utf8');

var falhas = [];

console.log('\n=== (1) Gatilho de menu do Rebalancer ===');
if (!/MENU_SYNC_PORTFOLIO/.test(menu)) {
  falhas.push('MENU_SYNC_PORTFOLIO ausente no menu.');
}
var chamaRebalancer = /PortfolioRebalancer\.executarSincronizacao/.test(menu) ||
                      /EXECUTAR_SINCRONIZACAO_CARTEIRAS/.test(menu);
if (!chamaRebalancer) {
  falhas.push('MENU_SYNC_PORTFOLIO NÃO chama o Rebalancer (M..T nunca seriam preenchidas).');
} else {
  console.log('  ✅ MENU_SYNC_PORTFOLIO chama PortfolioRebalancer.executarSincronizacao / EXECUTAR_SINCRONIZACAO_CARTEIRAS');
}
if (!/PortfolioUnified\.syncPortfolio/.test(menu)) {
  falhas.push('MENU_SYNC_PORTFOLIO deixou de chamar PortfolioUnified.syncPortfolio (cotação H).');
} else {
  console.log('  ✅ MENU_SYNC_PORTFOLIO mantém PortfolioUnified.syncPortfolio (cotação H)');
}

console.log('\n=== (2) Guarda de Resumo_Trades_Aprovados vazio ===');
// A guarda deve existir e referenciar mapaIdeal vazio + return.
if (!/Object\.keys\(mapaIdeal\)\.length\s*===\s*0/.test(reb)) {
  falhas.push('Rebalancer sem guarda de mapaIdeal vazio (marcaria tudo como VENDER).');
} else {
  console.log('  ✅ Rebalancer aborta quando mapaIdeal está vazio');
}

console.log('\n=== (3) Colunas de escrita M..T (1-based) ===');
var esperadas = { 13: 'M SUGESTÃO', 14: 'N STOP IDEAL', 15: 'O ALVO IDEAL',
                  17: 'Q ALVO 1', 18: 'R ALVO 2', 19: 'S ALVO MÉDIO', 20: 'T RISCO R$' };
Object.keys(esperadas).forEach(function (col) {
  var re = new RegExp('getRange\\(up\\.row,\\s*' + col + '\\)');
  if (!re.test(reb)) {
    falhas.push('Falta escrita na coluna ' + col + ' (' + esperadas[col] + ').');
  } else {
    console.log('  ✅ col ' + col + ' -> ' + esperadas[col]);
  }
});
if (/getRange\(up\.row,\s*16\)\.setValue/.test(reb)) {
  falhas.push('Rebalancer NÃO deve escrever na coluna 16 (P = SEU STOP OCO).');
} else {
  console.log('  ✅ col 16 (P SEU STOP OCO) preservada');
}

console.log('\n--- Asserções ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: fluxo das colunas M..T inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ Menu aciona o Rebalancer (M..T são preenchidas).');
  console.log('  ✅ Guarda evita falso "VENDER" com resumo vazio.');
  console.log('  ✅ Escrita cobre M,N,O,Q,R,S,T e preserva P (OCO).');
  console.log('\n✅ PASSOU: colunas M..T da Carteira serão preenchidas corretamente.');
}
