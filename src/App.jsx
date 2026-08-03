import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AdminLayout from './components/AdminLayout'

import Home from './pages/client/Home'
import Booking from './pages/client/Booking'
import MyAppointments from './pages/client/MyAppointments'
import NotFound from './pages/NotFound'

import Login from './pages/admin/Login'
import Agenda from './pages/admin/Agenda'
import Barbers from './pages/admin/Barbers'
import Services from './pages/admin/Services'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Área do cliente */}
          <Route path="/" element={<Home />} />
          <Route path="/agendar/:barberId" element={<Booking />} />
          <Route path="/meus-agendamentos" element={<MyAppointments />} />

          {/* Área administrativa */}
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Agenda />} />
            <Route path="barbeiros" element={<Barbers />} />
            <Route path="servicos" element={<Services />} />
          </Route>

          {/* Qualquer rota não mapeada */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
