import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EventFormDialog } from "@/components/EventFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, MapPin, Paperclip, Plus, UserCheck } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tableau-de-bord")({
  head: () => ({
    meta: [
      { title: "Tableau de bord des IRD — Ville de Rodez" },
      {
        name: "description",
        content:
          "Suivez les IRD à venir et passés, la présence du maire et les réponses des élus invités.",
      },
      { property: "og:title", content: "Tableau de bord des IRD" },
      {
        property: "og:description",
        content: "Planification des IRD et suivi des présences des élus.",
      },
    ],
  }),
  component: Dashboard,
});

type EventWithInvites = {
  id: string;
  title: string;
  location: string;
  starts_at: string;
  mayor_present: boolean;
  attachment_name: string | null;
  invitations: { status: string }[];
};

function Dashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, location, starts_at, mayor_present, attachment_name, invitations(status)")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data as EventWithInvites[];
    },
  });

  const now = Date.now();
  const upcoming = (data ?? []).filter((e) => new Date(e.starts_at).getTime() >= now).reverse();
  const past = (data ?? []).filter((e) => new Date(e.starts_at).getTime() < now);

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-primary">Événements IRD</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Créez un IRD, joignez un document et invitez les élus.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Nouvel IRD
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="space-y-10">
          <Section title="À venir" events={upcoming} empty="Aucun IRD programmé pour l'instant." />
          <Section title="Passés" events={past} empty="Aucun IRD passé." />
        </div>
      )}

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => refetch()}
      />
    </AppShell>
  );
}

function Section({
  title,
  events,
  empty,
}: {
  title: string;
  events: EventWithInvites[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-3 font-serif text-xl text-primary">{title}</h2>
      {events.length === 0 ? (
        <p className="rounded border border-dashed bg-card p-6 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="grid gap-3">
          {events.map((event) => {
            const accepted = event.invitations.filter((i) => i.status === "accepted").length;
            const declined = event.invitations.filter((i) => i.status === "declined").length;
            const pending = event.invitations.filter((i) => i.status === "pending").length;
            return (
              <Link key={event.id} to="/ird/$id" params={{ id: event.id }} className="block">
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                    <div className="min-w-[14rem] space-y-2">
                      <h3 className="font-serif text-lg text-foreground">{event.title}</h3>
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="h-4 w-4" aria-hidden />
                        {formatDateTime(event.starts_at)}
                      </p>
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" aria-hidden />
                        {event.location}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {event.mayor_present && (
                          <Badge variant="secondary">
                            <UserCheck className="mr-1 h-3 w-3" aria-hidden /> Maire présent
                          </Badge>
                        )}
                        {event.attachment_name && (
                          <Badge variant="outline">
                            <Paperclip className="mr-1 h-3 w-3" aria-hidden /> Pièce jointe
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4 text-center text-sm">
                      <Stat value={accepted} label="Présents" className="text-success" />
                      <Stat value={declined} label="Absents" className="text-destructive" />
                      <Stat value={pending} label="Sans réponse" className="text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Stat({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div>
      <p className={`text-2xl font-semibold ${className}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
