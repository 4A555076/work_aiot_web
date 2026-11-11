/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getConnection } = require('../db/pool');
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /aiot/fire/projects:
 *   post:
 *     tags:
 *       - Fire API
 *     summary: 取得使用者可查看的火災專案
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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ENID:
 *                         type: string
 *                       PJName_TW:
 *                         type: string
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.post('/fire/projects', verifyToken, async (req, res) => {
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
        SELECT A.[ENID], B.[value] AS ProjID, A.[Desc]
        FROM [AIOT].[dbo].[cfgEventN] AS A
        CROSS APPLY STRING_SPLIT(A.[ProjID], ',') AS B
        WHERE A.[Event] = 'EN119' AND A.[actENID] = 1;
      `;

    const [result, result2] = await Promise.all([
      webAiotDb
        .request()
        .input('ID', sql.VarChar, ID)
        .query(query),

      aiotDb
        .request()
        .query(query2),
    ]);

    const visibleProjSet = new Set(
      result.recordset.map((row) => 
        row.PROJID
      )
    );

    const eventMap = new Map();

    for (const { ProjID, ENID, Desc } of result2.recordset) {
      if (!ProjID || eventMap.has(ENID)) {
        continue;
      }

      if (visibleProjSet.has(String(ProjID).trim())) {
        eventMap.set(ENID, {
          ENID,
          PJName_TW: Desc,
        });
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


/**
 * @swagger
 * /aiot/fire/reports:
 *   post:
 *     tags:
 *       - Fire API
 *     summary: 查詢火災紀錄
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startDateTime
 *               - endDateTime
 *               - ENID
 *             properties:
 *               startDateTime:
 *                 type: string
 *                 description: 查詢起始時間
 *                 example: "2026-11-01 00:00:00"
 *               endDateTime:
 *                 type: string
 *                 description: 查詢結束時間
 *                 example: "2026-11-11 23:59:59"
 *               ENID:
 *                 type: string
 *                 description: 事件代碼
 *                 example: "EN20240001"
 *               squadCount:
 *                 type: integer
 *                 description: 出動分隊數下限（選填），未傳入時不篩選分隊數
 *                 example: 3
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
 *                     description: 火災紀錄
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.post('/fire/reports', verifyToken, async (req, res) => {
  const { startDateTime, endDateTime, ENID, squadCount } = req.body;

  try {
    const aiotDb = await getConnection('AIOT');

    const query = `
      SELECT 
          L.[SN], 
          L.[ENID], 
          CONVERT(VARCHAR(19), L.[cDate], 126) AS cDate,
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
        ${squadCount !== undefined && squadCount !== null && squadCount !== ''
        ? 'AND parsed.squadCount >= @SquadCount'
        : ''}
    `;

    const request = await aiotDb
      .request()
      .input('StartDateTime', sql.VarChar, startDateTime)
      .input('EndDateTime', sql.VarChar, endDateTime)
      .input('ENID', sql.VarChar, ENID);

    if (squadCount !== undefined && squadCount !== null && squadCount !== '') {
      request.input('SquadCount', sql.Int, squadCount);
    }

    const result = await request.query(query);

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
