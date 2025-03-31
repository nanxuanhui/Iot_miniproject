import { encryptData, decryptData } from './encryptionService';

// 数据库名称和对象存储名称
const DB_NAME = 'esp32SensorDB';
const STORE_NAME = 'sensorData';
const DB_VERSION = 1;

// 打开数据库连接
const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('数据库打开失败:', event.target.error);
      reject('无法打开数据库');
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };
    
    // 如果数据库不存在或版本升级，创建对象存储
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 创建对象存储，使用时间戳作为主键
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
        // 创建索引，用于按时间范围查询
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// 存储加密的温湿度数据
export const storeEncryptedData = async (data) => {
  try {
    // 加密数据
    const encryptedData = encryptData(data);
    if (!encryptedData) {
      throw new Error('数据加密失败');
    }
    
    // 添加时间戳，如果不存在
    const timestamp = data.timestamp || new Date().getTime();
    const dataToStore = {
      ...encryptedData,
      timestamp
    };
    
    // 打开数据库并存储数据
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = objectStore.put(dataToStore);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('存储数据失败:', event.target.error);
        reject('存储数据失败');
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('存储加密数据失败:', error);
    return false;
  }
};

// 批量存储加密的温湿度数据
export const storeMultipleEncryptedData = async (dataArray) => {
  try {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return false;
    }
    
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      let successCount = 0;
      
      dataArray.forEach(data => {
        // 加密数据
        const encryptedData = encryptData(data);
        if (!encryptedData) {
          return;
        }
        
        // 添加时间戳
        const timestamp = data.timestamp || new Date().getTime();
        const dataToStore = {
          ...encryptedData,
          timestamp
        };
        
        const request = objectStore.put(dataToStore);
        
        request.onsuccess = () => {
          successCount++;
          if (successCount === dataArray.length) {
            resolve(true);
          }
        };
        
        request.onerror = (event) => {
          console.error('批量存储数据失败:', event.target.error);
        };
      });
      
      transaction.oncomplete = () => {
        db.close();
        if (successCount > 0 && successCount < dataArray.length) {
          resolve(true); // 部分成功也视为成功
        }
      };
      
      transaction.onerror = (event) => {
        console.error('事务失败:', event.target.error);
        reject('批量存储失败');
      };
    });
  } catch (error) {
    console.error('批量存储加密数据失败:', error);
    return false;
  }
};

// 获取所有存储的温湿度数据并解密
export const getAllDecryptedData = async () => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = objectStore.getAll();
      
      request.onsuccess = (event) => {
        const encryptedRecords = event.target.result;
        
        // 解密所有记录
        const decryptedRecords = encryptedRecords
          .map(record => {
            const encryptedDataObj = {
              iv: record.iv,
              data: record.data
            };
            
            const decryptedData = decryptData(encryptedDataObj);
            if (decryptedData) {
              return {
                ...decryptedData,
                timestamp: record.timestamp
              };
            }
            return null;
          })
          .filter(record => record !== null);
        
        resolve(decryptedRecords);
      };
      
      request.onerror = (event) => {
        console.error('获取数据失败:', event.target.error);
        reject('获取数据失败');
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('获取解密数据失败:', error);
    return [];
  }
};

// 根据日期范围获取数据
export const getDataByDateRange = async (startDate, endDate) => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index('timestamp');
    
    // 转换日期为时间戳
    const startTimestamp = startDate instanceof Date ? startDate.getTime() : startDate;
    const endTimestamp = endDate instanceof Date ? endDate.getTime() : endDate;
    
    const range = IDBKeyRange.bound(startTimestamp, endTimestamp);
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(range);
      
      request.onsuccess = (event) => {
        const encryptedRecords = event.target.result;
        
        // 解密所有记录
        const decryptedRecords = encryptedRecords
          .map(record => {
            const encryptedDataObj = {
              iv: record.iv,
              data: record.data
            };
            
            const decryptedData = decryptData(encryptedDataObj);
            if (decryptedData) {
              return {
                ...decryptedData,
                timestamp: record.timestamp
              };
            }
            return null;
          })
          .filter(record => record !== null);
        
        resolve(decryptedRecords);
      };
      
      request.onerror = (event) => {
        console.error('获取日期范围数据失败:', event.target.error);
        reject('获取日期范围数据失败');
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('按日期范围获取数据失败:', error);
    return [];
  }
};

// 删除超过指定天数的旧数据
export const deleteOldData = async (daysToKeep = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTimestamp = cutoffDate.getTime();
    
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index('timestamp');
    
    const range = IDBKeyRange.upperBound(cutoffTimestamp);
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      request.onerror = (event) => {
        console.error('删除旧数据失败:', event.target.error);
        reject('删除旧数据失败');
      };
      
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };
    });
  } catch (error) {
    console.error('删除旧数据失败:', error);
    return false;
  }
}; 