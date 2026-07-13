(async () => {
  document.documentElement.style.visibility = 'hidden';
  const current = `${location.pathname}${location.search}${location.hash}`;
  try {
    const response = await fetch('/api/account/me', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('AUTH_REQUIRED');
    const result = await response.json();
    if (result.needsOnboarding) {
      location.replace(`/login.html?setup=1&next=${encodeURIComponent(current)}`);
      return;
    }
    window.yorisoiAccount = result;
    window.yorisoiLogout = async () => {
      await fetch('/api/account/session', { method: 'DELETE', credentials: 'same-origin' });
      location.replace('/login.html');
    };
    document.documentElement.style.visibility = '';
  } catch {
    location.replace(`/login.html?next=${encodeURIComponent(current)}`);
  }
})();
