const BASIN_ENDPOINT = 'https://f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com';

type Device = 'desktop' | 'android' | 'ios';

let pageViewRequest: Promise<void> | null = null;

function getDevice(): Device {
  const userAgent = navigator.userAgent;

  if (/android/i.test(userAgent)) {
    return 'android';
  }

  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }

  return 'desktop';
}

export function sendPageView(): Promise<void> {
  if (pageViewRequest) {
    return pageViewRequest;
  }

  pageViewRequest = (async () => {
    try {
      const response = await fetch(BASIN_ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'cds08/156',
          event: 'page_view',
          country: 'VN',
          device: getDevice(),
          time: Math.floor(Date.now() / 1000),
          page: window.location.pathname,
          meta: { key: 'demo', value: '100' },
        }),
      });

      if (!response.ok) {
        console.error(
          `[analytics] Cloudflare Basin returned HTTP ${response.status} for page_view.`,
        );
      }
    } catch (error) {
      console.error(
        '[analytics] Could not send page_view. The request may have been blocked by CORS, or the network or endpoint may be unavailable.',
        error,
      );
    }
  })();

  return pageViewRequest;
}
