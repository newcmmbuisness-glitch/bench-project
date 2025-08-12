// netlify/functions/crypto_utils.js
const crypto = require('crypto');
const ALGO = 'aes-256-cbc';
const IV_LENGTH = 16;

function encrypt(text, secretHex) {
  const key = Buffer.from(secretHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex'); // iv:payload
}

function decrypt(encryptedWithIv, secretHex) {
  const parts = (encryptedWithIv || '').split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted format');
  const [ivHex, dataHex] = parts;
  const key = Buffer.from(secretHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };

