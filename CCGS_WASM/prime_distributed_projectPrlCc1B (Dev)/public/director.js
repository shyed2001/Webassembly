// File: /public/director.js
import { config } from './config.js';

// --- UI Element Selections ---
const startBtn = document.getElementById('start-btn');
const pauseResumeBtn = document.getElementById('pause-resume-btn');
const refreshBtn = document.getElementById('refresh-btn');
const restartBtn = document.getElementById('restart-btn');
const logDiv = document.getElementById('log');
const progressContainer = document.getElementById('progress-container');
const tasksCompletedSpan = document.getElementById('tasks-completed');
const runningTotalSpan = document.getElementById('running-total');
const nValueSpan = document.getElementById('n-value');
const workerCountSpan = document.getElementById('worker-count');
const computationStatusSpan = document.getElementById('computation-status');
const workersTableBody = document.querySelector('#workers-table tbody');

// --- State Variables ---
let TOTAL_TASKS = 0;
let N_VALUE = 0;
let IS_RUNNING = false;
let runningTotal = 0n;
const workerStats = new Map();
let socket;

const log = (message) => {
    logDiv.textContent += message + '\n';
    logDiv.scrollTop = logDiv.scrollHeight;
};

function connectDirectorSocket() {
    log('Attempting to connect Director to coordinator...');
    socket = new WebSocket(config.WEBSOCKET_URL);

    socket.onopen = () => {
        log('✅ Connected. Registering as Director...');
        socket.send(JSON.stringify({ type: 'registerDirector' }));
        updateUIState();
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'log':
                log(data.message);
                break;
            case 'fullState':
                log('🔄 Received full state from server. Rebuilding UI...');
                TOTAL_TASKS = data.totalTasks;
                N_VALUE = data.nValue;
                IS_RUNNING = data.isRunning;
                nValueSpan.textContent = N_VALUE.toLocaleString();
                buildProgressUI(data.results);
                workerStats.clear();
                if (data.workers) {
                    data.workers.forEach(([id, info]) => workerStats.set(id, info));
                }
                updateWorkersTable();
                updateUIState();
                break;
            case 'progress':
                const bar = document.getElementById(`bar-${data.taskId}`);
                if (bar) {
                    bar.style.backgroundColor = '#2ecc71';
                    bar.textContent = `Task ${data.taskId}: Done`;
                }
                tasksCompletedSpan.textContent = `${data.totalCompleted} / ${TOTAL_TASKS}`;
                runningTotal = 0n;
                workerStats.forEach(worker => {
                    runningTotal += BigInt(worker.stats.primesFound || 0);
                });
                runningTotalSpan.textContent = runningTotal.toLocaleString();
                break;
            case 'complete':
                log(`\n🎉 ALL TASKS COMPLETE! Final Total: ${BigInt(data.totalPrimes).toLocaleString()}`);
                IS_RUNNING = false;
                updateUIState();
                break;
            case 'workerUpdate':
                workerStats.set(data.workerId, data.workerInfo);
                updateWorkersTable();
                break;
            case 'workerRemoved':
                workerStats.delete(data.workerId);
                updateWorkersTable();
                break;
        }
    };

    socket.onclose = () => {
        log('❌ Director disconnected. Reconnecting in 5 seconds...');
        IS_RUNNING = false;
        updateUIState();
        setTimeout(connectDirectorSocket, 5000);
    };

    socket.onerror = (error) => {
        log('❌ Director WebSocket error. Check console.');
        console.error('WebSocket Error:', error);
        socket.close();
    };
}

function updateWorkersTable() {
    workersTableBody.innerHTML = '';
    workerStats.forEach((info, id) => {
        const row = workersTableBody.insertRow();
        const statusClass = info.status === 'Idle' ? 'text-green-500' : info.status === 'Busy' ? 'text-blue-500' : 'text-red-500';
        row.innerHTML = `
            <td>${id}</td>
            <td>${info.ipAddress || 'N/A'}</td>
            <td class="${statusClass}">${info.status || 'N/A'}</td>
            <td>${info.currentTask !== null ? `Task ${info.currentTask}` : 'N/A'}</td>
            <td>${info.stats?.tasksCompleted || 0}</td>
            <td>${BigInt(info.stats?.primesFound || 0).toLocaleString()}</td>
            <td>${info.cpuCores || 'N/A'}</td>
            <td>${info.stats?.memory || 'N/A'}</td>
            <td>${info.browserInfo || 'Unknown'}</td>
            <td><button class="btn btn-danger btn-sm" onclick="window.terminateWorker('${id}')">Terminate</button></td>
        `;
    });
    workerCountSpan.textContent = workerStats.size;
}

function buildProgressUI(results) {
    progressContainer.innerHTML = '';
    let completedCount = 0;
    for (let i = 0; i < TOTAL_TASKS; i++) {
        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        bar.id = `bar-${i}`;
        if (results && results[i] !== null) {
            bar.style.backgroundColor = '#2ecc71';
            bar.textContent = `Task ${i}: Done`;
            completedCount++;
        } else {
            bar.textContent = `Task ${i}: Waiting`;
        }
        progressContainer.appendChild(bar);
    }
    tasksCompletedSpan.textContent = `${completedCount} / ${TOTAL_TASKS}`;
}

function updateUIState() {
    computationStatusSpan.textContent = IS_RUNNING ? 'Running' : 'Paused';
    startBtn.disabled = IS_RUNNING;
    pauseResumeBtn.disabled = (workerStats.size === 0);
    if (IS_RUNNING) {
        pauseResumeBtn.textContent = 'Pause Computation';
        pauseResumeBtn.classList.remove('btn-secondary');
        pauseResumeBtn.classList.add('btn-warning');
    } else {
        pauseResumeBtn.textContent = 'Resume Computation';
        pauseResumeBtn.classList.remove('btn-warning');
        pauseResumeBtn.classList.add('btn-secondary');
    }
}

window.terminateWorker = (workerId) => {
    if (confirm(`Are you sure you want to terminate worker ${workerId}?`)) {
        socket.send(JSON.stringify({ type: 'terminateWorker', workerId }));
    }
};

startBtn.onclick = () => {
    if (confirm('This will clear all previous logs and results. Are you sure?')) {
        log('Sending command to start a new computation...');
        socket.send(JSON.stringify({ type: 'startComputation' }));
    }
};

pauseResumeBtn.onclick = () => {
    const action = IS_RUNNING ? 'pauseComputation' : 'resumeComputation';
    log(`Sending command to ${action}...`);
    socket.send(JSON.stringify({ type: action }));
};

refreshBtn.onclick = () => {
    log('Refreshing page...');
    location.reload(true);
};

restartBtn.onclick = () => {
    if (confirm('Are you sure you want to restart the server?')) {
        log('Sending command to restart the server...');
        socket.send(JSON.stringify({ type: 'restartServer' }));
    }
};

connectDirectorSocket();