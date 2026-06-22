import { redirect } from "next/navigation";
import { headers } from "next/headers";
import TurquesaPublicSite from "./turquesa-web/page";

function isTurquesaHost(host: string) {
  const normalized = host.split(",")[0].trim().split(":")[0].toLowerCase();
  return normalized === "turquesarestaurante.com" || normalized === "www.turquesarestaurante.com";
}

export default async function HomePage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  if (isTurquesaHost(host)) return <TurquesaPublicSite />;

  redirect("/dashboard-ceo");
}
