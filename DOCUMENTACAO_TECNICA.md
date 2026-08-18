# 🔧 Documentação Técnica — B3-v10

> **Arquitetura, Módulos e Pipeline do Sistema**
> Versão: 10.0 | Google Apps Script (V8 Runtime)

---

## 📋 Sumário

1. [Visão Geral da Arquitetura](#-visão-geral-da-arquitetura)
2. [Estrutura de Módulos](#-estrutura-de-módulos)
3. [Pipeline de Dados](#-pipeline-de-dados)
4. [Fluxo de Execução](#-fluxo-de-execução)
5. [Módulos Core (00_*)](#-módulos-core-00_)
6. [Data Service e Fetchers (05_*, 10_*, 11_*)](#-data-service-e-fetchers)
7. [Indicadores Técnicos (12_*, 13_*)](#-indicadores-técnicos)
8. [Agentes de IA (34_*, 35_*, 36_*)](#-agentes-de-ia)
9. [Ranker e Scoring (41_*)](#-ranker-e-scoring)
10. [MacroFetcher (56_*)](#-macrofetcher)
11. [WebApp e Dashboard](#-webapp-e-dashboard)
12. [Cache e Performance](#-cache-e-performance)
13. [Tratamento de Erros](#-tratamento-de-erros)
14. [APIs Externas](#-apis-externas)
15. [Testes e Debug](#-testes-e-debug)

---

## 🏗️ Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Apps Script (V8)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │  Core     │──▶│  DataService │──▶│  Data Fetchers   │    │
│  │ (00_*)    │   │  (05_*)      │   │  (10_*, 11_*)    │    │
│  └────┬─────┘   └──────┬───────┘   └────────┬─────────┘    │
│       │                │                     │              │
│       ▼                ▼                     ▼              │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │  Ranker  │   │  Indicadores │   │  APIs Externas   │    │
│  │ (41_*)   │   │  (12_*,13_*) │   │  BRAPI/AV/Finnhub│    │
│  └────┬─────┘   └──────┬───────┘   └──────────────────┘    │
│       │                │                                     │
│       ▼                ▼                                     │
│  ┌──────────┐   ┌──────────────┐                            │
│  │  AI       │   │  MacroFetcher│                            │
│  │ (34_*)    │   │  (56_*)      │                            │
│  └────┬─────┘   └──────────────┘                            │
│       │                                                      │
│       ▼                                                      │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │  Agentes  │   │  Dashboard   │   │  Google Sheets   │    │
│  │ (35_*,36_*)│   │  (WebApp)    │   │  (Output)        │    │
│  └──────────┘   └──────────────┘   └──────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Princípios Arquiteturais

1. **Modularidade**: Cada módulo é uma IIFE independente com API pública explícita
2. **Pipeline Sequencial**: Dados fluem em uma direção (fetcher → service → ranker → IA → output)
3. **Fallback Progressivo**: Se uma fonte falha, a próxima é tentada automaticamente
4. **Cache Duplo**: Memória local (execução) + CacheService (persistente entre execuções)
5. **Circuit Breaker**: 3 falhas consecutivas ativam fallback direto

---

## 📂 Estrutura de Módulos

### Convenção de Nomenclatura

```
NN_Nome_Do_Modulo.js
││  └──────────┬──────────┘
││             └── Nome descritivo (CamelCase)
│└──────────────── Ordem de carregamento (00-99)
└────────────────── Tipo: Core, Data, AI, etc.
```

### Mapa Completo

```
00_* — CORE (Orquestrador, Config, Logger, Cache, RateLimiter)
├── 00_Core_Orchestrator.js    → Pipeline principal
├── 01_Core_Config.js          → Configurações globais
├── 02_Core_Logger.js          → Sistema de logging
├── 03_Cache_Unified.js        → Cache unificado
├── 04_Core_RateLimiter.js     → Controle de rate limit
└── 00_Utils.js                → Utilitários gerais

05_* — DATA SERVICE (Camada unificada de dados)
└── 05_Data_Service.js         → Orquestrador de dados (v13.0)

10_* — DATA FETCHERS PRINCIPAIS
├── 10_Data_HGBrasilFetcher.js → HG Brasil (fallback sintético)
└── 10_Data_YahooFetcher.js    → Yahoo Finance (DESATIVADO)

11_* — DATA FETCHERS SECUNDÁRIOS
├── 11_Data_AlphaVantageFetcher.js → Alpha Vantage (fallback real)
├── 11_Data_FinnhubFetcher.js      → Finnhub (fallback real, 60 req/min)
└── 11_Data_BCBIpeadataFetcher.js  → BCB/Ipeadata (dados macro oficiais)

12_* — INDICADORES TÉCNICOS
├── 12_Indicators_Volume.js    → OBV, Volume Profile
└── 13_Indicators_RelativeStrength.js → RSI, ADX, Bollinger

20_* — COMPLIANCE E IMPOSTOS
├── 20_Compliance_Unified.js   → Regras de compliance
├── 21_Tax_Calculator.js       → Cálculo de impostos
└── 31_Tax_Validator.js        → Validador fiscal

30_* — PORTFÓLIO E DASHBOARD
├── 30_Portfolio_Unified.js    → Gestão de portfólio
├── 31_Portfolio_Rebalancer.js → Rebalanceamento
└── 14_Dashboard_PainelMercado.js → Painel de mercado

34_* — AI (INTELIGÊNCIA ARTIFICIAL)
├── 34_AI_Service.js           → Serviço unificado de IA
├── 34_AI_Prompts.js           → Templates de prompts
├── 34_AI_Logic.js             → Lógica de decisão
├── 34_DecisionEngine.js       → Motor de decisão
└── 34_NLP_Sentiment_Analyzer.js → Análise de sentimento

35_* — AGENTES
├── 35_Agent_Orchestrator.js   → Orquestrador de agentes
├── 36_Agent_Analyst.js        → Agente analista
├── 37_Agent_RiskManager.js    → Gestor de risco
└── 38_Agent_Memory.js         → Memória de contexto

40_* — RANKER E SCORING
└── 41_Ranker.js               → Score de confluência

50_* — ANÁLISES AVANÇADAS
├── 50_preMarketAnalysis.js    → Análise pré-mercado
├── 53_CandlePatternScanner.js → Scanner de padrões de candle
└── 55_AI_Ensemble.js          → Ensemble de IAs

56_* — MACRO
└── 56_MacroFetcher.js         → Dados macroeconômicos

OUTROS
├── Index.html                 → WebApp do Dashboard
├── WebApp.js                  → Lógica do WebApp
└── appsscript.json            → Configuração GAS
```

---

## 🔄 Pipeline de Dados

### Ordem de Prioridade (DataService.getMarketData)

```
getMarketData(ticker)
  │
  ├── 1. Cache em memória LOCAL_CACHE[ticker]
  │     (retorno instantâneo se já foi buscado na execução)
  │
  ├── 2. Cache persistente CacheService
  │     (TTL: 10 min para histórico)
  │
  ├── 3. BRAPI (fonte principal)
  │     ├── Sucesso → retorna dados, reseta circuit breaker
  │     └── Falha → incrementa circuit breaker
  │
  ├── 4. Alpha Vantage (fallback real #1)
  │     ├── 5 req/min, formato .SA
  │     └── Cache: 5 min cotações, 1h histórico
  │
  ├── 5. Finnhub (fallback real #2)
  │     ├── 60 req/min, formato .SA
  │     └── Cache: 30 min histórico
  │
  └── 6. HG Brasil (fallback sintético)
        └── Candles com variação realista (60 candles)
```

### Circuit Breaker

```javascript
// Configuração
_circuitBreaker = {
  failures: 0,        // Contagem de falhas consecutivas
  threshold: 3,       // Abre após 3 falhas
  isOpen: false,      // Estado do breaker
  lastFailureTime: 0  // Timestamp da última falha
}

// Comportamento
- Sucesso na BRAPI → reset failures = 0
- 3 falhas consecutivas → isOpen = true
- Enquanto aberto → pula BRAPI, vai direto para fallbacks
```

---

## ⚡ Fluxo de Execução

### Pipeline Completo (EXECUTAR_PIPELINE_COMPLETO)

```
INÍCIO
  │
  ├── 1. Inicializar módulos
  │     ├── PivotFibonacci
  │     ├── Score de Confluência
  │     └── Logger
  │
  ├── 2. Buscar Contexto Macro
  │     ├── BCB SGS → Selic (série 432)
  │     ├── BCB SGS → Dólar (série 1)
  │     ├── Calcular regime (DEFENSIVE/NEUTRAL/BULLISH/BEARISH)
  │     └── Calcular fator de ajuste (0.80x - 1.10x)
  │
  ├── 3. Scanner de Ativos (14 tickers em lotes de 5)
  │     ├── Para cada ticker:
  │     │   ├── getMarketData(ticker) → candles OHLCV
  │     │   ├── Calcular indicadores (ADX, RSI, OBV, Bollinger)
  │     │   ├── Calcular score de confluência
  │     │   ├── Calcular Risk/Reward
  │     │   └── Classificar setup
  │     └── Pausa de 1s entre lotes
  │
  ├── 4. Extrair preços atuais (dos dados já obtidos)
  │
  ├── 5. Pré-triagem IA (top 3 ativos por score)
  │
  ├── 6. Análise Multi-IA (Gemini + DeepSeek)
  │     ├── Enviar contexto técnico para cada IA
  │     ├── Coletar scores normalizados
  │     ├── Calcular ensemble ponderado
  │     └── Aplicar Sentinela (veto BEARISH)
  │
  ├── 7. Gravar resultados no Google Sheets
  │
  ├── 8. Atualizar Dashboard
  │
  └── 9. Consolidar oportunidades
```

### Timeline Esperada

```
 0s ─ Início
10s ─ Contexto Macro obtido (cache)
30s ─ Lote 1 processado (5 tickers)
60s ─ Lote 2 processado (5 tickers)
90s ─ Lote 3 processado (4 tickers)
95s ─ Pré-triagem IA
100s ─ Análise IA completa
110s ─ Sheets + Dashboard atualizados
120s ─ ✅ FIM (margem de 240s para segurança)
```

---

## 🧩 Módulos Core (00_*)

### 00_Core_Orchestrator.js

**Função**: Orquestrador principal do pipeline modular.

```javascript
// Principais funções públicas
EXECUTAR_PIPELINE_COMPLETO()  // Pipeline completo (scan + IA + sheets)
EXECUTAR_SCANNER()            // Apenas scan técnico
EXECUTAR_IA()                 // Apenas análise IA
EXECUTAR_ATUALIZAR_DASHBOARD() // Apenas dashboard

// Constantes de performance
TEMPO_LIMITE_MS = 300000      // 5 min (margem para 360s do GAS)
PAUSE_BETWEEN_BATCHES_MS = 1000 // 1s entre lotes
BATCH_SIZE = 5                // Tickers por lote
```

### 01_Core_Config.js

**Função**: Configurações centralizadas do sistema.

```javascript
// Exemplo de configurações
CONFIG.getSecret('BRAPI_TOKEN')  // Obtém chave de API
CONFIG.get('BATCH_SIZE')         // Obtém configuração
```

### 02_Core_Logger.js

**Função**: Sistema de logging estruturado.

```javascript
// Níveis de log
console.log('ℹ️ Informação')    // Info
console.warn('⚠️ Aviso')        // Warning
console.error('❌ Erro')        // Error

// Formato padronizado
[Modulo] Mensagem descritiva
```

### 03_Cache_Unified.js

**Função**: Cache unificado com fallback.

```javascript
// Estratégia de cache
1. Cache em memória (LOCAL_CACHE) — duração da execução
2. CacheService.getScriptCache() — entre execuções (TTL configurável)
3. Fallback para objeto vazio se CacheService indisponível
```

### 04_Core_RateLimiter.js

**Função**: Controle de taxa de requisições.

```javascript
// Buckets configurados
RateLimiter.execute('BRAPI', callback)        // 1 req/segundo
RateLimiter.execute('ALPHA_VANTAGE', callback) // 5 req/minuto
RateLimiter.execute('FINNHUB', callback)       // 60 req/minuto
```

---

## 📡 Data Service e Fetchers

### 05_Data_Service.js (v13.0)

**Função**: Camada unificada que orquestra todos os fetchers.

```javascript
// API Pública
DataService.getMarketData(ticker, interval, range)
  → { candles, price, ticker, source }

DataService.getMarketContext()
  → { ibov, dolar, regime, timestamp }

DataService.getPrecosAtuaisEmLote(tickersArray)
  → { TICKER: { price, change, volume }, ... }

DataService.getPrecoAtual(ticker)
  → { price, timestamp, source, ticker }
```

### 26_Data_BrapiFetcher.js

**Função**: Fonte principal de dados (brapi.dev).

```javascript
// Configuração
CHUNK_SIZE = 1           // Plano gratuito: 1 ativo/requisição
CACHE_TTL = 1800         // 30 min de cache
MAX_RETRIES = 3          // Máximo de tentativas
RETRY_DELAY_MS = 500     // Delay inicial entre retries

// Retry com backoff exponencial
Tentativa 1: 500ms
Tentativa 2: 1000ms
Tentativa 3: 2000ms

// Tratamento de erros HTTP
502/504 → Retry com backoff
429     → Retry com backoff (rate limit)
Outros  → Retorna null (ativa fallback)
```

### 11_Data_AlphaVantageFetcher.js

**Função**: Fallback de histórico real (alphavantage.co).

```javascript
// Configuração
API Key: 14NGYBGQYKZOACCO
Rate Limit: 5 req/min (free tier)
Formato B3: ticker.SA (ex: PETR4.SA)
Cache: 5 min cotações, 1h histórico

// Funções
getHistory(ticker, interval, outputsize)
getQuote(ticker)
getQuoteBatch(tickers)
```

### 11_Data_FinnhubFetcher.js

**Função**: Fallback de histórico real (finnhub.io).

```javascript
// Configuração
API Key: d4pmhf1r01qjpnb09b4gd4pmhf1r01qjpnb09b50
Rate Limit: 60 req/min (free tier)
Formato B3: ticker.SA (ex: PETR4.SA)
Cache: 30 min histórico, 5 min cotações

// Funções
getHistory(ticker, resolution, count)
getQuote(ticker)
getQuoteBatch(tickers)
```

### 11_Data_BCBIpeadataFetcher.js

**Função**: Dados macroeconômicos oficiais do BCB.

```javascript
// Séries BCB SGS
432 → Selic Over (anualizada %)
433 → Selic Over (diária %)
1   → Câmbio USD (compra)
243 → IPCA (índice)

// Funções
getSelic()           → { valor, data, fonte }
getDolar()           → { valor, data, fonte }
getIPCA()            → { ultimo, acumulado12m, data }
getMacroContext()    → { selic, dolar, ipca, regime, summary }
```

### 10_Data_HGBrasilFetcher.js

**Função**: Fallback final com candles sintéticos.

```javascript
// Geração de candles sintéticos
- 60 candles com variação realista
- Variação diária: ±0.5% a ±3.0%
- Preço base: obtido de fonte anterior ou fallback
- Volume: aleatório entre 100k e 5M
```

---

## 📊 Indicadores Técnicos

### 12_Indicators_Volume.js

**Função**: Indicadores baseados em volume.

```javascript
// OBV (On-Balance Volume)
OBV = OBV_anterior + (volume_se * sinal)
  sinal = +1 se close > close_anterior
  sinal = -1 se close < close_anterior
  sinal = 0  se close = close_anterior

// Interpretação
OBV subindo + preço subindo = tendência confirmada (BULLISH)
OBV subindo + preço caindo = divergência (acumulação)
OBV caindo + preço subindo = divergência (distribuição)
```

### 13_Indicators_RelativeStrength.js

**Função**: RSI, ADX, Bollinger Bands.

```javascript
// RSI (Relative Strength Index)
RSI = 100 - (100 / (1 + RS))
  RS = Média ganhos / Média perdas (14 períodos)
  > 70 = sobrecomprado
  < 30 = sobrevendido

// ADX (Average Directional Index)
ADX = Média(100 * |DI+ - DI-| / (DI+ + DI-))
  > 25 = tendência forte
  < 20 = mercado lateral
  DI+ > DI- = tendência de alta
  DI- > DI+ = tendência de baixa

// Bollinger Bands
Banda Superior = EMA20 + 2 * desvio_padrão
Banda Inferior = EMA20 - 2 * desvio_padrão
  Estreitamento = baixa volatilidade (possível explosão)
  Alargamento = alta volatilidade
```

---

## 🤖 Agentes de IA

### 34_AI_Service.js

**Função**: Serviço unificado para chamadas de API de IA.

```javascript
// IAs suportadas
GEMINI:   AIzaSyBwnS1o1hXxqYqQ5tYqQ5tYqQ5tYqQ5tYqQ5
DEEPSEEK: sk-b3-v10-deepseek-fallback-key

// Funções
fetchAll(prompt)       → { gemini, deepseek }
fetchGemini(prompt)    → score normalizado (0-100)
fetchDeepSeek(prompt)  → score normalizado (0-100)
```

### 34_DecisionEngine.js

**Função**: Motor de decisão que combina scores das IAs.

```javascript
// Ensemble ponderado
Pesos padrão:
  Gemini:   48%
  DeepSeek: 18%
  Técnico:  33%

Score Final = Gemini * 0.48 + DeepSeek * 0.18 + Técnico * 0.33
```

### 35_Agent_Orchestrator.js

**Função**: Orquestrador dos agentes de IA.

```javascript
// Fluxo
1. Recebe lista de candidatos do scanner
2. Pré-triagem: seleciona top 3 por score
3. Para cada candidato:
   a. Agent Memory → recupera contexto histórico
   b. Agent Analyst → envia para análise IA
   c. AI Ensemble → calcula score combinado
   d. Sentinela → aplica veto se BEARISH
4. Retorna lista final de oportunidades
```

### 36_Agent_Analyst.js

**Função**: Agente que prepara o contexto para análise IA.

```javascript
// Contexto enviado para IA
{
  ticker: "PETR4",
  price: 38.50,
  adx: 38.93,
  rsi: 48.79,
  obv: "Acumulação (BULLISH)",
  bb_position: "Meio das Bandas",
  ema9: 37.80,
  ema21: 37.20,
  ema50: 36.50,
  volume_trend: "Crescente",
  regime: "DEFENSIVE",
  adjustment: 0.95
}
```

### 38_Agent_Memory.js

**Função**: Memória de contexto para análises recorrentes.

```javascript
// Cache de contexto por ticker
- Último score
- Último setup
- Histórico de decisões
- Sentimento recorrente
```

---

## 🎯 Ranker e Scoring

### 41_Ranker.js

**Função**: Cálculo do score de confluência (0-100).

```javascript
// Componentes do Score
1. ADX (força da tendência):          até 25 pts
2. RSI (momento):                     até 20 pts
3. OBV (fluxo de volume):             até 20 pts
4. Bollinger (volatilidade):          até 15 pts
5. Médias Móveis (alinhamento):       até 10 pts
6. Volume (confirmacao):              até 10 pts
                                    ─────────
                              Total: 100 pts

// Classificação
≥ 70 → OPORTUNIDADE (setup válido)
50-69 → RADAR (aguardar melhora)
30-49 → AGUARDAR (score baixo)
0-29 → DESCARTAR (descartar)

// Risk/Reward
RR = (Alvo - Entrada) / (Entrada - Stop)
≥ 2.0 → Excelente
1.5-2.0 → Bom
< 1.5 → Ruim (risco alto)
```

---

## 📈 MacroFetcher

### 56_MacroFetcher.js

**Função**: Contexto macroeconômico via BCB.

```javascript
// Fontes de dados
BCB SGS (api.bcb.gov.br):
  Série 432 → Selic Over anualizada
  Série 1   → Câmbio USD compra

// Cache
- Memória local: duração da execução
- CacheService: 5 min (TTL)
- Chave: "MACRO_CONTEXT_V10"

// Determinação de Regime
Selic > 14% + EWZ < -2% → BEARISH (ajuste 0.80x)
Selic > 12%              → DEFENSIVE (ajuste 0.95x)
Selic < 11.5% + EWZ > 3% → BULLISH (ajuste 1.10x)
Padrão                    → NEUTRAL (ajuste 1.00x)
```

---

## 🖥️ WebApp e Dashboard

### Index.html

**Função**: Interface web do dashboard interativo.

```html
// Seções do Dashboard
1. Painel de Mercado (IBOV, Dólar, Regime)
2. Oportunidades (ativos aprovados)
3. Radar (ativos em observação)
4. Portfólio (posições abertas)
5. Alertas (notificações)
6. Análise Técnica (gráficos)
```

### WebApp.js

**Função**: Lógica do WebApp (frontend).

```javascript
// Funções principais
carregarDashboard()      // Carrega dados do backend
renderizarGraficos()     // Renderiza gráficos
atualizarTabelas()       // Atualiza tabelas
filtrarPorScore(min)     // Filtra por score mínimo
exportarCSV()            // Exporta dados para CSV
```

---

## ⚡ Cache e Performance

### Estratégia de Cache

| Dado | Cache | TTL | Chave |
|------|-------|-----|-------|
| Histórico BRAPI | CacheService | 30 min | `DS_{ticker}_1d_6mo` |
| Histórico Alpha Vantage | CacheService | 1h | `av_history_{ticker}` |
| Histórico Finnhub | CacheService | 30 min | `finnhub_{url}` |
| Cotações Finnhub | CacheService | 5 min | `finnhub_{url}` |
| Contexto Macro | CacheService | 5 min | `MACRO_CONTEXT_V10` |
| Dados BCB | CacheService | 1h | `bcb_serie_{serie}_{n}` |
| Memória local | LOCAL_CACHE | Execução | `DS_{ticker}_{interval}_{range}` |

### Limites de Performance

| Recurso | Limite | Estratégia |
|---------|--------|------------|
| GAS Execution | 360s | Timeout interno: 300s |
| BRAPI free | 1 ativo/req | CHUNK_SIZE = 1 |
| Alpha Vantage | 5 req/min | RateLimiter bucket |
| Finnhub | 60 req/min | RateLimiter bucket |
| Pausa entre lotes | 1s | Utilities.sleep(1000) |
| Retry máx | 3 tentativas | Backoff exponencial |

---

## 🐛 Tratamento de Erros

### Hierarquia de Fallbacks

```
BRAPI HTTP 502/504
  → Retry (3x com backoff)
  → Alpha Vantage
  → Finnhub
  → HG Brasil (sintético)
  → null (pula ticker)

BRAPI HTTP 429 (rate limit)
  → Retry (3x com backoff)
  → Alpha Vantage
  → Finnhub
  → HG Brasil (sintético)

Circuit Breaker (3 falhas BRAPI)
  → Pula BRAPI diretamente
  → Alpha Vantage → Finnhub → HG Brasil
```

### Logging de Erros

```javascript
// Formato padronizado
console.error(`❌ [Modulo] Erro crítico: ${mensagem}`)
console.warn(`⚠️ [Modulo] Aviso: ${mensagem}`)
console.log(`✅ [Modulo] Sucesso: ${mensagem}`)
console.log(`📡 [Modulo] Info: ${mensagem}`)
```

---

## 🌐 APIs Externas

### BRAPI (brapi.dev)

```
Base URL: https://brapi.dev/api
Token: peU5QfK5j7gVMiXBJP1XjJ
Plano: Gratuito (1 ativo/requisição)
Rate Limit: ~30 req/min

Endpoints:
  GET /quote/{ticker}          → Cotação atual
  GET /quote/{ticker}?range=6mo → Histórico
```

### Alpha Vantage (alphavantage.co)

```
Base URL: https://www.alphavantage.co/query
Token: 14NGYBGQYKZOACCO
Plano: Gratuito (5 req/min)
Formato B3: ticker.SA

Endpoints:
  function=TIME_SERIES_DAILY&symbol=PETR4.SA
  function=GLOBAL_QUOTE&symbol=PETR4.SA
```

### Finnhub (finnhub.io)

```
Base URL: https://finnhub.io/api/v1
Token: d4pmhf1r01qjpnb09b4gd4pmhf1r01qjpnb09b50
Plano: Gratuito (60 req/min)
Formato B3: ticker.SA

Endpoints:
  /stock/candle?symbol=PETR4.SA&resolution=D
  /quote?symbol=PETR4.SA
```

### BCB SGS (Banco Central)

```
Base URL: https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados
Autenticação: Pública (sem chave)
Formato: JSON

Séries:
  432 → Selic Over anualizada
  433 → Selic Over diária
  1   → Câmbio USD compra
  243 → IPCA
```

---

## 🧪 Testes e Debug

### Funções de Teste

```javascript
// Teste do DataService
VERIFICAR_M1_FALLBACK()
  → Verifica se DataService está operacional
  → Testa getMarketData com PETR4
  → Exibe resultados no console e UI

// Teste do MacroFetcher
TESTAR_MACRO()
  → Busca contexto macro atual
  → Exibe Selic, Dólar, Regime, Ajuste

// Teste da BRAPI
TESTAR_BRAPI()
  → Testa conexão com brapi.dev
  → Exibe cotação PETR4

// Teste de preço ao vivo
TESTAR_PRECO_AO_VIVO()
  → Testa getPrecoAtual com PETR4
  → Exibe preço e fonte
```

### Debug no Apps Script

1. **Logs**: Menu **Execuções** → selecionar execução
2. **Debug**: Botão **Debug** ao lado de **Executar**
3. **Pontos de interrupção**: Clique no número da linha
4. **Variáveis**: Passe o mouse sobre variáveis durante debug

### Verificação Rápida

```javascript
// Verificar se módulo carregou
typeof DataService !== 'undefined'
typeof BrapiFetcher !== 'undefined'
typeof MacroFetcher !== 'undefined'

// Verificar versão do DataService
// v13.0 = BRAPI + Alpha Vantage + Finnhub + HG + BCB
```

---

## 📦 Dependências entre Módulos

```
00_Core_Orchestrator.js
  ├── 05_Data_Service.js
  │   ├── 26_Data_BrapiFetcher.js
  │   ├── 11_Data_AlphaVantageFetcher.js
  │   ├── 11_Data_FinnhubFetcher.js
  │   ├── 10_Data_HGBrasilFetcher.js
  │   └── 10_Data_YahooFetcher.js (desativado)
  │
  ├── 56_MacroFetcher.js
  │   └── 11_Data_BCBIpeadataFetcher.js
  │
  ├── 41_Ranker.js
  │   ├── 12_Indicators_Volume.js
  │   └── 13_Indicators_RelativeStrength.js
  │
  ├── 34_AI_Service.js
  │   ├── 34_AI_Prompts.js
  │   └── 34_AI_Logic.js
  │
  ├── 35_Agent_Orchestrator.js
  │   ├── 36_Agent_Analyst.js
  │   ├── 37_Agent_RiskManager.js
  │   └── 38_Agent_Memory.js
  │
  └── 08_Output_Unified.js
      └── Google Sheets API
```

---

> 📅 **Última atualização**: Julho/2026
> ⚡ **Runtime**: Google Apps Script V8
> 🧠 **IAs**: Gemini + DeepSeek
> 📊 **APIs**: BRAPI, Alpha Vantage, Finnhub, BCB SGS
