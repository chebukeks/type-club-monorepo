const SITE_URL = import.meta.env.VITE_SITE_URL || "https://type-club.ru";

function deriveCollabWsUrl(siteUrl: string): string {
  const explicit = import.meta.env.VITE_COLLAB_WS_URL;
  if (explicit) return explicit;

  try {
    const u = new URL(siteUrl);
    const isSecure = u.protocol === "https:";
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return `ws://${u.hostname}:8001/collab`;
    }
    return `${isSecure ? "wss" : "ws"}://${u.host}/collab`;
  } catch {
    return "wss://type-club.ru/collab";
  }
}

export const config = {
  siteUrl: SITE_URL,
  apiUrl: `${SITE_URL}/api`,
  collabWsUrl: deriveCollabWsUrl(SITE_URL),
};
