# QUADRO — ficha do app (v0.1)

> **Mudanças pedidas pelo Danilo (13/10/2026), valem sobre o resto da ficha:**
> 1. **Sem marcadores do Avid.** O caminho "Do Avid" sai da janela Importar frames. Importar = **imagens** e
>    **PDF do roteiro**. Os campos Entrada/Saída/Duração da ficha da cena continuam, preenchidos à mão.
> 2. **App genérico, para qualquer projeto.** Nada de dados de um filme específico no app: abre com
>    Novo projeto / Abrir / Recentes; nomes de partes, personagens etc. vêm do projeto. A detecção de cenas
>    do roteiro deve ser tolerante a formatos diferentes de PDF.

App de Mac (e Windows, pelo mesmo CI) para montar o **quadro de cenas** de um filme: um cartão por cena, com
frame, número e resumo, organizado em partes. É a versão digital do quadro físico (cartões impressos com tarja
preta e post-its numa chapa de aço). A estrutura vem do Manuskript: estrutura à esquerda, quadro no centro e
ficha da cena à direita.

Para quem: o Danilo (montador, usa o Avid Media Composer), que precisa usar **já**, no longa atual.
Depois, talvez, para outros montadores.

Base: repositório criado pelo modelo **danilolemosx/modelo-app-desktop** (Tauri v2 + motor em Rust + ui/ em
HTML/CSS/JS puros + CI/Release). Seguir a mesma receita do Decanta e do Destila.

Telas aprovadas: pasta `telas/`. Referência em HTML/CSS (cores, fontes e medidas): pasta `referencia-visual/`.
É mockup estático, então serve de guia visual, não de código para copiar.

---

## 1. O que entra na v0.1

### Layout (uma janela, tudo numa tela)
- **Barra de cima:** logo QUADRO (o "O" final em vermelho), nome do projeto + "salvo há X min", seletor
  **Quadro / Lista / Roteiro**, botão **Material ▾**, zoom (− slider +), **Importar frames**, **busca** (⌘F),
  **+ Cena** (vermelho).
  *(O botão "Imprimir cartões" que aparece em algumas telas SAIU desta versão.)*
- **Esquerda, "Estrutura":** as partes (quadradinho na cor do post-it, nome, título, nº de cenas) e as cenas
  dentro delas (bolinha de status, número, resumo cortado). Clique seleciona. As partes abrem e fecham.
- **Centro:** a visão escolhida (Quadro, Lista ou Roteiro).
- **Direita, ficha da cena** (papel creme): frame grande com "CENA 41" e "PARTE 2 · 6/7"; Resumo; Personagens
  (fichas + adicionar); Status (Montada / Em ajuste / Falta); **No Avid**: Entrada, Saída e Duração; Notas
  (post-it amarelo). Tudo editável direto ali.
- **Rodapé:** nº de cenas, nº de partes, duração estimada (soma das durações) e a legenda de status.

### Visão Quadro (`telas/quadro-6-criar-cena.png`)
- Cada **parte é uma fileira**: o post-it da parte à esquerda (fonte manuscrita: "PARTE 2 / A negociação /
  7 cenas") e os cartões em sequência, quebrando a linha quando preciso.
- **Cartão:** papel branco, tarja preta com "CENA 41" (grande) e o resumo (pequeno, à direita), frame embaixo,
  bolinha de status no canto. Selecionado = contorno vermelho.
- Opção (no menu Material): **sombra + leve inclinação aleatória** (padrão: ligado) e **grade perfeita**
  (padrão: desligado). A inclinação de cada cartão é fixa (derivada do id), não muda a cada abertura.
- **Post-its pequenos** grudados nos cartões (notas rápidas). Dá para criar, editar, mover para outro cartão
  e apagar.
- **Arrastar:** cartões (reordenar e mudar de parte), post-its de parte (move a parte inteira) e post-its de
  nota. Linha vermelha mostra onde vai cair.
- **"+" tracejado no fim de cada fileira:** cria uma cena nova vazia naquela parte, já selecionada.
  **"+ Parte"** (post-it tracejado) depois da última parte.
- **Soltar imagens** do Finder num cartão troca o frame. Soltar no "+" cria uma cena com aquele frame.
- Zoom muda o tamanho dos cartões.

### Materiais do quadro (`telas/quadro-1-materiais.png` e `quadro-2-escolher-material.png`)
Aço galvanizado (padrão), Cortiça, Feltro (azul-grafite com textura de lã), Madeira, Lousa, Papel kraft e Cinza
liso. Escolha por projeto. As texturas estão em CSS no `referencia-visual/` (SVG de ruído embutido), sem
imagens externas.

### Visão Lista (`telas/quadro-4-lista.png`)
- Tabela agrupada por parte, com o **post-it da parte** como cabeçalho (arrastável) e o total de cenas e de tempo.
- Colunas: alça ⋮⋮, Frame, Cena, Resumo, Personagens, Status, Duração. As notas aparecem como post-it no canto.
- **Arrastar linhas** para reordenar e mudar de parte, com linha vermelha e aviso "Mover para Parte 1 · antes
  da cena 11". Post-its de nota também arrastam.
- Quadro e Lista são o mesmo dado: mudou num, muda no outro.

### Visão Roteiro (`telas/quadro-5-roteiro.png`), só leitura
- Importa o roteiro em **PDF** (só PDF nesta versão; sugestão: pdf.js na interface).
- Mostra o texto formatado (Courier Prime), com o **cartão da cena na margem** de cada cabeçalho. A cena
  selecionada fica com barra vermelha e as vizinhas apagadas. Clique numa cena seleciona no app todo.
- Ao importar, detecta os cabeçalhos de cena e **liga cada um ao cartão de mesmo número**. Se o cartão não
  existe, oferece criar ("12 cenas do roteiro não estão no quadro. Criar?").
- Selo "SÓ LEITURA" + botão "Importar PDF". PDF escaneado (imagem) não funciona: avisar com clareza.
- Pedir ao Danilo um PDF real do roteiro para testar a detecção (formato brasileiro, ex.: "41 INT. DELEGACIA –
  DIA", "CENA 41", "INT./EXT.").

### Importar frames (`telas/quadro-3-importar-frames.png`)
Janela com 2 caminhos (o "Do Avid" saiu):
1. **De um vídeo**: fica **desligado na v0.1**, com o selo "EM BREVE" (é a v0.2).
2. **Arrastar imagens**: soltar vários JPG/PNG/TIFF. Se o nome do arquivo tiver o número ("CENA 41.jpg",
   "41.png", "cena_31BDEG.jpg"), o frame vai para o cartão certo (cria o cartão se não existir). Os que não
   batem ficam numa fila "sem cena" para o Danilo arrastar.


### Busca (`telas/quadro-7-busca.png`)
- Campo na barra de cima (⌘F). Procura em número, resumo, personagens e notas.
- Resultado: as cenas encontradas ganham **borda amarela** e as outras ficam **cinza e apagadas, sem sair do
  lugar**. A estrutura da esquerda acompanha.
- Filtros rápidos abaixo do campo: Status, Personagem (os mais frequentes + "+N"), Com notas, Sem frame,
  Parte. Contador "8 cenas com Santiago". Esc limpa.

### Geral
- **Desfazer/Refazer** (⌘Z / ⇧⌘Z) para tudo, principalmente os arrastes.
- **Salvar automático** (e ⌘S). Abrir / Novo / Recentes no menu do app.
- Atalhos: setas mudam a cena selecionada; Enter edita o resumo; Delete apaga a cena (com desfazer); ⌘1/2/3
  trocam a visão.
- Tudo em português.

---

## 2. Formato do projeto (aberto, para virar site depois)

Um projeto é uma **pasta** `Meu Filme.quadro/`:
```
Meu Filme.quadro/
  projeto.json      ← tudo, em texto legível
  frames/           ← imagens dos cartões (cópias, nome = id da cena)
  roteiro.pdf       ← cópia do PDF importado (opcional)
```
`projeto.json` (sugestão):
```json
{
  "formato": "quadro", "versao": 1,
  "nome": "Meu Filme", "corte": "corte 3",
  "material": "aco", "opcoes": { "sombra": true, "grade": false },
  "fps": "23.976",
  "partes": [ { "id": "p1", "nome": "Parte 1", "titulo": "O sequestro", "cor": "#f28cb1", "cenas": ["c05", "c07"] } ],
  "cenas": {
    "c41": { "numero": "41", "resumo": "Benício impede Jailton…", "personagens": ["Benício", "Jailton"],
             "status": "montada", "frame": "frames/c41.jpg",
             "entrada": "00:41:12:00", "saida": "00:42:54:00",
             "notas": "Testar começar no close…",
             "postits": [ { "id": "n1", "texto": "som direto", "cor": "#f6e35d" } ],
             "roteiro": { "pagina": 38 } }
  }
}
```
Status: `montada` (verde #4f9a5b), `ajuste` (amarelo #e0a530), `falta` (vermelho #d2382f).
Cores dos post-its de parte: rosa #f28cb1, pêssego #f5b98c, azul #7cc4ea, lilás #b99be6, amarelo #f3e36a, verde #a6dc8a.

---

## 3. Técnica

- **"Ponte" única:** toda chamada nativa (abrir/salvar pasta, ler arquivo, copiar imagem, diálogos) passa por
  um só módulo, `ui/ponte.js`. O resto da interface não fala com o Tauri direto. Assim o site, no futuro, troca só a ponte.
- O motor em Rust (`motor/`) fica pequeno na v0.1: ler/gravar o projeto (com gravação segura: arquivo temporário
  e depois renomear), copiar e redimensionar frames (miniatura para o quadro + original para a ficha) e
  calcular timecode. Com testes, como de costume.
- Arrastar do Finder: `getCurrentWebview().onDragDropEvent` (dá o caminho completo).
- PDF: pdf.js empacotado no app, sem depender de internet.
- Fontes (OFL, empacotadas, sem internet): **Archivo** variável com largura (títulos em maiúsculas, largura
  125%), **Caveat** (post-its) e **Courier Prime** (roteiro). Estão em `referencia-visual/fontes/`.
- Paleta da casa: papel #efe5cf, tinta #34312d, fundo #2e2d2b, vermelho #d2382f.
- Aguentar uns 200 cartões sem travar (miniaturas pequenas, nada de imagem gigante no quadro).
- Teste da interface com dados simulados no Playwright (projeto de exemplo com ~140 cenas, como o do Danilo)
  e captura das telas para comparar com `telas/`.

---

## 4. Fica para depois (não fazer agora)
- **v0.2:** tirar frames automático de um vídeo (ffmpeg embutido, como no Destila: detecta os cortes e tira um
  frame do meio de cada cena) e o frame pelo vídeo de referência no caminho do Avid.
- Imprimir cartões (PDF para imprimir e recortar).
- Versão site (a ponte e o formato aberto já preparam).
- Roteiro em Final Draft / Fountain, e editar o roteiro.

## 5. Entrega
Release **v0.1.0** pelo processo de sempre (Danilo publica pelo site). O que importa agora é o **.dmg do Mac
chip Apple**, que ele vai usar já. Depois: LEIA-ME curto e ícone (um cartão com tarja preta preso num quadro,
com o "O" vermelho).
