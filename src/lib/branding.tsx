import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentSchool } from "@/hooks/use-current-school";
import { Building2 } from "lucide-react";

export type Branding = {
  school_id: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  button_color: string | null;
  logo_url: string | null;
  stamp_url: string | null;
  motto: string | null;
};

function hexToHsl(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16) / 255;
  const g = parseInt(m.substring(2, 4), 16) / 255;
  const b = parseInt(m.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function toHsl(value: string): string {
  if (!value) return "";
  if (value.startsWith("#")) return hexToHsl(value);
  return value;
}

export function useSchoolBranding() {
  const schoolId = useCurrentSchool();
  return useQuery({
    queryKey: ["school-branding", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from("school_branding")
        .select("*")
        .eq("school_id", schoolId!)
        .maybeSingle();
      let logoUrl: string | null = null;
      if (data?.logo_url) {
        const { data: signed } = await supabase.storage
          .from("school-logos")
          .createSignedUrl(data.logo_url, 60 * 60);
        logoUrl = signed?.signedUrl ?? null;
      }
      let stampUrl: string | null = null;
      const stampPath = (data as any)?.stamp_url as string | null | undefined;
      if (stampPath) {
        const { data: signed } = await supabase.storage
          .from("school-logos")
          .createSignedUrl(stampPath, 60 * 60);
        stampUrl = signed?.signedUrl ?? null;
      }
      return data
        ? ({ ...(data as any), logo_url: logoUrl, stamp_url: stampUrl } as Branding)
        : null;
    },
    staleTime: 5 * 60_000,
  });
}

function hexLightness(hex: string): number {
  const m = hex.startsWith("#") ? hex.slice(1) : hex;
  if (m.length < 6) return 128;
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}
function contrastFg(value?: string | null): string {
  if (!value || !value.startsWith("#")) return "0 0% 100%";
  return hexLightness(value) > 150 ? "240 10% 10%" : "0 0% 100%";
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { data } = useSchoolBranding();
  useEffect(() => {
    const root = document.documentElement;
    const apply = (name: string, raw: string | null | undefined) => {
      if (!raw) {
        root.style.removeProperty(name);
        return;
      }
      root.style.setProperty(name, toHsl(raw));
    };
    apply("--primary", data?.primary_color);
    apply("--accent", data?.accent_color);
    apply("--secondary", data?.secondary_color);
    apply("--sidebar-primary", data?.primary_color);
    apply("--sidebar-accent", data?.accent_color);
    apply("--ring", data?.primary_color);
    if (data?.primary_color) {
      const fg = contrastFg(data.primary_color);
      root.style.setProperty("--primary-foreground", fg);
      root.style.setProperty("--sidebar-primary-foreground", fg);
      const h = toHsl(data.primary_color);
      root.style.setProperty(
        "--gradient-primary",
        `linear-gradient(135deg, hsl(${h}), hsl(${h} / 0.75))`,
      );
    } else {
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--sidebar-primary-foreground");
      root.style.removeProperty("--gradient-primary");
    }
    if (data?.accent_color) {
      root.style.setProperty("--accent-foreground", contrastFg(data.accent_color));
    } else {
      root.style.removeProperty("--accent-foreground");
    }
  }, [data?.primary_color, data?.accent_color, data?.secondary_color]);
  return <>{children}</>;
}

export function SchoolLogo({ className = "h-8 w-8" }: { className?: string }) {
  const { data } = useSchoolBranding();
  if (data?.logo_url) {
    return (
      <img
        src={data.logo_url}
        alt="Logo de l'école"
        className={`${className} rounded-lg object-cover`}
      />
    );
  }
  return (
    <div
      className={`${className} grid place-items-center rounded-lg bg-[image:var(--gradient-primary)]`}
    >
      <Building2 className="h-1/2 w-1/2 text-primary-foreground" />
    </div>
  );
}
