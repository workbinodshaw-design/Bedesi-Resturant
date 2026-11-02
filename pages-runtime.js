// GitHub Pages serves the public website/menu preview; Python remains local.
(() => {
  if (!location.hostname.endsWith('.github.io')) return;
  window.BEDESI_PAGES_PREVIEW = true;
  const base = new URL('.', document.currentScript.src);
  const table = new URLSearchParams(location.search).get('table');
  const home = location.pathname === base.pathname || location.pathname === new URL('index.html', base).pathname;
  if (home && table && /^[A-Za-z]?\d{1,3}$/.test(table)) {
    location.replace(new URL('table-menu.html' + location.search, base).href);
    return;
  }
  if (location.pathname.endsWith('/admin.html')) {
    location.replace(new URL('admin-preview.html', base).href);
    return;
  }
  // Block form submission before the application handlers run: no unavailable API calls.
  document.addEventListener('submit', event => {
    if (event.target.matches('#delivery-checkout, #coupon-panel')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest('#place-order, #delivery-continue')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href="/"]').forEach(link => link.href = base.href);
    document.querySelectorAll('.header-order, .hero .button-dark, .delivery-story-copy .button, .footer-top .button').forEach(link => {
      if (link.firstChild?.nodeType === Node.TEXT_NODE) link.firstChild.textContent = 'Explore menu ';
    });
    const story = document.querySelector('.delivery-story-copy');
    if (story) {
      story.querySelector('p').textContent = 'Explore the dishes and put together your food mood. This hosted preview does not accept online orders yet.';
      const steps = story.querySelectorAll('li');
      steps[1].querySelector('strong').textContent = 'Explore your options';
      steps[1].querySelector('p').textContent = 'Browse the full Bedesi menu.';
      steps[2].querySelector('strong').textContent = 'Ordering connection pending';
      steps[2].querySelector('p').textContent = 'Checkout needs the restaurant’s ordering server.';
    }
    const faq = document.querySelector('.faq-list details p');
    if (faq) faq.textContent = 'You can explore our full menu here. Online order submission is not connected on this GitHub-hosted preview.';
    const checkout = document.querySelector('#delivery-continue');
    if (checkout) {
      checkout.disabled = true;
      checkout.textContent = 'Checkout unavailable on preview';
      document.querySelector('.basket-charge-note').textContent = 'Menu and basket preview only. Orders are not submitted from this hosted version.';
      document.querySelector('#delivery-checkout').querySelectorAll('input, textarea, button').forEach(field => field.disabled = true);
      const note = document.createElement('p');
      note.className = 'pages-preview-note';
      note.textContent = 'Menu preview · Online ordering is not connected here.';
      document.querySelector('.delivery-heading').append(note);
    }
    const place = document.querySelector('#place-order');
    if (place) {
      place.disabled = true;
      place.textContent = 'Ordering unavailable on preview';
      const note = document.createElement('p');
      note.className = 'pages-preview-note';
      note.textContent = 'Your basket is a preview. No order is sent to the restaurant from this hosted page.';
      place.parentElement.before(note);
      document.querySelector('#coupon-card')?.setAttribute('hidden', '');
    }
  });
})();
