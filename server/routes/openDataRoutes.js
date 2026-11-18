const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getConnection } = require('../db/pool');
const { verifyToken } = require('../middleware/authMiddleware');


/**
 * @swagger
 * /aiot/taqmn/stations:
 *   get:
 *     tags:
 *       - Open Data
 *     summary: 取得TAQMN測站列表
 *     description: 查詢資料表中專案類行為TAQMN且狀態為啟用的測站清單。
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 查詢成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ProjID:
 *                         type: string
 *                       STID:
 *                         type: string
 *                       County:
 *                         type: string
 *                       STName:
 *                         type: string
 *                       geoLat:
 *                         type: number
 *                       geoLng:
 *                         type: number
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.get('/taqmn/stations', verifyToken, async (req, res) => {
  try {
    const aiotDb = await getConnection('AIOT');
    
    const query = `
        SELECT 
          [ProjID],
          [STID],
          [County],
          [STName],
          [geoLat],
          [geoLng]
        FROM [OPENDATA].[dbo].[ctrlStation]
        WHERE [ProjID] = 'TAQMN' AND [Enabled] = 1 
    `;

    const result = await aiotDb
      .request()
      .query(query);

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /aiot/taqmn/{STID}/data:
 *   get:
 *     tags:
 *       - Open Data
 *     summary: 取得指定TAQMN測站的空氣品質監測資料
 *     description: 根據測站代碼（STID）與時間區間查詢監測數據。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: STID
 *         required: true
 *         schema:
 *           type: string
 *         description: 測站代碼
 *         example: "ST001"
 *       - in: query
 *         name: startDateTime
 *         required: true
 *         schema:
 *           type: string
 *         description: 起始時間 (格式 yyyy-MM-dd HH:mm)
 *         example: "2026-11-01 00:00"
 *       - in: query
 *         name: endDateTime
 *         required: true
 *         schema:
 *           type: string
 *         description: 結束時間 (格式 yyyy-MM-dd HH:mm)
 *         example: "2026-11-11 23:59"
 *     responses:
 *       '200':
 *         description: 查詢成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       Date_Time:
 *                         type: string
 *                       ProjID:
 *                         type: string
 *                       STID:
 *                         type: string
 *                       SO2:
 *                         type: number
 *                       NO:
 *                         type: number
 *                       NOx:
 *                         type: number
 *                       NO2:
 *                         type: number
 *                       CO:
 *                         type: number
 *                       O3:
 *                         type: number
 *                       CH4:
 *                         type: number
 *                       NMHC:
 *                         type: number
 *                       THC:
 *                         type: number
 *                       PM10:
 *                         type: number
 *                       PM25:
 *                         type: number
 *                       WS:
 *                         type: number
 *                       WD:
 *                         type: number
 *                       WST10Vct:
 *                         type: number
 *                       WDT10Vct:
 *                         type: number
 *                       UVB:
 *                         type: number
 *                       AMB_TEMP:
 *                         type: number
 *                       RAINFALL:
 *                         type: number
 *                       RH:
 *                         type: number
 *                       PH_RAIN:
 *                         type: number
 *                       RAIN_COND:
 *                         type: number
 *                       CO2:
 *                         type: number
 *                       SHELT_TEMP:
 *                         type: number
 *                       PRESSURE:
 *                         type: number
 *                       RAIN_INT:
 *                         type: number
 *                       O3h8:
 *                         type: number
 *       '400':
 *         description: 缺少必要參數
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.get('/taqmn/:STID/data', verifyToken, async (req, res) => {
  const { STID } = req.params;
  const { startDateTime, endDateTime } = req.query;

  if (![STID, startDateTime, endDateTime].every(
    value => typeof value === 'string' && value.trim()
  )) {
    return res.status(400).json({
      success: false,
      message: 'Bad request',
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

    return res.status(200).json({
      success: true,
      data: result.recordset,
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



