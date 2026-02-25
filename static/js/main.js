// ═══════════════════════════════════════
// THEME & ACCENT — apply immediately
// ═══════════════════════════════════════
(function() {
  const theme = localStorage.getItem('theme') || document.body.dataset.initTheme || 'light';
  const accent = localStorage.getItem('accent') || document.body.dataset.initAccent || '#6366f1';
  document.documentElement.setAttribute('data-theme', theme);
  applyAccent(accent);
})();

function applyAccent(color) {
  const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
  const c2 = `rgb(${Math.min(r+60,255)},${Math.min(g+20,255)},${Math.min(b+90,255)})`;
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-2', c2);
  document.documentElement.style.setProperty('--accent-grad', `linear-gradient(135deg,${color},${c2})`);
  localStorage.setItem('accent', color);
}
function setAccentColor(c) { applyAccent(c); }

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.querySelectorAll('.toggle-switch').forEach(b => b.classList.toggle('on', next==='dark'));
  return next;
}

// ═══════════════════════════════════════
// MODALS
// ═══════════════════════════════════════
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow='hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow=''; }
}
document.addEventListener('keydown', e => {
  if (e.key==='Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => {
    m.classList.remove('open'); document.body.style.overflow='';
  });
});

// ═══════════════════════════════════════
// CREATE POST — full AJAX with FormData
// ═══════════════════════════════════════
let selectedFiles = [];

function handleMediaSelect(input) {
  const files = Array.from(input.files);
  const space = 4 - selectedFiles.length;
  if (space <= 0) { showToast('Максимум 4 файли', 'error'); input.value=''; return; }
  selectedFiles.push(...files.slice(0, space));
  renderPreview();
  input.value = '';
}

function renderPreview() {
  const el = document.getElementById('media-preview');
  if (!el) return;
  if (!selectedFiles.length) { el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='flex';
  el.innerHTML = selectedFiles.map((f,i) => {
    const isImg = f.type.startsWith('image/');
    const isVid = f.type.startsWith('video/');
    const icon = f.type.startsWith('audio/') ? '🎵' : isVid ? '🎬' : '';
    return `<div class="media-preview-item">
      ${isImg ? `<img src="${URL.createObjectURL(f)}">` : isVid ? `<video src="${URL.createObjectURL(f)}"></video>` : `<div class="preview-type-icon">${icon}</div>`}
      <button type="button" class="media-preview-remove" onclick="removeFile(${i})">✕</button>
    </div>`;
  }).join('');
}

function removeFile(i) {
  selectedFiles.splice(i,1);
  renderPreview();
}

async function submitPost() {
  const textarea = document.getElementById('compose-text');
  const content = textarea ? textarea.value.trim() : '';
  if (!content && !selectedFiles.length) { showToast('Додайте текст або медіа', 'error'); return; }

  const btn = document.getElementById('submit-post-btn');
  const progress = document.getElementById('post-progress');
  if (btn) { btn.disabled=true; btn.textContent='...'; }
  if (progress) progress.style.display='block';

  const fd = new FormData();
  fd.append('content', content);
  selectedFiles.forEach(f => fd.append('media', f));

  try {
    const res = await fetch('/post', { method:'POST', body: fd });
    const data = await res.json();

    if (data.success) {
      // Insert post at top of feed
      const feed = document.getElementById('posts-feed');
      const empty = document.getElementById('empty-feed');
      if (empty) empty.remove();
      if (feed) {
        const html = buildPostHTML(data.post);
        feed.insertAdjacentHTML('afterbegin', html);
      }
      // Reset form
      if (textarea) textarea.value='';
      selectedFiles = [];
      renderPreview();
      closeModal('modal-post');
      showToast('Пост опубліковано! ✓', 'success');
    } else {
      showToast(data.error || 'Помилка', 'error');
    }
  } catch(e) {
    showToast('Помилка завантаження', 'error');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='Опублікувати'; }
    if (progress) progress.style.display='none';
  }
}

function buildPostHTML(post) {
  const avatarHtml = post.avatar_img
    ? `<img src="/static/uploads/${post.avatar_img}" class="avatar avatar-sm" style="object-fit:cover;">`
    : `<div class="avatar avatar-sm" style="background:${post.avatar_color}">${post.username[0].toUpperCase()}</div>`;

  let mediaHtml = '';
  if (post.media && post.media.length) {
    const count = post.media.length;
    mediaHtml = `<div class="post-media-grid post-media-${count}">`;
    post.media.forEach(m => {
      if (m.media_type === 'image') {
        mediaHtml += `<div class="post-media-item"><img src="/static/uploads/${m.filename}" loading="lazy"></div>`;
      } else if (m.media_type === 'video') {
        mediaHtml += `<div class="post-media-item"><video src="/static/uploads/${m.filename}" controls preload="metadata" playsinline></video></div>`;
      } else if (m.media_type === 'audio') {
        mediaHtml += `<div class="post-audio-wrap"><div class="post-audio-icon">🎵</div><div class="post-audio-info"><div class="post-audio-label">Аудіо</div><audio src="/static/uploads/${m.filename}" controls></audio></div></div>`;
      }
    });
    mediaHtml += '</div>';
  }

  const textHtml = post.content ? `<div class="post-text-content">${escHtml(post.content)}</div>` : '';

  return `<article class="post-card" id="post-${post.id}">
    <div class="post-header">
      <a href="/profile/${escHtml(post.username)}">${avatarHtml}</a>
      <div class="post-author-info">
        <a href="/profile/${escHtml(post.username)}" class="post-author-name">${escHtml(post.username)}</a>
        <div class="post-time">щойно</div>
      </div>
      <button class="post-menu-btn">···</button>
    </div>
    ${mediaHtml}
    <div class="post-tappable" data-post-id="${post.id}" style="position:relative;">
      ${textHtml}
      <span class="double-tap-heart">❤️</span>
    </div>
    <div class="post-actions">
      <button class="post-action-btn like-btn-ajax" data-post-id="${post.id}"><span class="heart-icon">🤍</span></button>
      <button class="post-action-btn" style="font-size:1.1rem;" onclick="toggleComments(${post.id})">💬</button>
      <button class="post-action-btn" style="font-size:1.1rem;">📤</button>
      <button class="post-action-btn post-save-btn" style="font-size:1.1rem;">🔖</button>
    </div>
    <div class="post-likes" id="likes-${post.id}" style="display:none;"></div>
    <button class="view-comments-btn" onclick="toggleComments(${post.id})"><span style="color:var(--text-3);">Додати коментар</span></button>
    <div class="comments-section" id="comments-${post.id}">
      <div class="comments-list"></div>
      <div class="comment-input-row" data-post-id="${post.id}">
        <div class="avatar avatar-xs" style="background:var(--accent)"></div>
        <input class="comment-input" type="text" placeholder="Коментар...">
        <button class="comment-post-btn">Відповісти</button>
      </div>
    </div>
  </article>`;
}

// Char counter
document.addEventListener('input', e => {
  if (e.target.id === 'compose-text') {
    const rem = 500 - e.target.value.length;
    const el = document.getElementById('compose-char');
    if (el) { el.textContent = rem; el.style.color = rem < 20 ? '#ef4444' : 'var(--text-3)'; }
  }
});

// ═══════════════════════════════════════
// LIKES — AJAX, no reload
// ═══════════════════════════════════════
document.addEventListener('click', async e => {
  const btn = e.target.closest('.like-btn-ajax');
  if (!btn) return;
  e.preventDefault();
  const postId = btn.dataset.postId;
  const heartEl = btn.querySelector('.heart-icon');

  // Optimistic update
  const wasLiked = btn.classList.contains('liked');
  btn.classList.toggle('liked', !wasLiked);
  heartEl.textContent = wasLiked ? '🤍' : '❤️';
  heartEl.classList.add('heart-burst');
  setTimeout(() => heartEl.classList.remove('heart-burst'), 400);

  try {
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: 'POST', headers: {'Content-Type':'application/json'}
    });
    const data = await res.json();
    btn.classList.toggle('liked', data.liked);
    heartEl.textContent = data.liked ? '❤️' : '🤍';
    const likesEl = document.getElementById(`likes-${postId}`);
    if (likesEl) {
      if (data.count > 0) {
        likesEl.style.display = '';
        likesEl.textContent = `${data.count} ${data.count===1?'вподобання':'вподобань'}`;
      } else {
        likesEl.style.display = 'none';
      }
    }
  } catch(err) {
    // revert on error
    btn.classList.toggle('liked', wasLiked);
    heartEl.textContent = wasLiked ? '❤️' : '🤍';
  }
});

// ═══════════════════════════════════════
// DOUBLE TAP TO LIKE
// ═══════════════════════════════════════
const tapTimes = {};
document.addEventListener('click', e => {
  const area = e.target.closest('.post-tappable');
  if (!area) return;
  const id = area.dataset.postId;
  const now = Date.now();
  if (tapTimes[id] && now - tapTimes[id] < 350) {
    tapTimes[id] = 0;
    const heart = area.querySelector('.double-tap-heart');
    if (heart) { heart.classList.remove('show'); void heart.offsetWidth; heart.classList.add('show'); }
    const likeBtn = document.querySelector(`.like-btn-ajax[data-post-id="${id}"]`);
    if (likeBtn && !likeBtn.classList.contains('liked')) likeBtn.click();
  } else { tapTimes[id] = now; }
});

// ═══════════════════════════════════════
// COMMENTS — AJAX
// ═══════════════════════════════════════
async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;
  if (section.classList.contains('open')) { section.classList.remove('open'); return; }

  try {
    const res = await fetch(`/api/comments/${postId}`);
    const comments = await res.json();
    const list = section.querySelector('.comments-list');
    list.innerHTML = comments.length
      ? comments.map(c => `
        <div class="comment-item">
          <div class="avatar avatar-xs" style="background:${c.avatar_color}">${c.username[0].toUpperCase()}</div>
          <div class="comment-body">
            <a href="/profile/${escHtml(c.username)}" class="comment-author">${escHtml(c.username)}</a>
            <span class="comment-text"> ${escHtml(c.content)}</span>
            <div class="comment-time">${timeAgo(c.created_at)}</div>
          </div>
        </div>`).join('')
      : '<p style="color:var(--text-3);font-size:0.8rem;padding:4px 0;">Поки немає коментарів</p>';
    section.classList.add('open');
  } catch(e) { console.error(e); }
}

document.addEventListener('input', e => {
  const input = e.target.closest('.comment-input');
  if (!input) return;
  const btn = input.closest('.comment-input-row')?.querySelector('.comment-post-btn');
  if (btn) btn.classList.toggle('active', input.value.trim().length > 0);
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
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({content})
    });
    const comment = await res.json();
    input.value=''; btn.classList.remove('active');
    const list = document.querySelector(`#comments-${postId} .comments-list`);
    const empty = list.querySelector('p');
    if (empty) empty.remove();
    const el = document.createElement('div');
    el.className='comment-item';
    el.innerHTML=`<div class="avatar avatar-xs" style="background:${comment.avatar_color}">${comment.username[0].toUpperCase()}</div>
      <div class="comment-body"><a href="/profile/${escHtml(comment.username)}" class="comment-author">${escHtml(comment.username)}</a><span class="comment-text"> ${escHtml(comment.content)}</span><div class="comment-time">щойно</div></div>`;
    list.appendChild(el);
    // Update count button
    const viewBtn = document.querySelector(`#post-${postId} .view-comments-btn`);
    if (viewBtn) {
      const m = viewBtn.textContent.match(/\d+/);
      const n = m ? parseInt(m[0])+1 : 1;
      viewBtn.innerHTML = `Переглянути всі коментарі (${n})`;
    }
  } catch(e) { console.error(e); }
});

// ═══════════════════════════════════════
// FOLLOW — AJAX
// ═══════════════════════════════════════
document.addEventListener('click', async e => {
  const btn = e.target.closest('.follow-btn-ajax');
  if (!btn) return;
  e.preventDefault();
  const uid = btn.dataset.userId;
  try {
    const res = await fetch(`/follow/${uid}`, {method:'POST', headers:{'X-Requested-With':'XMLHttpRequest'}});
    const data = await res.json();
    btn.classList.toggle('following', data.following);
    btn.textContent = data.following ? 'Підписаний' : 'Підписатись';
  } catch(e) {}
});

// ═══════════════════════════════════════
// NOTIFICATIONS COUNT
// ═══════════════════════════════════════
async function checkNotifications() {
  try {
    const res = await fetch('/notifications/count');
    const {count} = await res.json();
    document.querySelectorAll('[data-notif]').forEach(el => el.classList.toggle('show', count > 0));
  } catch(e) {}
}
document.addEventListener('DOMContentLoaded', () => {
  checkNotifications();
  setInterval(checkNotifications, 30000);
});

// ═══════════════════════════════════════
// VOICE RECORDING
// ═══════════════════════════════════════
let mediaRecorder=null, recordedChunks=[], voiceInterval=null, voiceSeconds=0;

async function toggleVoiceRecord() {
  if (mediaRecorder && mediaRecorder.state==='recording') { stopVoiceRecord(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    recordedChunks=[];
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
    mediaRecorder = new MediaRecorder(stream, {mimeType:mime});
    mediaRecorder.ondataavailable = e => { if(e.data.size>0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t=>t.stop());
      const blob = new Blob(recordedChunks, {type:mime});
      const ext = mime.includes('webm') ? 'webm' : 'ogg';
      const file = new File([blob], `voice_${Date.now()}.${ext}`, {type:mime});
      if (selectedFiles.length<4) { selectedFiles.push(file); renderPreview(); }
      clearInterval(voiceInterval); voiceSeconds=0;
      document.getElementById('voice-ui').style.display='none';
      document.getElementById('voice-btn')?.classList.remove('recording');
    };
    mediaRecorder.start();
    document.getElementById('voice-ui').style.display='block';
    document.getElementById('voice-btn')?.classList.add('recording');
    voiceInterval = setInterval(() => {
      voiceSeconds++;
      const m=Math.floor(voiceSeconds/60), s=voiceSeconds%60;
      const el=document.getElementById('voice-timer');
      if(el) el.textContent=`${m}:${s.toString().padStart(2,'0')}`;
    }, 1000);
  } catch(e) { showToast('Немає доступу до мікрофону','error'); }
}

function stopVoiceRecord() { if(mediaRecorder?.state==='recording') mediaRecorder.stop(); }
function cancelVoiceRecord() {
  if(mediaRecorder?.state==='recording') mediaRecorder.stop();
  clearInterval(voiceInterval); voiceSeconds=0;
  document.getElementById('voice-ui').style.display='none';
  document.getElementById('voice-btn')?.classList.remove('recording');
  recordedChunks=[];
}

// ═══════════════════════════════════════
// STORY AUTO-REDIRECT
// ═══════════════════════════════════════
const storyBar = document.querySelector('.story-progress-bar');
if (storyBar) {
  const nextId = storyBar.dataset.nextId;
  setTimeout(() => { window.location.href = nextId ? `/story/${nextId}` : '/'; }, 5000);
}

// ═══════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════
function showToast(msg, type='success') {
  let container = document.querySelector('.flash-container');
  if (!container) {
    container = document.createElement('div');
    container.className='flash-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className=`flash-item ${type}`;
  el.textContent=msg;
  container.appendChild(el);
  setTimeout(() => { el.style.transition='opacity 0.4s'; el.style.opacity='0'; setTimeout(()=>el.remove(),400); }, 3000);
}

// Flash auto-dismiss
setTimeout(() => {
  document.querySelectorAll('.flash-item').forEach(el => {
    el.style.transition='opacity 0.5s';
    el.style.opacity='0';
    setTimeout(()=>el.remove(),500);
  });
}, 3500);

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function timeAgo(d) {
  const diff = Date.now() - new Date(d.includes('Z')||d.includes('+')?d:d+'Z').getTime();
  const m=Math.floor(diff/60000);
  if(m<1) return 'щойно';
  if(m<60) return `${m} хв`;
  const h=Math.floor(m/60);
  if(h<24) return `${h} год`;
  return `${Math.floor(h/24)} дн`;
}

// ═══════════════════════════════════════
// POST MENU
// ═══════════════════════════════════════
function togglePostMenu(postId) {
  const menu = document.getElementById(`menu-${postId}`);
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  // Close all menus first
  document.querySelectorAll('.post-menu-dropdown.open').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}
function closePostMenu(postId) {
  document.getElementById(`menu-${postId}`)?.classList.remove('open');
}
// Close menus on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.post-menu-wrap')) {
    document.querySelectorAll('.post-menu-dropdown.open').forEach(m => m.classList.remove('open'));
  }
});

// ═══════════════════════════════════════
// DELETE POST (from feed)
// ═══════════════════════════════════════
async function deletePostFromFeed(postId) {
  if (!confirm('Видалити пост?')) return;
  try {
    const res = await fetch(`/api/posts/${postId}/delete`, {method:'POST'});
    const data = await res.json();
    if (data.deleted) {
      const el = document.getElementById(`post-${postId}`);
      if (el) {
        el.style.transition = 'opacity 0.3s, transform 0.3s, max-height 0.4s';
        el.style.opacity = '0'; el.style.transform = 'translateX(-20px)';
        setTimeout(() => el.remove(), 350);
      }
      showToast('Пост видалено ✓', 'success');
    }
  } catch(e) { showToast('Помилка', 'error'); }
}

// ═══════════════════════════════════════
// REACTIONS (long press or hold)
// ═══════════════════════════════════════
let reactionTimer = null;
let reactionOpen = null;

document.addEventListener('pointerdown', e => {
  const btn = e.target.closest('[data-long-press]');
  if (!btn) return;
  const postId = btn.dataset.longPress;
  reactionTimer = setTimeout(() => {
    closeAllReactions();
    const picker = document.getElementById(`reactions-${postId}`);
    if (picker) { picker.classList.add('open'); reactionOpen = postId; }
  }, 500);
});

document.addEventListener('pointerup', () => {
  clearTimeout(reactionTimer); reactionTimer = null;
});
document.addEventListener('pointercancel', () => {
  clearTimeout(reactionTimer); reactionTimer = null;
});

// Close reactions on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.reaction-wrap') && reactionOpen) {
    closeAllReactions();
  }
});

function closeAllReactions() {
  document.querySelectorAll('.reaction-picker.open').forEach(p => p.classList.remove('open'));
  reactionOpen = null;
}

async function pickReaction(postId, emoji) {
  closeAllReactions();
  const btn = document.querySelector(`.like-btn-ajax[data-post-id="${postId}"]`);
  const heartEl = btn?.querySelector('.heart-icon');
  if (!btn || !heartEl) return;

  // Animate
  heartEl.textContent = emoji;
  heartEl.classList.add('heart-burst');
  btn.classList.add('liked');
  setTimeout(() => heartEl.classList.remove('heart-burst'), 400);

  try {
    const res = await fetch(`/api/posts/${postId}/like`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({emoji})
    });
    const data = await res.json();
    if (!data.liked) { btn.classList.remove('liked'); heartEl.textContent = '🤍'; }
    const likesEl = document.getElementById(`likes-${postId}`);
    if (likesEl) {
      if (data.count > 0) { likesEl.style.display=''; likesEl.textContent=`${data.count} ${data.count===1?'вподобання':'вподобань'}`; }
      else likesEl.style.display='none';
    }
  } catch(e) {}
}

// ═══════════════════════════════════════
// DELETE COMMENT (updated comment render)
// ═══════════════════════════════════════
// Override toggleComments to include delete buttons
const _origToggleComments = window.toggleComments;
window.toggleComments = async function(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;
  if (section.classList.contains('open')) { section.classList.remove('open'); return; }
  try {
    const res = await fetch(`/api/comments/${postId}`);
    const comments = await res.json();
    const list = section.querySelector('.comments-list');
    const myId = document.body.dataset.userId || 0;
    list.innerHTML = comments.length
      ? comments.map(c => `
        <div class="comment-item" id="comment-${c.id}">
          <div class="avatar avatar-xs" style="background:${c.avatar_color}">
            ${c.avatar_img ? `<img src="/static/uploads/${c.avatar_img}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : c.username[0].toUpperCase()}
          </div>
          <div class="comment-body" style="flex:1;">
            <a href="/profile/${escHtml(c.username)}" class="comment-author">${escHtml(c.username)}</a>
            <span class="comment-text"> ${escHtml(c.content)}</span>
            <div class="comment-time">${timeAgo(c.created_at)}</div>
          </div>
          <button class="comment-delete-btn" onclick="deleteComment(${c.id})">✕</button>
        </div>`).join('')
      : '<p style="color:var(--text-3);font-size:0.8rem;padding:4px 0;">Поки немає коментарів</p>';
    section.classList.add('open');
  } catch(e) { console.error(e); }
};

async function deleteComment(commentId) {
  try {
    const res = await fetch(`/api/comments/${commentId}/delete`, {method:'POST'});
    const data = await res.json();
    if (data.deleted) {
      const el = document.getElementById(`comment-${commentId}`);
      if (el) { el.style.opacity='0'; el.style.transition='opacity 0.2s'; setTimeout(()=>el.remove(),200); }
    }
  } catch(e) { showToast('Помилка', 'error'); }
}

// ═══════════════════════════════════════
// SHARE POST
// ═══════════════════════════════════════
function sharePost(postId) {
  const url = `${window.location.origin}/post/${postId}`;
  if (navigator.share) {
    navigator.share({ title: 'MySocial', url });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => showToast('Посилання скопійовано 📋', 'success'));
  } else {
    showToast('Посилання: ' + url, 'success');
  }
}