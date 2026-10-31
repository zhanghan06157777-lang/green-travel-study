// A lost PUT acknowledgement may leave a newer descendant at an older local revision.
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export function reconcile(local,remote){
 if(!local||!remote||local.id!==remote.id||remote.stage==='final'||local.events.length<remote.events.length)return null;
 if(!remote.events.every((event,i)=>canonical(event)===canonical(local.events[i])))return null;
 if(remote.b1.scenes.some((r,i)=>r.submittedAt!==null&&canonical(r)!==canonical(local.b1.scenes[i])))return null;
 if(local.b1.foregroundMs<remote.b1.foregroundMs)return null;
 return local;
}
export const visibleDelta=(previous,now,wasVisible)=>wasVisible?Math.min(60000,Math.max(0,now-previous)):0;
export function createSaveGate(work){
 let running=null;
 return ()=>{if(!running)running=Promise.resolve().then(work).finally(()=>{running=null;});return running;};
}
