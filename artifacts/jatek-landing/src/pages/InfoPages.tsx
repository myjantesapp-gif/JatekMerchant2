import { FormEvent, ReactNode, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Mail, Send, ShieldCheck } from "lucide-react";

function PageShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — Jatek`;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    description?.setAttribute("content", intro);
    window.scrollTo(0, 0);
  }, [intro, title]);

  return (
    <div className="min-h-screen bg-[#FFF8FC] text-[#0A1B3D]">
      <header className="sticky top-0 z-30 border-b border-[#EBEBEB] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <a href="/" aria-label="Accueil Jatek">
            <img src="/jatek-logo.png" alt="Jatek" className="h-8 w-auto" />
          </a>
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#6B7280] transition-colors hover:text-brand-pink">
            <ArrowLeft className="h-4 w-4" /> Retour à l’accueil
          </a>
        </div>
      </header>

      <main>
        <section className="border-b border-[#F4D8E8] bg-white">
          <div className="mx-auto max-w-5xl px-6 py-14 md:py-20">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-pink-soft text-brand-pink">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-5xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-[#6B7280]">{intro}</p>
            <p className="mt-4 text-sm font-semibold text-[#9CA3AF]">Dernière mise à jour : 12 septembre 2026</p>
          </div>
        </section>
        <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">{children}</div>
      </main>

      <footer className="border-t border-[#EBEBEB] bg-white px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col justify-between gap-4 text-sm text-[#6B7280] md:flex-row">
          <span>© {new Date().getFullYear()} Jatek App</span>
          <div className="flex flex-wrap gap-5">
            <a href="/support" className="hover:text-brand-pink">Support</a>
            <a href="/confidentialite" className="hover:text-brand-pink">Confidentialité</a>
            <a href="/rgpd" className="hover:text-brand-pink">RGPD</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10 max-w-3xl">
      <h2 className="mb-3 text-2xl font-extrabold">{title}</h2>
      <div className="space-y-3 leading-7 text-[#4B5563]">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <PageShell
      title="Politique de confidentialité"
      intro="Cette politique explique quelles données Jatek utilise, pourquoi elles sont nécessaires et comment nous les protégeons."
    >
      <Section title="1. Données que nous collectons">
        <p>Nous pouvons traiter les informations de compte et de contact, les adresses de livraison, l’historique des commandes, les informations de paiement limitées aux références fournies par nos prestataires, les échanges avec le support et les données techniques nécessaires au fonctionnement de l’application.</p>
        <p>Avec votre autorisation, la localisation de votre appareil peut être utilisée pour proposer une adresse ou suivre une livraison. Vous pouvez retirer cette autorisation dans les réglages de votre appareil.</p>
      </Section>
      <Section title="2. Utilisation des données">
        <p>Ces données servent à créer et sécuriser votre compte, traiter et livrer vos commandes, assurer le suivi en temps réel, répondre à vos demandes, prévenir la fraude et améliorer le service.</p>
      </Section>
      <Section title="3. Partage des données">
        <p>Les informations strictement nécessaires peuvent être transmises au commerce concerné, au livreur affecté, ainsi qu’à nos prestataires techniques, de paiement, d’hébergement et de communication. Nous ne vendons pas vos données personnelles.</p>
      </Section>
      <Section title="4. Conservation et sécurité">
        <p>Les données sont conservées pendant la durée nécessaire à la fourniture du service et au respect de nos obligations légales. Nous appliquons des mesures techniques et organisationnelles destinées à limiter les accès non autorisés, la perte et l’altération.</p>
      </Section>
      <Section title="5. Vos choix">
        <p>Vous pouvez mettre à jour certaines informations dans l’application et gérer les autorisations depuis votre appareil. Pour toute demande concernant vos données, utilisez la page <a href="/support" className="font-bold text-brand-pink">Support</a> ou écrivez à <a href="mailto:contact@jatek.app" className="font-bold text-brand-pink">contact@jatek.app</a>.</p>
      </Section>
    </PageShell>
  );
}

export function RgpdPage() {
  return (
    <PageShell
      title="RGPD et vos droits"
      intro="Jatek met à disposition les informations et moyens nécessaires pour exercer vos droits relatifs aux données personnelles."
    >
      <Section title="Responsable du traitement">
        <p>Jatek App détermine les finalités et moyens des traitements nécessaires à la fourniture de ses services. Le point de contact pour les questions de protection des données est <a href="mailto:contact@jatek.app" className="font-bold text-brand-pink">contact@jatek.app</a>.</p>
      </Section>
      <Section title="Bases juridiques">
        <p>Selon le traitement concerné, nous nous appuyons sur l’exécution du service demandé, le respect d’une obligation légale, notre intérêt légitime à sécuriser et améliorer Jatek, ou votre consentement lorsqu’il est requis.</p>
      </Section>
      <Section title="Vos droits">
        <ul className="list-disc space-y-2 pl-5">
          <li>accéder aux données personnelles vous concernant ;</li>
          <li>demander leur rectification ou, lorsque les conditions sont réunies, leur effacement ;</li>
          <li>demander la limitation du traitement ou vous y opposer ;</li>
          <li>recevoir les données que vous avez fournies dans un format portable ;</li>
          <li>retirer votre consentement à tout moment pour les traitements concernés ;</li>
          <li>introduire une réclamation auprès de l’autorité de contrôle compétente.</li>
        </ul>
      </Section>
      <Section title="Exercer vos droits">
        <p>Envoyez votre demande via notre page <a href="/support" className="font-bold text-brand-pink">Support</a>. Indiquez clairement le droit exercé et l’adresse associée à votre compte. Une preuve d’identité peut être demandée uniquement lorsque cela est nécessaire pour protéger vos données.</p>
        <p>Nous répondons dans les délais prévus par la réglementation applicable. Si la demande est complexe ou nombreuse, nous vous informerons de toute prolongation autorisée.</p>
      </Section>
      <Section title="Transferts et sous-traitants">
        <p>Lorsque des prestataires traitent des données pour notre compte, ils sont tenus de respecter des obligations de sécurité et de confidentialité. Les transferts internationaux éventuels sont encadrés par les garanties exigées par la réglementation applicable.</p>
      </Section>
    </PageShell>
  );
}

type FormState = "idle" | "sending" | "success" | "error";

export function SupportPage() {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError("");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible d’envoyer le message.");
      form.reset();
      setState("success");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’envoyer le message.");
      setState("error");
    }
  }

  return (
    <PageShell
      title="Support Jatek"
      intro="Une question sur une commande, votre compte ou l’application ? Envoyez-nous un message, notre équipe vous répondra par e-mail."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
        <aside className="h-fit rounded-3xl bg-[#0A1B3D] p-7 text-white">
          <Mail className="mb-5 h-7 w-7 text-brand-yellow" />
          <h2 className="text-xl font-extrabold text-white">Nous contacter</h2>
          <p className="mt-3 leading-7 text-white/75">Décrivez précisément votre demande et indiquez, si nécessaire, le numéro de commande concerné.</p>
          <a href="mailto:contact@jatek.app" className="mt-6 block break-all font-bold text-brand-yellow">contact@jatek.app</a>
        </aside>

        <form onSubmit={submit} className="rounded-3xl border border-[#EBEBEB] bg-white p-6 shadow-soft md:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-bold">Nom complet
              <input name="name" required minLength={2} maxLength={100} autoComplete="name" className="mt-2 w-full rounded-xl border border-[#D1D5DB] px-4 py-3 font-normal outline-none focus:border-brand-pink focus:ring-2 focus:ring-[#FDE8F4]" />
            </label>
            <label className="text-sm font-bold">Adresse e-mail
              <input name="email" type="email" required maxLength={254} autoComplete="email" className="mt-2 w-full rounded-xl border border-[#D1D5DB] px-4 py-3 font-normal outline-none focus:border-brand-pink focus:ring-2 focus:ring-[#FDE8F4]" />
            </label>
          </div>
          <label className="mt-5 block text-sm font-bold">Sujet
            <input name="subject" required minLength={3} maxLength={160} className="mt-2 w-full rounded-xl border border-[#D1D5DB] px-4 py-3 font-normal outline-none focus:border-brand-pink focus:ring-2 focus:ring-[#FDE8F4]" />
          </label>
          <label className="mt-5 block text-sm font-bold">Message
            <textarea name="message" required minLength={10} maxLength={5000} rows={7} className="mt-2 w-full resize-y rounded-xl border border-[#D1D5DB] px-4 py-3 font-normal outline-none focus:border-brand-pink focus:ring-2 focus:ring-[#FDE8F4]" />
          </label>
          <label className="sr-only" aria-hidden="true">Site web
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>

          {state === "success" && (
            <div role="status" className="mt-5 flex items-center gap-2 rounded-xl bg-[#E8FAF5] px-4 py-3 font-semibold text-[#087A5B]">
              <CheckCircle2 className="h-5 w-5" /> Votre message a bien été envoyé.
            </div>
          )}
          {state === "error" && <p role="alert" className="mt-5 rounded-xl bg-[#FFF0F2] px-4 py-3 font-semibold text-[#B4233B]">{error}</p>}

          <button disabled={state === "sending"} className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand-pink px-6 py-3.5 font-extrabold text-white transition-colors hover:bg-brand-pink-deep disabled:cursor-wait disabled:opacity-60">
            <Send className="h-4 w-4" /> {state === "sending" ? "Envoi en cours…" : "Envoyer le message"}
          </button>
          <p className="mt-4 text-xs leading-5 text-[#9CA3AF]">Les informations saisies sont utilisées uniquement pour traiter votre demande. Consultez notre <a href="/confidentialite" className="underline hover:text-brand-pink">politique de confidentialité</a>.</p>
        </form>
      </div>
    </PageShell>
  );
}