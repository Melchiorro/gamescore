const iconList = [
  "fa-hippo", "fa-fish", "fa-frog", "fa-dove",
  "fa-dog", "fa-crow", "fa-cat", "fa-otter", "fa-shrimp"
];

const colors = ["#f94144", "#f3722c", "#43aa8b", "#577590"];

let playerCount = 4;
let players = [];
let currentRound = 1;
let showScoreTable = true;
let currentGameId = null;

const savedGamesKey = 'scary-tales-saves';

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
      const playerNames = game.players?.map(p => p.name).join(', ') || '—';

      const label = document.createElement('div');
      label.innerHTML = `
        ${dateStr}, <strong>игроки:</strong> ${playerNames}
      `;

      const loadBtn = document.createElement('button');
      loadBtn.innerText = 'Загрузить';
      loadBtn.onclick = () => loadGame(game);

      const deleteBtn = document.createElement('button');
      deleteBtn.innerText = 'Удалить';
      deleteBtn.onclick = () => {
        deleteGame(game.id);
        wrapper.remove();
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

  for (let i = 0; i < count; i++) {
    const playerBlock = document.createElement('div');
    playerBlock.classList.add('player-setup');
    playerBlock.innerHTML = `
        <h4>Игрок ${i + 1}</h4>
        <input type="text" placeholder="Имя игрока" class="player-name" maxlength="10">
        <div class="color-options">${colors.map(color => `<span class="color-circle" style="background:${color}" data-color="${color}"></span>`).join('')}</div>
        <div class="icon-options">
          ${iconList.map(icon => `<i class="fas ${icon}" data-icon="${icon}"></i>`).join('')}
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

  for (let setup of setups) {
    const name = setup.querySelector('.player-name').value.trim();
    const colorEl = setup.querySelector('.color-circle.selected');
    const iconEl = setup.querySelector('i.selected');

    if (!name || !colorEl || !iconEl) {
      await customAlert('Пожалуйста, заполните все поля для каждого игрока.');
      return;
    }

    players.push({
      name,
      color: colorEl.dataset.color,
      icon: iconEl.dataset.icon,
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
    await shufflePlayers();
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
    const saves = getSavedGames().filter(save => !save.isCurrent);
    localStorage.setItem(savedGamesKey, JSON.stringify(saves));
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
        <i class="fas ${p.icon}"></i> <strong>${p.name}</strong>: ${p.points} очков
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
  saveGame();
  initGameField();
}


function renderScoreBoard() {
  const board = document.getElementById('scoreBoard');
  board.innerHTML = '';
  const maxPoints = Math.max(...players.map(p => p.points), 1);

  players.forEach(player => {
    const bar = document.createElement('div');
    bar.className = 'player-bar';
    const barWidth = (player.points / maxPoints) * 100;

    bar.innerHTML = `
    <div class="bar-container">
      <div class="bar" style="background:${player.color}; width:${barWidth}%">${showScoreTable ? player.points : ''}</div>
      <div class="icon" style="color:${player.color}"><i class="fas ${player.icon}"></i> ${player.name}</div>
    </div>
    `;
    board.appendChild(bar);
  });

  if (showScoreTable) renderHistoryTable();

  saveGame();
}

function renderHistoryTable() {
  let historyDiv = document.getElementById('historyTable');
  if (!historyDiv) {
    historyDiv = document.createElement('div');
    historyDiv.id = 'historyTable';
    historyDiv.style.maxHeight = '200px';
    historyDiv.style.overflowY = 'auto';
    historyDiv.style.marginTop = '10px';
    document.querySelector('.buttons').after(historyDiv);
    historyHead = document.createElement('h3');
    historyHead.innerText = `История очков`;
    historyHead.style.marginTop = '10px';
    document.querySelector('#historyTable').before(historyHead);
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

  allEntries.sort((a, b) => {
    if (a.round === 'ручной ввод') return -1;
    if (b.round === 'ручной ввод') return 1;
    return b.round - a.round;
  });

  historyDiv.innerHTML = `<table><thead><tr><th>Игрок</th><th>Очки</th><th>Раунд</th></tr></thead><tbody>
    ${allEntries.map(e => `
      <tr>
        <td style="color:${e.color}"><i class="fas ${e.icon}"></i> ${e.name}</td>
        <td>${e.delta}</td>
        <td>${e.round}</td>
      </tr>
    `).join('')}
  </tbody></table>`;
}

async function promptPointsEntry(manual = false) {
  if (manual) {
    const playerOptions = players.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
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
    const points = await customPrompt(`Введите очки для ${selectedPlayer.name}`, "0");
    if (points !== null) {
      const num = parseInt(points);
      if (!isNaN(num)) {
        selectedPlayer.points += num;
        selectedPlayer.history.push({ round: 'ручной ввод', delta: num });
        renderScoreBoard();
      }
    }
  } else {
    for (let player of players) {
      const points = await customPrompt(`Ход № ${currentRound}: ${player.name}, введите очки`, "0");
      if (points !== null) {
        const num = parseInt(points);
        if (!isNaN(num)) {
          player.points += num;
          player.history.push({ round: currentRound, delta: num });
        }
      }
    }
    currentRound++;
    renderScoreBoard();
  }
}


function saveGame() {
  const saves = getSavedGames();
  const now = currentGameId || new Date().toISOString();

  const current = {
    id: now,
    date: new Date().toISOString(),
    players,
    currentRound,
    showScoreTable,
    isCurrent: true,
    finished: false
  };

  const updated = [current, ...saves.filter(s => s.id !== now)];
  localStorage.setItem(savedGamesKey, JSON.stringify(updated));
}




function getSavedGames() {
  return JSON.parse(localStorage.getItem(savedGamesKey) || '[]');
}

function loadGame(save) {
  players = save.players;
  currentRound = save.currentRound;
  showScoreTable = save.showScoreTable;

  currentGameId = save.id; // сохранить ID загруженной игры

  const saves = getSavedGames().map(s => ({
    ...s,
    isCurrent: s.id === save.id
  }));
  localStorage.setItem(savedGamesKey, JSON.stringify(saves));

  initGameField();
}



function deleteGame(id) {
  const saves = getSavedGames().filter(s => s.id !== id);
  localStorage.setItem(savedGamesKey, JSON.stringify(saves));
  location.reload();
}






function customAlert(message) {
  return new Promise(resolve => {
    showModal({ message, showCancel: false, input: false }, resolve);
  });
}

function customConfirm(message, labels = { ok: 'ОК', cancel: 'Отмена' }) {
  return new Promise(resolve => {
    showModal({ message, showCancel: true, input: false, labels }, resolve);
  });
}


function customPrompt(message, defaultValue = '') {
  return new Promise(resolve => {
    showModal({ message, showCancel: true, input: true, defaultValue }, resolve);
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

  messageDiv.textContent = message;
  overlay.classList.remove('hidden');

  if (input) {
    inputContainer.classList.remove('hidden');
    inputField.value = defaultValue;
    inputField.focus();
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
