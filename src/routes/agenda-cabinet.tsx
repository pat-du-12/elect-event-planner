import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";

export const Route = createFileRoute("/agenda-cabinet")({
  head: () => ({
    meta: [
      { title: "Agenda du cabinet — Ville de Rodez" },
      {
        name: "description",
        content: "Tableau mensuel partagé du cabinet : IRD, lieux, invités, présences confirmées.",
      },
      { property: "og:title", content: "Agenda du cabinet — Ville de Rodez" },
      {
        property: "og:description",
        content: "Vue tableau des IRD du mois avec invités et présences confirmées.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaCabinet,
});

type Participant = { name: string; status: string };
type CalEvent = {
  id: string;
  title: string;
  location: string;
  starts_at: string;
  mayor_present: boolean;
  participants: Participant[];
};
type Extra = { id: string; organizer: string | null; address: string | null; created_at: string };

const MONTHS = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];
const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const C = {
  banner: "#1A2540",
  gold: "#C8A45A",
  head: "#2C4A8F",
  invBg: "#EEF1F8",
  invFg: "#2C4A8F",
  okBg: "#E6F4EF",
  okFg: "#1E7E5A",
  spkBg: "#FEF3CD",
  spkFg: "#8A6200",
  none: "#AAAAAA",
};

const COLS = [
  ["DATE RÉCEPTION IRD", 110],
  ["JOUR", 80],
  ["HEURE", 70],
  ["ÉLU(E)S PROPOSÉ(E)S", 130],
  ["LIEU", 220],
  ["PUISSANCE INVITANTE", 170],
  ["OBJET DE LA RENCONTRE", 280],
  ["PERSONNES INVITÉES", 240],
  ["PRÉSENCES CONFIRMÉES", 200],
  ["ORATEUR(S)", 150],
] as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function AgendaCabinet() {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));

  const { data: cal } = useQuery({
    queryKey: ["public-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_calendar");
      if (error) throw error;
      return (data ?? []) as unknown as CalEvent[];
    },
  });
  const { data: extras } = useQuery({
    queryKey: ["agenda-extras"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, organizer, address, created_at");
      return (data ?? []) as Extra[];
    },
  });

  const rows = useMemo(() => {
    const ex = new Map((extras ?? []).map((e) => [e.id, e]));
    return (cal ?? [])
      .filter((e) => {
        const d = new Date(e.starts_at);
        return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((e) => ({ ...e, extra: ex.get(e.id) }));
  }, [cal, extras, cursor]);

  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const cell = "border px-2 py-2 align-top text-xs";

  return (
    <div className="min-h-screen bg-background p-4 print:p-0">
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" size="sm" asChild>
          <Link to="/calendrier">← Calendrier</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => shift(-1)} aria-label="Mois précédent">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => shift(1)} aria-label="Mois suivant">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button size="sm" onClick={() => window.print()} className="ml-auto">
          <Printer className="mr-1 h-4 w-4" /> Imprimer
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ fontFamily: "Arial, sans-serif", minWidth: 1650 }}>
          <thead>
            <tr>
              <th colSpan={10} className="px-3 pt-3 text-left" style={{ background: C.banner, color: "#FFFFFF", fontSize: 17 }}>
                AGENDA DU CABINET &nbsp;·&nbsp; {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
              </th>
            </tr>
            <tr>
              <th colSpan={10} className="px-3 pb-3 text-left text-sm" style={{ background: C.banner, color: C.gold }}>
                Ville de Rodez &nbsp;—&nbsp; Tableau partagé du cabinet
              </th>
            </tr>
            <tr>
              {COLS.map(([label, w]) => (
                <th key={label} className="border px-2 py-2 text-left text-xs font-bold" style={{ background: C.head, color: "#FFFFFF", width: w }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="border p-6 text-center text-sm text-muted-foreground">
                  Aucun IRD ce mois-ci.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const d = new Date(r.starts_at);
              const invited = r.participants.map((p) => p.name);
              const confirmed = r.participants.filter((p) => p.status === "accepted").map((p) => p.name);
              const created = r.extra ? new Date(r.extra.created_at) : null;
              return (
                <tr key={r.id}>
                  <td className={cell}>{created ? `${pad(created.getDate())}/${pad(created.getMonth() + 1)}/${created.getFullYear()}` : ""}</td>
                  <td className={`${cell} font-bold`}>{DAYS[d.getDay()]} {pad(d.getDate())}</td>
                  <td className={cell}>{pad(d.getHours())}h{pad(d.getMinutes())}</td>
                  <td className={cell}>{r.mayor_present ? "Maire" : ""}</td>
                  <td className={cell}>
                    {r.location}
                    {r.extra?.address ? ` – ${r.extra.address}` : ""}
                  </td>
                  <td className={cell}>{r.extra?.organizer ?? ""}</td>
                  <td className={cell}>{r.title}</td>
                  <td className={cell} style={{ background: C.invBg, color: C.invFg }}>{invited.join(" / ") || "—"}</td>
                  <td className={cell} style={{ background: C.okBg, color: C.okFg }}>{confirmed.join(" / ") || "—"}</td>
                  <td className={cell} style={r.mayor_present ? { background: C.spkBg, color: C.spkFg } : { color: C.none }}>
                    {r.mayor_present ? "🎤 Maire" : "—"}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td />
              <td colSpan={9} className="px-2 py-3 text-xs">
                Légende : <span style={{ color: C.invFg }}>Invités (bleu)</span> ·{" "}
                <span style={{ color: C.okFg }}>Confirmés (vert)</span> ·{" "}
                <span style={{ color: C.spkFg }}>🎤 Orateur (doré)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
