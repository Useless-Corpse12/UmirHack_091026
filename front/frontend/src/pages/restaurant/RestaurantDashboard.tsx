import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyOrg, getMyOrders, updateOrderStatus } from '../../api'
import { useSignalR } from '../../hooks/useSignalR'
import type { Organization, Order } from '../../types'
import Btn from '../../components/Btn'
import StatusBadge from '../../components/StatusBadge'

export default function RestaurantDashboard() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'orders' | 'menu' | 'restaurants'>('orders')

  useEffect(() => {
    Promise.all([getMyOrg(), getMyOrders()]).then(([o, ord]) => {
      setOrg(o); setOrders(ord)
    }).finally(() => setLoading(false))
  }, [])

  useSignalR(conn => {
    if (!org) return
    conn.invoke('SubscribeToOrg', org.id)
    conn.on('NewOrder', async () => {
      const fresh = await getMyOrders()
      setOrders(fresh)
    })
  })

  const changeStatus = async (orderId: string, status: string) => {
    try {
      const updated = await updateOrderStatus(orderId, status)
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o))
    } catch {}
  }

  if (loading) return <p className="text-center py-10 text-gray-400">Загрузка...</p>
  if (!org) return <p className="text-center py-10 text-red-400">Организация не найдена</p>

  const activeOrders = orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status))
  const doneOrders = orders.filter(o => ['Delivered', 'Cancelled'].includes(o.status))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-gray-500">{org.restaurants.length} точек продаж</p>
        </div>
        {org.isBlocked && <span className="bg-red-100 text-red-700 text-sm px-3 py-1 rounded-full">Заблокировано</span>}
      </div>

      <div className="flex gap-2 mb-6 border-b">
        {(['orders', 'menu', 'restaurants'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 px-3 text-sm font-medium transition border-b-2
              ${tab === t ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'orders' ? `Заказы (${activeOrders.length})` : t === 'menu' ? 'Меню' : 'Точки'}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="flex flex-col gap-4">
          {activeOrders.length === 0 && <p className="text-gray-400">Нет активных заказов</p>}
          {activeOrders.map(o => (
            <div key={o.id} className="bg-white rounded-xl shadow p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm text-gray-400">{new Date(o.createdAt).toLocaleString('ru')}</p>
                  <p className="text-sm">📍 {o.deliveryAddress}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="mb-3">
                {o.items.map(i => (
                  <div key={i.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span>{i.name} × {i.quantity}</span>
                    <span>{i.subtotal} ₽</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-orange-500">{o.totalPrice} ₽</span>
                <div className="flex gap-2">
                  {o.status === 'Pending' && (
                    <Btn onClick={() => changeStatus(o.id, 'Confirmed')}>Принять</Btn>
                  )}
                  {o.status === 'Confirmed' && (
                    <Btn onClick={() => changeStatus(o.id, 'ReadyForPickup')} variant="success">Готово</Btn>
                  )}
                  {!['InDelivery', 'Delivered', 'Cancelled'].includes(o.status) && (
                    <Btn onClick={() => changeStatus(o.id, 'Cancelled')} variant="danger">Отмена</Btn>
                  )}
                </div>
              </div>
            </div>
          ))}

          {doneOrders.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-gray-400 text-sm">История ({doneOrders.length})</summary>
              <div className="flex flex-col gap-3 mt-3">
                {doneOrders.map(o => (
                  <div key={o.id} className="bg-gray-50 rounded-xl p-4 flex justify-between">
                    <div>
                      <p className="text-sm">{new Date(o.createdAt).toLocaleString('ru')}</p>
                      <p className="text-sm text-gray-500">{o.deliveryAddress}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={o.status} />
                      <span className="text-sm font-bold">{o.totalPrice} ₽</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {tab === 'menu' && (
        <div>
          <div className="flex justify-end mb-4">
            <Link to="/restaurant/menu" className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
              Управление меню →
            </Link>
          </div>
          <p className="text-gray-500 text-sm">Перейдите в раздел меню для добавления и редактирования блюд.</p>
        </div>
      )}

      {tab === 'restaurants' && (
        <div>
          <div className="flex justify-end mb-4">
            <Link to="/restaurant/locations" className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
              Управление точками →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {org.restaurants.map(r => (
              <div key={r.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-gray-500">📍 {r.address}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {r.isActive ? 'Активна' : 'Закрыта'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
