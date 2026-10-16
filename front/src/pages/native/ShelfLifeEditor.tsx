/** Visual editor for the API's integer shelfLifeSeconds value. */
export type DurationPart = "days" | "hours" | "minutes" | "seconds";
const bases: Record<DurationPart, number> = { days: 86400, hours: 3600, minutes: 60, seconds: 1 };
export function splitShelfLife(total: number) {
  const t = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  return { days: Math.floor(t / 86400), hours: Math.floor(t % 86400 / 3600), minutes: Math.floor(t % 3600 / 60), seconds: t % 60 };
}
export function changeShelfLife(total: number, part: DurationPart, raw: string): number {
  const amount = raw.trim() === "" ? 0 : Number(raw);
  if (!Number.isInteger(amount) || amount < 0 || amount > (part === "days" ? 24855 : part === "hours" ? 23 : 59)) return total;
  const fields = splitShelfLife(total);
  const result = Object.entries({ ...fields, [part]: amount }).reduce((sum, [key, value]) => sum + value * bases[key as DurationPart], 0);
  return result <= 2147483647 ? result : total;
}
export function ShelfLifeEditor({ value, disabled, onChange }: { value: number; disabled?: boolean; onChange: (seconds: number) => void }) {
  const parts = splitShelfLife(value);
  const labels: { id: DurationPart; title: string; max: number }[] = [
    { id: "days", title: "Дни", max: 24855 }, { id: "hours", title: "Часы", max: 23 },
    { id: "minutes", title: "Минуты", max: 59 }, { id: "seconds", title: "Секунды", max: 59 },
  ];
  return <div className="grid grid-cols-4 gap-2">
    {labels.map(({ id, title, max }) => <label key={id} className="min-w-0 text-xs font-medium text-slate-500">{title}
      <input aria-label={`Срок годности: ${title.toLowerCase()}`} type="number" inputMode="numeric" step={1} min={0} max={max}
        className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-center text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
        value={parts[id]} disabled={disabled} onChange={(e) => onChange(changeShelfLife(value, id, e.target.value))}/>
    </label>)}
  </div>;
}
