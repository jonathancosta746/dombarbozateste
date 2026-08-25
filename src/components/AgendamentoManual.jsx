import { useEffect, useMemo, useState } from 'react'
import { ouvirServicos, criarAgendamento, buscarAgendamentosPorBarbeiroEData } from '../utils/firebaseData'
import { formatarPreco, somarMinutos, adicionarDias, formatarDataBR } from '../utils/time'
import { useClientePorTelefone } from '../hooks/useClientePorTelefone'
import Loader from './Loader'

const DURACAO_PADRAO_MIN = 60
// Sem tela pedindo "repetir por quantas semanas": ao marcar recorrente, já
// agenda cerca de 1 ano de ocorrências à frente (pulando dias ocupados/
// bloqueados). O barbeiro encerra a série quando quiser, cancelando-a no
// card do agendamento. `ocorrencias` é calculado para cobrir ~1 ano em
// cada intervalo (52 semanas ou 26 quinzenas).
const INTERVALOS_RECORRENCIA = [
  { dias: 7, ocorrencias: 52, label: 'Repetir toda semana (corte recorrente)', descricao: 'toda semana' },
  { dias: 14, ocorrencias: 26, label: 'Repetir semana sim, semana não (corte recorrente)', descricao: 'a cada duas semanas' }
]

function gerarRecurringId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Formulário usado pelo barbeiro na Agenda para agendar um cliente direto em
// um horário vago (cliente que ligou, mandou mensagem ou chegou na barbearia).
// Reaproveita os mesmos campos do fluxo do cliente: serviços, nome e telefone.
// Também permite marcar como corte recorrente, repetindo o mesmo horário toda
// semana. O telefone vem primeiro: ao sair do campo, busca o nome já
// cadastrado para esse número e preenche automaticamente.
export default function AgendamentoManual({
  barberId, barberName, dataKey, slot, expedienteDia, agendamentosDoDia, bloqueiosDia,
  onConcluido, onCancelar
}) {
  const [servicos, setServicos] = useState(null)
  const [servicosSelecionados, setServicosSelecionados] = useState([])
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const { buscando: buscandoCliente, naoEncontrado: clienteNaoEncontrado } = useClientePorTelefone(telefone, setNome)
  const [intervaloRecorrencia, setIntervaloRecorrencia] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [progresso, setProgresso] = useState(null)
  const [erro, setErro] = useState('')
  const [pulados, setPulados] = useState(null)

  useEffect(() => {
    const unsub = ouvirServicos(lista => {
      setServicos(lista.filter(s => s.active !== false && s.barberId === barberId))
    })
    return unsub
  }, [barberId])

  const duracaoTotal = useMemo(
    () => servicosSelecionados.reduce((soma, s) => soma + s.durationMin, 0) || DURACAO_PADRAO_MIN,
    [servicosSelecionados]
  )
  const precoTotal = useMemo(
    () => servicosSelecionados.reduce((soma, s) => soma + s.price, 0),
    [servicosSelecionados]
  )
  const nomesServicos = useMemo(
    () => servicosSelecionados.map(s => s.name).join(', '),
    [servicosSelecionados]
  )

  // O horário vago vem sempre em blocos de 1h; se os serviços escolhidos
  // somarem mais que isso, o atendimento avança sobre os blocos seguintes.
  const horaFim = somarMinutos(slot.startTime, duracaoTotal)

  // Comparar "HH:mm" como texto funciona porque as horas são sempre com dois dígitos.
  const passaDoExpediente = !!expedienteDia?.end && horaFim > expedienteDia.end
  const caiNaPausa = !!expedienteDia?.breakStart && !!expedienteDia?.breakEnd
    && slot.startTime < expedienteDia.breakEnd && horaFim > expedienteDia.breakStart
  const conflito = (agendamentosDoDia || [])
    .filter(a => a.status !== 'cancelado' && a.status !== 'remarcado')
    .find(a => slot.startTime < a.endTime && horaFim > a.startTime)

  const impedimento = passaDoExpediente
    ? `O atendimento terminaria às ${horaFim}, depois do fim do expediente (${expedienteDia.end}).`
    : caiNaPausa
      ? `O atendimento terminaria às ${horaFim} e invade o intervalo (${expedienteDia.breakStart} – ${expedienteDia.breakEnd}).`
      : conflito
        ? `O atendimento terminaria às ${horaFim} e conflita com ${conflito.startTime} · ${conflito.clientName}.`
        : ''

  async function confirmar() {
    setErro('')
    if (!nome.trim() || !telefone.trim()) {
      setErro('Preencha nome e telefone do cliente.')
      return
    }
    if (impedimento) {
      setErro(impedimento)
      return
    }
    setSalvando(true)
    try {
      const dadosBase = {
        barberId,
        barberName,
        serviceId: servicosSelecionados.map(s => s.id),
        serviceName: nomesServicos || 'Atendimento',
        services: servicosSelecionados.map(s => ({
          id: s.id, name: s.name, price: s.price, durationMin: s.durationMin
        })),
        durationMin: duracaoTotal,
        price: precoTotal,
        startTime: slot.startTime,
        endTime: horaFim,
        clientName: nome.trim(),
        clientPhone: telefone.trim(),
        criadoPeloBarbeiro: true
      }

      if (!intervaloRecorrencia) {
        await criarAgendamento({ ...dadosBase, date: dataKey })
        onConcluido()
        return
      }

      // Cria um agendamento a cada `intervaloRecorrencia.dias`, cobrindo
      // cerca de 1 ano à frente. A primeira ocorrência é o próprio slot já
      // validado acima; as seguintes são checadas uma a uma (dia bloqueado
      // ou horário ocupado). O barbeiro não precisa dizer quando parar:
      // quando quiser encerrar, cancela a série pelo card do agendamento.
      const recurringId = gerarRecurringId()
      const puladosLista = []
      const { dias: intervaloDias, ocorrencias: totalOcorrencias } = intervaloRecorrencia

      for (let indice = 0; indice < totalOcorrencias; indice++) {
        const dataDaOcorrencia = indice === 0 ? dataKey : adicionarDias(dataKey, indice * intervaloDias)
        const dadosOcorrencia = { ...dadosBase, date: dataDaOcorrencia, recurringId, recurringWeekIndex: indice }
        setProgresso({ atual: indice + 1, total: totalOcorrencias })

        if (indice === 0) {
          await criarAgendamento(dadosOcorrencia)
          continue
        }

        if ((bloqueiosDia || []).some(b => b.date === dataDaOcorrencia)) {
          puladosLista.push({ data: dataDaOcorrencia, motivo: 'dia bloqueado' })
          continue
        }

        const agendamentosDaOcorrencia = await buscarAgendamentosPorBarbeiroEData(barberId, dataDaOcorrencia)
        const conflitoOcorrencia = agendamentosDaOcorrencia
          .filter(a => a.status !== 'cancelado' && a.status !== 'remarcado')
          .find(a => slot.startTime < a.endTime && horaFim > a.startTime)

        if (conflitoOcorrencia) {
          puladosLista.push({ data: dataDaOcorrencia, motivo: `conflito com ${conflitoOcorrencia.startTime} · ${conflitoOcorrencia.clientName}` })
          continue
        }

        await criarAgendamento(dadosOcorrencia)
      }

      if (puladosLista.length > 0) {
        setPulados(puladosLista)
        setSalvando(false)
        setProgresso(null)
      } else {
        onConcluido()
      }
    } catch (e) {
      setErro('Não foi possível agendar. Tente novamente.')
      setSalvando(false)
      setProgresso(null)
    }
  }

  function alternarServico(servico) {
    setServicosSelecionados(atual => {
      const jaSelecionado = atual.some(s => s.id === servico.id)
      return jaSelecionado ? atual.filter(s => s.id !== servico.id) : [...atual, servico]
    })
  }

  if (pulados) {
    const criadas = intervaloRecorrencia.ocorrencias - pulados.length
    const mostrar = pulados.slice(0, 10)
    return (
      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Corte recorrente agendado</div>
        <div className="aviso-recorrente">
          <span className="aviso-icone">🔁</span>
          <span>
            {criadas} datas agendadas para {nome.trim()}, {intervaloRecorrencia.descricao} às {slot.startTime}.
            Cancele a série quando quiser pelo card do agendamento.
          </span>
        </div>
        {pulados.length > 0 && (
          <>
            <div className="section-title">Datas que precisam ser combinadas manualmente</div>
            <div className="list-gap">
              {mostrar.map(p => (
                <div key={p.data} className="card">
                  <div className="row-between">
                    <span>{formatarDataBR(p.data)}</span>
                    <span className="badge badge-cancelado">pulado</span>
                  </div>
                  <div className="barber-meta" style={{ marginTop: 4 }}>{p.motivo}</div>
                </div>
              ))}
              {pulados.length > mostrar.length && (
                <div className="empty-state">+{pulados.length - mostrar.length} outras datas puladas</div>
              )}
            </div>
          </>
        )}
        <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={onConcluido}>
          Fechar
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <div className="section-title" style={{ marginTop: 0 }}>Serviço</div>

      {servicos === null && <Loader />}
      {servicos !== null && servicos.length === 0 && (
        <div className="empty-state">
          Nenhum procedimento cadastrado. O agendamento será criado como “Atendimento” de {DURACAO_PADRAO_MIN} min.
        </div>
      )}

      <div className="list-gap">
        {servicos?.map(s => {
          const selecionado = servicosSelecionados.some(x => x.id === s.id)
          return (
            <button
              key={s.id}
              type="button"
              className={`service-row ${selecionado ? 'selected' : ''}`}
              onClick={() => alternarServico(s)}
            >
              <div className="service-info">
                <span>{selecionado ? '✓ ' : ''}{s.name}</span>
                <span className="service-duration">{s.durationMin} min</span>
              </div>
              <span className="service-price">{formatarPreco(s.price)}</span>
            </button>
          )
        })}
      </div>

      <div className="aviso-recorrente">
        <span className="aviso-icone">🕒</span>
        <span>
          {slot.startTime} – {horaFim} · {duracaoTotal} min · {formatarPreco(precoTotal)}
        </span>
      </div>

      {impedimento && (
        <div className="aviso-recorrente">
          <span className="aviso-icone">⚠️</span>
          <span>{impedimento}</span>
        </div>
      )}

      <div className="section-title">Dados do cliente</div>
      <div className="field">
        <label htmlFor={`telefone-${slot.startTime}`}>Telefone (WhatsApp)</label>
        <input
          id={`telefone-${slot.startTime}`}
          value={telefone}
          onChange={e => setTelefone(e.target.value)}
          placeholder="(61) 90000-0000"
          inputMode="tel"
        />
      </div>
      <div className="field">
        <label htmlFor={`nome-${slot.startTime}`}>Nome</label>
        <input
          id={`nome-${slot.startTime}`}
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder={
            buscandoCliente
              ? 'Buscando cliente...'
              : clienteNaoEncontrado
                ? 'Sem cliente encontrado. Qual nome do Cliente?'
                : 'Nome do cliente'
          }
        />
      </div>

      {INTERVALOS_RECORRENCIA.map(intervalo => (
        <label key={intervalo.dias} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginTop: 4 }}>
          <input
            type="checkbox"
            checked={intervaloRecorrencia?.dias === intervalo.dias}
            onChange={e => setIntervaloRecorrencia(e.target.checked ? intervalo : null)}
          />
          {intervalo.label}
        </label>
      ))}

      {intervaloRecorrencia && (
        <div className="aviso-recorrente">
          <span className="aviso-icone">🔁</span>
          <span>Agenda as próximas datas automaticamente. Cancele a série quando quiser, pelo card do agendamento.</span>
        </div>
      )}

      {erro && <div className="error-text">{erro}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={confirmar}
          disabled={salvando || !!impedimento}
        >
          {salvando
            ? (progresso ? `Agendando ${progresso.atual}/${progresso.total}...` : 'Agendando...')
            : (intervaloRecorrencia ? 'Confirmar corte recorrente' : `Confirmar às ${slot.startTime}`)}
        </button>
        <button className="btn btn-outline btn-sm" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
