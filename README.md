# Analisador de Perfil Gupy — IA

Sistema web que analisa perfis da plataforma Gupy usando Inteligência Artificial (Claude).

## Estrutura

```
gupy-analyzer/
├── index.html     ← Interface web (renomeie gupy-analyzer.html)
├── server.js      ← Servidor Node.js (renomeie gupy-server.js)
├── package.json
└── README.md
```

## Como rodar localmente

```bash
# 1. Instalar dependências (nenhuma — zero dependências externas)
# 2. Rodar o servidor
ANTHROPIC_API_KEY=sua-chave-aqui node server.js

# 3. Acessar
http://localhost:3000
```

## Como publicar no Render (grátis)

1. Crie um repositório no GitHub com os arquivos
2. Acesse render.com → "New Web Service"
3. Conecte o repositório
4. Configure:
   - **Language:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Em **Environment Variables**, adicione:
   - `ANTHROPIC_API_KEY` → sua chave da API do Claude

## Onde obter a chave da API

1. Acesse: https://console.anthropic.com
2. Crie uma conta gratuita
3. Vá em "API Keys" → "Create Key"
4. Copie a chave e cole no Render como variável de ambiente

## Segurança

A chave da API fica **apenas no servidor** (variável de ambiente do Render).
Ela nunca é exposta no código ou no navegador do usuário.
