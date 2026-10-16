import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2, ChefHat, LogOut, Plus, UserRoundPlus } from "lucide-react";
import { useRestaurants } from "../features/restaurants/useRestaurants";
import { useAuthStore } from "../features/auth/store/authStore";
import { authApi } from "../shared/api/authApi";
import { ErrorNotice } from "../shared/ui/Feedback";
import { FormDialog } from "../shared/ui/FormDialog";
import { Notice, surface, primary, secondary, field } from "./native/NativeUI";

const roleLabels: Record<string, string> = { owner: "Владелец", admin: "Администратор", manager: "Менеджер", cashier: "Кассир" };
export const RestaurantsPage = () => {
  const navigate = useNavigate();
  const restaurants = useRestaurants();
  const session = useAuthStore((s) => s.session);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [created, setCreated] = useState<{ restaurantId: string; apiKey?: string } | null>(null);
  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await restaurants.create(name.trim());
      setCreated(result); setName(""); setShowCreate(false);
    } catch { /* Error supplied by hook. */ }
  };
  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const member = await restaurants.join(code.trim());
      setCode(""); setShowJoin(false); navigate(member ? "/restaurant/" + member.restaurantId : "/");
    } catch { /* Error supplied by hook. */ }
  };
  return <div className="min-h-screen bg-[#f6f8fc] pb-16">
    <header className="border-b border-slate-200 bg-white px-5 py-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white"><ChefHat size={23}/></div><div><p className="text-xl font-extrabold tracking-tight text-slate-900">UMIR</p><p className="text-xs text-slate-500">Панель ресторана</p></div></div>
      <div className="flex flex-wrap items-center gap-3"><span className="max-w-56 truncate text-xs text-slate-500" title={session?.user.email}>{session?.user.email}</span><button type="button" onClick={() => { void authApi.logout(); navigate("/login"); }} className={`${secondary} !py-2.5`}><LogOut size={16}/> Выйти</button></div>
    </div></header>
    <main className="mx-auto max-w-6xl space-y-7 px-4 pt-9 md:px-6">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-indigo-950 via-indigo-800 to-violet-700 px-6 py-9 text-white shadow-xl shadow-indigo-100 md:px-10 md:py-12">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full border-[50px] border-white/5" aria-hidden="true"/>
        <div className="relative"><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-indigo-200">Управление · UMIR</p><h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Мои рестораны</h1><p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">Выбери ресторан или создай новый. Данные и права доступа подгружаются из твоего бэкенда.</p>
          <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => { restaurants.clearCreateError(); setShowCreate(true); }} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-800 shadow-sm hover:bg-indigo-50"><Plus size={18}/> Создать ресторан</button>
            <button type="button" onClick={() => { restaurants.clearJoinError(); setShowJoin(true); }} className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/20"><UserRoundPlus size={18}/> Присоединиться по коду</button>
          </div>
        </div>
      </section>
      {created && <Notice tone="success" title="Ресторан создан"><div className="space-y-1"><p className="break-all">ID: {created.restaurantId}</p><button type="button" className="font-semibold underline" onClick={() => setCreated(null)}>Закрыть сообщение</button></div></Notice>}
      <ErrorNotice error={restaurants.error}/>
      {restaurants.error && <button type="button" onClick={() => void restaurants.reload().catch(() => {})} className={`${secondary} !py-2`}>Повторить загрузку</button>}
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold text-slate-900">Ваши пространства</h2><p className="mt-1 text-sm text-slate-500">Рестораны, к которым у тебя есть доступ</p></div><span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">{restaurants.isLoading ? "Загрузка…" : `${restaurants.data.length} ресторан(ов)`}</span></div>
      {restaurants.isLoading && <p className="text-sm text-slate-500">Загрузка ресторанов…</p>}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{restaurants.data.map((member) => <article key={member.restaurantId} className={`${surface} group overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-lg`}>
        <div className="mb-5 flex items-start justify-between"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Building2 size={25}/></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{roleLabels[member.role] || member.role}</span></div>
        <h3 className="line-clamp-2 text-lg font-extrabold tracking-tight text-slate-900">{member.name}</h3><p className="mt-2 truncate font-mono text-xs text-slate-400" title={member.restaurantId}>{member.restaurantId}</p>
        {member.role === "cashier" ? <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-500">Учётная запись кассы используется в POS-приложении.</p> :
          <Link to={`/restaurant/${member.restaurantId}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700">Открыть кабинет <ArrowRight size={16}/></Link>}
        {member.role === "owner" && <Link to={`/restaurant/${member.restaurantId}/settings`} aria-label={`Удалить ресторан ${member.name}`} className="mt-3 block text-xs font-semibold text-slate-400 hover:text-indigo-600">Настройки →</Link>}
      </article>)}</div>
      {restaurants.loaded && !restaurants.data.length && <div className={`${surface} flex flex-col items-center p-9 text-center`}><div className="mb-4 rounded-2xl bg-indigo-50 p-4 text-indigo-600"><Building2 size={30}/></div><h3 className="text-lg font-extrabold">Пока нет ресторанов</h3><p className="mt-2 max-w-sm text-sm text-slate-500">Создай первое пространство или присоединись к команде по приглашению.</p></div>}
    </main>
    {showCreate && <FormDialog title="Создать ресторан" onClose={() => setShowCreate(false)} busy={restaurants.isCreating}><form onSubmit={handleCreate} className="space-y-5"><fieldset disabled={restaurants.isCreating} className="space-y-5">
      <label className="block text-sm font-bold text-slate-700">Название ресторана<input aria-label="Название ресторана" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required className={`${field} mt-2`} placeholder="Например, ваше заведение" autoFocus/></label>
      <ErrorNotice error={restaurants.createError}/><div className="flex flex-wrap gap-2"><button className={primary}><Plus size={16}/>{restaurants.isCreating ? "Создание…" : "Создать ресторан"}</button><button type="button" onClick={() => setShowCreate(false)} className={secondary}>Отмена</button></div>
    </fieldset></form></FormDialog>}
    {showJoin && <FormDialog title="Присоединиться по приглашению" onClose={() => setShowJoin(false)} busy={restaurants.isJoining}><form onSubmit={handleJoin} className="space-y-5"><fieldset disabled={restaurants.isJoining} className="space-y-5">
      <label className="block text-sm font-bold text-slate-700">Код приглашения<input aria-label="Код приглашения" value={code} onChange={(e) => setCode(e.target.value)} required className={`${field} mt-2`} placeholder="Вставь полученный код" autoFocus/></label>
      <ErrorNotice error={restaurants.joinError}/><div className="flex flex-wrap gap-2"><button className={primary}><CheckCircle2 size={16}/>{restaurants.isJoining ? "Присоединение…" : "Принять приглашение"}</button><button type="button" onClick={() => setShowJoin(false)} className={secondary}>Отмена</button></div>
    </fieldset></form></FormDialog>}
  </div>;
};
