// 以日期、前綴與流水號組成的識別碼
function idGenerateDateSequence(
  latestId,
  {
    date = new Date(),
    prefix = '',
    includeDay = true,
    sequenceLength = 4,
  } = {},
) {
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    includeDay ? String(date.getDate()).padStart(2, '0') : '',
  ].join('');
  const baseId = `${prefix}${datePart}`;
  const latestIdText = latestId == null ? '' : String(latestId);
  const latestSequence = Number(latestIdText.slice(-sequenceLength));
  const sequence =
    latestIdText.startsWith(baseId) && Number.isInteger(latestSequence)
      ? latestSequence + 1
      : 1;

  return `${baseId}${String(sequence).padStart(sequenceLength, '0')}`;
}


// 以前綴、年月及四位流水號組成的識別碼
function idGenerateMonthlySequence(latestId = null, prefix = '') {
  return idGenerateDateSequence(latestId, { prefix, includeDay: false });
}

module.exports = { idGenerateDateSequence, idGenerateMonthlySequence };
