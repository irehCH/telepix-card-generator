// 서버(Apps Script) 호출. API_URL이 비어 있으면 브라우저 안의 가짜 서버(데모)를 쓴다.
import { API_URL } from './config.js';

// 주소 끝에 ?demo 를 붙이면 서버 대신 데모로 시험할 수 있다.
export const DEMO = !API_URL || new URLSearchParams(location.search).has('demo');

// 관리자 로그인은 탭을 닫을 때까지 기억한다.
// 신청 화면은 아무것도 기억하지 않는다 — 페이지에 들어올 때마다 이메일부터 새로 시작한다.
const IS_ADMIN_PAGE = /admin/.test(location.pathname);
const TOKEN_KEY = 'tpx-card-admin';
let memory = null;
export const session = IS_ADMIN_PAGE ? {
  get() { try { return JSON.parse(sessionStorage.getItem(TOKEN_KEY)); } catch { return null; } },
  set(v) { try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify(v)); } catch { /* 저장 불가해도 동작 */ } },
  clear() { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* */ } },
} : {
  get() { return memory; },
  set(v) { memory = v; },
  clear() { memory = null; },
};
// 예전 버전이 남긴 신청자 로그인 기록 지우기
try { sessionStorage.removeItem('tpx-card-token'); } catch { /* */ }

export async function call(action, params = {}) {
  const body = { action, ...params };
  const s = session.get();
  if (s && !body.token) body.token = s.token;
  const res = DEMO ? await demo(body) : await remote(body);
  if (!res.ok) {
    if (res.error === 'AUTH') {
      session.clear();
      throw new Error('로그인이 만료되었습니다. 다시 로그인하세요.');
    }
    throw new Error(res.message || '요청 실패');
  }
  return res;
}

async function remote(body) {
  // text/plain 으로 보내야 CORS 사전 요청 없이 Apps Script에 도달한다.
  const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' });
  if (!r.ok) return { ok: false, message: `서버 오류 (${r.status})` };
  return r.json();
}

export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBytes(b64) {
  const s = atob(b64); const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ---------------- 데모 서버 ----------------
// 실제 서버(apps-script/Code.gs)와 같은 응답 형태를 흉내 낸다. 데이터는 이 브라우저에만 남는다.

const DEMO_KEY = 'tpx-card-demo';
const DEMO_PASSWORD = 'demo'; // 실제 관리자 비밀번호와 다르게
const DEMO_PEOPLE = [
  { krName: '홍길동', enName: 'Gildong Hong', title: '선임연구원 | AI연구팀\nSenior Research Engineer | AI Research Team', email: 'gildong@demo.test', phone: '010-1234-5678', office: '서울' },
  { krName: '김하늘', enName: 'Haneul Kim', title: '매니저 | 경영지원팀\nManager | Management Support Team', email: 'haneul@demo.test', phone: '010-2345-6789', office: '대전' },
];
const mem = { subs: [], files: {} };
function load() { try { Object.assign(mem, JSON.parse(localStorage.getItem(DEMO_KEY)) || {}); } catch { /* */ } }
function save() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(mem)); } catch { /* 용량 초과 시 메모리에만 */ } }

function demoSignature(fields, type, pickup, image) {
  const f = {};
  Object.keys(fields || {}).filter(k => k !== 'type' && k !== 'showUrl').sort().forEach(k => { f[k] = String(fields[k]).trim(); });
  return JSON.stringify([f, type, pickup, image ? JSON.stringify({ mode: image.mode, invert: !!image.invert, data: image.data }) : '']);
}

async function demo(b) {
  load();
  await new Promise(r => setTimeout(r, 200));
  const who = b.token && JSON.parse(atob(b.token));
  const isAdmin = who && who.role === 'admin';
  const mine = email => mem.subs.filter(s => s.email === email).map(({ id, createdAt, pickup, type, adminMemo }) => ({ id, createdAt, pickup, type, adminMemo }));
  const AUTH = { ok: false, error: 'AUTH' };
  switch (b.action) {
    case 'requestCode': {
      // 실제 서버와 같게: 회사 도메인이면 코드 없이 통과
      const e = String(b.email || '').trim().toLowerCase();
      if (!e.endsWith('@demo.test')) return { ok: false, message: '@demo.test 이메일만 사용할 수 있습니다.' };
      return { ok: true, token: btoa(JSON.stringify({ email: e, role: 'user' })), role: 'user', email: e, profile: DEMO_PEOPLE.find(p => p.email === e) || null, submissions: mine(e) };
    }
    case 'adminLogin':
      if (b.password !== DEMO_PASSWORD) return { ok: false, message: '비밀번호가 맞지 않습니다.' };
      return { ok: true, token: btoa(JSON.stringify({ role: 'admin' })) };
    case 'mine': return who ? { ok: true, submissions: mine(who.email), profile: DEMO_PEOPLE.find(p => p.email === who.email) || null } : AUTH;
    case 'submit': {
      if (!who || who.role !== 'user') return AUTH;
      const dup = b.submitKey && mem.subs.find(s => s.submitKey === b.submitKey && s.email === who.email);
      if (dup) return { ok: true, id: dup.id, duplicate: true, submissions: mine(who.email) };
      // 메모만 빼고 내용이 같은 신청은 지우고 새 것으로 (실제 서버와 같은 규칙)
      const sig = demoSignature(b.fields, b.type || 'basic', b.pickup, b.image);
      const same = mem.subs.filter(s => demoSignature(s.fields, s.type, s.pickup, s.image) === sig);
      same.forEach(s => delete mem.files[s.id]);
      mem.subs = mem.subs.filter(s => !same.includes(s));
      const id = 'D' + Date.now().toString(36);
      mem.files[id] = b.pdf;
      mem.subs.push({ id, createdAt: new Date().toISOString(), email: who.email, krName: b.fields.krName, enName: `${b.fields.enFirst} ${b.fields.enLast}`.trim(), warnings: (b.warnings || []).join('\n'), memo: b.memo || '', pickup: b.pickup || '', type: b.type || 'basic', image: b.image || null, fields: b.fields, submitKey: b.submitKey || null });
      save();
      return { ok: true, id, replaced: same.length, submissions: mine(who.email) };
    }
    case 'deleteMine': {
      if (!who || who.role !== 'user') return AUTH;
      const s = mem.subs.find(x => x.id === b.id && x.email === who.email);
      if (!s) return { ok: false, message: '신청을 찾을 수 없습니다.' };
      delete mem.files[s.id];
      mem.subs = mem.subs.filter(x => x !== s);
      save();
      return { ok: true, submissions: mine(who.email) };
    }
    case 'list':
      if (!isAdmin) return AUTH;
      return { ok: true, items: mem.subs.map(s => ({ ...s, status: s.status === 'done' ? 'done' : 'pending', hasFile: !!mem.files[s.id] })).reverse() };
    case 'getPdf':
      if (!isAdmin) return AUTH;
      return mem.files[b.id] ? { ok: true, base64: mem.files[b.id] } : { ok: false, message: '파일이 없습니다.' };
    case 'adminUpdate': {
      if (!isAdmin) return AUTH;
      const s = mem.subs.find(x => x.id === b.id);
      if (!s) return { ok: false, message: '신청을 찾을 수 없습니다.' };
      Object.assign(s, { fields: b.fields, type: b.type, pickup: b.pickup, image: b.image || null, adminMemo: b.adminMemo || '', warnings: (b.warnings || []).join('\n'),
        krName: b.fields.krName, enName: `${b.fields.enFirst} ${b.fields.enLast}`.trim(), updatedAt: new Date().toISOString() });
      mem.files[b.id] = b.pdf;
      save();
      return { ok: true };
    }
    case 'deleteRows': {
      if (!isAdmin) return AUTH;
      const ids = b.all ? mem.subs.map(s => s.id) : b.ids;
      const filesTrashed = ids.filter(id => mem.files[id]).length;
      ids.forEach(id => delete mem.files[id]);
      const before = mem.subs.length;
      mem.subs = mem.subs.filter(s => !ids.includes(s.id));
      save();
      return { ok: true, deleted: before - mem.subs.length, filesTrashed };
    }
    case 'setStatus': {
      if (!isAdmin) return AUTH;
      const ids = b.ids || [];
      const hit = mem.subs.filter(s => ids.includes(s.id));
      hit.forEach(s => {
        if (b.status !== 'done') Object.assign(s, { status: 'pending', doneAt: '' });
        else if (s.status !== 'done') Object.assign(s, { status: 'done', doneAt: new Date().toISOString() });
      });
      save();
      return { ok: true, changed: hit.length };
    }
  }
  return { ok: false, message: '알 수 없는 요청' };
}
