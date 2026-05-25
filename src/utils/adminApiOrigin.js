/**
 * Single source for "which origin hosts /api" in the admin web app.
 * When VITE_USE_VITE_PROXY=true in dev, use the Vite dev server origin so
 * requests go through vite.config.js proxy → backend (avoids direct :5001).
 */
export function getAdminApiOrigin() {
  const useViteProxy =
    import.meta.env.DEV &&
    String(import.meta.env.VITE_USE_VITE_PROXY || "").toLowerCase() === "true";

  if (useViteProxy && typeof window !== "undefined") {
    return window.location.origin;
  }

  const raw =
    import.meta.env.VITE_PRIMARY_API_URL ||
    import.meta.env.VITE_NODE_API_URL ||
    "http://localhost:5001";

  if (raw && !String(raw).match(/^https?:\/\//)) {
    return `http://${raw}`;
  }
  return raw;
}
