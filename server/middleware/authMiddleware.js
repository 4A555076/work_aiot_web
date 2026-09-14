const jwt = require('jsonwebtoken');
require('dotenv').config();

function verifyToken(req, res, next) { 
  try {
    const tokenHeader = req.header('Authorization');
    if (!tokenHeader || !tokenHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' }); // Token 未提供
    }

    const token = tokenHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
      if (err) {
        const message = 
          err.name === 'TokenExpiredError' 
            ? 'Token expired'  // Token 過期
            : 'Invalid token'; // Token 無效或被篡改
        return res.status(401).json({ success: false, message });
      }

      if (decoded.payload) {
        req.user = decoded.payload; // 存入請求對象供後續使用
      } else if (decoded.ID && decoded.PWD) {
        const { ID, PWD } = decoded;
        req.user = { ID };
        req.body = { ...req.body, ID, PWD }; // 保留原 request body 並支援舊版 autologin token
      } else {
        return res.status(401).json({ success: false, message: 'Invalid token payload' }); // Token 解碼內容無效
      }

      next();
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' }); //伺服器錯誤
  }
};

module.exports = { verifyToken };
