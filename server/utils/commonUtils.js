const { CHEMICAL_MAP } = require('../constants');



const normalMap = Object.fromEntries(
  Object.entries(CHEMICAL_MAP).map(([key, value]) => [value, key])
);

const createRegex = (map) => new RegExp(
  Object.keys(map)
    .sort((a, b) => b.length - a.length)
    .map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g'
);

const chemicalRegex = createRegex(CHEMICAL_MAP);
const normalRegex = createRegex(normalMap);

/**
 * 格式化化學式，支援一般文字與上下標格式雙向轉換。
 * @param {string} text - 原始化學式
 * @param {'subscript'|'normal'} mode - 轉換模式，預設為 subscript
 * @returns {string|null} 轉換後的化學式
 */
function formatChemicalFormula(text, mode = 'subscript') {
  if (!text) return null;

  const map = mode === 'normal' ? normalMap : CHEMICAL_MAP;
  const regex = mode === 'normal' ? normalRegex : chemicalRegex;

  return text.replace(regex, (match) => map[match]);
}



/**
 * 將數字無條件捨去至指定小數位數。
 * @param {number|string} value - 原始數值
 * @param {number} decimalPlaces - 小數位數，預設 1
 * @param {boolean} asString - 是否回傳字串，預設 false
 */
function formatTruncateDecimal(value, decimalPlaces = 1, asString = false) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string' && !value.trim()) return null;

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return typeof value === 'string' ? value.trim() : null;
  }

  const places = Number.isInteger(decimalPlaces) && decimalPlaces >= 0
    ? decimalPlaces
    : 1;

  const multiplier = 10 ** places;
  const truncated = Math.trunc(number * multiplier) / multiplier;

  return asString ? truncated.toFixed(places) : truncated;
}



/**
 * 將日期轉換為指定格式。
 * @param {Date|string|number} value - 日期
 * @param {string} format - 日期格式，預設 yyyy-MM-dd
 * @param {boolean} utc - 是否使用 UTC 時間，預設 true
 * @returns {string} 格式化日期，無效日期回傳空字串
 */
const formatDate = (value, format = 'yyyy-MM-dd', utc = true) => {
  if (value == null || value === '') return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const get = (name) => date[utc ? `getUTC${name}` : `get${name}`]();

  const values = {
    yyyy: get('FullYear'),
    MM: String(get('Month') + 1).padStart(2, '0'),
    dd: String(get('Date')).padStart(2, '0'),
    HH: String(get('Hours')).padStart(2, '0'),
    mm: String(get('Minutes')).padStart(2, '0'),
    ss: String(get('Seconds')).padStart(2, '0'),
  };

  return format.replace(/yyyy|MM|dd|HH|mm|ss/g, (key) => values[key]);
};


module.exports = {
  formatChemicalFormula,
  formatTruncateDecimal,
  formatDate
};
