import os
from dotenv import load_dotenv

# Load môi trường từ .env.dev nếu đang ở local
if os.path.exists('../.env.dev'):
    load_dotenv('../.env.dev')
elif os.path.exists('.env'):
    load_dotenv('.env')

DATA_DIR = os.environ.get('DATA_DIR', '/data')
LOG_FILE = os.path.join(DATA_DIR, 'recordings.json')
WORKER_PORT = int(os.environ.get('WORKER_PORT', 5001))

# Tuning cho HDD + 40 vCPU + 3GB RAM
MAX_STREAM_WORKERS = int(os.environ.get('MAX_STREAM_WORKERS', 3))
MAX_SEG_WORKERS    = int(os.environ.get('MAX_SEG_WORKERS', 4))
FFMPEG_THREADS     = int(os.environ.get('FFMPEG_THREADS', 2))

# DB Configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'host.docker.internal'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', 'root'),
    'database': os.environ.get('DB_NAME', 'aoe_scoreboard')
}
