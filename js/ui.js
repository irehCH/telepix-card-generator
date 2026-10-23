// 작업이 끝날 때까지 화면 전체를 막는다: 클릭·키보드(inert)·페이지 이탈 경고.
// busy('신청 처리 중…', async setText => { ... }) — 작업이 성공하든 실패하든 끝나면 풀린다.
export async function busy(message, fn) {
  const wrap = document.createElement('div');
  wrap.className = 'busy';
  wrap.setAttribute('role', 'alertdialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-live', 'assertive');
  wrap.innerHTML = '<div class="busy-box"><div class="spinner" aria-hidden="true"></div><p class="busy-msg"></p><p class="hint">끝날 때까지 창을 닫거나 새로고침하지 마세요.</p></div>';
  const text = wrap.querySelector('.busy-msg');
  text.textContent = message;
  const others = [...document.body.children];
  const wasInert = others.map(el => el.inert);
  others.forEach(el => { el.inert = true; });
  const stopKeys = e => { e.preventDefault(); e.stopPropagation(); };
  const onLeave = e => { e.preventDefault(); e.returnValue = ''; };
  document.addEventListener('keydown', stopKeys, true);
  window.addEventListener('beforeunload', onLeave);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  document.body.appendChild(wrap);
  try {
    return await fn(t => { text.textContent = t; });
  } finally {
    wrap.remove();
    others.forEach((el, i) => { el.inert = wasInert[i]; });
    document.removeEventListener('keydown', stopKeys, true);
    window.removeEventListener('beforeunload', onLeave);
  }
}

// 페이지 안 확인 창. 브라우저 기본 confirm/prompt/alert 는 일부 브라우저(앱 내장 브라우저 등)에서
// 막혀 조용히 '취소'로 처리되므로 쓰지 않는다.
//
// ask('지울까요?')                          → Promise<boolean>
// ask('입력하세요', { input: '전체삭제' })   → 입력값이 일치하면 true
// ask('안내', { cancel: null })             → 확인 버튼만 (alert 대신)
// okFirst: 확인 버튼을 왼쪽에, okClass: 확인 버튼 모양 (예: 'blue')
export function ask(message, { ok = '확인', cancel = '취소', danger = false, input = null, okFirst = false, okClass = '' } = {}) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.innerHTML = `
      <div class="panel ask">
        <p class="ask-msg"></p>
        ${input !== null ? '<input class="ask-input" autocomplete="off">' : ''}
        <div class="row" style="justify-content:${okFirst ? 'flex-start' : 'flex-end'};margin-top:16px">
          ${cancel && !okFirst ? '<button type="button" data-a="no"></button>' : ''}
          <button type="button" data-a="yes" class="${okClass || (danger ? 'danger-fill' : 'primary')}"></button>
          ${cancel && okFirst ? '<button type="button" data-a="no"></button>' : ''}
        </div>
      </div>`;
    wrap.querySelector('.ask-msg').textContent = message;
    wrap.querySelector('[data-a="yes"]').textContent = ok;
    if (cancel) wrap.querySelector('[data-a="no"]').textContent = cancel;
    const field = wrap.querySelector('.ask-input');
    const prevFocus = document.activeElement;

    const done = v => {
      wrap.remove();
      document.removeEventListener('keydown', onKey, true);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      resolve(v);
    };
    const yes = () => done(input !== null ? field.value.trim() === input : true);
    const onKey = e => {
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      else if (e.key === 'Enter' && (field ? document.activeElement === field : true)) { e.preventDefault(); yes(); }
    };
    wrap.addEventListener('click', e => {
      const a = e.target.dataset && e.target.dataset.a;
      if (a === 'yes') yes();
      else if (a === 'no' || e.target === wrap) done(false);
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap);
    (field || wrap.querySelector('[data-a="yes"]')).focus();
  });
}
