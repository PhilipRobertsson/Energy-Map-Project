import { gsap } from "gsap";

// Opacity config for each map layer: which paint property controls its opacity
// and the full (fully visible) value to fade back to.
const LAYER_OPACITY = {
    "fuelType-fill":     { property: "fill-opacity",   full: 0.5 },
    "fuelType-border":   { property: "line-opacity",   full: 1 },
    "powerplants-layer": { property: "circle-opacity", full: 1 },
    "usage-fill":        { property: "fill-opacity",   full: 0.6 },
    "usage-border":      { property: "line-opacity",   full: 1 },
};

// Layers to fade in/out when entering each mode. The power plants layer is
// deliberately omitted from the "fuelType" fade-out list: in fuel type mode it
// can also be shown as an overlay for a selected country (managed by
// applyFuelTypeSelection), so fading it out here would make it flash.
const MODE_LAYERS = {
    fuelType: {
        fadeIn: ["fuelType-fill", "fuelType-border"],
        fadeOut: ["usage-fill", "usage-border"],
    },
    powerplants: {
        fadeIn: ["powerplants-layer"],
        fadeOut: ["fuelType-fill", "fuelType-border", "usage-fill", "usage-border"],
    },
    usage: {
        fadeIn: ["usage-fill", "usage-border"],
        fadeOut: ["fuelType-fill", "fuelType-border", "powerplants-layer"],
    },
};

// "fuelType" | "powerplants" | "usage" | null (before first switch)
let currentMapMode = null;

export function getMapMode() {
    return currentMapMode;
}

function fadeLayer(map, layerId, fadeIn) {
    const config = LAYER_OPACITY[layerId];
    if (!config || !map.getLayer(layerId)) return;
    const { property, full } = config;

    if (fadeIn) {
        map.setPaintProperty(layerId, property, 0);
        map.setLayoutProperty(layerId, "visibility", "visible");
    }
    const proxy = { opacity: fadeIn ? 0 : full };
    gsap.to(proxy, {
        opacity: fadeIn ? full : 0,
        duration: 0.4,
        ease: "power2.inOut",
        onUpdate: () => map.setPaintProperty(layerId, property, proxy.opacity),
        onComplete: () => {
            if (!fadeIn) {
                map.setLayoutProperty(layerId, "visibility", "none");
                // Restore the full opacity so the layer shows correctly the
                // next time other code makes it visible again.
                map.setPaintProperty(layerId, property, full);
            }
        },
    });
}

// Fade to the given mode: update the global state and fade the relevant layers
// in/out. No-op when already in that mode.
export function fadeToMapMode(map, mode) {
    if (!map || currentMapMode === mode) return;
    const prevMode = currentMapMode;
    currentMapMode = mode;

    const { fadeIn, fadeOut } = MODE_LAYERS[mode];
    fadeOut.forEach((id) => fadeLayer(map, id, false));
    fadeIn.forEach((id) => fadeLayer(map, id, true));

    // When leaving "powerplants" (country view) for "fuelType" (continent view),
    // the power plants layer is no longer the primary view and there is no
    // country selection to keep it as an overlay, so fade it out too.
    if (prevMode === "powerplants" && mode === "fuelType") {
        fadeLayer(map, "powerplants-layer", false);
    }
}
