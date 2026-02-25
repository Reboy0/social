from flask import Blueprint, request, session, redirect, url_for, render_template, flash
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db
import sqlite3

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        if len(username) < 3:
            flash('Логін має бути мінімум 3 символи', 'error')
        elif len(password) < 6:
            flash('Пароль має бути мінімум 6 символів', 'error')
        else:
            db = get_db()
            try:
                db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                           (username, generate_password_hash(password)))
                db.commit()
                flash('Акаунт створено!', 'success')
                return redirect(url_for('auth.login'))
            except sqlite3.IntegrityError:
                flash('Цей логін вже зайнятий', 'error')
    return render_template('auth.html', mode='register')

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        db = get_db()
        user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        if user and check_password_hash(user['password_hash'], password):
            user = dict(user)
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['theme'] = user.get('theme') or 'light'
            session['accent'] = user.get('accent_color') or '#6366f1'
            session['avatar_img'] = user.get('avatar_img') or ''
            return redirect(url_for('feed.index'))
        flash('Неправильний логін або пароль', 'error')
    return render_template('auth.html', mode='login')

@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.login'))