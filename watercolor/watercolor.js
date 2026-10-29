/* Open the full report when a story source or external fragment points into it. */
(()=>{const reveal=(hash)=>{if(!hash||hash==='#')return;let target;try{target=document.getElementById(decodeURIComponent(hash.slice(1)))}catch{return}if(!target)return;for(let p=target;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;return target};
document.addEventListener('click',event=>{const a=event.target.closest('a[href^="#"]');if(a)reveal(a.getAttribute('href'))});
window.addEventListener('hashchange',()=>reveal(location.hash));const target=reveal(location.hash);if(target)requestAnimationFrame(()=>target.scrollIntoView());})();
