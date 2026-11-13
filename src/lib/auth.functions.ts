import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().trim().min(1, "Name is required").max(120),
});

export const signupWithResend = createServerFn({ method: "POST" })
  .validator((input: unknown) => signupSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendActivationEmail } = await import("./email.server");

    const appUrl = (process.env.APP_URL || "https://bhaibiz.com").replace(/\/+$/, "");

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
        redirectTo: `${appUrl}/app`,
      },
    });

    if (linkError) {
      if (linkError.message.includes("already been registered")) {
        throw new Error("A user with this email address has already been registered.");
      }
      throw new Error(linkError.message);
    }

    const tokenHash = linkData.properties?.hashed_token;
    if (!tokenHash) {
      throw new Error("Could not generate confirmation token.");
    }

    const confirmUrl = `${appUrl}/auth/confirm?token_hash=${tokenHash}&type=signup`;

    await sendActivationEmail({
      to: data.email,
      name: data.fullName,
      confirmUrl,
    });

    return { ok: true };
  });
