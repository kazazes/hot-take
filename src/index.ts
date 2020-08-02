import NewYorkTimesScraper from "./targets/nytimes";
import moment from "moment";

let TimesScraper: NewYorkTimesScraper;

TimesScraper = new NewYorkTimesScraper({
  searchTerms: "trump china",
  startDate: moment().subtract(2, "days"),
  endDate: moment(),
  crawlerOptions: {
    maxConcurrency: 2,
    puppeteerPoolOptions: {
      useIncognitoPages: true,
    },
  },
});

async function main() {
  await TimesScraper.initializeCrawler();
  await TimesScraper.crawler?.run();
}

main();
