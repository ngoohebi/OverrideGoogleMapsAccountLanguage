import { languageEntries, languageName } from './languages.js';
import { isMapsUrl, normalizeLang, withHl } from './rules.js';
import { getLang, setLang } from './settings.js';

const $ = (id) => document.getElementById(id);
const list = $('list');
const search = $('search');
const status = $('status');

const OFF = { code: '', english: 'Use my Google Account language', native: 'Off' };
const entries = languageEntries();
let current = '';
let focusIndex = 0;

function renderStatus() {
  status.replaceChildren('Google Maps shows: ');
  const b = document.createElement('strong');
  b.textContent = current ? languageName(current) : 'your Google Account language';
  status.append(b);
}

function matches(e, q) {
  if (!q) return true;
  return [e.code, e.english, e.native].some((s) => s.toLowerCase().includes(q));
}

const findEntry = (code) => entries.find((e) => e.code.toLowerCase() === code.toLowerCase());

function visibleItems() {
  const raw = search.value.trim();
  const q = raw.toLowerCase();
  const all = [OFF, ...entries];
  // Keep a saved custom code (not in the Maps list) visible and selectable.
  if (current && !findEntry(current)) {
    all.splice(1, 0, { code: current, native: current, english: 'Custom code' });
  }
  const items = all.filter((e) => matches(e, q));
  // Typing any other valid code offers it as a row, chosen like any language.
  const code = normalizeLang(raw);
  if (code && !findEntry(code) && code.toLowerCase() !== current.toLowerCase()) {
    items.push({ code, native: `Use code “${code}”`, english: 'Custom code', custom: true });
  }
  return items;
}

function renderList() {
  const items = visibleItems();
  focusIndex = Math.min(focusIndex, Math.max(items.length - 1, 0));
  list.replaceChildren(
    ...items.map((e, i) => {
      const li = document.createElement('li');
      li.role = 'option';
      li.dataset.code = e.code;
      li.setAttribute('aria-selected', String(e.code.toLowerCase() === current.toLowerCase()));
      if (!e.code) li.classList.add('off');
      if (e.custom) li.classList.add('custom-row');
      if (i === focusIndex && search.value) li.classList.add('focus');
      const native = document.createElement('span');
      native.className = 'native';
      native.textContent = e.native;
      const english = document.createElement('span');
      english.className = 'english';
      english.textContent = e.english === e.native ? '' : e.english;
      const code = document.createElement('span');
      code.className = 'code';
      code.textContent = e.code;
      li.append(native, english, code);
      li.addEventListener('click', () => choose(e.code));
      return li;
    }),
  );
}

async function choose(code) {
  current = await setLang(code);
  search.value = '';
  focusIndex = 0;
  renderStatus();
  renderList();
  // Reload the active Maps tab so the change is visible immediately.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null && tab.url && isMapsUrl(tab.url)) {
    await chrome.tabs.update(tab.id, { url: withHl(tab.url, current) });
  }
}

search.addEventListener('input', () => {
  focusIndex = 0;
  renderList();
});

search.addEventListener('keydown', (ev) => {
  const items = visibleItems();
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    const step = ev.key === 'ArrowDown' ? 1 : -1;
    focusIndex = (focusIndex + step + items.length) % items.length;
    renderList();
    list.querySelector('.focus')?.scrollIntoView({ block: 'nearest' });
  } else if (ev.key === 'Enter' && items[focusIndex]) {
    ev.preventDefault();
    choose(items[focusIndex].code);
  }
});

current = await getLang();
renderStatus();
renderList();
list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
search.focus();
