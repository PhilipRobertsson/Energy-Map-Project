let running = false;
let timeoutId = null;
let frameId = null;

export function startScreenSaver(map, speed, animDuration){
    if (running || !map) return;
    running = true;
    autoScroll(map, speed, animDuration);
}

export function stopScreenSaver(){
    running = false;
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
    if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
    }
}

 // Automatically scrolls the map (screensaver)
function autoScroll(map, speed, animDuration) {
    if (!running) return;

    map.panBy([speed, 0], { animate: false, duration: animDuration });

    timeoutId = setTimeout(() =>{
        frameId = requestAnimationFrame(function() {
            autoScroll(map, speed, animDuration);
        });
    }, animDuration);
}
