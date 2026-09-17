/** Choose once per launch. Late config responses must never replace a playing intro. */
export async function loadStartupVideoUrl(
  apiBase: string,
  request: typeof fetch = fetch,
  timeoutMs = 1200,
): Promise<string | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await request(`${apiBase}/api/app-config`, { signal: controller.signal });
        if (!response.ok) throw new Error(`App config HTTP ${response.status}`);
        const config = await response.json();
        const value = config?.splashVideoUrl;
        return typeof value === "string" && value.trim() ? value.trim() : null;
      })(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs);
      }),
    ]);
  } catch (error) {
    console.warn("[SplashOverlay] config unavailable; using bundled intro");
    return null;
  } finally {
    clearTimeout(timer);
  }
}