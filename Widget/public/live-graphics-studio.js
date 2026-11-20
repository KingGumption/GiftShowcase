// Preserve old standalone and embedded editor links in the shared Studio editor.
const parameters = new URLSearchParams(location.search);
const editorUrl = new URL('/studio/', location.origin);
editorUrl.searchParams.set('overlay', parameters.get('type') || 'combo');
if (parameters.get('design')) editorUrl.searchParams.set('design', parameters.get('design'));
location.replace(editorUrl);
