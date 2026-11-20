const requestedOverlay = new URLSearchParams(location.search).get('overlay');
const sessionOverlay = KGGraphics.byId[requestedOverlay]?.live ? KGGraphics.byId[requestedOverlay] : null;

function matchesStudioDesign(design) {
  const definition = KGGraphics.definition(design.overlayKind, design.config);
  return sessionOverlay ? definition?.id === sessionOverlay.id : !definition?.live;
}

if (sessionOverlay) {
  const editor = window.rewardConfigEditor;
  window.rewardConfigEditor = Object.freeze({
    ...editor,
    getDefaults(kind) {
      const config = editor.getDefaults(kind);
      if (kind === 'goal') config.goalBar.graphic = {variant:sessionOverlay.id};
      return config;
    },
    loadConfigForKind(kind, config, message) {
      editor.loadConfigForKind(kind,config,message);
      if (kind === 'goal') window.renderSessionRules?.(config?.goalBar?.graphic);
    }
  });
}
