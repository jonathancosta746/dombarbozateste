import { useEffect, useState } from 'react'
import { ouvirBarbeiros, criarBarbeiro, atualizarBarbeiro, removerBarbeiro, horarioPadrao, verificarSenha, alterarMinhaSenha, enviarRedefinicaoSenha } from '../../utils/firebaseData'
import { comprimirImagemParaBase64 } from '../../utils/image'
import { DIAS_SEMANA } from '../../utils/time'
import { useAuth } from '../../context/AuthContext'
import Loader from '../../components/Loader'

// Arquivo original aceito antes de comprimir. Depois de comprimida, a
// imagem precisa caber (em base64) dentro do documento do barbeiro no
// Firestore — por isso o limite generoso aqui é só para evitar travar o
// navegador processando fotos gigantes de câmera.
const TAMANHO_MAXIMO_ARQUIVO = 8 * 1024 * 1024 // 8MB

// Validação simples e robusta o suficiente para pegar erros de digitação
// (sem @, sem domínio, espaços etc.) sem ser rígida demais com formatos válidos.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function emailValido(valor) {
  return REGEX_EMAIL.test(valor.trim())
}

// Traduz os erros mais comuns do Firebase Auth para mensagens em português.
function traduzirErroAuth(erro) {
  const codigo = erro?.code || ''
  if (codigo === 'auth/invalid-email') return 'E-mail inválido. Confira o endereço digitado.'
  if (codigo === 'auth/email-already-in-use') return 'Já existe um usuário com esse e-mail.'
  if (codigo === 'auth/weak-password') return 'Senha muito fraca. Use pelo menos 6 caracteres.'
  return erro?.message || 'Não foi possível salvar. Tente novamente.'
}

function FormBarbeiro({ inicial, podeEditarExpediente, podeDefinirAdmin, travarAdmin, editandoProprioPerfil, onSalvar, onCancelar }) {
  const [nome, setNome] = useState(inicial?.name || '')
  const [email, setEmail] = useState(inicial?.email || '')
  const [senha, setSenha] = useState('')
  const [foto, setFoto] = useState(inicial?.photoUrl || '')
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [erroFoto, setErroFoto] = useState('')
  const [ativo, setAtivo] = useState(inicial?.active !== false)
  const [administrador, setAdministrador] = useState(inicial?.isAdmin || false)
  const [horarios, setHorarios] = useState(inicial?.workingHours || horarioPadrao())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function atualizarDia(dia, campo, valor) {
    setHorarios(h => ({ ...h, [dia]: { ...h[dia], [campo]: valor } }))
  }

  async function selecionarArquivoFoto(ev) {
    const arquivo = ev.target.files?.[0]
    ev.target.value = '' // permite escolher o mesmo arquivo de novo depois, se precisar
    if (!arquivo) return

    setErroFoto('')
    if (!arquivo.type.startsWith('image/')) {
      setErroFoto('Selecione um arquivo de imagem.')
      return
    }
    if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) {
      setErroFoto('A imagem original deve ter no máximo 8MB.')
      return
    }

    setEnviandoFoto(true)
    try {
      const dataUrl = await comprimirImagemParaBase64(arquivo)
      setFoto(dataUrl)
    } catch (e) {
      setErroFoto(e.message || 'Não foi possível processar a imagem. Tente novamente.')
    } finally {
      setEnviandoFoto(false)
    }
  }

  async function salvar() {
    setErro('')

    if (!nome.trim()) {
      setErro('Informe o nome.')
      return
    }
    if (!email.trim()) {
      setErro('Informe o e-mail de login.')
      return
    }
    if (!emailValido(email)) {
      setErro('Digite um e-mail válido (ex: nome@dominio.com).')
      return
    }
    if (!inicial && !senha.trim()) {
      setErro('Informe uma senha.')
      return
    }

    setSalvando(true)
    try {
      await onSalvar({
        name: nome.trim(),
        email: email.trim(),
        password: senha || undefined,
        photoUrl: foto.trim(),
        active: ativo,
        isAdmin: administrador,
        // Só quem está editando o próprio perfil pode mexer no expediente.
        // Ao criar/editar outro barbeiro, o expediente existente (ou o padrão) é mantido.
        workingHours: podeEditarExpediente ? horarios : (inicial?.workingHours || horarioPadrao())
      })
    } catch (e) {
      setErro(traduzirErroAuth(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="card">
      <div className="field">
        <label>Nome</label>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Carlos" />
      </div>
      <div className="field">
        <label>E-mail de login</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="barbeiro@navalha.com"
          aria-invalid={email.trim() !== '' && !emailValido(email)}
        />
        {email.trim() !== '' && !emailValido(email) && (
          <div className="error-text">E-mail inválido</div>
        )}
      </div>
      {!inicial && (
        <div className="field">
          <label>Senha</label>
          <input
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="Mínimo de 6 caracteres"
          />
        </div>
      )}

      {inicial && editandoProprioPerfil && (
        <TrocarMinhaSenha />
      )}

      {inicial && !editandoProprioPerfil && (
        <RedefinirSenhaPorEmail email={email} />
      )}
      <div className="field">
        <label>Foto</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          {foto && (
            <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)' }}>
              <img src={foto} alt="Prévia da foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <label className="btn btn-outline btn-sm" style={{ cursor: enviandoFoto ? 'default' : 'pointer' }}>
            {enviandoFoto ? 'Processando...' : 'Enviar imagem'}
            <input
              type="file"
              accept="image/*"
              onChange={selecionarArquivoFoto}
              disabled={enviandoFoto}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        <input value={foto.startsWith('data:') ? '' : foto} onChange={e => setFoto(e.target.value)} placeholder={foto.startsWith('data:') ? 'Imagem enviada do dispositivo (ou cole uma URL para trocar)' : 'ou cole uma URL: https://...'} />
        {erroFoto && <div className="error-text">{erroFoto}</div>}
        <div className="barber-meta" style={{ marginTop: 4 }}>
          Imagens enviadas do dispositivo (máx. 8MB) são redimensionadas e comprimidas automaticamente. A imagem é cortada para preencher o quadro do card do barbeiro.
        </div>
      </div>

      {podeEditarExpediente ? (
        <>
          <div className="section-title">Expediente</div>
          {DIAS_SEMANA.map((nomeDia, d) => (
            <div key={d} className="card" style={{ marginBottom: 8, padding: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={horarios[d]?.enabled ?? false}
                  onChange={e => atualizarDia(d, 'enabled', e.target.checked)}
                />
                {nomeDia}
              </label>
              {horarios[d]?.enabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Início</label>
                    <input type="time" value={horarios[d].start} onChange={e => atualizarDia(d, 'start', e.target.value)} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Fim</label>
                    <input type="time" value={horarios[d].end} onChange={e => atualizarDia(d, 'end', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      ) : (
        <div className="empty-state" style={{ padding: '16px 8px' }}>
          O expediente é definido pelo próprio barbeiro, no perfil dele.
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '10px 0' }}>
        <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
        Visível para agendamento
      </label>

      {podeDefinirAdmin && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '0 0 16px' }}>
          <input
            type="checkbox"
            checked={administrador}
            disabled={travarAdmin}
            onChange={e => setAdministrador(e.target.checked)}
          />
          Acesso de administrador
        </label>
      )}

      {erro && <div className="error-text" style={{ marginBottom: 10 }}>{erro}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={salvar}
          disabled={salvando || enviandoFoto || (email.trim() !== '' && !emailValido(email))}
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
        {onCancelar && <button className="btn btn-outline" onClick={onCancelar}>Cancelar</button>}
      </div>
    </div>
  )
}

function TrocarMinhaSenha() {
  const [aberto, setAberto] = useState(false)
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function trocar() {
    setErro('')
    setSucesso(false)
    if (!senhaAtual) {
      setErro('Digite sua senha atual.')
      return
    }
    if (novaSenha.length < 6) {
      setErro('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não são iguais.')
      return
    }
    setSalvando(true)
    try {
      await alterarMinhaSenha(senhaAtual, novaSenha)
      setSucesso(true)
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmarSenha('')
    } catch (e) {
      setErro(e?.code === 'auth/invalid-credential' || e?.code === 'auth/wrong-password'
        ? 'Senha atual incorreta.'
        : 'Não foi possível trocar a senha. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  if (!aberto) {
    return (
      <div className="field">
        <label>Senha</label>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAberto(true)}>
          Trocar minha senha
        </button>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="barber-meta" style={{ marginBottom: 10 }}>Trocar minha senha</div>
      <div className="field">
        <label>Senha atual</label>
        <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} autoComplete="current-password" />
      </div>
      <div className="field">
        <label>Nova senha</label>
        <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo de 6 caracteres" autoComplete="new-password" />
      </div>
      <div className="field">
        <label>Confirmar nova senha</label>
        <input type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} autoComplete="new-password" />
      </div>
      {erro && <div className="error-text" style={{ marginBottom: 10 }}>{erro}</div>}
      {sucesso && <div className="barber-meta" style={{ marginBottom: 10, color: 'var(--green)' }}>Senha alterada com sucesso.</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={trocar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar nova senha'}
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => setAberto(false)} disabled={salvando}>Cancelar</button>
      </div>
    </div>
  )
}

function RedefinirSenhaPorEmail({ email }) {
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar() {
    setErro('')
    if (!emailValido(email)) {
      setErro('Digite um e-mail válido antes de enviar.')
      return
    }
    setEnviando(true)
    try {
      await enviarRedefinicaoSenha(email.trim())
      setEnviado(true)
    } catch (e) {
      setErro('Não foi possível enviar o e-mail de redefinição. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="field">
      <label>Senha</label>
      <div className="barber-meta" style={{ marginBottom: 8 }}>
        Por segurança, a senha de outro barbeiro só pode ser redefinida por ele mesmo. Envie um e-mail com o link de redefinição.
      </div>
      <button type="button" className="btn btn-outline btn-sm" onClick={enviar} disabled={enviando}>
        {enviando ? 'Enviando...' : 'Enviar e-mail de redefinição de senha'}
      </button>
      {enviado && <div className="barber-meta" style={{ marginTop: 8, color: 'var(--green)' }}>E-mail enviado para {email}.</div>}
      {erro && <div className="error-text" style={{ marginTop: 8 }}>{erro}</div>}
    </div>
  )
}

function ConfirmarExclusaoSenha({ nomeBarbeiro, onConfirmar, onCancelar }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [verificando, setVerificando] = useState(false)

  async function confirmar() {
    if (!senha.trim()) {
      setErro('Digite sua senha para confirmar.')
      return
    }
    setVerificando(true)
    setErro('')
    const ok = await onConfirmar(senha)
    setVerificando(false)
    if (!ok) setErro('Senha incorreta.')
  }

  return (
    <div className="card" style={{ marginTop: 10, borderColor: 'var(--red)' }}>
      <div className="barber-meta" style={{ marginBottom: 10 }}>
        Pra remover <strong>{nomeBarbeiro}</strong>, confirme sua senha de admin:
      </div>
      <div className="field" style={{ marginBottom: 10 }}>
        <input
          type="password"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          placeholder="Sua senha de login"
          autoFocus
        />
      </div>
      {erro && <div className="error-text">{erro}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-danger btn-sm" onClick={confirmar} disabled={verificando}>
          {verificando ? 'Verificando...' : 'Confirmar exclusão'}
        </button>
        <button className="btn btn-outline btn-sm" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  )
}

export default function Barbers() {
  const { barberId, isAdmin } = useAuth()
  const [barbeiros, setBarbeiros] = useState(null)
  const [editando, setEditando] = useState(null) // 'novo' | barberId | null
  const [excluindoId, setExcluindoId] = useState(null)

  useEffect(() => {
    const unsub = ouvirBarbeiros(setBarbeiros)
    return unsub
  }, [])

  if (barbeiros === null) return <Loader />

  // Barbeiro comum: só vê e edita o próprio perfil, sem lista nem outras opções.
  if (!isAdmin) {
    const meuPerfil = barbeiros.find(b => b.id === barberId)
    if (!meuPerfil) return <div className="empty-state">Seu perfil não foi encontrado.</div>
    return (
      <div>
        <div className="section-title" style={{ marginTop: 0 }}>Meu perfil</div>
        <FormBarbeiro
          inicial={meuPerfil}
          podeEditarExpediente
          podeDefinirAdmin={false}
          editandoProprioPerfil
          onSalvar={dados => atualizarBarbeiro(meuPerfil.id, dados)}
        />
      </div>
    )
  }

  const emEdicao = editando === 'novo' ? null : barbeiros.find(b => b.id === editando)

  if (editando) {
    const editandoOProprio = emEdicao?.id === barberId
    return (
      <FormBarbeiro
        inicial={emEdicao}
        podeEditarExpediente={editando === 'novo' ? false : editandoOProprio}
        podeDefinirAdmin
        travarAdmin={editandoOProprio}
        editandoProprioPerfil={editando !== 'novo' && editandoOProprio}
        onCancelar={() => setEditando(null)}
        onSalvar={async dados => {
          if (emEdicao) await atualizarBarbeiro(emEdicao.id, dados)
          else await criarBarbeiro(dados)
          setEditando(null)
        }}
      />
    )
  }

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>Barbeiros</div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditando('novo')}>+ Novo</button>
      </div>

      {barbeiros.length === 0 && <div className="empty-state">Nenhum barbeiro cadastrado ainda.</div>}

      <div className="list-gap">
        {barbeiros.map(b => (
          <div key={b.id} className="card">
            <div className="row-between">
              <div>
                <div className="barber-name">{b.name}{b.id === barberId ? ' (você)' : ''}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {b.isAdmin && <span className="badge badge-confirmado">Admin</span>}
                  {!b.active && <span className="badge badge-cancelado">Oculto</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setEditando(b.id)}>Editar</button>
              {b.id !== barberId && excluindoId !== b.id && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setExcluindoId(b.id)}
                >
                  Remover
                </button>
              )}
            </div>

            {excluindoId === b.id && (
              <ConfirmarExclusaoSenha
                nomeBarbeiro={b.name}
                onCancelar={() => setExcluindoId(null)}
                onConfirmar={async senha => {
                  const ok = await verificarSenha(barberId, senha)
                  if (ok) {
                    await removerBarbeiro(b.id)
                    setExcluindoId(null)
                  }
                  return ok
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
