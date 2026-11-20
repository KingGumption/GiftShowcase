(() => {
  const token = decodeURIComponent(location.pathname.split('/')[2] || '');
  const cloud = window.overlayCloud;
  let checking = false;
  const unsubscribe = cloud.subscribeDock(token, {
    onChange: async event => {
      if(event.type==='graphic.state'){if(event.variantId===window.graphicContext?.design)window.studioGraphicState?.(event.state);return;}
      if (event.type === 'dock.deleted') { location.reload(); return; }
      if (checking) return;
      checking = true;
      try {
        const payload = await cloud.getPublicDock(token);
        if (payload.items[0]?.variant.revision !== window.directWidgetRevision) location.reload();
      } catch (error) {
        if (error.status === 404) location.reload();
      } finally { checking = false; }
    }
  });
  addEventListener('beforeunload', unsubscribe, { once: true });
})();
