import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EventFormDialog } from "@/components/EventFormDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  Download,
  Mail,
  MapPin,
  Paperclip,
  Pencil,
  UserCheck,
} from "lucide-react";
import { formatDateTime, statusLabel } from "@/lib/format";
import { openInOutlook, type EmlAttachment } from "@/lib/outlook";
import type { Tables } from "@/integrations/supabase/types";


export const Route = createFileRoute("/_authenticated/ird/$id")({
  head: () => ({
    meta: [
      { title: "Détail de l'IRD — Invitations et présences" },
      {
        name: "description",
        content:
          "Consultez le détail d'un IRD, invitez des élus par e-mail et suivez leurs réponses de présence.",
      },
      { property: "og:title", content: "Détail de l'IRD" },
      {
        property: "og:description",
        content: "Invitations des élus et suivi des présences pour cet IRD.",
      },
    ],
  }),
  component: EventDetail,
});

type Invitation = Tables<"invitations"> & { elus: { full_name: string; email: string } | null };

function EventDetail() {
  const { id } = Route.useParams();
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);


  const eventQuery = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const invitationsQuery = useQuery({
    queryKey: ["invitations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*, elus(full_name, email)")
        .eq("event_id", id);
      if (error) throw error;
      return data as Invitation[];
    },
  });

  const elusQuery = useQuery({
    queryKey: ["elus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elus")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const event = eventQuery.data;
  const invitations = invitationsQuery.data ?? [];
  const invitedIds = new Set(invitations.map((i) => i.elu_id));
  const availableElus = (elusQuery.data ?? []).filter((e) => !invitedIds.has(e.id));

  async function inviteSelected() {
    if (selected.length === 0) return;
    const rows = selected.map((elu_id) => ({ event_id: id, elu_id }));
    const { error } = await supabase.from("invitations").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSelected([]);
    toast.success(`${rows.length} invitation(s) créée(s).`);
    invitationsQuery.refetch();
  }

  async function removeInvitation(invitationId: string) {
    const { error } = await supabase.from("invitations").delete().eq("id", invitationId);
    if (error) {
      toast.error(error.message);
      return;
    }
    invitationsQuery.refetch();
  }

  function linkFor(token: string) {
    return `${window.location.origin}/invitation/${token}`;
  }

  async function downloadAttachment() {
    if (!event?.attachment_path) return;
    const { data, error } = await supabase.storage
      .from("ird-attachments")
      .createSignedUrl(event.attachment_path, 300);
    if (error || !data) {
      toast.error("Téléchargement impossible.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  function messageFor(inv: Invitation) {
    return `Bonjour ${inv.elus?.full_name ?? ""},\n\nVous êtes invité(e) à l'IRD « ${event!.title} » le ${formatDateTime(
      event!.starts_at,
    )} à ${event!.location}.${event!.mayor_present ? "\nMonsieur le Maire sera présent." : ""}${
      event!.description ? `\n\n${event!.description}` : ""
    }\n\nMerci de confirmer votre présence via votre lien personnel :\n${linkFor(inv.token)}\n\nCordialement,\nMairie de Rodez`;
  }

  async function fetchAttachment(): Promise<EmlAttachment | null> {
    if (!event?.attachment_path || !event.attachment_name) return null;
    const { data, error } = await supabase.storage
      .from("ird-attachments")
      .download(event.attachment_path);
    if (error || !data) return null;
    return {
      filename: event.attachment_name,
      contentType: data.type || "application/octet-stream",
      bytes: new Uint8Array(await data.arrayBuffer()),
    };
  }

  async function openOutlookFor(list: Invitation[]) {
    const targets = list.filter((i) => i.elus?.email);
    if (targets.length === 0 || !event) return;
    setSending(true);
    try {
      const attachment = await fetchAttachment();
      for (const inv of targets) {
        openInOutlook({
          to: inv.elus!.email,
          subject: `Invitation IRD — ${event.title}`,
          body: messageFor(inv),
          attachment,
          filename: `IRD-${event.title}-${inv.elus!.full_name}`,
        });
        await new Promise((r) => setTimeout(r, 300));
      }
      toast.success(
        targets.length === 1
          ? "Message prêt : ouvrez le fichier téléchargé pour l'envoyer depuis Outlook."
          : `${targets.length} messages préparés : ouvrez-les pour les envoyer depuis Outlook.`,
      );
    } finally {
      setSending(false);
    }
  }


  function exportCsv() {
    const rows = [
      ["Nom", "E-mail", "Statut", "Répondu le", "Lien"],
      ...invitations.map((i) => [
        i.elus?.full_name ?? "",
        i.elus?.email ?? "",
        statusLabel(i.status),
        i.responded_at ? formatDateTime(i.responded_at) : "",
        linkFor(i.token),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "invitations-ird.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (eventQuery.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </AppShell>
    );
  }

  if (!event) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Cet IRD est introuvable.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link
        to="/tableau-de-bord"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux événements
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl text-primary">{event.title}</h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" aria-hidden /> {formatDateTime(event.starts_at)}
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden /> {event.location}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {event.mayor_present && (
              <Badge variant="secondary">
                <UserCheck className="mr-1 h-3 w-3" aria-hidden /> Maire présent
              </Badge>
            )}
            {event.attachment_name && (
              <Button variant="outline" size="sm" onClick={downloadAttachment}>
                <Paperclip className="h-4 w-4" /> {event.attachment_name}
              </Button>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" /> Modifier
        </Button>
      </div>

      {event.description && (
        <p className="mt-6 whitespace-pre-line rounded border bg-card p-4 text-sm">
          {event.description}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Inviter des élus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableElus.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tous les élus du carnet sont déjà invités.{" "}
                <Link to="/elus" className="underline">
                  Gérer le carnet
                </Link>
              </p>
            ) : (
              <>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {availableElus.map((elu) => (
                    <label key={elu.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.includes(elu.id)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked ? [...prev, elu.id] : prev.filter((v) => v !== elu.id),
                          )
                        }
                      />
                      <span>{elu.full_name}</span>
                    </label>
                  ))}
                </div>
                <Button onClick={inviteSelected} disabled={selected.length === 0} className="w-full">
                  Inviter ({selected.length})
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="font-serif text-lg">
              Invitations ({invitations.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openOutlookFor(invitations)}
                disabled={!invitations.length || sending}
              >
                <Mail className="h-4 w-4" />
                {sending ? "Préparation…" : "Ouvrir dans Outlook"}
              </Button>

              <Button size="sm" variant="ghost" onClick={exportCsv} disabled={!invitations.length}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun élu invité pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Élu</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Lien</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <span className="font-medium">{inv.elus?.full_name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {inv.elus?.email}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              inv.status === "accepted"
                                ? "default"
                                : inv.status === "declined"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {statusLabel(inv.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(linkFor(inv.token));
                              toast.success("Lien copié.");
                            }}
                          >
                            <Copy className="h-4 w-4" /> Copier
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={sending}
                            onClick={() => openOutlookFor([inv])}
                          >
                            <Mail className="h-4 w-4" /> Outlook
                          </Button>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeInvitation(inv.id)}
                            className="text-destructive"
                          >
                            Retirer
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
      </div>

      <EventFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        event={event}
        onSaved={() => eventQuery.refetch()}
      />
    </AppShell>
  );
}
