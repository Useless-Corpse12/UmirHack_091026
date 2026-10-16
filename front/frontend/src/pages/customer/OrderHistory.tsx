import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyOrders } from '../../api'
import type { Order } from '../../types'
import StatusBadge from '../../components/StatusBadge'

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { getMyOrders().then(setOrders).finally(() => setLoading(false)) }, [])

  if (loading) return <p className="text-center py-10 text-gray-400">Загрузка...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Мои заказы</h1>
      {orders.length === 0
        ? <p className="text-gray-400">У вас ещё нет заказов</p>
        : <div className="flex flex-col gap-3">
            {orders.map(o => (
              <Link key={o.id} to={`/customer/orders/${o.id}`}
                className="bg-white rounded-xl shadow p-4 hover:shadow-md transition flex justify-between items-center">
                <div>
                  <p className="font-semibold">{o.restaurantName}</p>
                  <p className="text-sm text-gray-400">{new Date(o.createdAt).toLocaleString('ru')}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={o.status} />
                  <span className="text-orange-500 font-bold">{o.totalPrice} ₽</span>
                </div>
              </Link>
            ))}
          </div>
      }
    </div>
  )
}
