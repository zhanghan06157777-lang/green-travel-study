import {mountParticipant} from './participant.mjs?v=20261101-admin-delete1';
const root=document.querySelector('#activity');
if(root)mountParticipant(root,root.dataset.condition);
