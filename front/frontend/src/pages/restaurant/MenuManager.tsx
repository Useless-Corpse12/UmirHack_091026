import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyOrg, getMenu, createMenuItem, updateMenuItem, deleteMenuItem } from '../../api'
import type { MenuItem } from '../../types'
import Btn from '../../components/Btn'
import Input from '../../components/Input'

const empty = { name: '', category: '', description: '', price: '', photoUrl: '' }

export default function MenuManager() {
  const nav = useNavigate()
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<MenuItem[]>([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    getMyOrg().then(org => {
      setOrgId(org.id)
      return getMenu(org.id)
    }).then(menu => {
      const all = menu.categories.flatMap(c => c.items)
      setItems(all)
    })
  }, [])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const data = { ...form, price: parseFloat(form.price) }
    try {
      if (editing) {
        const updated = await updateMenuItem(editing, { ...data, isAvailable: true })
        setItems(prev => prev.map(i => i.id === editing ? updated : i))
      } else {
        const created = await createMenuItem(data)
        setItems(prev => [...prev, created])
      }
      setForm(empty); setEditing(null); setShowForm(false)
    } catch {}
    finally { setLoading(false) }
  }

  const startEdit = (item: MenuItem) => {
    setForm({ name: item.name, category: item.category ?? '', description: item.description ?? '', price: String(item.price), photoUrl: item.photoUrl ?? '' })
    setEditing(item.id); setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить позицию?')) return
    await deleteMenuItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const toggleAvailable = async (item: MenuItem) => {
    const updated = await updateMenuItem(item.id, { name: item.name, category: item.category, description: item.description, price: item.price, photoUrl: item.photoUrl, isAvailable: !item.isAvailable })
    setItems(prev => prev.map(i => i.id === item.id ? updated : i))
  }

  const categories = [...new Set(items.map(i => i.category ?? 'Прочее'))]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/restaurant')} className="text-orange-500 text-sm hover:underline">← Назад</button>
          <h1 className="text-2xl font-bold">Меню</h1>
        </div>
        <Btn onClick={() => { setForm(empty); setEditing(null); setShowForm(true) }}>+ Добавить</Btn>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-6 grid grid-cols-2 gap-4">
          <Input label="Название" value={form.name} onChange={set('name')} required className="col-span-2" />
          <Input label="Категория" value={form.category} onChange={set('category')} placeholder="Пицца, Напитки..." />
          <Input label="Цена (₽)" type="number" value={form.price} onChange={set('price')} required />
          <Input label="Описание" value={form.description} onChange={set('description')} className="col-span-2" />
          <div className="col-span-2 flex gap-2">
            <Btn type="submit" loading={loading}>{editing ? 'Сохранить' : 'Добавить'}</Btn>
            <Btn type="button" variant="ghost" onClick={() => { setShowForm(false); setEditing(null) }}>Отмена</Btn>
          </div>
        </form>
      )}

      {categories.map(cat => (
        <div key={cat} className="mb-6">
          <h2 className="font-semibold text-gray-600 mb-3">{cat}</h2>
          <div className="flex flex-col gap-2">
            {items.filter(i => (i.category ?? 'Прочее') === cat).map(item => (
              <div key={item.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
                <div>
                  <p className={`font-medium ${!item.isAvailable ? 'text-gray-400 line-through' : ''}`}>{item.name}</p>
                  <p className="text-orange-500 font-bold text-sm">{item.price} ₽</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleAvailable(item)}
                    className={`text-xs px-2 py-1 rounded-full border ${item.isAvailable ? 'border-green-300 text-green-600' : 'border-gray-300 text-gray-400'}`}>
                    {item.isAvailable ? 'Доступно' : 'Скрыто'}
                  </button>
                  <button onClick={() => startEdit(item)} className="text-sm text-blue-500 hover:underline">✏️</button>
                  <button onClick={() => handleDelete(item.id)} className="text-sm text-red-400 hover:underline">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
