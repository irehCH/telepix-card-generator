// 관리자 화면
import { layoutBack, toSvg, buildPdf, mergeForPrint, loadFonts, normalizeFields, THEMES, TYPES } from './card.js';
import { createCardForm, prepareStoredImage } from './form.js';
import { call, session, DEMO, base64ToBytes, bytesToBase64 } from './api.js';
import { ask, busy } from './ui.js';

const $ = id => document.getElementById(id);
let items = [], fonts = null, template = null, editForm = null, editing = null;
const preparedImages = new Map(); // 신청 ID → 미리보기용 이미지
// 체크를 직접 바꾼 신청 ID → 선택 여부. 바꾸지 않은 신청은 대기(pending)면 선택, 완료(done)면 해제
// (새로 들어온 신청도 선택된 채로 보이고, 완료한 신청은 다음 합치기에 다시 들어가지 않게)
const picked = new Map();
const PICKUPS = [['서울캠퍼스', 'seoul'], ['대전캠퍼스', 'daejeon']];

function show(view) {
  for (const v of ['vLogin', 'vList', 'vLoading']) $(v).classList.toggle('hidden', v !== view);
  document.body.classList.toggle('centered', view !== 'vList'); // 비밀번호 화면은 화면 가운데
}
function msg(el, text, kind = 'info') { el.className = `msg ${kind}`; el.textContent = text || ''; }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = d => d ? new Date(d).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '';
const typeOf = i => (THEMES[i.type] ? i.type : 'basic');
const svgIcon = d => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="${d}"/></svg>`;
const EDIT = svgIcon('M4 20h4L19 9l-4-4L4 16v4M13.5 6.5l4 4');
const DOWNLOAD = svgIcon('M12 4v11M7 10l5 5 5-5M5 20h14');
const REVERT = svgIcon('M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5');
const TRASH = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

function thumb(i) {
  if (!fonts || !i.fields) return '<div class="thumb"></div>';
  try {
    const lay = layoutBack({ ...i.fields, type: typeOf(i) }, fonts, { image: preparedImages.get(i.id) });
    return `<div class="thumb">${toSvg(lay, { foil: true })}</div>`;
  } catch { return '<div class="thumb"></div>'; }
}

function details(i) {
  const f = normalizeFields(i.fields || {});
  return [`${f.posKr || ''} · ${f.deptKr || ''}`, `${f.posEn || ''} · ${f.deptEn || ''}`, `${f.phone || ''} · ${f.email || ''}`, i.image ? `이미지: ${i.image.mode === 'color' ? '원본 색' : '단색'}` : '']
    .filter(s => s.replace(/[ ·]/g, '')).map(esc).join('<br>');
}

function visible() {
  const pickup = $('pickupFilter').value, type = $('typeFilter').value;
  return items.filter(i => (!pickup || i.pickup === pickup) && (!type || typeOf(i) === type));
}

const isDone = i => i.status === 'done';
const isPicked = i => (picked.has(i.id) ? picked.get(i.id) : !isDone(i));
const selected = () => visible().filter(isPicked);

const LOADING_ROW = '<tr><td colspan="8"><div class="row hint"><div class="spinner small" aria-hidden="true"></div> 목록을 불러오는 중… (몇 초 걸릴 수 있습니다)</div></td></tr>';

function draw() {
  // 목록을 아직 한 번도 못 받았으면 '불러오는 중'을 유지한다 (폰트가 먼저 와서 빈 목록을 그리지 않게).
  if (!loadedOnce) {
    const failed = loadFailed && !loading;
    $('rows').innerHTML = failed ? '<tr><td colspan="8" class="hint">목록을 불러오지 못했습니다. 새로고침을 눌러 주세요.</td></tr>' : LOADING_ROW;
    $('count').textContent = failed ? '' : '목록을 불러오는 중…';
    return;
  }
  const rows = visible();
  $('rows').innerHTML = rows.map(i => `
    <tr${isDone(i) ? ' class="done"' : ''}>
      <td class="sel"><input type="checkbox" data-sel="${esc(i.id)}" ${isPicked(i) ? 'checked' : ''} aria-label="${esc(i.krName)} 선택"></td>
      <td>${thumb(i)}</td>
      <td>${isDone(i) ? '<span class="tag">주문 완료</span> ' : ''}<b>${esc(i.krName)}</b> <span class="hint">${esc(i.enName)}</span><br><span class="hint">${esc(i.email)}</span><div class="detail">${details(i)}</div></td>
      <td>${esc(THEMES[typeOf(i)].label)}</td>
      <td class="hint">${esc(fmt(i.createdAt))}${i.updatedAt ? `<br>수정 ${esc(fmt(i.updatedAt))}` : ''}${isDone(i) && i.doneAt ? `<br>주문 완료 ${esc(fmt(i.doneAt))}` : ''}</td>
      <td>${esc(i.pickup || '')}</td>
      <td>${esc(i.memo)}${i.adminMemo ? `<div class="detail">관리자: ${esc(i.adminMemo)}</div>` : ''}${i.warnings ? `<div class="w">${esc(i.warnings)}</div>` : ''}</td>
      <td class="manage"><div class="row" style="flex-wrap:nowrap;gap:6px">
        ${isDone(i) ? `<button class="icon revert" data-revert="${esc(i.id)}" data-tip="대기로 되돌리기" aria-label="${esc(i.krName)} 주문 대기로 되돌리기">${REVERT}</button>`
          : `<button class="icon" data-edit="${esc(i.id)}" title="수정" aria-label="${esc(i.krName)} 신청 수정">${EDIT}</button>`}
        ${i.hasFile ? `<button class="icon" data-open="${esc(i.id)}" title="PDF 내려받기" aria-label="${esc(i.krName)} PDF 내려받기">${DOWNLOAD}</button>`
          : `<button class="icon" disabled title="드라이브 individual 폴더에 이 신청의 PDF가 없습니다 (지워졌거나 옮겨짐)" aria-label="PDF 없음">${DOWNLOAD}</button>`}
        <button class="icon danger" data-del="${esc(i.id)}" title="이 신청 삭제" aria-label="${esc(i.krName)} 신청 삭제">${TRASH}</button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="8" class="hint">항목이 없습니다.</td></tr>';
  const hidden = items.length - rows.length, done = items.filter(isDone).length;
  $('count').textContent = (loading ? '다시 불러오는 중… · ' : '') + `전체 ${items.length}건${done ? ` (완료 ${done}건)` : ''}${hidden ? ` 중 ${rows.length}건 표시 (필터로 ${hidden}건 숨김)` : ''}`;
  syncSelection();
}

// 머리글 체크박스와 툴바 버튼 글자를 지금 선택에 맞춘다.
// 주문 완료하기는 체크된 것 중 대기인 것만 센다. 할 것이 없으면 주문 완료하기·신청 삭제는 비활성
function syncSelection() {
  const rows = visible(), sel = selected(), n = sel.length, todo = sel.filter(i => !isDone(i)).length;
  $('selAll').checked = rows.length > 0 && n === rows.length;
  $('selAll').indeterminate = n > 0 && n < rows.length;
  $('merge').textContent = `PDF 합치기 (${n}건)`;
  $('markDone').textContent = `주문 완료하기 (${todo}건)`;
  $('markDone').disabled = !todo;
  $('delSel').textContent = `신청 삭제 (${n}건)`;
  $('delSel').disabled = !n;
}

// 목록 불러오기. 서버 응답이 몇 초 걸릴 수 있어 그동안 '불러오는 중'을 보여 준다.
// 새로고침은 언제든 누를 수 있고, 이미 불러오는 중이면 그 결과를 기다린다 (요청을 겹쳐 보내지 않음).
let loading = null, loadedOnce = false, loadFailed = false;
function refresh() {
  if (!loading) loading = load().finally(() => { loading = null; draw(); });
  draw();
  return loading;
}
async function load() {
  msg($('listMsg'), '');
  loadFailed = false;
  try {
    items = (await call('list')).items;
    loadedOnce = true;
    draw();
    // 첨부 이미지는 비동기로 풀어서 미리보기에 다시 반영
    const pending = items.filter(i => i.image && !preparedImages.has(i.id));
    await Promise.all(pending.map(async i => { try { preparedImages.set(i.id, await prepareStoredImage(i.image)); } catch { /* 깨진 이미지는 무시 */ } }));
    if (pending.length) draw();
  } catch (err) { loadFailed = true; handleErr(err); }
}

function handleErr(err) {
  if (!session.get()) { show('vLogin'); msg($('loginMsg'), '다시 로그인하세요.', 'err'); return; }
  msg($('listMsg'), err.message, 'err');
}

async function fetchPdf(id) { return base64ToBytes((await call('getPdf', { id })).base64); }

function download(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function deleteRows(params, label) {
  await busy(`${label} 삭제하는 중…`, async () => {
    try {
      const r = await call('deleteRows', params);
      await refresh();
      msg($('listMsg'), `${r.deleted}건을 지웠습니다. individual 폴더의 PDF ${r.filesTrashed}개는 드라이브 휴지통으로 옮겼습니다 (30일 안에 복구 가능).`, 'ok');
    } catch (err) { handleErr(err); }
  });
}

// ---------- 수정 화면 ----------

function renderEdit() {
  if (!editForm || !fonts) return;
  const lay = layoutBack(editForm.read().fields, fonts, { image: editForm.preparedImage() });
  $('editBack').innerHTML = toSvg(lay, { foil: true }) + '<div class="trim"></div>';
  $('editWarn').textContent = lay.warnings.join('\n');
}

async function openEdit(id) {
  const i = items.find(x => x.id === id);
  if (!i) return;
  if (!fonts) { msg($('listMsg'), '폰트를 불러오는 중입니다. 잠시 후 다시 눌러 주세요.', 'warn'); return; }
  editing = i;
  $('editTitle').textContent = `${i.krName} 신청 수정`;
  $('editMeta').textContent = `신청 ${fmt(i.createdAt)} · ${i.email}${i.memo ? ` · 신청자 메모: ${i.memo}` : ''}`;
  $('adminMemo').value = i.adminMemo || '';
  msg($('editMsg'), '');
  $('editModal').classList.remove('hidden');
  await editForm.fill({ fields: { ...(i.fields || {}), type: typeOf(i) }, pickup: i.pickup, image: i.image });
  renderEdit();
}
function closeEdit() { $('editModal').classList.add('hidden'); editing = null; }

let saving = false;
$('fEdit').addEventListener('submit', async e => {
  e.preventDefault();
  if (saving) return;
  const bad = editForm.validate();
  if (bad.length) { msg($('editMsg'), `확인이 필요한 항목: ${bad.join(', ')}`, 'err'); return; }
  saving = true;
  try {
    await busy('PDF를 다시 만들어 저장하는 중…', async () => {
      try {
        if (!template) template = await fetch('assets/template.pdf').then(r => r.arrayBuffer());
        const { fields, pickup, image } = editForm.read();
        const lay = layoutBack(fields, fonts, { image: editForm.preparedImage() });
        const pdf = await buildPdf(PDFLib, template, lay, { title: `TELEPIX 명함 ${fields.krName}` });
        await call('adminUpdate', { id: editing.id, fields, type: fields.type, pickup, image, adminMemo: $('adminMemo').value.trim(), warnings: lay.warnings, pdf: bytesToBase64(pdf) });
        preparedImages.delete(editing.id);
        closeEdit();
        await refresh();
        msg($('listMsg'), '저장했습니다. individual 폴더의 PDF도 새로 만들었습니다.', 'ok');
      } catch (err) { msg($('editMsg'), err.message, 'err'); }
    });
  } finally { saving = false; }
});
$('editClose').addEventListener('click', closeEdit);
$('editCancel').addEventListener('click', closeEdit);
$('editModal').addEventListener('click', e => { if (e.target === $('editModal')) closeEdit(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && editing) closeEdit(); });

// ---------- 목록 이벤트 ----------

$('rows').addEventListener('click', async e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.edit) { openEdit(btn.dataset.edit); return; }
  if (btn.dataset.revert) { setStatus([btn.dataset.revert], 'pending'); return; }
  if (btn.dataset.del) {
    const i = items.find(x => x.id === btn.dataset.del);
    if (i && await ask(`${i.krName} (${THEMES[typeOf(i)].label} · ${i.pickup}) 신청을 지울까요?\n신청 기록과 individual 폴더의 PDF가 함께 지워집니다.`, { ok: '삭제', danger: true })) {
      deleteRows({ ids: [i.id] }, `${i.krName} 신청을`);
    }
    return;
  }
  const id = btn.dataset.open; if (!id) return;
  const i = items.find(x => x.id === id);
  btn.disabled = true;
  try {
    download(await fetchPdf(id), `${i ? `${i.krName}_${typeOf(i)}` : id}.pdf`);
  } catch (err) { handleErr(err); }
  btn.disabled = false;
});
$('rows').addEventListener('change', e => {
  const id = e.target.dataset && e.target.dataset.sel;
  if (!id) return;
  picked.set(id, e.target.checked);
  syncSelection();
});
// 체크박스 칸 아무 곳이나 눌러도 체크가 바뀐다 (체크박스 자체를 누르면 브라우저가 바꿈)
document.querySelector('#vList table').addEventListener('click', e => {
  const cell = e.target.closest('td.sel, th.sel');
  if (cell && e.target.tagName !== 'INPUT') cell.querySelector('input[type=checkbox]').click();
});
$('selAll').addEventListener('change', e => {
  for (const i of visible()) picked.set(i.id, e.target.checked);
  draw();
});
for (const id of ['pickupFilter', 'typeFilter']) $(id).addEventListener('change', draw);
$('refresh').addEventListener('click', refresh);

// ---------- 툴바 (체크된 신청에 하는 일) ----------

// 신청 삭제: 여러 건이면 실수 방지로 ‘선택삭제’를 입력하게 한다
$('delSel').addEventListener('click', async () => {
  const sel = selected();
  if (!sel.length) return msg($('listMsg'), '선택한 신청이 없습니다.', 'warn');
  const okd = sel.length === 1
    ? await ask(`${sel[0].krName} (${THEMES[typeOf(sel[0])].label} · ${sel[0].pickup}) 신청을 지울까요?\n신청 기록과 individual 폴더의 PDF가 함께 지워집니다.`, { ok: '삭제', danger: true })
    : await ask(`체크된 신청 ${sel.length}건을 지웁니다.\nindividual 폴더의 PDF도 함께 휴지통으로 갑니다.\n\n계속하려면 아래에 ‘선택삭제’라고 입력하세요.`, { ok: '신청 삭제', danger: true, input: '선택삭제' });
  if (okd) deleteRows({ ids: sel.map(i => i.id) }, `선택한 신청 ${sel.length}건을`);
});

// 진행 상태 바꾸기. 바꾼 신청은 직접 바꾼 체크를 잊어서, 주문 완료는 체크 해제·대기는 체크된 채로 보인다.
async function setStatus(ids, status) {
  const done = status === 'done';
  await busy(done ? '주문 완료로 바꾸는 중…' : '주문 대기로 되돌리는 중…', async () => {
    try {
      const r = await call('setStatus', { ids, status });
      for (const id of ids) picked.delete(id);
      await refresh();
      msg($('listMsg'), done ? `${r.changed}건을 주문 완료로 표시했습니다. 흐리게 보이고 체크가 풀리며, 30일 뒤 자동으로 지워집니다.` : `${r.changed}건을 주문 대기로 되돌렸습니다.`, 'ok');
    } catch (err) { handleErr(err); }
  });
}

// 주문 완료하기: 체크된 신청 중 대기인 것만 주문 완료(done)로
$('markDone').addEventListener('click', () => {
  const ids = selected().filter(i => !isDone(i)).map(i => i.id);
  if (ids.length) setStatus(ids, 'done');
});

// 선택 PDF 합치기: 지금 필터(타입·수령 장소)에 보이는 신청 중 체크된 것만 수령 장소 × 타입별로 합쳐 내려받는다.
// 드라이브에는 저장하지 않는다. 조합마다 한 파일씩.
let merging = false;
$('merge').addEventListener('click', async () => {
  if (merging) return;
  const all = selected().filter(i => i.hasFile);
  if (!all.length) return msg($('listMsg'), '선택한 신청 중 합칠 PDF가 없습니다.', 'warn');
  merging = true;
  try {
    await busy('PDF를 합치는 중…', async setText => {
      try {
        if (!template) template = await fetch('assets/template.pdf').then(r => r.arrayBuffer());
        const bleed = Number($('bleed').value) || 1;
        const d = new Date(), p2 = n => String(n).padStart(2, '0');
        const stamp = `${String(d.getFullYear()).slice(2)}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
        const done = [];
        for (const [pickup, region] of PICKUPS) {
          for (const type of TYPES) {
            const group = all.filter(i => i.pickup === pickup && typeOf(i) === type)
              .sort((a, b) => a.krName.localeCompare(b.krName, 'ko'));
            if (!group.length) continue;
            const label = `${pickup} · ${THEMES[type].label}`;
            const pdfs = [];
            for (const [n, i] of group.entries()) {
              setText(`${label} PDF 받는 중… ${n + 1}/${group.length}`);
              pdfs.push(await fetchPdf(i.id));
            }
            setText(`${label} 합치는 중…`);
            const merged = await mergeForPrint(PDFLib, template, type, pdfs, { bleed });
            const name = `${stamp}_${region}_${type}_${group.length}명${bleed === 2 ? '_bleed2mm' : ''}.pdf`;
            download(merged, name);
            done.push(`${label} ${group.length}명 → ${name}`);
          }
        }
        msg($('listMsg'), [`합친 PDF를 내려받았습니다 (재단 여백 ${bleed}mm, ${90 + 2 * bleed}×${50 + 2 * bleed}mm).`, ...done].join('\n'), 'ok');
      } catch (err) { handleErr(err); }
    });
  } finally { merging = false; }
});

$('fPass').addEventListener('submit', async e => {
  e.preventDefault();
  $('btnLogin').disabled = true;
  try {
    const r = await call('adminLogin', { password: $('password').value });
    session.set({ token: r.token, role: 'admin' });
    $('password').value = '';
    start();
  } catch (err) { msg($('loginMsg'), err.message, 'err'); }
  $('btnLogin').disabled = false;
});
$('logout').addEventListener('click', () => { session.clear(); location.reload(); });

async function start() {
  show('vList');
  await refresh();
}

(async () => {
  if (DEMO) $('demoBanner').classList.remove('hidden');
  editForm = createCardForm($('editFields'), { onChange: renderEdit });
  loadFonts(opentype, 'assets/fonts').then(f => { fonts = f; draw(); }).catch(() => {});
  const s = session.get();
  if (s && s.role === 'admin') start(); else show('vLogin');
})();
