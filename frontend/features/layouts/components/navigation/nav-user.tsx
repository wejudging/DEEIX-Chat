"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Bell,
  Check,
  CreditCard,
  Languages,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItemIcon,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SpinnerLabel } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { logout, patchMe } from "@/shared/api/auth";
import { getBillingConfig } from "@/shared/api/billing";
import { useAuthSession } from "@/shared/auth/auth-session-context";
import { clearSessionAndRedirectToLogin } from "@/shared/auth/session";
import { dispatchUserProfileUpdated } from "@/shared/auth/user-profile-events";
import { dispatchOpenAnnouncements, getAnnouncementUnread, subscribeAnnouncementUnreadChanged } from "@/shared/events/announcement-events";
import { useAppLocale } from "@/i18n/app-i18n-provider";
import { APP_LOCALE_LABELS, APP_LOCALES, type AppLocale } from "@/i18n/config";
import {
  formatBillingDisplayBalanceFromUSD,
  normalizeBillingDisplayCurrency,
  type BillingDisplayOptions,
} from "@/shared/lib/billing-display";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
    role?: string;
  };
}) {
  const t = useTranslations("common.navigation");
  const { locale, setLocale } = useAppLocale();
  const router = useRouter();
  const { accessToken, user: sessionUser } = useAuthSession();
  const [open, setOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [savingLocale, setSavingLocale] = React.useState<AppLocale | null>(null);
  const [hasUnreadAnnouncement, setHasUnreadAnnouncement] = React.useState(() => getAnnouncementUnread());
  const [billingDisplay, setBillingDisplay] = React.useState<BillingDisplayOptions>(() => ({
    currency: normalizeBillingDisplayCurrency(sessionUser?.billingAccountCurrency),
  }));
  const skipTriggerFocusRef = React.useRef(false);
  const isAdmin = user.role === "admin" || user.role === "superadmin";
  const subscriptionTier = sessionUser?.subscriptionTier.trim().toLowerCase() || "free";
  const hasPaidSubscription = subscriptionTier !== "free";
  const planLabel = hasPaidSubscription
    ? sessionUser?.subscriptionPlanName.trim() || sessionUser?.subscriptionTier.trim() || t("paidPlan")
    : t("freePlan");
  const balanceLabel = formatBillingDisplayBalanceFromUSD(sessionUser?.billingBalanceUSD ?? 0, billingDisplay);

  React.useEffect(() => subscribeAnnouncementUnreadChanged(setHasUnreadAnnouncement), []);

  React.useEffect(() => {
    if (!accessToken) return;
    let active = true;
    void getBillingConfig(accessToken)
      .then(({ config }) => {
        if (!active) return;
        setBillingDisplay({
          currency: normalizeBillingDisplayCurrency(config.displayCurrency),
          usdToCnyRate: config.usdToCNYRate,
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [accessToken]);

  const onLogout = React.useCallback(async () => {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      if (accessToken) {
        await logout(accessToken);
      }
    } catch {
      // Ignore logout API errors and clear local session to ensure exit.
    } finally {
      clearSessionAndRedirectToLogin();
      setLoggingOut(false);
    }
  }, [accessToken, loggingOut]);

  const navigateFromMenu = React.useCallback(
    (href: string) => (event: Event) => {
      event.preventDefault();
      skipTriggerFocusRef.current = true;
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const openAnnouncementsFromMenu = React.useCallback((event: Event) => {
    event.preventDefault();
    skipTriggerFocusRef.current = true;
    setOpen(false);
    dispatchOpenAnnouncements();
  }, []);

  const onLocaleSelect = React.useCallback(
    async (nextLocale: AppLocale) => {
      if (nextLocale === locale && !savingLocale) {
        return;
      }

      if (sessionUser) {
        dispatchUserProfileUpdated({ ...sessionUser, locale: nextLocale });
      }
      void setLocale(nextLocale);

      if (!accessToken) {
        return;
      }

      setSavingLocale(nextLocale);
      try {
        const nextUser = await patchMe(accessToken, { locale: nextLocale });
        dispatchUserProfileUpdated(nextUser);
      } catch {
        // Keep the local language selection; a later profile refresh may retry or restore the server value.
      } finally {
        setSavingLocale((current) => (current === nextLocale ? null : current));
      }
    },
    [accessToken, locale, savingLocale, sessionUser, setLocale],
  );

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
        <div className="relative mb-1 flex min-w-0 items-center rounded-lg bg-sidebar-accent/45 p-1 transition-colors hover:bg-sidebar-accent/70 group-data-[collapsible=icon]:mb-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                id="sidebar-user-menu-trigger"
                type="button"
                size="lg"
                className="h-11 w-full min-w-0 bg-transparent py-1.5 pl-1.5 pr-24 transition-[background-color,color,width,height,padding] data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:overflow-visible group-data-[collapsible=icon]:p-1.5"
                aria-label={user.name}
              >
                <Avatar className="size-7 shrink-0 rounded-full">
                  <AvatarImage src={user.avatar || undefined} alt={user.name} />
                  <AvatarFallback className="rounded-full bg-foreground text-xs font-medium text-background">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 gap-0.5 overflow-hidden pl-1.5 text-left leading-tight transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-medium text-foreground/95">{user.name}</span>
                  {sessionUser ? (
                    <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="truncate">{planLabel}</span>
                      <span aria-hidden="true" className="shrink-0">·</span>
                      <span className="inline-flex min-w-0 shrink-0 items-center gap-1" title={t("balanceLabel")}>
                        <Wallet aria-hidden="true" className="size-3 shrink-0" />
                        <span className="truncate">{balanceLabel}</span>
                      </span>
                    </span>
                  ) : null}
                </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
              side="top"
              align="start"
              sideOffset={6}
              onCloseAutoFocus={(event) => {
                if (!skipTriggerFocusRef.current) {
                  return;
                }
                event.preventDefault();
                skipTriggerFocusRef.current = false;
                requestAnimationFrame(() => {
                  document.getElementById("sidebar-user-menu-trigger")?.blur();
                });
              }}
            >
              <DropdownMenuLabel className="px-2 py-2 font-normal text-muted-foreground">
                <span className="block truncate" title={user.email}>
                  {user.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={navigateFromMenu("/setting/general")}>
                  <DropdownMenuItemIcon icon={Settings} />
                  {t("settings")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={openAnnouncementsFromMenu}>
                  <DropdownMenuItemIcon icon={Bell} />
                  <span className="min-w-0 flex-1 truncate">{t("announcements")}</span>
                  <span className="ml-auto flex size-4 shrink-0 items-center justify-center">
                    {hasUnreadAnnouncement ? <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" /> : null}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="focus:bg-accent/40 data-[state=open]:bg-accent/40">
                    <DropdownMenuItemIcon icon={Languages} />
                    {t("language")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-32 p-1.5">
                    {APP_LOCALES.map((item) => (
                      <DropdownMenuItem
                        key={item}
                        disabled={savingLocale === item}
                        onSelect={(event) => {
                          event.preventDefault();
                          void onLocaleSelect(item);
                        }}
                      >
                        {APP_LOCALE_LABELS[item]}
                        {locale === item ? <DropdownMenuItemIcon icon={Check} className="ml-auto" /> : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onSelect={navigateFromMenu("/setting/subscription")}>
                  <DropdownMenuItemIcon icon={CreditCard} />
                  {t("upgradePlan")}
                </DropdownMenuItem>
                {isAdmin ? (
                  <DropdownMenuItem onSelect={navigateFromMenu("/admin")}>
                    <DropdownMenuItemIcon icon={ShieldCheck} />
                    {t("admin")}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  void onLogout();
                }}
                disabled={loggingOut}
              >
                <DropdownMenuItemIcon icon={LogOut} />
                {loggingOut ? <SpinnerLabel>{t("loggingOut")}</SpinnerLabel> : t("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {sessionUser ? (
            <Button
              asChild
              size="xs"
              variant="outline"
              className="absolute right-2 h-7 rounded-full bg-background px-2.5 text-[11px] group-data-[collapsible=icon]:hidden"
            >
              <Link href="/setting/subscription">
                {hasPaidSubscription ? <CreditCard className="size-3" /> : <Sparkles className="size-3" />}
                {hasPaidSubscription ? t("upgradePlan") : t("upgrade")}
              </Link>
            </Button>
          ) : null}
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
