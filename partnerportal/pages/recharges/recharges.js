(function () {
  requireAuth();
  document.body.innerHTML = pageShell("Recharges & Bills");
  buildLayout("recharges");

  const content = document.getElementById("page-content");
  content.innerHTML = `
    <iframe
      src="https://damnpay.in"
      style="width:100%;height:calc(100vh - 60px);border:none;border-radius:10px;"
      allow="payment"
      loading="lazy"
    ></iframe>
  `;
})();
