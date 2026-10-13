// Ponte: toda chamada nativa (arquivos, diálogos, menu, arrastar do Finder) passa por aqui.
// O resto da interface não fala com o Tauri direto; uma versão site do Quadro troca só este arquivo.
"use strict";

const Ponte = (() => {
  const T = window.__TAURI__;
  const invoke = (cmd, args) => T.core.invoke(cmd, args);
  const sep = navigator.platform.startsWith("Win") ? "\\" : "/";
  const IMAGENS = /\.(jpe?g|png|tiff?|webp)$/i;

  return {
    mac: /Mac/.test(navigator.platform),
    sep,
    junta: (pasta, rel) => pasta.replace(/[\\/]+$/, "") + "/" + rel,
    nome: (caminho) => caminho.split(/[\\/]/).pop(),
    eImagem: (caminho) => IMAGENS.test(caminho),
    ePdf: (caminho) => /\.pdf$/i.test(caminho),

    // projeto
    projetoInicial: () => invoke("projeto_inicial"),
    recentes: () => invoke("recentes"),
    novoProjeto: (pasta, nome) => invoke("novo_projeto", { pasta, nome }),
    abrirProjeto: (caminho) => invoke("abrir_projeto", { caminho }),
    salvar: (caminho, projeto) => invoke("salvar_projeto", { caminho, projeto }),
    mostrarNoFinder: (caminho) => invoke("mostrar_no_finder", { caminho }),

    // frames
    importarFrame: (caminho, origem, id) => invoke("importar_frame", { caminho, origem, id }),
    numeroDoArquivo: (nome, existentes) => invoke("numero_do_arquivo", { nome, existentes }),
    /** URL para mostrar um arquivo local numa <img> (ou para o pdf.js ler). */
    url: (caminho) => T.core.convertFileSrc(caminho),

    // timecode
    duracao: (entrada, saida, fps) => invoke("duracao", { entrada, saida, fps }),
    segundos: (duracoes, fps) => invoke("segundos", { duracoes, fps }),

    // roteiro
    detectarCenas: (linhas) => invoke("detectar_cenas", { linhas }),
    copiarRoteiro: (caminho, origem) => invoke("copiar_roteiro", { caminho, origem }),

    // diálogos
    escolherPasta: (titulo) => T.dialog.open({ directory: true, title: titulo }),
    escolherArquivos: async (titulo, nome, extensoes, multiplo = true) => {
      const r = await T.dialog.open({ multiple: multiplo, title: titulo, filters: [{ name: nome, extensions: extensoes.flatMap((e) => [e, e.toUpperCase()]) }] });
      return r == null ? [] : Array.isArray(r) ? r : [r];
    },
    perguntar: (msg, ok = "OK", cancelar = "Cancelar") => T.dialog.ask(msg, { title: "Quadro", okLabel: ok, cancelLabel: cancelar }),
    avisar: (msg) => T.dialog.message(msg, { title: "Quadro" }),

    // janela
    titulo: (t) => T.window.getCurrentWindow().setTitle(t).catch(() => {}),
    aoMenu: (cb) => T.event.listen("menu", (ev) => cb(ev.payload)),
    aoFechar: (cb) => T.window.getCurrentWindow().onCloseRequested(cb),
    /** Arquivos arrastados do Finder: cb(tipo, caminhos, x, y), tipo = "over" | "drop" | "leave". */
    aoArrastarArquivos: (cb) => T.webview.getCurrentWebview().onDragDropEvent((ev) => {
      const p = ev.payload;
      // No Mac o Tauri já entrega a posição em pontos (como o CSS); no Windows, em pixels físicos.
      const r = /Mac/.test(navigator.platform) ? 1 : window.devicePixelRatio || 1;
      const x = p.position ? p.position.x / r : 0;
      const y = p.position ? p.position.y / r : 0;
      if (p.type === "enter" || p.type === "over") cb("over", p.paths || [], x, y);
      else if (p.type === "drop") cb("drop", p.paths || [], x, y);
      else cb("leave", [], 0, 0);
    }),
  };
})();
