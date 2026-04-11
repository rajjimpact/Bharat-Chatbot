# 🤖 NexBot — AI Chatbot

A beautiful, full-featured chatbot built with **PHP** (backend) and **JavaScript** (frontend).

---

## 📁 Project Structure

```
Chatbot/
├── index.html   ← Main HTML page (hero + chat UI)
├── style.css    ← Premium dark-mode glassmorphism styles
├── chat.js      ← Frontend JavaScript (UI, message flow, API calls)
└── api.php      ← PHP backend (FAQ engine, keyword matching)
```

---

## 🚀 How to Run

### Option 1 — XAMPP (Recommended for Windows)
1. Install **XAMPP** from [apachefriends.org](https://www.apachefriends.org/)
2. Copy this folder to `C:\xampp\htdocs\Chatbot\`
3. Start **Apache** in the XAMPP Control Panel
4. Visit `http://localhost/Chatbot/`

### Option 2 — PHP Built-in Server
If PHP is installed on your system:
```bash
cd path/to/Chatbot
php -S localhost:8000
```
Then visit `http://localhost:8000/`

### Option 3 — VS Code + PHP Server Extension
Install the **PHP Server** extension and right-click `index.html` → "PHP Server: Serve Project"

---

## 💬 What NexBot Can Answer

| Category | Example Questions |
|----------|------------------|
| 🤖 Identity | "Who are you?", "What can you do?" |
| 💻 Programming | "What is PHP?", "Explain JavaScript", "What is SQL?" |
| 🧠 AI & ML | "What is AI?", "How does machine learning work?" |
| 🌿 Health | "Give me health tips", "How to sleep better?" |
| ⚡ Productivity | "How to be more productive?", "Beat procrastination" |
| 🎓 General | "Tell me about space", "What is the internet?" |
| 😄 Fun | "Tell me a joke", "Give me a motivational quote" |

---

## 🛠️ Extending the Chatbot

To add new FAQ entries, edit `api.php` and add to the `$faq` array:
```php
[
    ['your keyword', 'another keyword'],     // trigger keywords
    "Your bot response here (use **bold**, *italic*, `code`)"
],
```

The scoring system automatically picks the best match based on keyword length and occurrence.

---

## ✨ Features

- 🎨 Premium dark-mode UI with glassmorphism
- 💬 Smooth animated message bubbles
- ⌨️ Typing indicator with bouncing dots
- ⚡ Quick-topic chips for common questions
- 📱 Fully responsive (mobile-friendly)
- 🔒 Input sanitisation & CORS headers
- 🧠 Keyword-scored FAQ matching with fallbacks
