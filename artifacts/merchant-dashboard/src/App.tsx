import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, CircleAlert, Clock3,
  ExternalLink, LayoutDashboard, LogOut, Menu as MenuIcon, MessageSquareText, MoreHorizontal,
  Package, Pencil, Plus, RefreshCw, Search, Settings, ShieldCheck, ShoppingBag, Store, Tags,
  Trash2, TrendingUp, UtensilsCrossed, X, UploadCloud, Loader2, Camera,
} from 'lucide-react';
import {
  getBackendMeQueryKey, getGetBackendDashboardQueryKey, getGetMenuItemQueryKey,
  getListBackendOrdersQueryKey, getListBackendProductsPageQueryKey, getListBackendTodosQueryKey, getListBackendShopsQueryKey,
  useBackendLogin, useBackendMe, useCreateBackendTodo, useDeleteBackendTodo, useDeleteMenuItem,
  useGetBackendDashboard, useGetMenuItem, useListBackendOrders, useListBackendProductsPage,
  useListBackendReviews, useListBackendShops, useListBackendTodos, useListMenuCategories,
  useToggleBackendTodo, useUpdateOrderStatus, customFetch,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { clearToken, getStoredToken, storeToken, API_BASE_URL } from '@/lib/merchant-auth';
import './index.css';

import { useMutation } from '@tanstack/react-query';

const ENDPOINTS = {
  createProduct: '/api/backend/products',
  updateProduct: (id: number) => `/api/backend/products/${id}`,
  deleteProduct: (id: number) => `/api/backend/products/${id}`,
  updateShop: (id: number) => `/api/backend/shops/${id}`,
  uploadImage: '/api/storage/uploads/image',
  printReceipt: (id: number, token: string) => `${API_BASE_URL}/api/orders/${id}/receipt?token=${encodeURIComponent(token)}`,
  printInvoice: (id: number, token: string) => `${API_BASE_URL}/api/orders/${id}/invoice?token=${encodeURIComponent(token)}`,
};


function useCreateBackendProduct() {
  return useMutation({
    mutationFn: async (data: { restaurantId: number; name: string; price: number; menuItemCategoryId?: number; category?: string; description?: string; isAvailable?: boolean; imageUrl?: string }) => {
      return customFetch(ENDPOINTS.createProduct, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
  });
}

function useUpdateBackendProduct() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return customFetch(ENDPOINTS.updateProduct(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
  });
}

function useDeleteBackendProduct() {
  return useMutation({
    mutationFn: async (id: number) => {
      return customFetch(ENDPOINTS.deleteProduct(id), {
        method: 'DELETE',
      });
    },
  });
}

function useUpdateBackendShop() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return customFetch(ENDPOINTS.updateShop(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
  });
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: false } } });

const money = (value?: number | null) => `${(value ?? 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
const compactMoney = (value?: number | null) => `${Math.round(value ?? 0).toLocaleString('fr-MA')} MAD`;
const dateLabel = (value?: string | null) => value ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const roleMap: Record<string, string> = { admin: 'Administrateur', super_admin: 'Super Administrateur', manager: 'Manager', restaurant_owner: 'Propriétaire', employee: 'Employé', customer: 'Client', driver: 'Livreur' };
const statusMap: Record<string, string> = { pending: 'En attente', accepted: 'Acceptée', confirmed: 'Confirmée', preparing: 'En préparation', ready: 'Prête', driver_at_restaurant: 'Livreur arrivé', picked_up: 'Récupérée', en_route: 'En route', out_for_delivery: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée' };
const formatRôle = (val?: string | null) => val ? (roleMap[val] || val.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())) : '—';
const formatStatus = (val?: string | null) => val ? (statusMap[val] || val.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())) : '—';
const formatPermission = (val?: string | null) => val ? val.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : '—';

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
  const tone = status === 'delivered' ? 'bg-secondary text-secondary-foreground' : status === 'cancelled' ? 'bg-red-100 text-red-700' : status === 'pending' ? 'bg-accent text-accent-foreground' : 'bg-fuchsia-100 text-fuchsia-700';
  return <span data-testid={`status-${status}`} className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em] ${tone}`}>{formatStatus(status)}</span>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} aria-hidden="true" />;
}

function QueryState({ loading, error, empty, onRetry, children }: { loading?: boolean; error?: boolean; empty?: boolean; onRetry?: () => void; children: ReactNode }) {
  if (loading) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="col-span-full h-72" /></div>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center"><CircleAlert className="mx-auto mb-3 text-red-600" /><h3 className="display text-lg font-bold text-red-900">Impossible de charger cette vue</h3><p className="mt-1 text-sm text-red-700">L'espace distant n'a pas répondu. Vos données n'ont pas été modifiées.</p>{onRetry && <Button data-testid="button-retry" className="mt-5" onClick={onRetry}><RefreshCw size={15} />Réessayer</Button>}</div>;
  if (empty) return <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center"><Package className="mx-auto mb-3 text-muted-foreground" /><h3 className="display text-lg font-bold">Rien ici pour le moment</h3><p className="mt-1 text-sm text-muted-foreground">Quand l'espace aura quelque chose à afficher, cela apparaîtra ici.</p></div>;
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
        <div className="relative"><Brand light /><p className="mt-20 max-w-xs text-4xl font-bold leading-[1.08] display">Le calme au cœur d'une cuisine animée.</p><p className="mt-5 max-w-sm text-sm leading-6 text-sidebar-foreground/65">Commandes, menu et activité de la boutique, dans un espace clair.</p></div>
        <div className="relative flex items-center gap-3 text-xs text-sidebar-foreground/55"><ShieldCheck size={15} />Espace privé partenaires Jatek</div>
      </section>
      <section className="p-7 sm:p-12">
        <div className="mb-10 md:hidden"><Brand /></div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Espace Commerçant</p>
        <h1 className="mt-3 display text-3xl font-bold tracking-tight">Heureux de vous revoir.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Connectez-vous pour continuer le service.</p>
        <form onSubmit={submit} className="mt-9 space-y-5">
          <label className="block"><span className="mb-2 block text-sm font-semibold">Email professionnel</span><input data-testid="input-email" required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@restaurant.com" className="h-12 w-full rounded-xl border border-input bg-background px-4 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">Mot de passe</span><input data-testid="input-password" required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Votre mot de passe" className="h-12 w-full rounded-xl border border-input bg-background px-4 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
          {login.isError && <div data-testid="status-login-error" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><CircleAlert size={17} className="mt-0.5 shrink-0" />Email ou mot de passe incorrect. Vérifiez vos informations et réessayez.</div>}
          <Button data-testid="button-sign-in" type="submit" className="h-12 w-full" disabled={login.isPending}>{login.isPending ? 'Connexion en cours…' : 'Accéder à l\'espace'}<ArrowUpRight size={16} /></Button>
        </form>
        <p className="mt-8 text-center text-xs text-muted-foreground">Besoin d'accès ? Demandez au propriétaire de votre boutique Jatek d'ajouter votre compte.</p>
      </section>
    </div>
  </main>;
}

function Brand({ light = false }: { light?: boolean }) {
  const logoUrl = `${import.meta.env.BASE_URL}jatek-logo.png`;
  return (
    <Link href="/" data-testid="link-brand" className="inline-flex items-center" aria-label="Logo Jatek">
      <img src={logoUrl} alt="Jatek" className="h-9 w-auto object-contain sm:h-10" />
    </Link>
  );
}

const navItems = [
  { 
    href: '/', label: 'Aperçu', icon: LayoutDashboard,
    activeCls: 'bg-rose-500 text-white shadow-lg shadow-rose-500/20',
    hoverCls: 'hover:bg-rose-500/15 hover:text-rose-100 focus-visible:ring-rose-400'
  },
  { 
    href: '/orders', label: 'Commandes', icon: ShoppingBag,
    activeCls: 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/20',
    hoverCls: 'hover:bg-fuchsia-500/15 hover:text-fuchsia-100 focus-visible:ring-fuchsia-400'
  },
  { 
    href: '/menu', label: 'Menu', icon: UtensilsCrossed,
    activeCls: 'bg-pink-600 text-white shadow-lg shadow-pink-600/20',
    hoverCls: 'hover:bg-pink-500/15 hover:text-pink-100 focus-visible:ring-pink-400'
  },
  { 
    href: '/reviews', label: 'Avis clients', icon: MessageSquareText,
    activeCls: 'bg-purple-500 text-white shadow-lg shadow-purple-500/20',
    hoverCls: 'hover:bg-purple-500/15 hover:text-purple-100 focus-visible:ring-purple-400'
  },
  { 
    href: '/shop', label: 'Boutique', icon: Store,
    activeCls: 'bg-pink-600 text-white shadow-lg shadow-pink-600/20',
    hoverCls: 'hover:bg-pink-500/15 hover:text-pink-100 focus-visible:ring-pink-400'
  },
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
      <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-sidebar-foreground/40">Espace de travail</div>
      <nav className="mt-3 space-y-1">{navItems.map(({ href, label, icon: Icon, activeCls, hoverCls }) => <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${active(href) ? activeCls : `text-sidebar-foreground/65 ${hoverCls}`}`}><Icon size={18} strokeWidth={active(href) ? 2.4 : 1.8} /><span>{label}</span>{label === 'Commandes' && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active(href) ? 'bg-white/25 text-white' : 'bg-fuchsia-500/20 text-fuchsia-200'}`}>en direct</span>}</Link>)}</nav>
      <div className="mt-auto">
        <div className="mb-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-3"><div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-[#74d4a4]" />{me.isLoading ? 'Vérification de la connexion' : 'Connecté à Jatek'}</div><p className="mt-2 text-[11px] leading-4 text-sidebar-foreground/45">Synchronisation en direct activée. Changements visibles par toute l'équipe.</p></div>
        <Link href="/settings" data-testid="link-nav-settings" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:ring-sidebar-border ${active('/settings') ? 'bg-sidebar-border text-sidebar-foreground shadow-sm' : 'text-sidebar-foreground/65 hover:bg-sidebar-border/50 hover:text-sidebar-foreground'}`}><Settings size={18} />Paramètres</Link>
        <button data-testid="button-sign-out" onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-sidebar-foreground/65 outline-none transition hover:bg-red-500/15 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"><LogOut size={18} />Se déconnecter</button>
      </div>
    </aside>
    {mobileOpen && <button aria-label="Close navigation" data-testid="button-overlay-menu" className="fixed inset-0 z-30 bg-sidebar/35 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <div className="lg:pl-[248px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-md sm:px-8">
        <button data-testid="button-open-menu" className="rounded-xl p-2 hover:bg-muted lg:hidden" onClick={() => setMobileOpen(true)}><MenuIcon size={21} /></button>
        <div className="hidden text-xs font-semibold text-muted-foreground sm:block">Espace Commerçant <span className="mx-2 text-border">/</span> {location === '/' ? 'Aperçu' : location.slice(1).replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
        <div className="ml-auto flex items-center gap-3"><button data-testid="button-notifications" className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-muted"><Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" /></button><div className="hidden h-7 w-px bg-border sm:block" /><div className="flex items-center gap-2"><span data-testid="text-user-initials" className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">{user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'JT'}</span><div className="hidden leading-tight sm:block"><div data-testid="text-user-name" className="text-sm font-bold">{user?.name || 'Équipe commerçant'}</div><div className="text-[11px] text-muted-foreground">{formatRôle(user?.role) || 'Membre de l\'équipe'}</div></div><ChevronDown size={15} className="hidden text-muted-foreground sm:block" /></div></div>
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
  if (me.isError) return <div className="grid min-h-[100dvh] place-items-center bg-background p-6"><div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center"><ShieldCheck className="mx-auto mb-4 text-red-600" /><h1 className="display text-xl font-bold">Session expirée</h1><p className="mt-2 text-sm text-red-700">Votre connexion n'est plus valide. Reconnectez-vous pour continuer.</p><Button data-testid="button-return-login" className="mt-5" onClick={() => { clearToken(); setLocation('/login'); }}>Retour à la connexion</Button></div></div>;
  return <Shell>{children}</Shell>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p><h1 data-testid="text-page-title" className="mt-2 display text-3xl font-bold tracking-[-.04em] sm:text-4xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div>{action}</div>;
}

function StatCard({ label, value, detail, icon: Icon, tone = 'coral' }: { label: string; value: string; detail: string; icon: typeof TrendingUp; tone?: 'coral' | 'mint' | 'yellow' | 'ink' }) {
  const tones = { coral: 'bg-primary/10 text-primary', mint: 'bg-secondary text-secondary-foreground', yellow: 'bg-accent text-accent-foreground', ink: 'bg-sidebar text-sidebar-foreground' };
  return <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between"><span className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}><Icon size={17} /></span></div><div data-testid={`text-stat-${label.toLowerCase().replaceAll(' ', '-')}`} className="mt-5 display text-3xl font-bold tracking-[-.04em]">{value}</div><div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">{detail}</div></div>;
}


function ImageUploader({ label, value, onChange, onUploading, kind = 'image', className = '' }: { label: string, value?: string, onChange: (url: string) => void, onUploading?: (isUploading: boolean) => void, kind?: string, className?: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Format non supporté (JPEG, PNG, WebP, GIF)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('L\'image dépasse 5 Mo');
      return;
    }

    setError('');
    setUploading(true);
    if (onUploading) onUploading(true);

    try {
      const response = await customFetch<{ url: string }>(ENDPOINTS.uploadImage, {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
          'X-Jatek-Media-Kind': kind
        },
        body: file
      });
      onChange(response.url);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du téléversement');
    } finally {
      setUploading(false);
      if (onUploading) onUploading(false);
    }
  };

  return (
    <div className={className}>
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <div className="relative overflow-hidden rounded-xl border border-input bg-background transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
        {value ? (
          <div className="group relative aspect-video w-full bg-muted">
            <img src={value} alt="Aperçu" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
               <button type="button" aria-label={`Supprimer ${label.toLowerCase()}`} onClick={() => onChange('')} className="rounded-lg bg-red-500 p-2 text-white"><X size={18} /></button>
            </div>
          </div>
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-muted/30 p-4 text-muted-foreground">
            {uploading ? <Loader2 className="animate-spin" size={24} /> : <UploadCloud size={24} />}
            <span className="text-center text-xs font-medium">{uploading ? 'Téléversement…' : 'Ajoutez une image depuis votre appareil'}</span>
          </div>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          <UploadCloud size={16} />Galerie / fichier
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={handleFile} disabled={uploading} />
        </label>
        <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          <Camera size={16} />Appareil photo
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" className="sr-only" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
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
    <PageHeading eyebrow="Aujourd'hui dans votre boutique" title="Passez un bon service." description="Un aperçu rapide de la semaine, des commandes en cours à l'argent gagné." action={<Button data-testid="button-refresh-dashboard" variant="soft" onClick={() => { dashboard.refetch(); todos.refetch(); }}><RefreshCw size={15} />Actualiser</Button>} />
    <QueryState loading={dashboard.isLoading} error={dashboard.isError} onRetry={() => dashboard.refetch()}>{data && <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="En cours" value={`${data.inProgressOrders}`} detail="Commandes nécessitant attention" icon={Clock3} tone="coral" />
        <StatCard label="Livrées" value={`${data.deliveredOrders}`} detail="Terminées sur la période" icon={Check} tone="mint" />
        <StatCard label="Gains boutique" value={compactMoney(data.merchantEarning)} detail={`${compactMoney(data.totalEarned)} valeur brute`} icon={TrendingUp} tone="yellow" />
        <StatCard label="Ruptures de stock" value={`${data.outOfStockProducts}`} detail={`sur ${data.totalProducts} articles`} icon={Tags} tone="ink" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Rythme des commandes</p><h2 className="mt-1 display text-xl font-bold">Cette semaine</h2></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">7 derniers jours</span></div><div className="mt-8 flex h-56 items-end gap-2 sm:gap-4">{(data.ordersChart || []).map((entry) => <div key={entry.label} className="flex min-w-0 flex-1 flex-col items-center gap-2"><span className="text-[10px] font-bold text-muted-foreground">{entry.value}</span><div className="flex h-40 w-full items-end rounded-lg bg-muted/60"><div data-testid={`bar-orders-${entry.label}`} className="w-full rounded-lg bg-primary transition-all" style={{ height: `${Math.max((entry.value / chartMax) * 100, 5)}%` }} /></div><span className="truncate text-[10px] font-semibold text-muted-foreground">{entry.label}</span></div>)}</div></section>
         <section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Votre liste</p><h2 className="mt-1 display text-xl font-bold">Notes de cuisine</h2></div><BookOpen className="text-primary" size={20} /></div><form onSubmit={submitTodo} className="mt-5 flex gap-2"><input data-testid="input-todo" value={todoText} onChange={(event) => setTodoText(event.target.value)} placeholder="Ajouter un rappel" className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" /><Button data-testid="button-add-todo" type="submit" className="shrink-0 px-3"><Plus size={16} /></Button></form><div className="mt-4 space-y-1">{todos.isLoading ? <><Skeleton className="h-10" /><Skeleton className="h-10" /></> : (todos.data || []).length === 0 ? <p className="py-7 text-center text-sm text-muted-foreground">Votre liste est vide.</p> : (todos.data || []).slice(0, 5).map((todo) => <div key={todo.id} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/60"><button data-testid={`button-toggle-todo-${todo.id}`} onClick={() => toggleTodo.mutate({ id: todo.id, data: { done: !todo.done } }, { onSuccess: () => client.invalidateQueries({ queryKey: getListBackendTodosQueryKey() }) })} className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${todo.done ? 'border-secondary bg-secondary text-secondary-foreground' : 'border-border'}`}>{todo.done && <Check size={13} />}</button><span data-testid={`text-todo-${todo.id}`} className={`min-w-0 flex-1 truncate text-sm ${todo.done ? 'text-muted-foreground line-through' : 'font-medium'}`}>{todo.text}</span><button data-testid={`button-delete-todo-${todo.id}`} onClick={() => deleteTodo.mutate({ id: todo.id }, { onSuccess: () => client.invalidateQueries({ queryKey: getListBackendTodosQueryKey() }) })} className="invisible rounded-lg p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600 group-hover:visible"><Trash2 size={14} /></button></div>)}</div></section>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Répartition financière</p><h2 className="mt-1 display text-xl font-bold">Où va la valeur des commandes</h2></div><Activity size={19} className="text-primary" /></div><div className="mt-5 grid grid-cols-2 gap-3">{[['Gain commerçant', data.merchantEarning], ['Gain livreur', data.deliveryEarning], ['Taxes', data.totalOrderTax], ['Commission Jatek', data.totalCommission]].map(([label, value]) => <div key={label as string} className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{label as string}</p><p data-testid={`text-money-${(label as string).toLowerCase().replaceAll(' ', '-')}`} className="mt-1 text-lg font-bold">{money(value as number)}</p></div>)}</div></section>
        <section className="rounded-2xl border border-card-border bg-sidebar p-5 text-sidebar-foreground shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-sidebar-foreground/50">Activité boutique</p><h2 className="mt-1 display text-xl font-bold">{(shops.data || [])[0]?.name || 'Votre boutique'}</h2></div><Store size={20} className="text-accent" /></div><div className="mt-6 flex items-end justify-between"><div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#74d4a4]" /><span className="text-sm font-semibold">{(shops.data || [])[0]?.isOpen ? 'Ouvert aux commandes' : 'Actuellement fermé'}</span></div><p className="mt-2 text-xs text-sidebar-foreground/50">{(shops.data || [])[0]?.address || 'Détails en cours de chargement'}</p></div><Link href="/shop" data-testid="link-shop-profile" className="inline-flex items-center gap-1.5 rounded-xl bg-sidebar-accent px-3 py-2 text-xs font-bold hover:bg-sidebar-accent/70">Voir la boutique <ExternalLink size={13} /></Link></div></section>
      </div>
    </div>}</QueryState>
  </div>;
}

function Orders() {
  const [status, setStatus] = useState('toutes');
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  
  const orders = useListBackendOrders({ status: status === 'toutes' ? undefined : status, search: search || undefined, limit: 100 });
  const updateStatus = useUpdateOrderStatus();
  const client = useQueryClient();
  
  const nextStatus = (current: string) => current === 'pending' ? 'accepted' : (current === 'accepted' || current === 'confirmed') ? 'preparing' : current === 'preparing' ? 'ready' : null;
  const selectedOrder = (orders.data || []).find(o => o.id === selectedOrderId);

  const printReceipt = (id: number) => {
    const token = getStoredToken();
    if (token) window.open(ENDPOINTS.printReceipt(id, token), '_blank', 'noopener,noreferrer');
  };

  const printInvoice = (id: number) => {
    const token = getStoredToken();
    if (token) window.open(ENDPOINTS.printInvoice(id, token), '_blank', 'noopener,noreferrer');
  };

  return <div className="page-in"><PageHeading eyebrow="Tableau de service" title="Commandes" description="Gardez les relais fluides. Mettez à jour les commandes dès que la cuisine a terminé." action={<Button data-testid="button-refresh-orders" variant="soft" onClick={() => orders.refetch()}><RefreshCw size={15} />Actualiser</Button>} />
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-card-border bg-card p-3 shadow-sm sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input data-testid="input-order-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Chercher une référence ou un client" className="h-10 w-full rounded-xl bg-muted/60 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" /></div><div className="no-scrollbar flex gap-2 overflow-x-auto">{['toutes', 'pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled'].map((filter) => <button key={filter} data-testid={`button-filter-${filter}`} onClick={() => setStatus(filter)} className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition ${status === filter ? 'bg-sidebar text-sidebar-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'}`}>{formatStatus(filter)}</button>)}</div></div>
    <QueryState loading={orders.isLoading} error={orders.isError} empty={!orders.isLoading && !orders.isError && (orders.data || []).length === 0} onRetry={() => orders.refetch()}>
      <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm"><div className="hidden grid-cols-[1.25fr_1fr_.8fr_.7fr_1fr] gap-4 border-b border-border bg-muted/50 px-5 py-3 text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground md:grid"><span>Commande</span><span>Client</span><span>Placée</span><span>Total</span><span className="text-right">Statut</span></div><div className="divide-y divide-border">{(orders.data || []).map((order) => { const next = nextStatus(order.status); return <div key={order.id} data-testid={`row-order-${order.id}`} onClick={() => setSelectedOrderId(order.id)} className="grid cursor-pointer gap-3 px-5 py-4 transition hover:bg-muted/30 md:grid-cols-[1.25fr_1fr_.8fr_.7fr_1fr] md:items-center"><div><div className="flex items-center gap-2"><span className="font-bold">#{order.reference || order.id}</span><span className="text-[10px] text-muted-foreground">ID {order.id}</span></div><p className="mt-1 text-xs text-muted-foreground">{order.items?.length || 0} article{order.items?.length === 1 ? '' : 's'} · {order.restaurantName}</p></div><div className="text-sm font-medium">{order.userName || 'Client'}<p className="mt-1 text-xs text-muted-foreground md:hidden">{dateLabel(order.createdAt)}</p></div><div className="hidden text-xs text-muted-foreground md:block">{dateLabel(order.createdAt)}</div><div className="font-bold">{money(order.total)}</div><div className="flex items-center justify-between gap-2 md:justify-end">{next && <Button data-testid={`button-advance-order-${order.id}`} variant="soft" className="px-2.5 py-2 text-xs" disabled={updateStatus.isPending} onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: order.id, data: { status: next as never } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListBackendOrdersQueryKey({ status: status === 'toutes' ? undefined : status, search: search || undefined, limit: 100 }) }); client.invalidateQueries({ queryKey: getGetBackendDashboardQueryKey({ range: 'week' }) }); } })}}>{next === 'accepted' ? 'Accepter' : `Marquer ${formatStatus(next).toLowerCase()}`}<ArrowUpRight size={13} /></Button>}<StatusPill status={order.status} /></div></div>; })}</div></section>
    </QueryState>

    {selectedOrder && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/45 p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setSelectedOrderId(null); }}>
        <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-card shadow-2xl">
          <button onClick={() => setSelectedOrderId(null)} className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button>
          <div className="border-b border-border p-6">
            <h2 className="text-xl font-bold">Commande #{selectedOrder.reference || selectedOrder.id}</h2>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span>{dateLabel(selectedOrder.createdAt)}</span>
              <StatusPill status={selectedOrder.status} />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Client</h3>
                <p className="mt-1 font-medium">{selectedOrder.userName}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.deliveryAddress}</p>
                {selectedOrder.notes && <div className="mt-3 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-900"><span className="font-bold">Notes:</span> {selectedOrder.notes}</div>}
              </div>
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Paiement</h3>
                <p className="mt-1 font-medium capitalize">{String(selectedOrder.paymentMethod) === 'cash' ? 'Espèces' : String(selectedOrder.paymentMethod) === 'card' ? 'Carte bancaire' : 'En ligne'}</p>
              </div>
            </div>
            <div className="mt-8">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Articles</h3>
              <div className="space-y-3">
                {selectedOrder.items?.map(item => (
                  <div key={item.id} className="flex justify-between gap-4 text-sm">
                    <div><span className="font-bold">{item.quantity}×</span> {item.menuItemName}<p className="text-xs text-muted-foreground">{money(item.unitPrice)} l’unité</p></div>
                    <div className="font-medium">{money(item.totalPrice)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Sous-total</span><span>{money(selectedOrder.subtotal)}</span></div>
              {(selectedOrder.discountAmount || 0) > 0 && <div className="flex justify-between text-red-600"><span>Remise</span><span>-{money(selectedOrder.discountAmount)}</span></div>}
              <div className="flex justify-between text-muted-foreground"><span>Livraison</span><span>{money(selectedOrder.deliveryFee)}</span></div>
              {(selectedOrder.vatAmount || 0) > 0 && <div className="flex justify-between text-muted-foreground"><span>TVA ({(selectedOrder.vatRate || 0)}%)</span><span>{money(selectedOrder.vatAmount)}</span></div>}
              {(selectedOrder.serviceFee || 0) > 0 && <div className="flex justify-between text-muted-foreground"><span>Frais de service</span><span>{money(selectedOrder.serviceFee)}</span></div>}
              <div className="flex justify-between pt-2 text-base font-bold"><span>Total</span><span>{money(selectedOrder.total)}</span></div>
            </div>
          </div>
          <div className="border-t border-border bg-muted/30 p-6">
            <div className="flex flex-wrap gap-3">
              {nextStatus(selectedOrder.status) && (
                <Button disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: selectedOrder.id, data: { status: nextStatus(selectedOrder.status) as never } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListBackendOrdersQueryKey() }); setSelectedOrderId(null); } })}>
                  {nextStatus(selectedOrder.status) === 'accepted' ? 'Accepter' : `Marquer ${formatStatus(nextStatus(selectedOrder.status)).toLowerCase()}`}
                </Button>
              )}
              {['pending', 'accepted', 'confirmed', 'preparing'].includes(selectedOrder.status) && (
                <Button variant="danger" disabled={updateStatus.isPending} onClick={() => { if(window.confirm('Voulez-vous vraiment annuler cette commande ?')) updateStatus.mutate({ id: selectedOrder.id, data: { status: 'cancelled' as never } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListBackendOrdersQueryKey() }); setSelectedOrderId(null); } }) }}>Annuler la commande</Button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button variant="soft" onClick={() => printReceipt(selectedOrder.id)}>Ticket cuisine</Button>
                <Button variant="soft" onClick={() => printInvoice(selectedOrder.id)}>Facture / PDF</Button>
              </div>
            </div>
            <p className="mt-3 text-right text-xs text-muted-foreground">La boîte d'impression permet de choisir « Enregistrer au format PDF ».</p>
          </div>
        </div>
      </div>
    )}
  </div>;
}



function MenuPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('toutes');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [addData, setAddData] = useState<any>({ name: '', price: 0, category: '', description: '', isAvailable: true, imageUrl: '' });
  
  const [editData, setEditData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const products = useListBackendProductsPage({ search: search || undefined, category: category === 'toutes' ? undefined : category, page: 1, pageSize: 100 });
  const categories = useListMenuCategories();
  const detail = useGetMenuItem(selectedId ?? 0, { query: { enabled: selectedId !== null, queryKey: getGetMenuItemQueryKey(selectedId ?? 0) } });
  
  const create = useCreateBackendProduct();
  const update = useUpdateBackendProduct();
  const remove = useDeleteBackendProduct();
  
  const shops = useListBackendShops();
  const shopId = shops.data?.[0]?.id;

  const client = useQueryClient();
  const items = products.data?.items || [];
  
  const startAdd = () => {
    setAddData({ name: '', price: 0, category: categories.data?.[0]?.name || '', description: '', isAvailable: true, imageUrl: '' });
    setIsAdding(true);
  };

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    create.mutate({
      restaurantId: shopId,
      name: addData.name,
      price: addData.price,
      category: addData.category,
      description: addData.description,
      isAvailable: addData.isAvailable,
      imageUrl: addData.imageUrl
    }, {
      onSuccess: () => {
        setIsAdding(false);
        client.invalidateQueries({ queryKey: getListBackendProductsPageQueryKey() });
        client.invalidateQueries({ queryKey: getGetBackendDashboardQueryKey() });
      }
    });
  };

  const startEdit = () => {
    if (!detail.data) return;
    setEditData({
      name: detail.data.name,
      price: detail.data.price,
      category: detail.data.category,
      description: detail.data.description || '',
      isAvailable: detail.data.isAvailable,
      imageUrl: detail.data.imageUrl || ''
    });
    setIsEditing(true);
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail.data || !editData) return;
    update.mutate({ id: detail.data.id, data: editData }, {
      onSuccess: () => {
        setIsEditing(false);
        client.invalidateQueries({ queryKey: getListBackendProductsPageQueryKey() });
        client.invalidateQueries({ queryKey: getGetMenuItemQueryKey(detail.data!.id) });
      }
    });
  };

  return <div className="page-in">
    <PageHeading eyebrow="Votre offre" title="Menu" description={`${products.data?.total ?? 0} articles dans le catalogue.`} action={<Button data-testid="button-add-product" onClick={startAdd} disabled={!shopId}><Plus size={16} />Ajouter un article</Button>} />
    
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-card-border bg-card p-3 shadow-sm sm:flex-row">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
        <input data-testid="input-menu-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Chercher dans le menu" className="h-10 w-full rounded-xl bg-muted/60 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        <button data-testid="button-category-tous" onClick={() => setCategory('toutes')} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold ${category === 'toutes' ? 'bg-sidebar text-sidebar-foreground' : 'bg-muted text-muted-foreground'}`}>Tous les articles</button>
        {(categories.data || []).map((item) => <button key={item.id} data-testid={`button-category-${item.id}`} onClick={() => setCategory(item.name)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold ${category === item.name ? 'bg-sidebar text-sidebar-foreground' : 'bg-muted text-muted-foreground'}`}>{item.name}</button>)}
      </div>
    </div>
    
    <QueryState loading={products.isLoading} error={products.isError} empty={!products.isLoading && !products.isError && items.length === 0} onRetry={() => products.refetch()}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((product) => (
          <div key={product.id} data-testid={`card-product-${product.id}`} className={`flex flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm transition hover:shadow-md ${!product.isAvailable ? 'opacity-60 grayscale-[0.5]' : ''}`}>
            {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-32 w-full object-cover" /> : <div className="flex h-32 w-full items-center justify-center bg-muted/50 text-muted-foreground"><UtensilsCrossed size={32} className="opacity-20" /></div>}
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold leading-tight">{product.name}</h3>
                <span className="rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">{product.category}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{product.description || 'Aucune description ajoutée pour le moment.'}</p>
              <div className="mt-auto pt-4 flex items-center justify-between">
                <span className="font-bold">{money(product.price)}</span>
                <div className="flex gap-2">
                  <button data-testid={`button-edit-product-${product.id}`} onClick={() => setSelectedId(product.id)} className="rounded-xl border border-border px-3 text-muted-foreground hover:bg-muted"><Pencil size={15} /></button>
                  <Button data-testid={`button-toggle-product-${product.id}`} variant={product.isAvailable ? 'soft' : 'primary'} className="flex-1 py-2 text-xs" disabled={update.isPending} onClick={() => update.mutate({ id: product.id, data: { isAvailable: !product.isAvailable } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListBackendProductsPageQueryKey() }); client.invalidateQueries({ queryKey: getGetBackendDashboardQueryKey() }); } })}>
                    {product.isAvailable ? 'Mettre en pause' : 'Rendre disponible'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </QueryState>

    {isAdding && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/45 p-4 overflow-y-auto" onClick={(event) => { if (event.target === event.currentTarget) setIsAdding(false); }}>
        <div className="relative w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold">Ajouter un nouvel article</h2>
            <button type="button" data-testid="button-close-add-product" onClick={() => setIsAdding(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button>
          </div>
          {create.isError && <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">Échec de l'ajout. Veuillez réessayer.</div>}
          <form onSubmit={submitAdd} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Nom</span>
                <input required value={addData.name} onChange={e => setAddData({...addData, name: e.target.value})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Prix (MAD)</span>
                <input required type="number" step="0.01" min="0" value={addData.price} onChange={e => setAddData({...addData, price: Number(e.target.value)})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary" />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Catégorie</span>
              <select required value={addData.category} onChange={e => setAddData({...addData, category: e.target.value})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary">
                <option value="" disabled>Sélectionner une catégorie</option>
                {(categories.data || []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Description</span>
              <textarea rows={3} value={addData.description} onChange={e => setAddData({...addData, description: e.target.value})} className="w-full rounded-xl border border-input bg-background p-3 outline-none focus:border-primary" />
            </label>
            <ImageUploader label="Image du produit" kind="product_image" value={addData.imageUrl} onChange={url => setAddData({...addData, imageUrl: url})} onUploading={setIsUploading} />
            <label className="flex items-center gap-3 rounded-xl border border-border p-4">
              <input type="checkbox" checked={addData.isAvailable} onChange={e => setAddData({...addData, isAvailable: e.target.checked})} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
              <div>
                <div className="text-sm font-semibold">Disponible à la commande</div>
                <div className="text-xs text-muted-foreground">Les clients peuvent commander cet article immédiatement.</div>
              </div>
            </label>
            <div className="mt-6 flex justify-end gap-3 border-t border-border pt-6">
              <Button type="button" variant="quiet" onClick={() => setIsAdding(false)}>Annuler</Button>
              <Button type="submit" disabled={create.isPending || isUploading}>{create.isPending ? 'Ajout...' : 'Ajouter un article'}</Button>
            </div>
          </form>
        </div>
      </div>
    )}

    {selectedId !== null && detail.data && !isAdding && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/45 p-4 overflow-y-auto" onClick={(event) => { if (event.target === event.currentTarget) { setSelectedId(null); setIsEditing(false); } }}>
        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl">
          {detail.isLoading ? <div className="p-8 text-center text-muted-foreground">Chargement de l'article...</div> : isEditing && editData ? (
             <div className="p-6">
               <div className="mb-6 flex items-center justify-between">
                 <h2 className="text-xl font-bold">Modifier les détails</h2>
                 <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button>
               </div>
               {update.isError && <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">Échec de la mise à jour.</div>}
               <form onSubmit={submitEdit} className="space-y-4">
                 <div className="grid gap-4 sm:grid-cols-2">
                   <label className="block">
                     <span className="mb-2 block text-sm font-semibold">Nom</span>
                     <input required value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary" />
                   </label>
                   <label className="block">
                     <span className="mb-2 block text-sm font-semibold">Prix (MAD)</span>
                     <input required type="number" step="0.01" min="0" value={editData.price} onChange={e => setEditData({...editData, price: Number(e.target.value)})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary" />
                   </label>
                 </div>
                 <label className="block">
                   <span className="mb-2 block text-sm font-semibold">Catégorie</span>
                   <select required value={editData.category} onChange={e => setEditData({...editData, category: e.target.value})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary">
                     <option value="" disabled>Sélectionner une catégorie</option>
                     {(categories.data || []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                   </select>
                 </label>
                 <label className="block">
                   <span className="mb-2 block text-sm font-semibold">Description</span>
                   <textarea rows={3} value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} className="w-full rounded-xl border border-input bg-background p-3 outline-none focus:border-primary" />
                 </label>
                 <ImageUploader label="Image du produit" kind="product_image" value={editData.imageUrl} onChange={url => setEditData({...editData, imageUrl: url})} onUploading={setIsUploading} />
                 <div className="mt-6 flex justify-end gap-3 border-t border-border pt-6">
                   <Button type="button" variant="quiet" onClick={() => setIsEditing(false)}>Annuler</Button>
                   <Button type="submit" disabled={update.isPending || isUploading}>{update.isPending ? 'Enregistrement...' : 'Enregistrer'}</Button>
                 </div>
               </form>
             </div>
          ) : (
             <>
               {detail.data.imageUrl ? <img src={detail.data.imageUrl} alt={detail.data.name} className="h-64 w-full object-cover" /> : <div className="flex h-64 w-full items-center justify-center bg-muted/50 text-muted-foreground"><UtensilsCrossed size={48} className="opacity-20" /></div>}
               <button onClick={() => setSelectedId(null)} className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"><X size={18} /></button>
               <div className="p-6">
                 <div className="flex items-start justify-between gap-4">
                   <div>
                     <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">{detail.data.category}</p>
                     <h2 className="mt-1 display text-2xl font-bold">{detail.data.name}</h2>
                   </div>
                   <span className="text-xl font-bold">{money(detail.data.price)}</span>
                 </div>
                 <p className="mt-4 text-sm leading-6 text-muted-foreground">{detail.data.description || 'Aucune description ajoutée pour le moment.'}</p>
                 <div className="mt-8 flex items-center justify-between rounded-xl bg-muted/50 p-4">
                   <div><div className="text-sm font-bold">Disponibilité</div><div className="text-xs text-muted-foreground">Modifications appliquées immédiatement au menu client.</div></div>
                   <div className={`text-sm font-bold ${detail.data.isAvailable ? 'text-primary' : 'text-muted-foreground'}`}>{detail.data.isAvailable ? 'Oui' : 'Non'}</div>
                 </div>
                 <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                   <Button variant="soft" className="flex-1" onClick={startEdit}><Pencil size={15} /> Modifier les détails</Button>
                   <Button data-testid="button-modal-toggle-product" className="flex-1" disabled={update.isPending} onClick={() => update.mutate({ id: detail.data!.id, data: { isAvailable: !detail.data!.isAvailable } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListBackendProductsPageQueryKey() }); client.invalidateQueries({ queryKey: getGetMenuItemQueryKey(detail.data!.id) }); } })}>
                     {detail.data.isAvailable ? 'Mettre en pause' : 'Rendre disponible'}
                   </Button>
                 </div>
                 <div className="mt-6 border-t border-border pt-6">
                   <Button data-testid="button-delete-product" variant="danger" disabled={remove.isPending} onClick={() => { if (window.confirm('Supprimer cet article de votre catalogue ?')) remove.mutate(detail.data!.id, { onSuccess: () => { setSelectedId(null); setIsEditing(false); client.invalidateQueries({ queryKey: getListBackendProductsPageQueryKey() }); } }); }}>
                     Supprimer
                   </Button>
                 </div>
               </div>
             </>
          )}
        </div>
      </div>
    )}
  </div>;
}



function Reviews() {
  const reviews = useListBackendReviews();
  const average = useMemo(() => { const values = reviews.data || []; return values.length ? (values.reduce((sum, review) => sum + review.rating, 0) / values.length).toFixed(1) : '—'; }, [reviews.data]);
  return <div className="page-in"><PageHeading eyebrow="Voix des clients" title="Avis clients" description="Un espace pour comprendre ce que les habitués aiment et améliorer l'expérience." action={<Button data-testid="button-refresh-reviews" variant="soft" onClick={() => reviews.refetch()}><RefreshCw size={15} />Actualiser</Button>} /><QueryState loading={reviews.isLoading} error={reviews.isError} empty={!reviews.isLoading && !reviews.isError && (reviews.data || []).length === 0} onRetry={() => reviews.refetch()}>{reviews.data && <div className="space-y-5"><section className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-card-border bg-sidebar p-5 text-sidebar-foreground"><p className="text-xs font-bold uppercase tracking-[.14em] text-sidebar-foreground/50">Note moyenne</p><p data-testid="text-average-rating" className="mt-3 display text-4xl font-bold">{average}<span className="ml-1 text-lg text-accent">/ 5</span></p><p className="mt-2 text-xs text-sidebar-foreground/55">Sur {reviews.data.length} avis publiés</p></div><div className="rounded-2xl border border-card-border bg-card p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Notes écrites</p><p className="mt-3 display text-4xl font-bold">{reviews.data.filter((review) => review.comment).length}</p><p className="mt-2 text-xs text-muted-foreground">Avis accompagnés d'un commentaire</p></div><div className="rounded-2xl border border-card-border bg-card p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">Dernier signal</p><p className="mt-3 display text-2xl font-bold">{reviews.data[0] ? dateLabel(reviews.data[0].createdAt).split(',')[0] : 'Aucune date'}</p><p className="mt-2 text-xs text-muted-foreground">Dernier avis client reçu</p></div></section><section className="rounded-2xl border border-card-border bg-card shadow-sm"><div className="border-b border-border px-5 py-4"><h2 className="display text-lg font-bold">Avis clients récents</h2></div><div className="divide-y divide-border">{reviews.data.map((review) => <div key={review.id} data-testid={`card-review-${review.id}`} className="flex gap-4 p-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">{review.userName?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'C'}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div><span data-testid={`text-review-customer-${review.id}`} className="font-bold">{review.userName || 'Client'}</span><span className="ml-3 text-xs text-muted-foreground">{dateLabel(review.createdAt)}</span></div><span data-testid={`text-review-rating-${review.id}`} className="rounded-lg bg-accent px-2 py-1 text-xs font-bold text-accent-foreground">{review.rating} / 5</span></div><p data-testid={`text-review-comment-${review.id}`} className="mt-3 text-sm leading-6 text-muted-foreground">{review.comment || 'Aucun commentaire écrit pour cette visite.'}</p></div></div>)}</div></section></div>}</QueryState></div>;
}


function Shop() {
  const shops = useListBackendShops();
  const shop = shops.data?.[0];
  const updateShop = useUpdateBackendShop();
  const client = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const startEdit = () => {
    if (!shop) return;
    setEditData({
      name: shop.name || '',
      description: shop.description || '',
      address: shop.address || '',
      phone: shop.phone || '',
      category: shop.category || '',
      businessType: shop.businessType || 'restaurant',
      deliveryTime: shop.deliveryTime || 30,
      deliveryFee: shop.deliveryFee || 0,
      minimumOrder: shop.minimumOrder || 0,
      isOpen: shop.isOpen ?? true,
      imageUrl: shop.imageUrl || '',
      coverImageUrl: shop.coverImageUrl || '',
      logoUrl: shop.logoUrl || ''
    });
    setIsEditing(true);
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !editData) return;
    updateShop.mutate({ id: shop.id, data: editData }, {
      onSuccess: () => {
        setIsEditing(false);
        client.invalidateQueries({ queryKey: getListBackendShopsQueryKey() });
      }
    });
  };

  return <div className="page-in"><PageHeading eyebrow="Présence client" title="Profil boutique" description="Détails visibles par les clients lorsqu'ils commandent chez vous." action={<Button data-testid="button-edit-shop" variant="soft" onClick={startEdit} disabled={!shop}><Pencil size={15} />Modifier le profil</Button>} />
    <QueryState loading={shops.isLoading} error={shops.isError} empty={!shops.isLoading && !shops.isError && !shop} onRetry={() => shops.refetch()}>
      {shop && (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm">
            {isEditing && editData ? (
              <div className="p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
                  <h2 className="text-xl font-bold">Modifier le profil de la boutique</h2>
                  <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button>
                </div>
                {updateShop.isError && <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">Échec de la sauvegarde. Veuillez réessayer.</div>}
                <form onSubmit={submitEdit} className="space-y-6">
                  <ImageUploader label="Logo de la boutique" kind="shop_logo" value={editData.logoUrl} onChange={url => setEditData({...editData, logoUrl: url})} onUploading={setIsUploading} className="mb-4" />
                  <ImageUploader label="Image principale (couverture)" kind="shop_cover" value={editData.coverImageUrl} onChange={url => setEditData({...editData, coverImageUrl: url})} onUploading={setIsUploading} className="mb-4" />
                  <ImageUploader label="Image secondaire" kind="shop_cover" value={editData.imageUrl} onChange={url => setEditData({...editData, imageUrl: url})} onUploading={setIsUploading} className="mb-4" />
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">Nom de la boutique</span>
                      <input required value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">Type de commerce</span>
                      <select required value={editData.businessType} onChange={e => setEditData({...editData, businessType: e.target.value})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary">
                        <option value="restaurant">Restaurant</option>
                        <option value="grocery">Épicerie / Supermarché</option>
                        <option value="pharmacy">Pharmacie</option>
                        <option value="flower">Fleuriste</option>
                        <option value="pet">Animalerie</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">Téléphone</span>
                      <input required type="tel" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">Catégorie principale</span>
                      <input required value={editData.category} onChange={e => setEditData({...editData, category: e.target.value})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Adresse</span>
                    <input required value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Description</span>
                    <textarea rows={3} value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} className="w-full rounded-xl border border-input bg-background p-3 outline-none focus:border-primary" />
                  </label>
                  
                  <div className="border-t border-border pt-6">
                    <h3 className="mb-4 text-sm font-bold text-muted-foreground uppercase tracking-widest">Paramètres de service</h3>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">Frais de livraison</span>
                        <input required type="number" step="0.01" min="0" value={editData.deliveryFee} onChange={e => setEditData({...editData, deliveryFee: Number(e.target.value)})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">Commande minimum</span>
                        <input required type="number" step="0.01" min="0" value={editData.minimumOrder} onChange={e => setEditData({...editData, minimumOrder: Number(e.target.value)})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold">Temps de livraison (min)</span>
                        <input required type="number" min="0" value={editData.deliveryTime} onChange={e => setEditData({...editData, deliveryTime: Number(e.target.value)})} className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary" />
                      </label>
                    </div>
                  </div>
                  
                  <label className="flex items-center gap-3 rounded-xl border border-border p-4">
                    <input type="checkbox" checked={editData.isOpen} onChange={e => setEditData({...editData, isOpen: e.target.checked})} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                    <div>
                      <div className="text-sm font-semibold">Boutique ouverte</div>
                      <div className="text-xs text-muted-foreground">Les clients peuvent découvrir et commander dans votre boutique.</div>
                    </div>
                  </label>
                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button type="button" variant="quiet" onClick={() => setIsEditing(false)}>Annuler</Button>
                    <Button type="submit" disabled={updateShop.isPending || isUploading}>{updateShop.isPending ? 'Enregistrement...' : 'Enregistrer'}</Button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                <div className="relative h-48 w-full bg-sidebar">
                  {shop.coverImageUrl && <img src={shop.coverImageUrl} className="h-full w-full object-cover opacity-60 mix-blend-overlay" alt="Couverture" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 flex items-end gap-4">
                    {shop.logoUrl ? <img src={shop.logoUrl} className="h-16 w-16 rounded-xl border-2 border-card bg-card object-cover" alt="Logo" /> : <div className="grid h-16 w-16 place-items-center rounded-xl border-2 border-card bg-card text-2xl font-bold">{shop.name?.charAt(0) || 'S'}</div>}
                    <div className="flex-1">
                      <h1 className="display text-2xl font-bold text-white">{shop.name}</h1>
                      <p className="mt-1 text-sm text-white/75">{shop.category} · {formatPermission(shop.businessType)}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 sm:p-8">
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">À propos</h2>
                  <p data-testid="text-shop-description" className="mt-2 text-sm leading-6">{shop.description || 'Aucune description ajoutée pour le moment.'}</p>
                  <div className="mt-8 grid gap-8 sm:grid-cols-2">
                    <div>
                      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Adresse</h2>
                      <p data-testid="text-shop-address" className="mt-2 text-sm font-medium">{shop.address}</p>
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Paramètres de service</h2>
                      <ul className="mt-3 space-y-3">
                        <li className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Statut actuel</span><span className={`font-bold ${shop.isOpen ? 'text-primary' : 'text-muted-foreground'}`}>{shop.isOpen ? 'Ouvert' : 'Fermé'}</span></li>
                        <li className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Frais de livraison</span><span className="font-bold">{money(shop.deliveryFee)}</span></li>
                        <li className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Commande minimum</span><span className="font-bold">{money(shop.minimumOrder)}</span></li>
                        <li className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Temps estimé</span><span className="font-bold">{shop.deliveryTime || 30} min</span></li>
                        <li className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Téléphone</span><span className="font-bold">{shop.phone || 'Non renseigné'}</span></li>
                        <li className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Note</span><span className="font-bold">{shop.rating ? `${shop.rating.toFixed(1)} / 5 (${shop.reviewCount})` : 'Non noté'}</span></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
          <section className="space-y-6">
            <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Une vitrine de confiance</p><h2 className="mt-1 display text-lg font-bold">Gardez vos détails à jour</h2></div><ShieldCheck size={20} className="text-primary" /></div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Gardez vos horaires, contacts et menu à jour pour faciliter la commande.</p>
            </div>
            {shop.imageUrl && (
              <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground mb-3">Image secondaire</p>
                <img src={shop.imageUrl} className="w-full rounded-xl object-cover aspect-video" alt="Shop detail" />
              </div>
            )}
          </section>
        </div>
      )}
    </QueryState>
  </div>;
}



function SettingsPage() {
  const [, setLocation] = useLocation();
  const me = useBackendMe({ query: { enabled: Boolean(getStoredToken()), queryKey: getBackendMeQueryKey() } });
  const user = me.data?.user;
  return <div className="page-in"><PageHeading eyebrow="Contrôle de l'espace" title="Paramètres" description="Votre compte, votre accès et la session qui sécurise cet espace." /><div className="grid gap-6 xl:grid-cols-[1fr_.8fr]"><section className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="flex items-center gap-4 border-b border-border pb-6"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-lg font-bold text-secondary-foreground">{user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'JT'}</span><div><h2 data-testid="text-settings-name" className="display text-xl font-bold">{user?.name || 'Équipe commerçant'}</h2><p data-testid="text-settings-email" className="text-sm text-muted-foreground">{user?.email || '—'}</p></div></div><div className="mt-5 space-y-1">{[['Rôle', formatRôle(user?.role)], ['Téléphone', user?.phone || 'Non renseigné'], ['Membre depuis', user?.createdAt ? dateLabel(user.createdAt).split(',')[0] : '—']].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm hover:bg-muted/60"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>)}</div></section><div className="space-y-4"><section className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="flex gap-3"><ShieldCheck className="text-secondary-foreground" size={20} /><div><h2 className="font-bold">Autorisations</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Accès hérité de votre rôle d'équipe Jatek.</p></div></div><div className="mt-5 flex flex-wrap gap-2">{(me.data?.permissions || []).length ? me.data?.permissions.map((permission) => <span key={permission} data-testid={`badge-permission-${permission}`} className="rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold">{formatPermission(permission)}</span>) : <span className="text-sm text-muted-foreground">Aucun détail d'autorisation disponible.</span>}</div></section><section className="rounded-2xl border border-red-200 bg-red-50 p-6"><h2 className="font-bold text-red-900">Se déconnecter de cet appareil</h2><p className="mt-1 text-sm leading-5 text-red-700">Effacer la session locale et retourner à l'écran de connexion.</p><Button data-testid="button-settings-sign-out" variant="danger" className="mt-5" onClick={() => { clearToken(); setLocation('/login'); }}><LogOut size={15} />Se déconnecter</Button></section></div></div></div>;
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