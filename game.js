import { saveResults, loadResults } from './storage.js';
import { setupScoresButton } from './ui.js';

function getScoreColor(score) {
  const percent = Math.max(0, Math.min(1, score / 1000));
  const r = Math.round(255 * (1 - percent));
  const g = Math.round(180 * percent + 60 * (1 - percent));
  return `rgb(${r},${g},80)`;
}

export function initGame() {
  document.addEventListener('DOMContentLoaded', () => {
    const gameArea = document.querySelector('.game-area');
    const gameAreaWidth = gameArea.offsetWidth;
    const gameAreaHeight = gameArea.offsetHeight;
    const totalTargets = 15;
    const minDistance = 60;
    let positions = [];
    let targets = [];
    let currentTargetIndex = 0;
    let startTime = null;
    let totalTime = 0;
    let incorrectClicks = 0;
    let missedGreenTargets = 0;
    let paused = false;
    let pauseTime = null;
    let currentTimeout = null;
    let waitingForReaction = false;
    let pendingAdvance = false;
    let lastReactionTime = 0;
    let results = loadResults();
    let pauseBtn = document.getElementById('pause');
    let restart = document.getElementById('restart');

    function isPositionValid(x, y) {
      return positions.every(([px, py]) => {
        const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        return distance >= minDistance;
      });
    }

    function generateTargets() {
      gameArea.innerHTML = '';
      positions = [];
      targets = [];
      for (let i = 0; i < totalTargets; i++) {
        const target = document.createElement('div');
        target.classList.add('target');
        let randomX, randomY;
        do {
          randomX = Math.random() * (gameAreaWidth - 250);
          randomY = Math.random() * (gameAreaHeight - 400);
        } while (!isPositionValid(randomX, randomY));
        positions.push([randomX, randomY]);
        const isGreen = Math.random() < 0.7;
        const randomColor = isGreen ? 'green' : 'red';
        target.style.position = 'absolute';
        target.style.left = `${randomX}px`;
        target.style.top = `${randomY}px`;
        target.style.backgroundColor = randomColor;
        target.style.borderRadius = '50%';
        target.style.display = 'none';
        targets.push(target);
        gameArea.appendChild(target);
      }
    }

    function addTargetListeners() {
      targets.forEach((target, index) => {
        target.onclick = null;
        target.addEventListener('click', () => {
          if (paused) return;
          if (index === currentTargetIndex && waitingForReaction) {
            target.clicked = true;
            waitingForReaction = false;
            pendingAdvance = true;
            timerWorker.postMessage('stop');
          }
          if (target.style.backgroundColor === 'red') {
            incorrectClicks++;
          }
        });
      });
    }

    function advanceTarget() {
      if (currentTimeout) {
        clearTimeout(currentTimeout);
        currentTimeout = null;
      }
      if (currentTargetIndex > 0) {
        const prevTarget = targets[currentTargetIndex - 1];
        if (prevTarget.style.backgroundColor === 'green' && !prevTarget.clicked) {
          missedGreenTargets++;
        }
        prevTarget.style.display = 'none';
      }
      if (currentTargetIndex < totalTargets) {
        const currentTarget = targets[currentTargetIndex];
        currentTarget.style.display = 'block';
        waitingForReaction = true;
        pendingAdvance = false;
        timerWorker.postMessage('start');
        currentTimeout = setTimeout(() => {
          if (waitingForReaction) {
            waitingForReaction = false;
            pendingAdvance = true;
            timerWorker.postMessage('stop');
          }
        }, 1500);
      } else {
        const averageTime = totalTime / (totalTargets - 1);
        const score = Math.round(2000 - averageTime - missedGreenTargets * 50 - incorrectClicks * 30);
        let gameOverPopover = document.getElementById('gameover-popover');
        if (!gameOverPopover) {
          gameOverPopover = document.createElement('div');
          gameOverPopover.id = 'gameover-popover';
          gameOverPopover.style.position = 'fixed';
          gameOverPopover.style.top = '50%';
          gameOverPopover.style.left = '50%';
          gameOverPopover.style.transform = 'translate(-50%, -50%)';
          gameOverPopover.style.background = '#fff';
          gameOverPopover.style.border = '1px solid #ccc';
          gameOverPopover.style.borderRadius = '12px';
          gameOverPopover.style.boxShadow = '0 2px 16px rgba(0,0,0,0.2)';
          gameOverPopover.style.padding = '36px 32px 24px 32px';
          gameOverPopover.style.zIndex = '2000';
          gameOverPopover.style.minWidth = '340px';
          gameOverPopover.style.display = 'none';
          gameOverPopover.innerHTML = `
            <button id="close-gameover-popover" style="position:absolute;top:12px;right:16px;font-size:22px;background:none;border:none;cursor:pointer;">&times;</button>
            <div id="gameover-content"></div>
          `;
          document.body.appendChild(gameOverPopover);
          document.getElementById('close-gameover-popover').onclick = () => {
            gameOverPopover.style.display = 'none';
          };
        }
        const scoreColor = getScoreColor(score);
        document.getElementById('gameover-content').innerHTML = `
          <h1 style=\"margin-top:0;text-align:center;font-size:2.2em;letter-spacing:1px;\">Game Over</h1>
          <div style=\"display:flex;justify-content:center;gap:32px;margin:18px 0 10px 0;font-size:1.1em;\">
            <div><b>Avg Reaction:</b> ${averageTime.toFixed(2)}ms</div>
            <div><b>Missed Greens:</b> ${missedGreenTargets}</div>
            <div><b>Incorrect Clicks:</b> ${incorrectClicks}</div>
          </div>
          <div style=\"text-align:center;margin-top:18px;\">
            <span style=\"font-size:2.3em;font-weight:bold;color:${scoreColor};\">${score}</span><br>
            <span style=\"font-size:1.1em;color:#888;\">Final Score</span>
          </div>
        `;
        gameOverPopover.style.display = 'block';
        const timestamp = new Date().toISOString();
        results[timestamp] = {
          averageTime: averageTime.toFixed(2),
          incorrectClicks,
          missedGreenTargets,
          score,
          targets: { ...results.targets },
        };
        saveResults(results);
      }
    }

    // Web Worker for timing (inline)
    const timerWorkerCode = `
      self.onmessage = function(e) {
        if (e.data === 'start') {
          self.startTime = performance.now();
        } else if (e.data === 'stop') {
          const elapsed = performance.now() - (self.startTime || 0);
          self.postMessage(elapsed);
        }
      };
    `;
    const timerWorkerBlob = new Blob([timerWorkerCode], { type: 'application/javascript' });
    let timerWorker = new Worker(URL.createObjectURL(timerWorkerBlob));
    timerWorker.onmessage = function (e) {
      if (!waitingForReaction && !pendingAdvance) return;
      lastReactionTime = e.data;
      totalTime += lastReactionTime;
      if (!results.targets) results.targets = {};
      results.targets[`target_${currentTargetIndex}`] = {
        color: targets[currentTargetIndex]?.style.backgroundColor,
        reactionTime: lastReactionTime.toFixed(2),
      };
      waitingForReaction = false;
      if (pendingAdvance) {
        pendingAdvance = false;
        currentTargetIndex++;
        advanceTarget();
      }
    };

    // Pause button
    pauseBtn.onclick = function () {
      if (!paused) {
        paused = true;
        pauseBtn.textContent = 'Resume';
        pauseTime = performance.now();
        if (currentTargetIndex < totalTargets) {
          targets[currentTargetIndex].style.display = 'none';
        }
        if (currentTimeout) {
          clearTimeout(currentTimeout);
          currentTimeout = null;
        }
      } else {
        paused = false;
        pauseBtn.textContent = 'Pause';
        if (currentTargetIndex < totalTargets) {
          targets[currentTargetIndex].style.display = 'block';
          currentTimeout = setTimeout(() => {
            currentTargetIndex++;
            advanceTarget();
          }, 1500);
        }
      }
    };

    // Restart button
    restart.addEventListener('click', () => {
      if (currentTimeout) {
        clearTimeout(currentTimeout);
        currentTimeout = null;
      }
      currentTargetIndex = 0;
      startTime = performance.now();
      totalTime = 0;
      incorrectClicks = 0;
      missedGreenTargets = 0;
      if (results.targets) results.targets = {};
      paused = false;
      pauseBtn.textContent = 'Pause';
      generateTargets();
      addTargetListeners();
      advanceTarget();
      createStartButton();
    });

    // Start button
    function createStartButton() {
      let startBtn = document.getElementById('start-btn');
      if (!startBtn) {
        startBtn = document.createElement('button');
        startBtn.id = 'start-btn';
        startBtn.textContent = 'Start';
        startBtn.style.position = 'absolute';
        startBtn.style.top = '50%';
        startBtn.style.left = '50%';
        startBtn.style.transform = 'translate(-50%, -50%)';
        startBtn.style.fontSize = '2em';
        startBtn.style.padding = '18px';
        startBtn.style.borderRadius = '12px';
        startBtn.style.background = '#4caf50';
        startBtn.style.color = '#fff';
        startBtn.style.border = 'none';
        startBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
        startBtn.style.cursor = 'pointer';
        startBtn.style.zIndex = '1001';
        startBtn.style.textAlign = 'center';
        gameArea.appendChild(startBtn);
      }
      return startBtn;
    }

    const startBtn = createStartButton();
    pauseBtn.style.display = 'none';
    restart.style.display = 'none';

    function startGame() {
      gameArea.innerHTML = '';
      startBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-block';
      restart.style.display = 'inline-block';
      generateTargets();
      addTargetListeners();
      currentTargetIndex = 0;
      totalTime = 0;
      incorrectClicks = 0;
      missedGreenTargets = 0;
      if (results.targets) results.targets = {};
      paused = false;
      pauseBtn.textContent = 'Pause';
      startTime = performance.now();
      advanceTarget();
    }

    startBtn.onclick = startGame;
    setupScoresButton();
  });
} 
