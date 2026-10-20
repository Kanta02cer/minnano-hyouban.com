import {startProductionAnalytics} from './media-analytics-bootstrap.js';
const node=document.getElementById('media-analytics-config');
if(node?.type==='application/json'){
  try { startProductionAnalytics({config:JSON.parse(node.textContent)}); }
  catch { /* Fail closed: article content and navigation continue normally. */ }
}
