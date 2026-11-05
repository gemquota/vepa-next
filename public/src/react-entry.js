/*
 * Compatibility bridge for cached pre-Vite VEPA documents.
 * Older cached HTML points at /src/react-entry.js and /style.css. The current
 * build uses hashed assets under /assets/, so discover those assets from the
 * current root document and boot the current bundle from the legacy URL.
 */
(async () => {
  try {
    const response = await fetch(`${location.origin}${location.pathname}`, {
      cache: 'no-store',
      headers: { Accept: 'text/html' },
    });
    const html = await response.text();
    const css = html.match(/href="(\/assets\/[^\"]+\.css)"/i)?.[1];
    const js = html.match(/src="([^"]*\/assets\/[^\"]+\.js)"/i)?.[1];

    if (css && !document.querySelector(`link[href="${css}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = css;
      document.head.appendChild(link);
    }
    if (!js) {
      // Dev server (or base-prefixed deploy): no hashed /assets/ bundle is
      // referenced by the served document. Boot the source runtime directly
      // so local development and e2e acceptance tests exercise real code.
      await import('/src/main.js');
      return;
    }
    await import(`${location.origin}${js}`);
  } catch (error) {
    console.error('VEPA compatibility bridge failed:', error);
  }
})();
