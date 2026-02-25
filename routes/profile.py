from flask import Blueprint, request, session, redirect, url_for, render_template, flash, jsonify
from database import get_db

profile_bp = Blueprint('profile', __name__)

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated

@profile_bp.route('/profile/<username>')
@login_required
def profile(username):
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()
    if not user:
        return render_template('404.html'), 404
    uid = session['user_id']

    posts = db.execute('''
        SELECT p.*,
               (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as like_count,
               (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) as user_liked
        FROM posts p WHERE p.user_id=?
        ORDER BY p.created_at DESC
    ''', (uid, user['id'])).fetchall()

    followers_count = db.execute('SELECT COUNT(*) FROM followers WHERE following_id=?', (user['id'],)).fetchone()[0]
    following_count = db.execute('SELECT COUNT(*) FROM followers WHERE follower_id=?', (user['id'],)).fetchone()[0]
    is_following = db.execute('SELECT 1 FROM followers WHERE follower_id=? AND following_id=?',
                              (uid, user['id'])).fetchone() is not None

    return render_template('profile.html', user=user, posts=posts,
                           followers_count=followers_count,
                           following_count=following_count,
                           is_following=is_following)

@profile_bp.route('/follow/<int:user_id>', methods=['POST'])
@login_required
def follow(user_id):
    db = get_db()
    uid = session['user_id']
    if uid == user_id:
        return jsonify({'error': 'cannot follow self'}), 400
    existing = db.execute('SELECT 1 FROM followers WHERE follower_id=? AND following_id=?', (uid, user_id)).fetchone()
    if existing:
        db.execute('DELETE FROM followers WHERE follower_id=? AND following_id=?', (uid, user_id))
        following = False
    else:
        db.execute('INSERT INTO followers (follower_id, following_id) VALUES (?,?)', (uid, user_id))
        db.execute('INSERT INTO notifications (user_id, from_user_id, type) VALUES (?,?,?)',
                   (user_id, uid, 'follow'))
        following = True
    db.commit()
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'following': following})
    return redirect(request.referrer)

@profile_bp.route('/profile/<username>/edit', methods=['GET', 'POST'])
@login_required
def edit_profile(username):
    if session['username'] != username:
        return redirect(url_for('profile.profile', username=username))
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()
    if request.method == 'POST':
        bio = request.form.get('bio', '').strip()[:200]
        avatar_color = request.form.get('avatar_color', '#6366f1')
        accent_color = request.form.get('accent_color', '#6366f1')
        theme = request.form.get('theme', 'light')
        db.execute('UPDATE users SET bio=?, avatar_color=?, accent_color=?, theme=? WHERE id=?',
                   (bio, avatar_color, accent_color, theme, session['user_id']))
        db.commit()
        session['theme'] = theme
        session['accent'] = accent_color
        flash('Профіль оновлено!', 'success')
        return redirect(url_for('profile.profile', username=username))
    return render_template('edit_profile.html', user=user)