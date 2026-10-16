import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Apply from './pages/auth/Apply'

import Restaurants from './pages/customer/Restaurants'
import Menu from './pages/customer/Menu'
import Checkout from './pages/customer/Checkout'
import OrderTracking from './pages/customer/OrderTracking'
import OrderHistory from './pages/customer/OrderHistory'

import CourierDashboard from './pages/courier/CourierDashboard'

import RestaurantDashboard from './pages/restaurant/RestaurantDashboard'
import MenuManager from './pages/restaurant/MenuManager'

import ModeratorDashboard from './pages/moderator/ModeratorDashboard'

function Guard({ role, children }: { role: string; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RootRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const map: Record<string, string> = {
    Customer: '/customer', Courier: '/courier',
    OrganizationOwner: '/restaurant', Moderator: '/moderator'
  }
  return <Navigate to={map[user.role] ?? '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/apply" element={<Apply />} />

          {/* Customer */}
          <Route path="/customer" element={<Guard role="Customer"><Layout><Restaurants /></Layout></Guard>} />
          <Route path="/customer/menu/:orgId" element={<Guard role="Customer"><Layout><Menu /></Layout></Guard>} />
          <Route path="/customer/checkout" element={<Guard role="Customer"><Layout><Checkout /></Layout></Guard>} />
          <Route path="/customer/orders" element={<Guard role="Customer"><Layout><OrderHistory /></Layout></Guard>} />
          <Route path="/customer/orders/:id" element={<Guard role="Customer"><Layout><OrderTracking /></Layout></Guard>} />

          {/* Courier */}
          <Route path="/courier" element={<Guard role="Courier"><Layout><CourierDashboard /></Layout></Guard>} />

          {/* Restaurant */}
          <Route path="/restaurant" element={<Guard role="OrganizationOwner"><Layout><RestaurantDashboard /></Layout></Guard>} />
          <Route path="/restaurant/menu" element={<Guard role="OrganizationOwner"><Layout><MenuManager /></Layout></Guard>} />

          {/* Moderator */}
          <Route path="/moderator" element={<Guard role="Moderator"><Layout><ModeratorDashboard /></Layout></Guard>} />

          {/* Root */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
