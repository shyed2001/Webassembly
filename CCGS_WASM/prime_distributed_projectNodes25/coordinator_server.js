// coordinator_server.js
import { WebSocketServer } from 'ws';

// Explicitly bind to '0.0.0.0' to accept connections from all network interfaces,
// including those coming through the local network or any tunnels.
const wss = new WebSocketServer({ port: 8080, host: '0.0.0.0' });
console.log('Coordinator server running on ws://0.0.0.0:8080');
console.log('Ensure Windows Firewall allows connections on port 8080.'); // Reminder for local IP setup

const N = 512000000; // Total range for prime computation
const TOTAL_TASKS = 512; // <--- Set to 25 to match the director.html provided

let directorSocket = null; // Stores the WebSocket connection for the Director client
// Using a Map to store worker objects, keyed by their unique workerId
const workers = new Map(); 
const taskQueue = []; // Queue of tasks to be assigned to workers
let results = []; // Stores results from completed tasks, indexed by taskId
let isRunning = false; // Flag to indicate if computation is currently active
let computationStartTime = null; // Timestamp when computation starts

/**
 * Sends a log message to the Director client.
 * @param {string} message - The message to log.
 */
function logToDirector(message) {
    if (directorSocket && directorSocket.readyState === directorSocket.OPEN) {
        directorSocket.send(JSON.stringify({ type: 'log', message: `[${new Date().toLocaleTimeString()}] ${message}` }));
    }
}

/**
 * Sends progress updates to the Director client.
 * @param {number} taskId - The ID of the task that completed.
 * @param {BigInt} count - The prime count for the completed task (as BigInt).
 * @param {number} totalCompleted - The total number of tasks completed so far.
 */
function updateDirectorProgress(taskId, count, totalCompleted) {
    if (directorSocket && directorSocket.readyState === directorSocket.OPEN) {
        // Convert BigInt count to string for JSON serialization
        directorSocket.send(JSON.stringify({ type: 'progress', taskId, count: count.toString(), totalCompleted }));
    }
}

/**
 * Sends updates about a specific worker's status and stats to the Director.
 * @param {string} workerId - The ID of the worker.
 * @param {object} workerInfo - Object containing worker details (status, currentTask, stats, etc.).
 */
function updateDirectorWorkerInfo(workerId, workerInfo) {
    if (directorSocket && directorSocket.readyState === WebSocket.OPEN) { // Ensure directorSocket is open
        // Create a deep copy to ensure BigInts are converted to strings for JSON serialization
        const infoToSend = JSON.parse(JSON.stringify(workerInfo, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value // Custom replacer for BigInt
        ));
        directorSocket.send(JSON.stringify({ type: 'workerUpdate', workerId, workerInfo: infoToSend }));
    } else {
        console.warn(`[Coordinator] Cannot send workerUpdate for ${workerId}: Director not connected or socket closed.`);
    }
}

/**
 * Notifies the Director client when all tasks are complete.
 * @param {BigInt} totalPrimes - The final sum of primes from all tasks (as BigInt).
 */
function notifyDirectorComplete(totalPrimes) {
    if (directorSocket && directorSocket.readyState === directorSocket.OPEN) {
        // Convert BigInt totalPrimes to string for JSON serialization
        directorSocket.send(JSON.stringify({ type: 'complete', totalPrimes: totalPrimes.toString() }));
    }
}

/**
 * Initializes the task queue by dividing the total computation range (N)
 * into TOTAL_TASKS chunks.
 */
function initializeTasks() { // No longer accepts dynamicTotalTasks
    taskQueue.length = 0;
    results = new Array(TOTAL_TASKS).fill(null); // Use fixed TOTAL_TASKS
    const chunkSize = Math.floor(N / TOTAL_TASKS); // Use fixed TOTAL_TASKS

    for (let i = 0; i < TOTAL_TASKS; i++) { // Use fixed TOTAL_TASKS
        const start = i * chunkSize + 1;
        const effectiveStart = (i === 0 && start === 1) ? 2 : start; 
        const end = (i === TOTAL_TASKS - 1) ? N : (i + 1) * chunkSize; 
        taskQueue.push({ taskId: i, start: effectiveStart, end });
    }
    logToDirector(`Task queue created with ${taskQueue.length} tasks.`);
    console.log(`[Coordinator] Task queue initialized: ${taskQueue.length} tasks.`);
}

function assignTaskToAvailableWorker() {
    if (taskQueue.length === 0) {
        console.log('[Coordinator] No tasks in queue to assign.');
        return;
    }

    for (const [workerId, workerData] of workers.entries()) {
        if (!workerData.isBusy) {
            const task = taskQueue.shift();
            if (task) {
                workerData.isBusy = true;
                workerData.assignedTask = task;
                workerData.ws.send(JSON.stringify({ type: 'task', task }));
                logToDirector(`Assigned task ${task.taskId} to worker ${workerId.substring(0, 8)}...`);
                console.log(`[Coordinator] Assigned task ${task.taskId} to worker ${workerId}.`);
                
                updateDirectorWorkerInfo(workerId, { 
                    status: 'Busy', 
                    currentTask: task.taskId,
                    stats: workerData.stats,
                    browserInfo: workerData.browserInfo
                });
                return;
            } else {
                console.log('[Coordinator] Task queue became empty during assignment loop.');
                break;
            }
        }
    }
    if (taskQueue.length > 0 && Array.from(workers.values()).every(w => w.isBusy)) {
        console.log(`[Coordinator] All workers are busy. ${taskQueue.length} tasks still in queue.`);
        logToDirector(`All workers busy. ${taskQueue.length} tasks remaining.`);
    }
}

wss.on('connection', ws => {
    ws.type = 'unknown'; 

    ws.on('message', message => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'registerDirector':
                if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
                    console.log('Existing Director detected. Closing old connection.');
                    logToDirector('Another Director connected. This Director instance will take control.');
                    directorSocket.close();
                }
                directorSocket = ws;
                ws.type = 'director';
                console.log('Director has connected.');
                logToDirector('👑 You are the Director. Ready to start.');
                
                workers.forEach((workerData, workerId) => {
                    updateDirectorWorkerInfo(workerId, {
                        status: workerData.isBusy ? 'Busy' : 'Idle',
                        currentTask: workerData.assignedTask ? workerData.assignedTask.taskId : null,
                        stats: workerData.stats,
                        browserInfo: workerData.browserInfo 
                    });
                });
                logToDirector(`Currently ${workers.size} workers connected.`);
                break;

            case 'registerWorker':
                const workerId = data.workerId;
                if (!workerId) {
                    console.error('Worker registration without ID received.');
                    ws.close();
                    return;
                }
                
                if (workers.has(workerId)) {
                    console.log(`Worker ${workerId} re-registered. Updating WebSocket object.`);
                    const existingWorkerData = workers.get(workerId);
                    existingWorkerData.ws = ws; 
                    ws.workerId = workerId; 
                    ws.type = 'worker'; 
                    logToDirector(`Worker ${workerId} reconnected.`);
                    updateDirectorWorkerInfo(workerId, { 
                        status: existingWorkerData.isBusy ? 'Busy' : 'Idle', 
                        currentTask: existingWorkerData.assignedTask ? existingWorkerData.assignedTask.taskId : null, 
                        stats: existingWorkerData.stats,
                        browserInfo: existingWorkerData.browserInfo
                    });
                } else {
                    workers.set(workerId, { 
                        ws: ws, 
                        isBusy: false, 
                        assignedTask: null, 
                        stats: { tasksCompleted: 0, primesFound: 0n, lastTaskTime: null }, 
                        browserInfo: data.browserInfo || 'Unknown Browser/OS' 
                    });
                    ws.workerId = workerId; 
                    ws.type = 'worker'; 

                    console.log(`Worker ${workerId} registered. Total workers: ${workers.size}`);
                    logToDirector(`Worker ${workerId} connected. Total workers: ${workers.size}`);
                    
                    updateDirectorWorkerInfo(workerId, { 
                        status: 'Idle', 
                        currentTask: null, 
                        stats: workers.get(workerId).stats,
                        browserInfo: workers.get(workerId).browserInfo
                    });
                }

                if (isRunning && taskQueue.length > 0) { 
                    console.log(`[Coordinator] Worker ${workerId} registered while running, attempting to assign task.`);
                    assignTaskToAvailableWorker();
                } else if (isRunning && taskQueue.length === 0) {
                    console.log(`[Coordinator] Worker ${workerId} registered, but no tasks left.`);
                }
                break;

            case 'startComputation':
                // No longer expects totalTasks from the Director, uses fixed TOTAL_TASKS
                if (isRunning) {
                    logToDirector('Computation is already running.');
                    console.log('[Coordinator] Start computation requested, but already running.');
                    return;
                }
                computationStartTime = Date.now();
                console.log(`Director started the computation with ${TOTAL_TASKS} tasks.`); // Use fixed TOTAL_TASKS
                logToDirector(`Starting new computation with ${TOTAL_TASKS} tasks at ${new Date(computationStartTime).toLocaleTimeString()}...`); // Use fixed TOTAL_TASKS
                isRunning = true;
                initializeTasks(); // No longer pass dynamicTotalTasks
                console.log(`[Coordinator] Attempting to assign initial tasks to ${workers.size} workers.`);
                Array.from(workers.values()).forEach(workerData => assignTaskToAvailableWorker()); 
                
                if (taskQueue.length > 0) {
                    logToDirector(`Not all tasks assigned initially. ${taskQueue.length} tasks remaining.`);
                } else {
                    logToDirector('All initial tasks assigned.');
                }
                break;
            
            case 'result':
                const resultWorkerId = data.workerId;
                const workerData = workers.get(resultWorkerId);

                if (!workerData) {
                    console.warn(`[Coordinator] Result from unknown worker ID: ${resultWorkerId}`);
                    return;
                }

                workerData.isBusy = false;
                const completedTask = workerData.assignedTask;
                workerData.assignedTask = null;

                const primeCount = BigInt(data.count); 
                results[data.taskId] = primeCount;

                workerData.stats.tasksCompleted++;
                workerData.stats.primesFound += primeCount; 
                workerData.stats.lastTaskTime = Date.now();

                const completedTotal = results.filter(r => r !== null).length;
                console.log(`[Coordinator] Task ${data.taskId} completed by worker ${resultWorkerId}. Total completed: ${completedTotal}`);
                logToDirector(`Worker ${resultWorkerId.substring(0, 8)}... completed task ${data.taskId} (${primeCount.toLocaleString()} primes).`);
                updateDirectorProgress(data.taskId, primeCount, completedTotal);

                updateDirectorWorkerInfo(resultWorkerId, { 
                    status: 'Idle', 
                    currentTask: null, 
                    stats: workerData.stats,
                    browserInfo: workerData.browserInfo
                });

                if (completedTotal === TOTAL_TASKS) { // Use fixed TOTAL_TASKS for completion check
                    const totalPrimes = results.reduce((sum, count) => sum + count, 0n); 
                    notifyDirectorComplete(totalPrimes);
                    isRunning = false;
                    const computationEndTime = Date.now();
                    const duration = (computationEndTime - computationStartTime) / 1000;
                    logToDirector(`Computation finished in ${duration.toFixed(2)} seconds.`);
                    console.log(`[Coordinator] ALL TASKS COMPLETE. Final Total: ${totalPrimes}. Duration: ${duration.toFixed(2)}s`);
                } else {
                    assignTaskToAvailableWorker();
                }
                break;

            case 'error':
                const errorWorkerId = data.workerId;
                const errorWorkerData = workers.get(errorWorkerId);

                if (!errorWorkerData) {
                    console.warn(`[Coordinator] Error from unknown worker ID: ${errorWorkerId}`);
                    return;
                }

                errorWorkerData.isBusy = false; 
                const failedTask = errorWorkerData.assignedTask;
                errorWorkerData.assignedTask = null;

                console.log(`[Coordinator] Worker ${errorWorkerId} reported an error on task ${failedTask ? failedTask.taskId : 'unknown'}. Re-queuing.`);
                logToDirector(`Worker ${errorWorkerId.substring(0, 8)}... crashed on task ${failedTask ? failedTask.taskId : 'unknown'}. Error: ${data.message}. Re-queuing...`);
                
                updateDirectorWorkerInfo(errorWorkerId, { 
                    status: 'Error', 
                    currentTask: null, 
                    stats: errorWorkerData.stats,
                    browserInfo: errorWorkerData.browserInfo
                });

                if (failedTask) {
                    taskQueue.unshift(failedTask);
                    assignTaskToAvailableWorker();
                }
                break;
        }
    });

    ws.on('close', () => {
        const disconnectedWorkerId = ws.workerId;

        if (ws.type === 'director') {
            console.log('Director disconnected.');
            logToDirector('Director disconnected. No further updates will be sent.');
            directorSocket = null;
        } else if (ws.type === 'worker' && disconnectedWorkerId) {
            const disconnectedWorkerData = workers.get(disconnectedWorkerId);
            workers.delete(disconnectedWorkerId);
            console.log(`Worker ${disconnectedWorkerId} disconnected. Total workers: ${workers.size}`);
            logToDirector(`Worker ${disconnectedWorkerId.substring(0, 8)}... disconnected. Total workers: ${workers.size}`);

            if (directorSocket && directorSocket.readyState === WebSocket.OPEN) {
                directorSocket.send(JSON.stringify({ type: 'workerRemoved', workerId: disconnectedWorkerId }));
            }

            if (disconnectedWorkerData && disconnectedWorkerData.assignedTask) {
                console.log(`Worker ${disconnectedWorkerId} was holding task ${disconnectedWorkerData.assignedTask.taskId}. Returning it to the queue.`);
                logToDirector(`Worker ${disconnectedWorkerId.substring(0, 8)}... disconnected with task ${disconnectedWorkerData.assignedTask.taskId}. Re-queuing...`);
                taskQueue.unshift(disconnectedWorkerData.assignedTask);
                assignTaskToAvailableWorker();
            }
        }
    });
});

// 
/** * Starts the WebSocket server and initializes the task queue.
 
---

### 3. `worker.html` (No Changes Needed)

Your `worker.html` file from the previous turn **does not need any changes** for this dynamic task count feature. It simply receives `start` and `end` values for its task, regardless of how many total tasks there are.

---

### Revised Step-by-Step Instructions

1.  **Save Files:**
    * Replace your `coordinator_server.js` content with the **Updated Node.js Coordinator Server (Dynamic Tasks)** code above.
    * Replace your `director.html` content with the **Updated Director Control Panel (Dynamic Tasks)** code above.
    * Your `worker.html` should be the one from the previous turn (no changes needed).
    * Ensure `prime_library.js` and `prime_library.wasm` are in the same directory.

2.  **Find Your Windows Machine's Current Local IP Address:** (If you haven't already, run `ipconfig` and get your IPv4 Address).

3.  **Update `director.html` with Your Local IP Address:** (As before, replace `192.168.1.106` with your actual IP in `director.html`'s `COORDINATOR_WS_URL`).

4.  **Configure Windows Firewall:** (Ensure TCP ports 8080 and 8008 are allowed inbound, for Domain, Private, and Public profiles).

5.  **Perform a Clean Restart:**
    * **Close ALL browser tabs** related to `director.html` and `worker.html`.
    * **Stop your `python -m http.server`** (Ctrl+C).
    * **Stop your `node coordinator_server.js`** (Ctrl+C).
    * **Start `node coordinator_server.js`** again.
    * **Start `python -m http.server 8008 --bind 0.0.0.0`** again.

6.  **Access the Application in Your Browser:**
    * **For the Director:** Open your web browser and go to:
        `http://YOUR_LOCAL_IP_ADDRESS:8008/director.html`
    * **For Workers:** Open **new tabs or separate devices** and go to:
        `http://YOUR_LOCAL_IP_ADDRESS:8008/worker.html`

7.  **Test the Dynamic Task Count:**
    * On the `director.html` page, you will now see an input field for "Total Tasks".
    * Change the value in the input field (e.g., to `20`, `50`, or `100`).
    * Click the "Start Computation" button.
    * Observe the Director Log and the "Tasks Completed: X / Y" display to confirm it updates with your chosen number of tasks.
    * The progress bars will also be created based on this new number.

This update makes your distributed computation system much more flexible!
*/