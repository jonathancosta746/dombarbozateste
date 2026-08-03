import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// Mesma validação usada no cadastro de barbeiros: pega erros óbvios de
// digitação (sem @, sem domínio, espaços) antes de bater no Firebase.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function emailValido(valor) {
  return REGEX_EMAIL.test(valor.trim())
}

export default function Login() {
  const { usuario, carregando: carregandoSessao, entrar } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  // O login no Firebase Auth resolve antes do AuthContext terminar de carregar
  // o perfil (onAuthStateChanged + busca no Firestore são assíncronos). Por
  // isso o redirecionamento espera o "usuario" do contexto ficar disponível,
  // em vez de navegar direto após o await de entrar().
  useEffect(() => {
    if (!carregandoSessao && usuario) {
      navigate('/admin', { replace: true })
    }
  }, [carregandoSessao, usuario, navigate])

  async function onSubmit(e) {
    e.preventDefault()
    setErro('')

    if (!email.trim() || !senha) {
      setErro('Preencha e-mail e senha.')
      return
    }
    if (!emailValido(email)) {
      setErro('Digite um e-mail válido (ex: nome@dominio.com).')
      return
    }

    setEntrando(true)
    try {
      await entrar(email.trim(), senha)
      // Não navega aqui: o useEffect acima cuida disso assim que o
      // contexto confirmar a sessão.
    } catch (e) {
      setErro('E-mail ou senha inválidos.')
      setEntrando(false)
    }
  }

  return (
    <div className="app-shell">
      <main style={{ paddingTop: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <img src="/logo.png" alt="Dom Barboza" className="brand-logo" />
        </div>
        <div className="eyebrow" style={{ marginBottom: 12, textAlign: 'center' }}>Painel administrativo</div>
        <div className="barber-meta" style={{ marginBottom: 30 }}>
          Entre com o e-mail e a senha cadastrados no Firebase Authentication.
        </div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              aria-invalid={email.trim() !== '' && !emailValido(email)}
            />
          </div>
          <div className="field">
            <label htmlFor="senha">Senha</label>
            <input id="senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="current-password" />
          </div>
          {erro && <div className="error-text">{erro}</div>}
          <button className="btn btn-primary" type="submit" disabled={entrando}>
            {entrando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="aviso-recorrente" style={{ marginTop: 20 }}>
          <span className="aviso-icone">🧪</span>
          <span>
            Contas de teste (senha <strong>123456</strong> para todas):<br />
            baiano@teste.com · lucas@teste.com · galego@teste.com · kaleb@teste.com
          </span>
        </div>
      </main>
    </div>
  )
}
