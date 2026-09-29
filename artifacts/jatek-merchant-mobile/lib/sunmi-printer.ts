import { Platform } from 'react-native';
import * as SunmiPrinter from '@mitsuharu/react-native-sunmi-printer-library';
import type { OrderDetail } from '@/lib/api-core';
import { dateTime, money, parseExtras } from '@/lib/format';

type Alignment = 'left' | 'center' | 'right';
type PrintLine = { text: string; size?: number; bold?: boolean; align?: Alignment };

function assertSunmiPlatform() {
  if (Platform.OS !== 'android') {
    throw new Error('L’impression thermique est disponible uniquement sur un terminal SUNMI Android.');
  }
}

async function printTicket(lines: PrintLine[]) {
  assertSunmiPlatform();
  await SunmiPrinter.prepare();
  await SunmiPrinter.enterPrinterBuffer(true);
  try {
    for (const line of lines) {
      await SunmiPrinter.setAlignment(line.align ?? 'left');
      await SunmiPrinter.setFontSize(line.size ?? 24);
      await SunmiPrinter.setTextStyle('bold', line.bold ?? false);
      await SunmiPrinter.printText(`${line.text}\n`);
    }
    await SunmiPrinter.setTextStyle('bold', false);
    await SunmiPrinter.setFontSize(24);
    await SunmiPrinter.setAlignment('left');
    await SunmiPrinter.lineWrap(4);
    await SunmiPrinter.exitPrinterBuffer(true);
  } catch (error) {
    try { await SunmiPrinter.exitPrinterBuffer(false); } catch { /* preserve the original printer error */ }
    throw error;
  }
}

function orderHeading(order: OrderDetail) {
  const reference = order.reference || String(order.id);
  return `COMMANDE #${reference}`;
}

export async function printKitchenTicket(order: OrderDetail) {
  const items: PrintLine[] = order.items.flatMap((item) => {
    const extras = parseExtras(item.selectedExtras);
    return [
      { text: `${item.quantity} × ${item.menuItemName}`, size: 28, bold: true },
      ...(item.selectedSize ? [{ text: `Taille : ${item.selectedSize}` }] : []),
      ...(extras.length ? [{ text: `Suppléments : ${extras.join(', ')}` }] : []),
    ];
  });

  await printTicket([
    { text: order.restaurantName || 'JATEK', size: 26, bold: true, align: 'center' },
    { text: 'TICKET CUISINE', size: 24, bold: true, align: 'center' },
    { text: orderHeading(order), size: 25, bold: true, align: 'center' },
    { text: order.kitchenCode || '----', size: 56, bold: true, align: 'center' },
    { text: dateTime(order.createdAt), size: 20, align: 'center' },
    { text: '--------------------------------', size: 20 },
    ...items,
    ...(order.notes ? [{ text: `NOTE : ${order.notes}`, size: 24, bold: true }] : []),
    { text: '--------------------------------', size: 20 },
    { text: 'SANS PRIX — PRÉPARATION CUISINE', size: 18, bold: true, align: 'center' },
  ]);
}

export async function printOrderReceipt(order: OrderDetail) {
  const items: PrintLine[] = order.items.flatMap((item) => {
    const extras = parseExtras(item.selectedExtras);
    return [
      { text: `${item.quantity} × ${item.menuItemName}`, size: 26, bold: true },
      ...(item.selectedSize ? [{ text: `Taille : ${item.selectedSize}` }] : []),
      ...(extras.length ? [{ text: `Suppléments : ${extras.join(', ')}` }] : []),
      { text: `${money(item.unitPrice, order.currency)} × ${item.quantity} = ${money(item.totalPrice, order.currency)}`, size: 20, align: 'right' },
    ];
  });

  await printTicket([
    { text: order.restaurantName || 'JATEK', size: 26, bold: true, align: 'center' },
    { text: 'REÇU DE COMMANDE', size: 25, bold: true, align: 'center' },
    { text: orderHeading(order), size: 24, bold: true, align: 'center' },
    { text: dateTime(order.createdAt), size: 20, align: 'center' },
    { text: `Client : ${order.userName || '—'}`, size: 22 },
    ...(order.customerPhone ? [{ text: `Tél. client : ${order.customerPhone}` }] : []),
    ...(order.deliveryAddress ? [{ text: `Adresse : ${order.deliveryAddress}`, size: 22 }] : []),
    { text: '--------------------------------', size: 20 },
    ...items,
    ...(order.notes ? [{ text: `NOTE : ${order.notes}`, size: 22, bold: true }] : []),
    { text: '--------------------------------', size: 20 },
    { text: `Sous-total : ${money(order.subtotal, order.currency)}`, size: 21 },
    ...(order.deliveryFee ? [{ text: `Livraison : ${money(order.deliveryFee, order.currency)}`, size: 21 }] : []),
    ...(order.serviceFee ? [{ text: `Frais de service : ${money(order.serviceFee, order.currency)}`, size: 21 }] : []),
    ...(order.discountAmount ? [{ text: `Remise : -${money(order.discountAmount, order.currency)}`, size: 21 }] : []),
    { text: `TOTAL : ${money(order.total, order.currency)}`, size: 30, bold: true, align: 'center' },
  ]);
}

export async function printCourierTicket(order: OrderDetail) {
  const items: PrintLine[] = order.items.flatMap((item) => {
    const extras = parseExtras(item.selectedExtras);
    return [
      { text: `${item.quantity} × ${item.menuItemName}`, size: 25, bold: true },
      ...(item.selectedSize ? [{ text: `Taille : ${item.selectedSize}` }] : []),
      ...(extras.length ? [{ text: `Suppléments : ${extras.join(', ')}` }] : []),
    ];
  });

  await printTicket([
    { text: 'TICKET LIVREUR', size: 28, bold: true, align: 'center' },
    { text: orderHeading(order), size: 26, bold: true, align: 'center' },
    { text: order.restaurantName || 'Boutique Jatek', size: 23, bold: true },
    ...(order.restaurantPhone ? [{ text: `Tél. boutique : ${order.restaurantPhone}` }] : []),
    { text: `Client : ${order.userName || '—'}`, size: 23 },
    ...(order.customerPhone ? [{ text: `Tél. client : ${order.customerPhone}` }] : []),
    { text: `Adresse : ${order.deliveryAddress || '—'}`, size: 23, bold: true },
    { text: dateTime(order.createdAt), size: 20 },
    { text: '--------------------------------', size: 20 },
    ...items,
    ...(order.notes ? [{ text: `NOTE : ${order.notes}`, size: 22, bold: true }] : []),
    { text: '--------------------------------', size: 20 },
    { text: `TOTAL : ${money(order.total, 'MAD')}`, size: 30, bold: true, align: 'center' },
  ]);
}

/** App-facing adapter around the native SUNMI printer library. */
export const SunmiInnerPrinter = {
  isSupported: Platform.OS === 'android',
  printKitchenTicket,
  printOrderReceipt,
  printCourierTicket,
};