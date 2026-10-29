document.querySelectorAll('.menu-toggle').forEach(button=>button.addEventListener('click',()=>{
  const expanded=button.getAttribute('aria-expanded')==='true';
  button.setAttribute('aria-expanded',String(!expanded));
  document.getElementById(button.getAttribute('aria-controls')).hidden=expanded;
}));
document.querySelectorAll('#site-menu a').forEach(a=>a.addEventListener('click',()=>{
  document.getElementById('site-menu').hidden=true;
  document.querySelector('.menu-toggle').setAttribute('aria-expanded','false');
}));
document.querySelectorAll('.motion-toggle').forEach(b=>b.addEventListener('click',()=>{
  const stopped=document.body.classList.toggle('motion-stopped');
  document.querySelectorAll('.motion-toggle').forEach(control=>{
    control.setAttribute('aria-pressed',String(stopped));
    control.textContent=stopped?'動きを再開する':'動きを止める';
  });
  document.dispatchEvent(new CustomEvent('editorial-motion-change',{detail:{paused:stopped}}));
}));
