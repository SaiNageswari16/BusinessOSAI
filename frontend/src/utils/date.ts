/**
 * Formats any date string or Date object into DD-MM-YY format (e.g. 27-09-26).
 */
export function formatDateDDMMYY(dateInput?: string | Date | null): string {
  if (!dateInput) return 'No active plan';
  
  // If string is already in DD-MM-YY format (e.g. 27-09-26), return as is
  if (typeof dateInput === 'string' && /^\d{2}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return String(dateInput);
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

/**
 * Returns today's date formatted as YYYY-MM-DD for HTML date inputs.
 */
export function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds days to a date string (YYYY-MM-DD) and returns YYYY-MM-DD.
 */
export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO || Date.now());
  if (isNaN(d.getTime())) return getTodayISO();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
