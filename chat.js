/**
 * Bharat Chatbot — chat.js
 * Features: Theme switching (Default/Light/Dark), chat UI, message flow, API calls.
 */

(function () {
  'use strict';

  // ─── DOM refs ────────────────────────────────────────────────────────────────
  const overlay     = document.getElementById('chatOverlay');
  const openBtn     = document.getElementById('openChatBtn');
  const closeBtn    = document.getElementById('closeChatBtn');
  const clearBtn    = document.getElementById('clearBtn');
  const input       = document.getElementById('userInput');
  const sendBtn     = document.getElementById('sendBtn');
  const msgArea     = document.getElementById('messagesArea');
  const fabBtn      = document.getElementById('fabBtn');
  const fabBadge    = document.getElementById('fabBadge');
  const statusEl    = document.querySelector('.bot-status');
  const topicChips  = document.querySelectorAll('.topic-chip');
  const quickTopics = document.getElementById('quickTopics');
  const attachBtn   = document.getElementById('attachBtn');
  const mediaInput  = document.getElementById('mediaInput');
  const previewCont = document.getElementById('mediaPreviewContainer');
  const previewImg  = document.getElementById('mediaPreviewImg');
  const removeMedia = document.getElementById('removeMediaBtn');

  // ─── State ───────────────────────────────────────────────────────────────────
  let isOpen      = false;
  let isBotTyping = false;
  let msgCount    = 0;
  let chatHistory = [];
  let fabNotified = false;
  let selectedMediaBase64 = null;
  let selectedMediaMime   = null;

  // =====================================================================
  //  THEME SYSTEM
  // =====================================================================
  function initTheme() {
    const saved = localStorage.getItem('claude-theme') || 'default';
    applyTheme(saved);
  }

  function applyTheme(theme) {
    // Set on <html> and <body>
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('claude-theme', theme);

    // Sync ALL theme buttons (both hero switcher & chat switcher)
    document.querySelectorAll('.theme-opt, .chat-theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  // Wire up all theme buttons (hero + chat header)
  document.querySelectorAll('.theme-opt, .chat-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
  });

  // Load saved theme on startup
  initTheme();

  // =====================================================================
  //  OPEN / CLOSE
  // =====================================================================
  function openChat() {
    isOpen = true;
    overlay.classList.add('open');
    fabBtn.classList.remove('visible');
    fabBadge.style.display = 'none';
    if (msgCount === 0) addWelcomeMessage();
    setTimeout(() => input.focus(), 400);
  }

  function closeChat() {
    isOpen = false;
    overlay.classList.remove('open');
    fabBtn.classList.add('visible');
    if (!fabNotified) {
      fabBadge.style.display = 'flex';
      fabBadge.textContent   = '1';
      fabNotified = true;
    }
    document.querySelector('.fab-icon-chat').style.display  = 'block';
    document.querySelector('.fab-icon-close').style.display = 'none';
  }

  openBtn.addEventListener('click', openChat);
  closeBtn.addEventListener('click', closeChat);
  fabBtn.addEventListener('click', () => isOpen ? closeChat() : openChat());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) closeChat(); });

  // =====================================================================
  //  CLEAR CHAT
  // =====================================================================
  clearBtn.addEventListener('click', () => {
    msgArea.innerHTML = '';
    chatHistory = [];
    msgCount    = 0;
    quickTopics.style.display = 'block';
    addWelcomeMessage();
  });

  // =====================================================================
  //  INPUT HANDLING
  // =====================================================================
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 130) + 'px';
    sendBtn.disabled   = (input.value.trim() === '' && !selectedMediaBase64);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) sendMessage(); }
  });

  sendBtn.addEventListener('click', sendMessage);

  // =====================================================================
  //  MEDIA IMPORT
  // =====================================================================
  attachBtn.addEventListener('click', () => mediaInput.click());

  mediaInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert("Please select an image file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      selectedMediaBase64 = evt.target.result;
      selectedMediaMime   = file.type;
      
      previewImg.src = selectedMediaBase64;
      previewCont.style.display = 'inline-block';
      sendBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  });

  removeMedia.addEventListener('click', () => {
    clearMedia();
    input.dispatchEvent(new Event('input'));
  });

  function clearMedia() {
    selectedMediaBase64 = null;
    selectedMediaMime   = null;
    mediaInput.value    = '';
    previewCont.style.display = 'none';
  }

  // ─── Topic chips ─────────────────────────────────────────────────────────────
  topicChips.forEach(chip => {
    chip.addEventListener('click', () => {
      input.value = chip.dataset.query;
      input.dispatchEvent(new Event('input'));
      quickTopics.style.display = 'none';
      sendMessage();
    });
  });

  // =====================================================================
  //  WELCOME MESSAGE
  // =====================================================================
  function addWelcomeMessage() {
    addBotMessage("👋 Hi there! I'm **Bharat**, your AI assistant.\n\nI can help you with **programming**, **health tips**, **food recipes**, **social guidance**, **science**, **history**, and much more.\n\nWhat would you like to explore today?");
  }

  // =====================================================================
  //  SEND FLOW
  // =====================================================================
  function sendMessage() {
    const text = input.value.trim();
    if ((!text && !selectedMediaBase64) || isBotTyping) return;

    if (quickTopics.style.display !== 'none') quickTopics.style.display = 'none';

    const mediaB64 = selectedMediaBase64;
    const mediaMime = selectedMediaMime;

    addUserMessage(text, mediaB64);
    input.value       = '';
    input.style.height = 'auto';
    clearMedia();
    sendBtn.disabled  = true;
    chatHistory.push({ role: 'user', text: text || "[Attached Image]" });
    fetchBotReply(text, mediaB64, mediaMime);
  }

  // =====================================================================
  //  MESSAGE RENDERING
  // =====================================================================
  function addUserMessage(text, mediaB64 = null) {
    msgCount++;
    msgArea.appendChild(buildMsgRow('user', text, mediaB64));
    scrollToBottom();
  }

  function addBotMessage(text) {
    msgCount++;
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
    msgArea.appendChild(buildMsgRow('bot', text));
    scrollToBottom();
    chatHistory.push({ role: 'bot', text });
  }

  function buildMsgRow(role, text, mediaB64 = null) {
    const row = document.createElement('div');
    row.className = `msg-row ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = role === 'bot' ? 'B' : '😊';

    const content = document.createElement('div');
    content.className = 'msg-content';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    
    let html = '';
    if (mediaB64) {
      html += `<img src="${mediaB64}" class="attached-media" alt="Attached media">`;
      if (text) html += `<br>`;
    }
    if (text) {
      html += formatText(text);
    }
    bubble.innerHTML = html;

    const time = document.createElement('div');
    time.className   = 'msg-time';
    time.textContent = nowTime();

    content.appendChild(bubble);
    content.appendChild(time);
    row.appendChild(avatar);
    row.appendChild(content);
    return row;
  }

  // Lightweight markdown-like formatter
  function formatText(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(128,90,50,0.12);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.85em">$1</code>')
      .replace(/\n/g, '<br>');
  }

  function nowTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // =====================================================================
  //  TYPING INDICATOR
  // =====================================================================
  function showTyping() {
    isBotTyping = true;
    statusEl.innerHTML = '<span class="status-dot"></span> Typing…';

    const wrap = document.createElement('div');
    wrap.id = 'typingIndicator';
    wrap.className = 'typing-indicator';

    const avatar = document.createElement('div');
    avatar.className   = 'msg-avatar';
    avatar.textContent = 'B';
    avatar.style.cssText = 'background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.76rem;flex-shrink:0';

    const bubble = document.createElement('div');
    bubble.className = 'typing-bubble';
    [1,2,3].forEach(() => {
      const d = document.createElement('div');
      d.className = 'dot';
      bubble.appendChild(d);
    });

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    msgArea.appendChild(wrap);
    scrollToBottom();
  }

  function hideTyping() {
    isBotTyping = false;
    statusEl.innerHTML = '<span class="status-dot"></span> Ready to assist';
    const t = document.getElementById('typingIndicator');
    if (t) t.remove();
  }

  // =====================================================================
  //  FETCH FROM PHP BACKEND
  // =====================================================================
  function fetchBotReply(userText, mediaB64 = null, mediaMime = null) {
    showTyping();
    const startTime = Date.now();

    const form = new FormData();
    form.append('message', userText);
    form.append('history', JSON.stringify(chatHistory.slice(-10)));
    
    if (mediaB64) {
      const b64Data = mediaB64.split(',')[1];
      form.append('mediaBase64', b64Data);
      form.append('mediaMime', mediaMime);
    }

    fetch('api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        history: chatHistory.slice(-10),
        mediaBase64: mediaB64 ? mediaB64.split(',')[1] : '',
        mediaMime: mediaMime || ''
      })
    })
      .then(async res => {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          return data;
        } catch (e) {
          throw new Error(res.ok ? 'Invalid response from server.' : (e.message || `HTTP ${res.status}`));
        }
      })
      .then(data => {
        const delay = Math.max(0, 700 - (Date.now() - startTime));
        setTimeout(() => {
          hideTyping();
          addBotMessage(data.reply || "I'm not sure about that. Could you rephrase?");
        }, delay);
      })
      .catch((err) => {
        setTimeout(() => {
          hideTyping();
          console.error('Backend Error:', err);
          addBotMessage(`⚠️ **${err.message}**\n\n_Make sure you've added your Grok API keys in Vercel → Project Settings → Environment Variables._`);
        }, 800);
      });
  }

  // ─── Scroll helper ────────────────────────────────────────────────────────────
  function scrollToBottom() {
    requestAnimationFrame(() => msgArea.scrollTo({ top: msgArea.scrollHeight, behavior: 'smooth' }));
  }

})();
