import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, UserCheck } from "lucide-react";
import { formatDateTime, statusLabel } from "@/lib/format";

export const Route = createFileRoute("/calendrier")({
  head: () => ({
    meta: [
      { title: "Calendrier des IRD — Mairie de Rodez" },
      {
        name: "description",
        content:
          "Consultez le calendrier public des IRD, la participation des élus et les événements en présence du Maire.",
      },
      { property: "og:title", content: "Calendrier des IRD — Mairie de Rodez" },
      {
        property: "og:description",
        content: "Calendrier public des IRD et participation des élus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicCalendar,
});

type Participant = { name: string; status: string };
type CalendarEvent = {
  id: string;
  title: string;
  location: string;
  starts_at: string;
  mayor_present: boolean;
  participants: Participant[];
};

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function PublicCalendar() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [openEvent, setOpenEvent] = useState<CalendarEvent | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["public-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_calendar");
      if (error) throw error;
      return (data ?? []) as unknown as CalendarEvent[];
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of data ?? []) {
      const key = dayKey(new Date(ev.starts_at));
      map.set(key, [...(map.get(key) ?? []), ev]);
    }
    return map;
  }, [data]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // lundi = 0
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const list: (Date | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [cursor]);

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  const accepted = (ev: CalendarEvent) =>
    ev.participants.filter((p) => p.status === "accepted").length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Mairie de Rodez
        </p>
        <h1 className="mt-2 font-serif text-3xl text-primary">Calendrier des IRD</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Consultez les événements à venir et la participation des élus.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Mois précédent">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-44 text-center font-serif text-lg capitalize text-primary">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </span>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Mois suivant">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-accent" aria-hidden /> Maire présent
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-secondary" aria-hidden /> Sans le Maire
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {DAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, idx) => {
            const events = date ? (byDay.get(dayKey(date)) ?? []) : [];
            const isToday = date && dayKey(date) === dayKey(today);
            return (
              <div
                key={idx}
                className={`min-h-24 border-b border-r p-1.5 last:border-r-0 ${
                  date ? "" : "bg-muted/30"
                }`}
              >
                {date && (
                  <>
                    <span
                      className={`text-xs ${
                        isToday
                          ? "rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    <div className="mt-1 space-y-1">
                      {events.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => setOpenEvent(ev)}
                          className={`block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium transition-opacity hover:opacity-80 ${
                            ev.mayor_present
                              ? "bg-accent text-accent-foreground"
                              : "bg-secondary text-secondary-foreground"
                          }`}
                          title={ev.title}
                        >
                          {ev.title}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <p className="mt-4 text-center text-sm text-muted-foreground">Chargement du calendrier…</p>
      )}

      <Dialog open={!!openEvent} onOpenChange={(o) => !o && setOpenEvent(null)}>
        <DialogContent>
          {openEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl text-primary">
                  {openEvent.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  {formatDateTime(openEvent.starts_at)}
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden />
                  {openEvent.location}
                </p>
                {openEvent.mayor_present && (
                  <Badge className="bg-accent text-accent-foreground">
                    <UserCheck className="mr-1 h-3 w-3" aria-hidden /> Maire présent
                  </Badge>
                )}
                <div className="pt-2">
                  <h2 className="mb-2 font-medium">
                    Participation ({accepted(openEvent)}/{openEvent.participants.length})
                  </h2>
                  {openEvent.participants.length === 0 ? (
                    <p className="text-muted-foreground">Aucun élu invité pour le moment.</p>
                  ) : (
                    <ul className="space-y-1">
                      {openEvent.participants.map((p, i) => (
                        <li key={i} className="flex items-center justify-between gap-2">
                          <span>{p.name}</span>
                          <Badge
                            variant={
                              p.status === "accepted"
                                ? "default"
                                : p.status === "declined"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {statusLabel(p.status)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
