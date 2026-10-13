import json
from contextlib import contextmanager
import mysql.connector
from config import DB_CONFIG

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS admin_sessions (
        id CHAR(64) PRIMARY KEY, csrf CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL, oauth_state CHAR(64), oauth_expires DATETIME, oauth_verifier VARCHAR(128),
        INDEX(expires_at))""",
    "ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS oauth_verifier VARCHAR(128)",
    """CREATE TABLE IF NOT EXISTS admin_jobs (
        id CHAR(32) PRIMARY KEY, kind VARCHAR(30) NOT NULL, payload LONGTEXT NOT NULL,
        status VARCHAR(20) NOT NULL, progress INT DEFAULT 0, message TEXT,
        error_code VARCHAR(60), created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX(status, created_at))""",
    """CREATE TABLE IF NOT EXISTS admin_settings (
        name VARCHAR(80) PRIMARY KEY, value LONGTEXT NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS admin_audit (
        id BIGINT AUTO_INCREMENT PRIMARY KEY, action VARCHAR(80) NOT NULL,
        detail LONGTEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)""",
    """CREATE TABLE IF NOT EXISTS admin_previews (
        id CHAR(64) PRIMARY KEY, session_id CHAR(64) NOT NULL, payload LONGTEXT NOT NULL,
        expires_at DATETIME NOT NULL)""",
]
DEFAULTS = {'warning_percent': 85, 'critical_percent': 95,
            'sync_enabled': True, 'sync_time': '02:00'}


@contextmanager
def connection():
    conn = mysql.connector.connect(**DB_CONFIG, connection_timeout=5)
    try:
        cursor = conn.cursor()
        cursor.execute("SET time_zone='+00:00'")
        cursor.close()
        yield conn
    finally:
        conn.close()


def query(sql, params=(), one=False, write=False):
    with connection() as conn:
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute(sql, params)
            if write:
                conn.commit()
                return cursor.rowcount
            return cursor.fetchone() if one else cursor.fetchall()
        finally:
            cursor.close()


def initialize():
    with connection() as conn:
        cursor = conn.cursor()
        for statement in SCHEMA:
            cursor.execute(statement)
        conn.commit()
        cursor.close()


def settings():
    values = DEFAULTS.copy()
    values.update({row['name']: json.loads(row['value']) for row in query('SELECT * FROM admin_settings')})
    return values


def set_setting(name, value):
    query('INSERT INTO admin_settings(name,value) VALUES (%s,%s) '
          'ON DUPLICATE KEY UPDATE value=VALUES(value)', (name, json.dumps(value)), write=True)


def audit(action, detail):
    query('INSERT INTO admin_audit(action,detail) VALUES (%s,%s)',
          (action, json.dumps(detail, ensure_ascii=False)), write=True)
