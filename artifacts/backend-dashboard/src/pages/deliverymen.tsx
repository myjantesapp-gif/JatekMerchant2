import { useState } from "react";
import { type BackendDeliveryman, useListBackendDeliverymen, getListBackendDeliverymenQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Truck, Star, Pencil, Loader2, Plus, Trash2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const emptyNew = { name: "", phone: "", email: "", vehicleType: "", vehiclePlate: "", nationalId: "", licenseNumber: "" };
const emptyEdit = { name: "", phone: "", vehicleType: "", vehiclePlate: "", nationalId: "", licenseNumber: "", isAvailable: true, isVerified: false, profileCompleted: false, latitude: "34.6814", longitude: "-1.9078" };

export default function Deliverymen() {
  const { data: drivers, isLoading } = useListBackendDeliverymen();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editing, setEditing] = useState<BackendDeliveryman | null>(null);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState(emptyNew);
  const [deleting, setDeleting] = useState<BackendDeliveryman | null>(null);
  const [resetTarget, setResetTarget] = useState<BackendDeliveryman | null>(null);
  const [pwdForm, setPwdForm] = useState({ newPassword: "", confirm: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ name: string; phone: string; tempPassword: string } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListBackendDeliverymenQueryKey() });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: number; data: typeof emptyEdit }) =>
      apiFetch(`/api/backend/drivers/${vars.id}`, { method: "PATCH", body: JSON.stringify(vars.data) }),
    onSuccess: () => { invalidate(); setEditing(null); toast({ title: "Livreur mis à jour" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyNew) =>
      apiFetch("/api/backend/drivers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (result: any) => {
      invalidate();
      setCreating(false);
      setNewForm(emptyNew);
      if (result?.tempPassword) {
        const d = result.driver;
        setCreatedCreds({ name: d?.name ?? newForm.name, phone: d?.phone ?? newForm.phone, tempPassword: result.tempPassword });
      } else {
        toast({ title: "Livreur créé" });
      }
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/backend/drivers/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Livreur supprimé" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
  });

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (pwdForm.newPassword !== pwdForm.confirm) { toast({ title: "Les mots de passe ne correspondent pas", variant: "destructive" }); return; }
    if (pwdForm.newPassword.length < 8) { toast({ title: "Min. 8 caractères", variant: "destructive" }); return; }
    setPwdLoading(true);
    try {
      const res = await apiFetch(`/api/backend/users/${resetTarget.userId}/reset-password`, { method: "PATCH", body: JSON.stringify({ newPassword: pwdForm.newPassword }) }) as any;
      toast({ title: res.message ?? "Mot de passe réinitialisé ✓" });
      setResetTarget(null); setPwdForm({ newPassword: "", confirm: "" });
    } catch (e: any) { toast({ title: "Erreur", description: e?.message, variant: "destructive" }); }
    finally { setPwdLoading(false); }
  };

  const toggleActiveMutation = useMutation({
    mutationFn: (d: BackendDeliveryman) =>
      apiFetch(`/api/backend/users/${d.userId}`, { method: "PATCH", body: JSON.stringify({ isActive: !(d.accountActive ?? true) }) }),
    onSuccess: (_res, d) => {
      toast({ title: (d.accountActive ?? true) ? "Compte désactivé" : "Compte activé" });
      setEditing((prev) => prev && prev.id === d.id ? { ...prev, accountActive: !(d.accountActive ?? true) } : prev);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message, variant: "destructive" }),
    onSettled: () => invalidate(),
  });

  const openEdit = (d: BackendDeliveryman) => {
    setEditing(d);
    setEditForm({
      name: d.name ?? "",
      phone: d.phone ?? "",
      vehicleType: d.vehicleType ?? "",
      vehiclePlate: d.vehiclePlate ?? "",
      nationalId: d.nationalId ?? "",
      licenseNumber: d.licenseNumber ?? "",
      isAvailable: d.isAvailable,
      isVerified: !!d.isVerified,
      profileCompleted: !!d.profileCompletedAt,
      latitude: String(d.latitude ?? "34.6814"),
      longitude: String(d.longitude ?? "-1.9078"),
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Livreurs</h1>
        <Button onClick={() => { setCreating(true); setNewForm(emptyNew); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nouveau livreur
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6">Livreur</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead>Plaque</TableHead>
                <TableHead>Livraisons</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-6"><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell className="px-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              )) : drivers?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Aucun livreur.</TableCell></TableRow>
              ) : drivers?.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="px-6 font-medium">
                    <div className="flex flex-col">
                      <span>{d.name}</span>
                      <span className="text-xs text-muted-foreground">{d.phone}</span>
                      {d.email && !d.email.endsWith("@jatek.internal") && <span className="text-xs text-muted-foreground">{d.email}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2 text-sm">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize">{d.vehicleType || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.vehiclePlate || "—"}</TableCell>
                  <TableCell className="font-bold">{d.totalDeliveries}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-medium">{d.rating?.toFixed(1) || "Nouveau"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={d.isAvailable ? "default" : "secondary"}>{d.isAvailable ? "Disponible" : "Hors ligne"}</Badge>
                      {d.isVerified && <Badge variant="outline">Vérifié</Badge>}
                      {d.profileCompletedAt && <Badge variant="outline">Complet</Badge>}
                      {d.accountActive === false && <Badge variant="destructive">Compte inactif</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Réinitialiser MDP" onClick={() => { setResetTarget(d); setPwdForm({ newPassword: "", confirm: "" }); }}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleting(d)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier {editing?.name}</DialogTitle>
            <DialogDescription>Mettez à jour les informations du livreur</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (editing) updateMutation.mutate({ id: editing.id, data: editForm }); }} className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Nom</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Nom complet" /></div>
              <div className="space-y-1"><Label className="text-xs">Téléphone</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+212..." /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Latitude</Label><Input type="number" step="any" value={editForm.latitude} onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Longitude</Label><Input type="number" step="any" value={editForm.longitude} onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })} /></div>
            </div>
            <div className="flex flex-wrap gap-5 pt-1">
              <div className="flex items-center gap-2"><Switch checked={editForm.isVerified} onCheckedChange={(v) => setEditForm({ ...editForm, isVerified: v })} /><Label>Vérifié</Label></div>
              <div className="flex items-center gap-2"><Switch checked={editForm.profileCompleted} onCheckedChange={(v) => setEditForm({ ...editForm, profileCompleted: v })} /><Label>Profil complet</Label></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Type de véhicule</Label><Input value={editForm.vehicleType} onChange={(e) => setEditForm({ ...editForm, vehicleType: e.target.value })} placeholder="moto, vélo, voiture..." /></div>
              <div className="space-y-1"><Label className="text-xs">Plaque</Label><Input value={editForm.vehiclePlate} onChange={(e) => setEditForm({ ...editForm, vehiclePlate: e.target.value })} placeholder="Ex: A-12345-B" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">CIN / National ID</Label><Input value={editForm.nationalId} onChange={(e) => setEditForm({ ...editForm, nationalId: e.target.value })} placeholder="CIN" /></div>
              <div className="space-y-1"><Label className="text-xs">N° Permis (optionnel)</Label><Input value={editForm.licenseNumber} onChange={(e) => setEditForm({ ...editForm, licenseNumber: e.target.value })} placeholder="Numéro de permis" /></div>
            </div>
            <div className="flex flex-wrap gap-5 pt-1">
              <div className="flex items-center gap-2">
                <Switch checked={editForm.isAvailable} onCheckedChange={(v) => setEditForm({ ...editForm, isAvailable: v })} />
                <Label>Disponible</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing?.accountActive ?? true}
                  disabled={toggleActiveMutation.isPending}
                  onCheckedChange={() => { if (editing) toggleActiveMutation.mutate(editing); }}
                />
                <Label>Compte actif</Label>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau livreur</DialogTitle>
            <DialogDescription>Créez un compte livreur. Un mot de passe temporaire sera généré et vous sera affiché après la création.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(newForm); }} className="space-y-3 pt-2">
            <div className="space-y-1"><Label className="text-xs">Nom complet *</Label><Input required value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="Nom du livreur" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Téléphone *</Label><Input required value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} placeholder="+212..." /></div>
              <div className="space-y-1"><Label className="text-xs">Email (optionnel)</Label><Input type="email" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} placeholder="email@..." /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Type de véhicule</Label><Input value={newForm.vehicleType} onChange={(e) => setNewForm({ ...newForm, vehicleType: e.target.value })} placeholder="moto, vélo, voiture..." /></div>
              <div className="space-y-1"><Label className="text-xs">Plaque</Label><Input value={newForm.vehiclePlate} onChange={(e) => setNewForm({ ...newForm, vehiclePlate: e.target.value })} placeholder="Ex: A-12345-B" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">CIN / National ID</Label><Input value={newForm.nationalId} onChange={(e) => setNewForm({ ...newForm, nationalId: e.target.value })} placeholder="CIN" /></div>
              <div className="space-y-1"><Label className="text-xs">N° Permis (optionnel)</Label><Input value={newForm.licenseNumber} onChange={(e) => setNewForm({ ...newForm, licenseNumber: e.target.value })} placeholder="Numéro de permis" /></div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>Annuler</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Créer le livreur
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credentials after creation */}
      <Dialog open={!!createdCreds} onOpenChange={(o) => !o && setCreatedCreds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Livreur créé ✓</DialogTitle>
            <DialogDescription>
              Partagez ces identifiants avec le livreur. Le mot de passe ne sera plus affiché.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted p-4 space-y-2 font-mono text-sm">
              <div><span className="text-muted-foreground">Nom&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: </span><span className="font-semibold">{createdCreds?.name}</span></div>
              <div><span className="text-muted-foreground">Téléphone: </span><span className="font-semibold">{createdCreds?.phone}</span></div>
              <div><span className="text-muted-foreground">Mot de passe temporaire: </span><span className="font-semibold text-primary">{createdCreds?.tempPassword}</span></div>
            </div>
            <p className="text-xs text-muted-foreground">Le livreur devra changer ce mot de passe à sa première connexion.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedCreds(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le MDP — {resetTarget?.name}</DialogTitle>
            <DialogDescription>Définissez un nouveau mot de passe pour le compte de ce livreur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1"><Label className="text-xs">Nouveau mot de passe *</Label><Input type="password" value={pwdForm.newPassword} onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })} placeholder="Min. 8 caractères" /></div>
            <div className="space-y-1"><Label className="text-xs">Confirmer *</Label><Input type="password" value={pwdForm.confirm} onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>Annuler</Button>
            <Button onClick={handleResetPassword} disabled={pwdLoading || !pwdForm.newPassword}>
              {pwdLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleting?.name} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le compte utilisateur et le profil livreur seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
