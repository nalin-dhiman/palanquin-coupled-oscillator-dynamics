import {simulate} from './model.js';
self.onmessage=({data})=>{
 try {const run=simulate(data.config,progress=>self.postMessage({type:'progress',id:data.id,progress}));self.postMessage({type:'result',id:data.id,run});}
 catch(error){self.postMessage({type:'error',id:data.id,message:error.message});}
};
