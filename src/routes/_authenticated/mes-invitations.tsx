import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CalendarDays, Check, MapPin, Paperclip, UserCheck, X } from "lucide-react";
import { formatDateTime, statusLabel } from "@/lib/format";
import { listMyInvitations, respondToMyInvitation } from "@/lib/my-invitations.functions";
import { useAppRole } from "@/hooks/useAppRole";

export const Route = createFileRoute("/_authenticated/mes-invitations")({
  head: () => ({
    meta: [
      { title: "Mes invitations — Planification des IRD" },
      {
        name: "description",
        content:
          "Consultez les IRD auxquels vous êtes invité(e) et confirmez votre présence en un clic.",
      },
      { property: "og:title", content: "Mes invitations aux IRD" },
      {
        property: "og:description",
        content: "Espace personnel des élus : détail des IRD et réponse de présence.",
      },
    ],
  }),
  component: MyInvitationsPage,
});

function MyInvitationsPage() {
  const router = useRouter();
  const { isAdmin, isLoading: roleLoading } = useAppRole();
  const fetchInvitations = useServerFn(listMyInvitations);
  const respond = useServerFn(respondToMyInvitation);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && isAdmin) router.navigate({ to: "/tableau-de-bord" });
  }, [roleLoading, isAdmin, router]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-invitations"],
    queryFn: () => fetchInvitations(),
  });

  async function answer(invitationId: string, status: "accepted" | "declined") {
    setPending(invitationId);
    try {
      const result = await respond({ data: { invitationId, status } });
      if (!result.ok) {
        toast.error(result.message ?? "Réponse impossible.");
        return;
      }
      toast.success(status === "accepted" ? "Présence confirmée." : "Absence enregistrée.");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Réponse impossible.");
    } finally {
      setPending(null);
    }
  }

  const invitations = data ?? [];
  const now = Date.now();
  const upcoming = invitations.filter((i) => new Date(i.event.startsAt).getTime() >= now);
  const past = invitations.filter((i) => new Date(i.event.startsAt).getTime() < now);

  return (
    <AppShell>
      <h1 className="font-serif text-3xl text-primary">Mes invitations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Confirmez votre présence aux IRD auxquels vous êtes convié(e).
      </p>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Chargement…</p>
      ) : invitations.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Vous n'avez aucune invitation pour le moment.{" "}
            <Link to="/calendrier" className="underline">
              Consulter le calendrier
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 space-y-10">
          <section className="space-y-4">
            <h2 className="font-serif text-xl text-primary">À venir</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun IRD à venir.</p>
            ) : (
              upcoming.map((inv) => (
                <Card key={inv.id}>
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">{inv.event.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" aria-hidden />{" "}
                      {formatDateTime(inv.event.startsAt)}
                    </p>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" aria-hidden /> {inv.event.location}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {inv.event.mayorPresent && (
                        <Badge variant="secondary">
                          <UserCheck className="mr-1 h-3 w-3" aria-hidden /> Maire présent
                        </Badge>
                      )}
                      <Badge
                        variant={
                          inv.status === "accepted"
                            ? "default"
                            : inv.status === "declined"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {statusLabel(inv.status)}
                      </Badge>
                      {inv.event.attachmentUrl && (
                        <a
                          href={inv.event.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm underline"
                        >
                          <Paperclip className="h-4 w-4" aria-hidden />
                          {inv.event.attachmentName}
                        </a>
                      )}
                    </div>
                    {inv.event.description && (
                      <p className="whitespace-pre-line rounded border bg-secondary/40 p-3 text-sm">
                        {inv.event.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        onClick={() => answer(inv.id, "accepted")}
                        disabled={pending === inv.id}
                        variant={inv.status === "accepted" ? "default" : "outline"}
                      >
                        <Check className="h-4 w-4" /> Je serai présent(e)
                      </Button>
                      <Button
                        onClick={() => answer(inv.id, "declined")}
                        disabled={pending === inv.id}
                        variant={inv.status === "declined" ? "destructive" : "outline"}
                      >
                        <X className="h-4 w-4" /> Je serai absent(e)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </section>

          {past.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-serif text-xl text-primary">Passés</h2>
              {past.map((inv) => (
                <Card key={inv.id} className="opacity-75">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium">{inv.event.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(inv.event.startsAt)} — {inv.event.location}
                      </p>
                    </div>
                    <Badge variant="outline">{statusLabel(inv.status)}</Badge>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
