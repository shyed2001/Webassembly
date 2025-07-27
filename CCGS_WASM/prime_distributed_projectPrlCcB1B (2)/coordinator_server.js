// In: prime_distributed_projectPrlCcB1B (2)/coordinator_server.js

import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const wss = new WebSocketServer({ port: 8080, host: '0.0.0.0' });
console.log('Coordinator server running on ws://192.168.1.100:8080');

const N = 5120000;
const TOTAL_TASKS = 5120;
const HEARTBEAT_INTERVAL = 30000;
const TASK_TIMEOUT = 180000;
const STATE_FILE = path.join(process.cwd(), 'computation_state.json');
const TASK_LOG_FILE = path.join(process.cwd(), 'task_log.csv');
const WORKER_LOG_FILE = path.join(process.cwd(), 'worker_log.csv');
const NOOP = () => {}; // This is the added line

// --- STATE VARIABLES ---
// ... (rest of the file remains the same)
// --- STATE VARIABLES ---
let directorSocket = null;
const workers = new Map();
let taskQueue = [];
let results = new Array(TOTAL_TASKS).fill(null);
let isRunning = false;
let computationStartTime = null;

// --- LOGGING & STATE ---
if (!fs.existsSync(TASK_LOG_FILE)) {
    fs.writeFileSync(TASK_LOG_FILE, 'Timestamp,TaskID,WorkerID,Status,Duration(ms)\n');
}
if (!fs.existsSync(WORKER_LOG_FILE)) {
    fs.writeFileSync(WORKER_LOG_FILE, 'Timestamp,WorkerID,IPAddress,CPU_Cores,Browser,Status\n');
}
const logTaskEvent = (taskId, workerId, status, duration = '') => {
    fs.appendFileSync(TASK_LOG_FILE, `${new Date().toISOString()},${taskId},${workerId},${status},${duration}\n`);
};
const logWorkerEvent = (workerId, ip, cpu, browser, status) => {
    fs.appendFileSync(WORKER_LOG_FILE, `${new Date().toISOString()},${workerId},${ip},${cpu},"${browser}",${status}\n`);
};
function bigIntReplacer(key, value) { return typeof value === 'bigint' ? value.toString() : value; }
function saveState() {
    try {
        const state = { N, TOTAL_TASKS, isRunning, computationStartTime, results, taskQueue };
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, bigIntReplacer), 'utf8');
    } catch (err) { console.error('Error saving state:', err); }
}

function initializeTasks(clearStateFile = false) {
    if (clearStateFile && fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE);
    }
    taskQueue = [];
    results = new Array(TOTAL_TASKS).fill(null);
    const chunkSize = Math.floor(N / TOTAL_TASKS);
    for (let i = 0; i < TOTAL_TASKS; i++) {
        const start = i * chunkSize + 1;
        const end = (i === TOTAL_TASKS - 1) ? N : (i + 1) * chunkSize;
        taskQueue.push({ taskId: i, start: (i === 0 ? 2 : start), end });
    }
    console.log(`[Coordinator] Task queue initialized with ${TOTAL_TASKS} tasks.`);
    saveState();
}

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            isRunning = state.isRunning;
            computationStartTime = state.computationStartTime;
            results = state.results;
            taskQueue = state.taskQueue;
            console.log(`[State] Computation state loaded.`);
            if (isRunning) {
                console.log('[Recovery] Checking for in-flight tasks...');
                let recoveredCount = 0;
                results.forEach((r, taskId) => {
                    if (r === null && !taskQueue.some(t => t.taskId === taskId)) {
                        const chunkSize = Math.floor(N / TOTAL_TASKS);
                        const start = taskId * chunkSize + 1;
                        const end = (taskId === TOTAL_TASKS - 1) ? N : (taskId + 1) * chunkSize;
                        taskQueue.unshift({ taskId, start: (taskId === 0 ? 2 : start), end });
                        recoveredCount++;
                    }
                });
                if (recoveredCount > 0) console.log(`[Recovery] Re-queued ${recoveredCount} tasks.`);
            }
        } else {
            console.log('[State] No state file found. Starting fresh.');
            initializeTasks();
        }
    } catch (err) {
        console.error('Error loading state:', err);
        initializeTasks();
    }
}

// --- Director and Worker Communication ---
const logToDirector = (message) => { if (directorSocket && directorSocket.readyState === WebSocket.OPEN) { directorSocket.send(JSON.stringify({ type: 'log', message: `[${new Date().toLocaleTimeString()}] ${message}` })); } };
const updateDirectorProgress = (taskId, count, totalCompleted) => { if (directorSocket && directorSocket.readyState === WebSocket.OPEN) { directorSocket.send(JSON.stringify({ type: 'progress', taskId, count: count.toString(), totalCompleted })); } };
const updateDirectorWorkerInfo = (workerId, workerInfo) => { if (directorSocket && directorSocket.readyState === WebSocket.OPEN) { const message = JSON.stringify({ type: 'workerUpdate', workerId, workerInfo }, bigIntReplacer); directorSocket.send(message); } };

function assignTaskToAvailableWorker() {
    if (!isRunning || taskQueue.length === 0) return;
    for (const [workerId, workerData] of workers.entries()) {
        if (workerData.ws.readyState === WebSocket.OPEN && !workerData.isBusy) {
            const task = taskQueue.shift();
            if (task) {
                workerData.isBusy = true;
                workerData.assignedTask = task;
                workerData.taskAssignedTime = Date.now();
                workerData.ws.send(JSON.stringify({ type: 'task', task }));
                logToDirector(`Assigned task ${task.taskId} to worker ${workerId}`);
                updateDirectorWorkerInfo(workerId, { ...workerData, status: 'Busy', currentTask: task.taskId });
                logTaskEvent(task.taskId, workerId, 'Assigned');
                saveState();
                return;
            }
        }
    }
}

// --- Heartbeat ---
setInterval(() => {
    workers.forEach((workerData, workerId) => {
        if (!workerData.ws.isAlive) {
            logToDirector(`Worker ${workerId} is unresponsive. Terminating connection.`);
            return workerData.ws.terminate();
        }
        workerData.ws.isAlive = false;
        workerData.ws.ping(NOOP);
    });
}, HEARTBEAT_INTERVAL);

// --- WebSocket Server ---
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', message => {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'registerDirector':
                directorSocket = ws;
                ws.type = 'director';
                logToDirector('👑 Director connected. Syncing state...');
                directorSocket.send(JSON.stringify({
                    type: 'fullState', nValue: N, totalTasks: TOTAL_TASKS, isRunning, results,
                    workers: Array.from(workers.entries()).map(([id, worker]) => {
                        const { ws, ...info } = worker;
                        return [id, info];
                    })
                }, bigIntReplacer));
                break;
            case 'startComputation':
                if (isRunning) return logToDirector('Computation already running.');
                isRunning = true;
                computationStartTime = Date.now();
                initializeTasks(true); // Clear state file
                fs.writeFileSync(TASK_LOG_FILE, 'Timestamp,TaskID,WorkerID,Status,Duration(ms)\n');
                fs.writeFileSync(WORKER_LOG_FILE, 'Timestamp,WorkerID,IPAddress,CPU_Cores,Browser,Status\n');
                workers.forEach(w => {
                    w.stats = { tasksCompleted: 0, primesFound: 0n, lastTaskTime: null };
                    logWorkerEvent(w.ws.workerId, w.ipAddress, w.cpuCores, w.browserInfo, 'Started Computation');
                });
                logToDirector(`Starting new computation...`);
                workers.forEach(() => assignTaskToAvailableWorker());
                break;
            case 'resumeComputation':
                if (isRunning) return logToDirector('Computation is already running.');
                if (!fs.existsSync(STATE_FILE)) {
                    logToDirector('No saved state found to resume. Please start a new computation.');
                    return;
                }
                isRunning = true;
                logToDirector('Resuming computation...');
                workers.forEach(() => assignTaskToAvailableWorker());
                break;
            
            case 'pauseComputation':
                if (!isRunning) return logToDirector('Computation is not running.');
                isRunning = false;
                saveState();
                logToDirector('⏸️ Computation paused.');
                break;
            
            case 'stopComputation':
                isRunning = false;
                initializeTasks(true); // Clear state and re-initialize
                logToDirector('⏹️ Computation stopped and reset.');
                break;

            case 'registerWorker':
                const workerId = data.workerId;
                if (!workerId) return ws.close();
                ws.workerId = workerId;
                ws.type = 'worker';
                const newWorkerData = {
                    ws, isBusy: false, assignedTask: null, taskAssignedTime: null,
                    stats: { tasksCompleted: 0, primesFound: 0n, lastTaskTime: null },
                    browserInfo: data.browserInfo || 'Unknown',
                    cpuCores: data.cpuCores || 'N/A',
                    ipAddress: clientIp,
                    status: 'Idle',
                    currentTask: null
                };
                workers.set(workerId, newWorkerData);
                logToDirector(`Worker ${workerId} connected.`);
                logWorkerEvent(workerId, clientIp, newWorkerData.cpuCores, newWorkerData.browserInfo, 'Connected');
                updateDirectorWorkerInfo(workerId, newWorkerData);
                assignTaskToAvailableWorker();
                break;
            case 'terminateWorker':
                const workerToTerminate = workers.get(data.workerId);
                if (workerToTerminate) {
                    logToDirector(`Director is terminating worker ${data.workerId}`);
                    workerToTerminate.ws.terminate();
                }
                break;
            case 'stillWorking':
                const activeWorker = workers.get(data.workerId);
                if (activeWorker && activeWorker.isBusy) {
                    activeWorker.taskAssignedTime = Date.now();
                    if(data.memory) {
                       activeWorker.stats.memory = data.memory;
                       updateDirectorWorkerInfo(data.workerId, activeWorker);
                    }
                }
                break;
            case 'result':
                const worker = workers.get(data.workerId);
                if (!worker || !worker.assignedTask || worker.assignedTask.taskId !== data.taskId) return;

                const taskDuration = Date.now() - worker.taskAssignedTime;
                logTaskEvent(data.taskId, data.workerId, 'Completed', taskDuration);
                
                const primeCount = BigInt(data.count);
                results[data.taskId] = primeCount.toString();
                worker.stats.tasksCompleted++;
                worker.stats.primesFound += primeCount;
                worker.stats.lastTaskTime = Date.now();
                worker.isBusy = false;
                worker.assignedTask = null;
                worker.taskAssignedTime = null;
                const completedTotal = results.filter(r => r !== null).length;
                
                updateDirectorProgress(data.taskId, primeCount, completedTotal);
                updateDirectorWorkerInfo(data.workerId, { ...worker, status: 'Idle', currentTask: null });
                saveState();

                if (completedTotal === TOTAL_TASKS) {
                    isRunning = false;
                    saveState();
                    const totalPrimes = results.reduce((sum, count) => sum + BigInt(count || 0), 0n);
                    logToDirector(`🎉 ALL TASKS COMPLETE! Final Total: ${totalPrimes.toLocaleString()}`);
                } else {
                    assignTaskToAvailableWorker();
                }
                break;
            case 'error':
                const errorWorker = workers.get(data.workerId);
                if (!errorWorker || !errorWorker.assignedTask) return;
                
                logToDirector(`Worker ${data.workerId}... error on task ${errorWorker.assignedTask.taskId}. Re-queuing.`);
                logTaskEvent(errorWorker.assignedTask.taskId, data.workerId, 'Error');
                taskQueue.unshift(errorWorker.assignedTask);
                errorWorker.isBusy = false;
                errorWorker.assignedTask = null;
                updateDirectorWorkerInfo(data.workerId, { ...errorWorker, status: 'Error', currentTask: null });
                saveState();
                assignTaskToAvailableWorker();
                break;
        }
    });
    
    ws.on('close', () => {
        if (ws.type === 'director') {
            directorSocket = null;
            console.log('Director disconnected.');
        } else if (ws.type === 'worker' && ws.workerId) {
            const workerData = workers.get(ws.workerId);
            if (workerData) {
                logWorkerEvent(ws.workerId, workerData.ipAddress, workerData.cpuCores, workerData.browserInfo, 'Disconnected');
                if (workerData.assignedTask) {
                    logToDirector(`Worker ${ws.workerId} disconnected. Re-queuing task ${workerData.assignedTask.taskId}.`);
                    logTaskEvent(workerData.assignedTask.taskId, ws.workerId, 'Disconnected_Requeued');
                    taskQueue.unshift(workerData.assignedTask);
                    saveState();
                }
                workers.delete(ws.workerId);
                if (directorSocket) directorSocket.send(JSON.stringify({ type: 'workerRemoved', workerId: ws.workerId }));
                assignTaskToAvailableWorker();
            }
        }
    });
});

loadState();