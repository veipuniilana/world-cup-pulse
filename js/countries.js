export const COUNTRY_LABELS = {
  PT: "Portugal",
  AR: "Argentina",
  BR: "Brazil",
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  GB: "England",
  US: "USA",
  MA: "Morocco",
  JP: "Japan"
};

export function countryName(code) {
  return COUNTRY_LABELS[code] || code || "Unknown";
}

export function flagEmoji(code) {
  if (!code || code.length !== 2) return "🏳️";
  const chars = code.toUpperCase().split("");
  return String.fromCodePoint(...chars.map((c) => 127397 + c.charCodeAt()));
}
