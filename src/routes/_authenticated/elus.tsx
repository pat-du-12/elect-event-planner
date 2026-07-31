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
import { Trash2, UserPlus } from "lucide-react";

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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["elus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elus")
        .select("id, full_name, email, role_title")
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

  async function removeElu(id: string) {
    const { error } = await supabase.from("elus").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Élu supprimé.");
    refetch();
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
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.map((elu) => (
                    <TableRow key={elu.id}>
                      <TableCell className="font-medium">{elu.full_name}</TableCell>
                      <TableCell>{elu.email}</TableCell>
                      <TableCell>{elu.role_title ?? "—"}</TableCell>
                      <TableCell className="text-right">
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
    </AppShell>
  );
}
