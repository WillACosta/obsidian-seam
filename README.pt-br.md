# Seam — organize suas notas no Obsidian sem esforço

> [English](README.md) · **Português**

> Capture ideias, use tags como preferir e deixe o Seam cuidar da organização para você.

O Seam é um plugin leve para Obsidian que facilita a criação, busca e a organização das suas notas. Inspirado no método [Zettelkasten](https://zettelkasten.de/introduction/), Apple Notes e Bear.

Suas ideias a passam por um fluxo simples entre `Fleeting`, `Permanent` e `Archive`. Assim, você passa menos tempo cuidando de arquivos e mais tempo escrevendo.

> [!NOTE]
> O Seam é 100% privado, ele não coleta nem nos envia dados pessoais, conteúdo das suas notas ou informações de uso. Suas estatísticas de escrita ficam nos seus dispositivos e podem ser sincronizadas pelo serviço de sua preferência.

![Apresentação do Seam](docs/images/seam_showcase.gif)

## Por que o Seam?

| Sem o Seam | Com o Seam |
| :--- | :--- |
| ❌ Parar o que está fazendo para criar uma nota | ✅ Registre uma ideia rápida pela Paleta Universal. |
| ❌ Mover notas entre pastas manualmente | ✅ Adicione `#permanent` e deixe o Seam cuidar da organização. |
| ❌ Deixar notas concluídas junto das que ainda estão em andamento | ✅ Adicione `#archive` para arquivá-las. |
| ❌ Usar ferramentas diferentes para encontrar o que precisa | ✅ Busque notas, arquivos, tags, consultas salvas e comandos em um só lugar. |
| ❌ Procurar suas notas e seu progresso em lugares diferentes | ✅ Navegue pelas notas no calendário e acompanhe suas estatísticas de escrita. |
| ❌ Depender do computador para manter a rotina | ✅ Use o Seam tanto no computador quanto em dispositivos móveis. |

## Encontre e crie com a Paleta Universal

A Paleta Universal reúne buscas e ações em um só lugar. Encontre notas pelo título, conteúdo, tag ou pasta, veja os trechos correspondentes e crie novas notas quando precisar. Para executar comandos do Seam, digite `>` ou abra a Paleta diretamente no modo de comandos.

Combine filtros, como em `/Fleeting #projeto !#archived`, e salve as buscas que usa com frequência. Você também pode fixar notas, comandos e consultas para acessá-los rapidamente ou explorar uma Base do Obsidian em tabela ou cartões sem sair da Paleta.

![Busca combinada](docs/images/combined_search.png)

![Buscas personalizadas e Bases](docs/images/special_queries_bookshelf.png)

## Mais espaço para escrever

### Capture e organize

Crie notas efêmeras pela Paleta ou configure opções de Captura Rápida com suas pastas e modelos. Quando uma nota estiver pronta, adicione `#permanent`; para arquivá-la, use `#archive`. O Seam move os arquivos automaticamente e também pode remover tags e propriedades que você não usa mais.

![Criando uma nota](docs/images/creating_new_note.png)

### Conecte seus dias

Com `@calendar`, você navega pelas notas diárias e cria novas notas a partir de um modelo. Também pode abrir ou criar notas semanais e anuais, fixar notas importantes no calendário e transferir tarefas pendentes entre dias.

![Calendário](docs/images/calendar.png)

### Acompanhe seu progresso

Nas **Estatísticas globais**, acompanhe o total de notas e palavras, sua atividade de escrita, sequências e tendências ao longo dos meses. Selecione um dia para revisitar suas notas. Quando quiser ver os detalhes de uma nota, consulte suas estatísticas, tarefas concluídas ou estrutura diretamente na Paleta.

O histórico de escrita mostra a atividade registrada a partir do momento em que o Seam começa a acompanhá-la. Suas notas anteriores também entram nos totais do cofre. Para sincronizar o histórico pelo Obsidian Sync, ative **Sincronizar todos os outros tipos** em cada dispositivo.

![Painel Estatísticas](docs/images/dashboard_stats.png)

### Mantenha suas fontes por perto

Crie notas vinculadas aos documentos e imagens que usa como referência e encontre tudo com `@sources`. O Seam também pode criar essas notas automaticamente para os arquivos da pasta de fontes que você escolher. Para ler PDFs, há ainda a opção de exibir as páginas em sequência.

![Nota de fonte com PDF](docs/images/sources.png)

## Comece a usar

O Seam requer o Obsidian **1.13.0** ou posterior.

1. No Obsidian, abra **Configurações → Plugins da comunidade**. Se necessário, desative o Modo restrito e procure por **Seam**.
2. Instale e ative o plugin.
3. Nas configurações do Seam, escolha suas pastas e modelos. Se preferir, abra **Inicializar o Seam** para conhecer a configuração recomendada. Ela é opcional e não move nem edita suas notas existentes.
4. Abra a **Paleta Universal** pela paleta de comandos do Obsidian ou configure um atalho para acessá-la.

A inicialização também oferece uma Base Bookshelf e as buscas `@bookshelf` e `@reading`. Você pode revisar todas as alterações propostas antes de aplicá-las.

<!-- Captura de tela ou GIF: Inicializar Seam e Bookshelf -->

Se preferir instalar manualmente, baixe `main.js`, `manifest.json` e `styles.css` na página de [Releases](https://github.com/WillACosta/obsidian-seam/releases). Coloque os arquivos em `<cofre>/.obsidian/plugins/obsidian-seam/`, recarregue o Obsidian e ative o Seam.

## Idiomas

O Seam acompanha o idioma do Obsidian e está disponível em português brasileiro e inglês. Se o Obsidian estiver em outro idioma, o Seam será exibido em inglês. Contribuições com traduções são bem-vindas!

## Apoie o projeto

O Seam é gratuito e de código aberto. Se ele ajuda no seu dia a dia, considere apoiar o desenvolvimento:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/willac)

**Pix**<br>
![QR code para Pix](docs/images/qrcode.svg)

## Desenvolvimento e licença

Para instruções de desenvolvimento e lançamento, consulte o [README.dev.md](README.dev.md). O Seam é distribuído sob a licença [GNU General Public License v3.0](LICENSE).

Desenvolvido por **William A. Costa** ([@WillACosta](https://github.com/WillACosta)).
