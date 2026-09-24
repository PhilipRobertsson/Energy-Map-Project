// Usage statistics tracking.
//
// Sessions are measured while the user is actively interacting with the tool,
// buffered locally (localStorage), and can later be sent to a server.

const STORAGE_KEY = "usageStatistics";
const MINIMUM_SESSION_DURATION = 5000; // ms — ignore sessions shorter than this (e.g. single clicks)

let sessionActive = false;
let sessionStart = null;
let lastInteraction = null;

let stats = loadStats();

function loadStats(){
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch {
        // localStorage unavailable or corrupt — start fresh
    }
    return { sessionCount: 0, totalDuration: 0, avrageDuration: 0 };
}

function persistStats(){
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch {
        // Ignore write failures (private mode, quota, etc.)
    }
}

// Call on every user input (pointer / key / touch).
export function registerInteraction(){
    const now = Date.now();
    if (!sessionActive) {
        sessionStart = now;
        sessionActive = true;
    }
    lastInteraction = now;
}

// Call when the inactivity timeout fires.
export function endSession(){
    if (!sessionActive) return null;

    const duration = Math.max(0, lastInteraction - sessionStart);
    sessionActive = false;
    sessionStart = null;
    lastInteraction = null;

    if (duration < MINIMUM_SESSION_DURATION) {
        return null; // Too short to count — likely a single interaction.
    }

    stats.sessionCount += 1;
    stats.totalDuration += duration;
    if(stats.sessionCount > 0){
        stats.averageDuration = Math.floor(stats.totalDuration / stats.sessionCount)
    }
    persistStats();
    console.log(loadStats()) // Simply output stats at each end Session
    return { duration, sessionCount: stats.sessionCount };
}

export function getStatistics(){
    return {
        sessionCount: stats.sessionCount,
        totalDuration: stats.totalDuration,
        averageDuration: stats.sessionCount ? stats.totalDuration / stats.sessionCount : 0,
    };
}

// Deferred: upload the buffered statistics to a server.
export function sendStatistics(){
    // TODO: implement server upload
}
