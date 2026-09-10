import { Fragment, useState, useRef, useEffect, useMemo } from "react";
import {
  useListBackendProductsPage,
  useListBackendShops,
  useBackendMe,
  getListBackendProductsQueryKey,
  getListBackendProductsPageQueryKey,
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Pencil, Trash2, Loader2, Settings2, Tags, Package, FileUp, Download, AlertCircle, ChevronDown, ChevronRight, ArrowDown, ArrowUp, ArrowUpDown, X, RefreshCw, GripVertical, Store } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { ImageUploadField } from "@/components/ImageUploadField";
import { buildProductListParams, isProductSort, type ProductAvailability, type ProductSort } from "@/lib/productListQuery";

const EMPTY = { name: "", description: "", price: "", category: "", menuItemCategoryId: "", imageUrl: "", isAvailable: true, isPopular: false, allergens: "", tags: "", prepTimeMinutes: "", calories: "", sortOrder: "0" };

type ProductCat = { id: number; restaurantId: number | null; name: string; isActive: boolean; productCount?: number };
function useProductCategories(restaurantId: string | number | undefined) {
  return useQuery<ProductCat[]>({
    queryKey: ["/api/backend/menu-categories", String(restaurantId ?? "")],
    queryFn: () => apiFetch(`/api/backend/menu-categories${restaurantId ? `?restaurantId=${restaurantId}` : ""}`),
    enabled: Boolean(restaurantId),
  });
}

type ProductTableSort = ProductSort | "category" | "availability" | "shop";
type SortDirection = "asc" | "desc";

const PRODUCT_TABLE_SORTS: { key: ProductTableSort; label: string }[] = [
  { key: "name", label: "Nom" },
  { key: "category", label: "Catégorie" },
  { key: "price", label: "Prix" },
  { key: "availability", label: "Disponibilité" },
  { key: "shop", label: "Boutique" },
  { key: "custom", label: "Ordre personnalisé" },
  { key: "createdAt", label: "Date de création" },
];

function isProductTableSort(value: string): value is ProductTableSort {
  return isProductSort(value) || value === "category" || value === "availability" || value === "shop";
}

function compareProductValues(
  left: any,
  right: any,
  sort: ProductTableSort,
  shopName: (restaurantId: number | null | undefined) => string,
): number {
  if (sort === "price") {
    return Number(left.price ?? 0) - Number(right.price ?? 0);
  }
  if (sort === "availability") {
    return Number(Boolean(left.isAvailable)) - Number(Boolean(right.isAvailable));
  }
  if (sort === "category") {
    return String(left.category ?? "").localeCompare(String(right.category ?? ""), "fr", { sensitivity: "base" });
  }
  if (sort === "shop") {
    return shopName(left.restaurantId).localeCompare(shopName(right.restaurantId), "fr", { sensitivity: "base" });
  }
  if (sort === "createdAt") {
    return new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime();
  }
  if (sort === "custom") {
    return Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0);
  }
  return String(left.name ?? "").localeCompare(String(right.name ?? ""), "fr", { sensitivity: "base" });
}

function SortableProductHeader({
  sort,
  activeSort,
  direction,
  onSort,
}: {
  sort: ProductTableSort;
  activeSort: ProductTableSort;
  direction: SortDirection;
  onSort: (sort: ProductTableSort) => void;
}) {
  const label = PRODUCT_TABLE_SORTS.find((option) => option.key === sort)?.label ?? sort;
  const isActive = activeSort === sort;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 -ml-3 gap-1 px-3 font-semibold"
      onClick={() => onSort(sort)}
      aria-label={`Trier par ${label}${isActive ? `, ${direction === "asc" ? "croissant" : "décroissant"}` : ""}`}
      data-testid={`button-sort-products-${sort}`}
    >
      {label}
      {isActive
        ? direction === "asc"
          ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
        : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
    </Button>
  );
}

export default function Products() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<ProductTableSort>("custom");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [shopFilter, setShopFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | ProductAvailability>("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const { data: me } = useBackendMe();
  const apiSort: ProductSort = isProductSort(sortBy) ? sortBy : "custom";
  const productQuery = buildProductListParams(search, apiSort, {
    shopId: shopFilter ? Number(shopFilter) : undefined,
    status: availabilityFilter === "all" ? undefined : availabilityFilter,
    category: categoryFilter || undefined,
    sortDirection,
    page,
    pageSize,
  });
  const {
    data: productPage,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useListBackendProductsPage(productQuery);
  // Keep the page client tolerant of a legacy test/mock response while the
  // production endpoint returns the typed pagination envelope.
  const products = Array.isArray(productPage) ? productPage : productPage?.items;
  const totalCount = Array.isArray(productPage) ? productPage.length : (productPage?.total ?? 0);
  const totalPages = Array.isArray(productPage)
    ? Math.max(1, Math.ceil(totalCount / pageSize))
    : Math.max(1, productPage?.totalPages ?? 1);
  const { data: shops } = useListBackendShops({});
  const qc = useQueryClient();
  const { toast } = useToast();
  const isOwner = me?.user.role === "restaurant_owner" || me?.user.role === "owner";
  const scopedShopIds = me?.scopedShopIds ?? [];
  const visibleShops = isOwner ? (shops || []).filter((s) => scopedShopIds.includes(s.id)) : (shops || []);
  const { data: productCategories, isLoading: categoriesLoading } = useQuery<ProductCat[]>({
    queryKey: ["/api/backend/menu-categories"],
    queryFn: () => apiFetch("/api/backend/menu-categories"),
  });

  const shopName = (restaurantId: number | null | undefined) =>
    visibleShops.find((shop) => shop.id === restaurantId)?.name ?? (restaurantId ? `Boutique #${restaurantId}` : "—");
  const categoryOptions = useMemo(() => {
    const names = new Set<string>();
    (Array.isArray(productCategories) ? productCategories : []).forEach((category) => names.add(category.name));
    (Array.isArray(products) ? products : []).forEach((product) => product.category && names.add(product.category));
    return Array.from(names).sort((left, right) => left.localeCompare(right, "fr", { sensitivity: "base" }));
  }, [productCategories, products]);
  const displayedProducts = useMemo(() => {
    const filtered = Array.isArray(products) ? products : [];
    return [...filtered].sort((left, right) => {
      const result = compareProductValues(left, right, sortBy, shopName);
      return result === 0
        ? (sortDirection === "asc" ? 1 : -1) * (Number(left.id) - Number(right.id))
        : (sortDirection === "asc" ? 1 : -1) * result;
    });
  }, [products, shopName, sortBy, sortDirection]);
  const hasFilters = Boolean(search || shopFilter || categoryFilter || availabilityFilter !== "all");
  const hasResults = displayedProducts.length > 0;

  useEffect(() => {
    setPage(1);
  }, [search, shopFilter, categoryFilter, availabilityFilter, sortBy, sortDirection]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const [createOpen, setCreateOpen] = useState(false);
  const [shopId, setShopId] = useState<string>(isOwner && scopedShopIds.length === 1 ? String(scopedShopIds[0]) : "");
  const [form, setForm] = useState(EMPTY);

  // `me` and `shops` arrive asynchronously. Without this synchronization an
  // owner with one shop keeps the initial empty value forever, so the category
  // query never starts and the listbox looks broken.
  useEffect(() => {
    if (!createOpen || shopId || !isOwner || visibleShops.length !== 1) return;
    setShopId(String(visibleShops[0].id));
  }, [createOpen, isOwner, shopId, visibleShops]);

  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const [optionsProduct, setOptionsProduct] = useState<any | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [orderDrafts, setOrderDrafts] = useState<Record<number, string>>({});
  const [orderSavingIds, setOrderSavingIds] = useState<Set<number>>(new Set());
  const [orderErrors, setOrderErrors] = useState<Record<number, string>>({});
  const [togglePendingIds, setTogglePendingIds] = useState<Set<number>>(new Set());
  const orderQueueRef = useRef(Promise.resolve());

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListBackendProductsQueryKey() });
    qc.invalidateQueries({ queryKey: getListBackendProductsPageQueryKey() });
  };

  const createMutation = useMutation({
    mutationFn: (payload: any) => apiFetch("/api/backend/products", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => { invalidate(); setCreateOpen(false); setForm(EMPTY); setShopId(""); toast({ title: "Produit créé" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiFetch(`/api/backend/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast({ title: "Produit modifié", description: "Les changements sont enregistrés." });
    },
    onError: (e: any) => {
      toast({ title: "Impossible d'enregistrer", description: e?.message ?? "Réessayez.", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: number; isAvailable: boolean }) =>
      apiFetch(`/api/backend/products/${id}`, { method: "PATCH", body: JSON.stringify({ isAvailable }) }),
    onSuccess: (_result, variables) => {
      invalidate();
      setTogglePendingIds((current) => {
        const next = new Set(current);
        next.delete(variables.id);
        return next;
      });
      toast({ title: "Disponibilité mise à jour" });
    },
    onError: (e: any, variables) => {
      setTogglePendingIds((current) => {
        const next = new Set(current);
        next.delete(variables.id);
        return next;
      });
      toast({ title: "Disponibilité non enregistrée", description: e?.message ?? "Réessayez.", variant: "destructive" });
    },
  });

  const orderMutation = useMutation({
    mutationFn: ({ id, sortOrder }: { id: number; sortOrder: number }) =>
      apiFetch(`/api/backend/products/${id}`, { method: "PATCH", body: JSON.stringify({ sortOrder }) }),
    onSuccess: (_result, variables) => {
      invalidate();
      setOrderSavingIds((current) => {
        const next = new Set(current);
        next.delete(variables.id);
        return next;
      });
      setOrderErrors((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      setOrderDrafts((current) => {
        if (current[variables.id] !== String(variables.sortOrder)) return current;
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      toast({ title: "Ordre enregistré" });
    },
    onError: (e: any, variables) => {
      const message = e?.message ?? "Réessayez.";
      setOrderSavingIds((current) => {
        const next = new Set(current);
        next.delete(variables.id);
        return next;
      });
      setOrderErrors((current) => ({ ...current, [variables.id]: message }));
      toast({ title: "Ordre non enregistré", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/backend/products/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Produit supprimé" }); },
    onError: (e: any) => toast({ title: "Suppression impossible", description: e?.message ?? "Ce produit n'a pas été supprimé.", variant: "destructive" }),
  });

  const buildProductPayload = (f: typeof EMPTY) => ({
    name: f.name,
    description: f.description || undefined,
    price: Number(String(f.price).replace(",", ".")),
     category: f.category || undefined,
     menuItemCategoryId: f.menuItemCategoryId ? Number(f.menuItemCategoryId) : undefined,
    imageUrl: f.imageUrl || undefined,
    isAvailable: f.isAvailable,
    isPopular: f.isPopular,
    allergens: f.allergens || undefined,
    tags: f.tags || undefined,
    prepTimeMinutes: f.prepTimeMinutes ? Number(f.prepTimeMinutes) : undefined,
    calories: f.calories ? Number(f.calories) : undefined,
     sortOrder: Number(f.sortOrder) || 0,
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) { toast({ title: "Choisissez une boutique", variant: "destructive" }); return; }
    if (!form.menuItemCategoryId) { toast({ title: "Choisissez une catégorie produit", variant: "destructive" }); return; }
    createMutation.mutate({ restaurantId: Number(shopId), ...buildProductPayload(form) });
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setEditForm({
      name: p.name, description: p.description ?? "", price: String(p.price),
      category: p.category, menuItemCategoryId: p.menuItemCategoryId ? String(p.menuItemCategoryId) : "", imageUrl: p.imageUrl ?? "",
      isAvailable: p.isAvailable, isPopular: p.isPopular,
      allergens: p.allergens ?? "",
      tags: Array.isArray(p.tags) ? p.tags.join(",") : (p.tags ?? ""),
      prepTimeMinutes: p.prepTimeMinutes ? String(p.prepTimeMinutes) : "",
      calories: p.calories ? String(p.calories) : "",
       sortOrder: String(p.sortOrder ?? 0),
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.menuItemCategoryId) {
      toast({ title: "Choisissez une catégorie produit", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: editing.id, data: buildProductPayload(editForm) });
  };

  const handleToggle = (p: any, isAvailable: boolean) => {
    setTogglePendingIds((current) => new Set(current).add(p.id));
    toggleMutation.mutate({ id: p.id, isAvailable });
  };

  const handleSortOrderChange = (product: any, rawValue: string) => {
    const nextOrder = Number(rawValue);
    const currentOrder = Number(product.sortOrder ?? 0);
    if (!rawValue.trim() || !Number.isInteger(nextOrder) || nextOrder < 0) {
      setOrderDrafts((current) => {
        return { ...current, [product.id]: rawValue };
      });
      setOrderErrors((current) => ({ ...current, [product.id]: "Saisissez un nombre entier positif ou nul." }));
      toast({ title: "Ordre invalide", description: "Saisissez un nombre entier positif ou nul.", variant: "destructive" });
      return;
    }
    if (nextOrder === currentOrder) {
      setOrderDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setOrderErrors((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      return;
    }
    setOrderSavingIds((current) => new Set(current).add(product.id));
    setOrderErrors((current) => {
      const next = { ...current };
      delete next[product.id];
      return next;
    });
    const save = orderQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await orderMutation.mutateAsync({ id: product.id, sortOrder: nextOrder });
      })
      .catch(() => undefined);
    orderQueueRef.current = save;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Produits</h1>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportOpen(true)} data-testid="button-import-products">
          <FileUp className="h-4 w-4" /> Importer CSV/JSON
        </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button className="gap-2" data-testid="button-create-product"><Plus className="h-4 w-4" /> Nouveau produit</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto">
            <DialogHeader><DialogTitle>Créer un produit</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3 pt-4">
              <Field label="Boutique">
                <Select
                  value={shopId}
                  onValueChange={(value) => {
                    setShopId(value);
                    setForm((current) => ({ ...current, category: "", menuItemCategoryId: "" }));
                  }}
                  disabled={isOwner && scopedShopIds.length === 1}
                >
                  <SelectTrigger><SelectValue placeholder={isOwner ? "Votre boutique" : "Choisir une boutique"} /></SelectTrigger>
                  <SelectContent>{visibleShops.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <ProductFields form={form} setForm={setForm} restaurantId={shopId || undefined} />
              <DialogFooter className="pt-4"><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Créer</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="produits">
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="produits" className="gap-1.5 shrink-0"><Package className="h-4 w-4" />Produits</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5 shrink-0"><Tags className="h-4 w-4" />Catégories menu</TabsTrigger>
        </TabsList>
        <TabsContent value="produits" className="pt-4">
          {isError && (
            <Alert variant="destructive" className="mb-4" data-testid="status-products-error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>Impossible de charger les produits. {error instanceof Error ? error.message : "Vérifiez votre connexion."}</span>
                <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => refetch()} data-testid="button-retry-products">
                  <RefreshCw className="h-3.5 w-3.5" /> Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader className="space-y-4 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">Catalogue produits</h2>
                  <p className="text-xs text-muted-foreground">Modifiez l’ordre personnalisé pour contrôler l’affichage dans l’application.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="status-products-count">
                  {isLoading ? "Chargement…" : `${displayedProducts.length} produit${displayedProducts.length === 1 ? "" : "s"} affiché${displayedProducts.length === 1 ? "" : "s"} sur ${totalCount}`}
                  {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Actualisation en cours" />}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[13rem] flex-1 sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un produit…"
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-testid="input-product-search"
                  />
                </div>
                <Select
                  value={sortBy}
                  onValueChange={(value) => {
                    if (isProductTableSort(value)) {
                      setSortBy(value);
                      setSortDirection(value === "createdAt" ? "desc" : "asc");
                    }
                  }}
                >
                  <SelectTrigger className="w-full sm:w-48" data-testid="select-product-sort"><SelectValue placeholder="Trier par" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Ordre personnalisé</SelectItem>
                    <SelectItem value="name">Nom</SelectItem>
                    <SelectItem value="category">Catégorie</SelectItem>
                    <SelectItem value="shop">Boutique</SelectItem>
                    <SelectItem value="price">Prix</SelectItem>
                    <SelectItem value="availability">Disponibilité</SelectItem>
                    <SelectItem value="createdAt">Date de création</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={shopFilter || "all"} onValueChange={(value) => setShopFilter(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-full sm:w-44" data-testid="select-product-shop"><SelectValue placeholder="Toutes les boutiques" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les boutiques</SelectItem>
                    {visibleShops.map((shop) => <SelectItem key={shop.id} value={String(shop.id)}>{shop.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter || "all"} onValueChange={(value) => setCategoryFilter(value === "all" ? "" : value)} disabled={categoriesLoading && categoryOptions.length === 0}>
                  <SelectTrigger className="w-full sm:w-44" data-testid="select-product-category"><SelectValue placeholder="Toutes les catégories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {categoryOptions.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={availabilityFilter} onValueChange={(value) => { if (value === "all" || value === "available" || value === "unavailable") setAvailabilityFilter(value); }}>
                  <SelectTrigger className="w-full sm:w-44" data-testid="select-product-availability"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="available">Disponibles</SelectItem>
                    <SelectItem value="unavailable">Indisponibles</SelectItem>
                  </SelectContent>
                </Select>
                {hasFilters && (
                  <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => {
                    setSearch("");
                    setShopFilter("");
                    setCategoryFilter("");
                    setAvailabilityFilter("all");
                  }} data-testid="button-clear-product-filters">
                    <X className="h-3.5 w-3.5" /> Réinitialiser
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><SortableProductHeader sort="name" activeSort={sortBy} direction={sortDirection} onSort={(nextSort) => {
                      if (sortBy === nextSort) setSortDirection((current) => current === "asc" ? "desc" : "asc");
                      else { setSortBy(nextSort); setSortDirection("asc"); }
                    }} /></TableHead>
                    <TableHead className="hidden md:table-cell"><SortableProductHeader sort="shop" activeSort={sortBy} direction={sortDirection} onSort={(nextSort) => {
                      if (sortBy === nextSort) setSortDirection((current) => current === "asc" ? "desc" : "asc");
                      else { setSortBy(nextSort); setSortDirection("asc"); }
                    }} /></TableHead>
                    <TableHead className="hidden sm:table-cell"><SortableProductHeader sort="category" activeSort={sortBy} direction={sortDirection} onSort={(nextSort) => {
                      if (sortBy === nextSort) setSortDirection((current) => current === "asc" ? "desc" : "asc");
                      else { setSortBy(nextSort); setSortDirection("asc"); }
                    }} /></TableHead>
                    <TableHead><SortableProductHeader sort="custom" activeSort={sortBy} direction={sortDirection} onSort={(nextSort) => {
                      if (sortBy === nextSort) setSortDirection((current) => current === "asc" ? "desc" : "asc");
                      else { setSortBy(nextSort); setSortDirection("asc"); }
                    }} /></TableHead>
                    <TableHead><SortableProductHeader sort="price" activeSort={sortBy} direction={sortDirection} onSort={(nextSort) => {
                      if (sortBy === nextSort) setSortDirection((current) => current === "asc" ? "desc" : "asc");
                      else { setSortBy(nextSort); setSortDirection("asc"); }
                    }} /></TableHead>
                    <TableHead><SortableProductHeader sort="availability" activeSort={sortBy} direction={sortDirection} onSort={(nextSort) => {
                      if (sortBy === nextSort) setSortDirection((current) => current === "asc" ? "desc" : "asc");
                      else { setSortBy(nextSort); setSortDirection("asc"); }
                    }} /></TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  )) : isError ? (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Les produits ne sont pas disponibles.</TableCell></TableRow>
                  ) : totalCount === 0 && !hasFilters ? (
                    <TableRow><TableCell colSpan={7} className="h-28 text-center">
                      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                        <Package className="h-8 w-8 opacity-40" />
                        <span>Aucun produit pour le moment.</span>
                        <span className="text-xs">Créez votre premier produit avec le bouton « Nouveau produit ».</span>
                      </div>
                    </TableCell></TableRow>
                  ) : !hasResults ? (
                    <TableRow><TableCell colSpan={7} className="h-28 text-center">
                      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                        <Search className="h-7 w-7 opacity-40" />
                        <span>Aucun produit ne correspond à ces filtres.</span>
                        <Button type="button" variant="link" size="sm" onClick={() => {
                          setSearch("");
                          setShopFilter("");
                          setCategoryFilter("");
                          setAvailabilityFilter("all");
                        }} data-testid="button-clear-empty-product-filters">Effacer les filtres</Button>
                      </div>
                    </TableCell></TableRow>
                  ) : displayedProducts.map((p) => (
                    <TableRow key={p.id} data-testid={`row-product-${p.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-3 min-w-[12rem]">
                          {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="h-10 w-10 rounded-md object-cover" data-testid={`img-product-${p.id}`} /> : <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center"><span className="text-xs text-muted-foreground">—</span></div>}
                          <span data-testid={`text-product-name-${p.id}`}>{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Store className="h-3.5 w-3.5" />{shopName(p.restaurantId)}</span></TableCell>
                      <TableCell className="hidden sm:table-cell"><Badge variant="secondary">{p.category}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={orderDrafts[p.id] ?? String(p.sortOrder ?? 0)}
                            onChange={(e) => {
                              setOrderDrafts((current) => ({ ...current, [p.id]: e.target.value }));
                              setOrderErrors((current) => {
                                const next = { ...current };
                                delete next[p.id];
                                return next;
                              });
                            }}
                            onBlur={(e) => handleSortOrderChange(p, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                            disabled={orderSavingIds.has(p.id)}
                            aria-invalid={Boolean(orderErrors[p.id])}
                            className={`h-8 w-20 ${orderErrors[p.id] ? "border-destructive focus-visible:ring-destructive" : ""}`}
                            aria-label={`Ordre personnalisé de ${p.name}`}
                            data-testid={`input-product-order-${p.id}`}
                          />
                          {orderSavingIds.has(p.id) && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Enregistrement de l’ordre" />}
                        </div>
                        {orderErrors[p.id] && <p className="mt-1 max-w-[12rem] text-[11px] text-destructive" role="alert" data-testid={`status-product-order-error-${p.id}`}>{orderErrors[p.id]}</p>}
                      </TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">{p.price} DH</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={p.isAvailable} onCheckedChange={(v) => handleToggle(p, v)} disabled={togglePendingIds.has(p.id)} data-testid={`switch-product-availability-${p.id}`} />
                          <span className="hidden lg:inline text-xs text-muted-foreground">{p.isAvailable ? "Disponible" : "Indisponible"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-10 w-10" title="Options" onClick={() => setOptionsProduct(p)} aria-label={`Gérer les options de ${p.name}`} data-testid={`button-product-options-${p.id}`}><Settings2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-10 w-10" title="Modifier" onClick={() => openEdit(p)} aria-label={`Modifier ${p.name}`} data-testid={`button-edit-product-${p.id}`}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:bg-destructive/10" title="Supprimer" onClick={() => setDeleting(p)} aria-label={`Supprimer ${p.name}`} data-testid={`button-delete-product-${p.id}`}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            {totalCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3 text-xs text-muted-foreground" data-testid="pagination-products">
                <span>
                  Page {page} sur {totalPages} · {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} sur {totalCount}
                </span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || isFetching} data-testid="button-products-previous-page">
                    Précédente
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || isFetching} data-testid="button-products-next-page">
                    Suivante
                  </Button>
                </div>
              </div>
            )}
          </Card>

        </TabsContent>
        <TabsContent value="categories" className="pt-4">
          <ProductMenuCategories />
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier {editing?.name}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={handleUpdate} className="space-y-3 pt-4">
              <ProductFields form={editForm} setForm={setEditForm} restaurantId={editing?.restaurantId} />
              <DialogFooter className="pt-4"><Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Enregistrer</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleting?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Un produit utilisé dans une commande ne peut pas être supprimé : rendez-le indisponible à la place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} data-testid="button-cancel-delete-product">Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
              data-testid="button-confirm-delete-product"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OptionsDialogWrapper product={optionsProduct} onClose={() => setOptionsProduct(null)} />
      <ImportProductsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        shops={visibleShops}
        isOwner={isOwner}
        scopedShopIds={scopedShopIds}
      />
    </div>
  );
}

// ─── Product Menu Categories ────────────────────────────────────────────────

type MenuCat = { id: number; restaurantId: number | null; name: string; sortOrder: number; isActive: boolean; productCount?: number };

function ProductMenuCategories() {
  const { data: me } = useBackendMe();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isOwner = me?.user.role === "restaurant_owner" || me?.user.role === "owner";
  const grants = (me as any)?.permissions ?? [];
  const canManage = ["super_admin", "admin"].includes(me?.user.role ?? "") || isOwner || grants.some((grant: string) =>
    grant === "*" || grant === "products.*" || grant === "products.write" || grant === "products.*.own"
  );
  const { data: shops } = useListBackendShops({});

  const { data: productCats, isLoading: pcLoading } = useQuery<MenuCat[]>({
    queryKey: ["/api/backend/menu-categories"],
    queryFn: () => apiFetch("/api/backend/menu-categories"),
  });

  const [newCat, setNewCat] = useState({ name: "", restaurantId: "", sortOrder: "0" });
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<{ id: number; name: string; sortOrder: number } | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<MenuCat | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<number | null>(null);
  const { data: expandedProducts, isLoading: expandedProductsLoading } = useQuery<any[]>({
    queryKey: ["/api/backend/menu-categories", expandedCategoryId, "products"],
    queryFn: () => apiFetch(`/api/backend/menu-categories/${expandedCategoryId}/products`),
    enabled: expandedCategoryId !== null,
  });

  const invalidatePC = () => {
    qc.invalidateQueries({ queryKey: ["/api/backend/menu-categories"] });
    // Renaming/toggling a category changes product labels/visibility in the
    // same dashboard session; do not wait for a navigation to refresh them.
    qc.invalidateQueries({ queryKey: getListBackendProductsQueryKey() });
  };

  const createMutation = useMutation({
    mutationFn: () => apiFetch("/api/backend/menu-categories", {
      method: "POST",
       body: JSON.stringify({ name: newCat.name.trim(), restaurantId: newCat.restaurantId ? Number(newCat.restaurantId) : null, sortOrder: Number(newCat.sortOrder) || 0 }),
    }),
    onSuccess: () => { invalidatePC(); setCreating(false); setNewCat({ name: "", restaurantId: "", sortOrder: "0" }); toast({ title: "Catégorie créée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name, sortOrder }: { id: number; name: string; sortOrder: number }) =>
      apiFetch(`/api/backend/menu-categories/${id}`, { method: "PATCH", body: JSON.stringify({ name, sortOrder }) }),
    onSuccess: () => { invalidatePC(); setRenaming(null); toast({ title: "Renommée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/backend/menu-categories/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidatePC(); setDeleting(null); toast({ title: "Supprimée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiFetch(`/api/backend/menu-categories/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => { invalidatePC(); toast({ title: "Statut mis à jour" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
  });

  return (
    <Card className="max-w-3xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <h2 className="text-base font-semibold">Catégories de produits</h2>
        {canManage && <Button size="sm" onClick={() => {
          if (isOwner && !newCat.restaurantId && shops?.[0]) {
            setNewCat((current) => ({ ...current, restaurantId: String(shops[0].id) }));
          }
          setCreating(true);
        }} className="gap-2"><Plus className="h-4 w-4" />Nouvelle</Button>}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead className="hidden sm:table-cell">Restaurant</TableHead>
              <TableHead className="hidden md:table-cell">Produits</TableHead>
              <TableHead className="hidden sm:table-cell">Ordre</TableHead>
              <TableHead>Statut</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pcLoading ? Array.from({ length: 4 }).map((_, i) => (
               <TableRow key={i}><TableCell><Skeleton className="h-4 w-32" /></TableCell><TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" /></TableCell><TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8" /></TableCell><TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-8" /></TableCell><TableCell /><>{canManage && <TableCell />}</></TableRow>
            )) : productCats?.length === 0 ? (
               <TableRow><TableCell colSpan={canManage ? 6 : 5} className="h-24 text-center text-muted-foreground">Aucune catégorie produit.</TableCell></TableRow>
               ) : productCats?.map((cat) => (
               <Fragment key={cat.id}>
               <TableRow>
                 <TableCell className="font-medium">
                   <Button
                     variant="ghost"
                     size="sm"
                     className="h-8 px-1.5 -ml-1.5 gap-1.5 font-medium"
                     onClick={() => setExpandedCategoryId((current) => current === cat.id ? null : cat.id)}
                     aria-expanded={expandedCategoryId === cat.id}
                   >
                     {expandedCategoryId === cat.id
                       ? <ChevronDown className="h-4 w-4" />
                       : <ChevronRight className="h-4 w-4" />}
                     {cat.name}
                   </Button>
                 </TableCell>
                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                  {cat.restaurantId
                    ? (shops as any[] | undefined)?.find((s: any) => s.id === cat.restaurantId)?.name ?? `#${cat.restaurantId}`
                    : <Badge variant="secondary">Global</Badge>}
                </TableCell>
                 <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{cat.productCount ?? 0}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{cat.sortOrder}</TableCell>
                 <TableCell>
                   <Badge variant={cat.isActive ? "default" : "outline"}>{cat.isActive ? "Active" : "Inactive"}</Badge>
                 </TableCell>
                 {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                       <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate({ id: cat.id, isActive: !cat.isActive })}>{cat.isActive ? "Désactiver" : "Activer"}</Button>
                       <Button variant="ghost" size="icon" onClick={() => { setRenaming({ id: cat.id, name: cat.name, sortOrder: cat.sortOrder }); setNewName(cat.name); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleting(cat)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
               {expandedCategoryId === cat.id && (
                 <TableRow key={`${cat.id}-products`} className="bg-muted/30">
                   <TableCell colSpan={canManage ? 6 : 5} className="py-3">
                     {expandedProductsLoading ? (
                       <div className="text-sm text-muted-foreground">Chargement des produits…</div>
                     ) : expandedProducts?.length ? (
                       <div className="flex flex-wrap gap-2">
                         {expandedProducts.map((product) => (
                           <Badge key={product.id} variant="outline">
                             {product.name} · {Number(product.price).toFixed(2)} MAD
                           </Badge>
                         ))}
                       </div>
                     ) : (
                       <span className="text-sm text-muted-foreground">Aucun produit dans cette catégorie.</span>
                     )}
                   </TableCell>
                 </TableRow>
               )}
               </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouvelle catégorie produit</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newCat.name.trim()) createMutation.mutate(); }} className="space-y-4 pt-2">
            <div className="space-y-1"><Label className="text-xs">Nom *</Label><Input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} required autoFocus /></div>
            <div className="space-y-1">
              <Label className="text-xs">Restaurant (vide = global)</Label>
               <Select value={newCat.restaurantId || "global"} onValueChange={(v) => setNewCat({ ...newCat, restaurantId: v === "global" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Global" /></SelectTrigger>
                <SelectContent className="z-[200]">
                   <SelectItem value="global" disabled={isOwner}>— Global —</SelectItem>
                   {(shops as any[] | undefined)?.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Ordre</Label><Input type="number" value={newCat.sortOrder} onChange={(e) => setNewCat({ ...newCat, sortOrder: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending || !newCat.name.trim()}>{createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Créer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

       <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
           <DialogHeader><DialogTitle>Modifier «{renaming?.name}»</DialogTitle></DialogHeader>
           <form onSubmit={(e) => { e.preventDefault(); if (renaming && newName.trim()) renameMutation.mutate({ id: renaming.id, name: newName.trim(), sortOrder: renaming.sortOrder }); }} className="space-y-4 pt-2">
            <div className="space-y-1"><Label className="text-xs">Nouveau nom</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} required /></div>
             <div className="space-y-1"><Label className="text-xs">Ordre</Label><Input type="number" min="0" value={renaming?.sortOrder ?? 0} onChange={(e) => setRenaming((current) => current ? { ...current, sortOrder: Number(e.target.value) || 0 } : current)} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(null)}>Annuler</Button>
               <Button type="submit" disabled={renameMutation.isPending || !newName.trim()}>{renameMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer «{deleting?.name}» ?</AlertDialogTitle>
            <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

const DIET_TAGS = [
  { value: "halal", label: "Halal" },
  { value: "vegetarian", label: "Végétarien" },
  { value: "vegan", label: "Vegan" },
  { value: "spicy", label: "Épicé" },
  { value: "gluten_free", label: "Sans gluten" },
];

function ProductFields({ form, setForm, restaurantId }: { form: any; setForm: any; restaurantId?: string | number }) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const { data: productCats, isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useProductCategories(restaurantId);
  const categoryOptions = (productCats ?? []).filter((category) =>
    category.isActive || String(category.id) === String(form.menuItemCategoryId),
  );
  const hasRestaurant = Boolean(restaurantId);
  const selectedTags: string[] = form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [];
  const toggleTag = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    set("tags", next.join(","));
  };
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nom *"><Input required value={form.name} onChange={(e: any) => set("name", e.target.value)} /></Field>
        <Field label="Catégorie *">
          {hasRestaurant ? (
            <Select
              value={form.menuItemCategoryId ? String(form.menuItemCategoryId) : ""}
              onValueChange={(id) => {
                const selected = productCats?.find((c) => String(c.id) === id);
                setForm({ ...form, menuItemCategoryId: id, category: selected?.name ?? "" });
              }}
              disabled={categoriesLoading || categoriesError || categoryOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    categoriesLoading
                      ? "Chargement des catégories…"
                      : categoriesError
                        ? "Catégories indisponibles"
                        : categoryOptions.length === 0
                          ? "Aucune catégorie active"
                          : "Choisir une catégorie"
                  }
                />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                 {categoryOptions.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                     {c.name}{c.restaurantId !== null ? " · boutique" : " · globale"}{!c.isActive ? " · inactive" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Sélectionnez d’abord une boutique pour charger ses catégories menu.
            </div>
          )}
          {hasRestaurant && categoriesError && (
            <div className="flex items-center justify-between gap-2 text-xs text-destructive" role="alert">
              <span>Impossible de charger les catégories.</span>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => refetchCategories()}>
                Réessayer
              </Button>
            </div>
          )}
          {hasRestaurant && !categoriesLoading && !categoriesError && categoryOptions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Aucune catégorie active pour cette boutique. Créez-en une dans l’onglet « Catégories menu ».
            </p>
          )}
        </Field>
        <Field label="Prix (DH) *"><Input required type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" step="0.01" value={form.price} onChange={(e: any) => set("price", e.target.value)} /></Field>
        <Field label="Ordre personnalisé">
          <Input type="number" step="1" value={form.sortOrder} onChange={(e: any) => set("sortOrder", e.target.value)} />
        </Field>
        <ImageUploadField
          label="Image"
          value={form.imageUrl}
          onValueChange={(value) => set("imageUrl", value)}
          uploadKind="media"
          previewClassName="h-16 w-16"
        />
      </div>
      <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e: any) => set("description", e.target.value)} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Allergènes">
          <Input value={form.allergens} onChange={(e: any) => set("allergens", e.target.value)} placeholder="gluten, lactose, noix…" />
        </Field>
        <Field label="Préparation (min)">
          <Input type="number" min="0" value={form.prepTimeMinutes} onChange={(e: any) => set("prepTimeMinutes", e.target.value)} placeholder="15" />
        </Field>
        <Field label="Calories (kcal)">
          <Input type="number" min="0" value={form.calories} onChange={(e: any) => set("calories", e.target.value)} placeholder="850" />
        </Field>
      </div>
      <div>
        <Label className="text-xs">Tags diététiques</Label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {DIET_TAGS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleTag(value)}
              className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                selectedTags.includes(value)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-6 pt-1">
        <label className="flex items-center gap-2 text-sm cursor-pointer"><Switch checked={form.isAvailable} onCheckedChange={(v: any) => set("isAvailable", v)} /> Disponible</label>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><Switch checked={form.isPopular} onCheckedChange={(v: any) => set("isPopular", v)} /> Populaire</label>
      </div>
    </>
  );
}

function Field({ label, children }: any) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

interface MenuItemSize { id: number; menuItemId: number; name: string; priceAdjustment: number; sortOrder: number; isAvailable: boolean; }
interface MenuItemExtra { id: number; menuItemId: number; name: string; price: number; sortOrder: number; isAvailable: boolean; }
interface ReusableOptionsCatalog {
  products: { id: number; name: string }[];
  sizes: { id: number; menuItemId: number; name: string; sourceProductName: string | null }[];
  extras: { id: number; menuItemId: number; name: string; sourceProductName: string | null }[];
}

function OptionsDialog({ product, onClose }: { product: any | null; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("sizes");
  const [sizeForm, setSizeForm] = useState({ name: "", priceAdjustment: "0", sortOrder: "0", isAvailable: true });
  const [extraForm, setExtraForm] = useState({ name: "", price: "0", sortOrder: "0", isAvailable: true });
  const [editingSize, setEditingSize] = useState<MenuItemSize | null>(null);
  const [editingExtra, setEditingExtra] = useState<MenuItemExtra | null>(null);
  const [sourceProductId, setSourceProductId] = useState("");
  const [importing, setImporting] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [`/api/menu/${product?.id}/sizes`] });
    qc.invalidateQueries({ queryKey: [`/api/menu/${product?.id}/extras`] });
  };

  const { data: sizes, isLoading: sizesLoading } = useQuery<MenuItemSize[]>({
    queryKey: [`/api/menu/${product?.id}/sizes`],
    queryFn: () => apiFetch(`/api/menu/${product.id}/sizes`),
    enabled: !!product,
  });
  const { data: extras, isLoading: extrasLoading } = useQuery<MenuItemExtra[]>({
    queryKey: [`/api/menu/${product?.id}/extras`],
    queryFn: () => apiFetch(`/api/menu/${product.id}/extras`),
    enabled: !!product,
  });
  const { data: reusableOptions } = useQuery<ReusableOptionsCatalog>({
    queryKey: [`/api/backend/options/${product?.restaurantId}`],
    queryFn: () => apiFetch(`/api/backend/options?restaurantId=${product.restaurantId}`),
    enabled: !!product?.restaurantId,
  });

  const importOptions = async () => {
    if (!product || !sourceProductId) return;
    setImporting(true);
    try {
      await apiFetch(`/api/backend/products/${product.id}/options/import`, {
        method: "POST",
        body: JSON.stringify({ sourceProductId: Number(sourceProductId) }),
      });
      invalidate();
      toast({ title: "Options importées", description: "Les tailles et suppléments du produit source ont été copiés." });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const createSize = async () => {
    if (!product) return;
    try {
      await apiFetch(`/api/menu/${product.id}/sizes`, {
        method: "POST",
        body: JSON.stringify({
          name: sizeForm.name,
          priceAdjustment: Number(sizeForm.priceAdjustment),
          sortOrder: Number(sizeForm.sortOrder),
          isAvailable: sizeForm.isAvailable,
        }),
      });
      setSizeForm({ name: "", priceAdjustment: "0", sortOrder: "0", isAvailable: true });
      invalidate();
      toast({ title: "Taille créée" });
    } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
  };

  const updateSize = async () => {
    if (!editingSize) return;
    try {
      await apiFetch(`/api/menu/sizes/${editingSize.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editingSize.name,
          priceAdjustment: editingSize.priceAdjustment,
          sortOrder: editingSize.sortOrder,
          isAvailable: editingSize.isAvailable,
        }),
      });
      setEditingSize(null);
      invalidate();
      toast({ title: "Taille mise à jour" });
    } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
  };

  const deleteSize = async (id: number) => {
    if (!confirm("Supprimer cette taille ?")) return;
    try {
      await apiFetch(`/api/menu/sizes/${id}`, { method: "DELETE" });
      invalidate();
      toast({ title: "Taille supprimée" });
    } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
  };

  const createExtra = async () => {
    if (!product) return;
    try {
      await apiFetch(`/api/menu/${product.id}/extras`, {
        method: "POST",
        body: JSON.stringify({
          name: extraForm.name,
          price: Number(extraForm.price),
          sortOrder: Number(extraForm.sortOrder),
          isAvailable: extraForm.isAvailable,
        }),
      });
      setExtraForm({ name: "", price: "0", sortOrder: "0", isAvailable: true });
      invalidate();
      toast({ title: "Supplément créé" });
    } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
  };

  const updateExtra = async () => {
    if (!editingExtra) return;
    try {
      await apiFetch(`/api/menu/extras/${editingExtra.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editingExtra.name,
          price: editingExtra.price,
          sortOrder: editingExtra.sortOrder,
          isAvailable: editingExtra.isAvailable,
        }),
      });
      setEditingExtra(null);
      invalidate();
      toast({ title: "Supplément mis à jour" });
    } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
  };

  const deleteExtra = async (id: number) => {
    if (!confirm("Supprimer ce supplément ?")) return;
    try {
      await apiFetch(`/api/menu/extras/${id}`, { method: "DELETE" });
      invalidate();
      toast({ title: "Supplément supprimé" });
    } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
  };

  if (!product) return null;

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Options — {product.name}</DialogTitle>
          <DialogDescription>Gérez les tailles et suppléments affichés dans l'app mobile.</DialogDescription>
        </DialogHeader>
        {!!reusableOptions?.products?.filter((p) => p.id !== product.id).length && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <Label className="text-xs font-medium">Réutiliser les options d'un autre produit</Label>
            <div className="flex gap-2">
              <Select value={sourceProductId} onValueChange={setSourceProductId}>
                <SelectTrigger className="min-w-0 flex-1">
                  <SelectValue placeholder="Choisir un produit source" />
                </SelectTrigger>
                <SelectContent className="z-[300]">
                  {reusableOptions.products.filter((p) => p.id !== product.id).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={importOptions} disabled={!sourceProductId || importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importer"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">L'import remplace les options actuelles de ce produit.</p>
          </div>
        )}
        <Tabs value={tab} onValueChange={setTab} className="pt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sizes">Tailles</TabsTrigger>
            <TabsTrigger value="extras">Suppléments</TabsTrigger>
          </TabsList>
          <TabsContent value="sizes" className="space-y-4 pt-2">
            {/* Add size form — responsive flex */}
            <div className="flex flex-col sm:flex-row gap-2 items-end border-b pb-4">
              <div className="flex-1 min-w-0 space-y-1">
                <Label className="text-xs">Nom</Label>
                <Input value={sizeForm.name} onChange={(e) => setSizeForm({ ...sizeForm, name: e.target.value })} placeholder="Large, XL…" />
              </div>
              <div className="w-full sm:w-28 space-y-1">
                <Label className="text-xs">Ajust. prix</Label>
                 <Input type="text" inputMode="decimal" value={sizeForm.priceAdjustment} onChange={(e) => setSizeForm({ ...sizeForm, priceAdjustment: e.target.value })} />
              </div>
              <div className="w-full sm:w-20 space-y-1">
                <Label className="text-xs">Ordre</Label>
                <Input type="number" value={sizeForm.sortOrder} onChange={(e) => setSizeForm({ ...sizeForm, sortOrder: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 sm:pb-0.5">
                <Switch checked={sizeForm.isAvailable} onCheckedChange={(v) => setSizeForm({ ...sizeForm, isAvailable: v })} />
                <span className="text-xs">Actif</span>
              </div>
              <Button size="icon" onClick={createSize} disabled={!sizeForm.name} className="shrink-0 sm:self-end">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {sizesLoading ? <Skeleton className="h-20 w-full" /> : sizes?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune taille. Ajoutez-en une ci-dessus.</p>
            ) : (
              <div className="space-y-2">
                {sizes?.map((s) => editingSize?.id === s.id ? (
                  <div key={s.id} className="flex flex-col sm:flex-row gap-2 items-end bg-muted/40 p-2 rounded-md">
                    <Input className="flex-1" value={editingSize.name} onChange={(e) => setEditingSize({ ...editingSize, name: e.target.value })} />
                     <Input className="w-full sm:w-28" type="text" inputMode="decimal" value={editingSize.priceAdjustment} onChange={(e) => setEditingSize({ ...editingSize, priceAdjustment: Number(String(e.target.value).replace(",", ".")) })} />
                    <Input className="w-full sm:w-20" type="number" value={editingSize.sortOrder} onChange={(e) => setEditingSize({ ...editingSize, sortOrder: Number(e.target.value) })} />
                    <Switch checked={editingSize.isAvailable} onCheckedChange={(v) => setEditingSize({ ...editingSize, isAvailable: v })} />
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={updateSize}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteSize(s.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ) : (
                  <div key={s.id} className="flex items-center justify-between p-2.5 border rounded-md gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{s.name}</span>
                      <span className="text-sm text-muted-foreground shrink-0">{s.priceAdjustment > 0 ? `+${s.priceAdjustment}` : s.priceAdjustment} MAD</span>
                      <Badge variant={s.isAvailable ? "default" : "secondary"} className="shrink-0">{s.isAvailable ? "Actif" : "Inactif"}</Badge>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingSize(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteSize(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="extras" className="space-y-4 pt-2">
            {/* Add extra form — responsive flex */}
            <div className="flex flex-col sm:flex-row gap-2 items-end border-b pb-4">
              <div className="flex-1 min-w-0 space-y-1">
                <Label className="text-xs">Nom</Label>
                <Input value={extraForm.name} onChange={(e) => setExtraForm({ ...extraForm, name: e.target.value })} placeholder="Fromage extra…" />
              </div>
              <div className="w-full sm:w-28 space-y-1">
                <Label className="text-xs">Prix (DH)</Label>
                 <Input type="text" inputMode="decimal" value={extraForm.price} onChange={(e) => setExtraForm({ ...extraForm, price: e.target.value })} />
              </div>
              <div className="w-full sm:w-20 space-y-1">
                <Label className="text-xs">Ordre</Label>
                <Input type="number" value={extraForm.sortOrder} onChange={(e) => setExtraForm({ ...extraForm, sortOrder: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 sm:pb-0.5">
                <Switch checked={extraForm.isAvailable} onCheckedChange={(v) => setExtraForm({ ...extraForm, isAvailable: v })} />
                <span className="text-xs">Actif</span>
              </div>
              <Button size="icon" onClick={createExtra} disabled={!extraForm.name} className="shrink-0 sm:self-end">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {extrasLoading ? <Skeleton className="h-20 w-full" /> : extras?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun supplément. Ajoutez-en un ci-dessus.</p>
            ) : (
              <div className="space-y-2">
                {extras?.map((x) => editingExtra?.id === x.id ? (
                  <div key={x.id} className="flex flex-col sm:flex-row gap-2 items-end bg-muted/40 p-2 rounded-md">
                    <Input className="flex-1" value={editingExtra.name} onChange={(e) => setEditingExtra({ ...editingExtra, name: e.target.value })} />
                     <Input className="w-full sm:w-28" type="text" inputMode="decimal" value={editingExtra.price} onChange={(e) => setEditingExtra({ ...editingExtra, price: Number(String(e.target.value).replace(",", ".")) })} />
                    <Input className="w-full sm:w-20" type="number" value={editingExtra.sortOrder} onChange={(e) => setEditingExtra({ ...editingExtra, sortOrder: Number(e.target.value) })} />
                    <Switch checked={editingExtra.isAvailable} onCheckedChange={(v) => setEditingExtra({ ...editingExtra, isAvailable: v })} />
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={updateExtra}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteExtra(x.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ) : (
                  <div key={x.id} className="flex items-center justify-between p-2.5 border rounded-md gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{x.name}</span>
                      <span className="text-sm text-muted-foreground shrink-0">{x.price > 0 ? `+${x.price}` : x.price === 0 ? "Inclus" : x.price} MAD</span>
                      <Badge variant={x.isAvailable ? "default" : "secondary"} className="shrink-0">{x.isAvailable ? "Actif" : "Inactif"}</Badge>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingExtra(x)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteExtra(x.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function OptionsDialogWrapper({ product, onClose }: { product: any | null; onClose: () => void }) {
  return product ? <OptionsDialog product={product} onClose={onClose} /> : null;
}

// ─── CSV/JSON Import Dialog ──────────────────────────────────────────────────

const CSV_TEMPLATE_HEADERS = "name,description,price,category,imageUrl,isAvailable,isPopular,allergens,prepTimeMinutes,calories,tags";
const CSV_EXAMPLE = `Pizza Margherita,"Tomate et mozzarella",49.90,Pizza,,true,false,"gluten,lactose",15,850,
Salade César,"Fraîche et légère",35.00,Salade,,true,true,,10,320,vegetarian`;

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const values: string[] = [];
    let cur = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { values.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").replace(/^"|"$/g, "")]));
  });
}

function ImportProductsDialog({
  open, onClose, shops, isOwner, scopedShopIds,
}: {
  open: boolean; onClose: () => void;
  shops: any[]; isOwner: boolean; scopedShopIds: number[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [shopId, setShopId] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const visibleShops = isOwner
    ? shops.filter((s) => scopedShopIds.includes(s.id))
    : shops;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) { setParseError("Le JSON doit être un tableau d'objets."); return; }
          setRows(parsed.map((r) => ({ ...r })));
          setParseError("");
        } else {
          const parsed = parseCSV(text);
          if (!parsed.length) { setParseError("Fichier vide ou format invalide."); return; }
          setRows(parsed);
          setParseError("");
        }
      } catch (err: any) {
        setParseError(`Erreur de parsing: ${err?.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!shopId) { toast({ title: "Choisissez une boutique", variant: "destructive" }); return; }
    if (!rows.length) { toast({ title: "Aucun produit à importer", variant: "destructive" }); return; }
    setImporting(true);
    setProgress({ done: 0, total: rows.length });
    let successes = 0;
    let errors = 0;
    for (const row of rows) {
      try {
        const price = parseFloat(row.price);
        if (!row.name || isNaN(price)) { errors++; setProgress((p) => ({ ...p, done: p.done + 1 })); continue; }
        await apiFetch("/api/backend/products", {
          method: "POST",
          body: JSON.stringify({
            restaurantId: Number(shopId),
            name: row.name.trim(),
            description: row.description || undefined,
            price,
            category: row.category || "Général",
            imageUrl: row.imageUrl || undefined,
            isAvailable: row.isAvailable !== "false",
            isPopular: row.isPopular === "true",
            allergens: row.allergens || undefined,
            prepTimeMinutes: row.prepTimeMinutes ? Number(row.prepTimeMinutes) : undefined,
            calories: row.calories ? Number(row.calories) : undefined,
            tags: row.tags || undefined,
          }),
        });
        successes++;
      } catch { errors++; }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    qc.invalidateQueries({ queryKey: getListBackendProductsQueryKey() });
    setImporting(false);
    toast({ title: `Import terminé: ${successes} créés, ${errors} erreurs` });
    if (successes > 0) { setRows([]); onClose(); }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_HEADERS + "\n" + CSV_EXAMPLE], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "produits_template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !importing) { onClose(); setRows([]); setParseError(""); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" /> Importer des produits
          </DialogTitle>
          <DialogDescription>
            Téléversez un fichier CSV ou JSON pour créer plusieurs produits en une fois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {/* Template download */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
              <span>Colonnes requises: <strong>name</strong>, <strong>price</strong>, <strong>category</strong></span>
              <Button variant="outline" size="sm" className="gap-2 h-7" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5" /> Télécharger le modèle CSV
              </Button>
            </AlertDescription>
          </Alert>

          {/* Shop select */}
          <div className="space-y-1">
            <Label className="text-xs">Boutique cible *</Label>
            <Select value={shopId || "none"} onValueChange={(v) => setShopId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Choisir une boutique" /></SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="none">— Choisir —</SelectItem>
                {visibleShops.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File input */}
          <div className="space-y-2">
            <Label className="text-xs">Fichier CSV ou JSON</Label>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                <FileUp className="h-4 w-4" />
                {rows.length > 0 ? `${rows.length} ligne(s) chargée(s)` : "Choisir un fichier"}
              </Button>
              {rows.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setRows([])}>Effacer</Button>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFile} />
            {parseError && <p className="text-xs text-destructive">{parseError}</p>}
          </div>

          {/* Preview table */}
          {rows.length > 0 && (
            <div className="border rounded-md overflow-x-auto max-h-60">
              <table className="text-xs w-full">
                <thead className="bg-muted/60 sticky top-0">
                  <tr>
                    {Object.keys(rows[0]).slice(0, 6).map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                    ))}
                    {Object.keys(rows[0]).length > 6 && <th className="px-2 py-1.5 text-left font-medium">…</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      {Object.values(row).slice(0, 6).map((v, j) => (
                        <td key={j} className="px-2 py-1 max-w-[140px] truncate">{String(v)}</td>
                      ))}
                      {Object.keys(row).length > 6 && <td className="px-2 py-1 text-muted-foreground">…</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <p className="text-xs text-muted-foreground text-center py-1.5 border-t">
                  + {rows.length - 20} lignes non affichées
                </p>
              )}
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Import en cours: {progress.done}/{progress.total}
            </div>
          )}
        </div>
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => { onClose(); setRows([]); setParseError(""); }} disabled={importing}>
            Annuler
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || !shopId || !rows.length}
            className="gap-2"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Importer {rows.length > 0 ? `(${rows.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
