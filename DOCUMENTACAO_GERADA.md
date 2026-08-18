# Documentação do Projeto

## Função: `register`
**Descrição:** Registra um novo módulo ou componente no objeto global `modules` do orquestrador.

**Parâmetros:** 
* `name` (String): O identificador único ou nome do módulo a ser registrado.
* `value` (Any): O objeto, função ou valor que representa o módulo.

**Retorno:** (Any) Retorna o próprio valor registrado, permitindo encadeamento ou confirmação imediata.

**Uso:** Utilizada durante a inicialização do script para injetar dependências ou registrar módulos no namespace central do sistema.

---

## Função: `get`
**Descrição:** Recupera uma instância ou referência de um módulo armazenado no objeto global `modules`.

**Parâmetros:** 
* `name` (String): A chave ou identificador único do módulo que se deseja acessar.

**Retorno:** 
* (Any/Object): O objeto, função ou valor associado à chave fornecida, ou `undefined` caso o módulo não exista.

**Uso:** Utilizada para acessar dinamicamente componentes do sistema carregados no orquestrador, permitindo a comunicação entre diferentes partes da aplicação através do objeto `modules`.

---

## Função: `has`
**Descrição:** Verifica se um módulo específico existe dentro do objeto global `modules` do orquestrador.

**Parâmetros:** 
* `name` (String): O nome ou chave do módulo a ser verificado.

**Retorno:** 
* `Boolean`: Retorna `true` se o módulo existir no objeto `modules`, ou `false` caso contrário.

**Uso:** Utilizada internamente para validar a existência de um módulo antes de tentar acessá-lo ou executá-lo, evitando erros de referência em tempo de execução.

---

## Função: `init`
**Descrição:** Inicializa o sistema registrando serviços, classes e funções globais em um repositório central de módulos para permitir a injeção de dependências e o acesso orquestrado.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Object`: Retorna o objeto `modules` contendo todas as instâncias ou referências registradas.

**Uso:** Deve ser chamada no início do ciclo de execução da aplicação para garantir que todos os componentes necessários (serviços de dados, IA, orquestradores e funções de processamento) estejam carregados e disponíveis para uso global.

---

## Função: `executarRoboB3`
**Descrição:** Função principal de orquestração responsável por inicializar o ambiente do robô, executar o fluxo de varredura da B3 e gerenciar o estado de log no cache.

**Parâmetros:** 
* `forcado` (Boolean): Flag que indica se a execução deve ignorar verificações de rotina ou forçar o processamento imediato.

**Retorno:** 
* `Object`: Um objeto contendo `success` (boolean) indicando o status da execução e `message` (string) com o resultado ou descrição do erro ocorrido.

**Uso:** Deve ser chamada como ponto de entrada (entry point) para iniciar o processo de automação, seja via gatilho (trigger) do Google Apps Script ou interface do usuário.

---

## Função: `isDebugModeEnabled`
**Descrição:** Verifica se o modo de depuração está ativo consultando variáveis de configuração globais ou propriedades do script.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Boolean`: Retorna `true` se o modo de depuração estiver habilitado (via `CONFIG` ou `PropertiesService`) ou se houver uma sobreposição (`override`) ativa; caso contrário, retorna `false`.

**Uso:** Utilizada para condicionar a execução de logs detalhados, rastreamento de erros ou comportamentos específicos de teste em todo o projeto, permitindo alternar o estado de depuração sem alterar o código-fonte.

---

## Função: `FORCAR_EXECUCAO`
**Descrição:** Função de utilidade para depuração que ignora restrições de horário e bloqueios de calendário para forçar a execução imediata do pipeline `executarRoboB3`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa o fluxo do robô ou lança um erro caso o modo de depuração esteja desativado.

**Uso:** Deve ser invocada manualmente via editor de script ou console de depuração apenas em ambientes de teste. A função verifica a propriedade `DEBUG_MODE` antes de aplicar um *monkey patch* temporário nos métodos de validação (`_bloqueioCalendarioMacro` e `verificarHorarioOperacional`), garantindo que as proteções originais sejam restauradas automaticamente após a execução, mesmo em caso de falha.

---

## Função: `teste_ai_basico`
**Descrição:** Executa um teste de diagnóstico básico para verificar a disponibilidade do objeto `AIEnsemble` e validar o funcionamento da rotina de depuração de falhas.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas imprime logs no console do Google Apps Script.

**Uso:** Utilizada como um teste de sanidade (smoke test) para confirmar se a biblioteca ou módulo `AIEnsemble` está carregado corretamente e se a função de depuração `DEBUG_AI_FAILURE` está operacional para o ativo "PETR4".

---

## Função: `teste_ensemble_mock`
**Descrição:** Executa uma rotina de testes automatizados para validar o funcionamento do módulo `AIEnsemble` utilizando dados simulados (mock).

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe logs de execução no console do Google Apps Script.

**Uso:** 
* Utilizada para depuração e verificação de integridade do sistema de ensemble de IA, garantindo que a classe `AIEnsemble` esteja carregada e operante antes de processamentos reais.

---

## Função: `teste_debug_logs`
**Descrição:** Função utilitária de diagnóstico que exibe no console do Google Apps Script um guia de instruções para depuração de logs do sistema AIEnsemble.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas imprime mensagens formatadas no console.

**Uso:** Deve ser executada manualmente durante a fase de desenvolvimento ou manutenção para orientar o desenvolvedor sobre como filtrar e interpretar os logs de execução do sistema de IA no painel de controle do Apps Script.

---

## Função: `teste_robo_full`
**Descrição:** Função de teste de integração que executa o fluxo completo do robô B3 com monitoramento detalhado via console.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe o status da execução e eventuais erros no log do Google Apps Script.

**Uso:** Utilizada para validar o funcionamento ponta a ponta do sistema de automação B3 em ambiente de desenvolvimento, permitindo identificar falhas críticas através de blocos de tratamento de exceção (`try/catch`).

---

## Função: `teste_ensemble_real`
**Descrição:** Executa um teste de integração do modelo de ensemble (AIEnsemble) utilizando dados reais de mercado do ativo PETR4 para validar o fluxo de análise técnica e pontuação aprimorada.

**Parâmetros:** 
* Nenhum (função de execução direta/script de teste).

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe os logs de execução e os resultados do processamento no console do Google Apps Script.

**Uso:** Utilizada como ferramenta de depuração (debug) para verificar se a integração entre o serviço de dados (`DataService`), o motor de análise técnica (`STRATEGY_EVALUATE_CORE`) e o modelo de inteligência artificial (`AIEnsemble`) está operando corretamente com dados reais.

---

## Função: `teste_pesos`
**Descrição:** Função de teste unitário para validar a lógica de ponderação (ensemble) aplicada aos scores de diferentes modelos de IA (Gemini, DeepSeek e Técnico) sob diversos cenários de falha.

**Parâmetros:**
*   Nenhum (a função utiliza um array interno de cenários predefinidos para simulação).

**Retorno:**
*   `void`: A função não retorna valores, apenas exibe os resultados da simulação e o status de aprovação (Score >= 65) no console do Google Apps Script.

**Uso:**
*   Utilizada no ambiente de desenvolvimento (`00_Debug_Ensemble_Tests.js`) para garantir que o sistema de pesos dinâmicos trate corretamente casos onde um ou ambos os modelos de IA falham, assegurando que o peso da análise técnica compense a ausência de dados.

---

## Função: `menu_testes`
**Descrição:** Exibe no console do Google Apps Script um menu interativo com opções de diagnóstico e execução de testes para o sistema de Ensemble.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas imprime informações formatadas no console.

**Uso:** Deve ser executada diretamente pelo editor do Google Apps Script para listar os comandos de teste disponíveis e orientar o desenvolvedor sobre como realizar a depuração do sistema.

---

## Função: `_`
**Descrição:** Função de atalho que invoca a rotina de criação do menu de testes no sistema.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valor.

**Uso:** Utilizada como um gatilho rápido ou alias para executar a função `menu_testes()` durante o desenvolvimento e depuração do projeto.

---

## Função: `onOpen`
**Descrição:** Função de gatilho simples (trigger) que executa a construção do menu personalizado da aplicação ao abrir a planilha.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valor.

**Uso:** É disparada automaticamente pelo Google Apps Script sempre que o usuário abre o arquivo, garantindo que o objeto `MenuTriade` seja instanciado e o menu apareça na interface do usuário.

---

## Função: `build`
**Descrição:** Esta função é responsável por inicializar e renderizar a interface de menus personalizados na barra de ferramentas do Google Sheets para o sistema de gestão de investimentos B3.

**Parâmetros:**
*   Nenhum parâmetro é aceito pela função.

**Retorno:**
*   `void`: A função não retorna valores, apenas interage com a API `SpreadsheetApp` para modificar a interface do usuário (UI).

**Uso:**
A função deve ser chamada (geralmente através do gatilho `onOpen`) para criar cinco menus principais na planilha: **CÉREBRO** (estratégia/IA), **COFRE** (gestão de portfólio), **AUTOMAÇÃO** (gerenciamento de gatilhos), **MANUTENÇÃO** (debug/testes) e **CONTÁBIL**. Cada item de menu está vinculado a uma função específica do projeto que será executada ao ser clicado pelo usuário.

---

## Função: `MENU_RANKER`
**Descrição:** Função de interface que atua como um gatilho de execução para o módulo de processamento de carteiras.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valores, apenas executa uma função ou exibe um alerta na interface do usuário.

**Uso:** Utilizada como ponto de entrada (geralmente vinculada a um item de menu personalizado na planilha) para verificar a existência e disparar a execução da função `PROCESSAR_CARTEIRA_FINAL`.

---

## Função: `MENU_ATUALIZAR_ESTATISTICAS`
**Descrição:** Função de interface responsável por disparar o processo de atualização de estatísticas, verificando previamente a existência do módulo `ATUALIZAR_ESTATISTICAS`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valores, apenas executa a lógica de chamada ou reporta erros.

**Uso:** Utilizada como gatilho de menu personalizado na planilha para iniciar o cálculo ou processamento de dados de performance, garantindo tratamento de erro caso o módulo de processamento não esteja carregado no escopo.

---

## Função: `MENU_SYNC_PORTFOLIO`
**Descrição:** Função de interface responsável por disparar o processo de sincronização do portfólio através do módulo `PortfolioUnified`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa uma ação ou exibe um alerta na interface do usuário.

**Uso:** Utilizada como callback para itens de menu personalizados no Google Sheets, servindo como ponte entre a interface do usuário e a lógica de negócio contida no módulo `PortfolioUnified`.

---

## Função: `MENU_TELEGRAM`
**Descrição:** Aciona manualmente a execução da função de notificação diária via Telegram através de um item de menu na interface da planilha.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valor, apenas exibe alertas na interface do usuário (UI) do Google Sheets.

**Uso:** Deve ser vinculada a um item de menu personalizado no Google Sheets para permitir que o usuário dispare o envio do relatório de forma imediata e receba um feedback visual sobre o sucesso ou falha da operação.

---

## Função: `MENU_TESTAR_ALERTA_RISCO`
**Descrição:** Executa um teste de conectividade do sistema de notificações enviando uma mensagem de verificação para o canal configurado no Telegram.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa ações de interface (alertas na planilha) e chamadas de serviço externo.

**Uso:** Utilizada através do menu personalizado da planilha para validar se o `NotificationService` está corretamente carregado e se a integração com o serviço de mensagens (Telegram) está operacional.

---

## Função: `MENU_DARF`
**Descrição:** Executa a função de recálculo fiscal global ou exibe um alerta de erro caso o módulo correspondente não esteja disponível no ambiente.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valor, apenas executa uma ação de sistema ou dispara uma interface de alerta (UI).

**Uso:** 
* Utilizada como gatilho de menu personalizado para disparar o processo de recálculo de DARFs, garantindo que o sistema verifique a existência da dependência `MENU_FISCAL_RECALCULAR_TUDO` antes da execução para evitar falhas de script.

---

## Função: `MENU_COMPLIANCE`
**Descrição:** Função de interface responsável por disparar o módulo de verificação de conformidade (Compliance) a partir do menu personalizado da planilha.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valores, apenas executa uma ação ou exibe um alerta na interface do usuário (UI).

**Uso:** Deve ser vinculada a um item de menu no Google Sheets; ao ser clicada, verifica a existência da função `COMPLIANCE_CHECK` e a executa, ou notifica o usuário caso o módulo não esteja configurado.

---

## Função: `TESTAR_LEITURA_DO_COFRE`
**Descrição:** Valida a disponibilidade e o funcionamento do serviço de gerenciamento de chaves (SecureKeyService) através de uma interface de alerta na planilha.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe um alerta (`SpreadsheetApp.getUi().alert`) na interface do usuário com o resultado do teste ou uma mensagem de erro.

**Uso:** Utilizada para fins de depuração e verificação de integridade, permitindo confirmar se o módulo `SecureKeyService` está carregado corretamente e se a leitura das chaves de segurança está operacional.

---

## Função: `MENU_DEBUG_SAUDE`
**Descrição:** Executa um diagnóstico de integridade do sistema através de uma interface de alerta na planilha ativa.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void` (Exibe um alerta na interface do usuário com o resultado do diagnóstico ou uma mensagem de erro).

**Uso:** 
* Utilizada como entrada de menu personalizado para disparar verificações de sistema. A função prioriza o método `DebugTools.verificarSaude()`, recorre à função global `verificarSaudeSistema()` caso a primeira não exista, e exibe um erro caso nenhuma dependência seja encontrada.

---

## Função: `MENU_DEBUG_PETR4`
**Descrição:** Aciona uma rotina de depuração específica para o ativo 'PETR4' através da interface do Google Sheets, verificando a disponibilidade de módulos de debug no ambiente.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, mas exibe alertas (`ui.alert`) na interface do usuário com o status da execução ou relatórios de erro.

**Uso:** 
* Deve ser chamada a partir de um item de menu personalizado na planilha. A função verifica se o objeto `DebugTools` ou a função global `debugarAtivo` estão definidos, executando a lógica de depuração para o ativo 'PETR4' e notificando o usuário sobre o sucesso ou a ausência dos módulos necessários.

---

## Função: `MENU_LIMPAR_CACHE`
**Descrição:** Executa a limpeza do cache do sistema através de uma interface de menu, verificando a disponibilidade de métodos de gerenciamento de cache antes da execução.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe alertas na interface do usuário (UI) do Google Sheets.

**Uso:** Utilizada como callback para itens de menu personalizados no Google Sheets para permitir que o usuário final limpe dados temporários armazenados, garantindo que a aplicação utilize informações atualizadas.

---

## Função: `MENU_AGENT_ANALYST`
**Descrição:** Executa uma análise automatizada de ativos financeiros através do módulo `AgentAnalyst`, exibindo um relatório de decisão e justificativa técnica em uma caixa de diálogo na interface do Google Sheets.

**Parâmetros:**
* Esta função não recebe parâmetros de entrada.

**Retorno:**
* `void`: A função não retorna valores, apenas interage com a interface do usuário (`ui.alert`) ou interrompe a execução em caso de erro.

**Uso:**
* Deve ser acionada via menu personalizado no Google Sheets. A função extrai o ticker da célula "C7" da aba "Resumo_Trades_Aprovados", processa os dados através do objeto `AgentAnalyst` e apresenta um resumo contendo a decisão, score de IA, estratégia e justificativa técnica para o trader.

---

## Função: `processarTicker`
**Descrição:** Função adaptadora responsável por orquestrar a análise de ativos financeiros, integrando dados de contexto (IBOV) e motores de decisão (V10) para gerar sinais de entrada.

**Parâmetros:**
*   `ticker` (String): O código do ativo financeiro a ser processado (ex: "PETR4").
*   `ibovContext` (Object): Objeto contendo o contexto de mercado do índice Bovespa, utilizado para enriquecer a análise do ativo.

**Retorno:**
*   `rawResult` (Object|null): Retorna o objeto de resultado gerado pelo motor de análise (V10) ou `null` caso a execução falhe ou o motor não esteja disponível.

**Uso:** Atua como uma camada de abstração (Adapter) que prepara o ambiente de execução, tenta realizar uma busca de dados intradiários (MTF) e delega a lógica de negócio principal para o `EntryGeneratorV10`, garantindo que o contexto de mercado seja compartilhado entre as camadas.

---

## Função: `testarIntegracaoAvancada`
**Descrição:** Função de teste unitário para validar o fluxo de processamento de ativos financeiros através da integração entre o serviço de contexto de mercado e o adaptador de pipeline.

**Parâmetros:** 
* Nenhum (a função utiliza valores fixos definidos internamente para fins de teste).

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe o status da execução e os dados processados no console do Google Apps Script.

**Uso:** Utilizada para verificar a integridade da integração entre `DataService` e `PipelineAdapter`, validando se o motor de análise consegue processar um ticker específico (ex: 'VALE3') e retornar os indicadores de score e setup corretamente.

---

## Função: `testeUnitarioV10_ComDadosFalsos`
**Descrição:** Função de teste unitário projetada para validar o comportamento do motor `EntryGeneratorV10` através da injeção de dados de mercado simulados (mock data) configurados para disparar o setup "SUPER_MOMENTUM".

**Parâmetros:** 
* Não recebe parâmetros (função de execução direta).

**Retorno:** 
* `void`: A função não retorna valores, mas exibe logs no console do Google Apps Script indicando o sucesso ou falha da análise do motor V10.

**Uso:** 
* Utilizada durante o desenvolvimento para verificar se o motor de estratégia processa corretamente cenários de tendência de alta e se os indicadores técnicos injetados resultam na pontuação e classificação esperadas pelo algoritmo de entrada.

---

## Função: `EXECUTAR_STRESS_TEST_BEAR_MARKET`
**Descrição:** Função de teste automatizado (unitário) que simula um cenário de mercado em queda (*Bear Market*) para validar a eficácia dos filtros de risco do `PipelineAdapter`.

**Parâmetros:**
* Esta função não recebe parâmetros.

**Retorno:**
* `void`: A função não retorna valores, apenas registra o resultado da validação no console do Google Apps Script (`console.log`).

**Uso:**
* Utilizada durante o desenvolvimento e testes de regressão para garantir que o robô de trading interrompa operações ou reduza o *score* de ativos quando o contexto de mercado (`isRiskOn: false`) indicar um cenário de crise, prevenindo entradas em momentos de alta volatilidade ou queda livre.

---

## Função: `isSecretKeyName`
**Descrição:** Verifica se uma determinada chave (string) está presente na lista de nomes de chaves secretas permitidas ou definidas no sistema.

**Parâmetros:** 
* `key`: O valor a ser verificado (será convertido para string).

**Retorno:** 
* `Boolean`: Retorna `true` se a chave existir na constante `SECRET_KEY_NAMES`, caso contrário, retorna `false`.

**Uso:** Utilizada para validar se uma chave específica é considerada sensível ou restrita antes de realizar operações de leitura ou escrita em configurações de segurança.

---

## Função: `isDebugModeEnabled`
**Descrição:** Verifica se o modo de depuração está ativo no projeto através da leitura de propriedades de script.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Boolean`: Retorna `true` se a propriedade `DEBUG_MODE_OVERRIDE` ou `DEBUG_MODE` estiver definida como a string `'true'`, caso contrário, retorna `false`.

**Uso:** Utilizada para habilitar condicionalmente logs detalhados, testes ou comportamentos específicos de desenvolvimento sem alterar o código-fonte, bastando ajustar as propriedades do script no painel do Google Apps Script.

---

## Função: `isSecretEnforcementActive`
**Descrição:** Verifica se a imposição de gerenciamento de segredos está ativa no projeto através da leitura de uma propriedade de script.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Boolean`: Retorna `true` se a propriedade 'ENFORCE_SECRET_MANAGEMENT_OVERRIDE' estiver definida como 'true', caso contrário, retorna `false`.

**Uso:** Utilizada como uma trava de segurança (feature flag) para determinar se o sistema deve validar ou exigir o uso de segredos gerenciados externamente, retornando `false` por padrão em caso de erro na leitura das propriedades.

---

## Função: `assertWebAppAuthorized`
**Descrição:** Valida a identidade do usuário atual, garantindo que apenas o proprietário do script (ou o usuário efetivo) tenha permissão para executar a função.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `String`: O endereço de e-mail do usuário autenticado caso a validação seja bem-sucedida.

**Uso:** Deve ser invocada no início de funções críticas ou sensíveis para restringir o acesso exclusivamente ao proprietário do projeto Google Apps Script, lançando um erro caso o usuário não esteja autenticado ou não corresponda ao proprietário.

---

## Função: `ensureSheet`
**Descrição:** Verifica a existência de uma aba em uma planilha Google e a cria automaticamente caso ela ainda não exista.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): O objeto da planilha (Spreadsheet) onde a verificação será realizada.
* `name` (String): O nome da aba que deve ser garantida.

**Retorno:**
* (GoogleAppsScript.Spreadsheet.Sheet): O objeto da aba encontrada ou recém-criada.

**Uso:** Ideal para rotinas de configuração inicial ou automações que dependem de abas específicas, evitando erros de "aba não encontrada" ao tentar manipular dados.

---

## Função: `styleHeader`
**Descrição:** Aplica uma formatação visual padronizada (estilo B3 PRO) em um intervalo de células específico para cabeçalhos de planilhas.

**Parâmetros:**
* `range` (GoogleAppsScript.Spreadsheet.Range): O objeto de intervalo de células que receberá a formatação.

**Retorno:**
* `void`: A função não retorna valor, apenas aplica alterações diretamente no objeto de intervalo fornecido.

**Uso:** Utilize esta função para padronizar visualmente linhas ou colunas de cabeçalho, aplicando automaticamente negrito, fundo azul escuro, texto branco e alinhamento centralizado.

---

## Função: `setHeaders`
**Descrição:** Configura o cabeçalho de uma planilha Google, aplicando formatação e congelamento de linhas, com opção de reset forçado.

**Parâmetros:**
*   `sh` (GoogleAppsScript.Spreadsheet.Sheet): Objeto da aba (Sheet) onde os cabeçalhos serão inseridos.
*   `headers` (Array): Lista de strings contendo os nomes das colunas.
*   `opts` (Object, opcional): Objeto de configuração contendo `forceReset` (booleano para sobrescrever dados existentes) e `freeze` (inteiro para definir número de linhas congeladas).

**Retorno:** `void` (Não retorna valor).

**Uso:** Ideal para inicialização de planilhas ou rotinas de setup, garantindo que a estrutura de colunas esteja correta e formatada. Exemplo: `setHeaders(sheet, ["ID", "Nome", "Data"], { forceReset: true, freeze: 1 });`

---

## Função: `setupResumoTrades`
**Descrição:** Inicializa e configura a planilha "Resumo_Trades_Aprovados" com cabeçalhos padronizados e formatação específica de dados.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha (Spreadsheet) onde a aba será criada ou acessada.
* `opts` (Object): Objeto de opções contendo configurações adicionais para a função `setHeaders` (ex: estilo de formatação).

**Retorno:**
* `GoogleAppsScript.Spreadsheet.Sheet`: O objeto da aba (Sheet) configurada.

**Uso:** Utilizada durante a rotina de setup do sistema para garantir que a aba de resumo de trades exista, possua as colunas necessárias e esteja com as células formatadas corretamente para datas e valores monetários.

---

## Função: `setupRelatorioRebal`
**Descrição:** Inicializa e formata a planilha "Relatorio_Rebalanceamento" no Google Sheets, definindo cabeçalhos e máscaras de formatação para colunas específicas.

**Parâmetros:** 
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha ativa onde a aba será criada ou recuperada.
* `opts` (Object): Objeto de opções contendo configurações adicionais para a função `setHeaders` (ex: estilo de formatação).

**Retorno:** (GoogleAppsScript.Spreadsheet.Sheet) Retorna o objeto da planilha (Sheet) configurada.

**Uso:** Utilizada durante a configuração inicial do sistema para garantir que a aba de relatórios exista, possua os cabeçalhos padronizados e as colunas de data e valores estejam formatadas corretamente para exibição.

---

## Função: `setupLogPerformance`
**Descrição:** Inicializa a planilha "Log_Performance" com cabeçalhos padronizados e formatação de células específica para dados de operações financeiras.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha (Spreadsheet) onde a aba será criada ou recuperada.
* `opts` (Object): Objeto de opções contendo configurações adicionais para a função `setHeaders` (ex: estilo de formatação).

**Retorno:**
* `GoogleAppsScript.Spreadsheet.Sheet`: Retorna o objeto da aba "Log_Performance" configurada.

**Uso:** Utilizada durante a rotina de configuração inicial do sistema para garantir que a aba de registro de performance exista e possua a estrutura de colunas e formatos de exibição (datas, valores monetários e percentuais) corretos para o preenchimento de dados de trading.

---

## Função: `setupCarteira`
**Descrição:** Inicializa a aba 'Carteira' em uma planilha Google, configurando cabeçalhos padronizados e aplicando formatos numéricos específicos para colunas financeiras.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha onde a aba será criada ou verificada.
* `opts` (Object): Objeto contendo configurações adicionais para a formatação dos cabeçalhos (passado para a função `setHeaders`).

**Retorno:**
* `GoogleAppsScript.Spreadsheet.Sheet`: O objeto da aba 'Carteira' configurada.

**Uso:** Utilizada durante a rotina de configuração inicial do sistema para garantir que a aba de controle de investimentos possua a estrutura de colunas correta e a formatação de moeda e porcentagem aplicada automaticamente.

---

## Função: `setupConfiguracoes`
**Descrição:** Inicializa a planilha de "Configurações" no Google Sheets, definindo cabeçalhos padrão e populando valores iniciais caso a aba esteja vazia.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha ativa onde a configuração será criada.
* `opts` (Object): Objeto de opções de formatação ou configuração passadas para a função auxiliar `setHeaders`.

**Retorno:**
* `GoogleAppsScript.Spreadsheet.Sheet`: Retorna o objeto da planilha "Configurações" recém-criada ou recuperada.

**Uso:** Utilizada durante a rotina de instalação ou setup do sistema para garantir que a estrutura de parâmetros globais (como capital e limites de risco) exista e contenha valores padrão para o funcionamento do robô.

---

## Função: `setupDashboard`
**Descrição:** Inicializa ou redefine a planilha "Dashboard" com um layout estruturado contendo títulos, cards de resumo e áreas reservadas para gráficos.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha ativa onde o Dashboard será criado.
* `opts` (Object, opcional): Objeto de configuração contendo a propriedade `forceReset` (boolean) para forçar a recriação do layout.

**Retorno:**
* `GoogleAppsScript.Spreadsheet.Sheet`: Retorna o objeto da planilha "Dashboard" configurada.

**Uso:** Chamada durante a configuração inicial do sistema ou quando o usuário solicita a redefinição do layout do painel, garantindo que a estrutura visual básica esteja presente antes da inserção de dados dinâmicos.

---

## Função: `setupResultadosAnalise`
**Descrição:** Inicializa a planilha "Resultados_Analise" com a estrutura de cabeçalhos necessária para o registro de operações e análises técnicas.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha (Spreadsheet) onde a aba será criada ou verificada.
* `opts` (Object): Objeto de configuração contendo parâmetros adicionais para a formatação dos cabeçalhos (passado para a função `setHeaders`).

**Retorno:**
* `GoogleAppsScript.Spreadsheet.Sheet`: O objeto da aba "Resultados_Analise" configurada.

**Uso:** Utilizada durante a rotina de configuração inicial do sistema para garantir que a aba de resultados exista e contenha todas as colunas necessárias para o armazenamento de dados de análise de mercado.

---

## Função: `setupOportunidades`
**Descrição:** Inicializa a aba 'Oportunidades' em uma planilha Google, garantindo a existência da folha e configurando seu cabeçalho padrão.

**Parâmetros:** 
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha onde a aba será criada ou verificada.
* `opts` (Object): Objeto de opções de configuração (passado para a função `setHeaders`).

**Retorno:** (GoogleAppsScript.Spreadsheet.Sheet) O objeto da folha 'Oportunidades' configurada.

**Uso:** Utilizada durante a rotina de setup inicial do sistema para garantir que a estrutura de dados necessária para o registro de oportunidades de investimento esteja presente e formatada corretamente.

---

## Função: `setupLogs`
**Descrição:** Inicializa a aba 'Logs' em uma planilha Google, garantindo sua existência e configurando o cabeçalho padrão para registro de eventos.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha onde a aba será criada ou verificada.
* `opts` (Object): Objeto de opções de configuração passado para a função auxiliar `setHeaders`.

**Retorno:**
* `GoogleAppsScript.Spreadsheet.Sheet`: O objeto da aba 'Logs' configurada.

**Uso:** Utilizada durante a rotina de configuração inicial do sistema para preparar a estrutura de auditoria e rastreamento de logs, garantindo que a planilha contenha as colunas: 'Data/Hora', 'Nível', 'Origem' e 'Mensagem'.

---

## Função: `setupSimulation`
**Descrição:** Inicializa a planilha de controle de simulações criando ou garantindo a existência da aba "Simulacao_Ativa" com seus respectivos cabeçalhos.

**Parâmetros:** 
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha (Spreadsheet) onde a aba será criada ou acessada.
* `opts` (Object): Objeto de configurações adicionais para a formatação dos cabeçalhos (passado para a função `setHeaders`).

**Retorno:** (GoogleAppsScript.Spreadsheet.Sheet) O objeto da aba "Simulacao_Ativa" configurada.

**Uso:** Utilizada durante a etapa de configuração inicial do sistema para preparar a estrutura de dados necessária para o registro de novas operações de simulação.

---

## Função: `setupSimulationLog`
**Descrição:** Inicializa a planilha "Log_Simulado" no Google Sheets, garantindo sua existência e configurando o cabeçalho padrão para registro de operações.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha ativa onde o log será criado.
* `opts` (Object): Objeto de opções de configuração passado para a função auxiliar `setHeaders` (ex: formatação ou estilo).

**Retorno:** (GoogleAppsScript.Spreadsheet.Sheet) Retorna o objeto da planilha "Log_Simulado" após a configuração.

**Uso:** Utilizada durante a rotina de inicialização do sistema para preparar a estrutura de dados onde os resultados das simulações serão armazenados.

---

## Função: `createSheets`
**Descrição:** Inicializa e recria a estrutura completa de abas da planilha, garantindo a existência de todas as páginas necessárias para o funcionamento do sistema.

**Parâmetros:**
* `options` (Object, opcional): Objeto contendo configurações ou parâmetros de inicialização que são propagados para as funções de configuração de cada aba.

**Retorno:**
* `void`: A função não retorna valor, apenas executa as operações de manipulação de abas na planilha ativa.

**Uso:** Utilizada durante a configuração inicial ou reset do sistema para garantir que todas as abas principais (Dashboard, Carteira, Logs, Simulações, etc.) e auxiliares (Tickers, Portfolio, IRPF, DARF) estejam presentes e configuradas corretamente na planilha ativa.

---

## Função: `RODAR_SETUP_COMPLETO`
**Descrição:** Executa a inicialização completa da estrutura de planilhas do projeto, forçando a recriação de abas para corrigir erros ou estados inconsistentes.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valor, mas dispara uma notificação (toast) na interface do usuário.

**Uso:** Deve ser chamada para inicializar o ambiente de trabalho ou restaurar a integridade das abas do sistema caso ocorram erros de configuração ou ausência de dados.

---

## Função: `RECUPERAR_ABAS_PERDIDAS`
**Descrição:** Esta função restaura abas ausentes na planilha ativa através do método de recuperação do módulo `Bootstrap`, garantindo a integridade dos dados existentes.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valores, apenas executa uma ação de sistema e exibe uma notificação na interface.

**Uso:** Deve ser executada quando houver suspeita de exclusão acidental de abas essenciais do sistema; a função aciona `Bootstrap.rescue()` para recriar as estruturas faltantes sem sobrescrever ou apagar os dados contidos nas abas remanescentes.

---

## Função: `_getSheet`
**Descrição:** Obtém uma planilha específica pelo nome definido na configuração, criando-a com cabeçalhos formatados caso ela ainda não exista.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): O objeto da planilha (Spreadsheet) onde a busca será realizada.

**Retorno:**
* `GoogleAppsScript.Spreadsheet.Sheet`: O objeto da planilha encontrada ou recém-criada.

**Uso:** Utilizada internamente para garantir que a planilha de destino esteja disponível e corretamente estruturada antes de operações de escrita, evitando erros de referência.

---

## Função: `_opParaLinha`
**Descrição:** Converte um objeto de operação financeira em um array unidimensional formatado para inserção em uma linha de planilha Google.

**Parâmetros:**
* `op` (Object): Objeto contendo os dados da operação (ex: ticker, preço, indicadores, etc.). Pode ser nulo ou indefinido.

**Retorno:**
* `Array`: Um array contendo os valores extraídos do objeto `op`, ordenados conforme a estrutura de colunas da planilha, ou um array de strings vazias caso `op` seja nulo.

**Uso:** Utilizada como função auxiliar para padronizar a transformação de dados de objetos JSON para o formato de linha exigido pelos métodos `appendRow` ou `setValues` da API do Google Sheets, garantindo que colunas ausentes sejam preenchidas com valores padrão (0 ou string vazia).

---

## Função: `saveAnalysisResults`
**Descrição:** Atualiza a planilha de destino com uma lista de dados processados, realizando a limpeza de registros anteriores, inserção de novos dados e aplicação de formatação condicional.

**Parâmetros:**
* `listaCompleta` (Array): Uma lista de objetos contendo os dados que serão transformados em linhas e salvos na planilha.

**Retorno:**
* `void`: A função não retorna valores, apenas executa operações de escrita na planilha e logs no console.

**Uso:** Deve ser chamada após o processamento de dados para persistir os resultados na aba definida em `CONFIG.SHEET_NAME`. A função limpa automaticamente os dados existentes (mantendo o cabeçalho), mapeia os objetos para o formato de linha via `_opParaLinha`, aplica máscaras de moeda/data e ajusta o tamanho das colunas.

---

## Função: `clearSheet`
**Descrição:** Limpa o conteúdo das linhas de dados de uma planilha específica, preservando a linha de cabeçalho.

**Parâmetros:** 
* Nenhum (a função utiliza variáveis globais `CONFIG.SHEET_NAME` e `CONFIG.HEADERS`).

**Retorno:** 
* `void`: Não retorna valor, apenas executa a limpeza ou registra logs de status/erro no console.

**Uso:** Deve ser chamada sempre que for necessário resetar os dados da planilha antes de uma nova operação de escrita, garantindo que apenas a primeira linha (cabeçalhos) permaneça intacta.

---

## Função: `clearLogs`
**Descrição:** Remove todos os registros da aba 'Logs' da planilha ativa, preservando apenas a linha de cabeçalho.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa a limpeza dos dados.

**Uso:** 
* Deve ser chamada para realizar a manutenção periódica da planilha de logs, evitando o acúmulo excessivo de dados. A função utiliza `deleteRows` para remover as linhas fisicamente ou `clearContent` como alternativa de segurança caso a exclusão falhe.

---

## Função: `runDiagnostics`
**Descrição:** Executa uma rotina de diagnóstico técnico para validar a integridade do ambiente, configurações de mercado e conectividade de serviços externos no Google Apps Script.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas registra informações detalhadas no log de execução (`Logger`).

**Uso:** 
* Deve ser executada manualmente via editor de script ou console para verificar se as propriedades de script (API Keys, tokens), o cache de configurações e a conexão com a API do Yahoo Finance estão operacionais antes de iniciar processos automatizados.

---

## Função: `monitorarRateLimits`
**Descrição:** Função de diagnóstico que exibe no console o status atual de consumo e disponibilidade de tokens de todas as instâncias gerenciadas pelo `RateLimiter`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas imprime logs no console do Google Apps Script.

**Uso:** Utilizada para depuração e monitoramento em tempo real, permitindo identificar se o sistema está atingindo limites de requisições ou se há gargalos na execução de processos que dependem de controle de fluxo. (Nota: Atualmente encontra-se comentada no código-fonte).

---

## Função: `diagnosticoCompleto`
**Descrição:** Realiza uma auditoria técnica do ambiente de execução, validando a integridade da planilha ativa, a existência de abas obrigatórias e o estado atual das configurações do módulo `CONFIG`.

**Parâmetros:**
* Nenhum.

**Retorno:**
* `void`: A função não retorna valores, apenas exibe logs detalhados no console do Google Apps Script para fins de depuração.

**Uso:**
* Deve ser executada manualmente via editor de código ou acionada durante a inicialização do sistema para verificar se a estrutura da planilha está correta e se as variáveis globais de configuração estão carregadas e acessíveis, facilitando a identificação de erros de configuração ou ausência de abas necessárias.

---

## Função: `_wrapRange`
**Descrição:** Cria um proxy para objetos `Range` do Google Apps Script que intercepta chamadas de métodos para registrar automaticamente o consumo de cota de acesso à planilha.

**Parâmetros:**
* `range` (GoogleAppsScript.Spreadsheet.Range): O objeto de intervalo da planilha que será encapsulado pelo proxy.

**Retorno:**
* `Proxy`: Um objeto proxy que espelha o `range` original, mas injeta a chamada `QuotaTracker.recordSheetAccess()` antes de qualquer execução de método.

**Uso:** Utilizado para monitorar e limitar o uso de chamadas de API em scripts que manipulam grandes volumes de dados, garantindo que cada interação com o intervalo seja contabilizada pelo rastreador de cotas.

---

## Função: `_wrapSheet`
**Descrição:** Implementa um proxy para objetos `Sheet` do Google Apps Script, interceptando chamadas de métodos específicos para registrar o consumo de cota e encapsular automaticamente os resultados retornados.

**Parâmetros:**
* `sheet` (GoogleAppsScript.Spreadsheet.Sheet): O objeto de planilha original que será monitorado e encapsulado.

**Retorno:**
* (Proxy): Um objeto Proxy que espelha a interface do objeto `Sheet` original, com interceptação nos métodos `getRange`, `getDataRange` e `getSheetByName`.

**Uso:** Utilizada para monitorar o uso da API de planilhas através da classe `QuotaTracker`, garantindo que toda vez que um intervalo ou planilha for acessado, a contagem de chamadas seja registrada e o objeto retornado receba o encapsulamento necessário para rastreamento contínuo.

---

## Função: `_wrapSpreadsheet`
**Descrição:** Cria um proxy para objetos `Spreadsheet` do Google Apps Script, interceptando métodos de acesso a dados para registrar o consumo de cota e encapsular automaticamente os objetos retornados.

**Parâmetros:**
* `spreadsheet` (GoogleAppsScript.Spreadsheet.Spreadsheet): O objeto da planilha que será envolvido pelo proxy.

**Retorno:**
* (Proxy): Um objeto proxy que espelha a interface original da planilha, com interceptadores adicionais para monitoramento de cota.

**Uso:** Envolve uma instância de planilha para garantir que toda vez que `getSheetByName`, `getSheets` ou `getDataRange` forem chamados, o `QuotaTracker` registre o acesso e o objeto resultante seja automaticamente encapsulado em um wrapper correspondente (`_wrapSheet` ou `_wrapRange`).

---

## Função: `QUOTA_TRACKER_REPORT`
**Descrição:** Recupera e registra no console o relatório de consumo de cotas do serviço `QuotaTracker`, caso este esteja disponível no escopo da aplicação.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Object|null`: Retorna o objeto contendo os dados do relatório de cotas se o `QuotaTracker` estiver definido, ou `null` caso contrário.

**Uso:** Utilizada para monitoramento e depuração, permitindo visualizar o status atual das cotas do Google Apps Script diretamente nos logs de execução.

---

## Função: `parseNumberBR_`
**Descrição:** Converte valores de entrada (strings ou números) no formato brasileiro para um tipo numérico padrão (`float`) do JavaScript.

**Parâmetros:** 
* `v` (any): O valor a ser convertido, podendo ser string, número ou nulo.

**Retorno:** 
* `number`: O valor numérico convertido ou `0` caso a conversão falhe ou o valor seja nulo/vazio.

**Uso:** Ideal para tratar dados provenientes de planilhas ou formulários que utilizam vírgula como separador decimal, garantindo que o valor seja processável em cálculos matemáticos.

---

## Função: `formatBRL_`
**Descrição:** Formata um valor numérico como uma string de moeda brasileira (BRL), garantindo duas casas decimais e o prefixo "R$".

**Parâmetros:** 
* `n` (Number|String): O valor numérico ou representação em string a ser formatado.

**Retorno:** 
* `String`: O valor formatado no padrão monetário brasileiro (ex: "R$ 1.234,56").

**Uso:** Ideal para exibir valores financeiros em relatórios ou interfaces, tratando automaticamente entradas inválidas ou nulas como zero.

---

## Função: `diagnosticarResumo`
**Descrição:** Realiza uma verificação de integridade do módulo `AgenticRanker`, validando a carga das configurações e a execução do processamento de trades.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* Objeto (JSON): Contém o status da operação ("OK"), o capital configurado, a porcentagem de risco definida e o total de trades processados.

**Uso:** Utilizada para diagnóstico rápido ou monitoramento do estado atual do motor de rankeamento, permitindo confirmar se as configurações estão carregadas e se o processamento de trades está operacional.

---

## Função: `avaliarRompimentoSeguro`
**Descrição:** Avalia a qualidade de um sinal de rompimento de preço com base em indicadores técnicos de volume e momentum (MACD) para classificar a confiabilidade da operação.

**Parâmetros:**
*   `precoAtual` (Number): O valor atual do ativo.
*   `bandaSuperior` (Number): O valor da resistência ou banda superior (ex: Bandas de Bollinger).
*   `volumeAtual` (Number): O volume de negociação no período atual.
*   `volumeMedio20` (Number): A média móvel de volume dos últimos 20 períodos.
*   `macdHistograma` (Number): O valor atual do histograma do indicador MACD.

**Retorno:** (Object) Um objeto contendo `tagFinal` (string), `alerta` (string) e `corFundo` (string hexadecimal), representando o status da análise (Validação, Pré-rompimento ou Falso Rompimento).

**Uso:** Utilizada em sistemas de trading automatizado ou planilhas de monitoramento para filtrar sinais de rompimento, evitando entradas falsas quando o volume está abaixo de 120% da média ou o MACD indica falta de força compradora.

---

## Função: `parseValue`
**Descrição:** Converte valores de entrada em tipos de dados nativos (booleano, numérico ou objeto JSON) quando representados como strings, mantendo o valor original caso a conversão não seja possível.

**Parâmetros:**
* `value` (Any): O valor a ser analisado e convertido.

**Retorno:**
* (Any): O valor convertido para `Boolean`, `Number`, `Object/Array` (via JSON) ou o próprio valor original caso não se enquadre nas regras de conversão.

**Uso:** Ideal para processar configurações ou dados provenientes de planilhas e formulários que chegam como texto, mas que representam tipos de dados estruturados.

---

## Função: `readSheetConfig`
**Descrição:** Lê uma planilha de configuração e converte seus dados em um objeto chave-valor para fácil acesso no script.

**Parâmetros:** 
* Nenhuma entrada direta (utiliza a constante global `NOME_ABA`).

**Retorno:** 
* `Object`: Um objeto contendo as chaves (coluna A) e seus respectivos valores processados (coluna B).

**Uso:** 
* Ideal para carregar configurações, parâmetros ou variáveis de ambiente armazenadas em uma aba específica da planilha, ignorando o cabeçalho e linhas vazias na primeira coluna.

---

## Função: `getCachedConfig`
**Descrição:** Recupera uma configuração armazenada em cache utilizando uma chave global, com tratamento de erros para fallback.

**Parâmetros:** 
* Nenhum (utiliza a variável global `CACHE_KEY` e o objeto `Cache` do escopo).

**Retorno:** 
* `Object|null`: Retorna o objeto de configuração caso encontrado no cache; caso contrário, retorna `null`.

**Uso:** Utilizada para otimizar a performance da aplicação, evitando chamadas repetitivas a fontes de dados externas ou cálculos pesados ao buscar configurações previamente armazenadas.

---

## Função: `putCachedConfig`
**Descrição:** Armazena um conjunto de configurações no cache do Google Apps Script com um tempo de expiração definido.

**Parâmetros:**
* `configMap` (Object/String): O objeto ou valor contendo as configurações que serão armazenadas no cache.

**Retorno:**
* `void`: A função não retorna valores; em caso de falha, o erro é capturado e registrado no console.

**Uso:** Utilizada para persistir temporariamente dados de configuração (`CONFIG`) no cache por 6 horas (21.600 segundos), otimizando a performance ao evitar leituras repetidas de fontes externas ou propriedades de script.

---

## Função: `isEnforcementActive`
**Descrição:** Verifica se o modo de imposição de segurança está ativo, priorizando uma função de verificação personalizada antes de consultar as propriedades do script.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Boolean`: Retorna `true` se a imposição estiver ativa (via função delegada ou configuração de propriedade) e `false` caso contrário.

**Uso:** Utilizada como uma camada de abstração para validar se restrições de segurança devem ser aplicadas, permitindo um "override" (substituição) manual através das propriedades do script caso a função `isSecretEnforcementActive` não esteja definida.

---

## Função: `isBlockedSheetSecret`
**Descrição:** Verifica se uma chave específica está bloqueada para acesso com base na ativação da política de segurança e na validação da nomenclatura da chave.

**Parâmetros:**
* `key` (String): O identificador ou nome da chave que se deseja verificar.

**Retorno:**
* `Boolean`: Retorna `true` se a proteção estiver ativa e a chave for considerada secreta/bloqueada; caso contrário, retorna `false`.

**Uso:** Utilizada como uma camada de segurança em funções que manipulam dados sensíveis, garantindo que chaves protegidas não sejam expostas ou processadas indevidamente quando o sistema de bloqueio estiver habilitado.

---

## Função: `readSecretFromProviders`
**Descrição:** Recupera valores de configuração ou segredos de forma hierárquica, priorizando um provedor externo (`Secrets`) e recorrendo ao `PropertiesService` do Google Apps Script como fallback.

**Parâmetros:**
* `key` (String): A chave identificadora do segredo ou propriedade a ser buscada.

**Retorno:**
* `String|Any|null`: Retorna o valor recuperado (processado pela função `parseValue` se vier do `PropertiesService`) ou `null` caso a chave não seja encontrada em nenhuma das fontes.

**Uso:** Utilize esta função para centralizar a leitura de credenciais ou configurações sensíveis, permitindo que o sistema tente buscar dados em um serviço de gerenciamento de segredos antes de consultar as propriedades nativas do script.

---

## Função: `_addBuffer`
**Descrição:** Adiciona uma nova entrada de log ao buffer global de memória (_logBuffer) contendo o registro temporal, nível, módulo e a mensagem especificada.

**Parâmetros:**
* `level` (String/Number): Define a severidade ou categoria do log (ex: 'INFO', 'ERROR').
* `modulo` (String): Identifica o componente ou função de origem do log.
* `mensagem` (String): O conteúdo descritivo do evento a ser registrado.

**Retorno:**
* `void`: Esta função não retorna valores, apenas altera o estado da variável global `_logBuffer`.

**Uso:** Utilizada internamente pelo sistema de logging para acumular registros em memória antes de realizar uma operação de escrita em lote (flush), otimizando o desempenho ao reduzir chamadas de I/O.

---

## Função: `info`
**Descrição:** Registra uma mensagem de nível informativo no buffer de log do sistema.

**Parâmetros:**
* `modulo` (String): Identificador do módulo ou componente de origem da mensagem.
* `mensagem` (String): O conteúdo textual da informação a ser registrada.

**Retorno:** `void` (Não retorna valor).

**Uso:** Utilizada para documentar o fluxo normal de execução do sistema, auxiliando no rastreamento de operações bem-sucedidas através da função interna `_addBuffer`.

---

## Função: `warn`
**Descrição:** Registra uma mensagem de aviso (nível WARN) no buffer de log do sistema.

**Parâmetros:**
* `modulo` (String): Identificador do módulo ou serviço que originou o aviso.
* `mensagem` (String): O conteúdo descritivo do aviso a ser registrado.

**Retorno:** `void` (Não retorna valor).

**Uso:** Utilizada para capturar eventos de atenção ou comportamentos inesperados que não interrompem a execução do script, enviando-os para a fila de processamento do logger através da função interna `_addBuffer`.

---

## Função: `error`
**Descrição:** Registra uma mensagem de erro no buffer de log e força a persistência imediata dos dados armazenados.

**Parâmetros:**
* `modulo` (String): Identificador do módulo ou componente onde o erro ocorreu.
* `mensagem` (String): Descrição detalhada do erro ou exceção capturada.

**Retorno:** `void` (Não retorna valor).

**Uso:** Deve ser utilizada em blocos `catch` ou verificações de falhas críticas para garantir que o log seja gravado no destino final (ex: planilha ou banco de dados) sem aguardar o processamento em lote.

---

## Função: `debug`
**Descrição:** Registra uma mensagem de nível "DEBUG" no buffer de logs do sistema através da função auxiliar `_addBuffer`.

**Parâmetros:** 
* `modulo` (String): Identificador do módulo ou componente de origem da mensagem.
* `mensagem` (String): O conteúdo informativo ou técnico a ser registrado.

**Retorno:** `void` (Não retorna valor).

**Uso:** Deve ser utilizada durante o desenvolvimento ou manutenção para rastrear o fluxo de execução e estados internos de funções específicas, enviando os dados para o buffer centralizado de logs.

---

## Função: `flush`
**Descrição:** Persiste os registros acumulados no buffer de memória (`_logBuffer`) para uma planilha Google, realizando a manutenção automática do limite de linhas definido.

**Parâmetros:**
* Esta função não recebe parâmetros (utiliza variáveis de escopo global como `_logBuffer`, `SHEET_NAME` e `MAX_LOGS_RETENTION`).

**Retorno:**
* `void`: Não retorna valor, apenas executa a operação de escrita e limpeza.

**Uso:**
Deve ser chamada ao final do processamento ou periodicamente para descarregar os logs acumulados na memória para a aba de destino. A função verifica a existência da aba, insere os dados em lote (otimizando a performance com `setValues`) e remove registros antigos caso o limite `MAX_LOGS_RETENTION` seja excedido.

---

## Função: `LIMPAR_CACHE_COMPLETO`
**Descrição:** Executa a limpeza total de todos os dados armazenados no serviço de cache da aplicação.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna nenhum valor.

**Uso:** Deve ser utilizada para resetar o estado do cache global, sendo útil em cenários de manutenção, atualização de configurações ou quando se deseja forçar a revalidação de dados em uma próxima execução.

---

## Função: `VERIFICAR_STATUS_CACHE`
**Descrição:** Exibe um alerta na interface do Google Sheets contendo as métricas atuais de desempenho e estado do sistema de cache.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas dispara uma janela de alerta (UI) no navegador.

**Uso:** Utilizada para monitoramento rápido e diagnóstico, permitindo que o usuário visualize o status operacional, a contagem de itens armazenados e a versão do sistema de cache diretamente na planilha.

---

## Função: `_getCacheService`
**Descrição:** Obtém uma instância do serviço de cache do script (ScriptCache) de forma segura, verificando a disponibilidade do ambiente.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Cache` ou `null`: Retorna o objeto `Cache` do Google Apps Script se disponível, ou `null` caso o serviço não possa ser acessado.

**Uso:** Utilizada internamente para implementar camadas de cache em operações de leitura frequente, garantindo que o código não falhe caso seja executado em ambientes onde o `CacheService` não esteja disponível.

---

## Função: `_normalizeCandles`
**Descrição:** Normaliza diferentes formatos de entrada de dados de candles, extraindo um array limpo e filtrado de valores válidos.

**Parâmetros:**
* `rawCandles` (Object|Array): O conjunto de dados bruto contendo candles, que pode ser um array direto ou um objeto contendo uma propriedade `candles`.

**Retorno:**
* `Array|null`: Retorna um array contendo apenas os elementos truthy (não nulos/indefinidos) ou `null` caso a entrada seja inválida.

**Uso:** Utilizada para padronizar a estrutura de dados de candles antes do processamento, garantindo que o sistema receba sempre um array limpo, independentemente de a API retornar o dado diretamente ou encapsulado em um objeto.

---

## Função: `_hasMinimumCandles`
**Descrição:** Valida se um conjunto de dados de velas (candles) atende aos requisitos mínimos de quantidade e integridade dos valores de fechamento.

**Parâmetros:**
* `candles` (Array): Uma lista de objetos representando candles, onde cada objeto deve conter, no mínimo, uma propriedade `close` numérica.

**Retorno:**
* `Boolean`: Retorna `true` se o array for válido, contiver a quantidade mínima definida em `MIN_CANDLES` e possuir pelo menos um candle com valor de fechamento positivo; caso contrário, retorna `false`.

**Uso:** Utilizada como uma camada de validação de dados antes de processar indicadores técnicos ou estratégias de trading, garantindo que o conjunto de dados não esteja vazio ou corrompido.

---

## Função: `_hasPriceCandidate`
**Descrição:** Verifica se um array de objetos de candle contém pelo menos um elemento válido com um valor de fechamento (close) positivo.

**Parâmetros:**
* `candles` (Array): Uma lista de objetos representando candles, onde cada objeto deve possuir uma propriedade `close` numérica.

**Retorno:**
* `Boolean`: Retorna `true` se o array for válido e contiver pelo menos um candle com `close > 0`; caso contrário, retorna `false`.

**Uso:** Utilizada para validar a integridade dos dados de mercado antes de realizar cálculos financeiros, garantindo que o conjunto de dados não esteja vazio ou corrompido.

---

## Função: `_getLastPrice`
**Descrição:** Esta função percorre um array de objetos de candles (velas) de trás para frente para retornar o valor de fechamento (close) mais recente que seja um número válido e positivo.

**Parâmetros:**
* `candles` (Array): Uma lista de objetos representando candles, onde cada objeto deve conter uma propriedade `close` (numérica).

**Retorno:**
* `Number|null`: Retorna o valor numérico do preço de fechamento do último candle válido encontrado, ou `null` caso o array esteja vazio, inválido ou não contenha valores positivos.

**Uso:** Utilizada para obter o preço atual ou o último preço de fechamento disponível em uma série histórica de dados financeiros, garantindo a integridade dos dados ao ignorar valores nulos ou inválidos.

---

## Função: `_buildResult`
**Descrição:** Processa e estrutura dados brutos de candles financeiros, adicionando metadados de identificação e o preço atual.

**Parâmetros:**
* `ticker` (String): O símbolo ou código do ativo financeiro.
* `candles` (Array): Conjunto de dados brutos de velas (OHLC) a serem processados.
* `source` (String, opcional): A origem ou provedor dos dados (padrão: 'UNKNOWN').

**Retorno:** (Object/Array) Um objeto estendido contendo o array de candles normalizados, o preço de fechamento mais recente, o ticker e a fonte, ou `null` se a normalização falhar.

**Uso:** Utilizada na camada de serviço para formatar e enriquecer os dados de mercado antes de serem consumidos pela interface ou por outras funções de análise.

---

## Função: `_tryBrapiHistory`
**Descrição:** Tenta recuperar o histórico de cotações de um ativo específico utilizando o serviço externo `BrapiFetcher`, com tratamento de erros e validação de existência do serviço.

**Parâmetros:**
* `ticker` (String): O código do ativo (ex: "PETR4", "AAPL34") a ser consultado.

**Retorno:**
* `Object|null`: Retorna os dados do histórico caso a requisição seja bem-sucedida, ou `null` caso o serviço esteja indisponível, ocorra um erro ou não haja dados para o ticker.

**Uso:** Utilizada como uma camada de abstração segura para buscar dados históricos, garantindo que a aplicação não interrompa sua execução caso a API da Brapi falhe ou o serviço não esteja carregado.

---

## Função: `_tryAlphaVantageHistory`
**Descrição:** Tenta recuperar o histórico de preços diários de um ativo através do serviço externo AlphaVantageFetcher, validando a integridade dos dados recebidos.

**Parâmetros:**
* `ticker` (String): O símbolo do ativo financeiro (ex: 'PETR4.SA', 'AAPL') a ser consultado.

**Retorno:**
* `Array|null`: Retorna um array de objetos contendo os dados históricos se a requisição for bem-sucedida e contiver pelo menos 18 registros; caso contrário, retorna `null`.

**Uso:** Utilizada internamente como uma camada de abstração para buscar dados de mercado, garantindo que o sistema apenas processe respostas válidas e trate falhas de conexão ou ausência do serviço de forma silenciosa.

---

## Função: `_tryFinnhubHistory`
**Descrição:** Tenta recuperar o histórico de preços diários de um ativo através do serviço Finnhub, validando a disponibilidade da API e a integridade mínima dos dados retornados.

**Parâmetros:**
* `ticker` (String): O símbolo do ativo financeiro (ex: 'AAPL', 'PETR4.SA') a ser consultado.

**Retorno:**
* `Array|null`: Retorna um array contendo os dados históricos (candles) caso a requisição seja bem-sucedida e atenda ao critério de tamanho mínimo; retorna `null` em caso de erro, indisponibilidade do serviço ou dados insuficientes.

**Uso:** Utilizada como uma camada de abstração para busca de dados históricos, garantindo que o sistema apenas processe séries temporais com volume de dados suficiente (mínimo de 18 candles) para análises subsequentes.

---

## Função: `_tryRapidAPIYahooHistory`
**Descrição:** Tenta recuperar dados históricos de mercado de um ticker específico utilizando o serviço externo `RapidAPIYahooFetcher`, com validação de integridade dos dados retornados.

**Parâmetros:**
* `ticker` (String): O símbolo do ativo financeiro (ex: "PETR4.SA").
* `interval` (String): O intervalo de tempo entre os candles (ex: "1d", "1h").
* `range` (String): O período total de histórico desejado (ex: "1mo", "1y").

**Retorno:**
* `Array|null`: Retorna um array de objetos contendo os dados históricos se a requisição for bem-sucedida e contiver pelo menos 18 registros; caso contrário, retorna `null`.

**Uso:** Utilizada como uma camada de abstração de dados para buscar cotações históricas, garantindo que o sistema apenas processe respostas válidas da API e tratando falhas de conexão ou erros de execução de forma silenciosa.

---

## Função: `getMarketData`
**Descrição:** Recupera dados históricos de mercado (candles) para um ticker específico, utilizando uma estratégia de múltiplas camadas de cache e redundância de fontes para otimizar performance e resiliência.

**Parâmetros:**
*   `ticker` (String): O símbolo do ativo financeiro (ex: 'PETR4.SA').
*   `interval` (String, opcional): O intervalo de tempo dos dados (padrão: '1d').
*   `range` (String, opcional): O período de abrangência dos dados (padrão: '6mo').

**Retorno:** (Object|null) Retorna um objeto estruturado contendo os dados normalizados do ativo ou `null` caso a requisição falhe ou o ticker esteja em estado de bloqueio temporário.

**Uso:** Esta função atua como a camada principal de acesso a dados do sistema. Ela verifica primeiro o cache local (memória), depois o `CacheService` do Google Apps Script e, por fim, consome APIs externas (como a BRAPI), implementando mecanismos de *Circuit Breaker* e controle de falhas para evitar chamadas desnecessárias a serviços indisponíveis.

---

## Função: `getMarketContext`
**Descrição:** Recupera dados de mercado (IBOV, Dólar e regime macroeconômico) para uso em análises financeiras ou automações.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* Objeto (JSON): Contém as propriedades `ibov` (close, change), `dolar` (close), `regime` (string) e `timestamp` (ISO string).

**Uso:** 
* Utilizada para centralizar a obtenção de variáveis de mercado; a função tenta integrar-se ao serviço `MacroFetcher` para definir o regime econômico atual, revertendo para 'NEUTRAL' em caso de falha ou indisponibilidade.

---

## Função: `getPrecosAtuaisEmLote`
**Descrição:** Obtém cotações atuais de múltiplos ativos financeiros em lote, utilizando uma estratégia de fallback entre múltiplos provedores de dados (BRAPI, RapidAPI-Yahoo e HG Brasil).

**Parâmetros:**
* `tickersArray` (Array): Lista de strings contendo os símbolos (tickers) dos ativos financeiros a serem consultados.

**Retorno:**
* `Object`: Um objeto onde as chaves são os tickers e os valores são objetos contendo as informações de cotação (incluindo o preço) para cada ativo encontrado.

**Uso:** A função é ideal para otimizar chamadas de API em planilhas ou sistemas que precisam atualizar diversos ativos simultaneamente, garantindo resiliência ao tentar provedores secundários caso o principal falhe ou não retorne dados para determinados ativos.

---

## Função: `getPrecoAtual`
**Descrição:** Recupera o preço atual e indicadores financeiros de um ativo financeiro utilizando múltiplas fontes de dados (BRAPI e RapidAPI-Yahoo) com tratamento de erros.

**Parâmetros:**
* `ticker` (String): O código do ativo (ex: "PETR4.SA" ou "PETR4").

**Retorno:**
* `Object` ou `null`: Retorna um objeto contendo `price`, `timestamp`, `source`, `ticker` e indicadores adicionais (como `pl`, `dy`, `volume`, `change`) caso a requisição seja bem-sucedida; retorna `null` se o ticker for inválido ou se todas as fontes falharem.

**Uso:**
A função sanitiza o ticker, tenta realizar a consulta primária via BRAPI (requer token configurado) e, em caso de falha ou indisponibilidade, recorre automaticamente ao `RapidAPIYahooFetcher` como alternativa, garantindo resiliência na obtenção de dados de mercado.

---

## Função: `obterDados`
**Descrição:** Função intermediária que atua como um wrapper para recuperar dados de mercado de um ativo financeiro específico.

**Parâmetros:**
* `ticker` (String): O símbolo ou código do ativo financeiro (ex: "PETR4.SA").
* `interval` (String): O intervalo de tempo entre os dados (ex: "1d", "1h").
* `range` (String): O período total de abrangência dos dados (ex: "1mo", "1y").

**Retorno:**
* (Object/Array): Retorna uma estrutura de dados (geralmente um objeto ou array de objetos) contendo as informações históricas ou atuais do mercado conforme processado pela função `getMarketData`.

**Uso:** Utilizada para abstrair a chamada da função principal `getMarketData`, permitindo a obtenção de séries temporais ou cotações de ativos dentro de projetos Google Apps Script.

---

## Função: `VERIFICAR_M1_FALLBACK`
**Descrição:** Realiza um diagnóstico de integridade do objeto `DataService` e da disponibilidade do `BrapiFetcher`, validando métodos essenciais e a conectividade com a API de mercado.

**Parâmetros:**
* Nenhum.

**Retorno:**
* `void`: A função não retorna valores, mas exibe os resultados via `console.log` e, se disponível, através de um alerta na interface do Google Sheets.

**Uso:**
* Deve ser executada manualmente ou via gatilho para verificar se os serviços de dados estão configurados corretamente e se a API (ex: Brapi) está retornando dados válidos (ex: candles de PETR4) antes de iniciar operações críticas de processamento de mercado.

---

## Função: `TESTAR_PRECO_AO_VIVO`
**Descrição:** Função de teste para validar a integração e a recuperação de dados de cotação em tempo real para um ativo específico.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe o resultado da operação no console do Google Apps Script.

**Uso:** Executada manualmente para verificar se o serviço `DataService` está operando corretamente e se a API de preços está retornando dados válidos para o ticker 'PETR4'.

---

## Função: `TESTAR_BRAPI`
**Descrição:** Realiza uma chamada de teste à API da BRAPI para validar a autenticação via token e verificar a conectividade através da consulta de dados da ação PETR4.

**Parâmetros:** 
* Nenhum (a função busca o token internamente através do objeto global `CONFIG`).

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe o status da conexão e dados financeiros (preço, P/L e DY) no console do Google Apps Script.

**Uso:** Deve ser executada manualmente ou via depurador para confirmar se o `BRAPI_TOKEN` está configurado corretamente e se a integração com o serviço externo está operacional.

---

## Função: `TESTAR_DEEPSEEK`
**Descrição:** Função de teste para validar a integração e o processamento de respostas em formato JSON através do conector DeepSeek.

**Parâmetros:** 
* Nenhum (a função utiliza valores fixos internos para o teste).

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe o resultado da requisição no console do Google Apps Script.

**Uso:** Executada manualmente para verificar a conectividade com a API do DeepSeek e garantir que o modo JSON está sendo interpretado corretamente pelo serviço.

---

## Função: `TESTAR_DEEPSEEK_ISOLADO`
**Descrição:** Função de teste unitário para validar a conectividade e o processamento de respostas da API DeepSeek através do módulo `AI_Connector`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas registra o resultado da requisição no console do Google Apps Script.

**Uso:** Executada manualmente para verificar se a integração com o DeepSeek está operacional, utilizando o modo JSON para validar a capacidade de estruturação de dados da API.

---

## Função: `TESTAR_CONEXAO_DEEPSEEK`
**Descrição:** Realiza uma requisição de teste à API do DeepSeek para verificar a validade da chave de API e a conectividade com o endpoint de listagem de modelos.

**Parâmetros:** 
* Nenhum (a função busca a chave de API internamente através do objeto global `CONFIG`).

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe o código de status HTTP e o conteúdo da resposta no console do Google Apps Script.

**Uso:** Deve ser executada manualmente via editor de script ou chamada durante a depuração para validar se as credenciais configuradas no `CONFIG` estão corretas e se o serviço do DeepSeek está acessível.

---

## Função: `TESTAR_FALLBACK`
**Descrição:** Função de teste projetada para validar o mecanismo de tratamento de erros e fallback do conector de IA ao forçar uma falha na requisição.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valor, apenas registra o resultado da operação no console do Google Apps Script.

**Uso:** Utilizada durante o desenvolvimento e depuração para verificar se o sistema `AI_Connector` lida corretamente com modelos inválidos, garantindo que o fallback seja acionado conforme esperado ao receber um erro da API.

---

## Função: `getEnhancedScore`
**Descrição:** Calcula uma pontuação consolidada de análise através de um sistema de pesos que combina uma avaliação técnica prévia com um modelo de ensemble (IA).

**Parâmetros:**
* `originalAnalysis` (Object): Objeto contendo a pontuação original (`score`) e metadados da análise inicial.

**Retorno:** (Object) Objeto contendo a pontuação final ponderada (`finalScore`), a confiança, o sentimento, a justificativa e as fontes utilizadas na análise.

**Uso:** Utilizada para refinar a precisão de uma avaliação inicial, aplicando um peso de 70% para a análise do ensemble e 30% para a pontuação técnica original, garantindo um resultado mais robusto.

---

## Função: `analyzeWithEnsemble`
**Descrição:** Realiza uma análise híbrida de ativos financeiros combinando indicadores técnicos quantitativos com a avaliação qualitativa da API Gemini para gerar um score de decisão consolidado.

**Parâmetros:**
*   `technicalData` (Object): Objeto contendo os dados do ativo, incluindo:
    *   `ticker` (String): Identificador do ativo (obrigatório).
    *   `indicators` (Object): Objeto opcional com `rsi`, `adx`, `volumeRelativo` e `bollinger` (upper, middle, lower).
    *   `price` (Number): Preço atual do ativo.
    *   `score` (Number): Pontuação técnica base (0-100).
    *   `setup` (String): Descrição do setup operacional.
    *   `isWeeklyBullish` (Boolean): Indicador de tendência semanal.

**Retorno:**
*   `Object`: Retorna um objeto contendo `score` (pontuação final ponderada), `confidence` (nível de confiança), `sentiment` (análise de sentimento) e `sources` (detalhamento das pontuações técnica e da IA).

**Uso:**
Utilizada como orquestrador de decisão para validar sinais de trading. A função normaliza os dados técnicos recebidos, consulta o modelo Gemini (`_getGeminiAnalysis`) e aplica um peso de 50% para a análise técnica e 50% para a análise da IA, garantindo um fallback técnico caso a API externa falhe.

---

## Função: `getEnhancedScoresBatch`
**Descrição:** Processa um lote de ativos financeiros aplicando enriquecimento de dados via IA para cada item, com tratamento de erros integrado para garantir a continuidade do fluxo.

**Parâmetros:**
* `lista` (Array de Objetos): Uma coleção de ativos (objetos) que devem conter, no mínimo, a propriedade `ticker` e, opcionalmente, um `score` base.

**Retorno:**
* `Array de Objetos`: Retorna uma nova lista contendo os dados originais de cada ativo acrescidos dos campos de análise: `enrichedScore`, `ensembleScore`, `aiConfidence`, `sentiment`, `aiRationale` e `sources`.

**Uso:** Utilizada pelo orquestrador do sistema para processar múltiplos ativos simultaneamente, delegando a análise individual para a função `getEnhancedScore` e aplicando valores padrão de segurança caso ocorra alguma falha na execução da IA.

---

## Função: `analisar`
**Descrição:** Processa um prompt de entrada utilizando um conjunto de dados técnicos para gerar uma resposta ou análise baseada em inteligência artificial.

**Parâmetros:**
* `prompt` (String): O texto ou comando principal que será enviado para o modelo de análise.
* `dadosTecnicos` (Object): Um objeto opcional contendo informações estruturadas ou metadados necessários para contextualizar a análise.

**Retorno:** (Any/String) Retorna o resultado processado pela lógica de IA ou o objeto de resposta gerado pelo serviço de análise.

**Uso:** É utilizada como ponto de entrada para orquestrar chamadas de modelos de IA, permitindo injetar contexto técnico dinâmico para refinar a precisão das respostas geradas.

---

## Função: `_ajustarPesosDinamicos`
**Descrição:** Esta função calcula dinamicamente a ponderação de confiança entre diferentes modelos de IA (Gemini, DeepSeek) e indicadores técnicos com base na disponibilidade dos dados e nas condições de mercado (ADX).

**Parâmetros:**
*   `gScore` (Number|null): Pontuação de confiança ou resultado retornado pelo modelo Gemini.
*   `dScore` (Number|null): Pontuação de confiança ou resultado retornado pelo modelo DeepSeek.
*   `adxValue` (Number): Valor do indicador ADX (Average Directional Index) utilizado para identificar a força da tendência.

**Retorno:**
*   `Object`: Um objeto contendo as chaves `GEMINI`, `DEEPSEEK` e `TECH`, cada uma com um valor numérico representando o peso percentual (0.0 a 1.0) atribuído a cada fonte de sinal.

**Uso:** Utilizada no módulo de Ensemble para garantir resiliência operacional (fallback em caso de falha de uma IA) e otimização de performance, priorizando o modelo mais adequado conforme a volatilidade e o regime de tendência identificado pelo ADX.

---

## Função: `_calcularSizingDinamico`
**Descrição:** Calcula o tamanho da posição (position sizing) de forma dinâmica baseando-se em scores de modelos de IA, consenso entre eles e o regime macroeconômico vigente.

**Parâmetros:**
* `finalScore` (Number): Pontuação consolidada do sinal de trading (0 a 1).
* `gemini` (Number): Score de confiança do modelo Gemini (0 a 1).
* `deepseek` (Number): Score de confiança do modelo DeepSeek (0 a 1).
* `macroRegime` (String): Identificador do cenário macroeconômico atual ("BEARISH", "DEFENSIVE" ou "BULLISH").

**Retorno:** (Number) O tamanho da posição ajustado, formatado com duas casas decimais.

**Uso:** Utilizado no módulo de execução para definir a exposição financeira do trade, aplicando multiplicadores de risco baseados na concordância das IAs e penalizando ou bonificando o volume conforme o contexto macroeconômico.

---

## Função: `_getGeminiAnalysis`
**Descrição:** Esta função realiza uma análise quantitativa de ativos da B3 utilizando a API do Gemini, integrando dados técnicos, contexto macroeconômico e regras de negócio predefinidas para gerar um score e sentimento de mercado.

**Parâmetros:**
*   `ticker` (String): O código do ativo a ser analisado (ex: "PETR4").
*   `data` (Object): Objeto contendo os indicadores técnicos (`rsi`, `adx`, `bollinger`), preço atual, score técnico base e tendência semanal.

**Retorno:**
*   `Object`: Retorna um objeto contendo `score` (Number, 0-100), `rationale` (String, justificativa da análise) e `sentiment` (String, "BULLISH", "BEARISH" ou "NEUTRAL"). Retorna `null` em caso de falha na conexão ou parsing.

**Uso:**
A função é utilizada como um módulo de inteligência artificial dentro do pipeline de análise técnica (`AI_Ensemble`). Ela constrói um prompt estruturado com regras de ajuste de score baseadas em indicadores (ADX, Bollinger, RSI), envia para o `AI_Connector` em modo JSON e valida o resultado antes de integrá-lo ao sistema de decisão.

---

## Função: `_extractScore`
**Descrição:** Extrai e normaliza um valor numérico de pontuação a partir de uma string ou objeto, buscando por padrões específicos ou chaves de identificação.

**Parâmetros:**
* `obj` (String|Object|null|undefined): O dado de entrada contendo a pontuação a ser extraída.

**Retorno:**
* `Number|null`: Retorna o valor numérico normalizado (convertendo vírgulas para pontos, se necessário) ou `null` caso nenhum valor válido seja encontrado.

**Uso:** Utilizada para processar respostas de modelos de IA ou dados estruturados, garantindo que diferentes formatos de pontuação (ex: "score: 8.5", "8,5" ou `{score: 9}`) sejam convertidos para um formato numérico padrão.

---

## Função: `_findScoreValue`
**Descrição:** Função recursiva projetada para extrair um valor numérico de pontuação (score) a partir de estruturas de dados complexas, incluindo strings, arrays ou objetos aninhados.

**Parâmetros:**
* `data` (any): O dado de entrada que pode ser um número, uma string, um array ou um objeto contendo o valor a ser extraído.

**Retorno:**
* `number|null`: Retorna o valor numérico encontrado ou `null` caso nenhum valor válido seja identificado na estrutura.

**Uso:** Utilizada para normalizar e extrair pontuações de respostas de APIs ou processamento de texto (como JSONs ou strings formatadas), buscando por chaves específicas (ex: "score", "ai_score", "rating") ou padrões numéricos dentro de strings.

---

## Função: `_normalizeScore`
**Descrição:** Normaliza valores numéricos ou strings de pontuação para uma escala decimal entre 0 e 1, tratando automaticamente variações de formato e escalas de 0-100.

**Parâmetros:**
* `val` (any): O valor a ser processado, podendo ser número, string (com possíveis caracteres extras ou formatação regional) ou nulo/indefinido.

**Retorno:**
* `number|null`: Retorna o valor normalizado como float (0.0 a 1.0) ou `null` caso o valor seja inválido ou esteja fora do intervalo permitido.

**Uso:** Utilizada para padronizar dados de entrada provenientes de IAs ou fontes externas que podem retornar pontuações em formatos variados (ex: "85", "0.85", "85%"), garantindo que todos os scores estejam em uma escala única de 0 a 1 para cálculos posteriores.

---

## Função: `_extractTechScore`
**Descrição:** Calcula ou normaliza um índice de pontuação técnica (Tech Score) entre 0 e 1 com base em dados de mercado fornecidos ou indicadores técnicos pré-processados.

**Parâmetros:**
* `data` (Object): Objeto contendo indicadores técnicos (`score`, `trend`, `rsi`, `macd`) ou `null`/`undefined`.

**Retorno:**
* `Number`: Um valor decimal entre 0 e 1 representando a força técnica do ativo.

**Uso:** Utilizada no módulo de ensemble para padronizar a avaliação de ativos, priorizando scores pré-calibrados (Core 22) ou realizando um cálculo heurístico baseado em tendência, RSI e MACD caso o score direto não esteja disponível.

---

## Função: `_safeParse`
**Descrição:** Função utilitária robusta para converter strings de resposta de LLMs em objetos JSON válidos, tratando ruídos de formatação, tags de raciocínio e erros comuns de sintaxe.

**Parâmetros:**
* `text` (String|Object): O conteúdo bruto recebido da API ou fonte de dados que deve ser convertido para um objeto estruturado.

**Retorno:**
* `Object|null`: Retorna o objeto JSON parseado, um objeto contendo um score (caso extraído), ou `null` se a conversão falhar após todas as tentativas de recuperação.

**Uso:** Ideal para processar respostas de modelos de IA que frequentemente incluem blocos Markdown, tags `<think>`, explicações textuais ou vírgulas extras que invalidam o `JSON.parse` nativo. A função tenta primeiro o parse direto, seguido pela extração de sub-strings delimitadas por chaves e, finalmente, pela busca de padrões de pontuação (score) no texto.

---

## Função: `_scoreToDecision`
**Descrição:** Converte um valor numérico de pontuação (score) em uma recomendação categórica de negociação baseada em faixas predefinidas.

**Parâmetros:** 
* `score` (Number): Valor numérico (geralmente entre 0 e 1) representando a confiança ou tendência do modelo de análise.

**Retorno:** 
* (String): Retorna uma das cinco categorias possíveis: "COMPRA_FORTE", "COMPRA", "VENDA_FORTE", "VENDA" ou "NEUTRO".

**Uso:** Utilizada no pipeline de decisão do sistema para traduzir o output quantitativo de um modelo de IA em uma diretriz de ação clara para o usuário ou sistema automatizado.

---

## Função: `TESTAR_ENSEMBLE`
**Descrição:** Função de teste unitário para validar a integração e o processamento de dados financeiros através dos módulos `analyzeWithEnsemble` e `getEnhancedScore`.

**Parâmetros:** 
* Nenhum (a função utiliza um objeto `mock` interno para simulação).

**Retorno:** 
* `void`: A função não retorna valores, apenas imprime os resultados das chamadas de teste no console do Google Apps Script.

**Uso:** Executada manualmente durante o desenvolvimento para verificar se as funções de análise de IA e cálculo de score estão processando corretamente os dados de entrada (ticker, preço e indicadores técnicos).

---

## Função: `DEBUG_AI_FAILURE`
**Descrição:** Função de diagnóstico projetada para validar a conectividade com provedores de IA (Gemini e DeepSeek) e verificar a integridade da lógica de extração de scores no sistema.

**Parâmetros:**
* `ticker` (String): Identificador do ativo ou entidade que será utilizado como contexto para o teste das chamadas de IA.

**Retorno:**
* `void`: A função não retorna valores, apenas imprime logs detalhados no console do Google Apps Script para fins de depuração.

**Uso:** Deve ser executada manualmente durante o desenvolvimento ou manutenção para identificar falhas de comunicação com as APIs de IA ou erros na manipulação e parsing de objetos JSON retornados pelos modelos.

---

## Função: `saveAnalysisResults`
**Descrição:** Processa e persiste uma lista de resultados de análise através de um mecanismo de buffer centralizado.

**Parâmetros:**
* `lista` (Array): Conjunto de dados ou objetos contendo os resultados da análise a serem salvos.

**Retorno:**
* `void`: A função não retorna valores.

**Uso:** Deve ser chamada ao finalizar uma etapa de processamento para garantir que os dados sejam enfileirados e gravados imediatamente no destino final (ex: planilha ou banco de dados) via `OutputBuffer`.

---

## Função: `_forceWrite`
**Descrição:** Realiza a atualização completa da planilha de saída, limpando dados anteriores e gravando um novo conjunto de registros em lote com formatação otimizada.

**Parâmetros:** 
* `lista` (Array): Conjunto de objetos contendo os dados brutos que serão transformados em linhas e gravados na planilha.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa operações de escrita e formatação na planilha ativa.

**Uso:** Utilizada para sincronizar o estado atual dos dados processados com a interface da planilha, garantindo que a estrutura esteja limpa, preenchida e formatada corretamente através de operações de rede em lote (batch operations) para alta performance.

---

## Função: `_toRow`
**Descrição:** Converte um objeto de operação financeira em um array formatado (linha) para exportação em planilhas, realizando a normalização de dados e a atualização dinâmica de preços.

**Parâmetros:**
*   `op` (Object): Objeto contendo os dados da operação (ticker, indicadores, preços, alvos, setup, etc.).

**Retorno:**
*   `Array`: Uma lista de valores estruturados na ordem específica das colunas da planilha de destino.

**Uso:** Utilizada no processo de saída de dados (`08_Output_Unified.js`) para transformar objetos de análise técnica em registros tabulares, garantindo que o preço utilizado seja o mais atualizado possível através de uma hierarquia de fontes (Live, Yahoo ou DataService).

---

## Função: `_formatSheetOptimized`
**Descrição:** Otimiza a performance de planilhas Google aplicando formatações numéricas e cores de fundo em lote através de matrizes, reduzindo chamadas de API.

**Parâmetros:**
*   `sheet` (GoogleAppsScript.Spreadsheet.Sheet): Objeto da planilha onde a formatação será aplicada.
*   `startRow` (Number): O número da linha inicial onde a formatação deve começar.
*   `numRows` (Number): A quantidade total de linhas a serem processadas.
*   `rowsSanitized` (Array<Array>): Matriz contendo os dados brutos, utilizada para determinar a lógica de coloração baseada em tipos e alertas.

**Retorno:**
*   `void`: A função não retorna valores, apenas altera diretamente o estado visual da planilha.

**Uso:**
Utilizada para realizar a formatação final de blocos de dados inseridos na planilha. A função aplica máscaras de moeda, porcentagem e decimais em colunas específicas e utiliza o método `setBackgrounds` com uma matriz bidimensional para colorir as linhas de forma eficiente em uma única requisição, evitando o gargalo de performance causado por chamadas repetitivas de `setBackground`.

---

## Função: `_ensureSheet`
**Descrição:** Verifica a existência de uma planilha específica em um arquivo Google Sheets, criando-a com cabeçalhos e formatação padrão caso ela não exista.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): O objeto da planilha (Spreadsheet) onde a verificação será realizada.

**Retorno:**
* `GoogleAppsScript.Spreadsheet.Sheet`: O objeto da planilha encontrada ou recém-criada.

**Uso:** Utilizada para garantir que o ambiente de destino dos dados esteja pronto antes de operações de escrita, evitando erros de referência e padronizando a estrutura da aba de saída.

---

## Função: `CORRIGIR_FORMATACAO_AGORA`
Como você não forneceu o corpo do código dentro da função, elaborei a documentação baseada na estrutura padrão de funções de automação de planilhas (Google Sheets) que realizam esse tipo de tarefa.

**Descrição:** Automatiza a padronização e correção de formatos de células (como datas, números ou alinhamento) em uma planilha ativa.

**Parâmetros:** 
* Nenhum (a função utiliza o contexto da planilha ativa via `SpreadsheetApp`).

**Retorno:** 
* `void` (Não retorna valor, apenas aplica alterações de formatação diretamente na planilha).

**Uso:** Deve ser executada manualmente via menu de extensões, botão vinculado ou através de um gatilho (trigger) de tempo/evento para garantir que os dados na planilha sigam o padrão visual definido no script.

---

## Função: `_getApiKey`
**Descrição:** Recupera a chave de API do serviço HG Brasil utilizando uma estratégia de prioridade entre gerenciadores de segredos, configurações personalizadas e um fallback de emergência.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `string`: A chave de API válida para autenticação no serviço HG Brasil.

**Uso:** A função é invocada internamente pelos métodos de busca de dados para obter a credencial de acesso. Ela prioriza a busca em objetos `Secrets` ou `CONFIG` (se disponíveis no escopo) e utiliza uma chave hardcoded como última alternativa, emitindo um aviso no console caso o fallback seja acionado.

---

## Função: `getQuoteBatch`
**Descrição:** Busca cotações de múltiplos ativos financeiros simultaneamente através da API da HG Brasil, utilizando cache para otimizar o consumo de requisições.

**Parâmetros:**
* `tickers` (Array de strings): Lista de símbolos dos ativos (ex: `['PETR4', 'VALE3.SA']`).

**Retorno:**
* `Object`: Um objeto onde as chaves são os tickers originais e os valores contêm `price`, `change`, `volume` e `source`. Retorna um objeto vazio em caso de erro ou entrada inválida.

**Uso:**
A função sanitiza os símbolos (removendo sufixos como ".SA"), verifica o `CacheService` para evitar chamadas redundantes à API e realiza uma requisição única ao endpoint `stock_price` da HG Brasil, mapeando os resultados de volta para os tickers solicitados.

---

## Função: `getQuote`
**Descrição:** Recupera os dados financeiros de um ativo específico através de uma chamada em lote (batch) ao serviço da HG Brasil.

**Parâmetros:** 
* `ticker` (String): O código identificador do ativo financeiro (ex: "IBOV", "USD", "PETR4").

**Retorno:** 
* (Object|null): Retorna o objeto contendo as informações do ativo se encontrado, ou `null` caso o ticker seja inválido ou não retorne dados.

**Uso:** Utilize esta função quando precisar obter a cotação atual de um único ativo, delegando a lógica de busca em lote para a função `getQuoteBatch`.

---

## Função: `getMarketData`
**Descrição:** Busca dados de mercado em tempo real via API da HG Brasil para um ticker específico, complementando a resposta com uma série histórica sintética de 60 candles para viabilizar o cálculo de indicadores técnicos.

**Parâmetros:**
* `ticker` (String): O código do ativo (ex: "PETR4" ou "PETR4.SA").

**Retorno:**
* `Object|null`: Retorna um objeto contendo os dados atuais do mercado e um array `fakeHistory` com 60 candles simulados, ou `null` caso o ticker não seja fornecido.

**Uso:**
Utilizada para integrar dados da HG Brasil ao sistema de análise técnica. A função normaliza o ticker (removendo sufixos como ".SA"), realiza a requisição HTTP e, caso o histórico real não esteja disponível na API, gera uma série temporal artificial baseada no preço atual, volatilidade e oscilações senoidais para garantir que indicadores como ADX, RSI e Bandas de Bollinger funcionem sem erros de falta de dados.

---

## Função: `_getRandomUserAgent`
**Descrição:** Seleciona e retorna aleatoriamente uma string de User-Agent a partir de uma lista predefinida para simular diferentes navegadores em requisições HTTP.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* {string}: Uma string contendo um User-Agent escolhido aleatoriamente do array `USER_AGENTS`.

**Uso:** Utilizada internamente em processos de scraping ou requisições de API (como o Yahoo Finance) para evitar bloqueios por parte do servidor, rotacionando a identidade do cliente que realiza a chamada.

---

## Função: `_fetchWithRetry`
**Descrição:** Realiza uma requisição HTTP com mecanismo de repetição automática (retry) em caso de falha ou erro de rede.

**Parâmetros:**
* `url` (String): O endereço URL de destino para a requisição.
* `options` (Object, opcional): Objeto contendo as configurações da requisição (método, headers, payload, etc.) e parâmetros de controle de retry (ex: `maxRetries`, `delay`).

**Retorno:** (Object/HTTPResponse) Retorna o objeto de resposta da requisição (`UrlFetchApp.HTTPResponse`) caso obtenha sucesso, ou lança uma exceção após esgotar as tentativas.

**Uso:** Utilizada para aumentar a resiliência de chamadas à API do Yahoo Finance, garantindo que falhas temporárias de conexão não interrompam a execução do script.

---

## Função: `getHistory`
**Descrição:** Recupera o histórico de preços de ativos financeiros da API do Yahoo Finance, tratando automaticamente a inclusão do sufixo para o mercado brasileiro (.SA).

**Parâmetros:**
* `ticker` (String): O código do ativo (ex: 'PETR4').
* `interval` (String, opcional): Frequência dos dados (padrão: '1d').
* `range` (String, opcional): Período de tempo dos dados (padrão: '3mo').

**Retorno:** (Array de Objetos) Uma lista de objetos contendo `date`, `open`, `high`, `low`, `close`, `volume` e `ticker`, filtrada para remover registros com preço de fechamento zero. Retorna `null` em caso de erro ou ausência de dados.

**Uso:** Ideal para alimentar planilhas com séries temporais de ações ou fundos imobiliários brasileiros, utilizando a função auxiliar `_fetchWithRetry` para garantir a resiliência da requisição HTTP.

---

## Função: `getQuoteBatchSmart`
**Descrição:** Busca cotações de ativos financeiros em lote, priorizando a API do Yahoo Finance e utilizando a API Brapi como mecanismo de fallback para ativos não encontrados.

**Parâmetros:**
* `tickers` (Array de Strings): Lista de símbolos dos ativos (ex: ['PETR4', 'VALE3']).

**Retorno:**
* `Object`: Um objeto onde as chaves são os símbolos dos ativos e os valores contêm um objeto com as propriedades `price` (preço), `change` (variação percentual) e `volume` (volume de negociação).

**Uso:** Ideal para atualizar múltiplos ativos em planilhas ou sistemas de monitoramento financeiro, garantindo resiliência ao alternar entre provedores de dados caso o Yahoo Finance falhe ou não retorne um símbolo específico.

---

## Função: `getQuoteBatchBrapi`
**Descrição:** Busca cotações em lote de ativos financeiros através da API da Brapi, processando os dados em blocos para otimizar requisições e contornar limitações de URL.

**Parâmetros:**
* `tickers` (Array de Strings): Lista de símbolos dos ativos (ex: `['PETR4', 'VALE3.SA']`).

**Retorno:**
* `Object`: Um dicionário onde as chaves são os tickers originais e os valores são objetos contendo `price` (preço), `change` (variação percentual), `volume` e a `source` (fonte dos dados).

**Uso:**
A função recupera o token de autenticação via `CONFIG` ou `PropertiesService`, normaliza os símbolos removendo o sufixo ".SA", realiza requisições em blocos de 10 ativos para evitar erros de URL e retorna um objeto consolidado com as informações de mercado. Inclui tratamento de erros e pausa de 200ms entre requisições para respeitar limites de taxa.

---

## Função: `getQuote`
**Descrição:** Recupera os dados financeiros de um único ativo (ticker) através de uma chamada otimizada em lote.

**Parâmetros:** 
* `ticker` (String): O símbolo do ativo financeiro (ex: "PETR4.SA" ou "AAPL") a ser consultado.

**Retorno:** 
* `Object|null`: Retorna um objeto contendo os dados do ativo se encontrado, ou `null` caso o ticker seja inválido ou não retorne dados.

**Uso:** Utilize esta função para obter cotações individuais de forma simplificada, aproveitando a infraestrutura de processamento em lote da função `getQuoteBatchSmart`.

---

## Função: `TEST_YahooFetcher`
**Descrição:** Função de diagnóstico para validar a integridade e a conectividade dos métodos de busca de dados financeiros (cotações em lote e histórico) do módulo `YahooFetcher`.

**Parâmetros:** 
* Nenhum (a função utiliza valores fixos internos para teste).

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe logs de execução no console do Google Apps Script para depuração.

**Uso:** 
* Deve ser executada manualmente no editor de script para verificar se as APIs externas (Yahoo Finance/BRAPI) estão acessíveis, se o token de autenticação está configurado corretamente e se os métodos de busca estão retornando dados válidos.

---

## Função: `_getApiKey`
**Descrição:** Recupera a chave de API do serviço Alpha Vantage priorizando gerenciadores de segredos externos e utilizando uma chave hardcoded como fallback de segurança.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `String`: A chave de API necessária para autenticar requisições no serviço Alpha Vantage.

**Uso:** 
* A função é utilizada internamente pelo módulo `Data_AlphaVantageFetcher` para obter credenciais de forma hierárquica: primeiro tenta buscar via objeto `Secrets`, depois via `CONFIG`, e finalmente recorre a uma constante hardcoded, emitindo um aviso de log caso o fallback seja acionado.

---

## Função: `_fetchWithRetry`
**Descrição:** Realiza requisições HTTP à API Alpha Vantage com suporte a tentativas automáticas (retry), controle de limite de taxa (rate limiting) e tratamento de erros específicos da API.

**Parâmetros:**
*   `url` (String): A URL base da requisição da API Alpha Vantage (sem a chave de API).
*   `options` (Object): Objeto de configuração para o `UrlFetchApp` (ex: método, headers).
*   `bucketName` (String): Identificador do grupo de limite de taxa para o módulo `RateLimiter`.

**Retorno:**
*   `Object|null`: Retorna o objeto JSON com os dados da resposta em caso de sucesso, ou `null` se a requisição falhar após todas as tentativas ou retornar erro da API.

**Uso:**
Utilizada internamente para encapsular chamadas à API Alpha Vantage, garantindo resiliência contra falhas de rede, erros de limite de taxa (HTTP 429) e mensagens de erro contidas no corpo da resposta JSON da própria API.

---

## Função: `getHistory`
**Descrição:** Busca e processa dados históricos de preços de ativos financeiros (OHLCV) da API Alpha Vantage, normalizando o formato do ticker para o padrão B3 (.SA).

**Parâmetros:**
*   `ticker` (String): O símbolo do ativo (ex: "PETR4").
*   `interval` (String, opcional): Frequência dos dados. Aceita 'daily' (padrão), 'weekly', 'monthly' ou intervalos intraday (ex: '5min').
*   `outputsize` (String, opcional): Quantidade de dados. 'compact' (últimos 100 registros) ou 'full' (histórico completo).

**Retorno:**
*   (Array de Objetos | null): Retorna um array de objetos contendo `date`, `open`, `high`, `low`, `close`, `volume` e `ticker`, ordenados cronologicamente do mais antigo para o mais recente. Retorna `null` em caso de erro ou intervalo inválido.

**Uso:**
A função é utilizada para integrar dados de mercado ao Google Sheets. Ela converte automaticamente o ticker para o formato da B3, realiza a requisição via `_fetchWithRetry`, extrai a série temporal do JSON retornado e normaliza os dados para um formato tabular pronto para uso em planilhas.

---

## Função: `getQuoteBatch`
**Descrição:** Processa uma lista de símbolos de ações (tickers) e retorna um objeto contendo os dados financeiros consolidados de cada um, utilizando a função auxiliar `getQuote`.

**Parâmetros:** 
* `tickers` (Array): Uma lista de strings representando os símbolos (tickers) das ações a serem consultadas.

**Retorno:** 
* (Object): Um objeto onde as chaves são os tickers e os valores são objetos contendo as propriedades `price`, `change` e `volume` para cada ativo encontrado.

**Uso:** Ideal para realizar consultas em lote de múltiplos ativos simultaneamente, permitindo centralizar as informações de preço, variação e volume em uma única estrutura de dados para posterior manipulação ou exibição.

---

## Função: `getQuote`
**Descrição:** Busca dados de cotação em tempo real de um ativo financeiro específico utilizando a API Alpha Vantage.

**Parâmetros:** 
* `ticker` (String): O símbolo do ativo financeiro (ex: "AAPL", "PETR4.SA") a ser consultado.

**Retorno:** 
* `Object|null`: Retorna um objeto contendo `price` (float), `change` (float), `volume` (int) e `timestamp` (Date) se bem-sucedido, ou `null` caso o ticker seja inválido ou a API falhe.

**Uso:** A função é utilizada para integrar dados de mercado ao Google Sheets ou outros serviços, dependendo da função auxiliar `_fetchWithRetry` para gerenciar requisições HTTP com tolerância a falhas.

---

## Função: `_fetchBCBSerie`
**Descrição:** Realiza a busca de séries temporais na API do Banco Central do Brasil (SGS) com suporte a cache, tratamento de erros e tentativas automáticas de reconexão.

**Parâmetros:**
* `serie` (String/Number): O código identificador da série temporal no Banco Central.
* `ultimosN` (Number, opcional): Quantidade de registros mais recentes a serem retornados (padrão: 10).

**Retorno:**
* `Array|null`: Retorna um array de objetos contendo os dados da série em caso de sucesso, ou `null` caso a requisição falhe após todas as tentativas.

**Uso:** A função deve ser chamada internamente por outros métodos do projeto para obter dados econômicos atualizados, aproveitando o cache do Google Apps Script para otimizar a performance e reduzir chamadas à API externa.

---

## Função: `getSelic`
**Descrição:** Recupera a taxa Selic atualizada através da API do Banco Central do Brasil utilizando a série temporal 432.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Object` ou `null`: Retorna um objeto contendo `valor` (float), `data` (string) e `fonte` (string) caso a requisição seja bem-sucedida; caso contrário, retorna `null`.

**Uso:** Utilizada para obter o valor mais recente da taxa Selic de forma automatizada, processando a formatação do dado recebido da API do BCB para um formato numérico padrão.

---

## Função: `getSelicDiaria`
**Descrição:** Recupera a série histórica da taxa Selic diária consultando a API do Banco Central do Brasil.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Array<Object>|null`: Retorna um array de objetos contendo `valor` (float) e `data` (string) caso a requisição seja bem-sucedida, ou `null` caso não haja dados.

**Uso:** 
* Utilizada para obter os valores diários da Selic, processando a formatação numérica (substituindo vírgula por ponto) para permitir cálculos financeiros subsequentes. Depende da função auxiliar `_fetchBCBSerie`.

---

## Função: `getDolar`
**Descrição:** Obtém a cotação atual do Dólar (USD) através da série histórica 1 do Banco Central do Brasil (BCB).

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* Objeto (ou `null`): Retorna um objeto contendo `valor` (float), `data` (string) e `fonte` (string), ou `null` caso a requisição falhe ou não retorne dados.

**Uso:** Utilizada para integrar a cotação oficial do Dólar em planilhas ou sistemas, invocando internamente a função auxiliar `_fetchBCBSerie` para consumir a API do SGS/BCB.

---

## Função: `getIPCA`
**Descrição:** Recupera o valor mensal mais recente e o acumulado dos últimos 12 meses do índice IPCA a partir da série 243 do Banco Central do Brasil.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Object` ou `null`: Retorna um objeto contendo o último valor (`ultimo`), o acumulado de 12 meses (`acumulado12m`), a data de referência (`data`) e a fonte dos dados, ou `null` caso a requisição falhe ou não retorne dados.

**Uso:** Utilizada para obter indicadores de inflação atualizados diretamente do SGS/BCB, sendo ideal para relatórios financeiros ou dashboards que necessitem do IPCA mensal e anualizado.

---

## Função: `getMacroContext`
**Descrição:** Agrega indicadores macroeconômicos (Selic, Dólar e IPCA) de fontes externas, define um regime de mercado baseado na taxa Selic e gera um resumo textual do contexto econômico atual.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Object`: Um objeto contendo o timestamp da execução, os valores e fontes dos indicadores (Selic, Dólar, IPCA), a classificação do regime de mercado (`DEFENSIVE`, `CAUTIOUS`, `EXPANSIVE` ou `NEUTRAL`), o motivo da classificação e um resumo formatado em string.

**Uso:** 
* Utilizada para centralizar dados macroeconômicos em um único objeto estruturado, facilitando a tomada de decisão automatizada ou a exibição de relatórios de contexto econômico em dashboards ou logs do sistema.

---

## Função: `getIpeadata`
**Descrição:** Função reservada para a integração com a API do Ipeadata, atualmente inativa devido à ausência de uma interface REST pública oficial.

**Parâmetros:** 
* `codigo` (String/Number): O identificador único da série temporal desejada no banco de dados do Ipeadata.

**Retorno:** 
* `null`: A função retorna nulo de forma consistente, indicando que a integração não está operacional e que o sistema deve recorrer a fontes alternativas.

**Uso:** Utilizada como um placeholder na arquitetura do sistema para padronizar chamadas de dados macroeconômicos, redirecionando a lógica de negócio para o provedor BCB (Banco Central do Brasil) enquanto a integração com o Ipeadata não é implementada.

---

## Função: `_getApiKey`
**Descrição:** Recupera a chave de API do serviço Finnhub priorizando fontes seguras (Secrets ou Config) com um fallback de emergência hardcoded.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `String`: A chave de API necessária para autenticar as requisições ao serviço Finnhub.

**Uso:** 
* A função deve ser chamada internamente pelos métodos de busca de dados do arquivo `11_Data_FinnhubFetcher.js`. Ela verifica automaticamente a disponibilidade de gerenciadores de segredos (`Secrets` ou `CONFIG`) antes de recorrer à chave de fallback, emitindo um aviso no console caso a configuração de segurança não esteja implementada.

---

## Função: `_fetchWithRetry`
**Descrição:** Realiza requisições HTTP à API da Finnhub com mecanismos de cache, controle de fluxo (circuit breaker) e tentativas automáticas em caso de falha.

**Parâmetros:**
* `url` (String): O endpoint da API Finnhub a ser consultado.
* `ttl` (Integer): Tempo de vida (em segundos) para armazenamento do resultado no cache do Google Apps Script.

**Retorno:**
* `Object|null`: Retorna o objeto JSON com os dados da resposta em caso de sucesso, ou `null` caso a requisição falhe, o limite de taxa seja atingido ou o circuito esteja aberto.

**Uso:**
Utilizada como camada de abstração para chamadas à API da Finnhub. A função verifica automaticamente o estado do *circuit breaker*, consulta o cache do script antes de realizar a requisição externa e gerencia retentativas (backoff) e erros de limite de taxa (429), garantindo resiliência e economia de chamadas à API.

---

## Função: `isTickerSkippable`
**Descrição:** Avalia se um determinado ticker de ativo deve ser ignorado pelo processador de dados com base em padrões de BDRs e ETFs específicos.

**Parâmetros:**
* `ticker` (String): O símbolo do ativo (ex: "PETR4", "IVVB11") a ser validado.

**Retorno:**
* `Boolean`: Retorna `true` se o ticker for um BDR ou ETF listado na regra de exclusão, caso contrário, retorna `false`.

**Uso:** Utilizada para filtrar ativos que não devem ser processados pelo `FinnhubFetcher`, evitando chamadas desnecessárias para ativos que não se enquadram no escopo da ferramenta ou que possuem padrões de nomenclatura específicos.

---

## Função: `getHistory`
**Descrição:** Busca o histórico de preços (candles) de um ativo financeiro na API Finnhub, normalizando o ticker para o padrão da B3 e estruturando os dados temporais.

**Parâmetros:**
*   `ticker` (String): O código do ativo (ex: "PETR4").
*   `resolution` (String, opcional): Intervalo do candle (padrão: 'D' para diário).
*   `count` (Number, opcional): Quantidade de períodos a retroceder (padrão: 120 dias).

**Retorno:**
*   `Array<Object>|null`: Retorna um array de objetos contendo `date`, `open`, `high`, `low`, `close`, `volume` e `ticker`, ou `null` caso não haja dados suficientes ou ocorra erro na requisição.

**Uso:** Utilizada para obter séries temporais de preços de ações brasileiras, sendo ideal para cálculos de indicadores técnicos ou visualização de gráficos, com tratamento automático de cache e validação de dados.

---

## Função: `getQuote`
**Descrição:** Busca dados financeiros em tempo real de um ativo específico na API Finnhub, formatando o ticker para o padrão B3 (sufixo .SA).

**Parâmetros:**
* `ticker` (String): O código do ativo (ex: "PETR4").

**Retorno:**
* `Object|null`: Retorna um objeto contendo os dados de mercado (`price`, `change`, `volume`, `high`, `low`, `open`, `previousClose`, `timestamp`, `source`) ou `null` caso o ativo não seja encontrado ou a API falhe.

**Uso:** Utilizada para integrar cotações de ações brasileiras em planilhas ou sistemas, normalizando automaticamente o ticker para o formato exigido pela API e aplicando cache para otimizar requisições.

---

## Função: `getQuoteBatch`
**Descrição:** Recupera dados de cotação de mercado para uma lista de ativos financeiros através de chamadas sequenciais à função `getQuote`.

**Parâmetros:**
* `tickers` (Array): Uma lista de strings contendo os símbolos (tickers) das ações ou ativos a serem consultados.

**Retorno:**
* `Object`: Um objeto onde as chaves são os símbolos dos ativos e os valores são os dados de cotação correspondentes (retornados pela função `getQuote`). Caso o input seja inválido ou nenhum dado seja encontrado, retorna um objeto vazio.

**Uso:** Ideal para processar múltiplos ativos de uma só vez, centralizando os resultados em um único objeto mapeado por ticker para facilitar a manipulação posterior dos dados.

---

## Função: `_getKey`
**Descrição:** Recupera a chave de API do RapidAPI priorizando o uso de um gerenciador de segredos externo e recorrendo às propriedades do script como alternativa.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `String`: A chave de API encontrada ou uma string vazia caso nenhuma configuração seja localizada.

**Uso:** Utilizada internamente para obter credenciais de autenticação de forma segura, permitindo a transição entre ambientes de gerenciamento de segredos e as propriedades nativas do Google Apps Script.

---

## Função: `_formatTicker`
**Descrição:** Normaliza o símbolo de um ativo financeiro garantindo que esteja em letras maiúsculas e, caso necessário, adiciona o sufixo padrão da B3 (.SA).

**Parâmetros:** 
* `ticker` (String): O símbolo do ativo financeiro a ser formatado.

**Retorno:** 
* `String`: O símbolo formatado em maiúsculas, com espaços removidos e sufixo ".SA" incluído se não for um índice (identificado por '^') ou se já não possuir o sufixo.

**Uso:** Utilizada para padronizar entradas de usuários ou dados externos antes de realizar consultas na API do Yahoo Finance, assegurando que ativos brasileiros sejam identificados corretamente.

---

## Função: `_fetch`
**Descrição:** Realiza requisições HTTP GET autenticadas para a API do Yahoo via RapidAPI, processando a resposta em formato JSON.

**Parâmetros:**
* `endpoint` (String): O caminho do recurso da API a ser acessado (ex: 'finance/quote').
* `params` (Object): Objeto contendo os pares chave-valor que comporão a query string da URL.

**Retorno:** (Object | null) Retorna o objeto JSON decodificado em caso de sucesso (HTTP 200) ou `null` caso ocorra erro na requisição, falha na autenticação ou exceção.

**Uso:** Utilizada como método utilitário interno para padronizar chamadas à API, gerenciando automaticamente a injeção de chaves de API, cabeçalhos de host e tratamento básico de erros.

---

## Função: `getHistory`
**Descrição:** Recupera o histórico de preços (OHLCV) de um ativo financeiro através da API do Yahoo Finance, processando e normalizando os dados em formato de velas (candles).

**Parâmetros:**
* `ticker` (String): O símbolo do ativo financeiro (ex: 'PETR4.SA', 'AAPL').
* `interval` (String, opcional): Frequência dos dados ('1d', '1wk', '1mo', ou abreviações 'D', 'W'). Padrão: '1d'.
* `range` (String, opcional): Período de tempo retroativo (ex: '6mo', '1y', '5d'). Padrão: '6mo'.

**Retorno:** 
* (Array<Object>|null): Retorna um array de objetos contendo `date` (ISO string), `open`, `high`, `low`, `close` e `volume`. Retorna `null` caso a requisição falhe ou os dados estejam incompletos.

**Uso:** Ideal para alimentar gráficos ou análises técnicas, a função abstrai a formatação da API do Yahoo Finance e converte os timestamps Unix para objetos de data legíveis, filtrando registros inválidos.

---

## Função: `getQuoteBatch`
**Descrição:** Busca em lote os preços atuais e variações percentuais de ativos financeiros utilizando a API do Yahoo Finance via RapidAPI.

**Parâmetros:**
* `tickers` (Array de Strings): Lista de símbolos de ativos (ex: `['AAPL', 'PETR4.SA']`) a serem consultados.

**Retorno:**
* `Object`: Um objeto onde as chaves são os símbolos dos ativos e os valores contêm o preço atual (`price`), a variação percentual (`change`) e a fonte dos dados (`source`). Retorna um objeto vazio em caso de erro ou lista de entrada nula.

**Uso:**
A função processa requisições HTTP em paralelo (`UrlFetchApp.fetchAll`) para otimizar o tempo de resposta, formatando cada ticker, realizando a chamada à API e extraindo os dados de mercado do objeto de resposta JSON. É ideal para atualizar múltiplas cotações simultaneamente em planilhas Google.

---

## Função: `calculateRS`
**Descrição:** Calcula a Força Relativa (RS) entre um ativo e um benchmark, retornando os valores normalizados e sua respectiva média móvel exponencial (EMA).

**Parâmetros:**
* `ticker` (String): O símbolo do ativo a ser analisado.
* `benchmarkTicker` (String, opcional): O símbolo do ativo de referência (padrão: 'IBOV').
* `period` (Number, opcional): O período utilizado para o cálculo da EMA (padrão: 21).
* `dataPeriod` (String, opcional): O intervalo de tempo para busca dos dados históricos (padrão: '1y').
* `interval` (String, opcional): A periodicidade dos candles (padrão: '1d').

**Retorno:** (Object) Um objeto contendo:
* `rsValues`: Array com a série histórica da razão entre o ativo e o benchmark.
* `rsEma`: Array com a série histórica da EMA calculada sobre a RS.
* `currentRS`: O valor mais recente da Força Relativa.
* `currentRSEma`: O valor mais recente da EMA da Força Relativa.

**Uso:** A função é utilizada para comparar o desempenho relativo de um ativo em relação a um índice de mercado, permitindo identificar tendências de superação ou subdesempenho através da análise da série histórica e da suavização por EMA.

---

## Função: `_parseNum`
**Descrição:** Converte valores de diversos formatos (strings monetárias, percentuais ou numéricos) em um tipo numérico (float) válido para cálculos.

**Parâmetros:**
* `val` (any): O valor a ser processado, podendo ser string, número, nulo ou indefinido.

**Retorno:**
* `number`: O valor convertido em número decimal ou `0` caso o valor seja inválido ou vazio.

**Uso:** Utilizada para sanitizar dados vindos de planilhas ou APIs que contenham formatação de moeda (R$), símbolos de porcentagem (%) ou separadores decimais brasileiros (vírgula), garantindo que o valor possa ser utilizado em operações matemáticas.

---

## Função: `updateDashboardCompleto`
**Descrição:** Atualiza o painel de controle (Dashboard) do sistema, consolidando métricas de desempenho da carteira, indicadores de risco e formatando visualmente a interface principal.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas realiza operações de escrita e formatação na planilha definida como `DASHBOARD_SHEET`.

**Uso:** 
* Deve ser executada para sincronizar o painel com os dados mais recentes da carteira. A função realiza a limpeza do dashboard antigo, processa cálculos de patrimônio, lucro e risco a partir da aba `CARTEIRA_SHEET` e aplica estilos visuais (cores, fontes e formatação de moeda) para facilitar a leitura dos indicadores de performance. Opcionalmente, dispara o monitoramento de saída de trades virtuais via `SimulationManager` antes da atualização.

---

## Função: `_drawComparisonBlock`
**Descrição:** Renderiza um bloco comparativo de métricas de performance entre dados operacionais reais e estratégias simuladas na planilha de dashboard.

**Parâmetros:**
* `dash` (GoogleAppsScript.Spreadsheet.Sheet): Objeto da planilha onde o bloco será desenhado.
* `startRow` (Number): O número da linha inicial onde o cabeçalho do bloco será posicionado.

**Retorno:**
* `void`: Esta função não retorna valores, apenas aplica formatação e dados na planilha.

**Uso:** Utilizada para atualizar visualmente o painel de controle, comparando indicadores de eficiência (Win Rate), retorno médio e volume de trades entre o cenário real e o simulado, aplicando cores distintas para facilitar a leitura.

---

## Função: `_drawWinRateChart`
**Descrição:** Esta função processa o histórico de operações (trades) da planilha de logs para calcular a evolução percentual da taxa de acerto (Win Rate) e renderiza um gráfico de linha no painel de controle (Dashboard).

**Parâmetros:**
* `dash` (GoogleAppsScript.Spreadsheet.Sheet): Objeto da planilha que representa o Dashboard onde o gráfico será inserido.
* `startRow` (Number): Índice da linha onde o gráfico será posicionado no Dashboard.

**Retorno:**
* `void`: A função não retorna valores, realizando apenas a manipulação de objetos na planilha.

**Uso:** É utilizada internamente para atualizar visualmente o desempenho do trader, filtrando os resultados "GAIN" e "LOSS" da aba `LOG_REAL`, armazenando os dados calculados na aba oculta `CHART_DATA` e atualizando o gráfico de linha correspondente no Dashboard.

---

## Função: `_getRealStats`
**Descrição:** Extrai e calcula métricas de desempenho de operações reais a partir de uma planilha de log, consolidando o total de trades, taxa de acerto e lucro médio.

**Parâmetros:**
* Nenhum (a função utiliza a constante global `LOG_REAL` para identificar a aba de origem).

**Retorno:**
* `Object`: Um objeto contendo:
    * `total` (Number): Quantidade total de operações.
    * `winRate` (String): Percentual de taxa de acerto formatado.
    * `avgProfit` (String): Média de lucro/prejuízo percentual formatada.

**Uso:** Utilizada para alimentar o painel de controle (Dashboard) com dados estatísticos atualizados das operações reais, processando tanto o resumo pré-calculado na linha 2 quanto o cálculo dinâmico da média baseada na coluna J.

---

## Função: `_getSimStats`
**Descrição:** Calcula estatísticas de desempenho (total de operações, taxa de acerto e lucro médio) baseadas nos dados de simulação registrados na planilha.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* Objeto contendo:
    * `total` (Number): Quantidade total de registros.
    * `winRate` (String): Percentual de operações com status "GAIN".
    * `avgProfit` (String): Média aritmética dos resultados percentuais das operações.

**Uso:** Utilizada pelo Dashboard para exibir o resumo de performance das simulações, lendo os dados da aba definida pela constante `LOG_SIMULADO` e processando as colunas de resultado e status.

---

## Função: `ATUALIZAR_DASHBOARD`
**Descrição:** Aciona o processo de atualização integral dos dados e elementos visuais do painel de controle (Dashboard).

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa a rotina de atualização no objeto `DashboardUI`.

**Uso:** 
* Deve ser chamada para sincronizar as informações do painel com as fontes de dados mais recentes, geralmente vinculada a um gatilho (trigger) de tempo ou a um botão de interface na planilha.

---

## Função: `dispararRelatorioDiario`
**Descrição:** Esta função automatiza o envio de um relatório diário de investimentos via Telegram, extraindo KPIs de uma aba de Dashboard e processando dados de rebalanceamento de ativos de uma planilha Google.

**Parâmetros:**
* Esta função não recebe parâmetros de entrada (utiliza variáveis de ambiente e contexto da planilha ativa).

**Retorno:**
* `void`: A função não retorna valores, realizando apenas o processamento de dados e o envio de mensagens externas via API do Telegram.

**Uso:**
* Deve ser configurada em um gatilho (Trigger) do Google Apps Script para execução automática diária; depende das funções auxiliares `_getConfigSecret` para autenticação e `_formatBRL` para formatação monetária, além da existência das abas "Dashboard" e "Relatorio_Rebalanceamento" na planilha ativa.

---

## Função: `_getConfigSecret`
**Descrição:** Recupera um valor sensível (segredo) a partir de um objeto de configuração global, garantindo a segurança da execução caso o objeto não esteja definido.

**Parâmetros:**
* `key` (String): A chave identificadora do segredo que se deseja recuperar.

**Retorno:**
* `String|null`: O valor do segredo correspondente à chave, ou `null` caso o objeto `CONFIG` não esteja disponível ou a função `getSecret` não exista.

**Uso:** Utilizada internamente para acessar credenciais ou tokens de forma segura, verificando a existência do ambiente de configuração antes da chamada para evitar erros de tempo de execução.

---

## Função: `_enviarTelegram`
**Descrição:** Envia um relatório automatizado de operações financeiras (Sniper B3) para um chat específico do Telegram utilizando a API oficial do bot.

**Parâmetros:**
* `token` (String): Token de autenticação do bot fornecido pelo BotFather.
* `chatId` (String/Number): Identificador único do chat ou canal onde a mensagem será enviada.
* `pat` (String/Number): Valor do patrimônio atual a ser exibido no relatório.
* `luc` (String/Number): Valor do resultado financeiro (lucro/prejuízo) a ser exibido.
* `urgentes` (Array de Objetos): Lista de ativos pendentes, contendo as propriedades `ticker`, `situacao`, `lucroAtual` e `meta`.

**Retorno:** `void` (A função não retorna valores; executa uma requisição HTTP e registra erros no console em caso de falha).

**Uso:** Utilizada para notificar usuários sobre o status de investimentos, formatando automaticamente a mensagem com emojis e estilo Markdown, destacando operações urgentes de compra ou ajuste.

---

## Função: `_enviarGmail`
**Descrição:** Função privada responsável por formatar e enviar um e-mail transacional via Gmail contendo o resumo de performance de trades e alertas de ações recomendadas.

**Parâmetros:** 
* `email` (String): Endereço de e-mail do destinatário.
* `pat` (String/Number): Valor atual do patrimônio para exibição no cabeçalho.
* `luc` (String/Number): Valor do lucro/prejuízo acumulado (utilizado para definir a cor do indicador).
* `urgentes` (Array de Objetos): Lista de ativos que requerem atenção, contendo propriedades como `ticker`, `precoAt`, `isPositivo`, etc.
* `mantidos` (Array de Objetos): Lista de ativos atualmente mantidos em carteira (processamento não detalhado no trecho fornecido).

**Retorno:** 
* `void`: A função executa o envio do e-mail via `MailApp.sendEmail` (ou `GmailApp.sendEmail`) e não retorna valores.

**Uso:** 
Utilizada como parte do motor de notificações do sistema "Sniper B3" para manter o usuário informado sobre o status da carteira. A função constrói um template HTML responsivo com codificação UTF-8, aplicando estilos condicionais baseados na performance financeira (verde para lucro, vermelho para prejuízo) e iterando sobre os arrays de ativos para preencher as tabelas de recomendações.

---

## Função: `_formatBRL`
**Descrição:** Formata um valor numérico para o padrão de moeda brasileira (Real) com o símbolo R$ e separadores decimais/de milhar.

**Parâmetros:**
* `val` (number): O valor numérico que será convertido para o formato de moeda.

**Retorno:**
* (string): Uma string formatada como moeda (ex: "R$ 1.234,56") ou "R$ 0,00" caso o valor seja inválido.

**Uso:** Utilizada para padronizar a exibição de valores monetários em notificações ou relatórios gerados pelo sistema, garantindo que entradas não numéricas não causem erros na interface.

---

## Função: `enviarAlertaRisco`
**Descrição:** Envia uma mensagem de notificação de risco para um chat específico do Telegram utilizando a API oficial do bot.

**Parâmetros:** 
* `mensagem` (String): O conteúdo textual da notificação a ser enviada, suportando formatação Markdown.

**Retorno:** 
* `void`: A função não retorna valores; em caso de falha na requisição ou ausência de credenciais, o erro é registrado no console.

**Uso:** Utilizada para disparar alertas automatizados em sistemas de monitoramento, integrando o Google Apps Script com o Telegram através de tokens e IDs de chat armazenados em configurações seguras.

---

## Função: `EXECUTAR_NOTIFICACAO_DIARIA`
**Descrição:** Função de gatilho responsável por iniciar o processo de envio do relatório diário através do serviço de notificações.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa a lógica contida no serviço.

**Uso:** Deve ser configurada como um gatilho (trigger) de tempo no Google Apps Script para execução automática em horários específicos (ex: diariamente às 08:00).

---

## Função: `COMPLIANCE_CHECK`
**Descrição:** Função de entrada (wrapper) que aciona o processo de auditoria de conformidade centralizado no módulo `ComplianceUnified`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores diretamente, delegando a execução para `ComplianceUnified.executarAuditoriaCompleta()`.

**Uso:** Deve ser chamada via gatilhos (triggers) do Google Apps Script ou manualmente através do menu personalizado para iniciar a verificação de conformidade definida no arquivo `20_Compliance_Unified.js`.

---

## Função: `verificarHorarioOperacional`
**Descrição:** Função de interface que delega a verificação de conformidade de horário operacional para o módulo `ComplianceUnified`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Boolean`: Retorna `true` se o horário atual estiver dentro do período operacional permitido, ou `false` caso contrário.

**Uso:** Utilizada como um ponto de entrada simplificado para validar se uma operação pode ser executada com base nas regras de tempo definidas na biblioteca ou classe `ComplianceUnified`.

---

## Função: `EXECUTAR_CALCULO_FISCAL`
**Descrição:** Função principal de entrada para disparar o processamento automatizado de cálculos fiscais através da classe `TaxProcessor`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe alertas na interface do usuário (UI) do Google Sheets indicando sucesso ou falha.

**Uso:** Deve ser vinculada a um botão na planilha ou executada via menu personalizado para iniciar a lógica de cálculo definida na classe `TaxProcessor`, processando os dados e notificando o usuário sobre o resultado.

---

## Função: `STRATEGY_EVALUATE_CORE`
**Descrição:** Função central de processamento que normaliza dados de mercado (candles) e realiza validações estruturais para preparar a execução de estratégias de análise técnica.

**Parâmetros:**
*   `data` (Array|Object): Conjunto de dados contendo candles (pode ser um array de objetos, um objeto com a propriedade `candles` ou um único objeto de candle).
*   `ibovContext` (Object): Contexto adicional do índice IBOV (ou mercado geral) utilizado para correlação ou referência macroeconômica.

**Retorno:**
*   `Object|null`: Retorna o objeto processado e validado para análise ou `null` caso os dados sejam inválidos, insuficientes ou o formato seja irreconhecível.

**Uso:** Deve ser invocada como a primeira etapa em pipelines de análise de estratégias para garantir que os dados de entrada estejam padronizados, contendo o ticker, o preço atual e uma quantidade mínima de candles (recomendado 50) antes de aplicar indicadores técnicos.

---

## Função: `_obterContextoPrecos`
**Descrição:** Extrai e normaliza arrays de preços (fechamento, máxima e mínima) a partir de uma lista de objetos de candles.

**Parâmetros:**
* `candles` (Array de Objetos): Lista de objetos contendo as propriedades `close`, `high` e `low`.

**Retorno:**
* `Object`: Um objeto contendo três arrays (`closes`, `highs`, `lows`). Caso `high` ou `low` sejam nulos, o valor de `close` é utilizado como fallback.

**Uso:** Utilizada para preparar dados brutos de candles para cálculos de indicadores técnicos ou análise estatística, garantindo que não haja valores nulos nas séries de máxima e mínima.

---

## Função: `_calcularIndicadoresTecnicos`
**Descrição:** Função responsável por processar e consolidar um conjunto de indicadores técnicos financeiros a partir de dados de candles e preços de fechamento, incluindo mecanismos de fallback para garantir a continuidade da execução.

**Parâmetros:**
* `candles` (Array de Objetos): Lista de objetos contendo dados OHLCV (Open, High, Low, Close, Volume) necessários para cálculos baseados em volume e volatilidade.
* `closes` (Array de Números): Lista contendo apenas os valores de fechamento (close) dos períodos, utilizada para cálculos de médias e osciladores.

**Retorno:** (Objeto) Retorna um dicionário contendo os valores calculados de: `ema9`, `ema21`, `ema50`, `ema200`, `rsi`, `atr`, `vwma20`, `adx`, `bollinger` (objeto com upper, middle, lower, width) e `volumeRelativo`.

**Uso:** Utilizada como motor central de análise técnica dentro do script, sendo chamada para alimentar estratégias de trading ou dashboards com dados normalizados e protegidos contra erros de cálculo (fallback para valores neutros ou estimados).

---

## Função: `_analisarEstruturaMercado`
**Descrição:** Analisa a estrutura de mercado atual com base em níveis de Fibonacci e confluência com médias móveis (EMA) dentro de uma janela de tempo definida.

**Parâmetros:**
* `ctx` (Object): Objeto de contexto contendo arrays de preços máximos (`highs`) e mínimos (`lows`).
* `preco` (Number): Preço atual do ativo.
* `ind` (Object): Objeto contendo indicadores técnicos, especificamente as médias móveis `ema21` e `ema50`.
* `candles` (Array): Array de objetos representando os candles históricos para identificação de pivôs.

**Retorno:** (Object) Retorna um objeto contendo os níveis de Fibonacci calculados (`h50`, `l50`, `fibo618`, `fibo50`), um booleano indicando se o preço está na zona de Fibonacci (`inFiboZone`), um booleano de confluência técnica (`temConfluencia`) e o valor do último pivô de baixa identificado (`swingLow`).

**Uso:** Utilizada para identificar zonas de suporte/resistência dinâmicas e validar se o preço atual apresenta confluência técnica com médias móveis, auxiliando na tomada de decisão de entrada ou saída em estratégias de trading.

---

## Função: `_processarGestaoRisco`
**Descrição:** Esta função calcula os parâmetros de gestão de risco (stop loss) e define alvos de saída baseados em análise técnica, volatilidade (ATR) e níveis de Fibonacci para operações de trading.

**Parâmetros:**
*   `preco` (Number): Preço atual de entrada ou referência para o cálculo.
*   `atr` (Number): Valor do Average True Range para ajuste de volatilidade.
*   `estrutura` (Object): Objeto contendo níveis técnicos (`h50`, `l50`, `fibo50`, `fibo618`).
*   `candles` (Array): Histórico de candles para análise de pivôs e ruído.
*   `closes` (Array): Histórico de preços de fechamento.

**Retorno:** (Object) Retorna um objeto contendo o nível de `stop`, os `alvos` calculados, o `rr` (Risk/Reward) projetado e indicadores de validade da operação.

**Uso:** Utilizada no motor de análise (Core Analyzers) para automatizar a definição de stop loss técnico (ajustado pelo ruído do mercado) e alvos de lucro baseados em múltiplos de risco e níveis de retração/extensão de Fibonacci.

---

## Função: `_selecionarAlvo`
**Descrição:** Seleciona o primeiro nível de preço disponível que atenda a um critério mínimo de Risco/Retorno (RR) em relação ao preço atual e à distância do stop.

**Parâmetros:**
* `niveisDisponiveis` (Array): Lista de valores numéricos representando potenciais alvos de preço.
* `precoAtual` (Number): O valor de mercado atual utilizado como base para o cálculo.
* `stopDist` (Number): A distância absoluta do stop loss, utilizada para calcular o risco da operação.
* `minRR` (Number, opcional): O multiplicador mínimo de Risco/Retorno aceitável (padrão: 1.0).

**Retorno:** (Object) Um objeto contendo:
* `alvo` (Number|null): O valor do nível de preço selecionado ou null caso nenhum atenda aos critérios.
* `rr` (Number): O valor do Risco/Retorno calculado para o alvo selecionado.
* `source` (String|null): A identificação da origem técnica do nível (ex: 'H50', 'FIBO618') ou null.

**Uso:** Utilizada em estratégias de trading para filtrar automaticamente alvos de lucro (take profit) que garantam uma relação risco-retorno favorável, priorizando níveis técnicos pré-definidos (H50, Fibonacci, etc.).

---

## Função: `_identificarSetup`
**Descrição:** Analisa indicadores técnicos e métricas de risco para classificar o ativo em um setup operacional específico baseado em estratégias de Swing Trade e Momentum.

**Parâmetros:**
*   `rr` (Number): Relação Risco/Retorno do trade.
*   `inFibo` (Boolean): Indica se o preço está em zona de retração de Fibonacci.
*   `score` (Number): Pontuação de qualidade do ativo (0-100).
*   `preco` (Number): Preço atual do ativo.
*   `ind` (Object): Objeto contendo indicadores técnicos (`adx`, `volumeRelativo`, `ema9`, `ema21`, `ema50`).
*   `risco` (Number): Nível de risco calculado (não utilizado explicitamente no trecho fornecido).

**Retorno:**
*   `String`: Uma string descritiva contendo o nome do setup identificado (ex: "🎯 SWING IDEAL (FIBO + TENDÊNCIA)") ou `undefined` caso nenhum critério seja atendido.

**Uso:**
Utilizada no motor de análise (`DecisionEngine`) para filtrar e categorizar oportunidades de compra, permitindo a priorização de ativos com base em confluências de Fibonacci, força de tendência (ADX/EMAs) e qualidade técnica (Score).

---

## Função: `_core_getATR`
**Descrição:** Calcula o indicador Average True Range (ATR) de um conjunto de velas, utilizando uma média móvel suavizada (Wilder's Smoothing) para medir a volatilidade do mercado.

**Parâmetros:**
* `candles` (Array de Objetos): Lista de objetos contendo as propriedades `high`, `low` e `close`.
* `period` (Number): O número de períodos (janela) para o cálculo da média do True Range.

**Retorno:**
* `Number`: O valor do ATR calculado com 4 casas decimais ou um valor de fallback (2% do preço) caso os dados sejam insuficientes.

**Uso:** Utilizado para determinar a volatilidade atual de um ativo, sendo frequentemente aplicado para definir níveis de Stop Loss ou dimensionamento de posição com base na oscilação média dos preços.

---

## Função: `_core_getEMA`
**Descrição:** Calcula a Média Móvel Exponencial (EMA) de um conjunto de valores numéricos, aplicando um fator de suavização baseado no período especificado.

**Parâmetros:**
* `values` (Array): Lista de valores numéricos a serem processados.
* `period` (Number): O número de períodos para o cálculo da EMA.

**Retorno:** (Number) O valor da EMA arredondado para duas casas decimais ou a média aritmética simples caso o número de elementos seja inferior ao período. Retorna 0 se o array estiver vazio.

**Uso:** Utilizada em análises técnicas e financeiras para suavizar séries temporais, dando maior peso aos dados mais recentes. Se a quantidade de dados for insuficiente para o período, a função retorna a média simples dos dados disponíveis.

---

## Função: `_core_getRSI`
**Descrição:** Calcula o Índice de Força Relativa (RSI) de um conjunto de dados financeiros utilizando o método de suavização de Wilder.

**Parâmetros:**
* `values` (Array): Lista de valores numéricos (preços) em ordem cronológica.
* `period` (Number, opcional): O período de cálculo (padrão é 14).

**Retorno:** (Number) O valor do RSI resultante, variando de 0 a 100.

**Uso:** Utilizada para identificar condições de sobrecompra (geralmente > 70) ou sobrevenda (geralmente < 30) em séries temporais de preços, sendo invocada internamente pelo módulo de análise técnica.

---

## Função: `_core_getVWMA`
**Descrição:** Calcula a Média Móvel Ponderada pelo Volume (VWMA) baseada no preço típico (média de máxima, mínima e fechamento) dos candles fornecidos.

**Parâmetros:**
* `candles` (Array de Objetos): Lista de objetos contendo dados de mercado (`high`, `low`, `close`, `volume`).
* `period` (Number): O número de períodos (candles) a serem considerados no cálculo da média.

**Retorno:**
* `Number`: O valor calculado da VWMA ou o preço de fechamento do último candle caso não haja dados suficientes ou volume.

**Uso:** Utilizada para identificar tendências de preço ponderadas pelo volume de negociação; caso o array de candles seja menor que o período definido, a função retorna o preço de fechamento do último candle disponível como fallback.

---

## Função: `_core_getADX`
**Descrição:** Calcula o Índice de Direcionalidade Média (ADX) para medir a força de uma tendência utilizando o método de suavização de Wilder.

**Parâmetros:**
*   `candles` (Array de Objetos): Lista de velas contendo propriedades `high`, `low` e `close`.
*   `period` (Number, opcional): Período de cálculo (padrão é 14).

**Retorno:**
*   `Number`: O valor atual do ADX (escala de 0 a 100). Retorna 20 como valor de fallback em caso de erro ou dados insuficientes.

**Uso:** Utilizado para identificar a força de uma tendência de mercado; valores acima de 25 geralmente indicam uma tendência forte, enquanto valores abaixo de 20 sugerem um mercado sem tendência ou lateralizado.

---

## Função: `wilderSmooth`
**Descrição:** Calcula a média móvel suavizada de Wilder (Wilder's Smoothing) para uma série de dados, aplicando uma ponderação recursiva que reduz o atraso em relação a médias móveis simples.

**Parâmetros:**
* `arr` (Array): Conjunto de valores numéricos a serem processados.
* `period` (Variável Global/Escopo): Define o número de períodos utilizados para o cálculo da suavização.

**Retorno:**
* `Array`: Um array contendo os valores suavizados, onde os índices anteriores ao `period - 1` permanecem vazios ou não processados, e os índices a partir de `period - 1` contêm os resultados calculados.

**Uso:** Utilizada principalmente em indicadores de análise técnica (como o RSI ou ATR) para suavizar variações de preços ou osciladores, minimizando o ruído de mercado através de uma fórmula de média móvel exponencial adaptada.

---

## Função: `_core_getBollinger`
**Descrição:** Calcula as Bandas de Bollinger (superior, média e inferior) e a largura relativa com base em uma série histórica de preços de fechamento.

**Parâmetros:**
* `closes` (Array): Lista de valores numéricos representando os preços de fechamento.
* `period` (Number, opcional): Número de períodos para o cálculo da média móvel (padrão: 20).
* `mult` (Number, opcional): Multiplicador do desvio padrão para definir a largura das bandas (padrão: 2.0).

**Retorno:** (Object) Um objeto contendo as propriedades `upper` (banda superior), `middle` (média móvel simples), `lower` (banda inferior) e `width` (largura relativa das bandas), todos formatados com 4 casas decimais.

**Uso:** Ideal para análise técnica de ativos financeiros, permitindo identificar volatilidade e níveis de sobrecompra/sobrevenda. Caso o array de entrada seja menor que o período definido, a função retorna uma estimativa baseada na média simples com um desvio fixo de 5%.

---

## Função: `_core_getLogReturns`
**Descrição:** Calcula a série de retornos logarítmicos (log returns) a partir de uma lista de preços de fechamento.

**Parâmetros:**
* `closes` (Array de números): Uma lista contendo os valores de fechamento sequenciais (ex: preços de ativos financeiros).

**Retorno:**
* `Array de números`: Uma lista contendo os resultados de `ln(preço_atual / preço_anterior)` para cada par consecutivo válido.

**Uso:** Utilizada para normalizar variações de preços em análise técnica ou financeira, garantindo que os retornos sejam aditivos e tratando valores nulos ou negativos para evitar erros matemáticos.

---

## Função: `_core_getMedian`
**Descrição:** Calcula a mediana de um conjunto de dados numéricos, filtrando valores inválidos e ordenando a lista antes do processamento.

**Parâmetros:**
* `arr` (Array): Uma lista contendo valores numéricos (podendo incluir elementos não numéricos que serão ignorados).

**Retorno:**
* `Number`: O valor da mediana do conjunto de dados ou 0 caso o array esteja vazio ou não contenha números válidos.

**Uso:** Ideal para análises estatísticas onde é necessário encontrar o valor central de um conjunto de dados, garantindo que apenas números válidos sejam considerados e lidando corretamente com arrays de tamanho par ou ímpar.

---

## Função: `_core_getRobustSigma`
**Descrição:** Calcula o desvio absoluto da mediana (MAD) escalonado para estimar o desvio padrão robusto de um conjunto de dados.

**Parâmetros:**
* `arr` (Array): Uma lista de números a partir da qual o desvio robusto será calculado.

**Retorno:**
* `Number`: O valor do desvio padrão robusto, calculado como 1,4826 vezes a mediana dos desvios absolutos em relação à mediana.

**Uso:** Utilizado para identificar a dispersão estatística de um conjunto de dados de forma resistente a valores discrepantes (*outliers*), sendo uma alternativa mais estável que o desvio padrão convencional em distribuições não normais.

---

## Função: `_core_estimarRuidoEstatistico`
**Descrição:** Calcula a volatilidade estatística (sigma) dos retornos logarítmicos de uma série de preços de fechamento utilizando uma abordagem robusta.

**Parâmetros:**
* `candles` (Array/Objeto): Conjunto de dados de velas (atualmente não utilizado internamente, mantido para compatibilidade).
* `closes` (Array): Lista de preços de fechamento históricos.
* `period` (Number, opcional): Janela de tempo para o cálculo; padrão é 20.

**Retorno:** (Object) Um objeto contendo a propriedade `sigmaLogRet`, representando o desvio padrão robusto dos retornos logarítmicos.

**Uso:** Utilizado para quantificar o ruído ou a volatilidade recente de um ativo, baseando-se nos últimos `period + 1` fechamentos para derivar os retornos logarítmicos e aplicar um cálculo de sigma robusto.

---

## Função: `_core_noisePrice`
**Descrição:** Calcula o valor dinâmico de ruído de preço para definir limites de stop ou filtros de volatilidade, combinando desvio padrão logarítmico e ATR.

**Parâmetros:**
* `preco` (Number): O preço atual do ativo.
* `atr` (Number): O valor do Average True Range atual.
* `candles` (Array): Conjunto de dados de candles para análise estatística.
* `closes` (Array): Série histórica dos preços de fechamento.

**Retorno:** (Number) O valor absoluto do ruído, representando o limite mínimo de variação aceitável.

**Uso:** Utilizada para ajustar dinamicamente níveis de stop-loss ou filtros de entrada, garantindo que o ruído estatístico do mercado seja considerado além da volatilidade medida pelo ATR.

---

## Função: `_core_detectPivotLows`
**Descrição:** Identifica pontos de reversão de baixa (pivot lows) em uma série temporal de candles, verificando se um candle específico possui a mínima mais baixa em relação a um número definido de candles anteriores e posteriores.

**Parâmetros:**
* `candles` (Array): Lista de objetos representando os candles, contendo propriedades de `low` (mínima) ou `close` (fechamento).
* `leftBars` (Integer, opcional): Número de candles à esquerda para validar a mínima. Se omitido, utiliza `CORE22_CFG.pivotLeftBars`.
* `rightBars` (Integer, opcional): Número de candles à direita para validar a mínima. Se omitido, utiliza `CORE22_CFG.pivotRightBars`.

**Retorno:**
* `Array`: Uma lista de objetos, onde cada objeto contém o `index` (posição no array original) e o `price` (valor da mínima) dos pivots detectados. Retorna um array vazio se não houver dados suficientes.

**Uso:** Utilizada em estratégias de análise técnica para detectar suportes ou fundos de mercado, onde um candle é considerado um "pivot low" apenas se for estritamente menor que os `leftBars` anteriores e os `rightBars` posteriores.

---

## Função: `_core_getLastPivotLow`
**Descrição:** Identifica o preço do último fundo de pivô (pivot low) detectado em um conjunto de dados de velas dentro de um período de análise definido.

**Parâmetros:**
* `candles` (Array): Lista de objetos representando os dados das velas (OHLC).
* `lookback` (Number, opcional): Quantidade de velas recentes a serem consideradas na análise; utiliza `CORE22_CFG.swingLookback` como padrão.
* `leftBars` (Number, opcional): Número de velas à esquerda necessárias para confirmar o pivô; utiliza `CORE22_CFG.pivotLeftBars` como padrão.
* `rightBars` (Number, opcional): Número de velas à direita necessárias para confirmar o pivô; utiliza `CORE22_CFG.pivotRightBars` como padrão.

**Retorno:** (Number|null) O valor do preço do último pivô de baixa encontrado ou `null` caso nenhum pivô seja detectado ou os dados sejam insuficientes.

**Uso:** Utilizada para extrair o nível de suporte mais recente baseado na estrutura de pivôs, sendo essencial para estratégias de análise técnica que buscam identificar fundos de mercado em janelas de tempo específicas.

---

## Função: `_core_getVolumeRelativo`
**Descrição:** Calcula a razão entre o volume do candle mais recente e a mediana dos volumes de um período definido, servindo como indicador de força relativa do volume.

**Parâmetros:**
* `candles` (Array de Objetos): Lista de candles contendo a propriedade `volume`.
* `period` (Number, opcional): Quantidade de períodos anteriores a considerar para o cálculo da mediana (padrão: 20).

**Retorno:** (Number) Um valor decimal representando o volume relativo (ex: 1.5 significa que o volume atual é 50% maior que a mediana do período). Retorna 1.0 em caso de dados insuficientes ou erro.

**Uso:** Utilizado para identificar picos ou quedas anômalas de volume em relação à média histórica recente, auxiliando na confirmação de tendências ou reversões de preço.

---

## Função: `_determinarEstrategiaEntrada`
**Descrição:** Analisa o setup técnico, indicadores e estrutura de mercado para determinar a recomendação operacional (entrada, observação ou descarte) de um ativo.

**Parâmetros:**
*   `setup` (String): Identificador do padrão técnico detectado.
*   `score` (Number): Pontuação de qualidade do setup (0-100).
*   `estrutura` (Object): Objeto contendo dados de suporte/resistência (ex: `inFiboZone`, `fibo618`).
*   `preco` (Number): Preço atual do ativo.
*   `ind` (Object): Indicadores técnicos (ex: `adx`).
*   `risco` (Object/Number): Parâmetros de gerenciamento de risco.

**Retorno:** (String) Uma recomendação textual formatada indicando a ação a ser tomada (ex: "✅ ENTRAR AGORA", "🔭 AGUARDAR", "⛔ NÃO ENTRAR").

**Uso:** Esta função atua como o motor de decisão final do sistema de trading, processando os dados analíticos para converter sinais técnicos em instruções operacionais claras para o usuário ou para automação de ordens.

---

## Função: `DIAGNOSTICAR_INDICADORES`
**Descrição:** Realiza o diagnóstico técnico de um ativo financeiro, processando dados de mercado para calcular e exibir indicadores como ADX, Bandas de Bollinger, RSI, ATR, Volume Relativo e Médias Móveis Exponenciais (EMAs).

**Parâmetros:**
* `ticker` (String, opcional): O código do ativo financeiro a ser analisado (ex: "PETR4"). Caso não seja informado, utiliza "PETR4" como padrão.

**Retorno:**
* `Object`: Retorna um objeto contendo os valores calculados dos indicadores técnicos (ADX, Bollinger, RSI, ATR, Volume Relativo, EMA9, EMA21, EMA50, EMA200) ou `undefined` em caso de erro ou falta de dados.

**Uso:** A função é utilizada para validar a integridade dos dados de mercado e gerar um relatório de diagnóstico rápido no console, servindo como ponto de entrada para a análise técnica automatizada de ativos.

---

## Função: `TESTAR_FUNCAO_CORE`
**Descrição:** Função de teste automatizado para validar a execução da lógica de análise técnica (`STRATEGY_EVALUATE_CORE`) em uma lista pré-definida de ativos financeiros.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe os resultados da análise e logs de depuração no console do Google Apps Script.

**Uso:** Utilizada durante o desenvolvimento para verificar se o motor de estratégia processa corretamente os dados de mercado (`DataService.getMarketData`) e retorna os indicadores esperados (Score, Setup, ADX, Bollinger e Risco/Retorno) para uma amostra de tickers.

---

## Função: `LIMPAR_CACHE_E_TESTAR`
**Descrição:** Esta função realiza a limpeza seletiva de propriedades de script e de usuário (cache) relacionadas ao sistema B3, recarrega as configurações globais e reinicia o processo de execução do robô.

**Parâmetros:**
* Nenhum.

**Retorno:**
* `void`: A função não retorna valores, apenas executa operações de limpeza e dispara a função `executarRoboB3`.

**Uso:** Utilizada para resetar o estado do sistema em caso de inconsistências de dados, garantindo que o robô utilize configurações atualizadas da planilha e limpe registros temporários obsoletos (prefixos "B3_", "CACHE" ou "B3V10").

---

## Função: `calculateClassicPivotPoints`
**Descrição:** Calcula os níveis de suporte e resistência do método "Classic Pivot Points" com base nos preços de máxima, mínima e fechamento de um período.

**Parâmetros:**
* `high` (Number): Preço máximo do período anterior.
* `low` (Number): Preço mínimo do período anterior.
* `close` (Number): Preço de fechamento do período anterior.

**Retorno:** (Object) Um objeto contendo os valores calculados para o ponto de pivô (`pivot`), três níveis de resistência (`r1`, `r2`, `r3`) e três níveis de suporte (`s1`, `s2`, `s3`).

**Uso:** Utilizada em estratégias de análise técnica para identificar zonas de reversão ou continuação de tendência, sendo chamada passando os dados OHLC (Open, High, Low, Close) de um ativo.

---

## Função: `calculateWoodiePivotPoints`
**Descrição:** Calcula os níveis de suporte e resistência baseados na metodologia Woodie Pivot Points utilizando os preços de máxima, mínima e fechamento.

**Parâmetros:**
* `high` (Number): Preço máximo do período anterior.
* `low` (Number): Preço mínimo do período anterior.
* `close` (Number): Preço de fechamento do período anterior.

**Retorno:** (Object) Um objeto contendo as propriedades `pivot`, `r1`, `r2`, `s1` e `s2`, representando o ponto de pivô central e os dois níveis de resistência e suporte, respectivamente.

**Uso:** Utilizada em estratégias de análise técnica para identificar pontos de reversão ou rompimento de preços no mercado financeiro.

---

## Função: `calculateCamarillaPivotPoints`
**Descrição:** Calcula os níveis de suporte e resistência baseados na metodologia de pontos de pivô Camarilla utilizando os valores de máxima, mínima e fechamento.

**Parâmetros:**
* `high` (Number): O valor da máxima do período.
* `low` (Number): O valor da mínima do período.
* `close` (Number): O valor do fechamento do período.

**Retorno:** (Object) Um objeto contendo os valores calculados para o pivô central (`pivot`), quatro níveis de resistência (`r1` a `r4`) e quatro níveis de suporte (`s1` a `s4`).

**Uso:** Ideal para estratégias de day trading que buscam identificar zonas de reversão ou rompimento de preços, sendo comumente aplicado em análises técnicas dentro de planilhas Google Sheets via Google Apps Script.

---

## Função: `detectSwingPoints`
**Descrição:** Identifica os pontos de oscilação (swing high e swing low) através da análise dos valores máximos e mínimos dentro de uma janela de tempo definida.

**Parâmetros:**
* `candles` (Array de objetos): Lista de objetos contendo os dados de mercado, onde cada objeto deve possuir as propriedades `high` (máxima) e `low` (mínima).
* `lookback` (Number, opcional): Define o número de períodos (candles) anteriores a serem analisados. O valor padrão é 20.

**Retorno:** Objeto contendo `{ swingHigh: number, swingLow: number }` ou `{ swingHigh: null, swingLow: null }` caso o conjunto de dados seja insuficiente.

**Uso:** Utilizada para detectar níveis de suporte e resistência locais em estratégias de análise técnica, como o traçado de níveis de Fibonacci ou identificação de tendências de curto prazo.

---

## Função: `calculateAllFibonacciLevels`
**Descrição:** Calcula os níveis de retração de Fibonacci com base em um topo (swing high) e um fundo (swing low) fornecidos.

**Parâmetros:**
* `swingHigh` (Number): O valor do preço no topo do movimento.
* `swingLow` (Number): O valor do preço no fundo do movimento.

**Retorno:** (Object) Um objeto contendo chaves identificadoras (ex: 'F23.6') que mapeiam para objetos contendo o preço calculado e o nível percentual correspondente.

**Uso:** Utilizada em análises técnicas para identificar potenciais zonas de suporte ou resistência onde o preço pode reverter durante uma correção em uma tendência de alta.

---

## Função: `completeAnalysis`
**Descrição:** Processa uma série de candles para calcular níveis de suporte/resistência baseados em Pivôs Clássicos e retrações de Fibonacci, retornando um objeto consolidado com os dados técnicos.

**Parâmetros:**
*   `candles` (Array): Lista de objetos representando candles, onde cada objeto deve conter as propriedades `high`, `low` e `close`.

**Retorno:**
*   `Object`: Um objeto contendo:
    *   `pivots`: Resultado dos cálculos de pivôs clássicos.
    *   `fibonacci`: Objeto com todos os níveis calculados de Fibonacci.
    *   `fib618`: Valor numérico específico da retração de 61.8%.
    *   `price`: Preço de fechamento do último candle.
    *   `timestamp`: Data e hora da execução da análise.
    *   Retorna `null` caso o array de candles seja inválido ou insuficiente (menos de 2 candles).

**Uso:** Esta função serve como um orquestrador de indicadores técnicos. Ela deve ser chamada passando o histórico de preços para obter, em uma única estrutura, os níveis de suporte e resistência necessários para tomada de decisão em estratégias de trading automatizado no Google Sheets.

---

## Função: `getSecrets`
**Descrição:** Recupera valores de segredos de forma hierárquica, utilizando cache em memória, Google Cloud Secret Manager ou Script Properties como fallback.

**Parâmetros:**
* `secretNames` (Array de Strings): Lista contendo os nomes das chaves (segredos) que se deseja recuperar.

**Retorno:**
* `Object` ou `null`: Retorna um objeto contendo os pares chave-valor dos segredos encontrados ou `null` caso a entrada seja inválida ou nenhum segredo seja localizado.

**Uso:** A função deve ser chamada passando um array com os nomes das propriedades desejadas. Ela verifica automaticamente se os dados estão no cache (respeitando o tempo de expiração), tenta buscá-los no GCP Secret Manager e, em caso de falha ou ausência, recorre às Script Properties do projeto.

---

## Função: `getSecret`
**Descrição:** Recupera o valor de um segredo específico armazenado no sistema a partir de uma lista de chaves.

**Parâmetros:** 
* `name` (String): O identificador ou nome do segredo que se deseja recuperar.

**Retorno:** 
* (String|null): Retorna o valor do segredo correspondente ao nome fornecido, ou `null` caso o segredo não seja encontrado ou a operação falhe.

**Uso:** Utilizada como um wrapper simplificado para extrair um único valor de segredo, delegando a lógica de busca em lote para a função `getSecrets`.

---

## Função: `getProjectId`
**Descrição:** Recupera o identificador do projeto Google Cloud (GCP) configurado nas propriedades do script.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `string`: O ID do projeto GCP armazenado na chave 'GCP_PROJECT_ID' ou uma string vazia caso a propriedade não esteja definida.

**Uso:** Utilizada para obter o identificador do projeto de forma dinâmica, evitando o uso de valores fixos (hardcoded) no código e permitindo a integração com serviços do Google Cloud que exigem o ID do projeto.

---

## Função: `fetchFromGcp`
**Descrição:** Recupera os valores mais recentes de múltiplos segredos armazenados no Google Cloud Secret Manager utilizando a API REST e autenticação via OAuth do Google Apps Script.

**Parâmetros:**
* `projectId` (String): O ID do projeto no Google Cloud onde os segredos estão armazenados.
* `secretNames` (Array de Strings): Uma lista contendo os nomes dos segredos que se deseja recuperar.

**Retorno:**
* `Object|null`: Retorna um objeto onde as chaves são os nomes dos segredos e os valores são as strings decodificadas, ou `null` caso nenhum segredo seja recuperado com sucesso.

**Uso:** Ideal para centralizar o gerenciamento de credenciais ou chaves de API externas, permitindo que o script busque múltiplos segredos de forma dinâmica durante a execução, desde que o projeto tenha as permissões de acesso configuradas no IAM.

---

## Função: `fetchFromScriptProperties`
**Descrição:** Recupera um conjunto de valores armazenados nas propriedades de script do Google Apps Script com base em uma lista de chaves fornecida.

**Parâmetros:**
* `secretNames` (Array de Strings): Lista contendo os nomes das propriedades (chaves) que se deseja buscar no `ScriptProperties`.

**Retorno:**
* `Object` ou `null`: Retorna um objeto contendo os pares chave-valor encontrados. Retorna `null` caso nenhuma das chaves solicitadas exista no armazenamento.

**Uso:** Ideal para centralizar a leitura de configurações ou credenciais sensíveis armazenadas no ambiente de script, permitindo buscar múltiplas variáveis de uma só vez e validando a existência dos dados antes do processamento.

---

## Função: `getValuationBonus`
**Descrição:** Calcula um bônus de pontuação (score) para ativos financeiros com base em indicadores fundamentalistas de preço/lucro (P/L) e dividend yield.

**Parâmetros:**
* `ticker` (String): O código do ativo (ex: "PETR4.SA") utilizado para a busca de dados.

**Retorno:**
* `Number`: Um valor inteiro representando o bônus acumulado (pode ser positivo, negativo ou zero).

**Uso:** A função é utilizada para classificar ativos em uma estratégia de "caçador de ofertas", atribuindo maior pontuação a empresas com P/L baixo (subavaliadas) e dividendos elevados, enquanto penaliza empresas com prejuízo (P/L negativo).

---

## Função: `_getToken`
**Descrição:** Recupera o token de autenticação da API Brapi buscando prioritariamente no serviço `Secrets` ou, como alternativa, no objeto `CONFIG`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `String|null`: Retorna o valor do token (string) caso encontrado em qualquer uma das fontes, ou `null` caso o token não esteja definido em nenhum dos provedores.

**Uso:** 
* Esta função privada é utilizada internamente para autenticar requisições à API Brapi, garantindo uma camada de abstração para a obtenção de credenciais sensíveis de diferentes fontes de configuração.

---

## Função: `_waitIfNeeded`
**Descrição:** Implementa um mecanismo de controle de fluxo (rate limiting) para garantir um intervalo mínimo entre requisições consecutivas à API.

**Parâmetros:**
* Nenhum. (Utiliza as variáveis globais `_lastRequestTime` e `MIN_INTERVAL_MS`).

**Retorno:**
* `void`: A função não retorna valores, apenas pausa a execução do script se necessário.

**Uso:** Deve ser chamada antes de cada requisição HTTP em um loop ou sequência de chamadas para evitar o bloqueio por excesso de requisições (rate limit) do servidor Brapi.

---

## Função: `_isFailureCached`
**Descrição:** Verifica se uma falha de requisição para um determinado ticker está armazenada no cache local e ainda dentro do período de validade (TTL).

**Parâmetros:**
* `ticker` (String): O símbolo do ativo financeiro a ser verificado.

**Retorno:**
* `Boolean`: Retorna `true` se a falha estiver em cache e for recente, caso contrário, retorna `false`.

**Uso:** Utilizada internamente para evitar requisições repetidas a ativos que falharam recentemente, otimizando o desempenho e respeitando limites de taxa da API (rate limiting).

---

## Função: `_markFailure`
**Descrição:** Registra o momento exato da falha de uma requisição para um ticker específico no cache de erros.

**Parâmetros:** 
* `ticker` (String): O símbolo do ativo financeiro que apresentou erro na busca de dados.

**Retorno:** 
* `void`: Esta função não retorna valores.

**Uso:** Utilizada internamente para marcar um ticker como "indisponível" ou "com erro" no objeto `_failureCache`, permitindo que o sistema evite novas tentativas de consulta para o mesmo ativo por um determinado período.

---

## Função: `_clearFailure`
**Descrição:** Remove uma entrada específica de falha de carregamento do cache global de erros associada a um ticker de ativo.

**Parâmetros:** 
* `ticker` (String): O símbolo do ativo financeiro (ex: "PETR4") cuja falha deve ser limpa do cache.

**Retorno:** 
* `void`: Esta função não retorna nenhum valor.

**Uso:** Utilizada para resetar o estado de erro de um ticker específico no objeto `_failureCache`, permitindo que novas tentativas de busca de dados sejam realizadas sem o bloqueio prévio de uma falha anterior.

---

## Função: `fetchHistory`
**Descrição:** Recupera o histórico de preços diários de um ativo financeiro através da API Brapi, utilizando cache persistente e lógica de retentativa para otimizar requisições.

**Parâmetros:**
* `ticker` (String): O código do ativo (ex: "PETR4", "AAPL"). A função realiza a higienização automática removendo sufixos como ".SA" ou prefixos como "^".

**Retorno:**
* `Array<Object>|null`: Retorna um array de objetos contendo os dados históricos (`date`, `open`, `high`, `low`, `close`, `volume`, `ticker`) caso a requisição seja bem-sucedida, ou `null` em caso de erro, falha de autenticação ou ticker inválido.

**Uso:**
Utilizada para obter séries temporais de preços (últimos 3 meses) para análise técnica ou cálculos de indicadores. A função gerencia automaticamente o limite de chamadas (rate limiting) e verifica o cache do Google Apps Script antes de realizar uma chamada HTTP externa para economizar cotas de API.

---

## Função: `getQuoteBatch`
**Descrição:** Busca cotações de múltiplos ativos financeiros simultaneamente através da API Brapi, utilizando cache de falhas e tratamento de normalização de tickers.

**Parâmetros:**
* `tickers` (Array de Strings): Lista de símbolos de ativos (ex: `['PETR4.SA', 'VALE3']`) a serem consultados.

**Retorno:**
* `Object`: Um dicionário onde as chaves são os tickers originais informados e os valores são objetos contendo `price` (preço), `change` (variação), `volume` e `source` (fonte).

**Uso:**
A função normaliza os tickers (remove sufixos `.SA` e padroniza para maiúsculas), verifica um cache de falhas para evitar requisições desnecessárias a ativos problemáticos, executa chamadas individuais à API Brapi com controle de taxa (`_waitIfNeeded`) e retorna um objeto consolidado com os dados de mercado encontrados.

---

## Função: `TESTAR_TICKER_BRAPI`
**Descrição:** Função de diagnóstico para validar a conectividade e o recebimento de dados históricos de ativos financeiros através da API da Brapi.

**Parâmetros:**
* `ticker` (String): O código do ativo financeiro a ser consultado (ex: "PETR4", "VALE3").

**Retorno:**
* `void`: A função não retorna valores, apenas registra o status da requisição e a quantidade de dados históricos no console do Google Apps Script.

**Uso:** Utilizada para depuração (debug) de integrações com a API da Brapi, verificando se o token de autenticação está configurado corretamente e se o endpoint retorna os dados esperados para o ticker informado.

---

## Função: `colToLetter_`
**Descrição:** Converte um número de índice de coluna (base 1) para o formato de letra correspondente do Google Sheets (ex: 1 para "A", 27 para "AA").

**Parâmetros:**
* `col` (Number): O número inteiro da coluna que se deseja converter.

**Retorno:**
* `String`: A representação alfabética da coluna (ex: "A", "B", ..., "Z", "AA", "AB", etc.).

**Uso:** Utilizada para converter índices numéricos obtidos via métodos como `getColumn()` em referências de colunas compatíveis com a notação A1 do Google Sheets, facilitando a construção de strings de intervalo (ex: `A1:C10`).

---

## Função: `relacionarAbasDetalhado`
**Descrição:** Esta função automatiza a criação de um inventário detalhado de todas as fórmulas e cabeçalhos presentes em todas as abas de uma planilha Google, consolidando os dados em uma aba dedicada chamada "Índice Detalhado".

**Parâmetros:** 
* Nenhum parâmetro é exigido.

**Retorno:** 
* Não possui retorno (tipo `void`). A função realiza a escrita direta de dados na planilha ativa.

**Uso:** 
* Deve ser executada para gerar ou atualizar um relatório de auditoria da estrutura da planilha, permitindo visualizar rapidamente quais células contêm fórmulas, seus valores atuais e a correspondência com os cabeçalhos de cada coluna em todas as abas.

---

## Função: `criarRelatorioComoTexto`
**Descrição:** Esta função gera um relatório formatado em uma aba específica do Google Sheets, convertendo fórmulas em texto simples e aplicando formatação visual personalizada em lote para melhor legibilidade.

**Parâmetros:**
* `abaIndice` (GoogleAppsScript Sheet): Objeto da aba onde o relatório será escrito.
* `relatorioFormulas` (Array de Arrays): Matriz contendo os dados brutos, onde a primeira linha representa o cabeçalho e as subsequentes os dados (incluindo fórmulas).
* `relatorioCabecalhos` (Array): Lista de títulos ou definições de cabeçalho para o relatório.

**Retorno:**
* `void` (Não retorna valor, realiza apenas a escrita e formatação direta na planilha).

**Uso:** Utilizada para documentar ou auditar fórmulas de uma planilha, exibindo-as como texto (precedidas por apóstrofo) em uma aba de relatório, com destaque visual para colunas específicas (como fórmulas e valores) e uso de notas para rastreabilidade.

---

## Função: `exportarFormulasComoCSV`
**Descrição:** Esta função percorre todas as abas de uma planilha Google, identifica células que contêm fórmulas e exporta um relatório detalhado contendo o nome do arquivo, nome da aba, referência da célula (A1) e o conteúdo da fórmula para uma aba específica chamada "Exportação Fórmulas".

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* Nenhum (void). A função realiza a escrita direta dos dados na planilha ativa.

**Uso:** Ideal para auditoria, documentação ou backup de lógica de planilhas complexas, permitindo visualizar todas as fórmulas utilizadas no arquivo em um formato tabular centralizado e formatado como texto plano.

---

## Função: `GERAR_RELATORIO_TEXTO`
**Descrição:** Função de entrada que aciona o processo de geração de um relatório textual detalhado através da execução da rotina de mapeamento de abas.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa o procedimento de processamento de dados.

**Uso:** Deve ser chamada para iniciar a consolidação ou formatação de dados baseada nas abas e cabeçalhos definidos no projeto, delegando a lógica principal para a função `relacionarAbasDetalhado`.

---

## Função: `EXPORTAR_FORMULAS_CSV`
**Descrição:** Função de interface que aciona o processo de exportação de fórmulas de planilhas para o formato CSV.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* Nenhum (void).

**Uso:** Utilizada como ponto de entrada (wrapper) para disparar a lógica de exportação definida na função `exportarFormulasComoCSV` presente no mesmo projeto.

---

## Função: `ativarEnforcementProducao`
**Descrição:** Ativa o mecanismo de segurança de gerenciamento de segredos em ambiente de produção através de chamadas diretas de configuração e persistência de propriedades de script.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa operações de configuração e registra logs no console.

**Uso:** Deve ser executada durante o processo de deploy ou inicialização do ambiente de produção para garantir que as políticas de segurança de segredos sejam aplicadas via código e via persistência de propriedades (`PropertiesService`).

---

## Função: `executarAnaliseReal`
**Descrição:** Executa uma análise técnica de oportunidade de mercado para o ativo PETR4 utilizando a integração com a API de Inteligência Artificial.

**Parâmetros:** 
* N/A (A função utiliza dados fixos definidos internamente no escopo).

**Retorno:** 
* `String`: Retorna o parecer ou resultado da análise gerado pela função `AIApiUtils.analyzeOpportunity`.

**Uso:** 
* Utilizada para disparar um processo de avaliação automatizada de um ativo específico, servindo como ponto de entrada para testes de integração entre os dados técnicos locais e o motor de IA.

---

## Função: `configurarProducao`
**Descrição:** Esta função automatiza a transição do ambiente de desenvolvimento para o de produção, validando credenciais críticas e aplicando restrições de performance e log.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa operações de configuração e registra logs no console.

**Uso:** Deve ser executada ao realizar o deploy do projeto para garantir que todas as chaves de API estejam presentes e que o sistema opere com parâmetros otimizados (nível de log reduzido, modo debug desativado e processamento de lotes conservador).

---

## Função: `planoEmergenciaEnforcement`
**Descrição:** Função de contingência projetada para desativar forçadamente mecanismos de segurança (Enforcement) em caso de falha crítica ou bloqueio de acesso no Google Apps Script.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa ações de sistema e exibe logs de instrução no console.

**Uso:** Deve ser executada manualmente em cenários de emergência onde o sistema de gerenciamento de segredos impede a execução normal do script, servindo como um "botão de pânico" para restaurar o acesso às configurações originais através da alteração de propriedades de script e orientações de reversão manual.

---

## Função: `PROCESSAR_OPORTUNIDADES_FINAL`
**Descrição:** Função de entrada que aciona o método de execução principal da classe `OportunidadesProcessor` para processar oportunidades de negócio.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valor, apenas executa a lógica contida na classe `OportunidadesProcessor`.

**Uso:** Deve ser chamada por gatilhos (triggers) do Google Apps Script ou manualmente para iniciar o fluxo de processamento de oportunidades definido no arquivo `29_Oportunidades_Processor.js`.

---

## Função: `emitirGuiaMensal`
**Descrição:** Automatiza a geração e exibição de uma guia DARF para um período mensal específico, realizando validações fiscais e integrando-se ao motor de cálculo de impostos.

**Parâmetros:**
*   `mes` (Number, opcional): O mês de referência (1-12). Se omitido, o sistema calcula automaticamente o mês anterior.
*   `ano` (Number, opcional): O ano de referência (ex: 2023). Se omitido, o sistema calcula automaticamente com base na data atual.

**Retorno:**
*   `void`: A função não retorna valores, mas exibe alertas na interface do usuário (UI) ou renderiza um modal HTML com os dados da guia caso o imposto seja devido.

**Uso:**
Deve ser chamada a partir de um menu personalizado ou gatilho na planilha. A função valida se o período solicitado já foi encerrado, verifica a existência do módulo `TaxCalculator` e, caso o imposto apurado seja igual ou superior a R$ 10,00, exibe o resumo do DARF para o usuário.

---

## Função: `enviarDarfPorEmail`
**Descrição:** Automatiza o envio de um resumo fiscal mensal por e-mail, executado condicionalmente apenas no primeiro dia útil de cada mês.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas realiza o envio de e-mail via `GmailApp` e registra logs no console.

**Uso:** Deve ser configurada como um gatilho (trigger) de tempo no Google Apps Script para execução mensal, garantindo que o usuário receba o cálculo do imposto (DARF) referente ao mês anterior de forma automatizada.

---

## Função: `_isPrimeiroDiaUtil`
**Descrição:** Verifica se a data fornecida corresponde ao primeiro dia útil do mês, considerando fins de semana e feriados.

**Parâmetros:**
* `data` (Date): O objeto de data a ser validado.

**Retorno:**
* `Boolean`: Retorna `true` se a data for o primeiro dia útil do mês, caso contrário, retorna `false`.

**Uso:** Utilizada para identificar o início do ciclo de processamento mensal ou prazos que dependem do primeiro dia útil, integrando-se opcionalmente com a biblioteca `ComplianceUnified` para validação de feriados.

---

## Função: `_exibirModal`
**Descrição:** Exibe uma janela modal personalizada contendo conteúdo HTML dentro da interface do Google Sheets.

**Parâmetros:**
* `html` (String): O conteúdo HTML ou o nome do arquivo `.html` a ser renderizado.
* `titulo` (String): O texto que aparecerá na barra de título da janela modal.
* `w` (Number): A largura da janela em pixels.
* `h` (Number): A altura da janela em pixels.

**Retorno:** `void` (Não retorna valor, apenas executa a renderização da interface).

**Uso:** Utilizada para abrir pop-ups de interação com o usuário (como formulários ou avisos) sobre a planilha ativa, bloqueando a interação com o restante da interface até que o modal seja fechado.

---

## Função: `MENU_FISCAL_CALCULAR_MES_ANTERIOR`
**Descrição:** Aciona o fluxo de geração de guias DARF referente ao mês anterior através da classe controladora DARFGenerator.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, executando apenas o processamento interno de emissão.

**Uso:** Utilizada como ponto de entrada (trigger) a partir de um menu personalizado na interface do Google Sheets para automatizar a criação de guias fiscais do período imediatamente anterior.

---

## Função: `MENU_FISCAL_RECALCULAR_TUDO`
**Descrição:** Função de interface que solicita confirmação do usuário para disparar o processo de recálculo completo do histórico fiscal baseado nas notas de corretagem.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valor, apenas executa ações na interface (UI) e dispara a função de processamento.

**Uso:** Acionada via menu personalizado na planilha para resetar e reconstruir as abas 'IRPF_Resumo_Anual' e 'DARF_Mensal', garantindo a integridade dos dados fiscais a partir da fonte primária (notas de corretagem).

---

## Função: `ENVIAR_DARF_MENSAL_AUTOMATICO`
**Descrição:** Função gatilho responsável por disparar o processo de envio automático de guias DARF por e-mail através da classe controladora `DARFGenerator`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa a rotina de envio definida na classe `DARFGenerator`.

**Uso:** Utilizada principalmente como função de entrada para acionadores (triggers) baseados em tempo do Google Apps Script, permitindo a automação do envio mensal das guias sem intervenção manual.

---

## Função: `syncPortfolio`
**Descrição:** Sincroniza automaticamente as cotações de ativos em uma planilha de carteira de investimentos, utilizando mapeamento dinâmico de colunas e requisições em lote para otimização de performance.

**Parâmetros:**
* Esta função não recebe parâmetros de entrada.

**Retorno:**
* `void`: A função não retorna valores, realizando a atualização direta dos dados na planilha ativa ou registrando erros no console.

**Uso:**
* Deve ser executada dentro do ambiente Google Apps Script vinculado à planilha de controle financeiro. A função identifica automaticamente as colunas de "Ticker" e "Preço" independentemente da ordem, extrai os ativos listados e utiliza o serviço `DataService` para buscar cotações atualizadas de forma eficiente, evitando chamadas individuais excessivas à API.

---

## Função: `EXECUTAR_SINCRONIZACAO_CARTEIRAS`
**Descrição:** Função de entrada que aciona o processo de sincronização de dados de carteiras através da classe `PortfolioRebalancer`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valor, executando a lógica internamente no objeto `PortfolioRebalancer`.

**Uso:** Deve ser utilizada como gatilho (trigger) ou chamada manual para iniciar a atualização dos dados das carteiras de investimentos no sistema.

---

## Função: `VERIFICAR_CONSISTENCIA_FISCAL`
**Descrição:** Realiza a consolidação e o log dos totais de Lucro/Prejuízo e IR Fonte acumulados na aba "Notas de Corretagem" para fins de conferência fiscal.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe os resultados processados no console do Google Apps Script.

**Uso:** 
* Deve ser executada manualmente ou via gatilho para validar se os valores somados na planilha de notas de corretagem estão consistentes com os cálculos esperados, utilizando as colunas de índice 2 (Lucro/Prejuízo) e 3 (IR Fonte).

---

## Função: `instalarAutomacao`
**Descrição:** Inicializa a configuração do sistema de automação e exibe uma notificação visual ao usuário confirmando a ativação.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valor, apenas executa a lógica de configuração e dispara um alerta na interface do Google Sheets.

**Uso:** Deve ser executada para ativar os gatilhos ou configurações iniciais do script `AutomacaoSetup`, sendo ideal para ser chamada via menu personalizado ou botão na planilha.

---

## Função: `desinstalarAutomacao`
**Descrição:** Remove as configurações da automação e altera o status operacional do sistema para o modo manual.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valor, apenas executa a desinstalação e exibe um alerta na interface do usuário.

**Uso:** 
* Deve ser executada quando houver a necessidade de interromper as rotinas automáticas da planilha, revertendo o sistema para o controle manual e notificando o usuário através de um alerta na interface do Google Sheets.

---

## Função: `criarConfiguracaoPadrao`
**Descrição:** Esta função inicializa e retorna um objeto contendo os parâmetros de configuração padrão, limites operacionais e pesos de pontuação para um sistema de análise de ativos.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Object`: Um objeto contendo constantes de indicadores técnicos (RSI, ATR, Volume, Score), pesos ponderados para cálculo de decisão e um template de prompt para processamento de linguagem natural (NLP).

**Uso:** 
* Utilizada para definir as configurações iniciais do sistema ou restaurar valores padrão caso o arquivo de configuração do usuário não seja encontrado ou esteja corrompido.

---

## Função: `criarTestesCalibracao`
**Descrição:** Esta função gera um conjunto de dados de teste (mock) estruturados para validar a lógica de decisão de um sistema de calibragem de setups operacionais.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Array<Object>`: Uma lista de objetos contendo o nome do cenário de teste, os dados de entrada (ticker, score, tipo de setup, tendência e indicadores técnicos) e o resultado esperado para a validação da regra de negócio.

**Uso:** Utilizada em suítes de testes automatizados ou scripts de validação para verificar se o motor de decisão do sistema de trading classifica corretamente os ativos entre "EXECUTAR", "DESCARTAR" ou "AGUARDAR" com base em parâmetros técnicos pré-definidos.

---

## Função: `_cfg`
**Descrição:** Função utilitária que recupera valores de configuração de um objeto global `CONFIG` com suporte a valor padrão (fallback).

**Parâmetros:**
* `key` (String): A chave identificadora da configuração a ser buscada.
* `fallback` (Any): O valor a ser retornado caso a configuração não seja encontrada ou o objeto global não esteja disponível.

**Retorno:** (Any) O valor associado à chave no objeto `CONFIG` ou o valor `fallback` fornecido.

**Uso:** Utilizada para acessar configurações do sistema de forma segura, evitando erros caso o objeto `CONFIG` não tenha sido inicializado ou a chave não exista.

---

## Função: `_clampScore`
**Descrição:** Normaliza um valor numérico para um intervalo fechado entre 0 e 100, garantindo que o resultado seja um número inteiro.

**Parâmetros:** 
* `value` (any): O valor a ser processado, que pode ser um número, string numérica ou outro tipo convertível.

**Retorno:** 
* `Number`: Um valor inteiro entre 0 e 100. Se a entrada for inválida ou não finita, retorna 0.

**Uso:** Utilizada para sanitizar pontuações ou métricas de decisão, assegurando que fiquem dentro dos limites esperados (0-100) e sem casas decimais.

---

## Função: `_normalizeSentiment`
**Descrição:** Normaliza strings de entrada contendo descrições de sentimento de mercado em categorias padronizadas para o motor de decisão.

**Parâmetros:**
* `raw` (String/Any): O valor bruto representando o sentimento (ex: "Alta", "Bad", "Bullish").

**Retorno:**
* `String`: Retorna uma das categorias normalizadas: 'TERRIBLE', 'BEARISH', 'CAUTELA', 'EXCELLENT', 'BULLISH', 'OTIMISTA' ou 'NEUTRAL'.

**Uso:** Utilizada para padronizar dados de entrada heterogêneos (provenientes de APIs ou inputs manuais) antes de processar regras de negócio, garantindo que o sistema interprete corretamente o sentimento do mercado. Caso o valor não seja reconhecido, a função emite um aviso no console e retorna 'NEUTRAL' por padrão.

---

## Função: `_sentimentBonus`
**Descrição:** Calcula o valor de bônus ou penalidade financeira com base em uma classificação de sentimento fornecida.

**Parâmetros:**
* `sentiment` (String): A chave que representa o sentimento (ex: 'EXCELLENT', 'BEARISH', 'NEUTRO').

**Retorno:**
* `Number`: O valor numérico correspondente ao bônus ou penalidade; retorna 0 caso o valor não seja numérico ou não seja encontrado.

**Uso:** A função mapeia o sentimento para uma chave de configuração global via `_cfg`. Se a chave não existir no `keyMap`, tenta buscar o valor diretamente em `CFG.SENTIMENT_BONUS` como fallback, garantindo sempre um retorno numérico para cálculos de decisão.

---

## Função: `_contains`
**Descrição:** Verifica se um valor específico está presente em um array, retornando um valor booleano.

**Parâmetros:**
* `list` (Array): A lista ou array onde a busca será realizada.
* `value` (Any): O elemento que se deseja verificar a existência dentro da lista.

**Retorno:** (Boolean) Retorna `true` se o valor for encontrado na lista, caso contrário, retorna `false`.

**Uso:** Utilizada para validar a existência de itens em coleções de dados, sendo uma alternativa simplificada ao método nativo `includes()` do JavaScript.

---

## Função: `_threshold`
**Descrição:** Define o valor de corte (threshold) para a tomada de decisão, mantendo um valor fixo independente da aplicação de flexibilidade técnica.

**Parâmetros:**
* `options` (Object): Objeto contendo configurações ou parâmetros contextuais da operação (atualmente não utilizado na lógica).
* `flexApplied` (Boolean): Indicador booleano que sinaliza se o ativo possui qualidade técnica (score >= 50 e ADX >= 20).

**Retorno:**
* `Number`: Retorna o valor constante definido em `CFG.DEFAULT_THRESHOLD` (atualmente 55).

**Uso:** Utilizada pelo motor de decisão para padronizar o critério de entrada, garantindo que a aplicação de filtros de flexibilidade não eleve indevidamente a barreira de entrada do ativo.

---

## Função: `_reject`
**Descrição:** Registra o evento de rejeição de uma operação no histórico de auditoria e retorna um objeto estruturado com o status de recusa e os dados consolidados da decisão.

**Parâmetros:**
* `ctx` (Object): Contexto da operação contendo o histórico de auditoria (`auditTrail`) e dados da operação (`op`).
* `reason` (String): O motivo detalhado pelo qual a operação foi rejeitada.
* `score` (Number): Pontuação calculada para a decisão, que será normalizada pela função `_clampScore`.
* `sentiment` (String, opcional): Sentimento associado à análise; caso não fornecido, utiliza o valor do contexto ou 'UNKNOWN'.
* `stage` (String, opcional): Etapa do processo onde a rejeição ocorreu; padrão é 'REJECT'.

**Retorno:** (Object) Um objeto contendo o status 'REJECTED', o score normalizado, o motivo, o preço Fibonacci (se disponível), alocação sugerida zero, relatório formatado e o histórico de auditoria atualizado.

**Uso:** Deve ser invocada pelo motor de decisão sempre que uma operação não atender aos critérios de aprovação, garantindo que o log de auditoria seja atualizado e o fluxo de execução receba uma resposta padronizada de rejeição.

---

## Função: `evaluate`
**Descrição:** Processa a avaliação de uma oportunidade de investimento aplicando filtros de memória, análise de sentimento (técnica ou via NLP) e verificações de risco para decidir pela aprovação ou rejeição da operação.

**Parâmetros:**
*   `input` (Object): Objeto contendo os dados necessários para a avaliação:
    *   `op` (Object): Dados da oportunidade (ticker, score, sentiment, news).
    *   `memoria` (Object): Histórico do ativo (penaltyPoints, drawdownLevel, flags de blacklist).
    *   `analise` (Object): Análise complementar (opcional).
    *   `macroRegime` (String): Regime de mercado atual (default: 'NEUTRAL').
    *   `riskCheckFn` (Function): Callback para validação de risco adicional.

**Retorno:**
*   `Object`: Retorna um objeto de contexto (`ctx`) contendo o status da decisão, trilha de auditoria (`auditTrail`), sentimento final e, em caso de rejeição, a justificativa e o código do erro.

**Uso:**
Utilizada como motor de decisão central para filtrar oportunidades de trading, integrando dados históricos de desempenho do ativo com análises de sentimento em tempo real (NLP) para validar se uma operação deve prosseguir ou ser descartada.

---

## Função: `_cfg`
**Descrição:** Função utilitária para recuperar valores de configuração de forma segura, verificando a existência do objeto global `CONFIG`.

**Parâmetros:**
* `key` (String): A chave do parâmetro de configuração a ser buscado.
* `fallback` (Any): O valor padrão a ser retornado caso a chave não exista ou o objeto `CONFIG` não esteja disponível.

**Retorno:** (Any) O valor associado à chave no objeto `CONFIG` ou o valor `fallback` fornecido.

**Uso:** Utilizada para acessar configurações do sistema de forma resiliente, evitando erros de referência caso o objeto `CONFIG` não tenha sido inicializado no escopo global.

---

## Função: `_scoreMinimo`
**Descrição:** Recupera o valor de pontuação mínima configurado para a execução de processos de IA, utilizando um valor padrão caso a configuração não esteja definida.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Number`: O valor numérico do score mínimo (priorizando a chave 'IA_SCORE_MINIMO' ou retornando 65 como fallback).

**Uso:** Utilizada internamente para validar se o resultado de uma análise de IA atende aos critérios de qualidade necessários antes de prosseguir com a execução de uma tarefa.

---

## Função: `_normalizeSentiment`
**Descrição:** Normaliza um valor de sentimento bruto utilizando um motor de decisão externo ou retorna um valor padrão caso o motor não esteja disponível.

**Parâmetros:** 
* `raw` (any): O valor ou dado de sentimento bruto que será processado.

**Retorno:** 
* `string`: Retorna o sentimento normalizado (ex: 'POSITIVE', 'NEGATIVE', 'NEUTRAL') conforme definido pelo `DecisionEngine` ou 'NEUTRAL' como fallback.

**Uso:** Utilizada como uma camada de abstração para garantir que a aplicação receba um formato de sentimento consistente, delegando a lógica de negócio para o objeto `DecisionEngine` se este estiver carregado no escopo.

---

## Função: `_calcularBonus`
**Descrição:** Calcula o bônus de sentimento para um objeto canônico, delegando a lógica ao motor de decisão caso esteja disponível.

**Parâmetros:**
* `canonical` (Object): O objeto de dados canônico que contém as informações necessárias para a análise de sentimento.

**Retorno:**
* `Number`: O valor do bônus calculado ou 0 caso o motor de decisão não esteja definido ou a função não exista.

**Uso:** Utilizada internamente para aplicar ajustes de pontuação baseados em análise de sentimento, verificando dinamicamente a existência do objeto `DecisionEngine` antes da execução.

---

## Função: `_consultarMemoria`
**Descrição:** Recupera o contexto de memória armazenado para um ativo e tipo de setup específicos, utilizando a biblioteca `AgentMemory`.

**Parâmetros:**
* `ticker` (String): O símbolo do ativo financeiro a ser consultado.
* `setupType` (String): O identificador do tipo de setup operacional associado ao ativo.

**Retorno:**
* (Object): Retorna o objeto de contexto contendo `{ text, isBadTicker, inDrawdown }` se bem-sucedido, ou um objeto padrão com valores vazios/falsos em caso de erro ou indisponibilidade.

**Uso:** Utilizada pelo orquestrador para verificar o histórico ou estado atual de um ativo na memória do agente antes de tomar decisões operacionais, garantindo resiliência caso o serviço de memória esteja indisponível.

---

## Função: `_consultarAnalista`
**Descrição:** Processa indicadores técnicos (ADX, Bandas de Bollinger e OBV) de um ativo financeiro para preparar um objeto de dados estruturado para o agente de análise de IA.

**Parâmetros:**
*   `ticker` (String): O código do ativo financeiro a ser analisado.
*   `op` (Object): Objeto contendo os dados de mercado e indicadores técnicos (ex: `price`, `indicators`, `adx`, `volumeRelativo`, `bollinger`).

**Retorno:**
*   `Object` ou `null`: Retorna um objeto contendo os dados formatados para a IA (`ticker`, labels de indicadores, tendência OBV) ou `null` caso a dependência `AgentAnalyst` não esteja disponível.

**Uso:** Utilizada pelo orquestrador de agentes para consolidar métricas técnicas brutas em descrições textuais interpretáveis, permitindo que o `AgentAnalyst` tome decisões baseadas em contexto técnico (ex: identificar se o preço está fora das Bandas de Bollinger ou a força da tendência via ADX).

---

## Função: `_consultarRisco`
**Descrição:** Avalia o risco de uma operação financeira através do módulo `AgentRiskManager`, aplicando uma política de fallback caso o serviço esteja indisponível.

**Parâmetros:**
* `op` (Object): Objeto contendo os dados da operação, incluindo obrigatoriamente o atributo `ticker`.

**Retorno:**
* `Object`: Retorna um objeto contendo `approved` (boolean), `reason` (string) e `suggested_allocation` (number).

**Uso:** Utilizada pelo orquestrador para validar se uma operação está dentro dos limites de risco antes da execução; se o `AgentRiskManager` não estiver carregado ou falhar, a função assume uma aprovação automática (fallback) com alocação total.

---

## Função: `_getThreshold`
**Descrição:** Retorna o valor numérico definido como pontuação mínima aceitável para a orquestração de agentes.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Number`: O valor do limite (threshold) configurado na função `_scoreMinimo()`.

**Uso:** Utilizada internamente para encapsular a chamada da regra de negócio que define o score mínimo, permitindo que outras funções do orquestrador validem se um agente ou processo atingiu o requisito necessário.

---

## Função: `processOpportunity`
**Descrição:** A função orquestra o processo de validação de oportunidades de investimento, integrando dados de memória, análise técnica e regras de risco para obter uma decisão final do motor de regras.

**Parâmetros:**
* `op` (Object): Objeto contendo os dados da oportunidade, incluindo obrigatoriamente o `ticker` e opcionalmente `score` e `setupType`.
* `macroRegime` (String): Define o cenário macroeconômico atual (ex: 'BULLISH', 'BEARISH', 'NEUTRAL') para contextualizar a decisão.

**Retorno:**
* `Object`: Retorna um objeto de decisão contendo o `status` (ex: 'APPROVED', 'REJECTED'), `score` final, `sentiment` e o `motivo` da decisão. Em caso de erro ou falha, retorna um objeto de rejeição padronizado.

**Uso:** É utilizada como ponto central de decisão no fluxo de agentes, sendo chamada após a coleta de dados básicos para validar se uma oportunidade deve ser executada com base no `DecisionEngine` e nas verificações de risco em tempo real.

---

## Função: `_rejeitarCom`
**Descrição:** Constrói um objeto de resposta padronizado indicando a rejeição de uma operação financeira com seus respectivos metadados e justificativa.

**Parâmetros:**
* `motivo` (String): A descrição ou causa da rejeição da operação.
* `op` (Object): Objeto contendo os dados da operação (espera-se que contenha `ticker` e `fiboPrice`).
* `sentiment` (String): Classificação do sentimento associado à análise (opcional).
* `score` (Number): Pontuação numérica atribuída à análise (opcional).

**Retorno:** (Object) Um objeto contendo o status 'REJECTED', os dados de análise (score, sentiment, motivo), o preço Fibonacci, alocação sugerida zerada e um relatório formatado em string.

**Uso:** Utilizada internamente pelo orquestrador de agentes para padronizar o formato de saída quando uma operação não atende aos critérios de validação ou estratégia, facilitando a integração com sistemas de log ou interfaces de usuário.

---

## Função: `_log`
**Descrição:** Registra no console do Google Apps Script um log formatado com o status da decisão de análise de um ativo financeiro.

**Parâmetros:**
* `decisao` (String): O resultado da análise ('APROVADO' ou outro valor).
* `ticker` (String): O símbolo do ativo financeiro (ex: 'PETR4').
* `sentiment` (String): A classificação de sentimento identificada (ex: 'Positivo', 'Negativo').
* `scoreOriginal` (Number/String): O valor da pontuação antes da normalização ou ajuste.
* `scoreFinal` (Number/String): O valor da pontuação após o processamento final.
* `motivo` (String): A justificativa ou descrição do critério utilizado para a decisão.

**Retorno:** `void` (Não retorna valor, apenas exibe a mensagem no console).

**Uso:** Utilizada internamente pelo orquestrador para monitorar o fluxo de decisão de cada ativo, exibindo um resumo visual (ícone, ticker, decisão e variação de score) para depuração e auditoria no log de execução.

---

## Função: `_sanitizarMemoria`
**Descrição:** Função de segurança responsável por higienizar strings de histórico de memória, removendo tentativas de *prompt injection* e caracteres estruturais para garantir a integridade do contexto enviado à IA.

**Parâmetros:**
* `texto` (String): O conteúdo do histórico ou memória que será processado e validado.

**Retorno:**
* `String`: O texto sanitizado, com padrões maliciosos substituídos, caracteres especiais removidos e truncado em até 300 caracteres.

**Uso:** Deve ser utilizada antes de injetar qualquer dado externo ou histórico de conversas no *prompt* do modelo de linguagem (LLM), prevenindo que o sistema sofra manipulação de comportamento ou quebra de formato JSON.

---

## Função: `_cfg`
**Descrição:** Função utilitária que recupera valores de configuração de um objeto global `CONFIG` com suporte a valor padrão (fallback).

**Parâmetros:**
* `key` (String): A chave identificadora da configuração a ser buscada.
* `fallback` (Any): O valor a ser retornado caso a configuração não seja encontrada ou o objeto `CONFIG` não esteja disponível.

**Retorno:** (Any) O valor associado à chave no objeto `CONFIG` ou o valor `fallback` fornecido.

**Uso:** Utilizada para acessar configurações do sistema de forma segura, evitando erros caso o objeto global `CONFIG` não tenha sido inicializado ou a chave não exista.

---

## Função: `_getSectorMap`
**Descrição:** Recupera o mapeamento de setores de ativos através do gerenciador global `B3V10_TICKER_MANAGER`, com fallback para um objeto vazio caso a dependência não esteja disponível.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Object`: Um objeto contendo o mapeamento de setores ou um objeto vazio `{}` caso o gerenciador não esteja definido.

**Uso:** Utilizada internamente para obter a classificação setorial de ativos financeiros, garantindo a resiliência do sistema ao verificar a existência do objeto `B3V10_TICKER_MANAGER` antes da execução.

---

## Função: `_cfg`
**Descrição:** Função utilitária que recupera valores de configuração de um objeto global `CONFIG` com suporte a valor padrão (fallback).

**Parâmetros:**
* `key` (String): A chave identificadora da configuração a ser buscada.
* `fallback` (Any): O valor a ser retornado caso a configuração não seja encontrada ou o objeto `CONFIG` não esteja disponível.

**Retorno:** (Any) O valor associado à chave no objeto `CONFIG` ou o valor `fallback` fornecido.

**Uso:** Utilizada para acessar variáveis de ambiente ou configurações do sistema de forma segura, evitando erros caso o objeto `CONFIG` não tenha sido inicializado ou a chave não exista.

---

## Função: `getContext`
**Descrição:** A função `getContext` compila dados históricos de performance do portfólio e tendências específicas de ativos para fornecer um contexto informativo ao LLM, auxiliando na calibração do *ai_score*.

**Parâmetros:**
* `ticker` (String): O símbolo do ativo financeiro a ser analisado.
* `setupType` (String): O tipo de configuração ou estratégia operacional sendo avaliada.

**Retorno:**
* `Array` (String[]): Uma lista de sentenças descritivas que consolidam o estado atual do portfólio (drawdown, win rate) e o viés histórico do ativo, formatadas para consumo por modelos de linguagem.

**Uso:** Utilizada no pipeline de decisão do agente para injetar "memória" sobre o estado atual da conta e o histórico do ativo, permitindo que o LLM ajuste sua propensão ao risco com base em fatos, sem emitir ordens diretas.

---

## Função: `_classifyDrawdown`
**Descrição:** Classifica o nível de risco de um *drawdown* (ou performance) com base na taxa de acerto (*win rate*) fornecida, utilizando limites configuráveis.

**Parâmetros:** 
* `winRate` (Number): Valor numérico representando a taxa de acerto atual a ser avaliada.

**Retorno:** 
* `String`: Retorna uma categoria de risco ('CRITICO', 'MODERADO', 'LEVE' ou 'NORMAL').

**Uso:** Utilizada para monitorar a saúde da estratégia, onde a função compara o `winRate` contra limites definidos em `CFG` (configurações globais), retornando o status de severidade para tomada de decisão automatizada.

---

## Função: `_getRecentPerformance`
**Descrição:** Recupera as métricas de performance (taxa de acerto e total de operações) a partir da planilha de logs do agente, aplicando tratamentos de formatação e validação de dados.

**Parâmetros:** 
* Nenhum. (A função utiliza a constante global `CFG.ABA_LOG_PERF` para localizar a aba de dados).

**Retorno:** 
* `Object`: Um objeto contendo `winRate` (número, percentual de acertos) e `totalTrades` (número, quantidade total de operações). Em caso de erro ou ausência de dados, retorna `{ winRate: 50, totalTrades: 0 }`.

**Uso:** 
* Utilizada pelo módulo de memória do agente para obter o histórico recente de performance, permitindo que o sistema ajuste seu comportamento com base na taxa de sucesso atual. A função lida automaticamente com variações de formato (strings com "%" ou números decimais) na célula de Win Rate.

---

## Função: `_getTickerBias`
**Descrição:** Avalia o desempenho histórico de um ativo na carteira, classificando-o como 'GOOD', 'BAD' ou 'NEUTRAL' com base no lucro acumulado.

**Parâmetros:**
* `ticker` (String): O código do ativo (ex: "PETR4") a ser consultado na planilha de carteira.

**Retorno:**
* `String`: Retorna 'GOOD' se o lucro superar o limite configurado, 'BAD' se o prejuízo exceder o limite configurado, ou 'NEUTRAL' caso contrário ou em caso de erro.

**Uso:** Utilizada pelo agente de memória para definir um viés de decisão sobre um ativo, permitindo filtrar ou priorizar operações baseadas no histórico de rentabilidade registrado na planilha de controle.

---

## Função: `_getTickerWinRate`
**Descrição:** Calcula a taxa de acerto (win rate) de um ativo específico com base em um histórico de performance dos últimos 12 meses.

**Parâmetros:**
* `ticker` (String): O código do ativo (ex: "PETR4") a ser consultado na planilha de logs.

**Retorno:**
* `Object|null`: Retorna um objeto contendo `total` (quantidade de operações), `winRate` (porcentagem de acertos) e `window` (período de 12 meses), ou `null` caso o ativo possua menos de 5 operações ou ocorra erro na execução.

**Uso:** Utilizado para extrair métricas de performance histórica de um ativo a partir da aba de logs, filtrando apenas operações finalizadas como 'GAIN' dentro de uma janela móvel de um ano.

---

## Função: `TESTAR_INTEGRACAO_MEMORIA`
**Descrição:** Função de diagnóstico para validar a integração entre o sistema de memória do agente (AgentMemory) e a interface do Google Sheets, exibindo o contexto e os indicadores de risco de um ativo específico.

**Parâmetros:** 
* Nenhum (a função utiliza um valor fixo 'PETR4' para fins de teste).

**Retorno:** 
* `void`: Exibe um alerta (`ui.alert`) na interface do usuário com os dados processados ou uma mensagem de erro em caso de falha.

**Uso:** Utilizada durante o desenvolvimento e depuração para verificar se a classe `AgentMemory` está recuperando corretamente o contexto textual e os cálculos de risco (drawdown, penalidades e status do ticker) antes de enviá-los ao LLM.

---

## Função: `validarChamadasLegadas`
**Descrição:** Realiza uma varredura estática no código-fonte do projeto atual utilizando a API do Google Apps Script para identificar padrões legados ou obsoletos com base em um conjunto de regras predefinidas.

**Parâmetros:**
* Esta função não recebe parâmetros de entrada.

**Retorno:**
* `Object`: Um objeto contendo:
    * `findings` (Number): Quantidade total de ocorrências encontradas.
    * `error` (Boolean): Indicador de falha na execução (true em caso de erro, false caso contrário).

**Uso:**
Utilizada como uma ferramenta de auditoria de código (linter) para automatizar a detecção de práticas obsoletas. A função recupera o conteúdo dos arquivos `.gs` via `Apps Script API`, aplica expressões regulares definidas em `getLegacyRules()`, calcula a localização das ocorrências e gera um relatório detalhado através das funções auxiliares `logSummary` e `writeReport`.

---

## Função: `getLegacyRules`
**Descrição:** Retorna um conjunto de regras de análise estática para identificar padrões de código legados ou ineficientes no projeto.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Array<Object>`: Uma lista de objetos contendo `id`, `description`, `regex` (para detecção), `suggestion` (orientação de refatoração) e, opcionalmente, `suggestExact` (função para gerar a correção automática).

**Uso:** 
* Utilizada pelo motor de varredura de código (`39_Code_Scanner.js`) para validar a qualidade do código, identificar métodos obsoletos da classe `YahooFetcher` e detectar gargalos de performance causados por chamadas de manipulação de planilha dentro de estruturas de repetição.

---

## Função: `inferGetHistory`
**Descrição:** Analisa e corrige a ordem dos argumentos de uma string de entrada para adequá-los à assinatura da função `YahooFetcher.getHistory`.

**Parâmetros:**
* `argsText` (String): Uma string contendo os argumentos separados por vírgula (ex: "PETR4, 1d, 1mo").

**Retorno:**
* `Object`: Um objeto contendo a chave `exact` (string com a chamada corrigida, se possível) e/ou `notes` (string com mensagens de erro ou status da inferência).

**Uso:** Utilizada para processar comandos de texto que tentam chamar o histórico de ativos, corrigindo automaticamente a inversão comum entre os parâmetros `interval` e `range` antes da execução.

---

## Função: `isInterval`
**Descrição:** Verifica se uma string fornecida corresponde a um intervalo de tempo válido aceito pelo sistema.

**Parâmetros:** 
* `s` (String): O valor de intervalo a ser validado.

**Retorno:** 
* `Boolean`: Retorna `true` se o intervalo for válido (presente na lista pré-definida) ou `false` caso contrário.

**Uso:** Utilizada para validar entradas de usuário ou dados de configuração antes de processar requisições de séries temporais ou consultas de dados financeiros.

---

## Função: `isRange`
**Descrição:** Verifica se uma string fornecida corresponde a um período de tempo financeiro válido definido no sistema.

**Parâmetros:**
* `s` (String): O valor de entrada a ser validado (ex: '1d', '1y').

**Retorno:**
* `Boolean`: Retorna `true` se a string (após normalização) estiver contida na lista de intervalos permitidos, caso contrário, retorna `false`.

**Uso:** Utilizada para validar entradas de usuário ou dados de configuração antes de processar consultas de séries temporais ou filtros de datas em ferramentas de análise financeira.

---

## Função: `strip`
**Descrição:** Remove espaços em branco das extremidades de uma string e, caso ela esteja delimitada por aspas simples ou duplas, remove esses caracteres delimitadores.

**Parâmetros:** 
* `s` (String): A string que será processada (aceita valores nulos ou indefinidos).

**Retorno:** 
* (String): A string tratada, sem espaços extras e sem aspas delimitadoras, caso existam.

**Uso:** Ideal para limpar entradas de dados (como valores de células ou inputs de formulários) que possam conter espaços acidentais ou estar envolvidas por aspas, garantindo a integridade do dado para processamento posterior.

---

## Função: `writeReport`
**Descrição:** Esta função exporta uma lista de objetos de validação de código para uma planilha Google, criando ou resetando a aba 'Validação_Código' com formatação padronizada.

**Parâmetros:**
* `rows` (Array de Objetos): Lista contendo os dados de auditoria, onde cada objeto deve possuir as propriedades: `file`, `line`, `snippet`, `rule`, `description`, `suggestion`, `exact` e `notes`.

**Retorno:**
* `void`: A função não retorna valores, apenas realiza operações de escrita na planilha ativa.

**Uso:** Ideal para relatórios de análise estática de código, onde os resultados processados pelo `Code_Scanner` precisam ser visualizados, filtrados ou compartilhados através de uma interface de planilha.

---

## Função: `logSummary`
**Descrição:** Exibe no console um relatório estatístico consolidado das validações de código realizadas, agrupando as ocorrências por regra.

**Parâmetros:** 
* `rows` (Array de objetos): Lista contendo os registros de validação, onde cada objeto deve possuir uma propriedade `rule` (string) representando a regra aplicada.

**Retorno:** 
* `void`: A função não retorna valores, apenas imprime o resumo formatado no console do Google Apps Script.

**Uso:** Utilizada ao final de um processo de varredura de código para fornecer um feedback visual rápido sobre quais tipos de problemas foram encontrados e a quantidade total de ocorrências detectadas.

---

## Função: `PROCESSAR_CARTEIRA_FINAL`
**Descrição:** Processa a lista de oportunidades de trading, categorizando ativos por setor e atualizando a planilha de resumo com os dados filtrados e organizados.

**Parâmetros:** 
* Nenhum (a função utiliza o contexto da planilha ativa `SpreadsheetApp.getActive()`).

**Retorno:** 
* `Number` ou `Void`: Retorna `0` caso a aba de origem esteja vazia ou inexistente; caso contrário, executa a atualização da planilha sem retorno explícito de valor.

**Uso:** 
* Deve ser executada para consolidar as recomendações de trading da aba "Oportunidades" na aba "Resumo_Trades_Aprovados", realizando a limpeza automática de dados obsoletos e aplicando a classificação setorial definida no mapa interno (`SECTOR_MAP`).

---

## Função: `_cfg`
**Descrição:** Função utilitária que recupera valores de configuração a partir de um objeto global `CONFIG`, retornando um valor padrão caso a configuração não exista ou o objeto não esteja definido.

**Parâmetros:**
* `key` (String): A chave identificadora do parâmetro de configuração a ser buscado.
* `fallback` (Any): O valor padrão a ser retornado caso a chave não seja encontrada ou o objeto `CONFIG` esteja indisponível.

**Retorno:** (Any) O valor associado à chave no objeto `CONFIG` ou o valor fornecido no parâmetro `fallback`.

**Uso:** Utilizada para acessar configurações do sistema de forma segura, evitando erros de referência caso o objeto `CONFIG` não tenha sido inicializado no escopo global.

---

## Função: `_determinarStatusPorSetup`
**Descrição:** Classifica ativos financeiros em categorias de sinal operacional ("COMPRAR", "RADAR" ou padrão) com base na combinação de um setup técnico específico e uma pontuação (score) de performance.

**Parâmetros:**
*   `setup` (String): Identificador ou nome do padrão técnico detectado (ex: "SWING IDEAL", "PULLBACK FIBO").
*   `score` (Number): Valor numérico representando a pontuação de qualidade ou força do ativo, utilizado como filtro de corte (threshold).

**Retorno:**
*   `String`: Retorna uma string formatada com um emoji e o status correspondente (ex: "🚀 COMPRAR", "🔭 RADAR") ou um valor padrão caso não atenda aos critérios.

**Uso:**
Utilizada no motor de ranqueamento (`41_Ranker.js`) para converter dados brutos de análise técnica em recomendações acionáveis. A função aplica thresholds dinâmicos (ajustados na v9/v9.1) para filtrar sinais de alta qualidade (score ≥ 65-70) ou ativos que necessitam de monitoramento (score ≥ 55).

---

## Função: `_escreverTabelaRanker`
**Descrição:** Atualiza uma planilha específica com uma lista de operações (trades), realizando a limpeza de dados antigos, formatação condicional de status e aplicação de máscaras de exibição numérica.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha (Spreadsheet) onde os dados serão gravados.
* `trades` (Array de Objetos): Lista contendo os dados das operações a serem processadas (ex: status, ticker, preço, etc.).
* `sheetName` (String): Nome da aba que receberá os dados (será criada caso não exista).

**Retorno:**
* `void`: A função não retorna valor, apenas executa operações de escrita e formatação na planilha.

**Uso:**
Utilizada para sincronizar e exibir o ranking de operações na interface do Google Sheets. A função garante que a aba de destino esteja limpa, insere os dados formatados, aplica máscaras de moeda/porcentagem e destaca visualmente as linhas com base no status do trade (ex: "🚀 COMPRAR" ou "🔭 RADAR").

---

## Função: `_desenharGlossario`
**Descrição:** A função `_desenharGlossario` é responsável por renderizar e formatar um painel de referência visual (glossário) no topo da planilha, detalhando os status de recomendação e indicadores técnicos da estratégia SMART HOLD.

**Parâmetros:**
* `sheet` (GoogleAppsScript.Spreadsheet.Sheet): Objeto da planilha onde o glossário será desenhado.

**Retorno:**
* `void`: A função não retorna valores, apenas executa operações de escrita e formatação diretamente na planilha.

**Uso:**
Deve ser chamada durante o processo de atualização do dashboard para garantir que as legendas de status (Comprar, Radar, Neutro, Vetado) e indicadores (OBV, BTC) estejam sincronizadas com as definições atuais da estratégia. A função limpa a área de cabeçalho (A1:N6) antes de aplicar os novos estilos e textos.

---

## Função: `verificarSaudeSistema`
**Descrição:** Função de diagnóstico automatizado que valida a integridade da integração com serviços de dados e a consistência lógica do motor de estratégia principal (STRATEGY_EVALUATE_CORE).

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, mas registra o status detalhado da saúde do sistema no console do Google Apps Script.

**Uso:** 
* Deve ser executada manualmente via editor de script ou agendada como um *heartbeat* para monitorar falhas em APIs externas ou erros de regressão na lógica de cálculo de estratégias, utilizando dados simulados (*mocks*) para garantir testes determinísticos.

---

## Função: `debugarAtivo`
**Descrição:** Função utilitária para diagnóstico rápido que executa o fluxo de avaliação de um ativo específico e exibe seus indicadores técnicos e resultados no console do Google Apps Script.

**Parâmetros:**
* `ticker` (String, opcional): O código do ativo a ser analisado (padrão: "PETR4").

**Retorno:**
* `void`: A função não retorna valores, apenas imprime os dados processados ou mensagens de erro no log de execução.

**Uso:** Utilize esta função durante o desenvolvimento ou manutenção para validar se o `DataService` e a `STRATEGY_EVALUATE_CORE` estão retornando os dados esperados para um ativo específico, facilitando a identificação de falhas em cálculos ou na obtenção de indicadores.

---

## Função: `gerarDadosMock`
**Descrição:** Gera um conjunto de dados simulados de mercado financeiro (OHLCV) para um ativo fictício, contendo 200 períodos com uma leve tendência de alta.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* Objeto: Contém uma string `ticker` (identificador do ativo) e um array `candles` composto por objetos com valores de `open`, `high`, `low`, `close` e `volume`.

**Uso:** Utilizada para testes de sistemas, depuração de gráficos ou validação de algoritmos de análise técnica sem a necessidade de conexão com uma API de dados reais.

---

## Função: `debugarCandles`
**Descrição:** Função utilitária para exibir no console os dados de fechamento, máxima e mínima dos últimos cinco candles de um ativo específico.

**Parâmetros:**
* `ticker` (String, opcional): O código do ativo a ser consultado (padrão: 'USIM5').

**Retorno:**
* `void`: Não retorna valor, apenas imprime os dados formatados no console do Google Apps Script.

**Uso:** Utilize esta função durante o desenvolvimento para validar rapidamente a integridade dos dados retornados pelo `DataService` para um ativo específico, verificando se os valores de preço estão sendo carregados corretamente.

---

## Função: `MENU_INSTALAR_AUTOMACAO`
**Descrição:** Cria e configura os gatilhos (triggers) temporais necessários para a execução automatizada das rotinas do robô de investimentos B3-v10.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, mas exibe um alerta (`alert`) na interface do usuário (UI) do Google Sheets confirmando o sucesso da instalação.

**Uso:** Deve ser executada para inicializar o agendamento de tarefas, incluindo o scanner de mercado, o envio de relatórios fiscais e a atualização do dashboard de trailing stop, garantindo que o sistema ignore automaticamente feriados e fins de semana.

---

## Função: `MENU_DESATIVAR_AUTOMACAO`
**Descrição:** Esta função interrompe o funcionamento do sistema de automação removendo todos os gatilhos (triggers) ativos e notificando o usuário através de um alerta na interface da planilha.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valor, apenas executa a limpeza dos gatilhos e exibe um alerta visual.

**Uso:** Deve ser chamada a partir de um item de menu personalizado na planilha para desativar instantaneamente todas as tarefas automatizadas gerenciadas pela classe `AutomacaoBot`.

---

## Função: `realizarManutencaoMadrugada`
**Descrição:** Executa rotinas de limpeza de cache, reset de propriedades de controle e sincronização de dados para preparar o sistema para um novo ciclo de operações.

**Parâmetros:**
* Nenhum.

**Retorno:**
* `void`: A função não retorna valores, apenas executa operações de manutenção e registra logs de execução.

**Uso:**
* Deve ser configurada como um gatilho (trigger) de tempo (Time-driven) para execução automática durante a madrugada, garantindo que o ambiente esteja limpo e sincronizado antes do início do próximo pregão.

---

## Função: `enviarStatusSaudeSemanal`
**Descrição:** Realiza uma verificação de integridade do sistema B3-v10, coletando métricas de gatilhos, propriedades de configuração e estado das APIs, enviando um relatório de status via serviço de notificação.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa o envio de mensagens e registra logs no console do Google Apps Script.

**Uso:** 
* Deve ser configurada como um gatilho (trigger) de tempo (ex: semanal) para monitorar automaticamente a saúde do script, garantindo que as chaves de API e os gatilhos de execução estejam ativos e operacionais.

---

## Função: `VISUALIZAR_MONITORAMENTO`
**Descrição:** Função de interface que aciona a análise de pré-mercado com o modo de visualização habilitado.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: Não retorna valores, apenas executa a lógica de processamento e exibição.

**Uso:** Utilizada como gatilho (trigger) ou atalho de menu para executar a função `preMarketAnalysis_Inteligente` passando o argumento `true`, forçando a exibição dos resultados do monitoramento na interface do usuário.

---

## Função: `preMarketAnalysis_Inteligente`
**Descrição:** Realiza uma análise automatizada de ativos em carteira, calculando distâncias para alvos e stops, além de consolidar o lucro total para suporte à tomada de decisão pré-mercado.

**Parâmetros:**
*   `forcarVisual` (Boolean, opcional): Define se a interface do usuário (UI) deve ser ativada para exibir alertas ou interações (padrão: `false`).

**Retorno:**
*   `void`: A função não retorna um valor, mas processa dados na planilha e, opcionalmente, interage com a interface do Google Sheets.

**Uso:**
Utilizada para automatizar a gestão de risco e o acompanhamento de metas de ativos. A função percorre a aba "Carteira", calcula a proximidade do preço atual em relação aos níveis de *Stop* e *Alvos* (1 e 2), e identifica o status de performance de cada ativo com base no preço médio, facilitando a visualização de pontos de saída ou realização de parciais.

---

## Função: `construirHtmlSniper`
**Descrição:** Gera um template HTML formatado para relatórios de monitoramento de mercado financeiro, exibindo estatísticas de carteira, tabelas de análise e sugestões de ajuste de stop.

**Parâmetros:**
*   `analises` (Array): Lista de objetos contendo os dados detalhados das análises dos ativos para exibição na tabela.
*   `stats` (Object): Objeto contendo métricas da carteira, especificamente a propriedade `lucroTotal` (number) para cálculo de cores e exibição de valores.
*   `sugestoes` (Array): Lista de objetos contendo recomendações de trailing stop, com propriedades `papel` (string) e `novoStop` (number).

**Retorno:**
*   `string`: Uma string contendo o código HTML completo (incluindo CSS inline) pronto para ser enviado via e-mail ou exibido em uma interface web.

**Uso:**
Utilizada no fluxo de automação de pré-mercado para consolidar visualmente os dados processados, permitindo que o usuário visualize rapidamente o lucro total da carteira e receba alertas acionáveis sobre ajustes de proteção (trailing stop) em seus ativos.

---

## Função: `getKey`
**Descrição:** Recupera o valor de uma chave de configuração armazenada nas propriedades do script ou do usuário, com suporte a valor padrão em caso de ausência ou erro.

**Parâmetros:**
* `keyName` (String): O nome da chave a ser buscada no armazenamento de propriedades.
* `defaultValue` (Any, opcional): O valor a ser retornado caso a chave não seja encontrada ou ocorra uma falha na leitura.

**Retorno:** (String|Any) O valor da chave encontrada ou o `defaultValue` fornecido.

**Uso:** Ideal para acessar configurações sensíveis ou variáveis de ambiente (como tokens de API) de forma resiliente, priorizando as propriedades do script e utilizando as do usuário como fallback.

---

## Função: `testarLeitura`
**Descrição:** Realiza uma auditoria de diagnóstico das chaves de API e tokens críticos armazenados no sistema, exibindo um relatório visual via interface modal no Google Sheets.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, mas renderiza um objeto `HtmlOutput` através do `SpreadsheetApp.getUi().showModalDialog()`.

**Uso:** 
* Deve ser executada manualmente pelo desenvolvedor ou administrador do sistema para verificar se as dependências de integração (OpenAI, Gemini, DeepSeek, Telegram e BRAPI) estão corretamente configuradas no serviço de chaves (`getKey`).

---

## Função: `VISUALIZAR_SENTINELA_GRINGO`
**Descrição:** Aciona a execução do módulo Sentinela Gringo em modo de visualização (simulação).

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas dispara o processo interno da classe `SentinelaGringo`.

**Uso:** Utilizada para executar a lógica de monitoramento ou processamento do "Sentinela Gringo" com o parâmetro de modo visual/teste ativado, permitindo verificar o comportamento do script sem necessariamente aplicar alterações definitivas ou persistentes.

---

## Função: `RODAR_SENTINELA_AUTOMATICO`
**Descrição:** Executa a rotina de monitoramento do sistema Sentinela Gringo de forma automática e silenciosa.

**Parâmetros:**
* Nenhum.

**Retorno:**
* `void`: A função não retorna valores, apenas dispara o processo de execução.

**Uso:** Utilizada principalmente como gatilho (trigger) agendado no Google Apps Script para disparar a lógica principal da classe `SentinelaGringo` com o parâmetro de modo automático definido como `false`.

---

## Função: `TESTAR_YAHOO_BLOQUEIO`
**Descrição:** Função de diagnóstico utilizada para verificar se o endpoint da API do Yahoo Finance está bloqueando requisições provenientes do Google Apps Script.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, mas registra o código de status HTTP e o conteúdo inicial da resposta no log de execução do Apps Script.

**Uso:** Deve ser executada manualmente via editor de script para validar a conectividade e identificar possíveis bloqueios de IP ou restrições de User-Agent impostas pelo Yahoo Finance ao serviço `UrlFetchApp`.

---

## Função: `TESTAR_SENTINELA_V8_DIRETO`
**Descrição:** Executa o processo principal do módulo `SentinelaGringo` forçando o bypass do motor V8 para testes de diagnóstico.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas registra logs no console do Apps Script e dispara a execução da classe `SentinelaGringo`.

**Uso:** Utilizada para depuração rápida do sistema de monitoramento, permitindo validar o comportamento da lógica principal sem as otimizações ou restrições específicas do motor V8 do Google Apps Script.

---

## Função: `converterParaNumero`
**Descrição:** Converte valores de entrada (strings, números ou nulos) em um formato numérico padrão, tratando símbolos monetários, formatação contábil e separadores decimais brasileiros.

**Parâmetros:**
* `valor` (any): O dado a ser convertido, podendo ser string, número, null ou undefined.

**Retorno:**
* `number`: O valor numérico convertido ou `NaN` caso a entrada seja inválida ou vazia.

**Uso:** Ideal para processar dados vindos de planilhas ou formulários que contenham formatação de moeda (ex: "R$ 1.234,56") ou notação contábil de parênteses para números negativos (ex: "(100,00)").

---

## Função: `encontrarIndiceColuna`
**Descrição:** Localiza o índice da primeira coluna em um array de cabeçalhos que contenha pelo menos uma das palavras-chave fornecidas.

**Parâmetros:**
* `cabecalho` (Array): Lista de nomes de colunas (strings) a serem pesquisados.
* `palavrasChave` (Array): Lista de termos (strings) que servem como critério de busca.

**Retorno:** (Number) O índice (base zero) da primeira coluna encontrada ou -1 caso nenhuma palavra-chave corresponda aos cabeçalhos.

**Uso:** Ideal para identificar dinamicamente a posição de colunas em planilhas (ex: encontrar a coluna "Data" ou "Data de Venda") independentemente da ordem exata das colunas no arquivo.

---

## Função: `lerNotas`
**Descrição:** Lê e processa os dados de operações financeiras contidos na aba de notas de corretagem de uma planilha Google, normalizando as informações para um formato de objeto estruturado.

**Parâmetros:** 
* Nenhum (a função utiliza a variável global `NOME_ABA_NOTAS` e o contexto da planilha ativa).

**Retorno:** 
* `Array<Object>`: Uma lista de objetos contendo as propriedades `data`, `tipo` (COMPRA/VENDA), `ticker`, `quantidade`, `preco` e `lucro`.

**Uso:** 
* Deve ser chamada para extrair e validar os registros de transações da planilha. A função identifica automaticamente as colunas através de palavras-chave no cabeçalho, filtra apenas linhas com datas válidas e tipos de operação permitidos, e retorna os dados limpos para processamento posterior.

---

## Função: `identificarTrades`
**Descrição:** Processa uma lista de operações financeiras para identificar trades individuais através do método FIFO (First-In, First-Out), calculando o lucro e o resultado percentual de cada venda em relação às suas respectivas compras.

**Parâmetros:** 
* `operacoes` (Array de Objetos): Lista contendo objetos de operações, cada um com as propriedades `ticker`, `data`, `tipo` ("COMPRA" ou "VENDA"), `quantidade` e `preco`.

**Retorno:** 
* `Array de Objetos`: Lista de trades consolidados, contendo `ticker`, `dataEntrada`, `precoEntrada`, `dataSaida`, `precoSaida`, `quantidade`, `lucro` e `resultadoPercentual`.

**Uso:** Ideal para sistemas de gestão de carteira que precisam calcular a performance histórica e o resultado financeiro de ativos, garantindo que cada venda seja pareada com o custo de aquisição mais antigo disponível para aquele ticker.

---

## Função: `garantirAbaLog`
**Descrição:** Verifica a existência da aba de logs na planilha ativa, criando-a com cabeçalhos formatados caso ela ainda não exista.

**Parâmetros:** 
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha (Spreadsheet) onde a verificação será realizada.

**Retorno:** 
* (GoogleAppsScript.Spreadsheet.Sheet): O objeto da aba de logs (existente ou recém-criada).

**Uso:** Deve ser chamada antes de qualquer operação de escrita de logs para garantir que o destino dos dados esteja disponível e corretamente estruturado com cabeçalhos.

---

## Função: `escreverTradesDetalhados`
**Descrição:** Atualiza a aba de log de trades com uma lista detalhada de operações, realizando a limpeza de dados anteriores, processamento de informações e aplicação de formatação condicional.

**Parâmetros:**
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha ativa onde o log será escrito.
* `trades` (Array<Object>): Lista de objetos contendo os dados das operações (ex: `dataEntrada`, `ticker`, `lucro`, `resultadoPercentual`, `precoEntrada`, `dataSaida`, `precoSaida`).

**Retorno:**
* `void`: A função não retorna valores, apenas executa operações de escrita e formatação na planilha.

**Uso:**
Utilizada para sincronizar o histórico de trades na aba de log, garantindo que os dados estejam organizados, categorizados por setor e formatados corretamente para visualização financeira. Deve ser chamada sempre que houver necessidade de atualizar a exibição detalhada das operações realizadas.

---

## Função: `atualizarResumoEstatistico`
**Descrição:** Calcula métricas de desempenho de uma lista de operações (trades) e atualiza um resumo estatístico na segunda linha da planilha de logs.

**Parâmetros:** 
* `ss` (GoogleAppsScript.Spreadsheet.Spreadsheet): Objeto da planilha ativa onde o resumo será gravado.
* `trades` (Array<Object>): Lista de objetos contendo os dados das operações, onde cada objeto deve possuir a propriedade `lucro`.

**Retorno:** 
* `void`: A função não retorna valores, apenas realiza a escrita direta na planilha.

**Uso:** Deve ser chamada após a coleta ou processamento de dados de trades para manter o painel de indicadores atualizado com a data da última execução, contagem de operações, taxa de acerto (win rate) e distribuição de resultados.

---

## Função: `executar`
**Descrição:** Orquestra o processamento de dados de operações financeiras, realizando a leitura, identificação de trades, atualização de registros detalhados e geração do resumo estatístico na planilha ativa.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Object|null`: Retorna um objeto contendo o `total` de trades processados e a `winRate` (taxa de acerto) em porcentagem, ou `null` caso não haja operações encontradas.

**Uso:** 
* Deve ser executada como o ponto de entrada principal do módulo `Performance_Manager` para sincronizar a aba de logs de performance com os dados brutos de operações, garantindo que o relatório estatístico esteja atualizado.

---

## Função: `ATUALIZAR_ESTATISTICAS`
**Descrição:** Função responsável por disparar o processamento de métricas de performance de trades e notificar o usuário sobre os resultados (Win Rate e volume de operações).

**Parâmetros:**
* Nenhum.

**Retorno:**
* `void`: A função não retorna valores, apenas executa ações de interface (alertas) ou loga informações no console.

**Uso:**
* Deve ser chamada para atualizar as estatísticas de trading a partir das notas de corretagem. A função detecta automaticamente se está sendo executada em um ambiente interativo (via menu/botão) ou em background (via gatilho/bot), adaptando a exibição da mensagem entre um alerta na planilha ou um log no console.

---

## Função: `TESTAR_WINRATE_ROLLING_12M`
**Descrição:** Função de diagnóstico utilizada para validar a integridade dos dados de performance (Win Rate e métricas de risco) recuperados via `AgentMemory` para um ativo específico.

**Parâmetros:**
* Nenhum (a função utiliza um valor fixo `tickerTeste = 'PETR4'` para fins de teste).

**Retorno:**
* `void`: A função não retorna valores para o script, mas exibe um alerta (`ui.alert`) na interface do Google Sheets com o resumo da validação ou uma mensagem de erro em caso de falha.

**Uso:**
* Deve ser executada manualmente via editor de script ou menu personalizado para verificar se o contexto de um ativo está sendo carregado corretamente e se a lógica de cálculo do "Win Rate Rolling 12M" está sendo processada e identificada no texto do contexto.

---

## Função: `GERAR_DASHBOARD_ANUAL`
**Descrição:** Processa dados de notas de corretagem para consolidar métricas anuais de performance financeira (lucros, prejuízos e volume de trades) em uma nova aba de dashboard.

**Parâmetros:** 
* Nenhum (a função utiliza o contexto da planilha ativa).

**Retorno:** 
* `void` (A função não retorna valores, mas realiza a criação/atualização da aba "Dashboard_Anual" na planilha ativa).

**Uso:** 
* Deve ser executada a partir do editor de script ou vinculada a um botão na planilha; a função lê a aba "Notas de Corretagem", agrupa os resultados financeiros por ano e gera uma tabela consolidada com o histórico de performance na aba "Dashboard_Anual".

---

## Função: `_cfg`
**Descrição:** Função utilitária para recuperar valores de configuração de um objeto global `CONFIG`, garantindo um valor padrão caso a configuração ou o objeto não existam.

**Parâmetros:**
* `key` (String): A chave identificadora da configuração que se deseja buscar.
* `fallback` (Any): O valor padrão a ser retornado caso a chave não seja encontrada ou o objeto `CONFIG` não esteja definido.

**Retorno:** (Any) O valor associado à chave no objeto `CONFIG` ou o valor do parâmetro `fallback`.

**Uso:** Utilizada para acessar variáveis de ambiente ou configurações do sistema de forma segura, evitando erros de referência caso o objeto `CONFIG` não tenha sido inicializado no escopo global.

---

## Função: `_extrairJSON`
**Descrição:** Função utilitária projetada para extrair e converter strings de texto em objetos JSON, tratando possíveis ruídos de formatação comuns em respostas de IAs.

**Parâmetros:**
* `rawText` (String): O conteúdo de texto bruto que contém ou pode conter uma estrutura JSON.

**Retorno:**
* `Object|Array|null`: Retorna o objeto ou array resultante do parsing se bem-sucedido, ou `null` caso a extração falhe.

**Uso:** Ideal para processar respostas de modelos de linguagem (LLMs) que frequentemente incluem blocos de código (markdown), tags de pensamento (`<think>`) ou textos explicativos ao redor do JSON, garantindo que apenas a estrutura de dados seja extraída e convertida.

---

## Função: `_callAI`
**Descrição:** Função intermediária que gerencia chamadas de IA com estratégia de fallback, priorizando o Gemini e utilizando o DeepSeek como alternativa em caso de falha.

**Parâmetros:**
* `prompt` (String): O texto ou instrução que será enviado para o modelo de IA.
* `options` (Object, opcional): Objeto contendo configurações adicionais para a chamada (força automaticamente o `jsonMode` como `true`).

**Retorno:**
* `Object|null`: Retorna o objeto de resposta da IA (formatado em JSON) se bem-sucedido, ou `null` caso ocorra erro em ambos os provedores ou o `AI_Connector` esteja indisponível.

**Uso:** Utilize esta função como uma camada de abstração para solicitações de IA no sistema, garantindo resiliência através da alternância automática entre provedores (Gemini -> DeepSeek). Requer que o objeto global `AI_Connector` esteja previamente carregado no projeto.

---

## Função: `_calcularScoreTecnicoFallback`
**Descrição:** Calcula um score técnico de 0 a 100 para uma operação financeira baseando-se em indicadores (RSI, ADX), relação risco-retorno (RR) e tipo de setup.

**Parâmetros:**
* `op` (Object): Objeto contendo os dados da operação, incluindo indicadores (`rsi`, `adx`), métricas de risco (`rr`) e identificação do setup (`setupType` ou `setup`).

**Retorno:**
* `Number`: Um valor inteiro entre 0 e 100 representando a qualidade técnica da operação, ou o valor padrão definido em `CONF.FALLBACK_SCORE` caso o parâmetro de entrada seja inválido.

**Uso:** Utilizado como um mecanismo de avaliação de segurança (fallback) no módulo de ensemble de IA para quantificar a viabilidade técnica de uma operação quando modelos mais complexos não estão disponíveis ou como filtro de validação inicial.

---

## Função: `_montarPromptBatch`
**Descrição:** Constrói um prompt estruturado para modelos de IA, formatando um lote de ativos financeiros com seus indicadores técnicos para análise quantitativa e recomendação de sentimento em formato JSON.

**Parâmetros:**
*   `batch` (Array de Objetos): Lista de ativos contendo propriedades como `ticker`, `score`, `rsi`, `adx`, `rr`, `setupType` (ou `setup`), `price` e `volumeRelativo` (ou objeto `indicators` aninhado).

**Retorno:**
*   `String`: Um prompt completo contendo instruções de persona, regras de negócio para cálculo de score, diretrizes de formatação JSON e a lista de ativos processada.

**Uso:**
Utilizado como etapa de preparação de dados antes de enviar requisições para APIs de LLM (como GPT ou Gemini), garantindo que a IA receba os dados padronizados e siga critérios técnicos específicos para a análise de ativos da B3.

---

## Função: `getEnhancedScoresBatch`
**Descrição:** Processa uma lista de candidatos a ativos financeiros em lotes, utilizando inteligência artificial para gerar pontuações aprimoradas e análise técnica consolidada.

**Parâmetros:**
*   `candidatos` (Array de Objetos): Lista contendo os dados dos ativos (ex: `ticker`, `score`, `rsi`, `adx`, `rr`, `setupType`).

**Retorno:**
*   `Array`: Lista de objetos contendo os resultados processados (scores aprimorados e análises) para cada ativo, incluindo casos de erro via `_makeFallbackResult`.

**Uso:**
Utilizada para otimizar o consumo de tokens e limites de API ao processar múltiplos ativos simultaneamente, enviando grupos de candidatos para o modelo de IA (Gemini) através de um prompt consolidado, garantindo eficiência no processamento em massa dentro do Google Apps Script.

---

## Função: `_makeFallbackResult`
**Descrição:** Cria um objeto de resultado padronizado com valores de fallback para ser utilizado quando o processamento principal de IA falha ou não retorna dados.

**Parâmetros:**
* `ticker` (String): O símbolo do ativo financeiro (ex: "PETR4").
* `score` (Number): O valor numérico de pontuação atribuído ao ativo.
* `motivo` (String, opcional): A justificativa ou mensagem de erro que explica o uso do fallback.

**Retorno:** (Object) Um objeto estruturado contendo o ticker, pontuações normalizadas, sentimento neutro, justificativa e a flag `fallback` definida como `true`.

**Uso:** Utilizada como mecanismo de segurança em fluxos de análise de dados para garantir que o sistema retorne um objeto com a estrutura esperada, mesmo na ausência de uma resposta válida da API de IA.

---

## Função: `analisar`
**Descrição:** Executa uma análise de sentimento e pontuação (score) de ativos financeiros utilizando uma abordagem de conjunto (ensemble) com múltiplos modelos de IA (Gemini e DeepSeek).

**Parâmetros:**
*   `prompt` (String): O texto ou instrução que será enviado para os modelos de IA processarem.
*   `options` (Object, opcional): Objeto de configuração contendo:
    *   `ticker` (String): Identificador do ativo (ex: 'PETR4').
    *   `score` (Number): Valor base de pontuação caso a IA não retorne um valor válido (padrão: 50).

**Retorno:** (Objeto) Retorna um objeto consolidado contendo os scores, sentimentos e as respostas brutas extraídas de cada modelo de IA utilizado.

**Uso:** A função é utilizada para orquestrar chamadas a diferentes APIs de IA, tratando falhas individualmente e extraindo dados estruturados (JSON) para gerar uma análise comparativa ou agregada sobre um determinado ativo financeiro.

---

## Função: `fetchJSONSafe`
**Descrição:** Realiza uma requisição HTTP GET para uma URL fornecida, validando a integridade do conteúdo e convertendo a resposta de texto para um objeto JSON de forma segura.

**Parâmetros:**
* `url` (String): A URL do endpoint que será consultado.

**Retorno:**
* `Object|null`: Retorna o objeto JSON correspondente à resposta em caso de sucesso, ou `null` caso ocorra algum erro na requisição, resposta vazia ou formato inválido.

**Uso:** Ideal para consumir APIs externas dentro do Google Apps Script, garantindo que falhas de rede ou respostas malformadas (como erros de servidor em XML) não interrompam a execução do script, tratando-as silenciosamente com um log de aviso.

---

## Função: `getSelic`
**Descrição:** Obtém a taxa Selic atual a partir de uma fonte externa, retornando um valor padrão de segurança caso a requisição falhe.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Number`: O valor da taxa Selic como um número de ponto flutuante (ex: 13.75).

**Uso:** 
* Utilizada para recuperar a taxa de juros básica da economia para cálculos financeiros ou ajustes de valores, garantindo resiliência ao sistema ao definir 13.75% como valor *fallback* em caso de erro na API.

---

## Função: `getDolar`
**Descrição:** Obtém a cotação atual do dólar através de uma requisição externa, retornando um valor padrão de segurança caso a consulta falhe.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Number`: O valor da cotação do dólar como ponto flutuante ou `5.0` em caso de erro ou ausência de dados.

**Uso:** Utilizada para integrar a cotação atual do dólar em cálculos financeiros ou automações dentro da planilha, garantindo que o sistema não pare caso a API de indicadores esteja indisponível.

---

## Função: `getEWZVariation`
**Descrição:** Função descontinuada que anteriormente retornava a variação do ETF EWZ e agora atua como um stub de compatibilidade retornando valor neutro.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Number`: Retorna sempre `0`, desativando o impacto do ativo no cálculo do regime macroeconômico.

**Uso:** Mantida no código para evitar erros de referência em chamadas legadas, enquanto o sistema migrou a lógica de análise macro para fontes oficiais do Banco Central (Selic e Dólar).

---

## Função: `calcularRegime`
**Descrição:** Classifica o regime de mercado financeiro com base nos indicadores macroeconômicos de taxa Selic e cotação do dólar.

**Parâmetros:** 
* `selic` (Number): Valor percentual da taxa básica de juros (ex: 12.5).
* `dolar` (Number): Valor da cotação do dólar em reais (ex: 5.50).

**Retorno:** 
* `String`: Retorna uma das quatro categorias de mercado: "BEARISH", "DEFENSIVE", "BULLISH" ou "NEUTRAL".

**Uso:** Utilizada para automatizar a tomada de decisão ou alocação de ativos em planilhas financeiras, aplicando regras de negócio que ponderam o risco fiscal e cambial conforme os níveis de juros e câmbio.

---

## Função: `getMacroContext`
**Descrição:** Recupera indicadores macroeconômicos (Selic, Dólar, EWZ) e define o regime de mercado atual, utilizando uma estratégia de cache em camadas para otimizar a performance e reduzir chamadas a APIs externas.

**Parâmetros:**
* Nenhum.

**Retorno:**
* **Objeto:** Retorna um objeto contendo os indicadores (`selic`, `dolar`, `ewzVariation`), o `regime` calculado, o `adjustment` de risco, um `timestamp` e um `summary` formatado. Em caso de falha, retorna um objeto com valores padrão (fallback).

**Uso:**
* Deve ser chamada sempre que o sistema precisar de dados macroeconômicos atualizados. A função gerencia automaticamente a busca eficiente: primeiro verifica a memória local da execução atual, depois o `CacheService` (persistente por 1 hora) e, por fim, realiza novas requisições às APIs caso necessário.

---

## Função: `getRiskAdjustmentInternal`
**Descrição:** Retorna um multiplicador numérico de ajuste de risco com base no regime de mercado fornecido.

**Parâmetros:**
* `regime` (String): Identificador do estado atual do mercado (esperado: "BEARISH", "DEFENSIVE" ou "BULLISH").

**Retorno:**
* `Number`: O fator de ajuste correspondente (0.80, 0.95, 1.1 ou 1.0 como padrão).

**Uso:** Utilizada para calibrar cálculos financeiros ou estratégias de alocação de ativos conforme a volatilidade ou tendência do mercado definida pelo parâmetro de entrada.

---

## Função: `getRiskAdjustment`
**Descrição:** Recupera o valor de ajuste de risco definido no contexto atual da macro.

**Parâmetros:**
* Nenhum.

**Retorno:**
* `Number` (ou tipo definido em `ctx`): O valor numérico ou objeto correspondente ao ajuste de risco armazenado no contexto da macro.

**Uso:** Utilizada para acessar a variável `adjustment` contida no objeto de contexto global da macro, permitindo que outras funções apliquem o fator de correção de risco em cálculos financeiros ou operacionais.

---

## Função: `TESTAR_MACRO`
**Descrição:** Função de diagnóstico utilizada para validar a integridade dos dados de contexto e o fator de ajuste de risco retornados pela classe `MacroFetcher`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe informações no console do Google Apps Script.

**Uso:** Executada manualmente durante a fase de desenvolvimento ou depuração para verificar se as configurações globais de macro e os parâmetros de risco estão sendo carregados corretamente pelo sistema.

---

## Função: `consultarCopilot`
**Descrição:** Envia dados técnicos de um ativo financeiro para um webhook externo (Power Automate) para processamento ou análise via Microsoft Copilot.

**Parâmetros:**
*   `ticker` (String): O código identificador do ativo (ex: "PETR4").
*   `technicalData` (Object): Objeto contendo indicadores técnicos (preço, RSI, volume, médias móveis, etc.).

**Retorno:**
*   `Object|null`: Retorna o objeto de resposta do webhook em caso de sucesso (código 200) ou `null` caso ocorram erros, validações falhas ou o webhook não esteja configurado.

**Uso:** A função deve ser chamada passando o ticker e o objeto de indicadores. Ela busca a URL do webhook nas propriedades do script (`COPILOT_WEBHOOK_URL`), formata os dados em um payload JSON e realiza uma requisição POST para integração externa.

---

## Função: `TESTAR_COPILOT`
**Descrição:** Função de teste unitário para validar a integração e o processamento de dados entre o sistema local e o serviço externo de Copilot via webhook.

**Parâmetros:** 
* Nenhum (a função utiliza dados estáticos definidos internamente).

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe logs no console do Google Apps Script indicando o sucesso ou falha da chamada.

**Uso:** Executada manualmente durante o desenvolvimento para verificar se a função `consultarCopilot` está operante e se as propriedades de configuração (`COPILOT_WEBHOOK_URL`) estão corretamente definidas no ambiente.

---

## Função: `MONITORAR_IA_STATUS`
**Descrição:** Atualiza uma planilha de controle chamada "Monitor_IA" com o status atual de diversas fontes de inteligência artificial e processamento de dados.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas realiza operações de escrita na planilha ativa e exibe um alerta na interface do usuário.

**Uso:** 
* Deve ser executada manualmente ou via gatilho (trigger) para atualizar o painel de monitoramento. A função verifica o status de serviços externos (Gemini e Macro Dados) e preenche a planilha com os dados coletados, aplicando formatação visual nas colunas de cabeçalho.

---

## Função: `_checkGeminiStatus`
**Descrição:** Verifica a disponibilidade e o status operacional da API do Gemini através de uma chamada de teste.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `String`: Retorna uma das três mensagens de status: "✅ ONLINE", "⚠️ INSTÁVEL" ou "❌ OFFLINE".

**Uso:** Utilizada internamente para monitoramento de saúde (health check) do serviço de IA, permitindo validar se a conexão com o `AI_Connector` está ativa antes de executar processos críticos.

---

## Função: `_checkMacroStatus`
**Descrição:** Verifica o status de conectividade do serviço de macros através da validação do contexto atual.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `String`: Retorna "✅ ONLINE" se o contexto for recuperado, "⚠️ SEM DADOS" se o contexto for nulo, ou "❌ OFFLINE" em caso de erro na execução.

**Uso:** Utilizada para monitorar a disponibilidade do `MacroFetcher` em painéis de controle ou logs de sistema, permitindo identificar rapidamente falhas de comunicação ou ausência de dados.

---

## Função: `_buildEntryKey`
**Descrição:** Gera uma chave única (string) baseada nos atributos de um objeto de entrada para identificação ou indexação de registros de simulação.

**Parâmetros:**
* `entry` (Object): Objeto contendo as propriedades `ticker` (ativo), `setup` (estratégia) e `price` (preço).

**Retorno:**
* `String`: Uma string formatada no padrão "TICKER::SETUP::PRICE".

**Uso:** Utilizada para criar chaves primárias compostas ou identificadores únicos para simulações, garantindo padronização (caixa alta e remoção de espaços) e consistência na comparação de dados.

---

## Função: `_parseNumber`
**Descrição:** Converte um valor fornecido para um número de ponto flutuante, retornando 0 caso o valor seja inválido ou não finito.

**Parâmetros:** 
* `value` (any): O valor a ser convertido para número (string, número ou outro tipo).

**Retorno:** 
* `number`: O valor numérico convertido ou 0 se a conversão falhar ou resultar em um valor não finito (NaN/Infinity).

**Uso:** Utilizada para garantir a segurança de cálculos matemáticos, evitando erros de execução causados por valores `NaN` ou tipos de dados inesperados em operações aritméticas.

---

## Função: `registerEntries`
**Descrição:** Registra uma lista de novas operações de simulação em uma planilha, garantindo a unicidade dos registros através de uma chave composta para evitar duplicatas.

**Parâmetros:**
* `lista` (Array de Objetos): Coleção de operações contendo as propriedades `ticker`, `price`, `stopLoss`, `target1`, `setup` e `score`.

**Retorno:**
* `void`: A função não retorna valores, apenas executa a escrita na planilha ativa.

**Uso:** Utilizada para persistir dados de simulações de trading na aba definida pela constante `SHEET_ACTIVE`. A função valida se o ticker e o preço são válidos, normaliza os dados (trim/uppercase) e verifica se a combinação de ticker, preço e setup já existe na planilha antes de realizar a inserção em lote.

---

## Função: `monitorExits`
**Descrição:** Monitora ativos em uma planilha de operações ativas, comparando preços de mercado em tempo real com níveis de stop e alvo para encerrar posições automaticamente.

**Parâmetros:** 
* Não possui parâmetros de entrada (utiliza variáveis globais de configuração como `SHEET_ACTIVE` e `SHEET_LOG`).

**Retorno:** 
* `void`: A função não retorna valores, realizando a atualização direta das planilhas de ativos ativos e histórico de log.

**Uso:** 
* Deve ser executada (geralmente via acionador de tempo/trigger) para verificar se o preço atual de mercado atingiu os limites de *Stop Loss* ou *Take Profit* definidos, movendo as operações finalizadas da aba ativa para a aba de log e limpando as posições encerradas da lista principal.

---

## Função: `getGhostStatistics`
**Descrição:** Analisa o histórico de operações registradas na planilha de logs para calcular métricas de desempenho, como taxa de acerto (WinRate) e retorno médio.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Object`: Um objeto contendo `total` (amostragem), `validCount` (registros válidos), `winRate` (percentual de ganhos), `avgReturn` (média de retorno) e `timestamp` (data da análise). Retorna `null` caso a planilha de logs não exista ou esteja vazia.

**Uso:** 
* Utilizada para monitorar a performance do "robô" (Ghost), extraindo dados das colunas F (Resultado %) e G (Status) da aba definida pela constante `SHEET_LOG` para gerar um resumo estatístico das operações.

---

## Função: `houseKeeping`
**Descrição:** Realiza a manutenção preventiva da planilha de logs, removendo registros antigos para otimizar a performance e evitar exceder os limites de processamento do Google Sheets.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa a exclusão de linhas na planilha.

**Uso:** Deve ser chamada periodicamente (via gatilho de tempo ou ao final de processos de simulação) para garantir que a aba definida pela constante `SHEET_LOG` mantenha apenas os últimos 200 registros, descartando o excedente quando o total de linhas ultrapassar 1000.

---

## Função: `TESTAR_SISTEMA`
**Descrição:** Executa um teste unitário de integração injetando um registro de trade fictício no sistema para validar o fluxo de processamento de dados.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, mas realiza operações de escrita na planilha e exibe uma notificação (toast) na interface do usuário.

**Uso:** Utilizada durante o desenvolvimento e depuração para verificar se a função `registerEntries` está processando corretamente os dados de entrada e se a planilha de destino (`SHEET_ACTIVE`) está sendo atualizada conforme esperado.

---

## Função: `MENU_TESTAR_SISTEMA_SIMULACAO`
**Descrição:** Função de interface (menu) que aciona o método de teste do gerenciador de simulações.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa a lógica contida em `SimulationManager`.

**Uso:** Utilizada para disparar o processo de verificação ou teste do sistema de simulação através de um item de menu na interface do Google Sheets. A função valida preventivamente a existência do objeto `SimulationManager` antes da execução.

---

## Função: `carregarDados`
**Descrição:** Esta função inicia o processo de carregamento assíncrono de dados do servidor para o dashboard, exibindo um indicador de carregamento (spinner) enquanto aguarda a resposta.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, ela manipula diretamente o DOM e dispara uma chamada assíncrona para o servidor.

**Uso:** Deve ser invocada (geralmente via evento ou ao carregar a página) para disparar a função `getDashboardData` no lado do servidor (Google Apps Script), tratando automaticamente o estado de carregamento, o sucesso (renderizando os dados) e o erro (exibindo um alerta).

---

## Função: `renderTickers`
**Descrição:** Renderiza dinamicamente uma lista de cartões de ativos financeiros no DOM com base em um conjunto de dados fornecido, aplicando estilos condicionais conforme o score de cada item.

**Parâmetros:**
* `data` (Array de Objetos): Lista contendo os dados dos ativos (ex: `ticker`, `score`, `setup`, `preco_atual`, `entrada_sugerida`).

**Retorno:**
* `void`: A função não retorna valores, apenas manipula o elemento HTML com ID `ticker-list`.

**Uso:**
Utilizada no lado do cliente (Client-side) para atualizar a interface do usuário após a obtenção de dados via `google.script.run`, limpando o container anterior e injetando o template HTML formatado para cada ativo, incluindo a lógica de classes CSS baseada no `score`.

---

## Função: `formatarMoeda`
**Descrição:** Converte um valor numérico ou string em uma string formatada como moeda brasileira (BRL) com duas casas decimais.

**Parâmetros:**
* `v`: O valor a ser formatado (pode ser um número ou uma string representando um número).

**Retorno:**
* `String`: O valor formatado no padrão 'R$ 0,00' (ex: "1.234,56") ou "0,00" caso o valor de entrada seja inválido.

**Uso:** Ideal para exibir valores monetários em elementos HTML dentro de interfaces do Google Apps Script, garantindo a padronização visual conforme as normas brasileiras.

---

## Função: `rodarScanner`
**Descrição:** Inicia um processo de varredura automatizada no servidor através de uma confirmação do usuário e gerencia o estado visual da interface durante a execução.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas executa ações de interface e dispara uma chamada assíncrona para o servidor.

**Uso:** 
* Deve ser vinculada a um evento de clique (ex: `onclick`) em um botão na interface HTML. A função solicita confirmação, desabilita o botão para evitar cliques duplicados, exibe o painel de progresso e invoca a função `executarRoboB3FromWeb` no Google Apps Script, recarregando os dados ao finalizar.

---

## Função: `abrirSentinela`
**Descrição:** Inicializa e exibe um modal de interface (Bootstrap) que realiza uma consulta assíncrona ao servidor para buscar e renderizar dados de mercado (ADRs) do "Sentinela".

**Parâmetros:**
* Nenhum.

**Retorno:**
* `void`: A função não retorna valores, apenas manipula o DOM do arquivo `Index.html` e dispara uma chamada de servidor (`google.script.run`).

**Uso:**
* Deve ser acionada via evento de interface (ex: clique em botão) para abrir o modal `modalSentinela`, exibir um indicador de carregamento e atualizar dinamicamente o conteúdo com os dados retornados pela função de servidor `getSentinelaData()`, tratando estados de sucesso, erro ou ausência de dados.

---

## Função: `carregarCarteira`
**Descrição:** Esta função realiza a busca assíncrona de dados de investimentos no servidor Google Apps Script e renderiza dinamicamente uma lista formatada no elemento HTML `portfolio-list`.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, mas manipula diretamente o DOM do arquivo `Index.html` para exibir os dados da carteira ou mensagens de estado (carregamento/vazio/erro).

**Uso:** 
* Deve ser chamada no lado do cliente (JavaScript) para popular a interface com os dados da planilha. Ela utiliza `google.script.run` para invocar a função `getPortfolioData()` no servidor, exibe um *spinner* de carregamento enquanto aguarda a resposta e, ao receber os dados, itera sobre a lista para criar os componentes visuais (cards) com formatação condicional de lucro/prejuízo.

---

## Função: `TESTAR_DADOS_BTC`
**Descrição:** Função de diagnóstico para validar a conectividade com a API da BRAPI e inspecionar a estrutura de dados retornada para ativos específicos.

**Parâmetros:** 
* Nenhum (a função utiliza variáveis globais ou objetos de configuração externos como `Secrets` ou `CONFIG`).

**Retorno:** 
* `void`: A função não retorna valores, realizando apenas a saída de logs no console do Google Apps Script para fins de depuração.

**Uso:** 
* Executada manualmente ou via gatilho para verificar se o `BRAPI_TOKEN` está configurado corretamente e para mapear quais campos (como preço, variação e capitalização de mercado) estão disponíveis na resposta da API para uma lista pré-definida de tickers.

---

## Função: `TESTAR_CONFLUENCIA_SCORE`
**Descrição:** Função de teste unitário projetada para validar a lógica de cálculo da função privada `_calcularScoreSistêmico`, simulando cenários de alta e baixa confluência técnica.

**Parâmetros:** 
* Nenhum (a função utiliza dados mockados internamente para execução).

**Retorno:** 
* `void`: A função não retorna valores, apenas imprime no console do Google Apps Script os resultados dos cálculos para verificação manual.

**Uso:** Deve ser executada durante a fase de desenvolvimento ou manutenção para garantir que as alterações no algoritmo de score não impactem negativamente a classificação de oportunidades (Forte vs. Fraco) baseada em indicadores técnicos, zonas de Fibonacci e gestão de risco.

---

## Função: `TESTAR_INTEGRACAO_NLP`
**Descrição:** Função de teste unitário para validar a integração entre o módulo de processamento de linguagem natural (NLP) e o motor de decisão do sistema.

**Parâmetros:** 
* Nenhum (a função utiliza dados mockados internamente para execução).

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe o resultado da análise no console do Google Apps Script.

**Uso:** Utilizada durante a fase de desenvolvimento e depuração para verificar se o objeto `DecisionEngine` processa corretamente os dados de entrada (ticker, notícia e score) e retorna a estrutura de decisão esperada.

---

## Função: `TESTAR_CONEXAO_RAPIDAPI_DIRETO`
**Descrição:** Função de diagnóstico para validar a conectividade e o processamento de dados entre o Google Apps Script e a API do Yahoo Finance via RapidAPI.

**Parâmetros:** 
* Nenhum (a função utiliza constantes internas e propriedades de script configuradas).

**Retorno:** 
* `void`: A função não retorna valores, mas exibe logs detalhados no console do Apps Script (sucesso ou falha de cada etapa).

**Uso:** 
* Executada manualmente para verificar se a `RAPIDAPI_KEY` está configurada corretamente, se o endpoint está acessível e se os métodos de busca de histórico (`getHistoryRapidAPI`) e cotações em lote (`getQuoteBatchRapidAPI`) da classe `YahooFetcher` estão operacionais.

---

## Função: `DIAGNOSTICO_BRAPI_YAHOO`
**Descrição:** Função de diagnóstico para validar a conectividade e a configuração de credenciais das APIs BRAPI e Yahoo Finance dentro do ambiente Google Apps Script.

**Parâmetros:**
* Nenhum.

**Retorno:**
* `Array` de strings contendo o status detalhado de cada etapa do diagnóstico (configuração de token, sucesso/falha na requisição HTTP e valores de teste).

**Uso:**
* Deve ser executada manualmente via editor de script ou chamada por uma interface de usuário (como um menu personalizado na planilha) para verificar se as APIs de mercado financeiro estão operacionais ou se há bloqueios de rede/configuração.

---

## Função: `VERIFICAR_MODULOS`
**Descrição:** Função de diagnóstico que valida a existência e a disponibilidade de módulos e funções críticas no ambiente de execução do Google Apps Script.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe logs detalhados no console do Google Apps Script.

**Uso:** Deve ser executada manualmente durante a fase de desenvolvimento ou depuração para garantir que as dependências (`MacroFetcher`, `MONITORAR_IA_STATUS`, `consultarCopilot` e `AIEnsemble`) foram carregadas corretamente antes da execução de fluxos principais.

---

## Função: `TESTE_MACRO_PIPELINE`
**Descrição:** Função de diagnóstico para validar a integração entre o `MacroFetcher` e o `AgentOrchestrator`, comparando o processamento de oportunidades financeiras com e sem a aplicação de contextos macroeconômicos.

**Parâmetros:** 
* Nenhum (função de execução direta/teste).

**Retorno:** 
* `void`: A função não retorna valores, apenas exibe logs detalhados no console do Google Apps Script para depuração.

**Uso:** Utilizada durante o desenvolvimento para verificar se o `AgentOrchestrator` está recebendo corretamente o regime macroeconômico e se o `MacroFetcher` está operando conforme o esperado, garantindo que as decisões do agente sejam consistentes com o cenário de mercado.

---

## Função: `TESTAR_INTEGRACAO`
**Descrição:** Função de diagnóstico para validar a integração entre os módulos de orquestração, análise técnica e inteligência artificial (Ensemble) no sistema de trading.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `void`: A função não retorna valores, realizando apenas a saída de logs detalhados no console do Google Apps Script para depuração.

**Uso:** 
* Deve ser executada manualmente via editor de script ou console de depuração para verificar se o ambiente está configurado corretamente, se o `DataService` está recuperando dados de mercado (ex: PETR4) e se o `AIEnsemble` está processando corretamente os scores ajustados pela macro.

---

## Função: `VERIFICAR_CORRECOES_ALTA_PRIORIDADE`
**Descrição:** Função de auditoria automatizada que valida a integridade estrutural e as configurações críticas de componentes específicos no ambiente Google Apps Script.

**Parâmetros:**
* Nenhum.

**Retorno:**
* `void`: A função não retorna um valor, mas exibe os resultados da auditoria através de uma interface de usuário (UI) do SpreadsheetApp (via `ui.alert` ou `ui.showModalDialog`, conforme implícito na lógica de coleta de `resultados`).

**Uso:**
* Deve ser executada como um script de verificação de sanidade (sanity check) para garantir que:
    1. Os pesos do `AIEnsemble` estejam configurados corretamente (50/50).
    2. A função `MENU_SYNC_PORTFOLIO` atue apenas como um wrapper (sem lógica de manipulação de dados).
    3. As funções de performance (`setupLogPerformance`) estejam corretamente segregadas entre o escopo global e o namespace `Bootstrap`, evitando conflitos de assinatura.

---

## Função: `setupLogPerformance`
**Descrição:** Esta função realiza uma verificação de integridade e escopo para garantir que a rotina `setupLogPerformance` não sofra conflitos de nomenclatura ou sobreposição entre diferentes módulos do projeto.

**Parâmetros:**
* Nenhum.

**Retorno:**
* `void`: A função não retorna um valor, mas adiciona mensagens de status ao array `resultados` (variável de escopo superior) indicando se a configuração está correta.

**Uso:**
Utilizada em rotinas de diagnóstico ou testes unitários para validar se a função `setupLogPerformance` está declarada corretamente dentro de um IIFE (Immediately Invoked Function Expression) e se não há colisões de escopo global que possam comprometer a execução da performance.

---

## Função: `VERIFICAR_M2_VOLUME_FILTRO`
**Descrição:** Realiza testes de validação automatizados para o cálculo do Volume Relativo (VR) e a integridade do score retornado pela função de avaliação de estratégia (STRATEGY_EVALUATE_CORE).

**Parâmetros:**
* Esta função não recebe parâmetros (execução via trigger ou manual).

**Retorno:**
* `void`: A função não retorna valores, mas exibe os resultados da validação através de uma interface de usuário (UI) ou logs (conforme implementação do objeto `ui`).

**Uso:**
* Utilizada como ferramenta de diagnóstico e controle de qualidade para garantir que os indicadores técnicos (Volume Relativo) e a lógica de pontuação (Score) do sistema de trading estejam operando conforme o esperado após alterações no código.

---

## Função: `VERIFICAR_M3_ENCERRAMENTO_AUTO`
**Descrição:** Realiza uma auditoria de integridade e validação de dados na planilha "Log_Performance" para garantir que o sistema de encerramento automático de operações (M3) esteja configurado e operacional.

**Parâmetros:**
* Nenhum parâmetro de entrada.

**Retorno:**
* `void`: A função não retorna valores, mas exibe um diálogo na interface do usuário (UI) do Google Sheets com o relatório detalhado dos testes realizados.

**Uso:**
* Deve ser executada manualmente pelo usuário através do menu do Google Apps Script ou via gatilho de depuração para verificar se o mapeamento de vendas, a estrutura das colunas de saída (K e L) e o status dos trades (GAIN/LOSS/ABERTO) estão consistentes antes de processar encerramentos automáticos.

---

## Função: `doGet`
**Descrição:** Função de entrada (entry point) para a aplicação web, responsável por renderizar a interface do dashboard e gerenciar o controle de acesso do usuário.

**Parâmetros:**
* `e` (Object): Objeto de evento contendo parâmetros da requisição HTTP (padrão do Google Apps Script).

**Retorno:**
* `HtmlOutput`: Retorna o conteúdo renderizado do arquivo 'Index' ou uma página de erro personalizada em caso de falha de autorização ou ausência de arquivo.

**Uso:** Esta função é disparada automaticamente quando a URL da Web App é acessada. Ela valida a autorização do usuário via `assertWebAppAuthorized` e configura metadados essenciais (título, viewport e segurança de frame) para a exibição correta do dashboard no navegador.

---

## Função: `getDashboardData`
**Descrição:** Extrai e processa dados da aba 'Oportunidades' de uma planilha Google, convertendo linhas em uma lista de objetos formatados para uso em um dashboard.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Array<Object>`: Uma lista de objetos onde cada chave é derivada do cabeçalho da planilha (via `headerParaChave`) e os valores são formatados (datas convertidas para string, valores vazios substituídos por '-' e números tratados).

**Uso:** 
* Deve ser chamada no lado do servidor (Google Apps Script) para fornecer dados estruturados a interfaces de usuário (Web Apps ou Sidebars). Requer que a função `assertWebAppAuthorized` valide o acesso antes da execução e que a função auxiliar `headerParaChave` esteja definida no escopo.

---

## Função: `getPortfolioData`
**Descrição:** Recupera e processa os dados da aba "Carteira" do Google Sheets, convertendo as linhas em uma lista de objetos JSON filtrada por ativos com saldo positivo.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Array<Object>`: Uma lista de objetos onde cada chave é normalizada pela função `headerParaChave` e os valores vazios são substituídos por `0`.

**Uso:** 
* Utilizada para alimentar a interface do Web App com o estado atual da carteira de investimentos, garantindo que apenas ativos com quantidade (`qtd`) maior que zero sejam exibidos. Requer autorização prévia via `assertWebAppAuthorized`.

---

## Função: `headerParaChave`
**Descrição:** Converte cabeçalhos de planilhas em chaves padronizadas (slugs) para uso como nomes de propriedades em objetos JSON.

**Parâmetros:**
* `header` (String/Any): O texto do cabeçalho original que será processado.

**Retorno:**
* `String`: Uma string formatada em minúsculas, sem acentos, com espaços e barras substituídos por underscores e caracteres especiais normalizados.

**Uso:** Ideal para transformar a primeira linha de uma planilha (cabeçalhos) em chaves de objetos, facilitando a manipulação de dados em arrays de objetos (ex: `data.map(row => ({ [headerParaChave(h)]: row[i] }))`).

---

## Função: `executarRoboB3FromWeb`
**Descrição:** Aciona a execução do robô de processamento de dados da B3 a partir de uma interface web, garantindo a validação de autorização do usuário.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Any`: Retorna o resultado da execução da função `executarRoboB3(true)`, cujo tipo depende da implementação interna da função chamada (geralmente um objeto de status ou mensagem de confirmação).

**Uso:** Utilizada como ponto de entrada (endpoint) para chamadas via `google.script.run` a partir do frontend do Dashboard Web, assegurando que apenas usuários autorizados iniciem o processamento.

---

## Função: `getExecutionLog`
**Descrição:** Recupera o estado atual de execução de um processo armazenado no cache do script ou retorna um objeto padrão de inicialização caso nenhum log seja encontrado.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Object`: Retorna um objeto contendo a chave `progress` (número) e `messages` (array de strings).

**Uso:** Utilizada principalmente em aplicações web (WebApp) para permitir que o front-end consulte o progresso em tempo real de um processo que está sendo executado no servidor.

---

## Função: `getSentinelaData`
**Descrição:** Recupera dados de sentimento do mercado americano através do serviço `SentinelaGringo`, tratando cenários de indisponibilidade ou falhas na execução.

**Parâmetros:** 
* Nenhum.

**Retorno:** 
* `Object`: Retorna um objeto contendo a lista `dados`, o `sentimento` (string), a `cor` (hexadecimal) e uma `message` informativa. Em caso de sucesso, retorna o objeto original do serviço; em caso de falha ou mercado fechado, retorna um objeto estruturado com valores padrão de erro ou aviso.

**Uso:** 
* Utilizada como uma função de backend (via `google.script.run`) para alimentar interfaces de dashboard que exibem o sentimento do mercado americano, garantindo que a aplicação não quebre caso a fonte de dados esteja inacessível.

---

