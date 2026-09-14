/** 將數值補成至少兩位字串。 */
function datePad2(value) {
  return String(value).padStart(2, '0');
}

/** 將 Date 格式化為本地時區的 YYYY-MM-DD 字串。 */
function dateFormatLocal(date) {
  return `${date.getFullYear()}-${datePad2(date.getMonth() + 1)}-${datePad2(date.getDate())}`;
}

/** 判斷兩個時間是否落在指定的毫秒容許範圍內。 */
function dateIsSameTime(source, target, toleranceMilliseconds = 10000) {
  return Math.abs(new Date(source).getTime() - new Date(target).getTime()) < toleranceMilliseconds;
}

/**
 * 統一日期時間格式
 *
 * 2026-09-01 08:35:22
 * → 2026-09-01T08:35:22
 *
 * 2026-09-01T08:35:22.000Z
 * → 2026-09-01T08:35:22
 *
 * 不做 +8 / -8 時區轉換
 */
const normalizeDateTime = (dateTime) => {
  if (!dateTime) return '';

  if (dateTime instanceof Date) {
    const year = dateTime.getFullYear();
    const month = datePad2(dateTime.getMonth() + 1);
    const day = datePad2(dateTime.getDate());
    const hour = datePad2(dateTime.getHours());
    const minute = datePad2(dateTime.getMinutes());
    const second = datePad2(dateTime.getSeconds());

    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }

  return String(dateTime)
    .trim()
    .replace(' ', 'T')
    .replace(/Z$/i, '')
    .replace(/\.\d+$/, '');
};


/**
 * 取得日期
 *
 * 2026-09-01T08:35:22
 * → 2026-09-01
 */
const getDatePart = (dateTime) => {
  return normalizeDateTime(dateTime).slice(0, 10);
};


/**
 * 取得小時 Key
 *
 * 2026-09-01T08:35:22
 * → 2026-09-01T08:00
 *
 * 適合 Map 比對使用
 */
const getHourKey = (dateTime) => {
  const value = normalizeDateTime(dateTime);

  if (!value) return '';

  const datePart = value.slice(0, 10);
  const hour = value.slice(11, 13) || '00';

  return `${datePart}T${hour}:00`;
};


/**
 * 轉成整點 ISO 顯示格式
 *
 * 2026-09-01 08:35:22
 * → 2026-09-01T08:00:00.000Z
 *
 * 注意：
 * 這裡的 Z 只是輸出格式，
 * 不進行 UTC 時區轉換。
 */
const formatToHourISO = (dateTime) => {
  const value = normalizeDateTime(dateTime);

  if (!value) return '';

  const datePart = value.slice(0, 10);
  const hour = value.slice(11, 13) || '00';

  return `${datePart}T${hour}:00:00.000Z`;
};


/**
 * 轉成每日 00:00 ISO 顯示格式
 *
 * 2026-09-01 15:30:00
 * → 2026-09-01T00:00:00.000Z
 *
 * 不做時區轉換
 */
const formatToDayISO = (dateTime) => {
  const datePart = getDatePart(dateTime);

  if (!datePart) return '';

  return `${datePart}T00:00:00.000Z`;
};


/**
 * 轉成 SQL DateTime 字串格式
 *
 * 2026-09-01T08:35:22.000Z
 * → 2026-09-01 08:35:22
 *
 * 不做時區轉換
 */
const formatToSqlDateTime = (dateTime) => {
  const value = normalizeDateTime(dateTime);

  if (!value) return '';

  return value.replace('T', ' ');
};



module.exports = {
  dateFormatLocal,
  dateIsSameTime,
  datePad2,
  getDatePart,
  getHourKey,
  formatToHourISO,
  formatToDayISO,
  formatToSqlDateTime,
};
