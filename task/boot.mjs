import {mountParticipant} from './participant.mjs?v=20261102-rules1';
const root=document.querySelector('#activity');
if(root)mountParticipant(root,root.dataset.condition);
