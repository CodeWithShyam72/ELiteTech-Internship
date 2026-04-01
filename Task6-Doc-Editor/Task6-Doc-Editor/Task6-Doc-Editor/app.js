/* ================================================
   CollabDocs - app.js
   Author: Shyam Ji
   Description: Real-Time Collaborative Document Editor
   Features:
   - Rich text editing (contenteditable + execCommand)
   - Multiple document management
   - Simulated real-time collaboration (BroadcastChannel API)
   - Live chat between collaborators
   - Activity log
   - Comments system
   - Word/character count
   - Auto-save to localStorage
   - Export as .txt
   - Share link generation
   Note: Real-time uses BroadcastChannel (same browser tabs)
         In production: use Socket.io + Node.js backend
================================================ */

/* ================================================
   APP STATE
================================================ */
let currentUser   = null;   // Logged-in user object
let userColor     = '#6c63ff';
let documents     = [];     // All documents array
let currentDocId  = null;   // Active document id
let saveTimer     = null;   // Debounce timer for auto-save
let collaborators = [];     // Simulated other users
let channel       = null;   // BroadcastChannel for real-time sync

/* ================================================
   LOGIN / JOIN
================================================ */
/**
 * Pick user color from the color picker dots
 */
function pickColor(el) {
  document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
  el.classList.add('active');
  userColor = el.dataset.color;
}

/**
 * Join the editor — sets up user and loads/creates documents
 */
function joinEditor() {
  const nameInput = document.getElementById('user-name-input');
  const name = nameInput.value.trim();
  if (!name) { nameInput.style.borderColor = '#ef4444'; nameInput.focus(); return; }

  currentUser = {
    id:      'user_' + Date.now(),
    name,
    color:   userColor,
    initials: name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
  };

  // Hide login, show editor
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('editor-app').style.display   = 'flex';

  initEditor();
}

/* ================================================
   EDITOR INIT
================================================ */
function initEditor() {
  // Setup current user avatar in navbar
  const avatar = document.getElementById('current-user-avatar');
  avatar.textContent       = currentUser.initials;
  avatar.style.background  = currentUser.color;
  avatar.title             = currentUser.name + ' (You)';

  // Load documents from localStorage
  const saved = localStorage.getItem('collabdocs_documents');
  if (saved) {
    documents = JSON.parse(saved);
  }

  // Create default doc if none exist
  if (documents.length === 0) {
    createDocument('Welcome Document', '<h2>Welcome to CollabDocs! ✨</h2><p>This is your collaborative document editor. Start typing, formatting, and collaborating in real time!</p><p>Try the toolbar above to <b>bold</b>, <i>italicize</i>, create <u>headings</u>, lists, and more.</p>');
  } else {
    renderDocList();
    loadDocument(documents[0].id);
  }

  // Setup BroadcastChannel for cross-tab real-time sync
  setupBroadcastChannel();

  // Simulate other collaborators joining
  simulateCollaborators();

  // Setup toolbar event listeners
  setupToolbar();

  // Setup editor input listener (auto-save + word count)
  const editor = document.getElementById('editor');
  editor.addEventListener('input', onEditorInput);
  editor.addEventListener('keyup', updateWordCount);
  editor.addEventListener('mouseup', updateToolbarState);
  editor.addEventListener('keyup', updateToolbarState);

  // Document title change listener
  document.getElementById('doc-title').addEventListener('input', onTitleChange);

  // Log join activity
  addActivity(currentUser.name + ' joined the document', currentUser.color);
}

/* ================================================
   BROADCAST CHANNEL (Real-Time Sync)
   Uses BroadcastChannel API to sync between browser tabs.
   In production: replace with Socket.io WebSocket events.
================================================ */
function setupBroadcastChannel() {
  if (!('BroadcastChannel' in window)) return;

  channel = new BroadcastChannel('collabdocs_channel');

  // Listen for messages from other tabs
  channel.onmessage = (event) => {
    const msg = event.data;
    switch (msg.type) {

      // Another user updated the document content
      case 'doc_update':
        if (msg.docId === currentDocId && msg.userId !== currentUser.id) {
          const editor = document.getElementById('editor');
          const savedPos = saveCaretPosition(editor);
          editor.innerHTML = msg.content;
          restoreCaretPosition(editor, savedPos);
          updateWordCount();
          setSaveStatus('saving');
          setTimeout(() => setSaveStatus('saved'), 800);
          addActivity(msg.userName + ' edited the document', msg.userColor);
        }
        break;

      // Another user sent a chat message
      case 'chat_message':
        if (msg.userId !== currentUser.id) {
          renderChatMessage(msg.userName, msg.text, msg.userColor, false);
        }
        break;

      // Another user joined
      case 'user_joined':
        if (msg.userId !== currentUser.id) {
          addCollaborator(msg);
          addActivity(msg.userName + ' joined', msg.userColor);
          showToast('👋 ' + msg.userName + ' joined the document!');
        }
        break;

      // Another user left
      case 'user_left':
        removeCollaborator(msg.userId);
        addActivity(msg.userName + ' left', msg.userColor);
        break;

      // Another user changed document title
      case 'title_change':
        if (msg.docId === currentDocId && msg.userId !== currentUser.id) {
          document.getElementById('doc-title').value = msg.title;
        }
        break;
    }
  };

  // Announce that current user has joined
  broadcast({ type: 'user_joined', ...currentUser });

  // Announce when user leaves the page
  window.addEventListener('beforeunload', () => {
    broadcast({ type: 'user_left', userId: currentUser.id, userName: currentUser.name });
  });
}

/** Broadcast a message to all other tabs */
function broadcast(data) {
  if (channel) channel.postMessage(data);
}

/* ================================================
   DOCUMENT MANAGEMENT
================================================ */

/**
 * Create a new document
 */
function createDocument(title = 'Untitled Document', content = '') {
  const doc = {
    id:        'doc_' + Date.now(),
    title,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  documents.unshift(doc);
  saveDocuments();
  renderDocList();
  loadDocument(doc.id);
  return doc;
}

/**
 * Load a document into the editor
 */
function loadDocument(id) {
  const doc = documents.find(d => d.id === id);
  if (!doc) return;

  currentDocId = id;
  document.getElementById('editor').innerHTML      = doc.content;
  document.getElementById('doc-title').value       = doc.title;
  setSaveStatus('saved');
  updateWordCount();
  renderDocList();
  addActivity('Opened "' + doc.title + '"', currentUser.color);
}

/**
 * Save all documents to localStorage
 */
function saveDocuments() {
  localStorage.setItem('collabdocs_documents', JSON.stringify(documents));
}

/**
 * Render the document list in the left sidebar
 */
function renderDocList() {
  const list = document.getElementById('doc-list');
  list.innerHTML = documents.map(doc => `
    <div class="doc-item ${doc.id === currentDocId ? 'active' : ''}"
         onclick="loadDocument('${doc.id}')">
      <div class="doc-item-title">📄 ${doc.title}</div>
      <div class="doc-item-meta">${formatDate(doc.updatedAt)}</div>
    </div>
  `).join('');
}

/** Create a new blank document from the sidebar button */
function newDocument() {
  createDocument('Untitled Document', '');
  document.getElementById('editor').focus();
  showToast('📄 New document created!');
}

/* ================================================
   EDITOR INPUT HANDLERS
================================================ */

/**
 * Called on every keypress in the editor
 * - Triggers auto-save (debounced)
 * - Broadcasts content change to other tabs
 */
function onEditorInput() {
  const editor  = document.getElementById('editor');
  const content = editor.innerHTML;
  const doc     = documents.find(d => d.id === currentDocId);

  if (doc) {
    doc.content   = content;
    doc.updatedAt = new Date().toISOString();
  }

  // Show "Saving..." status
  setSaveStatus('saving');

  // Debounce: save after 1s of no typing
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDocuments();
    renderDocList();
    setSaveStatus('saved');
  }, 1000);

  // Broadcast content change to other tabs (real-time)
  broadcast({
    type:      'doc_update',
    docId:     currentDocId,
    content,
    userId:    currentUser.id,
    userName:  currentUser.name,
    userColor: currentUser.color,
  });
}

/**
 * Called when document title is changed
 */
function onTitleChange() {
  const title = document.getElementById('doc-title').value;
  const doc   = documents.find(d => d.id === currentDocId);
  if (doc) {
    doc.title     = title;
    doc.updatedAt = new Date().toISOString();
    saveDocuments();
    renderDocList();
  }
  broadcast({ type: 'title_change', docId: currentDocId, title, userId: currentUser.id });
}

/** Update the save status indicator */
function setSaveStatus(status) {
  const el = document.getElementById('save-status');
  if (status === 'saving') { el.textContent = '⏳ Saving…'; el.classList.add('saving'); }
  else                     { el.textContent = '✓ Saved';    el.classList.remove('saving'); }
}

/* ================================================
   WORD COUNT
================================================ */
function updateWordCount() {
  const editor = document.getElementById('editor');
  const text   = editor.innerText || '';
  const words  = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars  = text.length;
  const mins   = Math.ceil(words / 200);

  document.getElementById('word-count').textContent = words + ' words';
  document.getElementById('char-count').textContent = chars + ' characters';
  document.getElementById('read-time').textContent  = mins + ' min read';
}

/* ================================================
   TOOLBAR
================================================ */

/**
 * Attach click handlers to all toolbar format buttons
 */
function setupToolbar() {
  document.querySelectorAll('.tb-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('editor').focus();
      document.execCommand(btn.dataset.cmd, false, null);
      updateToolbarState();
    });
  });
}

/** Apply a font size to selected text */
function applyFontSize(size) {
  document.getElementById('editor').focus();
  document.execCommand('fontSize', false, '7');
  // Override the default font size with a span
  document.querySelectorAll('font[size="7"]').forEach(el => {
    el.removeAttribute('size');
    el.style.fontSize = size + 'px';
  });
}

/** Apply heading format (h1, h2, h3) */
function applyHeading(tag) {
  document.getElementById('editor').focus();
  document.execCommand('formatBlock', false, tag);
  updateToolbarState();
}

/** Highlight selected text */
function applyHighlight() {
  document.getElementById('editor').focus();
  document.execCommand('hiliteColor', false, '#fef08a');
}

/** Clear all formatting from selection */
function clearFormat() {
  document.getElementById('editor').focus();
  document.execCommand('removeFormat', false, null);
  document.execCommand('formatBlock', false, 'p');
}

/** Update active state of toolbar buttons based on current selection */
function updateToolbarState() {
  const cmds = ['bold', 'italic', 'underline', 'strikeThrough',
                'justifyLeft', 'justifyCenter', 'justifyRight'];
  cmds.forEach(cmd => {
    const btn = document.querySelector(`.tb-btn[data-cmd="${cmd}"]`);
    if (btn) {
      btn.classList.toggle('active', document.queryCommandState(cmd));
    }
  });
}

/* ================================================
   CHAT
================================================ */

/**
 * Send a chat message
 */
function sendChat() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;

  // Render my message
  renderChatMessage(currentUser.name, text, currentUser.color, true);
  input.value = '';

  // Broadcast to other tabs
  broadcast({
    type:      'chat_message',
    userId:    currentUser.id,
    userName:  currentUser.name,
    userColor: currentUser.color,
    text,
  });

  // Simulate auto-reply from a collaborator (if any)
  if (collaborators.length > 0) {
    const bot = collaborators[0];
    const replies = [
      'Great point! 👍',
      'Agreed, let\'s keep going!',
      'I\'ll update that section.',
      'Looks good to me!',
      'Can you elaborate on that?',
    ];
    setTimeout(() => {
      const reply = replies[Math.floor(Math.random() * replies.length)];
      renderChatMessage(bot.name, reply, bot.color, false);
    }, 1000 + Math.random() * 2000);
  }
}

/**
 * Render a chat message bubble in the chat panel
 */
function renderChatMessage(name, text, color, isMine) {
  const container = document.getElementById('chat-messages');
  const initials  = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const time      = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

  const div = document.createElement('div');
  div.className = 'chat-msg ' + (isMine ? 'mine' : '');
  div.innerHTML = `
    <div class="chat-msg-header">
      <div class="chat-msg-avatar" style="background:${color}">${initials}</div>
      <span>${isMine ? 'You' : name}</span>
      <span>${time}</span>
    </div>
    <div class="chat-bubble">${escapeHtml(text)}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

/* ================================================
   ACTIVITY LOG
================================================ */
function addActivity(text, color) {
  const log = document.getElementById('activity-log');
  const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

  const div = document.createElement('div');
  div.className = 'activity-item';
  div.innerHTML = `
    <div class="activity-dot" style="background:${color}"></div>
    <div>
      <div>${text}</div>
      <div class="activity-time">${time}</div>
    </div>
  `;
  log.insertBefore(div, log.firstChild);
}

/* ================================================
   COMMENTS
================================================ */
function addComment() {
  const text = prompt('Add a comment:');
  if (!text || !text.trim()) return;

  const list = document.getElementById('comments-list');
  const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

  const div = document.createElement('div');
  div.className = 'comment-item';
  div.innerHTML = `
    <div class="comment-author" style="color:${currentUser.color}">${currentUser.name}</div>
    <div class="comment-text">${escapeHtml(text)}</div>
    <div class="comment-time">${time}</div>
  `;
  list.appendChild(div);
  showToast('🗒 Comment added!');
  addActivity(currentUser.name + ' added a comment', currentUser.color);
}

/* ================================================
   COLLABORATORS (Simulated)
================================================ */
const FAKE_USERS = [
  { id:'bot_1', name:'Priya Sharma',  color:'#ef4444', initials:'PS' },
  { id:'bot_2', name:'Rahul Verma',   color:'#10b981', initials:'RV' },
  { id:'bot_3', name:'Sneha Patel',   color:'#f59e0b', initials:'SP' },
];

/**
 * Simulate other users joining the document
 */
function simulateCollaborators() {
  // After 2 seconds, a simulated user "joins"
  setTimeout(() => {
    const bot = FAKE_USERS[0];
    addCollaborator(bot);
    collaborators.push(bot);
    addActivity(bot.name + ' joined', bot.color);
    showToast('👋 ' + bot.name + ' joined the document!');

    // Bot sends a welcome chat message
    setTimeout(() => {
      renderChatMessage(bot.name, 'Hey! Ready to collaborate? 🚀', bot.color, false);
    }, 1500);
  }, 2000);

  // After 5 seconds, another user joins
  setTimeout(() => {
    const bot2 = FAKE_USERS[1];
    addCollaborator(bot2);
    collaborators.push(bot2);
    addActivity(bot2.name + ' joined', bot2.color);
  }, 5000);
}

/**
 * Add a collaborator avatar to the topbar
 */
function addCollaborator(user) {
  const container = document.getElementById('active-users');
  const existing  = document.getElementById('avatar_' + user.id);
  if (existing) return;

  const div = document.createElement('div');
  div.className = 'user-bubble';
  div.id        = 'avatar_' + user.id;
  div.style.background = user.color;
  div.innerHTML = `
    ${user.initials}
    <div class="user-bubble-tooltip">${user.name}</div>
  `;
  container.appendChild(div);
}

/**
 * Remove a collaborator avatar from the topbar
 */
function removeCollaborator(userId) {
  const el = document.getElementById('avatar_' + userId);
  if (el) el.remove();
  collaborators = collaborators.filter(c => c.id !== userId);
}

/* ================================================
   RIGHT SIDEBAR TABS
================================================ */
function switchRsTab(tab, el) {
  document.querySelectorAll('.rs-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.rs-panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');
}

/* ================================================
   SHARE
================================================ */
function shareDoc() {
  const link = window.location.href + '?doc=' + currentDocId;
  document.getElementById('share-link-input').value = link;
  document.getElementById('share-modal').style.display = 'flex';
}

function closeShare(event) {
  if (event.target.id === 'share-modal') {
    document.getElementById('share-modal').style.display = 'none';
  }
}

function copyShareLink() {
  const input = document.getElementById('share-link-input');
  navigator.clipboard.writeText(input.value)
    .then(() => showToast('🔗 Link copied to clipboard!'))
    .catch(() => { input.select(); document.execCommand('copy'); showToast('🔗 Link copied!'); });
}

/* ================================================
   EXPORT
================================================ */
/**
 * Export current document as a .txt file
 */
function exportDoc() {
  const doc   = documents.find(d => d.id === currentDocId);
  if (!doc) return;

  const text  = document.getElementById('editor').innerText;
  const blob  = new Blob([doc.title + '\n\n' + text], { type: 'text/plain' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = (doc.title || 'document') + '.txt';
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇ Document exported as .txt!');
  addActivity('Document exported', currentUser.color);
}

/* ================================================
   CARET POSITION HELPERS
   Used to preserve cursor position during real-time updates
================================================ */
function saveCaretPosition(el) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range    = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function restoreCaretPosition(el, pos) {
  if (pos === null) return;
  const nodeIterator = document.createNodeIterator(el, NodeFilter.SHOW_TEXT);
  let node, charCount = 0;
  while ((node = nodeIterator.nextNode())) {
    if (charCount + node.length >= pos) {
      const range = document.createRange();
      const sel   = window.getSelection();
      range.setStart(node, pos - charCount);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    charCount += node.length;
  }
}

/* ================================================
   UTILITY FUNCTIONS
================================================ */

/** Escape HTML to prevent XSS in chat/comments */
function escapeHtml(text) {
  const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/** Format ISO date string to readable format */
function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

/* ================================================
   TOAST
================================================ */
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
