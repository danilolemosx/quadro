// Arrastar dentro do app (cartões, linhas da lista, partes, post-its, frames da fila), com a linha vermelha
// mostrando onde vai cair. Usa eventos de ponteiro (o arrastar nativo do HTML fica com o Finder).
// Elementos arrastáveis têm data-arr="cena|parte|nota|fila".
"use strict";

const Arrastar = (() => {
  let ini = null; // { el, x, y, tipo }
  let ativo = null; // { fantasma, dx, dy, alvo }
  let ultimo = { x: 0, y: 0 };
  let rolagem = null;
  let engolirClique = false;

  const insV = () => $("#insV"), insH = () => $("#insH"), dica = () => $("#dica");

  function limparIndicadores() {
    insV().classList.add("oculto");
    insH().classList.add("oculto");
    dica().classList.add("oculto");
    for (const el of $$(".alvo")) el.classList.remove("alvo");
  }
  function linhaV(x, top, h) {
    Object.assign(insV().style, { left: `${x - 1}px`, top: `${top}px`, height: `${h}px` });
    insV().classList.remove("oculto");
  }
  function linhaH(left, y, w) {
    Object.assign(insH().style, { left: `${left}px`, top: `${y - 1}px`, width: `${w}px` });
    insH().classList.remove("oculto");
  }
  function mostrarDica(texto, x, y) {
    const d = dica();
    d.textContent = texto;
    d.classList.remove("oculto");
    const w = d.offsetWidth;
    d.style.left = `${Math.min(x, innerWidth - w - 10)}px`;
    d.style.top = `${y - 26}px`;
  }
  const nomeParte = (pid) => {
    const p = Q.p.partes.find((x) => x.id === pid);
    return p ? p.nome : "";
  };
  function textoDestino(pid, antes) {
    return `Mover para ${nomeParte(pid)} · ` + (antes ? `antes da ${titulo(cena(antes)).toLowerCase()}` : "no fim");
  }

  // ---------- onde cai ----------
  function alvoCena(x, y, id) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    // lista
    const lr = el.closest(".lr[data-id]");
    if (lr && lr.dataset.id !== id) {
      const r = lr.getBoundingClientRect();
      const depois = y > r.top + r.height / 2;
      const pd = parteDe(lr.dataset.id);
      const antes = depois ? pd.parte.cenas.filter((c) => c !== id)[pd.parte.cenas.filter((c) => c !== id).indexOf(lr.dataset.id) + 1] || null : lr.dataset.id;
      return { parte: pd.parte.id, antes, linha: ["h", r.left, depois ? r.bottom + 2 : r.top - 2, r.width] };
    }
    const lpw = el.closest(".lpw[data-parte]");
    if (lpw) {
      const parte = Q.p.partes.find((p) => p.id === lpw.dataset.parte);
      const r = lpw.getBoundingClientRect();
      return { parte: parte.id, antes: parte.cenas.find((c) => c !== id) || null, linha: ["h", r.left, r.bottom + 2, r.width] };
    }
    // quadro
    const add = el.closest(".add[data-parte]");
    if (add) {
      const r = add.getBoundingClientRect();
      return { parte: add.dataset.parte, antes: null, linha: ["v", r.left - 8, r.top, r.height] };
    }
    const row = el.closest(".row[data-parte]");
    if (!row) return null;
    const cards = $$(".card[data-id]", row).filter((c) => c.dataset.id !== id);
    if (!cards.length) {
      const r = $(".cards", row).getBoundingClientRect();
      return { parte: row.dataset.parte, antes: null, linha: ["v", r.left - 8, r.top, 112 * Q.zoom] };
    }
    // o cartão mais perto do ponteiro (na mesma linha visual, de preferência)
    let melhor = null, dist = Infinity;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      const d = dy * 3 + dx;
      if (d < dist) { dist = d; melhor = c; }
    }
    const r = melhor.getBoundingClientRect();
    const depois = x > r.left + r.width / 2;
    const seq = Q.p.partes.find((p) => p.id === row.dataset.parte).cenas.filter((c) => c !== id);
    const antes = depois ? seq[seq.indexOf(melhor.dataset.id) + 1] || null : melhor.dataset.id;
    const gap = 7 * Q.zoom;
    return { parte: row.dataset.parte, antes, linha: ["v", depois ? r.right + gap : r.left - gap, r.top - 4, r.height + 8] };
  }

  function alvoParte(x, y, id) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const bloco = el.closest(".row[data-parte], .grp[data-parte]");
    if (!bloco) return null;
    const r = bloco.getBoundingClientRect();
    const depois = y > r.top + r.height / 2;
    const seq = Q.p.partes.map((p) => p.id).filter((p) => p !== id);
    if (bloco.dataset.parte === id) return { antes: Q.p.partes[Q.p.partes.findIndex((p) => p.id === id) + 1]?.id || null, linha: null };
    const antes = depois ? seq[seq.indexOf(bloco.dataset.parte) + 1] || null : bloco.dataset.parte;
    return { antes, linha: ["h", r.left, depois ? r.bottom + 4 : r.top - 6, Math.min(r.width, 900)] };
  }

  function alvoCartao(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const c = el.closest(".card[data-id], .lr[data-id], .op li[data-id]");
    if (c) return { cena: c.dataset.id, el: c };
    const big = el.closest(".insp .big");
    if (big && Q.sel) return { cena: Q.sel, el: big };
    return null;
  }

  function calcular(x, y) {
    limparIndicadores();
    const { tipo, el } = ini;
    let alvo = null;
    if (tipo === "cena") {
      alvo = alvoCena(x, y, el.dataset.id);
      if (alvo) {
        const [o, a, b, c] = alvo.linha;
        o === "v" ? linhaV(a, b, c) : linhaH(a, b, c);
        mostrarDica(textoDestino(alvo.parte, alvo.antes), x + 18, y);
      }
    } else if (tipo === "parte") {
      alvo = alvoParte(x, y, el.dataset.parte);
      if (alvo && alvo.linha) {
        const [, a, b, c] = alvo.linha;
        linhaH(a, b, c);
        const antes = alvo.antes && Q.p.partes.find((p) => p.id === alvo.antes);
        mostrarDica(antes ? `Mover para antes da ${antes.nome}` : "Mover para o fim", x + 18, y);
      }
    } else {
      alvo = alvoCartao(x, y);
      if (alvo) {
        alvo.el.classList.add("alvo");
        if (tipo === "fila") mostrarDica(`Frame da ${titulo(cena(alvo.cena)).toLowerCase()}`, x + 18, y);
      }
    }
    ativo.alvo = alvo;
  }

  function soltar() {
    const { tipo, el } = ini;
    const a = ativo.alvo;
    if (!a) return;
    if (tipo === "cena") moverCena(el.dataset.id, a.parte, a.antes);
    else if (tipo === "parte") moverParte(el.dataset.parte, a.antes);
    else if (tipo === "nota") moverNota(el.dataset.cena, el.dataset.nota, a.cena);
    else if (tipo === "fila") Importar.usarDaFila(el.dataset.fila, a.cena);
  }

  // ---------- rolar perto das bordas ----------
  function rolarPerto() {
    if (!ativo) return;
    const el = document.elementFromPoint(ultimo.x, ultimo.y);
    const cx = el && el.closest(".board, .list, .script, .side");
    if (cx) {
      const r = cx.getBoundingClientRect();
      const m = 50;
      let dy = 0;
      if (ultimo.y < r.top + m) dy = -Math.ceil((r.top + m - ultimo.y) / 4);
      else if (ultimo.y > r.bottom - m) dy = Math.ceil((ultimo.y - (r.bottom - m)) / 4);
      if (dy) { cx.scrollTop += dy; calcular(ultimo.x, ultimo.y); }
    }
    rolagem = requestAnimationFrame(rolarPerto);
  }

  // ---------- eventos ----------
  document.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    const el = ev.target.closest("[data-arr]");
    if (!el || ev.target.closest("[contenteditable='true'], input, textarea, button")) return;
    ini = { el, x: ev.clientX, y: ev.clientY, tipo: el.dataset.arr };
  });

  document.addEventListener("pointermove", (ev) => {
    if (!ini) return;
    ultimo = { x: ev.clientX, y: ev.clientY };
    if (!ativo) {
      if (Math.hypot(ev.clientX - ini.x, ev.clientY - ini.y) < 6) return;
      const r = ini.el.getBoundingClientRect();
      const f = ini.el.cloneNode(true);
      f.classList.remove("sel", "on", "levantado");
      f.classList.add("fantasma");
      Object.assign(f.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: 0, fontSize: getComputedStyle(ini.el).fontSize });
      document.body.appendChild(f);
      ini.el.classList.add("levantado");
      document.body.classList.add("arrastando");
      ativo = { fantasma: f, dx: ini.x - r.left, dy: ini.y - r.top, alvo: null };
      rolagem = requestAnimationFrame(rolarPerto);
    }
    ativo.fantasma.style.left = `${ev.clientX - ativo.dx}px`;
    ativo.fantasma.style.top = `${ev.clientY - ativo.dy}px`;
    calcular(ev.clientX, ev.clientY);
  });

  function terminar(cancelar) {
    if (ativo) {
      cancelAnimationFrame(rolagem);
      ativo.fantasma.remove();
      ini.el.classList.remove("levantado");
      document.body.classList.remove("arrastando");
      limparIndicadores();
      engolirClique = true;
      setTimeout(() => (engolirClique = false), 50);
      if (!cancelar) soltar();
    }
    ativo = null;
    ini = null;
  }
  document.addEventListener("pointerup", () => terminar(false));
  document.addEventListener("pointercancel", () => terminar(true));
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && ativo) terminar(true); }, true);
  document.addEventListener("click", (ev) => {
    if (engolirClique) { ev.stopPropagation(); ev.preventDefault(); engolirClique = false; }
  }, true);

  return { emAndamento: () => !!ativo };
})();
