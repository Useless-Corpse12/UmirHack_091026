import { useState } from 'react'
import { Link } from 'react-router-dom'
import { applyRegistration } from '../../api'
import Input from '../../components/Input'
import Btn from '../../components/Btn'

export default function Apply() {
  const [form, setForm] = useState({ email: '', displayName: '', role: 'Courier' })
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await applyRegistration(form.email, form.displayName, form.role)
      setDone(true)
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold mb-2">Заявка отправлена!</h2>
        <p className="text-gray-500 text-sm mb-6">Модератор свяжется с вами и вышлет данные для входа.</p>
        <Link to="/login" className="text-orange-500 hover:underline text-sm">← На страницу входа</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-1">Подать заявку</h1>
        <p className="text-sm text-gray-500 mb-6">Для курьеров и владельцев ресторанов</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Тип заявки</label>
            <select value={form.role} onChange={set('role')}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="Courier">Стать курьером</option>
              <option value="OrganizationOwner">Зарегистрировать организацию</option>
            </select>
          </div>
          <Input
            label={form.role === 'Courier' ? 'ФИО' : 'Название организации'}
            value={form.displayName} onChange={set('displayName')} required />
          <Input label="Email для связи" type="email" value={form.email} onChange={set('email')} required />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Btn type="submit" loading={loading} className="w-full">Отправить заявку</Btn>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-orange-500 hover:underline">← Назад</Link>
        </p>
      </div>
    </div>
  )
}
