from flask import Blueprint, request, session, redirect, url_for, render_template, jsonify
from database import get_db

stories_bp = Blueprint('stories', __name__)

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated

@stories_bp.route('/story/create', methods=['POST'])
@login_required
def create_story():
    content = request.form.get('content', '').strip()
    bg_color = request.form.get('bg_color', '#6366f1')
    if content:
        db = get_db()
        db.execute('INSERT INTO stories (user_id, content, bg_color) VALUES (?,?,?)',
                   (session['user_id'], content, bg_color))
        db.commit()
    return redirect(url_for('feed.index'))

@stories_bp.route('/story/<int:story_id>')
@login_required
def view_story(story_id):
    db = get_db()
    uid = session['user_id']
    story = db.execute('''
        SELECT s.*, u.username, u.avatar_color FROM stories s
        JOIN users u ON s.user_id = u.id
        WHERE s.id=? AND datetime(s.expires_at) > datetime('now')
    ''', (story_id,)).fetchone()
    if not story:
        return redirect(url_for('feed.index'))
    db.execute('INSERT OR IGNORE INTO story_views (user_id, story_id) VALUES (?,?)', (uid, story_id))
    db.commit()

    # next story
    next_story = db.execute('''
        SELECT id FROM stories
        WHERE id > ? AND datetime(expires_at) > datetime('now')
        ORDER BY id ASC LIMIT 1
    ''', (story_id,)).fetchone()

    return render_template('story_view.html', story=story,
                           next_id=next_story['id'] if next_story else None)