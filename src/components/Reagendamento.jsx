import { useEffect, useMemo, useState } from 'react'
import {
  buscarBarbeiroPorId, buscarAgendamentosPorBarbeiroEData,
  ouvirBloqueiosDiaPorBarbeiro, reagendarAgendamento
} from '../utils/firebaseData'
import { toDateKey, gerarHorariosDisponiveis } from '../utils/time'
import CalendarioMes from './CalendarioMes'
import Loader from './Loader'

// Formulário de reagendamento: escolhe uma nova data/horário para um
// agendamento já existente, reaproveitando o mesmo calendário e a mesma
// lógica de horários vagos usada no fluxo de agendamento do cliente.
// Usado tanto em "Meus agendamentos" (cliente) quanto na Agenda (admin).
export default function Reagendamento({ agendamento, onConcluido, onCancelar }) {
  const [barbeiro, setBarbeiro] = useState(undefined)
  const [dataSelecionada, setDataSelecionada] = useState(null)
  const [horarios, setHorarios] = useState([])
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)
  const [horarioSelecionado, setHorarioSelecionado] = useState(null)
  const [diasBloqueados, setDiasBloqueados] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

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

  useEffect(() => {
    buscarBarbeiroPorId(agendamento.barberId).then(setBarbeiro)
  }, [agendamento.barberId])

  useEffect(() => {
    const unsub = ouvirBloqueiosDiaPorBarbeiro(agendamento.barberId, setDiasBloqueados)
    return unsub
  }, [agendamento.barberId])

  useEffect(() => {
    if (!dataSelecionada || !barbeiro) return
    setCarregandoHorarios(true)
    setHorarioSelecionado(null)
    const dataKey = toDateKey(dataSelecionada)
    const diaSemana = dataSelecionada.getDay()
    const expedienteDia = barbeiro.workingHours?.[diaSemana]

    buscarAgendamentosPorBarbeiroEData(agendamento.barberId, dataKey).then(agendamentosDoDia => {
      // Ignora o próprio agendamento (caso a nova data escolhida seja a mesma)
      // para não considerar o horário atual dele como "ocupado".
      const outros = agendamentosDoDia.filter(a => a.id !== agendamento.id)
      const slots = gerarHorariosDisponiveis({
        expedienteDia,
        duracaoServicoMin: agendamento.durationMin,
        agendamentosDoDia: outros,
        dataKey
      })
      setHorarios(slots)
      setCarregandoHorarios(false)
    })
  }, [dataSelecionada, barbeiro, agendamento])

  async function confirmar() {
    if (!horarioSelecionado) return
    setErro('')
    setSalvando(true)
    try {
      const novosDados = {
        date: toDateKey(dataSelecionada),
        startTime: horarioSelecionado.startTime,
        endTime: horarioSelecionado.endTime
      }
      await reagendarAgendamento(agendamento.id, novosDados)
      onConcluido(novosDados)
    } catch (e) {
      setErro('Não foi possível reagendar. Tente novamente.')
      setSalvando(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="section-title" style={{ marginTop: 0 }}>Nova data</div>

      {barbeiro === undefined && <Loader />}
      {barbeiro && (
        <CalendarioMes
          dataMinima={dataMinima}
          dataMaxima={dataMaxima}
          dataSelecionada={dataSelecionada}
          onSelecionar={setDataSelecionada}
          diasBloqueados={diasBloqueados}
        />
      )}

      {dataSelecionada && (
        <>
          <div className="section-title">Novo horário</div>
          {carregandoHorarios && <Loader />}
          {!carregandoHorarios && horarios.length === 0 && (
            <div className="empty-state">Sem horários disponíveis neste dia.</div>
          )}
          {!carregandoHorarios && horarios.length > 0 && (
            <div className="slots-grid">
              {horarios.map(h => (
                <button
                  key={h.startTime}
                  type="button"
                  className={`slot-btn ${horarioSelecionado?.startTime === h.startTime ? 'selected' : ''}`}
                  onClick={() => setHorarioSelecionado(h)}
                >
                  {h.startTime}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {erro && <div className="error-text" style={{ marginTop: 10 }}>{erro}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={confirmar}
          disabled={!horarioSelecionado || salvando}
        >
          {salvando ? 'Reagendando...' : 'Confirmar novo horário'}
        </button>
        <button className="btn btn-outline btn-sm" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
