import { useEffect, useState } from 'react'
import { buscarClientePorTelefone } from '../utils/firebaseData'

// Assim que o telefone completa 11 dígitos (DDD + 9 dígitos), busca o nome já
// cadastrado para esse número e preenche automaticamente — sem sobrescrever
// um nome que a pessoa já tenha digitado. Quando não encontra cadastro,
// avisa via `naoEncontrado` (usado como placeholder do campo nome).
export function useClientePorTelefone(telefone, setNome) {
  const [buscando, setBuscando] = useState(false)
  const [naoEncontrado, setNaoEncontrado] = useState(false)

  useEffect(() => {
    const digitos = telefone.replace(/\D/g, '')
    setNaoEncontrado(false)
    if (digitos.length !== 11) return

    let cancelado = false
    setBuscando(true)
    buscarClientePorTelefone(telefone)
      .then(cliente => {
        if (cancelado) return
        if (cliente?.name) {
          setNome(atual => (atual.trim() ? atual : cliente.name))
        } else {
          setNaoEncontrado(true)
        }
      })
      .finally(() => { if (!cancelado) setBuscando(false) })

    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telefone])

  return { buscando, naoEncontrado }
}
