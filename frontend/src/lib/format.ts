const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
export const money = (n: number) => inr.format(n);
export const num = (n: number) => new Intl.NumberFormat("en-IN").format(n);
export const compactMoney = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${n}`;
export const minsAgo = (ts: number) => Math.max(0, Math.round((Date.now() - ts) / 60000));
