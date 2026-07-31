import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export type Lang = "ar" | "en";

export const LANG_COOKIE = "gmobd.lang";
export const DEFAULT_LANG: Lang = "ar";

function parseLang(cookieHeader: string | null | undefined): Lang {
  if (!cookieHeader) return DEFAULT_LANG;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=(ar|en)`));
  return (match?.[1] as Lang | undefined) ?? DEFAULT_LANG;
}

/**
 * Read on the server from the request and on the client from document.cookie,
 * so the very first HTML already carries the right `lang`/`dir`. A localStorage
 * read in an effect cannot do that — it renders Arabic RTL first and flips
 * after paint, which is the flash this replaces.
 */
export const readLang = createIsomorphicFn()
  .server(() => parseLang(getRequest()?.headers.get("cookie")))
  .client(() => (typeof document === "undefined" ? DEFAULT_LANG : parseLang(document.cookie)));

export function writeLangCookie(lang: Lang) {
  if (typeof document === "undefined") return;
  // A year, site-wide, and readable by the server on the next navigation.
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}

export { parseLang };
