import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const createSchema = z.object({
  eluId: z.string().uuid(),
  /** Mot de passe choisi par l'administrateur. Si absent, un mot de passe est généré. */
  password: z.string().min(8).max(72).optional(),
});

const adminSchema = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(72),
});

const deleteSchema = z.object({
  /** Identifiant de l'élu (supprime le carnet + le compte) */
  eluId: z.string().uuid().optional(),
  /** Identifiant du compte administrateur à supprimer */
  userId: z.string().uuid().optional(),
});

export type AdminAccount = {
  userId: string;
  email: string;
  fullName: string;
  isSelf: boolean;
};

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Action réservée à l'administrateur.");
}

/** Crée (ou réinitialise) le compte personnel d'un élu. Réservé à l'administrateur. */
export const createEluAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ email: string; password: string }> => {
    await assertAdmin(context);

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

/** Liste les comptes administrateurs. Réservé à l'administrateur. */
export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAccount[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) throw new Error(error.message);

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const byId = new Map((list?.users ?? []).map((u) => [u.id, u]));

    return (roles ?? []).map((r) => {
      const user = byId.get(r.user_id);
      return {
        userId: r.user_id,
        email: user?.email ?? "—",
        fullName: (user?.user_metadata?.["full_name"] as string | undefined) ?? user?.email ?? "—",
        isSelf: r.user_id === context.userId,
      };
    });
  });

/** Crée un nouveau compte administrateur. Réservé à l'administrateur. */
export const createAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => adminSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ email: string; password: string }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.toLowerCase();
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });

    let userId = created?.user?.id;
    if (createError || !userId) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
      if (!existing) throw new Error(createError?.message ?? "Création du compte impossible.");
      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: data.password,
      });
      if (pwError) throw new Error(pwError.message);
      userId = existing.id;
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);

    return { email, password: data.password };
  });

/** Supprime un utilisateur (élu ou administrateur). Réservé à l'administrateur. */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let authUserId = data.userId ?? null;

    if (data.eluId) {
      const { data: elu, error } = await supabaseAdmin
        .from("elus")
        .select("id, user_id")
        .eq("id", data.eluId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!elu) throw new Error("Élu introuvable.");
      authUserId = elu.user_id;

      await supabaseAdmin.from("invitations").delete().eq("elu_id", elu.id);
      const { error: delError } = await supabaseAdmin.from("elus").delete().eq("id", elu.id);
      if (delError) throw new Error(delError.message);
    }

    if (authUserId) {
      if (authUserId === context.userId) {
        throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", authUserId);
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
      if (authError) throw new Error(authError.message);
    }

    return { ok: true };
  });
