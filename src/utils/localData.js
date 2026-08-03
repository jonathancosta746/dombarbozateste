// Camada de dados 100% local: tudo é salvo como JSON no localStorage do
// navegador, sem backend nenhum. Mesma "API" que as páginas já usavam com
// o Firebase (ouvirBarbeiros, criarAgendamento, etc.), então dá pra trocar
// por Firebase de verdade depois só mudando os imports — veja
// /firebase-integration-backup na raiz do projeto para o código original.

const STORAGE_KEY = 'navalha_local_db'
const SESSION_KEY = 'navalha_local_session'

function gerarId() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

function clone(x) {
  return JSON.parse(JSON.stringify(x))
}

export function horarioPadrao() {
  const wh = {}
  for (let d = 0; d < 7; d++) {
    wh[d] = { enabled: d !== 0, start: '09:00', end: '19:00' }
  }
  return wh
}

function dadosIniciais() {
  const barbeiro1 = gerarId()
  const barbeiro2 = gerarId()
  return {
    barbers: [
      {
        id: barbeiro1, name: 'Carlos Silva', photoUrl: '', active: true,
        workingHours: horarioPadrao(), email: 'admin@navalha.com', password: 'admin123', isAdmin: true
      },
      {
        id: barbeiro2, name: 'Rafael Souza', photoUrl: '', active: true,
        workingHours: horarioPadrao(), email: 'rafael@navalha.com', password: 'rafael123', isAdmin: false
      }
    ],
    services: [
      { id: gerarId(), name: 'Corte', durationMin: 60, price: 40, barberId: barbeiro1, active: true },
      { id: gerarId(), name: 'Corte + Barba', durationMin: 90, price: 60, barberId: barbeiro1, active: true },
      { id: gerarId(), name: 'Barba', durationMin: 30, price: 25, barberId: barbeiro2, active: true }
    ],
    appointments: [],
    dayBlocks: []
  }
}

function migrarSeNecessario(dbCarregado) {
  const semCredenciais = !dbCarregado.barbers?.some(b => b.email)
  if (semCredenciais && dbCarregado.barbers?.length) {
    dbCarregado.barbers = dbCarregado.barbers.map((b, i) => ({
      ...b,
      email: b.email || (i === 0 ? 'admin@navalha.com' : `barbeiro${i + 1}@navalha.com`),
      password: b.password || (i === 0 ? 'admin123' : `barbeiro${i + 1}23`),
      isAdmin: b.isAdmin ?? i === 0
    }))
  }

  const primeiroBarbeiroId = dbCarregado.barbers?.[0]?.id
  const servicosCompartilhados = dbCarregado.services?.some(s => 'barberIds' in s && !('barberId' in s))
  if (servicosCompartilhados && primeiroBarbeiroId) {
    dbCarregado.services = dbCarregado.services.map(s => {
      const { barberIds, ...resto } = s
      // Serviço antigo sem dono único: atribui ao primeiro barbeiro da lista
      // (ou ao primeiro da lista de barberIds, se ele ainda existir).
      const dono = barberIds?.find(id => dbCarregado.barbers.some(b => b.id === id)) || primeiroBarbeiroId
      return { ...resto, barberId: s.barberId || dono }
    })
  }

  const temPausasSalvas = dbCarregado.barbers?.some(b =>
    Object.values(b.workingHours || {}).some(dia => dia.breakStart || dia.breakEnd)
  )
  if (temPausasSalvas) {
    dbCarregado.barbers = dbCarregado.barbers.map(b => {
      if (!b.workingHours) return b
      const wh = {}
      for (const [dia, config] of Object.entries(b.workingHours)) {
        const { breakStart, breakEnd, ...resto } = config
        wh[dia] = resto
      }
      return { ...b, workingHours: wh }
    })
  }

  if (!Array.isArray(dbCarregado.dayBlocks)) {
    dbCarregado.dayBlocks = []
  }

  delete dbCarregado.admin // formato antigo, não usado mais
  return dbCarregado
}

function carregarDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const carregado = migrarSeNecessario(JSON.parse(raw))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(carregado))
      return carregado
    }
  } catch {
    // localStorage indisponível ou JSON corrompido — recomeça do zero
  }
  const inicial = dadosIniciais()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inicial))
  return inicial
}

let db = carregarDB()

function salvar() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

const listeners = { barbers: new Set(), services: new Set(), appointments: new Set(), dayBlocks: new Set() }

function notificar(colecao) {
  salvar()
  listeners[colecao].forEach(cb => cb(clone(db[colecao])))
}

// ---------- Barbeiros ----------
export function ouvirBarbeiros(callback) {
  callback(clone(db.barbers))
  listeners.barbers.add(callback)
  return () => listeners.barbers.delete(callback)
}

export async function buscarBarbeiroPorId(id) {
  const b = db.barbers.find(x => x.id === id)
  return b ? clone(b) : null
}

export async function criarBarbeiro(dados) {
  const item = { id: gerarId(), active: true, ...dados }
  db.barbers.push(item)
  notificar('barbers')
  return item
}

export async function atualizarBarbeiro(id, dados) {
  db.barbers = db.barbers.map(b => (b.id === id ? { ...b, ...dados } : b))
  notificar('barbers')
}

export async function removerBarbeiro(id) {
  db.barbers = db.barbers.filter(b => b.id !== id)
  notificar('barbers')
}

export async function verificarSenha(barberId, senha) {
  const b = db.barbers.find(x => x.id === barberId)
  return !!b && b.password === senha
}

// ---------- Serviços ----------
export function ouvirServicos(callback) {
  callback(clone(db.services))
  listeners.services.add(callback)
  return () => listeners.services.delete(callback)
}

export async function criarServico(dados) {
  const item = { id: gerarId(), active: true, ...dados }
  db.services.push(item)
  notificar('services')
  return item
}

export async function atualizarServico(id, dados) {
  db.services = db.services.map(s => (s.id === id ? { ...s, ...dados } : s))
  notificar('services')
}

export async function removerServico(id) {
  db.services = db.services.filter(s => s.id !== id)
  notificar('services')
}

// ---------- Agendamentos ----------
export async function buscarAgendamentosPorBarbeiroEData(barberId, dateKey) {
  return clone(db.appointments.filter(a => a.barberId === barberId && a.date === dateKey))
}

export function ouvirAgendamentosPorBarbeiroEData(barberId, dateKey, callback) {
  function emitir() {
    callback(clone(db.appointments.filter(a => a.barberId === barberId && a.date === dateKey)))
  }
  emitir()
  listeners.appointments.add(emitir)
  return () => listeners.appointments.delete(emitir)
}

export function ouvirAgendamentosPorData(dateKey, callback) {
  function emitir() {
    callback(clone(db.appointments.filter(a => a.date === dateKey)))
  }
  emitir()
  listeners.appointments.add(emitir)
  return () => listeners.appointments.delete(emitir)
}

export async function criarAgendamento(dados) {
  const item = { id: gerarId(), status: 'confirmado', createdAt: new Date().toISOString(), ...dados }
  db.appointments.push(item)
  notificar('appointments')
  return item
}

export async function atualizarStatusAgendamento(id, status) {
  db.appointments = db.appointments.map(a => (a.id === id ? { ...a, status } : a))
  notificar('appointments')
}

export async function removerAgendamento(id) {
  db.appointments = db.appointments.filter(a => a.id !== id)
  notificar('appointments')
}

export async function buscarAgendamentosPorTelefone(telefone) {
  return clone(
    db.appointments
      .filter(a => a.clientPhone === telefone)
      .sort((a, b) => b.date.localeCompare(a.date))
  )
}

// ---------- Bloqueio de dia inteiro (férias, folga, etc.) ----------
export function ouvirBloqueiosDiaPorBarbeiro(barberId, callback) {
  function emitir() {
    callback(clone(db.dayBlocks.filter(x => x.barberId === barberId)))
  }
  emitir()
  listeners.dayBlocks.add(emitir)
  return () => listeners.dayBlocks.delete(emitir)
}

export async function criarBloqueioDia({ barberId, date, reason }) {
  // Upsert: se já existir bloqueio pra esse barbeiro+dia, substitui.
  db.dayBlocks = db.dayBlocks.filter(x => !(x.barberId === barberId && x.date === date))
  const item = { id: gerarId(), barberId, date, reason }
  db.dayBlocks.push(item)
  notificar('dayBlocks')
  return item
}

export async function removerBloqueioDia(id) {
  db.dayBlocks = db.dayBlocks.filter(x => x.id !== id)
  notificar('dayBlocks')
}

// ---------- Sessão local (login por barbeiro) ----------
export async function login(email, senha) {
  const alvo = db.barbers.find(b => (b.email || '').toLowerCase() === email.trim().toLowerCase())
  if (!alvo || alvo.password !== senha) throw new Error('Credenciais inválidas')
  const sessao = { barberId: alvo.id, isAdmin: !!alvo.isAdmin, name: alvo.name }
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessao))
  return sessao
}

export async function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export function sessaoAtual() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ---------- Backup manual (exportar / importar o JSON completo) ----------
export function exportarJSON() {
  return JSON.stringify(db, null, 2)
}

export function importarJSON(jsonTexto) {
  const novo = JSON.parse(jsonTexto)
  db = novo
  salvar()
  notificar('barbers')
  notificar('services')
  notificar('appointments')
  notificar('dayBlocks')
}
