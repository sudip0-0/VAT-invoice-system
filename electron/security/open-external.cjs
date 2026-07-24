function isAllowedExternalUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

module.exports = { isAllowedExternalUrl };
