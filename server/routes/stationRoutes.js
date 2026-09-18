const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getConnection } = require('../db/pool');
const { verifyToken } = require('../middleware/authMiddleware');
const { dateFormatLocal, dateIsSameTime } = require('../utils/dateUtils');
const { fileEnsureDirectory, fileRemoveAll, fileRenamePathKeys } = require('../utils/fileUtils');
const { formatChemicalSubscript, formatTruncateOneDecimal } = require('../utils/formatUtils');
const { geoCalculateHaversineDistance } = require('../utils/geoUtils');
const { idGenerateDateSequence, idGenerateMonthlySequence } = require('../utils/idUtils');
const { uploadCreateImageMiddleware, uploadRunMiddleware } = require('../utils/uploadUtils');

const INSPECTION_IMAGE_BASE_PATH = '\\\\192.168.3.204\\JSEnE_new\\JS99_暫存區\\_datAIOT\\_inspection_Image';
const INSPECTION_IMAGE_DIRECTIONS = ['East', 'South', 'North', 'West'];

function createInspectionImageSignature(userID, bookID, fileName) {
  return crypto
    .createHmac('sha256', process.env.JWT_TOKEN)
    .update(`${userID}\0${bookID}\0${fileName}`)
    .digest('hex');
}

function inspectionImageSignatureIsValid(signature, userID, bookID, fileName) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;

  const expected = createInspectionImageSignature(userID, bookID, fileName);
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

router.post('/projects', verifyToken, async (req, res) => {
  const { ID } = req.user;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  try {
    const [aiotDb, webAiotDb] = await Promise.all([
      getConnection('AIOT'),
      getConnection('WebAIOT'),
    ]);

    const query = `
        SELECT [ID], [PROJID], [ENABLE] 
        FROM [WebAIOT].[dbo].[cfg_CtrlUserPJID] 
        WHERE [ID] = @ID AND [ENABLE] = 1;
      `;

    const query2 = `
        SELECT [PJID], [PJName_TW] 
        FROM [AIOT].[dbo].[ctrlProject] 
        WHERE [actPJID] = 1 
        ORDER BY [PJID] DESC
      `;

    const [result, result2] = await Promise.all([
      webAiotDb.request().input('ID', sql.VarChar, ID).query(query),

      aiotDb.request().query(query2),
    ]);

    const visibleProjSet = new Set(result.recordset.map((row) => row.PROJID));

    const filtered = result2.recordset.filter((proj) => visibleProjSet.has(proj.PJID));

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

router.post('/projects/stations', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { PJID, enabled } = req.body;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  if (!PJID) {
    return res.status(400).json({ success: false, message: 'PJID 為必填欄位。' });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `EXEC [dbo].[GetUserStations] @ID = @ID, @InputPJID = @PJID, @Enabled = @enabled`;

    const result = await aiotDb
      .request()
      .input('ID', sql.VarChar, ID)
      .input('PJID', sql.VarChar, PJID)
      .input('enabled', sql.Int, enabled)
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset
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

router.post('/stations/detail', verifyToken, async (req, res) => {
  const { PJID, STID } = req.body;

  if (!PJID || !STID) {
    return res.status(400).json({ success: false, message: 'PJID 與 STID 為必填欄位。' });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
          SELECT 
              [ProjID],[PJName_TW],[STID],[IIT],[geoLat],[geoLng],[County],[Town],
              [AreaType],[Area],[Desc],[Alt],[BinVer],[StuFreq],[KinUpDateTime],[DeviceID]
          FROM [dbo].[ctrlStation] CS
          INNER JOIN [dbo].[ctrlProject] CP ON CS.ProjID = CP.PJID
          where [ProjID] = @PJID AND [STID] = @STID
        `;

    const result = await aiotDb
      .request()
      .input('PJID', sql.VarChar, PJID)
      .input('STID', sql.VarChar, STID)
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset
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

router.post('/projects/missing-hour', verifyToken, async (req, res) => {
  const { PJID } = req.body;
  const { ID } = req.user;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  if (!PJID) {
    return res.status(400).json({
      success: false,
      message: 'PJID 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = 'EXEC dbo.GetAccessStation @ID = @ID, @ProjIDFilter = @ProjIDFilter';
    const result = await aiotDb
      .request()
      .input('ID', sql.VarChar, ID)
      .input('ProjIDFilter', sql.VarChar, PJID)
      .query(query);

    const query2 = `
      SELECT TOP (1)
        [tbAIOT]
      FROM [AIOT].[dbo].[ctrlProject]
      WHERE [PJID] = @PJID;
    `;
    const result2 = await aiotDb.request().input('PJID', sql.VarChar, PJID).query(query2);

    const tbAIOT = result2.recordset[0]?.tbAIOT;

    if (!tbAIOT) {
      return res.status(404).json({
        success: false,
        message: '查無指定專案。',
      });
    }

    if (!/^[A-Za-z0-9_]+$/.test(tbAIOT)) {
      console.error(`Invalid ctrlProject.tbAIOT value for PJID ${PJID}`);
      return res.status(500).json({
        success: false,
        message: '專案資料表設定錯誤。',
      });
    }

    // 日期與小時邏輯處理
    const now = new Date();
    const currentHour = now.getHours();

    let onlyDate, prevDate, currentColumn, prevColumn;

    const todayStr = dateFormatLocal(now);
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = dateFormatLocal(yesterdayDate);

    if (currentHour === 0) {
      // 00:00 → 昨天 23 vs 22
      currentColumn = 'A.dCnt23';
      prevColumn = 'A.dCnt22';
      onlyDate = yesterdayStr;
      // 前天
      prevDate = dateFormatLocal(new Date(now.getTime() - 48 * 60 * 60 * 1000));
    } else if (currentHour === 1) {
      // 01:00 → 今天 00 - 昨天 23
      currentColumn = 'A.dCnt00';
      prevColumn = 'P.Prev_dCnt23';
      onlyDate = todayStr;
      prevDate = yesterdayStr;
    } else {
      // 02~23
      const curH = (currentHour - 1).toString().padStart(2, '0');
      const preH = (currentHour - 2).toString().padStart(2, '0');
      currentColumn = `A.dCnt${curH}`;
      prevColumn = `A.dCnt${preH}`;
      onlyDate = todayStr;
      prevDate = yesterdayStr;
    }

    const query3 = `
            WITH PrevData AS (
                SELECT STID, dCnt23 AS Prev_dCnt23
                FROM [dbo].[${tbAIOT}TDR]
                WHERE Date_Time = @prevDate
            )
            SELECT 
                CONVERT(VARCHAR(19), A.Date_Time, 126) AS Date_Time, 
                C.ProjID, 
                A.STID, 
                B.criteriaTDR, 
                C.IIT, 
                C.[Desc],
                P.Prev_dCnt23,
                A.dCnt00, A.dCnt01, A.dCnt02, A.dCnt03, A.dCnt04,
                A.dCnt05, A.dCnt06, A.dCnt07, A.dCnt08, A.dCnt09,
                A.dCnt10, A.dCnt11, A.dCnt12, A.dCnt13, A.dCnt14,
                A.dCnt15, A.dCnt16, A.dCnt17, A.dCnt18, A.dCnt19,
                A.dCnt20, A.dCnt21, A.dCnt22, A.dCnt23
            FROM [dbo].[${tbAIOT}TDR] A
            LEFT JOIN PrevData P ON A.STID = P.STID
            INNER JOIN [dbo].[ctrlProject] B ON A.ProjID = B.PJID
            INNER JOIN [dbo].[ctrlStation] C ON A.STID = C.STID
            WHERE C.Enabled = 1
              AND A.Date_Time = @onlyDate
              AND (
                  (${currentColumn} IS NULL AND ${prevColumn} IS NULL)
                  OR (${currentColumn} IS NULL AND ${prevColumn} IS NOT NULL)
                  OR (ISNULL(CAST(${currentColumn} AS INT), 0) - ISNULL(CAST(${prevColumn} AS INT), 0) > B.criteriaTDR)
              )
        `;

    const result3 = await aiotDb
      .request()
      .input('prevDate', sql.VarChar, prevDate)
      .input('onlyDate', sql.VarChar, onlyDate)
      .query(query3);

    const filtered = result3.recordset.filter((missingHour) =>
      result.recordset.some((accessibleStation) => accessibleStation.STID === missingHour.STID),
    );

    res.status(200).json({
      success: true,
      data: filtered
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

router.post('/projects/thresholdOver', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { PJID } = req.body;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = 'EXEC [STP_AIOTWEB_GetStationAlarmByProjID] @PJID = @PJID';

    const result = await aiotDb.request().input('PJID', sql.VarChar, PJID).query(query);

    // (暫時)篩掉 PJ:110011 測項CO
    const filtered = result.recordset.filter((row) => row.ITEM !== 'CO');

    res.status(200).json({
      success: true,
      data: filtered
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

router.post('/projects/disconnections', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { PJID, STID = null, filterStatus = 'All', filterKeywords = null } = req.body;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `EXEC [STP_AIOTWEB_GetDisconnectedByProjIDOrSTID] @PJID = @PJID, @STID = @STID, @FilterStatus = @filterStatus, @FilterKeywords = @filterKeywords`;

    const result = await aiotDb
      .request()
      .input('PJID', sql.VarChar, PJID)
      .input('STID', sql.VarChar, STID)
      .input('FilterStatus', sql.VarChar, filterStatus)
      .input('FilterKeywords', sql.NVarChar, filterKeywords ? JSON.stringify(filterKeywords) : null)
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset
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

router.post('/stations/inspections', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { PJID, startDateTime, endDateTime } = req.body;

  if (!ID) {
    return res.status(401).json({ success: false, message: 'ID is missing.' });
  }

  try {
    const [iotDb, aiotDb] = await Promise.all([getConnection('IOT'), getConnection('AIOT')]);

    const query = 'EXEC [dbo].[GetUserStations] @ID = @ID, @InputPJID = @PJID';
    const result = await aiotDb
      .request()
      .input('ID', sql.VarChar, ID)
      .input('PJID', sql.VarChar, PJID)
      .query(query);

    const validIITs = [...new Set(result.recordset.map((record) => record.IIT).filter(Boolean))];

    if (validIITs.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // SQL Server allows at most 2,100 parameters per request. A project normally has
    // far fewer stations, but retain the old in-memory filtering as a safe fallback.
    const canFilterInQuery = validIITs.length <= 2000;
    const inspectionRequest = iotDb
      .request()
      .input('startDateTime', sql.Date, startDateTime)
      .input('endDateTime', sql.Date, endDateTime);

    const iitFilter = canFilterInQuery
      ? `AND A.[IIT] IN (${validIITs.map((iit, index) => {
          const parameterName = `iit${index}`;
          inspectionRequest.input(parameterName, sql.VarChar, iit);
          return `@${parameterName}`;
        }).join(', ')})`
      : '';

    const query2 = `
      SELECT 
        A.[BookID],A.[IIT],A.[InspectionID],A.[StartDate],A.[StartTime],
        B.[Environmental],B.[Outside],B.[Electricity],B.[FixedCheck],B.[LockCheck],B.[Clean],
        B.[Surrounding1M],B.[Surrounding50M],B.[ValueStable],B.[FixRecord],B.[Migrate],
        C.[East],C.[North],C.[South],C.[West]
      FROM [IOT].[dbo].[InspectionMain] A
      LEFT JOIN [IOT].[dbo].[InspectionResult] B ON A.[BookID] = B.[BookID]
      LEFT JOIN [IOT].[dbo].[InspectionImg] C ON A.[BookID] = C.[BookID]
      WHERE A.[StartDate] BETWEEN @startDateTime AND @endDateTime
      ${iitFilter}
      ORDER BY A.[StartDate] DESC, A.[StartTime] DESC
    `;

    const result2 = await inspectionRequest.query(query2);

    const validIITSet = new Set(validIITs);
    const filteredResults = canFilterInQuery
      ? result2.recordset
      : result2.recordset.filter((record) => validIITSet.has(record.IIT));
    
    const renamedResults = fileRenamePathKeys(filteredResults);

    // Several inspection records can share the same date folder. Read each network
    // directory only once instead of once per record.
    const folderFiles = new Map();
    const folderPrefixes = [...new Set(
      renamedResults
        .map((record) => record.BookID?.substring(0, 8))
        .filter(Boolean),
    )];

    await Promise.all(folderPrefixes.map(async (prefix) => {
      try {
        folderFiles.set(prefix, await fs.promises.readdir(path.join(INSPECTION_IMAGE_BASE_PATH, prefix)));
      } catch (error) {
        folderFiles.set(prefix, []);
      }
    }));

    const updatedResults = renamedResults.map((record) => {
        const bookIDPrefix = record.BookID ? record.BookID.substring(0, 8) : '';
        const existingFiles = folderFiles.get(bookIDPrefix) || [];

        INSPECTION_IMAGE_DIRECTIONS.forEach((direction) => {
          const storedFileName = typeof record[direction] === 'string'
            ? path.basename(record[direction].replace(/\\/g, '/'))
            : '';
          const targetPrefix = `${record.BookID}_${direction}.`.toLowerCase();
          const matchedFile = existingFiles.find((file) =>
            file.toLowerCase() === storedFileName.toLowerCase()
            || file.toLowerCase().startsWith(targetPrefix)
          );

          if (!matchedFile) {
            record[direction] = null;
            return;
          }

          const signature = createInspectionImageSignature(ID, record.BookID, matchedFile);
          record[direction] = `/stations/inspections/images/${encodeURIComponent(record.BookID)}/${encodeURIComponent(matchedFile)}?signature=${signature}`;
        });

        return record;
      });

    res.status(200).json({
      success: true,
      data: updatedResults
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

router.get('/stations/inspections/images/:bookID/:fileName', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { bookID, fileName } = req.params;
  const { signature } = req.query;

  const isSafeBookID = /^[A-Za-z0-9_-]+$/.test(bookID);
  const isSafeFileName = path.basename(fileName) === fileName
    && INSPECTION_IMAGE_DIRECTIONS.some((direction) =>
      fileName.toLowerCase().startsWith(`${bookID}_${direction}.`.toLowerCase()),
    );

  if (!isSafeBookID || !isSafeFileName
    || !inspectionImageSignatureIsValid(signature, ID, bookID, fileName)) {
    return res.status(403).json({ success: false, message: '無權存取此圖片' });
  }

  const filePath = path.join(INSPECTION_IMAGE_BASE_PATH, bookID.substring(0, 8), fileName);

  try {
    const fileStat = await fs.promises.stat(filePath);
    if (!fileStat.isFile()) {
      return res.status(404).json({ success: false, message: '找不到圖片' });
    }

    res.type(path.extname(fileName));
    res.set('Cache-Control', 'private, max-age=3600');
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: '找不到圖片' });
    }

    console.error(`${req.method} ${req.originalUrl} error:`, error);
    return res.status(500).json({ success: false, message: '圖片讀取失敗' });
  }
});

router.post('/add/stations/inspections', verifyToken, async (req, res) => {
  let uploadedFiles = [];
  let transaction;

  try {
    const { ID } = req.user;

    if (!ID) {
      return res.status(401).json({
        success: false,
        message: 'ID is missing.',
      });
    }

    const iotDb = await getConnection('IOT');
    const latestBookIdResult = await iotDb.request().query(`
      SELECT TOP (1) [BookID]
      FROM [IOT].[dbo].[InspectionMain]
      ORDER BY [BookID] DESC
    `);
    const bookID = idGenerateDateSequence(latestBookIdResult.recordset[0]?.BookID);
    const uploadFolderPath = await fileEnsureDirectory(
      path.join(INSPECTION_IMAGE_BASE_PATH, bookID.substring(0, 8)),
    );
    const upload = uploadCreateImageMiddleware({
      destination: uploadFolderPath,
      fields: ['east', 'south', 'north', 'west'],
      filename: (file) => `${bookID}_${file.fieldname}${path.extname(file.originalname).toLowerCase()}`,
    });

    await uploadRunMiddleware(upload, req, res);
    uploadedFiles = Object.values(req.files || {}).flat();

    let data;
    try {
      data = JSON.parse(req.body.data || '{}');
    } catch {
      await fileRemoveAll(uploadedFiles, {
        onError: (error) => console.error('Remove inspection image failed:', error),
      });
      return res.status(400).json({
        success: false,
        message: '巡檢資料格式錯誤。',
      });
    }
    const {
      inspectionID,
      IIT,
      startDate,
      startTime,
      weather,
      TMP,
      HUM,
      modelType,
      environmental,
      outside,
      electricity,
      fixedCheck,
      lockCheck,
      clean,
      surrounding1M,
      surrounding50M,
      valueStable,
      fixRecord,
      migrate,
    } = data;

    const requiredValues = [
      IIT,
      startDate,
      startTime,
      weather,
      TMP,
      HUM,
      modelType,
      environmental,
      outside,
      electricity,
      fixedCheck,
      lockCheck,
      clean,
      surrounding1M,
      surrounding50M,
      valueStable,
      fixRecord,
      migrate,
    ];
    const requiredImages = ['east', 'south', 'north', 'west'];
    const hasEmptyValue = requiredValues.some(
      (value) => value === null || value === undefined || value === '',
    );
    const hasMissingImage = requiredImages.some((field) => !req.files?.[field]?.[0]);

    if (hasEmptyValue || hasMissingImage) {
      await fileRemoveAll(uploadedFiles, {
        onError: (error) => console.error('Remove inspection image failed:', error),
      });
      return res.status(400).json({
        success: false,
        message: '請填寫所有必填欄位並上傳四張圖片',
      });
    }

    const query = `
        INSERT INTO [IOT].[dbo].[InspectionMain]
        ([BookID], [ID], [InspectionID], [IIT], [StartDate], [StartTime], [FinisgTime], [Weather], [Temp], [HUM], [ModelType])
        VALUES (@BookID, @ID, @InspectionID, @IIT, @StartDate, @StartTime, @FinisgTime, @Weather, @Temp, @HUM, @ModelType)
      `;
    const query2 = `
        INSERT INTO [IOT].[dbo].[InspectionResult]
        ([BookID], [Environmental], [Outside], [Electricity], [FixedCheck], [LockCheck], [Clean], [Surrounding1M], [Surrounding50M], [ValueStable], [FixRecord], [Migrate])
        VALUES (@BookID, @Environmental, @Outside, @Electricity, @FixedCheck, @LockCheck, @Clean, @Surrounding1M, @Surrounding50M, @ValueStable, @FixRecord, @Migrate)
      `;

    const finishDate = new Date();
    const finisgTime = `${String(finishDate.getHours()).padStart(2, '0')}:${String(finishDate.getMinutes()).padStart(2, '0')}`;

    transaction = new sql.Transaction(iotDb);
    await transaction.begin();

    await transaction
      .request()
      .input('BookID', sql.VarChar, bookID)
      .input('ID', sql.VarChar, ID)
      .input('InspectionID', sql.VarChar, inspectionID || '')
      .input('IIT', sql.VarChar, IIT)
      .input('StartDate', sql.VarChar, startDate)
      .input('StartTime', sql.VarChar, startTime)
      .input('FinisgTime', sql.VarChar, finisgTime)
      .input('Weather', sql.Int, weather)
      .input('Temp', sql.Int, TMP)
      .input('HUM', sql.Int, HUM)
      .input('ModelType', sql.VarChar, modelType)
      .query(query);

    await transaction
      .request()
      .input('BookID', sql.VarChar, bookID)
      .input('Environmental', sql.VarChar, environmental)
      .input('Outside', sql.VarChar, outside)
      .input('Electricity', sql.VarChar, electricity)
      .input('FixedCheck', sql.VarChar, fixedCheck)
      .input('LockCheck', sql.VarChar, lockCheck)
      .input('Clean', sql.VarChar, clean)
      .input('Surrounding1M', sql.VarChar, surrounding1M)
      .input('Surrounding50M', sql.VarChar, surrounding50M)
      .input('ValueStable', sql.VarChar, valueStable)
      .input('FixRecord', sql.VarChar, fixRecord)
      .input('Migrate', sql.VarChar, migrate)
      .query(query2);

    await transaction.commit();
    transaction = null;

    res.status(200).json({
      success: true,
      data: { bookID },
      message: '資料和圖片已成功儲存'
    });

  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Rollback inspection error:', rollbackError);
      }
    }
    uploadedFiles = Object.values(req.files || {}).flat();
    await fileRemoveAll(uploadedFiles, {
      onError: (fileError) => console.error('Remove inspection image failed:', fileError),
    });
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message
    });
  }
});

router.post('/stations/health-reports', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { PJID, yearMonth } = req.body;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `EXEC [dbo].[GetUserStations] @ID = @ID, @InputPJID = @PJID, @Enabled = @enabled`;
    const result = await aiotDb
      .request()
      .input('ID', sql.VarChar, ID)
      .input('PJID', sql.VarChar, PJID)
      .input('enabled', sql.Int, 1)
      .query(query);

    const query2 = `EXEC [dbo].[STP_AIOTWEB_GetStationCompleteness] @PJID = @PJID, @YearMonth = @yearMonth`;
    const result2 = await aiotDb
      .request()
      .input('PJID', sql.VarChar, PJID)
      .input('YearMonth', sql.VarChar, yearMonth)
      .query(query2);

    const visibleStidSet = new Set(result.recordset.map((row) => row.STID));
    const filtered = result2.recordset.filter((row) => visibleStidSet.has(row.STID));

    res.status(200).json({
      success: true,
      data: filtered
    });

  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message
    });
  }
});

router.post('/stations/disconnections/detail', verifyToken, async (req, res) => {
  const { PJID, STID, yearMonth, switchGap } = req.body;

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `EXEC [dbo].[STP_AIOTWEB_GetStationDisconnectDetail] @PJID = @PJID, @STID = @STID, @YearMonth = @yearMonth, @switchGap = @switchGap`;
    const result = await aiotDb
      .request()
      .input('PJID', sql.VarChar, PJID)
      .input('STID', sql.VarChar, STID)
      .input('YearMonth', sql.VarChar, yearMonth)
      .input('switchGap', sql.Int, switchGap)
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset
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

router.post('/stations/nearby', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { lat, lng, radius, nearest } = req.body;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ success: false, message: '有效的 lat 與 lng 為必填欄位。' });
  }

  if (radius !== undefined && (!Number.isFinite(Number(radius)) || Number(radius) <= 0)) {
    return res.status(400).json({ success: false, message: 'radius 必須為正數。' });
  }

  if (nearest !== undefined && (!Number.isInteger(Number(nearest)) || Number(nearest) <= 0)) {
    return res.status(400).json({ success: false, message: 'nearest 必須為正整數。' });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `EXEC [dbo].[GetUserStations] @ID = @ID, @Enabled = 1`;
    const result = await aiotDb.request().input('ID', sql.VarChar, ID).query(query);

    // 計算距離並保留距離欄位
    const stationsWithDistance = result.recordset
      .map((station) => {
        if (!station.geoLat || !station.geoLng) return null;

        const distance = geoCalculateHaversineDistance(
          latitude,
          longitude,
          parseFloat(station.geoLat),
          parseFloat(station.geoLng),
        );

        return {
          ...station,
          distance: Math.round(distance),
        };
      })
      .filter((s) => s); // 排除 null

    let nearbyStations;

    if (nearest) {
      nearbyStations = stationsWithDistance
        .sort((a, b) => a.distance - b.distance)
        .slice(0, parseInt(nearest));
    } else if (radius) {
      nearbyStations = stationsWithDistance.filter(
        (station) => station.distance <= parseFloat(radius),
      );
      nearbyStations.sort((a, b) => a.distance - b.distance);
    } else {
      return res.status(400).json({ success: false, message: 'Missing radius or nearest.' });
    }

    res.status(200).json({
      success: true,
      data: nearbyStations
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

router.post('/user/stations', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { pjid, stid, stidOrIit, enabled } = req.body;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
        EXEC [dbo].[GetUserStations] 
        @ID = @ID, 
        @InputPJID = @InputPJID, 
        @StidFilter = @StidFilter, 
        @InputSTID = @InputSTID, 
        @Enabled = @Enabled
      `;
    const result = await aiotDb
      .request()
      .input('ID', sql.VarChar, ID)
      .input('InputPJID', sql.VarChar, pjid || null)
      .input('StidFilter', sql.VarChar, stid || null)
      .input('InputSTID', sql.VarChar, stidOrIit || null)
      .input('Enabled', sql.Int, enabled || null)
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

router.post('/stations/health-reports/detail', verifyToken, async (req, res) => {
  const { startDate, endDate, PJIDList } = req.body;

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `EXEC [dbo].[STP_AIOTWEB_GetProjectHealthPercent] @StartDate = @startDate, @EndDate = @endDate, @PJIDList = @PJIDList`;
    const result = await aiotDb
      .request()
      .input('startDate', sql.VarChar, startDate)
      .input('endDate', sql.VarChar, endDate)
      .input('PJIDList', sql.VarChar, PJIDList)
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset
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

router.post('/stations/disconnections/status', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { PJID, STID = null, filterStatus = 'All', filterKeywords = null } = req.body;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
            EXEC [STP_AIOTWEB_GetDisconnectedByProjIDOrSTID] 
                @PJID = @PJID, 
                @STID = @STID,
                @FilterStatus = @filterStatus, 
                @FilterKeywords = @filterKeywords
        `;
    const result = await aiotDb
      .request()
      .input('PJID', sql.VarChar, PJID)
      .input('STID', sql.VarChar, STID)
      .input('FilterStatus', sql.VarChar, filterStatus)
      .input('FilterKeywords', sql.NVarChar, filterKeywords ? JSON.stringify(filterKeywords) : null)
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset
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

router.post('/stations/uninstalled', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { ProjID = null, STID = null, startDateTime = null, endDateTime = null, stationStatus = 'all' } = req.body;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
          SELECT 
              [OLID],[DeviceID],[STID],[IIT],[Desc],[datOffLine],[noteOffLine], 
              [STAgencyEID],[datOnLine],[typeOffLine],[noteDiabled],[EID]
          FROM [AIOT].[dbo].[logSTOffLine]
          CROSS APPLY (
              SELECT DATEADD(DAY, 1, CAST(@endDateTime AS DATETIME)) AS endDateNextDay
          ) AS Boundary
          WHERE 1 = 1
              AND (@ProjID IS NULL OR [ProjID] = @ProjID)
              AND (@STID IS NULL OR [STID] = @STID)
              AND (
                  @stationStatus = 'all'

                  OR (@stationStatus = 'online' AND [datOnLine] IS NOT NULL AND [datOnLine] <> '')
                  OR (@stationStatus = 'offline' AND ([datOnLine] IS NULL OR [datOnLine] = ''))
              )
              AND (
                  @startDateTime IS NULL OR @endDateTime IS NULL
                  
                  OR (@stationStatus = 'all' AND (([datOffLine] >= @startDateTime AND [datOffLine] <= Boundary.endDateNextDay) or ([datOnLine] >= @startDateTime AND [datOnLine] <= Boundary.endDateNextDay)))
                  OR (@stationStatus = 'online' AND [datOnLine] BETWEEN @startDateTime AND Boundary.endDateNextDay)
                  OR (@stationStatus = 'offline' AND [datOffLine] BETWEEN @startDateTime AND Boundary.endDateNextDay)
              )
          ORDER BY [datOffLine] DESC;
      `;

    const result = await aiotDb
      .request()
      .input('ProjID', sql.VarChar, ProjID)
      .input('STID', sql.VarChar, STID)
      .input('startDateTime', sql.VarChar, startDateTime)
      .input('endDateTime', sql.VarChar, endDateTime)
      .input('stationStatus', sql.VarChar, stationStatus)
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

router.post('/add/stations/uninstalled', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const {
    datOffLine,
    datOnLine,
    ProjID,
    STID,
    STAgencyEID,
    EID,
    logType,
    typeOffLine,
    noteOffLine,
    noteDiabled,
  } = req.body;
  let transaction;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  if (!ProjID || !STID || !datOffLine) {
    return res.status(400).json({
      success: false,
      message: 'ProjID、STID 與 datOffLine 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');
    transaction = new sql.Transaction(aiotDb);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const query = `SELECT TOP (1) [OLID] FROM [AIOT].[dbo].[logSTOffLine] WITH (UPDLOCK, HOLDLOCK) ORDER BY [OLID] DESC`;
    const query2 = `SELECT [ProjID],[STID],[IIT],[Desc],[DeviceID] FROM [AIOT].[dbo].[ctrlStation] WHERE [ProjID] = @ProjID AND [STID] = @STID`;

    const {
      recordset: [{ OLID: lastOLID } = {}],
    } = await transaction.request().query(query);
    const { recordset: stationRows } = await transaction
      .request()
      .input('ProjID', sql.VarChar, ProjID)
      .input('STID', sql.VarChar, STID)
      .query(query2);

    if (!stationRows.length) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({
        success: false,
        message: '查無指定測站。',
      });
    }

    const { IIT, Desc, DeviceID } = stationRows[0];
    const newOLID = idGenerateMonthlySequence(lastOLID, 'OL');

    const query3 = `
          INSERT INTO [AIOT].[dbo].[logSTOffLine]
              ([OLID],[datOffLine],[datOnLine],[ProjID],[STID],[IIT],[DeviceID],[Desc],
              [STAgencyEID],[EID],[logType],[typeOffLine],[noteOffLine],[noteDiabled],[Ack])
          VALUES
              (@OLID,@datOffLine,@datOnLine,@ProjID,@STID,@IIT,@DeviceID,@Desc,
              @STAgencyEID,@EID,@logType,@typeOffLine,@noteOffLine,@noteDiabled,NULL)
        `;

    await transaction
      .request()
      .input('OLID', sql.VarChar, newOLID)
      .input('datOffLine', sql.VarChar, datOffLine)
      .input('datOnLine', sql.VarChar, datOnLine)
      .input('ProjID', sql.VarChar, ProjID)
      .input('STID', sql.VarChar, STID)
      .input('IIT', sql.VarChar, IIT)
      .input('DeviceID', sql.VarChar, DeviceID)
      .input('Desc', sql.NVarChar, Desc)
      .input('STAgencyEID', sql.VarChar, STAgencyEID)
      .input('EID', sql.VarChar, EID)
      .input('logType', sql.Int, logType)
      .input('typeOffLine', sql.NVarChar, typeOffLine)
      .input('noteOffLine', sql.NVarChar, noteOffLine)
      .input('noteDiabled', sql.VarChar, noteDiabled)
      .query(query3);

    await transaction.commit();
    transaction = null;

    res.status(200).json({
      success: true,
      message: '下架測站資料新增成功'
    });

  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Rollback uninstalled station error:', rollbackError);
      }
    }
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message
    });
  }
});

router.put('/edit/stations/uninstalled', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const {
    OLID,
    datOnLine,
    STAgencyEID,
    EID,
    logType,
    typeOffLine,
    noteOffLine,
    noteDiabled,
  } = req.body;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  if (!OLID) {
    return res.status(400).json({ success: false, message: 'OLID 為必填欄位。' });
  }

  try {
    const aiotDb = await getConnection('AIOT');
    const query = `
          UPDATE [AIOT].[dbo].[logSTOffLine]
          SET
              [datOnLine] = @datOnLine,
              [STAgencyEID] = @STAgencyEID,
              [EID] = @EID,
              [logType] = @logType,
              [typeOffLine] = @typeOffLine,
              [noteOffLine] = @noteOffLine,
              [noteDiabled] = @noteDiabled
          WHERE [OLID] = @OLID
        `;

    const result = await aiotDb
      .request()
      .input('OLID', sql.VarChar, OLID)
      .input('datOnLine', sql.VarChar, datOnLine)
      .input('STAgencyEID', sql.VarChar, STAgencyEID)
      .input('EID', sql.VarChar, EID)
      .input('logType', sql.Int, logType)
      .input('typeOffLine', sql.NVarChar, typeOffLine)
      .input('noteOffLine', sql.NVarChar, noteOffLine)
      .input('noteDiabled', sql.VarChar, noteDiabled)
      .query(query);

    if (!result.rowsAffected[0]) {
      return res.status(404).json({
        success: false,
        message: '查無指定的下架測站資料。',
      });
    }

    res.status(200).json({
      success: true,
      message: '下架測站資料編輯成功',
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

router.delete('/delete/stations/uninstalled', verifyToken, async (req, res) => {
  const { OLID } = req.body;

  if (!OLID) {
    return res.status(400).json({
      success: false,
      message: 'OLID 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');
    const query = `
      DELETE FROM [AIOT].[dbo].[logSTOffLine]
      WHERE [OLID] = @OLID;
    `;
    const result = await aiotDb.request().input('OLID', sql.VarChar, OLID).query(query);

    if (!result.rowsAffected[0]) {
      return res.status(404).json({
        success: false,
        message: '查無指定的下架測站資料。',
      });
    }

    res.status(200).json({
      success: true,
      message: '下架測站資料刪除成功'
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

router.post('/station/data/:STID', verifyToken, async (req, res) => {
  const { STID } = req.params;
  const { PJID, startDateTime, endDateTime, type, top, SELECT_COUNT } = req.body;
  const { role } = req.user;

  if (!role) return res.status(401).json({ success: false, message: 'Role is missing.' });

  if (!STID || !PJID || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: 'STID、PJID、startDateTime 與 endDateTime 為必填欄位。',
    });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    let query =
      'EXEC dbo.GetData @STID = @STID, @PROJID = @PJID, @FDATE = @startDateTime, @TDATE = @endDateTime';
    if (type) query += ', @TYPE = @type';
    if (top) query += ', @APP = @top';
    if (SELECT_COUNT) query += ', @SELECT_COUNT = @SELECT_COUNT';

    const result = await aiotDb
      .request()
      .input('STID', sql.VarChar, STID)
      .input('PJID', sql.VarChar, PJID)
      .input('startDateTime', sql.VarChar, startDateTime)
      .input('endDateTime', sql.VarChar, endDateTime)
      .input('type', sql.VarChar, type || null)
      .input('top', sql.VarChar, top || null)
      .input('SELECT_COUNT', sql.Int, SELECT_COUNT || null)
      .query(query);

    const roundedRecordset = result.recordset.map((record) => {
      const roundedRecord = Object.fromEntries(
        Object.entries(record)
          .map(([key, value]) => {
            if (role === 'AIOT' && key.startsWith('Count')) {
              return null;
            }

            if ((key.startsWith('Value') || key.startsWith('Count')) && typeof value === 'number') {
              return [key, formatTruncateOneDecimal(value)];
            }

            return [key, value];
          })
          .filter(Boolean),
      );
      return roundedRecord;
    });

    // 篩掉「現在時間」第一筆資料
    const now = new Date(Date.now() + 8 * 60 * 60 * 1000); // UTC+8
    now.setSeconds(0);
    now.setMilliseconds(0);
    if (!top && roundedRecordset.length > 0 && dateIsSameTime(roundedRecordset[0].Date_Time, now)) {
      roundedRecordset.shift();
    }

    res.status(200).json({
      success: true,
      data: roundedRecordset,
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

router.post('/station/model/:STID', verifyToken, async (req, res) => {
  const { role } = req.user;
  const { STID } = req.params;
  const { PJID } = req.body;

  if (!role) return res.status(401).json({ success: false, message: 'Role is missing.' });

  if (!STID || !PJID) {
    return res.status(400).json({ success: false, message: 'STID 與 PJID 為必填欄位。' });
  }

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
            SELECT [ProjID],[STID],[IIT],
            [ParName1],[ParName2],[ParName3],[ParName4],[ParName5],[ParName6],[ParName7],[ParName8],
            [ParUnit1],[ParUnit2],[ParUnit3],[ParUnit4],[ParUnit5],[ParUnit6],[ParUnit7],[ParUnit8]
            FROM [AIOT].[dbo].[ctrlStation] A 
            INNER JOIN [AIOT].[dbo].[cfgModel] B ON A.Model = B.Model 
            where [ProjID] = @PJID AND [STID] = @STID
        `;
    const result = await aiotDb
      .request()
      .input('PJID', sql.VarChar, PJID)
      .input('STID', sql.VarChar, STID)
      .query(query);

    if (role === 'ERP') {
      result.recordset = result.recordset.map((record) => {
        const updatedRecord = { ...record };

        Object.entries(record).forEach(([key, value]) => {
          if (key.startsWith('ParName')) {
            updatedRecord[key] = formatChemicalSubscript(value); // 直接覆蓋原欄位值
            updatedRecord[`${key}Count`] = value ? `${updatedRecord[key]} (Count)` : null;
          } else if (key.startsWith('ParUnit')) {
            updatedRecord[key] = formatChemicalSubscript(value);
          }
        });

        return updatedRecord;
      });
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

module.exports = router;
