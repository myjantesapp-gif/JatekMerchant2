export type NumericValue = number | string | null | undefined;

function toPlainDecimal(value: NumericValue): string {
  if (value == null) return "0";
  const raw = String(value).trim();
  if (!raw) return "0";

  const scientific = raw.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!scientific) {
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) ? raw : "0";
  }

  const [, sign, whole, fraction = "", exponentText] = scientific;
  const digits = whole + fraction;
  const decimalPosition = whole.length + Number(exponentText);
  if (decimalPosition <= 0) {
    return `${sign}0.${"0".repeat(-decimalPosition)}${digits}`;
  }
  if (decimalPosition >= digits.length) {
    return `${sign}${digits}${"0".repeat(decimalPosition - digits.length)}`;
  }
  return `${sign}${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
}

/** Display a received number exactly, without padding or rounding. */
export function formatExact(value: NumericValue): string {
  return toPlainDecimal(value);
}

/** Format a MAD amount without changing its precision. */
export function formatMad(value: NumericValue): string {
  return toPlainDecimal(value);
}

/** Add decimal amounts without floating-point rounding artifacts. */
export function addMoney(...values: NumericValue[]): string {
  const parts = values.map((value) => {
    const plain = toPlainDecimal(value);
    const negative = plain.startsWith("-");
    const unsigned = plain.replace(/^[+-]/, "");
    const [whole, fraction = ""] = unsigned.split(".");
    return {
      negative,
      digits: `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0",
      scale: fraction.length,
    };
  });
  const scale = Math.max(0, ...parts.map((part) => part.scale));
  const total = parts.reduce((sum, part) => {
    const amount = BigInt(part.digits) * 10n ** BigInt(scale - part.scale);
    return sum + (part.negative ? -amount : amount);
  }, 0n);

  const negative = total < 0n;
  const absolute = (negative ? -total : total).toString().padStart(scale + 1, "0");
  if (scale === 0) return `${negative ? "-" : ""}${absolute}`;

  const whole = absolute.slice(0, -scale);
  const fraction = absolute.slice(-scale).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}