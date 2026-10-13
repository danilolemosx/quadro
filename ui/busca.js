// Busca (⌘F): as cenas encontradas ganham borda amarela e as outras ficam cinza, sem sair do lugar.
"use strict";

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const Busca = {
  texto: "",
  status: new Set(),
  pers: new Set(),
  notas: false,
  semFrame: false,
  parte: null,
  todosPers: false,

  ativa() {
    return !!(this.texto.trim() || this.status.size || this.pers.size || this.notas || this.semFrame || this.parte);
  },
  /** Conjunto de ids encontrados, ou null se a busca está vazia. */
  resultado() {
    if (!Q.p || !this.ativa()) return null;
    const termos = semAcento(this.texto).split(/\s+/).filter(Boolean);
    const pers = [...this.pers].map(semAcento);
    const achados = new Set();
    for (const parte of Q.p.partes) {
      if (this.parte && parte.id !== this.parte) continue;
      for (const id of parte.cenas) {
        const c = Q.p.cenas[id];
        if (this.status.size && !this.status.has(c.status)) continue;
        if (this.notas && !temNotas(c)) continue;
        if (this.semFrame && c.frame) continue;
        const cp = (c.personagens || []).map(semAcento);
        if (pers.length && !pers.some((p) => cp.includes(p))) continue;
        if (termos.length) {
          const tudo = semAcento([c.numero, c.resumo, ...(c.personagens || []), c.notas, ...(c.postits || []).map((n) => n.texto)].join(" \u0001 "));
          const num = normNum(c.numero).toLowerCase();
          if (!termos.every((t) => tudo.includes(t) || num === t.replace(/^0+(?=\d)/, ""))) continue;
        }
        achados.add(id);
      }
    }
    return achados;
  },
  limpar() {
    this.texto = "";
    this.status.clear();
    this.pers.clear();
    this.notas = this.semFrame = false;
    this.parte = null;
    $("#buscaTexto").value = "";
    atualizarBusca();
  },
};

/** Personagens do projeto, do mais frequente para o menos. */
function personagensFrequentes() {
  const n = new Map();
  for (const c of Object.values(Q.p.cenas)) for (const p of c.personagens || []) n.set(p, (n.get(p) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt")).map((x) => x[0]);
}

function desenharPopBusca() {
  const pop = $("#popBusca");
  if (pop.classList.contains("oculto") || !Q.p) return;
  const pers = personagensFrequentes();
  const mostrar = Busca.todosPers ? pers : pers.slice(0, 6);
  for (const p of Busca.pers) if (!mostrar.includes(p)) mostrar.push(p);
  const res = Busca.resultado();
  const n = res ? res.size : Object.keys(Q.p.cenas).length;
  const pd = Q.sel && parteDe(Q.sel);
  const parteChip = Busca.parte ? Q.p.partes.find((p) => p.id === Busca.parte) : pd && pd.parte;
  const sufixo = Busca.texto.trim() ? ` com ${Busca.texto.trim()}` : Busca.pers.size ? ` com ${[...Busca.pers].join(", ")}` : "";
  pop.innerHTML = `
    <h4>STATUS</h4><div class="fl">${Object.entries(STATUS).map(([k, s]) => `<button class="chipf ${Busca.status.has(k) ? "on" : ""}" data-st="${k}"><i style="background:${s.cor}"></i>${s.nome}</button>`).join("")}</div>
    <h4>PERSONAGEM</h4><div class="fl">${mostrar.map((p) => `<button class="chipf ${Busca.pers.has(p) ? "on" : ""}" data-pers="${esc(p)}">${esc(p)}</button>`).join("")}
      ${!Busca.todosPers && pers.length > 6 ? `<button class="chipf" data-mais>+ ${pers.length - 6}</button>` : ""}${pers.length ? "" : `<span style="font-size:11.5px;color:#8d877c">Nenhum personagem cadastrado ainda.</span>`}</div>
    <h4>OUTROS</h4><div class="fl"><button class="chipf ${Busca.notas ? "on" : ""}" data-x="notas">Com notas</button><button class="chipf ${Busca.semFrame ? "on" : ""}" data-x="semFrame">Sem frame</button>
      ${parteChip ? `<button class="chipf ${Busca.parte ? "on" : ""}" data-parte="${parteChip.id}">${esc(parteChip.nome)}</button>` : ""}</div>
    <div class="res"><span><b>${n}</b>${n === 1 ? "cena" : "cenas"}${esc(sufixo)}</span><em>Esc limpa a busca</em></div>`;
}

/** Aplica o destaque sem redesenhar os cartões (rápido, sem piscar as imagens). */
function atualizarBusca() {
  const res = Busca.resultado();
  for (const el of $$("#vQuadro .card[data-id], #vLista .lr[data-id]")) {
    el.classList.toggle("hit", !!res && res.has(el.dataset.id));
    el.classList.toggle("apagado", !!res && !res.has(el.dataset.id));
  }
  for (const el of $$("#estrutura li[data-id]")) el.classList.toggle("apagado", !!res && !res.has(el.dataset.id));
  $("#busca").classList.toggle("on", Busca.ativa() || document.activeElement === $("#buscaTexto"));
  desenharPopBusca();
  desenharSo("roteiro-sel");
}
registrar("busca", desenharPopBusca);

function abrirPopBusca() {
  const pop = $("#popBusca");
  pop.classList.remove("oculto");
  const r = $("#busca").getBoundingClientRect();
  pop.style.left = `${Math.max(10, r.right - 420)}px`;
  pop.style.top = `${r.bottom + 6}px`;
  desenharPopBusca();
}
$("#buscaTexto").addEventListener("focus", () => { if (Q.p) { abrirPopBusca(); atualizarBusca(); } });
$("#buscaTexto").addEventListener("input", (ev) => { Busca.texto = ev.target.value; atualizarBusca(); });
$("#buscaTexto").addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") { ev.preventDefault(); Busca.limpar(); $("#buscaTexto").blur(); $("#popBusca").classList.add("oculto"); atualizarBusca(); }
  if (ev.key === "Enter") {
    const res = Busca.resultado();
    const primeiro = res && ordem().find((id) => res.has(id));
    if (primeiro) selecionar(primeiro);
  }
});
$("#popBusca").addEventListener("pointerdown", (ev) => ev.preventDefault()); // não tira o foco do campo
$("#popBusca").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  const alternar = (set, v) => (set.has(v) ? set.delete(v) : set.add(v));
  if (b.dataset.st) alternar(Busca.status, b.dataset.st);
  else if (b.dataset.pers) alternar(Busca.pers, b.dataset.pers);
  else if ("mais" in b.dataset) Busca.todosPers = true;
  else if (b.dataset.x) Busca[b.dataset.x] = !Busca[b.dataset.x];
  else if (b.dataset.parte) Busca.parte = Busca.parte ? null : b.dataset.parte;
  atualizarBusca();
});
document.addEventListener("pointerdown", (ev) => {
  if (!ev.target.closest("#popBusca, #busca")) {
    $("#popBusca").classList.add("oculto");
    setTimeout(() => $("#busca").classList.toggle("on", Busca.ativa()), 0);
  }
});
