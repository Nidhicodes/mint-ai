import { describe, it, expect } from 'vitest';
import { injectOgMeta } from '../sharing/encode';

describe('injectOgMeta', () => {
  const baseHtml = '<!DOCTYPE html><html><head><title>Test</title></head><body></body></html>';

  it('injects og:title, og:description, og:image, and og:type tags', () => {
    const result = injectOgMeta(baseHtml, {
      title: 'My App',
      description: 'A cool app',
      thumbnail: null,
    });

    expect(result).toContain('<meta property="og:title" content="My App">');
    expect(result).toContain('<meta property="og:description" content="A cool app">');
    expect(result).toContain('<meta property="og:image"');
    expect(result).toContain('<meta property="og:type" content="website">');
  });

  it('uses app thumbnail as og:image when available', () => {
    const thumbnail = 'data:image/png;base64,abc123';
    const result = injectOgMeta(baseHtml, {
      title: 'My App',
      description: 'A cool app',
      thumbnail,
    });

    expect(result).toContain(`<meta property="og:image" content="${thumbnail}">`);
  });

  it('falls back to /og-default.svg when thumbnail is null', () => {
    const result = injectOgMeta(baseHtml, {
      title: 'My App',
      description: 'A cool app',
      thumbnail: null,
    });

    expect(result).toContain('<meta property="og:image" content="/og-default.svg">');
  });

  it('removes existing OG meta tags before injecting new ones', () => {
    const htmlWithExistingOg =
      '<!DOCTYPE html><html><head><meta property="og:title" content="Old Title"><meta property="og:description" content="Old Desc"><title>Test</title></head><body></body></html>';

    const result = injectOgMeta(htmlWithExistingOg, {
      title: 'New Title',
      description: 'New Desc',
      thumbnail: null,
    });

    expect(result).not.toContain('Old Title');
    expect(result).not.toContain('Old Desc');
    expect(result).toContain('<meta property="og:title" content="New Title">');
    expect(result).toContain('<meta property="og:description" content="New Desc">');
  });

  it('injects tags after the <head> tag', () => {
    const result = injectOgMeta(baseHtml, {
      title: 'My App',
      description: 'Desc',
      thumbnail: null,
    });

    const headIndex = result.indexOf('<head>');
    const ogTitleIndex = result.indexOf('<meta property="og:title"');
    expect(ogTitleIndex).toBeGreaterThan(headIndex);
  });

  it('escapes special characters in title and description', () => {
    const result = injectOgMeta(baseHtml, {
      title: 'App "with" <special> & chars',
      description: 'Desc "with" <tags> & stuff',
      thumbnail: null,
    });

    expect(result).toContain('content="App &quot;with&quot; &lt;special&gt; &amp; chars"');
    expect(result).toContain('content="Desc &quot;with&quot; &lt;tags&gt; &amp; stuff"');
  });

  it('handles HTML without a <head> tag gracefully', () => {
    const noHeadHtml = '<!DOCTYPE html><html><body>Hello</body></html>';
    const result = injectOgMeta(noHeadHtml, {
      title: 'My App',
      description: 'Desc',
      thumbnail: null,
    });

    // Should return the HTML unchanged (no <head> to inject into)
    expect(result).not.toContain('<meta property="og:title"');
  });

  it('handles <head> tag with attributes', () => {
    const htmlWithAttrs = '<!DOCTYPE html><html><head lang="en"><title>Test</title></head><body></body></html>';
    const result = injectOgMeta(htmlWithAttrs, {
      title: 'My App',
      description: 'Desc',
      thumbnail: null,
    });

    expect(result).toContain('<meta property="og:title" content="My App">');
  });
});
