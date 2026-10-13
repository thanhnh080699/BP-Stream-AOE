import hashlib
import hmac
import os
import secrets
import threading
import time
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g
from config import ADMIN_PASSWORD
from services import admin_store as store

COOKIE = 'bp_admin_session'
_attempts = {}
_lock = threading.Lock()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def current_session():
    token = request.cookies.get(COOKIE, '')
    if not token:
        return None
    return store.query('SELECT * FROM admin_sessions WHERE id=%s AND expires_at>UTC_TIMESTAMP()',
                       (digest(token),), one=True)


def require_admin(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        session = current_session()
        if not session:
            return jsonify(error='Vui lòng đăng nhập quản trị.', code='unauthorized'), 401
        g.admin_session = session
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            if not hmac.compare_digest(request.headers.get('X-CSRF-Token', ''), session['csrf']):
                return jsonify(error='Phiên xác nhận không hợp lệ. Hãy tải lại trang.', code='csrf'), 403
        return fn(*args, **kwargs)
    return wrapped


def login(password):
    address = request.remote_addr or 'unknown'
    now = time.monotonic()
    with _lock:
        for key in list(_attempts):
            _attempts[key] = [stamp for stamp in _attempts[key] if now - stamp < 900]
            if not _attempts[key]:
                del _attempts[key]
        attempts = _attempts.get(address, [])
        if len(attempts) >= 5:
            return jsonify(error='Thử lại sau 15 phút.', code='rate_limited'), 429
        if not isinstance(password, str) or not hmac.compare_digest(password, ADMIN_PASSWORD):
            _attempts[address] = attempts + [now]
            return jsonify(error='Mật khẩu không đúng.', code='invalid_password'), 401
        _attempts.pop(address, None)
    token, csrf = secrets.token_hex(32), secrets.token_hex(32)
    expires = datetime.utcnow() + timedelta(hours=8)
    old = current_session()
    if old:
        store.query('DELETE FROM admin_sessions WHERE id=%s', (old['id'],), write=True)
    store.query('DELETE FROM admin_sessions WHERE expires_at<=UTC_TIMESTAMP()', write=True)
    store.query('INSERT INTO admin_sessions(id,csrf,expires_at) VALUES(%s,%s,%s)',
                (digest(token), csrf, expires), write=True)
    store.audit('login', {})
    response = jsonify(csrf=csrf, expires_at=expires.isoformat() + 'Z')
    response.set_cookie(COOKIE, token, max_age=8 * 3600, httponly=True,
                        secure=os.environ.get('ADMIN_COOKIE_SECURE', 'true').lower() == 'true',
                        samesite='Lax', path='/')
    return response
