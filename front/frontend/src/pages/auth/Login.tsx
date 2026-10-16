import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../../api'
import { useAuth } from '../../context/AuthContext'
import Input from '../../components/Input'
import Btn from '../../components/Btn'

const roleRedirect: Record<string, string> = {
  Customer: '/customer',
  Courier: '/courier',
  OrganizationOwner: '/restaurant',
  Moderator: '/moderator'
}

export default function Login() {
  const { login: saveAuth } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      saveAuth(data)
      nav(roleRedirect[data.role] ?? '/')
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">🚀 Доставка</h1>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input label="Email" type="email" value={email}
            onChange={e => setEmail(e.target.value)} required />
          <Input label="Пароль" type="password" value={password}
            onChange={e => setPassword(e.target.value)} required />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Btn type="submit" loading={loading} className="w-full mt-2">Войти</Btn>
        </form>
        <div className="mt-4 text-center text-sm text-gray-500 flex flex-col gap-1">
          <Link to="/register" className="text-orange-500 hover:underline">Регистрация покупателя</Link>
          <Link to="/apply" className="text-orange-500 hover:underline">Стать курьером / открыть ресторан</Link>
        </div>
      </div>
    </div>
  )
}
