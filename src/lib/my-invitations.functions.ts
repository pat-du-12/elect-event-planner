import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const respondSchema = z.object({
  invitationId: z.string().uuid(),
  status: z.enum(["accepted", "declined"]),
});

export type MyInvitation = {
  id: string;
  status: string;
  respondedAt: string | null;
  event: {
    id: string;
    title: string;
    location: string;
    description: string | null;
    startsAt: string;
    mayorPresent: boolean;
    attachmentName: string | null;
    attachmentUrl: string | null;
  };
};

export const listMyInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyInvitation[]> => {
    const { data, error } = await context.supabase
      .from("invitations")
      .select(
        "id, status, responded_at, events(id, title, location, description, starts_at, mayor_present, attachment_path, attachment_name)",
      );
    if (error) throw new Error(error.message);

    const rows = (data ?? []).filter((row) => row.events);
    if (rows.length === 0) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const invitations = await Promise.all(
      rows.map(async (row) => {
        const event = row.events!;
        let attachmentUrl: string | null = null;
        if (event.attachment_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("ird-attachments")
            .createSignedUrl(event.attachment_path, 60 * 60);
          attachmentUrl = signed?.signedUrl ?? null;
        }
        return {
          id: row.id,
          status: row.status,
          respondedAt: row.responded_at,
          event: {
            id: event.id,
            title: event.title,
            location: event.location,
            description: event.description,
            startsAt: event.starts_at,
            mayorPresent: event.mayor_present,
            attachmentName: event.attachment_name,
            attachmentUrl,
          },
        };
      }),
    );

    return invitations.sort(
      (a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime(),
    );
  });

export const respondToMyInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => respondSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message?: string }> => {
    const { data: invitation, error } = await context.supabase
      .from("invitations")
      .select("id, events(starts_at)")
      .eq("id", data.invitationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invitation) return { ok: false, message: "Invitation introuvable." };
    if (invitation.events && new Date(invitation.events.starts_at).getTime() < Date.now()) {
      return { ok: false, message: "Cet événement est déjà passé." };
    }

    const { error: updateError } = await context.supabase
      .from("invitations")
      .update({ status: data.status, responded_at: new Date().toISOString() })
      .eq("id", data.invitationId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });
