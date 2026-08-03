import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async usuarioFirebase => {
      if (!usuarioFirebase) {
        setSessao(null)
        setCarregando(false)
        return
      }

      try {
        const perfilSnapshot = await getDoc(doc(db, 'barbers', usuarioFirebase.uid))
        const perfil = perfilSnapshot.exists() ? perfilSnapshot.data() : {}
        setSessao({
          usuarioFirebase,
          barberId: usuarioFirebase.uid,
          name: perfil.name || usuarioFirebase.email || 'Usuário',
          isAdmin: !!perfil.isAdmin
        })
      } catch (erro) {
        console.error('Não foi possível carregar o perfil do usuário:', erro)
        setSessao(null)
      } finally {
        setCarregando(false)
      }
    })
  }, [])

  async function entrar(email, senha) {
    await signInWithEmailAndPassword(auth, email, senha)
  }

  async function sair() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{
      usuario: sessao?.usuarioFirebase || null,
      barberId: sessao?.barberId || null,
      nome: sessao?.name || '',
      isAdmin: !!sessao?.isAdmin,
      carregando,
      entrar,
      sair
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
