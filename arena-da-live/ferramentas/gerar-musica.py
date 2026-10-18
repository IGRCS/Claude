# Gera a música de fundo (trilha de batalha original, sem direitos autorais de terceiros).
#   python3 ferramentas/gerar-musica.py   (precisa de numpy e ffmpeg)
# Saída: public/comum/musica/batalha.ogg — loop perfeito de 16 compassos.
import os
import subprocess
import wave

import numpy as np

SR = 32000
BPM = 132
BATIDA = 60 / BPM
COMPASSO = 4 * BATIDA
N_COMPASSOS = 16
TOTAL = int(round(N_COMPASSOS * COMPASSO * SR))
rng = np.random.default_rng(7)


def nota(nome):
    notas = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, oit = nome[:-1], int(nome[-1])
    return 440.0 * 2 ** ((notas[n] + 12 * (oit + 1) - 69) / 12)


def env(n, ataque=0.005, queda=0.15):
    t = np.arange(n) / SR
    e = np.minimum(1, t / ataque) * np.exp(-t / queda)
    return e


def passa_baixa(x, corte):
    a = np.exp(-2 * np.pi * corte / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def onda(tipo, f, n, fase=0.0):
    t = (np.arange(n) / SR) * f + fase
    if tipo == 'quadrada':
        return np.where((t % 1) < 0.5, 1.0, -1.0)
    if tipo == 'pulso':
        return np.where((t % 1) < 0.25, 1.0, -1.0)
    if tipo == 'serra':
        return 2 * (t % 1) - 1
    return np.sin(2 * np.pi * t)


faixa = np.zeros(TOTAL + SR * 2)  # sobra no fim para as caudas, que voltam ao começo (loop sem emenda)


def por(inicio_s, sinal, ganho):
    i = int(inicio_s * SR)
    faixa[i:i + len(sinal)] += sinal * ganho


# ---- bateria
def bumbo():
    n = int(0.28 * SR)
    t = np.arange(n) / SR
    f = 50 + 110 * np.exp(-t * 28)
    fase = np.cumsum(f) / SR
    return np.sin(2 * np.pi * fase) * np.exp(-t * 9)


def caixa():
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    r = rng.uniform(-1, 1, n)
    r = r - passa_baixa(r, 1800)
    tom = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
    return (r * 0.9 + tom * 0.5) * np.exp(-t * 16)


def chimbal(aberto=False):
    n = int((0.12 if aberto else 0.04) * SR)
    t = np.arange(n) / SR
    r = rng.uniform(-1, 1, n)
    r = r - passa_baixa(r, 6000)
    return r * np.exp(-t * (18 if aberto else 70))


B, C, H, HO = bumbo(), caixa(), chimbal(), chimbal(True)
for c in range(N_COMPASSOS):
    base = c * COMPASSO
    for b16 in range(16):
        t = base + b16 * BATIDA / 4
        if b16 in (0, 6, 8, 11) or (c % 4 == 3 and b16 == 14):
            por(t, B, 0.95)
        if b16 in (4, 12):
            por(t, C, 0.55)
        if c % 4 == 3 and b16 in (13, 15):
            por(t, C, 0.3)
        if b16 % 2 == 0:
            por(t, HO if b16 % 8 == 6 else H, 0.16)

# ---- harmonia: Am | F | G | E (lá menor, clima de luta)
ACORDES = [('A', ['A3', 'C4', 'E4']), ('F', ['F3', 'A3', 'C4']), ('G', ['G3', 'B3', 'D4']), ('E', ['E3', 'G#3', 'B3'])]
BAIXOS = {'A': 'A1', 'F': 'F1', 'G': 'G1', 'E': 'E1'}

for c in range(N_COMPASSOS):
    nome, notas = ACORDES[(c // 2) % 4]
    base = c * COMPASSO
    fb = nota(BAIXOS[nome])
    # baixo galopante em colcheias com oitava
    for i in range(8):
        f = fb * (2 if i in (3, 7) else 1)
        n = int(BATIDA / 2 * SR * 0.9)
        s = passa_baixa(onda('serra', f, n), 700) * env(n, 0.004, 0.18)
        por(base + i * BATIDA / 2, s, 0.42)
    # pad suave
    n = int(COMPASSO * SR)
    pad = sum(onda('serra', nota(x) * d, n) for x in notas for d in (0.997, 1.003)) / 6
    pad = passa_baixa(pad, 900) * np.minimum(1, np.arange(n) / (0.3 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.2 * SR))
    por(base, pad, 0.10)
    # arpejo em semicolcheias (segunda metade da música mais intensa)
    if c >= 4:
        seq = notas + [notas[1]]
        for i in range(16):
            f = nota(seq[i % 4]) * 2
            n = int(BATIDA / 4 * SR * 0.8)
            s = onda('pulso', f, n) * env(n, 0.002, 0.06)
            por(base + i * BATIDA / 4, passa_baixa(s, 3500), 0.07 if c < 8 else 0.1)

# ---- melodia heroica nos compassos 9–16
MELODIA = ['A4', 'C5', 'E5', 'D5', 'C5', '-', 'A4', '-', 'F4', 'A4', 'C5', 'D5', 'C5', '-', 'A4', '-',
           'G4', 'B4', 'D5', 'E5', 'D5', '-', 'B4', '-', 'G#4', 'B4', 'E5', '-', 'D5', 'C5', 'B4', '-']
for k, m in enumerate(MELODIA):
    if m == '-':
        continue
    t = 8 * COMPASSO + k * BATIDA
    n = int(BATIDA * SR * 0.95)
    f = nota(m)
    vib = np.sin(2 * np.pi * 5.5 * np.arange(n) / SR) * 0.004
    s = onda('quadrada', f * (1 + vib.mean()), n) * 0.6 + onda('serra', f * 1.002, n) * 0.4
    por(t, passa_baixa(s, 2600) * env(n, 0.01, 0.35), 0.11)

# caudas que passaram do fim voltam para o começo -> loop sem emenda
faixa[:len(faixa) - TOTAL] += faixa[TOTAL:]
faixa = faixa[:TOTAL]
faixa /= np.max(np.abs(faixa)) * 1.12

raiz = os.path.join(os.path.dirname(__file__), '..', 'public', 'comum', 'musica')
os.makedirs(raiz, exist_ok=True)
wav = os.path.join(raiz, 'batalha.wav')
with wave.open(wav, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((faixa * 32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', os.path.join(raiz, 'batalha.ogg')], check=True)
os.remove(wav)
print(f'ok: {TOTAL / SR:.2f}s, loop de {N_COMPASSOS} compassos a {BPM} BPM')
