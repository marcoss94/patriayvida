"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProfileFormProps {
  profile: {
    id: string;
    full_name: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
  };
  email: string;
}

export function ProfileForm({ profile, email }: ProfileFormProps) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [address, setAddress] = useState(profile.address ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        address,
        city,
      })
      .eq("id", profile.id);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({
        type: "success",
        text: "Perfil actualizado correctamente.",
      });
    }

    setLoading(false);
  }

  return (
    <Card className="rounded-xl border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-card-foreground">
          Mi perfil
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          {message && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                message.type === "success"
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-destructive/20 bg-destructive/10 text-destructive"
              }`}
            >
              {message.text}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="rounded-lg border-border bg-secondary text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              El email no se puede modificar.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName" className="text-sm font-medium">
              Nombre completo
            </Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre"
              className="rounded-lg border-border bg-background transition-colors duration-200 focus:border-primary focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              Teléfono
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="099 123 456"
              className="rounded-lg border-border bg-background transition-colors duration-200 focus:border-primary focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="address" className="text-sm font-medium">
              Dirección
            </Label>
            <Input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. 18 de Julio 1234"
              className="rounded-lg border-border bg-background transition-colors duration-200 focus:border-primary focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="city" className="text-sm font-medium">
              Ciudad
            </Label>
            <Input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Montevideo"
              className="rounded-lg border-border bg-background transition-colors duration-200 focus:border-primary focus:ring-primary"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            disabled={loading}
            className="cursor-pointer rounded-lg bg-primary font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
          >
            {loading ? "Guardando..." : "Guardar cambios"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
