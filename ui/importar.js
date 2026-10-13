// Importar frames: janela "Importar frames", imagens soltas do Finder e a fila "sem cena".
"use strict";

const Importar = (() => {
  let ultimo = null; // resultado da última importação (para a janela)
  let progresso = null; // { feitos, total }

  const idArquivo = (base, k = 0) => `${base}-${Date.now().toString(36)}${k}`;
  const numeroInt = (n) => parseInt(String(n || ""), 10);

  /** Onde entra uma cena nova pelo número: depois da cena de número mais próximo abaixo dela. */
  function lugarPara(p, numero) {
    const alvo = numeroInt(numero);
    let melhor = null, melhorN = -Infinity;
    for (const parte of p.partes) for (const id of parte.cenas) {
      const n = numeroInt(p.cenas[id].numero);
      if (!isNaN(n) && !isNaN(alvo) && n <= alvo && n >= melhorN) { melhor = { parte, depois: id }; melhorN = n; }
    }
    return melhor || { parte: p.partes[0], depois: null };
  }
  function inserirNoLugar(p, id, numero) {
    const { parte, depois } = lugarPara(p, numero);
    const i = depois ? parte.cenas.indexOf(depois) + 1 : 0;
    parte.cenas.splice(i, 0, id);
  }

  /** Importa imagens e liga cada uma ao cartão pelo número no nome do arquivo. Um passo só de desfazer. */
  async function imagens(caminhos) {
    caminhos = caminhos.filter(Ponte.eImagem);
    if (!caminhos.length || !Q.p) return null;
    const existentes = Object.values(Q.p.cenas).map((c) => c.numero);
    const itens = [];
    for (const c of caminhos) itens.push({ caminho: c, nome: Ponte.nome(c), numero: await Ponte.numeroDoArquivo(Ponte.nome(c), existentes) });
    itens.sort((a, b) => (numeroInt(a.numero) || 1e9) - (numeroInt(b.numero) || 1e9));
    progresso = { feitos: 0, total: itens.length };
    desenharJanela();
    const novas = new Map(); // numero → id de cena nova
    const prontos = [], erros = [];
    for (const it of itens) {
      const cid = it.numero ? cenaPorNumero(it.numero) || novas.get(normNum(it.numero)) || null : null;
      let alvo = cid;
      if (it.numero && !cid) { alvo = novoId("c"); novas.set(normNum(it.numero), alvo); it.nova = true; }
      try {
        it.f = await Ponte.importarFrame(Q.caminho, it.caminho, idArquivo(alvo || "fila", prontos.length));
        it.cena = alvo;
        prontos.push(it);
      } catch (e) {
        erros.push(`${it.nome}: ${e}`);
      }
      progresso.feitos++;
      desenharJanela();
    }
    progresso = null;
    mudar((p) => {
      for (const it of prontos) {
        if (!it.cena) {
          (p.fila = p.fila || []).push({ id: novoId("f"), frame: it.f.frame, mini: it.f.mini, nome: it.nome });
          continue;
        }
        if (it.nova && !p.cenas[it.cena]) {
          p.cenas[it.cena] = { numero: it.numero, resumo: "", personagens: [], status: "", postits: [] };
          inserirNoLugar(p, it.cena, it.numero);
        }
        Object.assign(p.cenas[it.cena], { frame: it.f.frame, mini: it.f.mini });
      }
    });
    ultimo = {
      ligados: prontos.filter((i) => i.cena),
      novas: prontos.filter((i) => i.nova).length,
      fila: prontos.filter((i) => !i.cena).length,
      erros,
    };
    if (!janelaAberta()) {
      const partes = [`${ultimo.ligados.length} ${ultimo.ligados.length === 1 ? "frame foi para o cartão" : "frames foram para os cartões"}`];
      if (ultimo.novas) partes.push(`${ultimo.novas} cenas novas`);
      if (ultimo.fila) partes.push(`${ultimo.fila} sem cena (na fila, embaixo do quadro)`);
      aviso(partes.join(" · ") + ".", ["DESFAZER", desfazer]);
      if (erros.length) Ponte.avisar("Algumas imagens não puderam ser lidas:\n\n" + erros.join("\n"));
    }
    desenharJanela();
    return ultimo;
  }

  /** Uma imagem vira o frame da cena `id`. */
  async function frameDaCena(id, caminho) {
    try {
      const f = await Ponte.importarFrame(Q.caminho, caminho, idArquivo(id));
      mudar((p) => Object.assign(p.cenas[id], { frame: f.frame, mini: f.mini }));
    } catch (e) {
      Ponte.avisar(String(e));
    }
  }
  async function trocarFrame(id) {
    const [c] = await Ponte.escolherArquivos("Frame da cena", "Imagens", ["jpg", "jpeg", "png", "tif", "tiff", "webp"], false);
    if (c) await frameDaCena(id, c);
  }
  /** Imagens soltas no "+" de uma parte: uma cena nova para cada (número pelo nome do arquivo, ou o próximo). */
  async function novasCenas(parteId, caminhos) {
    const ids = [];
    for (const [k, c] of caminhos.filter(Ponte.eImagem).entries()) {
      let numero = await Ponte.numeroDoArquivo(Ponte.nome(c), []);
      if (!numero || cenaPorNumero(numero)) numero = null;
      const id = novoId("c");
      try {
        const f = await Ponte.importarFrame(Q.caminho, c, idArquivo(id, k));
        ids.push({ id, numero, f });
      } catch (e) { aviso(String(e)); }
    }
    if (!ids.length) return;
    mudar((p) => {
      const parte = p.partes.find((x) => x.id === parteId);
      for (const { id, numero, f } of ids) {
        p.cenas[id] = { numero: numero || proximoNumero(), resumo: "", personagens: [], status: "", postits: [], frame: f.frame, mini: f.mini };
        parte.cenas.push(id);
      }
    });
    selecionar(ids[ids.length - 1].id);
  }

  // ---------- fila "sem cena" ----------
  function htmlFila() {
    const fila = (Q.p && Q.p.fila) || [];
    if (!fila.length) return "";
    return `<div class="fila"><h4>SEM CENA · ${fila.length}<small>arraste para um cartão</small></h4>
      <div class="itens">${fila.map((f) => `<div class="it" data-arr="fila" data-fila="${f.id}" title="${esc(f.nome)}"><img src="${esc(Ponte.url(Ponte.junta(Q.caminho, f.mini)))}" alt=""><span>${esc(f.nome)}</span></div>`).join("")}</div>
      <button class="x" id="limparFila">esvaziar fila</button></div>`;
  }
  function usarDaFila(filaId, cenaId) {
    mudar((p) => {
      const i = (p.fila || []).findIndex((f) => f.id === filaId);
      if (i < 0 || !p.cenas[cenaId]) return;
      const [f] = p.fila.splice(i, 1);
      Object.assign(p.cenas[cenaId], { frame: f.frame, mini: f.mini });
    });
  }
  document.addEventListener("click", (ev) => {
    if (ev.target.id === "limparFila") mudar((p) => (p.fila = []));
  });

  // ---------- janela ----------
  const janelaAberta = () => !$("#modal").classList.contains("oculto") && $("#modal").dataset.janela === "importar";
  function abrir() {
    if (!Q.p) return;
    ultimo = null;
    $("#modal").dataset.janela = "importar";
    $("#modal").classList.remove("oculto");
    $("#veil").classList.remove("oculto");
    desenharJanela();
  }
  function fechar() {
    $("#modal").classList.add("oculto");
    $("#veil").classList.add("oculto");
  }
  function desenharJanela() {
    if (!janelaAberta()) return;
    let corpo;
    if (progresso) {
      corpo = `<div class="solte"><b>IMPORTANDO ${progresso.feitos} DE ${progresso.total}…</b>copiando as imagens para o projeto<div class="prog"><i style="width:${(100 * progresso.feitos) / progresso.total}%"></i></div></div>`;
    } else if (ultimo) {
      const amostra = ultimo.ligados.slice(0, 12);
      corpo = `<div class="resumo-imp">
          <div class="found">${ultimo.ligados.length}<small>${ultimo.ligados.length === 1 ? "frame no lugar" : "frames no lugar"} · prévia</small></div>
          <div style="font-size:12.5px;line-height:1.6;color:#5d5548">
            ${ultimo.novas ? `<b>${ultimo.novas}</b> cartões novos criados (o número não existia no quadro).<br>` : ""}
            ${ultimo.fila ? `<b>${ultimo.fila}</b> sem número de cena no nome: ficaram na fila, embaixo do quadro, para arrastar.<br>` : ""}
            Desfazer (⌘Z) volta tudo de uma vez.</div></div>
        ${amostra.length ? `<div class="strip">${amostra.map((i) => `<div><img src="${esc(Ponte.url(Ponte.junta(Q.caminho, i.f.mini)))}" alt=""></div>`).join("")}</div>` : ""}
        ${ultimo.erros.length ? `<div class="erros">Não foi possível ler: ${esc(ultimo.erros.join(" · "))}</div>` : ""}`;
    } else {
      corpo = `<div class="solte" id="zonaSolte"><b>SOLTE AS IMAGENS AQUI</b>JPG, PNG ou TIFF, quantas quiser. "CENA 41.jpg", "41.png" ou "cena_12A.tif" vão direto<br>para o cartão certo (e o cartão é criado se não existir). As outras ficam numa fila para você arrastar.
        <div><button class="btn2 go" id="escolherImgs">ESCOLHER IMAGENS…</button></div></div>`;
    }
    $("#modal").innerHTML = `
      <h2>IMPORTAR FRAMES</h2>
      <div class="sub">Escolha de onde vêm as imagens das cenas.</div>
      <div class="ways">
        <div class="way off" title="Chega na próxima versão"><span class="tag">EM BREVE</span><div class="n">1</div><b>DE UM VÍDEO</b><p>Solte o filme exportado. O Quadro encontra os cortes e tira um frame de cada cena.</p></div>
        <div class="way on"><span class="tag">MANUAL</span><div class="n">2</div><b>ARRASTAR IMAGENS</b><p>Solte seus próprios frames. Se o arquivo se chamar "CENA 41.jpg", ele vai direto para o cartão certo.</p></div>
      </div>
      <div class="cfg">${corpo}</div>
      <div class="act">${ultimo ? `<button id="maisImgs">IMPORTAR MAIS</button><button class="go" id="fecharImp">PRONTO</button>` : `<button id="fecharImp">CANCELAR</button>`}</div>`;
  }
  $("#modal").addEventListener("click", async (ev) => {
    if (!janelaAberta()) return;
    const id = ev.target.id;
    if (id === "fecharImp") fechar();
    if (id === "maisImgs") { ultimo = null; desenharJanela(); }
    if (id === "escolherImgs") {
      const cs = await Ponte.escolherArquivos("Importar frames", "Imagens", ["jpg", "jpeg", "png", "tif", "tiff", "webp"]);
      if (cs.length) await imagens(cs);
    }
  });
  $("#veil").addEventListener("click", () => { if (!progresso) fechar(); });

  // ---------- arquivos arrastados do Finder ----------
  let marcado = null;
  function alvoEm(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    if (janelaAberta()) return { tipo: "lote", el: $("#zonaSolte") || $("#modal") };
    const add = el.closest(".add[data-parte]");
    if (add) return { tipo: "novas", parte: add.dataset.parte, el: add };
    const c = el.closest(".card[data-id], .lr[data-id], .op li[data-id]");
    if (c) return { tipo: "cena", cena: c.dataset.id, el: c };
    const big = el.closest(".insp .big");
    if (big && Q.sel) return { tipo: "cena", cena: Q.sel, el: big };
    if (el.closest("#vRoteiro")) return { tipo: "lote", el: null };
    return { tipo: "lote", el: el.closest(".board") };
  }
  function marcar(el) {
    if (marcado === el) return;
    if (marcado) marcado.classList.remove("alvo", "alvo-finder");
    marcado = el;
    if (el) el.classList.add(el.classList.contains("board") ? "alvo-finder" : "alvo");
  }
  async function soltarArquivos(tipo, caminhos, x, y) {
    if (!Q.p) {
      if (tipo === "drop") {
        const pasta = caminhos.find((c) => /\.quadro[\\/]?$/i.test(c) || /projeto\.json$/i.test(c));
        if (pasta) abrirProjeto(pasta);
      }
      return;
    }
    if (tipo === "leave") return marcar(null);
    const a = alvoEm(x, y);
    if (tipo === "over") return marcar(a && a.el);
    marcar(null);
    const pdf = caminhos.find(Ponte.ePdf);
    if (pdf) return Roteiro.importar(pdf);
    const imgs = caminhos.filter(Ponte.eImagem);
    if (!imgs.length) {
      const pasta = caminhos.find((c) => /\.quadro[\\/]?$/i.test(c));
      if (pasta) return abrirProjeto(pasta);
      return aviso("Solte imagens (JPG, PNG, TIFF) ou o PDF do roteiro.");
    }
    if (!a) return;
    if (a.tipo === "cena" && imgs.length === 1) return frameDaCena(a.cena, imgs[0]);
    if (a.tipo === "novas") return novasCenas(a.parte, imgs);
    return imagens(imgs);
  }

  return { abrir, fechar, imagens, inserirNoLugar, trocarFrame, htmlFila, usarDaFila, soltarArquivos, aberta: janelaAberta };
})();

$("#btnImportar").addEventListener("click", () => Importar.abrir());
