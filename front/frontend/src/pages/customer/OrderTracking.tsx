import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getOrderById } from '../../api'
import { useSignalR } from '../../hooks/useSignalR'
import type { Order } from '../../types'
import StatusBadge from '../../components/StatusBadge'

const steps = ['Pending', 'Confirmed', 'ReadyForPickup', 'InDelivery', 'Delivered']
const stepLabel: Record<string, string> = {
  Pending: 'Ждём ресторан',
  Confirmed: 'Готовится',
  ReadyForPickup: 'Ищем курьера',
  InDelivery: 'Едет к вам',
  Delivered: 'Доставлен!'
}

export default function OrderTracking() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) getOrderById(id).then(setOrder).finally(() => setLoading(false))
  }, [id])

  useSignalR(conn => {
    if (!id) return
    conn.invoke('SubscribeToOrder', id)
    conn.on('OrderStatusChanged', ({ status }: { status: string }) => {
      setOrder(o => o ? { ...o, status: status as any } : o)
    })
  })

  if (loading) return <p className="text-center py-10 text-gray-400">Загрузка...</p>
  if (!order) return <p className="text-center py-10 text-red-400">Заказ не найден</p>

  const stepIdx = steps.indexOf(order.status)
  const isCancelled = order.status === 'Cancelled'

  return (
    <div className="max-w-lg mx-auto">
      <Link to="/customer/orders" className="text-orange-500 text-sm hover:underline mb-4 block">← Мои заказы</Link>
      <h1 className="text-2xl font-bold mb-2">Заказ #{order.id.slice(0, 8)}</h1>
      <div className="mb-6"><StatusBadge status={order.status} /></div>

      {!isCancelled && (
        <div className="bg-white rounded-xl shadow p-5 mb-4">
          <div className="flex justify-between">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${i <= stepIdx ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {i < stepIdx ? '✓' : i + 1}
                </div>
                <p className="text-xs text-center mt-1 text-gray-500 hidden sm:block">{stepLabel[s]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-5 mb-4">
        <p className="font-semibold mb-1">{order.restaurantName}</p>
        <p className="text-sm text-gray-500 mb-3">📍 {order.deliveryAddress}</p>
        {order.items.map(i => (
          <div key={i.id} className="flex justify-between text-sm py-1 border-b last:border-0">
            <span>{i.name} × {i.quantity}</span>
            <span>{i.subtotal} ₽</span>
          </div>
        ))}
        <div className="flex justify-between font-bold text-lg mt-3 pt-2">
          <span>Итого</span>
          <span className="text-orange-500">{order.totalPrice} ₽</span>
        </div>
      </div>
    </div>
  )
}
