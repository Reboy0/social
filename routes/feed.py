from flask import Blueprint, request, session, redirect, url_for, render_template, flash, jsonify
from database import get_db
from media import save_file

feed_bp = Blueprint('feed', __name__)

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated

def get_posts_with_media(db, uid, where_clause, params):
    posts = db.execute(f'''
        SELECT p.*, u.username, u.avatar_color, u.accent_color,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as user_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE {where_clause}
        ORDER BY p.created_at DESC
        LIMIT 30
    ''', (uid, *params)).fetchall()

    result = []
    for post in posts:
        media = db.execute(
            'SELECT * FROM post_media WHERE post_id=? ORDER BY position ASC',
            (post['id'],)
        ).fetchall()
        result.append({'post': post, 'media': media})
    return result

@feed_bp.route('/')
@login_required
def index():
    db = get_db()
    uid = session['user_id']

    stories = db.execute('''
        SELECT s.*, u.username, u.avatar_color,
               EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.user_id = ?) as viewed
        FROM stories s
        JOIN users u ON s.user_id = u.id
        WHERE datetime(s.expires_at) > datetime('now')
        GROUP BY u.id
        ORDER BY viewed ASC, s.created_at DESC
    ''', (uid,)).fetchall()

    post_rows = get_posts_with_media(db, uid,
        'p.user_id IN (SELECT following_id FROM followers WHERE follower_id = ? UNION SELECT ?)',
        (uid, uid))

    recommended = db.execute('''
        SELECT u.*,
               (SELECT COUNT(*) FROM followers WHERE following_id = u.id) as followers_count
        FROM users u
        WHERE u.id != ?
        AND u.id NOT IN (SELECT following_id FROM followers WHERE follower_id = ?)
        ORDER BY followers_count DESC
        LIMIT 5
    ''', (uid, uid)).fetchall()

    return render_template('feed.html', post_rows=post_rows, stories=stories, recommended=recommended)

@feed_bp.route('/post', methods=['POST'])
@login_required
def create_post():
    content = request.form.get('content', '').strip()
    files = request.files.getlist('media')
    has_files = any(f.filename for f in files)

    if not content and not has_files:
        flash('Додайте текст або медіафайл', 'error')
        return redirect(url_for('feed.index'))

    db = get_db()
    cursor = db.execute('INSERT INTO posts (user_id, content) VALUES (?, ?)',
                        (session['user_id'], content))
    post_id = cursor.lastrowid

    for i, file in enumerate(files[:4]):
        if not file or not file.filename:
            continue
        filename, media_type = save_file(file)
        if filename:
            db.execute(
                'INSERT INTO post_media (post_id, filename, media_type, position) VALUES (?,?,?,?)',
                (post_id, filename, media_type, i)
            )

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