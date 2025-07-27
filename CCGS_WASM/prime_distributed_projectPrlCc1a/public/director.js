
//director.js
const startBtn = document.getElementById('start-btn');
const logDiv = document.getElementById('log');
const progressContainer = document.getElementById('progress-container');
const tasksCompletedSpan = document.getElementById('tasks-completed');
const runningTotalSpan = document.getElementById('running-total');

// New elements for the worker stats table
const workerCountSpan = document.getElementById('worker-count');
const workerTableBody = document.querySelector('#worker-table tbody');
const workers = {}; // Object to store data for each connected worker

const TOTAL_TASKS = 2048; // 1024; // 512 or 1024
let runningTotal = 0n; // Initialize runningTotal as a BigInt

const log = (message) => {
    logDiv.textContent += message + '\n';
    logDiv.scrollTop = logDiv.scrollHeight;
};
// const socket = new WebSocket('ws://localhost:8080'); // Remember to use your IP 
//192.168.1.107 Lan Ethernet
//192.168.59.244
//192.168.1.106 WiFi
// https://xn05c0cs-8080.asse.devtunnels.ms/
// const socket = new WebSocket('ws://xn05c0cs-8080.asse.devtunnels.ms:8080');
// Remember to use your actual IP address here if testing on other devices
const socket = new WebSocket('ws://192.168.1.100:8080');

socket.onopen = () => {
    log('✅ Connected. Registering as Director...');
    socket.send(JSON.stringify({ type: 'registerDirector' }));
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch(data.type) {
        case 'log':
            log(data.message);
            break;

        // --- NEW: Logic to handle worker connections ---
        case 'workerConnected':
            workers[data.workerId] = { info: data.info, status: 'Idle', lastTaskTime: '---' };
            updateWorkerTable();
            log(`Worker #${data.workerId} connected.`);
            break;
            
        case 'workerDisconnected':
            delete workers[data.workerId];
            updateWorkerTable();
            log(`Worker #${data.workerId} disconnected.`);
            break;
        // ---------------------------------------------

        case 'progress':
            // Update the specific progress bar
            const bar = document.getElementById(`bar-${data.taskId}`);
            if (bar) {
                bar.style.backgroundColor = '#2ecc71'; // Green
                bar.textContent = `Task ${data.taskId}: Done (${BigInt(data.count).toLocaleString()})`;
            }
            
            // Update running totals using BigInt math
            runningTotal += BigInt(data.count);
            tasksCompletedSpan.textContent = `${data.totalCompleted} / ${TOTAL_TASKS}`;
            runningTotalSpan.textContent = runningTotal.toLocaleString();

            // --- NEW: Update the worker's status in the table ---
            if (workers[data.workerId]) {
                workers[data.workerId].status = 'Idle';
                workers[data.workerId].lastTaskTime = data.taskDuration.toFixed(2);
                updateWorkerTable();
            }
            break;

        case 'complete':
            log(`\n🎉 ALL TASKS COMPLETE! Final Total: ${BigInt(data.totalPrimes).toLocaleString()}`);
            startBtn.disabled = false;
            startBtn.textContent = 'Start Computation';
            // Mark all workers as Idle
            for (const id in workers) {
                workers[id].status = 'Idle';
            }
            updateWorkerTable();
            break;
    }
};

startBtn.onclick = () => {
    log('Sending command to start computation...');
    startBtn.disabled = true;
    startBtn.textContent = 'Computation Running...';
    
    // Reset UI
    progressContainer.innerHTML = '';
    runningTotal = 0n; // Reset BigInt total
    tasksCompletedSpan.textContent = `0 / ${TOTAL_TASKS}`;
    runningTotalSpan.textContent = '0';

    // Create placeholder bars
    for (let i = 0; i < TOTAL_TASKS; i++) {
        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        bar.id = `bar-${i}`;
        bar.textContent = `Task ${i}: Waiting...`;
        progressContainer.appendChild(bar);
    }

    // --- NEW: Update worker table to show tasks are being assigned ---
    for (const id in workers) {
        workers[id].status = 'Assigning...';
    }
    updateWorkerTable();

    socket.send(JSON.stringify({ type: 'startComputation' }));
};

// --- NEW: Function to render the worker table ---
function updateWorkerTable() {
    workerTableBody.innerHTML = ''; // Clear the table
    workerCountSpan.textContent = Object.keys(workers).length;

    for (const id in workers) {
        const worker = workers[id];
        const row = workerTableBody.insertRow();
        
        row.innerHTML = `
            <td>${id}</td>
            <td>${worker.status}</td>
            <td>${worker.info.cpuCores}</td>
            <td>${worker.info.deviceMemory}</td>
            <td>${worker.assignedTask ? worker.assignedTask.taskId : '---'}</td>
            <td>${worker.lastTaskTime}</td>
            <td>${worker.info.userAgent}</td>
        `;
    }
}



/*
const startBtn = document.getElementById('start-btn');
const logDiv = document.getElementById('log');
const progressContainer = document.getElementById('progress-container');
const tasksCompletedSpan = document.getElementById('tasks-completed');
const runningTotalSpan = document.getElementById('running-total');

const TOTAL_TASKS = 10;
let runningTotal = 0n; // Initialize runningTotal as a BigInt

const log = (message) => {
    logDiv.textContent += message + '\n';
    logDiv.scrollTop = logDiv.scrollHeight;
};

// Remember to use your actual IP address here if testing on other devices
const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => {
    log('✅ Connected. Registering as Director...');
    socket.send(JSON.stringify({ type: 'registerDirector' }));
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch(data.type) {
        case 'log':
            log(data.message);
            break;
        case 'progress':
            // Update the specific progress bar
            const bar = document.getElementById(`bar-${data.taskId}`);
            if (bar) {
                bar.style.backgroundColor = '#2ecc71'; // Green
                bar.textContent = `Task ${data.taskId}: Done (${BigInt(data.count).toLocaleString()})`;
            }
            
            // Update running totals using BigInt math
            runningTotal += BigInt(data.count);
            tasksCompletedSpan.textContent = `${data.totalCompleted} / ${TOTAL_TASKS}`;
            runningTotalSpan.textContent = runningTotal.toLocaleString();
            break;
        case 'complete':
            log(`\n🎉 ALL TASKS COMPLETE! Final Total: ${BigInt(data.totalPrimes).toLocaleString()}`);
            startBtn.disabled = false;
            startBtn.textContent = 'Start Computation';
            break;
    }
};

startBtn.onclick = () => {
    log('Sending command to start computation...');
    startBtn.disabled = true;
    startBtn.textContent = 'Computation Running...';
    
    // Reset UI
    progressContainer.innerHTML = '';
    runningTotal = 0n; // Reset BigInt total
    tasksCompletedSpan.textContent = `0 / ${TOTAL_TASKS}`;
    runningTotalSpan.textContent = '0';

    // Create placeholder bars
    for (let i = 0; i < TOTAL_TASKS; i++) {
        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        bar.id = `bar-${i}`;
        bar.textContent = `Task ${i}: Waiting...`;
        progressContainer.appendChild(bar);
    }

    socket.send(JSON.stringify({ type: 'startComputation' }));
};







/*
const startBtn = document.getElementById('start-btn');
const logDiv = document.getElementById('log');
const progressContainer = document.getElementById('progress-container');
const tasksCompletedSpan = document.getElementById('tasks-completed');
const runningTotalSpan = document.getElementById('running-total');

const TOTAL_TASKS = 10;
let runningTotal = 0;

const log = (message) => {
    logDiv.textContent += message + '\n';
    logDiv.scrollTop = logDiv.scrollHeight;
};

// const socket = new WebSocket('ws://localhost:8080'); // Remember to use your IP 
//192.168.1.107 Lan Ethernet
//192.168.59.244
//192.168.1.106 WiFi
// https://xn05c0cs-8080.asse.devtunnels.ms/
// const socket = new WebSocket('ws://xn05c0cs-8080.asse.devtunnels.ms:8080');
const socket = new WebSocket('ws://192.168.1.106:8080');

socket.onopen = () => {
    log('✅ Connected. Registering as Director...');
    socket.send(JSON.stringify({ type: 'registerDirector' }));
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch(data.type) {
        case 'log':
            log(data.message);
            break;
        case 'progress':
            // Update the specific progress bar
            const bar = document.getElementById(`bar-${data.taskId}`);
            if (bar) {
                bar.style.backgroundColor = '#2ecc71'; // Green
                bar.textContent = `Task ${data.taskId}: Done (${data.count.toLocaleString()})`;
            }
            
            // Update running totals
            runningTotal += data.count;
            tasksCompletedSpan.textContent = `${data.totalCompleted} / ${TOTAL_TASKS}`;
            runningTotalSpan.textContent = runningTotal.toLocaleString();
            break;
        case 'complete':
            log(`\n🎉 ALL TASKS COMPLETE! Final Total: ${data.totalPrimes.toLocaleString()}`);
            startBtn.disabled = false;
            startBtn.textContent = 'Start Computation';
            break;
    }
};

startBtn.onclick = () => {
    log('Sending command to start computation...');
    startBtn.disabled = true;
    startBtn.textContent = 'Computation Running...';
    
    // Reset UI
    progressContainer.innerHTML = '';
    runningTotal = 0;
    tasksCompletedSpan.textContent = `0 / ${TOTAL_TASKS}`;
    runningTotalSpan.textContent = '0';

    // Create placeholder bars
    for (let i = 0; i < TOTAL_TASKS; i++) {
        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        bar.id = `bar-${i}`;
        bar.textContent = `Task ${i}: Waiting...`;
        progressContainer.appendChild(bar);
    }

    socket.send(JSON.stringify({ type: 'startComputation' }));
};
*/