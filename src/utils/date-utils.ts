// Force English locale for date inputs
export function forceEnglishLocale() {
  // Override the browser's locale for date inputs
  const originalToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function(locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
    return originalToLocaleDateString.call(this, 'en-US', options);
  };

  // Override Intl.DateTimeFormat to use English
  const originalDateTimeFormat = Intl.DateTimeFormat;
  (Intl as any).DateTimeFormat = function(locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
    return new originalDateTimeFormat('en-US', options);
  };
}

// Format date to DD/MM/YYYY format
export function formatDate(date: string | Date): string {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Parse date from DD/MM/YYYY format
export function parseDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  // Handle DD/MM/YYYY format
  const parts = dateString.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
      return date;
    }
  }
  
  // Try parsing as ISO string
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  return null;
}

// Convert date to YYYY-MM-DD format for input[type="date"]
export function toDateInputValue(date: string | Date): string {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return d.toISOString().split('T')[0];
} 