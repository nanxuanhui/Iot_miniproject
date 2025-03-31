import { storeMultipleEncryptedData } from './databaseService';

// API 基础 URL
const API_BASE_URL = 'http://172.31.99.212:8888/api';

// 通用请求配置
const defaultConfig = {
  credentials: 'include',
  mode: 'cors',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// 获取传感器数据
export const fetchData = async () => {
  try {
    console.log('开始从数据库获取数据...');
    
    // 获取服务器数据
    const response = await fetch(`${API_BASE_URL}/get-data`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const serverData = await response.json();
    console.log('从数据库获取到的原始数据:', serverData);
    
    if (!Array.isArray(serverData)) {
      console.error('数据库返回的数据格式不正确:', serverData);
      return [];
    }
    
    if (serverData.length === 0) {
      console.log('数据库中没有数据');
      return [];
    }
    
    // 验证数据格式并确保数值类型正确
    const validData = serverData.filter(item => {
      if (!item) {
        console.warn('发现空数据项');
        return false;
      }
      
      // 确保所有必需的字段都存在
      if (!('temperature' in item) || !('humidity' in item) || !('timestamp' in item)) {
        console.warn('数据缺少必需字段:', item);
        return false;
      }
      
      // 确保数值类型正确
      const temperature = Number(item.temperature);
      const humidity = Number(item.humidity);
      const timestamp = Number(item.timestamp);
      
      if (isNaN(temperature) || isNaN(humidity) || isNaN(timestamp)) {
        console.warn('数据包含无效数值:', item);
        return false;
      }
      
      // 更新数据项为正确的数值类型
      item.temperature = temperature;
      item.humidity = humidity;
      item.timestamp = timestamp;
      
      return true;
    });
    
    if (validData.length === 0) {
      console.error('数据库中没有有效数据');
      return [];
    }
    
    // 按时间戳排序
    const sortedData = validData.sort((a, b) => b.timestamp - a.timestamp);
    console.log('排序后的数据库数据:', sortedData);
    
    // 获取最新数据
    const latest = sortedData[0];
    console.log('数据库最新数据:', {
      温度: latest.temperature,
      湿度: latest.humidity,
      时间: new Date(latest.timestamp * 1000).toLocaleString()
    });
    
    return sortedData;
  } catch (error) {
    console.error('从数据库获取数据失败:', error);
    return [];
  }
};

// 根据阈值过滤温度或湿度数据
export const fetchFilteredData = async (threshold, isAbove, type = 'temperature') => {
    try {
        const operator = isAbove ? 'above' : 'below';
        const params = new URLSearchParams({
            threshold: threshold,
            condition: operator
        });
        
        const response = await fetch(`${API_BASE_URL}/search-temperature?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('网络请求错误');
        }
        
        const data = await response.json();
        
        // 存储过滤后的数据到本地数据库，以便离线访问
        if (data && data.length > 0) {
            await storeMultipleEncryptedData(data);
            console.log('存储过滤数据成功');
        }
        
        return data;
    } catch (error) {
        console.error('过滤数据失败:', error);
        return [];
    }
};

// 根据温度阈值搜索数据
export const searchTemperature = async (threshold, operator = 'above') => {
    try {
        const params = new URLSearchParams({
            threshold: threshold,
            condition: operator
        });

        const response = await fetch(`${API_BASE_URL}/search-temperature?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!Array.isArray(data)) {
            console.error('搜索返回的数据格式不正确:', data);
            return { error: '数据格式错误' };
        }

        console.log(`找到 ${data.length} 条符合条件的数据`);
        
        if (data.length > 0) {
            console.log('最新记录:', {
                温度: data[0].temperature,
                湿度: data[0].humidity,
                时间: new Date(data[0].timestamp * 1000).toLocaleString()
            });
        }

        return {
            total: data.length,
            data: data
        };
    } catch (error) {
        console.error('温度搜索失败:', error);
        return { error: '搜索失败，请重试' };
    }
};

export const login = async (username, password) => {
  try {
    console.log('发送登录请求:', { username });
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      ...defaultConfig,
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    console.log('登录响应状态:', response.status);
    const data = await response.json();
    console.log('登录响应数据:', data);
    
    if (!response.ok) {
      throw new Error(data.error || '登录失败');
    }
    
    return data;
  } catch (error) {
    console.error('登录请求错误:', error);
    return { error: error.message };
  }
};

export const logout = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      ...defaultConfig,
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '登出失败');
    }
    
    return data;
  } catch (error) {
    console.error('登出错误:', error);
    return { error: error.message };
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      ...defaultConfig,
      method: 'GET'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '获取用户信息失败');
    }
    
    return data;
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return { error: error.message };
  }
};

export const register = async (username, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      ...defaultConfig,
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '注册失败');
    }
    
    return data;
  } catch (error) {
    console.error('注册错误:', error);
    return { error: error.message };
  }
};
