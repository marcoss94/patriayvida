"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(getLoginErrorMessage(error.message));
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="rounded-lg border border-cuba-red/20 bg-cuba-red/10 px-4 py-3 text-sm text-cuba-red-light">
              {error}
            </div>
          )}
          {searchParams.get("error") === "auth" && (
            <div className="rounded-lg border border-cuba-red/20 bg-cuba-red/10 px-4 py-3 text-sm text-cuba-red-light">
              Hubo un error con la autenticación. Intentá de nuevo.
            </div>
          )}

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
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿No tenés cuenta?{" "}
          <Link
            href="/registro"
            className="cursor-pointer font-medium text-primary underline-offset-4 transition-colors duration-200 hover:underline"
          >
            Creá una
          </Link>
        </p>
      </div>
    </div>
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
