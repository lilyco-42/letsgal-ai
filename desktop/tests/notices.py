"""CI-only attribution collector for the shipped Rust/Python dependencies."""
import importlib.metadata
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import ssl
import urllib.request
import zipfile

if os.environ.get('GITHUB_ACTIONS') != 'true':
    raise SystemExit('Dependency notices are generated with the build in GitHub Actions only')
notices = []
# Frozen apps also contain CPython and its OpenSSL shared libraries, outside pip metadata.
python_version = '.'.join(str(v) for v in sys.version_info[:3])
openssl_version = ssl.OPENSSL_VERSION.split()[1]
for name, version, url in [
    ('CPython', python_version, f'https://raw.githubusercontent.com/python/cpython/v{python_version}/LICENSE'),
    ('OpenSSL', openssl_version, f'https://raw.githubusercontent.com/openssl/openssl/openssl-{openssl_version}/LICENSE.txt'),
    ('Node.js', '22.18.0', 'https://raw.githubusercontent.com/nodejs/node/v22.18.0/LICENSE'),
]:
    with urllib.request.urlopen(url,timeout=30) as response:
        text = response.read(256*1024+1).decode('utf-8')
    if len(text) < 100 or len(text) > 256*1024:
        raise RuntimeError('Invalid bundled runtime notice')
    notices.append({'ecosystem':'Bundled native runtime','name':name,'version':version,'source':url,'notices':{'LICENSE':text}})
    if name == 'Node.js':
        Path('engine-LICENSE').write_text(text,encoding='utf-8')
# pywebview's own BSD notice does not replace the SDK's independent notice.
if os.name == 'nt':
    pin = json.loads(Path('packaging/webview2-sdk.json').read_text(encoding='utf-8'))
    with urllib.request.urlopen(pin['source'], timeout=30) as response:
        package = response.read(40 * 1024 * 1024 + 1)
    assert len(package) <= 40 * 1024 * 1024
    assert hashlib.sha256(package).hexdigest() == pin['package_sha256']
    distribution = importlib.metadata.distribution('pywebview')
    bundled = Path('dist/Lain42-Story-Studio/_internal/webview/lib')
    with zipfile.ZipFile(io.BytesIO(package)) as sdk:
        license_bytes = sdk.read(pin['license_path'])
        assert hashlib.sha256(license_bytes).hexdigest() == pin['license_sha256']
        assert Path('MICROSOFT-WEBVIEW2-LICENSE.txt').read_bytes() == license_bytes
        for file in pin['files']:
            assert hashlib.sha256(sdk.read(file['sdk_path'])).hexdigest() == file['sha256']
            installed = distribution.locate_file('webview/lib/' + file['app_path'])
            assert hashlib.sha256(installed.read_bytes()).hexdigest() == file['sha256'], file['app_path']
            assert hashlib.sha256((bundled / file['app_path']).read_bytes()).hexdigest() == file['sha256'], file['app_path']
    notices.append({'ecosystem': 'Bundled native SDK', 'name': pin['name'],
                    'version': pin['version'], 'license': 'BSD-3-Clause', 'source': pin['source'],
                    'verified_files': pin['files'], 'notices': {'LICENSE.txt': license_bytes.decode('utf-8')}})
    Path('evidence').mkdir(exist_ok=True)
    Path('evidence/webview2-sdk.json').write_text(json.dumps({
        'commit': os.environ['GITHUB_SHA'], 'version': pin['version'],
        'package_sha256': pin['package_sha256'], 'license_sha256': pin['license_sha256'],
        'five_bundled_files_match_official_sdk': True}), encoding='utf-8')
for distribution in importlib.metadata.distributions():
    texts = {}
    for file in distribution.files or []:
        if '.dist-info/' in str(file).replace('\\','/') and re.search(r'(?i)(license|licence|copying|notice)', str(file)):
            p = distribution.locate_file(file)
            if p.is_file() and p.stat().st_size < 256*1024:
                texts[str(file)] = p.read_text(encoding='utf-8',errors='replace')
    notices.append({'ecosystem':'Python (includes CI packaging dependencies)','name':distribution.metadata['Name'],'version':distribution.version,'license':distribution.metadata.get('License-Expression') or distribution.metadata.get('License'),'notices':texts})
target = Path('THIRD-PARTY-NOTICES.json')
ui = Path('ui')
# Preserve the exact official shadcn sources; visual customization lives in wrappers.
sources = json.loads((ui/'src/shadcn-sources.json').read_text(encoding='utf-8'))
for item in sources:
    source = ui/'src/components/ui'/item['file']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == item['sha256'], item['file']
notices.append({'ecosystem':'Frontend component source','name':'shadcn/ui','source':'https://github.com/shadcn-ui/ui',
                'license':'MIT','notices':{'LICENSE':(ui/'src/components/ui/LICENSE.md').read_text(encoding='utf-8')}})
npm = 'npm.cmd' if os.name == 'nt' else 'npm'
paths = subprocess.check_output([npm,'ls','--omit=dev','--all','--parseable'],cwd=ui,text=True,encoding='utf-8')
for line in paths.splitlines():
    directory = Path(line)
    if directory.resolve() == ui.resolve():
        continue
    package = json.loads((directory/'package.json').read_text(encoding='utf-8'))
    texts = {}
    for file in directory.iterdir():
        if file.is_file() and file.name.upper().startswith(('LICENSE','LICENCE','COPYING','NOTICE')) and file.stat().st_size < 256*1024:
            texts[file.name] = file.read_text(encoding='utf-8',errors='replace')
    notices.append({'ecosystem':'Bundled frontend JavaScript','name':package['name'],'version':package['version'],
                    'license':package.get('license'),'notices':texts})
target.write_text(json.dumps(notices,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Collected attribution for {len(notices)} dependencies')
