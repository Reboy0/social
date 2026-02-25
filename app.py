from flask import Flask
from database import init_db
from routes.auth import auth_bp
from routes.feed import feed_bp
from routes.profile import profile_bp
from routes.stories import stories_bp
from routes.search import search_bp
from routes.notifications import notif_bp
from routes.api import api_bp

app = Flask(__name__)
app.secret_key = 'change_this_secret_in_production_123'

app.register_blueprint(auth_bp)
app.register_blueprint(feed_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(stories_bp)
app.register_blueprint(search_bp)
app.register_blueprint(notif_bp)
app.register_blueprint(api_bp)

if __name__ == '__main__':
    init_db()
    app.run(debug=True)