import { openDB } from 'idb';
import { encryptData, decryptData } from './encryptionService';

const DB_NAME = 'sensorDB';
const DB_VERSION = 2;
const STORE_NAME = 'sensorData';
const BACKUP_STORE_NAME = 'sensorDataBackup';
const AGGREGATE_STORE_NAME = 'sensorDataAggregate';

// 数据库配置
const dbConfig = {
    name: DB_NAME,
    version: DB_VERSION,
    stores: {
        [STORE_NAME]: {
            keyPath: 'id',
            indexes: [
                { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } },
                { name: 'temperature', keyPath: 'temperature', options: { unique: false } },
                { name: 'humidity', keyPath: 'humidity', options: { unique: false } }
            ]
        },
        [BACKUP_STORE_NAME]: {
            keyPath: 'id',
            indexes: [
                { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }
            ]
        },
        [AGGREGATE_STORE_NAME]: {
            keyPath: 'id',
            indexes: [
                { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }
            ]
        }
    }
};

// 数据库管理器类
class DatabaseManager {
    constructor() {
        this.db = null;
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1秒
        this.cleanupThreshold = 30 * 24 * 60 * 60 * 1000; // 30天
        this.aggregateInterval = 60 * 60 * 1000; // 1小时
    }

    // 初始化数据库
    async init() {
        try {
            this.db = await openDB(DB_NAME, DB_VERSION, {
                upgrade(db) {
                    // 创建主数据存储
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                        dbConfig.stores[STORE_NAME].indexes.forEach(index => {
                            store.createIndex(index.name, index.keyPath, index.options);
                        });
                    }

                    // 创建备份存储
                    if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
                        const backupStore = db.createObjectStore(BACKUP_STORE_NAME, { keyPath: 'id' });
                        dbConfig.stores[BACKUP_STORE_NAME].indexes.forEach(index => {
                            backupStore.createIndex(index.name, index.keyPath, index.options);
                        });
                    }

                    // 创建聚合数据存储
                    if (!db.objectStoreNames.contains(AGGREGATE_STORE_NAME)) {
                        const aggregateStore = db.createObjectStore(AGGREGATE_STORE_NAME, { keyPath: 'id' });
                        dbConfig.stores[AGGREGATE_STORE_NAME].indexes.forEach(index => {
                            aggregateStore.createIndex(index.name, index.keyPath, index.options);
                        });
                    }
                }
            });

            console.log('数据库初始化成功');
            return true;
        } catch (error) {
            console.error('数据库初始化失败:', error);
            return false;
        }
    }

    // 添加数据（带重试机制）
    async addData(data) {
        let attempts = 0;
        while (attempts < this.retryAttempts) {
            try {
                const encryptedData = await encryptData(JSON.stringify(data));
                const id = Date.now();
                await this.db.add(STORE_NAME, {
                    id,
                    data: encryptedData,
                    timestamp: Date.now()
                });
                console.log('数据添加成功:', id);
                return true;
            } catch (error) {
                attempts++;
                console.error(`添加数据失败 (尝试 ${attempts}/${this.retryAttempts}):`, error);
                if (attempts < this.retryAttempts) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        return false;
    }

    // 获取数据（带重试机制）
    async getData() {
        let attempts = 0;
        while (attempts < this.retryAttempts) {
            try {
                const allData = await this.db.getAll(STORE_NAME);
                const decryptedData = await Promise.all(
                    allData.map(async item => {
                        const decrypted = await decryptData(item.data);
                        return JSON.parse(decrypted);
                    })
                );
                return decryptedData;
            } catch (error) {
                attempts++;
                console.error(`获取数据失败 (尝试 ${attempts}/${this.retryAttempts}):`, error);
                if (attempts < this.retryAttempts) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        return [];
    }

    // 清理旧数据
    async cleanupOldData() {
        try {
            const cutoffTime = Date.now() - this.cleanupThreshold;
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('timestamp');
            
            let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoffTime));
            while (cursor) {
                await store.delete(cursor.primaryKey);
                cursor = await cursor.continue();
            }
            
            await tx.done;
            console.log('旧数据清理完成');
        } catch (error) {
            console.error('清理旧数据失败:', error);
        }
    }

    // 创建数据备份
    async createBackup() {
        try {
            const data = await this.getData();
            const backupData = data.map(item => ({
                ...item,
                backupTimestamp: Date.now()
            }));

            const tx = this.db.transaction(BACKUP_STORE_NAME, 'readwrite');
            const store = tx.objectStore(BACKUP_STORE_NAME);
            
            for (const item of backupData) {
                await store.add(item);
            }
            
            await tx.done;
            console.log('数据备份创建成功');
        } catch (error) {
            console.error('创建数据备份失败:', error);
        }
    }

    // 聚合数据
    async aggregateData() {
        try {
            const data = await this.getData();
            const now = Date.now();
            const intervalStart = now - this.aggregateInterval;

            // 按时间间隔分组数据
            const groupedData = data.reduce((acc, item) => {
                const interval = Math.floor(item.timestamp / this.aggregateInterval);
                if (!acc[interval]) {
                    acc[interval] = {
                        temperatures: [],
                        humidities: []
                    };
                }
                acc[interval].temperatures.push(item.temperature);
                acc[interval].humidities.push(item.humidity);
                return acc;
            }, {});

            // 计算聚合值
            const aggregatedData = Object.entries(groupedData).map(([interval, values]) => ({
                id: parseInt(interval) * this.aggregateInterval,
                timestamp: parseInt(interval) * this.aggregateInterval,
                avgTemperature: values.temperatures.reduce((a, b) => a + b, 0) / values.temperatures.length,
                avgHumidity: values.humidities.reduce((a, b) => a + b, 0) / values.humidities.length,
                minTemperature: Math.min(...values.temperatures),
                maxTemperature: Math.max(...values.temperatures),
                minHumidity: Math.min(...values.humidities),
                maxHumidity: Math.max(...values.humidities)
            }));

            // 存储聚合数据
            const tx = this.db.transaction(AGGREGATE_STORE_NAME, 'readwrite');
            const store = tx.objectStore(AGGREGATE_STORE_NAME);
            
            for (const item of aggregatedData) {
                await store.put(item);
            }
            
            await tx.done;
            console.log('数据聚合完成');
        } catch (error) {
            console.error('数据聚合失败:', error);
        }
    }

    // 获取聚合数据
    async getAggregatedData() {
        try {
            return await this.db.getAll(AGGREGATE_STORE_NAME);
        } catch (error) {
            console.error('获取聚合数据失败:', error);
            return [];
        }
    }

    // 定期维护任务
    async scheduleMaintenance() {
        // 每天清理一次旧数据
        setInterval(() => this.cleanupOldData(), 24 * 60 * 60 * 1000);
        
        // 每天创建一次备份
        setInterval(() => this.createBackup(), 24 * 60 * 60 * 1000);
        
        // 每小时聚合一次数据
        setInterval(() => this.aggregateData(), this.aggregateInterval);
    }
}

// 创建单例实例
const databaseManager = new DatabaseManager();
export default databaseManager; 