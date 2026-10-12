"""Invoke the existing CLI binary; never reimplement the DSL compiler."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys

from .paths import child


def executable():
    suffix = '.exe' if sys.platform == 'win32' else ''
    configured = os.environ.get('LAIN42_STORY_CLI')
    base = Path(getattr(sys, '_MEIPASS', Path(__file__).parents[1]))
    path = Path(configured) if configured else base/'bin'/('letsgal-ai'+suffix)
    return str(path.resolve()) if path.is_file() else None


def validate_script(text):
    if not text.strip():
        raise ValueError('请先写一段故事')
    if len(text.encode('utf-8')) > 128*1024 or len(text.splitlines()) > 2000:
        raise ValueError('剧本最多 128 KB / 2000 行')
    names = []
    for number, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if line.startswith('#') and not line.startswith('## '):
            name = line[1:].strip()
            if not name or len(name) > 100 or '/' in name or '\\' in name:
                raise ValueError(f'第 {number} 行：请用短名称作为章节标题')
            child(Path('/safe-chapters'), name+'.json')
            if name in names:
                raise ValueError(f'第 {number} 行：章节名称不能重复')
            names.append(name)
        if line.startswith('## ') and not names:
            raise ValueError(f'第 {number} 行：片段前请先添加 # 章节标题')
        if line.startswith('!choice'):
            options = line[len('!choice'):].strip().split('|')
            if not options or any('->' not in option or not all(s.strip() for s in option.split('->',1)) for option in options):
                raise ValueError(f'第 {number} 行：分支格式为 !choice 选项 -> 片段名')
    if len(names)>80:
        raise ValueError('最多 80 个章节')


class StoryAdapter:
    def command(self, root, out, request):
        binary = executable()
        if not binary:
            raise ValueError('编译引擎缺失，请下载完整桌面包')
        validate_script(request.script)
        script = root/'story.dsl'
        script.write_bytes(request.script.encode('utf-8'))
        return [binary, 'build', str(script), '-o', str(out/'project'), '--name', request.title]

    def result(self, stdout):
        return {'message': stdout.strip()[:1000]}

    def validate_output(self, out, request, result):
        project = out/'project'
        metadata = json.loads((project/'project.json').read_text(encoding='utf-8'))
        chapters = []
        for name in metadata['chapterOrder']:
            path = child(project/'chapters', name+'.json')
            if path.stat().st_size > 2*1024*1024:
                raise ValueError('章节输出过大')
            chapters.append(json.loads(path.read_text(encoding='utf-8')))
        fragments = {f['id'] for c in chapters for f in c['fragments']}
        unpreviewed = set()
        assets = []
        manifest = json.loads((project/'assets/.manifest.json').read_text(encoding='utf-8'))
        # Inputs were validated PNG/JPEG uploads in this private workspace.
        source = out.parent.parent/'input/assets'
        for file in sorted(source.rglob('*')) if source.exists() else []:
            if not file.is_file():
                continue
            name = file.relative_to(source).as_posix()
            target = child(project/'assets', name)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(file, target)
            data = target.read_bytes()
            key = hashlib.md5(data).hexdigest()
            manifest['entries'][key] = {'path':name,'size':len(data),'updatedAt':int(target.stat().st_mtime*1000)}
            assets.append(name)
        (project/'assets/.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        warnings = []
        for chapter in chapters:
            for fragment in chapter['fragments']:
                for block in fragment['blocks']:
                    props = block.get('props',{})
                    kind = block['type']
                    if kind == 'branch':
                        options = json.loads(props['optionsJson'])
                        if any(o['fragmentId'] not in fragments for o in options):
                            raise ValueError('分支引用的片段不存在，请核对 ## 片段名')
                    if kind == 'callFragment' and props.get('fragmentId') not in fragments:
                        raise ValueError('调用的片段不存在，请核对 !call 和 ## 片段名')
                    if kind == 'scene' and props.get('uri') and props['uri'] not in assets:
                        warnings.append('缺少背景素材：'+props['uri'])
                    if kind not in {'dialogue','narration','scene','branch','callFragment','returnToEntry','comment','removeCharacter'}:
                        unpreviewed.add(kind)
        shutil.copyfile(out.parent.parent/'input/story.dsl',out/'story.dsl')
        result.update(title=metadata['name'],chapters=chapters,assets=assets,
                      warnings=sorted(set(warnings)),unpreviewed=sorted(unpreviewed))
