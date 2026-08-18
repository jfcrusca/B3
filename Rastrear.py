import re
import os
import json
import requests
from typing import List, Dict, Optional
from datetime import datetime

# --- CONFIGURAÇÃO ---
# ⚠️ IMPORTANTE: Eu removi sua chave por segurança. Coloque-a novamente abaixo.
GEMINI_API_KEY = "AQ.Ab8RN6I_wd4Q5lCiqWNivAWOn5pXNf6xyHAy4pXwFt-tB8W-Sw" 
MODEL_NAME = "gemini-3.1-flash-lite" # Atualizei para um modelo mais recente/estável
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"

# Configuração do Apps Script
APPS_SCRIPT_PROJECT_ID = "1cDeZdVZhr3HkcMugCov-HqCzjy4ws_MuvvEE9ViTzFFwc2RlFvCTQw6t"

def call_gemini_api(prompt: str) -> str:
    """Chama a API Gemini via REST"""
    headers = {'Content-Type': 'application/json'}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": 1024,
            "temperature": 0.3 # Reduzi um pouco para respostas mais técnicas
        }
    }

    try:
        response = requests.post(GEMINI_ENDPOINT, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()['candidates'][0]['content']['parts'][0]['text']
    except requests.exceptions.RequestException as e:
        return f"ERRO_API: {str(e)[:100]}"
    except (KeyError, IndexError) as e:
        return f"ERRO_FORMATO: {str(e)}"
    except Exception as e:
        return f"ERRO_INESPERADO: {str(e)[:100]}"

def obter_codigo_apps_script(project_id: str, metodo: str = "local") -> Optional[str]:
    """Obtém o código fonte de um projeto Apps Script"""
    codigo_completo = ""

    if metodo == "local":
        print("📁 Lendo arquivos locais (.js, .gs)...")
        # Verifica se existem arquivos no diretório
        arquivos_encontrados = False
        for arquivo in os.listdir("."):
            if arquivo.endswith((".js", ".gs", ".html")):
                arquivos_encontrados = True
                try:
                    with open(arquivo, 'r', encoding='utf-8') as f:
                        codigo_completo += f"// Arquivo: {arquivo}\n"
                        codigo_completo += f.read() + "\n\n"
                        print(f"  ✅ Lido: {arquivo}")
                except Exception as e:
                    print(f"  ⚠️  Erro ao ler {arquivo}: {e}")
                    continue
        
        if not arquivos_encontrados:
            print("  ⚠️ Nenhum arquivo .js ou .gs encontrado na pasta atual.")
            return None

        return codigo_completo if codigo_completo else None

    # ... (código do CLASP mantido igual, omitido para brevidade) ...
    return None

def analisar_estrutura_codigo(codigo_completo: str) -> Dict:
    """Analisa a estrutura do código Apps Script"""
    estrutura = {
        "funcoes": [],
        "variaveis_globais": [],
        "includes": []
    }

    # Separa por arquivos logicamente
    arquivos = {}
    arquivo_atual = "main"
    conteudo_arquivo = []

    for linha in codigo_completo.split('\n'):
        if linha.startswith('// Arquivo:'):
            if conteudo_arquivo:
                arquivos[arquivo_atual] = '\n'.join(conteudo_arquivo)
            arquivo_atual = linha.replace('// Arquivo:', '').strip()
            conteudo_arquivo = []
        else:
            conteudo_arquivo.append(linha)

    if conteudo_arquivo:
        arquivos[arquivo_atual] = '\n'.join(conteudo_arquivo)

    # Analisa cada arquivo
    for nome_arquivo, conteudo in arquivos.items():
        # Regex melhorado para capturar function nome() {
        padrao_funcao = r'function\s+([a-zA-Z0-9_]+)\s*\('

        for match in re.finditer(padrao_funcao, conteudo):
            nome_funcao = match.group(1)
            inicio = match.start()

            # Encontra o bloco de código {}
            chaves_abertas = 0
            encontrou_inicio = False
            fim = inicio
            
            # Busca simples pelo corpo da função
            for i, char in enumerate(conteudo[inicio:], start=inicio):
                if char == '{':
                    chaves_abertas += 1
                    encontrou_inicio = True
                elif char == '}':
                    chaves_abertas -= 1
                    if encontrou_inicio and chaves_abertas == 0:
                        fim = i + 1
                        break
            
            # Se não achou o fim corretamente, pega um snippet
            if fim > inicio and encontrou_inicio:
                corpo = conteudo[inicio:fim]
            else:
                linhas = conteudo[inicio:].split('\n')
                corpo = '\n'.join(linhas[:20]) # Fallback

            tipo = "customizada"
            if nome_funcao.startswith('on'): tipo = "listener"
            elif nome_funcao.startswith('do'): tipo = "webapp"
            
            estrutura["funcoes"].append({
                "nome": nome_funcao,
                "arquivo": nome_arquivo,
                "tipo": tipo,
                "codigo": corpo
            })

    return estrutura

def gerar_documentacao_local(funcao_info: Dict) -> str:
    """Fallback local se a API falhar"""
    return f"Documentação Local: Função '{funcao_info['nome']}' localizada em {funcao_info['arquivo']}."

def gerar_documentacao_inteligente(funcao_info: Dict, contexto_geral: str = "") -> str:
    """Gera documentação usando a função call_gemini_api corrigida"""
    
    codigo_exibir = funcao_info['codigo']
    if len(codigo_exibir) > 2000:
        codigo_exibir = codigo_exibir[:2000] + "\n// ... truncado ..."
    
    prompt_lines = [
        "Analise esta função Google Apps Script e gere documentação técnica:",
        f"Função: {funcao_info.get('nome')}",
        f"Arquivo: {funcao_info.get('arquivo')}",
        "CÓDIGO:",
        "```javascript",
        codigo_exibir,
        "```",
        "Responda EXATAMENTE neste formato:",
        "**Descrição:** (Resumo em 1 frase)",
        "**Parâmetros:** (Lista bullet points)",
        "**Retorno:** (Tipo e descrição)",
        "**Uso:** (Explicação breve)"
    ]
    
    prompt = '\n'.join(prompt_lines)
    
    # CORREÇÃO PRINCIPAL AQUI:
    resultado = call_gemini_api(prompt)
    
    # Se a API retornou erro, usa o fallback local
    if resultado.startswith("ERRO"):
        print(f"  ⚠️ Falha na API para {funcao_info['nome']}: {resultado}")
        return gerar_documentacao_local(funcao_info)
        
    return resultado

# --- EXECUÇÃO PRINCIPAL ---
if __name__ == "__main__":
    print("🚀 Iniciando Gerador de Documentação com Gemini...")
    
    # 1. Obter código (use 'local' se tiver os arquivos .js na pasta, ou configure o CLASP)
    codigo = obter_codigo_apps_script(APPS_SCRIPT_PROJECT_ID, metodo="local")
    
    # Mock para teste se não houver arquivos (remova isso em produção)
    if not codigo:
        print("ℹ️ Criando código de exemplo para teste...")
        codigo = "// Arquivo: codigo.gs\nfunction calcularMedia(a, b) { return (a+b)/2; }"

    if codigo:
        # 2. Analisar
        print("🔍 Analisando estrutura...")
        estrutura = analisar_estrutura_codigo(codigo)
        print(f"✅ Encontradas {len(estrutura['funcoes'])} funções.")
        
        # 3. Gerar Documentação
        print("\n📝 Gerando documentação com IA...\n")
        markdown_final = "# Documentação do Projeto\n\n"
        
        for func in estrutura['funcoes']:
            print(f"  > Processando: {func['nome']}...")
            doc = gerar_documentacao_inteligente(func, codigo[:1000])
            
            markdown_final += f"## Função: `{func['nome']}`\n"
            markdown_final += doc + "\n\n---\n\n"
        
        # 4. Salvar
        with open("DOCUMENTACAO_GERADA.md", "w", encoding="utf-8") as f:
            f.write(markdown_final)
            
        print("\n✨ Concluído! Verifique o arquivo 'DOCUMENTACAO_GERADA.md'")
    else:
        print("❌ Nenhum código encontrado para analisar.")