const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getConnection } = require('../db/pool');
const { verifyToken } = require('../middleware/authMiddleware');
const { 
  datePad2,
  getDatePart,
  getHourKey,
  formatToHourISO,
  formatToDayISO,
  formatToSqlDateTime,
} = require('../utils/dateUtils');
const {
  formatChemicalSubscript,
  formatFixedOneDecimal,
  formatNormalizeChemicalFormula,
  formatTruncateOneDecimal,
} = require('../utils/formatUtils');
const { buildBoxplots, parseBoxplotOptions } = require('../utils/boxplotUtils');
const { buildHeatmaps } = require('../utils/heatmapUtils');
const { buildWindRose } = require('../utils/windRoseUtils');
const { buildWindVector } = require('../utils/windVectorUtils');

const EPA_MODELS = [
  { value: 'SO2', name: '二氧化硫', label: '二氧化硫 SO₂ (ppm)', unit: 'ppm' },
  { value: 'NO', name: '一氧化氮', label: '一氧化氮 NO (ppm)', unit: 'ppm' },
  { value: 'NO2', name: '二氧化氮', label: '二氧化氮 NO₂ (ppm)', unit: 'ppm' },
  { value: 'NOx', name: '氮氧化物', label: '氮氧化物 NOₓ (ppm)', unit: 'ppm' },
  { value: 'CO', name: '一氧化碳', label: '一氧化碳 CO (ppm)', unit: 'ppm' },
  { value: 'O3', name: '臭氧', label: '臭氧 O₃ (ppm)', unit: 'ppm' },
  { value: 'CO2', name: '二氧化碳', label: '二氧化碳 CO₂ (ppm)', unit: 'ppm' },
  { value: 'CH4', name: '甲烷', label: '甲烷 CH₄ (ppm)', unit: 'ppm' },
  { value: 'NMHC', name: '非甲烷碳氫化合物', label: '非甲烷碳氫化合物 NMHC (ppm)', unit: 'ppm' },
  { value: 'THC', name: '總碳氫化合物', label: '總碳氫化合物 THC (ppm)', unit: 'ppm' },
  { value: 'PM10', name: '懸浮微粒', label: '懸浮微粒 PM₁₀ (μg/m³)', unit: 'μg/m³' },
  { value: 'PM25', name: '細懸浮微粒', label: '細懸浮微粒 PM₂.₅ (μg/m³)', unit: 'μg/m³' },
  { value: 'WS', name: '風速', label: '風速 WS (m/s)', unit: 'm/s' },
  { value: 'WD', name: '風向', label: '風向 WD (degrees)', unit: 'degrees' },
  { value: 'AMB_TEMP', name: '環境溫度', label: '環境溫度 TMP (°C)', unit: '°C' },
  { value: 'SHELT_TEMP', name: '測站溫度', label: '測站溫度 TMP (°C)', unit: '°C' },
  { value: 'RH', name: '相對濕度', label: '相對濕度 RH (%)', unit: '%' },
  { value: 'PRESSURE', name: '大氣壓力', label: '大氣壓力 PRES (hPa)', unit: 'hPa' },
  { value: 'UVB', name: '紫外線', label: '紫外線 UVB (UVI)', unit: 'UVI' },
  { value: 'RAINFALL', name: '雨量', label: '雨量 RF (mm)', unit: 'mm' },
  { value: 'RAIN_INT', name: '降雨強度', label: '降雨強度 RAIN_INT (mm/hr)', unit: 'mm/hr' },
  { value: 'PH_RAIN', name: '酸雨', label: '酸雨 pH', unit: '' },
  { value: 'RAIN_COND', name: '雨水導電度', label: '雨水導電度 RAIN_COND (μS/cm)', unit: 'μS/cm' },
  { value: 'WST10Vct', name: '10 分鐘平均風速', label: '10 分鐘平均風速 (m/s)', unit: 'm/s' },
  { value: 'WDT10Vct', name: '10 分鐘平均風向', label: '10 分鐘平均風向 (degrees)', unit: 'degrees' },
  { value: 'O3h8', name: '臭氧 8 小時平均', label: '臭氧 8 小時平均 (ppm)', unit: 'ppm' },
  { value: 'PM25h24', name: 'PM2.5 24 小時移動平均', label: 'PM2.5 24 小時移動平均 (μg/m³)', unit: 'μg/m³' },
  { value: 'PM10h24', name: 'PM10 24 小時移動平均', label: 'PM10 24 小時移動平均 (μg/m³)', unit: 'μg/m³' },
  { value: 'PSI', name: 'PSI', label: '空氣污染指標 PSI', unit: '' },
  { value: 'AQI', name: 'AQI', label: '空氣品質指標 AQI', unit: '' },
];

// Dashboard
router.post('/stations/dashboard/realtime', verifyToken, async (req, res) => {
  const { PJID, STID, type = 'T01' } = req.body;
  const { role } = req.user;

  if (!PJID || !STID) {
    return res.status(400).json({
      success: false,
      message: 'PJID 與 STID 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const realtimeType = ['T01', 'T05', 'T60'].includes(type) ? type : 'T01';

    const query = `
      SELECT B.*
      FROM [AIOT].[dbo].[ctrlStation] A
      INNER JOIN [AIOT].[dbo].[cfgModel] B
        ON A.Model = B.Model
      WHERE A.ProjID = @PJID
        AND A.STID = @STID
    `;
    const result = await aiotDb
      .request()
      .input('PJID', sql.VarChar, PJID)
      .input('STID', sql.VarChar, STID)
      .query(query);

    const modelRow = result.recordset[0] || {};

    const models = Array.from( { length: 8 }, (_, offset) => offset + 1 ).flatMap((index) => {
      const name = formatChemicalSubscript(modelRow['ParName' + index]);

      if (!name) return [];

      const valueModel = {
        value: 'Value' + index,
        name,
        label: modelRow['ParUnit' + index]
          ? `${name} (${modelRow['ParUnit' + index]})`
          : name,
        unit: modelRow['ParUnit' + index] || '',
      };

      const countModel = {
        value: 'Count' + index,
        name: name + ' Count',
        label: name + ' Count',
        unit: '',
      };

      return role === 'ERP'
        ? [valueModel, countModel]
        : [valueModel];
    });

    // 各資料類型的時間間隔
    const intervalMs = {
      T01: 1 * 60 * 1000,
      T05: 5 * 60 * 1000,
      T60: 60 * 60 * 1000,
    }[realtimeType];

    const now = new Date();
    const endDateTime = new Date(now);

    if (realtimeType === 'T01') {
      endDateTime.setSeconds(0, 0);
    } else if (realtimeType === 'T05') {
      endDateTime.setMinutes( Math.floor(endDateTime.getMinutes() / 5) * 5, 0, 0 );
    } else if (realtimeType === 'T60') {
      endDateTime.setMinutes(0, 0, 0);
    }

    endDateTime.setTime( endDateTime.getTime() - intervalMs );

    const startDateTime = new Date( endDateTime.getTime() - intervalMs * 4 );
    const toLocalISO = (date) => new Date( date.getTime() - date.getTimezoneOffset() * 60000 ).toISOString().slice(0, -1);
    const startStr = toLocalISO(startDateTime);
    const endStr = toLocalISO(endDateTime);

    const query2 = `
      EXEC dbo.GetData
        @STID = @STID,
        @PROJID = @PJID,
        @FDATE = @startDateTime,
        @TDATE = @endDateTime,
        @TYPE = @type
    `;

    const result2 = await aiotDb
      .request()
      .input('STID', sql.VarChar, STID)
      .input('PJID', sql.VarChar, PJID)
      .input('startDateTime', sql.VarChar, startStr)
      .input('endDateTime', sql.VarChar, endStr)
      .input('type', sql.VarChar, realtimeType)
      .query(query2);

    const realtimeRows =
      role === 'ERP'
        ? result2.recordset
        : result2.recordset.map((sourceRow) =>
            Object.fromEntries(
              Object.entries(sourceRow).filter(
                ([key]) => !key.startsWith('Count')
              )
            )
          );
    const modelKeys = new Set(models.map(({ value }) => value));
    const realtime = realtimeRows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          modelKeys.has(key) ? formatTruncateOneDecimal(value) : value,
        ])
      )
    );

    return res.status(200).json({
      success: true,
      data: {
        models,
        realtime,
        realtimeType,
        isEPA: false,
      },
    });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.post('/stations/dashboard/line', verifyToken, async (req, res) => {
  const { PJID, STID, startDateTime, endDateTime, type } = req.body;
  const { role } = req.user;
  
  if (!PJID || !STID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'PJID、STID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');
      const query = `
        SELECT B.*
        FROM [AIOT].[dbo].[ctrlStation] A
        INNER JOIN [AIOT].[dbo].[cfgModel] B
          ON A.Model = B.Model
        WHERE A.ProjID = @PJID
          AND A.STID = @STID
      `;
      const result = await aiotDb
        .request()
        .input('PJID', sql.VarChar, PJID)
        .input('STID', sql.VarChar, STID)
        .query(query);

      const modelRow = result.recordset[0] || {};

      const models = Array.from( { length: 8 }, (_, offset) => offset + 1 ).flatMap((index) => {
        const name = formatChemicalSubscript(modelRow['ParName' + index]);

        if (!name) return [];

        const valueModel = {
          value: 'Value' + index,
          name,
          label: modelRow['ParUnit' + index]
            ? `${name} (${modelRow['ParUnit' + index]})`
            : name,
          unit: modelRow['ParUnit' + index] || '',
        };

        const countModel = {
          value: 'Count' + index,
          name: name + ' Count',
          label: name + ' Count',
          unit: '',
        };

        return role === 'ERP'
          ? [valueModel, countModel]
          : [valueModel];
      });

      const query2 = `
        EXEC dbo.GetData @STID=@STID, @PROJID=@PJID, @FDATE=@startDateTime, @TDATE=@endDateTime, @TYPE=@type
      `
      const result2 = await aiotDb.request()
        .input('STID', sql.VarChar, STID)
        .input('PJID', sql.VarChar, PJID)
        .input('startDateTime', sql.VarChar, startDateTime)
        .input('endDateTime', sql.VarChar, endDateTime)
        .input('type', sql.VarChar, type || 'T05')
        .query(query2);
      const rows = result2.recordset.filter((row) => {
        const date = new Date(row.Date_Time);
        return !Number.isNaN(date.getTime());
      }).sort(
        (left, right) =>
          new Date(left.Date_Time).getTime() - new Date(right.Date_Time).getTime(),
      );
      const decimalPlaces = String(PJID) === '200209' ? 2 : 1;
      const line = {};
      for (const model of models) line[model.value] = [];
      for (const row of rows) {
        const timestamp = new Date(row.Date_Time).getTime();
        for (const model of models) {
          const value = Number(row[model.value]);
          if (Number.isFinite(value)) {
            line[model.value].push([
              timestamp,
              formatTruncateOneDecimal(value, decimalPlaces),
            ]);
          }
        }
      }
      return res.status(200).json({
        success: true,
        data: { models, line, history: rows },
      });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.post('/stations/dashboard/boxplot', verifyToken, async (req, res) => {
  const { PJID, STID, startDateTime, endDateTime, type, box = {} } = req.body;
  const { role } = req.user;

  if (!PJID || !STID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'PJID、STID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }

  const boxplotOptions = parseBoxplotOptions(box);
  if (!boxplotOptions) {
    return res.status(400).json({
      success: false,
      message: '盒鬚圖設定不正確：時間分組需為 hour、day、week 或 month，且上下百分位需分別位於 0–50 與 50–100 之間。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');
      const query = `
        SELECT B.*
        FROM [AIOT].[dbo].[ctrlStation] A
        INNER JOIN [AIOT].[dbo].[cfgModel] B
          ON A.Model = B.Model
        WHERE A.ProjID = @PJID
          AND A.STID = @STID
      `;
      const result = await aiotDb
        .request()
        .input('PJID', sql.VarChar, PJID)
        .input('STID', sql.VarChar, STID)
        .query(query);

      const modelRow = result.recordset[0] || {};

      const models = Array.from( { length: 8 }, (_, offset) => offset + 1 ).flatMap((index) => {
        const name = formatChemicalSubscript(modelRow['ParName' + index]);

        if (!name) return [];

        const valueModel = {
          value: 'Value' + index,
          name,
          label: modelRow['ParUnit' + index]
            ? `${name} (${modelRow['ParUnit' + index]})`
            : name,
          unit: modelRow['ParUnit' + index] || '',
        };

        const countModel = {
          value: 'Count' + index,
          name: name + ' Count',
          label: name + ' Count',
          unit: '',
        };

        return role === 'ERP'
          ? [valueModel, countModel]
          : [valueModel];
      });
      const query2 = `
        EXEC dbo.GetData @STID=@STID, @PROJID=@PJID, @FDATE=@startDateTime, @TDATE=@endDateTime, @TYPE=@type
      `
      const result2 = await aiotDb.request()
        .input('STID', sql.VarChar, STID)
        .input('PJID', sql.VarChar, PJID)
        .input('startDateTime', sql.VarChar, startDateTime)
        .input('endDateTime', sql.VarChar, endDateTime)
        .input('type', sql.VarChar, type || 'T05')
        .query(query2);
      const boxplots = buildBoxplots(result2.recordset, models, boxplotOptions);
      return res.status(200).json({ 
        success: true, 
        data: { models, boxplots } 
      });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.post('/stations/dashboard/heatmap', verifyToken, async (req, res) => {
  const { PJID, STID, startDateTime, endDateTime, type } = req.body;
  const { role } = req.user;

  if (!PJID || !STID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'PJID、STID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');
      const query = `
        SELECT B.*
        FROM [AIOT].[dbo].[ctrlStation] A
        INNER JOIN [AIOT].[dbo].[cfgModel] B
          ON A.Model = B.Model
        WHERE A.ProjID = @PJID
          AND A.STID = @STID
      `;
      const result = await aiotDb
        .request()
        .input('PJID', sql.VarChar, PJID)
        .input('STID', sql.VarChar, STID)
        .query(query);

      const modelRow = result.recordset[0] || {};

      const models = Array.from( { length: 8 }, (_, offset) => offset + 1 ).flatMap((index) => {
        const name = formatChemicalSubscript(modelRow['ParName' + index]);

        if (!name) return [];

        const valueModel = {
          value: 'Value' + index,
          name,
          label: modelRow['ParUnit' + index]
            ? `${name} (${modelRow['ParUnit' + index]})`
            : name,
          unit: modelRow['ParUnit' + index] || '',
        };

        const countModel = {
          value: 'Count' + index,
          name: name + ' Count',
          label: name + ' Count',
          unit: '',
        };

        return role === 'ERP'
          ? [valueModel, countModel]
          : [valueModel];
      });
      const query2 = `
        EXEC dbo.GetData @STID=@STID, @PROJID=@PJID, @FDATE=@startDateTime, @TDATE=@endDateTime, @TYPE=@type
      `
      const result2 = await aiotDb.request()
        .input('STID', sql.VarChar, STID)
        .input('PJID', sql.VarChar, PJID)
        .input('startDateTime', sql.VarChar, startDateTime)
        .input('endDateTime', sql.VarChar, endDateTime)
        .input('type', sql.VarChar, type || 'T05')
        .query(query2);
      const heatmaps = buildHeatmaps(result2.recordset, models);
      return res.status(200).json({ 
        success: true, 
        data: { models, heatmaps } 
      });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.post('/stations/dashboard/wind-rose', verifyToken, async (req, res) => {
  const { PJID, STID, startDateTime, endDateTime, type } = req.body;
  const { role } = req.user;

  if (!PJID || !STID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'PJID、STID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');
      const query = `
        SELECT B.*
        FROM [AIOT].[dbo].[ctrlStation] A
        INNER JOIN [AIOT].[dbo].[cfgModel] B
          ON A.Model = B.Model
        WHERE A.ProjID = @PJID
          AND A.STID = @STID
      `;
      const result = await aiotDb
        .request()
        .input('PJID', sql.VarChar, PJID)
        .input('STID', sql.VarChar, STID)
        .query(query);

      const modelRow = result.recordset[0] || {};

      const models = Array.from( { length: 8 }, (_, offset) => offset + 1 ).flatMap((index) => {
        const name = formatChemicalSubscript(modelRow['ParName' + index]);

        if (!name) return [];

        const valueModel = {
          value: 'Value' + index,
          name,
          label: modelRow['ParUnit' + index]
            ? `${name} (${modelRow['ParUnit' + index]})`
            : name,
          unit: modelRow['ParUnit' + index] || '',
        };

        const countModel = {
          value: 'Count' + index,
          name: name + ' Count',
          label: name + ' Count',
          unit: '',
        };

        return role === 'ERP'
          ? [valueModel, countModel]
          : [valueModel];
      });
      const query2 = `
        EXEC dbo.GetData @STID=@STID, @PROJID=@PJID, @FDATE=@startDateTime, @TDATE=@endDateTime, @TYPE=@type
      `
      const result2 = await aiotDb.request()
        .input('STID', sql.VarChar, STID)
        .input('PJID', sql.VarChar, PJID)
        .input('startDateTime', sql.VarChar, startDateTime)
        .input('endDateTime', sql.VarChar, endDateTime)
        .input('type', sql.VarChar, type || 'T05')
        .query(query2);
      const wind = buildWindRose(result2.recordset, models);
      return res.status(200).json({
        success: true,
        data: { models, wind },
      });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.post('/stations/dashboard/wind-vector', verifyToken, async (req, res) => {
  const { PJID, STID, startDateTime, endDateTime, type } = req.body;
  const { role } = req.user;
  if (!PJID || !STID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'PJID、STID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }
  if (['EPA', 'TAQMN'].includes(PJID)) {
    return res.status(400).json({ success: false, message: 'EPA 請使用 open-data Dashboard API。' });
  }
  try {
    const aiotDb = await getConnection('AIOT');
      const modelResult = await aiotDb.request()
        .input('PJID', sql.VarChar, PJID)
        .input('STID', sql.VarChar, STID)
        .query(
          'SELECT B.* FROM [AIOT].[dbo].[ctrlStation] A ' +
          'INNER JOIN [AIOT].[dbo].[cfgModel] B ON A.Model = B.Model ' +
          'WHERE A.ProjID = @PJID AND A.STID = @STID'
        );
      const modelRow = modelResult.recordset[0] || {};
      const models = Array.from({ length: 8 }, (_, offset) => offset + 1).flatMap((index) => {
        const name = formatChemicalSubscript(modelRow['ParName' + index]);
        if (!name) return [];

        const valueModel = {
          value: 'Value' + index,
          name,
          label: modelRow['ParUnit' + index]
            ? `${name} (${modelRow['ParUnit' + index]})`
            : name,
          unit: modelRow['ParUnit' + index] || '',
        };
        const countModel = {
          value: 'Count' + index,
          name: name + ' Count',
          label: name + ' Count',
          unit: '',
        };

        return role === 'AIOT' ? [valueModel, countModel] : [valueModel];
      });
      const rowResult = await aiotDb.request()
        .input('STID', sql.VarChar, STID)
        .input('PJID', sql.VarChar, PJID)
        .input('startDateTime', sql.VarChar, startDateTime)
        .input('endDateTime', sql.VarChar, endDateTime)
        .input('type', sql.VarChar, type || 'T05')
        .query('EXEC dbo.GetData @STID=@STID, @PROJID=@PJID, @FDATE=@startDateTime, @TDATE=@endDateTime, @TYPE=@type');
      const wind = buildWindVector(rowResult.recordset, models);
      return res.status(200).json({
        success: true,
        data: { models, wind },
      });
  } catch (error) {
    console.error(req.method + ' ' + req.originalUrl + ' error:', error);
    return res.status(500).json({ success: false, message: 'wind-vector query failed' });
  }
});


// 測站日報表
router.post('/stations/dashboard/daily-report', verifyToken, async (req, res) => {
  const { PJID, STID, startDateTime, endDateTime, timeType, modelType } = req.body;
  const { role } = req.user;

  if (!role) {
    return res.status(401).json({ success: false, message: 'Role is missing.' });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
      SELECT TOP (1)
        B.[ParName1],B.[ParName2],B.[ParName3],B.[ParName4],B.[ParName5],B.[ParName6],B.[ParName7],B.[ParName8]
      FROM [AIOT].[dbo].[ctrlStation] A
      INNER JOIN [AIOT].[dbo].[cfgModel] B
        ON A.[Model] = B.[Model]
      WHERE A.[ProjID] = @PJID
        AND A.[STID] = @STID;
    `;

    const result = await aiotDb
      .request()
      .input('PJID', sql.VarChar, PJID)
      .input('STID', sql.VarChar, STID)
      .query(query);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Station/Model not found.' });
    }

    const baseModelType = formatNormalizeChemicalFormula(modelType).split(/[\s()\-]/)[0];
    let targetIndex = 0;

    for (let index = 1; index <= 8; index += 1) {
      const parameterName = String(result.recordset[0][`ParName${index}`] || '');
      if (parameterName === baseModelType) {
        targetIndex = index;
        break;
      }
    }

    const query2 = `EXEC dbo.GetData @STID = @STID, @PROJID = @PJID, @FDATE = @startDateTime, @TDATE = @endDateTime, @TYPE = @timeType;`;

    const result2 = await aiotDb
      .request()
      .input('STID', sql.VarChar, STID)
      .input('PJID', sql.VarChar, PJID)
      .input('startDateTime', sql.VarChar, startDateTime)
      .input('endDateTime', sql.VarChar, endDateTime)
      .input('timeType', sql.VarChar, timeType)
      .query(query2);

    const rows = result2.recordset;
    const grouped = {};
    
    const isCountType = /(?:\s+Count|\(Count\))/i.test(modelType);
    const countKey = `Count${targetIndex}`;
    const valueKey = `Value${targetIndex}`;

    rows.forEach((row) => {
      const dateObj = new Date(row.Date_Time);

      const dateString = dateObj.toISOString().split('T')[0];
      const hourString = `${datePad2(dateObj.getUTCHours())}:${datePad2(dateObj.getUTCMinutes())}`;
      const rawValue = isCountType ? row[countKey] : row[valueKey];

      if (!grouped[dateString]) {
        grouped[dateString] = {
          Date_Time: dateObj.toISOString(),
        };
      }

      grouped[dateString][hourString] = formatFixedOneDecimal(rawValue);
    });

    const report = Object.values(grouped).sort((a, b) => {
      return new Date(a.Date_Time) - new Date(b.Date_Time);
    });

    return res.status(200).json({ 
      success: true, 
      data: report 
    });

  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    return res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

// 測站資料表
router.post('/stations/dashboard/table', verifyToken, async (req, res) => {
  const { PJID, STID, startDateTime, endDateTime, timeType, modelTypes = [], flagOnly = false } = req.body;
  const { role } = req.user;

  if (!role) {
    return res.status(401).json({ success: false, message: 'Role is missing.' });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
      SELECT TOP (1)
        B.[ParName1],B.[ParName2],B.[ParName3],B.[ParName4],B.[ParName5],B.[ParName6],B.[ParName7],B.[ParName8]
      FROM [AIOT].[dbo].[ctrlStation] A
      INNER JOIN [AIOT].[dbo].[cfgModel] B
        ON A.[Model] = B.[Model]
      WHERE A.[ProjID] = @PJID
        AND A.[STID] = @STID;
    `;

    const result = await aiotDb
      .request()
      .input('PJID', sql.VarChar, PJID)
      .input('STID', sql.VarChar, STID)
      .query(query);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Station/Model not found.' });
    }

    const parameterNames = result.recordset[0];
    const selectedModelTypes = new Set(
      (Array.isArray(modelTypes) ? modelTypes : [modelTypes])
        .map((modelType) => typeof modelType === 'string' ? modelType.trim() : '')
        .filter(Boolean),
    );
    const parameters = Array.from({ length: 8 }, (_, offset) => {
      const index = offset + 1;
      const name = formatChemicalSubscript(parameterNames[`ParName${index}`]?.trim());
      return { index, name };
    }).filter(({ name }) => name);

    const query2 = `EXEC dbo.GetData @STID = @STID, @PROJID = @PJID, @FDATE = @startDateTime, @TDATE = @endDateTime, @TYPE = @timeType;`;

    const result2 = await aiotDb
      .request()
      .input('STID', sql.VarChar, STID)
      .input('PJID', sql.VarChar, PJID)
      .input('startDateTime', sql.VarChar, startDateTime)
      .input('endDateTime', sql.VarChar, endDateTime)
      .input('timeType', sql.VarChar, timeType)
      .query(query2);

    const includeAll = !selectedModelTypes.size;

    const report = result2.recordset
      .map((sourceRow) => {
        const row = { Date_Time: sourceRow.Date_Time ?? null };

        parameters.forEach(({ index, name }) => {
          const countName = `${name} Count`;
          const includeValue = includeAll || selectedModelTypes.has(name);
          const includeCount = includeAll || selectedModelTypes.has(countName);

          if (includeValue) {
            row[name] = formatFixedOneDecimal(sourceRow[`Value${index}`]);
          }

          if (includeCount) {
            row[countName] = formatFixedOneDecimal(sourceRow[`Count${index}`]);
          }

          if (flagOnly && (includeValue || includeCount)) {
            row[`${name} Flag`] = sourceRow[`Status${index}`] ?? null;
          }
        });

        return row;
      })
      .sort((a, b) => {
        return new Date(a.Date_Time).getTime() - new Date(b.Date_Time).getTime();
      });

    res.status(200).json({ 
      success: true, 
      data: report 
    });
    
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});


// 測站月報表
router.post('/stations/dashboard/monthly-report', verifyToken, async (req, res) => {
  const { startDateTime, endDateTime, PJID, STID, modelTypes = [] } = req.body;

  if (!startDateTime || !endDateTime || !STID) {
    return res.status(400).json({
      success: false,
      message: 'startDateTime、endDateTime 與 STID 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
      SELECT TOP (1)
        B.[ParName1],B.[ParName2],B.[ParName3],B.[ParName4],B.[ParName5],B.[ParName6],B.[ParName7],B.[ParName8]
      FROM [AIOT].[dbo].[ctrlStation] A
      INNER JOIN [AIOT].[dbo].[cfgModel] B
        ON A.[Model] = B.[Model]
      WHERE A.[ProjID] = @PJID
        AND A.[STID] = @STID;
    `;

    const result = await aiotDb
      .request()
      .input('PJID', sql.VarChar, PJID)
      .input('STID', sql.VarChar, STID)
      .query(query);

    if (!result.recordset.length) {
      return res.status(404).json({ 
        success: false, 
        message: '找不到 Station/Model。' 
      });
    }

    const parameterNames = result.recordset[0];
    const selectedModelTypes = new Set(
      (Array.isArray(modelTypes) ? modelTypes : [modelTypes])
        .map((modelType) => typeof modelType === 'string' ? modelType.trim() : '')
        .filter(Boolean),
    );
    const parameters = Array.from({ length: 8 }, (_, offset) => {
      const index = offset + 1;
      const name = formatChemicalSubscript(parameterNames[`ParName${index}`]?.trim());
      return { index, name };
    }).filter(({ name }) => name);
    const query2 = `EXEC [dbo].[STP_AIOTWEB_GetStationMinuteToHourlyAvg] @StartDate = @startDate, @EndDate = @endDate, @STID = @STID;`;

    const result2 = await aiotDb
      .request()
      .input('startDate', sql.VarChar, startDateTime)
      .input('endDate', sql.VarChar, endDateTime)
      .input('STID', sql.VarChar, STID)
      .query(query2);

    const includeAll = !selectedModelTypes.size;

    const report = result2.recordset
      .map((sourceRow) => {
        const row = { Date_Time: sourceRow.Date_Time };

        parameters.forEach(({ index, name }) => {
          const countName = `${name} Count`;

          if (includeAll || selectedModelTypes.has(name)) {
            row[name] = formatFixedOneDecimal(sourceRow[`Value${index}`]);
          }

          if (includeAll || selectedModelTypes.has(countName)) {
            row[countName] = formatFixedOneDecimal(sourceRow[`Count${index}`]);
          }
        });

        return row;
      })
      .sort((a, b) => {
        return String(a.Date_Time).localeCompare(String(b.Date_Time));
    });

    res.status(200).json({ 
      success: true, 
      data: report 
    });
    
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});


// EPA：
router.post('/open-data/dashboard/realtime', verifyToken, async (req, res) => {
  const { STID } = req.body;

  if (!STID) {
    return res.status(400).json({
      success: false,
      message: 'STID 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');


    const intervalMs = 60 * 60 * 1000;
    const endDateTime = new Date();
    endDateTime.setMinutes(0, 0, 0);
    endDateTime.setTime(endDateTime.getTime() - intervalMs);

    const startDateTime = new Date(endDateTime.getTime() - intervalMs * 4);

    const toLocalISO = (date) =>
      new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, -1);

    const startStr = toLocalISO(startDateTime);
    const endStr = toLocalISO(endDateTime);
    const query = ` 
      SELECT *
      FROM [OPENDATA].[dbo].[dTAQMNT60]
      WHERE STID = @STID
        AND Date_Time BETWEEN @startDateTime AND @endDateTime
      ORDER BY Date_Time DESC
    `;

    const rowResult = await aiotDb.request()
      .input('STID', sql.VarChar, STID)
      .input('startDateTime', sql.VarChar, startStr)
      .input('endDateTime', sql.VarChar, endStr)
      .query(query);

    const modelKeys = new Set(EPA_MODELS.map(({ value }) => value));
    const realtime = rowResult.recordset.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          modelKeys.has(key) ? formatTruncateOneDecimal(value) : value,
        ])
      )
    );

    return res.status(200).json({
      success: true,
      data: {
        models: EPA_MODELS,
        realtime,
        realtimeType: 'T60',
        isEPA: true
      },
    });

  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.post('/open-data/dashboard/line', verifyToken, async (req, res) => {
  const { STID, startDateTime, endDateTime } = req.body;

  if (!STID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'STID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');
      const models = EPA_MODELS;
      const query = `
        SELECT * FROM [OPENDATA].[dbo].[dTAQMNT60]
        WHERE STID = @STID AND Date_Time BETWEEN @startDateTime AND @endDateTime
        ORDER BY Date_Time ASC
      `
      const result = await aiotDb.request()
        .input('STID', sql.VarChar, STID)
        .input('startDateTime', sql.VarChar, startDateTime)
        .input('endDateTime', sql.VarChar, endDateTime)
        .query(query);
      const rows = [];
      for (const row of result.recordset) {
        const date = new Date(row.Date_Time);
        if (!Number.isNaN(date.getTime())) rows.push(row);
      }
      const line = {};
      for (const model of models) line[model.value] = [];
      for (const row of rows) {
        const timestamp = new Date(row.Date_Time).getTime();
        for (const model of models) {
          const value = Number(row[model.value]);
          if (Number.isFinite(value)) line[model.value].push([timestamp, value]);
        }
      }
      return res.status(200).json({
        success: true,
        data: { models, line, history: rows },
      });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.post('/open-data/dashboard/boxplot', verifyToken, async (req, res) => {
  const { STID, startDateTime, endDateTime, box = {} } = req.body;

  if (!STID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'STID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }

  const boxplotOptions = parseBoxplotOptions(box);
  if (!boxplotOptions) {
    return res.status(400).json({
      success: false,
      message: '盒鬚圖設定不正確：時間分組需為 hour、day、week 或 month，且上下百分位需分別位於 0–50 與 50–100 之間。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');
      const models = EPA_MODELS;
      const query = `
        SELECT * FROM [OPENDATA].[dbo].[dTAQMNT60]
        WHERE STID = @STID AND Date_Time BETWEEN @startDateTime AND @endDateTime
        ORDER BY Date_Time ASC
      `
      const result = await aiotDb.request()
        .input('STID', sql.VarChar, STID)
        .input('startDateTime', sql.VarChar, startDateTime)
        .input('endDateTime', sql.VarChar, endDateTime)
        .query(query);
      const boxplots = buildBoxplots(result.recordset, models, boxplotOptions);
      return res.status(200).json({ 
        success: true, 
        data: { models, boxplots } 
      });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.post('/open-data/dashboard/heatmap', verifyToken, async (req, res) => {
  const { STID, startDateTime, endDateTime } = req.body;

  if (!STID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'STID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }
  try {
    const aiotDb = await getConnection('AIOT');
      const models = EPA_MODELS;
      const query = `
        SELECT * FROM [OPENDATA].[dbo].[dTAQMNT60]
        WHERE STID = @STID AND Date_Time BETWEEN @startDateTime AND @endDateTime
        ORDER BY Date_Time ASC
      `
      const result = await aiotDb.request()
        .input('STID', sql.VarChar, STID)
        .input('startDateTime', sql.VarChar, startDateTime)
        .input('endDateTime', sql.VarChar, endDateTime)
        .query(query);
      const heatmaps = buildHeatmaps(result.recordset, models);
      return res.status(200).json({ 
        success: true, 
        data: { models, heatmaps } 
      });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.post('/open-data/dashboard/wind-rose', verifyToken, async (req, res) => {
  const { STID, startDateTime, endDateTime } = req.body;

  if (!STID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'STID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }
  try {
    const aiotDb = await getConnection('AIOT');
      const models = EPA_MODELS;
      const query = `
        SELECT * FROM [OPENDATA].[dbo].[dTAQMNT60]
        WHERE STID = @STID AND Date_Time BETWEEN @startDateTime AND @endDateTime
        ORDER BY Date_Time ASC
      `
      const result = await aiotDb.request()
        .input('STID', sql.VarChar, STID)
        .input('startDateTime', sql.VarChar, startDateTime)
        .input('endDateTime', sql.VarChar, endDateTime)
        .query(query);
      const wind = buildWindRose(result.recordset, models);
      return res.status(200).json({
        success: true,
        data: { models, wind },
      });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.post('/open-data/dashboard/wind-vector', verifyToken, async (req, res) => {
  const { STID, startDateTime, endDateTime } = req.body;
  if (!STID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'STID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }
  try {
    const aiotDb = await getConnection('AIOT');
    const models = EPA_MODELS;
    const query = `
      SELECT * FROM [OPENDATA].[dbo].[dTAQMNT60]
      WHERE STID = @STID AND Date_Time BETWEEN @startDateTime AND @endDateTime
      ORDER BY Date_Time ASC
    `
    const result = await aiotDb.request()
      .input('STID', sql.VarChar, STID)
      .input('startDateTime', sql.VarChar, startDateTime)
      .input('endDateTime', sql.VarChar, endDateTime)
      .query(query);
    const wind = buildWindVector(result.recordset, models);

    return res.status(200).json({
      success: true,
      data: { models, wind },
    });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});


router.post('/open-data/dashboard/table', verifyToken, async (req, res) => {

    const { STID, startDateTime, endDateTime, modelTypes = [] } = req.body;

    if (!STID || !startDateTime || !endDateTime) {
      return res.status(400).json({
        success: false,
        message:
          'STID、startDateTime 與 endDateTime 為必填欄位。',
      });
    }

    try {
      const aiotDb = await getConnection('AIOT');
      const models = EPA_MODELS;

      let selectedColumnNames = [];


      if ( Array.isArray(modelTypes) && modelTypes.length ) {
        const selectedColumns = new Set();

        for (const requested of modelTypes) {
          const requestedName = String(
            requested || ''
          ).split(/\s|\(/)[0];

          const matchedModel = models.find(
            (model) =>
              model.value === requested ||
              model.name === requested ||
              model.label === requested ||
              model.value === requestedName ||
              model.name === requestedName
          );

          if (matchedModel) {
            selectedColumns.add(
              matchedModel.value
            );
          }
        }

        if (!selectedColumns.size) {
          return res.status(400).json({
            success: false,
            message: '查無有效的測項。',
          });
        }

        selectedColumnNames = [ ...selectedColumns ];
      }

      let selectColumns;

      if (selectedColumnNames.length) {
        selectColumns = [
          `
          CONVERT(
            VARCHAR(23),
            [Date_Time],
            121
          ) AS [Date_Time]
          `,
          ...selectedColumnNames.map(
            (column) => `[${column}]`
          ),
        ].join(',');
      } else {

        selectedColumnNames = models.map(
          (model) => model.value
        );

        selectColumns = [
          `
          CONVERT(
            VARCHAR(23),
            [Date_Time],
            121
          ) AS [Date_Time]
          `,
          ...selectedColumnNames.map(
            (column) => `[${column}]`
          ),
        ].join(',');
      }

      const sqlStartDateTime = formatToSqlDateTime(startDateTime);
      const sqlEndDateTime = formatToSqlDateTime(endDateTime);

      const query = `
        SELECT ${selectColumns}
        FROM [OPENDATA].[dbo].[dTAQMNT60]
        WHERE [STID] = @STID
          AND [Date_Time]
          BETWEEN @startDateTime AND @endDateTime
        ORDER BY [Date_Time] ASC
      `;

      const result = await aiotDb
        .request()
        .input('STID', sql.VarChar, STID)
        .input('startDateTime', sql.VarChar, sqlStartDateTime)
        .input('endDateTime', sql.VarChar, sqlEndDateTime)
        .query(query);

      const fillMissingHourlyData = (rows, start, end, columns) => {
        const dataMap = new Map();

        rows.forEach((item) => {
          const key = getHourKey(item.Date_Time);
          dataMap.set(key, item);
        });

        const formattedStart = formatToHourISO(start);
        const formattedEnd = formatToHourISO(end);

        const current = new Date(formattedStart);
        const endDate = new Date(formattedEnd);

        const filledData = [];
        for (
          let timestamp = current.getTime();
          timestamp <= endDate.getTime();
          timestamp += 60 * 60 * 1000
        ) {
          const currentDate = new Date(timestamp);
          const currentISO = currentDate.toISOString();
          const hourKey = getHourKey(currentISO);
          const existing = dataMap.get(hourKey);

          if (existing) {
            filledData.push({
              ...existing,
              Date_Time: formatToHourISO(existing.Date_Time),
            });

          } else {
            const missingRow = { Date_Time: currentISO };

            columns.forEach(
              (column) => {
                missingRow[column] = null;
              }
            );

            filledData.push( missingRow );
          }
        }

        return filledData;
      };

      const data =
        fillMissingHourlyData(
          result.recordset || [],
          startDateTime,
          endDateTime,
          selectedColumnNames
        );

      return res.status(200).json({
        success: true,
        data,
      });

    } catch (error) {
      console.error(`${req.method} ${req.originalUrl} error:`, error);

      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

router.post('/open-data/dashboard/daily-report', verifyToken, async (req, res) => {
  const { STID, startDateTime, endDateTime, modelType } = req.body;

  if (!STID || !startDateTime || !endDateTime || !modelType) {
    return res.status(400).json({
      success: false,
      message: 'STID、時間範圍與 modelType 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');
    const models = EPA_MODELS;

    const requestedName = String(modelType).split(/\s|\(/)[0];

    const matchedModel = models.find(model =>
      model.value === modelType ||
      model.name === modelType ||
      model.label === modelType ||
      model.name === requestedName ||
      model.value === requestedName
    );

    if (!matchedModel) {
      return res.status(400).json({
        success: false,
        message: '無效的 modelType。',
      });
    }

    const column = matchedModel.value;

    const sqlStartDateTime = formatToSqlDateTime(startDateTime);
    const sqlEndDateTime = formatToSqlDateTime(endDateTime);

    const query = `
      ;WITH DateRange AS (
        SELECT CAST(@startDateTime AS DATE) AS ReportDate

        UNION ALL

        SELECT DATEADD(DAY, 1, ReportDate)
        FROM DateRange
        WHERE ReportDate < CAST(@endDateTime AS DATE)
      ),

      RankedData AS (
        SELECT
          CAST([Date_Time] AS DATE) AS ReportDate,
          DATEPART(HOUR, [Date_Time]) AS ReportHour,
          TRY_CAST([${column}] AS FLOAT) AS Value,
          ROW_NUMBER() OVER (
            PARTITION BY
              CAST([Date_Time] AS DATE),
              DATEPART(HOUR, [Date_Time])
            ORDER BY [Date_Time] DESC
          ) AS rn
        FROM [OPENDATA].[dbo].[dTAQMNT60]
        WHERE
          [STID] = @STID
          AND [Date_Time] BETWEEN @startDateTime AND @endDateTime
      )

      SELECT
        CONVERT(VARCHAR(10), D.ReportDate, 23) AS [Date_Time],

        MAX(CASE WHEN R.ReportHour = 0  AND R.rn = 1 THEN R.Value END) AS [00:00],
        MAX(CASE WHEN R.ReportHour = 1  AND R.rn = 1 THEN R.Value END) AS [01:00],
        MAX(CASE WHEN R.ReportHour = 2  AND R.rn = 1 THEN R.Value END) AS [02:00],
        MAX(CASE WHEN R.ReportHour = 3  AND R.rn = 1 THEN R.Value END) AS [03:00],
        MAX(CASE WHEN R.ReportHour = 4  AND R.rn = 1 THEN R.Value END) AS [04:00],
        MAX(CASE WHEN R.ReportHour = 5  AND R.rn = 1 THEN R.Value END) AS [05:00],
        MAX(CASE WHEN R.ReportHour = 6  AND R.rn = 1 THEN R.Value END) AS [06:00],
        MAX(CASE WHEN R.ReportHour = 7  AND R.rn = 1 THEN R.Value END) AS [07:00],
        MAX(CASE WHEN R.ReportHour = 8  AND R.rn = 1 THEN R.Value END) AS [08:00],
        MAX(CASE WHEN R.ReportHour = 9  AND R.rn = 1 THEN R.Value END) AS [09:00],
        MAX(CASE WHEN R.ReportHour = 10 AND R.rn = 1 THEN R.Value END) AS [10:00],
        MAX(CASE WHEN R.ReportHour = 11 AND R.rn = 1 THEN R.Value END) AS [11:00],
        MAX(CASE WHEN R.ReportHour = 12 AND R.rn = 1 THEN R.Value END) AS [12:00],
        MAX(CASE WHEN R.ReportHour = 13 AND R.rn = 1 THEN R.Value END) AS [13:00],
        MAX(CASE WHEN R.ReportHour = 14 AND R.rn = 1 THEN R.Value END) AS [14:00],
        MAX(CASE WHEN R.ReportHour = 15 AND R.rn = 1 THEN R.Value END) AS [15:00],
        MAX(CASE WHEN R.ReportHour = 16 AND R.rn = 1 THEN R.Value END) AS [16:00],
        MAX(CASE WHEN R.ReportHour = 17 AND R.rn = 1 THEN R.Value END) AS [17:00],
        MAX(CASE WHEN R.ReportHour = 18 AND R.rn = 1 THEN R.Value END) AS [18:00],
        MAX(CASE WHEN R.ReportHour = 19 AND R.rn = 1 THEN R.Value END) AS [19:00],
        MAX(CASE WHEN R.ReportHour = 20 AND R.rn = 1 THEN R.Value END) AS [20:00],
        MAX(CASE WHEN R.ReportHour = 21 AND R.rn = 1 THEN R.Value END) AS [21:00],
        MAX(CASE WHEN R.ReportHour = 22 AND R.rn = 1 THEN R.Value END) AS [22:00],
        MAX(CASE WHEN R.ReportHour = 23 AND R.rn = 1 THEN R.Value END) AS [23:00]

      FROM DateRange D

      LEFT JOIN RankedData R
        ON D.ReportDate = R.ReportDate
        AND R.rn = 1

      GROUP BY D.ReportDate
      ORDER BY D.ReportDate ASC

      OPTION (MAXRECURSION 0);
    `;

    const result = await aiotDb
      .request()
      .input('STID', sql.VarChar, STID)
      .input('startDateTime', sql.VarChar, sqlStartDateTime)
      .input('endDateTime', sql.VarChar, sqlEndDateTime)
      .query(query);

    const fillMissingDailyHourlyData = (rows) => {
      return rows.map((row) => {
        const datePart = String(row.Date_Time).slice(0, 10);

        const dailyRow = {
          Date_Time: formatToDayISO(datePart),
        };

        for (let hour = 0; hour < 24; hour++) {
          const hourKey = `${String(hour).padStart(2, '0')}:00`;
          dailyRow[hourKey] = row[hourKey] ?? null;
        }

        return dailyRow;
      });
    };

    const data = fillMissingDailyHourlyData(result.recordset || []);

    return res.status(200).json({
      success: true,
      data,
    });

  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

router.post('/open-data/dashboard/monthly-report', verifyToken, async (req, res) => {
  const { STID, startDateTime, endDateTime, modelTypes = [] } = req.body;

  if (!STID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'STID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');
    const models = EPA_MODELS;

    const selectedModels = Array.isArray(modelTypes) && modelTypes.length
      ? models.filter(model =>
          modelTypes.some(requested => {
            const requestedName = String(requested || '').split(/\s|\(/)[0];

            return (
              requested === model.value ||
              requested === model.name ||
              requested === model.label ||
              requestedName === model.value ||
              requestedName === model.name
            );
          })
        )
      : models;

    if (!selectedModels.length) {
      return res.status(400).json({
        success: false,
        message: '查無有效的測項。',
      });
    }

    const sqlStartDateTime = formatToSqlDateTime(startDateTime);
    const sqlEndDateTime = formatToSqlDateTime(endDateTime);

    const avgColumns = selectedModels
      .map(model => `
        CONVERT(
          VARCHAR(30),
          CAST(
            ROUND(
              AVG(TRY_CAST([${model.value}] AS FLOAT)),
              1,
              1
            ) AS DECIMAL(18, 1)
          )
        ) AS [${model.value}]
      `)
      .join(',');

    const query = `
      SELECT
        CONVERT(
          VARCHAR(10),
          CAST([Date_Time] AS DATE),
          23
        ) AS [Date_Time],
        ${avgColumns}

      FROM [OPENDATA].[dbo].[dTAQMNT60]

      WHERE
        [STID] = @STID
        AND [Date_Time] BETWEEN @startDateTime AND @endDateTime

      GROUP BY CAST([Date_Time] AS DATE)

      ORDER BY CAST([Date_Time] AS DATE) ASC
    `;

    const result = await aiotDb
      .request()
      .input('STID', sql.VarChar, STID)
      .input('startDateTime', sql.VarChar, sqlStartDateTime)
      .input('endDateTime', sql.VarChar, sqlEndDateTime)
      .query(query);

    const fillMissingDailyData = (
      rows,
      startDateTime,
      endDateTime,
      columns
    ) => {
      const dataMap = new Map(
        rows.map((item) => [
          getDatePart(item.Date_Time),
          item,
        ])
      );

      const startDate = getDatePart(startDateTime);
      const endDate = getDatePart(endDateTime);

      let current = new Date(`${startDate}T00:00:00.000Z`);
      const end = new Date(`${endDate}T00:00:00.000Z`);

      const filledData = [];

      while (current <= end) {
        const dateKey = current.toISOString().slice(0, 10);
        const existing = dataMap.get(dateKey);

        if (existing) {
          filledData.push({
            ...existing,
            Date_Time: formatToDayISO(dateKey),
          });
        } else {
          const missingRow = {
            Date_Time: formatToDayISO(dateKey),
          };

          columns.forEach((column) => {
            missingRow[column] = null;
          });

          filledData.push(missingRow);
        }

        current.setUTCDate(current.getUTCDate() + 1);
      }

      return filledData;
    };

    const selectedColumns = selectedModels.map(model => model.value);

    const data = fillMissingDailyData(
      result.recordset || [],
      startDateTime,
      endDateTime,
      selectedColumns
    );

    return res.status(200).json({
      success: true,
      data,
    });

  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

module.exports = router;
