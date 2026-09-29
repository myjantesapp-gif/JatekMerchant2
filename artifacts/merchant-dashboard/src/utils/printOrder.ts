/**
 * Fetches the API's existing, isolated thermal-ticket HTML document and prints
 * it from a hidden iframe, never from the merchant dashboard DOM.
 */
export async function printThermalTicket(endpoint: string, token: string): Promise<void> {
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Le ticket n’a pas pu être préparé pour l’impression.');
  }

  const html = (await response.text()).replace(
    /(<body\b[^>]*?)\s+onload=(["'])[^"']*\2([^>]*>)/i,
    '$1$3',
  );
  const frame = document.createElement('iframe');
  frame.title = 'Aperçu du ticket de commande';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';

  await new Promise<void>((resolve, reject) => {
    let loaded = false;
    let settled = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      frame.remove();
      reject(new Error(message));
    };
    const timeoutId = window.setTimeout(() => fail('Le ticket a mis trop de temps à charger.'), 10_000);
    frame.onerror = () => fail('L’aperçu d’impression du ticket est indisponible.');
    frame.onload = () => {
      if (loaded) return;
      loaded = true;
      const printWindow = frame.contentWindow;
      if (!printWindow) {
        fail('L’aperçu d’impression du ticket est indisponible.');
        return;
      }
      window.setTimeout(() => {
        if (settled) return;
        try {
          printWindow.focus();
          printWindow.print();
          settled = true;
          window.clearTimeout(timeoutId);
          resolve();
          window.setTimeout(() => frame.remove(), 2000);
        } catch {
          fail('Le navigateur a empêché l’impression du ticket.');
        }
      }, 250);
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}