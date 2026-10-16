const map: Record<string, { label: string; cls: string }> = {
  Pending:        { label: 'Ждёт подтверждения', cls: 'bg-yellow-100 text-yellow-800' },
  Confirmed:      { label: 'Принят рестораном',  cls: 'bg-blue-100 text-blue-800' },
  ReadyForPickup: { label: 'Ждёт курьера',       cls: 'bg-purple-100 text-purple-800' },
  InDelivery:     { label: 'В доставке',          cls: 'bg-orange-100 text-orange-800' },
  Delivered:      { label: 'Доставлен',           cls: 'bg-green-100 text-green-800' },
  Cancelled:      { label: 'Отменён',             cls: 'bg-red-100 text-red-800' },
}

export default function StatusBadge({ status }: { status: string }) {
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' }
  return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.cls}`}>{s.label}</span>
}
