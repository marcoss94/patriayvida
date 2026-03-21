"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeReturnPath(searchParams.get("redirect"));
  const callbackError = getAuthCallbackErrorMessage(
    searchParams.get("error"),
    searchParams.get("reason")
  );
  const registerHref = getAuthPageHref("/registro", redirectTo);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPasswordLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(getLoginErrorMessage(error.message));
      setPasswordLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);

    const supabase = createClient();
    const callbackUrl = new URL("/callback", window.location.origin);
    callbackUrl.searchParams.set("next", redirectTo);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      setError(getOAuthErrorMessage(error.message));
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-8 sm:px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 sm:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
            Iniciar sesión
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ingresá tus datos para acceder a tu cuenta
          </p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-5">
          {error && (
            <div className="rounded-lg border border-cuba-red/20 bg-cuba-red/10 px-4 py-3 text-sm text-cuba-red-light">
              {error}
            </div>
          )}
          {callbackError && (
            <div className="rounded-lg border border-cuba-red/20 bg-cuba-red/10 px-4 py-3 text-sm text-cuba-red-light">
              {callbackError}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-lg border-border"
            disabled={passwordLoading || googleLoading}
            onClick={handleGoogleSignIn}
          >
            <GoogleIcon />
            {googleLoading ? "Conectando con Google..." : "Continuar con Google"}
          </Button>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              o continuá con email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 rounded-lg border-border bg-background px-3 transition-colors duration-200 focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11 rounded-lg border-border bg-background px-3 transition-colors duration-200 focus:border-primary"
              />
            </div>

            <Button
              type="submit"
              className="mt-1 h-11 w-full cursor-pointer rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
              disabled={passwordLoading || googleLoading}
            >
              {passwordLoading ? "Ingresando..." : "Iniciar sesión"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿No tenés cuenta?{" "}
          <Link
            href={registerHref}
            className="cursor-pointer font-medium text-primary underline-offset-4 transition-colors duration-200 hover:underline"
          >
            Creá una
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.9-4.1 2.9-6.9 0-.7-.1-1.4-.2-2.1H12z"
      />
      <path
        fill="#34A853"
        d="M12 21c2.6 0 4.8-.9 6.5-2.4l-3.1-2.4c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.2v2.6C4.9 18.9 8.2 21 12 21z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V6.6H3.2C2.4 8.2 2 10 2 11.8s.4 3.6 1.2 5.2L6.4 13z"
      />
      <path
        fill="#4285F4"
        d="M12 5.5c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.8 2.5 14.6 1.5 12 1.5 8.2 1.5 4.9 3.6 3.2 6.6l3.2 2.5c.8-2.4 3-4.1 5.6-4.1z"
      />
    </svg>
  );
}

function getLoginErrorMessage(errorMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase();

  if (normalizedMessage.includes("invalid login credentials")) {
    return "El email o la contraseña no coinciden. Revisalos e intentá de nuevo.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "Necesitás confirmar tu email antes de ingresar.";
  }

  return "No pudimos iniciar sesión en este momento. Intentá de nuevo en unos minutos.";
}

function getOAuthErrorMessage(errorMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase();

  if (normalizedMessage.includes("provider is not enabled")) {
    return "Google no está habilitado en este momento. Probá iniciar sesión con email y contraseña.";
  }

  return "No pudimos iniciar sesión con Google. Intentá de nuevo en unos minutos.";
}

function sanitizeReturnPath(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }

  return path;
}

function getAuthPageHref(basePath: "/login" | "/registro", redirectTo: string) {
  if (redirectTo === "/") {
    return basePath;
  }

  const searchParams = new URLSearchParams();
  searchParams.set("redirect", redirectTo);
  return `${basePath}?${searchParams.toString()}`;
}

function getAuthCallbackErrorMessage(errorCode: string | null, reasonCode: string | null) {
  if (errorCode === "auth") {
    return "Hubo un error con la autenticación. Intentá de nuevo.";
  }

  if (errorCode !== "oauth") {
    return null;
  }

  if (reasonCode === "exchange") {
    return "No pudimos validar tu acceso con Google. Intentá nuevamente.";
  }

  return "La autenticación con Google fue cancelada o falló. Intentá de nuevo.";
}
