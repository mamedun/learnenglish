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
from datetime import datetime
import io
import time
import wave

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


def request_form(client, path, fields, expected=200, files=None):
    boundary = f'----SpeakUpSmoke{secrets.token_hex(8)}'
    chunks = []
    for key, value in fields.items():
        chunks.extend([
            f'--{boundary}\r\n'.encode(),
            f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
            str(value).encode(),
            b'\r\n',
        ])
    for key, value in (files or {}).items():
        filename, content, mime = value
        chunks.extend([
            f'--{boundary}\r\n'.encode(),
            f'Content-Disposition: form-data; name="{key}"; filename="{filename}"\r\n'.encode(),
            f'Content-Type: {mime}\r\n\r\n'.encode(),
            content,
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


def request_bytes(client, path, expected=200):
    headers = {}
    if client.access_token:
        headers['Authorization'] = f'Bearer {client.access_token}'
    req = urllib.request.Request(f'{BASE}/{path}', headers=headers, method='GET')
    try:
        response = client.opener.open(req)
    except urllib.error.HTTPError as error:
        response = error
    body = response.read()
    assert response.status == expected, f'GET {path}: expected {expected}, got {response.status}: {body[:200]!r}'
    return body, response.headers.get('Content-Type', '')

def tiny_wav(sample=0):
    output = io.BytesIO()
    with wave.open(output, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24000)
        wav.writeframes(int(sample).to_bytes(2, 'little', signed=True) * 240)
    return output.getvalue()


def qris_crc16(value):
    crc = 0xFFFF
    for byte in value.encode():
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) if crc & 0x8000 else crc << 1
            crc &= 0xFFFF
    return f'{crc:04X}'


def static_qris():
    # Exact static merchant QRIS supplied for the dynamic-payment conversion
    # regression; its nested merchant-account templates must survive intact.
    return (
        '00020101021126610014COM.GO-JEK.WWW01189360091432325086690210'
        'G2325086690303UMI51440014ID.CO.QRIS.WWW0215ID10266052697310303'
        'UMI5204573453033605802ID5920HexaStudio, Software6013JAKARTA '
        'BARAT61051153062070703A016304E24E'
    )


def parse_qris(payload):
    fields = {}
    offset = 0
    while offset < len(payload):
        tag, size = payload[offset:offset + 2], int(payload[offset + 2:offset + 4])
        offset += 4
        fields[tag] = payload[offset:offset + size]
        offset += size
    return fields


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
for item in [unit for level in admin_catalog['levels'] for unit in level['units']] + admin_catalog['listening']:
    assert item['defaultVoice'] == 'af_heart'
    assert item['ttsSegments'] == []
    assert len(item['ttsRevision']) == 64
assert request(admin, 'admin/tts-cache')['cache']['limit_bytes'] == 1024 ** 3
admin_wallet_before = request(admin, 'me')['user']
assert admin_wallet_before['unlimited_diamonds'] is True
admin_ai_probe = request(admin, 'chat', 'POST', {'transcript': 'Hello, tutor.'}, expected=503)
assert 'error' in admin_ai_probe
assert request(admin, 'me')['user']['diamonds'] == admin_wallet_before['diamonds']
published = request(admin, 'catalog')
assert 'answer' not in published['listening'][0]['questions'][0]
assert 'explain' not in published['listening'][0]['questions'][0]
assert 'answer' in admin_catalog['listening'][0]['questions'][0]

user_email = f'smoke-{secrets.token_hex(4)}@example.invalid'
learner = request(regular, 'register', 'POST', {'name': 'Smoke Learner', 'email': user_email, 'password': 'example-password-2026'}, expected=201)['user']
assert learner['plan'] == 'regular' and not learner['must_change_password']
request(regular, 'admin/tts-cache', expected=403)
assert request(regular, 'app-config')['settings']['speech_input_mode'] in ('live_transcribe', 'ai_audio')
assert request(regular, 'app-config')['settings']['speech_similarity_threshold'] == 90
assert len(request(regular, 'catalog')['listening']) == 18
read_aloud_probe = request_form(regular, 'assess-audio', {'task_mode': 'read_aloud', 'consent': '1'}, expected=422)
assert 'Audio evaluasi tidak diterima' in read_aloud_probe['error']
direct_audio_probe = request_form(regular, 'assess-audio', {'task_mode': 'read_aloud_direct', 'consent': '1'}, expected=422)
assert 'Audio evaluasi tidak diterima' in direct_audio_probe['error']
response_probe = request_form(regular, 'assess-audio', {'task_mode': 'response', 'consent': '1'}, expected=422)
assert 'Audio evaluasi tidak diterima' in response_probe['error']
assert learner['diamonds'] == 0  # the regular account can use paid AI only after diamonds are added

# Admin user CRUD: create, change plan/profile, rotate a temporary password, delete.
managed_email = f'managed-{secrets.token_hex(4)}@example.invalid'
managed = request(admin, 'admin/users', 'POST', {
    'name': 'Managed Learner', 'email': managed_email,
    'password': 'managed-initial-password-2026',
}, expected=201)['user']
assert managed['role'] == 'user' and managed['plan'] == 'regular' and not managed['must_change_password']
managed = request(admin, 'admin/users', 'PUT', {
    'id': managed['id'], 'name': 'Updated Learner', 'email': managed_email,
    'password': 'managed-rotated-password-2026', 'plan': 'regular',
})['user']
assert managed['name'] == 'Updated Learner' and managed['plan'] == 'regular' and not managed['must_change_password']
managed_client = client()
managed_login = request(managed_client, 'login', 'POST', {
    'email': managed_email, 'password': 'managed-rotated-password-2026',
})['user']
assert managed_login['role'] == 'user' and not managed_login['must_change_password']
request(managed_client, 'progress')  # Admin-issued temporary passwords do not block regular users.
managed_search = request(admin, f"admin/users?search={urllib.parse.quote(managed_email)}&page=1&page_size=10")
assert managed_search['total'] == 1 and managed_search['users'][0]['id'] == managed['id']
assert request(admin, 'admin/wallet', 'PUT', {'id': managed['id'], 'mode': 'set', 'balance': 25})['diamonds'] == 25
assert request(admin, 'admin/wallet', 'PUT', {'id': managed['id'], 'mode': 'adjust', 'amount': -5})['diamonds'] == 20
assert request(admin, 'admin/wallet', 'PUT', {'id': managed['id'], 'mode': 'adjust', 'amount': 3})['diamonds'] == 23
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
listening_progress = {
    'completed': [],
    'listeningCompleted': [lesson['id']],
    'listeningAnswers': {lesson['id']: {str(q['id']): 1}},
    'listeningResults': {lesson['id']: {str(q['id']): {'percent': 92, 'passed': True}}},
    'speakingTranscripts': {lesson['id']: {str(q['id']): 'I heard the speaker order tea.'}},
    'xp': 10,
    'streak': 1,
    'sessions': [],
}
request(regular, 'progress', 'PUT', {'progress': listening_progress})
saved_listening_progress = request(regular, 'progress')['progress']
assert saved_listening_progress['listeningCompleted'] == [lesson['id']]
assert saved_listening_progress['listeningAnswers'] == listening_progress['listeningAnswers']
assert saved_listening_progress['listeningResults'] == listening_progress['listeningResults']
assert saved_listening_progress['speakingTranscripts'] == listening_progress['speakingTranscripts']
saved_audio = request_form(
    regular,
    'audio',
    {'client_ref': 'smoke-history'},
    expected=201,
    files={'audio': ('recording.wav', tiny_wav(), 'audio/wav')},
)['audio']
audio_bytes, audio_mime = request_bytes(regular, f"audio/{saved_audio['id']}")
assert audio_bytes == tiny_wav() and 'wav' in audio_mime
request(regular, f"audio/{saved_audio['id']}", 'DELETE')
request_bytes(regular, f"audio/{saved_audio['id']}", expected=404)
request(regular, 'admin/units', 'POST', {}, expected=403)
request(regular, 'listening/check', 'POST', {'lesson_id': lesson['id'], 'question_id': q['id'], 'answer': q['answer']}, expected=403, origin='https://attacker.invalid')

# Create, modify, archive and restore speaking content; the seed IDs remain stable.
unit = dict(admin_catalog['levels'][0]['units'][0]); unit.pop('id')
unit.update(
    title='Smoke speaking quest', sortOrder=100, image='', imageContext='', published=True,
    defaultVoice='bf_emma',
    ttsSegments=[
        {'speaker': 'Maya', 'voice': 'bf_emma', 'text': 'Hello there.'},
        {'speaker': 'Leo', 'voice': 'am_puck', 'text': 'Good morning.'},
    ],
)
request(admin, 'admin/units', 'POST', {**unit, 'image': 'https://example.com/inject.jpg'}, expected=422)
unit_id = request(admin, 'admin/units', 'POST', unit, expected=201)['id']
assert any(x['id'] == unit_id for x in request(admin, 'catalog')['levels'][0]['units'])
stored_unit = next(
    item for level in request(admin, 'admin/catalog')['levels'] for item in level['units']
    if item['id'] == unit_id
)
assert stored_unit['defaultVoice'] == 'bf_emma' and len(stored_unit['ttsSegments']) == 2
assert len(stored_unit['ttsRevision']) == 64
wav_data = tiny_wav()
request_form(
    admin,
    'tts-cache',
    {'type': 'speaking', 'id': unit_id, 'revision': stored_unit['ttsRevision'], 'voice': 'af_heart'},
    expected=201,
    files={'audio': ('smoke.wav', wav_data, 'audio/wav')},
)
replacement_wav = tiny_wav(1300)
request_form(
    admin,
    'tts-cache',
    {'type': 'speaking', 'id': unit_id, 'revision': stored_unit['ttsRevision'], 'voice': 'af_heart'},
    expected=201,
    files={'audio': ('smoke-rebuild.wav', replacement_wav, 'audio/wav')},
)
request_form(
    regular,
    'tts-cache',
    {'type': 'speaking', 'id': unit_id, 'revision': stored_unit['ttsRevision'], 'voice': 'multi'},
    expected=403,
)
multi_wav = tiny_wav(-900)
request_form(
    admin,
    'tts-cache',
    {'type': 'speaking', 'id': unit_id, 'revision': stored_unit['ttsRevision'], 'voice': 'multi'},
    expected=201,
    files={'audio': ('smoke-dialog.wav', multi_wav, 'audio/wav')},
)
cache_path = 'tts-cache?' + urllib.parse.urlencode({
    'type': 'speaking', 'id': unit_id, 'revision': stored_unit['ttsRevision'], 'voice': 'af_heart',
})
shared_audio, shared_mime = request_bytes(regular, cache_path)
assert shared_audio == replacement_wav and 'wav' in shared_mime
cache_auto_path = 'tts-cache?' + urllib.parse.urlencode({
    'type': 'speaking', 'id': unit_id, 'revision': stored_unit['ttsRevision'], 'voice': 'auto',
})
shared_auto_audio, _ = request_bytes(regular, cache_auto_path)
assert shared_auto_audio == multi_wav, 'auto playback should prefer multi-speaker cache when dialog segments exist'
cache_summary = request(admin, 'admin/tts-cache')['cache']
assert cache_summary['items'] == 2 and cache_summary['bytes'] == len(replacement_wav) + len(multi_wav)
unit.update(title='Edited speaking quest', prompt=unit['prompt'] + ' Updated.', published=False)
request(admin, f'admin/units/{unit_id}', 'PUT', unit)
request(regular, cache_path, expected=404)
assert request(admin, 'admin/tts-cache')['cache']['items'] == 0
assert all(x['id'] != unit_id for x in request(admin, 'catalog')['levels'][0]['units'])
assert any(x['id'] == unit_id and not x['published'] for x in request(admin, 'admin/catalog')['levels'][0]['units'])
request(admin, f'admin/units/{unit_id}', 'PUT', {**unit, 'published': True})
restored_unit = next(
    item for level in request(admin, 'admin/catalog')['levels'] for item in level['units']
    if item['id'] == unit_id
)
request_form(
    admin,
    'tts-cache',
    {'type': 'speaking', 'id': unit_id, 'revision': restored_unit['ttsRevision'], 'voice': 'bm_george'},
    expected=201,
    files={'audio': ('archive.wav', tiny_wav(), 'audio/wav')},
)
request(admin, f'admin/units/{unit_id}', 'DELETE')
assert request(admin, 'admin/tts-cache')['cache']['items'] == 0
assert all(x['id'] != unit_id for x in request(admin, 'catalog')['levels'][0]['units'])

# Listening writes question + key together transactionally and checks keys server-side.
new_lesson = {
    'level': 'A1', 'title': 'Smoke listening quest', 'objective': 'Hear a detail',
    'script': 'Maya orders one cup of tea.', 'image': '', 'sortOrder': 100, 'published': True,
    'defaultVoice': 'bm_george',
    'ttsSegments': [
        {'speaker': 'Maya', 'voice': 'bf_emma', 'text': 'May I have one cup of tea?'},
        {'speaker': 'Server', 'voice': 'bm_george', 'text': 'Certainly.'},
    ],
    'questions': [{'prompt': 'What did Maya order?', 'options': ['Tea', 'Coffee'], 'answer': 0, 'explain': 'She orders tea.'}],
}
request(admin, 'admin/listening', 'POST', {**new_lesson, 'questions': [{**new_lesson['questions'][0], 'answer': 4}]}, expected=422)
new_id = request(admin, 'admin/listening', 'POST', new_lesson, expected=201)['id']
check_lesson = next(l for l in request(regular, 'catalog')['listening'] if l['id'] == new_id)
assert 'answer' not in check_lesson['questions'][0]
assert check_lesson['defaultVoice'] == 'bm_george' and len(check_lesson['ttsSegments']) == 2
new_question_id = check_lesson['questions'][0]['id']
assert request(regular, 'listening/check', 'POST', {'lesson_id': new_id, 'question_id': new_question_id, 'answer': 0})['correct']
request_form(
    regular,
    'tts-cache',
    {'type': 'listening', 'id': new_id, 'revision': check_lesson['ttsRevision'], 'voice': 'bm_george'},
    expected=201,
    files={'audio': ('listening.wav', tiny_wav(), 'audio/wav')},
)
listening_cache_path = 'tts-cache?' + urllib.parse.urlencode({
    'type': 'listening', 'id': new_id, 'revision': check_lesson['ttsRevision'], 'voice': 'bm_george',
})
shared_audio, shared_mime = request_bytes(admin, listening_cache_path)
assert shared_audio.startswith(b'RIFF') and 'wav' in shared_mime
new_lesson['script'] += ' She pays in cash.'
new_lesson['questions'][0]['answer'] = 1
request(admin, f'admin/listening/{new_id}', 'PUT', new_lesson)
request(admin, listening_cache_path, expected=404)
assert request(admin, 'admin/tts-cache')['cache']['items'] == 0
assert not request(regular, 'listening/check', 'POST', {'lesson_id': new_id, 'question_id': next(l for l in request(regular, 'catalog')['listening'] if l['id'] == new_id)['questions'][0]['id'], 'answer': 0})['correct']
updated_lesson = next(
    lesson for lesson in request(admin, 'admin/catalog')['listening']
    if lesson['id'] == new_id
)
request_form(
    admin,
    'tts-cache',
    {'type': 'listening', 'id': new_id, 'revision': updated_lesson['ttsRevision'], 'voice': 'af_heart'},
    expected=201,
    files={'audio': ('archive-listening.wav', tiny_wav(), 'audio/wav')},
)
request(admin, f'admin/listening/{new_id}', 'DELETE')
assert request(admin, 'admin/tts-cache')['cache']['items'] == 0
assert all(l['id'] != new_id for l in request(regular, 'catalog')['listening'])

# Course Studio keeps unchanged audio caches, invalidates edited/deleted content,
# and removes every course cache when an empty course is deleted.
course_smoke_id = f'tts-smoke-{secrets.token_hex(4)}'
request(admin, 'admin/courses', 'POST', {
    'id': course_smoke_id, 'name': 'TTS Cache Smoke Course', 'description': '',
    'posterUrl': '', 'bannerUrl': '', 'status': 'draft', 'price': 0,
    'color': '#315C45', 'label': '', 'level': '', 'sortOrder': 0,
    'enableListening': True, 'enableAiLesson': True, 'enableLiveLesson': False,
}, expected=201)
course_category = {
    'id': 'cache-group', 'name': 'Cache tests', 'label': '', 'guide': '',
    'color': '#315C45', 'sortOrder': 0,
}
course_unit = {
    'id': 'cache-unit', 'categoryId': course_category['id'],
    'title': 'Shared-cache prompt', 'subtitle': '', 'masterPrompt': '',
    'mediaUrl': '', 'sortOrder': 0, 'published': True,
    'content': {
        'prompt': 'Describe your favorite place and explain why you enjoy it.',
        'defaultVoice': 'bf_emma',
        'ttsSegments': [
            {'speaker': 'Teacher', 'voice': 'bf_emma', 'text': 'Where do you like to go?'} ,
            {'speaker': 'Learner', 'voice': 'am_puck', 'text': 'I like the park.'},
        ],
    },
}
course_module = {'categories': [course_category], 'units': [course_unit]}
course_saved = request(
    admin,
    f'admin/courses/{course_smoke_id}/content/ai_lesson',
    'PUT',
    course_module,
)
course_saved_unit = course_saved['content']['units'][0]
course_revision = course_saved_unit['ttsRevision']
course_cache_fields = {
    'type': 'speaking', 'id': course_unit['id'],
    'revision': course_revision, 'course_id': course_smoke_id,
}
request_form(
    admin, 'tts-cache', {**course_cache_fields, 'voice': 'bf_emma'}, expected=201,
    files={'audio': ('course-single.wav', tiny_wav(), 'audio/wav')},
)
course_multi_wav = tiny_wav(-1700)
request_form(
    admin, 'tts-cache', {**course_cache_fields, 'voice': 'multi'}, expected=201,
    files={'audio': ('course-dialog.wav', course_multi_wav, 'audio/wav')},
)
course_auto_path = 'tts-cache?' + urllib.parse.urlencode({
    **course_cache_fields, 'voice': 'auto',
})
assert request_bytes(admin, course_auto_path)[0] == course_multi_wav
assert request(admin, 'admin/tts-cache')['cache']['items'] == 2

# Changing the title alone does not invalidate authored audio.
renamed_course_unit = {**course_unit, 'title': 'Renamed shared-cache prompt'}
request(
    admin,
    f'admin/courses/{course_smoke_id}/content/ai_lesson',
    'PUT',
    {'categories': [course_category], 'units': [renamed_course_unit]},
)
assert request_bytes(admin, course_auto_path)[0] == course_multi_wav
assert request(admin, 'admin/tts-cache')['cache']['items'] == 2

# Changing the prompt deletes every voice for that course unit.
changed_course_unit = {
    **renamed_course_unit,
    'content': {
        **renamed_course_unit['content'],
        'prompt': renamed_course_unit['content']['prompt'] + ' Give an example.',
    },
}
changed_course_module = {'categories': [course_category], 'units': [changed_course_unit]}
changed_course = request(
    admin,
    f'admin/courses/{course_smoke_id}/content/ai_lesson',
    'PUT',
    changed_course_module,
)
request_bytes(admin, course_auto_path, expected=404)
assert request(admin, 'admin/tts-cache')['cache']['items'] == 0
changed_course_revision = changed_course['content']['units'][0]['ttsRevision']
changed_cache_fields = {
    **course_cache_fields, 'revision': changed_course_revision,
}
single_fallback_wav = tiny_wav(1700)
request_form(
    admin, 'tts-cache', {**changed_cache_fields, 'voice': 'am_puck'}, expected=201,
    files={'audio': ('course-fallback.wav', single_fallback_wav, 'audio/wav')},
)
changed_auto_path = 'tts-cache?' + urllib.parse.urlencode({
    **changed_cache_fields, 'voice': 'auto',
})
assert request_bytes(admin, changed_auto_path)[0] == single_fallback_wav

# Removing the unit from the replacement-style Course Studio payload purges it.
request(
    admin,
    f'admin/courses/{course_smoke_id}/content/ai_lesson',
    'PUT',
    {'categories': [course_category], 'units': []},
)
assert request(admin, 'admin/tts-cache')['cache']['items'] == 0

# Re-create an audio cache and verify deleting its course purges that storage too.
recreated_course = request(
    admin,
    f'admin/courses/{course_smoke_id}/content/ai_lesson',
    'PUT',
    changed_course_module,
)
recreated_revision = recreated_course['content']['units'][0]['ttsRevision']
request_form(
    admin,
    'tts-cache',
    {**course_cache_fields, 'revision': recreated_revision, 'voice': 'af_heart'},
    expected=201,
    files={'audio': ('course-delete.wav', tiny_wav(), 'audio/wav')},
)
request(admin, f'admin/courses/{course_smoke_id}', 'DELETE')
assert request(admin, 'admin/tts-cache')['cache']['items'] == 0

cleared_cache = request(admin, 'admin/tts-cache/clear', 'POST')
assert cleared_cache['ok'] and cleared_cache['cache']['items'] == 0

level = dict(admin_catalog['levels'][0]); level['label'] = 'Fondasi (smoke edit)'
request(admin, f"admin/levels/{level['id']}", 'PUT', level)
assert request(regular, 'catalog')['levels'][0]['label'] == 'Fondasi (smoke edit)'

# Admin can lock registration and users out, then restore access.
settings = request(admin, 'admin/settings')['settings']
merchant_static_qris = static_qris()
merchant_static_fields = parse_qris(merchant_static_qris)
assert merchant_static_fields['60'] == 'JAKARTA BARAT'
assert merchant_static_fields['63'] == 'E24E'
assert qris_crc16(merchant_static_qris[:-4]) == merchant_static_fields['63']
config = {
    'ai_provider': 'clario',
    'speech_input_mode': 'ai_audio',
    'speech_scoring_mode': 'local',
    'speech_similarity_threshold': 75,
    'clario_base_url': settings['clario_base_url'],
    'clario_fallback_url': settings['clario_fallback_url'],
    'clario_model': settings['clario_model'],
    'gemini_live_model': settings['gemini_live_model'],
    'payment_qris_payload': merchant_static_qris,
    'payment_tax_percent': 11,
    'payment_admin_fee': 500,
    'payment_whatsapp': '6281234567890',
    'lockdown': False,
    'stop_registration': False,
}
request(admin, 'admin/settings', 'PUT', {**config, 'speech_similarity_threshold': 101}, expected=422)
request(admin, 'admin/settings', 'PUT', config)
assert request(admin, 'admin/settings')['settings']['speech_similarity_threshold'] == 75
assert request(regular, 'app-config')['settings']['speech_similarity_threshold'] == 75
assert request(admin, 'admin/settings')['settings']['speech_input_mode'] == 'ai_audio'
assert request(admin, 'admin/settings')['settings']['speech_scoring_mode'] == 'local'
assert request(regular, 'app-config')['settings']['speech_input_mode'] == 'ai_audio'
assert request(regular, 'app-config')['settings']['speech_scoring_mode'] == 'local'
request(regular, 'speech-score', 'POST', {'expected_text': 'hello', 'transcript': 'hello'}, expected=409)

# QRIS orders apply tax, fixed fees and a unique rupiah code; diamonds use base amount only.
shop_settings = request(regular, 'shop/settings')
assert shop_settings['settings']['diamond_rate'] == 100
assert shop_settings['settings']['purchase_validity_hours'] == 24
assert shop_settings['settings']['tax_percent'] == 11
assert shop_settings['settings']['admin_fee'] == 500
assert shop_settings['settings']['whatsapp'] == '6281234567890'
assert 'qris_payload' not in shop_settings['settings']
request(regular, 'shop/purchases', 'POST', {'base_amount': 5500}, expected=422)
purchase = request(regular, 'shop/purchases', 'POST', {'base_amount': 5000}, expected=201)['purchase']
assert purchase['status'] == 'pending'
assert purchase['base_amount'] == 5000 and purchase['diamond_amount'] == 50
assert purchase['tax_amount'] == 550 and purchase['admin_fee'] == 500
assert 1 <= purchase['unique_code'] <= 999
assert purchase['total_amount'] == 5000 + 550 + 500 + purchase['unique_code']
created_at = datetime.fromisoformat(purchase['created_at'])
expires_at = datetime.fromisoformat(purchase['expires_at'])
assert 86390 <= (expires_at - created_at).total_seconds() <= 86410
qris_fields = parse_qris(purchase['qris_payload'])
static_fields = merchant_static_fields
assert qris_fields['01'] == '12' and qris_fields['53'] == '360'
assert qris_fields['26'] == static_fields['26'] and qris_fields['51'] == static_fields['51']
assert qris_fields['59'] == static_fields['59']
assert qris_fields['60'] == 'JAKARTA BARAT'
assert qris_fields['54'] == f"{purchase['total_amount']:.2f}"
assert qris_fields['63'] == qris_crc16(purchase['qris_payload'][:-4])
request(regular, f"shop/purchases/{purchase['id']}/contacted", 'POST', {})
assert any(row['id'] == purchase['id'] and row['contacted_at'] for row in request(regular, 'shop/purchases')['purchases'])
admin_orders = request(admin, f"admin/purchases?page=1&status=pending&search={urllib.parse.quote(user_email)}")
assert admin_orders['total'] == 1 and admin_orders['items'][0]['email'] == user_email
approved = request(admin, f"admin/purchases/{purchase['id']}/approve", 'POST', {})
assert approved['diamonds'] == 50 and approved['purchase']['status'] == 'paid'
assert request(regular, 'me')['user']['diamonds'] == 50
second_purchase = request(regular, 'shop/purchases', 'POST', {'base_amount': 5000}, expected=201)['purchase']
request(admin, f"admin/purchases/{second_purchase['id']}", 'DELETE')
assert all(row['id'] != second_purchase['id'] for row in request(regular, 'shop/purchases')['purchases'])

# Free API uses its own encrypted API/JWT credentials and an allow-listed node pool.
free_config = {
    **config,
    'ai_provider': 'free',
    'free_pool': '\n'.join(['https://sg1.ichsanlabs.com', 'https://sg2.ichsanlabs.com']),
    'free_ttl_min': 30,
    'free_sub': 'smoke-api-client',
    'free_token_mode': 'auto',
    'free_api_key': 'smoke-api-key-only',
    'free_jwt_secret': 'smoke-jwt-secret-only',
    'free_manual_token': '',
    'speech_input_mode': 'live_transcribe',
    'speech_scoring_mode': 'ai',
}
request(admin, 'admin/settings', 'PUT', free_config)
selected = request(admin, 'admin/settings')['settings']
assert selected['ai_provider'] == 'free'
assert selected['speech_scoring_mode'] == 'ai'
assert selected['free_pool'].splitlines() == ['https://sg1.ichsanlabs.com', 'https://sg2.ichsanlabs.com']
assert selected['free_token_mode'] == 'auto' and selected['free_ttl_min'] == 30
assert not any(key.lower().startswith('ichan') for key in selected)
assert 'smoke-api-key-only' not in json.dumps(selected) and 'smoke-jwt-secret-only' not in json.dumps(selected)
assert request(regular, 'app-config')['settings']['ai_provider'] == 'free'
assert request(regular, 'app-config')['settings']['speech_scoring_mode'] == 'ai'
assert request(admin, 'models')['data'] == []

# Each AI mode requires diamonds, and Live reserves/refunds its 5-minute blocks.
assert request(admin, 'admin/wallet', 'PUT', {'id': learner['id'], 'mode': 'set', 'balance': 0})['diamonds'] == 0
for path, payload, required in [
    ('chat', {'transcript': 'Hello, tutor.'}, 2),
    ('speech-score', {'expected_text': 'hello', 'transcript': 'hello'}, 1),
]:
    insufficient = request(regular, path, 'POST', payload, expected=402)
    assert insufficient['required'] == required and insufficient['diamonds'] == 0
insufficient_audio = request_form(
    regular,
    'assess-audio',
    {'task_mode': 'response', 'consent': '1'},
    expected=402,
    files={'audio': ('smoke.wav', tiny_wav(), 'audio/wav')},
)
assert insufficient_audio['required'] == 5 and insufficient_audio['diamonds'] == 0
insufficient_direct_audio = request_form(
    regular,
    'assess-audio',
    {'task_mode': 'read_aloud_direct', 'consent': '1', 'task': 'Hello world.'},
    expected=402,
    files={'audio': ('smoke.wav', tiny_wav(), 'audio/wav')},
)
assert insufficient_direct_audio['required'] == 3 and insufficient_direct_audio['diamonds'] == 0

assert request(admin, 'admin/wallet', 'PUT', {'id': learner['id'], 'mode': 'set', 'balance': 10})['diamonds'] == 10
cancelled_live = request(regular, 'live-billing/start', 'POST', {}, expected=201)
assert cancelled_live['reserved_blocks'] == 1 and cancelled_live['diamonds'] == 0
cancelled_settlement = request(regular, 'live-billing/settle', 'POST', {
    'session_id': cancelled_live['session_id'], 'cancel': True,
})
assert cancelled_settlement['charged_diamonds'] == 0
assert cancelled_settlement['refunded_diamonds'] == 10 and cancelled_settlement['diamonds'] == 10

assert request(admin, 'admin/wallet', 'PUT', {'id': learner['id'], 'mode': 'set', 'balance': 20})['diamonds'] == 20
active_live = request(regular, 'live-billing/start', 'POST', {}, expected=201)
request(regular, 'live-billing/started', 'POST', {'session_id': active_live['session_id']})
request(regular, 'live-billing/reserve', 'POST', {'session_id': active_live['session_id']}, expected=409)
time.sleep(1.1)
settled_live = request(regular, 'live-billing/settle', 'POST', {
    'session_id': active_live['session_id'], 'cancel': False,
})
assert 2 <= settled_live['charged_diamonds'] <= 4
assert settled_live['refunded_diamonds'] == 10 - settled_live['charged_diamonds']
assert settled_live['diamonds'] == 20 - settled_live['charged_diamonds']

admin_live = request(admin, 'live-billing/start', 'POST', {}, expected=201)
assert admin_live['unlimited_access'] is True and admin_live['diamonds'] == admin_wallet_before['diamonds']
admin_live_settlement = request(admin, 'live-billing/settle', 'POST', {
    'session_id': admin_live['session_id'], 'cancel': True,
})
assert admin_live_settlement['charged_diamonds'] == 0
assert admin_live_settlement['refunded_diamonds'] == 0
assert admin_live_settlement['diamonds'] == admin_wallet_before['diamonds']

# Accept stored/client names from the previous build while presenting only the Free API brand.
legacy_config = {
    **config,
    'ai_provider': 'ichanlabs',
    'ichan_pool': '\n'.join(['https://sg1.ichsanlabs.com', 'https://sg2.ichsanlabs.com']),
    'ichan_ttl_min': 30,
    'ichan_sub': 'legacy-smoke-client',
    'ichan_token_mode': 'auto',
    'ichan_api_key': 'legacy-smoke-api-key-only',
    'ichan_jwt_secret': 'legacy-smoke-jwt-secret-only',
}
request(admin, 'admin/settings', 'PUT', legacy_config)
legacy_saved = request(admin, 'admin/settings')['settings']
assert legacy_saved['ai_provider'] == 'free'
assert legacy_saved['free_sub'] == 'legacy-smoke-client'
manual_config = {
    **free_config,
    'free_token_mode': 'manual',
    'free_jwt_secret': '',
    'free_manual_token': 'smoke-manual-token-only',
}
request(admin, 'admin/settings', 'PUT', manual_config)
manual_saved = request(admin, 'admin/settings')['settings']
assert manual_saved['free_token_mode'] == 'manual'
assert manual_saved['free_manual_token_configured']
assert 'smoke-manual-token-only' not in json.dumps(manual_saved)
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
print('PASS: auth and revocation; searchable/paginated admin users and wallets; seed/catalog/TTS/cache flows; persisted Listening Lab answer/speaking progress; AI diamond costs; QRIS pricing, unique codes, expiry and approval; Live block reservation/refunds; provider settings, CORS, lockdown and registration.')
