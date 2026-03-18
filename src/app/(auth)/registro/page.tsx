"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegistroPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setError(getSignupErrorMessage(error.message));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-8 sm:px-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
            ¡Revisá tu email!
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Te enviamos un email de confirmación. Revisá tu casilla para activar
            tu cuenta.
          </p>
          <Link href="/login" className="mt-6 block">
            <Button
              variant="outline"
              className="h-11 w-full cursor-pointer rounded-lg border-border transition-colors duration-200"
            >
              Volver a iniciar sesión
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-8 sm:px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 sm:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
            Crear cuenta
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Completá tus datos para registrarte
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="rounded-lg border border-cuba-red/20 bg-cuba-red/10 px-4 py-3 text-sm text-cuba-red-light">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName" className="text-sm font-medium">
              Nombre completo
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Juan Pérez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
              className="h-11 rounded-lg border-border bg-background px-3 transition-colors duration-200 focus:border-primary"
            />
          </div>

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
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="h-11 rounded-lg border-border bg-background px-3 transition-colors duration-200 focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirmar contraseña
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repetí tu contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="h-11 rounded-lg border-border bg-background px-3 transition-colors duration-200 focus:border-primary"
            />
          </div>

          <Button
            type="submit"
            className="mt-1 h-11 w-full cursor-pointer rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{" "}
          <Link
            href="/login"
            className="cursor-pointer font-medium text-primary underline-offset-4 transition-colors duration-200 hover:underline"
          >
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

function getSignupErrorMessage(errorMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase();

  if (normalizedMessage.includes("user already registered")) {
    return "Ya existe una cuenta con ese email. Probá iniciar sesión.";
  }

  if (normalizedMessage.includes("password should be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  return "No pudimos crear tu cuenta en este momento. Intentá de nuevo en unos minutos.";
}
