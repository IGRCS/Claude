// Troca automática de tema numa data/hora (ex.: sair do tema da eleição 72h antes da votação).

export function verificarTroca(agendamento, temaAtivo, agora = Date.now()) {
  if (!agendamento?.ativa || agendamento.feita) return { trocar: false, marcarFeita: false };
  const quando = Date.parse(agendamento.quando);
  if (!Number.isFinite(quando) || agora < quando) return { trocar: false, marcarFeita: false };
  // Já passou do horário: só troca se ainda estiver no tema de origem.
  if (agendamento.deTema && temaAtivo !== agendamento.deTema) return { trocar: false, marcarFeita: true };
  return { trocar: true, marcarFeita: true, para: agendamento.paraTema };
}

export function faltaParaTroca(agendamento, agora = Date.now()) {
  if (!agendamento?.ativa || agendamento.feita) return null;
  const quando = Date.parse(agendamento.quando);
  return Number.isFinite(quando) ? quando - agora : null;
}
