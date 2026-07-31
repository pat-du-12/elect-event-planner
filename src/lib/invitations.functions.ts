import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(10).max(200) });

const respondSchema = z.object({
  token: z.string().min(10).max(200),
  status: z.enum(["accepted", "declined"]),
});

export type PublicInvitation = {
  token: string;
  status: string;
  respondedAt: string | null;
  guestName: string;
  event: {
    title: string;
    location: string;
    description: string | null;
    startsAt: string;
    mayorPresent: boolean;
    attachmentName: string | null;
    attachmentUrl: string | null;
  };
};

export const getInvitationByToken = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }): Promise<PublicInvitation | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invitation, error } = await supabaseAdmin
      .from("invitations")
      .select(
        "token, status, responded_at, elus(full_name), events(title, location, description, starts_at, mayor_present, attachment_path, attachment_name)",
      )
      .eq("token", data.token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!invitation || !invitation.events || !invitation.elus) return null;

    const event = invitation.events;
    let attachmentUrl: string | null = null;
    if (event.attachment_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("ird-attachments")
        .createSignedUrl(event.attachment_path, 60 * 60);
      attachmentUrl = signed?.signedUrl ?? null;
    }

    return {
      token: invitation.token,
      status: invitation.status,
      respondedAt: invitation.responded_at,
      guestName: invitation.elus.full_name,
      event: {
        title: event.title,
        location: event.location,
        description: event.description,
        startsAt: event.starts_at,
        mayorPresent: event.mayor_present,
        attachmentName: event.attachment_name,
        attachmentUrl,
      },
    };
  });

export const respondToInvitation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => respondSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: boolean; message?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invitation, error } = await supabaseAdmin
      .from("invitations")
      .select("id, events(starts_at)")
      .eq("token", data.token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!invitation) return { ok: false, message: "Invitation introuvable." };

    if (invitation.events && new Date(invitation.events.starts_at).getTime() < Date.now()) {
      return { ok: false, message: "Cet événement est déjà passé." };
    }

    const { error: updateError } = await supabaseAdmin
      .from("invitations")
      .update({ status: data.status, responded_at: new Date().toISOString() })
      .eq("id", invitation.id);

    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });
