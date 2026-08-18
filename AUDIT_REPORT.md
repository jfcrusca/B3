# 🔍 AUDIT_REPORT — Auditoria Completa do Projeto B3-v10

**Data da auditoria:** 08/08/2026
**Escopo:** 70+ arquivos JavaScript (Google Apps Script)
**Objetivo:** Identificar funções duplicadas, código morto, módulos órfãos, dependências circulares, funções grandes, violações SOLID e acoplamento global excessivo.

---

## 📊 Resumo Executivo

| Severidade | Quantidade |
|------------|-----------|
| 🔴 CRÍTICO | 4 |
| 🟠 ALTO | 14 |
| 🟡 MÉDIO | 12 |
| 🔵 BAIXO | 4 |
| **TOTAL** | **34** |

### Principais Riscos Identificados

1. **Colisão de global AIEnsemble** (08 vs 55) — sobrescreve funções e causa erros de runtime.
2. **Acoplamento em estrela** — CONFIG referenciado por 34 arquivos.
3. **8 dependências circulares** entre módulos.
4. **12+ módulos órfãos** nunca utilizados.
5. **Referências penduradas** a módulos inexistentes (AIApiUtils, AgenticRanker, TechnicalIndicators, etc.).

---

## 1. Funções Duplicadas

### 🔴 CRÍTICO

#### 1.1 AIEnsemble — colisão de objeto global
- **Arquivos:** 08_AI_Ensemble.js (L10) e 55_AI_Ensemble.js (L21)
- **Descrição:** Ambos declaram var AIEnsemble = (function(){...})(). No GAS, os arquivos são concatenados e carregados em ordem alfabética. Como 08_ < 55_, o módulo 55 sobrescreve o 08.
- **Impacto:** As exportações exclusivas do 08 são perdidas:
  - getEnhancedScore — chamado em VerificarFunciona.js:132 e 00_Debug_Ensemble_Tests.js:130 → undefined → erro de runtime
  - DEBUG_AI_FAILURE — chamado em 00_Debug_Ensemble_Tests.js:23 → undefined
  - TESTAR_ENSEMBLE — chamado em 00_Debug_Ensemble_Tests.js:41 → undefined
- **Recomendação:** Unificar em um único módulo ou renomear um deles.

### 🟠 ALTO

#### 1.2 getMarketContext — TRIPLICADA
- **Arquivo:** 05_Data_Service.js (L321, L367, L374)
- **Descrição:** A função é declarada 3 vezes dentro da IIFE DataService. A 1ª (L321) contém código copiado de getMarketData (referencia ticker, cacheService, cacheKey inexistentes no escopo) e termina sem return. A 2ª (L367) só tem var regime = NEUTRAL. Apenas a 3ª (L374) é a implementação real.
- **Impacto:** As duas primeiras são código morto (a última declaração vence em JS). Confusão e risco de manutenção.

#### 1.3 getSelic / getDolar / getMacroContext — duplicadas
- **Arquivos:** 56_MacroFetcher.js (L56, L62, L110) e 11_Data_BCBIpeadataFetcher.js (L74, L105, L140)
- **Descrição:** Ambas buscam dados macro do BCB (Selic, Dólar, contexto macro) com implementações paralelas.
- **Impacto:** Duplicação de lógica de negócio e risco de divergência de dados.

### 🟡 MÉDIO

#### 1.4 _fetchWithRetry — duplicada em 3 fetchers
- **Arquivos:** 10_Data_YahooFetcher.js, 11_Data_AlphaVantageFetcher.js, 11_Data_FinnhubFetcher.js
- **Descrição:** Mesma lógica de retry com backoff exponencial implementada 3x.

#### 1.5 _getApiKey — duplicada em 3 fetchers
- **Arquivos:** 10_Data_HGBrasilFetcher.js, 11_Data_AlphaVantageFetcher.js, 11_Data_FinnhubFetcher.js

#### 1.6 getHistory / getQuote / getQuoteBatch — repetidas
- **Arquivos:** 10_Data_YahooFetcher.js, 10_Data_HGBrasilFetcher.js, 11_Data_AlphaVantageFetcher.js, 11_Data_FinnhubFetcher.js, 11_Data_RapidAPIYahooFetcher.js, 26_Data_BrapiFetcher.js
- **Descrição:** Interface comum de fetch repetida em todos os fetchers, sem abstração compartilhada.

#### 1.7 diagnosticoCompleto vs Tools.runDiagnostics
- **Arquivo:** 00_Tools.js — diagnosticoCompleto() (L109, global) e Tools.runDiagnostics() (L22)
- **Descrição:** Duas implementações redundantes de diagnóstico completo do sistema.

---

## 2. Código Morto

### 🟠 ALTO

#### 2.1 getMarketContext L321-346 e L367-369
- **Arquivo:** 05_Data_Service.js
- **Descrição:** As duas primeiras declarações de getMarketContext são sobrescritas pela terceira e nunca executam.

#### 2.2 Bloco intraday comentado
- **Arquivo:** 00_Pipeline_Adapter.js (L49-58)
- **Descrição:** Todo o bloco de busca de dados intradiários (H1) está comentado/desativado, mas o código de estrutura permanece.

### 🟡 MÉDIO

#### 2.3 Variável i indefinida
- **Arquivo:** 33_Data_SheetManager.js (L30)
- **Descrição:** if (i === 0) usa i que não está definido no escopo do map (deveria ser o índice). Bug latente que nunca dispara o log de debug.

#### 2.4 diagnosticoCompleto referencia módulos inexistentes
- **Arquivo:** 00_Tools.js (L195)
- **Descrição:** Verifica TechnicalIndicators, TechnicalStrategy, EntryGenerator, AIApiUtils — todos não definidos no projeto. Sempre reportará FALTANDO.

#### 2.5 analyzeWithEnsemble exportado mas nunca chamado
- **Arquivo:** 08_AI_Ensemble.js (L850)
- **Descrição:** Exportado na API pública mas sem consumidores externos.

---

## 3. Módulos Nunca Utilizados (Órfãos)

### 🟠 ALTO

| Módulo | Arquivo | Referenciado por |
|--------|---------|------------------|
| MenuTriade | 00_Menu_Manager.js | 0 arquivos |
| PipelineAdapter | 00_Pipeline_Adapter.js | 0 arquivos |
| ValuationEngine | 25_Fundamentalist_Engine.js | 0 arquivos |
| PortfolioRebalancer | 31_Portfolio_Rebalancer.js | 0 arquivos |
| PerformanceManager | 52_Performance_Manager.js | 0 arquivos |
| preMarketAnalysis | 50_preMarketAnalysis.js | 0 arquivos |
| CandlePatternScanner | 53_CandlePatternScanner.js | 0 arquivos |
| DashboardAnual | 54_Dashboard_Anual.js | 0 arquivos |
| DebugSystem | 46_Debug_System.js | 0 arquivos |
| HealthCheck | 48_Health_Check.js | 0 arquivos |
| HistoricalContext | 42_HistoricalContext.js | 0 arquivos |
| AIMonitor | 58_AI_Monitor.js | 0 arquivos |
| CopilotWebhook | 57_Copilot_Webhook.js | 1 (58, que é órfão) |

**Observação:** ValuationEngine (25) chama fetchFundamentalData() que não está definido em nenhum arquivo — referência pendurada que quebraria se o módulo fosse ativado.

---

## 4. Dependências Circulares

### 🟠 ALTO — Ciclos de dependência mútua (A ↔ B)

| Ciclo | Arquivos |
|-------|----------|
| 1 | 00_Core_Orchestrator.js ↔ 00_SheetWriter.js |
| 2 | 01_Core_Config.js ↔ 03_Cache_Unified.js |
| 3 | 01_Core_Config.js ↔ 24_Secrets_Manager.js |
| 4 | 01_Core_Config.js ↔ 34_DecisionEngine.js |
| 5 | 05_Data_Service.js ↔ 11_Data_RapidAPIYahooFetcher.js |
| 6 | 08_AI_Ensemble.js ↔ 56_MacroFetcher.js |
| 7 | 11_Data_BCBIpeadataFetcher.js ↔ 56_MacroFetcher.js |
| 8 | 34_DecisionEngine.js ↔ 55_AI_Ensemble.js |

**Observação:** O ciclo 1 (Orchestrator ↔ SheetWriter) é parcial — o SheetWriter só menciona CoreRegistry em comentário (L10), mas o acoplamento via registro/recuperação no CoreRegistry cria dependência implícita.

---

## 5. Funções Maiores que 150 Linhas

### 🟠 ALTO

| # | Função | Arquivo | Linha início | Est. linhas |
|---|--------|---------|--------------|-------------|
| 1 | analisar | 08_AI_Ensemble.js | 163 | ~272 |
| 2 | _calcularScoreSistêmico | 22_Core_Analyzers.js | 367 | ~206 |
| 3 | evaluate | 34_DecisionEngine.js | 112 | ~189 |
| 4 | STRATEGY_EVALUATE_CORE | 22_Core_Analyzers.js | 25 | ~180 |
| 5 | getMarketData | 05_Data_Service.js | 153 | ~164 |
| 6 | _lerEAgregar | 21_Tax_Calculator.js | 48 | ~157 |
| 7 | analisar | 55_AI_Ensemble.js | 392 | ~147 |
| 8 | getEnhancedScoresBatch | 55_AI_Ensemble.js | 213 | ~145 |

**Próximas do limite (140-150):**
- PROCESSAR_CARTEIRA_FINAL — 41_Ranker.js, L9 (~139)

---

## 6. Violações SOLID

### 🔴 CRÍTICO

#### 6.1 S — Single Responsibility (funções que fazem muitas coisas)
- **STRATEGY_EVALUATE_CORE** (22_Core_Analyzers.js, L25): normaliza entrada (4 formatos), valida candles, calcula indicadores, analisa padrões, estrutura, risco e score — ~10 responsabilidades.
- **getMarketData** (05_Data_Service.js, L153): gerencia cache, circuit breaker, 5 fallbacks de API, timeout e normalização — tudo em uma função.
- **analisar** (08_AI_Ensemble.js, L163): monta prompts, chama 2 IAs, calcula pesos dinâmicos, dimensiona lote e consolida resultado.

### 🟠 ALTO

#### 6.2 D — Dependency Inversion (dependências concretas)
- O projeto usa objetos globais singleton (var X = (function(){...})()) em vez de injeção de dependência. Qualquer módulo referencia qualquer global diretamente, criando acoplamento rígido e impossibilitando testes isolados.

#### 6.3 O — Open/Closed (extensão vs modificação)
- Os fallbacks encadeados em getMarketData exigem modificação da função para adicionar um novo provedor de dados, em vez de extensão via estratégia.

### 🟡 MÉDIO

#### 6.4 I — Interface Segregation
- AIEnsemble expõe interfaces sobrepostas (getEnhancedScore, getEnhancedScoresBatch, analisar, analyzeWithEnsemble) com responsabilidades misturadas entre os módulos 08 e 55.

#### 6.5 L — Liskov (substituição)
- A colisão AIEnsemble (08 vs 55) viola o princípio de substituição: o módulo 55 substitui o 08 mas não oferece todas as funções que o 08 oferecia, quebrando consumidores.

---

## 7. Objetos Globais Excessivamente Acoplados

### 🔴 CRÍTICO

#### 7.1 Acoplamento em estrela
| Global | Arquivos que referenciam |
|--------|--------------------------|
| CONFIG | **34 arquivos** |
| Cache | 14 arquivos |
| DataService | 12 arquivos |
| MacroFetcher | 8 arquivos |
| AIEnsemble | 6 arquivos |
| Secrets | 6 arquivos |

**Impacto:** Qualquer mudança na interface desses globals quebra dezenas de módulos. Alto risco de regressão.

### 🟠 ALTO

#### 7.2 Patch da API nativa Logger
- **Arquivo:** 00_Logger_Compat.js
- **Descrição:** Adiciona Logger.warn, Logger.info, Logger.error à API nativa do Google Apps Script. Modifica comportamento global de forma não declarada.

#### 7.3 Referências penduradas (globals inexistentes)
| Global | Usado em | Status |
|--------|----------|--------|
| AIApiUtils | 00_Tools.js, 28_ativarEnforcement.js | **Não definido** |
| DashboardUI.updateMarketOverview | 00_Tools.js (L70) | **Não existe** no DashboardUI |
| AgenticRanker | 00_Utils.js | **Não definido** |
| TechnicalIndicators | 00_Tools.js, 13_Indicators_RelativeStrength.js | **Não definido** |
| TechnicalStrategy | 00_Tools.js | **Não definido** |
| EntryGenerator | 00_Pipeline_Adapter.js, 00_Tools.js | **Não definido** |

**Impacto:** Chamadas a esses globals causarão ReferenceError em runtime.

---

## 8. Recomendações Priorizadas

### 🔴 Urgente (corrigir primeiro)
1. **Unificar AIEnsemble** (08 e 55) em um único módulo para eliminar a colisão e restaurar getEnhancedScore, DEBUG_AI_FAILURE, TESTAR_ENSEMBLE.
2. **Remover as 2 declarações mortas de getMarketContext** em 05_Data_Service.js.
3. **Corrigir referências penduradas** (AIApiUtils, AgenticRanker, TechnicalIndicators, TechnicalStrategy, EntryGenerator, DashboardUI.updateMarketOverview).
4. **Reduzir acoplamento de CONFIG** — considerar injeção de dependência ou acesso via serviço.

### 🟠 Alta prioridade
5. **Eliminar módulos órfãos** ou integrá-los ao pipeline (12+ módulos).
6. **Quebrar as 8 dependências circulares** — extrair dependências comuns para módulos de nível inferior.
7. **Refatorar funções > 150 linhas** em funções menores com responsabilidade única.

### 🟡 Média prioridade
8. **Extrair lógica comum dos fetchers** (_fetchWithRetry, _getApiKey, normalização) para um módulo compartilhado.
9. **Unificar getSelic/getDolar/getMacroContext** entre 56_MacroFetcher e 11_Data_BCBIpeadataFetcher.
10. **Remover diagnosticoCompleto** duplicado em 00_Tools.js.

### 🔵 Baixa prioridade
11. **Corrigir bug da variável i** em 33_Data_SheetManager.js.
12. **Documentar o patch do Logger** nativo ou substituí-lo por chamadas explícitas a LogService.

---

*Relatório gerado automaticamente. Nenhum código foi alterado nesta auditoria.*
