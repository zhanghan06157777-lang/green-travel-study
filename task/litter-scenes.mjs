// Research reference regions only. Never render these boxes on participant pages.
const region=(id,x,y,w,h)=>({id,box:{x,y,w,h}});
export const SCENES=[
  {id:'scene-01',title:'沙滩',image:'/task/images/scene-01.jpg',regions:[region('01-a',.446,.695,.081,.044)]},
  {id:'scene-02',title:'海边水面',image:'/task/images/scene-02.jpg',regions:[region('02-a',.481,.333,.282,.196),region('02-b',.259,.434,.084,.043),region('02-c',.139,.589,.100,.073)]},
  {id:'scene-03',title:'海岸礁石',image:'/task/images/scene-03.jpg',regions:[region('03-a',.332,.461,.139,.077),region('03-b',.884,.487,.095,.151),region('03-c',.409,.814,.430,.144)]},
  {id:'scene-04',title:'湖面',image:'/task/images/scene-04.jpg',regions:[region('04-a',.441,.342,.173,.083)]},
  {id:'scene-05',title:'公园步道',image:'/task/images/scene-05.jpg',regions:[region('05-a',.394,.528,.233,.114),region('05-b',.283,.730,.073,.060),region('05-c',.105,.790,.075,.040),region('05-d',.804,.547,.125,.119)]},
  {id:'scene-06',title:'公园草坪',image:'/task/images/scene-06.jpg',regions:[region('06-a',.699,.544,.114,.031),region('06-b',.706,.622,.278,.083),region('06-c',.907,.607,.051,.031)]},
];
for(const scene of SCENES)scene.image=new URL('./images/'+scene.id+'.jpg',import.meta.url).href;
export const MATCH_RULE='reference_bbox_center_in_freehand_polygon_v1';
