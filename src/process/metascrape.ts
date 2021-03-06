import metascraper from "metascraper";
import metascraperAudio from "metascraper-audio";
import metascraperAuthor from "metascraper-author";
import metascraperClearbit from "metascraper-clearbit";
import metascraperDate from "metascraper-date";
import metascraperDescription from "metascraper-description";
import metascraperImage from "metascraper-image";
import metascraperLang from "metascraper-lang";
import metascraperLogo from "metascraper-logo";
import metascraperPublisher from "metascraper-publisher";
import metascraperReadability from "metascraper-readability";
import metascraperTitle from "metascraper-title";
import metascraperUrl from "metascraper-url";
import metascraperVideo from "metascraper-video";
import extractor from "unfluff";
import get from "lodash.get";
import { createWindow } from "domino";
import { getMetadata } from "page-metadata-parser";
import Readability from "readability";
import { JSDOM } from "jsdom";
import { isUri } from "valid-url";
import sanitize from "sanitize-html";

export interface ILink {
  text?: string;
  href?: string;
}

export interface IMetadata {
  audio?: string;
  author?: string;
  logo?: string;
  publisher?: string;
  date?: string;
  description?: string;
  image?: string;
  lang?: string;
  title?: string;
  url?: string;
  text?: string;
  favicon?: string;
  tags?: string[];
  links?: ILink[];
  content?: string;
  html?: string;
}

export const metascrape = async (url: string, html: string): Promise<IMetadata | null> => {
  const scraper = metascraper([
    metascraperAudio(),
    metascraperAuthor(),
    metascraperClearbit(),
    metascraperDate(),
    metascraperDescription(),
    metascraperImage(),
    metascraperLang(),
    metascraperLogo(),
    metascraperPublisher(),
    metascraperReadability(),
    metascraperTitle(),
    metascraperUrl(),
    metascraperVideo(),
  ]);

  const metadata = await scraper({ html, url });
  const doc = createWindow(html).document;
  const data = getMetadata(doc, url);
  const jsdom = new JSDOM(html, {
    url,
  });
  const article = new Readability(jsdom.window.document).parse();

  const content = sanitize(get(article, "content"), {
    allowedTags: sanitize.defaults.allowedTags.concat(["img"]),
  });
  const unfluff = extractor(html);
  const sanitized = extractor(content);

  const links = get(sanitized, "links", []).filter((link: ILink) => {
    return link.href && isUri(link.href);
  });

  return {
    audio: get(metadata, "audio"),
    author: get(metadata, "author"),
    logo: get(metadata, "logo"),
    favicon: get(data, "icon") || get(unfluff, "favicon"),
    image: get(metadata, "image") || get(unfluff, "image"),
    publisher: get(metadata, "publisher") || get(unfluff, "publisher"),
    date: get(metadata, "date") || get(unfluff, "date"),
    description: get(unfluff, "description") || get(data, "description"),
    lang: get(data, "lang") || get(unfluff, "lang"),
    title: get(data, "title") || get(metadata, "title") || get(unfluff, "title"),
    url: get(data, "url") || get(metadata, "url") || get(unfluff, "url"),
    text: get(sanitized, "text"),
    tags: get(unfluff, "tags"),
    links,
    content,
    html,
  };
};
