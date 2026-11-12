const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authorization = req.get('Authorization');
  const match = /^Bearer ([^\s]+)$/i.exec(authorization || '');

  if (!match) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  try {
    const decoded = jwt.verify(
      match[1],
      process.env.JWT_TOKEN,
      {
        algorithms: ['HS256'],
        issuer: 'aiot-api',
        audience: 'aiot-web',
      },
    );

    // 檢查使用者資訊及角色是否合法
    if (
      typeof decoded.ID !== 'string' ||
      decoded.ID.length === 0 ||
      !['ERP', 'AIOT'].includes(decoded.role)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    req.user = {
      ID: decoded.ID,
      name: typeof decoded.name === 'string' ? decoded.name : '',
      role: decoded.role,
    };

    return next();
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError'
        ? 'Token expired'
        : 'Unauthorized';

    return res.status(401).json({
      success: false,
      message,
    });
  }
}

module.exports = { verifyToken };