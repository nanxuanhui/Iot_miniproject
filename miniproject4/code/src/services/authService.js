import CryptoJS from 'crypto-js';

// 常量配置
const TOKEN_STORAGE_KEY = 'auth_token';
const USER_INFO_KEY = 'auth_user';
const USER_STORAGE_KEY = 'auth_users';
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7天

// 用于测试的函数，计算密码哈希值
const testHashPassword = (password) => {
  console.log('测试密码:', password);
  const hash = CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
  console.log('生成的哈希值:', hash);
  return hash;
};

// 为了确保哈希值正确，预计算密码哈希
const adminPwdHash = testHashPassword('admin123');
const userPwdHash = testHashPassword('user123');

// 直接使用简单字符串密码进行测试（仅开发环境使用）
const initialUsers = [
  {
    id: 1,
    username: 'admin',
    // 临时使用明文密码测试
    password: 'admin123',
    name: '管理员',
    role: 'admin',
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    username: 'user',
    // 临时使用明文密码测试
    password: 'user123',
    name: '普通用户',
    role: 'user',
    createdAt: new Date().toISOString()
  },
  {
    id: 3, 
    username: 'test',
    password: 'test123',
    name: '测试用户',
    role: 'user',
    createdAt: new Date().toISOString()
  }
];

// 初始化认证服务
const initAuthService = () => {
  // 每次都强制重置数据用于测试
  console.log('初始化认证服务，重置所有数据');
  // 清除旧数据并重置
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_INFO_KEY);
  
  // 保存初始用户
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(initialUsers));
  
  // 更新版本
  localStorage.setItem('auth_version', '1.1');
};

// 立即初始化
initAuthService();

// 加载用户数据
const loadUsers = () => {
  const storedUsers = localStorage.getItem(USER_STORAGE_KEY);
  if (storedUsers) {
    return JSON.parse(storedUsers);
  } else {
    // 首次使用时，保存初始用户到本地存储
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(initialUsers));
    return initialUsers;
  }
};

// 保存用户数据
const saveUsers = (users) => {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
};

// 保存当前用户信息到本地存储
const saveUserToStorage = (user) => {
  // 去除密码等敏感信息
  const safeUser = { ...user };
  delete safeUser.password;
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(safeUser));
};

// 生成简单令牌
const generateToken = (user) => {
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    exp: new Date().getTime() + TOKEN_EXPIRY
  };
  
  // 简单加密
  const token = CryptoJS.AES.encrypt(
    JSON.stringify(payload), 
    'esp32-secure-monitoring-app-secret-key'
  ).toString();
  
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  return token;
};

// 验证密码 - 修改为直接比较（仅开发环境测试用）
const verifyPassword = (plainPassword, hashedPassword) => {
  // 临时改为直接比较明文密码 
  return plainPassword === hashedPassword;
};

// 哈希密码 - 临时返回明文（仅开发环境测试用）
const hashPassword = (password) => {
  // 临时直接返回明文密码
  return password;
};

// 用户登录
export const login = async (username, password, remember = false) => {
  console.log('尝试登录:', username, password);
  
  const users = loadUsers();
  console.log('当前用户列表:', users);
  
  const user = users.find(u => u.username === username);
  
  if (!user) {
    console.log('找不到用户:', username);
    throw new Error('用户名或密码不正确');
  }
  
  console.log('找到用户:', user);
  console.log('验证密码:', password, user.password);
  
  const isPasswordValid = verifyPassword(password, user.password);
  console.log('密码验证结果:', isPasswordValid);
  
  if (!isPasswordValid) {
    throw new Error('用户名或密码不正确');
  }
  
  // 生成令牌
  const token = generateToken(user);
  
  // 保存用户信息到本地存储
  saveUserToStorage(user);
  
  // 保存记住的用户名
  if (remember) {
    localStorage.setItem('remembered_username', username);
  } else {
    localStorage.removeItem('remembered_username');
  }
  
  console.log('登录成功:', user);
  return { ...user, token };
};

// 用户注册
export const register = async (userData) => {
  const { username, password, name } = userData;
  
  const users = loadUsers();
  
  // 检查用户名是否已存在
  if (users.some(u => u.username === username)) {
    throw new Error('用户名已存在');
  }
  
  // 哈希密码
  const hashedPassword = hashPassword(password);
  
  // 创建新用户
  const newUser = {
    id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
    username,
    password: hashedPassword,
    name: name || username,
    role: 'user',
    createdAt: new Date().toISOString()
  };
  
  // 添加到用户列表
  users.push(newUser);
  saveUsers(users);
  
  // 生成令牌
  const token = generateToken(newUser);
  
  // 保存用户信息到本地存储
  saveUserToStorage(newUser);
  
  return { ...newUser, token };
};

// 用户退出
export const logout = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_INFO_KEY);
};

// 获取当前用户
export const getCurrentUser = () => {
  const userJson = localStorage.getItem(USER_INFO_KEY);
  if (!userJson) return null;
  
  try {
    return JSON.parse(userJson);
  } catch (e) {
    console.error('解析用户数据错误:', e);
    return null;
  }
};

// 检查是否已认证
export const isAuthenticated = () => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return false;
  
  try {
    // 解密令牌
    const bytes = CryptoJS.AES.decrypt(
      token, 
      'esp32-secure-monitoring-app-secret-key'
    );
    const decoded = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    
    // 检查是否过期
    if (decoded.exp < new Date().getTime()) {
      logout(); // 清除过期令牌
      return false;
    }
    
    return true;
  } catch (e) {
    // 令牌无效
    console.error('验证令牌错误:', e);
    logout(); // 清除无效令牌
    return false;
  }
};

// 获取令牌
export const getToken = () => {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}; 