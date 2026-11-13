const express = require('express');
const router = express.Router();
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const { getConnection } = require('../db/pool');
const { verifyToken } = require('../middleware/authMiddleware');
const {
  cryptoEncryptText,
  cryptoGenerateRSAKeyPair,
  cryptoHashText,
} = require('../utils/cryptoUtils');

const { publicKey } = cryptoGenerateRSAKeyPair();


/**
 * @swagger
 * /aiot/user/login:
 *   post:
 *     tags:
 *       - User
 *     summary: 登入
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ID
 *               - PWD
 *             properties:
 *               ID:
 *                 type: string
 *                 description: 使用者帳號
 *                 example: "user001"
 *               PWD:
 *                 type: string
 *                 format: password
 *                 description: 使用者密碼
 *     responses:
 *       '200':
 *         description: 登入成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ID:
 *                   type: string
 *                 token:
 *                   type: string
 *                 name:
 *                   type: string
 *       '400':
 *         description: 請求參數錯誤
 *       '401':
 *         description: 帳號或密碼錯誤
 *       '500':
 *         description: 伺服器錯誤
 */

/**
 * TODO: 登入 API 安全性強化
 * 1. 強化密碼雜湊演算法及 JWT 金鑰管理，確保敏感資訊安全。
 * 2. 加入登入速率限制與帳號權限驗證，防止暴力破解及未授權存取。
 */
router.post('/user/login', async (req, res) => {
  const { ID, PWD } = req.body;

  if (![ID, PWD].every(
    value => typeof value === 'string' && value.trim()
  )) {
    return res.status(400).json({
      success: false,
      message: '請求參數錯誤',
    });
  }

  try {
    const webAiotDb = await getConnection('WebAIOT');
    const hashedPWD = cryptoHashText(PWD, { uppercase: true });

    const query = `
      SELECT
        [CNAME],
        [ID]
      FROM [sys_ERPaccount]
      WHERE [ID] = @ID
        AND [PWD] = @PWD;
    `;

    const result = await webAiotDb
      .request()
      .input('ID', sql.VarChar, ID)
      .input('PWD', sql.VarChar, hashedPWD)
      .query(query);

    let user = result.recordset[0];
    let role = 'ERP';

    if (!user) {
      const query2 = `
        SELECT
          [CNAME],
          [ID]
        FROM [sys_AIOTaccount]
        WHERE [ENABLE] = 1
          AND [ID] = @ID
          AND [PWD] = @PWD;
      `;

      const result2 = await webAiotDb
        .request()
        .input('ID', sql.VarChar, ID)
        .input('PWD', sql.VarChar, hashedPWD)
        .query(query2);

      user = result2.recordset[0];
      role = 'AIOT';
    } 

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const token = jwt.sign(
      {
        ID: user.ID,
        name: user.CNAME,
        role,
      },
      process.env.JWT_TOKEN,
      {
        algorithm: 'HS256',
        issuer: 'aiot-api',
        audience: 'aiot-web',
        expiresIn: '1h',
      },
    );

    return res.status(200).json({
      ID: cryptoEncryptText(user.ID, publicKey),
      token,
      name: user.CNAME,
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
 * /aiot/user/autologin:
 *   post:
 *     tags:
 *       - User
 *     summary: 使用者驗證自動登入
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 登入成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ID:
 *                   type: string
 *                 token:
 *                   type: string
 *                 name:
 *                   type: string
 *       '401':
 *         description: 帳號或密碼錯誤
 *       '500':
 *         description: 伺服器錯誤
 */
router.post('/user/autologin', async (req, res) => {
  try {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '');

    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // 驗證 JWT
    let decoded;

    try {
      decoded = jwt.verify(match[1], process.env.JWT_TOKEN, {
        algorithms: ['HS256'],
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: error.name === 'TokenExpiredError'
          ? 'Token expired'
          : 'Unauthorized',
      });
    }

    // 判斷是否為舊版外部系統 JWT
    const isLegacyToken =
      decoded &&
      typeof decoded.ID === 'string' &&
      typeof decoded.PWD === 'string' &&
      decoded.role === undefined &&
      decoded.payload === undefined &&
      decoded.iss === undefined &&
      decoded.aud === undefined;

    // 外部系統 JWT 必須具有過期時間
    if (isLegacyToken && !Number.isInteger(decoded.exp)) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // 取得 JWT 使用者資料
    const userInfo = decoded?.payload ?? decoded;

    const ID = isLegacyToken ? decoded.ID : userInfo?.ID;
    const roles = isLegacyToken
      ? ['ERP', 'AIOT']
      : [userInfo?.role];

    if (!ID || typeof ID !== 'string' || roles.some((role) => !['ERP', 'AIOT'].includes(role))) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // 檢查 AIOT JWT 的 issuer 和 audience
    if (
      !isLegacyToken &&
      (decoded.iss !== undefined || decoded.aud !== undefined) &&
      (decoded.iss !== 'aiot-api' || decoded.aud !== 'aiot-web')
    ) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const webAiotDb = await getConnection('WebAIOT');

    // 舊版外部系統需驗證密碼
    const hashedPWD = isLegacyToken
      ? cryptoHashText(decoded.PWD, { uppercase: true })
      : null;

    for (const role of roles) {
      const query = role === 'ERP'
        ? `
          SELECT
            [CNAME],
            [ID]
          FROM [sys_ERPaccount]
          WHERE [ID] = @ID
          ${isLegacyToken ? 'AND [PWD] = @PWD' : ''};
        `
        : `
          SELECT
            [CNAME],
            [ID]
          FROM [sys_AIOTaccount]
          WHERE [ENABLE] = 1
            AND [ID] = @ID
            ${isLegacyToken ? 'AND [PWD] = @PWD' : ''};
        `;

      const request = webAiotDb
        .request()
        .input('ID', sql.VarChar, ID);

      if (isLegacyToken) {
        request.input('PWD', sql.VarChar, hashedPWD);
      }

      const result = await request.query(query);
      const user = result.recordset[0];

      if (!user) continue;

      const token = jwt.sign(
        {
          ID: user.ID,
          name: user.CNAME,
          role,
        },
        process.env.JWT_TOKEN,
        {
          algorithm: 'HS256',
          issuer: 'aiot-api',
          audience: 'aiot-web',
          expiresIn: '1h',
        },
      );

      return res.status(200).json({
        ID: cryptoEncryptText(user.ID, publicKey),
        token,
        name: user.CNAME,
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
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
 * /aiot/user/pages:
 *   post:
 *     tags:
 *       - User
 *     summary: 使用者權限頁面
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 登入成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 PAGE:
 *                   type: string
 *                 pageName:
 *                   type: string
 *                 category:
 *                   type: string
 *                 serial:
 *                   type: string
 *       '500':
 *         description: 伺服器錯誤
 */
router.post('/user/pages', verifyToken, async (req, res) => {
  const { ID } = req.user;

  try {
    const webAiotDb = await getConnection('WebAIOT');

    const query = `
      SELECT
        b.[PAGE],
        c.[pageName],
        [category],
        [serial]
      FROM [WebAIOT].[dbo].[cfg_CtrlUserDept] a 
      INNER JOIN [WebAIOT].[dbo].[cfg_CtrlUserPermissions] b ON a.[INDEX] = b.[INDEX]
      LEFT JOIN [WebAIOT].[dbo].[cfg_CtrlPageName] c ON b.[PAGE] = c.[PAGE]
      WHERE [MEMBERS] LIKE '%' + @user + '%'
      GROUP BY b.[PAGE],c.[pageName],[category],[serial]
    `;

    const result = await webAiotDb
      .request()
      .input('user', sql.NVarChar, ID)
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
