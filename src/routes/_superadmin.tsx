import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isSuperAdminEmail } from "@/lib/superadmin";

export const Route = createFileRoute("/_superadmin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    if (!isSuperAdminEmail(data.session.user.email)) {
      throw redirect({ to: "/app" });
    }
    return { userId: data.session.user.id, email: data.session.user.email };
  },
  component: () => <Outlet />,
});
