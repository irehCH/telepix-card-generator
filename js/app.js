// 신청자 화면
import { layoutBack, toSvg, buildPdf, buildDigitalPdf, loadFonts, fieldsFromRecord, THEMES } from './card.js';
import { createCardForm } from './form.js';
import { call, session, DEMO, bytesToBase64 } from './api.js';
import { ask, busy } from './ui.js';

const $ = id => document.getElementById(id);
let fonts, template, lastLayout, form;
let assetsReady = Promise.resolve(); // 폰트·템플릿을 다 받으면 풀린다

function show(view) {
  for (const v of ['vLogin', 'vEdit', 'vLoading']) $(v).classList.toggle('hidden', v !== view);
}
function msg(el, text, kind = 'info') { el.className = `msg ${kind}`; el.textContent = text || ''; }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function currentLayout() {
  return layoutBack(form.read().fields, fonts, { image: form.preparedImage() });
}

function render() {
  if (!form) return;
  if (!fonts) {
    $('back').innerHTML = '<div class="row hint" style="height:100%;justify-content:center"><div class="spinner small" aria-hidden="true"></div> 미리보기를 불러오는 중…</div>';
    return;
  }
  lastLayout = currentLayout();
  const theme = THEMES[lastLayout.type];
  if (!$('frontImg').src.endsWith(theme.frontImage)) $('frontImg').src = theme.frontImage;
  $('backCap').textContent = '뒷면 · 빨간 점선이 재단선(90×50mm)입니다.' + (theme.foilPage != null ? ' 오른쪽 위 은색 로고는 은박 후가공 미리보기입니다.' : '');
  $('back').innerHTML = toSvg(lastLayout, { foil: true }) + '<div class="trim"></div>';
  $('warn').textContent = lastLayout.warnings.join('\n');
}

// 빠르게 타이핑해도 화면 갱신은 한 프레임에 한 번만
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  const flush = () => { if (renderQueued) { renderQueued = false; render(); } };
  requestAnimationFrame(flush);
  setTimeout(flush, 100); // 창이 가려져 프레임이 멈춰도 갱신되게
}

function renderMine(list) {
  if (!list || !list.length) { $('mine').textContent = '아직 없습니다.'; return; }
  $('mine').innerHTML = '<table><tr><th>신청일</th><th>타입</th><th>수령</th><th></th></tr>' +
    list.slice().reverse().map(s => `<tr><td>${esc(new Date(s.createdAt).toLocaleString('ko-KR'))}${s.adminMemo ? `<div class="detail">${esc(s.adminMemo)}</div>` : ''}</td><td>${esc((THEMES[s.type] || THEMES.basic).label)}</td><td>${esc(s.pickup || '')}</td>` +
      `<td><button type="button" class="danger" data-del="${esc(s.id)}">삭제</button></td></tr>`).join('') + '</table>';
}

let deleting = false;
$('mine').addEventListener('click', async e => {
  const id = e.target.dataset && e.target.dataset.del;
  if (!id || deleting) return;
  deleting = true;
  try {
    if (!(await ask('이 신청을 삭제할까요?\n만들어진 명함 PDF도 함께 지워집니다.', { ok: '삭제', danger: true }))) return;
    await busy('신청을 삭제하는 중…', async () => {
      try {
        const r = await call('deleteMine', { id });
        renderMine(r.submissions);
        const s = session.get(); if (s) session.set({ ...s, submissions: r.submissions });
        msg($('submitMsg'), '신청을 삭제했습니다.', 'ok');
      } catch (err) { msg($('submitMsg'), err.message, 'err'); }
    });
  } finally { deleting = false; }
});

function saveDraft() {
  const s = session.get();
  if (s) session.set({ ...s, draft: { ...form.read(), memo: $('memo').value } });
}

async function enterEditor(res) {
  $('who').textContent = res.email;
  const saved = session.get();
  const draft = saved && saved.draft;
  if (draft) {
    await form.fill(draft);
    $('memo').value = draft.memo || '';
  } else {
    await form.fill({ fields: res.profile ? fieldsFromRecord(res.profile) : { email: res.email } });
  }
  renderMine(res.submissions);
  show('vEdit');
  render();
  assetsReady.then(render).catch(err => msg($('submitMsg'), '폰트·템플릿을 불러오지 못했습니다. 새로고침해 주세요. (' + err.message + ')', 'err'));
}

function loggedIn(r) {
  session.set({ token: r.token, email: r.email, role: r.role, submissions: r.submissions });
  enterEditor(r);
}

// 내 신청 내역은 드라이브 기준이라, 다른 탭(드라이브 등)에 다녀오면 다시 확인한다.
let refreshingMine = false, lastMineCheck = 0;
async function refreshMine() {
  const s = session.get();
  if (!s || !s.token || refreshingMine || submitting || deleting || Date.now() - lastMineCheck < 5000) return;
  refreshingMine = true; lastMineCheck = Date.now();
  try {
    const r = await call('mine');
    renderMine(r.submissions);
  } catch { /* 조용히 넘어감: 다음에 다시 확인 */ }
  refreshingMine = false;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshMine(); });
window.addEventListener('focus', refreshMine);

async function makePdf() {
  await assetsReady;
  const layout = currentLayout();
  const { fields } = form.read();
  return { bytes: await buildPdf(PDFLib, template, layout, { title: `TELEPIX 명함 ${fields.krName}` }), layout };
}

function download(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------- 이벤트 ----------

$('fEmail').addEventListener('submit', async e => {
  e.preventDefault();
  $('btnSend').disabled = true;
  msg($('loginMsg'), '확인 중… 처음에는 5~10초 걸릴 수 있습니다.');
  try {
    const r = await call('requestCode', { email: $('email').value });
    if (r.token) { loggedIn(r); return; } // 인증코드를 쓰지 않는 설정이면 바로 로그인
    msg($('loginMsg'), r.demoHint || '등록된 이메일이면 인증코드를 보냈습니다. 메일이 안 보이면 스팸함도 확인하세요.', 'ok');
    $('fEmail').classList.add('hidden'); $('fCode').classList.remove('hidden'); $('code').focus();
  } catch (err) { msg($('loginMsg'), err.message, 'err'); }
  finally { $('btnSend').disabled = false; }
});

$('fCode').addEventListener('submit', async e => {
  e.preventDefault();
  $('btnVerify').disabled = true;
  try { loggedIn(await call('verify', { email: $('email').value, code: $('code').value.trim() })); }
  catch (err) { msg($('loginMsg'), err.message, 'err'); }
  $('btnVerify').disabled = false;
});

$('btnBack').addEventListener('click', () => {
  $('fCode').classList.add('hidden'); $('fEmail').classList.remove('hidden'); msg($('loginMsg'), '');
});

$('logout').addEventListener('click', () => { session.clear(); location.reload(); });


$('memo').addEventListener('input', saveDraft);

// SVG → PNG 바이트 (디지털 명함용). 가로 widthPx 픽셀, 세로는 SVG 비율대로.
async function rasterize(svg, widthPx) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = widthPx;
  c.height = Math.round(widthPx * img.naturalHeight / img.naturalWidth);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

// 디지털 명함: 화면·메신저용 PDF (앞·뒤 2쪽, 재단선 크기). 기본형은 은박을 뒷면에 은색으로 그려 넣는다.
let makingDigital = false;
$('btnDigital').addEventListener('click', async () => {
  if (makingDigital) return;
  makingDigital = true;
  try {
    await busy('디지털 명함을 만드는 중…', async () => {
      try {
        await assetsReady;
        const layout = currentLayout();
        const { fields } = form.read();
        const bytes = await buildDigitalPdf(PDFLib, template, layout, rasterize, { title: `TELEPIX 디지털 명함 ${fields.krName}` });
        download(bytes, `디지털명함_${fields.krName || '이름없음'}.pdf`);
      } catch (err) { msg($('submitMsg'), '디지털 명함을 만들지 못했습니다: ' + err.message, 'err'); }
    });
  } finally { makingDigital = false; }
});

// 신청은 한 번에 하나만. 버튼을 누른 순간부터 끝날 때까지 다시 눌러도(엔터 포함) 무시한다.
let submitting = false;
$('fCard').addEventListener('submit', async e => {
  e.preventDefault();
  if (submitting) return;
  submitting = true;
  $('btnSubmit').disabled = true;
  try {
    const bad = form.validate();
    if (bad.length) { msg($('submitMsg'), `확인이 필요한 항목: ${bad.join(', ')}`, 'err'); return; }
    if (lastLayout && lastLayout.warnings.some(w => w.includes('최소 크기') || w.includes('없는 글자'))) {
      if (!(await ask('경고가 있습니다. 그래도 신청할까요?\n\n' + lastLayout.warnings.join('\n')))) return;
    }
    const { fields, pickup, image } = form.read();
    const theme = THEMES[fields.type];
    if (!(await ask(`${theme.label}으로 신청합니다.\n업무시간 기준 최대 ${theme.leadDays}일 소요됩니다.`, { ok: '신청하기' }))) return;
    // 같은 요청이 두 번 도착해도 서버가 한 번만 저장하도록 하는 1회용 키
    const submitKey = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()).toString();
    await busy('명함 PDF를 만드는 중…', async setText => {
      try {
        const { bytes, layout } = await makePdf();
        setText('신청을 저장하는 중…');
        const r = await call('submit', { submitKey, fields, type: fields.type, pickup, image, warnings: layout.warnings, memo: $('memo').value.trim(), pdf: bytesToBase64(bytes) });
        msg($('submitMsg'), `신청이 접수되었습니다 (${theme.label}, 업무시간 기준 최대 ${theme.leadDays}일).${r.replaced ? ' 같은 내용의 이전 신청은 새 신청으로 바꿨습니다.' : ''}`, 'ok');
        renderMine(r.submissions);
        const s = session.get(); if (s) session.set({ ...s, draft: null, submissions: r.submissions });
      } catch (err) {
        msg($('submitMsg'), err.message, 'err');
      }
    });
  } finally {
    submitting = false;
    $('btnSubmit').disabled = false;
  }
});

// ---------- 시작 ----------

(async () => {
  if (DEMO) $('demoBanner').classList.remove('hidden');
  $('fCard').noValidate = true;
  form = createCardForm($('cardFields'), { onChange: () => { scheduleRender(); saveDraft(); }, lockPersonal: true });
  // 폰트(약 6MB)는 이메일을 입력하는 동안 뒤에서 받는다. 화면은 바로 보여 준다.
  assetsReady = Promise.all([
    loadFonts(opentype, 'assets/fonts'),
    fetch('assets/template.pdf').then(r => r.arrayBuffer()),
  ]).then(([f, t]) => { fonts = f; template = t; });
  assetsReady.catch(() => {}); // 실패는 신청 화면에 들어갈 때 알린다
  show('vLogin'); // 들어올 때마다 이메일부터 (로그인을 기억하지 않음)
})();
