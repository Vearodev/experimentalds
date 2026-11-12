/** Keep user-entered names literal when opened in a spreadsheet. */
export function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`;
}
