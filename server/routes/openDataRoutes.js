const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getConnection } = require('../db/pool');
const { verifyToken } = require('../middleware/authMiddleware');
router.post('/TAQMN/stations', verifyToken, async (req, res) => {
  try {
    const aiotDb = await getConnection('AIOT');
    const query = `
            SELECT  [ProjID],[STID],[County],[STName],[geoLat],[geoLng]
            FROM [OPENDATA].[dbo].[ctrlStation]
            WHERE [ProjID] = 'TAQMN' AND [Enabled] = 1 
        `;
    const result = await aiotDb.request().query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
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

router.post('/TAQMN/data/:STID', verifyToken, async (req, res) => {
  const { STID } = req.params;
  const { startDateTime, endDateTime } = req.body;

  if (!STID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'STID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');
    const query = `
        SELECT 
            [Date_Time],[ProjID],[STID],[SO2],[NO],[NOx],[NO2],[CO],[O3],[CH4],[NMHC],
            [THC],[PM10],[PM25],[WS],[WD],[WST10Vct],[WDT10Vct],[UVB],[AMB_TEMP],[RAINFALL],
            [RH],[PH_RAIN],[RAIN_COND],[CO2],[SHELT_TEMP],[PRESSURE],[RAIN_INT],[O3h8],[PM25h24],
            [PM10h24],[PSI],[AQI],[WeatherType],[DUST],[Typhoon],[Status],[sValue],[Pollutant]
        FROM [OPENDATA].[dbo].[dTAQMNT60]
        WHERE [STID] = @STID
            AND [Date_Time] BETWEEN @StartDateTime AND @EndDateTime
        ORDER BY [Date_Time] ASC;
        `;
    const result = await aiotDb
      .request()
      .input('STID', sql.VarChar, STID)
      .input('startDateTime', sql.VarChar, startDateTime)
      .input('endDateTime', sql.VarChar, endDateTime)
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
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

module.exports = router;



