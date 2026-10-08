import { esc, icon } from './site.mjs';
import { locales, downloadPath } from './locales.mjs';
import { cliCopy } from './cli-copy.mjs';

export function renderCli(lang, compact = false) {
  const t = cliCopy[lang];
  const methods = [
    ['curl', 'curl -fsSL https://kissopen.com/install | bash'],
    ['npm', 'npm install -g @kissopen/kissopen-terminal'],
    ['pnpm', 'pnpm add -g @kissopen/kissopen-terminal'],
    ['bun', 'bun add --global @kissopen/kissopen-terminal'],
    ['brew', 'brew tap kissopen/cli https://github.com/kissopen/kissopen\nbrew install kissopen/cli/kissopen'],
    ...['paru','yay'].map(helper=>[helper, `build_dir=$(mktemp -d) &&\ncurl -fsSL https://kissopen.com/install/PKGBUILD -o "$build_dir/PKGBUILD" &&\n${helper} -Bi "$build_dir"`])
  ];
  const notes = {curl:t.curlNote,brew:t.brewNote,paru:t.archNote,yay:t.archNote};
  const copyIcon = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>';
  const command = (id, text) => `<div class="cli-command"><code id="${id}">${esc(text)}</code><button type="button" class="cli-copy" data-copy-command="${id}" aria-label="${esc(t.copy)}" title="${esc(t.copy)}" hidden>${copyIcon}</button></div>`;
  const commands = [['--help',t.help],['--version',t.version],['resume --last',t.resume],['daemon status',t.status],['upgrade',t.upgrade]];
  return `<section class="cli-install${compact ? ' cli-home' : ''}" id="cli" aria-label="${t.title}">
${compact ? '' : `<div class="cli-heading"><div><p class="eyebrow"><span></span>KISSOPEN / CLI</p><h2 id="cli-title">${t.title}</h2><p>${t.description}</p></div><a class="underlink" href="https://www.npmjs.com/package/@kissopen/kissopen-terminal" target="_blank" rel="noopener noreferrer">${t.npm}${icon('arrow')}</a></div>`}
<div class="cli-terminal"><div class="cli-tabs" role="tablist" aria-label="${t.methods}">${methods.map(([name],index)=>`<button type="button" role="tab" id="cli-tab-${name}" aria-controls="cli-panel-${name}" aria-selected="${index===0}" tabindex="${index===0?'0':'-1'}">${name}</button>`).join('')}</div>
${methods.map(([name,text],index)=>`<div role="tabpanel" id="cli-panel-${name}" aria-labelledby="cli-tab-${name}" tabindex="0"${index?' hidden':''}>${command('cli-command-'+name,text)}${!compact && notes[name]?`<p class="cli-method-note">${notes[name]}</p>`:''}</div>`).join('')}</div>
${compact ? `<div class="cli-home-footer"><span>${t.launch} <code>kissopen</code></span><a href="${downloadPath(locales.find(locale => locale.id === lang))}#cli">Node.js 24+ · ${t.commands}${icon('arrow')}</a></div><p class="cli-feedback" role="status" aria-live="polite"></p>` : `<p class="cli-requirements">${t.requirements}</p><p class="cli-platforms">${t.platforms}</p>
<div class="cli-launch"><p>${t.launch}</p>${command('cli-command-launch','kissopen')}</div>
<p class="cli-feedback" role="status" aria-live="polite"></p>
<details class="cli-reference"><summary>${t.commands}</summary><dl>${commands.map(([args,label])=>`<div><dt><code>kissopen ${args}</code></dt><dd>${label}</dd></div>`).join('')}</dl></details>`}
</section>`;
}
