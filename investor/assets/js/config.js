// Region-aware investor portal config.
// damndeal.com  -> Global (only DamnDeal, 500 points / slot)
// damndeal.in   -> India  (DamnDeal + DamnPay, 5,000 points / slot)
// Point value: 1 point = 1 cent of the local currency (the smallest unit of
//              whichever country the investor is in — USD cent, EUR cent, etc.).
(function () {
  var host = (typeof window !== "undefined" ? window.location.hostname : "").toLowerCase();
  var isUS = host === "damndeal.com" || host.endsWith(".damndeal.com");
  var REGION = isUS ? "US" : "IN";

  var REGIONS = {
    IN: {
      apiBase: "https://damndeal.in/api",
      slotPoints: 5000,
      showDamnPay: true,
      platformWord: "Two",
      platformCount: "2",
      economy: "India's digital economy",
      economyShort: "India's digital growth",
      ecosystemBlurb: "India's hyperlocal commerce and digital payments ecosystem.",
    },
    US: {
      apiBase: "https://damndeal.com/api",
      slotPoints: 500,
      showDamnPay: false,
      platformWord: "One",
      platformCount: "1",
      economy: "the global digital economy",
      economyShort: "global digital growth",
      ecosystemBlurb: "a global hyperlocal commerce ecosystem.",
      pointNote: "1 point = 1 cent in your local currency",
    },
  };

  var R = REGIONS[REGION];
  window.CONFIG = {
    API_BASE: R.apiBase,
    REGION: REGION,
    SLOT_POINTS: R.slotPoints,
    SLOT_POINTS_FMT: R.slotPoints.toLocaleString("en-US"),
    SHOW_DAMNPAY: R.showDamnPay,
    PLATFORM_WORD: R.platformWord,
    PLATFORM_COUNT: R.platformCount,
    ECONOMY: R.economy,
    ECONOMY_SHORT: R.economyShort,
    ECOSYSTEM_BLURB: R.ecosystemBlurb,
    POINT_NOTE: R.pointNote || "",
  };
})();
