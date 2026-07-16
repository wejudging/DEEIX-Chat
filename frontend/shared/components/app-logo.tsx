"use client";

import Image from "next/image";

import { useBranding } from "@/shared/config/branding-provider";
import { useTheme } from "@/shared/components/theme-provider";

const HOHAI_LIGHT_LOGO_URL = "/branding/logo-light.png";
const HOHAI_DARK_LOGO_URL = "/branding/logo-dark.svg";

type AppLogoProps = {
  alt?: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
};

export function AppLogo({
  alt,
  width,
  height,
  priority,
  className,
}: AppLogoProps) {
  const branding = useBranding();
  const { resolvedTheme } = useTheme();
  const customLogoURL = branding.logoURL;
  const logoURL = customLogoURL
    ? resolvedTheme === "dark" && customLogoURL === HOHAI_LIGHT_LOGO_URL
      ? HOHAI_DARK_LOGO_URL
      : customLogoURL
    : resolvedTheme === "dark"
      ? "/logo-white.svg"
      : "/logo.svg";

  return (
    <Image
      src={logoURL}
      alt={alt ?? branding.title}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}

export function DeeixLogo({
  alt = "DEEIX Chat",
  width,
  height,
  priority,
  className,
}: AppLogoProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Image
      src={resolvedTheme === "dark" ? "/logo-white.svg" : "/logo.svg"}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
