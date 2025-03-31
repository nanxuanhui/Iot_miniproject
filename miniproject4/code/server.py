from flask import Flask, request, jsonify, session
from base64 import b64decode  # Import base64 decoding function
from Crypto.Cipher import AES  # Import AES encryption module
import json  # Import JSON handling module
import sqlite3  # Import SQLite3 database module
import re # Import regular expression module
import logging
import os
from datetime import datetime, timedelta
import shutil
import threading
import time
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from routes.auth import auth
from models.user import User
from database import db

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,  # 改为DEBUG级别以显示更多信息
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('esp32_server.log', mode='a', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 设置Flask的日志级别
logging.getLogger('werkzeug').setLevel(logging.DEBUG)

# Initialize Flask application
app = Flask(__name__)

# 配置 CORS
CORS(app, 
     resources={r"/*": {
         "origins": ["http://localhost:3000"],
         "methods": ["GET", "POST", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization", "Accept"],
         "expose_headers": ["Content-Type", "Authorization"],
         "supports_credentials": True,
         "max_age": 3600
     }},
     supports_credentials=True
)

# 配置
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///esp32.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SECURE'] = False  # 开发环境设置为 False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True

# 初始化数据库
db.init_app(app)

# 注册蓝图
app.register_blueprint(auth, url_prefix='/api/auth')

# 添加全局错误处理
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({"error": "未找到请求的资源"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "服务器内部错误"}), 500

# 移除全局 CORS 头，因为已经由 CORS 中间件处理
@app.after_request
def after_request(response):
    return response

# 移除 OPTIONS 请求处理，因为已经由 CORS 中间件处理
@app.route('/get-data', methods=['OPTIONS'])
def handle_options():
    return jsonify({'message': 'OK'})

# AES-256 encryption key (Must match the key used in the ESP32)
aes_key = bytes([
    0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38,
    0x39, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36,
    0x37, 0x38, 0x39, 0x30, 0x31, 0x32, 0x33, 0x34,
    0x35, 0x36, 0x37, 0x38, 0x39, 0x30, 0x31, 0x32
])

# 数据库配置
DB_NAME = 'sensor_data.db'
BACKUP_DIR = 'backups'
AGGREGATE_INTERVAL = 3600  # 1小时
CLEANUP_THRESHOLD = 30  # 30天
MAX_RETRIES = 3
RETRY_DELAY = 1  # 秒

def init_database():
    """初始化数据库和必要的表"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # 创建主数据表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sensor_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                temperature REAL,
                humidity REAL,
                timestamp INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 创建聚合数据表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS aggregated_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                interval_start INTEGER,
                interval_end INTEGER,
                avg_temperature REAL,
                avg_humidity REAL,
                min_temperature REAL,
                max_temperature REAL,
                min_humidity REAL,
                max_humidity REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 创建索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON sensor_data(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON sensor_data(created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_interval ON aggregated_data(interval_start, interval_end)")
        
        conn.commit()
        conn.close()
        logger.info("数据库初始化成功")
    except Exception as e:
        logger.error(f"数据库初始化失败: {str(e)}")
        raise

def create_backup():
    """创建数据库备份"""
    try:
        if not os.path.exists(BACKUP_DIR):
            os.makedirs(BACKUP_DIR)
            
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = os.path.join(BACKUP_DIR, f'sensor_data_{timestamp}.db')
        
        shutil.copy2(DB_NAME, backup_file)
        logger.info(f"数据库备份创建成功: {backup_file}")
        
        # 清理旧备份（保留最近7天的备份）
        cleanup_old_backups()
    except Exception as e:
        logger.error(f"创建数据库备份失败: {str(e)}")

def cleanup_old_backups():
    """清理旧的数据库备份"""
    try:
        cutoff_date = datetime.now() - timedelta(days=7)
        for filename in os.listdir(BACKUP_DIR):
            filepath = os.path.join(BACKUP_DIR, filename)
            file_time = datetime.fromtimestamp(os.path.getctime(filepath))
            if file_time < cutoff_date:
                os.remove(filepath)
                logger.info(f"删除旧备份: {filepath}")
    except Exception as e:
        logger.error(f"清理旧备份失败: {str(e)}")

def cleanup_old_data():
    """清理旧数据"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        cutoff_timestamp = int((datetime.now() - timedelta(days=CLEANUP_THRESHOLD)).timestamp())
        cursor.execute("DELETE FROM sensor_data WHERE timestamp < ?", (cutoff_timestamp,))
        
        conn.commit()
        conn.close()
        logger.info(f"清理了 {cursor.rowcount} 条旧数据")
    except Exception as e:
        logger.error(f"清理旧数据失败: {str(e)}")

def aggregate_data():
    """聚合传感器数据"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # 获取最新的聚合时间
        cursor.execute("SELECT MAX(interval_end) FROM aggregated_data")
        last_aggregate = cursor.fetchone()[0] or 0
        
        # 获取需要聚合的数据
        cursor.execute("""
            SELECT 
                MIN(timestamp) as interval_start,
                MAX(timestamp) as interval_end,
                AVG(temperature) as avg_temperature,
                AVG(humidity) as avg_humidity,
                MIN(temperature) as min_temperature,
                MAX(temperature) as max_temperature,
                MIN(humidity) as min_humidity,
                MAX(humidity) as max_humidity
            FROM sensor_data
            WHERE timestamp > ?
            GROUP BY strftime('%Y-%m-%d %H:00:00', datetime(timestamp, 'unixepoch'))
        """, (last_aggregate,))
        
        results = cursor.fetchall()
        
        # 插入聚合数据
        cursor.executemany("""
            INSERT INTO aggregated_data 
            (interval_start, interval_end, avg_temperature, avg_humidity, 
             min_temperature, max_temperature, min_humidity, max_humidity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, results)
        
        conn.commit()
        conn.close()
        logger.info(f"成功聚合 {len(results)} 条数据")
    except Exception as e:
        logger.error(f"数据聚合失败: {str(e)}")

def schedule_maintenance():
    """调度维护任务"""
    while True:
        try:
            # 每天凌晨2点执行清理和备份
            now = datetime.now()
            if now.hour == 2 and now.minute == 0:
                cleanup_old_data()
                create_backup()
            
            # 每小时聚合数据
            if now.minute == 0:
                aggregate_data()
            
            time.sleep(60)  # 每分钟检查一次
        except Exception as e:
            logger.error(f"维护任务执行失败: {str(e)}")
            time.sleep(60)  # 发生错误时等待1分钟后重试

def is_base64(s):
    """检查字符串是否为Base64编码"""
    return bool(re.fullmatch(r"^[A-Za-z0-9+/]*={0,2}$", s))

"""
Decrypts an AES-256 encrypted Base64-encoded string.

:param cipher_text: The Base64-encoded encrypted text received from ESP32.
:return: The decrypted plaintext JSON string, or None if decryption fails.
"""
def decrypt_aes(cipher_text):
    try:
        if not is_base64(cipher_text):
            logger.error("无效的Base64编码数据")
            return None
            
        cipher_text = b64decode(cipher_text)
        cipher = AES.new(aes_key, AES.MODE_ECB)
        decrypted = cipher.decrypt(cipher_text).decode()
        
        # 处理PKCS7填充
        pad = ord(decrypted[-1])
        if 1 <= pad <= 16:
            decrypted = decrypted[:-pad]
            
        decrypted = decrypted.strip().replace("\x00", "")
        
        if not decrypted:
            logger.error("解密后的数据为空")
            return None
            
        return decrypted
    except Exception as e:
        logger.error(f"AES解密失败: {str(e)}")
        return None

def save_data(data):
    """保存传感器数据"""
    for attempt in range(MAX_RETRIES):
        try:
            conn = sqlite3.connect(DB_NAME)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO sensor_data (temperature, humidity, timestamp)
                VALUES (?, ?, ?)
            """, (data["temperature"], data["humidity"], data["timestamp"]))
            
            conn.commit()
            conn.close()
            logger.info(f"数据保存成功: {data}")
            return True
        except Exception as e:
            logger.error(f"保存数据失败 (尝试 {attempt + 1}/{MAX_RETRIES}): {str(e)}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
            else:
                return False

"""
Flask route to handle incoming POST requests with encrypted sensor data.

:return: JSON response indicating success or error.
"""
@app.route('/api/post-data', methods=['POST'])
def receive_data():
    try:
        # 获取原始数据
        raw_data = request.get_data().decode('utf-8')
        logger.debug(f"接收到的原始数据: {raw_data}")
        
        # 验证是否为base64编码
        if not is_base64(raw_data):
            logger.error("数据不是有效的base64编码")
            return jsonify({"error": "无效的数据格式"}), 400
            
        # 解密数据
        try:
            decrypted_data = decrypt_aes(raw_data)
            logger.debug(f"解密后的数据: {decrypted_data}")
        except Exception as e:
            logger.error(f"数据解密失败: {str(e)}")
            return jsonify({"error": "数据解密失败"}), 400
            
        # 保存数据
        try:
            save_data(decrypted_data)
        except Exception as e:
            logger.error(f"数据保存失败: {str(e)}")
            return jsonify({"error": "数据保存失败"}), 500
            
        return jsonify({"message": "数据接收成功"})
    except Exception as e:
        logger.error(f"数据接收处理失败: {str(e)}")
        return jsonify({"error": "数据接收处理失败"}), 500

"""
Flask route to retrieve all sensor data from the SQLite database.
"""
@app.route('/api/get-data', methods=['GET'])
def get_data():
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # 获取最近的20条数据
        cursor.execute("""
            SELECT temperature, humidity, timestamp 
            FROM sensor_data 
            ORDER BY timestamp DESC 
            LIMIT 20
        """)
        
        data = cursor.fetchall()
        conn.close()
        
        # 转换数据格式
        formatted_data = [{
            'temperature': row[0],
            'humidity': row[1],
            'timestamp': row[2]
        } for row in data]
        
        return jsonify(formatted_data)
    except Exception as e:
        logger.error(f"获取数据失败: {str(e)}")
        return jsonify({'error': '获取数据失败'}), 500

@app.route('/api/get-aggregated-data', methods=['GET'])
def get_aggregated_data():
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # 获取最近24小时的聚合数据
        start_time = int((datetime.now() - timedelta(hours=24)).timestamp())
        
        cursor.execute("""
            SELECT 
                interval_start,
                interval_end,
                avg_temperature,
                avg_humidity,
                min_temperature,
                max_temperature,
                min_humidity,
                max_humidity
            FROM aggregated_data
            WHERE interval_start >= ?
            ORDER BY interval_start DESC
        """, (start_time,))
        
        data = cursor.fetchall()
        conn.close()
        
        formatted_data = [{
            'interval_start': row[0],
            'interval_end': row[1],
            'avg_temperature': row[2],
            'avg_humidity': row[3],
            'min_temperature': row[4],
            'max_temperature': row[5],
            'min_humidity': row[6],
            'max_humidity': row[7]
        } for row in data]
        
        return jsonify(formatted_data)
    except Exception as e:
        logger.error(f"获取聚合数据失败: {str(e)}")
        return jsonify({'error': '获取聚合数据失败'}), 500

@app.route('/api/search-temperature', methods=['GET'])
def search_temperature():
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        threshold = request.args.get('threshold', type=float)
        condition = request.args.get('condition', 'above')  # 'above' 或 'below'
        
        if not threshold:
            return jsonify({'error': '请提供温度阈值'}), 400
            
        if condition not in ['above', 'below']:
            return jsonify({'error': '无效的条件，请使用 "above" 或 "below"'}), 400
            
        operator = '>' if condition == 'above' else '<'
        query = f"""
            SELECT temperature, humidity, timestamp
            FROM sensor_data
            WHERE temperature {operator} ?
            ORDER BY timestamp DESC
        """
        
        cursor.execute(query, (threshold,))
        data = cursor.fetchall()
        conn.close()
        
        formatted_data = [{
            'temperature': row[0],
            'humidity': row[1],
            'timestamp': row[2]
        } for row in data]
        
        return jsonify(formatted_data)
    except Exception as e:
        logger.error(f"搜索温度数据失败: {str(e)}")
        return jsonify({'error': '搜索温度数据失败'}), 500

# 创建数据库表
with app.app_context():
    db.create_all()
    
    # 创建默认管理员账户
    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin')
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
        logger.info("创建默认管理员账户成功")

"""
Main entry point: Starts the Flask server on port 8888, accessible to all network devices.
"""
if __name__ == "__main__":
    # 初始化数据库
    init_database()
    
    # 启动维护任务线程
    maintenance_thread = threading.Thread(target=schedule_maintenance, daemon=True)
    maintenance_thread.start()
    
    # 启动Flask服务器
    app.run(host='0.0.0.0', port=8888, debug=True)  # Start Flask server on port 8888
