// Minimal no-op service worker: exists only so Chrome/Android treats the site
// as installable and uses the manifest icon (rather than a page-screenshot
// icon) when adding it to the home screen. Requests pass straight through.
self.addEventListener('fetch', () => {});
