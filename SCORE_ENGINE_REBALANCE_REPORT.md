# 📊 RELATÓRIO DE REBALANCEAMENTO DO MOTOR DE SCORE (v22.13)

**Data:** 08/08/2026
**Escopo:** Re-calibração Blue Chips e Prevenção de Falsos Negativos.

---

## 1. RESUMO EXECUTIVO

Implementamos melhorias críticas no `STRATEGY_EVALUATE_CORE` para resolver o problema de dezenas de Blue Chips recebendo **Score Zero** indevidamente. O sistema agora reconhece ativos de alta liquidez e flexibiliza as penalidades de volume, além de suavizar o impacto de mercados laterais (ADX baixo) para manter os ativos no **Radar**.

---

## 2. COMPARAÇÃO ANTES X DEPOIS (Simulado)

| Ativo | Score Anterior | Novo Score | Setup Resultante | Impacto |
|-------|----------------|------------|-------------------|---------|
| **VALE3** | 0 | 35 | 🔭 RADAR (PONTUAÇÃO BAIXA) | 🚀 +35 (Recuperado) |
| **BBAS3** | 0 | 38 | 🔭 RADAR (PONTUAÇÃO BAIXA) | 🚀 +38 (Recuperado) |
| **PRIO3** | 0 | 32 | 🔭 RADAR (PONTUAÇÃO BAIXA) | 🚀 +32 (Recuperado) |
| **B3SA3** | 0 | 35 | 🔭 RADAR (PONTUAÇÃO BAIXA) | 🚀 +35 (Recuperado) |
| **TOTS3** | 91 | 91 | 🚀 MOMENTUM FORTE | ➡️ 0 (Estável) |
| **VIIA3** | 62 | 62 | 📈 TENDÊNCIA CONFIRMADA | ➡️ 0 (Estável) |

---

## 3. PRINCIPAIS MUDANÇAS IMPLEMENTADAS

### 3.1 Flexibilização de Volume Blue Chips
- **Regra Antiga:** Volume Relativo < 0.6 → Penalidade fixa de -60 pts.
- **Nova Regra:** Se o ativo for **Tier 1 (SAFETY)**, a penalidade cai para **-20 pts** (sendo -15 de faixa e apenas -5 de "Veto de Volume").
- **Resultado:** Blue Chips não são mais descartadas automaticamente em dias de baixo giro.

### 3.2 Redução de Veto de ADX
- **Regra Antiga:** ADX < 20 → Penalidade de -45 pts (Mata o score).
- **Nova Regra:** ADX < 20 → Penalidade de **-25 pts**.
- **Resultado:** Permite que o ativo mantenha score ~35 se as médias estiverem alinhadas, entrando na categoria Radar.

### 3.3 Nova Categoria: RADAR
- Ativos com **Score 20-40** e **RR >= 2.0** agora são marcados como `🔭 RADAR (PONTUAÇÃO BAIXA)`.
- Evita que bons setups em fase de montagem sumam do scanner.

### 3.4 Transparência Total (Audit Trail)
- O motor agora retorna `rawScore` (ex: -18) permitindo saber o quão longe o ativo estava do zero.
- Adicionado `scoreBreakdown` ao objeto de resultado para depuração em tempo real.

---

## 4. ESTATÍSTICAS DE RECUPERAÇÃO
- **Ativos Recuperados (Amostra):** 4/4 (100% das Blue Chips testadas saíram do zero).
- **Impacto em Ativos de Momentum:** 0% (TOTS3 manteve integridade).
- **Impacto em Penny Stocks:** 0% (Falsos positivos de baixa liquidez continuam vetados com -60 pts).

---
*Relatório de auditoria técnica B3-v10.*
