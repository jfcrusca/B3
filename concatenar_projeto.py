import os

def concatenar_arquivos(extensoes=['.js', '.gs'], arquivo_saida='PROJETO_CONCATENADO.txt'):
    """
    Varre o diretório atual em busca de arquivos com as extensões fornecidas
    e concatena seus conteúdos em um único arquivo de saída.
    """
    arquivos_encontrados = []
    
    # Lista todos os arquivos no diretório atual
    for arquivo in os.listdir('.'):
        if any(arquivo.endswith(ext) for ext in extensoes):
            # Ignora arquivos de teste ou ferramentas de concatenação
            if arquivo in ['juntar.py', 'unir.py', 'juntar_js_em_4_txt.py', 'unir_py.py', 'concat_code.py', 'Concatenar.py']:
                continue
            arquivos_encontrados.append(arquivo)
    
    # Ordena os arquivos para consistência
    arquivos_encontrados.sort()
    
    with open(arquivo_saida, 'w', encoding='utf-8') as outfile:
        for fname in arquivos_encontrados:
            with open(fname, 'r', encoding='utf-8') as infile:
                outfile.write(f"\n/* --- ARQUIVO: {fname} --- */\n\n")
                outfile.write(infile.read())
                outfile.write("\n")
                
    print(f"Sucesso! {len(arquivos_encontrados)} arquivos concatenados em '{arquivo_saida}'.")

if __name__ == "__main__":
    concatenar_arquivos()
