// 명함 레이아웃 엔진 — 브라우저와 Node 양쪽에서 동작한다.
// 모든 글자는 폰트에서 꺼낸 외곽선(path)으로 그리고, 색은 DeviceCMYK로만 지정한다.
// 단위: 위치는 mm(왼쪽 위 원점, 아래로 +), 글자 크기는 pt.

const PT = 25.4 / 72; // 1pt = mm

// 명함 타입별 색과 페이지 구성. 배치는 두 타입이 같다.
// 색상: [C, M, Y, K] 0~1. pages: 템플릿 PDF 쪽 번호 (0 기본형 앞면, 1 은박판, 2 긴급형 앞면)
const RICH_BLACK = [0.745, 0.676, 0.667, 0.876];
const RED = [0, 0.9, 0.6, 0];
export const THEMES = {
  basic: {
    label: '기본형', leadDays: 7, bg: [0, 0, 0, 1],
    colors: { name: [0, 0, 0, 0.15], krName: [0, 0, 0, 0.15], degree: [0, 0, 0, 0.5], company: [0, 0, 0, 0.5], title: [0, 0, 0, 0.15], info: [0, 0, 0, 0.4], url: [0, 0, 0, 0.4] },
    frontPage: 0, foilPage: 1, frontImage: 'assets/front.png',
  },
  fast: {
    label: '긴급형', leadDays: 3, bg: [0, 0, 0, 0],
    colors: { name: [0, 0, 0, 1], krName: [0, 0, 0, 0.9], degree: [0, 0, 0, 0.55], company: [0, 0, 0, 0.6], title: [0, 0, 0, 0.9], info: [0, 0, 0, 0.8], url: [0, 0, 0, 0.6] },
    frontPage: 2, foilPage: null, frontImage: 'assets/front-fast.png',
    // 은박 자리에 인쇄하는 로고 (검정 + 빨강). 긴급형 원본에서 꺼내 은박 위치·크기에 맞춤.
    logo: [{"color":"black","cmds":[{"type":"M","x":78.4632,"y":9.0979},{"type":"C","x1":78.1114,"y1":9.0979,"x2":77.793,"y2":9.2356,"x":77.5624,"y":9.461},{"type":"C","x1":77.3318,"y1":9.6869,"x2":77.189,"y2":10.0002,"x":77.189,"y":10.3523},{"type":"L","x":77.189,"y":10.3655},{"type":"L","x":77.189,"y":10.379},{"type":"C","x1":77.189,"y1":10.7312,"x2":77.3318,"y2":11.0419,"x":77.5624,"y":11.2648},{"type":"C","x1":77.793,"y1":11.4877,"x2":78.1114,"y2":11.6224,"x":78.4632,"y":11.6224},{"type":"L","x":78.7944,"y":11.6224},{"type":"L","x":79.1253,"y":11.6224},{"type":"L","x":79.1253,"y":13.8189},{"type":"L","x":79.1253,"y":16.0155},{"type":"L","x":80.3753,"y":16.0155},{"type":"L","x":81.6249,"y":16.0155},{"type":"L","x":81.6249,"y":12.5569},{"type":"L","x":81.6249,"y":9.0979},{"type":"L","x":80.044,"y":9.0979},{"type":"L","x":78.4632,"y":9.0979}]},{"color":"black","cmds":[{"type":"M","x":83.5146,"y":10.9789},{"type":"C","x1":83.5146,"y1":10.9793,"x2":84.1566,"y2":10.9793,"x":84.7986,"y":10.9793},{"type":"C","x1":85.4406,"y1":10.9793,"x2":86.0826,"y2":10.9793,"x":86.0826,"y":10.9789},{"type":"C","x1":86.0826,"y1":9.7611,"x2":85.5841,"y2":8.6583,"x":84.7778,"y":7.8585},{"type":"C","x1":83.9718,"y1":7.0588,"x2":82.8576,"y2":6.5621,"x":81.6259,"y":6.5566},{"type":"L","x":81.6259,"y":7.8249},{"type":"L","x":81.6259,"y":9.0935},{"type":"C","x1":82.1482,"y1":9.0994,"x2":82.6204,"y2":9.3117,"x":82.9619,"y":9.6524},{"type":"C","x1":83.3038,"y1":9.9928,"x2":83.5146,"y2":10.4614,"x":83.5146,"y":10.9789}]},{"color":"red","cmds":[{"type":"M","x":82.5371,"y":13.2361},{"type":"C","x1":82.5371,"y1":12.5304,"x2":83.1092,"y2":11.958,"x":83.8153,"y":11.958},{"type":"C","x1":84.521,"y1":11.958,"x2":85.0931,"y2":12.5304,"x":85.0931,"y":13.2361},{"type":"C","x1":85.0931,"y1":13.9418,"x2":84.521,"y2":14.5143,"x":83.8153,"y":14.5143},{"type":"C","x1":83.1092,"y1":14.5143,"x2":82.5371,"y2":13.9418,"x":82.5371,"y":13.2361}]}],
    logoColors: { black: RICH_BLACK, red: RED },
  },
};
export const TYPES = Object.keys(THEMES);

export const CARD = {
  w: 92, h: 52, // 재단 여유 포함 작업 사이즈
  nameX: 6.0,
  nameLines: [ // 왼쪽 위 이름 블록 (기준선 y)
    { key: 'enFirst', y: 10.55, weight: 'Bold', size: 16, track: 46, color: 'name' },
    { key: 'enLast', y: 16.01, weight: 'Bold', size: 16, track: 46, color: 'name' },
    { key: 'krName', y: 20.33, weight: 'Bold', size: 8, track: 100, dx: 0.15, color: 'krName' },
  ],
  // 학위(PhD, MBA 등): 영문 성 오른쪽, 같은 기준선. 한글 이름보다 조금 작고 얇은 회색. gap = 성 끝에서 띄우는 거리(mm)
  degree: { after: 'enLast', weight: 'Medium', size: 7, track: 0, color: 'degree', gap: 1.4 },
  // 괄호 속 이름(enAlias): 있으면 둘째 줄에 성 대신 이 글자를 쓴다. 한글 이름과 같은 8pt, 학위처럼 얇은 회색.
  // maxX(mm, 은박 로고 왼쪽)를 넘으면 글자를 줄인다 (하한 minScale). 이때 학위는 첫 줄(degreeAfter) 오른쪽으로 간다.
  // 기준선은 윗줄 기준선에서 '이 글자 대문자 높이(약 2mm)'만큼 띄운 자리에 계산해 놓는다.
  // 원래 성 자리보다 올라간 만큼 아래 줄(한글 이름)도 같이 올라간다.
  alias: { replaces: 'enLast', degreeAfter: 'enFirst', weight: 'Medium', size: 8, track: 0, color: 'degree', maxX: 75, minScale: 0.6 },
  rightX: 85.91,
  maxWidth: 79.5, // 오른쪽 정렬 줄이 넘으면 안 되는 폭
  minScale: 0.85, // 넘칠 때 자동 축소 하한
  // 오른쪽 정보 블록: 아래에서 위로 쌓는다. gap = 이 줄 기준선 ~ 아래 줄 기준선 거리
  infoLines: [
    { key: 'company', weight: 'Medium', size: 5.5, track: 0, color: 'company', gap: 3.81 },
    { key: 'titleKr', weight: 'Medium', size: 8, track: 0, color: 'title', gap: 3.75, sep: '  •  ' },
    { key: 'titleEn', weight: 'Medium', size: 7.2, track: 0, color: 'title', gap: 3.64, sep: ' • ' },
    { key: 'contact', weight: 'Regular', size: 7.2, track: -10, color: 'info', gap: 4.15 },
    { key: 'addr1', weight: 'Regular', size: 6.65, track: -8, color: 'info', gap: 3.53 },
    { key: 'addr2', weight: 'Regular', size: 6.65, track: -7, color: 'info', y: 45.24 },
  ],
  url: { text: 'telepix.ai', weight: 'Regular', size: 7.0, track: 0, color: 'url', x: 6.62, yTop: 35.8 },
  // 첨부 이미지(QR·아이콘) 자리 — telepix.ai 대신 들어간다. 이 상자보다 커지지 않는다 (참고 QR 9.74mm).
  imageBox: { x: 6.12, y: 35.8, w: 9.74, h: 9.74 },
  // 영문 직책·소속 줄이 이미지 자리 오른쪽 끝에서 이 거리(mm) 안으로 들어오면 두 줄로 나눈다
  titleEnSplitGap: 1.5,
  titleEnLeading: 3.1, // 두 줄로 나눴을 때 줄 간격(mm, 7.2pt 글자)
  fixed: {
    company: '텔레픽스 주식회사',
    addr1: '서울특별시 영등포구 국제금융로8길 2, 18층 (여의도동, 농협재단빌딩)',
    addr2: '대전광역시 유성구 테크노4로 17, C동 518~519호 (관평동, 대덕비즈센터)',
  },
  labelWeight: 'SemiBold',
  // 은박(후가공) 로고 — 미리보기에만 그린다. 템플릿 PDF 2쪽(후가공판)의 외곽선, mm 단위.
  foil: 'M83.514 10.979C83.514 10.979 84.156 10.979 84.798 10.979C85.440 10.979 86.082 10.979 86.082 10.979C86.082 9.761 85.584 8.658 84.777 7.858C83.971 7.059 82.857 6.562 81.625 6.557L81.625 7.825L81.625 9.094C82.148 9.099 82.620 9.312 82.962 9.653C83.303 9.993 83.514 10.461 83.514 10.979M78.463 9.098C78.111 9.098 77.793 9.236 77.562 9.461C77.332 9.687 77.189 10.000 77.189 10.352L77.189 10.366L77.189 10.379C77.189 10.731 77.332 11.042 77.562 11.265C77.793 11.488 78.111 11.623 78.463 11.623L78.794 11.623L79.125 11.623L79.125 13.819L79.125 16.016L80.375 16.016L81.625 16.016L81.625 12.557L81.625 9.098L80.044 9.098L78.463 9.098M82.528 13.240C82.528 12.534 83.100 11.961 83.806 11.961C84.512 11.961 85.084 12.534 85.084 13.240C85.084 13.946 84.512 14.518 83.806 14.518C83.100 14.518 82.528 13.946 82.528 13.240',
};

export const WEIGHTS = ['Regular', 'Medium', 'SemiBold', 'Bold'];

const LABELS = { enFirst: '영문 이름', enLast: '영문 성', degree: '학위', enAlias: '괄호 속 이름', krName: '한글 이름', company: '회사명', titleKr: '직책·소속(한글)', titleEn: '직책·소속(영문)', contact: '연락처', addr1: '주소', addr2: '주소' };

// ---------- 입력값 정리 ----------

// 입력 중 휴대폰 번호에 하이픈 자동 삽입: 01012345678 → 010-1234-5678
export function hyphenPhone(raw) {
  const d = String(raw || '').replace(/[^0-9]/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export function formatPhone(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('+')) return s;
  const d = s.replace(/[^0-9]/g, '');
  if (d.startsWith('0')) {
    const rest = d.slice(1);
    const m = rest.match(/^(\d{2})(\d{3,4})(\d{4})$/);
    return '+82 ' + (m ? `${m[1]}-${m[2]}-${m[3]}` : rest);
  }
  return s;
}

// ['선임연구원', 'AI연구팀'] → "선임연구원 • AI연구팀". 입력에 섞인 '|'는 버린다.
export function joinTitle(parts, sep) {
  return parts.flatMap(p => String(p || '').split('|')).map(s => s.trim()).filter(Boolean).join(sep);
}

// 시트 형식 "선임연구원 | AI연구팀" → ['선임연구원', 'AI연구팀']
function splitTitle(line) {
  const [pos, ...rest] = String(line || '').split('|');
  return [pos.trim(), rest.join(' ').trim()];
}

// 예전 형식(titleKr/titleEn 한 칸)으로 저장된 값도 새 형식으로 읽는다.
export function normalizeFields(f) {
  const out = { ...f };
  if (out.posKr === undefined && out.titleKr !== undefined) [out.posKr, out.deptKr] = splitTitle(out.titleKr);
  if (out.posEn === undefined && out.titleEn !== undefined) [out.posEn, out.deptEn] = splitTitle(out.titleEn);
  for (const k of ['enFirst', 'enLast']) if (out[k] !== undefined) out[k] = normalizeEnName(out[k]);
  if (out.degree !== undefined) out.degree = normalizeDegree(out.degree);
  if (out.enAlias !== undefined) out.enAlias = normalizeAlias(out.enAlias);
  if (!THEMES[out.type]) out.type = 'basic';
  return out;
}

// 영문 이름 규칙: 괄호와 그 안, '-'·띄어쓰기는 빼고, 첫 글자만 대문자.
// "Gyu-Ang"·"Gyu ang" → "Gyuang", "KIM" → "Kim", "Fern (FERFSDF)" → "Fern"
export function normalizeEnName(s) {
  const w = String(s || '').replace(/\([^)]*\)?/g, '').replace(/[-\s()]/g, '');
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

// 괄호 속 이름: 괄호만 빼고 적힌 그대로 (대소문자 유지)
export function normalizeAlias(s) {
  return String(s || '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

// 학위 표기 통일: 마침표·띄어쓰기를 뺀다. 여러 개면 쉼표로 구분. "Ph.D." → "PhD", "M.B.A., Ph. D." → "MBA, PhD"
export function normalizeDegree(s) {
  return String(s || '').split(',').map(d => d.replace(/[.\s]/g, '')).filter(Boolean).join(', ');
}

// "Quang Huy Bui" → ["Quang Huy", "Bui", "", ""], "Sangu Kim, MBA" → ["Sangu", "Kim", "MBA", ""] (쉼표 뒤는 학위)
// 괄호 안은 따로 꺼낸다: "Fern (FERFSDF)" → ["Fern", "", "", "FERFSDF"]. 괄호는 둘째 줄에 있어도 읽고("FERN\n(NICHANUN T)"),
// 괄호 밖의 둘째 줄부터는 버린다.
export function splitEnglishName(full) {
  const all = String(full || '');
  const first = all.split(/\r?\n/)[0];
  const alias = normalizeAlias((all.match(/\([^)]*\)?/g) || []).join(' '));
  const noParen = t => t.replace(/\([^)]*\)?/g, ' ').replace(/[()]/g, ' ');
  const name = noParen(first).split(',')[0];
  const s = name.trim().replace(/\s+/g, ' ');
  // 학위는 어느 줄이든 쉼표 뒤 ("FERN\n(NICHANUN T), PhD" → PhD)
  const degree = noParen(all).split(/\r?\n/).flatMap(l => l.split(',').slice(1)).map(d => d.trim()).filter(Boolean).join(', ');
  const i = s.lastIndexOf(' ');
  return i < 0 ? [s, '', degree, alias] : [s.slice(0, i), s.slice(i + 1), degree, alias];
}

// 시트의 한 행(직원 정보)을 폼 값으로 바꾼다.
export function fieldsFromRecord(rec) {
  const [first, last, rawDegree, enAlias] = splitEnglishName(rec.enName);
  const enFirst = normalizeEnName(first), enLast = normalizeEnName(last), degree = normalizeDegree(rawDegree);
  const [kr, en] = String(rec.title || '').split(/\r?\n/);
  const [posKr, deptKr] = splitTitle(kr);
  const [posEn, deptEn] = splitTitle(en);
  return {
    krName: rec.krName || '', enFirst, enLast, degree, enAlias, posKr, deptKr, posEn, deptEn,
    phone: hyphenPhone(rec.phone), email: rec.email || '',
  };
}

// ---------- 글자 → 외곽선 ----------

// 한 줄(여러 run)을 외곽선 명령 목록으로 만든다. 기준선 왼쪽 끝이 (0,0), 단위 mm.
function shapeRuns(runs, fonts, scale = 1) {
  const cmds = [];
  let x = 0;
  const missing = new Set();
  for (const run of runs) {
    const font = fonts[run.weight];
    const sizeMm = run.size * PT * scale;
    const upm = font.unitsPerEm;
    const glyphs = font.stringToGlyphs(run.text);
    const chars = [...run.text];
    glyphs.forEach((g, i) => {
      if (g.index === 0 && chars[i] && chars[i].trim()) missing.add(chars[i]);
      const p = g.getPath(x, 0, sizeMm);
      for (const c of p.commands) cmds.push(c);
      let adv = g.advanceWidth;
      if (i < glyphs.length - 1) adv += font.getKerningValue(g, glyphs[i + 1]);
      x += adv / upm * sizeMm + (run.track || 0) / 1000 * sizeMm;
    });
    // run 마지막 글자 뒤 자간은 다음 run 앞에서도 유지
  }
  const lastTrack = runs.length ? (runs[runs.length - 1].track || 0) / 1000 * runs[runs.length - 1].size * PT * scale : 0;
  return { cmds, width: x - lastTrack, missing: [...missing] };
}

function transformCmds(cmds, f) {
  return cmds.map(c => {
    const o = { type: c.type };
    for (const [kx, ky] of [['x', 'y'], ['x1', 'y1'], ['x2', 'y2']]) {
      if (c[kx] !== undefined) { const [nx, ny] = f(c[kx], c[ky]); o[kx] = nx; o[ky] = ny; }
    }
    return o;
  });
}

// ---------- 첨부 이미지 ----------

// 픽셀(RGBA) → 명함에 넣을 형태.
//  mode 'mono' : 어두운 픽셀만 글자색 벡터 사각형으로 (배경은 버림). QR·아이콘용. invert면 밝은 픽셀을 씀.
//  mode 'color': 원본 색 그대로 (PDF에서는 CMYK로 바꿔 넣는다).
export function prepareImage({ width, height, data }, { mode = 'mono', invert = false, dataUrl = '' } = {}) {
  if (mode === 'color') return { mode, w: width, h: height, rgba: data, dataUrl };
  const ink = new Uint8Array(width * height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    if (data[i + 3] >= 128 && (lum < 0.5) !== invert) {
      ink[y * width + x] = 1;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { mode, w: 0, h: 0, rects: [] };
  // 가로 연속 구간을 찾고, 바로 위 줄과 같은 구간이면 세로로 이어 붙여 사각형 수를 줄인다.
  const rects = [], open = new Map();
  for (let y = y0; y <= y1 + 1; y++) {
    const runs = new Set();
    if (y <= y1) {
      for (let x = x0; x <= x1; x++) {
        if (!ink[y * width + x]) continue;
        const s = x; while (x <= x1 && ink[y * width + x]) x++;
        runs.add(`${s},${x - s}`);
      }
    }
    for (const [key, r] of open) if (!runs.has(key)) { rects.push(r); open.delete(key); }
    for (const key of runs) {
      if (open.has(key)) open.get(key)[3]++;
      else { const [s, w] = key.split(',').map(Number); open.set(key, [s - x0, y - y0, w, 1]); }
    }
  }
  return { mode, w: x1 - x0 + 1, h: y1 - y0 + 1, rects };
}

// 상자 안에 비율 유지로 맞춘다 (왼쪽·아래 정렬).
function fitBox(w, h, box) {
  const s = Math.min(box.w / w, box.h / h);
  return { x: box.x, y: box.y + box.h - h * s, w: w * s, h: h * s, s };
}

// ---------- 레이아웃 ----------

// fields → { type, shapes: [{cmds, cmyk} | {image, box}], warnings: [] }. fields.type 으로 기본형/긴급형을 고른다.
// opts.image: prepareImage() 결과. 있으면 telepix.ai 대신 그 자리에 넣는다.
export function layoutBack(fields, fonts, opts = {}, card = CARD) {
  fields = normalizeFields(fields);
  const theme = THEMES[fields.type];
  const shapes = [{ rect: [0, 0, card.w, card.h], cmyk: theme.bg }];
  const warnings = [];
  const add = (cmds, color) => shapes.push({ cmds, cmyk: theme.colors[color] });
  const noteMissing = (m, label) => { if (m.length) warnings.push(`${label}: 폰트에 없는 글자 ${m.join(' ')}`); };

  const degree = (fields.degree || '').trim(), dg = card.degree;
  const alias = (fields.enAlias || '').trim(), al = card.alias;
  const degreeShape = degree ? shapeRuns([{ text: degree, weight: dg.weight, size: dg.size, track: dg.track }], fonts) : null;
  if (degreeShape) noteMissing(degreeShape.missing, LABELS.degree);
  const degreeLine = alias ? al.degreeAfter : dg.after; // 괄호 속 이름이 있으면 학위는 첫 줄 오른쪽
  const capOf = (weight, size, scale = 1) => {
    const f = fonts[weight], ch = (f.tables.os2 && f.tables.os2.sCapHeight) || f.unitsPerEm * 0.7;
    return ch / f.unitsPerEm * size * PT * scale;
  };
  let shift = 0, prevY = null; // shift: 괄호 속 이름 때문에 아래 줄들이 올라간 거리(mm)
  for (const ln of card.nameLines) {
    const useAlias = alias && ln.key === al.replaces;
    const text = useAlias ? alias : (fields[ln.key] || '').trim();
    let lineY = ln.y - shift;
    const above = prevY;
    prevY = lineY;
    if (!text) continue;
    const x0 = card.nameX + (ln.dx || 0);
    let s;
    if (useAlias) {
      // 학위까지 한 줄에 들어가도록 필요하면 줄인다
      const run = { text, weight: al.weight, size: al.size, track: al.track };
      s = shapeRuns([run], fonts);
      let aScale = 1;
      const room = al.maxX - x0 - (degreeShape && degreeLine === ln.key ? dg.gap + degreeShape.width : 0);
      if (s.width > room) {
        const scale = aScale = Math.max(al.minScale, room / s.width);
        s = shapeRuns([run], fonts, scale);
        if (s.width > room + 0.01) warnings.push(`${LABELS.enAlias} 줄이 너무 길어 최소 크기로도 넘칩니다. 내용을 줄여 주세요.`);
        else warnings.push(`${LABELS.enAlias} 줄이 길어 ${Math.round(scale * 100)}%로 자동 축소했습니다.`);
      }
      noteMissing(s.missing, LABELS.enAlias);
      // 윗줄과의 틈 = 원래 크기의 대문자 높이, 글자가 줄었으면 줄어든 높이만큼만 내려온다
      if (above != null) {
        const y = above + capOf(al.weight, al.size) + capOf(al.weight, al.size, aScale);
        shift += lineY - y;
        lineY = prevY = y;
      }
      const yy = lineY;
      add(transformCmds(s.cmds, (x, y) => [x + x0, y + yy]), al.color);
    } else {
      s = shapeRuns([{ text, weight: ln.weight, size: ln.size, track: ln.track }], fonts);
      noteMissing(s.missing, LABELS[ln.key]);
      add(transformCmds(s.cmds, (x, y) => [x + x0, y + lineY]), ln.color);
    }
    let end = x0 + s.width;
    if (degreeShape && ln.key === degreeLine) {
      const dx = end + dg.gap;
      add(transformCmds(degreeShape.cmds, (x, y) => [x + dx, y + lineY]), dg.color);
      end = dx + degreeShape.width;
    }
    if (!useAlias && end > card.w - 4) warnings.push(`이름(${text})이 너무 깁니다.`);
  }

  const contactRuns = [];
  const phone = formatPhone(fields.phone), email = (fields.email || '').trim();
  const lineSpec = k => card.infoLines.find(l => l.key === k);
  const crun = lineSpec('contact');
  const base = { size: crun.size, track: crun.track };
  if (phone) contactRuns.push({ text: 'M:', weight: card.labelWeight, ...base }, { text: ' ' + phone, weight: crun.weight, ...base });
  if (phone && email) contactRuns.push({ text: '  ', weight: crun.weight, ...base });
  if (email) contactRuns.push({ text: 'E:', weight: card.labelWeight, ...base }, { text: ' ' + email, weight: crun.weight, ...base });

  const texts = {
    company: card.fixed.company,
    titleKr: joinTitle([fields.posKr, fields.deptKr], lineSpec('titleKr').sep),
    titleEn: joinTitle([fields.posEn, fields.deptEn], lineSpec('titleEn').sep),
    addr1: card.fixed.addr1,
    addr2: card.fixed.addr2,
  };

  // 한 줄을 오른쪽 정렬로 그린다. 너무 길면 자동 축소(하한 minScale).
  const placeRight = (runs, ln, yy) => {
    let s = shapeRuns(runs, fonts);
    let scale = 1;
    if (s.width > card.maxWidth) {
      scale = card.maxWidth / s.width;
      if (scale < card.minScale) {
        warnings.push(`${LABELS[ln.key]} 줄이 너무 길어 최소 크기로도 넘칩니다. 내용을 줄여 주세요.`);
        scale = card.minScale;
      } else {
        warnings.push(`${LABELS[ln.key]} 줄이 길어 ${Math.round(scale * 100)}%로 자동 축소했습니다.`);
      }
      s = shapeRuns(runs, fonts, scale);
    }
    noteMissing(s.missing, LABELS[ln.key]);
    const x0 = card.rightX - s.width;
    add(transformCmds(s.cmds, (x, yv) => [x + x0, yv + yy]), ln.color);
  };
  const runOf = (text, ln) => [{ text, weight: ln.weight, size: ln.size, track: ln.track }];

  // 영문 직책·소속이 한 줄로는 이미지 자리(왼쪽 아래 QR 칸)에 1.5mm 안쪽까지 다가가면,
  // 가운뎃점을 빼고 직책 / 소속 두 줄로 나눈다.
  const splitLeftLimit = card.imageBox.x + card.imageBox.w + card.titleEnSplitGap;
  const posEn = joinTitle([fields.posEn], ''), deptEn = joinTitle([fields.deptEn], '');
  const enSpec = lineSpec('titleEn');
  const splitEn = !!(posEn && deptEn && texts.titleEn) &&
    card.rightX - shapeRuns(runOf(texts.titleEn, enSpec), fonts).width < splitLeftLimit;

  // 아래에서 위로: 빈 줄은 건너뛰고 위 줄들이 내려온다.
  let y = null;
  for (const ln of [...card.infoLines].reverse()) {
    if (ln.key === 'titleEn' && splitEn) {
      y = y === null ? ln.y : y - ln.gap;
      placeRight(runOf(deptEn, ln), ln, y);   // 아랫줄: 소속
      y -= card.titleEnLeading;
      placeRight(runOf(posEn, ln), ln, y);    // 윗줄: 직책
      continue;
    }
    const runs = ln.key === 'contact' ? contactRuns : (texts[ln.key] ? runOf(texts[ln.key], ln) : []);
    if (!runs.length) continue;
    y = y === null ? ln.y : y - ln.gap;
    placeRight(runs, ln, y);
  }

  const img = opts.image;
  if (img && img.w > 0) {
    const b = fitBox(img.w, img.h, card.imageBox);
    if (img.mode === 'mono') {
      const cmds = [];
      for (const [x, y, w, h] of img.rects) {
        const X0 = b.x + x * b.s, Y0 = b.y + y * b.s, X1 = X0 + w * b.s, Y1 = Y0 + h * b.s;
        cmds.push({ type: 'M', x: X0, y: Y0 }, { type: 'L', x: X1, y: Y0 }, { type: 'L', x: X1, y: Y1 }, { type: 'L', x: X0, y: Y1 }, { type: 'Z' });
      }
      add(cmds, 'name');
    } else {
      shapes.push({ image: img, box: b, bg: theme.bg });
    }
  } else {
    // 세로 URL (시계 방향 90° 회전, 위에서 아래로 읽힘). 이미지를 넣으면 그 자리를 이미지가 쓴다.
    const u = card.url;
    const us = shapeRuns([{ text: u.text, weight: u.weight, size: u.size, track: u.track }], fonts);
    // 회전: (x, y) → (-y, x). 글자 윗부분이 오른쪽을 향한다.
    add(transformCmds(us.cmds, (x, y) => [u.x - y, u.yTop + x]), u.color);
  }

  // 긴급형: 은박 대신 오른쪽 위에 로고를 인쇄
  for (const s of theme.logo || []) shapes.push({ cmds: s.cmds, cmyk: theme.logoColors[s.color] });

  return { type: fields.type, shapes, warnings };
}

// ---------- 출력: SVG 미리보기 ----------

// 화면용 근사색. 인쇄 결과와 정확히 같지는 않다.
export function cmykToCss([c, m, y, k]) {
  const v = ch => Math.round(255 * (1 - 0.86 * Math.min(1, ch + k * (1 - ch))));
  return `rgb(${v(c)},${v(m)},${v(y)})`;
}

function cmdsToSvgD(cmds) {
  const f = n => +n.toFixed(3);
  return cmds.map(c => {
    switch (c.type) {
      case 'M': return `M${f(c.x)} ${f(c.y)}`;
      case 'L': return `L${f(c.x)} ${f(c.y)}`;
      case 'C': return `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}`;
      case 'Q': return `Q${f(c.x1)} ${f(c.y1)} ${f(c.x)} ${f(c.y)}`;
      case 'Z': return 'Z';
    }
    return '';
  }).join('');
}

// opts.foil: 은박이 있는 타입이면 은박 로고를 은색 그라디언트로 겹쳐 그린다 (화면 전용, PDF에는 안 들어감).
export function toSvg(layout, opts = {}, card = CARD) {
  const parts = layout.shapes.map(s => s.rect
    ? `<rect x="${s.rect[0]}" y="${s.rect[1]}" width="${s.rect[2]}" height="${s.rect[3]}" fill="${cmykToCss(s.cmyk)}"/>`
    : s.image
      ? `<image href="${s.image.dataUrl}" x="${s.box.x}" y="${s.box.y}" width="${s.box.w}" height="${s.box.h}" preserveAspectRatio="none"/>`
      : `<path d="${cmdsToSvgD(s.cmds)}" fill="${cmykToCss(s.cmyk)}"/>`);
  if (opts.foil && THEMES[layout.type || 'basic'].foilPage != null) {
    const id = 'foil' + Math.random().toString(36).slice(2, 8);
    parts.push(`<defs><linearGradient id="${id}" x1="77" y1="6.5" x2="86" y2="16" gradientUnits="userSpaceOnUse">` +
      '<stop offset="0" stop-color="#f4f4f4"/><stop offset=".3" stop-color="#9a9a9a"/><stop offset=".5" stop-color="#e6e6e6"/>' +
      '<stop offset=".75" stop-color="#8a8a8a"/><stop offset="1" stop-color="#d0d0d0"/></linearGradient></defs>' +
      `<path d="${card.foil}" fill="url(#${id})"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${card.w} ${card.h}">${parts.join('')}</svg>`;
}

// ---------- 출력: CMYK PDF ----------

// 컬러 이미지 → DeviceCMYK 이미지. 투명한 부분은 명함 배경색과 미리 섞어 PDF에 투명도가 남지 않게 한다.
// (ICC 없이 단순 변환이라 색은 근사치)
function cmykImageStream(context, img, bg) {
  const { w, h, rgba } = img;
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4] / 255, g = rgba[i * 4 + 1] / 255, b = rgba[i * 4 + 2] / 255, a = rgba[i * 4 + 3] / 255;
    const k = 1 - Math.max(r, g, b);
    const cmyk = k >= 1 ? [0, 0, 0, 1] : [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k];
    for (let j = 0; j < 4; j++) out[i * 4 + j] = Math.round(255 * (a * cmyk[j] + (1 - a) * bg[j]));
  }
  return context.flateStream(out, { Type: 'XObject', Subtype: 'Image', Width: w, Height: h, ColorSpace: 'DeviceCMYK', BitsPerComponent: 8 });
}

// 개인 명함 PDF: 앞면 + 생성한 뒷면 (+ 기본형은 은박판).
export async function buildPdf(PDFLib, templateBytes, layout, meta = {}, card = CARD) {
  const { PDFDocument, pushGraphicsState, popGraphicsState, setFillingCmykColor, moveTo, lineTo,
    appendBezierCurve, appendQuadraticCurve, closePath, fill, rectangle } = PDFLib;
  const theme = THEMES[layout.type || 'basic'];
  const doc = await PDFDocument.create();
  const tpl = await PDFDocument.load(templateBytes);
  const [front] = await doc.copyPages(tpl, [theme.frontPage]);
  const W = card.w / PT, H = card.h / PT;

  doc.addPage(front);
  const back = doc.addPage([W, H]);
  const X = v => v / PT, Y = v => H - v / PT; // mm(위 원점) → pt(아래 원점)
  const ops = [pushGraphicsState()];
  for (const s of layout.shapes) {
    if (s.image) {
      const name = back.node.newXObject('Im', doc.context.register(cmykImageStream(doc.context, s.image, s.bg)));
      const { concatTransformationMatrix, drawObject } = PDFLib;
      ops.push(pushGraphicsState(), concatTransformationMatrix(X(s.box.w), 0, 0, X(s.box.h), X(s.box.x), Y(s.box.y + s.box.h)), drawObject(name), popGraphicsState());
      continue;
    }
    ops.push(setFillingCmykColor(...s.cmyk));
    if (s.rect) {
      const [x, y, w, h] = s.rect;
      ops.push(rectangle(X(x), Y(y + h), X(w), X(h)), fill());
      continue;
    }
    for (const c of s.cmds) {
      if (c.type === 'M') ops.push(moveTo(X(c.x), Y(c.y)));
      else if (c.type === 'L') ops.push(lineTo(X(c.x), Y(c.y)));
      else if (c.type === 'C') ops.push(appendBezierCurve(X(c.x1), Y(c.y1), X(c.x2), Y(c.y2), X(c.x), Y(c.y)));
      else if (c.type === 'Q') ops.push(appendQuadraticCurve(X(c.x1), Y(c.y1), X(c.x), Y(c.y)));
      else if (c.type === 'Z') ops.push(closePath());
    }
    ops.push(fill()); // 비영(nonzero) 채우기 — 폰트 외곽선 규칙과 같다
  }
  ops.push(popGraphicsState());
  // 나눠서 넘긴다: 복잡한 QR은 명령이 수만 개라 한 번에 펼치면 호출 스택이 넘친다
  for (let i = 0; i < ops.length; i += 2000) back.pushOperators(...ops.slice(i, i + 2000));
  if (theme.foilPage != null) doc.addPage((await doc.copyPages(tpl, [theme.foilPage]))[0]);

  for (const p of doc.getPages()) {
    p.setTrimBox(0, 0, W, H);
    p.setBleedBox(0, 0, W, H);
  }
  doc.setTitle(meta.title || 'TELEPIX 명함');
  doc.setProducer('telepix-card');
  doc.setCreator('telepix-card');
  return doc.save();
}

// 주문용 합본 (한 타입만): 사람마다 앞면·뒷면, 은박판은 맨 끝에 한 장만.
// opts.bleed: 재단 여백(mm). 기본 1 (92×52). 2면 94×54로 키우고, 색 배경(기본형 뒷면 K100)도 가장자리까지 늘린다.
export async function mergeForPrint(PDFLib, templateBytes, type, list, { bleed = 1 } = {}, card = CARD) {
  const theme = THEMES[type];
  const out = await PDFLib.PDFDocument.create();
  const bgs = []; // 쪽마다 가장자리까지 늘릴 배경색 (흰색이면 null — 종이색이라 칠할 필요 없음)
  const colored = theme.bg.some(v => v > 0) ? theme.bg : null;
  for (const bytes of list) {
    const src = await PDFLib.PDFDocument.load(bytes);
    const pages = await out.copyPages(src, [0, 1]); // 개인 PDF의 앞면·뒷면
    pages.forEach(p => out.addPage(p));
    bgs.push(null, colored);
  }
  if (theme.foilPage != null) {
    const tpl = await PDFLib.PDFDocument.load(templateBytes);
    const [foil] = await out.copyPages(tpl, [theme.foilPage]);
    const p = out.addPage(foil);
    const { width, height } = p.getSize();
    p.setTrimBox(0, 0, width, height);
    p.setBleedBox(0, 0, width, height);
    bgs.push(null);
  }
  out.setTitle(`TELEPIX 명함 ${theme.label} ${list.length}명`);
  out.setProducer('telepix-card');
  if (bleed <= 1) return out.save();
  return expandBleed(PDFLib, await out.save(), bgs, bleed - 1, card);
}

// 모든 쪽을 사방 extraMm 만큼 키운다. 원래 내용은 가운데에 그대로(벡터·CMYK 유지) 두고,
// bgs[i] 가 있으면 그 색으로 늘어난 가장자리까지 먼저 칠한다.
async function expandBleed(PDFLib, bytes, bgs, extraMm, card) {
  const { PDFDocument, pushGraphicsState, popGraphicsState, setFillingCmykColor, rectangle, fill } = PDFLib;
  const src = await PDFDocument.load(bytes);
  const doc = await PDFDocument.create();
  const embedded = await doc.embedPdf(bytes, src.getPageIndices());
  const e = extraMm / PT, W = card.w / PT, H = card.h / PT, W2 = W + 2 * e, H2 = H + 2 * e;
  embedded.forEach((emb, i) => {
    const page = doc.addPage([W2, H2]);
    if (bgs[i]) page.pushOperators(pushGraphicsState(), setFillingCmykColor(...bgs[i]), rectangle(0, 0, W2, H2), fill(), popGraphicsState());
    page.drawPage(emb, { x: e, y: e, width: W, height: H });
    page.setTrimBox(0, 0, W2, H2);
    page.setBleedBox(0, 0, W2, H2);
  });
  doc.setTitle(src.getTitle() || 'TELEPIX 명함');
  doc.setProducer('telepix-card');
  return doc.save();
}

// ---------- 출력: 디지털 명함 (화면용) ----------

// 재단선(90×50mm)으로 잘린 화면용 PDF 2쪽(앞·뒤).
// 앞면은 템플릿 앞면을 벡터 그대로 넣고(재단 여백만 잘라냄), 뒷면은 은박을 은색으로 그려 넣은 고해상도 그림.
// rasterize(svg, widthPx) → PNG 바이트: 브라우저에서 SVG를 그림으로 바꾸는 함수 (화면 쪽에서 넘겨준다).
export async function buildDigitalPdf(PDFLib, templateBytes, layout, rasterize, meta = {}, card = CARD, bleed = 1) {
  const theme = THEMES[layout.type || 'basic'];
  const w = card.w - 2 * bleed, h = card.h - 2 * bleed;
  const doc = await PDFLib.PDFDocument.create();

  const [front] = await doc.embedPdf(templateBytes, [theme.frontPage]);
  const frontPage = doc.addPage([w / PT, h / PT]);
  frontPage.drawPage(front, { x: -bleed / PT, y: -bleed / PT, width: card.w / PT, height: card.h / PT }); // 쪽 밖으로 나간 여백은 잘림

  const svg = toSvg(layout, { foil: true }).replace(`viewBox="0 0 ${card.w} ${card.h}"`, `viewBox="${bleed} ${bleed} ${w} ${h}"`);
  const back = await doc.embedPng(await rasterize(svg, 2400));
  doc.addPage([w / PT, h / PT]).drawImage(back, { x: 0, y: 0, width: w / PT, height: h / PT });
  doc.setTitle(meta.title || 'TELEPIX 디지털 명함');
  doc.setProducer('telepix-card');
  return doc.save();
}

export async function loadFonts(opentype, baseUrl) {
  const fonts = {};
  await Promise.all(WEIGHTS.map(async w => {
    const res = await fetch(`${baseUrl}/Pretendard-${w}.otf`);
    fonts[w] = opentype.parse(await res.arrayBuffer());
  }));
  return fonts;
}
