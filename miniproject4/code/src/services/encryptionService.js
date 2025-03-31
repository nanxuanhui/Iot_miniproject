import CryptoJS from 'crypto-js';

// 与服务器相同的AES-256加密密钥 (32字节)
const aesKeyBytes = [
  0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 
  0x39, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 
  0x37, 0x38, 0x39, 0x30, 0x31, 0x32, 0x33, 0x34, 
  0x35, 0x36, 0x37, 0x38, 0x39, 0x30, 0x31, 0x32
];

// 将字节数组转换为十六进制字符串
const getHexKey = () => {
  return aesKeyBytes.map(byte => ('0' + byte.toString(16)).slice(-2)).join('');
};

// 加密数据
export const encryptData = (data) => {
  try {
    const jsonString = JSON.stringify(data);
    const key = CryptoJS.enc.Hex.parse(getHexKey());
    // 生成随机IV
    const iv = CryptoJS.lib.WordArray.random(16);
    
    const encrypted = CryptoJS.AES.encrypt(jsonString, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // 返回IV + 加密数据，两者都是Base64编码
    return {
      iv: iv.toString(CryptoJS.enc.Base64),
      data: encrypted.toString()
    };
  } catch (error) {
    console.error('加密失败:', error);
    return null;
  }
};

// 解密数据
export const decryptData = (encryptedData) => {
  try {
    const key = CryptoJS.enc.Hex.parse(getHexKey());
    const iv = CryptoJS.enc.Base64.parse(encryptedData.iv);
    
    const decrypted = CryptoJS.AES.decrypt(encryptedData.data, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('解密失败:', error);
    return null;
  }
}; 