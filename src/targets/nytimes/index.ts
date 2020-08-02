import TargetScraper, { SCRAPER, ScraperOptions } from "../TargetScraper";
import { PseudoUrl, PuppeteerHandlePageInputs } from "apify";
import moment, { Moment } from "moment";

export default class NewYorkTimesScraper extends TargetScraper {
  readonly shortName = "nyt";
  readonly identifier: SCRAPER = SCRAPER.NEW_YORK_TIMES;
  readonly articleMatchUrls: PseudoUrl[] = [
    new PseudoUrl(new RegExp(/https:\/\/(www\.)?nytimes\.com\/\d{4}\/\d{2}\/.*/)),
  ];
  readonly searchMatchUrls: PseudoUrl[] = [new PseudoUrl(new RegExp(/https:\/\/(www.)?nytimes.com\/search?query=.*/))];
  private searchEndDate: Moment;

  constructor(opts: ScraperOptions) {
    super(opts);
    this.searchEndDate = this.opts.endDate;
  }

  async handleSearchPage(inputs: PuppeteerHandlePageInputs): Promise<void> {
    const { page } = inputs;
    const buttonSelector = "button[data-testid='search-show-more-button']";
    let seeMoreClickedCount = 0;
    let shouldClose = false;
    while ((await page.$(buttonSelector)) && !shouldClose) {
      console.log('Clicking the "Show more" button.');
      await page.click(buttonSelector).then(() => new Promise((resolve) => setTimeout(resolve, 1000)));
      const enqueued = await this.enqueueMatchingLinks(inputs);
      seeMoreClickedCount = seeMoreClickedCount + 1;
      if (seeMoreClickedCount >= 5) {
        // Enqueue a fresh search URL so as to avoid page handle timeout
        const lastReq = enqueued[enqueued.length - 1].requestId;
        const lastUrl = (await this.requestQueue.getRequest(lastReq))?.url;
        const lastUrlDate = lastUrl?.match(/\d{4}\/\d{2}\/\d{2}/);
        if (lastUrlDate) {
          this.searchEndDate = moment(lastUrlDate[0], "YYYY/MM/DD").subtract(1, "d");
        }
        await this.requestQueue.addRequest(
          {
            url: this.startUrl(this.opts.searchTerms),
            userData: { label: "SEARCH" },
          },
          { forefront: true },
        );
        shouldClose = true;
      }
    }
    await this.enqueueMatchingLinks(inputs);
  }

  startUrl(searchTerms: string | string[]): string {
    const terms = Array.isArray(searchTerms) ? searchTerms.join(" ") : searchTerms;
    const urlParams = [
      [`endDate`, this.searchEndDate.format("YYYYMMDD")],
      ["startDate", this.opts.startDate.format("YYYYMMDD")],
      ["sort", "newest"],
      ["types", "article"],
    ]
      .map((p) => p.join("="))
      .join("&");
    return `https://www.nytimes.com/search?query=${encodeURIComponent(terms)}&${urlParams}`;
  }
}
