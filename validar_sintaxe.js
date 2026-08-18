/**
 * validar_sintaxe.js — UTILITÁRIO NODE.JS (NÃO PUBLICAR NO APPS SCRIPT)
 * ==========================================================================
 * 🔒 GUARD DE AMBIENTE: Usa `require('fs')` e `process.exit()` (Node.js).
 * No ambiente GAS, `require` não existe → tudo dentro do guard para não quebrar.
 */

// ⛔ GUARD: Só executa no Node.js
if (typeof require === 'function' && typeof process !== 'undefined' && typeof module !== 'undefined') {

const fs = require('fs');

const arquivos = [
  '08_AI_Ensemble.js',
  '34_DecisionEngine.js',
  '22_Core_Analyzers.js',
  '29_Oportunidades_Processor.js',
  '00_SheetWriter.js',
  '08_Output_Unified.js'
];

let todosOk = true;
for (const arq of arquivos) {
  try {
    const conteudo = fs.readFileSync(arq, 'utf8');
    // Valida sintaxe usando o V8 via new Function (apenas parse, não executa)
    new Function(conteudo);
    console.log('✅ ' + arq + ' — sintaxe OK');
  } catch (e) {
    todosOk = false;
    console.error('❌ ' + arq + ' — ERRO DE SINTAXE: ' + e.message);
  }
}

console.log(todosOk ? '\n🎉 TODOS OS ARQUIVOS VÁLIDOS' : '\n🚨 HÁ ERROS DE SINTAXE');
process.exit(todosOk ? 0 : 1);

} // ⛔ FIM DO GUARD DE AMBIENTE NODE.JS