import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { buscarBarbeiroPorId, ouvirServicos, buscarAgendamentosPorBarbeiroEData, criarAgendamento, criarPedidoEncaixe, ouvirBloqueiosDiaPorBarbeiro } from '../../utils/firebaseData'
import { toDateKey, formatarDataLegivel, formatarPreco, gerarHorariosDisponiveis, DIAS_SEMANA } from '../../utils/time'
import TopBar from '../../components/TopBar'
import CalendarioMes from '../../components/CalendarioMes'
import Loader from '../../components/Loader'

export default function Booking() {
  const { barberId } = useParams()
  const navigate = useNavigate()

  const [barbeiro, setBarbeiro] = useState(undefined)
  const [servicos, setServicos] = useState(null)
  const [servicosSelecionados, setServicosSelecionados] = useState([])
  const [dataSelecionada, setDataSelecionada] = useState(null)
  const [horarios, setHorarios] = useState([])
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)
  const [horarioSelecionado, setHorarioSelecionado] = useState(null)
  const [pedidoEncaixe, setPedidoEncaixe] = useState(false)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState(null)
  const [encaixeConfirmado, setEncaixeConfirmado] = useState(null)
  const [diasBloqueados, setDiasBloqueados] = useState([])

  const dataMinima = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const dataMaxima = useMemo(() => {
    const d = new Date(dataMinima)
    d.setMonth(d.getMonth() + 2)
    return d
  }, [dataMinima])

  const duracaoTotal = useMemo(
    () => servicosSelecionados.reduce((soma, s) => soma + s.durationMin, 0),
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

  function alternarServico(servico) {
    setServicosSelecionados(atual => {
      const jaSelecionado = atual.some(s => s.id === servico.id)
      return jaSelecionado ? atual.filter(s => s.id !== servico.id) : [...atual, servico]
    })
  }

  useEffect(() => {
    buscarBarbeiroPorId(barberId).then(setBarbeiro)
  }, [barberId])

  useEffect(() => {
    const unsub = ouvirBloqueiosDiaPorBarbeiro(barberId, setDiasBloqueados)
    return unsub
  }, [barberId])

  useEffect(() => {
    const unsub = ouvirServicos(lista => {
      const doBarbeiro = lista.filter(s => s.active !== false && s.barberId === barberId)
      setServicos(doBarbeiro)
    })
    return unsub
  }, [barberId])

  useEffect(() => {
    if (!dataSelecionada || servicosSelecionados.length === 0 || !barbeiro) return
    setCarregandoHorarios(true)
    setHorarioSelecionado(null)
    setPedidoEncaixe(false)
    const dataKey = toDateKey(dataSelecionada)
    const diaSemana = dataSelecionada.getDay()
    const expedienteDia = barbeiro.workingHours?.[diaSemana]

    buscarAgendamentosPorBarbeiroEData(barberId, dataKey).then(agendamentos => {
      const slots = gerarHorariosDisponiveis({
        expedienteDia,
        duracaoServicoMin: duracaoTotal,
        agendamentosDoDia: agendamentos,
        dataKey
      })
      setHorarios(slots)
      setCarregandoHorarios(false)
    })
  }, [dataSelecionada, servicosSelecionados, duracaoTotal, barbeiro, barberId])

  function selecionarHorario(h) {
    setHorarioSelecionado(h)
    setPedidoEncaixe(false)
  }

  function selecionarEncaixe() {
    setPedidoEncaixe(true)
    setHorarioSelecionado(null)
  }

  async function confirmarAgendamento() {
    setErro('')
    if (!nome.trim() || !telefone.trim()) {
      setErro('Preencha nome e telefone para confirmar.')
      return
    }
    setEnviando(true)
    try {
      const dataKey = toDateKey(dataSelecionada)
      const dados = {
        barberId,
        barberName: barbeiro.name,
        serviceId: servicosSelecionados.map(s => s.id),
        serviceName: nomesServicos,
        services: servicosSelecionados.map(s => ({ id: s.id, name: s.name, price: s.price, durationMin: s.durationMin })),
        durationMin: duracaoTotal,
        price: precoTotal,
        date: dataKey,
        startTime: horarioSelecionado.startTime,
        endTime: horarioSelecionado.endTime,
        clientName: nome.trim(),
        clientPhone: telefone.trim()
      }
      await criarAgendamento(dados)
      setAgendamentoConfirmado(dados)
    } catch (e) {
      setErro('Não foi possível concluir o agendamento. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarPedidoEncaixe() {
    setErro('')
    if (!nome.trim() || !telefone.trim()) {
      setErro('Preencha nome e telefone para confirmar.')
      return
    }
    setEnviando(true)
    try {
      const dados = {
        barberId,
        barberName: barbeiro.name,
        serviceId: servicosSelecionados.map(s => s.id),
        serviceName: nomesServicos,
        services: servicosSelecionados.map(s => ({ id: s.id, name: s.name, price: s.price, durationMin: s.durationMin })),
        durationMin: duracaoTotal,
        price: precoTotal,
        date: toDateKey(dataSelecionada),
        clientName: nome.trim(),
        clientPhone: telefone.trim()
      }
      await criarPedidoEncaixe(dados)
      setEncaixeConfirmado(dados)
    } catch (e) {
      setErro('Não foi possível enviar o pedido de encaixe. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (barbeiro === undefined || servicos === null) {
    return <div className="app-shell"><Loader /></div>
  }

  if (barbeiro === null) {
    return (
      <div className="app-shell">
        <TopBar titulo="Não encontrado" />
        <main><div className="empty-state">Barbeiro não encontrado.</div></main>
      </div>
    )
  }

  if (agendamentoConfirmado) {
    return (
      <div className="app-shell">
        <TopBar titulo="Confirmado" voltar={false} />
        <main>
          <div className="ticket">
            <div className="eyebrow" style={{ marginBottom: 6 }}>Horário reservado</div>
            <div className="brand" style={{ fontSize: 24 }}>{barbeiro.name}</div>
            <div className="ticket-divider" />
            <div className="ticket-row"><span className="label">Serviço</span><span>{agendamentoConfirmado.serviceName}</span></div>
            <div className="ticket-row"><span className="label">Data</span><span>{DIAS_SEMANA[dataSelecionada.getDay()]}, {formatarDataLegivel(dataSelecionada)}</span></div>
            <div className="ticket-row"><span className="label">Horário</span><span>{agendamentoConfirmado.startTime}</span></div>
            <div className="ticket-row"><span className="label">Valor</span><span>{formatarPreco(agendamentoConfirmado.price)}</span></div>
            <div className="ticket-divider" />
            <div className="ticket-row"><span className="label">Cliente</span><span>{agendamentoConfirmado.clientName}</span></div>
            <div className="ticket-row"><span className="label">Telefone</span><span>{agendamentoConfirmado.clientPhone}</span></div>
          </div>
          <div style={{ height: 16 }} />
          <button className="btn btn-primary" onClick={() => navigate('/')}>Voltar ao início</button>
        </main>
      </div>
    )
  }

  if (encaixeConfirmado) {
    return (
      <div className="app-shell">
        <TopBar titulo="Pedido enviado" voltar={false} />
        <main>
          <div className="ticket">
            <div className="eyebrow" style={{ marginBottom: 6 }}>Pedido de encaixe</div>
            <div className="brand" style={{ fontSize: 24 }}>{barbeiro.name}</div>
            <div className="ticket-divider" />
            <div className="ticket-row"><span className="label">Serviço</span><span>{encaixeConfirmado.serviceName}</span></div>
            <div className="ticket-row"><span className="label">Data</span><span>{DIAS_SEMANA[dataSelecionada.getDay()]}, {formatarDataLegivel(dataSelecionada)}</span></div>
            <div className="ticket-row"><span className="label">Valor</span><span>{formatarPreco(encaixeConfirmado.price)}</span></div>
            <div className="ticket-divider" />
            <div className="ticket-row"><span className="label">Cliente</span><span>{encaixeConfirmado.clientName}</span></div>
            <div className="ticket-row"><span className="label">Telefone</span><span>{encaixeConfirmado.clientPhone}</span></div>
          </div>
          <div className="aviso-recorrente" style={{ marginTop: 16 }}>
            <span className="aviso-icone">📋</span>
            <span>Você entrou na lista de encaixe para esse dia. O barbeiro vai entrar em contato para combinar o horário.</span>
          </div>
          <div style={{ height: 16 }} />
          <button className="btn btn-primary" onClick={() => navigate('/')}>Voltar ao início</button>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <TopBar titulo={barbeiro.name} />
      <main>
        <div className="section-title">1. Serviço</div>
        <div className="list-gap">
          {servicos.length === 0 && <div className="empty-state">Nenhum serviço cadastrado para este barbeiro.</div>}
          {servicos.map(s => {
            const selecionado = servicosSelecionados.some(x => x.id === s.id)
            return (
              <button
                key={s.id}
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

        {servicosSelecionados.length > 0 && (
          <div className="aviso-recorrente">
            <span className="aviso-icone">🧾</span>
            <span>
              {servicosSelecionados.length} {servicosSelecionados.length === 1 ? 'serviço selecionado' : 'serviços selecionados'} ·{' '}
              {duracaoTotal} min · {formatarPreco(precoTotal)}
            </span>
          </div>
        )}

        {servicosSelecionados.length > 0 && (
          <>
            <div className="section-title">2. Data</div>

            <CalendarioMes
              dataMinima={dataMinima}
              dataMaxima={dataMaxima}
              dataSelecionada={dataSelecionada}
              onSelecionar={setDataSelecionada}
              diasBloqueados={diasBloqueados}
            />
          </>
        )}

        {dataSelecionada && (
          <>
            <div className="section-title">3. Horário</div>
            {carregandoHorarios && <Loader />}
            {!carregandoHorarios && horarios.length === 0 && (
              <div className="empty-state">Sem horários disponíveis neste dia.</div>
            )}
            {!carregandoHorarios && horarios.length > 0 && (
              <div className="slots-grid">
                {horarios.map(h => (
                  <button
                    key={h.startTime}
                    className={`slot-btn ${horarioSelecionado?.startTime === h.startTime ? 'selected' : ''}`}
                    onClick={() => selecionarHorario(h)}
                  >
                    {h.startTime}
                  </button>
                ))}
              </div>
            )}

            {!carregandoHorarios && (
              <button
                type="button"
                className={pedidoEncaixe ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                style={{ marginTop: 12 }}
                onClick={selecionarEncaixe}
              >
                {pedidoEncaixe ? 'Encaixe selecionado' : 'Pedir encaixe'}
              </button>
            )}

            <div className="aviso-recorrente">
              <span className="aviso-icone">✂️</span>
              <span>
                Quer um corte recorrente (toda semana, a cada 10 ou 15 dias, por exemplo)?
                Combine direto com o barbeiro no dia do atendimento para configurar o agendamento recorrente.
              </span>
            </div>
          </>
        )}

        {(horarioSelecionado || pedidoEncaixe) && (
          <>
            <div className="section-title">4. Seus dados</div>
            <div className="field">
              <label htmlFor="nome">Nome</label>
              <input id="nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="field">
              <label htmlFor="telefone">Telefone (WhatsApp)</label>
              <input id="telefone" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(61) 90000-0000" inputMode="tel" />
            </div>

            {pedidoEncaixe && (
              <div className="aviso-recorrente">
                <span className="aviso-icone">📋</span>
                <span>Você entrará na lista de encaixe e o barbeiro entrará em contato para combinar o horário.</span>
              </div>
            )}

            {erro && <div className="error-text">{erro}</div>}
          </>
        )}
      </main>

      {(horarioSelecionado || pedidoEncaixe) && (
        <div className="btn-fixed-bottom">
          {horarioSelecionado && (
            <button className="btn btn-primary" onClick={confirmarAgendamento} disabled={enviando}>
              {enviando ? 'Confirmando...' : `Confirmar às ${horarioSelecionado.startTime}`}
            </button>
          )}
          {pedidoEncaixe && (
            <button className="btn btn-primary" onClick={confirmarPedidoEncaixe} disabled={enviando}>
              {enviando ? 'Enviando...' : 'Pedir encaixe'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
