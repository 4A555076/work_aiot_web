const express = require('express');
const router = express.Router();
const sql = require('mssql');
const path = require('path');
const fs = require('fs');
const { getConnection } = require('../db/pool');
const { verifyToken } = require('../middleware/authMiddleware');


/**
 * @swagger
 * /aiot/pcbs:
 *   get:
 *     tags:
 *       - Sensor
 *     summary: 查詢 PCB 板子清單
 *     description: 查詢所有狀態為啟用的 PCB 版子相關設定資料。
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
 *                       QAID:
 *                         type: string
 *                       Desc:
 *                         type: string
 *                       ProjID:
 *                         type: string
 *                       STID:
 *                         type: string
 *                       numChs:
 *                         type: number
 *                       ParID:
 *                         type: string
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.get('/pcbs', verifyToken, async (req, res) => {
  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
        SELECT [QAID],[Desc],[ProjID],[STID],[numChs],[ParID]
        FROM [AIOT].[dbo].[cfgQaqcN]
        WHERE [Enabled] = 1
        ORDER BY [QAID]
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
 * /aiot/sensors/qaqc/test-serials:
 *   get:
 *     tags:
 *       - Sensor
 *     summary: 查詢感測器測試序號(SN)
 *     description: 根據指定時間範圍與篩選類型，查詢感測器品質測試紀錄的測試序號(SN)。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDateTime
 *         required: true
 *         schema:
 *           type: string
 *         description: 起始時間 (格式 yyyy-MM-dd HH:mm)
 *         example: "2026-01-01 10:46"
 *       - in: query
 *         name: endDateTime
 *         required: true
 *         schema:
 *           type: string
 *         description: 結束時間 (格式 yyyy-MM-dd HH:mm)
 *         example: "2026-11-13 10:46"
 *       - in: query
 *         name: filterType
 *         required: false
 *         schema:
 *           type: string
 *           default: test
 *           enum: [test, report]
 *         description: 篩選類型 (test = 依測試時間區間重疊篩選, report = 依報告建立時間區間重疊篩選)
 *         example: "test"
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
 *                       SN:
 *                         type: string
 *                       conConfig:
 *                         type: string
 *       '400':
 *         description: 請求參數錯誤
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.get('/sensors/qaqc/test-serials', verifyToken, async (req, res) => {
  const { startDateTime, endDateTime, filterType = 'test' } = req.query;

  if (![startDateTime, endDateTime].every(
    value => typeof value === 'string' && value.trim()
  )) {
    return res.status(400).json({
      success: false,
      message: 'Bad request',
    });
  }

  if (!['report', 'test'].includes(filterType)) {
    return res.status(400).json({ 
      success: false,
      message: 'Bad request',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    let query = `
      SELECT DISTINCT 
          n.[SN], 
          n.[conConfig]
      FROM [AIOT].[dbo].[logQaqcN] AS n
      LEFT JOIN [AIOT].[dbo].[logQaqcNRpt] AS r 
          ON n.[SN] = r.[SN]
    `;

    switch (filterType) {
      case 'test': {
        query += ` WHERE n.[dt_F] <= @endDateTime AND (n.[dt_T] >= @startDateTime OR n.[dt_T] IS NULL)`;
        break; 
      }
      case 'report': {
        query += ` WHERE r.[amdDate] BETWEEN @startDateTime AND @endDateTime`;
        break; 
      }
      default: {
        break;
      }
    }

    query += ` ORDER BY n.[SN];`;

    const result = await aiotDb
      .request()
      .input('startDateTime', sql.VarChar, startDateTime)
      .input('endDateTime', sql.VarChar, endDateTime)
      .query(query);

    return res.status(200).json({
      success: true,
      data: result.recordset
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
 * /aiot/sensors/qaqc/component-serials:
 *   get:
 *     tags:
 *       - Sensor
 *     summary: 查詢元件序號(PRSN)
 *     description: 支援依據測試序號(SN)進行精準篩選，以及依據關鍵字對元件序號(PRSN)進行模糊搜尋。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: SN
 *         required: false
 *         schema:
 *           type: string
 *         description: 測試序號(SN) (選填)
 *         example: "Q20260225001"
 *       - in: query
 *         name: keyword
 *         required: false
 *         schema:
 *           type: string
 *         description: 關鍵字搜尋 (選填)
 *         example: "0630003"
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
 *                       PRSN:
 *                         type: string
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.get('/sensors/qaqc/component-serials', verifyToken, async (req, res) => {
  const { SN, keyword } = req.query;

  try {
    const aiotDb = await getConnection('AIOT');

    let query = `
      SELECT DISTINCT [PRSN]
      FROM [AIOT].[dbo].[logQaqcNRpt]
      WHERE [PRSN] IS NOT NULL
          AND LTRIM(RTRIM([PRSN])) <> ''
    `;

    const request = aiotDb.request();

    if (SN && SN.trim() !== '') {
      query += ` AND [SN] = @SN`;
      request.input('SN', sql.VarChar, SN.trim());
    }

    if (keyword && keyword.trim() !== '') {
      query += ` AND [PRSN] LIKE '%' + @keyword + '%'`;
      request.input('keyword', sql.VarChar, keyword.trim());
    }
    
    query += ` ORDER BY [PRSN];`;

    const result = await request.query(query);

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
 * /aiot/sensors/qaqc/health-reports:
 *   get:
 *     tags:
 *       - Sensor
 *     summary: 查詢感測器品質檢測結果
 *     description: 根據指定時間範圍與選填篩選條件，查詢感測器品質檢測報告。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDateTime
 *         required: true
 *         schema:
 *           type: string
 *         description: 起始時間 (格式 yyyy-MM-dd)
 *         example: "2026-01-01"
 *       - in: query
 *         name: endDateTime
 *         required: true
 *         schema:
 *           type: string
 *         description: 結束時間 (格式 yyyy-MM-dd)
 *         example: "2026-11-17"
 *       - in: query
 *         name: SN
 *         required: false
 *         schema:
 *           type: string
 *         description: 測試序號(SN) (選填)
 *         example: "Q20260914001"
 *       - in: query
 *         name: PRSN
 *         required: false
 *         schema:
 *           type: string
 *         description: 元件序號(PRSN) (選填，支援前綴模糊搜尋)
 *         example: "HPMA115S0"
 *       - in: query
 *         name: validValues
 *         required: false
 *         schema:
 *           type: number
 *         description: 濃度差值 (選填)
 *         example: 0.5
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
 *                       BACHNO:
 *                         type: string
 *                       PRSN:
 *                         type: string
 *                       PSERNO:
 *                         type: string
 *                       SN:
 *                         type: string
 *                       dt_F:
 *                         type: string
 *                       healthyC:
 *                         type: number
 *                       itcC:
 *                         type: number
 *                       r2C:
 *                         type: number
 *                       rangeMax:
 *                         type: number
 *                       rangeMin:
 *                         type: number
 *                       slpC:
 *                         type: number
 *                       status:
 *                         type: string
 *                       stdC:
 *                         type: number
 *                       tagChs:
 *                         type: number
 *                       tagSTID:
 *                         type: string
 *       '400':
 *         description: 請求參數錯誤
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.get('/sensors/qaqc/health-reports', verifyToken, async (req, res) => {
  const { startDateTime, endDateTime, SN, PRSN, validValues } = req.query;

  if (![startDateTime, endDateTime].every(
    value => typeof value === 'string' && value.trim()
  )) {
    return res.status(400).json({
      success: false,
      message: 'Bad request',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    let query = `
      SELECT 
      	[SN],
        [PSERNO],
        [BACHNO],
        [PRSN],
        CONVERT(VARCHAR(19), [dt_F], 126) AS [dt_F],
        [slpC],
        [itcC],
        [r2C],
        [stdC],
        [healthyC],
        [status],
        [rangeMin],
        [rangeMax],
        [tagSTID],
        [tagChs]
      FROM [AIOT].[dbo].[logQaqcNRpt]
      WHERE [amdDate] >= @startDateTime
        AND [amdDate] < DATEADD(DAY, 1, CAST(@endDateTime AS DATE))
    `;

    const request = aiotDb.request();
    request.input('startDateTime', sql.VarChar, startDateTime)
    request.input('endDateTime', sql.VarChar, endDateTime)

    if (SN && SN.trim() !== '') {
      query += ` AND [SN] = @SN`;
      request.input('SN', sql.VarChar, SN.trim());
    }

    if (PRSN && PRSN.trim() !== '') {
      query += ` AND [PRSN] LIKE  @PRSN + '%'`;
      request.input('PRSN', sql.VarChar, PRSN.trim());
    }

    if (validValues !== null && validValues !== undefined) {
      query += ` AND [rangeMax] - [rangeMin] >= @validValues`;
      request.input('validValues', sql.Decimal, validValues);
    }

    const result = await request.query(query);

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
 * /aiot/sensors/qaqc/health-image/{SN}/{PRSN}:
 *   get:
 *     tags:
 *       - Sensor
 *     summary: 查詢感測器品質檢測報告結果圖片
 *     description: 根據測試序號(SN)與元件序號(PRSN)，查詢並檢查圖片是否存在且可讀取，若存在則直接回傳 JPG 圖片檔案。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: SN
 *         required: true
 *         schema:
 *           type: string
 *         description: 測試序號(SN)
 *         example: "Q20260914001"
 *       - in: path
 *         name: PRSN
 *         required: true
 *         schema:
 *           type: string
 *         description: 元件序號(PRSN)
 *         example: "HPMA115S0-XXXT0B184913990"
 *     responses:
 *       200:
 *         description: 成功取得感測器健康檢查圖片
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       '400':
 *         description: 請求參數錯誤
 *       '401':
 *         description: 身份驗證錯誤
 *       '404':
 *         description: 找不到資源
 *       '500':
 *         description: 伺服器錯誤
 */
router.get('/sensors/qaqc/health-image/:SN/:PRSN', verifyToken, async (req, res) => {
  const { SN, PRSN } = req.params;

  const imageBasePath = path.win32.resolve(
    '\\\\192.168.3.204\\JSEnE_new\\JS99_暫存區\\_datAIOT\\_QAQC01',
  );

  // 驗證序號格式，避免路徑穿越攻擊
  const safeNamePattern = /^[a-zA-Z0-9_-]+$/;
  const isValidParams = [SN, PRSN].every(
    (value) => typeof value === 'string' && safeNamePattern.test(value)
  );

  if (!isValidParams) {
    return res.status(400).json({
      success: false,
      message: 'Bad request',
    });
  }

  // 組合圖片路徑
  const fileLocation = path.win32.resolve(
    imageBasePath,
    SN,
    `${SN}_${PRSN}.jpg`,
  );

  // 驗證圖片路徑
  const relativePath = path.win32.relative(imageBasePath, fileLocation);

  if (relativePath === '..' || relativePath.startsWith(`..${path.win32.sep}`) || path.win32.isAbsolute(relativePath)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid image path',
    });
  }

  // 檢查檔案是否存在且可讀取
  fs.access(fileLocation, fs.constants.R_OK, (err) => {
    if (err) {
      console.error(`Image access error: ${fileLocation}`, err);

      return res.status(err.code === 'ENOENT' ? 404 : 500).json({
        success: false,
        message: err.code === 'ENOENT'
          ? 'Image not found'
          : 'Internal server error',
      });
    }

    // 回傳圖片
    res.sendFile(fileLocation, (err) => {
      if (err) {
        console.error(`Error sending file: ${fileLocation}`, err);

        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            message: 'Internal server error',
          });
        }
      }
    });
  });
});


/**
 * @swagger
 * /aiot/sensors/qaqc/test/{SN}:
 *   get:
 *     tags:
 *       - Sensor
 *     summary: 查詢指定測試序號的品質測試紀錄
 *     description: 根據指定測試序號查詢對應的測試設定和紀錄資料。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: SN
 *         required: true
 *         schema:
 *           type: string
 *           example: Q20260914001
 *         description: 測試序號(SN)
 *     responses:
 *       200:
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
 *                       SN:
 *                         type: string
 *                       QAID:
 *                         type: string
 *                       STID:
 *                         type: string
 *                       PSERNO:
 *                         type: string
 *                       refSTID:
 *                         type: string
 *                       refChs:
 *                         type: number
 *                       dt_F:
 *                         type: string
 *                       dt_T:
 *                         type: string
 *                       qaCease:
 *                         type: number
 *                       numChs:
 *                         type: number
 *                       conConfig:
 *                         type: string
 *       400:
 *         description: 參數錯誤
 *       '401':
 *         description: 身份驗證錯誤
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/sensors/qaqc/test/:SN', verifyToken, async (req, res) => {
  const { SN } = req.params;

  if (![SN].every(
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
        a.[SN],
        b.[QAID],
        b.[STID],
        a.[PSERNO],
        a.[refSTID],
        a.[refChs],
        a.[dt_F],
        a.[dt_T],
        a.[qaCease],
        b.[numChs],
        a.[conConfig]
      FROM [AIOT].[dbo].[logQaqcN] a
      LEFT JOIN [AIOT].[dbo].[cfgQaqcN] b ON a.STID = b.STID
      WHERE [SN] = @SN
    `;
    const result = await aiotDb
      .request()
      .input('SN', sql.VarChar, SN)
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
 * /aiot/sensors/qaqc/test:
 *   post:
 *     tags:
 *       - Sensor
 *     summary: 新增品質測試紀錄
 *     description: 一次新增多筆測試紀錄，自動產生當日測試序號 SN，格式為 QyyyyMMddNNN。同一批資料共用相同 SN，僅 QAID 為必填。
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             minItems: 1
 *             items:
 *               type: object
 *               required:
 *                 - QAID
 *               properties:
 *                 QAID:
 *                   type: string
 *                   minLength: 1
 *                   description: 板子編號 (必填)
 *                   example: "QA20250001"
 *                 STID:
 *                   type: string
 *                   nullable: true
 *                   description: 板子型號 (選填)
 *                   example: "BUARS01"
 *                 PSERNO:
 *                   type: string
 *                   nullable: true
 *                   description: 感測器：品號、批號、元件序號 (選填)
 *                   example: "TEST,TEST,TEST1|TEST,TEST,TEST2|,,|,,|,,|,,|,,|,,|,,|,,|,,|,,|,,|,,"
 *                 refSTID:
 *                   type: string
 *                   nullable: true
 *                   description: 參考電路板編號 (選填)
 *                   example: "BUARS01"
 *                 refChs:
 *                   type: integer
 *                   nullable: true
 *                   description: 參考測項編號 (選填)
 *                   example: 3
 *                 startDateTime:
 *                   type: string
 *                   nullable: true
 *                   description: 開始時間 (格式 yyyy-MM-dd HH:mm，選填)
 *                   example: "2026-11-17 16:09"
 *                 endDateTime:
 *                   type: string
 *                   nullable: true
 *                   description: 結束時間 (格式 yyyy-MM-dd HH:mm，選填)
 *                   example: "2026-11-19 16:09"
 *                 conConfig:
 *                   type: string
 *                   nullable: true
 *                   description: 測試設定說明 (選填)
 *                   example: null
 *     responses:
 *       '200':
 *         description: 新增成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "新增成功"
 *       '400':
 *         description: 請求參數錯誤
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.post('/sensors/qaqc/test', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const requestData = req.body;

  if (!Array.isArray(requestData) || requestData.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Bad request',
    });
  }

  // 驗證每筆資料
  const isValidRequest = requestData.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }

    const {
      QAID,
      STID,
      PSERNO,
      refSTID,
      refChs,
      startDateTime,
      endDateTime,
      conConfig,
    } = item;

    return (
      [QAID].every(
        value => typeof value === 'string' && value.trim()
      ) &&
      [STID, PSERNO, refSTID, startDateTime, endDateTime, conConfig].every(
        value => value == null || typeof value === 'string'
      ) &&
      (refChs == null || Number.isInteger(refChs))
    );
  });

  if (!isValidRequest) {
    return res.status(400).json({
      success: false,
      message: 'Bad request',
    });
  }

  let transaction;
  let transactionStarted = false;

  try {
    const aiotDb = await getConnection('AIOT');

    transaction = new sql.Transaction(aiotDb);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;

    // 鎖定 SN 產生流程，避免同時新增產生重複序號
    const lockResult = await transaction
      .request()
      .input('Resource', sql.NVarChar, 'logQaqcN_SN')
      .input('LockMode', sql.VarChar, 'Exclusive')
      .input('LockOwner', sql.VarChar, 'Transaction')
      .input('LockTimeout', sql.Int, 10000)
      .query(`
        DECLARE @lockResult INT;

        EXEC @lockResult = sp_getapplock
          @Resource = @Resource,
          @LockMode = @LockMode,
          @LockOwner = @LockOwner,
          @LockTimeout = @LockTimeout;

        SELECT @lockResult AS lockResult;
      `);

    if (
      lockResult.recordset[0]?.lockResult == null ||
      lockResult.recordset[0].lockResult < 0
    ) {
      throw new Error('Failed to acquire SN lock');
    }

    const today = new Date();
    const todayStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('');

    const query = `
      SELECT TOP (1) [SN]
      FROM [AIOT].[dbo].[logQaqcN] WITH (UPDLOCK, HOLDLOCK)
      ORDER BY [SN] DESC;
    `;

    const result = await transaction.request().query(query);

    const lastSN = result.recordset[0]?.SN;
    const sequence = lastSN?.substring(1, 9) === todayStr
      ? Number(lastSN.slice(-3)) + 1
      : 1;

    // 每日流水號限制為 001 ~ 999
    if (!Number.isInteger(sequence) || sequence > 999) {
      await transaction.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: 'Daily SN limit exceeded',
      });
    }

    const newSN = `Q${todayStr}${String(sequence).padStart(3, '0')}`;

    const query2 = `
      INSERT INTO [AIOT].[dbo].[logQaqcN]
        ([SN], [QAID], [STID], [PSERNO], [refSTID], [refChs], [qaCease], [amdEID], [dt_F], [dt_T], [conConfig])
      VALUES
        (@SN, @QAID, @STID, @PSERNO, @refSTID, @refChs, @qaCease, @amdEID, @startDateTime, @endDateTime, @conConfig);
    `;

    for (const {
      QAID,
      STID,
      PSERNO,
      refSTID,
      refChs,
      startDateTime,
      endDateTime,
      conConfig,
    } of requestData) {
      await transaction
        .request()
        .input('SN', sql.VarChar, newSN)
        .input('QAID', sql.VarChar, QAID)
        .input('STID', sql.VarChar, STID)
        .input('PSERNO', sql.VarChar, PSERNO)
        .input('refSTID', sql.VarChar, refSTID)
        .input('refChs', sql.Int, refChs)
        .input('qaCease', sql.Int, 1)
        .input('amdEID', sql.VarChar, ID)
        .input('startDateTime', sql.VarChar, startDateTime)
        .input('endDateTime', sql.VarChar, endDateTime)
        .input('conConfig', sql.NVarChar, conConfig)
        .query(query2);
    }

    await transaction.commit();
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: '新增成功',
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
        transactionStarted = false;
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error(`${req.method} ${req.originalUrl} error:`, error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});


/**
 * @swagger
 * /aiot/sensors/qaqc/test/{SN}/calculate:
 *   post:
 *     tags:
 *       - Sensor
 *     summary: 啟動品質測試計算
 *     description: 根據測試序號 SN，刪除原有的品保品管測試報告，並將對應測試紀錄的 qaCease 設為 0，以啟動重新計算。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: SN
 *         required: true
 *         schema:
 *           type: string
 *         description: 測試序號
 *         example: "Q20261120001"
 *     responses:
 *       '200':
 *         description: 已啟動計算
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "已啟動計算"
 *       '400':
 *         description: 請求參數錯誤
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.post('/sensors/qaqc/test/:SN/calculate', verifyToken, async (req, res) => {
  const { SN } = req.params;

  if (![SN].every(
    value => typeof value === 'string' && value.trim()
  )) {
    return res.status(400).json({
      success: false,
      message: 'Bad request',
    });
  }

  let transaction;
  let transactionStarted = false;

  try {
    const aiotDb = await getConnection('AIOT');

    transaction = new sql.Transaction(aiotDb);
    await transaction.begin();
    transactionStarted = true;

    const query = `
      DELETE FROM [AIOT].[dbo].[logQaqcNRpt] 
      WHERE [SN] = @SN;
    `;

    await transaction
      .request()
      .input('SN', sql.VarChar, SN)
      .query(query);

    const query2 = `
      UPDATE [AIOT].[dbo].[logQaqcN] 
      SET [qaCease] = 0 
      WHERE [SN] = @SN;
    `;

    await transaction
      .request()
      .input('SN', sql.VarChar, SN)
      .query(query2);

    await transaction.commit();
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: '已啟動計算',
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
        transactionStarted = false;
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error(`${req.method} ${req.originalUrl} error:`, error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});


/**
 * @swagger
 * /aiot/sensors/qaqc/test/{SN}:
 *   put:
 *     tags:
 *       - Sensor
 *     summary: 修改品質測試紀錄
 *     description: 根據測試序號(SN)批次修改感測器品質測試紀錄，透過 SN 與 QAID 定位資料，不修改 SN、QAID 及 STID。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: SN
 *         required: true
 *         schema:
 *           type: string
 *         description: 測試序號
 *         example: "Q20261120001"
 *     requestBody:
 *       required: true
 *       description: 批次修改測試紀錄，records 為必填陣列，至少包含一筆資料。
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - records
 *             properties:
 *               records:
 *                 type: array
 *                 minItems: 1
 *                 description: 感測器品保品管測試紀錄清單
 *                 items:
 *                   type: object
 *                   required:
 *                     - QAID
 *                   properties:
 *                     QAID:
 *                       type: string
 *                       minLength: 1
 *                       description: 板子編號 (必填，僅用於定位資料，不進行修改)
 *                       example: "QA20250001"
 *                     PSERNO:
 *                       type: string
 *                       nullable: true
 *                       description: 感測器：品號、批號、元件序號 (選填)
 *                       example: "TEST,TEST,TEST1|TEST,TEST,TEST2"
 *                     refSTID:
 *                       type: string
 *                       nullable: true
 *                       description: 參考電路板編號 (選填)
 *                       example: "BUARS02"
 *                     refChs:
 *                       type: integer
 *                       nullable: true
 *                       description: 參考測項編號 (選填)
 *                       example: 3
 *                     startDateTime:
 *                       type: string
 *                       nullable: true
 *                       description: 開始時間 (格式 yyyy-MM-dd HH:mm，選填)
 *                       example: "2026-11-19 14:36"
 *                     endDateTime:
 *                       type: string
 *                       nullable: true
 *                       description: 結束時間 (格式 yyyy-MM-dd HH:mm，選填)
 *                       example: "2026-11-20 14:36"
 *                     conConfig:
 *                       type: string
 *                       nullable: true
 *                       description: 測試設定說明 (選填，允許 null 或空字串)
 *                       example: ""
 *           example:
 *             records:
 *               - QAID: "QA20250001"
 *                 PSERNO: "TEST,TEST,TEST1|TEST,TEST,TEST2|,,|,,|,,|,,|,,|,,|,,|,,|,,|,,|,,|,,"
 *                 refSTID: "BUARS02"
 *                 refChs: 3
 *                 startDateTime: "2026-11-19 14:36"
 *                 endDateTime: "2026-11-20 14:36"
 *                 conConfig: ""
 *               - QAID: "QA20250002"
 *                 PSERNO: "TEST2,TEST2,TEST22|TEST2,TEST2,TEST23|,,|,,|,,|,,|,,|,,|,,|,,|,,|,,|,,|,,"
 *                 refSTID: "BUARS02"
 *                 refChs: 3
 *                 startDateTime: "2026-11-19 14:36"
 *                 endDateTime: "2026-11-20 14:36"
 *                 conConfig: ""
 *     responses:
 *       '200':
 *         description: 修改成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "修改成功"
 *       '400':
 *         description: 請求參數錯誤
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.put('/sensors/qaqc/test/:SN', verifyToken, async (req, res) => {
  const { SN } = req.params;
  const { records } = req.body;

if (
    ![SN].every(
      value => typeof value === 'string' && value.trim()
    ) ||
    !Array.isArray(records) ||
    records.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Bad request',
    });
  }

  const isValidRequest = records.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }

    const {
      QAID,
      PSERNO,
      refSTID,
      refChs,
      startDateTime,
      endDateTime,
      conConfig,
    } = item;

    return (
      [QAID].every(
        value => typeof value === 'string' && value.trim()
      ) &&
      [PSERNO, refSTID, startDateTime, endDateTime, conConfig].every(
        value => value == null || typeof value === 'string'
      ) &&
      (refChs == null || Number.isInteger(refChs))
    );
  });

  if (!isValidRequest) {
    return res.status(400).json({
      success: false,
      message: 'Bad request',
    });
  }

  let transaction;
  let transactionStarted = false;

  try {
    const aiotDb = await getConnection('AIOT');

    transaction = new sql.Transaction(aiotDb);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;

    const query2 = `
      UPDATE [AIOT].[dbo].[logQaqcN]
      SET [PSERNO] = @PSERNO,
          [refSTID] = @refSTID,
          [refChs] = @refChs,
          [dt_F] = @startDateTime,
          [dt_T] = @endDateTime,
          [conConfig] = @conConfig
      WHERE [SN] = @SN AND [QAID] = @QAID;
    `;

    for (const {
      QAID,
      PSERNO,
      refSTID,
      refChs,
      startDateTime,
      endDateTime,
      conConfig,
    } of records) {
      await transaction
        .request()
        .input('SN', sql.VarChar, SN)
        .input('QAID', sql.VarChar, QAID)
        .input('PSERNO', sql.VarChar, PSERNO)
        .input('refSTID', sql.VarChar, refSTID)
        .input('refChs', sql.Int, refChs)
        .input('startDateTime', sql.VarChar, startDateTime)
        .input('endDateTime', sql.VarChar, endDateTime)
        .input('conConfig', sql.NVarChar, conConfig )
        .query(query2);
    }

    await transaction.commit();
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: '修改成功',
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
        transactionStarted = false;
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error(`${req.method} ${req.originalUrl} error:`, error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});


/**
 * @swagger
 * /aiot/sensors/qaqc/test/{SN}:
 *   delete:
 *     tags:
 *       - Sensor
 *     summary: 刪除指定測試序號的測試紀錄
 *     description: 根據測試序號SN，刪除對應的品質測試報告與測試紀錄。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: SN
 *         required: true
 *         schema:
 *           type: string
 *         description: 測試序號(SN)
 *         example: "Q20261119001"
 *     responses:
 *       '200':
 *         description: 刪除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "刪除成功"
 *       '400':
 *         description: 請求參數錯誤
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.delete('/sensors/qaqc/test/:SN', verifyToken, async (req, res) => {
  const { SN } = req.params;

  if (![SN].every(
    value => typeof value === 'string' && value.trim()
  )) {
    return res.status(400).json({
      success: false,
      message: 'Bad request',
    });
  }

  let transaction;
  let transactionStarted = false;

  try {
    const aiotDb = await getConnection('AIOT');

    transaction = new sql.Transaction(aiotDb);
    await transaction.begin();
    transactionStarted = true;

    const query = 'DELETE FROM [AIOT].[dbo].[logQaqcNRpt] WHERE [SN] = @SN;';
    await transaction
      .request()
      .input('SN', sql.VarChar, SN)
      .query(query);

    const query2 = 'DELETE FROM [AIOT].[dbo].[logQaqcN] WHERE [SN] = @SN;';
    await transaction
      .request()
      .input('SN', sql.VarChar, SN)
      .query(query2);

    await transaction.commit();
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: '刪除成功',
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
        transactionStarted = false;
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error(`${req.method} ${req.originalUrl} error:`, error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});


/**
 * @swagger
 * /aiot/sensors/replace:
 *   get:
 *     tags:
 *       - Sensor
 *     summary: 查詢感測器更換至測站紀錄
 *     description: 根據使用者測站權限，查詢感測器更換紀錄，支援測站、感測器編號及時間範圍等篩選條件。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: station
 *         required: false
 *         schema:
 *           type: string
 *         description: 測站(STID或IIT)
 *         example: "O30477"
 *       - in: query
 *         name: PRSN
 *         required: false
 *         schema:
 *           type: string
 *         description: 元件序號 (選填,支援模糊搜尋)
 *         example: "HPMA115S0"
 *       - in: query
 *         name: startDateTime
 *         required: false
 *         schema:
 *           type: string
 *         description: 起始時間 (格式 yyyy-MM-dd HH:mm)
 *         example: "2026-11-01 00:00"
 *       - in: query
 *         name: endDateTime
 *         required: false
 *         schema:
 *           type: string
 *         description: 結束時間 (格式 yyyy-MM-dd HH:mm)
 *         example: "2026-11-13 23:59"
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
 *                       amdDate:
 *                         type: string
 *                       PRSN:
 *                         type: string
 *                       STID:
 *                         type: string
 *                       IIT:
 *                         type: string
 *                       CNAME:
 *                         type: string
 *                       amdEID:
 *                         type: string
 *                       slpC:
 *                         type: number
 *                       itcC:
 *                         type: number
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.get('/sensors/replace', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { station, PRSN, startDateTime, endDateTime } = req.query;

  try {
    const aiotDb = await getConnection('AIOT');

    let query = `
      SELECT 
        A.[amdDate], 
        A.[PRSN], 
        X.[STID], 
        S.[IIT], 
        C.[CNAME], 
        A.[amdEID], 
        B.[slpC], 
        B.[itcC]
      FROM [AIOT].[dbo].[logSensor] A
      CROSS APPLY (
        SELECT PARSENAME(REPLACE(A.[conNote], ',', '.'), 2) AS STID
      ) X
      OUTER APPLY (
        SELECT TOP (1) Q.[slpC], Q.[itcC]
        FROM [AIOT].[dbo].[logQaqcNRpt] Q
        WHERE Q.[PRSN] = A.[PRSN]
        ORDER BY Q.[amdDate] DESC
      ) B
      INNER JOIN [AIOT].[dbo].[ctrlStation] S
        ON X.[STID] = S.[STID]
      LEFT JOIN [192.168.3.202].[WebAIOT].[dbo].[sys_ERPaccount] C
        ON A.[amdEID] = C.[ID]
      WHERE 
        S.[Enabled] = 1
        AND EXISTS (
          SELECT 1 
          FROM [192.168.3.202].[WebAIOT].[dbo].[cfg_CtrlUserPJID] u
          WHERE u.[ID] = @UserId 
            AND u.[ENABLE] = 1 
            AND u.[PROJID] = S.[ProjID]
            AND (
              u.[ALL] = '1'
              OR (u.[ST_STID] IS NOT NULL AND u.[ED_STID] IS NOT NULL AND X.[STID] BETWEEN u.[ST_STID] AND u.[ED_STID])
              OR (u.[IN_STID] IS NOT NULL AND X.[STID] IN (SELECT value FROM STRING_SPLIT(u.[IN_STID], ',')))
            )
        )
    `;

    const request = aiotDb.request();
    request.input('UserId', sql.VarChar, ID);

    if (station && station.trim() !== '') {
      query += ` AND (X.[STID] = @station OR S.[IIT] = @station)`;
      request.input('station', sql.VarChar, station.trim());
    }

    if (PRSN && PRSN.trim() !== '') {
      query += ` AND A.[PRSN] LIKE @PRSN`;
      request.input('PRSN', sql.VarChar, `%${PRSN.trim()}%`);
    }

    if (startDateTime && startDateTime.trim() !== '') {
      query += ` AND A.[amdDate] >= @startDateTime`;
      request.input('startDateTime', sql.VarChar, startDateTime.trim());
    }

    if (endDateTime && endDateTime.trim() !== '') {
      query += ` AND A.[amdDate] <= @endDateTime`;
      request.input('endDateTime', sql.VarChar, endDateTime.trim());
    }

    query += ` ORDER BY A.[amdDate] DESC;`;

    const result = await request.query(query);

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
 * /aiot/sensors/replace:
 *   post:
 *     tags:
 *       - Sensor
 *     summary: 更換測站感測器
 *     description: 根據專案編號、測站編號及新感測器元件序號，更換測站 PM2.5 感測器。更新測站校正係數（slpC、itcC），將原感測器狀態改為「替換」，並新增感測器上線紀錄。
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - PJID
 *               - STID
 *               - newSensorSn
 *             properties:
 *               PJID:
 *                 type: string
 *                 description: 專案編號
 *                 example: "PJ001"
 *               STID:
 *                 type: string
 *                 description: 測站編號
 *                 example: "O30477"
 *               newSensorSn:
 *                 type: string
 *                 description: 新感元件序號(PRSN)
 *                 example: "HPMA115S0"
 *     responses:
 *       '200':
 *         description: 感測器更換成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "更新成功"
 *       '400':
 *         description: 請求參數錯誤
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */

router.post('/sensors/replace', verifyToken, async (req, res) => {
  const { PJID, STID, newSensorSn } = req.body;
  const { ID } = req.user;

  if (![PJID, STID, newSensorSn].every(
    value => typeof value === 'string' && value.trim()
  )) {
    return res.status(400).json({
      success: false,
      message: 'Bad request',
    });
  }


  let transaction;
  let transactionStarted = false;

  try {
    const aiotDb = await getConnection('AIOT');

    transaction = new sql.Transaction(aiotDb);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;

    const query = `
            SELECT [ProjID],[STID],[IIT],[ParName1],[ParName2],[ParName3],[ParName4],[ParName5],[ParName6],[ParName7],[ParName8]
            FROM [AIOT].[dbo].[ctrlStation] A WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN [AIOT].[dbo].[cfgModel] B
                ON A.Model = B.Model
            WHERE [ProjID] = @PJID
              AND [STID] = @station;

            SELECT TOP (1)[SN],[PSERNO],[BACHNO],[PRSN],[slpC],[itcC],[r2C],[healthyC],[status]
            FROM [AIOT].[dbo].[logQaqcNRpt]
            WHERE [PRSN] = @newSensorSn
            ORDER BY [dt_T] DESC;
        `;

    const result = await transaction
      .request()
      .input('PJID', sql.VarChar, PJID)
      .input('station', sql.VarChar, STID)
      .input('newSensorSn', sql.VarChar, newSensorSn)
      .query(query);

    const station = result.recordsets[0][0];
    const sensor = result.recordsets[1][0];

    const parKey = Object.keys(station).find(
      (k) => k.startsWith('ParName') && station[k] === 'PM2.5',
    );

    if (!parKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'PM2.5 Not found' 
      });
    }

    const parNumber = Number(parKey.replace('ParName', ''));
    const conNote = `${PJID},${STID},${parNumber}`;

    const query2 = `
        SELECT TOP (1) *
        FROM [AIOT].[dbo].[logSensor]
        WHERE [conNote] = @conNote 
          AND [sortB] = '上線'
        ORDER BY [amdDate] ASC;
    `;

    const result2 = await aiotDb
      .request()
      .input('conNote', sql.VarChar, conNote)
      .query(query2);

    const oldSensor = result2.recordset[0];

    if (oldSensor) {
      const query3 = `
          UPDATE [AIOT].[dbo].[logSensor]
          SET [sortB] = N'替換'
          WHERE [PRSN] = @oldPRSN 
            AND [sortB] = '上線';
      `;
      await transaction
        .request()
        .input('oldPRSN', sql.VarChar, oldSensor.PRSN)
        .input('amdEID', sql.VarChar, ID)
        .query(query3);
    }

    const query4 = `
            UPDATE [AIOT].[dbo].[ctrlStation]
            SET [slpC${parNumber}] = @slpC,
                [itcC${parNumber}] = @itcC,
                [amdEID] = @amdEID,
                [amdDate] = GETDATE()
            WHERE [ProjID] = @PJID 
                AND [STID] = @station
            
            INSERT INTO [AIOT].[dbo].[logSensor]
            ([SN],[PSERNO],[BACHNO],[PRSN],[sortA],[sortB],[conNote],[amdEID],[amdDate])
            VALUES
            (@SN,@PSERNO,@BACHNO,@PRSN,N'出庫',N'上線',@conNote,@amdEID,GETDATE())
            
        `;

    await transaction
      .request()
      .input('slpC', sql.Decimal(12, 5), sensor.slpC)
      .input('itcC', sql.Decimal(12, 5), sensor.itcC)
      .input('PJID', sql.VarChar, PJID)
      .input('station', sql.VarChar, STID)
      .input('SN', sql.VarChar, sensor.SN)
      .input('PSERNO', sql.VarChar, sensor.PSERNO)
      .input('BACHNO', sql.VarChar, sensor.BACHNO)
      .input('PRSN', sql.VarChar, sensor.PRSN)
      .input('conNote', sql.VarChar, `${PJID},${STID},${parNumber}`)
      .input('amdEID', sql.VarChar, ID)
      .query(query4);

    await transaction.commit();
    transactionStarted = false;

    res.status(200).json({
      success: true,
      message: '更新成功',
    });

  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
        transactionStarted = false;
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error(`${req.method} ${req.originalUrl} error:`, error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});


module.exports = router;
