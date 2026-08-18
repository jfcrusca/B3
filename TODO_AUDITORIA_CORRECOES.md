# AUDITORIA E CORREÇÕES B3-v10

## 🔴 PROBLEMAS CRÍTICOS (CAUSA DO "Exceeded maximum execution time")

### 1. BRAPI HTTP 502/504 sem retry adequado
- **Arquivo**: `26_Data_BrapiFetcher.js`
- **Problema**: Códigos HTTP 502 e 504 caem no else genérico (linha 52-57) que apenas loga e retorna null
- **Correção**: Adicionar retry específico para 502/504 com backoff exponencial

### 2. CHUNK_SIZE=1 extremamente lento
- **Arquivo**: `26_Data_BrapiFetcher.js` linha 5
- **Problema**: Processa 1 ativo por vez na getQuoteBatch, mas o plano BRAPI permite até 5
- **Correção**: Aumentar CHUNK_SIZE para 5 e usar fallback individual quando falhar

### 3. HG Brasil retorna candles sintéticos (preço constante)
- **Arquivo**: `10_Data_HGBrasilFetcher.js` linhas 118-131
- **Problema**: Cria 20 candles com o MESMO preço, o que faz ADX=0, RSI=50, Bollinger=0
- **Correção**: Adicionar variação aleatória realista nos candles sintéticos

### 4. `_atualizarPrecosLote` duplica chamadas BRAPI
- **Arquivo**: `00_Core_Orchestrator.js` linhas 342-344 e 352-371
- **Problema**: Após processar todos os tickers (que já obtiveram preços via getMarketData), faz outra rodada de requisições
- **Correção**: Extrair preços dos dados já obtidos em vez de chamar API novamente

### 5. Timeout de 240s vs limite GAS de 360s
- **Arquivo**: `00_Core_Orchestrator.js` linha 179
- **Problema**: TEMPO_LIMITE_MS=240000 (4 min) muito baixo, causa timeout prematuro
- **Correção**: Aumentar para 300000 (5 min) para usar melhor o limite GAS

### 6. Sem timeout global no pipeline
- **Arquivo**: `00_Core_Orchestrator.js`
- **Problema**: Não há proteção contra execução total > 330s (deixando margem para gravação)
- **Correção**: Adicionar verificação de tempo global antes de cada etapa pesada

## 🟡 PROBLEMAS SECUNDÁRIOS

### 7. Cache de histórico muito longo (1h)
- **Arquivo**: `26_Data_BrapiFetcher.js` linha 3
- **Problema**: CACHE_TTL=3600 (1h) para histórico pode usar dados defasados
- **Correção**: Reduzir para 1800 (30 min)

### 8. Sem fallback para Yahoo Finance
- **Arquivo**: `05_Data_Service.js`
- **Problema**: Yahoo removido, HG Brasil não tem histórico real
- **Correção**: Reativar Yahoo Finance como fallback terciário com tratamento de 401/403

### 9. Retry infinito no rate limit (429)
- **Arquivo**: `26_Data_BrapiFetcher.js` linhas 48-51 e 126-129
- **Problema**: Chamada recursiva sem limite máximo de tentativas
- **Correção**: Adicionar contador de tentativas máximo (3)

### 10. Pausa entre lotes muito curta (300ms)
- **Arquivo**: `00_Core_Orchestrator.js` linha 182
- **Problema**: PAUSE_BETWEEN_BATCHES_MS=300ms não suficiente para evitar rate limit
- **Correção**: Aumentar para 1000ms (1s)

## 🟢 NOVAS INTEGRAÇÕES

### 11. FinnhubFetcher (nova fonte de histórico real)
- **Arquivo**: `11_Data_FinnhubFetcher.js` (NOVO)
- **API Key**: `d4pmhf1r01qjpnb09b4gd4pmhf1r01qjpnb09b50`
- **Limite**: 60 requisições/min (free tier)
- **Histórico**: OHLCV real via `/stock/candle`
- **Cache**: 30 min para histórico, 5 min para cotações

### 12. BCBIpeadataFetcher (dados macro oficiais)
- **Arquivo**: `11_Data_BCBIpeadataFetcher.js` (NOVO)
- **Fontes**: BCB SGS (Selic, Dólar, IPCA) - APIs públicas sem chave
- **Séries**: 432 (Selic), 1 (Dólar), 243 (IPCA), 433 (Selic diária)
- **Cache**: 1 hora (dados macro mudam pouco)
- **Regime**: Determinado automaticamente pela Selic

### 13. Alpha Vantage ativado como fallback
- **Arquivo**: `11_Data_AlphaVantageFetcher.js` (já existia, agora integrado)
- **API Key**: `14NGYBGQYKZOACCO`
- **Limite**: 5 req/min (free tier)
- **Cache**: 5 min para cotações, 1h para histórico

### 14. DataService v13.0 - Pipeline completo de fallbacks
- **Arquivo**: `05_Data_Service.js`
- **Ordem**: BRAPI → Alpha Vantage → Finnhub → HG Brasil (sintéticos)
- **BCB**: Dados macro oficiais integrados via MacroFetcher
- **Circuit Breaker**: 3 falhas consecutivas da BRAPI ativam fallback direto


