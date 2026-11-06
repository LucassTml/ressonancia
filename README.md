# Ressonância — enciclopédia interativa de áudio

Plataforma educacional sobre acústica, psicoacústica, eletrônica, áudio digital e fones IEM. Combina artigos aprofundados (escritos como um livro técnico, em português) com laboratórios interativos que fazem cálculos e processamento de áudio de verdade no navegador, via Web Audio API.

- **9 módulos, 58 artigos** — de “o que é som” a “como avaliar uma alegação em áudio”.
- **46 laboratórios** — ondas, ISO 226, pinna gain, laboratório de resposta em frequência, EQ paramétrico com seus arquivos, autoEQ, DAC, amostragem com reconstrução sinc, ABX com estatística, tuning de IEM e mais.
- **Glossário** com definições contextuais nos artigos, **busca** (Ctrl/⌘ K), **favoritos** e **tema claro (padrão) ou escuro** pelo botão no topo, salvos localmente.
- Sem cadastro, sem quizzes, sem gamificação. Nenhum áudio é enviado a servidores.

## Executar

Requer Node.js 18+.

```bash
npm install
npm run dev
```

Abra http://localhost:5173. Para gerar a versão de produção:

```bash
npm run build
npm run preview
```

O build gera um site estático em `dist/`. Por usar rotas do navegador (`/modulo/artigo`), o servidor de hospedagem precisa redirecionar rotas desconhecidas para `index.html` (o `vite preview` já faz isso).

Outros scripts:

- `npm run typecheck` — checagem de tipos.
- `npm run check` — verifica a integridade do conteúdo (artigos do sumário, laboratórios e links internos).

## Arquitetura

```
src/
  content/
    manifest.ts          Sumário: módulos e artigos (adicione novos artigos aqui)
    articles/<modulo>/   Artigos em MDX (prosa + componentes interativos)
    glossary.ts          Glossário
    perception.ts        Tradução de desvios de resposta em descrições perceptivas
    registry.ts          Carregamento sob demanda e índice de busca
  labs/                  Laboratórios (um componente por arquivo), registrados em labs/index.ts
  audio/                 Motor de áudio, DSP (biquads, FFT, FIR de fase mínima), ISO 226, autoEQ, modelos de impedância
  viz/                   Gráfico de resposta em frequência e osciloscópio/analisador
  components/            Layout, interface (controles, áudio) e componentes editoriais do MDX
  data/                  Curvas-alvo (dados do projeto AutoEq, licença MIT)
  lib/                   Preferências, favoritos, hooks
plugins/rehype-glossary.mjs   Marca a primeira ocorrência de termos do glossário em cada artigo
scripts/                      Conversão das curvas-alvo e verificação de conteúdo
```

### Adicionar um artigo

1. Crie `src/content/articles/<modulo>/<slug>.mdx`.
2. Registre o artigo em `src/content/manifest.ts` (título, resumo, laboratórios e artigos relacionados).
3. Componentes disponíveis no MDX sem importação: `Lead`, `Callout` (tipos `nota`, `chave`, `mito`, `atencao`, `aprofundar`, `evidencia`, `simplificacao`, `preferencia`), `Figure`, `Vars`, `KeyNumbers`, `Term`, `Lab`, `References` e `Ref`. Fórmulas com `$...$` e `$$...$$` (KaTeX).
4. Rode `npm run check`.

### Adicionar um laboratório

Crie o componente em `src/labs/<modulo>/` usando `LabFrame` e registre-o em `src/labs/index.ts`. Ele passa a aparecer no laboratório central e pode ser inserido em qualquer artigo com `<Lab id="..." />`.

## Áudio e segurança auditiva

Nenhum som toca automaticamente. Toda saída passa por um volume mestre (salvo localmente) e por um limitador em −3 dBFS. Apenas um laboratório toca por vez. Os laboratórios exibem um aviso de proteção auditiva até o usuário confirmá-lo.

## Dados e créditos

- Curvas-alvo (Harman 2016–2019, campo difuso 5128 e ISO 11904): derivadas do projeto [AutoEq](https://github.com/jaakkopasanen/AutoEq), © Jaakko Pasanen, licença MIT.
- Curvas de “assinaturas” e de IEMs nos laboratórios são sintéticas e representativas — não são medições de produtos.
- Música de demonstração: composição original sintetizada no navegador; a melodia do laboratório de altura é a *Ode à Alegria* (Beethoven, domínio público).

## Publicar na Vercel

O repositório já inclui `vercel.json` (framework Vite, saída em `dist/` e reescrita de rotas para `index.html`). Basta importar o repositório em vercel.com/new — não é preciso configurar nada além disso.
