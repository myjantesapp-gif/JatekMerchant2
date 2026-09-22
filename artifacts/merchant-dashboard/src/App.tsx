import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, CircleAlert, Clock3,
  ExternalLink, LayoutDashboard, LogOut, Menu as MenuIcon, MessageSquareText, MoreHorizontal,
  Package, Pencil, Plus, RefreshCw, Search, Settings, ShieldCheck, ShoppingBag, Store, Tags,
  Trash2, TrendingUp, UtensilsCrossed, X,
} from 'lucide-react';
import {
  getBackendMeQueryKey, getGetBackendDashboardQueryKey, getGetMenuItemQueryKey,
  getListBackendOrdersQueryKey, getListBackendProductsPageQueryKey, getListBackendTodosQueryKey,
  useBackendLogin, useBackendMe, useCreateBackendTodo, useDeleteBackendTodo, useDeleteMenuItem,
  useGetBackendDashboard, useGetMenuItem, useListBackendOrders, useListBackendProductsPage,
  useListBackendReviews, useListBackendShops, useListBackendTodos, useListMenuCategories,
  useToggleBackendTodo, useUpdateMenuItem, useUpdateOrderStatus,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { clearToken, getStoredToken, storeToken } from '@/lib/merchant-auth';
import './index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: false } } });

const money = (value?: number | null) => `${(value ?? 0).toLocaleString('en-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
const compactMoney = (value?: number | null) => `${Math.round(value ?? 0).toLocaleString('en-MA')} MAD`;
const dateLabel = (value?: string | null) => value ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const titleCase = (value?: string | null) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '—';

function Button({ children, className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'quiet' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:brightness-95',
    soft: 'bg-secondary text-secondary-foreground hover:brightness-95',
    quiet: 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
    danger: 'bg-destructive text-destructive-foreground hover:brightness-95',
  };
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${styles[variant]} disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>{children}</button>;
}

function StatusPill({ status }: { status?: string }) {
  const tone = status === 'delivered' ? 'bg-secondary text-secondary-foreground' : status === 'cancelled' ? 'bg-red-100 text-red-700' : status === 'pending' ? 'bg-accent text-accent-foreground' : 'bg-orange-100 text-orange-700';
  return <span data-testid={`status-${status}`} className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em] ${tone}`}>{titleCase(status)}</span>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} aria-hidden="true" />;
}

function QueryState({ loading, error, empty, onRetry, children }: { loading?: boolean; error?: boolean; empty?: boolean; onRetry?: () => void; children: ReactNode }) {
  if (loading) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="col-span-full h-72" /></div>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center"><CircleAlert className="mx-auto mb-3 text-red-600" /><h3 className="display text-lg font-bold text-red-900">We could not load this view</h3><p className="mt-1 text-sm text-red-700">The remote workspace did not respond. Your data has not been changed.</p>{onRetry && <Button data-testid="button-retry" className="mt-5" onClick={onRetry}><RefreshCw size={15} />Try again</Button>}</div>;
  if (empty) return <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center"><Package className="mx-auto mb-3 text-muted-foreground" /><h3 className="display text-lg font-bold">Nothing here yet</h3><p className="mt-1 text-sm text-muted-foreground">When the workspace has something to show, it will appear here.</p></div>;
  return <>{children}</>;
}

function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useBackendLogin();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ data: { email, password } }, { onSuccess: (response) => { storeToken(response.token); setLocation('/'); } });
  };
  return <main className="paper-grid flex min-h-[100dvh] items-center justify-center p-5">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_24px_70px_rgba(33,39,58,.12)] md:grid-cols-[.9fr_1.1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground md:flex md:flex-col md:justify-between">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full border-[34px] border-primary/40" />
        <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full border-[28px] border-accent/30" />
        <div className="relative"><Brand light /><p className="mt-20 max-w-xs text-4xl font-bold leading-[1.08] display">The calm side of a busy kitchen.</p><p className="mt-5 max-w-sm text-sm leading-6 text-sidebar-foreground/65">Orders, menu, and the pulse of your shop — in one clear place.</p></div>
        <div className="relative flex items-center gap-3 text-xs text-sidebar-foreground/55"><ShieldCheck size={15} />Private workspace for Jatek partners</div>
      </section>
      <section className="p-7 sm:p-12">
        <div className="mb-10 md:hidden"><Brand /></div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Merchant workspace</p>
        <h1 className="mt-3 display text-3xl font-bold tracking-tight">Good to see you.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to keep service moving.</p>
        <form onSubmit={submit} className="mt-9 space-y-5">
          <label className="block"><span className="mb-2 block text-sm font-semibold">Work email</span><input data-testid="input-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@restaurant.com" className="h-12 w-full rounded-xl border border-input bg-background px-4 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">Password</span><input data-testid="input-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" className="h-12 w-full rounded-xl border border-input bg-background px-4 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
          {login.isError && <div data-testid="status-login-error" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><CircleAlert size={17} className="mt-0.5 shrink-0" />Email or password not recognised. Check your details and try again.</div>}
          <Button data-testid="button-sign-in" type="submit" className="h-12 w-full" disabled={login.isPending}>{login.isPending ? 'Signing you in…' : 'Enter workspace'}<ArrowUpRight size={16} /></Button>
        </form>
        <p className="mt-8 text-center text-xs text-muted-foreground">Need access? Ask the owner of your Jatek shop to add your account.</p>
      </section>
    </div>
  </main>;
}

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" data-testid="link-brand" className="inline-flex items-center gap-2.5"><span className={`grid h-9 w-9 place-items-center rounded-xl ${light ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground'}`}><UtensilsCrossed size={18} /></span><span className={`display text-xl font-extrabold tracking-[-.06em] ${light ? 'text-sidebar-foreground' : 'text-foreground'}`}>jatek<span className="text-primary">.</span></span></Link>;
}

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/reviews', label: 'Reviews', icon: MessageSquareText },
  { href: '/shop', label: 'Shop profile', icon: Store },
];

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const me = useBackendMe({ query: { enabled: Boolean(getStoredToken()), queryKey: getBackendMeQueryKey() } });
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = (href: string) => href === '/' ? location === '/' : location.startsWith(href);
  const user = me.data?.user;
  const logout = () => { clearToken(); setLocation('/login'); };
  return <div className="min-h-[100dvh] bg-background">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] -translate-x-full flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : ''}`}>
      <div className="flex items-center justify-between px-3"><Brand light /><button data-testid="button-close-menu" className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent lg:hidden" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-sidebar-foreground/40">Workspace</div>
      <nav className="mt-3 space-y-1">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active(href) ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}><Icon size={18} strokeWidth={active(href) ? 2.4 : 1.8} /><span>{label}</span>{label === 'Orders' && <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">live</span>}</Link>)}</nav>
      <div className="mt-auto">
        <div className="mb-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-3"><div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-[#74d4a4]" />{me.isLoading ? 'Checking connection' : 'Connected to Jatek'}</div><p className="mt-2 text-[11px] leading-4 text-sidebar-foreground/45">Live data sync is on. Changes show up across your team.</p></div>
        <Link href="/settings" data-testid="link-nav-settings" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground ${active('/settings') ? 'bg-sidebar-accent text-sidebar-foreground' : ''}`}><Settings size={18} />Settings</Link>
        <button data-testid="button-sign-out" onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut size={18} />Sign out</button>
      </div>
    </aside>
    {mobileOpen && <button aria-label="Close navigation" data-testid="button-overlay-menu" className="fixed inset-0 z-30 bg-sidebar/35 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <div className="lg:pl-[248px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-md sm:px-8">
        <button data-testid="button-open-menu" className="rounded-xl p-2 hover:bg-muted lg:hidden" onClick={() => setMobileOpen(true)}><MenuIcon size={21} /></button>
        <div className="hidden text-xs font-semibold text-muted-foreground sm:block">Merchant workspace <span className="mx-2 text-border">/</span> {location === '/' ? 'Overview' : titleCase(location.slice(1))}</div>
        <div className="ml-auto flex items-center gap-3"><button data-testid="button-notifications" className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-muted"><Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" /></button><div className="hidden h-7 w-px bg-border sm:block" /><div className="flex items-center gap-2"><span data-testid="text-user-initials" className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">{user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'JT'}</span><div className="hidden leading-tight sm:block"><div data-testid="text-user-name" className="text-sm font-bold">{user?.name || 'Merchant team'}</div><div className="text-[11px] text-muted-foreground">{titleCase(user?.role) || 'Team member'}</div></div><ChevronDown size={15} className="hidden text-muted-foreground sm:block" /></div></div>
      </header>
      <main className="mx-auto max-w-[1500px] p-5 sm:p-8">{children}</main>
    </div>
  </div>;
}

function Guard({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState(getStoredToken());
  const me = useBackendMe({ query: { enabled: Boolean(token), queryKey: getBackendMeQueryKey() } });
  useEffect(() => {
    const sync = () => setToken(getStoredToken());
    window.addEventListener('jatek-auth-change', sync);
    return () => window.removeEventListener('jatek-auth-change', sync);
  }, []);
  useEffect(() => { if (!token) setLocation('/login'); }, [token, setLocation]);
  if (!token) return null;
  if (me.isLoading) return <div className="grid min-h-[100dvh] place-items-center bg-background"><div className="w-64"><Skeleton className="h-9" /><Skeleton className="mt-3 h-4" /></div></div>;
  if (me.isError) return <div className="grid min-h-[100dvh] place-items-center bg-background p-6"><div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center"><ShieldCheck className="mx-auto mb-4 text-red-600" /><h1 className="display text-xl font-bold">Session expired</h1><p className="mt-2 text-sm text-red-700">Your sign-in is no longer valid. Sign in again to continue.</p><Button data-testid="button-return-login" className="mt-5" onClick={() => { clearToken(); setLocation('/login'); }}>Return to sign in</Button></div></div>;
  return <Shell>{children}</Shell>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p><h1 data-testid="text-page-title" className="mt-2 display text-3xl font-bold tracking-[-.04em] sm:text-4xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div>{action}</div>;
}

function StatCard({ label, value, detail, icon: Icon, tone = 'coral' }: { label: string; value: string; detail: string; icon: typeof TrendingUp; tone?: 'coral' | 'mint' | 'yellow' | 'ink' }) {
  const tones = { coral: 'bg-primary/10 text-primary', mint: 'bg-secondary text-secondary-foreground', yellow: 'bg-accent text-accent-foreground', ink: 'bg-sidebar text-sidebar-foreground' };
  return <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between"><span className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}><Icon size={17} /></span></div><div data-testid={`text-stat-${label.toLowerCase().replaceAll(' ', '-')}`} className="mt-5 display text-3xl font-bold tracking-[-.04em]">{value}</div><div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">{detail}</div></div>;
}

function Dashboard() {
  const dashboard = useGetBackendDashboard({ range: 'week' });
  const todos = useListBackendTodos();
  const createTodo = useCreateBackendTodo();
  const toggleTodo = useToggleBackendTodo();
  const deleteTodo = useDeleteBackendTodo();
  const shops = useListBackendShops();
  const client = useQueryClient();
  const [todoText, setTodoText] = useState('');
  const data = dashboard.data;
  const chartMax = Math.max(...(data?.ordersChart?.map((entry) => entry.value) || [1]), 1);
  const submitTodo = (event: FormEvent) => { event.preventDefault(); if (!todoText.trim()) return; createTodo.mutate({ data: { text: todoText.trim() } }, { onSuccess: () => { setTodoText(''); client.invalidateQueries({ queryKey: getListBackendTodosQueryKey() }); } }); };
  return <div className="page-in">
    <PageHeading eyebrow="Today at your shop" title="Make it a good service." description="A quick read on the week so far, from the orders that need you now to the money already earned." action={<Button data-testid="button-refresh-dashboard" variant="soft" onClick={() => { dashboard.refetch(); todos.refetch(); }}><RefreshCw size={15} />Refresh</Button>} />
    <QueryState loading={dashboard.isLoading} error={dashboard.isError} onRetry={() => dashboard.refetch()}>{data && <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="In progress" value={`${data.inProgressOrders}`} detail="Orders needing attention" icon={Clock3} tone="coral" />
        <StatCard label="Delivered" value={`${data.deliveredOrders}`} detail="Completed this period" icon={Check} tone="mint" />
        <StatCard label="Shop earnings" value={compactMoney(data.merchantEarning)} detail={`${compactMoney(data.totalEarned)} gross order value`} icon={TrendingUp} tone="yellow" />
        <StatCard label="Out of stock" value={`${data.outOfStockProducts}`} detail={`of ${data.totalProducts} menu items`} icon={Tags} tone="ink" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Order rhythm</p><h2 className="mt-1 display text-xl font-bold">This week</h2></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">Last 7 days</span></div><div className="mt-8 flex h-56 items-end gap-2 sm:gap-4">{(data.ordersChart || []).map((entry) => <div key={entry.label} className="flex min-w-0 flex-1 flex-col items-center gap-2"><span className="text-[10px] font-bold text-muted-foreground">{entry.value}</span><div className="flex h-40 w-full items-end rounded-lg bg-muted/60"><div data-testid={`bar-orders-${entry.label}`} className="w-full rounded-lg bg-primary transition-all" style={{ height: `${Math.max((entry.value / chartMax) * 100, 5)}%` }} /></div><span className="truncate text-[10px] font-semibold text-muted-foreground">{entry.label}</span></div>)}</div></section>
        <section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Your list</p><h2 className="mt-1 display text-xl font-bold">Kitchen notes</h2></div><BookOpen className="text-primary" size={20} /></div><form onSubmit={submitTodo} className="mt-5 flex gap-2"><input data-testid="input-todo" value={todoText} onChange={(event) => setTodoText(event.target.value)} placeholder="Add a reminder" className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" /><Button data-testid="button-add-todo" type="submit" className="shrink-0 px-3"><Plus size={16} /></Button></form><div className="mt-4 space-y-1">{todos.isLoading ? <><Skeleton className="h-10" /><Skeleton className="h-10" /></> : (todos.data || []).length === 0 ? <p className="py-7 text-center text-sm text-muted-foreground">Your list is clear.</p> : (todos.data || []).slice(0, 5).map((todo) => <div key={todo.id} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/60"><button data-testid={`button-toggle-todo-${todo.id}`} onClick={() => toggleTodo.mutate({ id: todo.id, data: { done: !todo.done } }, { onSuccess: () => client.invalidateQueries({ queryKey: getListBackendTodosQueryKey() }) })} className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${todo.done ? 'border-secondary bg-secondary text-secondary-foreground' : 'border-border'}`}>{todo.done && <Check size={13} />}</button><span data-testid={`text-todo-${todo.id}`} className={`min-w-0 flex-1 truncate text-sm ${todo.done ? 'text-muted-foreground line-through' : 'font-medium'}`}>{todo.text}</span><button data-testid={`button-delete-todo-${todo.id}`} onClick={() => deleteTodo.mutate({ id: todo.id }, { onSuccess: () => client.invalidateQueries({ queryKey: getListBackendTodosQueryKey() }) })} className="invisible rounded-lg p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600 group-hover:visible"><Trash2 size={14} /></button></div>)}</div></section>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Money map</p><h2 className="mt-1 display text-xl font-bold">Where the order value goes</h2></div><Activity size={19} className="text-primary" /></div><div className="mt-5 grid grid-cols-2 gap-3">{[['Merchant earning', data.merchantEarning], ['Delivery earning', data.deliveryEarning], ['Order tax', data.totalOrderTax], ['Jatek commission', data.totalCommission]].map(([label, value]) => <div key={label as string} className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{label as string}</p><p data-testid={`text-money-${(label as string).toLowerCase().replaceAll(' ', '-')}`} className="mt-1 text-lg font-bold">{money(value as number)}</p></div>)}</div></section>
        <section className="rounded-2xl border border-card-border bg-sidebar p-5 text-sidebar-foreground shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-sidebar-foreground/50">Shop pulse</p><h2 className="mt-1 display text-xl font-bold">{(shops.data || [])[0]?.name || 'Your shop'}</h2></div><Store size={20} className="text-accent" /></div><div className="mt-6 flex items-end justify-between"><div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#74d4a4]" /><span className="text-sm font-semibold">{(shops.data || [])[0]?.isOpen ? 'Open for orders' : 'Currently closed'}</span></div><p className="mt-2 text-xs text-sidebar-foreground/50">{(shops.data || [])[0]?.address || 'Shop details are loading'}</p></div><Link href="/shop" data-testid="link-shop-profile" className="inline-flex items-center gap-1.5 rounded-xl bg-sidebar-accent px-3 py-2 text-xs font-bold hover:bg-sidebar-accent/70">View shop <ExternalLink size={13} /></Link></div></section>
      </div>
    </div>}</QueryState>
  </div>;
}

function Orders() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const orders = useListBackendOrders({ status: status === 'all' ? undefined : status, search: search || undefined, limit: 100 });
  const updateStatus = useUpdateOrderStatus();
  const client = useQueryClient();
  const nextStatus = (current: string) => current === 'pending' ? 'accepted' : current === 'accepted' ? 'preparing' : current === 'preparing' ? 'ready' : current === 'ready' ? 'out_for_delivery' : null;
  return <div className="page-in"><PageHeading eyebrow="Service board" title="Orders" description="Keep every handoff clear. Update an order once the kitchen has made the next move." action={<Button data-testid="button-refresh-orders" variant="soft" onClick={() => orders.refetch()}><RefreshCw size={15} />Refresh</Button>} />
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-card-border bg-card p-3 shadow-sm sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input data-testid="input-order-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference or customer" className="h-10 w-full rounded-xl bg-muted/60 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" /></div><div className="no-scrollbar flex gap-2 overflow-x-auto">{['all', 'pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled'].map((filter) => <button key={filter} data-testid={`button-filter-${filter}`} onClick={() => setStatus(filter)} className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition ${status === filter ? 'bg-sidebar text-sidebar-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'}`}>{titleCase(filter)}</button>)}</div></div>
    <QueryState loading={orders.isLoading} error={orders.isError} empty={!orders.isLoading && !orders.isError && (orders.data || []).length === 0} onRetry={() => orders.refetch()}><section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm"><div className="hidden grid-cols-[1.25fr_1fr_.8fr_.7fr_1fr] gap-4 border-b border-border bg-muted/50 px-5 py-3 text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground md:grid"><span>Order</span><span>Customer</span><span>Placed</span><span>Total</span><span className="text-right">Status</span></div><div className="divide-y divide-border">{(orders.data || []).map((order) => { const next = nextStatus(order.status); return <div key={order.id} data-testid={`row-order-${order.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-muted/30 md:grid-cols-[1.25fr_1fr_.8fr_.7fr_1fr] md:items-center"><div><div className="flex items-center gap-2"><span className="font-bold">#{order.reference || order.id}</span><span className="text-[10px] text-muted-foreground">ID {order.id}</span></div><p className="mt-1 text-xs text-muted-foreground">{order.items?.length || 0} item{order.items?.length === 1 ? '' : 's'} · {order.restaurantName}</p></div><div className="text-sm font-medium">{order.userName || 'Customer'}<p className="mt-1 text-xs text-muted-foreground md:hidden">{dateLabel(order.createdAt)}</p></div><div className="hidden text-xs text-muted-foreground md:block">{dateLabel(order.createdAt)}</div><div className="font-bold">{money(order.total)}</div><div className="flex items-center justify-between gap-2 md:justify-end">{next ? <Button data-testid={`button-advance-order-${order.id}`} variant="soft" className="px-2.5 py-2 text-xs" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: order.id, data: { status: next as never } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListBackendOrdersQueryKey({ status: status === 'all' ? undefined : status, search: search || undefined, limit: 100 }) }); client.invalidateQueries({ queryKey: getGetBackendDashboardQueryKey({ range: 'week' }) }); } })}>{next === 'accepted' ? 'Accept' : `Mark ${titleCase(next)}`}<ArrowUpRight size={13} /></Button> : <StatusPill status={order.status} />}<StatusPill status={order.status} /></div></div>; })}</div></section></QueryState>
  </div>;
}

function MenuPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const products = useListBackendProductsPage({ search: search || undefined, category: category === 'all' ? undefined : category, page: 1, pageSize: 100 });
  const categories = useListMenuCategories();
  const detail = useGetMenuItem(selectedId ?? 0, { query: { enabled: selectedId !== null, queryKey: getGetMenuItemQueryKey(selectedId ?? 0) } });
  const update = useUpdateMenuItem();
  const remove = useDeleteMenuItem();
  const client = useQueryClient();
  const items = products.data?.items || [];
  return <div className="page-in"><PageHeading eyebrow="Your offering" title="Menu" description={`${products.data?.total ?? 0} items in the live catalogue.`} action={<Button data-testid="button-add-product" disabled title="Product creation is not exposed by the current generated client"><Plus size={16} />Add item</Button>} />
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-card-border bg-card p-3 shadow-sm sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input data-testid="input-product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your menu" className="h-10 w-full rounded-xl bg-muted/60 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" /></div><div className="no-scrollbar flex gap-2 overflow-x-auto"><button data-testid="button-category-all" onClick={() => setCategory('all')} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold ${category === 'all' ? 'bg-sidebar text-sidebar-foreground' : 'bg-muted text-muted-foreground'}`}>All items</button>{(categories.data || []).map((item) => <button key={item.id} data-testid={`button-category-${item.id}`} onClick={() => setCategory(item.name)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold ${category === item.name ? 'bg-sidebar text-sidebar-foreground' : 'bg-muted text-muted-foreground'}`}>{item.name}</button>)}</div></div>
    <QueryState loading={products.isLoading} error={products.isError} empty={!products.isLoading && !products.isError && items.length === 0} onRetry={() => products.refetch()}><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((product) => <article key={product.id} data-testid={`card-product-${product.id}`} className="group overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="relative h-36 overflow-hidden bg-secondary">{product.imageUrl ? <img data-testid={`img-product-${product.id}`} src={product.imageUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="grid h-full place-items-center text-secondary-foreground/60"><UtensilsCrossed size={30} /></div>}<span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${product.isAvailable ? 'bg-card/90 text-secondary-foreground' : 'bg-sidebar/85 text-sidebar-foreground'}`}>{product.isAvailable ? 'Available' : 'Paused'}</span>{product.isPopular && <span className="absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-accent-foreground">Popular</span>}</div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{product.name}</h2><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{product.description || 'No description added yet.'}</p></div><button data-testid={`button-menu-more-${product.id}`} onClick={() => setSelectedId(product.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><MoreHorizontal size={18} /></button></div><div className="mt-4 flex items-center justify-between"><div><span className="font-bold">{money(product.price)}</span>{product.compareAtPrice && <span className="ml-2 text-xs text-muted-foreground line-through">{money(product.compareAtPrice)}</span>}</div><span className="rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">{product.category}</span></div><div className="mt-4 flex gap-2"><Button data-testid={`button-toggle-product-${product.id}`} variant={product.isAvailable ? 'soft' : 'primary'} className="flex-1 py-2 text-xs" disabled={update.isPending} onClick={() => update.mutate({ id: product.id, data: { isAvailable: !product.isAvailable } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListBackendProductsPageQueryKey({ search: search || undefined, category: category === 'all' ? undefined : category, page: 1, pageSize: 100 }) }); client.invalidateQueries({ queryKey: getGetBackendDashboardQueryKey({ range: 'week' }) }); } })}>{product.isAvailable ? 'Pause item' : 'Make available'}</Button><button data-testid={`button-edit-product-${product.id}`} onClick={() => setSelectedId(product.id)} className="rounded-xl border border-border px-3 text-muted-foreground hover:bg-muted"><Pencil size={15} /></button></div></div></article>)}</div></QueryState>
    {selectedId !== null && <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/45 p-4" onClick={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}><div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Menu item</p><h2 className="mt-1 display text-2xl font-bold">{detail.data?.name || 'Loading item'}</h2></div><button data-testid="button-close-product" onClick={() => setSelectedId(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button></div>{detail.isLoading ? <div className="mt-6 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-20" /></div> : detail.data && <div className="mt-6 space-y-4"><div className="rounded-xl bg-muted p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold">Live availability</span><span className={`text-sm font-bold ${detail.data.isAvailable ? 'text-secondary-foreground' : 'text-red-600'}`}>{detail.data.isAvailable ? 'On' : 'Off'}</span></div><p className="mt-2 text-xs text-muted-foreground">Changes are applied to the customer-facing menu immediately.</p></div><div className="flex gap-2"><Button data-testid="button-modal-toggle-product" className="flex-1" disabled={update.isPending} onClick={() => update.mutate({ id: detail.data!.id, data: { isAvailable: !detail.data!.isAvailable } }, { onSuccess: () => { setSelectedId(null); client.invalidateQueries({ queryKey: getListBackendProductsPageQueryKey() }); } })}>{detail.data.isAvailable ? 'Pause item' : 'Make available'}</Button><Button data-testid="button-delete-product" variant="danger" disabled={remove.isPending} onClick={() => { if (window.confirm('Remove this menu item from your catalogue?')) remove.mutate({ id: detail.data!.id }, { onSuccess: () => { setSelectedId(null); client.invalidateQueries({ queryKey: getListBackendProductsPageQueryKey() }); } }); }}><Trash2 size={16} />Remove</Button></div></div>}</div></div>}
  </div>;
}

function Reviews() {
  const reviews = useListBackendReviews();
  const average = useMemo(() => { const values = reviews.data || []; return values.length ? (values.reduce((sum, review) => sum + review.rating, 0) / values.length).toFixed(1) : '—'; }, [reviews.data]);
  return <div className="page-in"><PageHeading eyebrow="Customer voice" title="Reviews" description="A quiet place to notice what regulars love and where the experience can get sharper." action={<Button data-testid="button-refresh-reviews" variant="soft" onClick={() => reviews.refetch()}><RefreshCw size={15} />Refresh</Button>} /><QueryState loading={reviews.isLoading} error={reviews.isError} empty={!reviews.isLoading && !reviews.isError && (reviews.data || []).length === 0} onRetry={() => reviews.refetch()}>{reviews.data && <div className="space-y-5"><section className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-card-border bg-sidebar p-5 text-sidebar-foreground"><p className="text-xs font-bold uppercase tracking-[.14em] text-sidebar-foreground/50">Average score</p><p data-testid="text-average-rating" className="mt-3 display text-4xl font-bold">{average}<span className="ml-1 text-lg text-accent">/ 5</span></p><p className="mt-2 text-xs text-sidebar-foreground/55">Across {reviews.data.length} published reviews</p></div><div className="rounded-2xl border border-card-border bg-card p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Response habit</p><p className="mt-3 display text-4xl font-bold">{reviews.data.filter((review) => review.comment).length}</p><p className="mt-2 text-xs text-muted-foreground">Reviews with written feedback</p></div><div className="rounded-2xl border border-card-border bg-card p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Latest signal</p><p className="mt-3 display text-2xl font-bold">{reviews.data[0] ? dateLabel(reviews.data[0].createdAt).split(',')[0] : 'No date'}</p><p className="mt-2 text-xs text-muted-foreground">Most recent customer note</p></div></section><section className="rounded-2xl border border-card-border bg-card shadow-sm"><div className="border-b border-border px-5 py-4"><h2 className="display text-lg font-bold">Recent customer notes</h2></div><div className="divide-y divide-border">{reviews.data.map((review) => <div key={review.id} data-testid={`card-review-${review.id}`} className="flex gap-4 p-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">{review.userName?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'C'}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div><span data-testid={`text-review-customer-${review.id}`} className="font-bold">{review.userName || 'Customer'}</span><span className="ml-3 text-xs text-muted-foreground">{dateLabel(review.createdAt)}</span></div><span data-testid={`text-review-rating-${review.id}`} className="rounded-lg bg-accent px-2 py-1 text-xs font-bold text-accent-foreground">{review.rating} / 5</span></div><p data-testid={`text-review-comment-${review.id}`} className="mt-3 text-sm leading-6 text-muted-foreground">{review.comment || 'No written note from this visit.'}</p></div></div>)}</div></section></div>}</QueryState></div>;
}

function Shop() {
  const shops = useListBackendShops();
  const shop = shops.data?.[0];
  return <div className="page-in"><PageHeading eyebrow="Customer-facing presence" title="Shop profile" description="The details customers see when they discover and order from your business." action={<Button data-testid="button-edit-shop" variant="soft" disabled title="Shop profile updates are not exposed by the current generated client"><Pencil size={15} />Edit profile</Button>} /><QueryState loading={shops.isLoading} error={shops.isError} empty={!shops.isLoading && !shops.isError && !shop} onRetry={() => shops.refetch()}>{shop && <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm"><div className="relative h-52 bg-secondary">{shop.imageUrl ? <img data-testid="img-shop-cover" src={shop.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="paper-grid grid h-full place-items-center text-secondary-foreground/35"><Store size={55} /></div>}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-sidebar/75 to-transparent p-5 pt-16"><h2 data-testid="text-shop-name" className="display text-2xl font-bold text-white">{shop.name}</h2><p className="mt-1 text-sm text-white/75">{shop.category} · {shop.businessType}</p></div></div><div className="grid gap-5 p-5 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">About</p><p data-testid="text-shop-description" className="mt-2 text-sm leading-6">{shop.description || 'No description added yet.'}</p></div><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Address</p><p data-testid="text-shop-address" className="mt-2 text-sm leading-6">{shop.address}</p></div></div></section><section className="space-y-4"><div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="display text-lg font-bold">Service settings</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${shop.isOpen ? 'bg-secondary text-secondary-foreground' : 'bg-red-100 text-red-700'}`}>{shop.isOpen ? 'Open' : 'Closed'}</span></div><div className="mt-5 divide-y divide-border">{[['Delivery fee', money(shop.deliveryFee)], ['Minimum order', money(shop.minimumOrder)], ['Phone', shop.phone || 'Not listed'], ['Rating', shop.rating ? `${shop.rating.toFixed(1)} / 5 (${shop.reviewCount})` : 'Not rated']].map(([label, value]) => <div key={label} className="flex items-center justify-between py-3 text-sm"><span className="text-muted-foreground">{label}</span><span data-testid={`text-shop-${String(label).toLowerCase().replaceAll(' ', '-')}`} className="font-bold">{value}</span></div>)}</div></div><div className="rounded-2xl border border-primary/20 bg-primary/10 p-5"><div className="flex gap-3"><ShieldCheck className="shrink-0 text-primary" size={20} /><div><h3 className="font-bold">A trusted storefront</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">Keep hours, contact details, and your menu current to make ordering effortless for customers.</p></div></div></div></section></div>}</QueryState></div>;
}

function SettingsPage() {
  const [, setLocation] = useLocation();
  const me = useBackendMe({ query: { enabled: Boolean(getStoredToken()), queryKey: getBackendMeQueryKey() } });
  const user = me.data?.user;
  return <div className="page-in"><PageHeading eyebrow="Workspace control" title="Settings" description="Your account, access level, and the session that keeps this workspace private." /><div className="grid gap-6 xl:grid-cols-[1fr_.8fr]"><section className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="flex items-center gap-4 border-b border-border pb-6"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-lg font-bold text-secondary-foreground">{user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'JT'}</span><div><h2 data-testid="text-settings-name" className="display text-xl font-bold">{user?.name || 'Merchant team'}</h2><p data-testid="text-settings-email" className="text-sm text-muted-foreground">{user?.email || '—'}</p></div></div><div className="mt-5 space-y-1">{[['Role', titleCase(user?.role)], ['Phone', user?.phone || 'Not listed'], ['Member since', user?.createdAt ? dateLabel(user.createdAt).split(',')[0] : '—']].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm hover:bg-muted/60"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>)}</div></section><div className="space-y-4"><section className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="flex gap-3"><ShieldCheck className="text-secondary-foreground" size={20} /><div><h2 className="font-bold">Permissions</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Access inherited from your Jatek staff role.</p></div></div><div className="mt-5 flex flex-wrap gap-2">{(me.data?.permissions || []).length ? me.data?.permissions.map((permission) => <span key={permission} data-testid={`badge-permission-${permission}`} className="rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold">{titleCase(permission)}</span>) : <span className="text-sm text-muted-foreground">No permission details returned.</span>}</div></section><section className="rounded-2xl border border-red-200 bg-red-50 p-6"><h2 className="font-bold text-red-900">Sign out of this device</h2><p className="mt-1 text-sm leading-5 text-red-700">Clear the local session and return to the merchant sign-in screen.</p><Button data-testid="button-settings-sign-out" variant="danger" className="mt-5" onClick={() => { clearToken(); setLocation('/login'); }}><LogOut size={15} />Sign out</Button></section></div></div></div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/login" component={Login} />
    <Route path="/" component={() => <Guard><Dashboard /></Guard>} />
    <Route path="/orders" component={() => <Guard><Orders /></Guard>} />
    <Route path="/menu" component={() => <Guard><MenuPage /></Guard>} />
    <Route path="/reviews" component={() => <Guard><Reviews /></Guard>} />
    <Route path="/shop" component={() => <Guard><Shop /></Guard>} />
    <Route path="/settings" component={() => <Guard><SettingsPage /></Guard>} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>;
}