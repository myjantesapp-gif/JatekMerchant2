import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <main className="paper-grid flex min-h-[100dvh] items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-8 text-center shadow-[0_24px_70px_rgba(33,39,58,.1)] sm:p-12">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
          <Compass size={30} />
        </span>
        <p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-primary">Page introuvable</p>
        <h1 data-testid="text-not-found-title" className="mt-3 display text-3xl font-bold tracking-tight">Cette table est vide.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">La page demandée ne fait pas partie de l'espace commerçant. Retournez à l'aperçu pour continuer le service.</p>
        <Link href="/" data-testid="link-not-found-home" className="mx-auto mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-95">
          <ArrowLeft size={16} /> Retour à l'aperçu
        </Link>
      </section>
    </main>
  );
}