export const supplyLabel = (value: {
  supplyId: string;
  supplyNumber?: string;
}) => value.supplyNumber || "ID " + value.supplyId;
export const dateLabel = (value: string, withSeconds = false) =>
  new Date(value).toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: withSeconds ? "medium" : "short",
  });
const unitLabels = new Map([
  ["pcs", "шт."],
  ["g", "г"],
  ["kg", "кг"],
  ["ml", "мл"],
  ["l", "л"],
]);
export const unitLabel = (unit: string) => unitLabels.get(unit) || unit;
