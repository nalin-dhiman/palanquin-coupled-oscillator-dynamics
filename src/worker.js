import {simulate,isWalking} from './simulation.js';
import {Session} from './walking.js';
let session=null,activeId=null;
self.onmessage=({data})=>{
 try {
  if(data.type==='advance'){
   if(data.id!==activeId||!session)return;
   const samples=session.advanceTo(data.target);
   self.postMessage({type:'chunk',id:data.id,samples,stats:session.stats,complete:session.index===session.total,simulatedUntil:session.samples.at(-1).t});return;
  }
  activeId=data.id;session=null;
  if(data.live&&isWalking(data.config)){
   session=new Session(data.config);session.advanceTo(.2);self.postMessage({type:'live-start',id:data.id,run:session.result()});
  }else{const run=simulate(data.config,progress=>self.postMessage({type:'progress',id:data.id,progress}));self.postMessage({type:'result',id:data.id,run});}
 }
 catch(error){self.postMessage({type:'error',id:data.id,message:error.message});}
};
