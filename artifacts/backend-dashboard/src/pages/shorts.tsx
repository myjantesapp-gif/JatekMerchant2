import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Loader2, Film, Play, PlayCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploadField } from "@/components/ImageUploadField";
import { VideoUploadField, getYouTubeEmbedUrl } from "@/components/VideoUploadField";

interface Short {
  id: number;
  title: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  restaurantId?: number | null;
  restaurantName?: string | null;
  viewCount?: number | null;
  views?: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface Shop {
  id: number;
  name: string;
  logoUrl?: string | null;
}

const EMPTY = {
  title: "",
  imageUrl: "",
  videoUrl: "",
  restaurantId: "" as string | number,
  restaurantName: "",
  isActive: true,
  sortOrder: 0,
};

function formatShortViews(short: Short): string {
  const value = short.viewCount ?? short.views;
  if (value == null) return "— vues";
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}K vues`;
  }
  return `${value.toLocaleString("fr-FR")} vues`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs font-medium">{label}</Label>{children}</div>;
}

function ShortForm({
  form,
  setForm,
  shops,
  onMediaUploadingChange,
}: {
  form: typeof EMPTY;
  setForm: (f: typeof EMPTY) => void;
  shops: Shop[];
  onMediaUploadingChange: (isUploading: boolean) => void;
}) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });

  const handleRestaurantChange = (id: string) => {
    if (id === "__none__") {
      set("restaurantId", "");
      set("restaurantName", "");
    } else {
      const shop = shops.find((s) => String(s.id) === id);
      setForm({ ...form, restaurantId: Number(id), restaurantName: shop?.name ?? "" });
    }
  };

  return (
    <div className="space-y-3">
      <Field label="Titre *">
        <Input
          required
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ex: Découvrez nos burgers gourmands"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Ordre d'affichage">
          <Input
            type="number"
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", Number(e.target.value))}
          />
        </Field>
        <Field label="Restaurant lié">
          <Select
            value={form.restaurantId ? String(form.restaurantId) : "__none__"}
            onValueChange={handleRestaurantChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Aucun restaurant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Aucun restaurant —</SelectItem>
              {shops.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <ImageUploadField
        label="Miniature du Short"
        value={form.imageUrl}
        onValueChange={(value) => set("imageUrl", value)}
        onUploadingChange={onMediaUploadingChange}
        uploadKind="short"
        placeholder="https://… (JPEG, PNG, WebP ou GIF)"
        previewClassName="h-28 w-full"
      />

      <VideoUploadField
        label="Vidéo du Short"
        value={form.videoUrl}
        onValueChange={(value) => set("videoUrl", value)}
        onUploadingChange={onMediaUploadingChange}
        uploadKind="short"
      />

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
        Actif (visible dans l'application)
      </label>
    </div>
  );
}

export default function Shorts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<Short | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const { data: shorts, isLoading } = useQuery<Short[]>({
    queryKey: ["/api/backend/shorts"],
    queryFn: () => apiFetch("/api/backend/shorts"),
  });

  const { data: shopsData } = useQuery<{ shops: Shop[] } | Shop[]>({
    queryKey: ["/api/backend/shops"],
    queryFn: () => apiFetch("/api/backend/shops"),
  });
  const shops: Shop[] = Array.isArray(shopsData)
    ? shopsData
    : (shopsData as any)?.shops ?? [];
  const shopById = new Map(shops.map((shop) => [shop.id, shop]));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/backend/shorts"] });

  const toPayload = (f: typeof EMPTY) => ({
    title: f.title,
    imageUrl: f.imageUrl || null,
    videoUrl: f.videoUrl || null,
    restaurantId: f.restaurantId ? Number(f.restaurantId) : null,
    restaurantName: f.restaurantName || null,
    isActive: f.isActive,
    sortOrder: f.sortOrder,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast({ title: "Titre requis", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      await apiFetch("/api/backend/shorts", { method: "POST", body: JSON.stringify(toPayload(form)) });
      invalidate(); setCreateOpen(false); setForm(EMPTY);
      toast({ title: "Short créé ✓" });
    } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
    finally { setSubmitting(false); }
  };

  const openEdit = (s: Short) => {
    setEditing(s);
    setEditForm({
      title: s.title,
      imageUrl: s.imageUrl ?? "",
      videoUrl: s.videoUrl ?? "",
      restaurantId: s.restaurantId ?? "",
      restaurantName: s.restaurantName ?? "",
      isActive: s.isActive,
      sortOrder: s.sortOrder,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.title.trim()) { toast({ title: "Titre requis", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      await apiFetch(`/api/backend/shorts/${editing.id}`, { method: "PATCH", body: JSON.stringify(toPayload(editForm)) });
      invalidate(); setEditing(null);
      toast({ title: "Short mis à jour ✓" });
    } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
    finally { setSubmitting(false); }
  };

  const handleToggle = async (s: Short, isActive: boolean) => {
    try {
      await apiFetch(`/api/backend/shorts/${s.id}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
      invalidate();
    } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce short définitivement ?")) return;
    try {
      await apiFetch(`/api/backend/shorts/${id}`, { method: "DELETE" });
      invalidate(); toast({ title: "Short supprimé" });
    } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
  };

  const activeShorts = shorts?.filter((s) => s.isActive) ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shorts & Reels</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez les vidéos courtes affichées dans la section «&nbsp;Découvrir en vidéo&nbsp;» de l'application
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Nouveau short
        </Button>
      </div>

      {/* Live previews */}
      {activeShorts.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
            Aperçu des shorts actifs ({activeShorts.length})
          </p>
          <div className="flex gap-4 overflow-x-auto pb-3">
            {activeShorts.map((s) => (
              <div
                key={s.id}
                className="relative shrink-0 overflow-hidden rounded-[22px] bg-zinc-900 shadow-lg ring-1 ring-black/5"
                style={{ width: "min(44vw, 360px)", aspectRatio: "0.69" }}
              >
                {s.videoUrl
                  ? getYouTubeEmbedUrl(s.videoUrl)
                    ? <iframe src={getYouTubeEmbedUrl(s.videoUrl) ?? undefined} title={`Aperçu YouTube — ${s.title}`} className="absolute inset-0 h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture" />
                    : <video src={s.videoUrl} className="absolute inset-0 h-full w-full object-cover" muted playsInline preload="metadata" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                  : s.imageUrl
                    ? <img src={s.imageUrl} alt={s.title} className="absolute inset-0 h-full w-full object-cover" />
                    : <div className="absolute inset-0 flex items-center justify-center"><Film className="h-10 w-10 text-zinc-600" /></div>
                }
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent via-55% to-black/80" />

                <div
                  className="absolute left-4 top-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#ec176b] bg-white shadow-md sm:h-20 sm:w-20"
                  title={s.restaurantName || "Jatek"}
                >
                  {s.restaurantId && shopById.get(s.restaurantId)?.logoUrl ? (
                    <img
                      src={shopById.get(s.restaurantId)?.logoUrl ?? undefined}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-center text-sm font-extrabold leading-none text-[#08244a] sm:text-lg">
                      {(s.restaurantName || "Jatek").trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="absolute inset-x-4 bottom-4">
                  <p className="line-clamp-2 text-sm font-extrabold leading-tight text-white drop-shadow sm:text-2xl">
                    {s.title}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-white/90 sm:text-base">
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    <span>{formatShortViews(s)}</span>
                  </div>
                </div>

                <div className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/90 bg-black/20 text-white shadow-md backdrop-blur-sm sm:h-14 sm:w-14">
                  <Play className="ml-0.5 h-5 w-5 fill-white sm:h-7 sm:w-7" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Film className="h-4 w-4" /> Tous les shorts ({shorts?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Ord.</TableHead>
                <TableHead>Short</TableHead>
                <TableHead className="hidden sm:table-cell">Restaurant</TableHead>
                <TableHead className="hidden md:table-cell">Vidéo</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {[10, 48, 24, 20, 12, 16].map((w, j) => (
                      <TableCell key={j}><Skeleton className={`h-${j === 1 ? 10 : 4} w-${w}`} /></TableCell>
                    ))}
                  </TableRow>
                ))
                : shorts?.length === 0
                  ? <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Aucun short. Créez-en un !</TableCell></TableRow>
                  : shorts?.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground text-sm">{s.sortOrder}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-8 rounded-md shrink-0 overflow-hidden bg-zinc-100 relative flex items-center justify-center">
                              {s.videoUrl
                                ? getYouTubeEmbedUrl(s.videoUrl)
                                  ? <iframe src={getYouTubeEmbedUrl(s.videoUrl) ?? undefined} title={`Aperçu YouTube — ${s.title}`} className="h-full w-full border-0" allow="encrypted-media; picture-in-picture" />
                                  : <video src={s.videoUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                               : s.imageUrl
                                 ? <img src={s.imageUrl} alt={s.title} className="h-full w-full object-cover" />
                                 : <Film className="h-4 w-4 text-zinc-400" />
                             }
                          </div>
                          <p className="font-medium text-sm line-clamp-2 max-w-[220px]">{s.title}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {s.restaurantName
                          ? <Badge variant="secondary">{s.restaurantName}</Badge>
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {s.videoUrl
                          ? (
                            <a
                              href={s.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline max-w-[160px] truncate"
                            >
                              <PlayCircle className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{s.videoUrl}</span>
                            </a>
                          )
                          : <span className="text-xs text-muted-foreground">Pas de vidéo</span>
                        }
                      </TableCell>
                      <TableCell>
                        <Switch checked={s.isActive} onCheckedChange={(v) => handleToggle(s, v)} />
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-9 w-9 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setForm(EMPTY); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Créer un short</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <ShortForm form={form} setForm={setForm} shops={shops} onMediaUploadingChange={setUploadingMedia} />
            <DialogFooter>
              <Button type="submit" disabled={submitting || uploadingMedia}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier le short</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={handleUpdate} className="space-y-4 pt-2">
              <ShortForm form={editForm} setForm={setEditForm} shops={shops} onMediaUploadingChange={setUploadingMedia} />
              <DialogFooter>
                <Button type="submit" disabled={submitting || uploadingMedia}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enregistrer
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
