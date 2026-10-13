//! Motor do Quadro. Toda a lógica que mexe em arquivos fica aqui, sem nada de interface, para poder ser
//! testada sozinha (`cargo test -p motor`) e usada pela linha de comando (`motor-cli`).
//!
//! - `projeto`: criar, abrir e salvar a pasta `Nome.quadro/` (gravação segura).
//! - `frames`: copiar imagens para o projeto (original + miniatura) e achar o número da cena no nome do arquivo.
//! - `timecode`: timecode em 23,976 / 24 / 25 / 29,97 NDF e DF / 30 (e 50, 59,94, 60).
//! - `roteiro`: achar os cabeçalhos de cena no texto extraído de um PDF.
//! - `recentes`: a lista de projetos abertos recentemente.

pub mod frames;
pub mod projeto;
pub mod recentes;
pub mod roteiro;
pub mod timecode;
