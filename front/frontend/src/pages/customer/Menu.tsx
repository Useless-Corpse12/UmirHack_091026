import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { getMenu } from '../../api'
import type { CartItem, MenuResponse } from '../../types'
import Btn from '../../components/Btn'

export default function Menu() {
  const { orgId } = useParams<{ orgId: string }>()
  const [sp] = useSearchParams()
  const restaurantId = sp.get('restaurantId') ?? ''
  const restaurantName = sp.get('restaurantName') ?? ''
  const nav = useNavigate()

  const [menu, setMenu] = useState<MenuResponse | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orgId) getMenu(orgId).then(setMenu).finally(() => setLoading(false))
  }, [orgId])

  const addToCart = (id: string, name: string, price: number) => {
    setCart(c => {
      const ex = c.find(i => i.menuItemId === id)
      if (ex) return c.map(i => i.menuItemId === id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...c, { menuItemId: id, name, price, quantity: 1 }]
    })
  }

  const removeFromCart = (id: string) => {
    setCart(c => {
      const ex = c.find(i => i.menuItemId === id)
      if (!ex) return c
      if (ex.quantity === 1) return c.filter(i => i.menuItemId !== id)
      return c.map(i => i.menuItemId === id ? { ...i, quantity: i.quantity - 1 } : i)
    })
  }

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const goCheckout = () => {
    sessionStorage.setItem('cart', JSON.stringify(cart))
    sessionStorage.setItem('restaurantId', restaurantId)
    sessionStorage.setItem('restaurantName', restaurantName)
    nav('/customer/checkout')
  }

  if (loading) return <p className="text-center py-10 text-gray-400">Загрузка меню...</p>
  if (!menu) return <p className="text-center py-10 text-red-400">Меню не найдено</p>

  return (
    <div className="pb-28">
      <div className="mb-6">
        <button onClick={() => nav('/customer')} className="text-orange-500 text-sm hover:underline">← Рестораны</button>
        <h1 className="text-2xl font-bold mt-1">{restaurantName || menu.orgName}</h1>
        <p className="text-gray-500 text-sm">{menu.orgName}</p>
      </div>

      {menu.categories.map((cat, ci) => (
        <div key={ci} className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">{cat.category ?? 'Прочее'}</h2>
          <div className="flex flex-col gap-3">
            {cat.items.map(item => {
              const inCart = cart.find(i => i.menuItemId === item.id)
              return (
                <div key={item.id} className="bg-white rounded-xl p-4 shadow flex justify-between items-center">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    {item.description && <p className="text-sm text-gray-400">{item.description}</p>}
                    <p className="text-orange-500 font-bold mt-1">{item.price} ₽</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {inCart ? (
                      <>
                        <button onClick={() => removeFromCart(item.id)}
                          className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold hover:bg-orange-200">−</button>
                        <span className="w-6 text-center font-bold">{inCart.quantity}</span>
                        <button onClick={() => addToCart(item.id, item.name, item.price)}
                          className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold hover:bg-orange-600">+</button>
                      </>
                    ) : (
                      <button onClick={() => addToCart(item.id, item.name, item.price)}
                        className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold hover:bg-orange-600">+</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <div className="max-w-5xl mx-auto">
            <Btn onClick={goCheckout} className="w-full text-lg py-3">
              Корзина ({cartCount}) — {total} ₽
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
