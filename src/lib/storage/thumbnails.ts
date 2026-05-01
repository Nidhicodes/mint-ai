const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 300;
const MAX_THUMBNAIL_BYTES = 65536; // 64KB

/**
 * Captures a thumbnail by rendering HTML in a temporary unsandboxed iframe
 * and using html2canvas to screenshot it.
 */
export async function captureThumbnail(
  _iframe: HTMLIFrameElement,
): Promise<string | null> {
  try {
    const html = _iframe?.srcdoc || _iframe?.contentDocument?.documentElement?.outerHTML;
    if (!html) { console.warn('[thumbnail] No HTML found'); return null; }
    return await captureFromHtml(html);
  } catch (e) {
    console.warn('[thumbnail] captureThumbnail error:', e);
    return null;
  }
}

export async function captureFromHtml(html: string): Promise<string | null> {
  console.log('[thumbnail] Starting capture, HTML length:', html.length);

  const tempIframe = document.createElement('iframe');
  tempIframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:800px;height:600px;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(tempIframe);

  try {
    const doc = tempIframe.contentDocument;
    if (!doc) { console.warn('[thumbnail] No contentDocument'); return null; }

    doc.open();
    doc.write(html);
    doc.close();

    console.log('[thumbnail] HTML written, waiting for render...');
    await new Promise(r => setTimeout(r, 1000));

    console.log('[thumbnail] Importing html2canvas...');
    const { default: html2canvas } = await import('html2canvas');

    console.log('[thumbnail] Running html2canvas...');
    const fullCanvas = await html2canvas(doc.body, {
      width: 800,
      height: 600,
      scale: 0.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 800,
      windowHeight: 600,
    });

    console.log('[thumbnail] Canvas captured:', fullCanvas.width, 'x', fullCanvas.height);

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = THUMBNAIL_WIDTH;
    thumbCanvas.height = THUMBNAIL_HEIGHT;
    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) { console.warn('[thumbnail] No canvas context'); return null; }

    ctx.drawImage(fullCanvas, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

    for (const quality of [0.7, 0.5, 0.3, 0.1]) {
      const dataUrl = thumbCanvas.toDataURL('image/jpeg', quality);
      console.log('[thumbnail] JPEG quality', quality, '→', dataUrl.length, 'bytes');
      if (dataUrl.length <= MAX_THUMBNAIL_BYTES) {
        console.log('[thumbnail] Success! Size:', dataUrl.length);
        return dataUrl;
      }
    }

    console.warn('[thumbnail] All qualities exceeded 64KB');
    return null;
  } catch (e) {
    console.error('[thumbnail] Capture failed:', e);
    return null;
  } finally {
    if (tempIframe.parentNode) tempIframe.parentNode.removeChild(tempIframe);
  }
}
