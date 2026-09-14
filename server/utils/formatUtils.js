/** 將含 Unicode 下標的常見化學式轉為一般文字。 */
function formatNormalizeChemicalFormula(text) {
  if (!text) return null;

  return text
    .replace(/SO₂/g, 'SO2')
    .replace(/NH₃/g, 'NH3')
    .replace(/PM₁₀/g, 'PM10')
    .replace(/PM₂\.₅/g, 'PM2.5')
    .replace(/H₂S/g, 'H2S')
    .replace(/NO₂/g, 'NO2')
    .replace(/O₃/g, 'O3');
}

/** 將一般文字的常見化學式與單位轉為 Unicode 上下標格式。 */
function formatChemicalSubscript(text) {
  if (!text) return null;

  return text
    .replace(/SO2/g, 'SO₂')
    .replace(/NH3/g, 'NH₃')
    .replace(/PM10/g, 'PM₁₀')
    .replace(/PM2\.5/g, 'PM₂.₅')
    .replace(/H2S/g, 'H₂S')
    .replace(/NO2/g, 'NO₂')
    .replace(/O3/g, 'O₃')
    .replace(/ug\/m3/g, 'μg/m³');
}

/** 以無條件捨去方式保留一位小數，並回傳字串。 */
function formatFixedOneDecimal(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    if (trimmed === '-' || trimmed === '—') return trimmed;
    const number = Number(trimmed);
    return Number.isFinite(number) ? (Math.trunc(number * 10) / 10).toFixed(1) : trimmed;
  }

  const number = Number(value);
  return Number.isFinite(number) ? (Math.trunc(number * 10) / 10).toFixed(1) : null;
}

/** 將數字無條件捨去至指定小數位數（預設一位），非數字則原樣回傳。 */
function formatTruncateOneDecimal(value, decimalPlaces = 1) {
  if (typeof value !== 'number') return value;

  const places = Number.isInteger(decimalPlaces) && decimalPlaces >= 0
    ? decimalPlaces
    : 1;
  const multiplier = 10 ** places;

  return value >= 0
    ? Math.floor(value * multiplier) / multiplier
    : Math.ceil(value * multiplier) / multiplier;
}

module.exports = {
  formatChemicalSubscript,
  formatFixedOneDecimal,
  formatNormalizeChemicalFormula,
  formatTruncateOneDecimal,
};
