import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useAppRole } from "@/hooks/useAppRole";

const linkClass =
  "rounded px-3 py-2 text-sm transition-colors hover:bg-primary-foreground/10 [&.active]:bg-primary-foreground/15";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAdmin } = useAppRole();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <Building2 className="h-6 w-6 shrink-0" aria-hidden />
          <div className="mr-auto">
            <p className="font-serif text-lg leading-tight">Planification des IRD</p>
            <p className="text-xs opacity-75">
              {isAdmin ? "Espace administrateur" : "Espace élu"}
            </p>
          </div>
          <nav className="flex items-center gap-1">
            {isAdmin ? (
              <>
                <Link to="/tableau-de-bord" className={linkClass}>
                  Événements
                </Link>
                <Link to="/elus" className={linkClass}>
                  Élus
                </Link>
              </>
            ) : (
              <Link to="/mes-invitations" className={linkClass}>
                Mes invitations
              </Link>
            )}
            <Link to="/calendrier" className={linkClass}>
              Calendrier
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Déconnexion</span>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
