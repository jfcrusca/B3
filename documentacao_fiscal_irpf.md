# Análise de Conformidade Fiscal IRPF - B3-v10

Para garantir conformidade total com o Imposto de Renda (IRPF) sobre operações em bolsa (B3), o sistema atual precisa cobrir os seguintes pontos críticos, que atualmente parecem ser lacunas:

## 1. O que falta para Conformidade Total
- [ ] **Controle de Preço Médio (Custódia):** O sistema precisa registrar o preço médio de compra de cada ativo para calcular o lucro/prejuízo real na venda. Atualmente, o módulo `TaxCalculator` foca em ler "Notas de Corretagem" (já processadas).
- [ ] **Segregação de Mercado:** O IRPF exige separação clara entre Swing Trade (15%) e Day Trade (20%). O módulo `TaxCalculator` faz essa distinção, mas precisamos garantir que as operações de Day Trade estejam corretamente identificadas na origem.
- [ ] **Relatório de Carteira (Posição em Aberto):** Necessário para a Declaração Anual de Bens e Direitos. O sistema precisa calcular a posição final em 31/12.
- [ ] **Compensação de Prejuízos:** O sistema já calcula, mas é fundamental que o usuário valide mês a mês se o prejuízo acumulado está correto.

## 2. Sugestões de Melhoria
- [ ] **`21_Tax_Calculator.js`**: Adicionar uma função que exporta um relatório específico de "Bens e Direitos" para o IRPF, detalhando quantidade e preço médio.
- [ ] **`30_DARF_Generator.js`**: Criar uma interface para "Conciliação Anual", onde o usuário pode validar os meses processados contra as notas de corretagem originais.
- [ ] **Monitoramento de Preço Médio**: Implementar um novo módulo ou função que calcule e armazene o preço médio por ativo a partir das notas.

## 3. Script de Validação de Consistência (Sugestão)
Um script que verifica:
1. Se todos os meses possuem notas de corretagem registradas.
2. Se o saldo de prejuízo acumulado de um mês bate com o início do próximo.
3. Se o IR Fonte calculado na planilha confere com a soma das notas.

---
*Este documento serve como roteiro para as próximas etapas de implementação fiscal.*
