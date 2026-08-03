import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAE4xhN80M3tuvE_0AmkCJUovXO7zpW14U",
  authDomain: "dom-barboza-barbearia.firebaseapp.com",
  projectId: "dom-barboza-barbearia",
  storageBucket: "dom-barboza-barbearia.firebasestorage.app",
  messagingSenderId: "551054568345",
  appId: "1:551054568345:web:faa2800982740dfaee8108"
}

const camposAusentes = Object.entries(firebaseConfig)
  .filter(([, valor]) => !valor)
  .map(([campo]) => campo)

if (camposAusentes.length) {
  console.warn(`Firebase não configurado. Campos ausentes: ${camposAusentes.join(', ')}`)
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
