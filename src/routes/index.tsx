import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  component: IndexRedirect,
});

function IndexRedirect() {
  const nav = useNavigate();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    nav({ to: user ? "/dashboard" : "/login", replace: true });
  }, [nav, ready, user]);

  return null;
}
