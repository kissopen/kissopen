const t = JSON.parse(document.querySelector('#page-copy').textContent);
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const systemAppearance = matchMedia('(prefers-color-scheme: light)');
let explicitAppearance = false;
try { explicitAppearance = ['light','dark'].includes(localStorage.getItem('kissopen-site-appearance')); } catch {}
function updateAppearance(mode, persist=false) {
  document.documentElement.dataset.appearance = mode;
  const light = mode === 'light';
  const label = light ? t.darkMode : t.lightMode;
  $('.appearance-toggle').setAttribute('aria-label',label);
  $('.appearance-toggle').title=label;
  $('meta[name="theme-color"]').content=light?'#f7f7fb':'#111215';
  if(persist) { explicitAppearance=true; try {localStorage.setItem('kissopen-site-appearance',mode);} catch {} }
}
updateAppearance(document.documentElement.dataset.appearance || (systemAppearance.matches?'light':'dark'));
$('.appearance-toggle').addEventListener('click',() => updateAppearance(document.documentElement.dataset.appearance==='light'?'dark':'light',true));
systemAppearance.addEventListener('change',event => { if(!explicitAppearance) updateAppearance(event.matches?'light':'dark'); });
document.documentElement.classList.add('js');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
let motion = !reduce.matches;
try { const saved = localStorage.getItem('kissopen-site-motion'); if (saved !== null) motion = saved === 'on' && !reduce.matches; } catch {}
let playing = true, stage = 0, elapsed = 0, lastTime = 0, demoVisible = false, canvasVisible = false;
const durations = [4600, 6000, 5400, 4500];
const devices = $('.devices');
const canvas = $('#constellation');
const ctx = canvas.getContext('2d');
let cw = 0, ch = 0, pointer = {x:-1000,y:-1000}, frame = 0;
const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add('visible'); reveal.unobserve(entry.target); }
}), { threshold: .08 });
$$('.reveal').forEach(el => reveal.observe(el));
const visibility = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.target === canvas) canvasVisible = entry.isIntersecting;
    else demoVisible = entry.isIntersecting;
  }
  synchronize();
}, {threshold:0});
visibility.observe(canvas); visibility.observe(devices);

function setStage(value) {
  stage = value; elapsed = 0;
  devices.dataset.stage = stage;
  $('#stage-title').textContent = t.stageTitles[stage];
  $('#stage-description').textContent = t.stageDescriptions[stage];
  $$('.stage-controls button').forEach((el,i) => el.setAttribute('aria-pressed', String(i === stage)));
  $('.phone-response p').textContent = stage === 3 ? t.phoneDone : t.phoneReply;
  updateChecks();
  $('.stage-controls').style.setProperty('--progress','0');
}
function updateChecks() {
  $$('[data-check]').forEach((el,i) => el.classList.toggle('done',stage > 1 || (stage === 1 && elapsed > 650 + i * 1100)));
}
function synchronize() {
  const active = motion && playing && !document.hidden && demoVisible;
  document.body.classList.toggle('demo-paused',!active);
  $('.handoff-path').classList.toggle('paused',!active);
  const svg = $('.handoff-path');
  if (active) svg.unpauseAnimations?.(); else svg.pauseAnimations?.();
  const play = $('#play-pause');
  play.setAttribute('aria-label',playing && motion ? t.pause : t.play);
  play.innerHTML = playing && motion ? '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>' : '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 12 8-12 8Z"/></svg>';
  lastTime = 0;
  if (!frame && motion && !document.hidden && (canvasVisible || active)) frame = requestAnimationFrame(tick);
}
function setMotion(on, save = true) {
  motion = on;
  document.body.classList.toggle('motion-off', !on);
  $('.motion-toggle').setAttribute('aria-pressed', String(on));
  $('.motion-toggle span').textContent = on ? t.motionOn : t.motionOff;
  if (save) { try { localStorage.setItem('kissopen-site-motion',on ? 'on' : 'off'); } catch {} }
  if (!on) draw(0);
  synchronize();
}
$('.motion-toggle').addEventListener('click',() => setMotion(!motion));
reduce.addEventListener('change',() => setMotion(!reduce.matches));
$('#play-pause').addEventListener('click',() => { if (!motion) { playing=true; setMotion(true); } else { playing=!playing; synchronize(); } });
$('#replay').addEventListener('click',() => { setStage(0); playing=true; synchronize(); });
$$('[data-stage-button]').forEach(button => button.addEventListener('click',() => { setStage(Number(button.dataset.stageButton)); playing=false; synchronize(); }));
document.addEventListener('visibilitychange',synchronize);

function resize() {
  const box=canvas.getBoundingClientRect(); cw=box.width; ch=box.height;
  const dpr=Math.min(devicePixelRatio || 1,2);
  canvas.width=Math.round(cw*dpr); canvas.height=Math.round(ch*dpr);
  ctx?.setTransform(dpr,0,0,dpr,0,0); draw(0);
}
new ResizeObserver(resize).observe(canvas);
canvas.addEventListener('pointermove',event => { const r=canvas.getBoundingClientRect(); pointer={x:event.clientX-r.left,y:event.clientY-r.top}; });
canvas.addEventListener('pointerleave',() => { pointer={x:-1000,y:-1000}; });
function draw(now) {
  if (!ctx || !cw || !ch) return;
  ctx.clearRect(0,0,cw,ch);
  const size=Math.min(cw*.88,ch*.86), left=(cw-size)/2, top=(ch-size)/2;
  const spacing=size/29;
  for(let row=0;row<=29;row++) for(let col=0;col<=29;col++) {
    const x=col/29, y=row/29;
    const wedge=(x<.46 && x>.08 && Math.abs(y-.5)<(.46-x)*1.08) || (x>.54 && x<.92 && Math.abs(y-.5)<(x-.54)*1.08);
    const px=left+col*spacing, py=top+row*spacing;
    const wave=.5+.5*Math.sin(now*.0008+col*.21-row*.16);
    const distance=Math.hypot(pointer.x-px,pointer.y-py);
    const hover=Math.max(0,1-distance/100);
    const opacity=wedge ? .3+wave*.53+hover*.17 : .018+wave*.02;
    ctx.fillStyle=`rgba(171,150,228,${opacity})`;
    ctx.beginPath();ctx.arc(px,py,wedge ? 1.5+wave*.8+hover : .7,0,Math.PI*2);ctx.fill();
  }
}
function tick(now) {
  frame=0;
  if (!motion || document.hidden) return;
  const delta=lastTime ? Math.min(now-lastTime,80) : 0; lastTime=now;
  if (canvasVisible) draw(now);
  if (playing && demoVisible) {
    elapsed+=delta;
    if (elapsed>=durations[stage]) setStage((stage+1)%4);
    $('.stage-controls').style.setProperty('--progress',String(elapsed/durations[stage]));
    updateChecks();
  }
  if (canvasVisible || (playing && demoVisible)) frame=requestAnimationFrame(tick);
}
setMotion(motion,false);

const modelCount=() => { $('#model-count').textContent=t.selected.replace('{n}',String($$('input[name="models"]:checked').length)); };
$$('input[name="models"]').forEach(input => input.addEventListener('change',modelCount));
$('#select-models').addEventListener('click',() => { $$('input[name="models"]').forEach(input => { input.checked=true; }); modelCount(); });
const themeColors=['#9184d9','#46a994','#d2a572','#919198'];
let theme=0;
function setTheme(index) {
  theme=index;
  $('.theme-previews').style.setProperty('--theme',themeColors[index]);
  $('.mini-app.dark').style.background=['#222127','#152a28','#30251f','#151515'][index];
  $('.mini-app.light').style.background=['#f0edf6','#e4f1ee','#f4ede1','#eeeeef'][index];
  $$('[data-theme]').forEach((el,i) => el.setAttribute('aria-pressed',String(i === index)));
}
$$('[data-theme]').forEach(button => button.addEventListener('click',() => setTheme(Number(button.dataset.theme))));
$('#cycle-theme').addEventListener('click',() => setTheme((theme+1)%4));
$$('.switch').forEach(button => button.addEventListener('click',() => {
  button.setAttribute('aria-checked',String(button.getAttribute('aria-checked') !== 'true'));
  $('#plugin-count').textContent=t.pluginCount.replace('{n}',String($$('.switch[aria-checked="true"]').length));
}));
$$('[data-frequency]').forEach(button => button.addEventListener('click',() => {
  const index=Number(button.dataset.frequency);
  $$('[data-frequency]').forEach((el,i) => el.setAttribute('aria-pressed',String(i===index)));
  $('#schedule-time').textContent=t.times[index]; $('#next-run').textContent=t.nextRuns[index];
}));
$('#run-task').addEventListener('click',() => {
  const button=$('#run-task'); button.disabled=true;
  $('#run-result').textContent=t.running;
  setTimeout(() => { $('#run-result').textContent=`✓ ${t.ran}`; button.disabled=false; }, motion ? 1500 : 150);
});
const menu=$('.menu-button');
menu.addEventListener('click',() => { const open=menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded',String(open)); $('#mobile-nav').hidden=!open; });
$('#mobile-nav').addEventListener('click',event => { if(event.target.closest('a,button')) { $('#mobile-nav').hidden=true; menu.setAttribute('aria-expanded','false'); } });
document.addEventListener('keydown',event => { if(event.key==='Escape' && !$('#mobile-nav').hidden) { $('#mobile-nav').hidden=true; menu.setAttribute('aria-expanded','false'); menu.focus(); } });
$('#site-language').addEventListener('change',event => {
  // A locale is explicit, not inferred from browser settings. Keep the section
  // and shared appearance/motion preferences when switching the page language.
  location.assign(event.currentTarget.value + location.hash);
});
