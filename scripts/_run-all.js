/**
 * @file scripts/_run-all.js
 * @description Runner offline de testes para o projeto B3-v10.
 *
 * Descobre automaticamente todos os harnesses em scripts/test_*.js (ordem alfabética),
 * executa cada um em processo separado e resume o resultado.
 * Harnesses obsoletos/frágeis ficam em scripts/_legacy/ e são IGNORADOS.
 *
 * Uso:
 *   node scripts/_run-all.js            -> executa todos os testes
 *   node scripts/_run-all.js forca bdr  -> executa apenas os que casam com os filtros
 *
 * Saída: exit code 0 se todos passarem, 1 caso haja alguma falha.
 */

var fs = require('fs');
var path = require('path');
var { spawnSync } = require('child_process');

var SCRIPTS_DIR = __dirname;
var ROOT_DIR = path.resolve(__dirname, '..');
var filtros = process.argv.slice(2);

function listarTestes() {
  return fs.readdirSync(SCRIPTS_DIR)
    .filter(function (nome) { return /^test_.*\.js$/.test(nome); })
    .sort()
    .filter(function (nome) {
      if (filtros.length === 0) return true;
      var alvo = nome.toLowerCase();
      return filtros.some(function (f) { return alvo.indexOf(String(f).toLowerCase()) !== -1; });
    });
}

function main() {
  var testes = listarTestes();

  if (testes.length === 0) {
    console.error('❌ Nenhum teste encontrado em scripts/ (filtros: ' + (filtros.join(', ') || 'nenhum') + ')');
    process.exitCode = 1;
    return;
  }

  console.log('🧪 B3-v10 — Runner de testes offline');
  console.log('   Diretório: ' + SCRIPTS_DIR);
  console.log('   Testes encontrados: ' + testes.length + '\n');

  var falhas = [];

  testes.forEach(function (nome, i) {
    var rotulo = '[' + (i + 1) + '/' + testes.length + '] ' + nome;
    process.stdout.write(rotulo + ' ... ');

    // execFileSync com cwd na raiz: os harnesses usam caminhos relativos (ex.: readFileSync('05_...js'))
    var res = spawnSync(process.execPath, [path.join(SCRIPTS_DIR, nome)], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (res.status === 0) {
      console.log('✅ PASS');
    } else {
      console.log('❌ FAIL');
      falhas.push({ nome: nome, saida: (res.stdout || '') + (res.stderr || '') });
    }
  });

  console.log('\n' + '─'.repeat(60));
  if (falhas.length === 0) {
    console.log('✅ SUCESSO: ' + testes.length + '/' + testes.length + ' testes passaram.');
    process.exitCode = 0;
    return;
  }

  console.log('❌ FALHA: ' + falhas.length + ' de ' + testes.length + ' testes falharam.\n');
  falhas.forEach(function (f) {
    console.log('=== ' + f.nome + ' ===');
    var linhas = f.saida.trim().split(/\r?\n/);
    console.log(linhas.slice(-15).join('\n'));
    console.log('');
  });
  process.exitCode = 1;
}

main();
