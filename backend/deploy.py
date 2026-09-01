import json, urllib.request, time, os

TOKEN = os.getenv('COOLIFY_TOKEN')
BASE = 'http://localhost:8000/api/v1'
APP = 'r2xw1rgnwjaq4kq6c4rsayr7'

def req(method, path, body=None):
    r = urllib.request.Request(f'{BASE}{path}', method=method)
    r.add_header('Authorization', f'Bearer {TOKEN}')
    r.add_header('Content-Type', 'application/json')
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(r, data=data) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]

st, res = req('POST', f'/deploy', {'uuid': APP})
print('deploy:', st, '|', res)
dep = res['deployments'][0]['deployment_uuid'] if st == 200 else None
if dep:
    for i in range(15):
        d = req('GET', f'/deployments/{dep}')[1]
        s = d.get('status', '?')
        print(f'poll {i+1}: {s}')
        if s in ('finished', 'failed', 'success'):
            break
        time.sleep(12)
