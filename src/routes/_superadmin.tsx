import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const SUPER_ADMIN_EMAIL = import.meta.env["VITE_SUPER_ADMIN_EMAIL"] as string | undefined;

export const Route = createFileRoute("/_superadmin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    if (!SUPER_ADMIN_EMAIL || data.session.user.email !== SUPER_ADMIN_EMAIL) {
      throw redirect({ to: "/app" });
    }
    return { userId: data.session.user.id, email: data.session.user.email };
  },
  component: () => <Outlet />,
});
