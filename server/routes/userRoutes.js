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

// 登入
router.post('/user/login', async (req, res) => {
  const { ID, PWD } = req.body;

  if (!ID || !PWD) {
    return res.status(400).json({
      success: false,
      message: 'ID 與密碼為必填欄位。',
    });
  }

  try {
    const webAiotDb = await getConnection('WebAIOT');

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
      .input('PWD', sql.VarChar, cryptoHashText(PWD, { uppercase: true }))
      .query(query);

    if (result.recordset.length > 0) {
      const payload = {
        ID: result.recordset[0].ID,
        name: result.recordset[0].CNAME,
        role: 'ERP',
      };

      const token = jwt.sign(
        { payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 },
        process.env.JWT_TOKEN,
      );

      res.status(200).json({
        ID: cryptoEncryptText(result.recordset[0].ID, publicKey),
        token,
        name: result.recordset[0].CNAME,
      });

    } else {
      const webAiotDb = await getConnection('WebAIOT');

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
        .input('PWD', sql.VarChar, cryptoHashText(PWD, { uppercase: true }))
        .query(query2);

      if (result2.recordset.length > 0) {
        const payload = {
          ID: result2.recordset[0].ID,
          name: result2.recordset[0].CNAME,
          role: 'AIOT',
        };

        const token = jwt.sign(
          { payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 },
          process.env.JWT_TOKEN,
        );

        res.status(200).json({
          ID: cryptoEncryptText(result2.recordset[0].ID, publicKey),
          token,
          name: result2.recordset[0].CNAME,
        });

      } else {
        res.status(401).json({ 
          success: false, 
          message: 'Invalid credentials' 
        });
      }
    }
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);
    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

// 自動登入
router.post('/user/autologin', verifyToken, async (req, res) => {
  try {
    const { ID, PWD } = req.body;
    const webAiotDb = await getConnection('WebAIOT');
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
      .input('PWD', sql.VarChar, cryptoHashText(PWD, { uppercase: true }))
      .query(query);

    if (result.recordset.length > 0) {
      const payload = {
        ID: result.recordset[0].ID,
        name: result.recordset[0].CNAME,
        role: 'ERP',
      };

      const token = jwt.sign(
        { payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 },
        process.env.JWT_TOKEN,
      );
      res.status(200).json({
        ID: cryptoEncryptText(result.recordset[0].ID, publicKey),
        token,
        name: result.recordset[0].CNAME,
      });
    } else {
      const webAiotDb = await getConnection('WebAIOT');
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
        .input('PWD', sql.VarChar, cryptoHashText(PWD, { uppercase: true }))
        .query(query2);

      if (result2.recordset.length > 0) {
        const payload = {
          ID: result2.recordset[0].ID,
          name: result2.recordset[0].CNAME,
          role: 'AIOT',
        };

        const token = jwt.sign(
          { payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 },
          process.env.JWT_TOKEN,
        );
        res.status(200).json({
          ID: cryptoEncryptText(result2.recordset[0].ID, publicKey),
          token,
          name: result2.recordset[0].CNAME,
        });
      } else {
        res.status(401).json({ 
          success: false, 
          message: 'Invalid credentials' 
        });
      }
    }
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} error:`, error);
    res.status(500).json({
      success: false,
      message: '伺服器錯誤',
      error: error.message,
    });
  }
});

// 使用者權限頁面
router.post('/user/pages', verifyToken, async (req, res) => {
  const { ID } = req.user;

  if (!ID) {
    return res.status(401).json({
      success: false,
      message: 'ID is missing.',
    });
  }

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
