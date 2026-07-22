const { buildShareHtml } = require('../publicFields');

const TEMPLATE = '<html><head><title>App</title></head><body></body></html>';

describe('buildShareHtml', () => {
  it('returns the template unchanged when there is no drink', () => {
    expect(buildShareHtml(TEMPLATE, null)).toBe(TEMPLATE);
  });

  it('injects og:title/description/type and omits og:image when there is no photo', () => {
    const html = buildShareHtml(TEMPLATE, { producer: 'Chateau X', name: 'Reserve', avgRating: 8, photo: null });
    expect(html).toContain('<meta property="og:title" content="Chateau X — Reserve">');
    expect(html).toContain('<meta property="og:description" content="Rated 8/10">');
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).not.toContain('og:image');
    expect(html).toContain('</head>');
  });

  it('includes og:image when a photo is present', () => {
    const html = buildShareHtml(TEMPLATE, { producer: 'X', name: 'Y', avgRating: 7, photo: 'https://example.com/x.png' });
    expect(html).toContain('<meta property="og:image" content="https://example.com/x.png">');
  });

  it('shows "Not yet tasted" when avgRating is null', () => {
    const html = buildShareHtml(TEMPLATE, { producer: 'X', name: 'Y', avgRating: null, photo: null });
    expect(html).toContain('<meta property="og:description" content="Not yet tasted">');
  });

  it('HTML-escapes producer/name to prevent markup injection', () => {
    const html = buildShareHtml(TEMPLATE, { producer: '<script>', name: 'A & B "quoted"', avgRating: null, photo: null });
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B &quot;quoted&quot;');
    expect(html).not.toContain('<script>');
  });
});
