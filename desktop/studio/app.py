import secrets
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

from .adapters import StoryAdapter, executable, validate_script
from .jobs import Jobs
from .paths import MAX_FILE, MAX_UPLOAD, Workspaces, child

WEB = Path(__file__).parents[1]/'frontend'


class JobInput(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    session: str = Field(pattern=r'^[a-f0-9]{32}$')
    title: str = Field(default='我的故事',min_length=1,max_length=80)
    script: str = Field(min_length=1,max_length=131072)


def create_app():
    workspaces, jobs, token = Workspaces(), Jobs(), secrets.token_urlsafe(32)

    @asynccontextmanager
    async def lifespan(app):
        yield
        await jobs.close()
        workspaces.close()

    app=FastAPI(title='Lain42 Story Studio',lifespan=lifespan,docs_url=None,redoc_url=None,openapi_url=None)
    app.state.workspaces,app.state.jobs=workspaces,jobs

    @app.middleware('http')
    async def local_only(request: Request,call_next):
        host=request.headers.get('host','')
        try:
            parsed=urlsplit('http://'+host)
            valid=parsed.hostname in {'127.0.0.1','localhost','::1'} and parsed.username is None and not parsed.path
            origin=request.headers.get('origin')
            if origin:valid=valid and origin=='http://'+host
            if request.url.path.startswith('/api/'):
                valid=valid and secrets.compare_digest(request.cookies.get('asset_session',''),token)
            if not valid:return JSONResponse({'detail':'请从本机工具窗口打开'},status_code=403)
            if int(request.headers.get('content-length','0'))>MAX_UPLOAD+1024*1024:
                return JSONResponse({'detail':'请求文件过大'},status_code=413)
        except (ValueError,TypeError):return JSONResponse({'detail':'无效请求'},status_code=400)
        response=await call_next(request)
        response.headers.update({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
            'Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"})
        return response

    @app.exception_handler(ValueError)
    async def invalid(request,error):return JSONResponse({'detail':str(error)[:1000]},status_code=400)

    @app.get('/',response_class=HTMLResponse)
    def index():
        response=HTMLResponse((WEB/'index.html').read_text(encoding='utf-8'))
        response.set_cookie('asset_session',token,httponly=True,samesite='strict')
        return response

    @app.get('/api/capabilities')
    def capabilities():return {'available':bool(executable()),'max_script_kb':128,'max_assets':24,'external_models':False}

    @app.post('/api/workspaces')
    def new_workspace():
        identifier=uuid.uuid4().hex
        root=workspaces.new(identifier)
        (root/'input/assets').mkdir()
        return {'id':identifier}

    @app.post('/api/workspaces/{identifier}/assets')
    async def upload(identifier: str,path: str=Form(...),file: UploadFile=File(...)):
        root=workspaces.get(identifier)/'input/assets'
        if jobs.busy():raise HTTPException(409,'编译期间不能修改素材')
        target=child(root,path)
        if target.suffix.lower() not in {'.png','.jpg','.jpeg'} or target.exists():
            raise ValueError('请选择新的 PNG/JPEG 相对路径')
        existing=[p for p in root.rglob('*') if p.is_file()]
        if len(existing)>=24:raise ValueError('最多 24 张素材')
        size=0;total=sum(p.stat().st_size for p in existing)
        target.parent.mkdir(parents=True,exist_ok=True)
        try:
            with target.open('xb') as output:
                while chunk:=await file.read(1024*1024):
                    size+=len(chunk)
                    if size>MAX_FILE or size+total>MAX_UPLOAD:raise HTTPException(413,'单张最多16MB，素材合计最多32MB')
                    output.write(chunk)
            with Image.open(target) as image:
                if image.format not in {'PNG','JPEG'} or image.width*image.height>16_000_000:
                    raise ValueError('仅支持不超过1600万像素的PNG/JPEG')
                image.verify()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
            target.unlink(missing_ok=True)
            raise ValueError('素材不是有效的 PNG/JPEG 图片') from error
        except BaseException:
            target.unlink(missing_ok=True)
            raise
        finally:await file.close()
        return {'path':path,'bytes':size}

    @app.delete('/api/workspaces/{identifier}')
    async def delete(identifier: str):
        workspaces.get(identifier)
        await jobs.delete_session(identifier)
        workspaces.delete(identifier)
        return {'ok':True}

    @app.post('/api/jobs')
    async def start(body: JobInput):
        validate_script(body.script)
        return jobs.start(uuid.uuid4().hex,body.session,workspaces.get(body.session),StoryAdapter(),body)

    def get_job(identifier):
        if identifier not in jobs.items:raise HTTPException(404,'任务已删除')
        return jobs.items[identifier]

    @app.get('/api/jobs/{identifier}')
    def status(identifier: str):return jobs.public(get_job(identifier))

    @app.post('/api/jobs/{identifier}/cancel')
    async def cancel(identifier: str):
        get_job(identifier)
        return await jobs.cancel(identifier)

    @app.get('/api/jobs/{identifier}/files/{name:path}')
    def download(identifier: str,name: str):
        job=get_job(identifier)
        if job['state']!='done':raise HTTPException(409,'编译尚未完成')
        if name not in {f['name'] for f in job['files']}|{'export.zip'}:raise HTTPException(404,'文件不存在')
        file=child(job['out'],name)
        return FileResponse(file,filename=file.name,content_disposition_type='inline' if file.suffix.lower() in {'.png','.jpg','.jpeg'} else 'attachment')

    app.mount('/assets',StaticFiles(directory=WEB),name='assets')
    return app
