from flask import Blueprint, request, session, redirect, url_for, render_template, jsonify
from database import get_db

notif_bp = Blueprint('notifications', __name__)

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated

@notif_bp.route('/notifications')
@login_required
def notifications():
    db = get_db()
    uid = session['user_id']
    notifs = db.execute('''
        SELECT n.*, u.username, u.avatar_color
        FROM notifications n
        JOIN users u ON n.from_user_id = u.id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT 50
    ''', (uid,)).fetchall()
    db.execute('UPDATE notifications SET is_read=1 WHERE user_id=?', (uid,))
    db.commit()
    return render_template('notifications.html', notifications=notifs)

@notif_bp.route('/notifications/count')
@login_required
def notif_count():
    db = get_db()
    count = db.execute('SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0',
                       (session['user_id'],)).fetchone()[0]
    return jsonify({'count': count})