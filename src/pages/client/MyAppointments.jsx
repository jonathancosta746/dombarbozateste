import { useState } from 'react'
import { buscarAgendamentosPorTelefone, atualizarStatusAgendamento } from '../../utils/firebaseData'
import { formatarPreco, formatarDataBR } from '../../utils/time'
import TopBar from '../../components/TopBar'
import Reagendamento from '../../components/Reagendamento'

export default function MyAppointments() {
  const [telefone, setTelefone] = useState('')
  const [resultados, setResultados] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  const [reagendandoId, setReagendandoId] = useState(null)

  async function buscar(e) {
    e.preventDefault()
    if (!telefone.trim()) return
    setBuscando(true)
    setErro('')
    try {
      const lista = await buscarAgendamentosPorTelefone(telefone.trim())
      setResultados(lista)
    } catch (e) {
      setErro('Não foi possível buscar seus agendamentos agora. Tente novamente em instantes.')
      setResultados(null)
    } finally {
      setBuscando(false)
    }
  }

  async function cancelar(id) {
    await atualizarStatusAgendamento(id, 'cancelado')
    setResultados(r => r.map(a => a.id === id ? { ...a, status: 'cancelado' } : a))
  }

  function reagendado(id, novosDados) {
    setResultados(r => [...r.map(a => a.id === id ? { ...a, ...novosDados } : a)]
      .sort((a, b) => {
        const porData = b.date.localeCompare(a.date)
        return porData !== 0 ? porData : b.startTime.localeCompare(a.startTime)
      }))
    setReagendandoId(null)
  }

  return (
    <div className="app-shell">
      <TopBar titulo="Meus agendamentos" />
      <main>
        <form onSubmit={buscar}>
          <div className="field">
            <label htmlFor="tel">Telefone usado no agendamento</label>
            <input id="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(61) 90000-0000" inputMode="tel" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={buscando}>
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        {erro && <div className="error-text" style={{ marginTop: 10 }}>{erro}</div>}

        {resultados !== null && (
          <>
            <div className="section-title">Resultados</div>
            {resultados.length === 0 && <div className="empty-state">Nenhum agendamento encontrado para esse telefone.</div>}
            <div className="list-gap">
              {resultados.map(a => (
                <div key={a.id} className="card">
                  <div className="row-between">
                    <strong>{a.barberName}</strong>
                    <span className={`badge badge-${a.status}`}>{a.status}</span>
                  </div>
                  <div className="barber-meta" style={{ marginTop: 4 }}>
                    {a.serviceName} · {formatarDataBR(a.date)} às {a.startTime} · {formatarPreco(a.price)}
                  </div>
                  {a.status === 'confirmado' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setReagendandoId(id => id === a.id ? null : a.id)}
                      >
                        Reagendar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => cancelar(a.id)}>
                        Cancelar agendamento
                      </button>
                    </div>
                  )}
                  {a.status === 'confirmado' && reagendandoId === a.id && (
                    <Reagendamento
                      agendamento={a}
                      onCancelar={() => setReagendandoId(null)}
                      onConcluido={novosDados => reagendado(a.id, novosDados)}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
