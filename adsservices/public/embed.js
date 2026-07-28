/*!
 * DamnDeal Ads — drop-in embed SDK
 * Usage:
 *   <div class="dd-ad" data-zone="ZONE_API_KEY" data-app="damndeal"></div>
 *   <script src="https://damndeal.in/ads/embed.js" async></script>
 *
 * Renders a Google/Meta-style ad unit: creative (image/video) + headline + CTA button.
 * Impression is logged by the serve call; the CTA button uses the tracked clickUrl.
 */
(function () {
  var API = "https://damndeal.in/ads/api";

  var CSS =
    '.ddad{font-family:Inter,system-ui,Arial,sans-serif;border:1px solid #e6e8ef;border-radius:14px;overflow:hidden;background:#fff;max-width:360px;box-shadow:0 1px 3px rgba(20,20,50,.06),0 8px 24px rgba(20,20,50,.05)}' +
    '.ddad__media{display:block;width:100%;background:#0d0e12;line-height:0}' +
    '.ddad__media img,.ddad__media video{width:100%;display:block;object-fit:cover}' +
    '.ddad__body{display:flex;align-items:center;gap:10px;padding:10px 12px}' +
    '.ddad__txt{flex:1;min-width:0}' +
    '.ddad__title{font-size:13px;font-weight:700;color:#1b1d29;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.ddad__spon{font-size:10px;color:#7a8194;text-transform:uppercase;letter-spacing:.05em;margin-top:1px}' +
    '.ddad__cta{flex-shrink:0;background:#6C2FD9;color:#fff;border:none;font-size:12px;font-weight:700;padding:8px 14px;border-radius:9px;cursor:pointer;text-decoration:none;white-space:nowrap;transition:.15s}' +
    '.ddad__cta:hover{background:#5826b8}' +
    '.ddad--video .ddad__media video{max-height:220px}';

  function injectCSS() {
    if (document.getElementById("ddad-css")) return;
    var s = document.createElement("style");
    s.id = "ddad-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function render(slot, ad) {
    if (!ad) { slot.style.display = "none"; return; } // no ad → collapse slot
    var media = ad.type === "video"
      ? '<video src="' + ad.creativeUrl + '" autoplay muted loop playsinline></video>'
      : '<img src="' + ad.creativeUrl + '" alt="">';
    slot.classList.add("ddad");
    if (ad.type === "video") slot.classList.add("ddad--video");
    slot.innerHTML =
      '<a class="ddad__media" href="' + ad.clickUrl + '" target="_blank" rel="noopener">' + media + '</a>' +
      '<div class="ddad__body">' +
        '<div class="ddad__txt">' +
          '<div class="ddad__title">' + (ad.title || "") + '</div>' +
          '<div class="ddad__spon">Sponsored</div>' +
        '</div>' +
        '<a class="ddad__cta" href="' + ad.clickUrl + '" target="_blank" rel="noopener">' + (ad.cta || "Learn More") + '</a>' +
      '</div>';
  }

  function loadSlot(slot) {
    var zone = slot.getAttribute("data-zone");
    var app = slot.getAttribute("data-app") || "";
    if (!zone || slot.getAttribute("data-loaded")) return;
    slot.setAttribute("data-loaded", "1");
    fetch(API + "/serve?zone=" + encodeURIComponent(zone) + "&app=" + encodeURIComponent(app))
      .then(function (r) { return r.json(); })
      .then(function (res) { render(slot, res.ad); })
      .catch(function () { slot.style.display = "none"; });
  }

  function boot() {
    injectCSS();
    var slots = document.querySelectorAll(".dd-ad");
    for (var i = 0; i < slots.length; i++) loadSlot(slots[i]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // expose manual refresh for SPAs
  window.DDAds = { refresh: boot };
})();
