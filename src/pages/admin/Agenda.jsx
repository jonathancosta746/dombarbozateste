import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  ouvirBarbeiros, ouvirAgendamentosPorBarbeiroEData,
  atualizarStatusAgendamento, criarAgendamento, removerAgendamento,
  ouvirBloqueiosDiaPorBarbeiro, criarBloqueioDia, removerBloqueioDia,
  ouvirPedidosEncaixePorBarbeiroEData, concluirPedidoEncaixe,
  cancelarSerieRecorrente
} from '../../utils/firebaseData'
import { toDateKey, gerarHorariosDisponiveis, formatarPreco, formatarDataBR, diaDaSemana, jaPassou, MOTIVOS_BLOQUEIO_DIA } from '../../utils/time'
import { linkWhatsapp } from '../../utils/whatsapp'
import { useAuth } from '../../context/AuthContext'
import CalendarioMes from '../../components/CalendarioMes'
import Reagendamento from '../../components/Reagendamento'
import AgendamentoManual from '../../components/AgendamentoManual'
import Loader from '../../components/Loader'

const DURACAO_SLOT_MIN = 60 // horários (livres, vagos e bloqueios) sempre em blocos de 1h

export default function Agenda() {
  const { barberId: meuBarberId, isAdmin } = useAuth()
  const [barbeiros, setBarbeiros] = useState(null)
  const [barberId, setBarberId] = useState('')
  const dataMinima = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const [dataSelecionada, setDataSelecionada] = useState(dataMinima)
  const [agendamentos, setAgendamentos] = useState(null)
  const [encaixes, setEncaixes] = useState(null)
  const [encaixeAberto, setEncaixeAberto] = useState(false)
  const [concluindoEncaixeId, setConcluindoEncaixeId] = useState(null)
  const [bloqueando, setBloqueando] = useState(null)
  const [bloqueiosDia, setBloqueiosDia] = useState([])
  const [mostrarFormBloqueioDia, setMostrarFormBloqueioDia] = useState(false)
  const [motivoSelecionado, setMotivoSelecionado] = useState('nao_especificado')
  const [reagendandoId, setReagendandoId] = useState(null)
  const [agendandoSlot, setAgendandoSlot] = useState(null)
  const [cancelandoSerieId, setCancelandoSerieId] = useState(null)

  const dataMaxima = useMemo(() => {
    const d = new Date(dataMinima)
    d.setMonth(d.getMonth() + 2)
    return d
  }, [dataMinima])

  useEffect(() => {
    const unsub = ouvirBarbeiros(lista => {
      setBarbeiros(lista)
      if (!isAdmin) {
        setBarberId(meuBarberId)
      } else if (!barberId && lista.length > 0) {
        setBarberId(lista[0].id)
      }
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, meuBarberId])

  useEffect(() => {
    if (!barberId || !dataSelecionada) {
      setAgendamentos(null)
      return
    }
    const unsub = ouvirAgendamentosPorBarbeiroEData(barberId, toDateKey(dataSelecionada), lista => {
      setAgendamentos(lista.sort((a, b) => a.startTime.localeCompare(b.startTime)))
    })
    return unsub
  }, [barberId, dataSelecionada])

  useEffect(() => {
    if (!barberId || !dataSelecionada) {
      setEncaixes(null)
      return
    }
    const unsub = ouvirPedidosEncaixePorBarbeiroEData(barberId, toDateKey(dataSelecionada), lista => {
      // Pendentes primeiro; dentro de cada grupo, mais recentes primeiro.
      setEncaixes(lista.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'pendente' ? -1 : 1
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
      }))
    })
    return unsub
  }, [barberId, dataSelecionada])

  useEffect(() => {
    if (!barberId) { setBloqueiosDia([]); return }
    const unsub = ouvirBloqueiosDiaPorBarbeiro(barberId, setBloqueiosDia)
    return unsub
  }, [barberId])

  useEffect(() => {
    setMostrarFormBloqueioDia(false)
    setMotivoSelecionado('nao_especificado')
    setReagendandoId(null)
    setAgendandoSlot(null)
    setConcluindoEncaixeId(null)
    setEncaixeAberto(false)
  }, [dataSelecionada, barberId])

  const bloqueioDoDia = dataSelecionada
    ? bloqueiosDia.find(b => b.date === toDateKey(dataSelecionada))
    : null

  const encaixesPendentes = (encaixes || []).filter(e => e.status !== 'concluido').length

  const barbeiroAtual = barbeiros?.find(b => b.id === barberId)

  const expedienteDia = dataSelecionada
    ? barbeiroAtual?.workingHours?.[dataSelecionada.getDay()]
    : null

  const horariosVagos = useMemo(() => {
    if (!barbeiroAtual || !dataSelecionada) return []
    return gerarHorariosDisponiveis({
      expedienteDia,
      duracaoServicoMin: DURACAO_SLOT_MIN,
      agendamentosDoDia: agendamentos || [],
      dataKey: toDateKey(dataSelecionada)
    })
  }, [barbeiroAtual, dataSelecionada, agendamentos])

  function statusExibido(a) {
    if (a.status === 'bloqueado') return 'bloqueado'
    if (a.status === 'cancelado') return 'cancelado'
    if (a.status === 'remarcado') return 'remarcado'
    if (jaPassou(a.date, a.endTime)) return 'concluido'
    return 'confirmado'
  }

  async function bloquearHorario(slot) {
    setBloqueando(slot.startTime)
    try {
      await criarAgendamento({
        barberId,
        barberName: barbeiroAtual?.name,
        date: toDateKey(dataSelecionada),
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: 'bloqueado',
        clientName: 'Horário bloqueado',
        clientPhone: '',
        serviceName: 'Bloqueio manual',
        durationMin: DURACAO_SLOT_MIN,
        price: 0
      })
    } finally {
      setBloqueando(null)
    }
  }

  async function confirmarBloqueioDia() {
    await criarBloqueioDia({ barberId, date: toDateKey(dataSelecionada), reason: motivoSelecionado })
    setMostrarFormBloqueioDia(false)
  }

  async function desbloquearDia() {
    if (bloqueioDoDia) await removerBloqueioDia(bloqueioDoDia.id)
  }

  async function cancelarSerie(a) {
    if (!confirm('Cancelar este e todos os agendamentos futuros dessa série recorrente?')) return
    setCancelandoSerieId(a.id)
    try {
      await cancelarSerieRecorrente(a.recurringId, a.date)
    } finally {
      setCancelandoSerieId(null)
    }
  }

  async function concluirEncaixe(id) {
    setConcluindoEncaixeId(id)
    try {
      await concluirPedidoEncaixe(id)
    } finally {
      setConcluindoEncaixeId(null)
    }
  }

  if (barbeiros === null) return <Loader />

  if (barbeiros.length === 0) {
    return <div className="empty-state">Cadastre um barbeiro para ver a agenda.</div>
  }

  return (
    <div>
      {isAdmin ? (
        <div className="field">
          <label htmlFor="barbeiro">Barbeiro</label>
          <select
            id="barbeiro"
            value={barberId}
            onChange={e => { setBarberId(e.target.value); setDataSelecionada(dataMinima) }}
          >
            {barbeiros.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      ) : (
        <div className="section-title" style={{ marginTop: 0 }}>Minha agenda</div>
      )}

      <CalendarioMes
        dataMinima={dataMinima}
        dataMaxima={dataMaxima}
        dataSelecionada={dataSelecionada}
        onSelecionar={setDataSelecionada}
      />

      {dataSelecionada && (
        <div className="calendar-info">{horariosVagos.length} horário{horariosVagos.length === 1 ? '' : 's'} livre{horariosVagos.length === 1 ? '' : 's'}</div>
      )}

      {dataSelecionada && bloqueioDoDia && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="row-between">
            <strong>Dia bloqueado</strong>
            <span className="badge badge-bloqueado">{MOTIVOS_BLOQUEIO_DIA[bloqueioDoDia.reason] || 'sem motivo'}</span>
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={desbloquearDia}>
            Desbloquear dia
          </button>
        </div>
      )}

      {dataSelecionada && !bloqueioDoDia && !mostrarFormBloqueioDia && (
        <button
          className="btn btn-outline btn-sm"
          style={{ marginTop: 10 }}
          onClick={() => setMostrarFormBloqueioDia(true)}
        >
          Bloquear dia
        </button>
      )}

      {dataSelecionada && !bloqueioDoDia && mostrarFormBloqueioDia && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="section-title" style={{ marginTop: 0 }}>Motivo do bloqueio</div>
          <div className="list-gap">
            {Object.entries(MOTIVOS_BLOQUEIO_DIA).map(([valor, rotulo]) => (
              <label key={valor} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input
                  type="radio"
                  name="motivo-bloqueio"
                  checked={motivoSelecionado === valor}
                  onChange={() => setMotivoSelecionado(valor)}
                />
                {rotulo}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary btn-sm" onClick={confirmarBloqueioDia}>Confirmar bloqueio</button>
            <button className="btn btn-outline btn-sm" onClick={() => setMostrarFormBloqueioDia(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {dataSelecionada && !bloqueioDoDia && (
        <>
          <button
            type="button"
            className="section-toggle"
            onClick={() => setEncaixeAberto(v => !v)}
            aria-expanded={encaixeAberto}
          >
            <span className="section-title">Pedidos de encaixe</span>
            <span className="section-toggle-right">
              {!encaixeAberto && encaixesPendentes > 0 && (
                <span className="section-toggle-count">{encaixesPendentes}</span>
              )}
              <span className="section-toggle-chevron">{encaixeAberto ? '▲' : '▼'}</span>
            </span>
          </button>

          {encaixeAberto && (
            <>
              {encaixes === null && <Loader />}
              {encaixes !== null && encaixes.length === 0 && (
                <div className="empty-state">Nenhum pedido de encaixe para este dia.</div>
              )}

              <div className="list-gap">
                {encaixes?.map(e => {
                  const concluido = e.status === 'concluido'
                  const wpp = linkWhatsapp(e.clientPhone)
                  return (
                    <div key={e.id} className={`card card-encaixe ${concluido ? 'card-resolvido' : ''}`}>
                      <div className="row-between">
                        <strong>{e.clientName}</strong>
                        {concluido && <span className="badge badge-concluido">concluído</span>}
                      </div>
                      <div className="barber-meta" style={{ marginTop: 4 }}>
                        {e.serviceName} · {formatarPreco(e.price)} · {e.clientPhone}
                      </div>
                      {!concluido && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          {wpp && (
                            <a className="btn btn-whatsapp btn-sm" href={wpp} target="_blank" rel="noopener noreferrer">
                              WhatsApp
                            </a>
                          )}
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => concluirEncaixe(e.id)}
                            disabled={concluindoEncaixeId === e.id}
                          >
                            {concluindoEncaixeId === e.id ? 'Concluindo...' : 'Concluir'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <div className="section-title">Agendamentos do dia</div>

          {agendamentos === null && <Loader />}
          {agendamentos !== null && agendamentos.length === 0 && (
            <div className="empty-state">Nenhum agendamento para este dia.</div>
          )}

          <div className="list-gap">
            {agendamentos?.map(a => {
              const status = statusExibido(a)
              const wpp = linkWhatsapp(a.clientPhone)

              if (status === 'remarcado') {
                const horarioLiberado = horariosVagos.find(h => h.startTime === a.startTime)
                return (
                  <Fragment key={a.id}>
                    <div className="card card-remarcado">
                      <div className="row-between">
                        <strong>{a.startTime} · {a.clientName}</strong>
                        <span className="badge badge-remarcado">remarcado</span>
                      </div>
                      <div className="barber-meta" style={{ marginTop: 4 }}>
                        {a.serviceName} · {formatarPreco(a.price)} · {a.clientPhone}
                      </div>
                      {a.remarcadoPara && (
                        <div className="barber-meta" style={{ marginTop: 4 }}>
                          Remarcado para {diaDaSemana(a.remarcadoPara.date)}, {formatarDataBR(a.remarcadoPara.date)} às {a.remarcadoPara.startTime}
                        </div>
                      )}
                    </div>

                    {horarioLiberado && (
                      <div className="card">
                        <div className="row-between">
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                            {horarioLiberado.startTime} – {horarioLiberado.endTime} · horário liberado
                          </span>
                          <button
                            className={agendandoSlot === horarioLiberado.startTime ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}
                            onClick={() => setAgendandoSlot(atual => atual === horarioLiberado.startTime ? null : horarioLiberado.startTime)}
                          >
                            {agendandoSlot === horarioLiberado.startTime ? 'Fechar' : 'Agendar'}
                          </button>
                        </div>

                        {agendandoSlot === horarioLiberado.startTime && (
                          <AgendamentoManual
                            barberId={barberId}
                            barberName={barbeiroAtual?.name}
                            dataKey={toDateKey(dataSelecionada)}
                            slot={horarioLiberado}
                            expedienteDia={expedienteDia}
                            agendamentosDoDia={agendamentos || []}
                            bloqueiosDia={bloqueiosDia}
                            onConcluido={() => setAgendandoSlot(null)}
                            onCancelar={() => setAgendandoSlot(null)}
                          />
                        )}
                      </div>
                    )}
                  </Fragment>
                )
              }

              return (
                <div key={a.id} className={`card ${status === 'concluido' ? 'card-passado' : ''}`}>
                  <div className="row-between">
                    <strong>{a.startTime} · {a.clientName}</strong>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {a.recurringId && <span className="badge badge-recorrente">🔁 recorrente</span>}
                      {status !== 'confirmado' && (
                        <span className={`badge badge-${status}`}>{status}</span>
                      )}
                    </div>
                  </div>
                  {status !== 'bloqueado' && (
                    <div className="barber-meta" style={{ marginTop: 4 }}>
                      {a.serviceName} · {formatarPreco(a.price)} · {a.clientPhone}
                    </div>
                  )}

                  {(status === 'confirmado' || status === 'concluido') && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      {wpp && (
                        <a className="btn btn-whatsapp btn-sm" href={wpp} target="_blank" rel="noopener noreferrer">
                          WhatsApp
                        </a>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setReagendandoId(id => id === a.id ? null : a.id)}
                      >
                        Reagendar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => atualizarStatusAgendamento(a.id, 'cancelado')}>
                        Cancelar
                      </button>
                      {a.recurringId && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => cancelarSerie(a)}
                          disabled={cancelandoSerieId === a.id}
                        >
                          {cancelandoSerieId === a.id ? 'Cancelando série...' : 'Cancelar série'}
                        </button>
                      )}
                    </div>
                  )}
                  {(status === 'confirmado' || status === 'concluido') && reagendandoId === a.id && (
                    <Reagendamento
                      agendamento={a}
                      onCancelar={() => setReagendandoId(null)}
                      onConcluido={() => setReagendandoId(null)}
                    />
                  )}
                  {status === 'bloqueado' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => removerAgendamento(a.id)}>
                        Desbloquear
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="section-title">Horários vagos</div>

          {agendamentos === null && <Loader />}
          {agendamentos !== null && horariosVagos.length === 0 && (
            <div className="empty-state">Nenhum horário vago neste dia.</div>
          )}

          <div className="list-gap">
            {horariosVagos.map(h => (
              <div key={h.startTime} className="card">
                <div className="row-between">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{h.startTime} – {h.endTime}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={agendandoSlot === h.startTime ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}
                      onClick={() => setAgendandoSlot(atual => atual === h.startTime ? null : h.startTime)}
                    >
                      {agendandoSlot === h.startTime ? 'Fechar' : 'Agendar'}
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => bloquearHorario(h)}
                      disabled={bloqueando === h.startTime}
                    >
                      {bloqueando === h.startTime ? 'Bloqueando...' : 'Bloquear'}
                    </button>
                  </div>
                </div>

                {agendandoSlot === h.startTime && (
                  <AgendamentoManual
                    barberId={barberId}
                    barberName={barbeiroAtual?.name}
                    dataKey={toDateKey(dataSelecionada)}
                    slot={h}
                    expedienteDia={expedienteDia}
                    agendamentosDoDia={agendamentos || []}
                    bloqueiosDia={bloqueiosDia}
                    onConcluido={() => setAgendandoSlot(null)}
                    onCancelar={() => setAgendandoSlot(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
