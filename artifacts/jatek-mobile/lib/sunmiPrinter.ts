import { DeviceEventEmitter, NativeModules, Platform } from "react-native";

export type SunmiPrinterState =
  | "unavailable"
  | "connecting"
  | "ready"
  | "printing"
  | "paper_out"
  | "paper_error"
  | "overheated"
  | "cover_open"
  | "offline"
  | "disconnected"
  | "error";

export type SunmiPrinterStatus = {
  state: SunmiPrinterState;
  message?: string | null;
  connected: boolean;
};

type SunmiPrinterNativeModule = {
  connect(): Promise<SunmiPrinterStatus>;
  disconnect(): Promise<SunmiPrinterStatus>;
  getStatus(): Promise<SunmiPrinterStatus>;
  printText(text: string): Promise<SunmiPrinterStatus>;
  printReceipt(receipt: SunmiReceipt): Promise<SunmiPrinterStatus>;
};

export type SunmiReceiptItem = {
  quantity: number;
  menuItemName: string;
  totalPrice: number;
};

export type SunmiReceipt = {
  restaurantName: string;
  address?: string | null;
  phone?: string | null;
  ice?: string | null;
  reference: string;
  createdAt?: string | null;
  kitchenCode?: string | null;
  userName?: string | null;
  deliveryAddress?: string | null;
  notes?: string | null;
  items: SunmiReceiptItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
};

const nativeModule = NativeModules.JatekSunmiPrinter as SunmiPrinterNativeModule | undefined;
let printQueue: Promise<SunmiPrinterStatus> = Promise.resolve({
  state: "ready",
  connected: true,
});

export function isSunmiPrinterAvailable(): boolean {
  return Platform.OS === "android" && Boolean(nativeModule);
}

const unavailableStatus: SunmiPrinterStatus = {
  state: "unavailable",
  connected: false,
  message: Platform.OS === "web"
    ? "Le pont Android Sunmi n’est pas disponible dans le navigateur."
    : "Le pont Sunmi n’est pas inclus dans cette version.",
};

export async function connectSunmiPrinter(): Promise<SunmiPrinterStatus> {
  if (!isSunmiPrinterAvailable()) return unavailableStatus;
  return nativeModule!.connect();
}

export async function getSunmiPrinterStatus(): Promise<SunmiPrinterStatus> {
  if (!isSunmiPrinterAvailable()) return unavailableStatus;
  return nativeModule!.getStatus();
}

export async function disconnectSunmiPrinter(): Promise<SunmiPrinterStatus> {
  if (!isSunmiPrinterAvailable()) return unavailableStatus;
  return nativeModule!.disconnect();
}

export async function printSunmiText(text: string): Promise<SunmiPrinterStatus> {
  if (!isSunmiPrinterAvailable()) throw new Error(unavailableStatus.message ?? "Pont Sunmi indisponible");
  return nativeModule!.printText(text);
}

export async function printSunmiReceipt(receipt: SunmiReceipt): Promise<SunmiPrinterStatus> {
  if (!isSunmiPrinterAvailable()) throw new Error(unavailableStatus.message ?? "Pont Sunmi indisponible");
  const printJob = printQueue.catch(() => unavailableStatus).then(async () => {
    await connectSunmiPrinter();
    return nativeModule!.printReceipt(receipt);
  });
  printQueue = printJob;
  return printJob;
}

export function subscribeSunmiPrinterStatus(listener: (status: SunmiPrinterStatus) => void): { remove: () => void } {
  if (!isSunmiPrinterAvailable()) return { remove: () => undefined };
  return DeviceEventEmitter.addListener("jatekSunmiPrinterStatus", listener);
}