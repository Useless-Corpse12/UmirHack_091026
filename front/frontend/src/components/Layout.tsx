import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const roleLabel: Record<string, string> = {
  Customer: 'Покупатель',
  Courier: 'Курьер',
  OrganizationOwner: 'Ресторан',
  Moderator: 'Модератор'
}

const roleHome: Record<string, string> = {
  Customer: '/customer',
  Courier: '/courier',
  OrganizationOwner: '/restaurant',
  Moderator: '/moderator'
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()

  const handleLogout = () => { logout(); nav('/login') }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-orange-500 text-white shadow">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={user ? roleHome[user.role] : '/'} className="font-bold text-xl">
            🚀 Доставка
          </Link>
          {user && (
            <div className="flex items-center gap-4 text-sm">
              <span className="opacity-80">{roleLabel[user.role]}</span>
              <span className="font-medium">{user.displayName}</span>
              <button onClick={handleLogout}
                className="bg-white text-orange-500 px-3 py-1 rounded font-medium hover:bg-orange-50">
                Выйти
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  )
}
