import { gsap } from "gsap";
import { createDiagram, otherFuels } from "./sidePanelUtilities.js";

// powerplants, region, fuel, year, generation filters
export function getShownPowerPlants(pps, rFilter, fFilter, yFilter, gFilter){
    const shownRegions = rFilter.filter(r => r.show).map(r => r.country);
    const shownFuels = fFilter.filter(f => f.show).map(f => f.fuel);
    const yearValues = yFilter.length === 2 ? yFilter[0] : null;
    const yearBounds = yFilter.length === 2 ? yFilter[1] : null;
    const genValues = gFilter.length === 2 ? gFilter[0] : null;
    const genBounds = gFilter.length === 2 ? gFilter[1] : null;

    const shownPowerPlants = []

    for (const f of pps.features) {
        const p = f.properties;
        if(otherFuels.includes(p.primary_fuel)){
            p.primary_fuel = "Other"
        }
        if (!shownRegions.includes(p.country)) continue;
        if (!shownFuels.includes(p.primary_fuel)) continue;
        if (yearValues && yearBounds && (yearValues[0] !== yearBounds[0] || yearValues[1] !== yearBounds[1])) {
            const y = Number(p.commissioning_year);
            if (isNaN(y) || y < yearValues[0] || y > yearValues[1]) continue;
        }
         if (genValues && genBounds && (genValues[0] !== genBounds[0] || genValues[1] !== genBounds[1])) {
            const gMin = Number(p.minMax[0])
            const gMax = Number(p.minMax[1])
            if (isNaN(gMin) || isNaN(gMax) || gMin < genValues[0] || gMax > genValues[1]) continue;
        }
        shownPowerPlants.push(f)
    }
    return shownPowerPlants
}

// Get the bounding box for a set of power plant coordinates
export function getBounds(coordinates){ // coordinates -> long [0], lat [1]
    const lngs = coordinates.map(coord => coord[0]);
    const lats = coordinates.map(coord => coord[1]);

    // Find the extremes
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return {
        southWest: [minLng, minLat],
        northEast: [maxLng, maxLat]
    };
}

export function handleZoomIn(icon, mapRef){
    gsap.fromTo(icon, 
        { scale: 1 }, 
        { scale: 1.25, duration: 0.15, yoyo: true, repeat: 1, overwrite: true }
    );
    mapRef.current?.zoomIn({ duration: 800 });
}

export function handleZoomOut(icon, mapRef){
    gsap.fromTo(icon, 
        { scale: 1 }, 
        { scale: 1.25, duration: 0.15, yoyo: true, repeat: 1, overwrite: true }
    );
    mapRef.current?.zoomOut({ duration: 800 });
}

export function handleZoomSelection(element, regionFilter, fuelFilter, yearFilter, generationFilter, powerPlants, mapRef, assetSources, zoomSelectionState){
    const fullScreen = () =>{
        mapRef.current?.flyTo({
            center: [23.333333, 15.5],
            zoom: 1.8,
            speed: 0.8,
            curve: 1.4
        });
    }

    gsap.fromTo(element, 
        { scale: 1 }, 
        { scale: 1.25, duration: 0.15, yoyo: true, repeat: 1, overwrite: true }
    );

    const pps = getShownPowerPlants(powerPlants, regionFilter, fuelFilter, yearFilter, generationFilter)

    if(element.classList.contains("selection") && powerPlants.length != pps.length){
        element.src = assetSources.zoomFullScreen
        zoomSelectionState.current.isSelection = false

        const coordinates = []
        pps.forEach((p) =>{
            coordinates.push(p.geometry.coordinates)
        })
        
        if(coordinates.length && coordinates.length != powerPlants.features.length){
            const bounds = getBounds(coordinates)
            mapRef.current?.fitBounds([bounds.southWest, bounds.northEast],{
                padding: 50,
                maxZoom: 15
            });
        }else{
            fullScreen()
        }
    }else{
        element.src = assetSources.zoomSelection
        zoomSelectionState.current.isSelection = true
        fullScreen()
    }
    element.classList.toggle("selection");
}

export function handleResetClick(button, option, resetAllFilters){
    gsap.fromTo(button, 
        { opacity: 1 }, 
        { 
            opacity: 0.7, 
            duration: 0.15,
            yoyo: true, 
            repeat: 1, 
            overwrite: true 
        }
    );
    switch(option){
        case "reset":
            resetAllFilters()
            break;
        case "close":
            const openPopUps = document.querySelectorAll(".maplibregl-popup")
            openPopUps.forEach(popup => {
                gsap.to(popup.children[1].children, {opacity: 0, duration: 0.2, ease: "power2.in"})
                gsap.to(popup.children[1], { height: 0, width: 0, opacity: 0, duration: 0.3, ease: "power2.in", transformOrigin: "bottom center", onComplete: () => popup.remove() })
            })
            break;
    }
}

export function handleIndexClick(element, index, filterRef){
    gsap.fromTo(element, { backgroundColor: "rgba(0,0,0,0.0)" }, 
        { backgroundColor: "#004B70",  duration: 0.15, yoyo: true,  repeat: 1,  overwrite: true }
    );
    gsap.fromTo(element.firstElementChild, { color: "#004B70" }, 
        { color: "#F2FBFF", duration: 0.15, yoyo: true, repeat: 1, overwrite: true }
    );
        
    const alphabetArray = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    let matchingRegions = filterRef.current.filter(r => r.country_long[0] == index)
    while(!matchingRegions.length){
        let newIndex = alphabetArray.findIndex(c => c == index) + 1
        matchingRegions = filterRef.current.filter(r => r.country_long[0] == alphabetArray[newIndex])
    }
        
    const legendContainer = element.parentElement.parentElement.children[0]
    const regionToScroll = matchingRegions[0]
        
    element.scrollIntoView({behavior: 'smooth', block: 'center', inline: 'center'})

    for(var i = 0; i < legendContainer.children.length; i++){
        if(legendContainer.children[i].children[1].textContent == regionToScroll.country_long){
            legendContainer.children[i].scrollIntoView({behavior: 'smooth', block: 'center', inline: 'center'})
        }
    }
}

// Handle clicks on the seperate legends
export function handleFueLegClick(clickedFuel, setBarChartFilter, setFilter, checkAndSetFilter){
    if(setBarChartFilter){
        if (clickedFuel === "all") {
            setBarChartFilter(null)
        } else {
            setBarChartFilter(prev => {
                if (!prev) return prev
                return prev.filter(f => f !== clickedFuel)
            })
        }
    }
    setFilter(prev => {
        const toggled = checkAndSetFilter(null, prev, clickedFuel, "fuel")
        return toggled;
    });
}

export function handleRegLegClick(clickedCountry, filterRef, setFilter, zoomTo, zoomToRegionFilter){
    const prev = filterRef.current
    const shown = prev.filter(r => r.show)
    const isOnlyShown = shown.length === 1 && shown[0].country === clickedCountry

    let toggled
    if (isOnlyShown) {
        // Clicking the only selected region deselects it (show all regions)
        toggled = prev.map(r => ({ ...r, show: true }))
    } else {
        // Radio-button logic: select only the clicked region
        toggled = prev.map(r => ({ ...r, show: r.country === clickedCountry }))
    }
    setFilter(toggled)
    if(zoomTo){
        zoomToRegionFilter(toggled)
    }
}

export function handleNavigationClick(id, icon, setPage, allPages){
    setPage(allPages[id])
    if(icon.classList.contains("navigationBarIconSmall")){ // Animate number as well
        gsap.fromTo(icon.parentElement.children[1], { fontSize: "1.5vmin" },
        { fontSize: "1.65vmin", duration: 0.15, yoyo: true, repeat: 1, overwrite: true }
    );
    }
    gsap.fromTo(icon, { scale: 1 }, 
        { scale: 1.25, duration: 0.15, yoyo: true, repeat: 1, overwrite: true }
    );
}

export function handleSidePanelToggle(panelContainer, panelOpenRef){
    const sidePanel = panelContainer.current
    const toggleButton = document.querySelector("#sidePanelToggleContainer")
    if (!sidePanel) return;

    if (panelOpenRef.current) {
        gsap.fromTo(sidePanel.children,{opacity: 1}, {opacity:0, duration: 0.1, ease: "power2.out", onComplete: ()=>{
            gsap.fromTo(sidePanel,
                {rotateY:0},
                {rotateY:90, transformOrigin:"right 50%", duration: 0.15, ease: "power2.out",
                    onComplete: () => {
                        panelOpenRef.current = false
                    }
                })
        }})
        gsap.fromTo(toggleButton, {right:"28dvw"}, {right:"0dvw", duration: 0.15, ease: "power2.out"})
    } else {
        gsap.fromTo(sidePanel,
            {rotateY:90},
            {rotateY:0, transformOrigin:"right 50%", duration: 0.15, ease: "power2.in", 
                onComplete: () => {
                    gsap.fromTo(sidePanel.children,{opacity: 0}, {opacity:1, duration: 0.1, ease: "power2.in"})
                    sidePanel.style.display = "flex"
                    sidePanel.style.translate = "unset"
                    sidePanel.style.rotate = "unset"
                    sidePanel.style.scale = "unset"
                    sidePanel.style.transform = "unset"
                    panelOpenRef.current = true
                }
            })
        gsap.fromTo(toggleButton, {right:"0dvw"}, {right:"28dvw", duration: 0.15, ease: "power2.in"})
    }
}

export function handleRollupClick(element, toggleFunction){
    toggleFunction(element)
}

export function handleLinePlotToggle(element){
    const container = element.parentElement.parentElement.parentElement.parentElement.parentElement
    if(element.style.backgroundColor == "rgb(170, 211, 222)") return;
    const otherButton = (element == element.parentElement.children[0])? element.parentElement.children[1] : element.parentElement.children[0]
    gsap.fromTo(element, { backgroundColor: "rgba(0,0,0,0.0)" }, 
        { backgroundColor: "#AAD3DE",  duration: 0.15, onComplete: () =>{
            element.style.backgroundColor = "#AAD3DE"
        } } 
    );
    gsap.fromTo(otherButton, { backgroundColor: "#AAD3DE" }, 
        { backgroundColor: "rgba(0,0,0,0.0)",  duration: 0.15, onComplete: () =>{
            otherButton.style.backgroundColor = "rgba(0,0,0,0.0)"
        } } 
    );

    let linePlot, barChart, boldText, standardText

    if(container.id == "sidePanelLinePlot"){
        linePlot = document.getElementById("linePlotSVG")
        barChart = document.getElementById("barChartSVG")

        boldText = document.getElementById("linePlotExBoldText")
        standardText = document.getElementById("linePlotExStandardText")
    }

    if(container.id == "sidePanelComparisonLinePlot"){
        linePlot = document.getElementById("compLinePlotSVG")
        barChart = document.getElementById("compBarChartSVG")

        boldText = document.getElementById("compLinePlotExBoldText")
        standardText = document.getElementById("compLinePlotExStandardText")
    }

    const capacityValues = container.querySelectorAll(".ffCapacity")
    const generationValues = container.querySelectorAll(".ffGeneration")

    // Get selected continent name
    const continent = container.querySelector(".continentSelected").querySelector("span").textContent

    if(linePlot.classList.contains("hide")){
        gsap.fromTo(linePlot, { opacity: 0 }, 
            { opacity: 1,  duration: 0.15, onComplete: () =>{
                linePlot.classList.toggle("hide")
                if(continent == "Global"){
                    boldText.textContent = "Global electric generation per year "
                }else{
                    boldText.textContent = continent + "'s electric generation per year "
                }
                standardText.textContent = "(GWh)"
            } } 
        );
        gsap.fromTo(barChart, { opacity: 1 }, 
            { opacity: 0,  duration: 0.15, onComplete: () =>{
                barChart.classList.toggle("hide")
            } } 
        );
        for(let i = 0; i < generationValues.length; i++){ // Capacity values and generation values have the same lenghts
            gsap.fromTo(generationValues[i], { opacity: 0 }, { opacity: 1,  duration: 0.15, 
                onComplete: () =>{ generationValues[i].classList.toggle("hide")} });
            gsap.fromTo(capacityValues[i], { opacity: 1 }, { opacity: 0,  duration: 0.15,
                onComplete: () =>{capacityValues[i].classList.toggle("hide")} });
        }
    }else{
        gsap.fromTo(linePlot, { opacity: 1 }, 
            { opacity: 0,  duration: 0.15, onComplete: () =>{
                linePlot.classList.toggle("hide")
            } } 
        );
        gsap.fromTo(barChart, { opacity: 0 }, 
            { opacity: 1,  duration: 0.15, onComplete: () =>{
                barChart.classList.toggle("hide")
                if(continent == "Global"){
                    boldText.textContent = "Global power plant capacity by source "
                }else{
                    boldText.textContent = continent+ "'s power plant capacity by source "
                }
                standardText.textContent = "(MW)"
            }} 
        );
        for(let i = 0; i < capacityValues.length; i++){ // Capacity values and generation values have the same lenghts
            gsap.fromTo(capacityValues[i], { opacity: 0 }, { opacity: 1,  duration: 0.15, 
                onComplete: () =>{ capacityValues[i].classList.toggle("hide")} });
            gsap.fromTo(generationValues[i], { opacity: 1 }, { opacity: 0,  duration: 0.15,
                onComplete: () =>{generationValues[i].classList.toggle("hide")} });
        }
    }
    gsap.fromTo([boldText,standardText], 
        { opacity: 1 }, 
        { opacity: 0, duration: 0.15, yoyo: true, repeat: 1, overwrite: true }
    );
}

export function handleContinentClick(element, continent, filterRef, setFilter, dontZoomTo, zoomToRegionFilter){
    // Get previous selection, return if identical click
    const prev = element.parentElement.querySelector(".continentSelected")
    if(element == prev) return;
        
    // Remove selected class from previous button, add class to clicked element
    gsap.fromTo(element, { backgroundColor: "rgba(0,0,0,0.0)", border: "0.1vmin solid #AAD3DE", color:"#000000" }, 
        { backgroundColor: "#65A1E0", border: "0.1vmin solid #65A1E0", color:"#FCFCFC",  duration: 0.15, onComplete: () =>{
            element.classList.toggle("continentSelected")
        } } 
    );
    gsap.fromTo(prev, { backgroundColor: "#65A1E0", border: "0.1vmin solid #65A1E0", color:"#FCFCFC" }, 
        { backgroundColor: "rgba(0,0,0,0.0)", border: "0.1vmin solid #AAD3DE", color:"#000000",  duration: 0.15, onComplete: () =>{
            prev.classList.toggle("continentSelected")
        } } 
    );

    // Set region filter
    const prevFilter = filterRef.current

    let linePlotTitle, linePlotBold, linePlotSVG

    // Get lineplot titles
    if(element.parentElement.parentElement.id == "sidePanelLinePlot"){
        linePlotTitle = element.parentElement.parentElement.querySelector("#linePlotTitle")
        linePlotBold = element.parentElement.parentElement.querySelector("#linePlotExBoldText")
        linePlotSVG = element.parentElement.parentElement.querySelector("#linePlotSVG")
    }

    if(element.parentElement.parentElement.id == "sidePanelComparisonLinePlot"){
        linePlotTitle = element.parentElement.parentElement.querySelector("#compLinePlotTitle")
        linePlotBold = element.parentElement.parentElement.querySelector("#compLinePlotExBoldText")
        linePlotSVG = element.parentElement.parentElement.querySelector("#compLinePlotSVG")
    }

    let toggled
    if(continent == "Global"){
        toggled = prevFilter.map(r => ({ ...r, show: true }))
        linePlotTitle.textContent = "Global Electricity Source Trends"
        if(linePlotSVG.classList.contains("hide")){
            linePlotBold.textContent = "Global power plant capacity by source "
        }else{
            linePlotBold.textContent = "Global electric generation per year "
        }
    }else{
        toggled = prevFilter.map(r => ({ ...r, show: r.continent === continent }))
        linePlotTitle.textContent = continent + "'s Electricity Source Trends"
        if(linePlotSVG.classList.contains("hide")){
            linePlotBold.textContent = continent + "'s power plant capacity by source "
        }else{
            linePlotBold.textContent = continent + "'s electric generation per year "
        }
    }

    setFilter(toggled)
    if(!dontZoomTo){
        zoomToRegionFilter(toggled)
    }
}

export function handleMapModeToggle(element, mapRef){
    // Get previous selection, return if identical click
    const prev = document.querySelector(".selectedMapMode")
    if(element == prev) return;

    // Remove selected class from previous button, add class to clicked element
    gsap.fromTo(element, { backgroundColor: "rgba(0,0,0,0.0)", color:"#f7f7f7" }, 
        { backgroundColor: "#AAD3DE", color:"#243B6D",  duration: 0.15, onComplete: () =>{
            element.classList.toggle("selectedMapMode")
        } } 
    );
    gsap.fromTo(prev, { backgroundColor: "#AAD3DE", color:"#243B6D" }, 
        { backgroundColor: "rgba(0,0,0,0.0)", color:"#f7f7f7",  duration: 0.15, onComplete: () =>{
            prev.classList.toggle("selectedMapMode")
        } } 
    );

    // Get map context
    const currentMap = mapRef.current

    const prevMode = prev.querySelector("span").textContent
    const selectedMode = element.querySelector("span").textContent

    // Get different containers in the fuel filter
    const fuelFilterContents = document.querySelectorAll(".fuelFilterContent")

    // Set visibility for a set of layer ids
    const setVisibility = (layerIds, visibility) => {
        layerIds.forEach(id => {
            if (currentMap.getLayer(id)) currentMap.setLayoutProperty(id, "visibility", visibility)
        })
    }

    // Hide previous mode's layers
    switch(prevMode){
        case "Power Plants":
            setVisibility(["powerplants-layer"], "none")
            fuelFilterContents[0].classList.toggle("hide")
            break;
        case "Low Carbon Usage":
            setVisibility(["lowCarbon-fill", "lowCarbon-border"], "none")
            fuelFilterContents[1].classList.toggle("hide")
            break;
        case "Fossil Fuel Usage":
            setVisibility(["fossilFuel-fill", "fossilFuel-border"], "none")
            fuelFilterContents[2].classList.toggle("hide")
            break;
    }

    // Show selected mode's layers
    switch(selectedMode){
        case "Power Plants":
            setVisibility(["powerplants-layer"], "visible")
            fuelFilterContents[0].classList.toggle("hide")
            break;
        case "Low Carbon Usage":
            setVisibility(["lowCarbon-fill", "lowCarbon-border"], "visible")
            fuelFilterContents[1].classList.toggle("hide")
            break;
        case "Fossil Fuel Usage":
            setVisibility(["fossilFuel-fill", "fossilFuel-border"], "visible")
            fuelFilterContents[2].classList.toggle("hide")
            break;
    }
}

export function handleAddDiagramClick(assetSources, comparisonFuelFilter, regionalData, comparisonRegionFilter,
    compRegionFilterRef, setComparisonRegionFilter, setComparisonFuelFilter,
    fillDropDowns, toggleDropDown, zoomToRegionFilter, checkAndSetFilter, years
){
    // Get the diagram wrapper and check if the comparison window already has been created
    const diagramWrapper = document.querySelector("#allDiagramContainer");

    const promptText = diagramWrapper.querySelector("#additionalDiagramPromptContainer").querySelector("span");
    const promptIcon = diagramWrapper.querySelector("#additionalDiagramPromptContainer").querySelector("img");

    const prev = document.querySelector("#sidePanelComparisonLinePlot");
    if(prev != null){
        // Remove present comparison diagram
        gsap.fromTo(prev,
            { height: prev.offsetHeight, opacity: 1, },
            { height: 0, opacity: 0, duration: 0.15, ease: "power2.out",
                onComplete: () =>{
                    prev.remove()
                }
            }
        )

        gsap.fromTo(diagramWrapper.querySelector("#additionalDiagramPromptContainer"),
            {opacity: 1},
            {opacity: 0, duration: 0.085, ease: "power2.out",
                onComplete: () =>{
                    promptText.textContent = "+ add one diagram for comparison";
                    promptIcon.src = assetSources.sidePanelRollupOpen;
                    gsap.fromTo(diagramWrapper.querySelector("#additionalDiagramPromptContainer"),
                        {opacity: 0},
                        {opacity: 1, duration: 0.085, ease: "power2.in"}
                    )
                }
            }
        )
        return;
    };

    // Create new diagram
    const newDiagram = createDiagram({
        assetSources,
        fuels: comparisonFuelFilter,
        regionalData,
        regionFilter: comparisonRegionFilter,
        regionFilterRef: compRegionFilterRef,
        setRegionFilter: setComparisonRegionFilter,
        setFuelFilter: setComparisonFuelFilter,
        setBarChartFilter: null,
        onIndexClick: (element, index) => handleIndexClick(element, index, compRegionFilterRef),
        onContinentClick: (element, continent, filterRef, setFilter, dontZoomTo) => handleContinentClick(element, continent, filterRef, setFilter, dontZoomTo, zoomToRegionFilter),
        onToggleClick: handleLinePlotToggle,
        onLegendClick: (clickedFuel, setBarChartFilter, setFilter) => handleFueLegClick(clickedFuel, setBarChartFilter, setFilter, checkAndSetFilter),
        comparison: true,
        years,
    })

    // Add click functionality to dropDowns
    const compRegionFilter = newDiagram.querySelector("#compRegionFilter");

    const header = compRegionFilter.querySelector(".sidePanelDropDownHeader")

    header.onclick = () => handleRollupClick(compRegionFilter.querySelector(".sidePanelFilterDropDown"), toggleDropDown)

    fillDropDowns(compRegionFilter.querySelector(".sidePanelDropDownField"), comparisonRegionFilter, setComparisonRegionFilter, compRegionFilterRef, false)

    newDiagram.style.opacity = 0

    gsap.fromTo(diagramWrapper.querySelector("#additionalDiagramPromptContainer"),
        {opacity: 1},
        {opacity: 0, duration: 0.085, ease: "power2.out", onComplete: () =>{
                promptText.textContent = "Close comparison diagram";
                promptIcon.src = assetSources.closeIcon;
                gsap.fromTo(diagramWrapper.querySelector("#additionalDiagramPromptContainer"),
                    {opacity: 0},
                    {opacity: 1, duration: 0.085, ease: "power2.in"}
                )
            }
        }
    )

    diagramWrapper.appendChild(newDiagram)

    // Open animation and height assignment
    gsap.fromTo(diagramWrapper.lastChild,
        { height: 0, opacity: 0 },
        { height: "auto", opacity: 1, duration: 0.15, ease: "power2.in"}
    )
}

export function handlePlayBackClick(element,filter, setFilter,playTime){
    if(element.classList.contains("runningPlayBack")) return;
    element.classList.add("runningPlayBack")

    gsap.fromTo(element, 
        { opacity: 1 }, 
        { 
            opacity: 0.5, 
            duration: 0.15,
            yoyo: true, 
            repeat: 1, 
            overwrite: true 
        }
    );

    const text = element.querySelector("span")

    // Reset to content-driven width so measurements are correct on repeated clicks
    // (a previous run leaves an explicit inline width behind).
    element.style.width = "auto"
    const originalWidth = element.getBoundingClientRect().width

    // Shrink to the width of the "Playing..." label
    text.textContent = "Playing..."
    const newWidth = element.getBoundingClientRect().width

    gsap.fromTo(element, 
        { width: originalWidth }, 
        { width: newWidth, duration: 0.10 }
    );

    // Animate the year filter from the earliest to the latest bound year,
    // stepping one year at a time over the playback duration.
    const bounds = filter.length === 2 ? filter[1] : null
    if (bounds && bounds[1] > bounds[0]) {
        const [minYear, maxYear] = bounds
        const totalSteps = maxYear - minYear
        const stepDuration = playTime / totalSteps

        // Start at the earliest year, then increment the max value each step
        setFilter([[minYear, minYear], bounds])
        for(let step = 1; step <= totalSteps; step++){
            setTimeout(() => {
                setFilter([[minYear, minYear + step], bounds])
            }, step * stepDuration)
        }
    }

    // When the playback time has elapsed, restore the original label and width
    setTimeout(() =>{
        gsap.fromTo(element, 
            { width: newWidth }, 
            { width: originalWidth, duration: 0.10, onComplete: () =>{
                element.classList.remove("runningPlayBack")
                text.textContent = "Animated historical playback"
                gsap.set(element, { clearProps: "width" })
            }}
        );
    }, playTime);
}
