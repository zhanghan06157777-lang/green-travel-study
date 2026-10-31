import * as model from './model.mjs?v=20261101-ui2';
import {renderRules,renderTask,renderReward,renderFinal,rewardFeedback,esc} from './view.mjs?v=20261101-ui2';
import {mountAnnotationSurface} from './annotation-surface.mjs?v=20261101-ui2';
import {smoothPath} from './annotation-geometry.mjs?v=20261101-ui2';
import {SCENES} from './litter-scenes.mjs?v=20261101-ui2';
import {reconcile,visibleDelta,createSaveGate} from './recovery.mjs?v=20261101-ui2';
import {createStudyTransport} from './transport.mjs?v=20261101-ui2';
import {config} from '../config.mjs?v=20261101-ui2';
import {createDraftStore} from './draft-store.mjs?v=20261101-ui2';
import {createScenePreloader,renderScenePhoto} from './scene-assets.mjs?v=20261101-ui2';

// A capability belongs to this browser/session, never an IP address.
export function mountParticipant(root,condition){
 const images=createScenePreloader();images.warm(0,'high');
 const pid=(new URLSearchParams(location.search).get('pid')||'').slice(0,80);
 const key=config.cacheNamespace+':'+condition+':'+pid;
 const drafts=createDraftStore({storage:localStorage,key});
 let releaseLease=null;
 let cache,state,revision=0,code='',surface=null,disposed=false,ready=false,nofind=false,busy=false;
 let dirty=false,mutations=0,saveTimer=null,tick=performance.now(),sceneIndex=-1,wasVisible=!document.hidden,conflict=false;
 const abort=new AbortController();
 function store(){drafts.write({token:cache.token,state,revision,dirty});if(!dirty)drafts.acknowledge(state,cache.token);}
 function status(message,error=false){const box=root.querySelector('#sync');if(box){box.className='sync'+(error?' error':'');box.innerHTML=esc(message)+(error?' <button data-action="sync">重试保存</button>':'');}}
 async function api(path,method='GET',data){return createStudyTransport({...config,token:cache.token,signal:abort.signal})(path,method,data);}
 function remember(){dirty=true;mutations++;store();status('正在保存…');clearTimeout(saveTimer);saveTimer=setTimeout(()=>flush().catch(()=>{}),450);}
 function mutate(next,redraw=true){if(next===state)return;state=next;remember();if(redraw)render();}
 const flush=createSaveGate(async()=>{try{
   while(dirty&&state.stage!=='final'){
    const count=mutations,snapshot=structuredClone(state);
    let result;
    try{result=await api('/api/study','PUT',{state:snapshot,revision});}
    catch(error){if(error.status!==409)throw error;
     const canonical=await api('/api/study?id='+encodeURIComponent(state.id));
     if(canonical.state.stage==='final'){state=canonical.state;revision=canonical.revision;code=canonical.code;dirty=false;store();render();return;}
     if(reconcile(state,canonical.state)){revision=canonical.revision;store();continue;}
     conflict=true;throw new Error('另一个页面有不同的进度。当前本地记录已保留，请勿清除浏览器数据；请联系研究者处理。');
    }
    revision=result.revision;code=result.code;
    if(count===mutations)dirty=false;
    store();
   }
   status('进度已保存');
  }catch(e){
   status(e.status===409?'进度已在其他页面更新。请刷新，以服务器记录为准。':e.message+'；记录已保存在当前浏览器，请重试。',true);
   throw e;
  }});
 function accrue(){const now=performance.now(),dt=visibleDelta(tick,now,wasVisible);tick=now;if(state?.stage!=='task'||!dt||!ready||busy||conflict)return;
  const i=state.b1.currentSceneIndex,r=state.b1.scenes[i];
  state={...state,b1:{...state.b1,foregroundMs:state.b1.foregroundMs+dt,scenes:state.b1.scenes.map((v,j)=>j===i?{...r,foregroundMs:r.foregroundMs+dt}:v)}};
  remember();
 }
 function controls(){const r=state.b1.scenes[state.b1.currentSceneIndex];const submit=root.querySelector('#submit'),no=root.querySelector('#no-find');
  if(submit)submit.disabled=!ready||(!r.marks.length&&!nofind)||busy;
  if(no){no.disabled=!ready||!!r.marks.length||busy;no.setAttribute('aria-pressed',String(nofind));}
  for(const name of ['undo','clear']){const b=root.querySelector('[data-action="'+name+'"]');if(b)b.disabled=busy||!r.marks.length;}
 }
 function render(){
  if(disposed)return;surface?.dispose();surface=null;ready=false;
  root.classList.toggle('task-page',state.stage==='task');
  root.classList.toggle('rules-page',state.stage==='rules');
  root.classList.toggle('reward-page',['reward','final'].includes(state.stage));
  root.innerHTML='<div id="sync" class="sync" role="status">'+(dirty?'正在保存…':'进度已保存')+'</div>'+(state.stage==='rules'?renderRules(state):state.stage==='task'?renderTask(state):state.stage==='reward'?renderReward(state):renderFinal(state,code));
  if(state.stage!=='task')return;
  const i=state.b1.currentSceneIndex;if(sceneIndex!==i)nofind=false;sceneIndex=i;tick=performance.now();
  const photo=root.querySelector('#photo'),svg=root.querySelector('#surface');
  surface=mountAnnotationSurface(svg,{marks:state.b1.scenes[i].marks,onNotice:message=>{root.querySelector('#notice').textContent=message;},onStroke:stroke=>{
   if(busy)return;
   accrue();const next=model.addMark(state,stroke);if(next===state)root.querySelector('#notice').textContent='已达到圈画上限，请提交当前场景或结束识别。';mutate(next,false);nofind=false;surface.setMarks(state.b1.scenes[i].marks);controls();
  }});
  const loaded=()=>{if(disposed||!photo.isConnected)return;ready=photo.naturalWidth>0;svg.dataset.ready=String(ready);root.querySelector('#photo-loading').hidden=true;root.querySelector('#photo-error').hidden=ready;controls();if(ready)images.warm(i+1);};
  photo.onload=loaded;photo.onerror=loaded;if(photo.complete)loaded();
 }
 function review(){const dialog=document.createElement('dialog');dialog.className='review-dialog';dialog.innerHTML='<h2>识别记录</h2><p class="small">已提交的记录仅供查看。</p>'+state.b1.scenes.map((r,i)=>'<h3>'+esc(SCENES[i].title)+'</h3><div class="photo-shell">'+renderScenePhoto(SCENES[i])+'<svg viewBox="0 0 1000 1000" preserveAspectRatio="none">'+r.marks.map(m=>'<path d="'+smoothPath(m.points,true)+'" class="annotation-mark"/>').join('')+'</svg></div>').join('')+'<button class="btn primary">返回领取页</button>';root.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();}
 async function action(event){
  const button=event.target.closest('[data-action]');if(!button||button.disabled||busy||!state||conflict)return;
  const action=button.dataset.action;
  try{
   if(action==='sync'){await flush();return;}
   if(action==='copy'){try{await navigator.clipboard.writeText(code);button.textContent='已复制';}catch{status('请长按或选择随机码后手动复制。');}return;}
   if(state.stage==='final')return;
   accrue();
   if(action==='start')mutate(model.startTask(state));
   if(action==='undo'||action==='clear'){mutate(action==='undo'?model.undoMark(state):model.clearMarks(state),false);surface?.setMarks(state.b1.scenes[state.b1.currentSceneIndex].marks);controls();}
   if(action==='nofind'){nofind=!nofind;controls();}
   if(action==='submit'){mutate(model.submitScene(state,{notFound:nofind}));nofind=false;await flush();}
   if(action==='stop'){mutate(model.finishTask(state));await flush();}
   if(action==='return'){mutate(model.returnToTask(state));await flush();}
   if(action==='review')review();
   if(action==='retry')render();
   if(action==='claim'){
    busy=true;button.disabled=true;status('正在确认领取结果…');
    await flush();
    const result=await api('/api/study/claim','POST',{id:state.id,revision});
    state=result.state;revision=result.revision;code=result.code;dirty=false;store();render();
    const f=rewardFeedback(state),dialog=document.createElement('dialog');dialog.className='review-dialog result-dialog';dialog.innerHTML='<h2>'+esc(f.title)+'</h2>'+(f.detail?'<p class="result-text">'+esc(f.detail)+'</p>':'')+'<p class="result-notice">'+esc(f.notice)+'</p><p class="return-note">'+esc(f.codeInstruction)+'</p><button class="btn primary">我知道了</button>';root.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();
   }
  }catch(e){status(e.message,true);}finally{busy=false;const claim=root.querySelector('[data-action="claim"]');if(claim)claim.disabled=false;}
 }
 root.addEventListener('click',action);
 const interval=setInterval(accrue,15000);
 const visible=()=>{accrue();wasVisible=!document.hidden;tick=performance.now();if(document.hidden&&dirty)flush().catch(()=>{});};
 document.addEventListener('visibilitychange',visible);
 const before=e=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',before);
 const online=()=>{if(dirty)flush().catch(()=>{});};window.addEventListener('online',online);
 async function init(){
  try{
   cache=drafts.read();
   if(!cache?.token){cache={token:[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('')};drafts.write(cache);}
   const result=await api('/api/study','POST',{token:cache.token,condition,pid});if(disposed)return;
   revision=result.revision;code=result.code;
   state=drafts.recover(result.state,cache.token)||result.state;
   dirty=state!==result.state;store();render();if(dirty)await flush();
  }catch(e){if(!disposed){root.innerHTML='<section class="panel"><h1>暂时无法进入活动</h1><p>'+esc(e.message)+'</p><p>请保留当前浏览器，并刷新重试。</p><button class="btn primary" data-action="reload">刷新重试</button></section>';root.querySelector('button').onclick=()=>location.reload();}}
 }
 if(navigator.locks?.request){navigator.locks.request(key,{ifAvailable:true},async lock=>{if(!lock){root.innerHTML='<section class="panel"><h1>活动已在另一个页面打开</h1><p>请在原页面继续；如需使用本页，请关闭另一个活动页面后刷新。</p><button class="btn primary">重新检查</button></section>';root.querySelector('button').onclick=()=>location.reload();return;}await init();if(!disposed)await new Promise(resolve=>releaseLease=resolve);}).catch(()=>{if(!disposed)root.innerHTML='<section class="panel">无法协调活动页面，请关闭其他活动页后刷新重试。</section>';});}else init();
 return ()=>{disposed=true;releaseLease?.();clearInterval(interval);clearTimeout(saveTimer);surface?.dispose();abort.abort();root.removeEventListener('click',action);document.removeEventListener('visibilitychange',visible);window.removeEventListener('beforeunload',before);window.removeEventListener('online',online);};
}
