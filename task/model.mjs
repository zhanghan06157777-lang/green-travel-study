import {SCENES,MATCH_RULE} from './litter-scenes.mjs?v=20261102-rules1';
import {normalizeStroke,matchRegions} from './annotation-geometry.mjs?v=20261102-rules1';
const CONDITIONS=['engagement','completion'];
const METHODS=['mouse','touch','pen'];
const time=v=>Number.isFinite(v)&&v>=0;
const active=s=>s?.schemaVersion===7&&s.stage==='task'&&s.b1.endedAt===null;
const event=(s,type,at,detail={})=>({...s,events:[...s.events,{type,at,...detail}]});
const replaceScene=(s,index,scene)=>({...s,b1:{...s.b1,scenes:s.b1.scenes.map((r,i)=>i===index?scene:r)}});

export function createSession({id,condition,participantId='',now=Date.now()}={}){
  if(!CONDITIONS.includes(condition)||typeof id!=='string'||!id||!time(now))throw new TypeError('无效会话参数');
  return {schemaVersion:7,taskVersion:'photo_annotation_v7',id,condition,participantId:String(participantId).slice(0,80),createdAt:now,
    assignmentMethod:'external_condition_link',enrollmentSource:'external_credamo',
    stage:'rules',b1:{currentSceneIndex:0,startedAt:null,firstActionAt:null,endedAt:null,totalDrawnCount:0,foregroundMs:0,
      scenes:SCENES.map(r=>({id:r.id,marks:[],drawnCount:0,enteredAt:null,submittedAt:null,notFound:false,foregroundMs:0,matchedRegionIds:[]}))},
    reward:{eligible:null,claimedAt:null,fulfilmentStatus:'not_claimed'},
    events:[{type:'session_created',at:now,condition}]};
}
export function startTask(s,now=Date.now()){
  if(s.stage!=='rules')return s;
  const next=replaceScene(s,0,{...s.b1.scenes[0],enteredAt:now});
  return event({...next,stage:'task',b1:{...next.b1,startedAt:now}},'b1_started',now,{sceneId:SCENES[0].id});
}
export function addMark(s,stroke,now=Date.now()){
  if(!active(s)||!METHODS.includes(stroke?.inputMethod)||!time(stroke.durationMs))return s;
  const points=normalizeStroke(stroke.points),index=s.b1.currentSceneIndex,scene=s.b1.scenes[index];
  if(!points||scene.submittedAt!==null||scene.marks.length>=80||s.b1.totalDrawnCount>=120)return s;
  const drawnCount=scene.drawnCount+1;
  const mark={id:`${scene.id}-mark-${drawnCount}`,points,inputMethod:stroke.inputMethod,durationMs:stroke.durationMs,at:now};
  let next=replaceScene(s,index,{...scene,notFound:false,drawnCount,marks:[...scene.marks,mark]});
  next={...next,b1:{...next.b1,totalDrawnCount:s.b1.totalDrawnCount+1,firstActionAt:s.b1.firstActionAt??now}};
  return event(next,'b1_mark_added',now,{sceneId:scene.id,markId:mark.id,inputMethod:mark.inputMethod,mark});
}
export function undoMark(s,now=Date.now()){
  if(!active(s))return s;
  const i=s.b1.currentSceneIndex,r=s.b1.scenes[i];if(!r.marks.length)return s;
  return event(replaceScene(s,i,{...r,marks:r.marks.slice(0,-1)}),'b1_mark_undone',now,{sceneId:r.id,markId:r.marks.at(-1).id});
}
export function clearMarks(s,now=Date.now()){
  if(!active(s))return s;
  const i=s.b1.currentSceneIndex,r=s.b1.scenes[i];if(!r.marks.length)return s;
  return event(replaceScene(s,i,{...r,marks:[]}),'b1_marks_cleared',now,{sceneId:r.id,removedCount:r.marks.length});
}
export function summarize(s){
  const perScene=s.b1.scenes.map((r,i)=>({id:r.id,submitted:r.submittedAt!==null,markCount:r.marks.length,drawnCount:r.drawnCount,
    hitIds:matchRegions(r.marks,SCENES[i].regions),notFound:r.notFound}));
  return {submittedSceneCount:perScene.filter(r=>r.submitted).length,markedSceneCount:perScene.filter(r=>r.submitted&&r.markCount>0).length,
    retainedMarkCount:perScene.reduce((n,r)=>n+r.markCount,0),totalDrawnCount:s.b1.totalDrawnCount,
    uniqueRegionHits:perScene.filter(r=>r.submitted).reduce((n,r)=>n+r.hitIds.length,0),perScene};
}
function commitCurrent(s,notFound,now){
  const i=s.b1.currentSceneIndex,r=s.b1.scenes[i];
  if(r.submittedAt!==null)return s;
  if(!r.marks.length&&!notFound)throw new Error('请圈画您发现的垃圾，或勾选“未发现垃圾”后提交。');
  if(r.marks.length&&notFound)throw new Error('已有圈画时不能同时选择未发现垃圾。');
  return event(replaceScene(s,i,{...r,submittedAt:now,notFound:r.marks.length===0,matchedRegionIds:matchRegions(r.marks,SCENES[i].regions)}),
    'b1_scene_submitted',now,{sceneId:r.id,markCount:r.marks.length,notFound:r.marks.length===0});
}
function end(s,now){
  const summary=summarize(s);
  return event({...s,stage:'reward',b1:{...s.b1,endedAt:now},reward:{...s.reward,eligible:null}},'b1_settlement_entered',now,
    {submittedSceneCount:summary.submittedSceneCount});
}
export function submitScene(s,{notFound=false}={},now=Date.now()){
  if(!active(s))return s;
  let next=commitCurrent(s,notFound,now);const index=s.b1.currentSceneIndex;
  if(index===5)return end(next,now);
  next=replaceScene(next,index+1,{...next.b1.scenes[index+1],enteredAt:now});
  return event({...next,b1:{...next.b1,currentSceneIndex:index+1}},'b1_scene_entered',now,{sceneId:SCENES[index+1].id});
}
export function finishTask(s,now=Date.now()){
  if(['reward','final'].includes(s.stage))return s;
  if(!['rules','task'].includes(s.stage))return s;
  let next=s;
  if(active(s)&&s.b1.scenes[s.b1.currentSceneIndex].marks.length)next=commitCurrent(s,false,now);
  return end(next,now);
}
export function returnToTask(s,now=Date.now()){
  if(s.stage!=='reward'||s.reward.claimedAt!==null)return s;
  const index=s.b1.scenes.findIndex(r=>r.submittedAt===null);if(index<0)return s;
  let next=replaceScene(s,index,{...s.b1.scenes[index],enteredAt:s.b1.scenes[index].enteredAt??now});
  next={...next,stage:'task',b1:{...next.b1,currentSceneIndex:index,endedAt:null}};
  return event(next,'b1_returned_from_settlement',now,{sceneId:SCENES[index].id});
}
export function finalize(s,now=Date.now()){
  if(s.stage!=='reward'||s.reward.claimedAt!==null)return s;
  const z=summarize(s),eligible=z.markedSceneCount>0&&(s.condition==='engagement'||z.submittedSceneCount===6);
  return event({...s,stage:'final',reward:{eligible,claimedAt:now,fulfilmentStatus:eligible?'pending':'ineligible'}},'reward_finalized',now,{eligible});
}
export function canResume(s,condition,participantId=''){
  try{
    if(s?.schemaVersion!==7||s.taskVersion!=='photo_annotation_v7'||typeof s.id!=='string'||!s.id||!time(s.createdAt)||
      !CONDITIONS.includes(condition)||s.condition!==condition||s.participantId!==participantId||!['rules','task','reward','final'].includes(s.stage)||
      !Array.isArray(s.events)||!Array.isArray(s.b1?.scenes)||s.b1.scenes.length!==6||
      !Number.isInteger(s.b1.currentSceneIndex)||s.b1.currentSceneIndex<0||s.b1.currentSceneIndex>5||
      !time(s.b1.foregroundMs)||!Number.isInteger(s.b1.totalDrawnCount)||s.b1.totalDrawnCount<0||s.b1.totalDrawnCount>120)return false;
    let sawUnsubmitted=false,totalDrawn=0;
    for(const [i,r] of s.b1.scenes.entries()){
      if(r.id!==SCENES[i].id||!Array.isArray(r.marks)||r.marks.length>80||!Number.isInteger(r.drawnCount)||r.drawnCount<r.marks.length||
        !time(r.foregroundMs)||typeof r.notFound!=='boolean'||!Array.isArray(r.matchedRegionIds)||
        (r.enteredAt!==null&&!time(r.enteredAt))||(r.submittedAt!==null&&!time(r.submittedAt)))return false;
      totalDrawn+=r.drawnCount;
      if(new Set(r.marks.map(m=>m.id)).size!==r.marks.length)return false;
      for(const m of r.marks)if(typeof m.id!=='string'||!METHODS.includes(m.inputMethod)||!time(m.durationMs)||!time(m.at)||!normalizeStroke(m.points)||m.points.some(p=>p.x<0||p.x>1||p.y<0||p.y>1))return false;
      if(r.submittedAt===null){sawUnsubmitted=true;if(r.notFound||r.matchedRegionIds.length)return false;}
      else{
        if(sawUnsubmitted||r.enteredAt===null||r.submittedAt<r.enteredAt||r.notFound!==(r.marks.length===0))return false;
        if(JSON.stringify(r.matchedRegionIds)!==JSON.stringify(matchRegions(r.marks,SCENES[i].regions)))return false;
      }
      if(i>s.b1.currentSceneIndex&&(r.enteredAt!==null||r.marks.length||r.submittedAt!==null))return false;
    }
    if(totalDrawn!==s.b1.totalDrawnCount||(totalDrawn>0?!time(s.b1.firstActionAt):s.b1.firstActionAt!==null))return false;
    const summary=summarize(s),eligible=summary.markedSceneCount>0&&(condition==='engagement'||summary.submittedSceneCount===6);
    if(['reward','final'].includes(s.stage)){
      if(!time(s.b1.endedAt)||s.reward.eligible!==(s.stage==='final'?eligible:null))return false;
    }else{
      if(s.b1.endedAt!==null||s.reward.eligible!==null||s.reward.claimedAt!==null||summary.submittedSceneCount>5)return false;
      if(s.stage==='rules'&&(s.b1.startedAt!==null||totalDrawn||summary.submittedSceneCount||s.b1.scenes.some(r=>r.enteredAt!==null)))return false;
      if(s.stage==='task'&&(!time(s.b1.startedAt)||s.b1.currentSceneIndex!==summary.submittedSceneCount||!time(s.b1.scenes[s.b1.currentSceneIndex].enteredAt)))return false;
    }
    if(s.stage==='final'&&s.reward.claimedAt===null)return false;
    if(s.reward.claimedAt!==null&&(s.stage!=='final'||!time(s.reward.claimedAt)||s.reward.fulfilmentStatus!==(eligible?'pending':'ineligible')))return false;
    if(s.reward.claimedAt===null&&s.reward.fulfilmentStatus!=='not_claimed')return false;
    return true;
  }catch{return false;}
}
export function toCSV(sessions){
  const cell=value=>{let v=value===null||value===undefined?'':String(value);if(/^[\s]*[=+\-@]|^[\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};
  const headers=['session_id','participant_id','schema_version','task_version','condition','stage','submitted_scene_count','marked_scene_count',
    'retained_mark_count','valid_strokes_drawn_total','unique_region_hits','region_match_rule','foreground_ms','started_at','ended_at','reward_eligible','reward_claimed_at','fulfilment_status'];
  for(let i=1;i<=6;i++)for(const name of ['submitted','not_found','retained_marks','drawn_strokes','region_hits','foreground_ms','marks_json'])headers.push(`scene_${String(i).padStart(2,'0')}_${name}`);
  headers.push('events_json');
  const rows=sessions.filter(s=>s?.schemaVersion===7&&s.taskVersion==='photo_annotation_v7').map(s=>{
    const z=summarize(s);const values=[s.id,s.participantId,7,s.taskVersion,s.condition,s.stage,z.submittedSceneCount,z.markedSceneCount,z.retainedMarkCount,z.totalDrawnCount,z.uniqueRegionHits,MATCH_RULE,
      s.b1.foregroundMs,s.b1.startedAt,s.b1.endedAt,s.reward.eligible,s.reward.claimedAt,s.reward.fulfilmentStatus];
    for(const [i,r]of s.b1.scenes.entries())values.push(r.submittedAt!==null,r.notFound,r.marks.length,r.drawnCount,z.perScene[i].hitIds.length,r.foregroundMs,JSON.stringify(r.marks));
    values.push(JSON.stringify(s.events));return values;
  });
  return '\uFEFF'+[headers,...rows].map(r=>r.map(cell).join(',')).join('\r\n');
}
