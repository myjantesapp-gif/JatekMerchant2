export type StartupMedia = {
  videoUrl: string | null;
  logoUrl: string | null;
};

/** Choose once per launch. Late config responses must never replace a playing intro. */
export async function loadStartupMedia(
  apiBase: string,
  request: typeof fetch = fetch,
  timeoutMs = 1200,
): Promise<StartupMedia> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await request(`${apiBase}/api/app-config`, { signal: controller.signal });
        if (!response.ok) throw new Error(`App config HTTP ${response.status}`);
        const config = await response.json();
        const videoUrl = config?.splashVideoUrl;
        const logoUrl = config?.splashLogoUrl;
        return {
          videoUrl: typeof videoUrl === "string" && videoUrl.trim() ? videoUrl.trim() : null,
          logoUrl: typeof logoUrl === "string" && logoUrl.trim() ? logoUrl.trim() : null,
        };
      })(),
      new Promise<StartupMedia>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve({ videoUrl: null, logoUrl: null });
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    console.warn("[SplashOverlay] config unavailable; using bundled intro");
    return { videoUrl: null, logoUrl: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function loadStartupVideoUrl(
  apiBase: string,
  request: typeof fetch = fetch,
  timeoutMs = 1200,
): Promise<string | null> {
  return (await loadStartupMedia(apiBase, request, timeoutMs)).videoUrl;
}