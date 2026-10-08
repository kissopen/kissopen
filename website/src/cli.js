const copy = JSON.parse(document.querySelector('#page-copy').textContent);
const platform = navigator.userAgentData?.platform || navigator.userAgent;
const device = /Windows|Win32/i.test(platform) ? 'windows' : null;
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
