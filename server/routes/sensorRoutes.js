const express = require('express');
const router = express.Router();
const sql = require('mssql');
const path = require('path');
const fs = require('fs');
const { getConnection } = require('../db/pool');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/sensor/replacementReport', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { station, PRSN, startDateTime, endDateTime } = req.body;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
      SELECT A.[amdDate], A.[PRSN], X.[STID], S.[IIT], C.[CNAME], A.[amdEID], B.[slpC], B.[itcC]
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
      LEFT JOIN [AIOT].[dbo].[ctrlStation] S
          ON X.[STID] = S.[STID]
      LEFT JOIN [192.168.3.202].[WebAIOT].[dbo].[sys_ERPaccount] C
          ON A.[amdEID] = C.[ID]
      WHERE
        (@station IS NULL OR X.[STID] = @station OR S.[IIT] = @station)
        AND (@PRSN IS NULL OR A.[PRSN] LIKE '%' + @PRSN + '%')
        AND (@startDateTime IS NULL OR A.[amdDate] >= @startDateTime)
        AND (@endDateTime IS NULL OR A.[amdDate] <= @endDateTime)
      ORDER BY A.[amdDate] DESC;
    `;

    const query2 = `EXEC [dbo].[GetUserStations] @ID = @ID, @Enabled = 1`;

    const result = await aiotDb
      .request()
      .input('station', sql.VarChar, station || null)
      .input('PRSN', sql.VarChar, PRSN || null)
      .input('startDateTime', sql.VarChar, startDateTime || null)
      .input('endDateTime', sql.VarChar, endDateTime || null)
      .query(query);

    const result2 = await aiotDb.request().input('ID', sql.VarChar, ID).query(query2);

    const visibleStidSet = new Set(result2.recordset.map((row) => row.STID));

    const filtered = result.recordset.filter((row) => row.STID && visibleStidSet.has(row.STID));

    res.status(200).json({
      success: true,
      data: filtered,
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

// 測試序號: 以區間去查詢
router.post('/sensors/test-serials', verifyToken, async (req, res) => {
  const { startDateTime, endDateTime } = req.body;

  if (!startDateTime || !endDateTime) {
    return res.status(400).json({ success: false, message: '日期區間為必填欄位。' });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
      SELECT DISTINCT [SN] FROM [AIOT].[dbo].[logQaqcNRpt] 
      WHERE [amdDate] BETWEEN @startDateTime AND @endDateTime
    `;
    const result = await aiotDb
      .request()
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

// 元件序號: 有 SN → 查該 SN 的 PRSN, 無 SN → 下拉模糊搜尋 PRSN
router.post('/sensors/component-serials', verifyToken, async (req, res) => {
  const { SN = '', keyword = '' } = req.body;

  try {
    const aiotDb = await getConnection('AIOT');

    let query;
    let result;

    if (SN) {
      query = `
        SELECT DISTINCT [PRSN]
        FROM [AIOT].[dbo].[logQaqcNRpt]
        WHERE [SN] = @SN
          AND [PRSN] IS NOT NULL
          AND LTRIM(RTRIM([PRSN])) <> ''
        ORDER BY [PRSN];
      `;

      result = await aiotDb.request().input('SN', sql.VarChar, SN).query(query);
    } else {
      query = `
        SELECT DISTINCT [PRSN]
        FROM [AIOT].[dbo].[logQaqcNRpt]
        WHERE [PRSN] IS NOT NULL
          AND LTRIM(RTRIM([PRSN])) <> ''
          AND [PRSN] LIKE '%' + @keyword + '%'
        ORDER BY [PRSN];
      `;

      result = await aiotDb.request().input('keyword', sql.VarChar, keyword).query(query);
    }

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

// sensor 健康度結果報告
router.post('/sensors/health-reports', verifyToken, async (req, res) => {
  const { startDateTime, endDateTime, SN, PRSN, validValues } = req.body;

  if (!startDateTime || !endDateTime) {
    return res.status(400).json({ success: false, message: '日期區間為必填欄位。' });
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
        AND ([rangeMax] - [rangeMin] = 0
    `;

    if (validValues !== null) {
      query += ` OR [rangeMax] - [rangeMin] >= @validValues)`;
    } else {
      query += ` OR [rangeMax] - [rangeMin] >= 0)`;
    }

    if (SN && SN.trim() !== null) {
      query += ` AND [SN] = @SN`;
    }

    if (PRSN && PRSN.trim() !== null) {
      query += ` AND [PRSN] LIKE '%' + @PRSN`;
    }

    const result = await aiotDb
      .request()
      .input('startDateTime', sql.VarChar, startDateTime)
      .input('endDateTime', sql.VarChar, endDateTime)
      .input('SN', sql.VarChar, SN || null)
      .input('PRSN', sql.VarChar, PRSN || null)
      .input('validValues', sql.Decimal, validValues)
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

router.post('/sensors/health-image', verifyToken, async (req, res) => {
  const { imagePath } = req.body;
  const imageBasePath = path.resolve(
    '\\\\192.168.3.204\\JSEnE_new\\JS99_暫存區\\_datAIOT\\_QAQC01',
  );

  if (!imagePath || typeof imagePath !== 'string') {
    return res.status(400).json({ imageExists: false, error: 'imagePath is required' });
  }

  const fileLocation = path.resolve(imageBasePath, imagePath);
  const relativePath = path.relative(imageBasePath, fileLocation);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return res.status(400).json({ imageExists: false, error: 'Invalid image path' });
  }

  // 檢查檔案是否存在
  fs.access(fileLocation, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(`File not found: ${fileLocation}`);
      return res.status(404).json({ imageExists: false, error: 'Image not found' });
    }
    // 如果檔案存在，告訴前端檔案存在並傳送檔案
    res.sendFile(fileLocation, (err) => {
      if (err) {
        return res.status(500).json({ imageExists: true, error: 'Error sending file' });
      }
    });
  });
});

router.post('/sensors/qaqc/test-serials', verifyToken, async (req, res) => {
  const { startDateTime, endDateTime } = req.body;

  if (!startDateTime || !endDateTime) {
    return res.status(400).json({ success: false, message: '日期區間為必填欄位。' });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
      SELECT DISTINCT [SN],[conConfig] 
      FROM [AIOT].[dbo].[logQaqcN] 
      WHERE
        [dt_F] < @EndDateTime
        AND (
            [dt_T] > @StartDateTime
            OR [dt_T] IS NULL
        )
      ORDER BY [SN];`
    const result = await aiotDb
      .request()
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

router.post('/sensors/qaqc/SN', verifyToken, async (req, res) => {
  const { SN } = req.body;
  if (!SN) return res.status(400).json({ success: false, message: 'SN 為必填。' });
  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
      SELECT a.[SN],b.[QAID],b.[STID],a.[PSERNO],a.[refSTID],a.[refChs],a.[dt_F],a.[dt_T],a.[qaCease],b.[numChs],a.[conConfig]
      FROM [AIOT].[dbo].[logQaqcN] a
      LEFT JOIN [AIOT].[dbo].[cfgQaqcN] b ON a.STID = b.STID
      WHERE [SN] = @SN
    `;
    const result = await aiotDb.request().input('SN', sql.VarChar, SN).query(query);

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

router.post('/add/sensors/qaqc/SN', verifyToken, async (req, res) => {
  const requestData = req.body;
  const { ID } = req.user;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  if (!Array.isArray(requestData) || requestData.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'requestData is required.',
    });
  }

  let transaction;

  try {
    const aiotDb = await getConnection('AIOT');
    transaction = new sql.Transaction(aiotDb);
    await transaction.begin();

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
    const sequence = lastSN?.substring(1, 9) === todayStr ? Number(lastSN.slice(-3)) + 1 : 1;
    const newSN = `Q${todayStr}${String(sequence).padStart(3, '0')}`;

    const query2 = `
      INSERT INTO [AIOT].[dbo].[logQaqcN]
        ([SN], [QAID], [STID], [PSERNO], [refSTID], [refChs], [qaCease], [amdEID], [dt_F], [dt_T], [conConfig])
      VALUES
        (@SN, @QAID, @STID, @PSERNO, @refSTID, @refChs, @qaCease, @amdEID, @startDateTime, @endDateTime, @conConfig);
    `;

    for (const item of requestData) {
      await transaction
        .request()
        .input('SN', sql.VarChar, newSN)
        .input('QAID', sql.VarChar, item.QAID)
        .input('STID', sql.VarChar, item.STID)
        .input('PSERNO', sql.VarChar, item.PSERNO)
        .input('refSTID', sql.VarChar, item.refSTID)
        .input('refChs', sql.Int, item.refChs)
        .input('qaCease', sql.Int, 1)
        .input('amdEID', sql.VarChar, ID)
        .input('startDateTime', sql.VarChar, item.startDateTime)
        .input('endDateTime', sql.VarChar, item.endDateTime)
        .input('conConfig', sql.NVarChar, item.conConfig || '')
        .query(query2);
    }

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: '新增成功',
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error(`${req.method} ${req.originalUrl} error:`, error);
    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.put('/update/sensors/qaqc/SN', verifyToken, async (req, res) => {
  const { SN, records } = req.body;
  const { ID } = req.user;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  if (!SN || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, message: 'SN 與 records 為必填。' });
  }

  let transaction;
  try {
    const aiotDb = await getConnection('AIOT');
    transaction = new sql.Transaction(aiotDb);
    await transaction.begin();

    const query = `
      SELECT [QAID]
      FROM [AIOT].[dbo].[logQaqcN] WITH (UPDLOCK, HOLDLOCK)
      WHERE [SN] = @SN;
    `;
    const result = await transaction.request().input('SN', sql.VarChar, SN).query(query);

    const existingQAIDs = result.recordset.map((item) => String(item.QAID)).sort();
    const requestedQAIDs = records.map((item) => String(item.QAID)).sort();
    if (
      existingQAIDs.length === 0 ||
      requestedQAIDs.some((QAID) => !QAID) ||
      new Set(requestedQAIDs).size !== requestedQAIDs.length ||
      existingQAIDs.length !== requestedQAIDs.length ||
      existingQAIDs.some((QAID, index) => QAID !== requestedQAIDs[index])
    ) {
      await transaction.rollback();
      transaction = null;
      return res.status(400).json({
        success: false,
        message: '編輯時不可新增、移除或變更 QAID。',
      });
    }

    const query2 = `
      UPDATE [AIOT].[dbo].[logQaqcN]
      SET [PSERNO] = @PSERNO,
          [refSTID] = @refSTID,
          [refChs] = @refChs,
          [dt_F] = @dt_F,
          [dt_T] = @dt_T,
          [conConfig] = @conConfig
      WHERE [SN] = @SN AND [QAID] = @QAID;
    `;

    for (const item of records) {
      const updateResult = await transaction
        .request()
        .input('SN', sql.VarChar, SN)
        .input('QAID', sql.VarChar, item.QAID)
        .input('PSERNO', sql.VarChar, item.PSERNO)
        .input('refSTID', sql.VarChar, item.refSTID)
        .input('refChs', sql.Int, item.refChs)
        .input('dt_F', sql.VarChar, item.startDateTime)
        .input('dt_T', sql.VarChar, item.endDateTime)
        .input('conConfig', sql.NVarChar, item.conConfig || '')
        .query(query2);

      if (!updateResult.rowsAffected[0]) {
        await transaction.rollback();
        transaction = null;
        return res.status(404).json({
          success: false,
          message: `查無 QAID ${item.QAID} 的 QAQC 紀錄。`,
        });
      }
    }

    await transaction.commit();
    transaction = null;

    res.status(200).json({
      success: true,
      message: '修改成功',
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.put('/update/sensors/qaqc/qaCease', verifyToken, async (req, res) => {
  const { SN } = req.body;

  if (!SN) {
    return res.status(400).json({
      success: false,
      message: 'SN 為必填。',
    });
  }

  let transaction;
  try {
    const aiotDb = await getConnection('AIOT');
    transaction = new sql.Transaction(aiotDb);
    await transaction.begin();

    const query = `DELETE FROM [AIOT].[dbo].[logQaqcNRpt] WHERE [SN] = @SN;`;
    await transaction.request().input('SN', sql.VarChar, SN).query(query);

    const query2 = `UPDATE [AIOT].[dbo].[logQaqcN] SET [qaCease] = 0 WHERE [SN] = @SN;`;
    const result2 = await transaction.request().input('SN', sql.VarChar, SN).query(query2);

    if (!result2.rowsAffected[0]) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({
        success: false,
        message: '查無此 QAQC 紀錄。',
      });
    }

    await transaction.commit();
    transaction = null;

    res.status(200).json({
      success: true,
      message: '已啟動計算',
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Rollback QAQC calculation error:', rollbackError);
      }
    }
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.delete('/delete/sensors/qaqc/SN', verifyToken, async (req, res) => {
  const { SN } = req.body;

  if (!SN) {
    return res.status(400).json({
      success: false,
      message: 'SN 為必填。',
    });
  }

  let transaction;
  try {
    const aiotDb = await getConnection('AIOT');

    transaction = new sql.Transaction(aiotDb);
    await transaction.begin();
    const query = 'DELETE FROM [AIOT].[dbo].[logQaqcNRpt] WHERE [SN] = @SN;';
    const result = await transaction.request().input('SN', sql.VarChar, SN).query(query);
    const query2 = 'DELETE FROM [AIOT].[dbo].[logQaqcN] WHERE [SN] = @SN;';
    const result2 = await transaction.request().input('SN', sql.VarChar, SN).query(query2);
    if (!result2.rowsAffected[0]) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '查無此 QAQC 紀錄。',
      });
    }
    await transaction.commit();
    res.status(200).json({
      success: true,
      message: '刪除成功',
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

router.post('/pcbs', verifyToken, async (req, res) => {
  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
        SELECT [QAID],[Desc],[ProjID],[STID],[numChs],[ParID]
        FROM [AIOT].[dbo].[cfgQaqcN]
        WHERE [Enabled] = 1
        ORDER BY [QAID]
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

router.post('/update/sensor/station', verifyToken, async (req, res) => {
  const { PJID, STID, newSensorSn } = req.body;
  const { ID } = req.user;

  if (!ID) {
    return res.status(401).json({ success: false, message: 'ID is missing.' });
  }

  if (!PJID || !STID || !newSensorSn) {
    return res.status(400).json({
      success: false,
      message: 'PJID、STID 與 newSensorSn 為必填欄位。',
    });
  }

  let transaction;

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
            SELECT [ProjID],[STID],[IIT],[ParName1],[ParName2],[ParName3],[ParName4],[ParName5],[ParName6],[ParName7],[ParName8]
            FROM [AIOT].[dbo].[ctrlStation] A
            INNER JOIN [AIOT].[dbo].[cfgModel] B
                ON A.Model = B.Model
            WHERE [ProjID] = @PJID
              AND [STID] = @station;

            SELECT TOP (1)[SN],[PSERNO],[BACHNO],[PRSN],[slpC],[itcC],[r2C],[healthyC],[status]
            FROM [AIOT].[dbo].[logQaqcNRpt]
            WHERE [PRSN] = @newSensorSn
            ORDER BY [dt_T] DESC;
        `;

    const result = await aiotDb
      .request()
      .input('PJID', sql.VarChar, PJID)
      .input('station', sql.VarChar, STID)
      .input('newSensorSn', sql.VarChar, newSensorSn)
      .query(query);

    const station = result.recordsets[0][0];
    const sensor = result.recordsets[1][0];

    if (!station || !sensor) {
      return res.status(404).json({ success: false, message: '查無 station 或 sensor 資料。' });
    }

    const parKey = Object.keys(station).find(
      (k) => k.startsWith('ParName') && station[k] === 'PM2.5',
    );
    if (!parKey) {
      return res.status(400).json({ success: false, message: '此測站無 PM2.5 測項。' });
    }

    const parNumber = Number(parKey.replace('ParName', ''));
    const conNote = `${PJID},${STID},${parNumber}`;

    const query2 = `
            SELECT TOP (1) *
            FROM [AIOT].[dbo].[logSensor]
            WHERE [conNote] LIKE @conNote AND [sortB] = '上線'
            ORDER BY [amdDate] ASC;
        `;

    const result2 = await aiotDb
      .request()
      .input('conNote', sql.VarChar, conNote)
      .query(query2);

    const oldSensor = result2.recordset[0];

    transaction = new sql.Transaction(aiotDb);
    await transaction.begin();

    if (oldSensor) {
      const query3 = `
                UPDATE [AIOT].[dbo].[logSensor]
                SET [sortB] = N'替換', [amdEID] = @amdEID, [amdDate] = GETDATE()
                WHERE [PRSN] = @oldPRSN AND [sortB] = '上線';
            `;
      await transaction
        .request()
        .input('oldPRSN', sql.VarChar, oldSensor.PRSN)
        .input('amdEID', sql.VarChar, ID)
        .query(query3);
    }

    const query4 = `
            UPDATE [AIOT].[dbo].[ctrlStation]
            SET [slpC${parNumber}] = @slpC,[itcC${parNumber}] = @itcC,[amdEID] = @amdEID,[amdDate] = GETDATE()
            WHERE [ProjID] = @PJID AND [STID] = @station
            
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
    transaction = null;

    res.status(200).json({
      success: true,
      message: '更新成功',
    });

  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Rollback sensor replacement error:', rollbackError);
      }
    }

    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});


module.exports = router;
