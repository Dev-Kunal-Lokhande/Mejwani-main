/**
 * Formats a numeric amount to INR (Indian Rupees) display currency format.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a Date object or ISO string into a readable time/date representation.
 */
export function formatDate(dateString: string | Date): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Truncates text if it exceeds a specified limit.
 */
export function truncateText(text: string, limit = 20): string {
  if (text.length <= limit) return text;
  return `${text.substring(0, limit)}...`;
}
