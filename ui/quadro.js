// Visão Quadro (centro), Estrutura (esquerda), rodapé, menu de materiais e menus de contexto.
"use strict";

// ---------- menu de contexto (botão direito) ----------
const Ctx = {
  /** itens: [{ t: "texto", f: fn, perigo }, "-", { html, depois(el) }] */
  abrir(x, y, itens) {
    const el = $("#ctx");
    el.innerHTML = "";
    for (const it of itens) {
      if (it === "-") { el.appendChild(document.createElement("hr")); continue; }
      if (it.html) {
        const d = document.createElement("div");
        d.innerHTML = it.html;
        el.appendChild(d);
        it.depois && it.depois(d);
        continue;
      }
      const b = document.createElement("button");
      b.textContent = it.t;
      if (it.perigo) b.className = "perigo";
      b.onclick = () => { Ctx.fechar(); it.f(); };
      el.appendChild(b);
    }
    el.classList.remove("oculto");
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = `${Math.min(x, innerWidth - w - 8)}px`;
    el.style.top = `${Math.min(y, innerHeight - h - 8)}px`;
  },
  fechar() { $("#ctx").classList.add("oculto"); },
  aberto: () => !$("#ctx").classList.contains("oculto"),
};
document.addEventListener("pointerdown", (ev) => {
  if (Ctx.aberto() && !ev.target.closest("#ctx")) Ctx.fechar();
});

// ---------- editar parte (nome, título, cor) ----------
function editarParte(pid, x, y) {
  const parte = Q.p.partes.find((p) => p.id === pid);
  if (!parte) return;
  Ctx.abrir(x, y, [
    {
      html: `<label>NOME<input data-c="nome" value="${esc(parte.nome)}"></label>
             <label>TÍTULO<input data-c="titulo" value="${esc(parte.titulo || "")}" placeholder="ex.: O sequestro"></label>
             <div class="cores">${CORES_PARTE.map((c) => `<button data-cor="${c}" style="background:${c};${c === parte.cor ? "outline:2px solid #fff;outline-offset:1px" : ""}"></button>`).join("")}</div>`,
      depois(d) {
        for (const inp of $$("input", d)) {
          inp.addEventListener("input", () => mudar((p) => (p.partes.find((x) => x.id === pid)[inp.dataset.c] = inp.value), { chave: `parte-${pid}-${inp.dataset.c}` }));
          inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") Ctx.fechar(); });
        }
        for (const b of $$("[data-cor]", d)) b.onclick = () => { mudar((p) => (p.partes.find((x) => x.id === pid).cor = b.dataset.cor)); editarParte(pid, x, y); };
        setTimeout(() => { const i = $("input[data-c=titulo]", d); i.focus(); i.select(); }, 0);
      },
    },
    "-",
    { t: "Nova cena nesta parte", f: () => criarCena(pid) },
    { t: "Apagar parte…", perigo: true, f: () => apagarParte(pid) },
  ]);
}
async function apagarParte(pid) {
  const i = Q.p.partes.findIndex((p) => p.id === pid);
  const parte = Q.p.partes[i];
  if (Q.p.partes.length === 1) return aviso("O projeto precisa de pelo menos uma parte.");
  const vizinha = Q.p.partes[i - 1] || Q.p.partes[i + 1];
  if (parte.cenas.length && !(await Ponte.perguntar(`As ${parte.cenas.length} cenas da ${parte.nome} vão para a ${vizinha.nome}. Apagar a parte?`, "Apagar parte"))) return;
  mudar((p) => {
    const viz = p.partes.find((x) => x.id === vizinha.id);
    const pt = p.partes.find((x) => x.id === pid);
    if (i > 0) viz.cenas.push(...pt.cenas);
    else viz.cenas.unshift(...pt.cenas);
    p.partes = p.partes.filter((x) => x.id !== pid);
  });
}

function menuCartao(id, x, y) {
  const c = cena(id);
  selecionar(id, { rolar: false });
  Ctx.abrir(x, y, [
    { t: "Novo post-it no cartão", f: () => editarNota(id, novaNota(id)) },
    { t: "Trocar frame…", f: () => Importar.trocarFrame(id) },
    ...(c.frame ? [{ t: "Tirar frame", f: () => mudar((p) => { delete p.cenas[id].frame; delete p.cenas[id].mini; }) }] : []),
    "-",
    { t: "Nova cena depois desta", f: () => criarCena(parteDe(id).parte.id, { depois: id }) },
    { t: `Apagar ${titulo(c).toLowerCase()}`, perigo: true, f: () => apagarCena(id) },
  ]);
}
function menuNota(cid, nid, x, y) {
  Ctx.abrir(x, y, [
    { t: "Editar", f: () => editarNota(cid, nid) },
    { html: `<div class="cores">${CORES_NOTA.map((c) => `<button data-cor="${c}" style="background:${c}"></button>`).join("")}</div>`,
      depois(d) { for (const b of $$("[data-cor]", d)) b.onclick = () => { Ctx.fechar(); mudar((p) => (p.cenas[cid].postits.find((n) => n.id === nid).cor = b.dataset.cor)); }; } },
    "-",
    { t: "Apagar post-it", perigo: true, f: () => mudar((p) => (p.cenas[cid].postits = p.cenas[cid].postits.filter((n) => n.id !== nid))) },
  ]);
}
/** Edita o texto de um post-it no próprio cartão. Vazio ao sair = apagado. */
function editarNota(cid, nid) {
  if (Q.vista !== "quadro") trocarVista("quadro");
  const el = $(`.mini[data-cena="${cid}"][data-nota="${nid}"]`);
  if (!el) return;
  el.contentEditable = "true";
  el.focus();
  document.getSelection().selectAllChildren(el);
  const fim = () => {
    el.removeEventListener("blur", fim);
    el.contentEditable = "false";
    const texto = el.innerText.trim();
    mudar((p) => {
      const c = p.cenas[cid];
      if (!c) return;
      if (!texto) c.postits = c.postits.filter((n) => n.id !== nid);
      else { const n = c.postits.find((n) => n.id === nid); if (n) n.texto = texto; }
    });
  };
  el.addEventListener("blur", fim);
  el.addEventListener("keydown", (ev) => {
    if ((ev.key === "Enter" && !ev.shiftKey) || ev.key === "Escape") { ev.preventDefault(); el.blur(); }
    ev.stopPropagation();
  });
}

// ---------- quadro ----------
function htmlCartao(id, hits) {
  const c = cena(id);
  const tilt = (sorte(id) * 2.6 - 1.3).toFixed(2);
  const y = (sorte(id, 1) * 0.34 - 0.26).toFixed(2);
  const cls = ["card", id === Q.sel ? "sel" : "", hits ? (hits.has(id) ? "hit" : "apagado") : ""].join(" ");
  const st = STATUS[c.status];
  const notas = (c.postits || []).map((n, k) =>
    `<div class="mini" data-arr="nota" data-cena="${id}" data-nota="${n.id}" style="--r:${(sorte(n.id) * 14 - 8).toFixed(1)}deg;--k:${k};background:${esc(n.cor || CORES_NOTA[0])}">${esc(n.texto)}</div>`).join("");
  return `<div class="${cls}" data-arr="cena" data-id="${id}" style="--r:${tilt}deg;--y:${y}em">
    <div class="hd"><b>${esc(titulo(c))}</b><span>${esc(c.resumo || "")}</span></div>
    <div class="fr">${imgFrame(c) || `<div class="semf">SOLTE UM FRAME</div>`}</div>
    ${st ? `<i class="dot" style="background:${st.cor}"></i>` : ""}${notas}</div>`;
}

function desenharQuadro() {
  const b = $("#vQuadro");
  const o = Q.p.opcoes || {};
  const sombra = o.sombra !== false, grade = !!o.grade;
  b.className = `board m-${Q.p.material || "aco"}${sombra ? "" : " plano"}${sombra && !grade ? "" : " reto"}${Q.vista === "quadro" ? "" : " oculto"}`;
  b.style.setProperty("--z", Q.zoom);
  if (Q.vista !== "quadro") return;
  const hits = Busca.resultado();
  const vazio = !Object.keys(Q.p.cenas).length;
  const rows = Q.p.partes.map((parte) => {
    const n = parte.cenas.length;
    return `<section class="row" data-parte="${parte.id}">
      <div class="postit" data-arr="parte" data-parte="${parte.id}" style="background:${esc(parte.cor)};--r:${(sorte(parte.id) * 5 - 2.4).toFixed(1)}deg">
        <b>${esc(parte.nome)}</b>${parte.titulo ? `<small>${esc(parte.titulo)}</small>` : ""}<em>${n} ${n === 1 ? "cena" : "cenas"}</em></div>
      <div class="cards">${parte.cenas.map((id) => htmlCartao(id, hits)).join("")}
        <div class="add" data-parte="${parte.id}" title=""><span class="tip">NOVA CENA NA ${esc(parte.nome.toUpperCase())}</span></div></div>
    </section>`;
  }).join("");
  $("#rows").innerHTML = (vazio ? `<div class="vazio-q"><b>QUADRO VAZIO</b>Clique no + para criar uma cena, solte imagens aqui (o número no nome do arquivo vira a cena)<br>ou importe o roteiro em PDF na aba Roteiro.</div>` : "")
    + rows + `<div class="addp" title="Nova parte"><span>+ Parte</span></div>` + Importar.htmlFila();
}
registrar("quadro", desenharQuadro);

$("#vQuadro").addEventListener("click", (ev) => {
  const t = ev.target;
  if (t.closest(".mini[contenteditable='true']")) return;
  const add = t.closest(".add");
  if (add) return criarCena(add.dataset.parte);
  if (t.closest(".addp")) {
    const pid = criarParte();
    const el = $(`.postit[data-parte="${pid}"]`);
    if (el) { const r = el.getBoundingClientRect(); editarParte(pid, r.right + 8, r.top); }
    return;
  }
  const card = t.closest(".card");
  if (card) selecionar(card.dataset.id, { rolar: false });
});
$("#vQuadro").addEventListener("dblclick", (ev) => {
  const mini = ev.target.closest(".mini");
  if (mini) return editarNota(mini.dataset.cena, mini.dataset.nota);
  const postit = ev.target.closest(".postit");
  if (postit) return editarParte(postit.dataset.parte, ev.clientX, ev.clientY);
  const card = ev.target.closest(".card");
  if (card) { selecionar(card.dataset.id, { rolar: false }); Ficha.focarResumo(); }
});
document.addEventListener("contextmenu", (ev) => {
  if (ev.target.closest("input, textarea, [contenteditable='true']")) return;
  ev.preventDefault();
  if (!Q.p) return;
  const mini = ev.target.closest(".mini, .nt");
  if (mini) return menuNota(mini.dataset.cena, mini.dataset.nota, ev.clientX, ev.clientY);
  const parte = ev.target.closest(".postit, .lp, .oph");
  if (parte) return editarParte(parte.dataset.parte, ev.clientX, ev.clientY);
  const c = ev.target.closest("[data-id]");
  if (c && cena(c.dataset.id)) return menuCartao(c.dataset.id, ev.clientX, ev.clientY);
});

// ---------- estrutura ----------
function desenharEstrutura() {
  const hits = Busca.resultado();
  $("#estrutura").innerHTML = `<h3>ESTRUTURA</h3>` + Q.p.partes.map((parte) => `
    <div class="op ${Q.fechadas.has(parte.id) ? "closed" : ""}">
      <div class="oph" data-parte="${parte.id}" data-arr="parte"><i style="background:${esc(parte.cor)}"></i>${esc(parte.nome)}${parte.titulo ? ` <small>· ${esc(parte.titulo)}</small>` : ""}<em>${parte.cenas.length}</em></div>
      <ul>${parte.cenas.map((id) => {
        const c = cena(id), st = STATUS[c.status];
        return `<li data-id="${id}" class="${id === Q.sel ? "on" : ""} ${hits && !hits.has(id) ? "apagado" : ""}"><i ${st ? `style="background:${st.cor}"` : ""}></i><b>${esc(c.numero)}</b><span>${esc(c.resumo || "")}</span></li>`;
      }).join("") || `<div class="vazio-est">sem cenas</div>`}</ul>
    </div>`).join("");
}
registrar("estrutura", desenharEstrutura);
$("#estrutura").addEventListener("click", (ev) => {
  const li = ev.target.closest("li[data-id]");
  if (li) return selecionar(li.dataset.id);
  const h = ev.target.closest(".oph");
  if (h) {
    Q.fechadas.has(h.dataset.parte) ? Q.fechadas.delete(h.dataset.parte) : Q.fechadas.add(h.dataset.parte);
    guardarPreferencias();
    desenharEstrutura();
  }
});
$("#estrutura").addEventListener("dblclick", (ev) => {
  const h = ev.target.closest(".oph");
  if (h) editarParte(h.dataset.parte, ev.clientX, ev.clientY);
});

// ---------- rodapé ----------
function desenharRodape() {
  const n = Object.keys(Q.p.cenas).length, np = Q.p.partes.length;
  $("#rodape").innerHTML = `<span><b>${n}</b> ${n === 1 ? "cena" : "cenas"}</span><span><b>${np}</b> ${np === 1 ? "parte" : "partes"}</span>
    <span>duração estimada <b id="totalTempo">${tempoTotal(segundosDe(ordem()))}</b></span>
    <div class="lg">${Object.values(STATUS).map((s) => `<span><i style="background:${s.cor}"></i>${s.nome}</span>`).join("")}</div>`;
}
registrar("rodape", desenharRodape);

// ---------- material e zoom ----------
function desenharMaterial() {
  const m = MATERIAIS.find((x) => x[0] === Q.p.material) || MATERIAIS[0];
  $("#matSw").className = `sw m-${m[0]}`;
  $("#matNome").textContent = m[1].split(" ").pop().toUpperCase();
  const pop = $("#popMaterial");
  if (pop.classList.contains("oculto")) return;
  const o = Q.p.opcoes || {};
  pop.innerHTML = `<h4>MATERIAL DO QUADRO</h4><div class="grid">${MATERIAIS.map(([id, nome]) =>
    `<button class="t ${id === m[0] ? "on" : ""}" data-mat="${id}"><div class="m-${id}"></div>${nome.toUpperCase()}</button>`).join("")}</div>
    <button class="opt" data-op="sombra">Sombra e leve inclinação nos cartões<i class="tog ${o.sombra !== false ? "" : "off"}"></i></button>
    <button class="opt" data-op="grade">Alinhar cartões em grade perfeita<i class="tog ${o.grade ? "" : "off"}"></i></button>`;
}
registrar("material", desenharMaterial);
$("#matBtn").addEventListener("click", () => {
  const pop = $("#popMaterial");
  pop.classList.toggle("oculto");
  const r = $("#matBtn").getBoundingClientRect();
  pop.style.left = `${Math.max(10, Math.min(r.left - 80, innerWidth - 510))}px`;
  desenharMaterial();
});
$("#popMaterial").addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-mat]");
  if (t) mudar((p) => (p.material = t.dataset.mat));
  const o = ev.target.closest("[data-op]");
  if (o) mudar((p) => {
    p.opcoes = p.opcoes || { sombra: true, grade: false };
    const k = o.dataset.op;
    p.opcoes[k] = k === "sombra" ? p.opcoes.sombra === false : !p.opcoes.grade;
  });
});
document.addEventListener("pointerdown", (ev) => {
  if (!ev.target.closest("#popMaterial, #matBtn")) $("#popMaterial").classList.add("oculto");
});

function aplicarZoom(z) {
  Q.zoom = Math.min(1.8, Math.max(0.6, Math.round(z * 100) / 100));
  $("#zoom").value = Q.zoom;
  $("#vQuadro").style.setProperty("--z", Q.zoom);
  guardarPreferencias();
}
$("#zoom").addEventListener("input", (ev) => aplicarZoom(+ev.target.value));
$("#zoomMenos").addEventListener("click", () => aplicarZoom(Q.zoom - 0.1));
$("#zoomMais").addEventListener("click", () => aplicarZoom(Q.zoom + 0.1));

// preferências da tela (por projeto, só neste computador)
function guardarPreferencias() {
  try {
    localStorage.setItem("quadro:" + Q.caminho, JSON.stringify({ zoom: Q.zoom, vista: Q.vista, fechadas: [...Q.fechadas], sel: Q.sel }));
  } catch { /* sem armazenamento: tudo bem */ }
}
function lerPreferencias() {
  try {
    const p = JSON.parse(localStorage.getItem("quadro:" + Q.caminho) || "{}");
    Q.zoom = p.zoom || 1;
    Q.vista = p.vista || "quadro";
    Q.fechadas = new Set(p.fechadas || []);
    if (p.sel && cena(p.sel)) Q.sel = p.sel;
  } catch { /* idem */ }
}
