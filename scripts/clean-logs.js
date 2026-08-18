// scripts/clean-logs.js
const fs = require('fs');
const path = require('path');

// Defina a pasta onde estão seus arquivos .gs (ex: './src' ou './' se estiverem na raiz)
const TARGET_DIR = './'; 
const IGNORE_DIRS = ['node_modules', '.git', '.github', 'scripts'];

function cleanDirectory(directory) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) cleanDirectory(fullPath);
    } else if (fullPath.endsWith('.gs') || fullPath.endsWith('.js') || fullPath.endsWith('.html')) {
      cleanFile(fullPath);
    }
  }
}

function cleanFile(filePath) {
  const originalCode = fs.readFileSync(filePath, 'utf8');

  // Regex que localiza as funções de debug (console.log, print, log) e remove a instrução inteira
  let cleanedCode = originalCode
    .replace(/^[ \t]*(console\.log|print|log)\s*\([\s\S]*?\);?[ \t]*$/gm, '')
    // Remove os espaços e linhas em branco extras que ficarem para trás
    .replace(/\n\s*\n/g, '\n');

  if (originalCode !== cleanedCode) {
    fs.writeFileSync(filePath, cleanedCode, 'utf8');
    console.log(`🧹 Logs removidos em: ${filePath}`);
  }
}

console.log('🔍 Iniciando varredura de logs de debug...');
cleanDirectory(TARGET_DIR);
console.log('✅ Limpeza concluída! (console.warn e console.error foram mantidos)');