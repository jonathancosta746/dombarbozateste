// Utilitários de data/hora para a agenda.
// Dias da semana no padrão JS: 0=domingo ... 6=sábado

export const DIAS_SEMANA = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
]

export function toDateKey(date) {
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function proximosDias(qtd = 14) {
  const dias = []
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  for (let i = 0; i < qtd; i++) {
    const d = new Date(hoje)
    d.setDate(hoje.getDate() + i)
    dias.push(d)
  }
  return dias
}

function minutosParaHora(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

function horaParaMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Gera os horários disponíveis para um barbeiro em uma data específica,
// considerando o expediente do dia, a duração do serviço e os agendamentos já existentes.
export function gerarHorariosDisponiveis({ expedienteDia, duracaoServicoMin, agendamentosDoDia, intervaloMin = 60, dataKey }) {
  if (!expedienteDia || !expedienteDia.enabled) return []

  const inicioExpediente = horaParaMinutos(expedienteDia.start)
  const fimExpediente = horaParaMinutos(expedienteDia.end)
  const pausaInicio = expedienteDia.breakStart ? horaParaMinutos(expedienteDia.breakStart) : null
  const pausaFim = expedienteDia.breakEnd ? horaParaMinutos(expedienteDia.breakEnd) : null

  // "cancelado" e "remarcado" não ocupam mais o horário: remarcado significa
  // que o cliente foi movido para outra data, liberando este horário.
  const ocupados = (agendamentosDoDia || [])
    .filter(a => a.status !== 'cancelado' && a.status !== 'remarcado')
    .map(a => ({ inicio: horaParaMinutos(a.startTime), fim: horaParaMinutos(a.endTime) }))

  const agora = new Date()
  const ehHoje = toDateKey(agora) === dataKey
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes()

  const slots = []
  for (let inicio = inicioExpediente; inicio + duracaoServicoMin <= fimExpediente; inicio += intervaloMin) {
    const fim = inicio + duracaoServicoMin

    if (ehHoje && inicio <= minutosAgora) continue

    if (pausaInicio !== null && inicio < pausaFim && fim > pausaInicio) continue

    const conflita = ocupados.some(o => inicio < o.fim && fim > o.inicio)
    if (conflita) continue

    slots.push({ startTime: minutosParaHora(inicio), endTime: minutosParaHora(fim) })
  }

  return slots
}

// Soma minutos a um horário "HH:mm" e devolve o novo horário no mesmo formato.
export function somarMinutos(hhmm, minutos) {
  return minutosParaHora(horaParaMinutos(hhmm) + minutos)
}

// Soma dias a uma dataKey "AAAA-MM-DD" e devolve a nova dataKey.
// Usado para gerar as próximas datas de um agendamento recorrente semanal.
export function adicionarDias(dataKey, dias) {
  const [ano, mes, dia] = dataKey.split('-').map(Number)
  const d = new Date(ano, mes - 1, dia)
  d.setDate(d.getDate() + dias)
  return toDateKey(d)
}

export function formatarDataLegivel(date) {
  return new Date(date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

export const MOTIVOS_BLOQUEIO_DIA = {
  ferias: 'Férias',
  folga: 'Folga',
  nao_especificado: 'Não especificado'
}

export function diaDaSemana(dataKey) {
  const [ano, mes, dia] = dataKey.split('-').map(Number)
  return DIAS_SEMANA[new Date(ano, mes - 1, dia).getDay()]
}

export function formatarDataBR(dataKey) {
  if (!dataKey) return ''
  const [ano, mes, dia] = dataKey.split('-')
  return `${dia}/${mes}/${ano}`
}

export function formatarPreco(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Verifica se o horário de término de um agendamento já passou,
// combinando a data (AAAA-MM-DD) com a hora de término (HH:mm).
export function jaPassou(dataKey, horaFim) {
  if (!dataKey || !horaFim) return false
  const [ano, mes, dia] = dataKey.split('-').map(Number)
  const [h, m] = horaFim.split(':').map(Number)
  const momento = new Date(ano, mes - 1, dia, h, m)
  return momento.getTime() < Date.now()
}
