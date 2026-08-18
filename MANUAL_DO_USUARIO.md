# 📘 Manual do Usuário — B3-v10

> **Sistema de Análise Inteligente para Mercado de Ações Brasileiro (B3)**
> Versão: 10.0 | Google Apps Script + WebApp

---

## 📋 Sumário

1. [O que é o B3-v10?](#-o-que-é-o-b3-v10)
2. [Primeiros Passos](#-primeiros-passos)
3. [Dashboard WebApp](#-dashboard-webapp)
4. [Funcionalidades Principais](#-funcionalidades-principais)
5. [Interpretando os Resultados](#-interpretando-os-resultados)
6. [Manutenção e Agenda](#-manutenção-e-agenda)
7. [Solução de Problemas](#-solução-de-problemas)
8. [Glossário](#-glossário)

---

## 🎯 O que é o B3-v10?

O **B3-v10** é um sistema automatizado de análise de ações brasileiras que:

- 📊 **Escaneia** 14+ ativos da B3 diariamente
- 🧠 **Analisa** com Inteligência Artificial (Gemini + DeepSeek)
- 🚦 **Classifica** setups com score de confluência (0-100)
- 📉 **Calcula** indicadores técnicos (ADX, RSI, OBV, Bollinger)
- 💰 **Sugere** operações com Risk/Reward calculado
- 📈 **Gera** dashboard interativo no Google Sheets

### Para quem é?
- **Investidores individuais** que querem análise técnica automatizada
- **Traders** que buscam setups com boa relação risco/retorno
- **Analistas** que precisam de screening rápido do mercado

---

## 🚀 Primeiros Passos

### 1. Instalação no Google Sheets

1. Abra o [Google Apps Script](https://script.google.com/)
2. Crie um novo projeto
3. Copie todos os arquivos `.js` para o projeto
4. Configure o arquivo `appsscript.json`:

```json
{
  "timeZone": "America/Sao_Paulo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

### 2. Execução Inicial

1. No menu do Apps Script, selecione `00_Core_Orchestrator` → `EXECUTAR_PIPELINE_COMPLETO`
2. Autorize as permissões necessárias (leitura/escrita na planilha, URLs externas)
3. Acompanhe a execução pelo menu **Execuções** (ícone de relógio)

### 3. Agendamento Automático

Para executar automaticamente em dias úteis:

1. No Apps Script, clique em **Gatilhos** (⏰)
2. Adicione um novo gatilho:
   - **Função**: `EXECUTAR_PIPELINE_COMPLETO`
   - **Fonte do evento**: Baseado no tempo
   - **Tipo**: Disparador por dia
   - **Horário**: 10:00 às 11:00 (antes da abertura dos EUA)

---

## 🖥️ Dashboard WebApp

### Acessando o Dashboard

O sistema gera um dashboard interativo acessível via:

1. **Google Sheets**: Aba "Dashboard" na planilha vinculada
2. **WebApp**: URL pública gerada pelo Apps Script (menu **Implantar** → **Nova implantação**)

### Seções do Dashboard

| Seção | Descrição |
|-------|-----------|
| 📊 **Painel de Mercado** | IBOV, Dólar, Regime Macroeconômico |
| 🎯 **Oportunidades** | Ativos aprovados com score > 70 |
| 🔭 **Radar** | Ativos em observação (score 50-70) |
| 📋 **Portfólio** | Posições abertas e performance |
| ⚠️ **Alertas** | Riscos e notificações importantes |
| 📈 **Análise Técnica** | Gráficos com indicadores |

---

## ⚙️ Funcionalidades Principais

### 🔍 Scanner de Ativos

O scanner processa 14 tickers pré-definidos em lotes de 5:

```
📦 Lote 1: VALE3, PETR4, ITUB4, BBAS3, WEGE3
📦 Lote 2: GGBR4, JBSS3, RAIL3, PRIO3, RENT3
📦 Lote 3: HYPE3, SBSP3, CPLE3, ABEV3
```

Para cada ativo, calcula:
- **Score de Confluência** (0-100) — baseado em múltiplos indicadores
- **Risk/Reward** — relação entre stop loss e alvo
- **Setup** — classificação da oportunidade
- **ADX** — força da tendência
- **RSI** — momento do ativo
- **OBV** — fluxo de volume

### 🧠 Análise por IA

Após o scan técnico, a IA (Gemini + DeepSeek) analisa os melhores candidatos:

1. **Pré-triagem**: Seleciona até 3 ativos com melhor score
2. **Análise profunda**: Envia contexto técnico para as IAs
3. **Ensemble**: Combina scores das IAs com pesos configuráveis
4. **Sentinela**: Aplica filtro de sentimento (BEARISH/BULLISH)
5. **Resultado**: Lista final de oportunidades aprovadas

### 📊 Indicadores Técnicos

| Indicador | Função | Interpretação |
|-----------|--------|---------------|
| **ADX** | Força da tendência | >25 = tendência forte, <20 = lateral |
| **RSI** | Momento | >70 = sobrecomprado, <30 = sobrevendido |
| **OBV** | Fluxo de volume | Subindo = acumulação, caindo = distribuição |
| **Bollinger** | Volatilidade | Estreitando = baixa, alargando = alta |
| **Médias Móveis** | Suporte/resistência dinâmico | EMA9, EMA21, EMA50 |

### 🏛️ Contexto Macroeconômico

O sistema busca automaticamente dados oficiais do **Banco Central**:

- **Selic** (série BCB 432) — taxa básica de juros
- **Dólar** (série BCB 1) — cotação de compra
- **IPCA** (série BCB 243) — inflação oficial

Com base nesses dados, define o **regime de mercado**:

| Regime | Condição | Ajuste |
|--------|----------|--------|
| 🟢 **BULLISH** | Selic < 11.5% | 1.10x |
| 🟡 **NEUTRAL** | Selic 11.5-12% | 1.00x |
| 🟠 **DEFENSIVE** | Selic > 12% | 0.95x |
| 🔴 **BEARISH** | Selic > 14% + EWZ < -2% | 0.80x |

---

## 📖 Interpretando os Resultados

### Scores e Setups

| Score | Classificação | Ação |
|-------|---------------|------|
| **70-100** | ✅ OPORTUNIDADE | Setup válido para operação |
| **50-69** | 🔭 RADAR | Aguardar melhora do setup |
| **30-49** | ⏸️ AGUARDAR | Score baixo, não operar |
| **0-29** | ❌ DESCARTAR | Descartar ativo |

### Risk/Reward (RR)

```
RR = (Alvo - Entrada) / (Entrada - Stop)

RR ≥ 2.0 → Excelente (operação recomendada)
RR 1.5-2.0 → Bom (operar com cautela)
RR < 1.5 → Ruim (risco alto, descartar)
```

### Exemplo de Log

```
✅ [Scanner] PETR4: score=57.00 | RR=1.72 | setup=⏸️ AGUARDAR MELHOR SETUP
   🧠 IA: Gemini 62% | DeepSeek 57% | Técnico 57%
   ⛔ Sentinela: VETADO (BEARISH)
```

---

## 🔧 Manutenção e Agenda

### Rotina Diária Recomendada

| Horário | Atividade |
|---------|-----------|
| 08:00 | Pipeline automático (pré-mercado) |
| 10:00-11:00 | Pipeline principal (após abertura) |
| 17:00 | Pipeline de fechamento (opcional) |

### Tarefas Semanais

- [ ] Verificar logs de execução (erros e warnings)
- [ ] Revisar oportunidades aprovadas vs. mercado
- [ ] Ajustar parâmetros se necessário (stop, alvo, score mínimo)

### Tarefas Mensais

- [ ] Verificar saldo de requisições das APIs
- [ ] Atualizar lista de tickers se necessário
- [ ] Revisar performance do sistema

---

## 🐛 Solução de Problemas

### Problemas Comuns

| Problema | Causa | Solução |
|----------|-------|---------|
| `Exceeded maximum execution time` | Timeout GAS (360s) | Reduzir tickers ou aumentar timeout |
| `BRAPI HTTP 502/504` | API instável | Fallback automático para Alpha Vantage |
| `FINNHUB_API_KEY ausente` | Secrets Manager não encontrou | Chave hardcoded já configurada |
| `Yahoo HTTP 401/403` | Yahoo bloqueou acesso | Yahoo desativado, usar Finnhub |
| Dashboard não atualiza | Cache expirado | Aguardar 5 min ou limpar cache |

### Verificando o Sistema

Use as funções de teste no Apps Script:

```javascript
VERIFICAR_M1_FALLBACK()  // Testa DataService
TESTAR_MACRO()           // Testa dados macro
TESTAR_BRAPI()           // Testa conexão BRAPI
TESTAR_PRECO_AO_VIVO()   // Testa cotação atual
```

### Logs e Debug

1. No Apps Script, vá em **Execuções** (⏰)
2. Selecione a execução desejada
3. Analise os logs procurando por:
   - `❌` — Erros críticos
   - `⚠️` — Warnings (fallbacks ativados)
   - `✅` — Sucessos

---

## 📚 Glossário

| Termo | Significado |
|-------|-------------|
| **ADX** | Average Directional Index — força da tendência |
| **B3** | Brasil, Bolsa, Balcão — bolsa de valores brasileira |
| **BCB** | Banco Central do Brasil |
| **BRAPI** | API brasileira de cotações (brapi.dev) |
| **Candle** | Representação OHLC de um período (abertura, máxima, mínima, fechamento) |
| **Circuit Breaker** | Mecanismo que desvia para fallback após falhas consecutivas |
| **EMA** | Média Móvel Exponencial |
| **EWZ** | ETF de ações brasileiras negociado nos EUA |
| **GAS** | Google Apps Script |
| **HG Brasil** | API brasileira de dados financeiros (hgbrasil.com) |
| **IBOV** | Índice Bovespa |
| **IIFE** | Immediately Invoked Function Expression |
| **OBV** | On-Balance Volume — indicador de fluxo de volume |
| **OHLC** | Open, High, Low, Close — preços de abertura, máxima, mínima, fechamento |
| **RR** | Risk/Reward — relação risco/retorno |
| **RSI** | Relative Strength Index — índice de força relativa |
| **Selic** | Taxa básica de juros brasileira |
| **Sentinela** | Módulo de veto baseado em sentimento de mercado |
| **Ticker** | Código do ativo na B3 (ex: PETR4, VALE3) |

---

> 📅 **Última atualização**: Julho/2026
> ⚡ **Sistema**: B3-v10 | Google Apps Script | Gemini + DeepSeek
