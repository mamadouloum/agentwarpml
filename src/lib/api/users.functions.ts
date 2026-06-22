import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server-side creation of a school member account.
// Only a school_admin (of the caller's active school) or a super_admin may call it.
// Uses the service-role admin client to create the auth user with the school's
// default password; the user changes it later from Paramètres.
export const createSchoolUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      role: z.enum(["teacher", "staff", "parent", "student"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", userId)
      .maybeSingle();
    const schoolId = (profile?.school_id as string | null) ?? null;
    if (!schoolId) throw new Error("Aucune école active sur votre compte.");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["school_admin", "super_admin"]);
    if (!roles || roles.length === 0) {
      throw new Error("Réservé à l'administration de l'établissement.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: school } = await supabaseAdmin
      .from("schools")
      .select("default_member_password")
      .eq("id", schoolId)
      .maybeSingle();
    const dmp = (school as any)?.default_member_password as string | null;
    const password = dmp && dmp.length >= 6 ? dmp : `ML2-${Math.random().toString(36).slice(2, 8)}`;

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { first_name: data.firstName ?? "", last_name: data.lastName ?? "" },
    });
    if (cErr || !created?.user) {
      throw new Error(cErr?.message ?? "Création du compte impossible.");
    }

    const uid = created.user.id;
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      first_name: data.firstName ?? "",
      last_name: data.lastName ?? "",
      school_id: schoolId,
    });
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: uid, role: data.role, school_id: schoolId },
        { onConflict: "user_id,role,school_id" },
      );

    return { email: data.email, password };
  });
