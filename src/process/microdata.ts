import { toJson } from "microdata-node";

export const parseMicrodata = (html: string, pageUrl: string): unknown => toJson(html, { base: baseUrl(pageUrl) });

function baseUrl(url: string): string {
  const base = url.match(/\w+:\/\/.*?\//);
  if (base) {
    return base[0];
  } else {
    throw new Error("Could not parse URL from base: " + url);
  }
}
