import xtend from "xtend";
import {
  Dataset,
  KeyValueStore,
  openDataset,
  openKeyValueStore,
  openRequestQueue,
  PseudoUrl,
  PuppeteerCrawler,
  PuppeteerCrawlerOptions,
  PuppeteerHandlePageInputs,
  QueueOperationInfo,
  RequestQueue,
  utils as apifyUtils,
} from "apify";
import moment, { Moment } from "moment";
import { Log } from "apify-shared/log";
import { parseMicrodata } from "../process/microdata";
import { metascrape } from "../process/metascrape";

export type ScraperOptions = {
  startDate: Moment;
  endDate: Moment;
  crawlerOptions?: Partial<PuppeteerCrawlerOptions>;
  searchTerms: string | string[];
};

export default abstract class TargetScraper {
  abstract readonly identifier: SCRAPER;
  abstract readonly searchMatchUrls: PseudoUrl[];
  abstract readonly articleMatchUrls: PseudoUrl[];
  abstract readonly shortName: string;

  protected abstract startUrl(searchTerms: string | string[]): string;

  opts: ScraperOptions;
  requestQueue!: RequestQueue;
  crawler?: PuppeteerCrawler;
  defaults: Partial<ScraperOptions> = {
    crawlerOptions: {
      maxConcurrency: 2,
      maxRequestsPerCrawl: Number.MAX_VALUE,
    },
    endDate: moment(),
    startDate: moment().subtract(30, "days"),
  };
  log!: Log;
  dataset!: Dataset;
  store!: KeyValueStore;

  constructor(opts: ScraperOptions) {
    if (!opts.searchTerms) throw new Error("No search terms specified");
    opts.searchTerms = Array.isArray(opts.searchTerms)
      ? opts.searchTerms.map((s) => s.trim())
      : opts.searchTerms.trim();
    this.opts = xtend(this.defaults, opts);
  }

  protected async handlePageFunction(inputs: PuppeteerHandlePageInputs): Promise<void> {
    const { request, page } = inputs;
    const title = await page.title();
    console.log(`URL: ${request.url}\nTITLE: ${title}`);

    if (request.userData.label === "SEARCH") {
      await this.handleSearchPage(inputs);
    } else if (request.userData.label === "ARTICLE") {
      await this.handleArticlePage(inputs);
    }
  }

  protected abstract handleSearchPage(puppeteerHandlePageInputs: PuppeteerHandlePageInputs): Promise<void>;

  async handleArticlePage({ page }: PuppeteerHandlePageInputs): Promise<void> {
    const html = await page.content();
    const v = {
      microdata: parseMicrodata(html, page.url()),
      metascrape: await metascrape(page.url(), html),
    };

    return this.store.setValue(this.cleanURL(page.url()), v);
  }

  protected async initializeRequestQueue(): Promise<RequestQueue> {
    if (!this.requestQueue) {
      this.requestQueue = await openRequestQueue(this.identifier.toString());
    }
    return this.requestQueue;
  }

  public async initializeCrawler(): Promise<PuppeteerCrawler> {
    this.log = apifyUtils.log.child({ prefix: this.identifier.toString() });
    this.dataset = await openDataset(this.identifier.toString());
    this.store = await openKeyValueStore(this.identifier.toString());
    this.requestQueue = await this.initializeRequestQueue();

    const startUrl = this.startUrl(this.opts.searchTerms);
    this.log.info(`Using ${startUrl} as the start URL`);
    await this.requestQueue.addRequest({ url: this.startUrl(this.opts.searchTerms), userData: { label: "SEARCH" } });
    this.crawler = new PuppeteerCrawler({
      requestQueue: this.requestQueue,
      handlePageFunction: this.handlePageFunction.bind(this),
      ...this.opts.crawlerOptions,
    });
    return this.crawler;
  }

  protected enqueueMatchingLinks({ page }: PuppeteerHandlePageInputs): Promise<QueueOperationInfo[]> {
    return apifyUtils.enqueueLinks({
      requestQueue: this.requestQueue,
      page,
      pseudoUrls: this.articleMatchUrls,
      transformRequestFunction: (original) => {
        original.userData = { label: "ARTICLE" };
        return original;
      },
    });
  }

  protected cleanURL(url: string): string {
    return url
      .replace(/^https?:\/\/(www\.)?.*?\//, this.shortName + "_")
      .replace(/\?.*$/g, "")
      .replace(/\//g, "_");
  }
}

export enum SCRAPER {
  GENERIC,
  NEW_YORK_TIMES,
}
