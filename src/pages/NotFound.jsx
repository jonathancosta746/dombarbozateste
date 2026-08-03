import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="app-shell">
      <main className="center-screen" style={{ flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <div className="brand" style={{ fontSize: 40 }}>404</div>
        <div className="barber-meta">Essa página não existe.</div>
        <Link to="/" className="btn btn-primary" style={{ marginTop: 8 }}>Voltar ao início</Link>
      </main>
    </div>
  )
}
