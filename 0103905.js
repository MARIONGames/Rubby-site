/* ===== State ===== */
let sessionId = null;
let selectedModality = 'auto';
let isLoading = false;
let conversations = {};

/* ===== DOM refs ===== */
const chatArea     = document.getElementById('chat-area');
const welcome      = document.getElementById('welcome');
const userInput    = document.getElementById('user-input');
const sendBtn      = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const convList     = document.getElementById('conversations-list');
const newChatBtn   = document.getElementById('new-chat-btn');
const tempSlider   = document.getElementById('temp-slider');
const tempVal      = document.getElementById('temp-val');
const maxTokens    = document.getElementById('max-tokens-input');
const settingsPanel= document.getElementById('settings-panel');
const settingsToggle=document.getElementById('settings-toggle');
const topbarTitle  = document.getElementById('topbar-title');
const sidebar      = document.getElementById('sidebar');
const menuBtn      = document.getElementById('menu-btn');

/* ===== Init ===== */
window.addEventListener('DOMContentLoaded', () => {
  loadConversations();
  newSession();
});

/* ===== Settings ===== */
tempSlider.addEventListener('input', () => {
  tempVal.textContent = parseFloat(tempSlider.value).toFixed(2);
});
settingsToggle.addEventListener('click', () => {
  settingsPanel.classList.toggle('open');
});

/* ===== Sidebar mobile ===== */
menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 640 && !sidebar.contains(e.target) && e.target !== menuBtn) {
    sidebar.classList.remove('open');
  }
});

/* ===== Modality selector ===== */
document.querySelectorAll('.modality-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.modality-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedModality = btn.dataset.modality;
  });
});

/* ===== Welcome chips ===== */
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const prompt = chip.dataset.prompt;
    const mod = chip.dataset.modality;
    if (mod) setModality(mod);
    userInput.value = prompt;
    autoResize();
    sendMessage();
  });
});

function setModality(mod) {
  selectedModality = mod;
  document.querySelectorAll('.modality-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.modality === mod);
  });
}

/* ===== Auto-resize textarea ===== */
function autoResize() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
}
userInput.addEventListener('input', autoResize);

/* ===== Keyboard ===== */
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
sendBtn.addEventListener('click', sendMessage);

/* ===== New session ===== */
function newSession() {
  sessionId = null;
  clearMessages();
  welcome.style.display = 'flex';
  topbarTitle.textContent = 'New Chat';
  document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('active'));
}
newChatBtn.addEventListener('click', () => {
  newSession();
  if (window.innerWidth <= 640) sidebar.classList.remove('open');
});

function clearMessages() {
  // Remove all messages but keep welcome + typing indicator
  Array.from(chatArea.children).forEach(child => {
    if (child.id !== 'welcome' && child.id !== 'typing-indicator') {
      chatArea.removeChild(child);
    }
  });
  chatArea.insertBefore(welcome, typingIndicator);
}

/* ===== Send message ===== */
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isLoading) return;

  welcome.style.display = 'none';
  appendMessage('user', text);
  userInput.value = '';
  autoResize();

  setLoading(true);

  try {
    const body = {
      message: text,
      session_id: sessionId,
      modality: selectedModality,
      temperature: parseFloat(tempSlider.value),
      max_tokens: parseInt(maxTokens.value),
    };

    const res = await fetch('http://127.0.0.1:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.error) {
      appendMessage('assistant', `⚠️ Error: ${data.error}`, {});
    } else {
      sessionId = data.session_id;
      appendMessage('assistant', data.text, data);
      // Refresh sidebar
      loadConversations();
      highlightSession(sessionId);
    }
  } catch (err) {
    appendMessage('assistant', `⚠️ Network error: ${err.message}`, {});
  } finally {
    setLoading(false);
  }
}

function setLoading(val) {
  isLoading = val;
  sendBtn.disabled = val;
  typingIndicator.classList.toggle('visible', val);
  if (val) chatArea.scrollTop = chatArea.scrollHeight;
}

/* ===== Append message ===== */
function appendMessage(role, text, data = {}) {
  const msg = document.createElement('div');
  msg.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? 'U' : 'R';

  const col = document.createElement('div');

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = renderMarkdown(text);

  // Image
  if (data.image_url) {
    const img = document.createElement('img');
    img.src = data.image_url;
    img.alt = 'Generated image';
    img.loading = 'lazy';
    bubble.appendChild(img);
  }

  // Video / GIF
  if (data.video_url) {
    const img = document.createElement('img');
    img.src = data.video_url;
    img.alt = 'Generated video';
    img.className = 'gif';
    bubble.appendChild(img);
  }

  // 3D model download
  if (data.model_url) {
    const a = document.createElement('a');
    a.href = data.model_url;
    a.download = '';
    a.className = 'download-link';
    a.textContent = '⬇ Download 3D Model (.obj)';
    bubble.appendChild(a);
  }

  // Search results
  if (data.search_results && data.search_results.length) {
    const sr = document.createElement('div');
    sr.className = 'search-results';
    data.search_results.forEach(r => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `<a href="${r.url}" target="_blank" rel="noopener">${escapeHtml(r.title)}</a>
        <div class="search-result-snippet">${escapeHtml(r.snippet || '')}</div>`;
      sr.appendChild(item);
    });
    bubble.appendChild(sr);
  }

  // Thinking
  if (data.thinking && data.thinking.length) {
    const btn = document.createElement('button');
    btn.className = 'thinking-toggle';
    btn.textContent = '🧠 Show reasoning';
    const content = document.createElement('div');
    content.className = 'thinking-content';
    content.innerHTML = data.thinking.map(t => `<p>${escapeHtml(String(t))}</p>`).join('');
    btn.addEventListener('click', () => {
      content.classList.toggle('open');
      btn.textContent = content.classList.contains('open') ? '🧠 Hide reasoning' : '🧠 Show reasoning';
    });
    bubble.appendChild(btn);
    bubble.appendChild(content);
  }

  col.appendChild(bubble);

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const ts = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  const modalityTag = data.modality && data.modality !== 'text' ? ` · ${data.modality}` : '';
  meta.textContent = ts + modalityTag;
  col.appendChild(meta);

  msg.appendChild(avatar);
  msg.appendChild(col);

  chatArea.insertBefore(msg, typingIndicator);
  chatArea.scrollTop = chatArea.scrollHeight;
}

/* ===== Markdown renderer ===== */
function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtmlPreserveCode(text);

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = lang || 'code';
    const id = 'cb_' + Math.random().toString(36).slice(2);
    return `<div class="code-block">
      <div class="code-block-header">
        <span>${escapeHtml(langLabel)}</span>
        <button class="copy-btn" onclick="copyCode('${id}')">Copy</button>
      </div>
      <pre id="${id}">${code.trimEnd()}</pre>
    </div>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Blockquote
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  // HR
  html = html.replace(/^---+$/gm, '<hr>');
  // Unordered list
  html = html.replace(/^\s*[-*+] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  // Ordered list
  html = html.replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>');
  // Links
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Line breaks → paragraphs
  html = html.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  if (!html.startsWith('<')) html = `<p>${html}</p>`;
  return html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function escapeHtmlPreserveCode(str) {
  // We need to escape HTML but then process markdown; do a two-pass
  // to preserve code fences. Escape everything first then unescape inside fences.
  let result = '';
  let i = 0;
  while (i < str.length) {
    if (str.startsWith('```', i)) {
      const end = str.indexOf('```', i + 3);
      if (end !== -1) {
        const block = str.slice(i, end + 3);
        result += block; // leave code block unescaped (will process after)
        i = end + 3;
      } else {
        result += escapeHtml(str[i]);
        i++;
      }
    } else {
      result += escapeHtml(str[i]);
      i++;
    }
  }
  return result;
}

/* ===== Copy code ===== */
function copyCode(id) {
  const pre = document.getElementById(id);
  if (!pre) return;
  navigator.clipboard.writeText(pre.textContent).then(() => showToast('Copied!'));
}

/* ===== Toast ===== */
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

/* ===== Load conversations from server ===== */
async function loadConversations() {
  try {
    const res = await fetch('http://127.0.0.1:5000/api/conversations');
    const data = await res.json();
    renderConversationList(data.sessions || []);
  } catch (e) { /* ignore */ }
}

function renderConversationList(sessions) {
  convList.innerHTML = '';
  if (!sessions.length) {
    convList.innerHTML = '<div style="padding:12px;font-size:0.78rem;color:var(--text-muted)">No conversations yet</div>';
    return;
  }
  sessions.forEach(s => {
    const item = document.createElement('div');
    item.className = 'conv-item' + (s.session_id === sessionId ? ' active' : '');
    item.dataset.sid = s.session_id;

    const title = document.createElement('div');
    title.className = 'conv-item-title';
    title.textContent = s.preview || 'Conversation';

    const meta = document.createElement('div');
    meta.className = 'conv-item-meta';
    meta.textContent = s.message_count + ' msgs · ' + formatDate(s.updated_at);

    const del = document.createElement('button');
    del.className = 'conv-delete-btn';
    del.textContent = '✕';
    del.title = 'Delete';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteConversation(s.session_id);
    });

    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(del);
    item.addEventListener('click', () => loadSession(s.session_id));
    convList.appendChild(item);
  });
}

function highlightSession(sid) {
  document.querySelectorAll('.conv-item').forEach(i => {
    i.classList.toggle('active', i.dataset.sid === sid);
  });
}

async function loadSession(sid) {
  if (sid === sessionId) return;
  sessionId = sid;
  clearMessages();
  welcome.style.display = 'none';
  highlightSession(sid);
  if (window.innerWidth <= 640) sidebar.classList.remove('open');

  try {
    const res = await fetch(`http://127.0.0.1:5000/api/conversations/${sid}`);
    const data = await res.json();
    topbarTitle.textContent = 'Chat';
    (data.messages || []).forEach(m => {
      appendMessage(m.role, m.content, m.metadata || {});
    });
  } catch (e) {
    showToast('Failed to load conversation');
  }
}

async function deleteConversation(sid) {
  try {
    await fetch(`http://127.0.0.1:5000/api/conversations/${sid}`, { method: 'DELETE' });
    if (sid === sessionId) newSession();
    await loadConversations();
  } catch (e) {
    showToast('Failed to delete conversation');
  }
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}
