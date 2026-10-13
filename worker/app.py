from flask import Flask
try:
    from flask_cors import CORS
except ImportError:
    CORS = None
from database import init_db
from config import WORKER_PORT
from werkzeug.middleware.proxy_fix import ProxyFix
from routes.api_admin import bp as admin_bp
from services.admin_jobs import start as start_admin

# Import routes
from routes.api_players import bp as players_bp
from routes.api_scores import bp as scores_bp
from routes.api_recordings import bp as recordings_bp

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024
if CORS:
    CORS(app)

# Khởi tạo Database
init_db()

# Đăng ký Blueprints
app.register_blueprint(players_bp)
app.register_blueprint(scores_bp)
app.register_blueprint(recordings_bp)
app.register_blueprint(admin_bp)
start_admin()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=WORKER_PORT)
