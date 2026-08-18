# Documentação B3-v10

## 00_Core_Orchestrator
**Categoria:** core_orchestration

**Resumo:** Módulo com 3 funções: executarRoboB3, isDebugModeEnabled, FORCAR_EXECUCAO...

### Funções:
- `executarRoboB3` ()
- `isDebugModeEnabled` ()
- `FORCAR_EXECUCAO` ()

---
## 00_Debug_Ensemble_Tests
**Categoria:** core_orchestration

**Resumo:** Teste 1: Verificar se IAs estão respondendo básico Execute: teste_ai_basico()

### Funções:
- `teste_ai_basico` ()
- `teste_ensemble_mock` ()
- `teste_debug_logs` ()
- `teste_robo_full` ()
- `teste_ensemble_real` ()
- `teste_pesos` ()
- `menu_testes` ()
- `_` ()

---
## 00_Logger_Compat
**Categoria:** core_orchestration

**Resumo:** Sem descrição detectada.


---
## 00_Menu_Manager
**Categoria:** core_orchestration

**Resumo:** ============================================================================= 00_Menu_Manager.gs — v14.0 (TRÍADE DE COMANDO - ELITE) ===================================================================

### Funções:
- `onOpen` ()
- `build` ()
- `MENU_RANKER` ()
- `MENU_ATUALIZAR_ESTATISTICAS` ()
- `MENU_SYNC_PORTFOLIO` ()
- `MENU_TELEGRAM` ()
- `MENU_TESTAR_ALERTA_RISCO` ()
- `MENU_DARF` ()
- `MENU_COMPLIANCE` ()
- `TESTAR_LEITURA_DO_COFRE` ()
- `MENU_DEBUG_SAUDE` ()
- `MENU_DEBUG_PETR4` ()
- `MENU_LIMPAR_CACHE` ()
- `MENU_AGENT_ANALYST` ()

---
## 00_Pipeline_Adapter
**Categoria:** core_orchestration

**Resumo:** ============================================================================= 00_Pipeline_Adapter.gs (Versão Blindada V10.1 - COM CONTEXTO IBOV) =======================================================

### Funções:
- `processarTicker` (ticker, ibovContext)
- `testarIntegracaoAvancada` ()
- `testeUnitarioV10_ComDadosFalsos` ()
- `EXECUTAR_STRESS_TEST_BEAR_MARKET` ()

---
## 00_Security_Utils
**Categoria:** core_orchestration

**Resumo:** 00_Security_Utils.js — Utilitários de segurança compartilhados

### Funções:
- `isSecretKeyName` (key)
- `isDebugModeEnabled` ()
- `isSecretEnforcementActive` ()
- `assertWebAppAuthorized` ()

---
## 00_Setup_CreateSheets
**Categoria:** core_orchestration

**Resumo:** 00_Setup_CreateSheets.gs — KIT DE RESGATE (V4 - Completo) ============================================================================= Recria a estrutura de TODAS as abas, incluindo as que sumiram. N

### Funções:
- `ensureSheet` (ss, name)
- `styleHeader` (range)
- `setHeaders` (sh, headers, opts)
- `setupResumoTrades` (ss, opts)
- `setupRelatorioRebal` (ss, opts)
- `setupLogPerformance` (ss, opts)
- `setupCarteira` (ss, opts)
- `setupConfiguracoes` (ss, opts)
- `setupDashboard` (ss, opts)
- `setupResultadosAnalise` (ss, opts)
- `setupOportunidades` (ss, opts)
- `setupLogs` (ss, opts)
- `setupSimulation` (ss, opts)
- `setupSimulationLog` (ss, opts)
- `createSheets` (options)
- `RODAR_SETUP_COMPLETO` ()
- `RECUPERAR_ABAS_PERDIDAS` ()

---
## 00_Tools
**Categoria:** core_orchestration

**Resumo:** Módulo com 7 funções: clearLogs, runDiagnostics, monitorarRateLimits...

### Funções:
- `clearLogs` ()
- `runDiagnostics` ()
- `monitorarRateLimits` ()
- `MENU_RESET_YAHOO` ()
- `MENU_RESET_GEMINI` ()
- `adicionarMenuRateLimiter` ()
- `diagnosticoCompleto` ()

---
## 00_Utils
**Categoria:** core_orchestration

**Resumo:** 00_Utils.gs - Funções Globais de Suporte Resolve os erros: parseNumberBR_, formatBRL_ e diagnosticarResumo

### Funções:
- `_wrapRange` (range)
- `_wrapSheet` (sheet)
- `_wrapSpreadsheet` (spreadsheet)
- `QUOTA_TRACKER_REPORT` ()
- `parseNumberBR_` (v)
- `formatBRL_` (n)
- `diagnosticarResumo` ()
- `avaliarRompimentoSeguro` (precoAtual, bandaSuperior, volumeAtual, volumeMedio20, macdHistograma)

---
## 01_Core_Config
**Categoria:** core_orchestration

**Resumo:** ============================================================================= 01_Core_Config.gs   GESTOR UNIFICADO DE CONFIGURAÇÕES B3-v10 =============================================================

### Funções:
- `parseValue` (value)
- `readSheetConfig` ()
- `getCachedConfig` ()
- `putCachedConfig` (configMap)
- `isEnforcementActive` ()
- `isBlockedSheetSecret` (key)
- `readSecretFromProviders` (key)

---
## 02_Core_Logger
**Categoria:** core_orchestration

**Resumo:** Módulo com 6 funções: _addBuffer, info, warn...

### Funções:
- `_addBuffer` (level, modulo, mensagem)
- `info` (modulo, mensagem)
- `warn` (modulo, mensagem)
- `error` (modulo, mensagem)
- `debug` (modulo, mensagem)
- `flush` ()

---
## 03_Cache_Unified
**Categoria:** utils

**Resumo:** 03_Cache_Unified.gs — V3.1 (MODULAR & SLIM) ============================================================================= Finalidade: Gestão centralizada de cache para evitar excesso de chamadas de AP

### Funções:
- `LIMPAR_CACHE_COMPLETO` ()
- `VERIFICAR_STATUS_CACHE` ()

---
## 04_Core_RateLimiter
**Categoria:** core_orchestration

**Resumo:** // ===== 04_Core_RateLimiter.gs ===== // Gestor de Limites de API (Anti-Bloqueio e Controlo de Custos)


---
## 05_B3V10_TickerManager
**Categoria:** data_management

**Resumo:** ============================================================================= 05_B3V10_TickerManager.gs — GESTOR CENTRALIZADO DE ATIVOS (FUSÃO ELITE 2026) =============================================


---
## 05_Data_Service
**Categoria:** data_management

**Resumo:** 05_Data_Service.gs — CAMADA DE DADOS UNIFICADA (v12.0 - SOMENTE BRAPI) ============================================================================= ✅ REMOVIDO: Yahoo Finance (401/403 bloqueado) ✅ PRI

### Funções:
- `getMarketData` (ticker, interval, range)
- `getMarketContext` ()
- `getPrecosAtuaisEmLote` (tickersArray)
- `getPrecoAtual` (ticker)
- `obterDados` (ticker, interval, range)
- `VERIFICAR_M1_FALLBACK` ()
- `TESTAR_PRECO_AO_VIVO` ()
- `TESTAR_BRAPI` ()

---
## 07_AI_Unified_Connector
**Categoria:** ai_analysis

**Resumo:** // 📦 MÓDULO/ARQUIVO: 07_AI_Unified_Connector.js // 🛠️  TECNOLOGIA: JAVASCRIPT // 📌  VERSÃO: 3.4 — DEEPSEEK + FALLBACK COMPLETO RESILIENTE /

### Funções:
- `TESTAR_DEEPSEEK` ()
- `TESTAR_DEEPSEEK_ISOLADO` ()
- `TESTAR_CONEXAO_DEEPSEEK` ()
- `TESTAR_FALLBACK` ()

---
## 08_AI_Ensemble
**Categoria:** ai_analysis

**Resumo:** 08_AI_Ensemble.js ============================================================================= CENTRAL DE INTELIGÊNCIA COLETIVA DE IA (UNIFICADO v10.0) ===============================================

### Funções:
- `getEnhancedScore` (originalAnalysis)
- `analyzeWithEnsemble` (technicalData)
- `getEnhancedScoresBatch` (lista)
- `analisar` (prompt, dadosTecnicos = {}, macroRegime = "NEUTRAL")
- `_ajustarPesosDinamicos` (gScore, dScore, adxValue)
- `_calcularSizingDinamico` (finalScore, gemini, deepseek, macroRegime)
- `_getGeminiAnalysis` (ticker, data)
- `_extractScore` (obj)
- `_findScoreValue` (data)
- `_normalizeScore` (val)
- `_extractTechScore` (data)
- `_safeParse` (text)
- `_scoreToDecision` (score)
- `TESTAR_ENSEMBLE` ()
- `DEBUG_AI_FAILURE` (ticker)
- `geminiFalhou` ()
- `deepseekFalhou` ()

---
## 08_Output_Unified
**Categoria:** utils

**Resumo:** ============================================================================= 08_Output_Unified.gs — CENTRAL DE SAÍDA E RELATÓRIOS (v12.0 - MEMORY BUFFER) =============================================

### Funções:
- `saveAnalysisResults` (lista)
- `_forceWrite` (lista)
- `_toRow` (op)
- `_formatSheetOptimized` (sheet, startRow, numRows, rowsSanitized)
- `_ensureSheet` (ss)
- `CORRIGIR_FORMATACAO_AGORA` ()

---
## 10_Data_YahooFetcher
**Categoria:** data_management

**Resumo:** Executa um teste completo das funcionalidades do módulo YahooFetcher. Valida a conexão com o Yahoo e o fallback automático para BRAPI.

### Funções:
- `_getRandomUserAgent` ()
- `_fetchWithRetry` (url, options = {})
- `getHistory` (ticker, interval = '1d', range = '3mo')
- `getQuoteBatchSmart` (tickers)
- `getQuoteBatchBrapi` (tickers)
- `getQuote` (ticker)
- `TEST_YahooFetcher` ()

---
## 11_Data_AlphaVantageFetcher
**Categoria:** data_management

**Resumo:** 11_Data_AlphaVantageFetcher.js — Provedor de Dados Alpha Vantage (v1.0) ============================================================================= ✅ Nova fonte de dados para histórico e cotações. ✅

### Funções:
- `_getApiKey` ()
- `_fetchWithRetry` (url, options, bucketName)
- `getHistory` (ticker, interval = 'daily', outputsize = 'compact')
- `getQuoteBatch` (tickers)
- `getQuote` (ticker)

---
## 12_Indicators_Volume
**Categoria:** technical_indicators

**Resumo:** 12_Indicators_Volume.gs — V10.0 (REFATORAÇÃO MODULAR) ============================================================================= Finalidade: Cálculos avançados de Volume e Fluxo de Dinheiro. Refato


---
## 13_Indicators_RelativeStrength
**Categoria:** technical_indicators

**Resumo:** Módulo com 1 funções: calculateRS...

### Funções:
- `calculateRS` (ticker, benchmarkTicker, period, dataPeriod, interval)

---
## 14_Dashboard_PainelMercado
**Categoria:** ai_analysis

**Resumo:** 14_Dashboard_PainelMercado.gs — v14.1 (REFACTORED: PERFORMANCE FIX) ============================================================================= ✅ GESTÃO: Adicionado Bloco de Saúde da Carteira (Lucro

### Funções:
- `_parseNum` (val)
- `updateDashboardCompleto` ()
- `_drawComparisonBlock` (dash, startRow)
- `_drawWinRateChart` (dash, startRow)
- `_getRealStats` ()
- `_getSimStats` ()
- `ATUALIZAR_DASHBOARD` ()
- `calcAvg` (list)

---
## 15_AI_Agentic_Enricher
**Categoria:** ai_analysis

**Resumo:** 15_AIAgenticEnricher.gs — v7.0 (INTEGRAÇÃO TOTAL COM CONFIG) ============================================================================= ✅ DINÂMICO: Busca Modelo, Score Mínimo e Chaves via CONFIG.ge


---
## 17_Notification_Manager
**Categoria:** data_management

**Resumo:** 17_Notification_Manager.gs — v7.6 (INTELLIGENCE & AGENTIC) ============================================================================= ✅ RÓTULOS: Alterado de "P/L" para "LUCRO ATUAL" para evitar con

### Funções:
- `dispararRelatorioDiario` ()
- `_getConfigSecret` (key)
- `_enviarTelegram` (token, chatId, pat, luc, urgentes)
- `_enviarGmail` (email, pat, luc, urgentes, mantidos)
- `_formatBRL` (val)
- `enviarAlertaRisco` (mensagem)
- `EXECUTAR_NOTIFICACAO_DIARIA` ()

---
## 20_Compliance_Unified
**Categoria:** utils

**Resumo:** 20_Compliance_Unified.gs — V5.0 (MODULAR & SNIPER COMPLIANT) ============================================================================= Finalidade: Guardião de regras, horários e travas de risco. R

### Funções:
- `COMPLIANCE_CHECK` ()
- `verificarHorarioOperacional` ()

---
## 21_Tax_Calculator
**Categoria:** utils

**Resumo:** ============================================================================= 21_Tax_Calculator.gs — MOTOR CONTÁBIL & DISTRIBUIDOR FISCAL (V3.1) =======================================================

### Funções:
- `EXECUTAR_CALCULO_FISCAL` ()

---
## 22_Core_Analyzers
**Categoria:** core_orchestration

**Resumo:** Módulo com 25 funções: STRATEGY_EVALUATE_CORE, _obterContextoPrecos, _calcularIndicadoresTecnicos...

### Funções:
- `STRATEGY_EVALUATE_CORE` (data, ibovContext)
- `_obterContextoPrecos` (candles)
- `_calcularIndicadoresTecnicos` (candles, closes)
- `_analisarEstruturaMercado` (ctx, preco, ind, candles)
- `_processarGestaoRisco` (preco, atr, estrutura, candles, closes)
- `_selecionarAlvo` (niveisDisponiveis, precoAtual, stopDist, minRR)
- `_identificarSetup` (rr, inFibo, score, preco, ind, risco)
- `_core_getATR` (candles, period)
- `_core_getEMA` (values, period)
- `_core_getRSI` (values, period)
- `_core_getVWMA` (candles, period)
- `_core_getADX` (candles, period)
- `wilderSmooth` (arr)
- `_core_getBollinger` (closes, period, mult)
- `_core_getLogReturns` (closes)
- `_core_getMedian` (arr)
- `_core_getRobustSigma` (arr)
- `_core_estimarRuidoEstatistico` (candles, closes, period)
- `_core_noisePrice` (preco, atr, candles, closes)
- `_core_detectPivotLows` (candles, leftBars, rightBars)
- `_core_getLastPivotLow` (candles, lookback, leftBars, rightBars)
- `_core_getVolumeRelativo` (candles, period)
- `DIAGNOSTICAR_INDICADORES` (ticker)
- `TESTAR_FUNCAO_CORE` ()
- `LIMPAR_CACHE_E_TESTAR` ()

---
## 23_Pivot_Fibonacci
**Categoria:** utils

**Resumo:** ============================================================================= 23_Pivot_Fibonacci.gs — Indicadores de Pivô e Fibonacci (OTIMIZADO) ======================================================

### Funções:
- `calculateClassicPivotPoints` (high, low, close)
- `calculateWoodiePivotPoints` (high, low, close)
- `calculateCamarillaPivotPoints` (high, low, close)
- `detectSwingPoints` (candles, lookback = 20)
- `calculateAllFibonacciLevels` (swingHigh, swingLow)
- `completeAnalysis` (candles)

---
## 24_Secrets_Manager
**Categoria:** data_management

**Resumo:** ============================================================================= 24_Secrets_Manager.gs — Gestão Avançada de Chaves (GCP + Fallback) =======================================================

### Funções:
- `getSecrets` (secretNames)
- `getSecret` (name)
- `getProjectId` ()
- `fetchFromGcp` (projectId, secretNames)
- `fetchFromScriptProperties` (secretNames)

---
## 25_Fundamentalist_Engine
**Categoria:** utils

**Resumo:** 25_Fundamentalist_Engine.gs Especialista em Valuation e Margem de Segurança

### Funções:
- `getValuationBonus` (ticker)

---
## 26_Data_BrapiFetcher
**Categoria:** data_management

**Resumo:** Módulo com 6 funções: _getToken, _waitIfNeeded, _fetchWithCache...

### Funções:
- `_getToken` ()
- `_waitIfNeeded` ()
- `_fetchWithCache` (key, url, ttl, isBatch = false)
- `fetchHistory` (ticker, attempt = 1)
- `getQuoteBatch` (tickers)
- `TESTAR_TICKER_BRAPI` (ticker)

---
## 27_Abas_Cabecalhos
**Categoria:** utils

**Resumo:** 27_Abas_Cabecalhos.gs - Versão com Fórmulas como Texto EXIBE: - Todas as fórmulas como TEXTO PLANO (não executáveis) - Links também como texto (opcional)

### Funções:
- `colToLetter_` (col)
- `relacionarAbasDetalhado` ()
- `criarRelatorioComoTexto` (abaIndice, relatorioFormulas, relatorioCabecalhos)
- `exportarFormulasComoCSV` ()
- `GERAR_RELATORIO_TEXTO` ()
- `EXPORTAR_FORMULAS_CSV` ()

---
## 28_ativarEnforcement
**Categoria:** utils

**Resumo:** Módulo com 4 funções: ativarEnforcementProducao, executarAnaliseReal, configurarProducao...

### Funções:
- `ativarEnforcementProducao` ()
- `executarAnaliseReal` ()
- `configurarProducao` ()
- `planoEmergenciaEnforcement` ()

---
## 29_Oportunidades_Processor
**Categoria:** utils

**Resumo:** 29_Oportunidades_Processor.gs — V4.0 (ENCAPSULATED & CLEAN) ============================================================================= ✅ RESPONSABILIDADE: Ler "Resultados_Analise", consolidar por T

### Funções:
- `PROCESSAR_OPORTUNIDADES_FINAL` ()

---
## 30_DARF_Generator
**Categoria:** trading_logic

**Resumo:** ============================================================================= 30_DARF_Generator.gs — PAINEL FISCAL & INTERFACE (V2.1) ==================================================================

### Funções:
- `emitirGuiaMensal` (mes, ano)
- `enviarDarfPorEmail` ()
- `_isPrimeiroDiaUtil` (data)
- `_exibirModal` (html, titulo, w, h)
- `MENU_FISCAL_CALCULAR_MES_ANTERIOR` ()
- `MENU_FISCAL_RECALCULAR_TUDO` ()
- `ENVIAR_DARF_MENSAL_AUTOMATICO` ()

---
## 30_Portfolio_Unified
**Categoria:** trading_logic

**Resumo:** Módulo com 1 funções: syncPortfolio...

### Funções:
- `syncPortfolio` ()

---
## 31_Portfolio_Rebalancer
**Categoria:** trading_logic

**Resumo:** 31_Portfolio_Rebalancer.gs — v6.0 (SINCRONIA TOTAL DE ALVOS E STOPS) ============================================================================= Finalidade: Cruzar a Carteira Real com a Recomendada 

### Funções:
- `EXECUTAR_SINCRONIZACAO_CARTEIRAS` ()
- `getSheetRobust` (name)

---
## 32_Automacao_Setup
**Categoria:** config_setup

**Resumo:** ============================================================================= 32_Automacao_Setup.gs — O MAESTRO DA AUTOMAÇÃO B3-v10 ====================================================================

### Funções:
- `instalarAutomacao` ()
- `desinstalarAutomacao` ()

---
## 33_Data_SheetManager
**Categoria:** data_management

**Resumo:** Aplica regras de cores baseadas no Setup para facilitar a leitura rápida

### Funções:
- `findVal` (options)

---
## 34_AI_Logic
**Categoria:** ai_analysis

**Resumo:** Sem descrição detectada.


---
## 34_AI_Prompts
**Categoria:** ai_analysis

**Resumo:** ============================================================================= 34_AI_Prompts.gs — Configurações, Constantes e Estado ====================================================================

### Funções:
- `criarConfiguracaoPadrao` ()
- `criarTestesCalibracao` ()

---
## 34_AI_Service
**Categoria:** ai_analysis

**Resumo:** 34_AI_Service.gs — V6.1 (ORQUESTRAÇÃO MODULAR + ADX + BOLLINGER) ============================================================================= Finalidade: Controlador central de Inteligência e Diagnós


---
## 34_DecisionEngine
**Categoria:** ai_analysis

**Resumo:** Módulo com 8 funções: _cfg, _clampScore, _normalizeSentiment...

### Funções:
- `_cfg` (key, fallback)
- `_clampScore` (value)
- `_normalizeSentiment` (raw)
- `_sentimentBonus` (sentiment)
- `_contains` (list, value)
- `_threshold` (options, flexApplied)
- `_reject` (ctx, reason, score, sentiment, stage)
- `evaluate` (input)

---
## 35_Agent_Orchestrator
**Categoria:** core_orchestration

**Resumo:** Módulo com 12 funções: _cfg, _scoreMinimo, _normalizeSentiment...

### Funções:
- `_cfg` (key, fallback)
- `_scoreMinimo` ()
- `_normalizeSentiment` (raw)
- `_calcularBonus` (canonical)
- `_consultarMemoria` (ticker, setupType)
- `_consultarAnalista` (ticker, op)
- `_consultarRisco` (op)
- `_getThreshold` ()
- `processOpportunity` (op, macroRegime)
- `_rejeitarCom` (motivo, op, sentiment, score)
- `_log` (decisao, ticker, sentiment, scoreOriginal, scoreFinal, motivo)
- `icone` ()

---
## 36_Agent_Analyst
**Categoria:** ai_analysis

**Resumo:** Módulo com 1 funções: _sanitizarMemoria...

### Funções:
- `_sanitizarMemoria` (texto)

---
## 37_Agent_RiskManager
**Categoria:** data_management

**Resumo:** 37_Agent_RiskManager.gs — GESTOR INTEGRADO DE RISCO E PORTFÓLIO V5.0 ============================================================================= ✅ PAPEL: Filtro final de decisão. Valida correlação, 

### Funções:
- `_cfg` (key, fallback)

---
## 38_Agent_Memory
**Categoria:** ai_analysis

**Resumo:** Módulo com 7 funções: _cfg, getContext, _classifyDrawdown...

### Funções:
- `_cfg` (key, fallback)
- `getContext` (ticker, setupType)
- `_classifyDrawdown` (winRate)
- `_getRecentPerformance` ()
- `_getTickerBias` (ticker)
- `_getTickerWinRate` (ticker)
- `TESTAR_INTEGRACAO_MEMORIA` ()

---
## 39_Code_Scanner
**Categoria:** utils

**Resumo:** Detecta automaticamente o uso de funções legadas (como fetchCandles) e sugere a migração para métodos modernos (getHistory), garantindo a evolução do sistema. [5]

### Funções:
- `validarChamadasLegadas` ()
- `getLegacyRules` ()
- `inferGetHistory` (argsText)
- `isInterval` (s)
- `isRange` (s)
- `strip` (s)
- `writeReport` (rows)
- `logSummary` (rows)

---
## 41_Ranker
**Categoria:** trading_logic

**Resumo:** ✅ CORREÇÃO: Mapeamento de colunas sincronizado com o Módulo 08 (v10.7). ✅ FIX: R/R agora aponta para o Índice 9 (Coluna J), corrigindo o valor "0". ✅ INTEGRADO: Position Sizing baseado no Risco por Tr

### Funções:
- `PROCESSAR_CARTEIRA_FINAL` ()
- `_cfg` (key, fallback)
- `_determinarStatusPorSetup` (setup, score)
- `_escreverTabelaRanker` (ss, trades, sheetName)
- `_desenharGlossario` (sheet)

---
## 42_HistoricalContext
**Categoria:** utils

**Resumo:** 42_HistoricalContext.gs


---
## 46_Debug_System
**Categoria:** utils

**Resumo:** ============================================================================= 46_Debug_System.gs — Diagnóstico Dedicado (Versão Core Analyzers) ========================================================

### Funções:
- `verificarSaudeSistema` ()
- `debugarAtivo` (ticker = "PETR4")
- `gerarDadosMock` ()
- `debugarCandles` (ticker = 'USIM5')

---
## 47_Automacao_Triggers
**Categoria:** utils

**Resumo:** ============================================================================= 47_Automacao_Triggers.gs — GESTÃO AGÊNTICA DE GATILHOS (v12.0) ===========================================================

### Funções:
- `MENU_INSTALAR_AUTOMACAO` ()
- `MENU_DESATIVAR_AUTOMACAO` ()
- `realizarManutencaoMadrugada` ()

---
## 48_Health_Check
**Categoria:** utils

**Resumo:** ============================================================================= 48_Health_Check.gs — MONITOR DE INTEGRIDADE (v10) ========================================================================

### Funções:
- `enviarStatusSaudeSemanal` ()

---
## 50_preMarketAnalysis
**Categoria:** utils

**Resumo:** ============================================================================= 50_preMarketAnalysis.gs — v5.1 (SNIPER EDITION FIXED) ====================================================================

### Funções:
- `VISUALIZAR_MONITORAMENTO` ()
- `preMarketAnalysis_Inteligente` (forcarVisual = false)
- `construirHtmlSniper` (analises, stats, sugestoes)

---
## 51_SecureKeyService
**Categoria:** security

**Resumo:** 51_SecureKeyService.gs — v3.0 (DIAGNÓSTICO VISUAL) ============================================================================= ✅ CONEXÃO TOTAL: Lê as senhas das Propriedades do Script. ✅ RELATÓRIO H


---
## 51_Sentinela_Gringo
**Categoria:** security

**Resumo:** ============================================================================= 51_Sentinela_Gringo.gs — v1.1 (ADR & PRE-MARKET MONITOR) =================================================================

### Funções:
- `VISUALIZAR_SENTINELA_GRINGO` ()
- `RODAR_SENTINELA_AUTOMATICO` ()
- `TESTAR_YAHOO_BLOQUEIO` ()
- `TESTAR_SENTINELA_V8_DIRETO` ()

---
## 52_Performance_Manager
**Categoria:** data_management

**Resumo:** Módulo com 10 funções: converterParaNumero, encontrarIndiceColuna, lerNotas...

### Funções:
- `converterParaNumero` (valor)
- `encontrarIndiceColuna` (cabecalho, palavrasChave)
- `lerNotas` ()
- `identificarTrades` (operacoes)
- `garantirAbaLog` (ss)
- `escreverTradesDetalhados` (ss, trades)
- `atualizarResumoEstatistico` (ss, trades)
- `executar` ()
- `ATUALIZAR_ESTATISTICAS` ()
- `TESTAR_WINRATE_ROLLING_12M` ()

---
## 53_CandlePatternScanner
**Categoria:** utils

**Resumo:** 53_CandlePatternScanner.gs — Motor de Price Action B3 ============================================================================= ✅ AUTONOMIA: Detecta padrões de alta probabilidade para o mercado br


---
## 54_Dashboard_Anual
**Categoria:** utils

**Resumo:** ========================================================================= // 54_Dashboard_Anual.gs  --  MOTOR DE INTELIGÊNCIA: HISTÓRICO ANUAL (2019 - 2026) // ========================================

### Funções:
- `GERAR_DASHBOARD_ANUAL` ()

---
## 55_AI_Ensemble
**Categoria:** ai_analysis

**Resumo:** 55_AI_Ensemble.js ============================================================================= PONTE DE COMPATIBILIDADE (UNIFICADO v10.0) =============================================================


---
## 56_MacroFetcher
**Categoria:** api_fetchers

**Resumo:** 56_MacroFetcher.js — VERSÃO FINAL ESTÁVEL ------------------------------------------------------------- ✔ APIs confiáveis (BCB + Yahoo) ✔ Proteção contra XML / erro ✔ Regime unificado (NEUTRAL / BEARI

### Funções:
- `fetchJSONSafe` (url)
- `getSelic` ()
- `getDolar` ()
- `getEWZVariation` ()
- `calcularRegime` (selic, ewzVar)
- `getMacroContext` ()
- `getRiskAdjustmentInternal` (regime)
- `getRiskAdjustment` ()
- `TESTAR_MACRO` ()

---
## 57_Copilot_Webhook
**Categoria:** utils

**Resumo:** 57_Copilot_Webhook.js — Integração com Copilot (CORRIGIDO) Versão 2.0 - Com validações de segurança

### Funções:
- `consultarCopilot` (ticker, technicalData)
- `TESTAR_COPILOT` ()

---
## 58_AI_Monitor
**Categoria:** ai_analysis

**Resumo:** DASHBOARD DE MONITORAMENTO DAS IAs //58_AL_Monitor.gs

### Funções:
- `MONITORAR_IA_STATUS` ()
- `_checkGeminiStatus` ()
- `_checkMacroStatus` ()

---
## 59_Simulation_Manager
**Categoria:** data_management

**Resumo:** 59_Simulation_Manager.gs — MOTOR DE PAPER TRADING (v1.0) ============================================================================= ✅ PAPEL: Simular a execução de TODOS os trades aprovados pelo Sen

### Funções:
- `_buildEntryKey` (entry)
- `_parseNumber` (value)
- `registerEntries` (lista)
- `monitorExits` ()
- `getGhostStatistics` ()
- `houseKeeping` ()
- `TESTAR_SISTEMA` ()
- `MENU_TESTAR_SISTEMA_SIMULACAO` ()

---
## 99_Debug_Unified
**Categoria:** utils

**Resumo:** ============================================================================= 99_Debug_Unified.gs — v4.0 (LÓGICA PURA) ============================================================================= ⚠️ 

### Funções:
- `time` ()
- `log` (texto)

---
## TESTE_RapidAPI
**Categoria:** utils

**Resumo:** Função para validar a conexão com a RapidAPI. Use para verificar se o Host e a Key estão corretos sem precisar rodar o robô inteiro.

### Funções:
- `TESTAR_CONEXAO_RAPIDAPI_DIRETO` ()
- `DIAGNOSTICO_BRAPI_YAHOO` ()

---
## VerificarFunciona
**Categoria:** utils

**Resumo:** 🚀 SIMULAÇÃO ESTRATÉGICA: Cenário BULLISH Força o regime de mercado para BULLISH e ignora travas de horário para verificar a sensibilidade de aprovação do robô.

### Funções:
- `VERIFICAR_MODULOS` ()
- `SIMULAR_CENARIO_BULLISH_DEBUG` ()
- `TESTE_MACRO_PIPELINE` ()
- `TESTAR_INTEGRACAO` ()
- `VERIFICAR_CORRECOES_ALTA_PRIORIDADE` ()
- `setupLogPerformance` ()
- `VERIFICAR_M2_VOLUME_FILTRO` ()
- `VERIFICAR_M3_ENCERRAMENTO_AUTO` ()
- `DIAGNOSTICO_BRAPI_YAHOO` ()

---
## WebApp
**Categoria:** utils

**Resumo:** WebApp.js — Dashboard Sniper B3

### Funções:
- `doGet` (e)
- `getDashboardData` ()
- `getPortfolioData` ()
- `headerParaChave` (header)
- `executarRoboB3FromWeb` ()
- `getSentinelaData` ()

---
