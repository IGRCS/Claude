// Gera eventos falsos para testar tudo no OBS sem precisar estar ao vivo.

import { EventEmitter } from 'node:events';
import { escolherAleatorio } from './util.js';

const NOMES = [
  'tia_neide', 'joao.da.padaria', 'marcinha2009', 'seu_ze_do_bar', 'gabi.gamer', 'pedrinho_ff', 'dona_cida',
  'rafa_motoboy', 'lu_maquiadora', 'carlao_churrasco', 'bia.santos', 'tiago_ofc', 'zezinho', 'vovo_juju',
  'kaique_br', 'Fernandinha', 'Paulão do Gás', 'Cleide Fofa', 'Rodrigo Fiel', 'Jéssica Oliveira',
];

const PRESENTES = {
  medio: { id: 'sim-rosquinha', nome: 'Doughnut', moedas: 30, tipo: 2 },
  especial: { id: 'sim-chapeu', nome: 'Hat and Mustache', moedas: 99, tipo: 2 },
  super: { id: 'sim-dinheiro', nome: 'Money Gun', moedas: 500, tipo: 2 },
};

let contador = 0;

export class Simulador extends EventEmitter {
  constructor({ obterTema, aleatorio = Math.random }) {
    super();
    this.obterTema = obterTema;
    this.aleatorio = aleatorio;
    this.timer = null;
  }

  usuario(nome) {
    const n = nome || escolherAleatorio(NOMES, this.aleatorio);
    return { id: `sim:${n}`, apelido: n.replace(/\s+/g, '_').toLowerCase(), nome: n, foto: null };
  }

  // Presente do próprio lado (ex.: Rosa), mandado em sequência para testar os combos.
  presentePequeno(lado, usuario = this.usuario()) {
    const tema = this.obterTema();
    const p = tema?.lados[lado]?.presentes?.[0];
    const presente = { id: p?.ids?.[0] ?? `sim-lado${lado}`, nome: p?.nomes?.[0] ?? `Presente ${lado + 1}`, moedas: 1, tipo: 1, imagem: p?.imagem ?? null };
    const total = 1 + Math.floor(this.aleatorio() * 5);
    const groupId = `g${++contador}`;
    for (let i = 1; i <= total; i++) {
      setTimeout(() => this.emit('presente', { usuario, presente, repeatCount: i, repeatEnd: false, groupId }), (i - 1) * 180);
    }
    setTimeout(() => this.emit('presente', { usuario, presente, repeatCount: total, repeatEnd: true, groupId }), total * 180 + 200);
  }

  // Presente "neutro": o usuário escolhe o lado no chat antes ("1" ou "2").
  presenteGrande(lado, tamanho, usuario = this.usuario()) {
    const tema = this.obterTema();
    const palavra = tema?.lados[lado]?.palavras?.[0] ?? String(lado + 1);
    this.emit('comentario', { usuario, texto: palavra });
    const presente = { ...PRESENTES[tamanho] ?? PRESENTES.medio, imagem: null };
    setTimeout(() => this.emit('presente', { usuario, presente, repeatCount: 1, repeatEnd: false, groupId: '' }), 120);
  }

  executar({ tipo, lado = 0, tamanho = 'pequeno', nome } = {}) {
    const usuario = this.usuario(nome);
    switch (tipo) {
      case 'presente':
        if (tamanho === 'pequeno') this.presentePequeno(lado, usuario);
        else this.presenteGrande(lado, tamanho, usuario);
        break;
      case 'entrar': {
        const tema = this.obterTema();
        this.emit('comentario', { usuario, texto: tema?.lados[lado]?.palavras?.[0] ?? String(lado + 1) });
        break;
      }
      case 'estado':
        this.emit('comentario', { usuario, texto: escolherAleatorio(['SP', 'RJ', 'BA', 'MG', 'PE', 'RS', 'CE', 'AM', 'PA', 'GO'], this.aleatorio) });
        break;
      case 'curtidas':
        this.emit('comentario', { usuario, texto: String(lado + 1) });
        this.emit('curtida', { usuario, quantidade: 60 });
        break;
      case 'seguir':
        this.emit('seguiu', { usuario });
        break;
      default:
        break;
    }
  }

  automatico(ligar) {
    clearTimeout(this.timer);
    this.timer = null;
    if (!ligar) return;
    const passo = () => {
      const r = this.aleatorio();
      const lado = this.aleatorio() < 0.5 ? 0 : 1;
      if (r < 0.58) this.executar({ tipo: 'presente', lado, tamanho: 'pequeno' });
      else if (r < 0.72) this.executar({ tipo: 'entrar', lado });
      else if (r < 0.8) this.executar({ tipo: 'curtidas', lado });
      else if (r < 0.86) this.executar({ tipo: 'estado' });
      else if (r < 0.94) this.executar({ tipo: 'presente', lado, tamanho: 'medio' });
      else if (r < 0.985) this.executar({ tipo: 'presente', lado, tamanho: 'especial' });
      else this.executar({ tipo: 'presente', lado, tamanho: 'super' });
      this.timer = setTimeout(passo, 500 + this.aleatorio() * 1300);
    };
    passo();
  }

  get ligado() {
    return this.timer !== null;
  }
}
