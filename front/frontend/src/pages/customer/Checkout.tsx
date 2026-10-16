import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrder } from '../../api'
import type { CartItem } from '../../types'
import Input from '../../components/Input'
import Btn from '../../components/Btn'

export default function Checkout() {
  const nav = useNavigate()
  const cart: CartItem[] = JSON.parse(sessionStorage.getItem('cart') ?? '[]')
  const restaurantId = sessionStorage.getItem('restaurantId') ?? ''
  const restaurantName = sessionStorage.getItem('restaurantName') ?? ''

  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  if (!cart.length) {
    nav('/customer')
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address.trim()) { setError('Введите адрес доставки'); return }
    setError('')
    setLoading(true)
    try {
      const order = await createOrder(restaurantId, address, cart)
      sessionStorage.removeItem('cart')
      sessionStorage.removeItem('restaurantId')
      sessionStorage.removeItem('restaurantName')
      nav(`/customer/orders/${order.id}`)
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Ошибка оформления заказа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <button onClick={() => nav(-1)} className="text-orange-500 text-sm hover:underline mb-4 block">← Назад</button>
      <h1 className="text-2xl font-bold mb-6">Оформление заказа</h1>

      <div className="bg-white rounded-xl shadow p-5 mb-4">
        <p className="font-semibold text-gray-600 mb-3">📦 {restaurantName}</p>
        {cart.map(i => (
          <div key={i.menuItemId} className="flex justify-between text-sm py-1 border-b last:border-0">
            <span>{i.name} × {i.quantity}</span>
            <span className="font-medium">{i.price * i.quantity} ₽</span>
          </div>
        ))}
        <div className="flex justify-between font-bold text-lg mt-3 pt-2">
          <span>Итого</span>
          <span className="text-orange-500">{total} ₽</span>
        </div>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow p-5 flex flex-col gap-4">
        <Input label="Адрес доставки" value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="ул. Пушкина, д. 5, кв. 12" required />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Btn type="submit" loading={loading} className="w-full py-3 text-lg">
          Заказать
        </Btn>
      </form>
    </div>
  )
}
