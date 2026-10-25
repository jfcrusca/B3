# Análise de Conformidade Fiscal IRPF - B3-v10

Para garantir conformidade total com o Imposto de Renda (IRPF) sobre operações em bolsa (B3), o sistema atual precisa cobrir os seguintes pontos críticos, que atualmente parecem ser lacunas:

# Análise de Conformidade Fiscal IRPF - B3-v10

> **Status: IMPLEMENTADO na v4.0 do motor contábil (21_Tax_Calculator.js).**
> Ver a seção "1. O que foi corrigido" para o detalhamento técnico.

## 1. O que foi corrigido (v4.0)

Todos os itens antes pendentes foram endereçados:

- [x] **Controle de Preço Médio (Custódia):** implementado em
  `TaxCalculator.getBensEDireitos(ano)` (`taxPosicaoBensEDireitos`). Percorre as
  notas cronologicamente e aplica a regra da RFB: compras aumentam o custo médio
  ponderado; vendas reduzem a quantidade AO CUSTO MÉDIO (sem alterar o preço
  médio remanescente).
- [x] **Segregação de Mercado:** agora são **4 motores independentes** —
  `SWING` (15%), `DT` (20%), `FII` (20%) e `ETF` (15%). Antes, ETF era
  indevidamente tratado como Swing (e ganhava isenção de R$ 20k, que não se aplica).
- [x] **Relatório de Carteira (Posição em Aberto):** `getBensEDireitos(ano)`
  devolve ticker, tipo, quantidade, custo médio e custo total em 31/12.
- [x] **Compensação de Prejuízos:** motor reescrito com pool de prejuízo
  **positivo** e ordem legal: apura mês → acumula prejuízo do mês → abate pool
  anterior → aplica isenção dos R$ 20k → tributa → abate IR-Fonte **do mesmo
  mercado** → mínimo de R$ 10 com arraste.
- [x] **`21_Tax_Calculator.js`**: relatórios com trilha de auditoria completa
  (bases, abatimentos, créditos) nas abas `DARF_Mensal` (23 colunas),
  `IRPF_Resumo_Anual` (21 colunas), `Resumo_Executivo_IRPF` e bloco de
  **TOTAIS POR ANO**.
- [x] **`31_Tax_Validator.js`**: reescrito como auditor de verdade (antes era um
  stub com índices mágicos apontando para 'Data' e 'Horário'). Executa 6
  checagens e grava em `Auditoria_Fiscal`.
- [x] **`30_DARF_Generator.js`**: interface de conciliação disponível via
  `VERIFICAR_CONSISTENCIA_FISCAL()`.


## 2. Script de Validação de Consistência — IMPLEMENTADO

`31_Tax_Validator.js` executa as seguintes checagens:

| ID | Checagem | O que valida |
|----|----------|--------------|
| C1 | Cobertura mensal | Meses com `Mês Referência` válido, lacunas na série e linhas sem mês |
| C2 | Encadeamento | Saldo de prejuízo de um mês = saldo anterior − abatido no mês atual |
| C3 | IR-Fonte | Soma das colunas `IR na Fonte`/`IR Normal`/`IR DT`/`IR FII`/`IR ETF` vs apuração |
| C4 | Lucro/Prejuízo | Coluna `Lucro/Prejuízo` (Y) vs `(Valor Líquido − Custo Total)` |
| C5 | DARF | Imposto bruto consolidado = Σ dos 4 mercados |
| C6 | Mínimo de DARF | Nenhum pagamento < R$ 10,00 e nenhum valor ≥ R$ 10,00 como 'ACUMULAR' |

O resultado é gravado na aba `Auditoria_Fiscal` com severidade
(`ERRO`/`AVISO`/`OK`/`INFO`), referência (mês/mercado) e valor envolvido.

## 3. Correções contábeis aplicadas (bugs encontrados)

| # | Bug anterior | Correção |
|---|--------------|----------|
| 1 | ETF tratado como swing (ganhava isenção de R$ 20k) | Motor `ETF` dedicado a 15%, sem isenção |
| 2 | IR-Fonte abatido contra imposto de OUTRO mercado | Compensação segregada por mercado (colunas `IR Normal`/`IR DT`/`IR FII`/`IR ETF`) |
| 3 | IR retido a maior era **perdido** em meses isentos | Vira **crédito** carregado para meses futuros do mesmo mercado |
| 4 | `prejuAcumSwing` operava com valores negativos (frágil) | Pool de prejuízo sempre positivo, com `prejuizoAbatido` explícito |
| 5 | `isento` era decidido antes de acumular o prejuízo do mês | Ordem legal corrigida e coberta por testes |
| 6 | Parsing de mês aceitava só `Date` e `"set./2020"` | 8 formatos + serial do Sheets (`taxChaveMes`) |
| 7 | `31_Tax_Validator` usava `row[2]`/`row[3]` (Data/Horário) | Mapeamento dinâmico por aliases de cabeçalho |
| 8 | `52_Performance_Manager` recalculava lucro ignorando taxas | Ancora no `Lucro/Prejuízo` da fonte, com FIFO como validação cruzada |
| 9 | `30_Portfolio_Unified` abortava sem recalcular derivados | Recalcula Lucro/Prejuízo, % e Participação em lote |

## 4. Testes automatizados

`scripts/test_calculo_fiscal.js` — **84 asserções** cobrindo parsing de mês,
classificação de mercado, isenção dos R$ 20k, compensação entre meses, arraste
do mínimo de R$ 10, IR-Fonte segregado e crédito de IR. Execução:

```bash
npm run test:fiscal     # ou: node scripts/test_calculo_fiscal.js
npm run test:all        # roda fiscal + mapeamento da carteira + guard de fórmula
```

## 5. Pontos em aberto (não são bugs, são limitações de escopo)

- [ ] **Proventos (JCP/dividendos):** a coluna `Proventos` da aba `Carteira` não
  é lida pelo motor fiscal. JCP tem retenção de 15% própria e deve constar na
  ficha de Rendimentos Isentos/Exclusivos — não impacta o DARF de ganhos líquidos.
- [ ] **Conciliação com o GCAP:** o sistema gera os valores, mas não exporta no
  leiaute do programa da Receita.
- [ ] **Ajuste de IR sobre opções/futuros:** o motor cobre ações, FII e ETF;
  derivativos (opções, futuros, termo) não são classificados separadamente.

---

*Documento atualizado após a implementação da v4.0 do motor contábil.*

