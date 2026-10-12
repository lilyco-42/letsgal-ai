"""Run the actual frozen launcher and compare its ZIP with known story inputs."""
import io
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import zipfile
import httpx

if os.environ.get('GITHUB_ACTIONS')!='true':raise RuntimeError('CI only')
binary=Path(sys.argv[1]).resolve()
env=dict(os.environ);env.pop('LAIN42_STORY_CLI',None)
process=subprocess.Popen([str(binary),'--browser'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',env=env)
try:
    url=None
    for _ in range(30):
        line=process.stdout.readline().strip()
        if line.startswith('http://127.0.0.1:'):url=line;break
        if process.poll() is not None:raise RuntimeError('Frozen launcher exited: '+line)
    assert url,'Packaged application did not start'
    with httpx.Client(base_url=url,timeout=20) as client:
        for _ in range(100):
            try:
                if client.get('/').status_code==200:break
            except httpx.HTTPError:pass
            time.sleep(.1)
        assert client.get('/api/capabilities').json()['available']
        session=client.post('/api/workspaces').json()['id']
        script='# 验收\n小明：实际冻结引擎运行。\n!end'
        start=client.post('/api/jobs',json={'session':session,'title':'冻结包验收','script':script})
        assert start.status_code==200,start.text
        job=start.json()
        for _ in range(100):
            job=client.get('/api/jobs/'+job['id']).json()
            if job['state'] not in {'queued','running'}:break
            time.sleep(.1)
        assert job['state']=='done',job
        export=client.get('/api/jobs/'+job['id']+'/files/export.zip')
        with zipfile.ZipFile(io.BytesIO(export.content)) as archive:
            chapter=json.loads(archive.read('project/chapters/验收.json'))
            assert chapter['fragments'][0]['blocks'][0]['content'][0]['text']=='实际冻结引擎运行。'
            assert archive.read('story.dsl').decode()==script
        assert client.delete('/api/workspaces/'+session).status_code==200
    Path('evidence').mkdir(exist_ok=True)
    Path('evidence/frozen.json').write_text(json.dumps({'real_embedded_cli':True,'source_export_match':True,'session_deleted':True}),encoding='utf-8')
finally:
    process.terminate()
    try:process.wait(timeout=10)
    except subprocess.TimeoutExpired:process.kill();process.wait()
