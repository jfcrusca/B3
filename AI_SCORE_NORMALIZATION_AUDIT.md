# 🧮 AUDITORIA DE NORMALIZAÇÃO DE SCORE DA IA

**Data:** 08/08/2026
**Escopo:** Gemini · DeepSeek · AIEnsemble · AgentAnalyst
**Objetivo:** Mapear escalas de retorno (0-1 vs 0-100), conversões automáticas e riscos de dupla normalização no pipeline de score.

---

## 1. RESUMO EXECUTIVO

O pipeline de score da IA usa **três workflows distintos** com **contratos de escala diferentes** e **heurísticas de auto-detecção** (`num > 1.0`) para decidir se um valor está em escala 0-1 ou 0-100. Essa heurística é **ambígua no valor exato `1`** e **não protege contra a IA ignorar o prompt de escala**, gerando riscos reais de **inversão de score** e **subestimação severa**.

**Veredito:** A normalização é **funcional nos caminhos felizes**, mas **frágil** — depende de a IA obedecer o prompt e de nenhum score cair exatamente em `1`. Há **3 riscos de dupla normalização** e **1 risco de inversão completa** documentados abaixo.

---

## 2. MAPA DE ESCALAS POR COMPONENTE

| Componente | Arquivo | Escala de entrada | Escala de saída | Normalização |
|-----------|---------|-------------------|-----------------|--------------|
| **Gemini (conector)** | `07_AI_Unified_Connector.js` | — | Texto/JSON bruto | Nenhuma (retorna raw) |
| **DeepSeek (conector)** | `07_AI_Unified_Connector.js` | — | Texto/JSON bruto | Nenhuma (retorna raw) |
| **AIEnsemble — Workflow A** (`getEnhancedScore`/`analyzeWithEnsemble`) | `08_AI_Ensemble.js` | 0-100 (prompt) | **0-100** | Clamp `Math.min(100, Math.max(0, score))` — **sem normalização** |
| **AIEnsemble — Workflow B** (`analisar`) | `08_AI_Ensemble.js` | 0-1 (prompt) | **0-100** | `_normalizeScore` (0-1) → `*100` |
| **AIEnsemble — Workflow C** (`getEnhancedScoresBatch`) | `08_AI_Ensemble.js` | 0-100 (prompt) | **0-100** | Clamp `Math.round` — **sem normalização** |
| **AgentAnalyst** | `36_Agent_Analyst.js` | 0-100 (`finalScore`) | **0-100** (`ai_score`) | `Math.round` |
| **DecisionEngine** | `34_DecisionEngine.js` | 0-100 (`ai_score`) | 0-100 | `_clampScore` |
| **Orchestrator** | `00_Core_Orchestrator.js` | 0-100 | 0-100 | Direto |

**Conclusão do mapa:** O conector (`07`) é agnóstico de escala — a normalização acontece **exclusivamente no `08_AI_Ensemble.js`**, que expõe **três contratos de escala diferentes** dependendo da função chamada.

---

## 3. FLUXO DETALHADO POR WORKFLOW

### 3.1 Workflow B — `analisar(prompt, options)` (usado pelo AgentAnalyst)

Este é o caminho **crítico** (Sentinela/AgentAnalyst). Fluxo:

```
1. rawTechScore = dadosTecnicos.score || 50          // 0-100 (do AgentAnalyst)
2. techScore = rawTechScore > 1 ? rawTechScore : rawTechScore * 100   // heurística > 1
3. promptGemini/DeepSeek pedem: {"score": número entre 0.00 e 1.00}   // 0-1
4. gS = _extractScore(gemini)      // _normalizeScore → 0-1
5. dS = _extractScore(deepseek)    // _normalizeScore → 0-1
6. if (gS !== null) gS *= 100;     // CONVERSÃO 0-1 → 0-100
7. if (dS !== null) dS *= 100;     // CONVERSÃO 0-1 → 0-100
8. finalScore = (w.GEMINI * gS) + (w.DEEPSEEK * dS) + (w.TECH * techScore)  // 0-100
9. decision = _scoreToDecision(finalScore / 100)      // 0-100 → 0-1
10. positionSize = _calcularSizingDinamico(finalScore/100, (gS||0)/100, (dS||0)/100, ...)  // 0-1
11. return { finalScore: Math.round(finalScore), ... }  // 0-100
```

**Escala interna consistente:** Após o passo 6-7, tudo está em 0-100. Os passos 9-10 convertem corretamente para 0-1 para as funções de decisão/sizing. ✅

### 3.2 Workflow A — `getEnhancedScore` / `analyzeWithEnsemble`

```
1. _getGeminiAnalysis pede: {"score": 0-100, ...}     // 0-100
2. score = Math.min(100, Math.max(0, score))          // clamp 0-100, SEM normalização
3. totalScore = (tecnicoScore * 0.5) + (gemini.score * 0.5)   // 0-100
4. finalScore = Math.min(100, Math.max(0, totalScore))        // 0-100
```

**⚠️ Contrato de escala DIFERENTE do Workflow B:** aqui o prompt pede 0-100 e **não há normalização**. Se a IA retornar 0-1 (ignorando o prompt), o score é tratado como 0-100 → **subestimação severa**.

### 3.3 Workflow C — `getEnhancedScoresBatch`

```
1. Prompt batch pede: {"score": <0-100>, ...}         // 0-100
2. aiScore = Math.max(0, Math.min(100, Math.round(parsedItem.score)))  // clamp, SEM normalização
3. ensembleScore = Math.round((scoreBase * 0.4) + (aiScore * 0.6))     // 0-100
```

**⚠️ Mesmo risco do Workflow A:** sem normalização. Se a IA retornar 0-1, `Math.round(0.85)` = `1` (não 85).

---

## 4. FUNÇÕES DE NORMALIZAÇÃO (Código)

### 4.1 `_normalizeScore(val)` — linha 976

```js
var normalized = num > 1.0 ? num / 100 : num;
```

**Heurística de auto-detecção de escala:** `num > 1.0` → assume 0-100 e divide por 100; senão assume 0-1.

**🔴 RISCO CRÍTICO — valor exato `1`:**
- Se a IA retorna `{"score": 1}` significando **1/100** (extremamente bearish), `1 > 1.0` é **falso** → tratado como 0-1 → retorna `1.0`.
- No Workflow B, `gS *= 100` → **100** (extremamente bullish). **Inversão completa do sinal.**
- O mesmo vale para `techScore`: `rawTechScore = 1` (0-100) → `1 > 1` falso → `1 * 100 = 100`.

### 4.2 `_extractScore(obj)` — linha 910

- Aceita objeto, string ou número.
- Para string, busca `score:` ou o primeiro número solto.
- Delega a `_normalizeScore` → retorna **0-1**.

### 4.3 `_findScoreValue(data)` — linha 937

- Procura chaves `score|ai_score|aiscore|aiScore|value|rating|result|resultado`.
- **⚠️ Risco:** pode capturar um campo de escala diferente (ex: `rating` 0-5 estrelas) e normalizar incorretamente como 0-1.

### 4.4 `_extractTechScore(data)` — linha 996

```js
if (data.score !== undefined) return data.score > 1 ? data.score / 100 : data.score;
```

- **Retorna 0-1**, mas **NUNCA é chamado** (dead code).
- **⚠️ Inconsistência de contrato:** se fosse conectado, retornaria 0-1 enquanto o resto do `analisar` opera em 0-100 → dupla normalização.

### 4.5 `_safeParse(text)` — linha 1009

- Se o JSON parseado for um **número solto**, retorna `{ score: parsed }`.
- `0.75` → `{score: 0.75}` → 0-1. `75` → `{score: 75}` → `_normalizeScore(75)` → 0.75. Ambos OK, mas a ambiguidade do `1` persiste.

---

## 5. RISCOS DE DUPLA NORMALIZAÇÃO (Priorizados)

### 🔴 RISCO 1 — Inversão completa no valor `1` (CRÍTICO)

| Cenário | Valor IA | `_normalizeScore` | `*100` | Resultado | Correto? |
|---------|----------|-------------------|--------|-----------|----------|
| IA retorna 1/100 (bearish) | `1` | `1 > 1.0` = falso → `1.0` | `100` | **100 (bullish)** | ❌ **INVERTIDO** |
| IA retorna 1.0/1.0 (bullish) | `1.0` | `1.0 > 1.0` = falso → `1.0` | `100` | 100 (bullish) | ✅ |

**Impacto:** Um score de `1` (0-100) é interpretado como `100`. Em ativos fracos, a IA pode retornar `1` e o sistema aprovaria como forte. **Inversão de sinal.**

### 🔴 RISCO 2 — Workflow A/C sem normalização (ALTO)

- Workflow A (`_getGeminiAnalysis`) e C (`getEnhancedScoresBatch`) pedem 0-100 e **só fazem clamp**, sem normalização.
- Se a IA retorna 0-1 (ignorando o prompt), um `0.85` vira `0.85` (Workflow A) ou `1` (Workflow C) em vez de `85`.
- **Impacto:** Subestimação severa → ativos bons rejeitados ou com score irrisório.

### 🟡 RISCO 3 — `techScore` heuristic `> 1` (MÉDIO)

- `rawTechScore > 1 ? rawTechScore : rawTechScore * 100`.
- Se um chamador passar score técnico 0-1 (ex: `0.75`), vira `75`. Se passar 0-100 `1`, vira `100`. A heurística não distingue.
- **Impacto:** Depende do contrato do chamador. Hoje o AgentAnalyst passa 0-100, então OK, mas é frágil.

### 🟡 RISCO 4 — `_scoreToDecision`/`_calcularSizingDinamico` esperam 0-1 (LATENTE)

- Recebem `finalScore / 100`. Se `finalScore` fosse 0-1 (contrato violado upstream), `/100` → quase zero → **sempre NEUTRO/VENDA**.
- **Impacto:** Latente — só ocorre se um workflow retornar 0-1 onde se espera 0-100.

### 🟡 RISCO 5 — `_findScoreValue` captura campo errado (MÉDIO)

- Aceita `value|rating|result`. Um `rating` 0-5 estrelas seria normalizado como 0-1 → `5` → `5/100 = 0.05` → `*100 = 5` (quase zero).
- **Impacto:** Score irrisório se a IA incluir um campo `rating` no JSON.

### 🟢 RISCO 6 — `_extractTechScore` dead code (BAIXO)

- Definido, nunca chamado, retorna 0-1 (contrato divergente). Risco de confusão futura.

---

## 6. CONSUMIDORES — VALIDAÇÃO DE ESCALA

| Consumidor | Campo | Escala esperada | Verificação |
|-----------|-------|-----------------|-------------|
| `36_Agent_Analyst.js` | `ensembleResult.finalScore` → `ai_score` | 0-100 | ✅ `Math.round(finalScore)`; thresholds 60/40 consistentes |
| `34_DecisionEngine.js` | `analise.ai_score` | 0-100 | ✅ `_clampScore(analise.ai_score)` |
| `00_Core_Orchestrator.js` | `op.aiScore` | 0-100 | ✅ `op.aiScore = op.score` (0-100) |
| `15_AI_Agentic_Enricher.js` | `op.enrichedScore` | 0-100 | ✅ `op.enrichedScore = op.score` |

**Todos os consumidores esperam 0-100 e recebem 0-100 nos caminhos felizes.** ✅

---

## 7. RECOMENDAÇÕES

### 7.1 Correções de alto impacto

1. **Eliminar a ambiguidade do `1` em `_normalizeScore`:**
   - Tratar `num === 1` como **0-100** (mais provável em ativos fracos) OU exigir escala explícita no prompt.
   - Melhor: mudar o prompt para pedir `{"score": 0-100}` em **todos** os workflows e remover a heurística `> 1.0`.

2. **Unificar o contrato de escala para 0-100 em todos os workflows:**
   - Workflow A, B e C devem pedir 0-100 e normalizar de forma idêntica.
   - Eliminar a divergência entre `_getGeminiAnalysis` (0-100, sem normalização) e `analisar` (0-1, com normalização).

3. **Adicionar guarda de normalização no Workflow A e C:**
   - Se `parsedItem.score <= 1`, multiplicar por 100 (assumindo 0-1) antes do clamp — ou rejeitar o item.

### 7.2 Correções de médio impacto

4. **Restringir `_findScoreValue`** a chaves `score|ai_score|aiscore|aiScore` (remover `value|rating|result` genéricos).

5. **Remover ou corrigir `_extractTechScore`** (dead code com contrato divergente).

6. **Adicionar log de escala detectada** em `_normalizeScore` (já existe parcialmente via `[DEBUG _normalizeScore]`) e alerta quando `num === 1`.

---

## 8. ANEXO — LINHAS-CHAVE

| Arquivo | Linha | Trecho |
|---------|-------|--------|
| `08_AI_Ensemble.js` | 646-647 | `if (gS !== null) gS *= 100;` |
| `08_AI_Ensemble.js` | 656 | `finalScore = (w.GEMINI*gS) + (w.DEEPSEEK*dS) + (w.TECH*techScore)` |
| `08_AI_Ensemble.js` | 713 | `_scoreToDecision(finalScore / 100)` |
| `08_AI_Ensemble.js` | 715 | `_calcularSizingDinamico(finalScore/100, (gS||0)/100, (dS||0)/100, ...)` |
| `08_AI_Ensemble.js` | 987 | `var normalized = num > 1.0 ? num / 100 : num;` |
| `08_AI_Ensemble.js` | 996-999 | `_extractTechScore` (dead code, retorna 0-1) |
| `08_AI_Ensemble.js` | 898 | `score: Math.min(100, Math.max(0, score))` (Workflow A, sem normalização) |
| `08_AI_Ensemble.js` | 888 | Prompt Workflow A: `{"score": 0-100}` |
| `08_AI_Ensemble.js` | ~470 | Prompt Workflow B: `{"score": número entre 0.00 e 1.00}` |
| `08_AI_Ensemble.js` | ~450 | Prompt Workflow C: `{"score": <0-100>}` |
| `36_Agent_Analyst.js` | — | `ai_score = Math.round(finalScore)` (0-100) |
| `34_DecisionEngine.js` | — | `_clampScore(analise.ai_score)` (0-100) |

---

*Relatório gerado a partir da análise estática de `07_AI_Unified_Connector.js`, `08_AI_Ensemble.js`, `55_AI_Ensemble.js`, `34_AI_Service.js`, `36_Agent_Analyst.js`, `34_DecisionEngine.js` e `00_Core_Orchestrator.js`.*
