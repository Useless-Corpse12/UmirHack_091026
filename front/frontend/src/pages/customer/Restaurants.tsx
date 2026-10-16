import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRestaurants } from '../../api'
import type { Restaurant } from '../../types'

export default function Restaurants() {
  const [list, setList] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    getRestaurants().then(setList).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-center py-10 text-gray-400">Загрузка...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Рестораны</h1>
      {list.length === 0
        ? <p className="text-gray-400">Нет доступных ресторанов</p>
        : <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {list.map(r => (
              <div key={r.id}
                onClick={() => nav(`/customer/menu/${r.orgId}?restaurantId=${r.id}&restaurantName=${encodeURIComponent(r.name)}`)}
                className="bg-white rounded-xl shadow p-5 cursor-pointer hover:shadow-md transition border border-transparent hover:border-orange-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-lg">{r.name}</p>
                    <p className="text-sm text-gray-500">{r.orgName}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.isActive ? 'Открыт' : 'Закрыт'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2">📍 {r.address}</p>
                {r.deliveryRadius && <p className="text-xs text-gray-400 mt-1">Доставка до {r.deliveryRadius} км</p>}
              </div>
            ))}
          </div>
      }
    </div>
  )
}
