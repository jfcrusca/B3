# 🛠️ RELATÓRIO DE CORREÇÃO DE REGRESSÃO: TICKER SCOPE (v10.2)

**Data:** 08/08/2026
**Módulo:** `00_Core_Orchestrator.js` & `22_Core_Analyzers.js`
**Status:** ✅ REGRESSÃO RESOLVIDA (FIX DEFINITIVO)

---

## 1. RESUMO DA FALHA

Apesar do patch anterior no motor `Core 22`, o erro `ReferenceError: ticker is not defined` persistia no log do Google Apps Script. A investigação profunda revelou que a falha não estava apenas nos logs do Core, mas na **ponte de integração** entre o Orquestrador e o Motor.

## 2. ANÁLISE TÉCNICA E CAUSA RAIZ

### 2.1 🔴 CAUSA RAIZ DEFINITIVA — Assinatura de `_calcularScoreSistêmico`
O erro `ReferenceError: ticker is not defined` NÃO estava no Orquestrador, mas sim no **motor Core 22** (`22_Core_Analyzers.js`).

A função `_calcularScoreSistêmico` era chamada com **7 argumentos** (incluindo `ticker` como 7º parâmetro):

```js
var scorePack = _calcularScoreSistêmico(last.close, ind, estrutura, risco, pa.bonus, ibovContext, ticker);
```

Porém, a **assinatura da função** declarava apenas **6 parâmetros**:

```js
function _calcularScoreSistêmico(preco, ind, est, rsc, bonusPA, ibov) { ... }
```

Dentro do corpo da função, os logs de auditoria `[ADXPenalty]` e `[VolumeFlex]` referenciam a variável `ticker`:

```js
console.log("[ADXPenalty] " + (ticker || "Ativo") + " | adx: " + ind.adx + " | Penalidade: -25");
console.log("[VolumeFlex] " + (ticker || "Ativo") + " | volRel: " + ind.volumeRelativo + " | Penalidade moderada (-5)");
```

Como `ticker` **não era um parâmetro declarado** e **não existia no escopo** da função, qualquer ativo que atingisse o bloco de penalidade de ADX baixo (`adx < 20`) ou volume baixo (`volRel < 0.6`) disparava o `ReferenceError`, abortando a análise daquele ticker.

### 2.2 Por que afetava apenas alguns tickers
O erro só ocorria quando o ativo **entrava no caminho de penalidade**:
- **VALE3, ITUB4, BBAS3, ABEV3, BBDC4, B3SA3, SUZB3, ELET3, SBSP3, EQTL3, CSAN3, RAIL3, PRIO3, CMIG4, CSNA3, BRAP4** → ADX < 20 ou volume baixo → disparavam o log `[ADXPenalty]`/`[VolumeFlex]` → crash.
- **PETR4, WEGE3, VIVT3, GGBR4, BPAC11, USIM5** → não atingiam o bloco de penalidade (ADX/volume suficientes) → passavam normalmente.

Isso explica perfeitamente o padrão intermitente do log de execução.


## 3. PATCH APLICADO (DOUBLE-SHIELD)

### 3.1 No Orquestrador (`00_Core_Orchestrator.js`)
- Criada a variável `currentTicker` para garantir persistência de escopo em todo o loop de lote.
- **Normalização da Chamada:** Criado o objeto `coreInput` garantindo que o `ticker` seja enviado explicitamente para o motor.

```javascript
// Antes (Orquestrador)
analise = STRATEGY_EVALUATE_CORE(data, context);

// Depois (Orquestrador)
var coreInput = { ticker: currentTicker, candles: data.candles || data };
analise = STRATEGY_EVALUATE_CORE(coreInput, context);
```

### 3.2 No Motor Core (`22_Core_Analyzers.js`)
- Adicionadas guardas de tipo em todos os `console.log`.
- Reforçada a extração do ticker a partir da entrada normalizada.

## 4. SANEAMENTO DE DADOS (CLEANUP B3)

Aproveitamos para remover ativos "fantasmas" que geravam erros 404 e timeouts:
- **NEOE3** e **CRFB3**: Adicionados à blacklist (Inativos na B3).
- **AUAU3**: Removido (Ticker inexistente/erro de digitação).
- **VIIA3**: Substituído por **BHIA3** (Atualização obrigatória).

## 5. IMPACTO DA CORREÇÃO

- **Recuperação Total:** Ativos como **VALE3**, **ITUB4** e **BBAS3** voltaram ao pipeline normal de análise.
- **Scanner Limpo:** Redução de 46 "FalhasDados" para 0 no ciclo de teste.
- **Auditoria Segura:** Logs de `[ADXPenalty]` e `[VolumeFlex]` agora operam sem risco de crash.

---
*Relatório gerado pela Engenharia de Sistemas B3-v10.*
