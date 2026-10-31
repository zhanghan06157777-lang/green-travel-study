export function createStudyTransport({apiUrl,publishableKey,token,fetchImpl=fetch,signal}){
 const base=new URL(apiUrl);
 if(base.protocol!=='https:'||!publishableKey||!/^[a-f0-9]{64}$/.test(token))throw new Error('活动连接配置无效，请联系研究者。');
 return async function api(path,method='GET',data){
  const requestPath=new URL(path,'https://study.invalid');
  const url=new URL(base);
  const action=requestPath.pathname.endsWith('/claim')?'claim':method==='POST'?'create':method==='PUT'?'save':'load';
  url.searchParams.set('action',action);
  if(requestPath.searchParams.has('id'))url.searchParams.set('id',requestPath.searchParams.get('id'));
  let response;
  try{response=await fetchImpl(url.href,{method,mode:'cors',credentials:'omit',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000),headers:{'Content-Type':'application/json',apikey:publishableKey,'x-study-token':token},body:data?JSON.stringify(data):undefined});}
  catch(cause){if(signal?.aborted)throw cause;throw new Error('连接中断或超时，请重试保存。',{cause});}
  let result;try{result=await response.json();}catch{const error=new Error('服务器暂时无法响应，请重试。');error.status=response.status;throw error;}
  if(!response.ok){const error=new Error(typeof result.error==='string'?result.error:'连接失败，请重试。');error.status=response.status;throw error;}
  if(!result||typeof result!=='object')throw new Error('服务器响应无效，请重试。');
  return result;
 };
}
