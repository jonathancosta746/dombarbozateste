import { useEffect, useState } from 'react'
import { ouvirServicos, criarServico, atualizarServico, removerServico } from '../../utils/firebaseData'
import { formatarPreco } from '../../utils/time'
import { useAuth } from '../../context/AuthContext'
import Loader from '../../components/Loader'

function FormServico({ inicial, onSalvar, onCancelar }) {
  const [nome, setNome] = useState(inicial?.name || '')
  const [duracao, setDuracao] = useState(inicial?.durationMin || 60)
  const [preco, setPreco] = useState(inicial?.price || 0)
  const [ativo, setAtivo] = useState(inicial?.active !== false)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!nome.trim() || duracao <= 0) return
    setSalvando(true)
    await onSalvar({
      name: nome.trim(),
      durationMin: Number(duracao),
      price: Number(preco),
      active: ativo
    })
    setSalvando(false)
  }

  return (
    <div className="card">
      <div className="field">
        <label>Nome do procedimento</label>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Corte + Barba" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="field">
          <label>Duração (min)</label>
          <input type="number" min="5" step="5" value={duracao} onChange={e => setDuracao(e.target.value)} />
        </div>
        <div className="field">
          <label>Preço (R$)</label>
          <input type="number" min="0" step="0.5" value={preco} onChange={e => setPreco(e.target.value)} />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '4px 0 16px' }}>
        <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
        Ativo (visível para agendamento)
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
        <button className="btn btn-outline" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  )
}

export default function Services() {
  const { barberId } = useAuth()
  const [servicos, setServicos] = useState(null)
  const [editando, setEditando] = useState(null)

  useEffect(() => {
    const unsub = ouvirServicos(setServicos)
    return unsub
  }, [])

  if (servicos === null) return <Loader />

  const meusServicos = servicos.filter(s => s.barberId === barberId)
  const emEdicao = editando === 'novo' ? null : meusServicos.find(s => s.id === editando)

  if (editando) {
    return (
      <FormServico
        inicial={emEdicao}
        onCancelar={() => setEditando(null)}
        onSalvar={async dados => {
          if (emEdicao) await atualizarServico(emEdicao.id, dados)
          else await criarServico({ ...dados, barberId })
          setEditando(null)
        }}
      />
    )
  }

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>Meus procedimentos</div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditando('novo')}>+ Novo</button>
      </div>

      {meusServicos.length === 0 && <div className="empty-state">Você ainda não cadastrou nenhum procedimento.</div>}

      <div className="list-gap">
        {meusServicos.map(s => (
          <div key={s.id} className="card">
            <div className="row-between">
              <div className="service-info">
                <span>{s.name}</span>
                <span className="service-duration">{s.durationMin} min</span>
              </div>
              <span className="service-price">{formatarPreco(s.price)}</span>
            </div>
            {!s.active && <span className="badge badge-cancelado" style={{ marginTop: 6, display: 'inline-block' }}>Inativo</span>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setEditando(s.id)}>Editar</button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => { if (confirm(`Remover ${s.name}?`)) removerServico(s.id) }}
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
