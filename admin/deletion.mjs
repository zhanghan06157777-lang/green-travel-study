import {esc} from '../task/view.mjs?v=20261102-rules1';
export function renderRecordActions(record){return `<span class="record-actions"><button data-record="${esc(record.id)}">查看</button><button class="record-delete" data-delete="${esc(record.id)}" data-code="${esc(record.code)}">删除</button></span>`;}
export function renderDeleteConfirmation(record){return `<h2 id="delete-heading">确认删除</h2><p>确认删除样本 <strong class="mono">${esc(record.code)}</strong>？删除后无法恢复。</p><div class="delete-actions"><button class="btn secondary" data-decision="cancel">取消</button><button class="btn danger" data-decision="confirm">确认</button></div>`;}
export function clampRecordPage(page,total){return Math.max(0,Math.min(Math.max(0,Math.floor(Number(page)||0)),Math.ceil(Math.max(0,Number(total)||0)/25)-1));}
export function createDeleteFlow({ask,remove,onDeleted,onError=()=>{}}){
 let epoch=0,busy=false;
 return {invalidate(){epoch++;},async run(record){
  if(busy)return false;busy=true;const version=epoch,target={id:record.id,code:record.code};
  try{
   if(!await ask(target)||epoch!==version)return false;
   const result=await remove(target);
   if(epoch!==version)return false;
   if(result?.deleted!==true||result.id!==target.id)throw Error('删除结果未确认，请刷新列表核实。');
   await onDeleted(target);return true;
  }catch(error){if(epoch===version)onError(error);return false;}finally{busy=false;}
 }};
}
