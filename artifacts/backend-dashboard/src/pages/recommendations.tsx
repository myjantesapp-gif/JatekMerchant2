import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Search, Store, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type RecommendationProduct = {
  id: number;
  restaurantId: number;
  restaurantName: string;
  name: string;
  imageUrl: string | null;
  price: number;
  isAvailable: boolean;
  isRecommended: boolean;
};

type RecommendationRestaurant = {
  id: number;
  name: string;
  imageUrl: string | null;
  logoUrl: string | null;
  businessType: string;
  isOpen: boolean;
  isVerified: boolean;
  isRecommended: boolean;
};

type RecommendationData = {
  products: RecommendationProduct[];
  restaurants: RecommendationRestaurant[];
};

export default function Recommendations() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError } = useQuery<RecommendationData>({
    queryKey: ["/api/backend/recommendations"],
    queryFn: () => apiFetch("/api/backend/recommendations"),
    refetchInterval: 30_000,
  });

  const mutation = useMutation({
    mutationFn: ({ kind, id, isRecommended }: { kind: "products" | "restaurants"; id: number; isRecommended: boolean }) =>
      apiFetch(`/api/backend/recommendations/${kind}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isRecommended }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/backend/recommendations"] });
      toast({ title: "Recommandation mise à jour" });
    },
    onError: (error: any) => toast({ title: "Impossible de mettre à jour", description: error?.message, variant: "destructive" }),
  });

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const products = useMemo(
    () => (data?.products ?? []).filter((item) => `${item.name} ${item.restaurantName}`.toLocaleLowerCase().includes(normalizedSearch)),
    [data?.products, normalizedSearch],
  );
  const restaurants = useMemo(
    () => (data?.restaurants ?? []).filter((item) => `${item.name} ${item.businessType}`.toLocaleLowerCase().includes(normalizedSearch)),
    [data?.restaurants, normalizedSearch],
  );
  const recommendedProducts = data?.products.filter((item) => item.isRecommended).length ?? 0;
  const recommendedRestaurants = data?.restaurants.filter((item) => item.isRecommended).length ?? 0;

  const toggle = (kind: "products" | "restaurants", id: number, checked: boolean) => {
    mutation.mutate({ kind, id, isRecommended: checked });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Check className="h-8 w-8 text-primary" /> Recommandations
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sélectionnez les produits et restaurants qui alimentent les rubriques live de l’application mobile.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un produit ou un restaurant" />
          </div>
        </CardContent>
      </Card>

      {isError ? <p className="text-destructive">Impossible de charger les recommandations.</p> : null}
      {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : (
        <Tabs defaultValue="products" className="space-y-4">
          <TabsList>
            <TabsTrigger value="products"><Utensils className="h-4 w-4 mr-2" />Produits ({recommendedProducts} recommandés)</TabsTrigger>
            <TabsTrigger value="restaurants"><Store className="h-4 w-4 mr-2" />Restaurants ({recommendedRestaurants} recommandés)</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Produits recommandés</CardTitle>
                <CardDescription>Ces produits apparaissent dans la section « Produits recommandés » si la section est visible dans App Config.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {products.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Aucun produit trouvé.</p> : products.map((product) => (
                  <div key={product.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{product.restaurantName} · {Number(product.price).toFixed(2)} DH</p>
                    </div>
                    {!product.isAvailable && <Badge variant="secondary">Indisponible</Badge>}
                    <Switch checked={product.isRecommended} onCheckedChange={(checked) => toggle("products", product.id, checked)} disabled={mutation.isPending} aria-label={`Recommander ${product.name}`} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="restaurants">
            <Card>
              <CardHeader>
                <CardTitle>Restaurants recommandés</CardTitle>
                <CardDescription>Ces restaurants alimentent la section recommandée de l’application après validation et ouverture.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {restaurants.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Aucun restaurant trouvé.</p> : restaurants.map((restaurant) => (
                  <div key={restaurant.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {(restaurant.logoUrl || restaurant.imageUrl) ? <img src={restaurant.logoUrl || restaurant.imageUrl || ""} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{restaurant.name}</p>
                      <p className="text-xs text-muted-foreground">{restaurant.businessType}{!restaurant.isOpen ? " · fermé" : ""}{!restaurant.isVerified ? " · non vérifié" : ""}</p>
                    </div>
                    {restaurant.isRecommended && <Badge>Live</Badge>}
                    <Switch checked={restaurant.isRecommended} onCheckedChange={(checked) => toggle("restaurants", restaurant.id, checked)} disabled={mutation.isPending} aria-label={`Recommander ${restaurant.name}`} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}