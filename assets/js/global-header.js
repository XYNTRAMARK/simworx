
(() => {
  const header = document.querySelector('.global-header');
  const toggle = document.querySelector('.global-toggle');
  if (header && toggle) {
    toggle.addEventListener('click', () => header.classList.toggle('open'));
  }
})();
