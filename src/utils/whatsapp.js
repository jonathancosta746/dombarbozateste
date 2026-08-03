// Monta um link do WhatsApp a partir do telefone salvo no agendamento.
// Aceita números digitados de qualquer jeito ((61) 90000-0000, 61900000000...)
// e assume DDI 55 (Brasil) quando o número não vem com código de país.
export function linkWhatsapp(telefone) {
  const digitos = (telefone || '').replace(/\D/g, '')
  if (!digitos) return null
  const comCodigoPais = digitos.length <= 11 ? `55${digitos}` : digitos
  return `https://wa.me/${comCodigoPais}`
}
