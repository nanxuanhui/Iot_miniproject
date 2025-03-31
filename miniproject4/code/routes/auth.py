from flask import Blueprint, request, jsonify, session
from models.user import User
from database import db
from functools import wraps

auth = Blueprint('auth', __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': '请先登录'}), 401
        return f(*args, **kwargs)
    return decorated_function

@auth.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': '请提供用户名和密码'}), 400
        
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': '用户名已存在'}), 400
        
    user = User(username=data['username'])
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': '注册成功'}), 201

@auth.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        print('收到登录请求:', data)
        
        if not data or 'username' not in data or 'password' not in data:
            print('缺少用户名或密码')
            return jsonify({'error': '请提供用户名和密码'}), 400
            
        user = User.query.filter_by(username=data['username']).first()
        print('查询到用户:', user.username if user else None)
        
        if user and user.check_password(data['password']):
            print('密码验证成功')
            session['user_id'] = user.id
            session['username'] = user.username
            return jsonify({
                'message': '登录成功',
                'user': user.to_dict()
            })
            
        print('用户名或密码错误')
        return jsonify({'error': '用户名或密码错误'}), 401
    except Exception as e:
        print('登录过程出错:', str(e))
        return jsonify({'error': '登录失败，请重试'}), 500

@auth.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': '已登出'})

@auth.route('/me', methods=['GET'])
@login_required
def get_current_user():
    user = User.query.get(session['user_id'])
    return jsonify(user.to_dict()) 