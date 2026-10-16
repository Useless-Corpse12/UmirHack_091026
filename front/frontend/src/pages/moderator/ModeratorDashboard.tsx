import { useEffect, useState } from 'react'
import { getApplications, reviewApplication, createUser, getCouriers, getOrganizations, blockCourier, blockOrganization } from '../../api'
import type { Application } from '../../types'
import Btn from '../../components/Btn'
import Input from '../../components/Input'

export default function ModeratorDashboard() {
  const [tab, setTab] = useState<'apps' | 'couriers' | 'orgs'>('apps')
  const [apps, setApps] = useState<Application[]>([])
  const [couriers, setCouriers] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Форма создания пользователя
  const [creating, setCreating] = useState<Application | null>(null)
  const [newPass, setNewPass] = useState('')
  const [newWorkZone, setNewWorkZone] = useState('')
  const [created, setCreated] = useState<any>(null)

  useEffect(() => {
    if (tab === 'apps') getApplications(false).then(setApps)
    if (tab === 'couriers') getCouriers().then(setCouriers)
    if (tab === 'orgs') getOrganizations().then(setOrgs)
  }, [tab])

  const handleReview = async (id: string, status: 'Approved' | 'Rejected', note?: string) => {
    await reviewApplication(id, status, note)
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  const handleCreateUser = async () => {
    if (!creating || !newPass) return
    setLoading(true)
    try {
      const result = await createUser({
        applicationId: creating.id,
        email: creating.email,
        password: newPass,
        displayName: creating.displayName,
        role: creating.role,
        workZone: creating.role === 'Courier' ? newWorkZone : null
      })
      setCreated(result)
      setApps(prev => prev.map(a => a.id === creating.id ? { ...a, status: 'Approved' } : a))
    } catch {}
    finally { setLoading(false) }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Панель модератора</h1>

      <div className="flex gap-2 mb-6 border-b">
        {(['apps', 'couriers', 'orgs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition
              ${tab === t ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500'}`}>
            {t === 'apps' ? `Заявки (${apps.filter(a => a.status === 'Pending').length})` : t === 'couriers' ? 'Курьеры' : 'Организации'}
          </button>
        ))}
      </div>

      {tab === 'apps' && (
        <div className="flex flex-col gap-4">
          {apps.length === 0 && <p className="text-gray-400">Заявок нет</p>}
          {apps.map(app => (
            <div key={app.id} className="bg-white rounded-xl shadow p-5">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold">{app.displayName}</p>
                  <p className="text-sm text-gray-500">{app.email}</p>
                  <p className="text-xs text-gray-400">
                    {app.role === 'Courier' ? '🛵 Курьер' : '🏪 Организация'} · {new Date(app.createdAt).toLocaleString('ru')}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium
                  ${app.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                    app.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {app.status === 'Pending' ? 'Ожидает' : app.status === 'Approved' ? 'Одобрено' : 'Отклонено'}
                </span>
              </div>
              {app.status === 'Pending' && (
                <div className="flex gap-2 mt-3">
                  <Btn variant="success" onClick={() => setCreating(app)}>Одобрить и создать</Btn>
                  <Btn variant="danger" onClick={() => handleReview(app.id, 'Rejected')}>Отклонить</Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'couriers' && (
        <div className="flex flex-col gap-3">
          {couriers.map((c: any) => (
            <div key={c.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{c.displayName}</p>
                <p className="text-sm text-gray-500">{c.email}</p>
                <p className="text-xs text-gray-400">
                  {c.isOnShift ? '🟢 На смене' : '⚫ Не на смене'} · {c.workZone ?? 'Зона не указана'}
                </p>
              </div>
              <Btn variant={c.isBlocked ? 'success' : 'danger'}
                onClick={async () => { await blockCourier(c.id, !c.isBlocked); getCouriers().then(setCouriers) }}>
                {c.isBlocked ? 'Разблокировать' : 'Заблокировать'}
              </Btn>
            </div>
          ))}
        </div>
      )}

      {tab === 'orgs' && (
        <div className="flex flex-col gap-3">
          {orgs.map((o: any) => (
            <div key={o.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{o.name}</p>
                <p className="text-sm text-gray-500">{o.ownerEmail} · {o.restaurantCount} точек</p>
              </div>
              <Btn variant={o.isBlocked ? 'success' : 'danger'}
                onClick={async () => { await blockOrganization(o.id, !o.isBlocked); getOrganizations().then(setOrgs) }}>
                {o.isBlocked ? 'Разблокировать' : 'Заблокировать'}
              </Btn>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно создания пользователя */}
      {creating && !created && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="font-bold text-lg mb-4">Создать аккаунт</h2>
            <div className="flex flex-col gap-1 mb-3 text-sm text-gray-600">
              <p><strong>Email:</strong> {creating.email}</p>
              <p><strong>Имя:</strong> {creating.displayName}</p>
              <p><strong>Роль:</strong> {creating.role === 'Courier' ? 'Курьер' : 'Владелец'}</p>
            </div>
            <div className="flex flex-col gap-3">
              <Input label="Придумайте пароль" type="text" value={newPass}
                onChange={e => setNewPass(e.target.value)} placeholder="TempPass123" />
              {creating.role === 'Courier' &&
                <Input label="Рабочая зона" value={newWorkZone}
                  onChange={e => setNewWorkZone(e.target.value)} placeholder="Центральный район" />}
              <div className="flex gap-2 mt-2">
                <Btn onClick={handleCreateUser} loading={loading} className="flex-1">Создать</Btn>
                <Btn variant="ghost" onClick={() => setCreating(null)}>Отмена</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Показать созданные данные */}
      {created && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="font-bold text-lg mb-4 text-green-600">✅ Аккаунт создан!</h2>
            <p className="text-sm text-gray-500 mb-3">Отправьте эти данные пользователю:</p>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm mb-4">
              <p>Email: {created.email}</p>
              <p>Пароль: {newPass}</p>
            </div>
            <Btn className="w-full" onClick={() => { setCreated(null); setCreating(null); setNewPass('') }}>Готово</Btn>
          </div>
        </div>
      )}
    </div>
  )
}
