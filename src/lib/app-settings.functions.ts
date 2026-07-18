import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

// Public — used by /login (anonymous) to set the Google `hd` hint.
export const getAllowedEmailDomain = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "allowed_email_domain")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { domain: (data?.value ?? "").trim() || null };
  });

// Admin/finance write — enforced again by set_app_setting RPC.
export const setAllowedEmailDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      domain: z.string().trim().max(253).refine(
        (v) => v === "" || DOMAIN_RE.test(v),
        "Must be a valid domain like example.com (or blank to allow any)",
      ),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_app_setting", {
      _key: "allowed_email_domain",
      _value: data.domain,
    });
    if (error) throw new Error(error.message);
    return { ok: true, domain: data.domain || null };
  });