import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const createSchema = z.object({
  eluId: z.string().uuid(),
  /** Mot de passe choisi par l'administrateur. Si absent, un mot de passe est généré. */
  password: z.string().min(8).max(72).optional(),
});

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Crée (ou réinitialise) le compte personnel d'un élu. Réservé à l'administrateur. */
export const createEluAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ email: string; password: string }> => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Action réservée à l'administrateur.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: elu, error } = await supabaseAdmin
      .from("elus")
      .select("id, email, full_name, user_id")
      .eq("id", data.eluId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!elu) throw new Error("Élu introuvable.");

    const password = data.password ?? generatePassword();

    if (elu.user_id) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(elu.user_id, {
        password,
      });
      if (updateError) throw new Error(updateError.message);
      return { email: elu.email, password };
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: elu.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: elu.full_name },
    });

    let userId = created?.user?.id;

    if (createError || !userId) {
      // L'utilisateur existe peut-être déjà : on le retrouve pour le rattacher.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users.find(
        (u) => u.email?.toLowerCase() === elu.email.toLowerCase(),
      );
      if (!existing) throw new Error(createError?.message ?? "Création du compte impossible.");
      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password,
      });
      if (pwError) throw new Error(pwError.message);
      userId = existing.id;
    }

    const { error: linkError } = await supabaseAdmin
      .from("elus")
      .update({ user_id: userId })
      .eq("id", elu.id);
    if (linkError) throw new Error(linkError.message);

    return { email: elu.email, password };
  });
