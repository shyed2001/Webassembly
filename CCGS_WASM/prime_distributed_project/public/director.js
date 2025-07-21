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

const socket = new WebSocket('ws://localhost:8080'); // Remember to use your IP

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