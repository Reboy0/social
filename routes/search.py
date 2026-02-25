from flask import Blueprint, request, session, redirect, url_for, render_template, jsonify
from database import get_db

search_bp = Blueprint('search', __name__)

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated

@search_bp.route('/search')
@login_required
def search():
    q = request.args.get('q', '').strip()
    db = get_db()
    uid = session['user_id']
    users = []
    if q:
        users = db.execute('''
            SELECT u.*,
                   (SELECT COUNT(*) FROM followers WHERE following_id=u.id) as followers_count,
                   EXISTS(SELECT 1 FROM followers WHERE follower_id=? AND following_id=u.id) as is_following
            FROM users u
            WHERE u.username LIKE ? AND u.id != ?
            ORDER BY followers_count DESC
            LIMIT 20
        ''', (uid, f'%{q}%', uid)).fetchall()

    # Trending posts (most liked in last 7 days)
    trending = db.execute('''
        SELECT p.*, u.username, u.avatar_color,
               COUNT(l.user_id) as like_count,
               (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) as user_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN likes l ON l.post_id = p.id
        WHERE datetime(p.created_at) > datetime('now', '-7 days')
        GROUP BY p.id
        ORDER BY like_count DESC
        LIMIT 12
    ''', (uid,)).fetchall()

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify([{
            'id': u['id'], 'username': u['username'],
            'avatar_color': u['avatar_color'],
            'followers_count': u['followers_count'],
            'is_following': bool(u['is_following'])
        } for u in users])

    return render_template('search.html', users=users, trending=trending, q=q)