import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loader from './Loader'

export default function AdminLayout() {
  const { usuario, isAdmin, nome, carregando, sair } = useAuth()

  if (carregando) return <div className="app-shell"><Loader /></div>

  if (!usuario) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div>
          <img src="/logo.png" alt="Dom Barboza" className="brand-logo brand-logo-sm" />
          <div className="eyebrow">{nome}{isAdmin ? ' · admin' : ''}</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={sair}>Sair</button>
      </div>

      <main style={{ paddingBottom: 90 }}>
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <NavLink to="/admin" end className={({ isActive }) => isActive ? 'active' : ''}>
          <span>📅</span>Agenda
        </NavLink>
        <NavLink to="/admin/barbeiros" className={({ isActive }) => isActive ? 'active' : ''}>
          <span>💈</span>{isAdmin ? 'Barbeiros' : 'Meu perfil'}
        </NavLink>
        <NavLink to="/admin/servicos" className={({ isActive }) => isActive ? 'active' : ''}>
          <span>🗒️</span>Serviços
        </NavLink>
      </nav>
    </div>
  )
}
