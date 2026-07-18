import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-roles";
import { getAllowedEmailDomain, setAllowedEmailDomain } from "@/lib/app-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Expense It" }] }),
  component: AdminSettings,
});

function AdminSettings() {
  const { isAdmin, isFinance, isLoading } = useRoles();
  const qc = useQueryClient();
  const get = useServerFn(getAllowedEmailDomain);
  const save = useServerFn(setAllowedEmailDomain);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["app-settings", "allowed_email_domain"],
    queryFn: () => get(),
    enabled: !isLoading && (isAdmin || isFinance),
  });

  const [domain, setDomain] = useState("");
  useEffect(() => {
    if (data) setDomain(data.domain ?? "");
  }, [data]);

  const mut = useMutation({
    mutationFn: (value: string) => save({ data: { domain: value.trim() } }),
    onSuccess: (r) => {
      qc.setQueryData(["app-settings", "allowed_email_domain"], { domain: r.domain });
      qc.invalidateQueries({ queryKey: ["allowed-email-domain"] });
      toast.success(r.domain ? `Allowed domain set to ${r.domain}` : "Allowed domain cleared — any email accepted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;
  if (!isAdmin && !isFinance) {
    return (
      <div className="px-5 pt-12">
        <p className="text-sm text-muted-foreground">You don't have access to settings.</p>
      </div>
    );
  }

  return (
    <div className="px-5 md:px-8 pt-10 pb-16 max-w-2xl">
      <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors">
        <ArrowLeft className="size-3.5" /> Admin
      </Link>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mt-4">
        <Settings className="size-3.5" /> Settings
      </div>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-2">Workspace settings</h1>
      <p className="text-sm text-white/70 mt-2">Configure deployment-wide rules for your team.</p>

      <div className="mt-8 rounded-3xl p-6 bg-white/[0.04] ring-1 ring-white/10">
        <h2 className="text-base font-semibold text-white">Allowed email domain</h2>
        <p className="text-xs text-white/60 mt-1">
          Restrict sign-ups and Google sign-in to a single email domain (e.g. <code className="text-white/80">acme.com</code>).
          Leave blank to allow any email address.
        </p>

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate(domain);
          }}
        >
          <div>
            <Label htmlFor="domain" className="text-[10px] uppercase tracking-[0.14em] text-white/55">
              Domain
            </Label>
            <Input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acme.com"
              disabled={loading || mut.isPending}
              className="mt-2 bg-white/5 border-white/10 text-white"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={mut.isPending || loading || (domain.trim() === (data?.domain ?? ""))}>
              {mut.isPending ? <><Loader2 className="size-3.5 mr-2 animate-spin" /> Saving…</> : "Save"}
            </Button>
            {data?.domain && (
              <Button
                type="button"
                variant="ghost"
                disabled={mut.isPending}
                onClick={() => { setDomain(""); mut.mutate(""); }}
              >
                Clear
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}