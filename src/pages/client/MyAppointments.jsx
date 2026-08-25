import { useEffect, useState } from 'react'
import {
  buscarAgendamentosPorTelefone, atualizarStatusAgendamento,
  buscarClientePorTelefone, salvarCliente
} from '../../utils/firebaseData'
import { obterTelefoneSalvo, salvarTelefoneCliente, limparTelefoneCliente } from '../../utils/clientSession'
import { formatarPreco, formatarDataBR, diaDaSemana } from '../../utils/time'
import TopBar from '../../components/TopBar'
import Reagendamento from '../../components/Reagendamento'

export default function MyAppointments() {
  const [telefone, setTelefone] = useState('')
  const [resultados, setResultados] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  const [reagendandoId, setReagendandoId] = useState(null)
  const [nomeCliente, setNomeCliente] = useState('')
  const [salvandoNome, setSalvandoNome] = useState(false)
  const [nomeSalvo, setNomeSalvo] = useState(false)

  async function buscarPorTelefone(tel) {
    setBuscando(true)
    setErro('')
    setNomeSalvo(false)
    try {
      const [lista, cliente] = await Promise.all([
        buscarAgendamentosPorTelefone(tel),
        buscarClientePorTelefone(tel)
      ])
      setResultados(lista)
      setNomeCliente(cliente?.name || lista[0]?.clientName || '')
    } catch (e) {
      setErro('Não foi possível buscar seus agendamentos agora. Tente novamente em instantes.')
      setResultados(null)
    } finally {
      setBuscando(false)
    }
  }

  // Se o telefone já foi salvo em um agendamento anterior neste navegador,
  // busca automaticamente para o cliente já entrar "logado".
  useEffect(() => {
    const salvo = obterTelefoneSalvo()
    if (!salvo) return
    setTelefone(salvo)
    buscarPorTelefone(salvo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buscar(e) {
    e.preventDefault()
    if (!telefone.trim()) return
    await buscarPorTelefone(telefone.trim())
    salvarTelefoneCliente(telefone.trim())
  }

  function sair() {
    limparTelefoneCliente()
    setTelefone('')
    setResultados(null)
    setNomeCliente('')
    setErro('')
    setReagendandoId(null)
    setNomeSalvo(false)
  }

  async function salvarNomeCliente() {
    if (!nomeCliente.trim()) return
    setSalvandoNome(true)
    setNomeSalvo(false)
    try {
      await salvarCliente(telefone.trim(), nomeCliente.trim())
      setNomeSalvo(true)
    } finally {
      setSalvandoNome(false)
    }
  }

  async function cancelar(id) {
    await atualizarStatusAgendamento(id, 'cancelado')
    setResultados(r => r.map(a => a.id === id ? { ...a, status: 'cancelado' } : a))
  }

  function reagendado(id, novoAgendamento) {
    setResultados(r => [
      ...r.map(a => a.id === id
        ? { ...a, status: 'remarcado', remarcadoPara: { date: novoAgendamento.date, startTime: novoAgendamento.startTime } }
        : a),
      novoAgendamento
    ].sort((a, b) => {
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
            <div className="section-title">Seu nome</div>
            <div className="field">
              <label htmlFor="nome-cliente">Nome atrelado a esse telefone</label>
              <input
                id="nome-cliente"
                value={nomeCliente}
                onChange={e => { setNomeCliente(e.target.value); setNomeSalvo(false) }}
                placeholder="Seu nome"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn btn-outline btn-sm" onClick={salvarNomeCliente} disabled={salvandoNome || !nomeCliente.trim()}>
                {salvandoNome ? 'Salvando...' : 'Salvar nome'}
              </button>
              {nomeSalvo && <span style={{ fontSize: 13, color: 'var(--green)' }}>Nome salvo.</span>}
            </div>

            <div className="row-between">
              <div className="section-title" style={{ margin: 0 }}>Resultados</div>
              <button className="btn btn-outline btn-sm" onClick={sair}>Sair</button>
            </div>
            {resultados.length === 0 && <div className="empty-state">Nenhum agendamento encontrado para esse telefone.</div>}
            <div className="list-gap">
              {resultados.map(a => (
                <div key={a.id} className="card">
                  <div className="row-between">
                    <span className="appointment-highlight">
                      {diaDaSemana(a.date)} · {formatarDataBR(a.date)} às {a.startTime}
                    </span>
                    <span className={`badge badge-${a.status}`}>{a.status}</span>
                  </div>
                  <div className="appointment-highlight" style={{ marginTop: 2 }}>
                    {a.serviceName} · {formatarPreco(a.price)}
                  </div>
                  <div className="barber-meta" style={{ marginTop: 6 }}>{a.barberName}</div>
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
                      onConcluido={novoAgendamento => reagendado(a.id, novoAgendamento)}
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
