let levels = [];
let currentGrid = [];
let selectedColor = null;
let start = [0, 0];
let size = 0;
let originalGrid = [];
let currentLevelId = 1;
let hintVisible = false;
let usedMoves = 0;
let isFilling = false;

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const SOUND_POOL_SIZE = 20;
let fillSoundPool = [];

function initSoundPool() {
    const baseSound = document.getElementById("fillSound");
    fillSoundPool = [];
    for (let i = 0; i < SOUND_POOL_SIZE; i++) {
        const sound = baseSound.cloneNode();
        sound.volume = baseSound.volume;
        fillSoundPool.push(sound);
        document.body.appendChild(sound);
    }
}

function playFillSound() {
    for (let i = 0; i < SOUND_POOL_SIZE; i++) {
        const sound = fillSoundPool[i];
        if (sound.paused || sound.ended) {
            sound.currentTime = 0;
            sound.play().catch(() => { });
            break;
        }
    }
}


async function loadLevels() {
    const res = await fetch("./flood_fill_levels.json");
    levels = await res.json();
    if (!localStorage.getItem("maxLevel")) {
        localStorage.setItem("maxLevel", "1");
    }
    renderLevelButtons();
    const autoLoadId = parseInt(localStorage.getItem("maxLevel") || "1");
    loadLevel(autoLoadId);
}

function renderLevelButtons() {
    const select = document.getElementById("levelSelect");
    const lang = localStorage.getItem('lang') || 'zh-TW';
    const t = translations[lang];
    select.innerHTML = '';
    const defaultOption = document.createElement("option");
    defaultOption.textContent = t.select;
    defaultOption.disabled = true;
    select.appendChild(defaultOption);
    const unlockedLevel = parseInt(localStorage.getItem("maxLevel") || "1");
    for (let level of levels) {
        const option = document.createElement("option");
        const unlockedLevel = parseInt(localStorage.getItem("maxLevel") || "1");
        if (level.id > unlockedLevel) {
            option.disabled = true;
            option.style.color = '#aaa';
        }
        option.value = level.id;
        if (lang === 'en') {
            option.textContent = `Level ${level.id}`;
        } else if (lang === 'ja') {
            option.textContent = `レベル${level.id}`;
        } else if (lang === 'zh-CN') {
            option.textContent = `第 ${level.id} 关`;
        } else {
            option.textContent = `第 ${level.id} 關`;
        }
        select.appendChild(option);
    }

    const maxLevel = parseInt(localStorage.getItem("maxLevel") || "1");
    select.value = maxLevel.toString();
}

function loadLevel(id) {
    const unlockedLevel = parseInt(localStorage.getItem("maxLevel") || "1");
    if (id > unlockedLevel) return;
    const level = levels.find(l => l.id === id);
    if (!level) return;

    currentLevelId = id;
    currentGrid = level.grid.map(row => [...row]);
    originalGrid = level.grid.map(row => [...row]);
    start = level.start;
    size = level.size;
    hintVisible = false;
    usedMoves = 0;

    const bestKey = `best_${level.id}`;
    const bestRecord = localStorage.getItem(bestKey);
    const bestText = bestRecord ? `｜最佳步數：${bestRecord}` : "";

    const t = translations[localStorage.getItem('lang') || 'zh-TW'];
    document.getElementById("preview").innerHTML = `
        <h3>${t.nowLevel} ${level.id} ${t.nowLevel2}｜${level.size}x${level.size}｜${t.limitMove}: ${level.solution.length + 2} ${bestText}</h3>
        <p id="hint" style="display: none"></p>
        <p id="moveCount">${t.move}：0</p>
      `;


    renderPalette(level.colors);
    renderBoard();
    document.getElementById("message").textContent = "";
}

function renderHintCircles(sequence) {
    const hintContainer = document.getElementById("hint");
    hintContainer.innerHTML = `步數：${sequence.length}<br>` + sequence.map(color => `<span class="hint-circle" style="background:${color}"></span>`).join('');
}

function toggleHint() {
    const hint = document.getElementById("hint");
    const level = levels.find(l => l.id === currentLevelId);
    if (!level) return;
    hintVisible = !hintVisible;
    if (hintVisible) {
        renderHintCircles(level.solution);
        hint.style.display = "block";
    } else {
        hint.style.display = "none";
    }
    renderBoard();
}

function resetLevel() {
    loadLevel(currentLevelId);
}

function renderPalette(colors) {
    const palette = document.getElementById("palette");
    palette.innerHTML = '';
    colors.forEach(color => {
        const btn = document.createElement("button");
        btn.style.backgroundColor = color;
        btn.className = selectedColor === color ? 'selected' : '';
        btn.onclick = () => {
            selectedColor = color;
            renderPalette(colors);
        };
        palette.appendChild(btn);
    });
}

function renderBoard() {
    const board = document.getElementById("gameBoard");
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${size}, 30px)`;
    currentGrid.forEach((row, i) => {
        row.forEach((color, j) => {
            const cell = document.createElement("div");
            cell.className = 'cell';
            cell.style.backgroundColor = color;
            if (i === start[0] && j === start[1] && hintVisible) {
                cell.style.outline = '2px dashed black';
            } else {
                cell.style.outline = '';
            }
            cell.onclick = () => {
                if (isFilling || !selectedColor || currentGrid[i][j] === selectedColor) return;
                const level = levels.find(l => l.id === currentLevelId);
                usedMoves++;
                if (usedMoves > level.solution.length + 2) {
                    document.getElementById("message").textContent = translations[localStorage.getItem('lang') || 'zh-TW'].failed;
                    return;
                } else {
                    document.getElementById("moveCount").textContent = `目前步數：${usedMoves}`;
                    isFilling = true;
                    floodFill(i, j, currentGrid[i][j], selectedColor, () => {
                        isFilling = false;
                        renderBoard();
                    });
                }
            };
            board.appendChild(cell);
        });
    });
}

async function floodFill(x, y, fromColor, toColor, onFinish) {
    if (fromColor === toColor || currentGrid[x][y] !== fromColor) return;
    const visited = Array.from({ length: size }, () => Array(size).fill(false));
    let queue = [[x, y]];
    visited[x][y] = true;

    if (isIOS) {
        while (queue.length > 0) {
            const [cx, cy] = queue.shift();
            currentGrid[cx][cy] = toColor;
            createParticles(cx, cy, toColor);
            const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dx, dy] of directions) {
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx >= 0 && ny >= 0 && nx < size && ny < size && !visited[nx][ny] && currentGrid[nx][ny] === fromColor) {
                    visited[nx][ny] = true;
                    queue.push([nx, ny]);
                }
            }
        }
        playFillSound();
        checkWin();
        if (onFinish) onFinish();
        return;
    }

    let step = 0;
    let frameCount = 0;
    const framesPerStep = 20;

    function processQueue() {
        frameCount++;
        if (frameCount < framesPerStep) {
            requestAnimationFrame(processQueue);
            return;
        }
        frameCount = 0;

        if (queue.length === 0) {
            if (onFinish) onFinish();
            return;
        }

        const nextQueue = [];
        for (const [cx, cy] of queue) {
            currentGrid[cx][cy] = toColor;
            renderBoard();
            createParticles(cx, cy, toColor);
            playFillSound();
            checkWin();

            const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dx, dy] of directions) {
                const nx = cx + dx;
                const ny = cy + dy;
                if (
                    nx >= 0 && ny >= 0 && nx < size && ny < size &&
                    !visited[nx][ny] && currentGrid[nx][ny] === fromColor
                ) {
                    visited[nx][ny] = true;
                    nextQueue.push([nx, ny]);
                }
            }
        }

        step++;
        queue.length = 0;
        queue.push(...nextQueue);
        requestAnimationFrame(processQueue);
    }
    requestAnimationFrame(processQueue);
}


function checkWin() {
    const target = currentGrid[start[0]][start[1]];
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if (currentGrid[i][j] !== target) return;
        }
    }
    document.getElementById("message").textContent = translations[localStorage.getItem('lang') || 'zh-TW'].win;
    const currentId = currentLevelId;
    const prevMax = parseInt(localStorage.getItem("maxLevel") || "1");
    if (currentId >= prevMax) {
        localStorage.setItem("maxLevel", currentId + 1);
        renderLevelButtons();
    }
    const bestKey = `best_${currentId}`;
    const best = parseInt(localStorage.getItem(bestKey) || "999");
    if (usedMoves < best) {
        localStorage.setItem(bestKey, usedMoves);
        document.getElementById("message").textContent += translations[localStorage.getItem('lang') || 'zh-TW'].newRecord + usedMoves;
    }
    setTimeout(() => {
        if (levels.find(l => l.id === currentId + 1)) {
            loadLevel(currentId + 1);
        }
    }, 1000);
}

function createParticles(x, y, color) {
    const board = document.getElementById("gameBoard");
    const cells = board.querySelectorAll(".cell");
    const index = x * size + y;
    const cell = cells[index];
    if (!cell) return;

    const rect = cell.getBoundingClientRect();
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const originX = rect.left + scrollLeft + rect.width / 2;
    const originY = rect.top + scrollTop + rect.height / 2;

    for (let i = 0; i < 4; i++) {
        const p = document.createElement("div");
        p.className = "particle";
        p.style.background = "white";
        p.style.boxShadow = `0 0 3px 2px ${color}`;
        const angle = Math.random() * 2 * Math.PI;
        const distance = 80 + Math.random() * 10;
        const dx = Math.cos(angle) * distance + "px";
        const dy = Math.sin(angle) * distance + "px";
        p.style.setProperty('--dx', dx);
        p.style.setProperty('--dy', dy);
        p.style.left = originX + 'px';
        p.style.top = originY + 'px';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1600);
    }
}

loadLevels();

const bgm = document.getElementById("bgm");
bgm.volume = 0.5;
function toggleMusic() {
    if (bgm.paused) bgm.play(); else bgm.pause();
}
function toggleDarkMode() {
    document.body.classList.toggle("dark");
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBtn').style.display = 'inline-block';
});

document.getElementById('installBtn').addEventListener('click', async () => {
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isInStandaloneMode = 'standalone' in window.navigator && window.navigator.standalone;

    if (isIos && !isInStandaloneMode) {
        showIosInstallTip();
        return;
    }

    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    console.log('User response to A2HS:', result.outcome);
    deferredPrompt = null;
    document.getElementById('installBtn').style.display = 'none';
});


if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        const bar = document.createElement('div');
        bar.innerHTML = '🔄 發現新版本，請點此重新整理';
        bar.style.position = 'fixed';
        bar.style.bottom = '0';
        bar.style.width = '100%';
        bar.style.padding = '10px';
        bar.style.backgroundColor = '#333';
        bar.style.color = 'white';
        bar.style.textAlign = 'center';
        bar.style.cursor = 'pointer';
        bar.onclick = () => location.reload();
        document.body.appendChild(bar);
    });
}

const translations = {
    'zh-TW': {
        restart: '重新開始', hint: '顯示提示', dark: '暗色模式', music: '音樂開關', select: '請選擇想玩的關卡', nowLevel: '第', nowLevel2: '關', limitMove: '限制步數', move: '目前步數', best: '最佳步數：', win: '🎉 恭喜通關！', newRecord: '🌟 新紀錄！最佳步數：', failed: '❌ 超出步數限制，挑戰失敗！', iosTip: '📲 請使用 Safari 點擊分享選單，然後選擇『加入主畫面』即可安裝本遊戲！'
    },
    'zh-CN': {
        install: '添加到主畫面',
        restart: '重新开始', hint: '显示提示', dark: '深色模式', music: '音乐开关', select: '请选择想玩的关卡', nowLevel: '第', nowLevel2: '关', limitMove: '限制步数', move: '当前步数', best: '最佳步数：', win: '🎉 恭喜通关！', newRecord: '🌟 新纪录！最佳步数：', failed: '❌ 超出步数限制，挑战失败！', iosTip: '📲 请使用 Safari 点击分享按钮，然后选择「添加到主屏幕」以安装游戏！'
    },
    'en': {
        install: 'Install to Home Screen',
        restart: 'Restart', hint: 'Show Hint', dark: 'Dark Mode', music: 'Toggle Music', select: 'Select a level to play', nowLevel: 'Level', nowLevel2: '', limitMove: 'Moves limited', move: 'Moves used', best: 'Best: ', win: '🎉 You Win!', newRecord: '🌟 New Record! Best: ', failed: '❌ Out of moves! Try again!', iosTip: '📲 On Safari, tap the Share icon and choose “Add to Home Screen” to install this game.'
    },
    'ja': {
        install: 'ホーム画面に追加',
        restart: 'やり直し', hint: 'ヒント表示', dark: 'ダークモード', music: '音楽切替', select: 'レベルを選択してください', nowLevel: 'レベル', nowLevel2: '', limitMove: '制限の手数', move: '現在の手数', best: 'ベスト：', win: '🎉 クリア！', newRecord: '🌟 新記録！ベスト：', failed: '❌ 手数オーバー、失敗！', iosTip: '📲 Safariで共有アイコンをタップし、「ホーム画面に追加」を選択してください。'
    }
};

function setLanguage(lang) {
    const langSelect = document.getElementById('langSelect');
    if (langSelect) langSelect.selectedIndex = 0;
    localStorage.setItem('lang', lang);
    applyLanguage();
}

function applyLanguage() {
    const titleMap = {
        'zh-TW': '填色遊戲',
        'zh-CN': '填色游戏',
        'en': 'Flood Fill Puzzle',
        'ja': '塗りつぶしパズル'
    };
    const lang = localStorage.getItem('lang') || 'zh-TW';
    const t = translations[lang];
    const langSelect = document.getElementById('langSelect');
    if (langSelect) {
        langSelect.options[0].textContent = {
            'zh-TW': '切換語言',
            'zh-CN': '切换语言',
            'en': 'Change Language',
            'ja': '言語を変更'
        }[lang];
    }
    document.querySelector('button[onclick="resetLevel()"]').textContent = t.restart;
    document.querySelector('button[onclick="toggleHint()"]').textContent = t.hint;
    document.querySelector('button[onclick="toggleDarkMode()"]').textContent = t.dark;
    document.querySelector('button[onclick="toggleMusic()"]').textContent = t.music;
    const titleEl = document.getElementById('gameTitle');
    if (titleEl) titleEl.textContent = titleMap[lang];
    const installBtn = document.getElementById('installBtn');
    if (installBtn) installBtn.innerHTML = '📱 ' + (t.install || '安裝到主畫面');
    const defaultOption = document.querySelector('#levelSelect option[disabled]');
    if (defaultOption) defaultOption.textContent = t.select;

    renderLevelButtons();

    if (typeof currentLevelId !== 'undefined' && levels.length > 0) {
        const level = levels.find(l => l.id === currentLevelId);
        if (level) {
            const bestKey = `best_${level.id}`;
            const bestRecord = localStorage.getItem(bestKey);
            const bestText = bestRecord ? `｜${t.best}${bestRecord}` : "";
            document.getElementById("preview").innerHTML = `
        <h3>${t.nowLevel} ${level.id} ${t.nowLevel2}｜${level.size}x${level.size}｜${t.limitMove}: ${level.solution.length + 2} ${bestText}</h3>
        <p id="hint" style="display: ${hintVisible ? 'block' : 'none'}"></p>
        <p id="moveCount">${t.move}：${usedMoves}</p>
      `;
            if (hintVisible) renderHintCircles(level.solution);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const lang = localStorage.getItem('lang') || 'zh-TW';
    localStorage.setItem('lang', lang);
    applyLanguage();

    if (window.matchMedia('(display-mode: standalone)').matches) {
        document.getElementById('installBtn').style.display = 'none';
    }

    initSoundPool();
});

function showIosInstallTip() {
    const existing = document.getElementById("iosInstallTip");
    if (existing) return;

    const tip = document.createElement("div");
    tip.id = "iosInstallTip";
    tip.innerHTML = translations[localStorage.getItem('lang') || 'zh-TW'].iosTip;
    tip.style.padding = "10px";
    tip.style.color = document.body.classList.contains('dark') ? '#fff' : '#000';
    tip.style.background = document.body.classList.contains('dark') ? '#1e1e1e' : '#ffffe0';
    tip.style.border = document.body.classList.contains('dark') ? '1px solid #666' : '1px solid #aaa';
    tip.style.margin = "10px";
    tip.style.fontSize = "0.9em";
    tip.style.position = "fixed";
    tip.style.bottom = "50px";
    tip.style.right = "10px";
    tip.style.zIndex = "999";
    tip.style.maxWidth = "80vw";

    const close = document.createElement("button");
    close.textContent = "✖";
    close.style.marginLeft = "10px";
    close.style.cursor = "pointer";
    close.onclick = () => tip.remove();
    tip.appendChild(close);

    document.body.appendChild(tip);
}