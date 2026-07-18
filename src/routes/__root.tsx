import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-semibold tracking-tight text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-medium">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist or has moved.</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0b0a10" },
      // PWA / iOS home-screen
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Expense It" },
      { name: "application-name", content: "Expense It" },
      { name: "format-detection", content: "telephone=no" },
      { title: "Easy Expense management that you won't hate" },
      { name: "description", content: "Snap a receipt, get reimbursed. A mobile-first expense platform for finance, ops, and the people doing the work." },
      { property: "og:title", content: "Easy Expense management that you won't hate" },
      { name: "twitter:title", content: "Easy Expense management that you won't hate" },
      { property: "og:description", content: "Snap a receipt, get reimbursed. A mobile-first expense platform for finance, ops, and the people doing the work." },
      { name: "twitter:description", content: "Snap a receipt, get reimbursed. A mobile-first expense platform for finance, ops, and the people doing the work." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/36810613-7820-4c8a-a85b-abb87b85e537/id-preview-e49c099c--77f965f1-d0be-49b2-9dc9-0d934051d96d.lovable.app-1778777351020.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/36810613-7820-4c8a-a85b-abb87b85e537/id-preview-e49c099c--77f965f1-d0be-49b2-9dc9-0d934051d96d.lovable.app-1778777351020.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function AuthBridge() {
  const router = useRouter();
  const qc = useQueryClient();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        lastUserId.current = data.session?.user?.id ?? null;
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;

      const nextUserId = session?.user?.id ?? null;
      const userChanged = lastUserId.current !== nextUserId;
      lastUserId.current = nextUserId;

      if (event === "SIGNED_OUT") {
        qc.clear();
        router.invalidate();
        return;
      }

      if (event === "SIGNED_IN" && !userChanged) return;
      if (event !== "SIGNED_IN" && event !== "USER_UPDATED" && event !== "PASSWORD_RECOVERY") return;

      router.invalidate();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, qc]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const setAppHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? 0;
      const nextHeight = Math.max(window.innerHeight, viewportHeight, document.documentElement.clientHeight);
      document.documentElement.style.setProperty("--app-height", `${nextHeight}px`);
    };

    setAppHeight();
    const raf = window.requestAnimationFrame(setAppHeight);
    window.addEventListener("resize", setAppHeight);
    window.addEventListener("orientationchange", setAppHeight);
    window.addEventListener("pageshow", setAppHeight);
    window.visualViewport?.addEventListener("resize", setAppHeight);
    window.visualViewport?.addEventListener("scroll", setAppHeight);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", setAppHeight);
      window.removeEventListener("orientationchange", setAppHeight);
      window.removeEventListener("pageshow", setAppHeight);
      window.visualViewport?.removeEventListener("resize", setAppHeight);
      window.visualViewport?.removeEventListener("scroll", setAppHeight);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBridge />
      <Outlet />
      <Toaster
        position="top-center"
        closeButton
        swipeDirections={["left", "right", "top"]}
        offset={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        mobileOffset={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: "ei-toast",
            title: "ei-toast-title",
            description: "ei-toast-desc",
            icon: "ei-toast-icon",
            closeButton: "ei-toast-close",
            loading: "ei-toast-loading",
            success: "ei-toast-success",
            error: "ei-toast-error",
          },
        }}
      />
    </QueryClientProvider>
  );
}
