// State
let currentUser = null;
// GASのURLをハードコーディング
const API_URL = 'https://script.google.com/macros/s/AKfycbwnjcvWp50ZiJrzVWfODy8T6LCNO-yJsM_hIHPUvdx7ZEorCYVGsPykuVmDt8-7HOpO/exec';

// Init
window.onload = function () {
    const savedUser = localStorage.getItem('room_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    } else {
        showLogin();
    }
};

// API Helper
async function callApi(action, params = {}, method = 'POST') {
    let url = API_URL;
    let options = {
        method: method,
        redirect: 'follow'
    };

    if (method === 'GET') {
        const query = new URLSearchParams({ action, ...params }).toString();
        url += (url.includes('?') ? '&' : '?') + query;
    } else {
        options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
        options.body = JSON.stringify({ action, ...params });
    }

    const res = await fetch(url, options);
    const json = await res.json();
    return json;
}

// Navigation
function showLogin() {
    hideAll();
    document.getElementById('login-view').classList.remove('hidden');
}

function showRegister() {
    hideAll();
    document.getElementById('register-view').classList.remove('hidden');
}

function showDashboard() {
    hideAll();
    document.getElementById('dashboard-view').style.display = 'block';
    document.getElementById('app-header').classList.remove('hidden');
    document.getElementById('header-email').textContent = currentUser.email;
    loadDashboardData();
}

function hideAll() {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('register-view').classList.add('hidden');
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('app-header').classList.add('hidden');
}

function logout() {
    localStorage.removeItem('room_user');
    currentUser = null;
    showLogin();
}

// Handlers
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.textContent = 'ログイン中...';

    try {
        const res = await callApi('login', { email, password: pass });
        if (res.success) {
            currentUser = res.user;
            localStorage.setItem('room_user', JSON.stringify(currentUser));
            showDashboard();
        } else {
            showToast(res.message);
        }
    } catch (err) {
        showToast('エラー: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'ログイン';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-password').value;
    const btn = document.getElementById('reg-btn');

    btn.disabled = true;
    btn.textContent = '送信中...';

    try {
        const res = await callApi('register', { email, password: pass });
        alert(res.message);
        if (res.success) {
            showLogin();
        }
    } catch (err) {
        showToast('エラー: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '確認メールを送信';
    }
}

async function loadDashboardData() {
    const container = document.getElementById('dashboard-content');
    container.innerHTML = '<div class="loading-spinner"></div><div style="text-align:center">商品を読み込み中...</div>';

    try {
        const res = await callApi('getDashboardData', {}, 'GET');
        if (res.success) {
            container.innerHTML = '';
            Object.keys(res.data).forEach(genre => {
                if (res.data[genre].length > 0) {
                    renderGenreSection(container, genre, res.data[genre]);
                }
            });
        } else {
            throw new Error(res.message);
        }
    } catch (err) {
        container.innerHTML = `<div style="color:red; text-align:center">読み込みエラー: ${err.message}</div>`;
    }
}

function renderGenreSection(container, genreName, items) {
    const section = document.createElement('div');
    section.innerHTML = `
    <div class="section-header">
      ${genreName} <span class="genre-badge">Ranking</span>
    </div>
    <div class="grid">
      ${items.map((item, idx) => `
        <div class="card" onclick='openItemModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>
          <img src="${item.imageUrl}" class="card-img" loading="lazy">
          <div class="card-body">
            <div class="card-title">${item.name}</div>
            <div class="card-price">${parseInt(item.price).toLocaleString()}円</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
    container.appendChild(section);
}

function openItemModal(item) {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    modal.style.display = 'flex';

    content.innerHTML = `
    <div style="text-align:center">
      <img src="${item.imageUrl}" style="max-height:200px; border-radius:8px;">
      <h3 style="font-size:1rem; margin:1rem 0;">${item.name}</h3>
    </div>
    <div class="loading-spinner"></div>
    <div style="text-align:center; color:#666;">AI紹介文を生成中...</div>
  `;

    callApi('generateRecommendation', { itemName: item.name })
        .then(res => {
            if (!res.success) throw new Error(res.message);

            const text = res.data;
            const roomUrl = `https://room.rakuten.co.jp/mix?itemcode=${item.code.replace(/:/g, '%3A')}&scid=we_room_upc60`;

            content.innerHTML = `
        <div style="text-align:center; margin-bottom:1rem;">
          <img src="${item.imageUrl}" style="max-height:150px; border-radius:8px;">
          <h3 style="font-size:1rem; margin:0.5rem 0;">${item.name}</h3>
        </div>
        
        <label style="font-weight:bold; font-size:0.9rem;">AI生成紹介文:</label>
        <div class="generated-text" id="copy-target">${text}</div>
        
        <div style="display:flex; gap:1rem; flex-direction:column;">
          <button class="btn" onclick="copyAndOpen('${roomUrl}')">
            紹介文をコピーしてROOMへ
          </button>
          <button class="btn" style="background:#666;" onclick="closeModal()">閉じる</button>
        </div>
      `;
        })
        .catch(err => {
            content.innerHTML += `<div style="color:red; text-align:center; margin-top:1rem;">エラー: ${err.message}</div>`;
        });
}

function copyAndOpen(url) {
    const text = document.getElementById('copy-target').innerText;

    // モバイル対応: ポップアップブロックを回避するため、非同期処理(setTimeout)を使わずに遷移する
    // クリップボード書き込みは試みるが、失敗しても遷移を優先する
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('コピーしました！ROOMを開きます...');
            // アプリへのディープリンクは location.href の方が確実に動作する場合が多い
            window.location.href = url;
        })
        .catch(err => {
            console.error('Copy failed', err);
            showToast('コピーに失敗しました。手動でコピーしてください。');
            // コピー失敗してもROOMは開く
            window.location.href = url;
        });
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
});
