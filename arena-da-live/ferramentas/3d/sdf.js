// Escultura por SDF (campo de distância) + malha por "surface nets".
import * as THREE from 'three';

const len = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

export const sdf = {
  esfera: (c, r) => (x, y, z) => len(x - c[0], y - c[1], z - c[2]) - r,
  // elipsoide aproximado (bom o suficiente para escultura)
  elipse: (c, r) => (x, y, z) => {
    const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
    const k0 = len(px, py, pz);
    const k1 = len(px / r[0], py / r[1], pz / r[2]);
    return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
  },
  // cone arredondado entre a e b (raios ra, rb)
  cone: (a, b, ra, rb) => (x, y, z) => {
    const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
    return len(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
  },
  caixa: (c, b, r) => (x, y, z) => {
    const qx = Math.abs(x - c[0]) - b[0] + r, qy = Math.abs(y - c[1]) - b[1] + r, qz = Math.abs(z - c[2]) - b[2] + r;
    return len(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  },
  // cilindro arredondado vertical
  cilindro: (c, r, h, arred = 0.01) => (x, y, z) => {
    const dx = len(x - c[0], 0, z - c[2]) - r + arred, dy = Math.abs(y - c[1]) - h + arred;
    return Math.min(Math.max(dx, dy), 0) + len(Math.max(dx, 0), Math.max(dy, 0), 0) - arred;
  },
  uniao: (k, ...fs) => (x, y, z) => {
    let d = fs[0](x, y, z);
    for (let i = 1; i < fs.length; i++) {
      const d2 = fs[i](x, y, z);
      const h = Math.max(k - Math.abs(d - d2), 0) / k;
      d = Math.min(d, d2) - h * h * k * 0.25;
    }
    return d;
  },
  menos: (k, a, b) => (x, y, z) => {
    const d1 = a(x, y, z), d2 = -b(x, y, z);
    if (k <= 0) return Math.max(d1, d2);
    const h = Math.max(k - Math.abs(d1 - d2), 0) / k;
    return Math.max(d1, d2) + h * h * k * 0.25;
  },
  inter: (k, a, b) => (x, y, z) => {
    const d1 = a(x, y, z), d2 = b(x, y, z);
    if (k <= 0) return Math.max(d1, d2);
    const h = Math.max(k - Math.abs(d1 - d2), 0) / k;
    return Math.max(d1, d2) + h * h * k * 0.25;
  },
  inflar: (f, e) => (x, y, z) => f(x, y, z) - e,
  plano: (n, d) => (x, y, z) => x * n[0] + y * n[1] + z * n[2] - d, // >0 do lado n
  ruido: (f, amp, freq) => (x, y, z) => f(x, y, z) + amp * fbm(x * freq, y * freq, z * freq),
};

// ruído de valor 3D
function hash(i, j, k) {
  let h = (i * 374761393 + j * 668265263 + k * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function ruido3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const fx = x - i, fy = y - j, fz = z - k;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash(i, j, k), hash(i + 1, j, k), u), l(hash(i, j + 1, k), hash(i + 1, j + 1, k), u), v),
    l(l(hash(i, j, k + 1), hash(i + 1, j, k + 1), u), l(hash(i, j + 1, k + 1), hash(i + 1, j + 1, k + 1), u), v),
    w,
  ) * 2 - 1;
}
export function fbm(x, y, z) {
  return ruido3(x, y, z) * 0.6 + ruido3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + ruido3(x * 4.3, y * 4.3, z * 4.3) * 0.1;
}

// Malha por surface nets. f: sdf; min/max: caixa; passo: tamanho da célula; cor(x,y,z) opcional -> [r,g,b]
export function malhar(f, min, max, passo, cor) {
  const nx = Math.ceil((max[0] - min[0]) / passo) + 1;
  const ny = Math.ceil((max[1] - min[1]) / passo) + 1;
  const nz = Math.ceil((max[2] - min[2]) / passo) + 1;
  const val = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) val[id(i, j, k)] = f(min[0] + i * passo, min[1] + j * passo, min[2] + k * passo);
  const vert = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  const ARESTAS = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cantos = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let neg = 0;
        for (let c = 0; c < 8; c++) {
          const v = val[id(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
          cantos[c] = v;
          if (v < 0) neg++;
        }
        if (neg === 0 || neg === 8) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of ARESTAS) {
          const va = cantos[a], vb = cantos[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
          n++;
        }
        vert[id(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / n) * passo, min[1] + (j + sy / n) * passo, min[2] + (k + sz / n) * passo);
      }
  const ind = [];
  const quad = (a, b, c, d, inv) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (inv) ind.push(a, b, c, a, c, d);
    else ind.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const v0 = val[id(i, j, k)] < 0;
        if (i < nx - 1 && v0 !== val[id(i + 1, j, k)] < 0)
          quad(vert[id(i, j - 1, k - 1)], vert[id(i, j, k - 1)], vert[id(i, j, k)], vert[id(i, j - 1, k)], v0);
        if (j < ny - 1 && v0 !== val[id(i, j + 1, k)] < 0)
          quad(vert[id(i - 1, j, k - 1)], vert[id(i - 1, j, k)], vert[id(i, j, k)], vert[id(i, j, k - 1)], v0);
        if (k < nz - 1 && v0 !== val[id(i, j, k + 1)] < 0)
          quad(vert[id(i - 1, j - 1, k)], vert[id(i, j - 1, k)], vert[id(i, j, k)], vert[id(i - 1, j, k)], v0);
      }
  // normais pelo gradiente do campo
  const nor = new Float32Array(pos.length);
  const e = passo * 0.5;
  for (let v = 0; v < pos.length; v += 3) {
    const [x, y, z] = [pos[v], pos[v + 1], pos[v + 2]];
    const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
    const l = len(gx, gy, gz) || 1;
    nor[v] = gx / l; nor[v + 1] = gy / l; nor[v + 2] = gz / l;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (cor) {
    const cs = new Float32Array(pos.length);
    for (let v = 0; v < pos.length; v += 3) {
      const c = cor(pos[v], pos[v + 1], pos[v + 2]);
      cs[v] = c[0]; cs[v + 1] = c[1]; cs[v + 2] = c[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(cs, 3));
  }
  g.setIndex(ind);
  return g;
}
