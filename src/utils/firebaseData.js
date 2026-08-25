import { initializeApp, deleteApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  sendPasswordResetEmail,
  signOut as signOutSecondary
} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'
import { auth, db } from '../firebase'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

export function horarioPadrao() {
  const horarios = {}
  for (let dia = 0; dia < 7; dia++) {
    horarios[dia] = { enabled: dia !== 0, start: '09:00', end: '19:00' }
  }
  return horarios
}

function mapear(snapshot) {
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
}

function semUndefined(objeto) {
  return Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== undefined))
}

function normalizarTelefone(telefone) {
  return (telefone || '').replace(/\D/g, '')
}

// ---------- Clientes ----------
// Registro simples de "nome atrelado a um telefone", para autopreencher o
// nome quando o telefone já é conhecido (tanto no agendamento manual do
// barbeiro quanto na tela "Meus agendamentos" do cliente).
export async function buscarClientePorTelefone(telefone) {
  const id = normalizarTelefone(telefone)
  if (!id) return null
  const snapshot = await getDoc(doc(db, 'clients', id))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

export async function salvarCliente(telefone, nome) {
  const id = normalizarTelefone(telefone)
  if (!id || !nome?.trim()) return
  await setDoc(
    doc(db, 'clients', id),
    { phone: telefone.trim(), name: nome.trim(), updatedAt: serverTimestamp() },
    { merge: true }
  )
}

// ---------- Barbeiros ----------
export function ouvirBarbeiros(callback) {
  const consulta = query(collection(db, 'barbers'), orderBy('name'))
  return onSnapshot(consulta, snapshot => callback(mapear(snapshot)))
}

export async function buscarBarbeiroPorId(id) {
  const snapshot = await getDoc(doc(db, 'barbers', id))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

export async function criarBarbeiro(dados) {
  const { password, ...perfil } = dados
  if (!password || password.length < 6) {
    throw new Error('A senha precisa ter pelo menos 6 caracteres.')
  }

  // Uma segunda instância de Auth cria o login sem desconectar o administrador atual.
  const appSecundario = initializeApp(firebaseConfig, `criar-barbeiro-${Date.now()}`)
  const authSecundario = getAuth(appSecundario)

  try {
    const credencial = await createUserWithEmailAndPassword(authSecundario, perfil.email, password)
    const item = {
      ...perfil,
      active: perfil.active !== false,
      workingHours: perfil.workingHours || horarioPadrao(),
      createdAt: serverTimestamp()
    }
    await setDoc(doc(db, 'barbers', credencial.user.uid), item)
    await signOutSecondary(authSecundario)
    return { id: credencial.user.uid, ...item }
  } finally {
    await deleteApp(appSecundario)
  }
}

export async function atualizarBarbeiro(id, dados) {
  const { password: _password, ...perfil } = dados
  return updateDoc(doc(db, 'barbers', id), semUndefined(perfil))
}

export async function removerBarbeiro(id) {
  // Remove o perfil do Firestore. A conta do Firebase Authentication deve ser
  // removida pelo Console ou por uma Cloud Function/Admin SDK.
  return deleteDoc(doc(db, 'barbers', id))
}

export async function verificarSenha(_barberId, senha) {
  const usuario = auth.currentUser
  if (!usuario?.email) return false
  try {
    const credencial = EmailAuthProvider.credential(usuario.email, senha)
    await reauthenticateWithCredential(usuario, credencial)
    return true
  } catch {
    return false
  }
}

// Só é possível alterar a senha do próprio usuário autenticado no momento —
// o SDK do Firebase Auth no cliente não permite que um admin defina a senha
// de outra pessoa diretamente (isso exigiria o Admin SDK, em um backend).
// Por isso exige a senha atual, reautentica e só então troca.
export async function alterarMinhaSenha(senhaAtual, novaSenha) {
  const usuario = auth.currentUser
  if (!usuario?.email) throw new Error('Sessão inválida.')
  const credencial = EmailAuthProvider.credential(usuario.email, senhaAtual)
  await reauthenticateWithCredential(usuario, credencial)
  await updatePassword(usuario, novaSenha)
}

// Para o admin "resetar" a senha de outro barbeiro: envia um e-mail com link
// de redefinição (o próprio barbeiro escolhe a nova senha por lá).
export async function enviarRedefinicaoSenha(email) {
  return sendPasswordResetEmail(auth, email)
}

// ---------- Serviços ----------
export function ouvirServicos(callback) {
  const consulta = query(collection(db, 'services'), orderBy('name'))
  return onSnapshot(consulta, snapshot => callback(mapear(snapshot)))
}

export async function criarServico(dados) {
  return addDoc(collection(db, 'services'), {
    ...dados,
    active: dados.active !== false,
    createdAt: serverTimestamp()
  })
}

export async function atualizarServico(id, dados) {
  return updateDoc(doc(db, 'services', id), semUndefined(dados))
}

export async function removerServico(id) {
  return deleteDoc(doc(db, 'services', id))
}

// ---------- Agendamentos ----------
export async function buscarAgendamentosPorBarbeiroEData(barberId, dateKey) {
  const consulta = query(
    collection(db, 'appointments'),
    where('barberId', '==', barberId),
    where('date', '==', dateKey)
  )
  return mapear(await getDocs(consulta))
}

export function ouvirAgendamentosPorBarbeiroEData(barberId, dateKey, callback) {
  const consulta = query(
    collection(db, 'appointments'),
    where('barberId', '==', barberId),
    where('date', '==', dateKey)
  )
  return onSnapshot(consulta, snapshot => callback(mapear(snapshot)))
}

export function ouvirAgendamentosPorData(dateKey, callback) {
  const consulta = query(collection(db, 'appointments'), where('date', '==', dateKey))
  return onSnapshot(consulta, snapshot => callback(mapear(snapshot)))
}

export async function criarAgendamento(dados) {
  const resultado = await addDoc(collection(db, 'appointments'), {
    status: 'confirmado',
    ...dados,
    createdAt: serverTimestamp()
  })
  if (dados.clientPhone && dados.clientName) {
    await salvarCliente(dados.clientPhone, dados.clientName)
  }
  return resultado
}

export async function atualizarStatusAgendamento(id, status) {
  return updateDoc(doc(db, 'appointments', id), { status })
}

// Cancela um agendamento recorrente e todas as ocorrências futuras da mesma
// série (mesmo recurringId), a partir da data informada. Usado quando o
// barbeiro decide encerrar um corte recorrente.
export async function cancelarSerieRecorrente(recurringId, apartirDeDataKey) {
  const consulta = query(collection(db, 'appointments'), where('recurringId', '==', recurringId))
  const snapshot = await getDocs(consulta)
  const futuros = snapshot.docs.filter(d => {
    const dados = d.data()
    return dados.date >= apartirDeDataKey && dados.status !== 'cancelado' && dados.status !== 'remarcado'
  })
  await Promise.all(futuros.map(d => updateDoc(d.ref, { status: 'cancelado' })))
}

// ---------- Pedidos de encaixe ----------
// Cliente pede uma vaga fora dos horários livres normais; o barbeiro entra
// em contato depois para combinar o horário exato.
export async function criarPedidoEncaixe(dados) {
  return addDoc(collection(db, 'fitInRequests'), {
    status: 'pendente',
    ...dados,
    createdAt: serverTimestamp()
  })
}

export function ouvirPedidosEncaixePorBarbeiroEData(barberId, dateKey, callback) {
  const consulta = query(
    collection(db, 'fitInRequests'),
    where('barberId', '==', barberId),
    where('date', '==', dateKey)
  )
  return onSnapshot(consulta, snapshot => callback(mapear(snapshot)))
}

export async function concluirPedidoEncaixe(id) {
  return updateDoc(doc(db, 'fitInRequests', id), { status: 'concluido' })
}

// Reagendar não move o agendamento original: ele fica marcado como
// "remarcado" na data/horário antigos (para o barbeiro ver que aquele
// horário foi liberado e para onde o cliente foi) e um novo agendamento é
// criado na nova data/horário. Isso deixa o card antigo visível no painel
// como histórico, em vez de simplesmente sumir do dia original.
export async function reagendarAgendamento(agendamento, { date, startTime, endTime }) {
  const { id, createdAt, status, date: dataAntiga, startTime: horaAntiga, endTime: fimAntigo, ...dadosOriginais } = agendamento

  await updateDoc(doc(db, 'appointments', id), {
    status: 'remarcado',
    remarcadoPara: { date, startTime, endTime }
  })

  const novoDoc = await addDoc(collection(db, 'appointments'), {
    ...dadosOriginais,
    date,
    startTime,
    endTime,
    status: 'confirmado',
    remarcadoDe: id,
    createdAt: serverTimestamp()
  })

  return { id: novoDoc.id, ...dadosOriginais, date, startTime, endTime, status: 'confirmado' }
}

export async function removerAgendamento(id) {
  return deleteDoc(doc(db, 'appointments', id))
}

export async function buscarAgendamentosPorTelefone(telefone) {
  // Sem orderBy aqui de propósito: combinar where('clientPhone', ...) com
  // orderBy('date', ...) em campos diferentes exige um índice composto no
  // Firestore. Buscamos só pelo filtro e ordenamos no cliente, evitando
  // depender de criar índice no console do Firebase.
  const consulta = query(
    collection(db, 'appointments'),
    where('clientPhone', '==', telefone)
  )
  const lista = mapear(await getDocs(consulta))
  return lista.sort((a, b) => {
    const porData = b.date.localeCompare(a.date)
    return porData !== 0 ? porData : b.startTime.localeCompare(a.startTime)
  })
}

// ---------- Bloqueios de dia ----------
export function ouvirBloqueiosDiaPorBarbeiro(barberId, callback) {
  const consulta = query(collection(db, 'dayBlocks'), where('barberId', '==', barberId))
  return onSnapshot(consulta, snapshot => callback(mapear(snapshot)))
}

export async function criarBloqueioDia({ barberId, date, reason }) {
  const id = `${barberId}_${date}`
  const dados = { barberId, date, reason, createdAt: serverTimestamp() }
  await setDoc(doc(db, 'dayBlocks', id), dados)
  return { id, ...dados }
}

export async function removerBloqueioDia(id) {
  return deleteDoc(doc(db, 'dayBlocks', id))
}
