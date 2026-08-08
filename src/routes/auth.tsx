import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion administrateur — Planification des IRD" },
      {
        name: "description",
        content:
          "Espace réservé à l'administrateur pour créer les IRD et gérer les invitations des élus.",
      },
      { property: "og:title", content: "Connexion administrateur — Planification des IRD" },
      {
        property: "og:description",
        content: "Accès sécurisé à la planification des IRD et au suivi des présences.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function goToHome(userId: string) {
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (roles?.some((r) => r.role === "admin")) {
      router.navigate({ to: "/tableau-de-bord" });
    } else {
      router.navigate({ to: "/mes-invitations" });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await goToHome(data.user.id);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.user) await goToHome(data.user.id);
      }

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3 text-primary">
          <Building2 className="h-7 w-7" aria-hidden />
          <h1 className="font-serif text-2xl">Planification des IRD</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">
              {mode === "signin" ? "Connexion" : "Créer le compte administrateur"}
            </CardTitle>
            <CardDescription>
              {mode === "signin"
                ? "Espace réservé à l'administrateur."
                : "Le premier compte créé devient l'administrateur."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Adresse e-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Veuillez patienter…" : mode === "signin" ? "Se connecter" : "Créer le compte"}
              </Button>
            </form>
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin"
                ? "Première utilisation ? Créer le compte administrateur"
                : "J'ai déjà un compte — se connecter"}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
