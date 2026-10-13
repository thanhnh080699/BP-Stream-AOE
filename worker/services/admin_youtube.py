import json
import datetime
from collections import namedtuple
import os
import pickle
import tempfile
import shutil
import uuid
import time
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from config import DATA_DIR

SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube']
PRIVATE_DIR = os.environ.get('ADMIN_PRIVATE_DIR', '/private')
TOKEN = os.path.join(PRIVATE_DIR, 'youtube_token.json')
SECRETS = os.path.join(PRIVATE_DIR, 'youtube_secrets.json')


class YouTubeError(RuntimeError):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


def error_code(error):
    if isinstance(error, YouTubeError):
        return error.code
    reason = str(error)
    try:
        content = json.loads(error.content)
        reason = ' '.join(item.get('reason', '') for item in content.get('error', {}).get('errors', [])) + reason
    except (AttributeError, ValueError, TypeError):
        pass
    if 'youtubeSignupRequired' in reason:
        return 'signup_required'
    if 'quotaExceeded' in reason or 'dailyLimitExceeded' in reason:
        return 'quota_exceeded'
    status = getattr(getattr(error, 'resp', None), 'status', 0)
    if status == 401 or 'invalid_grant' in reason:
        return 'token_expired'
    if status == 403:
        return 'permission_denied'
    if status == 429 or status >= 500 or isinstance(error, (TimeoutError, ConnectionError, OSError)):
        return 'network_error'
    return 'youtube_error'


class LegacyState:
    pass


LegacyBoundaryData = namedtuple('LegacyBoundaryData', 'encoded_locations expiry cooldown_expiry cooldown_duration')


class LegacyCredentialsReader(pickle.Unpickler):
    def find_class(self, module, name):
        allowed = {
            ('google.oauth2.credentials', 'Credentials'): Credentials,
            ('datetime', 'datetime'): datetime.datetime,
            ('datetime', 'timedelta'): datetime.timedelta,
            ('datetime', 'timezone'): datetime.timezone,
            ('google.auth._regional_access_boundary_utils', '_RegionalAccessBoundaryManager'): LegacyState,
            ('google.auth._regional_access_boundary_utils', '_RegionalAccessBoundaryRefreshManager'): LegacyState,
            ('google.auth._regional_access_boundary_utils', '_RegionalAccessBoundaryData'): LegacyBoundaryData,
        }
        if (module, name) not in allowed:
            raise ValueError('Legacy token chứa kiểu dữ liệu không được phép. Hãy kết nối lại Google.')
        return allowed[(module, name)]


def migrate_private_files():
    private = os.path.abspath(PRIVATE_DIR)
    public = os.path.abspath(DATA_DIR)
    if os.path.commonpath([private, public]) == public:
        raise ValueError('ADMIN_PRIVATE_DIR phải nằm ngoài thư mục media DATA_DIR.')
    os.makedirs(private, mode=0o700, exist_ok=True)
    os.chmod(private, 0o700)
    for name in ('youtube_secrets.json', 'youtube_token.json', 'youtube_token.pickle'):
        source = os.path.join(DATA_DIR, name)
        destination = os.path.join(private, name)
        if not os.path.exists(source):
            continue
        if os.path.islink(source) or os.path.islink(destination):
            raise ValueError('Không chuyển credentials từ đường dẫn symlink.')
        if os.path.exists(destination):
            destination += '.legacy-' + uuid.uuid4().hex
        shutil.move(source, destination)
        os.chmod(destination, 0o600)


def save_credentials(credentials):
    os.makedirs(os.path.dirname(TOKEN), mode=0o700, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix='.youtube-', dir=os.path.dirname(TOKEN))
    try:
        with os.fdopen(descriptor, 'w') as target:
            target.write(credentials.to_json())
            target.flush()
            os.fsync(target.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, TOKEN)
    finally:
        if os.path.exists(temporary):
            os.remove(temporary)


def credentials():
    if os.path.exists(TOKEN):
        creds = Credentials.from_authorized_user_file(TOKEN)
    else:
        legacy = os.path.join(PRIVATE_DIR, 'youtube_token.pickle')
        if not os.path.exists(legacy):
            legacy = os.path.join(DATA_DIR, 'youtube_token.pickle')
        if not os.path.exists(legacy):
            raise YouTubeError('not_connected', 'Chưa kết nối YouTube. Kết nối tài khoản trong CMS.')
        # Only the existing server-owned token is migrated; uploads never accept pickle.
        with open(legacy, 'rb') as source:
            creds = LegacyCredentialsReader(source).load()
        if not isinstance(creds, Credentials):
            raise ValueError("Legacy token không hợp lệ.")
        creds = Credentials.from_authorized_user_info(json.loads(creds.to_json()))
        save_credentials(creds)
    if not creds.valid:
        if not creds.refresh_token:
            raise YouTubeError('token_expired', 'Phiên Google hết hạn. Hãy kết nối lại.')
        try:
            creds.refresh(Request())
            save_credentials(creds)
        except Exception as error:
            raise YouTubeError(error_code(error), 'Không thể làm mới kết nối Google. Hãy kết nối lại.') from error
    return creds


def service():
    return build('youtube', 'v3', credentials=credentials(), cache_discovery=False)


def channel(client=None):
    client = client or service()
    result = retry(lambda: client.channels().list(part='snippet', mine=True).execute())
    items = result.get('items', [])
    if not items:
        raise YouTubeError('signup_required', 'Tài khoản được cấp quyền chưa có kênh YouTube. Tạo/chọn đúng kênh rồi kết nối lại.')
    item = items[0]
    return {'id': item['id'], 'title': item['snippet']['title'],
            'url': 'https://www.youtube.com/channel/' + item['id']}


def retry(operation):
    for attempt in range(3):
        try:
            return operation()
        except Exception as error:
            code = error_code(error)
            if code != 'network_error' or attempt == 2:
                raise YouTubeError(code, str(error)) from error
            time.sleep(2 ** (attempt + 1))


def oauth_config():
    base = os.environ.get('ADMIN_PUBLIC_URL', '').rstrip('/')
    callback = base + '/api/v1/admin/youtube/oauth/callback' if base else None
    configured = False
    if os.path.exists(SECRETS):
        with open(SECRETS) as source:
            data = json.load(source)
        configured = bool(data.get('web') and callback in data['web'].get('redirect_uris', []))
    return {'public_url': base, 'callback_url': callback,
            'configured': base.startswith('https://') and configured,
            'setup_message': 'Dùng OAuth Web application, tải JSON credentials lên server và đăng ký đúng callback HTTPS.'}


def flow(state=None, code_verifier=None):
    config = oauth_config()
    if not config['configured']:
        raise ValueError('Cần ADMIN_PUBLIC_URL HTTPS và OAuth Web client với callback khớp chính xác.')
    return Flow.from_client_secrets_file(SECRETS, scopes=SCOPES, state=state,
                                         redirect_uri=config['callback_url'], code_verifier=code_verifier)
