import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ouvirBarbeiros } from '../../utils/firebaseData'
import Loader from '../../components/Loader'

export default function Home() {
  const [barbeiros, setBarbeiros] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = ouvirBarbeiros(lista => setBarbeiros(lista.filter(b => b.active !== false)))
    return unsub
  }, [])

  return (
    <div className="app-shell">
      <div className="topbar topbar-centered">
        <img src="/logo.png" alt="Dom Barboza" className="brand-logo" />
      </div>

      <main>
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
