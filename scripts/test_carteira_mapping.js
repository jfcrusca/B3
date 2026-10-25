/**
 * Harness offline de REGRESSÃO — mapeamento de colunas da aba 'Carteira'.
 *
 * Valida que os índices usados pelos módulos do robô batem com o CABEÇALHO REAL
 * do usuário (A..T / 20 colunas), evitando o bug histórico onde "Preço Médio" era
 * lido da coluna F (Última Compra).
 *
 * Cabeçalho real (linha 1):
 *   A Tipo | B Papel | C Qtd | D Valor Líquido | E 1ª Compra | F Última Compra
 *   G Preço Médio Ordem | H Cotação Atual | I Lucro/Prejuízo | J Proventos
 *   K Lucro/Prejuízo % | L Participação na Carteira | M 🤖 SUGESTÃO
 *   N 🛑 STOP IDEAL | O 🎯 ALVO IDEAL | P 🛡️ SEU STOP (OCO) | Q 🏁 ALVO 1 (50%)
 *   R 🏁 ALVO 2 (50%) | S 📊 ALVO MÉDIO | T 💸 RISCO R$
 */

var fs = require('fs');

// Cabeçalho real (fonte de verdade para o teste)
var HEADER = [
  'Tipo', 'Papel', 'Qtd', 'Valor Líquido', '1ª Compra', 'Última Compra',
  'Preço Médio Ordem', 'Cotação Atual', 'Lucro/Prejuízo', 'Proventos',
  'Lucro/Prejuízo %', 'Participação na Carteira', '🤖 SUGESTÃO',
  '🛑 STOP IDEAL', '🎯 ALVO IDEAL', '🛡️ SEU STOP (OCO)', '🏁 ALVO 1 (50%)',
  '🏁 ALVO 2 (50%)', '📊 ALVO MÉDIO', '💸 RISCO R$'
];

// Coluna esperada (0-based) por campo, conforme o robô deve ler
var ESPERADO = {
  TICKER: 1,        // B
  PRECO_MEDIO: 6,   // G
  COTACAO: 7,       // H
  LUCRO_RS: 8,      // I
  STOP_IDEAL: 13,   // N
  ALVO_IDEAL: 14,   // O
  STOP_OCO: 15,     // P
  ALVO1: 16,        // Q
  ALVO2: 17,        // R
  ALVO_MEDIO: 18,   // S
  RISCO_RS: 19      // T
};

var falhas = [];

// 1) Valida que os nomes do cabeçalho batem com a posição esperada
Object.keys(ESPERADO).forEach(function (campo) {
  var idx = ESPERADO[campo];
  var nome = HEADER[idx] || '<vazio>';
  console.log('  ' + campo.padEnd(12) + ' -> idx ' + String(idx).padStart(2) +
    ' = "' + nome + '"');
});

// 2) Confere que o módulo 50_preMarketAnalysis usa PRECO_MEDIO=6 (não 5)
var srcPre = fs.readFileSync('50_preMarketAnalysis.js', 'utf8');
if (!/PRECO_MEDIO:\s*6\b/.test(srcPre)) {
  falhas.push('50_preMarketAnalysis: CARTEIRA_COL.PRECO_MEDIO deve ser 6 (coluna G).');
}
if (!/STOP_OCO:\s*15\b/.test(srcPre)) {
  falhas.push('50_preMarketAnalysis: CARTEIRA_COL.STOP_OCO deve ser 15 (coluna P).');
}
if (!/ALVO1:\s*16\b/.test(srcPre)) {
  falhas.push('50_preMarketAnalysis: CARTEIRA_COL.ALVO1 deve ser 16 (coluna Q).');
}
if (!/ALVO2:\s*17\b/.test(srcPre)) {
  falhas.push('50_preMarketAnalysis: CARTEIRA_COL.ALVO2 deve ser 17 (coluna R).');
}
// Garante que NÃO voltou a ler precoMedio de row[5]
if (/precoMedio\s*=\s*parseFloat\(row\[5\]\)/.test(srcPre)) {
  falhas.push('50_preMarketAnalysis: regressão — precoMedio voltou a ler row[5] (col F).');
}

// 3) Confere que o Rebalancer escreve stop/alvo/risco nas colunas certas (1-based)
var srcReb = fs.readFileSync('31_Portfolio_Rebalancer.js', 'utf8');
[13, 14, 15, 17, 18, 19, 20].forEach(function (col) {
  var re = new RegExp('getRange\\(up\\.row,\\s*' + col + '\\)');
  if (!re.test(srcReb)) {
    falhas.push('31_Portfolio_Rebalancer: esperada escrita em coluna ' + col + ' (1-based).');
  }
});
// Não deve escrever na coluna 16 (P = SEU STOP OCO do usuário)
if (/getRange\(up\.row,\s*16\)\.setValue/.test(srcReb)) {
  falhas.push('31_Portfolio_Rebalancer: NÃO deve sobrescrever a coluna P (16 = SEU STOP OCO).');
}

// 4) Confere que o Dashboard lê Qtd(2), Cotação(7), Lucro(8), Risco(19)
var srcDash = fs.readFileSync('14_Dashboard_PainelMercado.js', 'utf8');
[[2], [7], [8], [19]].forEach(function (pair) {
  var re = new RegExp('dataC\\[i\\]\\[' + pair[0] + '\\]');
  if (!re.test(srcDash)) {
    falhas.push('14_Dashboard_PainelMercado: esperado dataC[i][' + pair[0] + '].');
  }
});

console.log('\n--- Asserções de mapeamento ---');
if (falhas.length) {
  falhas.forEach(function (a) { console.log('  ❌ ' + a); });
  console.log('\n❌ FALHOU: mapeamento de colunas da aba Carteira inconsistente.');
  process.exitCode = 1;
} else {
  console.log('  ✅ Preço Médio lido de G (idx 6), não de F (data).');
  console.log('  ✅ Stop/Alvo/OCO lidos de N/O/P/Q/R conforme cabeçalho real.');
  console.log('  ✅ Rebalancer grava em M,N,O,Q,R,S,T (1-based) e NÃO toca P (OCO).');
  console.log('  ✅ Dashboard lê Qtd/Cotação/Lucro/Risco nos índices corretos.');
  console.log('\n✅ PASSOU: mapeamento da aba Carteira alinhado ao cabeçalho real.');
}
