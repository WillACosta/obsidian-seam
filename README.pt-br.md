# Seam — Organização de Notas sem Fricção para o Obsidian

> [English](README.md) · **Português**

> Capture ideias, use tags naturalmente e deixe o Seam organizar suas notas em segundo plano.

Seam é um plugin leve para Obsidian que organiza notas por meio de tags. Inspirado no método [Zettelkasten](https://zettelkasten.de/introduction/) e em aplicativos como Apple Notes e Bear, ele usa um fluxo simples entre `Fleeting`, `Permanent` e `Archive`. Adicione `#permanent` ou `#archive` para mover uma nota e use a Paleta Universal para pesquisar em seu cofre. Passe menos tempo gerenciando arquivos e mais tempo escrevendo.

!["Apresentação Seam"](docs/images/seam_showcase.gif)

## Por que o Seam?

O Seam simplifica a organização e não interrompe seu trabalho:

| Fluxo Tradicional | Com o Seam |
|:---|:---|
| ❌ Mover arquivos manualmente entre pastas | ✅ Adicione `#permanent` para organizar uma nota |
| ❌ Misturar notas concluídas com trabalhos ativos | ✅ Adicione `#archive` para tirá-las do caminho |
| ❌ Alternar entre várias ferramentas de busca | ✅ Pesquise notas, conteúdo, tags e comandos em uma paleta |
| ❌ Usar ferramentas diferentes para buscar e criar notas rápidas | ✅ Faça buscas especiais, crie notas com o Quick Capture e mantenha notas de documentos vinculadas ao original |
| ❌ Manter uma estrutura complexa de pastas | ✅ Use um fluxo simples guiado por tags |
| ❌ Depender de recursos exclusivos para desktop | ✅ Use o Seam no computador ou no celular |

## Como o Seam se integra à sua rotina

### 1. Capture sem Fricção (Notas Efêmeras / Fleeting)

Abra a **Paleta Universal** pela paleta de comandos do Obsidian ou com o atalho que você escolher. Digite o título de uma nota e, se ela ainda não existir, pressione `Enter` para criá-la em `Fleeting/`. Você também pode usar um modelo com suas propriedades e seções preferidas.

```
Paleta Universal → "Reunião com Equipe de Design" → [Criar nova nota]
```
!["Criando nova nota"](./docs/images/creating_new_note.png)

### 2. Salve Notas Permanentes (`#permanent`)

Quando uma nota estiver pronta para ser guardada, adicione `#permanent` ao texto ou às propriedades.

O Seam irá:

1. Mover a nota para sua pasta `Permanent/`.
2. Remover a tag de ação `#permanent`.
3. Remover outras tags ou propriedades escolhidas nas configurações.

### 3. Arquive Trabalhos Concluídos (`#archive`)

Quando uma nota de projeto, tarefa ou reunião estiver concluída, adicione `#archive`.

1. A nota é movida para a pasta `Archive/`.
2. O Seam remove a tag de ação `#archive`.
3. O Seam pode adicionar `#archived` para facilitar buscas futuras.

!["Arquivando uma nota"](./docs/images/archiving.png)

### 4. Busque e Filtre com Tags Dinâmicas

Abra a **Paleta Universal**:

- **Pesquise notas e conteúdo**: Encontre termos em títulos, caminhos e textos.
- **Filtre por tag**: Digite `#` para ver as tags e pressione `Enter` para adicionar uma.
- **Combine filtros**: Adicione vários chips de tags e remova-os com `Backspace` ou `×`.
- **Abra em uma nova aba**: Pressione `Cmd + Enter` no macOS ou `Ctrl + Enter` no Windows e Linux.

!["Busca combinada"](./docs/images/combined_search.png)

## Principais Funcionalidades

### Roteamento Automático por Tags

O Seam identifica tags de ação no texto ou nas propriedades da nota. Ele cria as pastas de destino quando necessário, evita sobrescrever arquivos e só remove as tags depois que a nota é movida. Se uma nota tiver `#permanent` e `#archive` ao mesmo tempo, o Seam a mantém no lugar.

### Paleta Universal

Pesquise e execute ações em um só lugar:

- Encontre notas por título, caminho, tag ou conteúdo.
- Veja uma prévia do texto encontrado antes de abrir a nota.
- Crie uma nota efêmera quando nenhum resultado corresponder à busca.
- Digite `>` para executar comandos do Seam.

### Buscas Personalizadas

Deixe suas buscas favoritas sempre à mão. Crie atalhos para projetos, listas de leitura ou qualquer coleção de notas e fixe-os na Paleta Universal. Ao criar uma consulta, escolha como ela deve encontrar as notas:

- **Sistema de busca do Seam**: Combine tags, filtros por pasta e busca por texto em uma consulta reutilizável.
- **Bases**: Use uma Base e suas visualizações para explorar os resultados em tabelas ou cartões na Paleta Universal.

!["Buscas personalizadas e Bases"](./docs/images/custom_queries.png)

### Limpeza Automática ao Mover

Escolha quais tags temporárias e propriedades o Seam remove depois de mover uma nota. Por exemplo, você pode limpar `#todo`, `#review` ou a propriedade `status`.

### Modelos para Notas Efêmeras

Escolha uma nota modelo, como `Templates/Nota Efêmera`. Novas notas criadas pela paleta começarão com seu conteúdo e suas propriedades.

### Notas de Fontes

Traga anotações manuscritas, documentos e imagens para o seu fluxo de notas. Exporte os arquivos para `Sources/`, e o Seam cria uma nota vinculada ao original.

Encontre suas fontes com `@sources` na Paleta Universal e leia PDFs com páginas contínuas.

!["Nota de fonte com PDF"](./docs/images/sources.png)

### Compatibilidade Total com Dispositivos Móveis

O Seam usa as APIs públicas do Obsidian e não depende de código exclusivo para desktop. Ele funciona no computador, iPhone, iPad e Android.

## Configurações

!["Configurações do Seam"](./docs/images/settings.png)

Personalize o Seam em **Configurações → Plugins da comunidade → Seam**.

## Instalação

### Pelos Plugins da Comunidade do Obsidian

1. Abra **Configurações → Plugins da comunidade** no Obsidian.
2. Desative o **Modo restrito**, se necessário.
3. Clique em **Explorar** e procure por **Seam**.
4. Clique em **Instalar** e depois em **Ativar**.

### Instalação Manual

1. Baixe o release mais recente (`main.js`, `manifest.json`, `styles.css`) na página de [Releases](https://github.com/WillACosta/obsidian-seam/releases).
2. Crie uma pasta chamada `obsidian-seam` no diretório de plugins do seu cofre: `<cofre>/.obsidian/plugins/obsidian-seam/`.
3. Copie os arquivos baixados para dentro dessa pasta.
4. Recarregue o Obsidian e ative o **Seam** em **Configurações → Plugins da comunidade**.

## Como filtrar no Seam

Use estes tokens na Paleta Universal para filtrar buscas ou acessar outros modos:

| Token | O que faz | Exemplo |
|:---|:---|:---|
| `#tag` | Filtra notas por tag. | `#leitura` |
| `!#tag` ou `-#tag` | Exclui notas com uma tag. | `!#arquivado` |
| `dir:` | Filtra notas por pasta. Coloque entre aspas os caminhos com espaços. | `dir:Fleeting` · `dir:"Arquivo de Projetos"` |
| `@` | Executa uma busca especial integrada ou personalizada. | `@today` · `@sources` · `@livros` |
| `OR` ou `||` | Busca por um termo ou pelo outro. | `#leitura OR #pesquisa` |
| `>` | Mostra e executa comandos do Seam. | `>archive` |

## Idiomas

O Seam usa o idioma configurado no Obsidian. Atualmente, oferece suporte a:

- **Inglês (US)**
- **Português (BR)**

Outros idiomas usam o inglês por padrão.

### Como Contribuir com Traduções

Quer usar o Seam em outro idioma? Contribuições são bem-vindas:

1. Crie um novo arquivo de idioma em `src/i18n/locales/<código-do-idioma>.ts` (ex: `es.ts`, `fr.ts`, `de.ts`) implementando a interface `Translations`.
2. Registre o novo idioma em `src/i18n/index.ts`.
3. Abra um Pull Request no [GitHub](https://github.com/WillACosta/obsidian-seam).

## Apoie o Projeto

O Seam é gratuito e de código aberto. Se ele economiza seu tempo, considere apoiar seu desenvolvimento:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/willac)

**Pix**<br>

!["QRCode PIX"](./docs/images/qrcode.svg)

## Desenvolvimento

Para instruções de desenvolvimento, diretrizes de desenvolvimento orientado por especificações (SDD) e procedimentos de release, consulte o [README.dev.md](README.dev.md).

## Licença

Este projeto está sob a licença [GNU General Public License v3.0](LICENSE).

## Como foi construído

O Seam foi desenvolvido com o auxílio de agentes de IA. Cada iteração foi guiada e documentada com especificações em texto escritas por mim.

Desenvolvido com cuidado por **William A. Costa** ([@WillACosta](https://github.com/WillACosta)).
