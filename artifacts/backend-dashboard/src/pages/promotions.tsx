import { useEffect, useMemo, useState } from "react";
import {
  useListBackendAds,
  useCreateBackendAd,
  useUpdateBackendAd,
  useDeleteBackendAd,
  useListBackendShops,
  getListBackendAdsQueryKey,
  getListBackendProductsQueryKey,
  type MenuItem,
  type Ad,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { ImageUploadField } from "@/components/ImageUploadField";
import { apiFetch } from "@/lib/api";

type AdType = "jatek_offer" | "vip_banner" | "promo_banner";

interface AdForm {
  type: AdType;
  title: string;
  subtitle: string;
  badge: string;
  bgColor: string;
  accentColor: string;
  icon: string;
  imageUrl: string;
  linkUrl: string;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY_FORM: AdForm = {
  type: "vip_banner",
  title: "",
  subtitle: "",
  badge: "",
  bgColor: "#E91E63",
  accentColor: "",
  icon: "star",
  imageUrl: "",
  linkUrl: "",
  isActive: true,
  sortOrder: 0,
};

const AD_TYPE_LABELS: Record<AdType, string> = {
  jatek_offer: "Offre Jatek",
  vip_banner: "Bannière VIP",
  promo_banner: "Bannière Promo",
};

type ProductWithPromotion = MenuItem & {
  compareAtPrice?: number | null;
};

type PromoAd = Ad & {
  restaurantId?: number | null;
  productId?: number | null;
  normalPrice?: number | null;
  promoPrice?: number | null;
};

interface ProductPromoForm {
  restaurantId: string;
  productId: string;
  normalPrice: string;
  promoPrice: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_PRODUCT_PROMO: ProductPromoForm = {
  restaurantId: "",
  productId: "",
  normalPrice: "",
  promoPrice: "",
  imageUrl: "",
  sortOrder: 0,
  isActive: true,
};

export default function Promotions() {
  const { data: ads, isLoading } = useListBackendAds({});
  const { data: shops = [] } = useListBackendShops({});
  const createAd = useCreateBackendAd();
  const updateAd = useUpdateBackendAd();
  const deleteAd = useDeleteBackendAd();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AdForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [promotionShopId, setPromotionShopId] = useState("");
  const [promotionProductId, setPromotionProductId] = useState("");
  const [promotionPrice, setPromotionPrice] = useState("");
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<number | null>(null);
  const [productPromoForm, setProductPromoForm] = useState<ProductPromoForm>(EMPTY_PRODUCT_PROMO);
  const [promoUploadingImage, setPromoUploadingImage] = useState(false);
  const [promoShopId, setPromoShopId] = useState("");
  const [promoProductId, setPromoProductId] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: getListBackendAdsQueryKey() });
  const promotionProductsQuery = useQuery<ProductWithPromotion[]>({
    queryKey: ["/api/backend/products", "promotion-editor", promotionShopId],
    queryFn: () => apiFetch(`/api/backend/products?shopId=${promotionShopId}&sort=custom&sortDirection=asc`),
    enabled: Boolean(promotionShopId),
  });
  const promotionProducts = promotionProductsQuery.data ?? [];
  const promoProductsQuery = useQuery<ProductWithPromotion[]>({
    queryKey: ["/api/backend/products", "new-promo", promoShopId],
    queryFn: () => apiFetch(`/api/backend/products?shopId=${promoShopId}&sort=custom&sortDirection=asc`),
    enabled: Boolean(promoShopId),
  });
  const promoProducts = promoProductsQuery.data ?? [];
  const selectedPromoProduct = useMemo(
    () => promoProducts.find((product) => String(product.id) === promoProductId),
    [promoProductId, promoProducts],
  );
  const promoAds = (ads ?? []).filter((ad) => ad.type === "promo_product") as PromoAd[];
  const selectedPromotionProduct = useMemo(
    () => promotionProducts.find((product) => String(product.id) === promotionProductId),
    [promotionProductId, promotionProducts],
  );
  const promotionMutation = useMutation({
    mutationFn: ({ productId, promoPrice }: { productId: number; promoPrice: number | null }) =>
      apiFetch(`/api/backend/products/${productId}/promotion`, {
        method: "PATCH",
        body: JSON.stringify({ promoPrice }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/backend/products", "promotion-editor", promotionShopId] });
      await qc.invalidateQueries({ queryKey: getListBackendProductsQueryKey() });
      toast({ title: "Promotion enregistrée" });
      setPromotionPrice("");
    },
    onError: (error: any) => toast({
      title: "Promotion non enregistrée",
      description: error?.message ?? "Réessayez.",
      variant: "destructive",
    }),
  });

  useEffect(() => {
    setPromotionProductId("");
    setPromotionPrice("");
  }, [promotionShopId]);

  useEffect(() => {
    if (!selectedPromotionProduct) return;
    const hasPromotion = Number(selectedPromotionProduct.compareAtPrice ?? 0) > Number(selectedPromotionProduct.price);
    setPromotionPrice(hasPromotion ? String(selectedPromotionProduct.price) : "");
  }, [selectedPromotionProduct]);

  useEffect(() => {
    if (editingPromoId) return;
    setPromoProductId("");
    setProductPromoForm((current) => ({ ...current, productId: "", normalPrice: "", promoPrice: "", imageUrl: "" }));
  }, [editingPromoId, promoShopId]);

  useEffect(() => {
    if (!selectedPromoProduct || editingPromoId) return;
    setProductPromoForm((current) => ({
      ...current,
      productId: String(selectedPromoProduct.id),
      normalPrice: String(selectedPromoProduct.compareAtPrice ?? selectedPromoProduct.price),
      imageUrl: current.imageUrl || selectedPromoProduct.imageUrl || "",
    }));
  }, [editingPromoId, selectedPromoProduct]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (ad: any) => {
    setEditingId(ad.id);
    setForm({
      type: ad.type ?? "vip_banner",
      title: ad.title ?? "",
      subtitle: ad.subtitle ?? "",
      badge: ad.badge ?? "",
      bgColor: ad.bgColor ?? "#E91E63",
      accentColor: ad.accentColor ?? "",
      icon: ad.icon ?? "star",
      imageUrl: ad.imageUrl ?? "",
      linkUrl: ad.linkUrl ?? "",
      isActive: ad.isActive ?? true,
      sortOrder: ad.sortOrder ?? 0,
    });
    setDialogOpen(true);
  };

  const openCreatePromo = () => {
    setEditingPromoId(null);
    setPromoShopId("");
    setPromoProductId("");
    setProductPromoForm(EMPTY_PRODUCT_PROMO);
    setPromoDialogOpen(true);
  };

  const openEditPromo = (ad: PromoAd) => {
    setEditingPromoId(ad.id);
    setPromoShopId(String(ad.restaurantId ?? ""));
    setPromoProductId(String(ad.productId ?? ""));
    setProductPromoForm({
      restaurantId: String(ad.restaurantId ?? ""),
      productId: String(ad.productId ?? ""),
      normalPrice: String(ad.normalPrice ?? ""),
      promoPrice: String(ad.promoPrice ?? ""),
      imageUrl: ad.imageUrl ?? "",
      sortOrder: ad.sortOrder ?? 0,
      isActive: ad.isActive ?? true,
    });
    setPromoDialogOpen(true);
  };

  const handleSavePromo = async () => {
    const normalPrice = Number(productPromoForm.normalPrice.trim().replace(",", "."));
    const promoPrice = Number(productPromoForm.promoPrice.trim().replace(",", "."));
    if (!productPromoForm.restaurantId || !productPromoForm.productId || !selectedPromoProduct) {
      toast({ title: "Restaurant et produit requis", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(normalPrice) || normalPrice <= 0 || !Number.isFinite(promoPrice) || promoPrice < 0 || promoPrice >= normalPrice) {
      toast({ title: "Prix promo invalide", description: "Le prix promo doit être inférieur au prix normal.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const shop = shops.find((item) => String(item.id) === productPromoForm.restaurantId);
    const payload = {
      type: "promo_product",
      title: selectedPromoProduct.name,
      subtitle: shop?.name ?? undefined,
      badge: "PROMO",
      bgColor: "#E91E63",
      accentColor: "#FFFFFF",
      icon: "tag",
      imageUrl: productPromoForm.imageUrl.trim() || undefined,
      linkUrl: `/restaurant/${productPromoForm.restaurantId}?productId=${productPromoForm.productId}`,
      restaurantId: Number(productPromoForm.restaurantId),
      productId: Number(productPromoForm.productId),
      normalPrice,
      promoPrice,
      isActive: productPromoForm.isActive,
      sortOrder: Number(productPromoForm.sortOrder),
    };
    try {
      if (editingPromoId) {
        await updateAd.mutateAsync({ id: editingPromoId, data: payload });
        toast({ title: "Promotion mise à jour" });
      } else {
        await createAd.mutateAsync({ data: payload });
        toast({ title: "Promotion créée" });
      }
      await invalidate();
      setPromoDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Promotion non enregistrée", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Titre requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      type: form.type,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || undefined,
      badge: form.badge.trim() || undefined,
      bgColor: form.bgColor,
      accentColor: form.accentColor.trim() || undefined,
      icon: form.icon.trim() || "star",
      imageUrl: form.imageUrl.trim() || undefined,
      linkUrl: form.linkUrl.trim() || undefined,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder),
    };
    try {
      if (editingId) {
        await updateAd.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Publicité mise à jour" });
      } else {
        await createAd.mutateAsync({ data: payload });
        toast({ title: "Publicité créée" });
      }
      invalidate();
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Supprimer cette publicité ?")) return;
    deleteAd.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: "Supprimée" }); },
      onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
    });
  };

  const saveProductPromotion = () => {
    if (!selectedPromotionProduct) {
      toast({ title: "Choisissez un produit", variant: "destructive" });
      return;
    }
    const rawPrice = promotionPrice.trim().replace(",", ".");
    const promoPrice = Number(rawPrice);
    const cataloguePrice = Number(selectedPromotionProduct.compareAtPrice ?? selectedPromotionProduct.price);
    if (!Number.isFinite(promoPrice) || promoPrice < 0 || promoPrice >= cataloguePrice) {
      toast({
        title: "Prix promotionnel invalide",
        description: `Le prix doit être inférieur à ${cataloguePrice.toFixed(2)} DH.`,
        variant: "destructive",
      });
      return;
    }
    promotionMutation.mutate({ productId: selectedPromotionProduct.id, promoPrice });
  };

  const clearProductPromotion = () => {
    if (!selectedPromotionProduct) return;
    promotionMutation.mutate({ productId: selectedPromotionProduct.id, promoPrice: null });
  };

  const field = (k: keyof AdForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tags className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Promotions</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreatePromo}><Plus className="h-4 w-4 mr-2" />Nouvelle promo</Button>
          <Button variant="outline" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nouvelle publicité</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Promotions produits ({promoAds.length})</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Associez une offre à un restaurant et à son produit.</p>
          </div>
          <Button size="sm" onClick={openCreatePromo}><Plus className="mr-2 h-4 w-4" />Ajouter</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Ordre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promoAds.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Aucune promotion produit.</TableCell></TableRow>
              ) : promoAds.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell>
                    {promo.imageUrl ? <img src={promo.imageUrl} alt="" className="h-10 w-14 rounded object-cover" /> : <div className="h-10 w-14 rounded bg-muted" />}
                  </TableCell>
                  <TableCell>{shops.find((shop) => shop.id === promo.restaurantId)?.name ?? "—"}</TableCell>
                  <TableCell className="font-medium">{promo.title}</TableCell>
                  <TableCell>
                    <span className="font-semibold text-primary">{Number(promo.promoPrice ?? 0).toFixed(2)} DH</span>
                    <span className="ml-2 text-xs text-muted-foreground line-through">{Number(promo.normalPrice ?? 0).toFixed(2)} DH</span>
                  </TableCell>
                  <TableCell>{promo.sortOrder}</TableCell>
                  <TableCell><Badge variant={promo.isActive ? "default" : "secondary"}>{promo.isActive ? "Actif" : "Inactif"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditPromo(promo)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(promo.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promotion par boutique</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sélectionnez une boutique, son produit, puis saisissez le prix promotionnel.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_180px_auto] md:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="promotion-shop">Boutique</Label>
            <Select value={promotionShopId} onValueChange={setPromotionShopId}>
              <SelectTrigger id="promotion-shop" data-testid="select-promotion-shop">
                <SelectValue placeholder="Choisir une boutique" />
              </SelectTrigger>
              <SelectContent>
                {shops.map((shop) => (
                  <SelectItem key={shop.id} value={String(shop.id)}>{shop.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="promotion-product">Produit</Label>
            <Select
              value={promotionProductId}
              onValueChange={setPromotionProductId}
              disabled={!promotionShopId || promotionProductsQuery.isLoading}
            >
              <SelectTrigger id="promotion-product" data-testid="select-promotion-product">
                <SelectValue placeholder={promotionProductsQuery.isLoading ? "Chargement…" : "Choisir un produit"} />
              </SelectTrigger>
              <SelectContent>
                {promotionProducts.map((product) => (
                  <SelectItem key={product.id} value={String(product.id)}>
                    {product.name}{Number(product.compareAtPrice ?? 0) > Number(product.price) ? " · Promo active" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="promotion-price">Prix promo (DH)</Label>
            <Input
              id="promotion-price"
              type="text"
              inputMode="decimal"
              value={promotionPrice}
              onChange={(event) => setPromotionPrice(event.target.value)}
              placeholder="Ex. 29,90"
              disabled={!selectedPromotionProduct}
              data-testid="input-promotion-price"
            />
            {selectedPromotionProduct && (
              <span className="text-xs text-muted-foreground">
                Prix catalogue : {Number(selectedPromotionProduct.compareAtPrice ?? selectedPromotionProduct.price).toFixed(2)} DH
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={saveProductPromotion}
              disabled={!selectedPromotionProduct || !promotionPrice.trim() || promotionMutation.isPending}
              data-testid="button-save-product-promotion"
            >
              {promotionMutation.isPending ? "Enregistrement…" : "Appliquer"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={clearProductPromotion}
              disabled={!selectedPromotionProduct || Number(selectedPromotionProduct.compareAtPrice ?? 0) <= Number(selectedPromotionProduct.price) || promotionMutation.isPending}
              data-testid="button-clear-product-promotion"
            >
              Retirer
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Publicités actives ({ads?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Badge</TableHead>
                <TableHead>Couleur</TableHead>
                <TableHead>Ordre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
                : ads?.length === 0
                  ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Aucune publicité.</TableCell></TableRow>
                  : ads?.map((ad: Ad) => (
                    <TableRow key={ad.id}>
                      <TableCell className="font-medium max-w-[180px] truncate">{ad.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{AD_TYPE_LABELS[ad.type as AdType] ?? ad.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{ad.badge || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full border" style={{ background: ad.bgColor ?? "#ccc" }} />
                          <span className="text-xs text-muted-foreground">{ad.bgColor}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{ad.sortOrder}</TableCell>
                      <TableCell>
                        <Badge variant={ad.isActive ? "default" : "secondary"}>
                          {ad.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(ad)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(ad.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier la publicité" : "Nouvelle publicité"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as AdType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AD_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Titre *</Label>
              <Input value={form.title} onChange={field("title")} placeholder="Ex: Livraison gratuite" />
            </div>
            <div className="grid gap-1.5">
              <Label>Sous-titre</Label>
              <Input value={form.subtitle} onChange={field("subtitle")} placeholder="Ex: Sur votre première commande" />
            </div>
            <div className="grid gap-1.5">
              <Label>Badge</Label>
              <Input value={form.badge} onChange={field("badge")} placeholder="Ex: NEW, -20%" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Couleur de fond</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.bgColor} onChange={(e) => setForm((p) => ({ ...p, bgColor: e.target.value }))} className="h-9 w-10 rounded border cursor-pointer" />
                  <Input value={form.bgColor} onChange={field("bgColor")} className="flex-1" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Couleur accent</Label>
                <Input value={form.accentColor} onChange={field("accentColor")} placeholder="#ffffff" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Icône</Label>
              <Input value={form.icon} onChange={field("icon")} placeholder="Ex: star, zap, gift" />
            </div>
            <ImageUploadField
              label="Image de la promotion"
              value={form.imageUrl}
              onValueChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))}
              onUploadingChange={setUploadingImage}
              uploadKind="banner"
              previewClassName="h-28 w-full"
            />
            <div className="grid gap-1.5">
              <Label>URL lien</Label>
              <Input value={form.linkUrl} onChange={field("linkUrl")} placeholder="/restaurant/42" />
            </div>
            <div className="grid gap-1.5">
              <Label>Ordre d'affichage</Label>
              <Input type="number" value={form.sortOrder} onChange={field("sortOrder")} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v })) } />
              <Label>Actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || uploadingImage}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPromoId ? "Modifier la promo" : "Nouvelle promo"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Restaurant *</Label>
              <Select value={promoShopId} onValueChange={(value) => {
                setPromoShopId(value);
                setProductPromoForm((current) => ({ ...current, restaurantId: value }));
              }}>
                <SelectTrigger><SelectValue placeholder="Choisir un restaurant" /></SelectTrigger>
                <SelectContent>{shops.map((shop) => <SelectItem key={shop.id} value={String(shop.id)}>{shop.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Produit *</Label>
              <Select value={promoProductId} onValueChange={(value) => {
                setPromoProductId(value);
                setProductPromoForm((current) => ({ ...current, productId: value }));
              }} disabled={!promoShopId || promoProductsQuery.isLoading}>
                <SelectTrigger><SelectValue placeholder={promoProductsQuery.isLoading ? "Chargement…" : "Choisir un produit"} /></SelectTrigger>
                <SelectContent>{promoProducts.map((product) => <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Prix normal (DH) *</Label>
                <Input type="text" inputMode="decimal" value={productPromoForm.normalPrice} onChange={(event) => setProductPromoForm((current) => ({ ...current, normalPrice: event.target.value }))} placeholder="Ex. 50" />
              </div>
              <div className="grid gap-1.5">
                <Label>Prix promo (DH) *</Label>
                <Input type="text" inputMode="decimal" value={productPromoForm.promoPrice} onChange={(event) => setProductPromoForm((current) => ({ ...current, promoPrice: event.target.value }))} placeholder="Ex. 35" />
              </div>
            </div>
            <ImageUploadField
              label="Image de la promo"
              value={productPromoForm.imageUrl}
              onValueChange={(imageUrl) => setProductPromoForm((current) => ({ ...current, imageUrl }))}
              onUploadingChange={setPromoUploadingImage}
              uploadKind="image"
              previewClassName="h-28 w-full"
            />
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="grid gap-1.5">
                <Label>Ordre d'affichage</Label>
                <Input type="number" min={0} step={1} value={productPromoForm.sortOrder} onChange={(event) => setProductPromoForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch checked={productPromoForm.isActive} onCheckedChange={(isActive) => setProductPromoForm((current) => ({ ...current, isActive }))} />
                <Label>Promo active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSavePromo} disabled={saving || promoUploadingImage || !selectedPromoProduct}>{saving ? "Enregistrement…" : "Enregistrer la promo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
