// Funções pequenas usadas em vários módulos.

// "Ação Ñ!" -> "acao n!" (minúsculas, sem acentos)
export function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function escolherAleatorio(lista, aleatorio = Math.random) {
  if (!lista || lista.length === 0) return undefined;
  return lista[Math.floor(aleatorio() * lista.length)];
}

export function limitar(valor, min, max) {
  return Math.max(min, Math.min(max, valor));
}

// Mescla profunda simples: objetos são mesclados, o resto é substituído.
export function mesclar(base, extra) {
  if (extra === undefined) return structuredClone(base);
  if (!ehObjeto(base) || !ehObjeto(extra)) return structuredClone(extra);
  const saida = structuredClone(base);
  for (const [chave, valor] of Object.entries(extra)) {
    saida[chave] = ehObjeto(valor) && ehObjeto(saida[chave]) ? mesclar(saida[chave], valor) : structuredClone(valor);
  }
  return saida;
}

function ehObjeto(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function horaAgora() {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
