// "Sessão" simples do cliente no navegador: guarda o telefone usado no
// último agendamento em localStorage, para reconhecê-lo automaticamente em
// "Meus agendamentos" e mostrar o próximo horário marcado na Home.
const CHAVE_TELEFONE = 'barbearia:telefoneCliente'

export function obterTelefoneSalvo() {
  try {
    return localStorage.getItem(CHAVE_TELEFONE) || ''
  } catch {
    return ''
  }
}

export function salvarTelefoneCliente(telefone) {
  if (!telefone?.trim()) return
  try {
    localStorage.setItem(CHAVE_TELEFONE, telefone.trim())
  } catch {
    // localStorage indisponível (ex: navegação privada) — segue sem sessão salva.
  }
}

export function limparTelefoneCliente() {
  try {
    localStorage.removeItem(CHAVE_TELEFONE)
  } catch {
    // nada a fazer
  }
}
