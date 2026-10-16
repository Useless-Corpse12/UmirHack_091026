import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";

export const surface = "rounded-[22px] border border-slate-200/80 bg-white shadow-[0_12px_40px_-28px_rgba(15,23,42,.28)]";
export const field = "block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100";
export const primary = "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
export const secondary = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50";

export function Heading({ eyebrow, title, description, aside }: { eyebrow?: string; title: string; description?: string; aside?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4 pb-1"><div className="min-w-0 max-w-2xl">
    {eyebrow && <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[.19em] text-indigo-600">{eyebrow}</p>}
    <h2 className="text-[clamp(1.6rem,3.5vw,2.25rem)] font-extrabold tracking-tight text-slate-950">{title}</h2>
    {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
  </div>{aside}</div>;
}
export function Notice({ children, tone = "warning", title }: { children: ReactNode; tone?: "warning" | "danger" | "info" | "success"; title?: string }) {
  const options = {
    warning: { css: "border-amber-200 bg-amber-50/90 text-amber-950", Icon: AlertTriangle },
    danger: { css: "border-rose-200 bg-rose-50 text-rose-950", Icon: ShieldAlert },
    info: { css: "border-indigo-200 bg-indigo-50 text-indigo-950", Icon: Info },
    success: { css: "border-emerald-200 bg-emerald-50 text-emerald-900", Icon: CheckCircle2 },
  }[tone];
  return <div role={tone === "danger" ? "alert" : "note"} className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-6 ${options.css}`}>
    <options.Icon className="mt-0.5 shrink-0" size={19}/><div className="min-w-0">{title && <p className="font-bold">{title}</p>}<div>{children}</div></div>
  </div>;
}
export function ErrorMessage({ value }: { value: string }) { return value ? <Notice tone="danger" title="Ошибка запроса"><span role="alert">{value}</span></Notice> : null; }
export function Stat({ label, value, icon, description }: { label: string; value: string | number; icon: ReactNode; description?: string }) {
  return <section className={`${surface} p-5 md:p-6`}><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">{icon}</div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900">{value}</p>
    {description && <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>}
  </section>;
}
export function Empty({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-500 shadow-sm">{icon || <AlertCircle size={22}/>}</div>
    <p className="font-semibold text-slate-800">{title}</p><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{children}</p>
  </div>;
}
