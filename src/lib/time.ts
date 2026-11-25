export function formatUtc8(iso: string) {
  return (
    new Date(Date.parse(iso) + 8 * 3600_000)
      .toISOString()
      .slice(0, 16)
      .replace("T", " ") + " UTC+8"
  );
}
export function relativeAge(iso: string, now = Date.now()) {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + "m ago";
  if (minutes < 1440) return Math.floor(minutes / 60) + "h ago";
  return Math.floor(minutes / 1440) + "d ago";
}
