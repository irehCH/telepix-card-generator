// 관리자 화면
import { layoutBack, toSvg, buildPdf, mergeForPrint, loadFonts, normalizeFields, THEMES, TYPES } from './card.js';
import { createCardForm, prepareStoredImage } from './form.js';
import { call, session, DEMO, base64ToBytes, bytesToBase64 } from './api.js';
import { ask, busy } from './ui.js';

const $ = id => document.getElementById(id);
let items = [], fonts = null, template = null, editForm = null, editing = null;
const preparedImages = new Map(); // 신청 ID → 미리보기용 이미지
const PICKUPS = [['서울캠퍼스', 'seoul'], ['대전캠퍼스', 'daejeon']];

function show(view) { for (const v of ['vLogin', 'vList', 'vLoading']) $(v).classList.toggle('hidden', v !== view); }
function msg(el, text, kind = 'info') { el.className = `msg ${kind}`; el.textContent = text || ''; }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = d => d ? new Date(d).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '';
const typeOf = i => (THEMES[i.type] ? i.type : 'basic');
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

const LOADING_ROW = '<tr><td colspan="7"><div class="row hint"><div class="spinner small" aria-hidden="true"></div> 목록을 불러오는 중… (몇 초 걸릴 수 있습니다)</div></td></tr>';

function draw() {
  // 목록을 아직 한 번도 못 받았으면 '불러오는 중'을 유지한다 (폰트가 먼저 와서 빈 목록을 그리지 않게).
  if (!loadedOnce) {
    const failed = loadFailed && !loading;
    $('rows').innerHTML = failed ? '<tr><td colspan="7" class="hint">목록을 불러오지 못했습니다. 새로고침을 눌러 주세요.</td></tr>' : LOADING_ROW;
    $('count').textContent = failed ? '' : '목록을 불러오는 중…';
    return;
  }
  const rows = visible();
  $('rows').innerHTML = rows.map(i => `
    <tr>
      <td>${thumb(i)}</td>
      <td><button class="link" data-edit="${esc(i.id)}"><b>${esc(i.krName)}</b></button> <span class="hint">${esc(i.enName)}</span><br><span class="hint">${esc(i.email)}</span><div class="detail">${details(i)}</div></td>
      <td>${esc(THEMES[typeOf(i)].label)}</td>
      <td class="hint">${esc(fmt(i.createdAt))}${i.updatedAt ? `<br>수정 ${esc(fmt(i.updatedAt))}` : ''}</td>
      <td>${esc(i.pickup || '')}</td>
      <td>${esc(i.memo)}${i.adminMemo ? `<div class="detail">관리자: ${esc(i.adminMemo)}</div>` : ''}${i.warnings ? `<div class="w">${esc(i.warnings)}</div>` : ''}</td>
      <td><div class="row" style="flex-wrap:nowrap;gap:6px">
        ${i.hasFile ? `<button data-open="${esc(i.id)}">PDF</button>` : '<span class="hint" title="드라이브 individual 폴더에 이 신청의 PDF가 없습니다 (지워졌거나 옮겨짐)">PDF 없음</span>'}
        <button class="icon danger" data-del="${esc(i.id)}" title="이 신청 삭제" aria-label="${esc(i.krName)} 신청 삭제">${TRASH}</button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="7" class="hint">항목이 없습니다.</td></tr>';
  const hidden = items.length - rows.length;
  $('count').textContent = (loading ? '다시 불러오는 중… · ' : '') + `전체 ${items.length}건${hidden ? ` 중 ${rows.length}건 표시 (필터로 ${hidden}건 숨김)` : ''}`;
  const scope = [$('pickupFilter').value, $('typeFilter').value && THEMES[$('typeFilter').value].label].filter(Boolean).join(' · ');
  $('merge').textContent = `PDF 합치기${scope ? ` (${scope})` : ' (전체)'}`;
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
  if (btn.dataset.del) {
    const i = items.find(x => x.id === btn.dataset.del);
    if (i && await ask(`${i.krName} (${THEMES[typeOf(i)].label} · ${i.pickup}) 신청을 지울까요?\n신청 기록과 individual 폴더의 PDF가 함께 지워집니다.`, { ok: '삭제', danger: true })) {
      deleteRows({ ids: [i.id] }, `${i.krName} 신청을`);
    }
    return;
  }
  const id = btn.dataset.open; if (!id) return;
  btn.disabled = true;
  try {
    const url = URL.createObjectURL(new Blob([await fetchPdf(id)], { type: 'application/pdf' }));
    window.open(url, '_blank');
  } catch (err) { handleErr(err); }
  btn.disabled = false;
});
for (const id of ['pickupFilter', 'typeFilter']) $(id).addEventListener('change', draw);
$('refresh').addEventListener('click', refresh);
$('delAll').addEventListener('click', async () => {
  if (!items.length) return msg($('listMsg'), '지울 항목이 없습니다.', 'warn');
  const okd = await ask(`필터와 관계없이 신청 ${items.length}건을 모두 지웁니다.\nindividual 폴더의 PDF도 모두 휴지통으로 갑니다.\n\n계속하려면 아래에 ‘전체삭제’라고 입력하세요.`, { ok: '전체 삭제', danger: true, input: '전체삭제' });
  if (okd) deleteRows({ all: true }, '모든 신청을');
});

// PDF 합치기: 지금 필터(타입·수령 장소)에 보이는 신청을 수령 장소 × 타입별로 합쳐 내려받는다.
// 드라이브에는 저장하지 않는다. 필터가 '전체'면 모든 조합을 각각 한 파일씩.
let merging = false;
$('merge').addEventListener('click', async () => {
  if (merging) return;
  const all = visible().filter(i => i.hasFile);
  if (!all.length) return msg($('listMsg'), '지금 필터에 합칠 PDF가 없습니다.', 'warn');
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
