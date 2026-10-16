import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../../api'
import { useAuth } from '../../context/AuthContext'
import Input from '../../components/Input'
import Btn from '../../components/Btn'

export default function Register() {
  const { login: saveAuth } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', displayName: '', contactInfo: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await register(form.email, form.password, form.displayName, form.contactInfo || undefined)
      saveAuth(data)
      nav('/customer')
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-1">Регистрация</h1>
        <p className="text-sm text-gray-500 mb-6">Создание аккаунта покупателя</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input label="Имя" value={form.displayName} onChange={set('displayName')} required />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
          <Input label="Пароль" type="password" value={form.password} onChange={set('password')} required />
          <Input label="Контакт (необязательно)" value={form.contactInfo} onChange={set('contactInfo')} />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Btn type="submit" loading={loading} className="w-full">Зарегистрироваться</Btn>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-orange-500 hover:underline">Уже есть аккаунт</Link>
        </p>
      </div>
    </div>
  )
}
