import { cookies, headers } from "next/headers";
import LiveTrackerClient from "./LiveTrackerClient";
import type { LiveLocale } from "./translations";

export const dynamic = "force-dynamic";

export default async function LiveTrackerPage() {
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const savedLocale = cookieStore.get("aoe2-live-locale")?.value;
  const country = (
    requestHeaders.get("x-vercel-ip-country") ??
    requestHeaders.get("cf-ipcountry") ??
    requestHeaders.get("x-country-code") ??
    ""
  ).toUpperCase();
  const acceptLanguage = requestHeaders.get("accept-language") ?? "";
  const initialLocale: LiveLocale =
    savedLocale === "pt" || savedLocale === "en"
      ? savedLocale
      : country
        ? country === "BR" ? "pt" : "en"
        : /^pt-BR/i.test(acceptLanguage) ? "pt" : "en";

  return <LiveTrackerClient initialLocale={initialLocale} />;
}
