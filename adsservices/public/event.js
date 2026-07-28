/*!
 * DamnDeal Ads — Conversion Pixel (browser)
 * Put on EVERY page of the advertiser site:
 *   <script src="https://damndeal.in/ads/event.js"></script>
 * Then fire a conversion on the success/thank-you page:
 *   ddq('purchase', { value: 1299, currency: 'USD', orderId: 'ORD-123' });
 *
 * On landing it captures ?dd_click=... (added to the URL when a user clicks an ad)
 * and remembers it for 30 days, so the conversion is attributed to the right ad.
 */
(function () {
  var API = "https://damndeal.in/ads/api";
  var KEY = "dd_click_id";
  var TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

  // 1. Capture click id from the landing URL
  try {
    var p = new URLSearchParams(location.search);
    var cid = p.get("dd_click");
    if (cid) localStorage.setItem(KEY, JSON.stringify({ id: cid, t: Date.now() }));
  } catch (e) {}

  function storedClick() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && Date.now() - raw.t < TTL) return raw.id;
    } catch (e) {}
    return null;
  }

  // 2. ddq(event, params) → records a conversion
  window.ddq = function (event, params) {
    params = params || {};
    var body = {
      event: event || "purchase",
      value: params.value || 0,
      currency: params.currency || "USD",
      orderId: params.orderId || "",
      clickId: params.clickId || storedClick() || "",
      zone: params.zone || "",
    };
    return fetch(API + "/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).then(function (r) { return r.json(); }).catch(function () {});
  };
})();
