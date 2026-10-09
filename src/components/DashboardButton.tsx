import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";

const HIDDEN = ["/tableau-de-bord", "/auth"];

export function DashboardButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (HIDDEN.includes(pathname)) return null;
  return (
    <Link
      to="/tableau-de-bord"
      className="fixed bottom-5 left-5 z-50 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 print:hidden"
    >
      <LayoutDashboard className="h-4 w-4" aria-hidden />
      Tableau de bord
    </Link>
  );
}
