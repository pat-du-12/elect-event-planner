import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getInvitationByToken, respondToInvitation } from "@/lib/invitations.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Check, MapPin, Paperclip, UserCheck, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/invitation/$token")({
  loader: ({ params }) => getInvitationByToken({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Votre invitation à un IRD — Ville de Rodez" },
      {
        name: "description",
        content:
          "Consultez les informations de l'IRD auquel vous êtes convié(e) et confirmez votre présence en un clic.",
      },
      { property: "og:title", content: "Votre invitation à un IRD" },
      {
        property: "og:description",
        content: "Confirmez ou déclinez votre présence à l'IRD auquel vous êtes convié(e).",
      },
    ],
  }),
  errorComponent: () => (
    <Centered>
      <p className="text-sm text-muted-foreground">
        Ce lien d'invitation est invalide ou a expiré.
      </p>
    </Centered>
  ),
  component: InvitationPage,
});

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4 py-10">
      <div className="w-full max-w-xl">{children}</div>
    </div>
  );
}

function InvitationPage() {
  const invitation = Route.useLoaderData();
  const router = Route.useRouter();
  const respond = useServerFn(respondToInvitation);
  const [saving, setSaving] = useState(false);

  if (!invitation) {
    return (
      <Centered>
        <Card>
          <CardContent className="p-8 text-center">
            <h1 className="font-serif text-2xl text-primary">Invitation introuvable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ce lien n'est plus valide. Rapprochez-vous du secrétariat.
            </p>
          </CardContent>
        </Card>
      </Centered>
    );
  }

  const { event } = invitation;

  async function send(status: "accepted" | "declined") {
    setSaving(true);
    try {
      const result = await respond({ data: { token: invitation!.token, status } });
      if (!result.ok) {
        toast.error(result.message ?? "Réponse impossible.");
        return;
      }
      toast.success(status === "accepted" ? "Présence confirmée." : "Absence enregistrée.");
      router.invalidate();
    } catch {
      toast.error("Réponse impossible pour le moment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Centered>
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">Bonjour {invitation.guestName},</p>
          <CardTitle className="font-serif text-2xl text-primary">{event.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
              {formatDateTime(event.startsAt)}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
              {event.location}
            </p>
            {event.mayorPresent && (
              <Badge variant="secondary">
                <UserCheck className="mr-1 h-3 w-3" aria-hidden /> Le maire sera présent
              </Badge>
            )}
          </div>

          {event.description && (
            <p className="whitespace-pre-line rounded border bg-secondary/50 p-4 text-sm">
              {event.description}
            </p>
          )}

          {event.attachmentUrl && (
            <a
              href={event.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-4"
            >
              <Paperclip className="h-4 w-4" aria-hidden /> {event.attachmentName ?? "Pièce jointe"}
            </a>
          )}

          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-sm font-medium">Serez-vous présent(e) ?</p>
            {invitation.status !== "pending" && (
              <p className="mb-3 text-sm text-muted-foreground">
                Réponse enregistrée :{" "}
                <strong>{invitation.status === "accepted" ? "Présent(e)" : "Absent(e)"}</strong>. Vous
                pouvez la modifier ci-dessous.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => send("accepted")} disabled={saving}>
                <Check className="h-4 w-4" /> Je serai présent(e)
              </Button>
              <Button variant="outline" onClick={() => send("declined")} disabled={saving}>
                <X className="h-4 w-4" /> Je ne pourrai pas
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </Centered>
  );
}
