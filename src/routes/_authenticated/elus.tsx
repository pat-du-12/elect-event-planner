import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, ShieldPlus, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import {
  createAdminAccount,
  createEluAccount,
  deleteUserAccount,
  listAdmins,
} from "@/lib/elu-accounts.functions";


export const Route = createFileRoute("/_authenticated/elus")({
  head: () => ({
    meta: [
      { title: "Carnet des élus — Planification des IRD" },
      {
        name: "description",
        content: "Gérez la liste des élus invités aux IRD : nom, fonction et adresse e-mail.",
      },
      { property: "og:title", content: "Carnet des élus" },
      {
        property: "og:description",
        content: "Liste réutilisable des élus pour les invitations aux IRD.",
      },
    ],
  }),
  component: ElusPage,
});

function ElusPage() {
  const [saving, setSaving] = useState(false);
  const [bulk, setBulk] = useState("");
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(true);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const createAccount = useServerFn(createEluAccount);
  const createAdmin = useServerFn(createAdminAccount);
  const deleteAccount = useServerFn(deleteUserAccount);
  const fetchAdmins = useServerFn(listAdmins);

  const adminsQuery = useQuery({ queryKey: ["admins"], queryFn: () => fetchAdmins() });


  const { data, isLoading, refetch } = useQuery({
    queryKey: ["elus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elus")
        .select("id, full_name, email, role_title, user_id")
        .order("full_name");
      if (error) throw error;
      return data;
    },

  });

  async function addElu(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const full_name = String(fd.get("full_name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const role_title = String(fd.get("role_title") ?? "").trim() || null;
    if (!full_name || !email) return;
    setSaving(true);
    const { error } = await supabase.from("elus").insert({ full_name, email, role_title });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Cet e-mail existe déjà." : error.message);
      return;
    }
    form.reset();
    toast.success("Élu ajouté.");
    refetch();
  }

  async function addBulk() {
    const lines = bulk
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const rows = lines
      .map((line) => {
        const parts = line.split(/[;,\t]/).map((p) => p.trim());
        const email = parts.find((p) => p.includes("@"))?.toLowerCase();
        const full_name = parts.find((p) => !p.includes("@")) ?? email ?? "";
        return email ? { full_name, email } : null;
      })
      .filter((r): r is { full_name: string; email: string } => r !== null);

    if (rows.length === 0) {
      toast.error("Aucune adresse e-mail valide détectée.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("elus").upsert(rows, { onConflict: "email" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBulk("");
    toast.success(`${rows.length} élu(s) enregistré(s).`);
    refetch();
  }

  async function makeAccount(eluId: string, password?: string) {
    setCreatingFor(eluId);
    try {
      const result = await createAccount({ data: password ? { eluId, password } : { eluId } });
      setCredentials(result);
      setResetFor(null);
      setNewPassword("");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création du compte impossible.");
    } finally {
      setCreatingFor(null);
    }
  }

  async function removeElu(id: string, name: string) {
    if (!window.confirm(`Supprimer définitivement ${name} et son compte utilisateur ?`)) return;
    try {
      await deleteAccount({ data: { eluId: id } });
      toast.success("Élu et compte supprimés.");
      refetch();
      adminsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible.");
    }
  }

  async function removeAdmin(userId: string, name: string) {
    if (!window.confirm(`Supprimer définitivement l'administrateur ${name} ?`)) return;
    try {
      await deleteAccount({ data: { userId } });
      toast.success("Administrateur supprimé.");
      adminsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible.");
    }
  }

  async function addAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("admin_email") ?? "").trim().toLowerCase();
    const fullName = String(fd.get("admin_name") ?? "").trim();
    if (!email || !fullName || adminPassword.length < 8) {
      toast.error("Nom, e-mail et mot de passe (8 caractères minimum) sont requis.");
      return;
    }
    setSaving(true);
    try {
      const result = await createAdmin({ data: { email, fullName, password: adminPassword } });
      setCredentials(result);
      setAdminPassword("");
      form.reset();
      adminsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }



  return (
    <AppShell>
      <h1 className="font-serif text-3xl text-primary">Carnet des élus</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Les élus enregistrés ici peuvent être invités à n'importe quel IRD.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Ajouter un élu</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addElu} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nom et prénom</Label>
                <Input id="full_name" name="full_name" maxLength={120} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Adresse e-mail</Label>
                <Input id="email" name="email" type="email" maxLength={255} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role_title">Fonction (facultative)</Label>
                <Input id="role_title" name="role_title" maxLength={120} />
              </div>
              <Button type="submit" disabled={saving}>
                <UserPlus className="h-4 w-4" /> Ajouter
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Import rapide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Une ligne par élu, au format « Nom ; email ».
            </p>
            <textarea
              className="min-h-36 w-full rounded-md border bg-background p-3 text-sm"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"Marie Dupont ; marie.dupont@exemple.fr\nJean Martin ; jean.martin@exemple.fr"}
            />
            <Button onClick={addBulk} disabled={saving} variant="secondary">
              Importer la liste
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-serif text-lg">
            Élus enregistrés {data ? `(${data.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun élu enregistré.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Fonction</TableHead>
                    <TableHead>Compte</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.map((elu) => (
                    <TableRow key={elu.id}>
                      <TableCell className="font-medium">{elu.full_name}</TableCell>
                      <TableCell>{elu.email}</TableCell>
                      <TableCell>{elu.role_title ?? "—"}</TableCell>
                      <TableCell>
                        {elu.user_id ? (
                          <Badge variant="secondary">Actif</Badge>
                        ) : (
                          <Badge variant="outline">Aucun</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2"
                          disabled={creatingFor === elu.id}
                          onClick={() =>
                            elu.user_id
                              ? setResetFor({ id: elu.id, name: elu.full_name })
                              : makeAccount(elu.id)
                          }
                        >
                          <KeyRound className="h-4 w-4" />
                          {elu.user_id ? "Réinitialiser le mot de passe" : "Créer le compte"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeElu(elu.id)}
                          aria-label={`Supprimer ${elu.full_name}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={resetFor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetFor(null);
            setNewPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              Définissez un nouveau mot de passe pour {resetFor?.name}, ou laissez le champ vide
              pour en générer un automatiquement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">Nouveau mot de passe (8 caractères minimum)</Label>
              <Input
                id="new_password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                maxLength={72}
                placeholder="Laisser vide pour générer"
              />
            </div>
            <Button
              disabled={creatingFor === resetFor?.id || (newPassword.length > 0 && newPassword.length < 8)}
              onClick={() =>
                resetFor &&
                makeAccount(resetFor.id, newPassword.length >= 8 ? newPassword : undefined)
              }
            >
              <KeyRound className="h-4 w-4" /> Appliquer
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={credentials !== null} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Identifiants du compte</DialogTitle>
            <DialogDescription>
              Communiquez ces identifiants à l'élu. Le mot de passe n'est affiché qu'une seule fois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Identifiant (e-mail)</p>
              <p className="font-mono">{credentials?.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Mot de passe provisoire</p>
              <p className="font-mono text-base">{credentials?.password}</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(
                  `Identifiant : ${credentials?.email}\nMot de passe : ${credentials?.password}`,
                );
                toast.success("Identifiants copiés.");
              }}
            >
              Copier les identifiants
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

