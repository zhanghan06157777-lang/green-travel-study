import {config} from '../config.mjs?v=20261101-ui1';import {esc} from '../task/view.mjs?v=20261101-ui1';import {renderDetail,time} from './render.mjs?v=20261101-ui1';
import {createResponseGate} from './response-gate.mjs?v=20261101-ui1';
const sessionGate=createResponseGate(),detailGate=createResponseGate();
const $=id=>document.getElementById(id);let session=null,page=0,total=0,detail=null,generation=0,history=true,references=false;
const error=message=>{$('error').textContent=message||'';};
async function auth(path,body,token){const r=await fetch(config.supabaseUrl+'/auth/v1/'+path,{method:'POST',credentials:'omit',headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});let data;try{data=await r.json();}catch{data={};}if(!r.ok)throw Error('登录失败或已过期，请检查账号、密码及邮箱验证状态。');return data;}
function setSession(data){session={accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:Date.now()+(data.expires_in||3600)*1000};}
function clear(){sessionGate.invalidate();detailGate.invalidate();session=null;detail=null;generation++;$('records').innerHTML='';$('detail').innerHTML='';$('detail').hidden=true;$('workspace').hidden=true;$('logout').hidden=true;$('login-panel').hidden=false;$('login').reset();}
async function api(action,params=new URLSearchParams()){
 return sessionGate.run(async()=>{
 if(!session)throw Error('请先登录。');
 if(session.expiresAt<Date.now()+30000){try{setSession(await sessionGate.run(()=>auth('token?grant_type=refresh_token',{refresh_token:session.refreshToken})));}catch(e){clear();throw e;}}
 const url=new URL(config.apiUrl);url.searchParams.set('action',action);for(const [k,v]of params)url.searchParams.set(k,v);
 const r=await fetch(url,{credentials:'omit',cache:'no-store',headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.accessToken},signal:AbortSignal.timeout(25000)});
 if(!r.ok){let body;try{body=await r.json();}catch{}if(r.status===401)clear();throw Error(body?.error||'请求失败，请重试。');}
 return action==='admin-export'?await r.text():await r.json();
 });
}
const params=()=>{const p=new URLSearchParams(new FormData($('filters')));p.set('page',String(page));return p;};
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function load(){const current=++generation;error('');try{const result=await api('admin-list',params());if(current!==generation)return;total=result.total;$('records').innerHTML=result.records.map(r=>`<tr><td class="mono">${esc(r.code)}</td><td>${esc(r.external_id||'未传入')}${r.external_count>1?'（重复编号）':''}</td><td>${r.condition==='engagement'?'参与':'完成'}</td><td>${r.stage==='final'?'已结束':r.stage==='reward'?'结算中':r.stage==='task'?'识别中':'规则页'}</td><td>${r.summary.submittedSceneCount} / ${r.summary.retainedMarkCount}</td><td>${r.eligible===null?'未确认':r.eligible?'有，待发放':'无'}</td><td>${esc(time(r.created_at))}</td><td><button data-record="${esc(r.id)}">查看</button></td></tr>`).join('');$('count').textContent=`共 ${total} 条 · 第 ${page+1} 页`;$('previous').disabled=page===0;$('next').disabled=(page+1)*25>=Math.min(total,10025);}catch(e){error(e.message);}}
$('login').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;error('');try{const f=new FormData(e.currentTarget);setSession(await auth('token?grant_type=password',{email:f.get('email'),password:f.get('password')}));$('login').reset();await api('admin-list',new URLSearchParams());$('login-panel').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;page=0;await load();}catch(e){clear();error(e.message);}finally{button.disabled=false;}});
$('logout').onclick=async()=>{const token=session?.accessToken;clear();error('');if(token)try{await auth('logout?scope=local',null,token);}catch{error('本页面已退出；网络未确认远端退出，请关闭页面。');}};
$('filters').onsubmit=e=>{e.preventDefault();page=0;load();};$('previous').onclick=()=>{if(page>0){page--;load();}};$('next').onclick=()=>{if((page+1)*25<Math.min(total,10025)){page++;load();}};
$('export').onclick=async()=>{error('');try{download(await api('admin-export',params()),'green-travel-summary.csv','text/csv;charset=utf-8');}catch(e){error(e.message);}};
$('records').onclick=async e=>{const button=e.target.closest('[data-record]');if(!button)return;error('');try{detail=await detailGate.run(()=>api('admin-detail',new URLSearchParams({id:button.dataset.record})),{latest:true});$('detail').innerHTML=renderDetail(detail,{history,references});$('detail').hidden=false;}catch(e){error(e.message);}};
$('detail').onclick=e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='close'){detailGate.invalidate();$('detail').hidden=true;$('detail').innerHTML='';detail=null;}if(action==='json'&&detail)download(JSON.stringify(detail,null,2),detail.code+'.json','application/json');};
$('detail').onchange=e=>{if(e.target.id==='history')history=e.target.checked;if(e.target.id==='references')references=e.target.checked;if(detail)$('detail').innerHTML=renderDetail(detail,{history,references});};
