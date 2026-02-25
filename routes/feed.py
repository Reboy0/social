from flask import Blueprint, request, session, redirect, url_for, render_template, flash, jsonify
from database import get_db

feed_bp = Blueprint('feed', __name__)

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated

@feed_bp.route('/')
@login_required
def index():
    db = get_db()
    uid = session['user_id']

    # Stories (not expired, not own, not viewed OR own)
    stories = db.execute('''
        SELECT s.*, u.username, u.avatar_color,
               EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.user_id = ?) as viewed
        FROM stories s
        JOIN users u ON s.user_id = u.id
        WHERE datetime(s.expires_at) > datetime('now')
        GROUP BY u.id
        ORDER BY viewed ASC, s.created_at DESC
    ''', (uid,)).fetchall()

    # Feed: followed users + recommended
    posts = db.execute('''
        SELECT p.*, u.username, u.avatar_color, u.accent_color,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as user_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id IN (
            SELECT following_id FROM followers WHERE follower_id = ?
            UNION SELECT ?
        )
        ORDER BY p.created_at DESC
        LIMIT 30
    ''', (uid, uid, uid)).fetchall()

    # Recommended users (not following, not self)
    recommended = db.execute('''
        SELECT u.*, 
               (SELECT COUNT(*) FROM followers WHERE following_id = u.id) as followers_count
        FROM users u
        WHERE u.id != ?
        AND u.id NOT IN (SELECT following_id FROM followers WHERE follower_id = ?)
        ORDER BY followers_count DESC
        LIMIT 5
    ''', (uid, uid)).fetchall()

    return render_template('feed.html', posts=posts, stories=stories, recommended=recommended)

@feed_bp.route('/post', methods=['POST'])
@login_required
def create_post():
    content = request.form.get('content', '').strip()
    if not content:
        return redirect(url_for('feed.index'))
    db = get_db()
    db.execute('INSERT INTO posts (user_id, content) VALUES (?, ?)',
               (session['user_id'], content))
    db.commit()
    return redirect(url_for('feed.index'))

@feed_bp.route('/like/<int:post_id>', methods=['POST'])
@login_required
def like_post(post_id):
    db = get_db()
    uid = session['user_id']
    like = db.execute('SELECT 1 FROM likes WHERE user_id=? AND post_id=?', (uid, post_id)).fetchone()
    if like:
        db.execute('DELETE FROM likes WHERE user_id=? AND post_id=?', (uid, post_id))
        liked = False
    else:
        db.execute('INSERT INTO likes (user_id, post_id) VALUES (?,?)', (uid, post_id))
        # notify post author
        post = db.execute('SELECT user_id FROM posts WHERE id=?', (post_id,)).fetchone()
        if post and post['user_id'] != uid:
            db.execute('INSERT INTO notifications (user_id, from_user_id, type, post_id) VALUES (?,?,?,?)',
                       (post['user_id'], uid, 'like', post_id))
        liked = True
    db.commit()
    count = db.execute('SELECT COUNT(*) FROM likes WHERE post_id=?', (post_id,)).fetchone()[0]
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'liked': liked, 'count': count})
    return redirect(request.referrer or url_for('feed.index'))