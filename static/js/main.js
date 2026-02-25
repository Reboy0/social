// ═══════════════════════════════════════
// THEME & ACCENT
// ═══════════════════════════════════════
(function() {
  const theme = localStorage.getItem('theme') || document.body.dataset.initTheme || 'light';
  const accent = localStorage.getItem('accent') || document.body.dataset.initAccent || '#6366f1';
  document.documentElement.setAttribute('data-theme', theme);
  setAccentColor(accent);
})();

function setAccentColor(color) {
  // Generate gradient from single color
  const lighter = color;
  const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
  const lighter2 = `rgba(${Math.min(r+60,255)},${Math.min(g+30,255)},${Math.min(b+80,255)},1)`;
  document.documentElement.style.setProperty('--accent', lighter);
  document.documentElement.style.setProperty('--accent-2', lighter2);
  document.documentElement.style.setProperty('--accent-grad', `linear-gradient(135deg, ${lighter}, ${lighter2})`);
  localStorage.setItem('accent', color);
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.querySelector('.toggle-switch');
  if (btn) btn.classList.toggle('on', next === 'dark');
  return next;
}

// ═══════════════════════════════════════
// MODALS
// ═══════════════════════════════════════
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open');
      document.body.style.overflow = '';
    });
  }
});

// ═══════════════════════════════════════
// LIKES (AJAX)
// ═══════════════════════════════════════
document.addEventListener('click', async e => {
  const btn = e.target.closest('.like-btn-ajax');
  if (!btn) return;
  e.preventDefault();
  const postId = btn.dataset.postId;
  const heartEl = btn.querySelector('.heart-icon');

  try {
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    });
    const data = await res.json();

    btn.classList.toggle('liked', data.liked);
    heartEl.textContent = data.liked ? '❤️' : '🤍';
    heartEl.classList.add('heart-burst');
    setTimeout(() => heartEl.classList.remove('heart-burst'), 400);

    const countEl = btn.closest('.post-actions')?.nextElementSibling;
    if (countEl && countEl.classList.contains('post-likes')) {
      countEl.textContent = data.count === 1 ? '1 вподобання' : `${data.count} вподобань`;
    }
  } catch(err) { console.error(err); }
});

// ═══════════════════════════════════════
// DOUBLE TAP TO LIKE
// ═══════════════════════════════════════
const tapTimes = {};

document.addEventListener('click', async e => {
  const postContent = e.target.closest('.post-tappable');
  if (!postContent) return;
  const postId = postContent.dataset.postId;
  const now = Date.now();

  if (tapTimes[postId] && now - tapTimes[postId] < 400) {
    tapTimes[postId] = 0;
    // Show heart animation
    const heart = postContent.querySelector('.double-tap-heart');
    if (heart) {
      heart.classList.remove('show');
      void heart.offsetWidth; // reflow
      heart.classList.add('show');
    }
    // Like via API
    const likeBtn = document.querySelector(`.like-btn-ajax[data-post-id="${postId}"]`);
    if (likeBtn && !likeBtn.classList.contains('liked')) {
      likeBtn.click();
    }
  } else {
    tapTimes[postId] = now;
  }
});

// ═══════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════
document.addEventListener('click', async e => {
  const btn = e.target.closest('.view-comments-btn');
  if (!btn) return;
  const postId = btn.dataset.postId;
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;

  if (section.classList.contains('open')) {
    section.classList.remove('open');
    return;
  }

  // Load comments
  try {
    const res = await fetch(`/api/comments/${postId}`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    const comments = await res.json();
    const list = section.querySelector('.comments-list');
    list.innerHTML = comments.length === 0
      ? '<p style="color:var(--text-3);font-size:0.8rem;padding:8px 0">Поки немає коментарів</p>'
      : comments.map(c => `
        <div class="comment-item">
          <div class="avatar avatar-xs" style="background:${c.avatar_color}">${c.username[0].toUpperCase()}</div>
          <div class="comment-body">
            <span class="comment-author">${escHtml(c.username)}</span>
            <span class="comment-text"> ${escHtml(c.content)}</span>
            <div class="comment-time">${timeAgo(c.created_at)}</div>
          </div>
        </div>
      `).join('');
    section.classList.add('open');
  } catch(err) { console.error(err); }
});

document.addEventListener('input', e => {
  const input = e.target.closest('.comment-input');
  if (!input) return;
  const postBtn = input.closest('.comment-input-row')?.querySelector('.comment-post-btn');
  if (postBtn) postBtn.classList.toggle('active', input.value.trim().length > 0);
});

document.addEventListener('click', async e => {
  const btn = e.target.closest('.comment-post-btn.active');
  if (!btn) return;
  const row = btn.closest('.comment-input-row');
  const input = row.querySelector('.comment-input');
  const postId = row.dataset.postId;
  const content = input.value.trim();
  if (!content) return;

  try {
    const res = await fetch(`/api/comments/${postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const comment = await res.json();
    input.value = '';
    btn.classList.remove('active');

    const list = document.querySelector(`#comments-${postId} .comments-list`);
    const emptyMsg = list.querySelector('p');
    if (emptyMsg) emptyMsg.remove();
    const newEl = document.createElement('div');
    newEl.className = 'comment-item';
    newEl.innerHTML = `
      <div class="avatar avatar-xs" style="background:${comment.avatar_color}">${comment.username[0].toUpperCase()}</div>
      <div class="comment-body">
        <span class="comment-author">${escHtml(comment.username)}</span>
        <span class="comment-text"> ${escHtml(comment.content)}</span>
        <div class="comment-time">щойно</div>
      </div>
    `;
    list.appendChild(newEl);

    // Update comment count
    const countBtn = document.querySelector(`.view-comments-btn[data-post-id="${postId}"]`);
    if (countBtn) {
      const match = countBtn.textContent.match(/\d+/);
      const count = match ? parseInt(match[0]) + 1 : 1;
      countBtn.textContent = `Переглянути всі коментарі (${count})`;
    }
  } catch(err) { console.error(err); }
});

// ═══════════════════════════════════════
// FOLLOW (AJAX)
// ═══════════════════════════════════════
document.addEventListener('click', async e => {
  const btn = e.target.closest('.follow-btn-ajax');
  if (!btn) return;
  e.preventDefault();
  const userId = btn.dataset.userId;

  try {
    const res = await fetch(`/follow/${userId}`, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    const data = await res.json();
    btn.classList.toggle('following', data.following);
    btn.textContent = data.following ? 'Підписаний' : 'Підписатись';
  } catch(err) { console.error(err); }
});

// ═══════════════════════════════════════
// NOTIFICATIONS COUNT
// ═══════════════════════════════════════
async function checkNotifications() {
  try {
    const res = await fetch('/notifications/count');
    const data = await res.json();
    document.querySelectorAll('.notif-dot, .bnav-badge[data-notif], .nav-badge[data-notif]').forEach(el => {
      el.classList.toggle('show', data.count > 0);
    });
  } catch(err) {}
}
// Check on load
document.addEventListener('DOMContentLoaded', checkNotifications);

// ═══════════════════════════════════════
// SEARCH (LIVE)
// ═══════════════════════════════════════
let searchTimeout;
const searchInput = document.querySelector('.search-input');
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const q = searchInput.value.trim();
      if (q) {
        window.location.href = `/search?q=${encodeURIComponent(q)}`;
      }
    }, 500);
  });
}

// ═══════════════════════════════════════
// COLOR SWATCHES
// ═══════════════════════════════════════
document.querySelectorAll('.color-swatch[data-color]').forEach(swatch => {
  swatch.addEventListener('click', () => {
    const group = swatch.closest('.color-grid, .story-bg-picker');
    group?.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
    const target = swatch.dataset.target;
    if (target) {
      const input = document.querySelector(`input[name="${target}"]`);
      if (input) input.value = swatch.dataset.color;
    }
    if (swatch.dataset.type === 'accent') {
      setAccentColor(swatch.dataset.color);
      previewAccent(swatch.dataset.color);
    }
  });
});

function previewAccent(color) {
  setAccentColor(color);
}

// ═══════════════════════════════════════
// COMPOSE CHAR COUNT
// ═══════════════════════════════════════
document.querySelectorAll('.compose-textarea').forEach(ta => {
  const counter = ta.closest('.modal-sheet, .compose-wrap')?.querySelector('.compose-char');
  if (!counter) return;
  const limit = parseInt(ta.dataset.limit || 500);
  ta.addEventListener('input', () => {
    const rem = limit - ta.value.length;
    counter.textContent = rem;
    counter.style.color = rem < 20 ? '#ef4444' : 'var(--text-3)';
  });
});

// ═══════════════════════════════════════
// FLASH AUTO-DISMISS
// ═══════════════════════════════════════
setTimeout(() => {
  document.querySelectorAll('.flash-item').forEach(el => {
    el.style.transition = 'opacity 0.5s, transform 0.5s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    setTimeout(() => el.remove(), 500);
  });
}, 3500);

// ═══════════════════════════════════════
// STORY AUTO-REDIRECT
// ═══════════════════════════════════════
const storyProgress = document.querySelector('.story-progress-bar');
if (storyProgress) {
  const nextId = storyProgress.dataset.nextId;
  setTimeout(() => {
    if (nextId) window.location.href = `/story/${nextId}`;
    else window.location.href = '/';
  }, 5000);
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr + 'Z').getTime();
  const mins = Math.floor(diff/60000);
  if (mins < 1) return 'щойно';
  if (mins < 60) return `${mins} хв`;
  const hrs = Math.floor(mins/60);
  if (hrs < 24) return `${hrs} год`;
  return `${Math.floor(hrs/24)} дн`;
}