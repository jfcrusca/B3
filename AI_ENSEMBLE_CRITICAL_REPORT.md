# 🚨 AI_ENSEMBLE_CRITICAL_REPORT

**Data:** 08/08/2026
**Escopo:** Colisão entre `08_AI_Ensemble.js` e `55_AI_Ensemble.js`
**Severidade:** 🔴 CRÍTICA — colisão de objeto global com perda de funcionalidade em produção

---

## 1. Diagnóstico da Colisão

Ambos os arquivos declaram o **mesmo objeto global**:

```js
// 08_AI_Ensemble.js (L10)
var AIEnsemble = (function() { ... })();

// 55_AI_Ensemble.js (L21)
var AIEnsemble = (function () { ... })();
```

No Google Apps Script, os arquivos são **concatenados e carregados em ordem alfabética**. Como `08_` < `55_`, o módulo `55` é carregado por último e **sobrescreve completamente** o módulo `08`.

**Resultado:** Apenas as exportações do `55` sobrevivem em runtime. Todas as funções exclusivas do `08` são **perdidas silenciosamente** (sem erro de compilação, pois é reatribuição de variável).

---

## 2. Funções Perdidas (exclusivas do 08, sobrescritas pelo 55)

| Função | Exportada em 08 | Exportada em 55 | Status |
|--------|:---:|:---:|--------|
| `getEnhancedScore` | ✅ | ❌ | 🔴 **PERDIDA** |
| `analyzeWithEnsemble` | ✅ | ❌ | 🔴 **PERDIDA** |
| `TESTAR_ENSEMBLE` | ✅ | ❌ | 🔴 **PERDIDA** |
| `DEBUG_AI_FAILURE` | ✅ | ❌ | 🔴 **PERDIDA** |

### Consumidores quebrados por essas perdas

| Arquivo | Chamada | Impacto |
|---------|---------|---------|
| `00_Debug_Ensemble_Tests.js` | `AIEnsemble.DEBUG_AI_FAILURE("PETR4")` (L23) | 🔴 `TypeError: AIEnsemble.DEBUG_AI_FAILURE is not a function` |
| `00_Debug_Ensemble_Tests.js` | `AIEnsemble.TESTAR_ENSEMBLE()` (L41) | 🔴 `TypeError: AIEnsemble.TESTAR_ENSEMBLE is not a function` |
| `00_Debug_Ensemble_Tests.js` | `AIEnsemble.getEnhancedScore({...})` (L130) | 🔴 `TypeError: AIEnsemble.getEnhancedScore is not a function` |
| `VerificarFunciona.js` | `AIEnsemble.getEnhancedScore(analise)` (L132) | 🔴 `TypeError: AIEnsemble.getEnhancedScore is not a function` |

> ⚠️ **Nota:** `00_Debug_Ensemble_Tests.js` e `VerificarFunciona.js` são scripts de diagnóstico/verificação, não o pipeline principal. Porém, `getEnhancedScore` também é o fluxo de enriquecimento rápido do scanner (Workflow A do 08), que fica indisponível.

---

## 3. Funções Duplicadas (definidas em ambos, com comportamento divergente)

| Função | 08_AI_Ensemble.js | 55_AI_Ensemble.js | Conflito |
|--------|-------------------|-------------------|----------|
| `getEnhancedScoresBatch` | `(lista)` — itera 1 a 1, chama `getEnhancedScore` por ativo | `(candidatos)` — processa em lotes de 5 (`BATCH_SIZE`), 1 chamada IA por lote | 🔴 **Assinatura e lógica divergentes** |
| `analisar` | `(prompt, dadosTecnicos={}, macroRegime="NEUTRAL")` — multi-IA paralela com pesos dinâmicos por ADX/macro | `(prompt, options)` — Gemini + DeepSeek sequencial, ponderação fixa | 🔴 **Assinatura e retorno divergentes** |

### Divergência crítica em `analisar`

| Aspecto | 08 (perdido) | 55 (ativo) |
|---------|--------------|------------|
| 2º parâmetro | `dadosTecnicos` (objeto com `.ticker`, `.score`, `.adx`) | `options` (objeto com `.ticker`, `.score`, `.trend`, `.rsi`, `.adx`, `.macd`) |
| 3º parâmetro | `macroRegime` (string) | — (não existe) |
| Execução | `UrlFetchApp.fetchAll` paralelo + fallback sequencial | Sequencial Gemini→DeepSeek |
| Pesos | Dinâmicos (ADX + regime macro) | Fixos (`ENSEMBLE_WEIGHT_GEMINI`/`DEEPSEEK`) |
| Decisão | `COMPRA_FORTE`/`COMPRA`/`VENDA`/`VENDA_FORTE`/`NEUTRO` | `COMPRA`/`AGUARDAR` |
| Rejeição | `rejected` + `positionSize` + `pesos` | `rejected` + `breakdown` |

### Divergência crítica em `getEnhancedScoresBatch`

| Aspecto | 08 (perdido) | 55 (ativo) |
|---------|--------------|------------|
| Estratégia | 1 chamada IA por ativo (via `getEnhancedScore`) | Lotes de 5 ativos por chamada |
| Campos de retorno | `enrichedScore`, `ensembleScore`, `aiConfidence`, `sentiment`, `aiRationale`, `sources` | `enrichedScore`, `ensembleScore`, `aiScore`, `aiConfidence`, `sentiment`, `aiRationale`, `fallback` + preserva ~30 campos originais |
| Fallback | `sources: {tecnico, gemini}` | `fallback: true` + `_calcularScoreTecnicoFallback` |

---

## 4. Chamadas Quebradas (referências a APIs inexistentes)

### 4.1 `AIEnsemble.PESOS` — referência fantasma

`VerificarFunciona.js` (L159-163) acessa `AIEnsemble.PESOS`:

```js
const pesos = AIEnsemble.PESOS;
const ok = pesos.GEMINI === 0.50 && pesos.TECNICO === 0.50 ...
```

**Nenhum dos dois módulos exporta `PESOS`.** O 08 usa `PESOS_PADRAO` (privado, com `GEMINI/DEEPSEEK/TECH`) e o 55 usa `CONF` (privado). Resultado: **sempre lança exceção** → `❌ Ensemble — erro: Cannot read properties of undefined (reading 'GEMINI')`. Este teste de verificação de alta prioridade está **permanentemente quebrado**.

### 4.2 Compatibilidade do `analisar` com `36_Agent_Analyst.js`

`36_Agent_Analyst.js` (L162-169) chama:

```js
AIEnsemble.analisar(promptCompleto, {
  ticker, score, trend, rsi, adx, macd
});
```

- **Com o 55 ativo (estado atual):** funciona — `options` é lido corretamente. ✅
- **Se a ordem de carga mudar (08 ativo):** o 08 lê `dadosTecnicos.ticker`, `.score`, `.adx` — funciona parcialmente, mas ignora `trend`, `rsi`, `macd` e o 3º arg `macroRegime` fica `undefined`. O retorno `decision: "NEUTRO"` do 08 **não passa** no check `=== "COMPRA_FORTE" || === "COMPRA"` do AgentAnalyst → vira `AGUARDAR`. Comportamento muda silenciosamente. ⚠️

### 4.3 Compatibilidade do `getEnhancedScoresBatch` com `00_Core_Orchestrator.js`

`00_Core_Orchestrator.js` chama `AIEnsemble.getEnhancedScoresBatch(candidatosIA)` e espera `enrichedScore`, `ensembleScore`, `aiConfidence`, `sentiment`, `aiRationale`, `fallback`.

- **Com o 55 ativo:** retorna todos esses campos. ✅
- **Com o 08 ativo:** retorna `enrichedScore`, `ensembleScore`, `aiConfidence`, `sentiment`, `aiRationale`, `sources` — **mas NÃO retorna `fallback`**. O Orchestrator não depende de `fallback` no mapeamento, então funciona, mas o contrato diverge. ⚠️

---

## 5. Riscos em Produção

| # | Risco | Severidade | Descrição |
|---|-------|:---:|-----------|
| 1 | **Perda silenciosa de funções** | 🔴 Alta | `getEnhancedScore`, `analyzeWithEnsemble`, `TESTAR_ENSEMBLE`, `DEBUG_AI_FAILURE` somem sem erro de compilação. Qualquer chamada em runtime quebra com `TypeError`. |
| 2 | **Comportamento não determinístico** | 🔴 Alta | O resultado depende da **ordem alfabética de carga**. Qualquer renomeação de arquivo (ex: `08_` → `09_`) inverte o vencedor e muda toda a lógica de decisão. |
| 3 | **Dupla manutenção** | 🟠 Média | Correções aplicadas em um módulo são perdidas se o outro for o ativo. Ex: o 08 tem pesos dinâmicos por ADX/macro (mais sofisticado), mas o 55 (ativo) usa pesos fixos. A sofisticação do 08 está **morta em produção**. |
| 4 | **Contrato de `analisar` divergente** | 🟠 Média | O 08 retorna `decision: "NEUTRO"` e `positionSize`; o 55 retorna `decision: "AGUARDAR"`. Consumidores que dependem de `positionSize` (sizing dinâmico) quebram se o 08 vencer. |
| 5 | **`AIEnsemble.PESOS` sempre quebra** | 🟠 Média | Teste de verificação de alta prioridade (`VERIFICAR_CORRECOES_ALTA_PRIORIDADE`) falha permanentemente. |
| 6 | **Duplicação de lógica de parse** | 🟡 Baixa | `_safeParse` (08) e `_extrairJSON` (55) são implementações paralelas do mesmo problema — risco de divergência de comportamento. |
| 7 | **Consumo de API divergente** | 🟡 Baixa | O 08 usa `fetchAll` paralelo (2 chamadas simultâneas); o 55 usa chamadas sequenciais. Em rate-limit apertado, o comportamento de throttling difere. |

---

## 6. Estratégia de Merge (Recomendação)

### Objetivo
Unificar em **um único módulo** que preserve o melhor de ambos, sem quebrar consumidores.

### 6.1 Módulo canônico recomendado
Manter **`08_AI_Ensemble.js`** como base (mais sofisticado: pesos dinâmicos por ADX/macro, sizing dinâmico, `fetchAll` paralelo, fallback sequencial) e **absorver as melhorias do 55**.

### 6.2 Passos do merge

1. **Eliminar a colisão:** remover a declaração `var AIEnsemble` do `55_AI_Ensemble.js` (ou deletar o arquivo). Manter apenas o `08` como fonte única.

2. **Portar do 55 para o 08:**
   - `_cfg()` — leitura de configuração centralizada via `CONFIG.get()` (o 08 usa constantes hardcoded).
   - `_calcularScoreTecnicoFallback()` — fallback técnico robusto por RSI/ADX/RR/setup (o 08 só usa `scoreTecnico` bruto).
   - `_montarPromptBatch()` + lógica de **lote de 5** no `getEnhancedScoresBatch` (reduz chamadas de API de N para N/5).
   - `_makeFallbackResult()` — resultado fallback padronizado.
   - Preservação dos ~30 campos originais no retorno de `getEnhancedScoresBatch` (o 08 só espalha `...op`).

3. **Unificar `analisar`:** adotar a assinatura do 55 `analisar(prompt, options)` (compatível com `36_Agent_Analyst.js`), mas **incorporar a lógica de pesos dinâmicos e sizing do 08** dentro dela. Ler `macroRegime` de `options.macroRegime` (default `"NEUTRAL"`).

4. **Restaurar as exportações perdidas** no objeto de retorno do 08:
   ```js
   return {
     getEnhancedScore,          // do 08
     analyzeWithEnsemble,       // do 08
     getEnhancedScoresBatch,    // unificado (lote do 55 + campos do 08)
     analisar,                  // unificado (assinatura 55 + pesos 08)
     TESTAR_ENSEMBLE,           // do 08
     DEBUG_AI_FAILURE,          // do 08
     PESOS: PESOS_PADRAO        // NOVO — corrige VerificarFunciona.js
   };
   ```

5. **Corrigir `VerificarFunciona.js`:** o teste espera `PESOS.GEMINI === 0.50 && PESOS.TECNICO === 0.50`. O `PESOS_PADRAO` do 08 é `{GEMINI:0.40, DEEPSEEK:0.40, TECH:0.20}`. **Ajustar o teste** para refletir os pesos reais (ou expor `PESOS` com os valores esperados pelo teste).

6. **Padronizar o retorno de `analisar`:** garantir que sempre inclua `decision`, `finalScore`, `rejected`, `breakdown`, `rationale`, `sentiment` e, quando aplicável, `positionSize` e `pesos`.

### 6.3 Ordem de prioridade do merge
1. 🔴 Eliminar a dupla declaração global (passo 1).
2. 🔴 Restaurar `getEnhancedScore`, `TESTAR_ENSEMBLE`, `DEBUG_AI_FAILURE` (passo 4).
3. 🟠 Unificar `analisar` (passo 3) — desbloqueia o AgentAnalyst.
4. 🟠 Unificar `getEnhancedScoresBatch` (passo 2) — desbloqueia o Orchestrator com eficiência de lote.
5. 🟡 Corrigir `PESOS`/`VerificarFunciona.js` (passo 5).

### 6.4 Testes de regressão pós-merge
- `teste_ai_basico()` → `DEBUG_AI_FAILURE` deve responder.
- `teste_ensemble_mock()` → `TESTAR_ENSEMBLE` deve rodar.
- `teste_ensemble_real()` → `getEnhancedScore` deve retornar `finalScore`/`confidence`.
- `VERIFICAR_CORRECOES_ALTA_PRIORIDADE()` → `AIEnsemble.PESOS` deve existir.
- `36_Agent_Analyst.analyze()` → `analisar(prompt, options)` deve retornar `decision`/`breakdown`.
- `00_Core_Orchestrator._enriquecerComIA()` → `getEnhancedScoresBatch` deve retornar `enrichedScore`/`ensembleScore`/`fallback`.

---

## 7. Resumo Executivo

| Item | Status |
|------|--------|
| Funções perdidas | 4 (`getEnhancedScore`, `analyzeWithEnsemble`, `TESTAR_ENSEMBLE`, `DEBUG_AI_FAILURE`) |
| Funções duplicadas | 2 (`getEnhancedScoresBatch`, `analisar`) — com assinaturas e lógica divergentes |
| Chamadas quebradas | 4 em `00_Debug_Ensemble_Tests.js` + 1 em `VerificarFunciona.js` + `AIEnsemble.PESOS` fantasma |
| Riscos em produção | 7 (2 críticos, 3 médios, 2 baixos) |
| Ação recomendada | Merge em `08_AI_Ensemble.js`, absorvendo lote/fallback/config do `55`, restaurando exportações e expondo `PESOS` |

**Conclusão:** A colisão é **crítica e ativa em produção**. O módulo `55` sobrescreve o `08`, matando o fluxo de enriquecimento rápido (`getEnhancedScore`) e os utilitários de debug, além de deixar o teste `AIEnsemble.PESOS` permanentemente quebrado. A correção exige merge definitivo em um único módulo canônico.
