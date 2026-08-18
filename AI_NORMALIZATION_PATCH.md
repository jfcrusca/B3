# 🩹 PATCH DE NORMALIZAÇÃO ESTRUTURAL DE SCORE DA IA

**Data:** 08/08/2026
**Versão:** 2.0
**Módulo:** `08_AI_Ensemble.js`

---

## 1. RESUMO DAS ALTERAÇÕES

Este patch implementa uma correção profunda no sistema de normalização de scores, eliminando a heurística ambígua `num > 1` e unificando o tratamento de escalas (0-1 e 0-100) em todos os workflows do Ensemble.

### Principais Mudanças:
- **Unificação para Escala 0-100:** Todos os workflows agora retornam scores em escala 0-100, garantindo compatibilidade com `AgentAnalyst` e `DecisionEngine`.
- **Nova Função `normalizeAIScore`:** Substitui as funções legadas, implementando detecção inteligente de escala e tratamento explícito para o caso crítico `1.0`.
- **Correção do Valor Crítico `1`:** Valores exatamente `1` agora são interpretados como `100` (escala 0-1 -> 100%), evitando a inversão de sinal (anteriormente tratado como 1/100).
- **Normalização nos Workflows A e C:** Adicionada normalização que faltava no enriquecimento rápido e no processamento em lote.
- **Auditoria Detalhada:** Logs no formato `[AI SCORE NORMALIZATION]` documentam entrada, escala detectada e saída final.
- **Limpeza de Código:** Removidas as funções `_normalizeScore`, `_extractScore` e `_extractTechScore` (código morto).
- **Restrição de Campos:** `_findScoreValue` agora busca apenas chaves específicas de score (`score`, `ai_score`, `aiScore`, `aiscore`), ignorando campos genéricos como `rating` ou `value`.

---

## 2. IMPACTO NOS COMPONENTES

| Componente | Workflow | Impacto | Mudança |
|------------|----------|---------|---------|
| **Scanner Rápido** | Workflow A | **ALTO** | Agora normaliza scores 0-1 retornados pela IA (antes ignorava). |
| **AgentAnalyst** | Workflow B | **CRÍTICO** | Resolve inversão no score `1` e elimina dupla normalização manual. |
| **Orchestrator Lote** | Workflow C | **ALTO** | Garante que scores individuais no lote sigam a nova regra de normalização. |
| **DecisionEngine** | Consumo | **NENHUM** | Continua recebendo 0-100, mas agora com maior confiabilidade. |

---

## 3. LOGS DE AUDITORIA

Exemplo de saída no console:
```
[AI SCORE NORMALIZATION] WorkflowB (Gemini) | Entrada: 0.85 | Escala: 0-1 | Resultado: 85
[AI SCORE NORMALIZATION] WorkflowB (DeepSeek) | Entrada: 75 | Escala: 0-100 | Resultado: 75
⚠️ [AI SCORE NORMALIZATION] Ambiguidade detectada (valor 1) de WorkflowC. Assumindo escala 0-1 -> 100.
```

---

## 4. INSTRUÇÕES DE VERIFICAÇÃO

1. Executar `TESTE_NORMALIZACAO_SCORE()` no `TESTE_NORMALIZACAO.js`.
2. Verificar o relatório gerado no log.
3. Observar a ausência de erros de escala no Dashboard após novas análises da IA.

---
*Patch gerado por Cline para B3-v10.*
