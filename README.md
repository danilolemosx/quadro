# Quadro (Mac e Windows)

O **quadro de cenas** de um filme: um cartão por cena (frame, número e resumo), organizado em partes. É a versão
digital do quadro físico de montagem (cartões com tarja preta e post-its numa chapa de aço). Serve para qualquer
projeto.

- **Quadro**: cada parte é uma fileira com o post-it da parte e os cartões. Arraste cartões, partes e post-its.
  Sete materiais de fundo (aço, cortiça, feltro, madeira, lousa, kraft, cinza).
- **Lista**: as mesmas cenas em tabela, agrupadas por parte, com arraste.
- **Roteiro** (só leitura): importa o PDF do roteiro, acha as cenas e põe o cartão de cada uma na margem.
- **Ficha da cena**: resumo, personagens, status, entrada/saída/duração e notas, tudo editável.
- **Importar frames**: solte imagens; "CENA 41.jpg" vai direto para o cartão 41.
- **Busca** (⌘F), **desfazer** (⌘Z), salvamento automático.

O projeto é uma pasta `Nome.quadro/` com `projeto.json` (texto legível), `frames/` e `roteiro.pdf`.
A ficha completa está em `docs/QUADRO-ESPEC.md` e as telas aprovadas em `docs/telas/`.

Feito a partir do modelo de app desktop do Danilo (receita do **Decanta**): Tauri v2, motor em Rust
(`motor/`), interface em HTML/CSS/JS (`ui/`, toda chamada nativa passa por `ui/ponte.js`).

## Desenvolvimento

```bash
cargo test -p motor                                        # testes do motor
cargo run -p motor --bin motor-cli -- tc 00:41:12:00 00:42:54:00 23.976
testes-ui/capturar.sh                                      # telas com 143 cenas simuladas (testes-ui/capturas)
cd app && npx @tauri-apps/cli@2 dev                        # abre o app
cd app && npx @tauri-apps/cli@2 build --bundles dmg        # .dmg local
```

## Publicar uma versão

1. Atualize `"version"` em `app/tauri.conf.json`.
2. Confira que os **Testes** passaram na aba Actions.
3. Em **Releases → Draft a new release**, crie a tag `vX.Y.Z` (alvo: `main`), título `Quadro vX.Y.Z`,
   **Publish release**.
4. Em 20 a 30 minutos, os instaladores aparecem no fim da página da Release:
   `Quadro_X.Y.Z_aarch64.dmg` (Mac M1–M4), `Quadro_X.Y.Z_x64.dmg` (Mac Intel), `Quadro_X.Y.Z_x64-setup.exe` (Windows).

## Licenças
- Quadro: MIT OR Apache-2.0.
- Fontes Archivo, Caveat e Courier Prime: SIL Open Font License 1.1 (`ui/fonts/OFL.txt`).
- pdf.js (Mozilla): Apache 2.0 (`ui/pdfjs/LICENSE`).
