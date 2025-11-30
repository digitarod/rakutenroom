// State
let currentUser = null;
// GASのURLをハードコーディング
const API_URL = 'https://script.google.com/macros/s/AKfycbxv_Qa9NQT8psN6LEv84wtfR1TpIJygDxFbNFtAoslEaYqMK5guzZmhLneb360AJDnU/exec';

// Init
window.onload = function () {
    const savedUser = localStorage.getItem('room_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        // 後方互換性: 古いデータにplanがない場合はFreeとする
        if (!currentUser.plan) currentUser.plan = 'Free';
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

    updatePremiumUI();
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

function showSettings() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'flex';

    // 現在の設定を反映
    const isPremium = currentUser.plan === 'Premium';
    document.getElementById('plan-toggle-input').checked = isPremium;
    document.getElementById('custom-prompt').value = currentUser.customPrompt || '';

    updateSettingsUI(isPremium);
}

function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}

function togglePlan() {
    const isPremium = document.getElementById('plan-toggle-input').checked;
    updateSettingsUI(isPremium);
}

function updateSettingsUI(isPremium) {
    const freeLabel = document.getElementById('plan-label-free');
    const premiumLabel = document.getElementById('plan-label-premium');
    const premiumSettings = document.getElementById('premium-settings');

    if (isPremium) {
        freeLabel.classList.remove('active');
        premiumLabel.classList.add('active');
        premiumSettings.classList.remove('hidden');
    } else {
        freeLabel.classList.add('active');
        premiumLabel.classList.remove('active');
        premiumSettings.classList.add('hidden');
    }
}

function updatePremiumUI() {
    const isPremium = currentUser.plan === 'Premium';
    const searchSection = document.getElementById('search-section');
    const promoBanner = document.getElementById('premium-promo');

    if (isPremium) {
        searchSection.classList.remove('hidden');
        promoBanner.classList.add('hidden');
    } else {
        searchSection.classList.add('hidden');
        promoBanner.classList.remove('hidden');
    }
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

async function saveSettings() {
    const btn = document.getElementById('save-settings-btn');
    btn.disabled = true;
    btn.textContent = '保存中...';

    const isPremium = document.getElementById('plan-toggle-input').checked;
    const plan = isPremium ? 'Premium' : 'Free';
    const customPrompt = document.getElementById('custom-prompt').value;

    try {
        const res = await callApi('updateProfile', {
            email: currentUser.email,
            plan: plan,
            customPrompt: customPrompt
        });

        if (res.success) {
            currentUser = res.user;
            localStorage.setItem('room_user', JSON.stringify(currentUser));
            showToast('設定を保存しました');
            closeSettings();
            updatePremiumUI();
            // 設定変更後はダッシュボードをリロードして反映させる
            loadDashboardData();
        } else {
            showToast(res.message);
        }
    } catch (err) {
        showToast('エラー: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '保存する';
    }
}

async function handleSearch(e) {
    e.preventDefault();
    const keyword = document.getElementById('search-keyword').value;
    const genreId = document.getElementById('search-genre').value;
    const container = document.getElementById('dashboard-content');

    container.innerHTML = '<div class="loading-spinner"></div><div style="text-align:center">検索中...</div>';

    try {
        const res = await callApi('searchItems', { keyword, genreId });
        if (res.success) {
            container.innerHTML = '';
            if (res.data.length > 0) {
                renderGenreSection(container, `検索結果: ${keyword}`, res.data);
            } else {
                container.innerHTML = '<div style="text-align:center; padding:2rem;">該当する商品が見つかりませんでした。</div>';
            }
        } else {
            throw new Error(res.message);
        }
    } catch (err) {
        container.innerHTML = `<div style="color:red; text-align:center">検索エラー: ${err.message}</div>`;
    }
}

async function loadDashboardData() {
    const container = document.getElementById('dashboard-content');
    // 検索結果が表示されている場合はリロードしない（簡易実装）
    // ただし、初期表示や設定変更後はリロードしたい
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
      ${genreName} 
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

    // カスタムプロンプトを渡す
    const customPrompt = currentUser.plan === 'Premium' ? currentUser.customPrompt : '';

    callApi('generateRecommendation', { itemName: item.name, customPrompt: customPrompt })
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

    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('コピーしました！ROOMを開きます...');
            window.location.href = url;
        })
        .catch(err => {
            console.error('Copy failed', err);
            showToast('コピーに失敗しました。手動でコピーしてください。');
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
