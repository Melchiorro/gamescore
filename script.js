const iconList = [
    "fa-hippo", "fa-fish", "fa-frog", "fa-dove",
    "fa-dog", "fa-crow", "fa-cat", "fa-otter", "fa-shrimp"
];

const colors = ["#f94144", "#f3722c", "#53b3ab", "#577590", "#1c5e99", "#8c3479"];

let playerCount = 4;
let players = [];
let currentRound = 1;
let showScoreTable = true;
let currentGameId = null;
let historyTableCreated = false; // Новый флаг для отслеживания создания таблицы истории

const savedGamesKey = 'scary-tales-saves';
const MAX_SAVED_GAMES = 20; // Ограничение на количество сохранений

// Вспомогательные функции безопасности
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function safeParseInt(value, defaultValue = 0) {
    if (value === null || value === undefined || value === '') return defaultValue;
    const num = Number(value);
    return isNaN(num) || !Number.isFinite(num) ? defaultValue : Math.floor(num);
}

function generateUniqueId() {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '-' + performance.now();
}

function validatePointsInput(input, allowNegative = false) {
    if (input === null || input === undefined) {
        return { valid: false, error: "Введите значение" };
    }

    const trimmed = input.toString().trim();
    if (trimmed === '') {
        return { valid: false, error: "Введите значение" };
    }

    const num = Number(trimmed);
    if (isNaN(num) || !Number.isFinite(num)) {
        return { valid: false, error: "Введите корректное число" };
    }

    if (!allowNegative && num < 0) {
        return { valid: false, error: "Очки не могут быть отрицательными" };
    }

    return { valid: true, value: num, raw: trimmed };
}

window.addEventListener('DOMContentLoaded', () => {
    const saved = getSavedGames().filter(game => !game.finished);

    if (saved.length) {
        const savedDiv = document.getElementById('savedGame');
        savedDiv.style.display = 'block';
        savedDiv.innerHTML = '<h3>Незаконченные игры:</h3>';

        saved.forEach(game => {
            const wrapper = document.createElement('div');
            wrapper.className = 'saved-entry';

            const dateStr = new Date(game.date).toLocaleString();
            const playerNames = game.players?.map(p => escapeHTML(p.name)).join(', ') || '—';

            const label = document.createElement('div');
            label.innerHTML = `
        ${escapeHTML(dateStr)}, <strong>игроки:</strong> ${playerNames}
      `;

            const loadBtn = document.createElement('button');
            loadBtn.innerText = 'Загрузить';
            loadBtn.onclick = () => loadGame(game);

            const deleteBtn = document.createElement('button');
            deleteBtn.innerText = 'Удалить';
            deleteBtn.onclick = () => {
                if (confirm('Удалить это сохранение?')) {
                    deleteGame(game.id);
                    wrapper.remove();
                }
            };

            wrapper.appendChild(label);
            wrapper.appendChild(loadBtn);
            wrapper.appendChild(deleteBtn);
            savedDiv.appendChild(wrapper);
        });
    }

    setupPlayerInputs(playerCount);
});

document.querySelectorAll('.playersCount').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.playersCount').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        playerCount = parseInt(btn.value);
        setupPlayerInputs(playerCount);
    });
});

function setupPlayerInputs(count) {
    const container = document.querySelector('.playersIconsColours');
    container.innerHTML = '';

    const usedColors = new Set();
    const usedIcons = new Set();

    for (let i = 0; i < count; i++) {
        const availableColors = colors.filter(color => !usedColors.has(color));
        const availableIcons = iconList.filter(icon => !usedIcons.has(icon));

        // Автоматически выбираем уникальные цвет и иконку
        const selectedColor = availableColors[0] || colors[i % colors.length];
        const selectedIcon = availableIcons[0] || iconList[i % iconList.length];

        usedColors.add(selectedColor);
        usedIcons.add(selectedIcon);

        const playerBlock = document.createElement('div');
        playerBlock.classList.add('player-setup');
        playerBlock.innerHTML = `
        <h4>Игрок ${i + 1}</h4>
        <input type="text" placeholder="Имя игрока" class="player-name" maxlength="15">
        <div class="color-options">${colors.map((color, idx) => `
          <span class="color-circle ${color === selectedColor ? 'selected' : ''}" 
                style="background:${color}" 
                data-color="${color}"
                title="Цвет ${idx + 1}"></span>`).join('')}
        </div>
        <div class="icon-options">
          ${iconList.map((icon, idx) => `
            <i class="fas ${icon} ${icon === selectedIcon ? 'selected' : ''}" 
               data-icon="${icon}"
               title="Иконка ${idx + 1}"></i>`).join('')}
        </div>
      `;
        container.appendChild(playerBlock);
    }

    document.querySelectorAll('.color-circle').forEach(circle => {
        circle.addEventListener('click', () => {
            const parent = circle.parentElement;
            parent.querySelectorAll('.color-circle').forEach(c => c.classList.remove('selected'));
            circle.classList.add('selected');
        });
    });

    document.querySelectorAll('.icon-options i').forEach(icon => {
        icon.addEventListener('click', () => {
            const parent = icon.parentElement;
            parent.querySelectorAll('i').forEach(i => i.classList.remove('selected'));
            icon.classList.add('selected');
        });
    });

    if (!document.querySelector('.btn-next')) {
        const nextBtn = document.createElement('input');
        nextBtn.type = 'button';
        nextBtn.value = 'Продолжить';
        nextBtn.className = 'btn-next';
        nextBtn.addEventListener('click', savePlayerData);
        document.querySelector('.container').appendChild(nextBtn);
    }
}

async function savePlayerData() {
    const setups = document.querySelectorAll('.player-setup');
    players = [];

    // Проверка на уникальность имен
    const names = new Set();
    const colorsUsed = new Set();
    const iconsUsed = new Set();

    for (let setup of setups) {
        const name = setup.querySelector('.player-name').value.trim();
        const colorEl = setup.querySelector('.color-circle.selected');
        const iconEl = setup.querySelector('i.selected');

        if (!name) {
            await customAlert('Пожалуйста, введите имя для каждого игрока.');
            return;
        }

        if (names.has(name.toLowerCase())) {
            await customAlert('Имена игроков не должны повторяться.');
            return;
        }

        if (!colorEl) {
            await customAlert('Пожалуйста, выберите цвет для каждого игрока.');
            return;
        }

        if (!iconEl) {
            await customAlert('Пожалуйста, выберите иконку для каждого игрока.');
            return;
        }

        const color = colorEl.dataset.color;
        const icon = iconEl.dataset.icon;

        if (colorsUsed.has(color)) {
            await customAlert('Цвета игроков не должны повторяться.');
            return;
        }

        if (iconsUsed.has(icon)) {
            await customAlert('Иконки игроков не должны повторяться.');
            return;
        }

        names.add(name.toLowerCase());
        colorsUsed.add(color);
        iconsUsed.add(icon);

        players.push({
            name: escapeHTML(name),
            color: color,
            icon: icon,
            points: 0,
            history: []
        });
    }

    if (players.length === playerCount) {
        askShufflePlayers();
    }
}

function shufflePlayers() {
    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
    }
}

async function askShufflePlayers() {
    const shuffle = await customConfirm("Перемешивать ли очередь игроков?", { ok: 'Да', cancel: 'Нет' });
    if (shuffle) {
        shufflePlayers();
    }
    askScoreTableDisplay();
}

async function askScoreTableDisplay() {
    showScoreTable = await customConfirm("Показывать ли очки во время игры?", { ok: 'Да', cancel: 'Нет' });
    initGameField();
}

function initGameField() {
    const container = document.querySelector('.container');
    container.innerHTML = '<h3>Прогресс игроков</h3><div id="scoreBoard"></div><div class="buttons"></div>';

    historyTableCreated = false; // Сброс флага при новой игре

    renderScoreBoard();

    const addPointsBtn = document.createElement('button');
    addPointsBtn.innerText = 'Подвести итог раунда';
    addPointsBtn.onclick = () => promptPointsEntry();
    document.querySelector('.buttons').appendChild(addPointsBtn);

    const manualBtn = document.createElement('button');
    manualBtn.innerText = 'Ручной ввод очков';
    manualBtn.onclick = () => promptPointsEntry(true);
    document.querySelector('.buttons').appendChild(manualBtn);

    const endGameBtn = document.createElement('button');
    endGameBtn.innerText = 'Завершить игру';
    endGameBtn.style.backgroundColor = '#d9534f';
    endGameBtn.style.color = 'white';
    endGameBtn.onclick = confirmEndGame;
    document.querySelector('.buttons').appendChild(endGameBtn);
}

async function confirmEndGame() {
    const result = await showFinalScoresModal();
    if (result === 'restart') {
        restartGameWithSamePlayers();
    } else if (result === 'end') {
        const saves = getSavedGames();
        const updatedSaves = saves.map(game =>
            game.id === currentGameId ? { ...game, finished: true } : game
        );

        try {
            localStorage.setItem(savedGamesKey, JSON.stringify(updatedSaves));
        } catch (e) {
            console.error('Ошибка сохранения:', e);
            await customAlert('Не удалось сохранить результат игры. Данные могут быть потеряны.');
        }

        location.reload();
    }
}

async function showFinalScoresModal() {
    return new Promise(resolve => {
        const overlay = document.getElementById('modalOverlay');
        const box = document.getElementById('modalBox');
        const messageDiv = document.getElementById('modalMessage');
        const inputContainer = document.getElementById('modalInputContainer');
        inputContainer.classList.add('hidden');

        const sortedPlayers = [...players].sort((a, b) => b.points - a.points);
        const scoreList = sortedPlayers.map(p => `
      <div style="color:${p.color}; margin-bottom:5px;">
        <i class="fas ${p.icon}"></i> <strong>${escapeHTML(p.name)}</strong>: ${p.points} очков
      </div>
    `).join('');

        messageDiv.innerHTML = `
      <h3>Итоги игры</h3>
      ${scoreList}
    `;

        const okBtn = document.getElementById('modalOk');
        const cancelBtn = document.getElementById('modalCancel');
        overlay.classList.remove('hidden');

        okBtn.textContent = 'Повторить игру';
        cancelBtn.textContent = 'Завершить';

        cancelBtn.classList.remove('hidden');

        const cleanup = () => {
            overlay.classList.add('hidden');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        okBtn.onclick = () => {
            cleanup();
            resolve('restart');
        };

        cancelBtn.onclick = () => {
            cleanup();
            resolve('end');
        };
    });
}

function restartGameWithSamePlayers() {
    players.forEach(p => {
        p.points = 0;
        p.history = [];
    });
    currentRound = 1;
    historyTableCreated = false;
    saveGame();
    initGameField();
}

function renderScoreBoard() {
    const board = document.getElementById('scoreBoard');
    board.innerHTML = '';

    const sortedPlayers = [...players].sort((a, b) => b.points - a.points);
    const maxPoints = Math.max(...sortedPlayers.map(p => p.points), 1);

    sortedPlayers.forEach(player => {
        const bar = document.createElement('div');
        bar.className = 'player-bar';
        const barWidth = Math.max((player.points / maxPoints) * 100, 0);

        bar.innerHTML = `
    <div class="bar-container">
      <div class="bar" style="background:${player.color}; width:${barWidth}%">
        ${showScoreTable ? player.points : ''}
      </div>
      <div class="icon" style="color:${player.color}">
        <i class="fas ${player.icon}"></i> ${escapeHTML(player.name)}
      </div>
    </div>
    `;
        board.appendChild(bar);
    });

    if (showScoreTable) renderHistoryTable();

    saveGame();
}

function renderHistoryTable() {
    let historyDiv = document.getElementById('historyTable');
    let historyHead = document.querySelector('#historyTable + h3, h3 + #historyTable');

    if (!historyDiv) {
        historyDiv = document.createElement('div');
        historyDiv.id = 'historyTable';
        historyDiv.style.maxHeight = '200px';
        historyDiv.style.overflowY = 'auto';
        historyDiv.style.marginTop = '10px';
        document.querySelector('.buttons').after(historyDiv);
    }

    if (!historyHead && !historyTableCreated) {
        historyHead = document.createElement('h3');
        historyHead.innerText = 'История очков';
        historyHead.style.marginTop = '10px';
        historyDiv.before(historyHead);
        historyTableCreated = true;
    }

    const allEntries = [];
    players.forEach(p => {
        p.history.forEach(h => {
            allEntries.push({
                name: p.name,
                icon: p.icon,
                color: p.color,
                round: h.round,
                delta: h.delta
            });
        });
    });

    // Сортировка: ручной ввод сверху, затем по убыванию раундов
    allEntries.sort((a, b) => {
        if (a.round === 'ручной ввод' && b.round !== 'ручной ввод') return -1;
        if (b.round === 'ручной ввод' && a.round !== 'ручной ввод') return 1;
        if (typeof a.round === 'number' && typeof b.round === 'number') {
            return b.round - a.round;
        }
        return 0;
    });

    if (allEntries.length === 0) {
        historyDiv.innerHTML = '<p style="text-align: center; color: #666;">История очков пуста</p>';
        return;
    }

    historyDiv.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Игрок</th>
          <th>Очки</th>
          <th>Раунд</th>
        </tr>
      </thead>
      <tbody>
        ${allEntries.map(e => `
          <tr>
            <td style="color:${e.color}">
              <i class="fas ${e.icon}"></i> ${escapeHTML(e.name)}
            </td>
            <td>${e.delta > 0 ? '+' : ''}${e.delta}</td>
            <td>${escapeHTML(e.round.toString())}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

async function promptPointsEntry(manual = false) {
    if (manual) {
        const playerOptions = players.map((p, i) =>
            `<option value="${i}">${escapeHTML(p.name)}</option>`
        ).join('');

        const selectHtml = `
      <label>Выберите игрока:</label>
      <select id="playerSelect">${playerOptions}</select>
    `;

        const selectedIndex = await new Promise(resolve => {
            const overlay = document.getElementById('modalOverlay');
            const box = document.getElementById('modalBox');
            const messageDiv = document.getElementById('modalMessage');
            const inputContainer = document.getElementById('modalInputContainer');
            const inputField = document.getElementById('modalInput');
            const okBtn = document.getElementById('modalOk');
            const cancelBtn = document.getElementById('modalCancel');

            messageDiv.innerHTML = selectHtml;
            inputContainer.classList.add('hidden');
            overlay.classList.remove('hidden');
            cancelBtn.classList.remove('hidden');

            okBtn.textContent = 'ОК';
            cancelBtn.textContent = 'Отмена';

            const cleanup = () => {
                overlay.classList.add('hidden');
                okBtn.onclick = null;
                cancelBtn.onclick = null;
            };

            okBtn.onclick = () => {
                const sel = document.getElementById('playerSelect');
                cleanup();
                resolve(parseInt(sel.value));
            };

            cancelBtn.onclick = () => {
                cleanup();
                resolve(null);
            };
        });

        if (selectedIndex === null) return;

        const selectedPlayer = players[selectedIndex];
        let points;
        let isValid = false;

        do {
            points = await customPrompt(`Введите очки для ${selectedPlayer.name}`, "");
            if (points === null) return; // Пользователь отменил

            const validation = validatePointsInput(points, true); // Разрешаем отрицательные
            if (validation.valid) {
                selectedPlayer.points += validation.value;
                selectedPlayer.history.push({ round: 'ручной ввод', delta: validation.value });
                renderScoreBoard();
                isValid = true;
            } else {
                await customAlert(validation.error);
            }
        } while (!isValid);

    } else {
        let roundCompleted = true;

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            let points;
            let isValid = false;

            do {
                points = await customPrompt(`Ход № ${currentRound}: ${player.name}, введите очки`, "");
                if (points === null) {
                    // Пользователь отменил ввод для этого игрока
                    roundCompleted = false;
                    await customAlert(`Ввод очков для ${player.name} отменен. Раунд не завершен.`);
                    break;
                }

                const validation = validatePointsInput(points, true);
                if (validation.valid) {
                    player.points += validation.value;
                    player.history.push({ round: currentRound, delta: validation.value });
                    isValid = true;
                } else {
                    await customAlert(validation.error);
                }
            } while (!isValid);

            if (!roundCompleted) break;
        }

        if (roundCompleted) {
            currentRound++;
        }
        renderScoreBoard();
    }
}

function saveGame() {
    const savedGames = getSavedGames();

    if (currentGameId) {
        const existingIndex = savedGames.findIndex(g => g.id === currentGameId);
        if (existingIndex !== -1) {
            try {
                savedGames[existingIndex] = {
                    id: currentGameId,
                    date: Date.now(),
                    players: JSON.parse(JSON.stringify(players)),
                    round: currentRound,
                    showScoreTable: showScoreTable,
                    finished: false
                };
                localStorage.setItem(savedGamesKey, JSON.stringify(savedGames));
            } catch (e) {
                console.error('Ошибка сохранения игры:', e);
                handleStorageError(savedGames);
            }
            return;
        }
    }

    const newSave = {
        id: generateUniqueId(),
        date: Date.now(),
        players: JSON.parse(JSON.stringify(players)),
        round: currentRound,
        showScoreTable: showScoreTable,
        finished: false
    };

    currentGameId = newSave.id;
    savedGames.push(newSave);

    try {
        localStorage.setItem(savedGamesKey, JSON.stringify(savedGames));
    } catch (e) {
        console.error('Ошибка сохранения новой игры:', e);
        handleStorageError(savedGames);
    }
}

function handleStorageError(games) {
    // Попытка очистить старые сохранения
    if (games.length > MAX_SAVED_GAMES) {
        games.sort((a, b) => b.date - a.date); // Сортируем по дате (новые сверху)
        const trimmedGames = games.slice(0, MAX_SAVED_GAMES);

        try {
            localStorage.setItem(savedGamesKey, JSON.stringify(trimmedGames));
            console.log(`Удалено ${games.length - MAX_SAVED_GAMES} старых сохранений`);
        } catch (e) {
            console.error('Не удалось очистить старые сохранения:', e);
            // Последняя попытка - сохранить только текущую игру
            try {
                localStorage.setItem(savedGamesKey, JSON.stringify([games.find(g => g.id === currentGameId) || games[0]]));
            } catch (finalError) {
                console.error('Критическая ошибка хранения:', finalError);
            }
        }
    }
}

function getSavedGames() {
    try {
        const saved = localStorage.getItem(savedGamesKey);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error('Ошибка чтения сохранений:', e);
        return [];
    }
}

function loadGame(save) {
    // Валидация загружаемых данных
    if (!save || !save.players || !Array.isArray(save.players)) {
        customAlert('Ошибка загрузки игры: некорректные данные');
        return;
    }

    players = save.players.map(p => ({
        name: escapeHTML(p.name || 'Игрок'),
        color: p.color || colors[0],
        icon: p.icon || iconList[0],
        points: safeParseInt(p.points, 0),
        history: Array.isArray(p.history) ? p.history : []
    }));

    currentRound = safeParseInt(save.round, 1);
    showScoreTable = save.showScoreTable !== undefined ? save.showScoreTable : true;
    currentGameId = save.id;
    historyTableCreated = false;

    initGameField();
}

function deleteGame(id) {
    const saves = getSavedGames().filter(s => s.id !== id);
    try {
        localStorage.setItem(savedGamesKey, JSON.stringify(saves));
    } catch (e) {
        console.error('Ошибка удаления игры:', e);
    }
}

function customAlert(message) {
    return new Promise(resolve => {
        showModal({ message: escapeHTML(message), showCancel: false, input: false }, resolve);
    });
}

function customConfirm(message, labels = { ok: 'ОК', cancel: 'Отмена' }) {
    return new Promise(resolve => {
        showModal({
            message: escapeHTML(message),
            showCancel: true,
            input: false,
            labels
        }, resolve);
    });
}

function customPrompt(message, defaultValue = '') {
    return new Promise(resolve => {
        showModal({
            message: escapeHTML(message),
            showCancel: true,
            input: true,
            defaultValue: escapeHTML(defaultValue.toString())
        }, resolve);
    });
}

function showModal({ message, showCancel = false, input = false, defaultValue = '', labels = {} }, callback) {
    const overlay = document.getElementById('modalOverlay');
    const box = document.getElementById('modalBox');
    const messageDiv = document.getElementById('modalMessage');
    const inputContainer = document.getElementById('modalInputContainer');
    const inputField = document.getElementById('modalInput');
    const okBtn = document.getElementById('modalOk');
    const cancelBtn = document.getElementById('modalCancel');

    // Очистка старых обработчиков
    const oldOkHandler = okBtn.onclick;
    const oldCancelHandler = cancelBtn.onclick;
    if (oldOkHandler) okBtn.onclick = null;
    if (oldCancelHandler) cancelBtn.onclick = null;

    messageDiv.innerHTML = message;
    overlay.classList.remove('hidden');

    // Объявляем handleEnter в правильной области видимости
    let handleEnter;

    if (input) {
        inputContainer.classList.remove('hidden');
        inputField.value = defaultValue;
        inputField.focus();

        // Обработка Enter в поле ввода
        handleEnter = (e) => {
            if (e.key === 'Enter') {
                okBtn.click();
            }
        };

        inputField.addEventListener('keypress', handleEnter);
    } else {
        inputContainer.classList.add('hidden');
    }

    cancelBtn.classList.toggle('hidden', !showCancel);

    okBtn.textContent = labels.ok || 'ОК';
    cancelBtn.textContent = labels.cancel || 'Отмена';

    const cleanup = () => {
        overlay.classList.add('hidden');
        okBtn.onclick = null;
        cancelBtn.onclick = null;

        if (input && handleEnter) {
            inputField.removeEventListener('keypress', handleEnter);
        }
    };

    okBtn.onclick = () => {
        cleanup();
        callback(input ? inputField.value : true);
    };

    cancelBtn.onclick = () => {
        cleanup();
        callback(false);
    };
}