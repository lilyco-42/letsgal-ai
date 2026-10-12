"""CI-only tests execute the real embedded CLI and compare exported chapters."""
import io
import json
import os
from pathlib import Path
import time
import unittest
import zipfile

from fastapi.testclient import TestClient
from PIL import Image
from studio.app import create_app

if os.environ.get('GITHUB_ACTIONS')!='true':raise RuntimeError('Product tests run only in GitHub Actions')
DSL='# 雨后\n!scene 站台 backgrounds/station.png\n旁白：雨停了。\n阿澄：一起出发吗？\n!choice 出发 -> leave | 留下 -> stay\n## leave\n旁白：我们坐上列车。\n!end\n## stay\n旁白：我留在站台。\n!end'

class StudioTests(unittest.TestCase):
    def setUp(self):
        self.app=create_app()
        self.client=TestClient(self.app,base_url='http://localhost')
        self.client.__enter__();self.addCleanup(self.client.__exit__,None,None,None)
        self.client.get('/')

    def workspace(self):return self.client.post('/api/workspaces').json()['id']

    def wait(self,job):
        for _ in range(200):
            result=self.client.get('/api/jobs/'+job).json()
            if result['state'] not in {'queued','running'}:return result
            time.sleep(.025)
        self.fail('Actual CLI did not finish')

    def test_real_compile_image_preview_export_and_delete(self):
        session=self.workspace();data=io.BytesIO();Image.new('RGB',(180,100),(42,50,70)).save(data,format='PNG')
        upload=self.client.post(f'/api/workspaces/{session}/assets',data={'path':'backgrounds/station.png'},files={'file':('station.png',data.getvalue(),'image/png')})
        self.assertEqual(upload.status_code,200,upload.text)
        response=self.client.post('/api/jobs',json={'session':session,'title':'雨后','script':DSL})
        self.assertEqual(response.status_code,200,response.text)
        job=self.wait(response.json()['id']);self.assertEqual(job['state'],'done',job)
        self.assertEqual(job['result']['warnings'],[])
        self.assertEqual(job['result']['assets'],['backgrounds/station.png'])
        with zipfile.ZipFile(io.BytesIO(self.client.get('/api/jobs/'+job['id']+'/files/export.zip').content)) as archive:
            chapter=json.loads(archive.read('project/chapters/雨后.json'))
            self.assertEqual(chapter,job['result']['chapters'][0])
            self.assertEqual(archive.read('project/assets/backgrounds/station.png'),data.getvalue())
            self.assertEqual(archive.read('story.dsl').decode(),DSL)
        root=self.app.state.workspaces.get(session)
        self.assertEqual(self.client.delete('/api/workspaces/'+session).status_code,200)
        self.assertFalse(root.exists())
        self.assertEqual(self.client.get('/api/jobs/'+job['id']).status_code,404)

    def test_invalid_branch_duplicate_chapter_and_path_escape_rejected(self):
        session=self.workspace()
        for script in ['# ../../escape\n旁白：危险','# 重复\n你好\n# 重复\n再见','!choice 不完整','## no_chapter\n你好']:
            response=self.client.post('/api/jobs',json={'session':session,'title':'x','script':script})
            self.assertEqual(response.status_code,400,response.text)
        response=self.client.post('/api/jobs',json={'session':session,'title':'x','script':'# a\n!choice 走 -> missing'})
        job=self.wait(response.json()['id']);self.assertEqual(job['state'],'failed')
        self.assertIn('片段不存在',job['error'])
        self.assertEqual(self.client.get('/api/jobs/'+job['id']+'/files/export.zip').status_code,409)
        response=self.client.post(f'/api/workspaces/{session}/assets',data={'path':'../escape.png'},files={'file':('x.png',b'not an image','image/png')})
        self.assertEqual(response.status_code,400)

    def test_local_auth_origin_and_unknown_arguments(self):
        with TestClient(create_app(),base_url='http://localhost') as other:
            self.assertEqual(other.get('/api/capabilities').status_code,403)
        self.assertEqual(self.client.get('/api/capabilities',headers={'Origin':'https://evil.example'}).status_code,403)
        self.assertEqual(self.client.get('/',headers={'Host':'evil.example'}).status_code,403)
        session=self.workspace()
        self.assertEqual(self.client.post('/api/jobs',json={'session':session,'title':'x','script':'hi','command':'rm'}).status_code,422)

    def test_cancel_and_session_cleanup(self):
        session=self.workspace()
        job=self.client.post('/api/jobs',json={'session':session,'title':'x','script':'# a\n旁白：文本'}).json()
        result=self.client.post('/api/jobs/'+job['id']+'/cancel').json()
        self.assertIn(result['state'],{'cancelled','done'})
        self.assertEqual(self.client.delete('/api/workspaces/'+session).status_code,200)
        self.assertEqual(self.client.get('/api/jobs/'+job['id']).status_code,404)
