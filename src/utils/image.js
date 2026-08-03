// Redimensiona e comprime uma imagem inteiramente no navegador (via canvas),
// devolvendo um data URL em base64 pronto para salvar direto no Firestore
// (sem depender do Firebase Storage, que exige o plano pago Blaze).
//
// Tenta qualidades decrescentes de JPEG até o resultado caber no limite de
// bytes informado. Se mesmo na qualidade mais baixa não couber, rejeita com
// uma mensagem amigável para o usuário tentar uma imagem mais simples.
export function comprimirImagemParaBase64(arquivo, {
  maxDimensao = 640,
  limiteBytes = 700 * 1024
} = {}) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()

    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))

    leitor.onload = () => {
      const img = new Image()

      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'))

      img.onload = () => {
        let { width, height } = img
        if (width > maxDimensao || height > maxDimensao) {
          if (width >= height) {
            height = Math.round(height * (maxDimensao / width))
            width = maxDimensao
          } else {
            width = Math.round(width * (maxDimensao / height))
            height = maxDimensao
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        const qualidades = [0.82, 0.65, 0.5, 0.35]
        let melhorResultado = null

        for (const qualidade of qualidades) {
          const dataUrl = canvas.toDataURL('image/jpeg', qualidade)
          melhorResultado = dataUrl
          if (dataUrl.length <= limiteBytes) {
            resolve(dataUrl)
            return
          }
        }

        reject(new Error('Não foi possível comprimir a imagem o suficiente. Tente uma foto mais simples ou de menor resolução.'))
      }

      img.src = leitor.result
    }

    leitor.readAsDataURL(arquivo)
  })
}
