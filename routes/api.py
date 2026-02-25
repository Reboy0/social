from flask import Blueprint, request, session, redirect, url_for, jsonify
from database import get_db

api_bp = Blueprint('api', __name__, url_prefix='/api')

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

@api_bp.route('/comments/<int:post_id>', methods=['GET'])
@login_required
def get_comments(post_id):
    db = get_db()
    comments = db.execute('''
        SELECT c.*, u.username, u.avatar_color
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    ''', (post_id,)).fetchall()
    return jsonify([dict(c) for c in comments])

@api_bp.route('/comments/<int:post_id>', methods=['POST'])
@login_required
def add_comment(post_id):
    content = request.json.get('content', '').strip()
    if not content:
        return jsonify({'error': 'Empty comment'}), 400
    db = get_db()
    uid = session['user_id']
    db.execute('INSERT INTO comments (post_id, user_id, content) VALUES (?,?,?)',
               (post_id, uid, content))
    post = db.execute('SELECT user_id FROM posts WHERE id=?', (post_id,)).fetchone()
    if post and post['user_id'] != uid:
        db.execute('INSERT INTO notifications (user_id, from_user_id, type, post_id) VALUES (?,?,?,?)',
                   (post['user_id'], uid, 'comment', post_id))
    db.commit()
    comment = db.execute('''
        SELECT c.*, u.username, u.avatar_color
        FROM comments c JOIN users u ON c.user_id = u.id
        WHERE c.id = last_insert_rowid()
    ''').fetchone()
    return jsonify(dict(comment))

@api_bp.route('/posts/<int:post_id>/like', methods=['POST'])
@login_required
def toggle_like(post_id):
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
            db.execute('INSERT OR IGNORE INTO notifications (user_id, from_user_id, type, post_id) VALUES (?,?,?,?)',
                       (post['user_id'], uid, 'like', post_id))
        liked = True
    db.commit()
    count = db.execute('SELECT COUNT(*) FROM likes WHERE post_id=?', (post_id,)).fetchone()[0]
    return jsonify({'liked': liked, 'count': count})