import {canResume} from './model.mjs';import {reconcile} from './recovery.mjs';
export function createDraftStore({storage,key,writerId=crypto.randomUUID()}){
 const prefix=key+':draft:',own=prefix+writerId;
 const parse=text=>{try{return text?JSON.parse(text):null;}catch{return null;}};
 function drafts(token){const result=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(!k?.startsWith(prefix))continue;const snapshot=parse(storage.getItem(k));if(snapshot?.dirty&&(!token||snapshot.token===token))result.push({key:k,snapshot});}return result;}
 function read(){return parse(storage.getItem(key))||drafts()[0]?.snapshot||null;}
 function write(snapshot){
  const value={...snapshot,writerId};
  // Persist our own branch before touching the shared resume pointer.
  if(value.dirty)storage.setItem(own,JSON.stringify(value));
  const current=parse(storage.getItem(key));
  if(current?.dirty&&current.writerId!==writerId){const oldKey=prefix+(current.writerId||'legacy');if(!storage.getItem(oldKey))storage.setItem(prefix+'backup-'+crypto.randomUUID(),JSON.stringify(current));}
  storage.setItem(key,JSON.stringify(value));
 }
 function recover(remote,token){
  if(remote.stage==='final')return null;
  const current=parse(storage.getItem(key));const list=drafts(token).map(d=>d.snapshot);
  if(current?.dirty&&current.token===token)list.push(current);
  const candidates=[];
  for(const entry of list){const state=entry.state;if(!canResume(state,remote.condition,remote.participantId))throw Error('本地记录格式异常，记录已保留。请勿清除浏览器数据，请联系研究者。');if(reconcile(state,remote))candidates.push(state);else if(!reconcile(remote,state))throw Error('检测到多个页面的记录冲突，全部草稿已保留。请勿清除浏览器数据，请联系研究者。');}
  if(!candidates.length)return null;
  const selected=candidates.find(state=>candidates.every(other=>!!reconcile(state,other)));
  if(!selected)throw Error('检测到多个页面的离线记录冲突，全部草稿已保留。请勿清除浏览器数据，请联系研究者。');
  return selected;
 }
 function acknowledge(serverState,token){for(const draft of drafts(token))if(reconcile(serverState,draft.snapshot.state))storage.removeItem(draft.key);}
 return {read,write,drafts,recover,acknowledge};
}
