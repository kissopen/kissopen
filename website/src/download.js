const copy = JSON.parse(document.querySelector('#page-copy').textContent);
const button = document.querySelector('.appearance-toggle');
const system = matchMedia('(prefers-color-scheme: light)');
let explicit = false;
try { explicit = ['light','dark'].includes(localStorage.getItem('kissopen-site-appearance')); } catch {}
function appearance(mode, save=false) {
  document.documentElement.dataset.appearance=mode;
  const label = mode==='light'?copy.darkMode:copy.lightMode;
  button.setAttribute('aria-label',label); button.title=label;
  document.querySelector('meta[name="theme-color"]').content=mode==='light'?'#f7f7fb':'#111215';
  if (save) { explicit=true; try {localStorage.setItem('kissopen-site-appearance',mode);} catch {} }
}
appearance(document.documentElement.dataset.appearance || (system.matches?'light':'dark'));
button.addEventListener('click',()=>appearance(document.documentElement.dataset.appearance==='light'?'dark':'light',true));
system.addEventListener('change',event=>{if(!explicit) appearance(event.matches?'light':'dark');});
document.querySelector('#site-language').addEventListener('change',event=>location.assign(event.currentTarget.value + location.hash));
const menu = document.querySelector('.menu-button');
const navigation = document.querySelector('#mobile-nav');
function closeMenu() { navigation.hidden=true; menu.setAttribute('aria-expanded','false'); }
menu.addEventListener('click',()=>{ const open=menu.getAttribute('aria-expanded')!=='true'; menu.setAttribute('aria-expanded',String(open)); navigation.hidden=!open; });
navigation.addEventListener('click',event=>{if(event.target.closest('a,button')) closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!navigation.hidden){closeMenu();menu.focus();}});
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
let motion = !reduce.matches;
try { const saved=localStorage.getItem('kissopen-site-motion'); if(saved!==null) motion=saved==='on'&&!reduce.matches; } catch {}
function setMotion(on,save=false) {
  motion=on;
  document.body.classList.toggle('motion-off',!on);
  document.querySelector('.motion-toggle').setAttribute('aria-pressed',String(on));
  document.querySelector('.motion-toggle span').textContent=on?copy.motionOn:copy.motionOff;
  if(save) {try {localStorage.setItem('kissopen-site-motion',on?'on':'off');}catch{}}
}
setMotion(motion);
document.querySelector('.motion-toggle').addEventListener('click',()=>setMotion(!motion,true));
reduce.addEventListener('change',event=>{if(event.matches) setMotion(false);});
const platform = navigator.userAgentData?.platform || navigator.userAgent;
const device = /Android/i.test(platform)?'android':/Windows|Win32/i.test(platform)?'windows':/Mac/i.test(platform)&&navigator.maxTouchPoints<=1?'macos':null;
if(device) document.querySelector(`[data-device="${device}"]`).hidden=false;

const installTabs = [...document.querySelectorAll('.cli-tabs [role="tab"]')];
const cliFeedback = document.querySelector('.cli-feedback');
function selectInstallTab(selected) {
  for (const tab of installTabs) {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  }
  cliFeedback.textContent = '';
}
if (device === 'windows') selectInstallTab(document.getElementById('cli-tab-npm'));
for (const tab of installTabs) {
  tab.addEventListener('click', () => selectInstallTab(tab));
  tab.addEventListener('keydown', event => {
    const index = installTabs.indexOf(tab);
    const next = event.key === 'ArrowRight' ? (index + 1) % installTabs.length
      : event.key === 'ArrowLeft' ? (index - 1 + installTabs.length) % installTabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? installTabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    selectInstallTab(installTabs[next]);
    installTabs[next].focus();
  });
}
for (const copyButton of document.querySelectorAll('[data-copy-command]')) {
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    const code = document.getElementById(copyButton.dataset.copyCommand);
    try {
      await navigator.clipboard.writeText(code.textContent);
      cliFeedback.textContent = copy.cliCopied;
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      cliFeedback.textContent = copy.cliCopyFailed;
    }
  });
}
