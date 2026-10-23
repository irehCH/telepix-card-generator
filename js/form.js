// 명함 입력 폼 — 신청 화면과 관리자 수정 화면이 함께 쓴다.
import { hyphenPhone, normalizeFields, normalizeEnName, normalizeDegree, normalizeAlias, prepareImage, THEMES } from './card.js';
import { ask } from './ui.js';

const TEXT = [ // [필드, 라벨, placeholder, input 속성]
  ['krName', '한글 이름', ''],
  ['enFirst', '영문 이름 (윗줄)', ''], ['enLast', '영문 성 (아랫줄)', ''],
  ['degree', '학위 (선택)', 'PhD, MBA'], ['enAlias', '괄호 속 이름 (선택)', ''],
  ['posKr', '한글 직책', '선임연구원'], ['deptKr', '한글 소속', 'AI연구팀'],
  ['posEn', '영문 직책', 'Senior Research Engineer'], ['deptEn', '영문 소속', 'AI Research Team'],
  ['phone', '휴대폰', '01012345678', 'inputmode="numeric" maxlength="13"'],
  ['email', '이메일', '', 'type="email"'],
];
const OPTIONAL = ['degree', 'enAlias']; // 비워 둬도 되는 칸 (영문 성은 괄호 속 이름이 있으면 비워도 됨)
const LABELS = Object.fromEntries([...TEXT.map(([k, l]) => [k, l.replace(/ \(.*\)/, '')]), ['pickup', '수령 장소']]);
const IMAGE_MAX_CHARS = 45000; // 시트 한 칸(5만 자)에 들어가게
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function field(k) {
  const [, label, ph, attrs = ''] = TEXT.find(t => t[0] === k);
  const [main, sub] = label.split(' (');
  return `<div><label>${esc(main)}${sub ? ` <span class="opt">(${esc(sub)}</span>` : ''}</label><input data-f="${k}" placeholder="${esc(ph)}" ${attrs}></div>`;
}

// lockPersonal: 이름~이메일 칸을 잠가 두고, 누르면 '관리자 동의' 안내 후에만 풀어 준다 (신청 화면용).
// 잠금 해제는 기억하지 않는다 — 페이지에 들어올 때마다 다시 잠긴다.
export function createCardForm(root, { onChange = () => {}, lockPersonal = false } = {}) {
  root.innerHTML = `
    <label>명함 타입</label>
    <div class="seg" role="radiogroup">
      ${Object.entries(THEMES).map(([k, t]) => `<label><input type="radio" name="cardType-${root.id}" value="${k}"><span>${t.label}<small>${k === 'basic' ? '검정 · 은박' : '흰색 · 인쇄 로고'} · 최대 ${t.leadDays}일</small></span></label>`).join('')}
    </div>
    <p class="msg info" data-f="typeNote"></p>
    ${field('krName')}
    <div class="grid2">${field('enFirst')}${field('enLast')}</div>
    <div class="grid2">${field('degree')}${field('enAlias')}</div>
    <div class="hint">학위는 영문 성 오른쪽에 작은 회색 글자로 들어갑니다. 괄호 속 이름을 적으면 둘째 줄에 성 대신 작은 회색 글자로 들어갑니다.</div>
    <div class="grid2">${field('posKr')}${field('deptKr')}</div>
    <div class="grid2">${field('posEn')}${field('deptEn')}</div>
    <div class="hint">명함에는 ‘직책 • 소속’으로 표시됩니다.</div>
    ${field('phone')}
    <div class="hint">숫자만 입력하면 하이픈이 자동으로 붙습니다. 명함에는 +82 형식으로 들어갑니다.</div>
    ${field('email')}
    <label>수령 장소</label>
    <select data-f="pickup"><option value="">선택하세요</option><option>서울캠퍼스</option><option>대전캠퍼스</option></select>
    <label>QR코드 · 아이콘 <span class="opt">(선택)</span></label>
    <div class="imgbox">
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-f="imageFile">
      <div class="row hidden" data-f="imageOpts">
        <select data-f="imageMode" style="width:auto">
          <option value="mono">단색 (명함 글자색, QR 추천)</option>
          <option value="color">원본 색 (CMYK로 변환)</option>
        </select>
        <label class="check" style="margin:0"><input type="checkbox" data-f="imageInvert"> 색상 반전</label>
        <button type="button" data-f="imageClear">이미지 빼기</button>
      </div>
      <div class="hint">왼쪽 아래 telepix.ai 자리에 들어갑니다.</div>
    </div>`;

  const $ = k => root.querySelector(`[data-f="${k}"]`);
  const radios = () => [...root.querySelectorAll(`input[name="cardType-${root.id}"]`)];
  let image = null; // { data, mode, invert, prepared }

  function syncUi() {
    const type = read().fields.type;
    $('typeNote').textContent = `${THEMES[type].label}은 업무시간 기준 최대 ${THEMES[type].leadDays}일 소요됩니다.`;
    $('imageOpts').classList.toggle('hidden', !image);
    $('imageInvert').closest('label').classList.toggle('hidden', !image || image.mode !== 'mono');
  }

  function read() {
    const fields = {};
    for (const [k] of TEXT) fields[k] = $(k).value.trim();
    fields.enFirst = normalizeEnName(fields.enFirst);
    fields.enLast = normalizeEnName(fields.enLast);
    fields.degree = normalizeDegree(fields.degree);
    fields.enAlias = normalizeAlias(fields.enAlias);
    fields.type = (radios().find(r => r.checked) || { value: 'basic' }).value;
    return { fields, pickup: $('pickup').value, image: image && { data: image.data, mode: image.mode, invert: image.invert } };
  }

  async function fill({ fields = {}, pickup, image: img } = {}) {
    const f = normalizeFields(fields);
    for (const [k] of TEXT) $(k).value = f[k] || '';
    $('phone').value = hyphenPhone($('phone').value);
    radios().forEach(r => { r.checked = r.value === f.type; });
    $('pickup').value = pickup || '';
    root.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
    await setImage(img || null);
  }

  // img: { data: dataURL, mode, invert } 또는 null
  async function setImage(img) {
    if (!img || !img.data) { image = null; $('imageFile').value = ''; syncUi(); onChange(); return; }
    const pixels = await decode(img.data);
    image = { data: img.data, mode: img.mode || 'mono', invert: !!img.invert, pixels };
    image.prepared = prepareImage(pixels, { mode: image.mode, invert: image.invert, dataUrl: image.data });
    $('imageMode').value = image.mode;
    $('imageInvert').checked = image.invert;
    syncUi(); onChange();
  }

  function validate() {
    const bad = [];
    const optional = $('enAlias').value.trim() ? [...OPTIONAL, 'enLast'] : OPTIONAL;
    for (const k of [...TEXT.map(t => t[0]).filter(k => !optional.includes(k)), 'pickup']) {
      const el = $(k);
      let ok = !!el.value.trim();
      if (ok && k === 'phone') ok = /^01\d-\d{3,4}-\d{4}$/.test(el.value);
      if (ok && k === 'email') ok = el.checkValidity();
      el.classList.toggle('invalid', !ok);
      if (!ok) bad.push(LABELS[k]);
    }
    if (image && image.mode === 'mono' && !image.prepared.w) bad.push('이미지 (인쇄할 부분이 없습니다. ‘색상 반전’을 바꿔 보세요)');
    return bad;
  }

  root.addEventListener('input', e => {
    const t = e.target, k = t.dataset.f;
    if (k === 'phone') t.value = hyphenPhone(t.value);
    else if (TEXT.some(x => x[0] === k) && t.value.includes('|')) t.value = t.value.replace(/\s*\|\s*/g, ' ');
    if (t.classList.contains('invalid') && t.value.trim()) t.classList.remove('invalid');
    if (t.type === 'radio') syncUi();
    if (k !== 'imageFile') onChange();
  });
  // 영문 이름·학위는 칸을 벗어날 때 규칙대로 고쳐 보여 준다 (입력 중에 바꾸면 커서가 튐)
  root.addEventListener('focusout', e => {
    const t = e.target, k = t.dataset && t.dataset.f;
    const fix = { enFirst: normalizeEnName, enLast: normalizeEnName, degree: normalizeDegree, enAlias: normalizeAlias }[k];
    if (!fix) return;
    const v = fix(t.value);
    if (v !== t.value) { t.value = v; onChange(); }
  });
  root.addEventListener('change', async e => {
    const k = e.target.dataset.f;
    if (k === 'pickup') onChange();
    if (k === 'imageFile' && e.target.files[0]) {
      try { await setImage({ data: await normalizeImageFile(e.target.files[0]), mode: image ? image.mode : 'mono' }); }
      catch (err) { ask('이미지를 읽지 못했습니다: ' + err.message, { cancel: null }); e.target.value = ''; }
    }
    if ((k === 'imageMode' || k === 'imageInvert') && image) {
      await setImage({ data: image.data, mode: $('imageMode').value, invert: $('imageInvert').checked });
    }
  });
  $('imageClear').addEventListener('click', () => setImage(null));

  // 개인정보 칸 잠금
  const personal = TEXT.map(([k]) => $(k));
  let locked = false, asking = false;
  const setLocked = on => {
    locked = on;
    personal.forEach(el => { el.readOnly = on; el.classList.toggle('locked', on); });
  };
  if (lockPersonal) {
    setLocked(true);
    root.addEventListener('focusin', async e => {
      if (!locked || !personal.includes(e.target) || asking) return;
      const field = e.target;
      field.blur();
      asking = true;
      const ok = await ask('개인정보 수정 시, 꼭 관리자의 동의가 필요합니다.\n자의적으로 수정하면 신청이 보류됩니다.',
        { ok: '허락 받았어요', cancel: '수정하지 않을래요', okFirst: true, okClass: 'blue' });
      asking = false;
      if (ok) { setLocked(false); field.focus(); }
    });
  }

  syncUi();
  return { read, fill, validate, setImage, preparedImage: () => (image ? image.prepared : null) };
}

// 저장된 이미지 { data, mode, invert } → layoutBack 에 넘길 형태 (관리자 목록 미리보기용)
export async function prepareStoredImage(img) {
  if (!img || !img.data) return null;
  return prepareImage(await decode(img.data), { mode: img.mode || 'mono', invert: !!img.invert, dataUrl: img.data });
}

// dataURL → RGBA 픽셀
function decode(dataUrl) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      resolve({ width: c.width, height: c.height, data: d.data });
    };
    im.onerror = () => reject(new Error('이미지 형식을 읽을 수 없습니다.'));
    im.src = dataUrl;
  });
}

// 올린 파일을 작은 PNG(안 되면 JPEG) dataURL로 줄인다 — 신청 기록 한 칸에 들어갈 크기까지.
async function normalizeImageFile(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error('10MB 이하 파일만 올릴 수 있습니다.');
  const src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('이미지 형식을 읽을 수 없습니다.')); i.src = src; });
  let side = 400;
  for (let tries = 0; tries < 8; tries++, side = Math.round(side * 0.8)) {
    const s = Math.min(1, side / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * s)); c.height = Math.max(1, Math.round(im.naturalHeight * s));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, 0, 0, c.width, c.height);
    const png = c.toDataURL('image/png');
    if (png.length <= IMAGE_MAX_CHARS) return png;
    const jpg = c.toDataURL('image/jpeg', 0.85);
    if (jpg.length <= IMAGE_MAX_CHARS) return jpg;
  }
  throw new Error('이미지가 너무 복잡합니다. 더 단순한 이미지를 올려 주세요.');
}
