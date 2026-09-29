import PDFDocument from "pdfkit";
import QRCode from "qrcode";

type DocumentItem = {
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedSize?: string | null;
  selectedExtras?: string | null;
};

export type OrderDocumentData = {
  id: number;
  reference: string | null;
  restaurantName: string;
  userName: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  vatRate: number;
  vatAmount: number;
  serviceFee: number;
  refundedAmount: number;
  total: number;
  currency: string;
  deliveryAddress: string;
  notes: string | null;
  kitchenCode: string | null;
  pickupCode: string | null;
  paymentMethod: string;
  createdAt: Date | string;
  items: DocumentItem[];
};

export type RestaurantDocumentData = {
  name: string;
  address: string;
  phone: string | null;
  ice: string | null;
};

type DocumentKind = "invoice" | "receipt";

const MAGENTA = "#d42a72";
const NAVY = "#0a1b3d";
const MUTED = "#64748b";

function money(value: unknown, currency = "MAD"): string {
  return `${Number(value ?? 0).toFixed(2)} ${currency}`;
}

function orderReference(order: OrderDocumentData): string {
  return order.reference || `#CMD${String(order.id).padStart(6, "0")}`;
}

export function documentFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "commande";
}

function itemDetails(item: DocumentItem): string {
  let extras = item.selectedExtras || "";
  if (extras) {
    try {
      const values: unknown = JSON.parse(extras);
      if (Array.isArray(values)) extras = values.filter((value): value is string => typeof value === "string").join(", ");
    } catch {
      // Older orders may store extras as plain text.
    }
  }
  const details = [
    item.selectedSize ? `Taille: ${item.selectedSize}` : "",
    extras
      ? `Extras: ${extras}`
      : "",
  ].filter(Boolean);
  return details.join(" · ");
}

function qrPayload(order: OrderDocumentData): string {
  // Do not put the customer's delivery code or personal address in the QR.
  // The ticket only needs a safe, scan-friendly order identity.
  return [
    "JATEK",
    "ORDER",
    order.id,
    orderReference(order),
    order.kitchenCode || "",
  ].join("|");
}

function writeWrappedText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options?: PDFKit.Mixins.TextOptions,
): number {
  doc.text(text, x, y, { width, ...options });
  return doc.y;
}

export async function createOrderPdf(
  order: OrderDocumentData,
  restaurant: RestaurantDocumentData,
  kind: DocumentKind,
): Promise<Buffer> {
  const isReceipt = kind === "receipt";
  const doc = new PDFDocument(
    isReceipt
      ? {
          size: [226.77, 720],
          margins: { top: 18, bottom: 18, left: 16, right: 16 },
          info: { Title: `Ticket ${orderReference(order)}`, Author: "Jatek" },
        }
      : {
          size: "A4",
          margins: { top: 42, bottom: 42, left: 42, right: 42 },
          info: { Title: `Facture ${orderReference(order)}`, Author: "Jatek" },
        },
  );

  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const qr = await QRCode.toBuffer(qrPayload(order), {
    type: "png",
    width: isReceipt ? 108 : 132,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const issued = new Date(order.createdAt).toLocaleString("fr-FR");
  const reference = orderReference(order);

  if (isReceipt) {
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(15).text(restaurant.name, {
      align: "center",
    });
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(restaurant.address, {
      align: "center",
    });
    if (restaurant.phone) doc.text(restaurant.phone, { align: "center" });
    doc.moveDown(0.5);
    doc.strokeColor("#999").dash(2, { space: 2 }).moveTo(16, doc.y).lineTo(211, doc.y).stroke();
    doc.undash();
    doc.moveDown(0.5);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(reference, { align: "center" });
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(issued, { align: "center" });
    doc.moveDown(0.5);

    const qrX = (226.77 - 108) / 2;
    doc.image(qr, qrX, doc.y, { width: 108, height: 108 });
    doc.y += 112;
    doc.fillColor(MUTED).fontSize(7).text("Scanner pour identifier la commande", { align: "center" });
    doc.moveDown(0.6);

    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(24).text(order.kitchenCode || "—", {
      align: "center",
      characterSpacing: 3,
    });
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("CODE CUISINE", { align: "center" });
    doc.moveDown(0.8);
    doc.fillColor(NAVY).fontSize(9).text(`Client: ${order.userName}`);
    doc.fillColor(MUTED).fontSize(8).text(order.deliveryAddress);
    if (order.notes) doc.text(`Note: ${order.notes}`);
    doc.moveDown(0.5);

    for (const item of order.items) {
      const detail = itemDetails(item);
      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8).text(
        `${item.quantity}× ${item.menuItemName}`,
        { continued: true },
      );
      doc.font("Helvetica").text(money(item.totalPrice, order.currency), { align: "right" });
      if (detail) doc.fillColor(MUTED).fontSize(7).text(detail);
    }

    doc.moveDown(0.6);
    doc.strokeColor("#999").dash(2, { space: 2 }).moveTo(16, doc.y).lineTo(211, doc.y).stroke();
    doc.undash();
    doc.moveDown(0.4);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("TOTAL", { continued: true });
    doc.text(money(order.total, order.currency), { align: "right" });
    doc.moveDown(0.8);
    doc.fillColor(MUTED).font("Helvetica").fontSize(7).text(
      "Ticket restaurant Jatek · conserver pour le suivi de la commande",
      { align: "center" },
    );
  } else {
    doc.fillColor(MAGENTA).font("Helvetica-Bold").fontSize(28).text("Jatek");
    doc.fillColor(MUTED).font("Helvetica").fontSize(10).text("Facture officielle");
    doc.image(qr, 420, 42, { width: 132, height: 132 });
    doc.fillColor(MUTED).fontSize(8).text("QR commande", 420, 178, { width: 132, align: "center" });

    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(18).text("FACTURE", 360, 208, {
      width: 193,
      align: "right",
    });
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(
      `N° ${reference}\nDate: ${issued}\nStatut: ${order.status}`,
      360,
      232,
      { width: 193, align: "right", lineGap: 4 },
    );
    doc.strokeColor(MAGENTA).lineWidth(2).moveTo(42, 195).lineTo(553, 195).stroke();

    let y = 222;
    const boxWidth = 245;
    doc.roundedRect(42, y, boxWidth, 80, 8).fill("#f8fafc");
    doc.roundedRect(308, y, boxWidth, 80, 8).fill("#f8fafc");
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("VENDEUR", 56, y + 14);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10).text(restaurant.name, 56, y + 29, { width: 215 });
    doc.font("Helvetica").fontSize(8).text(restaurant.address, 56, y + 46, { width: 215 });
    if (restaurant.phone) doc.text(restaurant.phone, 56, y + 61);
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("CLIENT", 322, y + 14);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10).text(order.userName, 322, y + 29, { width: 215 });
    doc.font("Helvetica").fontSize(8).text(order.deliveryAddress, 322, y + 46, { width: 215 });
    y += 108;

    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("PAIEMENT", 42, y);
    doc.fillColor(NAVY).font("Helvetica").fontSize(9).text(
      order.paymentMethod === "cash" ? "Espèces" : order.paymentMethod === "card" ? "Carte bancaire" : order.paymentMethod,
      42,
      y + 14,
    );
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("CODE CUISINE", 210, y);
    doc.fillColor(NAVY).font("Helvetica").fontSize(9).text(order.kitchenCode || "—", 210, y + 14);
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("RÉFÉRENCE", 378, y);
    doc.fillColor(NAVY).font("Helvetica").fontSize(9).text(reference, 378, y + 14);
    y += 45;

    doc.fillColor(NAVY).rect(42, y, 511, 24).fill();
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(8)
      .text("DESCRIPTION", 52, y + 8)
      .text("QTÉ", 345, y + 8, { width: 35, align: "center" })
      .text("P.U.", 395, y + 8, { width: 65, align: "right" })
      .text("TOTAL", 475, y + 8, { width: 65, align: "right" });
    y += 24;

    for (const item of order.items) {
      const detail = itemDetails(item);
      const rowHeight = detail ? 34 : 24;
      if (y + rowHeight > 690) {
        doc.addPage();
        y = 42;
      }
      doc.fillColor(NAVY).font("Helvetica").fontSize(9).text(item.menuItemName, 52, y + 8, { width: 275 });
      if (detail) doc.fillColor(MUTED).fontSize(7).text(detail, 52, y + 20, { width: 275 });
      doc.fillColor(NAVY).fontSize(9).text(String(item.quantity), 345, y + 8, { width: 35, align: "center" });
      doc.text(money(item.unitPrice, order.currency), 395, y + 8, { width: 65, align: "right" });
      doc.text(money(item.totalPrice, order.currency), 475, y + 8, { width: 65, align: "right" });
      doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(42, y + rowHeight).lineTo(553, y + rowHeight).stroke();
      y += rowHeight;
    }

    y += 20;
    const totalsX = 335;
    const totalRow = (label: string, value: string, strong = false) => {
      doc.fillColor(strong ? MAGENTA : MUTED).font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 13 : 9)
        .text(label, totalsX, y, { width: 105 })
        .text(value, 450, y, { width: 103, align: "right" });
      y += strong ? 25 : 17;
    };
    totalRow("Sous-total", money(order.subtotal, order.currency));
    if (order.discountAmount > 0) totalRow("Remise", `-${money(order.discountAmount, order.currency)}`);
    totalRow("Livraison", money(order.deliveryFee, order.currency));
    if (order.vatAmount > 0) totalRow(`TVA (${order.vatRate} %)`, money(order.vatAmount, order.currency));
    if (order.serviceFee > 0) totalRow("Frais de service", money(order.serviceFee, order.currency));
    if (order.refundedAmount > 0) totalRow("Remboursé", `-${money(order.refundedAmount, order.currency)}`);
    doc.strokeColor(NAVY).lineWidth(1.5).moveTo(totalsX, y - 5).lineTo(553, y - 5).stroke();
    totalRow("TOTAL TTC", money(order.total, order.currency), true);

    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(
      "Merci pour votre commande — Jatek SAS\nCette facture a été générée automatiquement et ne nécessite pas de signature.",
      42,
      760,
      { width: 511, align: "center", lineGap: 4 },
    );
  }

  doc.end();
  return output;
}