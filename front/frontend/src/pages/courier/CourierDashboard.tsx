import { useEffect, useState } from 'react'
import { startShift, endShift, getAvailableOrders, acceptOrder, completeOrder, getCurrentOrder } from '../../api'
import { useSignalR } from '../../hooks/useSignalR'
import type { CourierOrderPreview, CourierOrderDetails } from '../../types'
import Btn from '../../components/Btn'
import StatusBadge from '../../components/StatusBadge'

export default function CourierDashboard() {
  const [onShift, setOnShift] = useState(false)
  const [available, setAvailable] = useState<CourierOrderPreview[]>([])
  const [current, setCurrent] = useState<CourierOrderDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Загрузить текущий заказ при входе
  useEffect(() => {
    getCurrentOrder().then((d: any) => {
      if (d && !d.message) { setCurrent(d); setOnShift(true) }
    })
  }, [])

  // SignalR
  useSignalR(conn => {
    conn.on('OrderAvailable', (order: CourierOrderPreview) => {
      setAvailable(prev => [...prev, order])
    })
    conn.on('OrderTaken', ({ orderId }: { orderId: string }) => {
      setAvailable(prev => prev.filter(o => o.id !== orderId))
    })
  })

  const handleStartShift = async () => {
    setLoading(true)
    try {
      await startShift()
      setOnShift(true)
      const orders = await getAvailableOrders()
      setAvailable(orders)
      setMsg('')
    } catch (e: any) { setMsg(typeof e === 'string' ? e : 'Ошибка') }
    finally { setLoading(false) }
  }

  const handleEndShift = async () => {
    setLoading(true)
    try {
      await endShift()
      setOnShift(false)
      setAvailable([])
      setMsg('')
    } catch (e: any) { setMsg(typeof e === 'string' ? e : 'Ошибка') }
    finally { setLoading(false) }
  }

  const handleAccept = async (id: string) => {
    setLoading(true)
    try {
      const details = await acceptOrder(id)
      setCurrent(details)
      setAvailable([])
      setMsg('')
    } catch (e: any) { setMsg(typeof e === 'string' ? e : 'Заказ уже взят') }
    finally { setLoading(false) }
  }

  const handleComplete = async () => {
    if (!current) return
    setLoading(true)
    try {
      await completeOrder(current.id)
      setCurrent(null)
      const orders = await getAvailableOrders()
      setAvailable(orders)
      setMsg('✅ Доставка выполнена!')
    } catch (e: any) { setMsg(typeof e === 'string' ? e : 'Ошибка') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Кабинет курьера</h1>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium px-3 py-1 rounded-full
            ${onShift ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {onShift ? '🟢 На смене' : '⚫ Не на смене'}
          </span>
          {!onShift
            ? <Btn onClick={handleStartShift} loading={loading}>Начать смену</Btn>
            : <Btn onClick={handleEndShift} loading={loading} variant="ghost" disabled={!!current}>
                Завершить смену
              </Btn>
          }
        </div>
      </div>

      {msg && <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">{msg}</div>}

      {/* Текущий заказ */}
      {current && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-6">
          <div className="flex justify-between items-start mb-3">
            <h2 className="font-bold text-lg">Активный заказ</h2>
            <StatusBadge status={current.status} />
          </div>
          <div className="space-y-2 text-sm mb-4">
            <p>🏪 <strong>Откуда:</strong> {current.restaurantName} — {current.restaurantAddress}</p>
            <p>📍 <strong>Куда:</strong> {current.deliveryAddress}</p>
            <p>📞 <strong>Клиент:</strong> {current.customerContact}</p>
            <p>💰 <strong>Сумма:</strong> {current.totalPrice} ₽</p>
          </div>
          <div className="border-t pt-3 mb-4">
            {current.items.map(i => (
              <div key={i.id} className="flex justify-between text-sm py-1">
                <span>{i.name} × {i.quantity}</span>
                <span>{i.subtotal} ₽</span>
              </div>
            ))}
          </div>
          <Btn onClick={handleComplete} loading={loading} variant="success" className="w-full py-3">
            ✅ Доставлено
          </Btn>
        </div>
      )}

      {/* Доступные заказы */}
      {onShift && !current && (
        <div>
          <h2 className="font-semibold text-lg mb-3">
            Доступные заказы {available.length > 0 && `(${available.length})`}
          </h2>
          {available.length === 0
            ? <p className="text-gray-400 py-8 text-center">Нет доступных заказов. Ожидайте...</p>
            : <div className="flex flex-col gap-3">
                {available.map(o => (
                  <div key={o.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{o.restaurantName}</p>
                      <p className="text-sm text-gray-500">📍 {o.restaurantAddress}</p>
                      <p className="text-orange-500 font-bold mt-1">{o.totalPrice} ₽</p>
                    </div>
                    <Btn onClick={() => handleAccept(o.id)} loading={loading}>
                      Взять
                    </Btn>
                  </div>
                ))}
              </div>
          }
        </div>
      )}
    </div>
  )
}
