// 페이지 사이를 오갈 때 ?demo 같은 주소 뒤 설정을 유지한다 (data-keep-query 가 붙은 링크).
document.addEventListener('DOMContentLoaded', () => {
  if (!location.search) return;
  document.querySelectorAll('a[data-keep-query]').forEach(a => {
    const url = new URL(a.getAttribute('href'), document.baseURI);
    url.search = location.search;
    a.href = url.href;
  });
});
