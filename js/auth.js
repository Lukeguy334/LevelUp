// auth.js — shared session helpers used by every page.

async function requireSession(redirectTo = 'index.html') {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

window.LevelUpAuth = { requireSession, signOut };
