#!/usr/bin/env python3
"""Gera um PDF de roteiro de teste (Courier 12, formato brasileiro), sem dependências.
Uso: python3 -I testes-ui/gerar-roteiro.py saida.pdf"""
import sys

CENAS = [
    ("5", "EXT. ESTRADA DE TERRA – NOITE", "Um carro para no acostamento. Faróis apagados.", [("ANA", "Desliga o motor.")]),
    ("7", "INT. APARTAMENTO DE BRUNO – DIA", "O telefone toca. Bruno demora a atender.", [("BRUNO", "Alô?")]),
    ("8", "EXT. TERRENO BALDIO – DIA", "Policiais cercam uma vala. Ninguém fala.", []),
    ("9", "INT. HOSPITAL – QUARTO – NOITE", "Carla come em silêncio ao lado do leito.", [("CARLA", "Você precisa comer alguma coisa.")]),
    ("11", "INT. DELEGACIA – DIA", "Davi chega com uma caixa de papelão nas mãos.", []),
    ("40", "EXT. RUA DO MORRO – DIA", "Elisa corta os fios de um orelhão com um alicate. Fábio e Davi, encostados no carro, estudam a área.", [("FÁBIO", "Três entradas. Uma saída só.")]),
    ("41", "INT. DELEGACIA – SALA DE GUSTAVO – DIA", "Hugo entra com o colete na mão. Gustavo não tira os olhos dos papéis.",
     [("GUSTAVO", "Você não vai."), ("HUGO", "A equipe tá contando comigo."), ("GUSTAVO", "(ergue uma foto 3x4)\nPreciso que você ache esse homem. Hoje.")]),
    ("42", "EXT. MORRO – NOITE", "Ana distribui os homens em silêncio. Ao fundo, Davi fala no rádio.", []),
    ("43", "INT. CARRO – NOITE", "Ninguém fala. O rádio chia.", [("ANA", "Agora.")]),
    ("44A", "INT./EXT. CATIVEIRO – NOITE", "Bruno e Davi conduzem o refém pelo corredor.", []),
]


def quebrar(texto, largura):
    linhas, atual = [], ""
    for p in texto.split():
        if len(atual) + len(p) + 1 > largura:
            linhas.append(atual)
            atual = p
        else:
            atual = (atual + " " + p).strip()
    if atual:
        linhas.append(atual)
    return linhas


def linhas_do_roteiro():
    out = []  # (coluna_em_caracteres, texto, negrito)
    for num, cab, acao, falas in CENAS:
        out.append((0, f"{num} {cab}", True))
        out.append(None)
        for l in quebrar(acao, 60):
            out.append((0, l, False))
        out.append(None)
        for nome, fala in falas:
            out.append((22, nome, False))
            for parte in fala.split("\n"):
                if parte.startswith("("):
                    out.append((16, parte, False))
                else:
                    for l in quebrar(parte, 35):
                        out.append((10, l, False))
            out.append(None)
        out.append(None)
    return out


def pdf(linhas, saida):
    por_pagina = 46
    paginas = [linhas[i:i + por_pagina] for i in range(0, len(linhas), por_pagina)]
    objs = []
    def add(o):
        objs.append(o)
        return len(objs)
    f1 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>")
    f2 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>")
    pages_id = len(objs) + 1 + 2 * len(paginas)
    kids = []
    for n, pg in enumerate(paginas):
        cmds = [b"BT"]
        cmds.append(f"/F1 12 Tf 1 0 0 1 500 750 Tm ({n + 38}.) Tj".encode())
        y = 720
        for item in pg:
            if item is not None:
                col, texto, negrito = item
                t = texto.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").encode("cp1252")
                cmds.append(f"/{'F2' if negrito else 'F1'} 12 Tf 1 0 0 1 {108 + col * 7.2:.1f} {y} Tm (".encode() + t + b") Tj")
            y -= 14
        cmds.append(b"ET")
        stream = b"\n".join(cmds)
        c = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        p = add(f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 612 792] /Contents {c} 0 R /Resources << /Font << /F1 {f1} 0 R /F2 {f2} 0 R >> >> >>".encode())
        kids.append(p)
    add(f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>".encode())
    cat = add(f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode())
    out = bytearray(b"%PDF-1.4\n")
    offs = []
    for i, o in enumerate(objs):
        offs.append(len(out))
        out += f"{i + 1} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for o in offs:
        out += f"{o:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root {cat} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    open(saida, "wb").write(out)


if __name__ == "__main__":
    pdf(linhas_do_roteiro(), sys.argv[1] if len(sys.argv) > 1 else "roteiro-teste.pdf")
