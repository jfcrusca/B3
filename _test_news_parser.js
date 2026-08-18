/**
 * _test_news_parser.js — TESTE NODE.JS (NÃO PUBLICAR NO APPS SCRIPT)
 * ==========================================================================
 * 🔒 GUARD DE AMBIENTE: Este arquivo usa `require('fs')`, `process.exit()` e
 * mocks de APIs Google Apps Script. Ele SÓ deve rodar no Node.js.
 * No ambiente GAS, `require` não existe → envolvemos tudo num guard para
 * que a inclusão deste arquivo NÃO quebre o script (ReferenceError).
 */

// ⛔ GUARD: Só executa no Node.js (require existe). No Apps Script, vira no-op.
if (typeof require === 'function' && typeof process !== 'undefined' && typeof module !== 'undefined') {

var fs = require('fs');

// Mock do ambiente Google Apps Script
global.CacheService = {
  getScriptCache: function() {
    return {
      get: function() { return null; },
      put: function() {}
    };
  }
};

global.UrlFetchApp = {
  fetch: function(url) {
    return {
      getResponseCode: function() { return 200; },
      getContentText: function() { return mockXml; }
    };
  }
};

global.Utilities = {
  sleep: function() {}
};

// Mock XML realista
var mockXml = '<?xml version="1.0" encoding="UTF-8"?>' +
  '<rss version="2.0">' +
  '<channel>' +
  '<item>' +
  '<title>Petrobras: bons 2T e dividendos, mas por que ações fecharam em queda de 3%? - InfoMoney</title>' +
  '<link>https://example.com/1</link>' +
  '<pubDate>Tue, 11 Aug 2026 10:00:00 GMT</pubDate>' +
  '</item>' +
  '<item>' +
  '<title>Petrobras aprova pagamento de remuneração aos acionistas de R$ 17,4 bilhões - Agência Petrobras</title>' +
  '<link>https://example.com/2</link>' +
  '<pubDate>Tue, 11 Aug 2026 09:30:00 GMT</pubDate>' +
  '</item>' +
  '<item>' +
  '<title>Com tudo jogando a favor, Petrobras (PETR4) quase dobra o lucro líquido no 2T26 - Seu Dinheiro</title>' +
  '<link>https://example.com/3</link>' +
  '<pubDate>Tue, 11 Aug 2026 09:00:00 GMT</pubDate>' +
  '</item>' +
  '</channel>' +
  '</rss>';

// Carrega o NewsFetcher
try {
  var src = fs.readFileSync('11_Data_NewsFetcher.js', 'utf8');
  eval(src);
  console.log('✅ NewsFetcher carregado com sucesso');
} catch (e) {
  console.error('❌ Erro ao carregar NewsFetcher:', e.message);
  process.exit(1);
}

// Testa getNewsForTicker
console.log('\n📰 Testando getNewsForTicker("PETR4", 3)...');
var result = NewsFetcher.getNewsForTicker('PETR4', 3);
console.log(JSON.stringify(result, null, 2));

if (Array.isArray(result) && result.length === 3) {
  console.log('✅ Teste passou: 3 notícias obtidas');
} else {
  console.error('❌ Teste falhou: esperava 3 notícias, obteve ' + (result ? result.length : 0));
  process.exit(1);
}

// Testa toSummaryText
console.log('\n📰 Testando toSummaryText...');
var summary = NewsFetcher.toSummaryText(result);
console.log('Resumo:', summary);

if (summary && summary.indexOf('1.') !== -1 && summary.indexOf('2.') !== -1 && summary.indexOf('3.') !== -1) {
  console.log('✅ Teste passou: resumo formatado corretamente');
} else {
  console.error('❌ Teste falhou: formato do resumo incorreto');
  process.exit(1);
}

// Testa getNewsSummary
console.log('\n📰 Testando getNewsSummary("PETR4", 3)...');
var summary2 = NewsFetcher.getNewsSummary('PETR4', 3);
console.log('Resumo:', summary2);

if (summary2 && summary2 !== 'Sem alertas de notícias.') {
  console.log('✅ Teste passou: resumo obtido');
} else {
  console.error('❌ Teste falhou: resumo vazio');
  process.exit(1);
}

// Testa toSummaryText com array vazio
console.log('\n📰 Testando toSummaryText([])...');
var empty = NewsFetcher.toSummaryText([]);
console.log('Resumo vazio:', empty);

if (empty === 'Sem alertas de notícias.') {
  console.log('✅ Teste passou: array vazio retorna marcador padrão');
} else {
  console.error('❌ Teste falhou: esperava "Sem alertas de notícias."');
  process.exit(1);
}

console.log('\n🎉 TODOS OS TESTES PASSARAM!');

} // ⛔ FIM DO GUARD DE AMBIENTE NODE.JS