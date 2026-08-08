/** Aides pour la gestion des comptes (importées par les fonctions serveur). */

export function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

type RpcClient = {
  rpc: (
    name: "has_role",
    args: { _user_id: string; _role: "admin" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any;
};

/** Vérifie que l'appelant possède le rôle administrateur. */
export async function assertAdmin(context: { supabase: RpcClient; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Action réservée à l'administrateur.");
}

