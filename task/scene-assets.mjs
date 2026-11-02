import {SCENES} from './litter-scenes.mjs?v=20261102-rules1';
const optimized=scene=>new URL('./images/'+scene.id+'.webp',import.meta.url).href;
export function renderScenePhoto(scene,{interactive=false}={}){
 return `<picture><source type="image/webp" srcset="${optimized(scene)}"><img ${interactive?'id="photo" fetchpriority="high"':'loading="lazy"'} src="${scene.image}" alt="${scene.title}环境照片" decoding="async" draggable="false"></picture>`;
}
function loadImage(src,priority){return new Promise(resolve=>{const image=new Image();image.decoding='async';image.fetchPriority=priority;image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=src;});}
export function createScenePreloader({load=loadImage}={}){
 const pending=new Map();
 return {warm(index,priority='low'){
  if(!Number.isInteger(index)||!SCENES[index])return Promise.resolve(false);
  const src=optimized(SCENES[index]);
  if(!pending.has(src))pending.set(src,Promise.resolve().then(()=>load(src,priority)).then(ok=>{if(!ok)pending.delete(src);return !!ok;},()=>{pending.delete(src);return false;}));
  return pending.get(src);
 }};
}
