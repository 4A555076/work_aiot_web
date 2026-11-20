const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getConnection } = require('../db/pool');
const { verifyToken } = require('../middleware/authMiddleware');


/**
 * @swagger
 * /aiot/fire/projects:
 *   get:
 *     tags:
 *       - Fire
 *     summary: 取得使用者可查看的火災專案列表
 *     description: 根據登入使用者的身分，比對其專案權限，回傳對應的火災專案事件代碼列表。
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
 *                       ENID:
 *                         type: string
 *                         description: 事件代碼
 *                         example: "EN20240001"
 *                       PJName_TW:
 *                         type: string
 *                         description: 專案/事件中文描述
 *                         example: "火災警訊-高雄市"
 *       '401':
 *         description: 身份驗證錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.get('/fire/projects', verifyToken, async (req, res) => {
  const { ID } = req.user;

  try {
    const [aiotDb, webAiotDb] = await Promise.all([
      getConnection('AIOT'),
      getConnection('WebAIOT'),
    ]);

    const userProjectsQuery = `
      SELECT [ID], [PROJID], [ENABLE] 
      FROM [WebAIOT].[dbo].[cfg_CtrlUserPJID] 
      WHERE [ID] = @ID AND [ENABLE] = 1;
    `;

    const eventsQuery = `
      SELECT A.[ENID], B.[value] AS ProjID, A.[Desc]
      FROM [AIOT].[dbo].[cfgEventN] AS A
      CROSS APPLY STRING_SPLIT(A.[ProjID], ',') AS B
      WHERE A.[Event] = 'EN119' AND A.[actENID] = 1;
    `;

    const [userProjectsResult, eventsResult] = await Promise.all([
      webAiotDb
        .request()
        .input('ID', sql.VarChar, ID)
        .query(userProjectsQuery),

      aiotDb
        .request()
        .query(eventsQuery),
    ]);

    const visibleProjSet = new Set(
      userProjectsResult.recordset
        .filter((row) => row.PROJID != null)
        .map((row) => String(row.PROJID).trim())
    );

    const eventMap = new Map();

    for (const { ProjID, ENID, Desc } of eventsResult.recordset) {
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

    const filteredProjects = Array.from(eventMap.values());

    return res.status(200).json({
      success: true,
      data: filteredProjects,
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
 * /aiot/fire/{ENID}/reports:
 *   get:
 *     tags:
 *       - Fire
 *     summary: 查詢指定事件的火災紀錄
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ENID
 *         required: true
 *         schema:
 *           type: string
 *         description: 事件代碼
 *         example: "EN20240001"
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
 *       - in: query
 *         name: squadCount
 *         required: false
 *         schema:
 *           type: integer
 *         description: 出動分隊數下限（選填），未傳入時不篩選分隊數
 *         example: 3
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
 *                       ENID:
 *                         type: string
 *                       cDate:
 *                         type: string
 *                       Ack:
 *                         type: number
 *                       Event:
 *                         type: string
 *                       WGS84:
 *                         type: string
 *                       district:
 *                         type: string
 *                       detail:
 *                         type: string
 *                       status:
 *                         type: string
 *                       squadCount:
 *                         type: number
 *                       updateTime:
 *                         type: string
 *                       durationMinute:
 *                         type: string
 *       '400':
 *         description: 請求參數錯誤
 *       '401':
 *         description: 身份驗證錯誤
 *       '403':
 *         description: 沒有查詢該事件的權限
 *       '500':
 *         description: 伺服器錯誤
 */
router.get('/fire/:ENID/reports', verifyToken, async (req, res) => {
  const { ID } = req.user;
  const { ENID } = req.params;
  const { startDateTime, endDateTime, squadCount } = req.query;

  if (![startDateTime, endDateTime, ENID].every(
    value => typeof value === 'string' && value.trim()
  )) {
    return res.status(400).json({
      success: false,
      message: 'Bad request',
    });
  }

  const hasSquadCount =
    squadCount !== undefined &&
    squadCount !== null &&
    squadCount !== '';

  try {
    const [aiotDb, webAiotDb] = await Promise.all([
      getConnection('AIOT'),
      getConnection('WebAIOT'),
    ]);

    const userProjectsQuery = `
      SELECT [PROJID]
      FROM [WebAIOT].[dbo].[cfg_CtrlUserPJID]
      WHERE [ID] = @ID
        AND [ENABLE] = 1;
    `;

    const eventProjectsQuery = `
      SELECT DISTINCT
        LTRIM(RTRIM(S.[value])) AS ProjID
      FROM [AIOT].[dbo].[cfgEventN] AS C
      CROSS APPLY STRING_SPLIT(C.[ProjID], ',') AS S
      WHERE C.[ENID] = @ENID
        AND C.[Event] = 'EN119'
        AND C.[actENID] = 1;
    `;

    const [userProjects, eventProjects] = await Promise.all([
      webAiotDb
        .request()
        .input('ID', sql.VarChar, ID)
        .query(userProjectsQuery),

      aiotDb
        .request()
        .input('ENID', sql.VarChar, ENID)
        .query(eventProjectsQuery),
    ]);

    const visibleProjSet = new Set(
      userProjects.recordset
        .filter((row) => row.PROJID != null)
        .map((row) => String(row.PROJID).trim())
    );

    const hasPermission = eventProjects.recordset.some(
      (row) => visibleProjSet.has(row.ProjID)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }

    const query = `
      SELECT
          L.[SN],
          L.[ENID],
          CONVERT(VARCHAR(19), L.[cDate], 126) AS cDate,
          L.[Ack],
          C.[Event],
          CASE
            WHEN P.secondPipe > 0
            THEN REPLACE(
              LEFT(L.[conST], P.secondPipe - 1),
              '|',
              ','
            )
            ELSE NULL
          END AS WGS84,
          parsed.district,
          parsed.detail,
          parsed.status,
          parsed.squadCount,
          CONVERT(
            VARCHAR(19),
            TRY_CONVERT(DATETIME, parsed.updateTime),
            126
          ) AS updateTime,
          CASE
            WHEN TRY_CONVERT(DATETIME, parsed.updateTime) IS NOT NULL
            THEN
              CAST(
                DATEDIFF(
                  MINUTE,
                  L.[cDate],
                  TRY_CONVERT(DATETIME, parsed.updateTime)
                ) / 60 AS VARCHAR(20)
              ) + '小時' +
              RIGHT(
                '0' + CAST(
                  DATEDIFF(
                    MINUTE,
                    L.[cDate],
                    TRY_CONVERT(DATETIME, parsed.updateTime)
                  ) % 60 AS VARCHAR(2)
                ),
                2
              ) + '分鐘'
            ELSE NULL
          END AS durationMinute

      FROM [AIOT].[dbo].[logEventN] AS L

      JOIN [AIOT].[dbo].[cfgEventN] AS C
        ON L.[ENID] = C.[ENID]

      -- 取得座標第二個分隔符號的位置
      CROSS APPLY (
        SELECT
          CHARINDEX(
            '|',
            L.[conST],
            CHARINDEX('|', L.[conST]) + 1
          ) AS secondPipe
      ) AS P

      -- 取得各欄位標記位置
      CROSS APPLY (
        SELECT
          CHARINDEX('【案件地點】', L.[conText]) AS districtPos,
          CHARINDEX('【案件詳細】', L.[conText]) AS detailPos,
          CHARINDEX('【執行狀況】', L.[conText]) AS statusPos,
          CHARINDEX('【出動分隊數】', L.[conText]) AS squadPos,
          CHARINDEX('【更新時間】', L.[conText]) AS updatePos
      ) AS pos

      -- 解析火災紀錄文字
      CROSS APPLY (
        SELECT
          district =
            CASE
              WHEN pos.districtPos > 0
              THEN REPLACE(
                REPLACE(
                  SUBSTRING(
                    L.[conText],
                    pos.districtPos + 6,
                    CHARINDEX(
                      '|',
                      L.[conText] + '|',
                      pos.districtPos + 6
                    ) - (pos.districtPos + 6)
                  ),
                  '【', ''
                ),
                '[', ''
              )
              ELSE NULL
            END,

          detail =
            CASE
              WHEN pos.detailPos > 0
              THEN SUBSTRING(
                L.[conText],
                pos.detailPos + 6,
                CHARINDEX(
                  '|',
                  L.[conText] + '|',
                  pos.detailPos + 6
                ) - (pos.detailPos + 6)
              )
              ELSE NULL
            END,

          status =
            CASE
              WHEN pos.statusPos > 0
              THEN SUBSTRING(
                L.[conText],
                pos.statusPos + 6,
                CHARINDEX(
                  '|',
                  L.[conText] + '|',
                  pos.statusPos + 6
                ) - (pos.statusPos + 6)
              )
              ELSE NULL
            END,

          squadCount =
            CASE
              WHEN pos.squadPos > 0
              THEN TRY_CONVERT(
                INT,
                ISNULL(
                  NULLIF(
                    SUBSTRING(
                      L.[conText],
                      pos.squadPos + 7,
                      CHARINDEX(
                        '|',
                        L.[conText] + '|',
                        pos.squadPos + 7
                      ) - (pos.squadPos + 7)
                    ),
                    ''
                  ),
                  '0'
                )
              )
              ELSE NULL
            END,

          updateTime =
            CASE
              WHEN pos.updatePos > 0
              THEN SUBSTRING(
                L.[conText],
                pos.updatePos + 6,
                19
              )
              ELSE NULL
            END
      ) AS parsed

      WHERE L.[cDate] BETWEEN
        CONVERT(DATETIME2(0), @startDateTime, 120)
        AND CONVERT(DATETIME2(0), @endDateTime, 120)

        AND L.[ENID] = @ENID

        ${hasSquadCount
          ? 'AND parsed.squadCount >= @SquadCount'
          : ''};
    `;

    const request = aiotDb
      .request()
      .input('startDateTime', sql.VarChar, startDateTime)
      .input('endDateTime', sql.VarChar, endDateTime)
      .input('ENID', sql.VarChar, ENID);

    if (hasSquadCount) {
      request.input('SquadCount', sql.Int, squadCount);
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

module.exports = router;
