// Carrega os temas de temas/<id>/tema.json. Cada tema define os dois lados:
// nomes, cores, presentes, palavras do chat, imagens, vozes e frases.

import { readdir, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export const POSES = ['parado', 'soco', 'especial', 'apanhando', 'nocaute', 'vitoria'];

const FRASES_GENERICAS = {
  ataque: ['Valeu, {nome}! Toma essa, {rival}!', 'Esse soco é cortesia de {nome}!', '{nome} mandou e eu bati!'],
  especial: ['Golpe especial patrocinado por {nome}!', 'Segura essa, {rival}! Presente de {nome}!'],
  super: ['SUPER GOLPE! Obrigado, {nome}!'],
  vitoria: ['Venci o round! Valeu, galera!'],
};

const NARRADOR_PADRAO = {
  inicioRound: ['Round {round}! Lutem!'],
  empate: ['Empate! Ninguém levou esse round!'],
};

function erroTema(id, msg) {
  return new Error(`Tema "${id}": ${msg}`);
}

export function validarTema(id, bruto) {
  const t = structuredClone(bruto ?? {});
  t.id = id;
  t.nome = String(t.nome || id);
  t.titulo = String(t.titulo ?? t.nome);
  t.subtitulo = String(t.subtitulo ?? '');
  t.aviso = String(t.aviso ?? 'Jogo de humor • Personagens fictícios');
  t.avisoIA = String(t.avisoIA ?? '');
  t.mapa = t.mapa !== false;
  // arena 3D (opcional): imagem de fundo pronta e onde ficam as cabeças dos bonecos na tela [[x, y], [x, y]]
  t.fundo = t.fundo ? String(t.fundo) : null;
  t.cabecas = Array.isArray(t.cabecas) && t.cabecas.length === 2 ? t.cabecas.map((c) => [Number(c[0]) || 0, Number(c[1]) || 0]) : null;
  t.cores = { fundo1: '#1a1033', fundo2: '#05060f', destaque: '#ffd400', ...(t.cores ?? {}) };
  t.base = `/temas/${encodeURIComponent(id)}/`;
  if (!Array.isArray(t.lados) || t.lados.length !== 2) throw erroTema(id, 'precisa ter exatamente 2 lados em "lados".');
  t.lados = t.lados.map((l, i) => {
    if (!l || !l.nome) throw erroTema(id, `o lado ${i + 1} precisa de "nome".`);
    const lado = { ...l };
    lado.nome = String(lado.nome);
    lado.cor = lado.cor || (i === 0 ? '#e53935' : '#1e88e5');
    lado.corTexto = lado.corTexto || '#ffffff';
    lado.presentes = (lado.presentes ?? []).map((p) => ({
      rotulo: String(p.rotulo ?? p.nomes?.[0] ?? 'Presente'),
      emoji: String(p.emoji ?? '🎁'),
      nomes: (p.nomes ?? []).map(String),
      ids: (p.ids ?? []).map(String),
      imagem: p.imagem ?? null,
    }));
    lado.palavras = (lado.palavras ?? [String(i + 1)]).map(String);
    lado.dicaChat = String(lado.dicaChat ?? lado.palavras[0] ?? i + 1);
    lado.personagem = { escala: 1, ...(lado.personagem ?? {}) };
    lado.personagem.imagens = { ...(lado.personagem.imagens ?? {}) };
    lado.voz = lado.voz ?? {};
    lado.frases = { ...FRASES_GENERICAS, ...(lado.frases ?? {}) };
    for (const cat of Object.keys(FRASES_GENERICAS)) {
      if (!Array.isArray(lado.frases[cat]) || lado.frases[cat].length === 0) lado.frases[cat] = FRASES_GENERICAS[cat];
    }
    return lado;
  });
  t.narrador = { voz: {}, ...(t.narrador ?? {}) };
  t.narrador.frases = { ...NARRADOR_PADRAO, ...(t.narrador.frases ?? {}) };
  t.substituicoesNoNome = t.substituicoesNoNome ?? null;
  return t;
}

async function existe(caminho) {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

export async function carregarTemas(pasta) {
  const temas = new Map();
  const avisos = [];
  let entradas = [];
  try {
    entradas = await readdir(pasta, { withFileTypes: true });
  } catch (erro) {
    avisos.push(`Pasta de temas não encontrada: ${pasta}`);
    return { temas, avisos };
  }
  for (const entrada of entradas) {
    if (!entrada.isDirectory()) continue;
    const id = entrada.name;
    const arquivo = join(pasta, id, 'tema.json');
    if (!(await existe(arquivo))) continue;
    try {
      const texto = (await readFile(arquivo, 'utf8')).replace(/^﻿/, '');
      const tema = validarTema(id, JSON.parse(texto));
      for (const [i, lado] of tema.lados.entries()) {
        const imgs = lado.personagem.imagens;
        if (!imgs.parado) avisos.push(`Tema "${id}", lado ${i + 1}: falta a imagem "parado" (vai aparecer uma silhueta).`);
        for (const [pose, rel] of Object.entries(imgs)) {
          if (!POSES.includes(pose)) avisos.push(`Tema "${id}": pose desconhecida "${pose}" (use ${POSES.join(', ')}).`);
          else if (!/^https?:/.test(rel) && !(await existe(join(pasta, id, rel)))) {
            avisos.push(`Tema "${id}": imagem não encontrada: ${rel}`);
            delete imgs[pose];
          }
        }
      }
      // fundo e retratos são opcionais: se o arquivo não existir, a tela usa o visual sem eles
      if (tema.fundo && !/^https?:/.test(tema.fundo) && !(await existe(join(pasta, id, tema.fundo)))) {
        avisos.push(`Tema "${id}": fundo não encontrado: ${tema.fundo}`);
        tema.fundo = null;
      }
      for (const lado of tema.lados) {
        const r = lado.personagem.retrato;
        if (r && !/^https?:/.test(r) && !(await existe(join(pasta, id, r)))) {
          avisos.push(`Tema "${id}": retrato não encontrado: ${r}`);
          delete lado.personagem.retrato;
        }
      }
      temas.set(id, tema);
    } catch (erro) {
      avisos.push(erro instanceof SyntaxError ? `Tema "${id}": tema.json com erro de digitação (${erro.message})` : erro.message);
    }
  }
  return { temas, avisos };
}

// Versão enxuta para mandar à tela (sem dados internos desnecessários).
export function temaParaTela(tema) {
  return {
    id: tema.id,
    nome: tema.nome,
    titulo: tema.titulo,
    subtitulo: tema.subtitulo,
    aviso: tema.aviso,
    avisoIA: tema.avisoIA,
    mapa: tema.mapa,
    fundo: tema.fundo,
    cabecas: tema.cabecas,
    cores: tema.cores,
    base: tema.base,
    lados: tema.lados.map((l) => ({
      nome: l.nome,
      cor: l.cor,
      corTexto: l.corTexto,
      presentes: l.presentes.map((p) => ({ rotulo: p.rotulo, emoji: p.emoji, imagem: p.imagem })),
      dicaChat: l.dicaChat,
      personagem: l.personagem,
      voz: l.voz,
    })),
    narrador: { voz: tema.narrador.voz },
    // vozes gravadas: a tela baixa todas de uma vez ao abrir, para a fala sair sem atraso
    audios: [
      ...new Set(
        tema.lados.flatMap((l) =>
          Object.values(l.frases ?? {})
            .flat()
            .map((f) => (f && typeof f === 'object' ? f.audio : null))
            .filter(Boolean)
            .map((a) => (/^https?:/.test(a) ? a : `${tema.base}${a}`)),
        ),
      ),
    ],
  };
}
