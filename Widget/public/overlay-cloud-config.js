(() => {
  const origin = window.location.origin;

  window.overlayCloudConfig = Object.freeze({
    apiBaseUrl: `${origin}/api`,
    appBaseUrl: `${origin}/Widget/public`,
    outputBaseUrl: `${origin}/output`
  });
})();
