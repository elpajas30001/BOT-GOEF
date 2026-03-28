const path = require('path');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let activeProcesses = [];

function stopStreams() {
    activeProcesses.forEach(proc => {
        try { if (proc && !proc.killed) proc.kill(); } catch (e) {}
    });
    activeProcesses = [];
}

module.exports = {
    sleep,
    stopStreams,
    get activeProcesses() { return activeProcesses; },
    set activeProcesses(val) { activeProcesses = val; }
};
