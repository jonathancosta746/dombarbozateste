# Barbearia — Firebase

O aplicativo usa:

- Firebase Authentication para login dos barbeiros;
- Cloud Firestore para barbeiros, serviços, agendamentos e bloqueios de dias;
- listeners em tempo real (`onSnapshot`) para atualizar as telas automaticamente.

## Configuração

1. No Firebase Console, crie um projeto.
2. Em **Authentication > Sign-in method**, ative **E-mail/senha**.
3. Em **Firestore Database**, crie o banco.
4. Copie `.env.example` para `.env` e preencha as credenciais do aplicativo Web.
5. Publique o conteúdo de `firestore.rules` nas regras do Firestore.
6. Execute:

```bash
npm install
npm run dev
```

## Primeiro administrador

Como ainda não existe um administrador para criar usuários pela tela:

1. Crie o primeiro usuário em **Authentication > Users**.
2. Copie o UID desse usuário.
3. No Firestore, crie a coleção `barbers` e um documento cujo ID seja exatamente o UID.
4. Use campos como estes:

```json
{
  "name": "Administrador",
  "email": "admin@exemplo.com",
  "isAdmin": true,
  "active": true,
  "photoUrl": "",
  "workingHours": {
    "0": { "enabled": false, "start": "09:00", "end": "19:00" },
    "1": { "enabled": true, "start": "09:00", "end": "19:00" },
    "2": { "enabled": true, "start": "09:00", "end": "19:00" },
    "3": { "enabled": true, "start": "09:00", "end": "19:00" },
    "4": { "enabled": true, "start": "09:00", "end": "19:00" },
    "5": { "enabled": true, "start": "09:00", "end": "19:00" },
    "6": { "enabled": true, "start": "09:00", "end": "19:00" }
  }
}
```

Depois disso, o administrador consegue criar novos barbeiros pelo painel. A criação usa uma instância secundária do Firebase Authentication para não desconectar o administrador atual.

## Observação sobre exclusão

A exclusão de um barbeiro pela interface remove o perfil no Firestore. A conta correspondente no Firebase Authentication deve ser removida no Console ou por uma Cloud Function com Admin SDK.
