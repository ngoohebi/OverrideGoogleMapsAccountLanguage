import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALLOW_RULE_ID, REDIRECT_RULE_ID, buildRules, isMapsUrl, normalizeLang, withHl } from '../extension/rules.js';
import { MAPS_LANGUAGES, languageEntries, languageName } from '../extension/languages.js';

const ruleRe = (lang, id) => new RegExp(buildRules(lang).find((r) => r.id === id).condition.regexFilter, 'i');

test('normalizeLang accepts language codes and rejects junk', () => {
  for (const c of ['ja', 'zh-TW', 'es-419', 'sr-Latn', 'fil']) assert.equal(normalizeLang(c), c);
  for (const c of ['', null, undefined, 'j', 'ja_JP', 'ja&x=1', 'zh-TW#', 'abcd']) assert.equal(normalizeLang(c), '');
  assert.equal(normalizeLang('  ko '), 'ko');
});

test('buildRules: off gives no rules', () => {
  assert.deepEqual(buildRules(''), []);
  assert.deepEqual(buildRules('not a code!'), []);
});

test('buildRules: redirect adds/replaces hl on main frames only', () => {
  const rules = buildRules('ja');
  assert.equal(rules.length, 2);
  const redirect = rules.find((r) => r.id === REDIRECT_RULE_ID);
  assert.deepEqual(redirect.action.redirect.transform.queryTransform.addOrReplaceParams, [{ key: 'hl', value: 'ja' }]);
  for (const r of rules) assert.deepEqual(r.condition.resourceTypes, ['main_frame']);
  assert.ok(rules.find((r) => r.id === ALLOW_RULE_ID).priority > redirect.priority);
});

test('redirect regex matches Maps URLs only', () => {
  const re = ruleRe('ja', REDIRECT_RULE_ID);
  for (const u of [
    'https://www.google.com/maps',
    'https://www.google.com/maps/@25.03,121.56,14z',
    'https://www.google.com/maps?q=taipei',
    'https://www.google.com.tw/maps/place/Taipei+101',
    'https://google.co.jp/maps/',
    'https://maps.google.com/',
    'https://maps.google.co.uk/maps?q=x',
  ]) assert.ok(re.test(u), u);
  for (const u of [
    'https://www.google.com/',
    'https://www.google.com/search?q=maps',
    'https://www.google.com/mapsfoo',
    'https://mail.google.com/maps',
    'https://example.com/maps',
    'https://www.google.com/url?q=https://www.google.com/maps',
  ]) assert.ok(!re.test(u), u);
});

test('allow regex matches only when hl already equals the chosen code', () => {
  const re = ruleRe('zh-TW', ALLOW_RULE_ID);
  assert.ok(re.test('https://www.google.com/maps?hl=zh-TW'));
  assert.ok(re.test('https://www.google.com/maps/@1,2,3z?entry=ttu&hl=zh-TW'));
  assert.ok(re.test('https://www.google.com/maps/@1,2,3z?hl=zh-TW&entry=ttu'));
  assert.ok(!re.test('https://www.google.com/maps?hl=zh-TWX'));
  assert.ok(!re.test('https://www.google.com/maps?hl=zh'));
  assert.ok(!re.test('https://www.google.com/maps?xhl=zh-TW'));
  assert.ok(!re.test('https://www.google.com/maps'));
  assert.ok(!re.test('https://www.google.com/search?hl=zh-TW'));
});

test('isMapsUrl', () => {
  assert.ok(isMapsUrl('https://www.google.com/maps/@25,121,14z'));
  assert.ok(isMapsUrl('https://www.google.co.jp/maps'));
  assert.ok(isMapsUrl('https://maps.google.com/?q=x'));
  assert.ok(!isMapsUrl('https://www.google.com/search?q=x'));
  assert.ok(!isMapsUrl('https://www.google.com/mapsfoo'));
  assert.ok(!isMapsUrl('chrome://extensions'));
  assert.ok(!isMapsUrl('not a url'));
});

test('withHl adds, replaces and removes hl, keeping the rest', () => {
  assert.equal(withHl('https://www.google.com/maps/@1,2,3z', 'ja'), 'https://www.google.com/maps/@1,2,3z?hl=ja');
  assert.equal(
    withHl('https://www.google.com/maps/place/X/@1,2,3z/data=!3m1?entry=ttu&hl=en#frag', 'fr'),
    'https://www.google.com/maps/place/X/@1,2,3z/data=!3m1?entry=ttu&hl=fr#frag',
  );
  assert.equal(withHl('https://www.google.com/maps?hl=en&q=a', ''), 'https://www.google.com/maps?q=a');
});

test('language list is valid and complete', () => {
  assert.equal(new Set(MAPS_LANGUAGES).size, MAPS_LANGUAGES.length);
  for (const c of MAPS_LANGUAGES) assert.equal(normalizeLang(c), c);
  const entries = languageEntries();
  assert.equal(entries.length, MAPS_LANGUAGES.length);
  assert.equal(entries.find((e) => e.code === 'ja').native, '日本語');
  assert.equal(entries.find((e) => e.code === 'iw').english, 'Hebrew');
});

test('manifest is sane', () => {
  const m = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
  assert.equal(m.manifest_version, 3);
  assert.match(m.version, /^\d+(\.\d+){0,3}$/);
  assert.deepEqual(m.permissions.sort(), ['declarativeNetRequest', 'storage']);
  assert.ok(m.host_permissions.includes('*://*.google.com/*'));
  assert.ok(m.host_permissions.every((p) => /^\*:\/\/\*\.google\.[a-z.]+\/\*$/.test(p)), 'only Google hosts');
});

test('languageName is readable for normal people', () => {
  assert.equal(languageName('ja'), 'Japanese · 日本語');
  assert.equal(languageName('zh-TW'), 'Chinese (Taiwan) · 中文（台灣）');
  assert.equal(languageName('en'), 'English');
  assert.equal(languageName('iw'), 'Hebrew · עברית');
  assert.equal(languageName('qqq'), 'qqq');
});
