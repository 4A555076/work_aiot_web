const crypto = require('crypto');


// 產生指定金鑰長度的 RSA 公鑰與私鑰
function cryptoGenerateRSAKeyPair({ modulusLength = 2048 } = {}) {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}


// 使用 RSA 公鑰加密文字，並回傳 Base64 字串
function cryptoEncryptText(text, key, { oaepHash = 'sha256' } = {}) {
  const encryptedBuffer = crypto.publicEncrypt(
    { key, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash },
    Buffer.from(String(text), 'utf8'),
  );
  return encryptedBuffer.toString('base64');
}


// 使用 RSA 私鑰解密 Base64 密文，並回傳原始文字
function cryptoDecryptText(encryptedText, key, { oaepHash = 'sha256' } = {}) {
  const decryptedBuffer = crypto.privateDecrypt(
    { key, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash },
    Buffer.from(encryptedText, 'base64'),
  );
  return decryptedBuffer.toString('utf8');
}


// 使用指定演算法雜湊文字，並依設定輸出編碼結果
function cryptoHashText(text, { algorithm = 'sha256', encoding = 'hex', uppercase = false } = {}) {
  const digest = crypto.createHash(algorithm).update(String(text), 'utf8').digest(encoding);
  return uppercase && typeof digest === 'string' ? digest.toUpperCase() : digest;
}


module.exports = {
  cryptoDecryptText,
  cryptoEncryptText,
  cryptoGenerateRSAKeyPair,
  cryptoHashText,
};
