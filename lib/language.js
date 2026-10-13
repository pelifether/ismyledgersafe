// Which page a visitor gets: Portuguese for Brazil and Portugal, English
// elsewhere. ?lang= and the lang cookie (set by the footer switch) win.
const PORTUGUESE = new Set(["BR", "PT"]);

export function pageFor(request) {
  const url = new URL(request.url);
  const asked = url.searchParams.get("lang");
  const cookie = /(?:^|;\s*)lang=(pt|en)\b/.exec(request.headers.get("cookie") || "")?.[1];
  const choice = asked === "pt" || asked === "en" ? asked : cookie;
  const pt = choice ? choice === "pt" : PORTUGUESE.has(request.headers.get("x-vercel-ip-country") || "");
  return pt ? "/pt.html" : "/index.html";
}
