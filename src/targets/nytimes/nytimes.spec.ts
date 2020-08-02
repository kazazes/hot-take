import NewYorkTimesScraper from "./index";
import moment from "moment";

let TimesScraper: NewYorkTimesScraper;

beforeAll(async (cb) => {
  TimesScraper = new NewYorkTimesScraper({
    searchTerms: "trump",
    startDate: moment().subtract(7),
    endDate: moment(),
    crawlerOptions: {
      launchPuppeteerOptions: {
        useChrome: true,
      },
      maxRequestsPerCrawl: 5,
      maxConcurrency: 1,
      puppeteerPoolOptions: {
        useIncognitoPages: true,
      },
    },
  });
  return TimesScraper.initializeCrawler();
});

it("scrapes search page", (cb) => {
  TimesScraper.crawler?.run();
});
