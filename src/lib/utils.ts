export { cn } from "cn"

export function formatDate(dateVal: string | Date | number | null | undefined): string {
  if (!dateVal) return "";
  try {
    if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [y, m, d] = dateVal.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(dateVal);
  }
}

export function formatDateTime(dateVal: string | Date | number | null | undefined): string {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(dateVal);
  }
}

export function formatTime(dateVal: string | Date | number | null | undefined): string {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(dateVal);
  }
}
