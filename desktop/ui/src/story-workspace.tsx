import {useEffect,useRef,useState} from 'react';
import {BookOpen,Download,FileText,LoaderCircle,Moon,Play,Plus,RotateCcw,Sun,Trash2} from 'lucide-react';
import {Button} from './components/ui/button';
import {Card,CardContent,CardHeader,CardTitle} from './components/ui/card';
import {Badge} from './components/ui/badge';

type Block={id:string;type:string;props?:Record<string,string|boolean>;content?:{text:string}[]};
type Fragment={id:string;name:string;blocks:Block[]};
type Chapter={id:string;name:string;fragments:Fragment[]};
type Result={title:string;chapters:Chapter[];assets:string[];warnings:string[];unpreviewed:string[]};
type Job={id:string;state:string;error?:string;result?:Result};
const EXAMPLE='# 雨后的车站\n!scene 车站 backgrounds/station.png\n旁白：雨停了，站台上的灯依旧亮着。\n阿澄：你会和我一起出发吗？\n!choice 一起出发 -> departure | 留在车站 -> stay\n## departure\n旁白：我们踏上了第一班列车。\n!end\n## stay\n阿澄：那我就在这里等你。\n!end';
async function api<T>(url:string,init?:RequestInit):Promise<T>{
 const response=await fetch(url,init);const data=await response.json();
 if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'请求未完成，请检查输入后重试');
 return data as T;
}
function fileUrl(job:string,name:string){return `/api/jobs/${job}/files/${name.split('/').map(encodeURIComponent).join('/')}`}

function StoryPreview({job}:{job:Job}){
 const result=job.result!;
 const [chapter,setChapter]=useState(0),[fragment,setFragment]=useState(0),[cursor,setCursor]=useState(0);
 const [history,setHistory]=useState<[number,number,number][]>([]);
 const frames=result.chapters[chapter]?.fragments[fragment]?.blocks||[];
 const block=frames[cursor];
 const text=block?.content?.map(x=>x.text).join('')||'';
 const scene=[...frames.slice(0,cursor+1)].reverse().find(x=>x.type==='scene');
 const asset=String(scene?.props?.uri||'');
 const options=block?.type==='branch'?JSON.parse(String(block.props?.optionsJson||'[]')) as {text:string;fragmentId:string}[]:[];
 const target=(id:string)=>{for(let c=0;c<result.chapters.length;c++)for(let f=0;f<result.chapters[c].fragments.length;f++)if(result.chapters[c].fragments[f].id===id)return [c,f] as const;return null};
 const jump=(id:string,call=false)=>{const t=target(id);if(t){if(call)setHistory(h=>[...h,[chapter,fragment,cursor+1]]);setChapter(t[0]);setFragment(t[1]);setCursor(0)}};
 function next(){
  if(block?.type==='branch')return;
  if(block?.type==='callFragment'){jump(String(block.props?.fragmentId),true);return}
  if(block?.type==='returnToEntry'){setCursor(frames.length);return}
  if(cursor+1<frames.length){setCursor(cursor+1);return}
  if(history.length){const last=history[history.length-1];setHistory(h=>h.slice(0,-1));setChapter(last[0]);setFragment(last[1]);setCursor(last[2]);return}
  if(fragment===0&&chapter+1<result.chapters.length){setChapter(chapter+1);setFragment(0);setCursor(0);return}
  setCursor(frames.length);
 }
 const reset=()=>{setChapter(0);setFragment(0);setCursor(0);setHistory([])};
 return <div className="space-y-4" id="preview">
  <div className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">真实编译成果 / 剧情预览</p><h2 className="text-xl font-medium">{result.title}</h2></div><Button variant="outline" size="sm" onClick={reset}><RotateCcw/>重播</Button></div>
  <div className="story-stage">
   {asset&&result.assets.includes(asset)&&<img className="story-background" alt={String(scene?.props?.sceneName||'场景')} src={fileUrl(job.id,'project/assets/'+asset)}/>}
   <div className="story-stage-label"><span>{result.chapters[chapter]?.name}</span><Badge variant="secondary">{block?.type||'预览结束'}</Badge></div>
   <div className="story-dialogue" aria-live="polite">
    <p className="text-xs text-primary mb-3">{block?.type==='dialogue'?String(block.props?.characterName||''):block?.type==='narration'?'旁白':block?.type==='scene'?String(block.props?.sceneName||'场景'):block?.type==='branch'?'做一个选择':block?.type==='returnToEntry'?'本段结束':'剧情节点'}</p>
    <p id="previewText" className="text-lg leading-relaxed whitespace-pre-wrap">{text||(!block?'这段故事已经走到终点。':block.type==='scene'?(result.assets.includes(asset)?'背景已加载。':'背景未导入；可先阅读剧情。'):block.type==='branch'?'选择下方选项，进入对应片段。':block.type==='callFragment'?'继续进入调用片段。':block.type==='returnToEntry'?'点击继续结束预览。':'此演出节点不在简化预览范围，工程中仍会保留。')}</p>
    {options.length>0?<div className="grid gap-2 mt-5">{options.map((o,i)=><Button key={i} variant="outline" onClick={()=>jump(o.fragmentId)}>{o.text}</Button>)}</div>:block&&<Button className="mt-5" onClick={next} id="nextLine">继续<Play/></Button>}
   </div>
  </div>
  <div className="flex flex-wrap gap-2">{result.chapters.map((c,i)=><Button key={c.id} variant={i===chapter?'secondary':'ghost'} size="sm" onClick={()=>{setChapter(i);setFragment(0);setCursor(0);setHistory([])}}>{c.name}</Button>)}</div>
  <p className="text-xs text-muted-foreground">预览对白、背景与分支，不是官方游戏引擎。完整演出请在 LetsGal Studio 核对。</p>
 </div>
}

export function StoryWorkspace(){
 const [dark,setDark]=useState(true),[title,setTitle]=useState('雨后的车站'),[script,setScript]=useState(EXAMPLE);
 const [session,setSession]=useState<string|null>(null),[job,setJob]=useState<Job|null>(null),[ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[assets,setAssets]=useState<string[]>([]),[assetPath,setAssetPath]=useState('backgrounds/station.png');
 const generation=useRef(0);
 const running=busy||job?.state==='queued'||job?.state==='running';
 useEffect(()=>{document.documentElement.classList.toggle('dark',dark)},[dark]);
 useEffect(()=>{api<{available:boolean}>('/api/capabilities').then(x=>setReady(x.available)).catch(e=>setError(e.message))},[]);
 useEffect(()=>{
  if(!job||!['queued','running'].includes(job.state))return;
  let active=true;const timer=setInterval(()=>api<Job>('/api/jobs/'+job.id).then(j=>{if(active)setJob(j)}).catch(e=>{if(active){setError(e.message);setJob(j=>j?{...j,state:'failed'}:null)}}),250);
  return()=>{active=false;clearInterval(timer)};
 },[job?.id,job?.state]);
 async function workspace(){if(session)return session;const x=await api<{id:string}>('/api/workspaces',{method:'POST'});setSession(x.id);return x.id}
 async function compile(){
  setBusy(true);setError('');const revision=generation.current;
  try{const id=await workspace();const next=await api<Job>('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:id,title,script})});if(revision===generation.current)setJob(next)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function cancel(){if(job)try{setJob(await api<Job>('/api/jobs/'+job.id+'/cancel',{method:'POST'}))}catch(e){setError((e as Error).message)}}
 async function clear(){generation.current++;setBusy(true);try{if(session)await api('/api/workspaces/'+session,{method:'DELETE'});setSession(null);setJob(null);setAssets([]);setError('')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function upload(file:File){setBusy(true);setError('');try{const id=await workspace();const form=new FormData();form.set('path',assetPath);form.set('file',file);const x=await api<{path:string}>(`/api/workspaces/${id}/assets`,{method:'POST',body:form});setAssets(a=>[...a,x.path]);setJob(null)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function importScript(file:File){try{if(file.size>131072)throw Error('剧本最多128KB');setScript(await file.text());setJob(null);setError('')}catch(e){setError((e as Error).message)}}
 const status=job?.state==='done'?'编译完成':running?'正在编译':job?.state==='cancelled'?'已取消':job?.state==='failed'?'编译失败':ready?'本机引擎就绪':'编译引擎不可用';
 return <main className="min-h-screen bg-background text-foreground">
  <header className="border-b bg-card px-6 py-4 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="rounded-lg border p-2"><BookOpen size={22}/></div><div><h1 className="text-base font-semibold">剧情工坊</h1><p className="text-xs text-muted-foreground">Lain42 · LetsGal Story Studio</p></div></div><div className="flex items-center gap-3"><Badge variant="outline">离线创作</Badge><Button variant="ghost" size="icon" aria-label="切换明暗主题" onClick={()=>setDark(v=>!v)}>{dark?<Sun/>:<Moon/>}</Button></div></header>
  <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
   <div className="mb-7"><p className="text-xs tracking-widest text-primary mb-2">WRITE · PREVIEW · EXPORT</p><h2 className="text-3xl font-medium tracking-tight mb-2">让你的故事，开始发生。</h2><p className="text-sm text-muted-foreground">写下对白，看看分支怎么走，再导出工程。素材和剧本都留在本机。</p></div>
   <div className="grid gap-6 lg:grid-cols-[minmax(340px,.85fr)_minmax(0,1.15fr)]">
    <div className="space-y-5">
     <Card><CardHeader><CardTitle>01 / 写故事</CardTitle></CardHeader><CardContent className="space-y-4">
      <label className="block text-sm" htmlFor="title">工程名称<input id="title" className="story-input mt-2" value={title} maxLength={80} disabled={running} onChange={e=>{setTitle(e.target.value);setJob(null)}}/></label>
      <label className="block text-sm" htmlFor="script">剧情脚本<textarea id="script" className="story-input font-mono text-sm mt-2 min-h-[300px]" value={script} disabled={running} spellCheck={false} onChange={e=>{setScript(e.target.value);setJob(null)}}/></label>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={running} onClick={()=>{setScript(EXAMPLE);setJob(null)}}><FileText/>载入示例</Button><label className="story-upload">导入 .dsl<input id="storyFile" type="file" accept=".dsl,.txt" disabled={running} onChange={e=>{const f=e.target.files?.[0];if(f)void importScript(f);e.target.value=''}}/></label></div>
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">不熟悉语法？展开快速参考</summary><pre className="mt-3 whitespace-pre-wrap">{'# 章节名\n旁白：一段描述\n角色名：一句对白\n!scene 场景名 backgrounds/image.png\n!choice 选项 -> ending\n## ending\n旁白：结局\n!end'}</pre><p className="mt-3">可把 AI 生成的相同格式脚本粘贴进来。不内置 AI 服务或调用额度。</p></details>
     </CardContent></Card>
     <Card><CardHeader><CardTitle>02 / 附加背景</CardTitle></CardHeader><CardContent className="space-y-3">
      <label className="block text-sm" htmlFor="assetPath">脚本中引用的相对路径<input id="assetPath" className="story-input mt-2" value={assetPath} disabled={running} onChange={e=>setAssetPath(e.target.value)}/></label>
      <label className="story-upload"><Plus size={16}/>选择 PNG / JPEG<input id="assetFile" type="file" accept="image/png,image/jpeg" disabled={running} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value=''}}/></label>
      <ul className="text-xs text-muted-foreground space-y-1">{assets.map(a=><li key={a}>{a}</li>)}</ul><p className="text-xs text-muted-foreground">无素材也能编译。24 张以内，单张最多16MB。请使用自己有权使用的素材。</p>
     </CardContent></Card>
     <div className="flex flex-wrap gap-2"><Button id="compile" disabled={running||!ready||!script.trim()||!title.trim()} onClick={()=>void compile()}>{running?<LoaderCircle className="animate-spin"/>:<Play/>}编译并预览</Button>{running&&<Button variant="outline" onClick={()=>void cancel()}>取消</Button>}<Button variant="ghost" disabled={busy} onClick={()=>void clear()}><Trash2/>清空工作区</Button></div>
     <p id="status" aria-live="polite" className="text-sm text-muted-foreground">{status}</p>{(error||job?.error)&&<p role="alert" className="text-sm text-destructive">{error||job?.error}</p>}
    </div>
    <Card className="h-fit lg:sticky lg:top-6"><CardContent className="pt-6">
     {job?.state==='done'&&job.result?<><StoryPreview key={job.id} job={job}/><div className="border-t mt-6 pt-5 flex flex-wrap gap-3"><a id="downloadZip" href={fileUrl(job.id,'export.zip')} className="story-download"><Download size={16}/>导出工程 ZIP</a><a href={fileUrl(job.id,'story.dsl')} className="story-download">保存剧本</a></div>{job.result.warnings.length>0&&<div className="mt-4 text-xs text-muted-foreground"><p>待补素材</p>{job.result.warnings.map(w=><p key={w}>{w}</p>)}</div>}{job.result.unpreviewed.length>0&&<p className="mt-4 text-xs text-muted-foreground">仅在工程中保留、未模拟的演出：{job.result.unpreviewed.join('、')}</p>}</>:<div className="story-empty"><BookOpen size={38}/><h3 className="mt-4 text-xl">故事在这里展开</h3><p className="mt-2 text-sm">先编译左侧脚本。预览来自实际生成的章节。</p></div>}
     <p className="mt-5 text-xs text-muted-foreground">退出或清空将删除临时文件，记得先导出。ZIP 是 LetsGal 工程，不是完整游戏安装包。</p>
    </CardContent></Card>
   </div>
  </div>
 </main>
}
