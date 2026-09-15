const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getConnection } = require('../db/pool');
const { verifyToken } = require('../middleware/authMiddleware');

// 火災專案
router.post('/fire/projects', verifyToken, async (req, res) => {
  const { ID } = req.user;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

  try {
    const [aiotDb, webaiotDb] = await Promise.all([
      getConnection('AIOT'),
      getConnection('WebAIOT'),
    ]);

    const userProjectsQuery = `
        SELECT [ID], [PROJID], [ENABLE] 
        FROM [WebAIOT].[dbo].[cfg_CtrlUserPJID] 
        WHERE [ID] = @ID AND [ENABLE] = 1;
      `;

    const fireProjectsQuery = `
        SELECT A.[ENID], B.[value] AS ProjID, A.[Desc]
        FROM [AIOT].[dbo].[cfgEventN] AS A
        CROSS APPLY STRING_SPLIT(A.[ProjID], ',') AS B
        WHERE A.[Event] = 'EN119' AND A.[actENID] = 1;
      `;

    const [{ recordset: userProjects }, { recordset: fireProjects }] = await Promise.all([
      webaiotDb.request().input('ID', sql.VarChar, ID).query(userProjectsQuery),

      aiotDb.request().query(fireProjectsQuery),
    ]);

    const visibleProjSet = new Set(userProjects.map((row) => row.PROJID));

    const eventMap = new Map();

    for (const { ProjID, ENID, Desc } of fireProjects) {
      if ((!ProjID, eventMap.has(ENID))) continue;

      const ENIDList = ProjID.split(',').map((p) => p.trim());
      if (ENIDList.some((ProjID) => visibleProjSet.has(ProjID))) {
        eventMap.set(ENID, { ENID, PJName_TW: Desc });
      }
    }

    const filtered = Array.from(eventMap.values());

    res.status(200).json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// 火災紀錄
router.post('/fire/reports', verifyToken, async (req, res) => {
  const { startDateTime, endDateTime, ENID, squadCount = 0 } = req.body;

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
      SELECT 
          L.[SN], 
          L.[ENID], 
          CONVERT(VARCHAR(19), L.[cDate], 126) AS cDate,
          L.[conST], 
          L.[Ack], 
          C.[Event],
          REPLACE(LEFT(L.[conST], CHARINDEX('|', L.[conST], CHARINDEX('|', L.[conST]) + 1) - 1), '|', ',') AS WGS84,
          parsed.district,
          parsed.detail,
          parsed.status,
          parsed.squadCount,
          CONVERT(VARCHAR(19), TRY_CAST(parsed.updateTime AS DATETIME), 126) AS updateTime,
          RIGHT('0' + CAST(DATEDIFF(MINUTE, L.[cDate], TRY_CAST(parsed.updateTime AS DATETIME)) / 60 AS VARCHAR), 2) + '小時' + 
          RIGHT('0' + CAST(DATEDIFF(MINUTE, L.[cDate], TRY_CAST(parsed.updateTime AS DATETIME)) % 60 AS VARCHAR), 2) + '分鐘' AS durationMinute
      FROM [AIOT].[dbo].[logEventN] L
      JOIN [AIOT].[dbo].[cfgEventN] C ON L.[ENID] = C.[ENID]
      CROSS APPLY (
          SELECT 
              district = REPLACE(REPLACE(SUBSTRING(L.conText, CHARINDEX('【案件地點】', L.conText) + 6, CHARINDEX('|', L.conText + '|', CHARINDEX('【案件地點】', L.conText)) - (CHARINDEX('【案件地點】', L.conText) + 6)), '【', ''), '[', ''),
              detail = SUBSTRING(L.conText, CHARINDEX('【案件詳細】', L.conText) + 6, CHARINDEX('|', L.conText + '|', CHARINDEX('【案件詳細】', L.conText)) - (CHARINDEX('【案件詳細】', L.conText) + 6)),
              status = SUBSTRING(L.conText, CHARINDEX('【執行狀況】', L.conText) + 6, CHARINDEX('|', L.conText + '|', CHARINDEX('【執行狀況】', L.conText)) - (CHARINDEX('【執行狀況】', L.conText) + 6)),
              squadCount = CAST(ISNULL(NULLIF(SUBSTRING(L.conText, CHARINDEX('【出動分隊數】', L.conText) + 7, CHARINDEX('|', L.conText + '|', CHARINDEX('【出動分隊數】', L.conText)) - (CHARINDEX('【出動分隊數】', L.conText) + 7)), ''), '0') AS INT),
              updateTime = SUBSTRING(L.conText, CHARINDEX('【更新時間】', L.conText) + 6, 19)
      ) AS parsed
      WHERE L.[cDate] BETWEEN @startDateTime AND @endDateTime 
        AND L.[ENID] = @ENID
        AND parsed.squadCount >= @SquadCount;
    `;

    const result = await aiotDb
      .request()
      .input('StartDateTime', sql.VarChar, startDateTime)
      .input('EndDateTime', sql.VarChar, endDateTime)
      .input('ENID', sql.VarChar, ENID)
      .input('SquadCount', sql.Int, squadCount)
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

module.exports = router;
