from flask import Blueprint, request, session, jsonify
from database import get_db
from media import delete_file

api_bp = Blueprint('api', __name__, url_prefix='/api')

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

# ── COMMENTS ──────────────────────────────────────
@api_bp.route('/comments/<int:post_id>', methods=['GET'])
@login_required
def get_comments(post_id):
    db = get_db()
    uid = session['user_id']
    comments = db.execute('''
        SELECT c.*, u.username, u.avatar_color, COALESCE(u.avatar_img,'') as avatar_img
        FROM comments c JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ? ORDER BY c.created_at ASC
    ''', (post_id,)).fetchall()
    return jsonify([dict(c) for c in comments])

@api_bp.route('/comments/<int:post_id>', methods=['POST'])
@login_required
def add_comment(post_id):
    content = request.json.get('content', '').strip()
    if not content:
        return jsonify({'error': 'Empty'}), 400
    db = get_db()
    uid = session['user_id']
    db.execute('INSERT INTO comments (post_id, user_id, content) VALUES (?,?,?)', (post_id, uid, content))
    post = db.execute('SELECT user_id FROM posts WHERE id=?', (post_id,)).fetchone()
    if post and post['user_id'] != uid:
        db.execute('INSERT INTO notifications (user_id, from_user_id, type, post_id) VALUES (?,?,?,?)',
                   (post['user_id'], uid, 'comment', post_id))
    db.commit()
    c = db.execute('''SELECT c.*, u.username, u.avatar_color, COALESCE(u.avatar_img,'') as avatar_img
        FROM comments c JOIN users u ON c.user_id=u.id WHERE c.id=last_insert_rowid()''').fetchone()
    return jsonify(dict(c))

@api_bp.route('/comments/<int:comment_id>/delete', methods=['POST'])
@login_required
def delete_comment(comment_id):
    db = get_db()
    uid = session['user_id']
    comment = db.execute('SELECT * FROM comments WHERE id=?', (comment_id,)).fetchone()
    if not comment:
        return jsonify({'error': 'Not found'}), 404
    # Allow delete if own comment OR own post
    post = db.execute('SELECT user_id FROM posts WHERE id=?', (comment['post_id'],)).fetchone()
    if comment['user_id'] != uid and (not post or post['user_id'] != uid):
        return jsonify({'error': 'Forbidden'}), 403
    db.execute('DELETE FROM comments WHERE id=?', (comment_id,))
    db.commit()
    return jsonify({'deleted': True})

# ── POSTS ─────────────────────────────────────────
@api_bp.route('/posts/<int:post_id>/like', methods=['POST'])
@login_required
def toggle_like(post_id):
    db = get_db()
    uid = session['user_id']
    emoji = request.json.get('emoji', '❤️') if request.is_json else '❤️'
    like = db.execute('SELECT 1 FROM likes WHERE user_id=? AND post_id=?', (uid, post_id)).fetchone()
    if like:
        db.execute('DELETE FROM likes WHERE user_id=? AND post_id=?', (uid, post_id))
        liked = False
    else:
        db.execute('INSERT INTO likes (user_id, post_id) VALUES (?,?)', (uid, post_id))
        post = db.execute('SELECT user_id FROM posts WHERE id=?', (post_id,)).fetchone()
        if post and post['user_id'] != uid:
            db.execute('INSERT OR IGNORE INTO notifications (user_id, from_user_id, type, post_id) VALUES (?,?,?,?)',
                       (post['user_id'], uid, 'like', post_id))
        liked = True
    db.commit()
    count = db.execute('SELECT COUNT(*) FROM likes WHERE post_id=?', (post_id,)).fetchone()[0]
    return jsonify({'liked': liked, 'count': count})

@api_bp.route('/posts/<int:post_id>/delete', methods=['POST'])
@login_required
def delete_post(post_id):
    db = get_db()
    uid = session['user_id']
    post = db.execute('SELECT * FROM posts WHERE id=?', (post_id,)).fetchone()
    if not post:
        return jsonify({'error': 'Not found'}), 404
    if post['user_id'] != uid:
        return jsonify({'error': 'Forbidden'}), 403
    # Delete media files
    media = db.execute('SELECT filename FROM post_media WHERE post_id=?', (post_id,)).fetchall()
    for m in media:
        delete_file(m['filename'])
    db.execute('DELETE FROM posts WHERE id=?', (post_id,))
    db.commit()
    return jsonify({'deleted': True})

# ── STORIES ───────────────────────────────────────
@api_bp.route('/stories/<int:story_id>/delete', methods=['POST'])
@login_required
def delete_story(story_id):
    db = get_db()
    uid = session['user_id']
    story = db.execute('SELECT * FROM stories WHERE id=?', (story_id,)).fetchone()
    if not story:
        return jsonify({'error': 'Not found'}), 404
    if story['user_id'] != uid:
        return jsonify({'error': 'Forbidden'}), 403
    db.execute('DELETE FROM stories WHERE id=?', (story_id,))
    db.commit()
    return jsonify({'deleted': True})

# ── FOLLOWERS / FOLLOWING lists ───────────────────
@api_bp.route('/users/<int:user_id>/followers')
@login_required
def get_followers(user_id):
    db = get_db()
    uid = session['user_id']
    users = db.execute('''
        SELECT u.id, u.username, u.avatar_color, COALESCE(u.avatar_img,'') as avatar_img,
               EXISTS(SELECT 1 FROM followers WHERE follower_id=? AND following_id=u.id) as is_following
        FROM followers f JOIN users u ON f.follower_id = u.id
        WHERE f.following_id=? ORDER BY f.created_at DESC
    ''', (uid, user_id)).fetchall()
    return jsonify([dict(u) for u in users])

@api_bp.route('/users/<int:user_id>/following')
@login_required
def get_following(user_id):
    db = get_db()
    uid = session['user_id']
    users = db.execute('''
        SELECT u.id, u.username, u.avatar_color, COALESCE(u.avatar_img,'') as avatar_img,
               EXISTS(SELECT 1 FROM followers WHERE follower_id=? AND following_id=u.id) as is_following
        FROM followers f JOIN users u ON f.following_id = u.id
        WHERE f.follower_id=? ORDER BY f.created_at DESC
    ''', (uid, user_id)).fetchall()
    return jsonify([dict(u) for u in users])