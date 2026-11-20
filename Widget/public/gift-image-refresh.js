(() => {
  if (!['https:', 'http:'].includes(location.protocol)) return;
  let revision = null;
  let checking = false;
  const path = /^\/api\/v1\/gifts\/(?:images\/[A-Z]{2}\/\d+|creator-images\/[a-f0-9]{32})\.webp$/;
  async function refresh() {
    if (checking) return;
    const images = [...document.images].filter(image => {
      try { return path.test(new URL(image.src).pathname); } catch { return false; }
    });
    if (!images.length) return;
    checking = true;
    try {
      const origin = new URL(images[0].src).origin;
      const response = await fetch(origin + '/api/v1/gifts/catalogue?status=1', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      if (revision && payload.revision) {
        images.forEach(image => {
          const url = new URL(image.src);
          if (url.pathname.includes('/creator-images/')) url.searchParams.set('v', String(Math.floor(Date.now() / 900000)));
          else if (revision !== payload.revision) url.searchParams.set('v', payload.revision);
          else return;
          image.src = url.href;
        });
      }
      revision = payload.revision || revision;
    } catch { /* Retain the already displayed artwork while the network is unavailable. */ }
    finally { checking = false; }
  }
  const initial = setTimeout(refresh, 1000);
  const interval = setInterval(refresh, 15 * 60 * 1000);
  addEventListener('beforeunload', () => { clearTimeout(initial); clearInterval(interval); }, { once: true });
})();
