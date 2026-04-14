from flask import Flask
try:
    from flask_cors import CORS
except ImportError:
    CORS = None
from database import init_db
from config import WORKER_PORT

# Import routes
from routes.api_players import bp as players_bp
from routes.api_scores import bp as scores_bp
from routes.api_recordings import bp as recordings_bp

app = Flask(__name__)
if CORS:
    CORS(app)

# Khởi tạo Database
init_db()

# Đăng ký Blueprints
app.register_blueprint(players_bp)
app.register_blueprint(scores_bp)
app.register_blueprint(recordings_bp)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=WORKER_PORT)
