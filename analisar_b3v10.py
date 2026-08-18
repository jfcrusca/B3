import os
import re
import json
import pandas as pd
from pathlib import Path
from collections import defaultdict, Counter
import matplotlib
matplotlib.use('Agg')  # Backend não-interativo para evitar erros de GUI
import matplotlib.pyplot as plt
import networkx as nx
from datetime import datetime

class AnalisadorEspecializadoB3v10:
    """
    Analisador especializado para o projeto B3-v10
    Analisa módulos de Apps Script (.js exportado)
    """

    def __init__(self, pasta_modulos):
        self.pasta = Path(pasta_modulos)
        self.modulos = {}
        self.dependencias = defaultdict(list)
        self.funcoes_globais = defaultdict(list)
        self.erros = []

        # Padrões específicos do B3-v10
        self.padroes_especificos = {
            'apps_script_services': [
                r'SpreadsheetApp\.', r'UrlFetchApp\.', r'Logger\.', r'Utilities\.',
                r'DriveApp\.', r'CacheService\.', r'PropertiesService\.', r'ScriptApp\.'
            ],
            'apis_financeiras': [
                r'brapi\.com\.br', r'query1\.finance\.yahoo\.com', r'GoogleFinance',
                r'getCotacao', r'getHistorico', r'fetchQuote'
            ],
            'ia_integracao': [
                r'deepseek', r'gemini', r'openai', r'processarComIA',
                r'analisarComIA', r'AgenticEnricher', r'AI_Unified'
            ],
            'telegram': [
                r'api\.telegram\.org', r'sendMessage', r'enviarMensagemTelegram'
            ],
            'indicadores_tecnicos': [
                r'calcularRSI', r'calcularMACD', r'calcularEMA', r'VolumeProfile'
            ],
            'fibonacci': [
                r'fibonacci', r'pivots?', r'retracoes'
            ]
        }

        # Categorias do Sistema
        self.categorias = {
            'core_orchestration': {'keywords': ['00_', 'orchestrator', 'core', 'pipeline'], 'descricao': 'Orquestração Core'},
            'config_setup': {'keywords': ['01_', 'config', 'setup', 'init'], 'descricao': 'Configuração'},
            'data_management': {'keywords': ['05_', 'data', 'ticker', 'sheet', 'manager'], 'descricao': 'Gestão de Dados'},
            'api_fetchers': {'keywords': ['10_', '26_', 'brapi', 'yahoo', 'fetch'], 'descricao': 'APIs Externas'},
            'technical_indicators': {'keywords': ['11_', '12_', '13_', 'indicator', 'technical'], 'descricao': 'Indicadores Técnicos'},
            'ai_analysis': {'keywords': ['07_', '15_', '34_', 'ai', 'agent', 'gpt'], 'descricao': 'Inteligência Artificial'},
            'trading_logic': {'keywords': ['22_', '30_', '31_', '41_', 'rank', 'portfolio', 'strategy'], 'descricao': 'Lógica de Trading'},
            'utils': {'keywords': ['utils', 'tools', 'helper'], 'descricao': 'Utilitários'},
            'security': {'keywords': ['24_', '51_', 'secret', 'key', 'auth'], 'descricao': 'Segurança'}
        }

    def analisar_modulo_js(self, arquivo):
        """Lê e analisa um arquivo JS com tratamento de erro e encoding"""
        conteudo = None
        # Tenta múltiplos encodings
        for enc in ['utf-8', 'latin-1', 'cp1252']:
            try:
                with open(arquivo, 'r', encoding=enc) as f:
                    conteudo = f.read()
                break
            except:
                continue
        
        if conteudo is None:
            self.erros.append(f"Erro de leitura (encoding): {arquivo.name}")
            return None

        nome_modulo = arquivo.stem

        # Extrações
        funcoes = self._extrair_funcoes_avancado(conteudo)
        dependencias = self._extrair_dependencias(conteudo, nome_modulo)
        metricas = self._calcular_metricas(conteudo)
        padroes = self._detectar_padroes(conteudo)
        categoria = self._determinar_categoria(nome_modulo, conteudo)
        documentacao = self._extrair_documentacao(conteudo)
        
        # Identificar responsabilidade
        responsabilidade = self.categorias.get(categoria, {}).get('descricao', 'Geral')

        return {
            'nome_arquivo': arquivo.name,
            'nome_modulo': nome_modulo,
            'categoria': categoria,
            'responsabilidade': responsabilidade,
            'funcoes': funcoes,
            'num_funcoes': len(funcoes),
            'dependencias': dependencias,
            'metricas': metricas,
            'padroes': padroes,
            'documentacao': documentacao,
            'resumo': self._gerar_resumo(documentacao, funcoes)
        }

    def _extrair_funcoes_avancado(self, conteudo):
        """Regex melhorado para capturar functions, arrow functions e classes"""
        funcoes = []
        
        # 1. Function Declaration: function nome(p1, p2)
        padrao_tradicional = r'function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)'
        
        # 2. Variable Assignment: const nome = function(p1) ou const nome = (p1) =>
        padrao_var = r'(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:function\s*)?(?:\(([^)]*)\)|[a-zA-Z0-9_$]+)\s*=>?'

        # Processar Tradicional
        for m in re.finditer(padrao_tradicional, conteudo):
            funcoes.append({
                'nome': m.group(1),
                'parametros': [p.strip() for p in m.group(2).split(',') if p.strip()],
                'tipo': 'function',
                'publica': not m.group(1).startswith('_')
            })

        # Processar Arrow/Var
        for m in re.finditer(padrao_var, conteudo):
            # Evita duplicatas se o regex pegar coisas já pegas
            if not any(f['nome'] == m.group(1) for f in funcoes):
                params_str = m.group(2) if m.group(2) else ""
                funcoes.append({
                    'nome': m.group(1),
                    'parametros': [p.strip() for p in params_str.split(',') if p.strip()],
                    'tipo': 'arrow/const',
                    'publica': not m.group(1).startswith('_')
                })
        
        return funcoes

    def _extrair_dependencias(self, conteudo, modulo_atual):
        deps = {'modulos': [], 'apis': [], 'google': []}
        
        # Google Services
        for svc in ['SpreadsheetApp', 'UrlFetchApp', 'DriveApp', 'CacheService']:
            if svc in conteudo: deps['google'].append(svc)
            
        # APIs Externas
        if 'brapi' in conteudo.lower(): deps['apis'].append('Brapi')
        if 'yahoo' in conteudo.lower(): deps['apis'].append('Yahoo')
        
        # Dependência de outros módulos (heurística simples por nome conhecido)
        # Em um cenário real, você listaria todos os arquivos primeiro
        known_modules = ['Orchestrator', 'Logger', 'DataService', 'Ranker']
        for km in known_modules:
            if km in conteudo and km != modulo_atual:
                deps['modulos'].append(km)
                
        return deps

    def _calcular_metricas(self, conteudo):
        linhas = conteudo.split('\n')
        loc = len([l for l in linhas if l.strip() and not l.strip().startswith('//')])
        complexidade = conteudo.count('if ') + conteudo.count('for ') + conteudo.count('while ') + conteudo.count('&&')
        return {
            'linhas_total': len(linhas),
            'linhas_codigo': loc,
            'complexidade_ciclomatica': complexidade,
            'num_todos': conteudo.count('TODO')
        }

    def _detectar_padroes(self, conteudo):
        encontrados = {}
        for cat, patterns in self.padroes_especificos.items():
            matches = [p.replace('\\', '') for p in patterns if re.search(p, conteudo, re.IGNORECASE)]
            if matches:
                encontrados[cat] = matches
        return encontrados

    def _determinar_categoria(self, nome, conteudo):
        nome_lower = nome.lower()
        for cat, info in self.categorias.items():
            if any(k in nome_lower for k in info['keywords']):
                return cat
        return 'utils' # Default

    def _extrair_documentacao(self, conteudo):
        doc = {'descricao': '', 'todos': []}
        
        # Extrair TODOs
        todos = re.findall(r'//\s*TODO:?(.*)', conteudo)
        doc['todos'] = [t.strip() for t in todos]
        
        # Extrair bloco JSDoc inicial
        match = re.search(r'/\*\*(.*?)\*/', conteudo, re.DOTALL)
        if match:
            lines = [l.strip().strip('*').strip() for l in match.group(1).split('\n')]
            doc['descricao'] = ' '.join([l for l in lines if l and not l.startswith('@')])[:200]
            
        return doc

    def _gerar_resumo(self, doc, funcoes):
        if doc['descricao']: return doc['descricao']
        if funcoes: return f"Módulo com {len(funcoes)} funções: {', '.join([f['nome'] for f in funcoes[:3]])}..."
        return "Sem descrição detectada."

    def analisar_todos_modulos(self):
        arquivos = list(self.pasta.glob('**/*.js'))
        print(f"📂 Encontrados {len(arquivos)} arquivos .js em {self.pasta}")
        
        for arq in arquivos:
            print(f"  -> Analisando: {arq.name}...", end='\r')
            dados = self.analisar_modulo_js(arq)
            if dados:
                self.modulos[arq.name] = dados
                # Mapear dependências para grafo
                for dep in dados['dependencias']['modulos']:
                    self.dependencias[arq.name].append(dep)
        print("\n✅ Análise concluída.")

    def gerar_relatorios(self):
        if not self.modulos:
            print("❌ Nenhum módulo para gerar relatório.")
            return

        print("\n📊 GERANDO RELATÓRIOS...")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")

        # 1. Excel Principal
        rows = []
        for nome, m in self.modulos.items():
            rows.append({
                'Arquivo': nome,
                'Categoria': m['categoria'],
                'Linhas': m['metricas']['linhas_codigo'],
                'Funções': m['num_funcoes'],
                'Complexidade': m['metricas']['complexidade_ciclomatica'],
                'TODOs': m['metricas']['num_todos'],
                'Serviços Google': ', '.join(m['dependencias']['google']),
                'Resumo': m['resumo']
            })
        
        df = pd.DataFrame(rows)
        df.to_excel('relatorio_principal_b3v10.xlsx', index=False)
        print("✅ [1/8] relatorio_principal_b3v10.xlsx")

        # 2. Estatísticas Categorias
        df_cats = df.groupby('Categoria').agg({
            'Arquivo': 'count',
            'Linhas': 'sum',
            'Funções': 'sum',
            'Complexidade': 'mean'
        }).reset_index()
        df_cats.to_excel('estatisticas_categorias.xlsx', index=False)
        print("✅ [2/8] estatisticas_categorias.xlsx")

        # 3. JSON Completo
        with open('estrutura_completa_b3v10.json', 'w', encoding='utf-8') as f:
            json.dump(self.modulos, f, indent=2, ensure_ascii=False)
        print("✅ [3/8] estrutura_completa_b3v10.json")

        # 4. Mapa Dependências (PNG)
        try:
            G = nx.DiGraph()
            for origem, deps in self.dependencias.items():
                for dest in deps:
                    G.add_edge(origem, dest)
            
            plt.figure(figsize=(12, 8))
            pos = nx.spring_layout(G, k=0.5)
            nx.draw(G, pos, with_labels=True, node_size=1000, font_size=8, node_color='lightblue', edge_color='gray')
            plt.title("Mapa de Dependências B3-v10")
            plt.savefig('mapa_dependencias.png')
            plt.close()
            print("✅ [4/8] mapa_dependencias.png")
        except Exception as e:
            print(f"⚠️ Erro ao gerar gráfico: {e}")

        # 5. Módulos Críticos (TXT)
        with open('modulos_criticos.txt', 'w', encoding='utf-8') as f:
            f.write("=== MÓDULOS CRÍTICOS ===\n\n")
            criticos = [m for m in self.modulos.values() if m['metricas']['linhas_codigo'] > 500 or m['metricas']['complexidade_ciclomatica'] > 50]
            for c in criticos:
                f.write(f"⚠️ {c['nome_arquivo']} | Linhas: {c['metricas']['linhas_codigo']} | Complexidade: {c['metricas']['complexidade_ciclomatica']}\n")
        print("✅ [5/8] modulos_criticos.txt")

        # 6. Sugestões Organização
        with open('sugestoes_organizacao.txt', 'w', encoding='utf-8') as f:
            f.write("=== SUGESTÃO DE ESTRUTURA ===\n\n")
            por_cat = defaultdict(list)
            for m in self.modulos.values():
                por_cat[m['categoria']].append(m['nome_arquivo'])
            
            for cat, arqs in por_cat.items():
                f.write(f"📁 /{cat.upper()}\n")
                for a in arqs:
                    f.write(f"  - {a}\n")
                f.write("\n")
        print("✅ [6/8] sugestoes_organizacao.txt")

        # 7. Documentação Automática (MD)
        with open('documentacao_automatica.md', 'w', encoding='utf-8') as f:
            f.write("# Documentação B3-v10\n\n")
            for m in self.modulos.values():
                f.write(f"## {m['nome_modulo']}\n")
                f.write(f"**Categoria:** {m['categoria']}\n\n")
                f.write(f"**Resumo:** {m['resumo']}\n\n")
                if m['funcoes']:
                    f.write("### Funções:\n")
                    for func in m['funcoes']:
                        f.write(f"- `{func['nome']}` ({', '.join(func['parametros'])})\n")
                f.write("\n---\n")
        print("✅ [7/8] documentacao_automatica.md")

        # 8. Funções Duplicadas
        with open('funcoes_duplicadas.txt', 'w', encoding='utf-8') as f:
            all_funcs = []
            for m in self.modulos.values():
                for func in m['funcoes']:
                    all_funcs.append(func['nome'])
            
            duplicadas = [item for item, count in Counter(all_funcs).items() if count > 1]
            f.write("=== FUNÇÕES COM NOMES DUPLICADOS ===\n")
            for d in duplicadas:
                f.write(f"- {d}\n")
        print("✅ [8/8] funcoes_duplicadas.txt")
        
        print("\n🏁 TUDO PRONTO!")

def main():
    print("="*60)
    print("🚀 ANALISADOR B3-V10 (VERSÃO CORRIGIDA)")
    print("="*60)
    
    # Pergunta o caminho interativamente
    path_input = input("\nCole o caminho da pasta com os arquivos .js: ").strip()
    path_input = path_input.replace('"', '') # Remove aspas do Windows
    
    if not os.path.exists(path_input):
        print("❌ Caminho não encontrado!")
        return

    analisador = AnalisadorEspecializadoB3v10(path_input)
    analisador.analisar_todos_modulos()
    analisador.gerar_relatorios()

if __name__ == "__main__":
    main()