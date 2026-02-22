from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
import json
import os
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__)
app.secret_key = 'kharcha_secret_key_2024'

DB_FILE = 'database.json'

# ─── Database Helpers ───
def get_db():
    if not os.path.exists(DB_FILE):
        return {"users": [], "expenses": []}
    with open(DB_FILE, 'r') as f:
        return json.load(f)

def save_db(db):
    with open(DB_FILE, 'w') as f:
        json.dump(db, f, indent=2)

# ─── Auth Decorator ───
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Login karo pehle'}), 401
        return f(*args, **kwargs)
    return decorated

# ─── Routes ───
@app.route('/')
def index():
    return render_template('index.html')

# ── Auth APIs ──
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username', '').strip()
    email    = data.get('email', '').strip()
    password = data.get('password', '')

    if not username or len(username) < 3:
        return jsonify({'error': 'Username kam se kam 3 characters ka hona chahiye'}), 400
    if not email or '@' not in email:
        return jsonify({'error': 'Valid email daalo'}), 400
    if not password or len(password) < 6:
        return jsonify({'error': 'Password kam se kam 6 characters ka hona chahiye'}), 400

    db = get_db()
    if any(u['username'] == username for u in db['users']):
        return jsonify({'error': 'Yeh username pehle se le liya hai'}), 400
    if any(u['email'] == email for u in db['users']):
        return jsonify({'error': 'Yeh email pehle se register hai'}), 400

    user = {
        'id': int(datetime.now().timestamp() * 1000),
        'username': username,
        'email': email,
        'password': generate_password_hash(password),
        'created_at': datetime.now().isoformat()
    }
    db['users'].append(user)
    save_db(db)

    session['user_id'] = user['id']
    session['username'] = user['username']
    return jsonify({'message': f'Account ban gaya! Welcome {username} 🎉', 'username': username})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Sab fields bharo'}), 400

    db = get_db()
    user = next((u for u in db['users'] if u['username'] == username), None)

    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Username ya password galat hai'}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']
    return jsonify({'message': f'Welcome back {username}! 👋', 'username': username})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logout ho gaye'})

@app.route('/api/me')
def me():
    if 'user_id' in session:
        return jsonify({'logged_in': True, 'username': session['username']})
    return jsonify({'logged_in': False})

# ── Expense APIs ──
@app.route('/api/expenses', methods=['GET'])
@login_required
def get_expenses():
    db = get_db()
    user_id = session['user_id']
    expenses = [e for e in db['expenses'] if e['user_id'] == user_id]

    # Filters
    filter_type = request.args.get('filter', 'all')
    category    = request.args.get('category', 'all')
    start_date  = request.args.get('start')
    end_date    = request.args.get('end')

    now = datetime.now()

    if filter_type == 'past_week':
        since = now - timedelta(days=7)
        expenses = [e for e in expenses if datetime.fromisoformat(e['date']) >= since]
    elif filter_type == 'past_month':
        since = now - timedelta(days=30)
        expenses = [e for e in expenses if datetime.fromisoformat(e['date']) >= since]
    elif filter_type == 'last_3_months':
        since = now - timedelta(days=90)
        expenses = [e for e in expenses if datetime.fromisoformat(e['date']) >= since]
    elif filter_type == 'custom' and start_date and end_date:
        s = datetime.fromisoformat(start_date)
        e_date = datetime.fromisoformat(end_date) + timedelta(hours=23, minutes=59)
        expenses = [e for e in expenses if s <= datetime.fromisoformat(e['date']) <= e_date]

    if category != 'all':
        expenses = [e for e in expenses if e['category'] == category]

    expenses.sort(key=lambda x: x['date'], reverse=True)
    return jsonify(expenses)

@app.route('/api/expenses', methods=['POST'])
@login_required
def add_expense():
    data = request.json
    title    = data.get('title', '').strip()
    amount   = data.get('amount')
    date     = data.get('date', '').strip()
    category = data.get('category', 'Others')
    desc     = data.get('description', '').strip()

    if not title:
        return jsonify({'error': 'Title daalna zaroori hai'}), 400
    if not amount or float(amount) <= 0:
        return jsonify({'error': 'Valid amount daalo'}), 400
    if not date:
        return jsonify({'error': 'Date select karo'}), 400

    db = get_db()
    expense = {
        'id': int(datetime.now().timestamp() * 1000),
        'user_id': session['user_id'],
        'title': title,
        'amount': float(amount),
        'date': date,
        'category': category,
        'description': desc,
        'created_at': datetime.now().isoformat(),
        'updated_at': None
    }
    db['expenses'].append(expense)
    save_db(db)
    return jsonify({'message': 'Expense add ho gayi! 💰', 'expense': expense})

@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
@login_required
def update_expense(expense_id):
    data = request.json
    db = get_db()
    idx = next((i for i, e in enumerate(db['expenses'])
                if e['id'] == expense_id and e['user_id'] == session['user_id']), None)
    if idx is None:
        return jsonify({'error': 'Expense nahi mili'}), 404

    exp = db['expenses'][idx]
    exp['title']       = data.get('title', exp['title']).strip()
    exp['amount']      = float(data.get('amount', exp['amount']))
    exp['date']        = data.get('date', exp['date'])
    exp['category']    = data.get('category', exp['category'])
    exp['description'] = data.get('description', exp['description']).strip()
    exp['updated_at']  = datetime.now().isoformat()

    save_db(db)
    return jsonify({'message': 'Expense update ho gayi! ✅', 'expense': exp})

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
@login_required
def delete_expense(expense_id):
    db = get_db()
    before = len(db['expenses'])
    db['expenses'] = [e for e in db['expenses']
                      if not (e['id'] == expense_id and e['user_id'] == session['user_id'])]
    if len(db['expenses']) == before:
        return jsonify({'error': 'Expense nahi mili'}), 404
    save_db(db)
    return jsonify({'message': 'Expense delete ho gayi 🗑️'})

@app.route('/api/stats')
@login_required
def stats():
    db = get_db()
    user_id = session['user_id']
    expenses = [e for e in db['expenses'] if e['user_id'] == user_id]

    total = sum(e['amount'] for e in expenses)
    now = datetime.now()
    this_month = sum(e['amount'] for e in expenses
                     if datetime.fromisoformat(e['date']).month == now.month
                     and datetime.fromisoformat(e['date']).year == now.year)
    return jsonify({
        'total': total,
        'this_month': this_month,
        'count': len(expenses)
    })

if __name__ == '__main__':
    app.run(debug=True)
