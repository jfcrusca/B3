# 🕵️ RELATÓRIO DE INVESTIGAÇÃO: SCORE ZERO EM ATIVOS LÍQUIDOS

**Data:** 08/08/2026
**Escopo:** VALE3, BBAS3, B3SA3, SUZB3, PRIO3, CMIG4, RAIL3, RDOR3, TRPL4, CPLE3
**Objetivo:** Identificar por que ativos com RR > 2 estão recebendo score 0 no `STRATEGY_EVALUATE_CORE`.

---

## 1. RESUMO EXECUTIVO

A investigação identificou que o fenômeno de "Score Zero" não é um bug de cálculo, mas um efeito cascata de **regras excessivamente restritivas** no motor `Core 22`. Ativos líderes (Blue Chips) estão sendo penalizados simultaneamente por **ADX Baixo (Mercado Lateral)** e **Volume Relativo < 0.6**, o que gera uma pontuação negativa que é "clampada" em 0.

**Veredito:** O sistema está operando em modo "Sniper Extremo", descartando ativos de alta liquidez quando eles entram em fases de consolidação, mesmo que o Risk/Reward técnico pareça atrativo.

---

## 2. ANÁLISE POR ATIVO (Simulação Sistêmica)

### Ativos Grupo A: VALE3, BBAS3, B3SA3, PRIO3
*   **Setup Identificado:** `📈 TENDÊNCIA CONFIRMADA` ou `🔭 RADAR`.
*   **Componentes do Score:**
    1.  Base: 30
    2.  ADX (< 20): **-45** (Penalidade de mercado lateral)
    3.  VolRel (< 0.6): **-60** (Penalidade dupla: -30 de faixa + -30 de veto de iliquidez)
    4.  RR (> 2.0): +5
*   **Score Resultante:** 30 - 45 - 60 + 5 = **-70** → `Math.max(0, -70)` = **0**.
*   **Linha Crítica:** `22_Core_Analyzers.js:435` (`s -= 45`) e `489` (`s -= 30`).

### Ativos Grupo B: TRPL4, CPLE3, CMIG4 (Elétricas)
*   **Setup Identificado:** `Aguardar melhor setup`.
*   **Causa do Zero:** Baixa volatilidade histórica resultando em ADX muito baixo (< 15). A penalidade de ADX (-45) sozinha anula a base (30) e os bônus de médias móveis (+20).
*   **Classificação:** `COMPORTAMENTO ESPERADO` (Ativos de dividendos/proteção raramente geram setups de momentum agressivo).

---

## 3. COMPARAÇÃO DE BENCHMARK

| Ticker | Score | Status | Motivo da Diferença |
|--------|-------|--------|----------------------|
| **TOTS3** | 91 | ✅ Aprovado | ADX > 30 (+25) e VolRel > 1.5 (+20). Momentum puro. |
| **VIIA3** | 62 | ✅ Aprovado | Setup de reversão com Volume forte compensando tendência fraca. |
| **ROXO34**| 64 | ✅ Aprovado | Recentemente listado/volátil, mantendo ADX > 22. |
| **VALE3** | 0 | ❌ Vetado | Consolidação em topo/fundo com volume decrescente. |

---

## 4. COMPONENTES DO "KILLER SCORE" (Hard Vetos)

O score chega a zero devido à sobreposição de:
1.  **ADX < 20 (-45 pts):** O sistema assume que em mercado lateral, qualquer sinal de médias ou RSI é "ruído".
2.  **Volume Relativo < 0.6 (-60 pts):** Uma regra de segurança para evitar *low caps* está "matando" Blue Chips em dias de liquidez abaixo da média.
3.  **Regime BEARISH (-30 pts):** Se o IBOV estiver em queda, a base de 30 é zerada antes mesmo de olhar o ativo.

---

## 5. CLASSIFICAÇÃO DAS CAUSAS RAIZ

| Causa | Classificação | Descrição |
|-------|---------------|-----------|
| **Veto de Volume < 0.6** | `REGRA EXCESSIVAMENTE RESTRITIVA` | Penalidade de -60 em Blue Chips é desproporcional. |
| **Penalidade ADX < 20** | `COMPORTAMENTO ESPERADO` | O robô é desenhado para Swing Trade de Tendência. |
| **Clamp Math.max(0, s)** | `BUG (Lógico)` | Scores negativos mascaram ativos que estão "quase lá" (-5) de ativos "péssimos" (-100). |
| **Dados de VALE3/PRIO3** | `DADO AUSENTE (Sazonal)` | Em feriados nos EUA (ADRs), o volume cai abaixo de 0.6 e o score zera. |

---

## 6. ESTRATÉGIA DE AJUSTE (RECOMENDAÇÃO)

*   **Flexibilizar Volume para IBOV:** Ativos que compõem o índice não deveriam sofrer a penalidade de "Veto de Iliquidez" (-30 cumulativo) mesmo com VolRel < 0.6.
*   **Reduzir Veto de ADX:** Trocar -45 por -25 para permitir que o RR > 3 e Médias alinhadas mantenham o ativo no "Radar" (Score 30-40) em vez de Zero.

---
*Relatório gerado pela Auditoria de Sistemas B3-v10.*
