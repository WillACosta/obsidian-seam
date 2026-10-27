# Seam — Organização de Notas sem Fricção para o Obsidian

> [English](README.md) · **Português**

> Capture ideias, use tags naturalmente e deixe o Seam organizar suas notas em segundo plano.

Seam é um plugin leve para Obsidian que organiza notas por meio de tags. Inspirado no método [Zettelkasten](https://zettelkasten.de/introduction/) e em aplicativos como Apple Notes e Bear, ele usa um fluxo simples entre `Fleeting`, `Permanent` e `Archive`. Adicione `#permanent` ou `#archive` para mover uma nota e use a Paleta Universal para pesquisar em seu cofre. Passe menos tempo gerenciando arquivos e mais tempo escrevendo.

!["Apresentação Seam"](docs/images/seam_showcase.gif)

## Por que o Seam?

O Seam simplifica a organização e não interrompe seu trabalho:

| Fluxo Tradicional                                                | Com o Seam                                                                                                     |
| :--------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| ❌ Mover arquivos manualmente entre pastas                       | ✅ Adicione `#permanent` para organizar uma nota                                                               |
| ❌ Misturar notas concluídas com trabalhos ativos                | ✅ Adicione `#archive` para tirá-las do caminho                                                                |
| ❌ Alternar entre várias ferramentas de busca                    | ✅ Pesquise notas, conteúdo, tags e comandos em uma paleta                                                     |
| ❌ Usar ferramentas diferentes para buscar e criar notas rápidas | ✅ Faça buscas especiais, crie notas com o Quick Capture e mantenha notas de documentos vinculadas ao original |
| ❌ Manter uma estrutura complexa de pastas                       | ✅ Use um fluxo simples guiado por tags                                                                        |
| ❌ Depender de recursos exclusivos para desktop                  | ✅ Use o Seam no computador ou no celular                                                                      |

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

Em uma consulta Base como `@bookshelf`, use as setas para cima/baixo no campo de busca para entrar na navegação dos resultados. As quatro setas navegam pelos cartões; em tabelas, cima/baixo seleciona linhas e esquerda/direita revela colunas. Pressione `Esc` para voltar à busca e novamente para fechar. Enter abre a nota selecionada; Mod+Enter abre uma nova aba e Shift+Enter abre uma divisão.

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

| Token              | O que faz                                                            | Exemplo                                |
| :----------------- | :------------------------------------------------------------------- | :------------------------------------- |
| `#tag`             | Filtra notas por tag.                                                | `#leitura`                             |
| `!#tag` ou `-#tag` | Exclui notas com uma tag.                                            | `!#arquivado`                          |
| `/`                | Filtra notas por pasta. Coloque entre aspas os caminhos com espaços. | `/Fleeting` · `/"Arquivo de Projetos"` |
| `@`                | Executa uma busca especial integrada ou personalizada.               | `@today` · `@sources` · `@livros`      |
| `OR` ou `          |                                                                      | `                                      | Busca por um termo ou pelo outro. | `#leitura OR #pesquisa` |
| `>`                | Mostra e executa comandos do Seam.                                   | `>archive`                             |

Fixe até **cinco buscas especiais**, entre integradas e personalizadas, nas configurações do Seam. As buscas fixadas aparecem primeiro na lista de `@`. Pressione **Backspace** logo após uma busca ativa para removê-la de uma vez, incluindo o espaço final.

Encontre arquivos nas pastas configuradas com `@fleeting` e `@permanent`, ou veja os dez arquivos abertos mais recentemente com `@recentlyOpened`. Combine essas buscas com outros filtros do Seam. Com o campo da Paleta vazio, pressione **↑** para percorrer as buscas anteriores da sessão; **↓** retorna em direção ao campo vazio.

As Notas Diárias aparecem com datas legíveis e um subtítulo com calendário. Se `@today` ou `@yesterday` não encontrar a Nota Diária, selecione a ação oferecida para criá-la e abri-la com o modelo configurado. Com a Nota Diária de hoje aberta, use **Mover tarefas pendentes para a nota diária de amanhã** ou **Trazer tarefas pendentes da nota diária de ontem** nos comandos do Seam. Cada comando de tarefas aparece apenas quando sua nota de origem contém trabalho pendente. O Seam usa a pasta, o formato de data e o modelo do plugin nativo Notas Diárias. Tarefas não concluídas (`[ ]`) e parcialmente concluídas (`[/]`) são movidas com o contexto dos itens pais, preservando as concluídas na origem. Se um item pai parcialmente concluído permanecer apenas com filhos concluídos, ele será marcado como concluído na origem.

### Calendário de Notas Diárias

Digite `@calendar` na Paleta Universal para navegar pelas Notas Diárias. Pontos indicam datas com notas; clique para abri-las. Clicar numa data vazia seleciona o dia e oferece **Criar nota diária**, usando a pasta, o formato de data e o modelo configurados em Notas Diárias. O calendário começa na data da Nota Diária aberta ou no dia atual. `@today`, `@yesterday` e `@calendar` ficam juntos na lista de buscas especiais.

Use as setas para cima/baixo no campo de busca para entrar no calendário; depois, navegue por dias/semanas com as setas. Page Up/Down muda o mês; com Shift, muda o ano. Clique no mês/ano ou alcance esse botão com Tab e Enter para escolher um ano e depois um mês. Enter abre ou cria a nota do dia selecionado. Pressione `Esc` uma vez para voltar ao campo e novamente para fechar a Paleta. Os controles também aceitam Tab e Enter/Espaço.

O dia selecionado também oferece **Abrir nota semanal** ou **Criar nota semanal**, com o intervalo de datas da semana. Em **Configurações do Seam → Calendário e notas periódicas**, use automaticamente as configurações habilitadas do Periodic Notes ou defina a pasta, o formato e o modelo no Seam. Use `gggg-[W]ww` para semanas locais ou `GGGG-[W]WW` para semanas ISO iniciadas na segunda-feira; o calendário segue os mesmos limites. Os modelos aceitam `{{date}}`, `{{title}}`, `{{time}}` e dias da semana, como `{{monday:YYYY-MM-DD}}`.

Use **Fixar nota** no calendário ou **Fixar nota atual no calendário** nos comandos do Obsidian/Seam para manter até três notas acima do calendário. Elas permanecem visíveis ao navegar por datas e seletores, acompanham mudanças de nome/pasta e são removidas quando a nota é excluída. Use o botão de desafixar ou **Desafixar nota atual do calendário** para remover uma delas.

**Manter esta semana fixada** usa uma dessas posições para a semana atual real. A referência acompanha cada nova semana independentemente da data navegada; se a nota não existir, sua criação é oferecida explicitamente. As demais notas, como metas anuais, continuam fixas. Tab alcança as notas e ações semanais; Enter/Espaço ativa os controles e o rodapé acompanha a ação em foco.

### Notas da semana e do ano atuais

Use `@thisWeek` para a nota da semana atual e `@thisYear` para a nota do ano civil atual. Assim como `@today`, eles oferecem a nota existente para abrir ou uma sugestão explícita de criação quando ela não existe. Enter usa a aba atual; Mod+Enter abre outra aba; Shift+Enter ou Mod+Shift+Enter abre um painel dividido. Filtros de tags, texto e pastas não criam notas duplicadas.

A busca semanal reutiliza as configurações do calendário. Para notas anuais, configure a pasta, o formato e o modelo em **Configurações do Seam → Calendário e notas periódicas**. O padrão é `Yearly/YYYY.md`, sem modelo; as configurações anuais habilitadas do Periodic Notes são usadas quando a opção compartilhada está ativada. Modelos anuais usam 1º de janeiro para `{{date}}`, o nome do arquivo para `{{title}}` e aceitam `{{time}}`. Notas anuais fixadas continuam apontando para o mesmo arquivo até serem desafixadas ou excluídas.

### Excluir nota atual

Com uma nota Markdown aberta, escolha **Excluir nota atual** nos comandos do Obsidian ou nos comandos `>` do Seam. O Seam respeita a confirmação de exclusão e o destino configurado no Obsidian: lixeira do sistema, pasta `.trash` do cofre ou exclusão permanente. Cancelar a confirmação nativa mantém a nota intacta.

### Estrutura da nota

Com uma nota Markdown aberta, escolha **Mostrar estrutura da nota** nos comandos do Obsidian ou nos comandos `>` do Seam. A Paleta Universal lista todos os títulos na ordem da nota, com recuo para os subtítulos. Use as setas para cima e para baixo para navegar e Enter ou um clique para ir ao título no painel atual. Digite para filtrar os títulos, pressione `Backspace` com o campo vazio para voltar à busca da Paleta ou pressione `Esc` para fechar.

### Estatísticas da nota

Com uma nota Markdown aberta, escolha **Mostrar estatísticas da nota** nos comandos do Obsidian ou nos comandos `>` do Seam. A Paleta Universal mostra palavras, caracteres, parágrafos, tempo estimado de leitura e datas de criação e modificação no idioma configurado. A contagem inclui o texto ainda não salvo no editor; caracteres incluem espaços e Markdown, parágrafos são separados por linhas em branco e o tempo de leitura usa 200 palavras por minuto. Pressione `Esc` ou use o botão de fechar para sair.

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
