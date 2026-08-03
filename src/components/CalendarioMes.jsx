import { useMemo, useState } from 'react'
import { toDateKey, MOTIVOS_BLOQUEIO_DIA } from '../utils/time'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]
const DIAS_SEMANA_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function inicioDoMes(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export default function CalendarioMes({ dataMinima, dataMaxima, dataSelecionada, onSelecionar, diasBloqueados }) {
  const hojeKey = useMemo(() => toDateKey(new Date()), [])
  const chaveMinima = toDateKey(dataMinima)
  const chaveMaxima = toDateKey(dataMaxima)

  const mapaBloqueios = useMemo(() => {
    const m = new Map()
    ;(diasBloqueados || []).forEach(b => m.set(b.date, b.reason))
    return m
  }, [diasBloqueados])

  const mesMinimo = inicioDoMes(dataMinima)
  const mesMaximo = inicioDoMes(dataMaxima)

  const [mesVisivel, setMesVisivel] = useState(
    inicioDoMes(dataSelecionada || dataMinima)
  )

  const podeVoltar = mesVisivel > mesMinimo
  const podeAvancar = mesVisivel < mesMaximo

  const celulas = useMemo(() => {
    const primeiroDiaSemana = mesVisivel.getDay()
    const totalDiasNoMes = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 0).getDate()

    const lista = []
    for (let i = 0; i < primeiroDiaSemana; i++) lista.push(null)
    for (let dia = 1; dia <= totalDiasNoMes; dia++) {
      lista.push(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), dia))
    }
    return lista
  }, [mesVisivel])

  function mudarMes(delta) {
    setMesVisivel(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  return (
    <div className="calendar-square">
      <div className="calendar-header">
        <button
          type="button"
          className="calendar-nav"
          onClick={() => mudarMes(-1)}
          disabled={!podeVoltar}
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <span className="calendar-titulo">{MESES[mesVisivel.getMonth()]} {mesVisivel.getFullYear()}</span>
        <button
          type="button"
          className="calendar-nav"
          onClick={() => mudarMes(1)}
          disabled={!podeAvancar}
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      <div className="calendar-grid calendar-weekdays">
        {DIAS_SEMANA_CURTO.map((d, i) => (
          <span key={i} className="calendar-weekday">{d}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {celulas.map((data, i) => {
          if (!data) return <span key={`vazio-${i}`} />

          const chave = toDateKey(data)
          const motivoBloqueio = mapaBloqueios.get(chave)
          const bloqueado = motivoBloqueio !== undefined
          const disponivel = chave >= chaveMinima && chave <= chaveMaxima && !bloqueado
          const selecionado = dataSelecionada && toDateKey(dataSelecionada) === chave
          const ehHoje = chave === hojeKey
          const motivoTexto = (motivoBloqueio === 'ferias' || motivoBloqueio === 'folga')
            ? MOTIVOS_BLOQUEIO_DIA[motivoBloqueio]
            : null

          return (
            <button
              key={chave}
              type="button"
              className={`calendar-cell ${ehHoje ? 'today' : ''} ${selecionado ? 'selected' : ''} ${motivoTexto ? 'blocked-labeled' : ''}`}
              disabled={!disponivel}
              title={motivoTexto || undefined}
              onClick={() => onSelecionar(data)}
            >
              <span className="calendar-cell-num">{data.getDate()}</span>
              {motivoTexto && <span className="calendar-cell-motivo">{motivoTexto}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
