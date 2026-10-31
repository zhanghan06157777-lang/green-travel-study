import {mountParticipant} from './participant.mjs';
const root=document.querySelector('#activity');
if(root)mountParticipant(root,root.dataset.condition);
