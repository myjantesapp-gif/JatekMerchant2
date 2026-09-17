import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Save, Loader2, Globe, AlertTriangle, Star, LayoutGrid, MessageSquare, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type HomeSectionConfig = {
  visible: boolean;
  title: string;
  source: string;
  limit: number;
};

type HomeSectionKey =
  | "categories"
  | "banners"
  | "shorts"
  | "recommended_products"
  | "recommended_restaurants"
  | "popular"
  | "new_restaurants"
  | "supermarkets"
  | "new_products"
  | "shops"
  | "all"
  | "free_delivery"
  | "newest"
  | "support";

const DEFAULT_CONFIG = {
  defaultLanguage: "fr",
  maintenanceMode: false,
  featuredCount: 6,
  homeOrder: ["categories", "banners", "shorts", "recommended_products", "recommended_restaurants", "popular", "new_restaurants", "supermarkets", "new_products", "shops", "all", "free_delivery", "newest", "support"],
  welcomeMessage: "Bienvenue sur Jatek !",
  homeSections: {
    categories: { visible: true, title: "Catégories", source: "categories", limit: 4 },
    banners: { visible: true, title: "Bannières", source: "banners", limit: 10 },
    shorts: { visible: true, title: "Shorts", source: "shorts", limit: 12 },
    recommended_products: { visible: true, title: "Produits recommandés", source: "recommended_products", limit: 6 },
    recommended_restaurants: { visible: true, title: "Restaurants recommandés", source: "recommended_restaurants", limit: 6 },
    popular: { visible: true, title: "Produits populaires", source: "popular", limit: 6 },
    new_products: { visible: true, title: "Offres du moment", source: "promos", limit: 6 },
    new_restaurants: { visible: false, title: "Restauration", source: "new_restaurants", limit: 6 },
    supermarkets: { visible: true, title: "Supermarché", source: "supermarkets", limit: 6 },
    shops: { visible: false, title: "Boutiques", source: "shops", limit: 6 },
    all: { visible: true, title: "Recommandé pour vous", source: "all_restaurants", limit: 6 },
    free_delivery: { visible: true, title: "Livraison gratuite", source: "free_delivery", limit: 6 },
    newest: { visible: true, title: "Nouveautés", source: "newest", limit: 6 },
    support: { visible: true, title: "Besoin d'aide ?", source: "support", limit: 1 },
  } as Record<HomeSectionKey, HomeSectionConfig>,
};

type AppConfigData = typeof DEFAULT_CONFIG;

const HOME_SECTIONS = [
  { key: "categories", label: "Catégories des shops" },
  { key: "banners", label: "Bannières" },
  { key: "shorts", label: "Shorts" },
  { key: "recommended_products", label: "Produits recommandés" },
  { key: "recommended_restaurants", label: "Restaurants recommandés" },
  { key: "popular", label: "Produits populaires" },
  { key: "new_restaurants", label: "Restaurants près de chez vous" },
  { key: "supermarkets", label: "Supermarchés près de chez vous" },
  { key: "new_products", label: "Offres du moment" },
  { key: "shops", label: "Boutiques" },
  { key: "all", label: "Recommandé pour vous" },
  { key: "free_delivery", label: "Livraison gratuite" },
  { key: "newest", label: "Nouveautés" },
  { key: "support", label: "Support" },
];
const DYNAMIC_SECTION_KEYS: HomeSectionKey[] = [
  "categories", "banners", "shorts", "recommended_products", "recommended_restaurants", "popular", "new_restaurants", "supermarkets",
  "new_products", "shops", "all", "free_delivery", "newest", "support",
];
const SOURCE_OPTIONS: Record<HomeSectionKey, Array<{ value: string; label: string }>> = {
  categories: [{ value: "categories", label: "Catégories actives" }],
  banners: [{ value: "banners", label: "Bannières actives" }],
  shorts: [{ value: "shorts", label: "Shorts publiés" }],
  recommended_products: [{ value: "recommended_products", label: "Sélection gérée ci-dessous" }],
  recommended_restaurants: [{ value: "recommended_restaurants", label: "Sélection gérée ci-dessous" }],
  popular: [
    { value: "popular", label: "Catalogue recommandé" },
    { value: "newest", label: "Produits les plus récents" },
  ],
  new_products: [
    { value: "promos", label: "Produits en promotion" },
    { value: "newest", label: "Produits les plus récents" },
    { value: "popular", label: "Catalogue recommandé" },
  ],
  new_restaurants: [
    { value: "new_restaurants", label: "Restaurants les plus récents" },
    { value: "all_restaurants", label: "Tous les restaurants" },
  ],
  supermarkets: [
    { value: "supermarkets", label: "Supermarchés uniquement" },
    { value: "all_restaurants", label: "Tous les commerces" },
  ],
  shops: [
    { value: "shops", label: "Boutiques uniquement" },
    { value: "all_restaurants", label: "Tous les commerces" },
  ],
  all: [{ value: "all_restaurants", label: "Tous les commerces" }],
  free_delivery: [{ value: "free_delivery", label: "Produits sans frais de livraison" }],
  newest: [{ value: "newest", label: "Produits les plus récents" }],
  support: [{ value: "support", label: "Carte d'assistance" }],
};

export default function AppConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery<AppConfigData>({
    queryKey: ["/api/backend/app-config"],
    queryFn: () => apiFetch("/api/backend/app-config"),
  });

  const [form, setForm] = useState<AppConfigData>(DEFAULT_CONFIG);

  useEffect(() => {
    if (config) {
      const savedOrder = config.homeOrder || [];
      const missingOrder = DEFAULT_CONFIG.homeOrder.filter(k => !savedOrder.includes(k));

      setForm({
        ...DEFAULT_CONFIG,
        ...config,
        homeOrder: [...savedOrder, ...missingOrder],
        homeSections: {
          ...DEFAULT_CONFIG.homeSections,
          ...(config.homeSections || {})
        }
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: AppConfigData) =>
      apiFetch("/api/backend/app-config", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/backend/app-config"] });
      toast({ title: "Configuration sauvegardée ✓" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
  });

  const moveSection = (key: string, dir: -1 | 1) => {
    const arr = [...form.homeOrder];
    const i = arr.indexOf(key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setForm({ ...form, homeOrder: arr });
  };

  const updateSectionConfig = (key: HomeSectionKey, updates: Partial<HomeSectionConfig>) => {
    setForm(prev => ({
      ...prev,
      homeSections: {
        ...prev.homeSections,
        [key]: { ...prev.homeSections[key], ...updates },
      }
    }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" /> App Config
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configuration lue par l'app mobile au démarrage via <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/app-config</code>
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          {saveMutation.isPending
            ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
            : <Save className="h-4 w-4 mr-2" />}
          Sauvegarder
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Language */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" /> Langue par défaut
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={form.defaultLanguage}
                onValueChange={(v) => setForm({ ...form, defaultLanguage: v })}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  <SelectItem value="ar">🇲🇦 العربية</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Maintenance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Mode maintenance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.maintenanceMode}
                  onCheckedChange={(v) => setForm({ ...form, maintenanceMode: v })}
                />
                <Label>
                  {form.maintenanceMode
                    ? <Badge variant="destructive">Maintenance activée — app indisponible</Badge>
                    : <span className="text-muted-foreground text-sm">Désactivé — app visible normalement</span>}
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Featured count */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4" /> Restaurants vedettes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={form.featuredCount}
                  onChange={(e) => setForm({ ...form, featuredCount: Number(e.target.value) })}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  restaurants affichés dans le carousel "Vedettes" (flag <code className="text-xs bg-muted px-1 rounded">isFeatured</code>)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Home sections order */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" /> Ordre des sections home
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {form.homeOrder.map((key, idx) => {
                  const sec = HOME_SECTIONS.find((s) => s.key === key);
                  const isDynamic = DYNAMIC_SECTION_KEYS.includes(key as HomeSectionKey);
                  const config = isDynamic ? form.homeSections[key as HomeSectionKey] : null;
                  const isHidden = isDynamic && config && !config.visible;

                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border transition-opacity ${isHidden ? 'bg-muted/10 opacity-50' : 'bg-muted/30'}`}
                    >
                      <span className="text-xs text-muted-foreground font-mono w-5 text-center">{idx + 1}</span>
                      <span className="flex-1 text-sm font-medium flex items-center gap-2">
                        {sec?.label ?? key}
                        {isHidden && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Masqué</span>}
                      </span>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => moveSection(key, -1)} disabled={idx === 0}
                      >↑</Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => moveSection(key, 1)} disabled={idx === form.homeOrder.length - 1}
                      >↓</Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Dynamic sections configuration */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" /> Paramètres des sections dynamiques
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {DYNAMIC_SECTION_KEYS.map(key => {
                const config = form.homeSections[key] || DEFAULT_CONFIG.homeSections[key];
                const sec = HOME_SECTIONS.find(s => s.key === key);
                return (
                  <div key={key} className={`space-y-3 border rounded-lg p-4 transition-colors ${config.visible ? 'bg-card' : 'bg-muted/10'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={config.visible}
                          onCheckedChange={(v) => updateSectionConfig(key, { visible: v })}
                        />
                        <Label
                          className="font-semibold text-base cursor-pointer select-none"
                          onClick={() => updateSectionConfig(key, { visible: !config.visible })}
                        >
                          {sec?.label}
                        </Label>
                      </div>
                      {!config.visible && <Badge variant="secondary">Masqué</Badge>}
                    </div>

                    {config.visible && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Titre affiché</Label>
                          <Input
                            value={config.title}
                            onChange={(e) => updateSectionConfig(key, { title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Source autorisée</Label>
                          <Select value={config.source} onValueChange={(source) => updateSectionConfig(key, { source })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SOURCE_OPTIONS[key].map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Limite d'éléments</Label>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={config.limit}
                            onChange={(e) => updateSectionConfig(key, { limit: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Welcome message */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Message d'accueil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={2}
                value={form.welcomeMessage}
                onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
                placeholder="Bienvenue sur Jatek !"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Affiché dans l'app mobile sur l'écran d'accueil.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}