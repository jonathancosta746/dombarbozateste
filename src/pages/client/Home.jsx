import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ouvirBarbeiros, buscarAgendamentosPorTelefone, atualizarStatusAgendamento } from '../../utils/firebaseData'
import { obterTelefoneSalvo } from '../../utils/clientSession'
import { formatarPreco, formatarDataBR, diaDaSemana, jaPassou } from '../../utils/time'
import Loader from '../../components/Loader'
import Reagendamento from '../../components/Reagendamento'

export default function Home() {
  const [barbeiros, setBarbeiros] = useState(null)
  const [proximoAgendamento, setProximoAgendamento] = useState(null)
  const [reagendando, setReagendando] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = ouvirBarbeiros(lista => setBarbeiros(lista.filter(b => b.active !== false)))
    return unsub
  }, [])

  useEffect(() => {
    const telefone = obterTelefoneSalvo()
    if (!telefone) return
    buscarAgendamentosPorTelefone(telefone).then(lista => {
      const futuros = lista
        .filter(a => a.status === 'confirmado' && !jaPassou(a.date, a.endTime))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      setProximoAgendamento(futuros[0] || null)
    })
  }, [])

  async function cancelar() {
    await atualizarStatusAgendamento(proximoAgendamento.id, 'cancelado')
    setProximoAgendamento(null)
  }

  return (
    <div className="app-shell">
      <div className="topbar topbar-centered">
        <img src="/logo.png" alt="Dom Barboza" className="brand-logo" />
      </div>

      <main>
        {proximoAgendamento && (
          <>
            <div className="section-title" style={{ marginTop: 0 }}>Seu próximo agendamento</div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="appointment-highlight">
                {diaDaSemana(proximoAgendamento.date)} · {formatarDataBR(proximoAgendamento.date)} às {proximoAgendamento.startTime}
              </div>
              <div className="appointment-highlight" style={{ marginTop: 2 }}>
                {proximoAgendamento.serviceName} · {formatarPreco(proximoAgendamento.price)}
              </div>
              <div className="barber-meta" style={{ marginTop: 6 }}>{proximoAgendamento.barberName}</div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setReagendando(v => !v)}>
                  Reagendar
                </button>
                <button className="btn btn-danger btn-sm" onClick={cancelar}>
                  Cancelar agendamento
                </button>
              </div>

              {reagendando && (
                <Reagendamento
                  agendamento={proximoAgendamento}
                  onCancelar={() => setReagendando(false)}
                  onConcluido={novoAgendamento => {
                    setProximoAgendamento(novoAgendamento)
                    setReagendando(false)
                  }}
                />
              )}
            </div>
          </>
        )}

        <div className="section-title">Escolha o barbeiro</div>

        {barbeiros === null && <Loader />}

        {barbeiros !== null && barbeiros.length === 0 && (
          <div className="empty-state">
            <div className="icon">✂️</div>
            Nenhum barbeiro disponível no momento.
          </div>
        )}

        <div className="barbeiros-grid">
          {barbeiros?.map(b => (
            <button
              key={b.id}
              className="barber-poster-card"
              onClick={() => navigate(`/agendar/${b.id}`)}
            >
              <div className="barber-poster-photo">
                {b.photoUrl ? <img src={b.photoUrl} alt={b.name} /> : <span>{b.name?.[0]}</span>}
              </div>
              <div className="barber-poster-name">{b.name}</div>
            </button>
          ))}
        </div>

        <div className="section-title">Já tem um horário marcado?</div>
        <Link to="/meus-agendamentos" className="btn btn-outline" style={{ display: 'flex' }}>
          Ver meus agendamentos
        </Link>
      </main>
    </div>
  )
}
