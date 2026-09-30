"""Integration smoke test for a throwaway local PHP/SQLite server.

Run tests/prepare_smoke_api.py, start that isolated API tree on port 8788, then:
  SMOKE_ADMIN_EMAIL=smoke-admin@example.invalid \
  SMOKE_ADMIN_PASSWORD=smoke-bootstrap-password python3 tests/smoke_api.py
Never target production: the test changes settings, credentials and catalog content.
"""
import http.cookiejar
import base64
import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request

BASE = os.getenv('SMOKE_API_BASE', 'http://127.0.0.1:8788/learnenglish/api').rstrip('/')
assert urllib.parse.urlparse(BASE).hostname in ('127.0.0.1', 'localhost'), 'Smoke test may only touch a local server'
ADMIN_EMAIL = os.getenv('SMOKE_ADMIN_EMAIL')
ADMIN_PASSWORD = os.getenv('SMOKE_ADMIN_PASSWORD')
assert ADMIN_EMAIL and ADMIN_PASSWORD, 'Provide SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD in your private environment'


class Client:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self.access_token = None


def client():
    return Client()


def request(client, path, method='GET', payload=None, expected=200, origin=None, token_override=None, cookie_override=None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {'Content-Type': 'application/json'} if data is not None else {}
    token = token_override if token_override is not None else client.access_token
    if token and path not in ('login', 'register', 'auth/refresh'):
        headers['Authorization'] = f'Bearer {token}'
    if cookie_override:
        headers['Cookie'] = f'speakup_refresh={cookie_override}'
    if origin:
        headers['Origin'] = origin
    req = urllib.request.Request(f'{BASE}/{path}', data=data, headers=headers, method=method)
    try:
        response = client.opener.open(req)
    except urllib.error.HTTPError as error:
        response = error
    body = json.load(response)
    assert response.status == expected, f'{method} {path}: expected {expected}, got {response.status}: {body}'
    if 'access_token' in body:
        client.access_token = body['access_token']
    if path == 'logout' and response.status == 200:
        client.access_token = None
    return body


def request_form(client, path, fields, expected=200):
    boundary = f'----SpeakUpSmoke{secrets.token_hex(8)}'
    chunks = []
    for key, value in fields.items():
        chunks.extend([
            f'--{boundary}\r\n'.encode(),
            f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
            str(value).encode(),
            b'\r\n',
        ])
    chunks.append(f'--{boundary}--\r\n'.encode())
    headers = {'Content-Type': f'multipart/form-data; boundary={boundary}'}
    if client.access_token:
        headers['Authorization'] = f'Bearer {client.access_token}'
    req = urllib.request.Request(f'{BASE}/{path}', data=b''.join(chunks), headers=headers, method='POST')
    try:
        response = client.opener.open(req)
    except urllib.error.HTTPError as error:
        response = error
    body = json.load(response)
    assert response.status == expected, f'POST {path} form: expected {expected}, got {response.status}: {body}'
    return body


def refresh_cookie(client):
    return next(cookie.value for cookie in client.cookies if cookie.name == 'speakup_refresh')


admin, regular, anon = client(), client(), client()
health = request(anon, 'health')
assert health['ok'] and health['database'] == 'sqlite' and health['auth_configured']
assert request(anon, 'me')['authenticated'] is False
assert request(anon, 'auth/refresh', 'POST', expected=401)['code'] == 'refresh_expired'
request(anon, 'catalog', expected=401)
request(admin, 'login', 'POST', {'email': ADMIN_EMAIL, 'password': 'incorrect'}, expected=401)
initial = request(admin, 'login', 'POST', {'email': ADMIN_EMAIL, 'password': ADMIN_PASSWORD})['user']
assert initial['role'] == 'admin' and initial['must_change_password']
assert len(admin.access_token.split('.')) == 3
claims = json.loads(base64.urlsafe_b64decode(admin.access_token.split('.')[1] + '=='))
assert claims['exp'] - claims['iat'] == 900 and claims['sub'] == str(initial['id'])
old_refresh = refresh_cookie(admin)
assert request(admin, 'auth/refresh', 'POST')['user']['id'] == initial['id']
assert refresh_cookie(admin) != old_refresh
request(anon, 'auth/refresh', 'POST', expected=401, cookie_override=old_refresh)
request(admin, 'admin/catalog', expected=403)
request(admin, 'account/password', 'POST', {'current_password': 'wrong', 'new_password': 'difficult-new-password-2026'}, expected=401)
rotated = secrets.token_urlsafe(20)
pre_rotation_access = admin.access_token
pre_rotation_cookie = refresh_cookie(admin)
changed = request(admin, 'account/password', 'POST', {'current_password': ADMIN_PASSWORD, 'new_password': rotated})['user']
assert not changed['must_change_password']
assert refresh_cookie(admin) != pre_rotation_cookie
request(admin, 'admin/catalog', expected=401, token_override=pre_rotation_access)
request(anon, 'auth/refresh', 'POST', expected=401, cookie_override=pre_rotation_cookie)
assert request(admin, 'me')['user']['id'] == initial['id']
admin_catalog = request(admin, 'admin/catalog')
assert len(admin_catalog['levels']) == 6
assert sum(len(l['units']) for l in admin_catalog['levels']) == 48
assert len(admin_catalog['listening']) == 18
assert sum(len(l['questions']) for l in admin_catalog['listening']) == 36
published = request(admin, 'catalog')
assert 'answer' not in published['listening'][0]['questions'][0]
assert 'explain' not in published['listening'][0]['questions'][0]
assert 'answer' in admin_catalog['listening'][0]['questions'][0]

user_email = f'smoke-{secrets.token_hex(4)}@example.invalid'
learner = request(regular, 'register', 'POST', {'name': 'Smoke Learner', 'email': user_email, 'password': 'example-password-2026'}, expected=201)['user']
assert learner['plan'] == 'regular' and not learner['must_change_password']
assert request(regular, 'app-config')['settings']['speech_input_mode'] in ('live_transcribe', 'ai_audio')
assert len(request(regular, 'catalog')['listening']) == 18
read_aloud_probe = request_form(regular, 'assess-audio', {'task_mode': 'read_aloud', 'consent': '1'}, expected=422)
assert 'Audio evaluasi tidak diterima' in read_aloud_probe['error']
response_probe = request_form(regular, 'assess-audio', {'task_mode': 'response', 'consent': '1'}, expected=403)
assert response_probe.get('premium_required') is True

# Admin user CRUD: create, change plan/profile, rotate a temporary password, delete.
managed_email = f'managed-{secrets.token_hex(4)}@example.invalid'
managed = request(admin, 'admin/users', 'POST', {
    'name': 'Managed Learner', 'email': managed_email,
    'password': 'managed-initial-password-2026', 'plan': 'premium',
}, expected=201)['user']
assert managed['role'] == 'user' and managed['plan'] == 'premium' and managed['must_change_password']
managed = request(admin, 'admin/users', 'PUT', {
    'id': managed['id'], 'name': 'Updated Learner', 'email': managed_email,
    'password': 'managed-rotated-password-2026', 'plan': 'regular',
})['user']
assert managed['name'] == 'Updated Learner' and managed['plan'] == 'regular' and managed['must_change_password']
assert any(row['id'] == managed['id'] for row in request(admin, 'admin/users')['users'])
request(admin, f"admin/users/{managed['id']}", 'DELETE')
request(admin, f"admin/users/{managed['id']}", 'DELETE', expected=404)
request(regular, 'admin/catalog', expected=403)
lesson = admin_catalog['listening'][0]
q = lesson['questions'][0]
wrong = request(regular, 'listening/check', 'POST', {'lesson_id': lesson['id'], 'question_id': q['id'], 'answer': (q['answer'] + 1) % len(q['options'])})
assert wrong['correct'] is False and wrong['correct_index'] == q['answer'] and wrong['explain']
right = request(regular, 'listening/check', 'POST', {'lesson_id': lesson['id'], 'question_id': q['id'], 'answer': q['answer']})
assert right['correct'] is True
request(regular, 'listening/check', 'POST', {'lesson_id': lesson['id'], 'question_id': 123456789, 'answer': 0}, expected=404)
request(regular, 'progress', 'PUT', {'progress': {'completed': [], 'listeningCompleted': [lesson['id']], 'xp': 10, 'streak': 1, 'sessions': []}})
assert request(regular, 'progress')['progress']['listeningCompleted'] == [lesson['id']]
request(regular, 'admin/units', 'POST', {}, expected=403)
request(regular, 'listening/check', 'POST', {'lesson_id': lesson['id'], 'question_id': q['id'], 'answer': q['answer']}, expected=403, origin='https://attacker.invalid')

# Create, modify, archive and restore speaking content; the seed IDs remain stable.
unit = dict(admin_catalog['levels'][0]['units'][0]); unit.pop('id')
unit.update(title='Smoke speaking quest', sortOrder=100, image='', imageContext='', published=True)
request(admin, 'admin/units', 'POST', {**unit, 'image': 'https://example.com/inject.jpg'}, expected=422)
unit_id = request(admin, 'admin/units', 'POST', unit, expected=201)['id']
assert any(x['id'] == unit_id for x in request(admin, 'catalog')['levels'][0]['units'])
unit.update(title='Edited speaking quest', published=False)
request(admin, f'admin/units/{unit_id}', 'PUT', unit)
assert all(x['id'] != unit_id for x in request(admin, 'catalog')['levels'][0]['units'])
assert any(x['id'] == unit_id and not x['published'] for x in request(admin, 'admin/catalog')['levels'][0]['units'])
request(admin, f'admin/units/{unit_id}', 'PUT', {**unit, 'published': True})
request(admin, f'admin/units/{unit_id}', 'DELETE')
assert all(x['id'] != unit_id for x in request(admin, 'catalog')['levels'][0]['units'])

# Listening writes question + key together transactionally and checks keys server-side.
new_lesson = {'level': 'A1', 'title': 'Smoke listening quest', 'objective': 'Hear a detail', 'script': 'Maya orders one cup of tea.', 'image': '', 'sortOrder': 100, 'published': True, 'questions': [{'prompt': 'What did Maya order?', 'options': ['Tea', 'Coffee'], 'answer': 0, 'explain': 'She orders tea.'}]}
request(admin, 'admin/listening', 'POST', {**new_lesson, 'questions': [{**new_lesson['questions'][0], 'answer': 4}]}, expected=422)
new_id = request(admin, 'admin/listening', 'POST', new_lesson, expected=201)['id']
check_lesson = next(l for l in request(regular, 'catalog')['listening'] if l['id'] == new_id)
assert 'answer' not in check_lesson['questions'][0]
new_question_id = check_lesson['questions'][0]['id']
assert request(regular, 'listening/check', 'POST', {'lesson_id': new_id, 'question_id': new_question_id, 'answer': 0})['correct']
new_lesson['questions'][0]['answer'] = 1
request(admin, f'admin/listening/{new_id}', 'PUT', new_lesson)
assert not request(regular, 'listening/check', 'POST', {'lesson_id': new_id, 'question_id': next(l for l in request(regular, 'catalog')['listening'] if l['id'] == new_id)['questions'][0]['id'], 'answer': 0})['correct']
request(admin, f'admin/listening/{new_id}', 'DELETE')
assert all(l['id'] != new_id for l in request(regular, 'catalog')['listening'])

level = dict(admin_catalog['levels'][0]); level['label'] = 'Fondasi (smoke edit)'
request(admin, f"admin/levels/{level['id']}", 'PUT', level)
assert request(regular, 'catalog')['levels'][0]['label'] == 'Fondasi (smoke edit)'

# Admin can lock registration and users out, then restore access.
settings = request(admin, 'admin/settings')['settings']
config = {
    'ai_provider': 'clario',
    'speech_input_mode': 'ai_audio',
    'clario_base_url': settings['clario_base_url'],
    'clario_fallback_url': settings['clario_fallback_url'],
    'clario_model': settings['clario_model'],
    'gemini_live_model': settings['gemini_live_model'],
    'lockdown': False,
    'stop_registration': False,
}
request(admin, 'admin/settings', 'PUT', config)
assert request(admin, 'admin/settings')['settings']['speech_input_mode'] == 'ai_audio'
assert request(regular, 'app-config')['settings']['speech_input_mode'] == 'ai_audio'

# Selecting IchanLabs must not silently call Clario; the adapter remains blocked until its real sample is available.
ichan_config = {
    **config,
    'ai_provider': 'ichanlabs',
    'ichan_base_url': 'https://ichan-smoke.invalid',
    'ichan_server': 'SG2',
    'ichan_model': 'smoke-model',
    'ichan_secret': 'smoke-secret-only',
    'ichan_token': 'smoke-token-only',
    'speech_input_mode': 'live_transcribe',
}
request(admin, 'admin/settings', 'PUT', ichan_config)
selected = request(admin, 'admin/settings')['settings']
assert selected['ai_provider'] == 'ichanlabs'
assert 'smoke-secret-only' not in json.dumps(selected) and 'smoke-token-only' not in json.dumps(selected)
models_error = request(admin, 'models', expected=503)
assert 'sample' in (models_error.get('detail') or '').lower()
request(admin, 'admin/settings', 'PUT', {**config, 'ai_provider': 'clario', 'speech_input_mode': 'live_transcribe'})
assert request(regular, 'app-config')['settings']['speech_input_mode'] == 'live_transcribe'

config = {**config, 'speech_input_mode': 'live_transcribe', 'lockdown': True, 'stop_registration': True}
request(admin, 'admin/settings', 'PUT', config)
request(regular, 'catalog', expected=423)
request(regular, 'register', 'POST', {'name': 'Blocked', 'email': 'blocked@example.invalid', 'password': 'blocked-password-2026'}, expected=423)
assert request(admin, 'admin/catalog')['levels']
request(admin, 'admin/settings', 'PUT', {**config, 'lockdown': False})
request(regular, 'catalog')
request(anon, 'register', 'POST', {'name': 'Closed', 'email': 'closed@example.invalid', 'password': 'closed-password-2026'}, expected=403)
request(admin, 'admin/settings', 'PUT', {**config, 'lockdown': False, 'stop_registration': False})
request(regular, 'progress', 'DELETE')
assert request(regular, 'progress')['progress'] is None
request(regular, 'logout', 'POST')
request(regular, 'progress', expected=401)
request(regular, 'auth/refresh', 'POST', expected=401)
print('PASS: JWT + rotating refresh/cookies, password/logout revocation, roles, admin user CRUD, seed 6/48/18/36, catalog CRUD, server answer checks, progress, global provider/input mode, no IchanLabs fallback, CORS, lockdown, registration.')
