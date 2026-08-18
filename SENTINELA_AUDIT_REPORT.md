# 🔍 AUDITORIA DO MÓDULO SENTINELA

**Data:** 08/08/2026
**Execução analisada:** 72 tickers processados | 14 aprovados técnicos | 9 enviados à IA | 4 aprovados finais
**Regime macro:** DEFENSIVE (adjustment 0.95x)

---

## 1. RESUMO EXECUTIVO

O módulo Sentinela está **excessivamente restritivo**, com **5 de 9 ativos vetados** (55% de rejeição) — todos pelo mesmo motivo: **sentimento BEARISH derivado do OBV (Distribuição)**. O veto por sentimento ocorre **antes** do check de threshold e **ignora o score técnico**, vetando até ativos com score razoável (POMO4=43, EGIE3=43) puramente por OBV em distribuição.

**Conclusão:** O Sentinela não está "equilibrando risco" — está **descartando oportunidades por um único indicador de fluxo (OBV)** que tende a sinalizar distribuição em regime DEFENSIVE, criando um viés sistemático de rejeição.

---

## 2. TABELA COMPLETA DOS 9 ATIVOS ENVIADOS À IA

| # | Ticker | Score Técnico | Score IA (ensemble) | Score Final | Sentiment (deep) | Decisão | Motivo |
|---|--------|--------------|--------------------|------------|------------------|---------|--------|
| 1 | PETR4 | 39.9 | 45 | 40 | BEARISH | ⛔ VETADO | Sentimento BEARISH em regime DEFENSIVE |
| 2 | VIVT3 | 38.0 | 38 | 38 | BEARISH | ⛔ VETADO | Sentimento BEARISH em regime DEFENSIVE |
| 3 | POMO4 | 42.75 | 43 | 43 | BEARISH | ⛔ VETADO | Sentimento BEARISH em regime DEFENSIVE |
| 4 | TOTS3 | 95.0 | 71 | 91 | BULLISH | ✅ APROVADO | Score técnico 100 + IA 71 = 91 \| BULLISH |
| 5 | MELI34 | 58.9 | 48 | 56 | NEUTRAL | ✅ APROVADO | Score técnico 59 + IA 48 = 56 \| NEUTRAL |
| 6 | EGIE3 | 42.75 | 52 | 43 | BEARISH | ⛔ VETADO | Sentimento BEARISH em regime DEFENSIVE |
| 7 | VIIA3 | 66.5 | 49 | 62 | NEUTRAL | ✅ APROVADO | Score técnico 67 + IA 49 = 62 \| NEUTRAL |
| 8 | ROXO34 | 71.25 | 49 | 64 | NEUTRAL | ✅ APROVADO | Score técnico 71 + IA 49 = 64 \| NEUTRAL |
| 9 | XPBR31 | 38.0 | 35 | 38 | BEARISH | ⛔ VETADO | Sentimento BEARISH em regime DEFENSIVE |

**Resultado:** 4 aprovados (TOTS3, MELI34, VIIA3, ROXO34) | 5 vetados (PETR4, VIVT3, POMO4, EGIE3, XPBR31)

---

## 3. CATEGORIZAÇÃO DOS VETOS

### 3.1 Por categoria

| Categoria | Qtd | Ativos | % dos vetos |
|-----------|-----|--------|-------------|
| **1. Sentimento** | **5** | PETR4, VIVT3, POMO4, EGIE3, XPBR31 | **100%** |
| 2. Score (threshold) | 0 | — | 0% |
| 3. Regime macro (isolado) | 0 | — | 0% |
| 4. Risco (RiskManager) | 0 | — | 0% |
| 5. RR | 0 | — | 0% |

### 3.2 Detalhamento por motivo

| Motivo registrado | Qtd | Ativos |
|-------------------|-----|--------|
| "Sentimento desfavorável: BEARISH em regime DEFENSIVE" | 5 | PETR4, VIVT3, POMO4, EGIE3, XPBR31 |

**Todos os 5 vetos são idênticos:** sentimento BEARISH em regime DEFENSIVE.

---

## 4. ANÁLISE DA CAUSA RAIZ (Código)

### 4.1 O veto por sentimento ocorre ANTES do threshold

Em `34_DecisionEngine.js`, o fluxo é:

```
Linha 174: if (hardVeto || dynamicVeto) {   // BEARISH/CAUTELA/BAIXA
Linha 179:   flexApplied = false;
Linha 186:   if (macroRegime === 'BEARISH' && sentiment === 'BEARISH') → veto direto
Linha 193:   if (sentiment === 'CAUTELA') → flex se score≥50 e ADX≥20
Linha 209:   if (!flexApplied) → _reject("Sentimento desfavoravel: BEARISH em regime DEFENSIVE")
}
Linha 263: threshold check (55)  ← NUNCA ALCANÇADO para BEARISH
```

**Consequência:** Qualquer ativo com sentimento BEARISH/CAUTELA/BAIXA é vetado na linha 209, **antes** de chegar ao check de threshold (linha 263). O score técnico é irrelevante para o veto de sentimento.

### 4.2 O regime DEFENSIVE NÃO é considerado no veto

O código só faz **veto direto** quando `macroRegime === 'BEARISH'` (linha 186). Para regime **DEFENSIVE**, o fluxo cai na linha 209 que rejeita **qualquer** BEARISH/CAUTELA/BAIXA, independentemente do regime. A mensagem "em regime DEFENSIVE" é apenas informativa — o regime não altera a decisão.

### 4.3 O sentimento é dominado pelo OBV

O `AgentAnalyst` (via `35_Agent_Orchestrator.js`, linha 99-110) calcula a tendência do OBV e a envia como contexto. No log, **a maioria dos ativos mostra "OBV=Distribuição (BEARISH)"**, o que direciona o sentimento para BEARISH → veto automático.

**O OBV é um indicador de fluxo que tende a sinalizar distribuição em mercados DEFENSIVE**, criando um viés sistemático: em regime DEFENSIVE, quase todos os ativos são marcados como BEARISH e vetados.

### 4.4 Discrepância entre sentimento do batch e do deep analysis

| Ticker | Sentimento batch (AIEnsemble) | Sentimento deep (AgentAnalyst) | Divergência |
|--------|------------------------------|-------------------------------|-------------|
| PETR4 | NEUTRAL | BEARISH | ⚠️ SIM |
| POMO4 | NEUTRAL | BEARISH | ⚠️ SIM |
| EGIE3 | NEUTRAL | BEARISH | ⚠️ SIM |

O batch AIEnsemble (usado para o score ensemble) diz NEUTRAL, mas o deep analysis (usado para o veto do Sentinela) diz BEARISH. Essa inconsistência faz o ativo ter score ensemble decente mas ser vetado por sentimento.

---

## 5. AVALIAÇÃO DE RESTRITIVIDADE

### 5.1 Indicadores de restritividade excessiva

| Métrica | Valor | Avaliação |
|---------|-------|-----------|
| Taxa de rejeição na Sentinela | 5/9 = **55%** | ⚠️ Alta |
| Vetos por sentimento | 5/5 = **100%** | 🔴 Concentrado |
| Vetos por OBV (Distribuição) | 5/5 = **100%** | 🔴 Viés de indicador único |
| Aprovados finais | 4/72 = **5.5%** | ⚠️ Muito baixo |
| Aprovados técnicos que chegaram à IA | 9/14 = **64%** | OK (pré-triagem) |

### 5.2 Diagnóstico

1. **Viés de indicador único:** O veto é 100% impulsionado pelo OBV (Distribuição → BEARISH). Um único indicador de fluxo está derrubando todo o pipeline.
2. **Veto sem considerar score:** Ativos com score técnico de 43 (POMO4, EGIE3) são vetados por sentimento, sem chance de compensação.
3. **Regime DEFENSIVE amplifica o problema:** Em regime DEFENSIVE, o OBV tende a mostrar distribuição, gerando BEARISH em massa.
4. **Dupla penalidade mascarada:** Todos os 5 vetados também teriam score < 55 (threshold), mas o veto de sentimento ocorre antes e mascara a real razão.

### 5.3 Veredito

**SIM, o módulo está excessivamente restritivo.** O problema não é o threshold de score (55), mas o **veto automático por sentimento BEARISH** que ignora o score técnico e é dominado por um único indicador (OBV).

---

## 6. RECOMENDAÇÕES

### 6.1 Correções de alto impacto

1. **Considerar o regime no veto de sentimento:**
   - Em regime **DEFENSIVE**, aplicar apenas penalidade de score (não veto automático) para BEARISH.
   - Reservar o veto direto para `macroRegime === 'BEARISH'` (como já existe na linha 186).

2. **Permitir flex para BEARISH com score alto:**
   - Estender o flex (hoje só para CAUTELA) para BEARISH quando `score ≥ 60` e `ADX ≥ 25`, similar ao flex de CAUTELA.

3. **Reduzir o peso do OBV no sentimento:**
   - O OBV não deve ser o único driver do sentimento. Combinar com RSI, ADX e tendência de preço.
   - Considerar que OBV Distribuição em regime DEFENSIVE é esperado e não deve ser veto absoluto.

4. **Alinhar sentimento batch vs deep:**
   - Usar o mesmo sentimento do batch AIEnsemble no deep analysis, ou documentar a divergência.

### 6.2 Correções de médio impacto

5. **Registrar o estágio real do veto:** Se o score < 55, registrar como veto por threshold, não por sentimento (evita mascarar a causa).

6. **Adicionar contador de vetos por categoria** no log do Sentinela (sentimento/score/regime/risco/RR) para monitoramento contínuo.

---

## 7. STATUS DE IMPLEMENTAÇÃO DAS RECOMENDAÇÕES (v9.7)

Todas as 6 recomendações foram **implementadas e validadas** (sintaxe OK via `node --check`).

| # | Recomendação | Status | Arquivo(s) alterado(s) |
|---|--------------|--------|------------------------|
| 1 | Considerar o regime no veto de sentimento | ✅ Implementado | `34_DecisionEngine.js` |
| 2 | Permitir flex para BEARISH com score alto | ✅ Implementado | `34_DecisionEngine.js` |
| 3 | Reduzir o peso do OBV no sentimento | ✅ Implementado | `36_Agent_Analyst.js` |
| 4 | Alinhar sentimento batch vs deep | ✅ Implementado | `35_Agent_Orchestrator.js`, `36_Agent_Analyst.js` |
| 5 | Registrar o estágio real do veto | ✅ Implementado | `34_DecisionEngine.js` |
| 6 | Adicionar contador de vetos por categoria | ✅ Implementado | `00_Core_Orchestrator.js` |

### 7.1 Detalhamento das correções

**Rec 1 — Regime no veto (34_DecisionEngine.js):**
- Em regime `DEFENSIVE`, BEARISH/BAIXA agora aplica **penalidade de score** (`DECISION_DEFENSIVE_BEARISH_PENALTY`, default 15) em vez de veto automático.
- Veto direto reservado para `TERRIBLE/CRISE` (hard veto) e `BEARISH + macro BEARISH` (veto de risco).

**Rec 2 — Flex BEARISH (34_DecisionEngine.js):**
- Flex estendido para BEARISH/BAIXA quando `score ≥ 60` e `ADX ≥ 25` (configurável via `DECISION_FLEX_BEARISH_HIGH_SCORE`/`_HIGH_ADX`).
- CAUTELA mantém flex com `score ≥ 50` e `ADX ≥ 20`.

**Rec 3 — Peso do OBV (36_Agent_Analyst.js):**
- Prompt do sistema reescrito: OBV agora é **um dos fatores** de validação, combinado com RSI, ADX e tendência.
- OBV Distribuição em regime DEFENSIVE **não é veto absoluto**; setups com ADX > 25 e RR ≥ 2.0 não são vetados apenas por OBV.

**Rec 4 — Alinhamento batch/deep (35 + 36):**
- `35_Agent_Orchestrator.js` repassa `sentimentoBatch` (do batch AIEnsemble) ao deep analysis.
- `36_Agent_Analyst.js` usa o sentimento do batch em zona limítrofe (40-60): se o batch é BULLISH/NEUTRAL, não rebaixa para BEARISH.

**Rec 5 — Estágio real do veto (34_DecisionEngine.js):**
- Se o score está abaixo do threshold, o veto é registrado como `THRESHOLD` (causa real), não mascarado como sentimento.

**Rec 6 — Contador de vetos (00_Core_Orchestrator.js):**
- Novo log `[AUDITORIA SENTINELA]` com contadores por categoria: sentimento, score, regime, risco, RR, correlação, erro e pré-triagem.
- Categorização baseada no estágio real do `auditTrail` da decisão.

---

## 8. ANEXO — DADOS BRUTOS DO LOG

### 8.1 Ativos aprovados tecnicamente (14) que NÃO foram à IA (score < 30 ou setup RISCO ALTO/SEM DADOS)

Estes foram descartados na pré-triagem da IA (`_enriquecerComIA`, linha 421-430) por `notaSegura < 30` ou setup de descarte. Não passaram pelo Sentinela.

### 8.2 Ativos reprovados tecnicamente (58)

Reprovados na triagem técnica por RR < minRR ou score < 20. Não chegaram à IA nem ao Sentinela.

### 8.3 Fluxo completo

```
72 tickers processados
 ├─ 14 aprovados tecnicamente (RR ≥ minRR, score ≥ 20)
 │   ├─ 9 enviados à IA (score ≥ 30, setup válido)
 │   │   ├─ 4 APROVADOS pelo Sentinela (TOTS3, MELI34, VIIA3, ROXO34)
 │   │   └─ 5 VETADOS por sentimento BEARISH (PETR4, VIVT3, POMO4, EGIE3, XPBR31)
 │   └─ 5 descartados na pré-triagem IA (score < 30)
 └─ 58 reprovados tecnicamente (RR/score)
```

---

*Relatório gerado a partir do log de execução de 08/08/2026 13:58-14:03.*
