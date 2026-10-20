function plainText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

module.exports = { plainText };
