import { useNavigate } from 'react-router-dom'

export default function TopBar({ titulo, voltar = true, acao }) {
  const navigate = useNavigate()
  return (
    <div className="topbar">
      {voltar && (
        <button className="voltar" onClick={() => navigate(-1)} aria-label="Voltar">‹</button>
      )}
      <div style={{ flex: 1 }}>
        <div className="page-title">{titulo}</div>
      </div>
      {acao}
    </div>
  )
}
