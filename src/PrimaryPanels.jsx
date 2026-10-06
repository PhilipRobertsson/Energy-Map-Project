import { useState, useEffect, useRef, useContext, createElement } from 'react'
import maplibregl from "maplibre-gl";
import { gsap } from "gsap";

import { MapContext, usageColourForYear } from './Map.jsx'
import { createDiagram, getShownRegionFuelData, formatPowerOf10, getLatestGenerationValue,
              otherFuels, drawLinePlot, drawBarChart, drawUsageLinePlot, getDropDown, createUsageGradient, 
              getShownRegionUsage} from './sidePanelUtilities.js'
import { handleZoomIn, handleZoomOut, handleZoomSelection, handleResetClick,
              handleIndexClick, handleFueLegClick, handleRegLegClick, handleNavigationClick,
              handleSidePanelToggle, handleRollupClick, handleLinePlotToggle, handleContinentClick,
              handleMapModeToggle, handleAddDiagramClick, getShownPowerPlants, getBounds,
              handlePlayBackClick } from './eventHandlers.js'
import { registerInteraction, endSession } from './usageStatistics.js'
import {createPopUpBarChart, createPopUpUsagePlot, makePopUpMovable, toggleSelectionDropDown} from './popUpUtilites.js'

import './PrimaryPanels.css'

// Definition for the filter panel
const fuelFilterDef = {
    id: "fuelFilter",
    position: ["absolute", null, null, 0, 0], // Bottom left corner, css -> [position, top, right, bottom, left]
};

// Definition for the side panel
const sidePanelDef ={
    id: "sidePanel",
    width: 30 + "dvw", // 30% of screen width
    height: 100 + "dvh", // 100% of screen height
    position: ["absolute", 0, 0, null, null], // Right hand side, css -> [position, top, right, bottom, left]
};

// Sources for the different svg files stored in the public folder
const assetSources ={
    zoomIn: "./fuelFilter/filterPanelZoomIn.svg",
    zoomOut: "./fuelFilter/filterPanelZoomOut.svg",
    zoomSelection: "./fuelFilter/filterPanelZoomSelection.svg",
    zoomFullScreen: "./fuelFilter/filterPanelFullScreen.svg",
    fuelIconCoal: "./fuelFilter/fuelIconCoal.svg",
    fuelIconGas: "./fuelFilter/fuelIconGas.svg",
    fuelIconHydro: "./fuelFilter/fuelIconHydro.svg",
    fuelIconNuclear: "./fuelFilter/fuelIconNuclear.svg",
    fuelIconOil: "./fuelFilter/fuelIconOil.svg",
    fuelIconSolar: "./fuelFilter/fuelIconSolar.svg",
    fuelIconWind: "./fuelFilter/fuelIconWind.svg",
    sidePanelHome: "./sidePanel/sidePanelHomeIcon.svg",
    sidePanelInstructions: "./sidePanel/sidePanelInstructionsIcon.svg",
    sidePanelInfo: "./sidePanel/sidePanelInfoIcon.svg",
    sidePanelRollupOpen: "./sidePanel/sidePanelRollupOpen.svg",
    sidePanelRollupClose: "./sidePanel/sidePanelRollupClose.svg",
    sidePanelCheckMark: "./sidePanel/sidePanelCheckMark.svg",
    sidePanelSelectAllCircle: "./sidePanel/sidePanelSelectAllCircle.svg",
    infoIcon: "./popup/popupInfo.svg",
    jinyiPaperQR: "./qrCodes/jinyiPaper.png",
    energyDataQR: "./qrCodes/energyData.png",
    closeIcon: "./popup/popupClose.svg"
};

// The different pages on the instruction page
const allPages = [
    {id: 0, visibleHtmlElements: [true, true, true, false, true, true, true, true, false, false,false,false, false, false]}, /*Home page*/
    {id: 1, visibleHtmlElements: [true, false, false, true, false, false, false, false, true, false,false,false, false, false]}, /*Info page*/
    {id: 2, visibleHtmlElements: [true, false, false, false, true, true, true, true, false, true,false,false, false, false]}, /*Instructions page 1*/
    {id: 3, visibleHtmlElements: [true, false, false, false, true, true, true, true, false, false,true,false, false, false]}, /*Instructions page 2*/
    {id: 4, visibleHtmlElements: [true, false, false, false, true, true, true, true, false, false,false,true, false, false]}, /*Instructions page 3*/
    {id: 5, visibleHtmlElements: [true, false, false, false, true, true, true, true, false, false,false,false, true, false]}, /*Instructions page 4*/
    {id: 6, visibleHtmlElements: [true, false, false, false, true, true, true, true, false, false,false,false, false, true]}, /*Instructions page 5*/
];

// static JSON to fetch and states to set
const fetchJSON = ["fuelCatagories", "regionalInformation", "regionalFilter", "instructions", "continentalInformation"]
const statesToSet = ["FuelFilter", "RegionalData", "RegionFilter", "PageContent", "ContinentalData"]

function PrimaryPanels() {
    const { mapRef, powerPlants, boundaryData, barChartFilter, setBarChartFilter, popupCount, timeRef, resetTimer, reportedYears, estimatedYears,shareYears, mapReady, clearFuelTypeSelection, handleContinentFromMapRef, applyFuelTypeSelection, setBaseFilters } = useContext(MapContext);
    const filterContainer = useRef(null);
    const sidePanelContainer = useRef(null)

    // Filter states
    const [fuelFilter, setFuelFilter] = useState([]);
    const [regionFilter, setRegionFilter] = useState([]);
    const [yearFilter, setYearFilter] = useState([]);
    const [generationFilter, setGenerationFilter] = useState([]);
    const [LCShareFilter, setLCShareFilter] = useState([]); // similar to generation filter
    const [FFShareFilter, setFFShareFilter] = useState([]); // similar to generation filter
    const [shareYearFilter, setShareYearFilter] = useState([]); // similar to year filter

    // Used by the possible "additional diagram" feature
    const [comparisonFuelFilter, setComparisonFuelFilter] = useState([]);
    const [comparisonRegionFilter, setComparisonRegionFilter] = useState([]);

    // World data
    const [regionalData, setRegionalData] = useState([]);
    const [continentalData, setContinentalData] = useState([]);

    // Panel related states (both fuel filter and side panel)
    const [sidePanelPage, setSidePanelPage] = useState(allPages[0]);
    const [pages, setPages] = useState(null);
    const [pageContent, setPageContent] = useState(null);
    const zoomSelectionState = useRef({ isSelection: true });
    const prevBarChartFilter = useRef([]);

    // General references
    const prevPageRef = useRef(null);
    const regionalDataRef = useRef([]);
    const sidePanelOpenRef = useRef(true);
    const yearsRef = useRef({ reported: { first: 0, last: 0 }, estimated: { first: 0, last: 0 } });
    const shareYearsRef = useRef({first: 0, last: 0}); // similar to yearsRef
    const continentalDataRef = useRef([]); // continent-level usage data

    // Filter references
    const regionFilterRef = useRef([]);
    const fuelFilterRef = useRef([]);
    const compRegionFilterRef = useRef([]);
    const compFuelFilterRef = useRef([]);
    const defaultRegionSet = useRef(false);

    const [screenSize, setScreenSize] = useState({
        width: window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth,
        height: window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight,
    });

    // Keep refs in sync with filter states
    useEffect(() => {
        regionFilterRef.current = regionFilter
        fuelFilterRef.current = fuelFilter
        compRegionFilterRef.current = comparisonRegionFilter
        compFuelFilterRef.current = comparisonFuelFilter
        regionalDataRef.current = regionalData
        yearsRef.current = { reported: reportedYears, estimated: estimatedYears }
        shareYearsRef.current = shareYears
        continentalDataRef.current = continentalData
    }, [regionFilter, fuelFilter, regionalData, comparisonRegionFilter, comparisonFuelFilter, reportedYears, estimatedYears, shareYears, continentalData]);

    // Clear the fuel type country selection whenever the region filter changes
    useEffect(() => {
        clearFuelTypeSelection()
    }, [regionFilter, clearFuelTypeSelection])

    // Expose a continent-click handler for Map.jsx (used when clicking a country
    // on the map while no continent is currently selected)
    useEffect(() => {
        handleContinentFromMapRef.current = (continentName) => {
            const element = Array.from(document.querySelectorAll(".linePlotContinentButton"))
                .find(btn => btn.querySelector("span")?.textContent === continentName)
            if (!element) return
            handleContinentClick(element, regionalData, continentName, continentalData, regionFilterRef, setRegionFilter, shareYears, false, zoomToRegionFilter)
        }
    })

    // Fetch JSON files and set relevant States
    useEffect(() => {
        for(var i = 0; i < fetchJSON.length; i++){
            let state = statesToSet[i]
            fetch("./" + fetchJSON[i] + ".json")
                .then((response) => response.json())
                .then((data) =>{
                    eval("set"+state+"(data)");
                    if(state == "FuelFilter"){setComparisonFuelFilter(data)}
                    if(state == "RegionFilter"){setComparisonRegionFilter(data)}
                })
        }
    }, []);

    // Initial draw of panels
    useEffect(() => {
        if (filterContainer.current) return;
        if (sidePanelContainer.current) return;

        filterContainer.current = document.createElement("div");
        sidePanelContainer.current = document.createElement("div");
    }, []);

    // Check if anything updates, resets timer
    useEffect(() =>{
        resetTimer()
    }, [sidePanelPage,pages, fuelFilter, regionFilter, regionalData, powerPlants, pageContent,
        comparisonRegionFilter, comparisonFuelFilter,
        shareYearFilter, LCShareFilter, FFShareFilter, yearFilter, generationFilter])

    // Register user interactions for usage-statistics tracking (any pointer / key / touch)
    useEffect(() =>{
        const onInput = () => registerInteraction();
        window.addEventListener("pointerdown", onInput);
        window.addEventListener("keydown", onInput);
        window.addEventListener("touchstart", onInput);
        return () =>{
            window.removeEventListener("pointerdown", onInput);
            window.removeEventListener("keydown", onInput);
            window.removeEventListener("touchstart", onInput);
        }
    }, [])

    // Check the timer, if it reaches zero, reset everything
    useEffect(() =>{
        if(timeRef <= 0){
            endSession()
            resetAllFilters()
            handleResetClick(null, "close", null) // Close pop-ups

            // Remove the comparison diagram if it is open, and reset its prompt button
            const comparisonDiagram = document.querySelector("#sidePanelComparisonLinePlot")
            if (comparisonDiagram) comparisonDiagram.remove()
            const promptText = document.querySelector("#diagramPromptText")
            const promptIcon = document.querySelector("#additionalDiagramPromptContainer img")
            if (promptText) promptText.textContent = "+ add one diagram for comparison"
            if (promptIcon) promptIcon.src = assetSources.sidePanelRollupOpen

            // Reset the map mode to "Power Plants" (sets the selected class / colours and map layers)
            const powerPlantsButton = Array.from(document.querySelectorAll(".mapToggleButton"))
                .find(button => button.querySelector("span")?.textContent === "Power Plants")
            if (powerPlantsButton) handleMapModeToggle(powerPlantsButton, mapRef, regionFilter)

            mapRef.current?.flyTo({
                center: [89, 30],
                zoom: 1.8,
                speed: 0.8,
                curve: 1.4
            });
            handleNavigationClick(0, document.getElementById("navigationID0"), setSidePanelPage, allPages)
        }
    }, [timeRef])

    // Check if screen size changes, redraw plots
    useEffect(() => {
        const redrawPlots = (width, height) => {
            const linePlotSVG = document.getElementById("linePlotSVG")
            const barChartSVG = document.getElementById("barChartSVG")
            const usageLinePlotSVG = document.getElementById("usagePlotSVG")
            if (!linePlotSVG && !barChartSVG && !usageLinePlotSVG) return

            const sidePanelWidth = Math.floor(width * 0.30)
            const sidePanelLeftMargin = Math.floor((window.innerHeight <= 1024)? width* 0.02 : width * 0.01)
            const sidePanelPadding = Math.floor(2 * width * 0.01)
            const plotWidth = Math.floor((sidePanelWidth - sidePanelLeftMargin - sidePanelPadding) * 0.55)
            const altPlotWidth = Math.floor((sidePanelWidth - sidePanelLeftMargin - sidePanelPadding) * 0.85)
            const plotHeight = Math.floor((height * 0.35) * 0.72)

            const dataVisualization = (linePlotSVG || barChartSVG).parentElement
            const altVis = usageLinePlotSVG?.parentElement
            const linePlotHidden = linePlotSVG ? linePlotSVG.classList.contains("hide") : true
            const barChartHidden = barChartSVG ? barChartSVG.classList.contains("hide") : true

            linePlotSVG?.remove()
            barChartSVG?.remove()
            usageLinePlotSVG?.remove()

            const fuels = getShownRegionFuelData(regionalDataRef.current, regionFilterRef.current, fuelFilterRef.current, true, yearsRef.current)
            const regions = getShownRegionUsage(regionalDataRef.current, regionFilterRef.current, shareYearsRef.current )
            drawLinePlot(dataVisualization, plotWidth, plotHeight, fuels, !linePlotHidden, "linePlotSVG", yearsRef.current)
            drawBarChart(dataVisualization, plotWidth, plotHeight, fuels, !barChartHidden)
            drawUsageLinePlot(altVis, altPlotWidth, plotHeight, regions, "usagePlotSVG", yearsRef.current)
        }

        const handleResize = () => {
            const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth
            const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight
            setScreenSize({ width, height })
            redrawPlots(width, height)
        }
        handleResize()
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    // Add information and buttons to filter panel (only on load)
    useEffect(() =>{
        const filter = filterContainer.current;
        if (!filter || !regionFilter.length ||!fuelFilter.length || !yearFilter.length || !generationFilter.length || !powerPlants) return;

        /*--[Control buttons at the bottom of the filter panel]--*/
        var controlContainer = document.createElement("div")
        controlContainer.id = "controlContainer"
        // Zoom in button
        var zoomIn = document.createElement("img")
        zoomIn.className = "controlIcon"
        zoomIn.src = assetSources.zoomIn
        zoomIn.onclick =() => handleZoomIn(zoomIn, mapRef)
        // Zoom out button
        var zoomOut = document.createElement("img")
        zoomOut.className = "controlIcon"
        zoomOut.src = assetSources.zoomOut
        zoomOut.onclick = () => handleZoomOut(zoomOut, mapRef)
        // Zoom selection
        var zoomSelection = document.createElement("img")
        zoomSelection.classList.add("controlIcon", "selection")
        zoomSelection.src = assetSources.zoomSelection
        zoomSelection.onclick = () =>  handleZoomSelection(zoomSelection, regionFilter, fuelFilter, yearFilter, generationFilter, powerPlants, mapRef, assetSources, zoomSelectionState)

        if (zoomSelectionState.current.isSelection ||
             powerPlants.features.length != 
             getShownPowerPlants(powerPlants, regionFilter, fuelFilter, yearFilter, generationFilter).length) {
          zoomSelection.classList.add("selection")
        } else {
          zoomSelection.src = assetSources.zoomFullScreen
        }

        controlContainer.appendChild(zoomIn) // Append zoom in button
        controlContainer.appendChild(zoomOut) // Append zoom out button
        controlContainer.appendChild(zoomSelection) // Append slection zoom button

        // Map mode toggle buttons
        const mapToggleButtonContainer = document.createElement("div");
        mapToggleButtonContainer.id = "mapToggleContainer"

        // Find the currently selected map mode, defaulting to "Power Plants"
        const currentSelection = filter.querySelector(".selectedMapMode");
        const selectedModeName = currentSelection ? currentSelection.querySelector("span").textContent : "Power Plants";

        for(let i = 0; i<2;i++){
            let toggleButton = document.createElement("div");
            toggleButton.classList.add("mapToggleButton");

            let toggleText = document.createElement("span");
            switch(i){
                case 0:
                    toggleText.textContent = "Power Plants"
                    break;
                case 1:
                    toggleText.textContent = "Energy Usage"
                    break;
            }
            toggleButton.appendChild(toggleText);
            toggleButton.onclick = () => handleMapModeToggle(toggleButton, mapRef, regionFilter)

            if(toggleText.textContent === selectedModeName){
                toggleButton.classList.add("selectedMapMode");
            }
            
            mapToggleButtonContainer.appendChild(toggleButton)
        }

        if(filter.children.length > 0){
            filter.replaceChild(mapToggleButtonContainer, filter.children[filter.children.length-2])
            filter.replaceChild(controlContainer, filter.children[filter.children.length - 1])
        }

        if (filter.children.length > 0) return;

        const legendContainer = document.createElement("div")
        legendContainer.classList.add("fuelFilterContent")

        let usageContainer = document.createElement("div")
        usageContainer = createUsageGradient(usageContainer, ["#c93b2b", "#e68a47", "#f3db5e", "#5fa675", "#1b5e39"])
        usageContainer.classList.add("fuelFilterContent", "gradientContainer", "hide")

        // Create colour legends for each fuel available
        for(let i = 0; i < fuelFilter.length; i++){
            const fuel = fuelFilter[i] // Used for easier access

            // Create legend element
            const legend = document.createElement("div")
            legend.classList.add("filterLegend")

            // Create colour box for legend element
            const colour = document.createElement("div")
            colour.classList.add("legendColour")
            colour.style.backgroundColor = fuel.colour

            // Add icon to colour box
            if(fuel.fuel != "Other"){
                const icon = document.createElement("img")
                icon.classList.add("legendIcon")
                icon.src = eval("assetSources.fuelIcon"+fuel.fuel)
                colour.appendChild(icon)
            }

            // Create text for legend element
            const label = document.createElement("p")
            label.classList.add("legendName")
            label.textContent = fuel.fuel

            legend.onclick = () => handleFueLegClick(fuel.fuel, setBarChartFilter, setFuelFilter, checkAndSetFilter); // Filters the data points on the map according to fuelFilter state
            legend.style.opacity = fuel.show ? "1" : "0.3"
            legend.appendChild(colour) // Append the colour box to the legend element
            legend.appendChild(label) // Append the text to the legend element
            legendContainer.appendChild(legend) // Append the legend to the filter container
        }

        filter.appendChild(legendContainer)
        filter.appendChild(usageContainer)
        filter.appendChild(mapToggleButtonContainer)
        filter.appendChild(controlContainer) // Append control panel to filter panel
    }, [fuelFilter, powerPlants, regionFilter, yearFilter, generationFilter]);

    // Update zoom selection icon when filters change, redraw plots
    useEffect(() => {
        const filter = filterContainer.current
        if (!filter || !fuelFilter.length || !powerPlants) return
        const zoomSelection = filter.querySelectorAll(".controlIcon")[2]
        if (!zoomSelection) return
        const pps = getShownPowerPlants(powerPlants, regionFilter, fuelFilter, yearFilter, generationFilter)

        // Unset the continent selection when a specific country is selected, so
        // the usage plot falls back to the region-aggregated data. This must run
        // synchronously before the redraw below so the DOM is up to date.
        const unsetContinentSelection = (containerId, filter) =>{
            if(filter.filter(r => r.show).length <= 2){
                const selectedContinentButtons = document.querySelectorAll(`#${containerId} .continentSelected`);
                for(let i = 0; i < selectedContinentButtons.length; i++){
                    const button = selectedContinentButtons[i]
                    button.classList.remove("continentSelected")
                    gsap.fromTo(button, { backgroundColor: "#65A1E0", border: "0.1vmin solid #65A1E0", color:"#FCFCFC" }, 
                        { backgroundColor: "rgba(0,0,0,0.0)", border: "0.1vmin solid #AAD3DE", color:"#000000",  duration: 0.15 }
                    );
                }
            }
        }
        unsetContinentSelection("sidePanelLinePlot", regionFilter)
        unsetContinentSelection("sidePanelComparisonLinePlot", comparisonRegionFilter)

        // Usage data for a diagram: continent-level data if a continent is
        // selected, otherwise the region-aggregated data.
        const getUsageData = (containerId, regionFilterRef) =>{
            const continentName = document.querySelector(`#${containerId} .continentSelected span`)?.textContent
            if (continentName) {
                const selectedName = continentName === "Global" ? "World" : continentName
                const continentData = continentalDataRef.current.find(f => f.entity === selectedName)
                if (continentData) return continentData
            }
            return getShownRegionUsage(regionalDataRef.current, regionFilterRef.current, shareYearsRef.current)
        }

        const linePlotSVG = document.getElementById("linePlotSVG")
        const barChartSVG = document.getElementById("barChartSVG")
        const usageLinePlotSVG = document.getElementById("usagePlotSVG")

        if(linePlotSVG && barChartSVG && usageLinePlotSVG){
            const dataVisualization = (linePlotSVG || barChartSVG).parentElement
            const altVis = usageLinePlotSVG?.parentElement
            const linePlotHidden = linePlotSVG ? linePlotSVG.classList.contains("hide") : true
            const barChartHidden = barChartSVG ? barChartSVG.classList.contains("hide") : true

            const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth
            const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight

            const sidePanelWidth = Math.floor(width * 0.30)
            const sidePanelLeftMargin = Math.floor((window.innerHeight <= 1024)? width* 0.02 : width * 0.01)
            const sidePanelPadding = Math.floor(2 * width * 0.01)
            const plotWidth = Math.floor((sidePanelWidth - sidePanelLeftMargin - sidePanelPadding) * 0.55)
            const altPlotWidth = Math.floor((sidePanelWidth - sidePanelLeftMargin - sidePanelPadding) * 0.85)
            const plotHeight = Math.floor((height * 0.35) * 0.72)

            linePlotSVG?.remove()
            barChartSVG?.remove()
            usageLinePlotSVG?.remove()

            const fuels = getShownRegionFuelData(regionalDataRef.current, regionFilterRef.current, fuelFilterRef.current, true, yearsRef.current)
            const usageData = getUsageData("sidePanelLinePlot", regionFilterRef)
            drawLinePlot(dataVisualization, plotWidth, plotHeight, fuels, !linePlotHidden, "linePlotSVG", yearsRef.current)
            drawBarChart(dataVisualization, plotWidth, plotHeight, fuels, !barChartHidden)
            drawUsageLinePlot(altVis, altPlotWidth, plotHeight, usageData, "usagePlotSVG", shareYearsRef.current)
        }

        // Redraw comparison plots if they exist
        const compLinePlotSVG = document.getElementById("compLinePlotSVG")
        const compBarChartSVG = document.getElementById("compBarChartSVG")
        const compUsageLinePlotSVG = document.getElementById("compUsagePlotSVG")

        if(compLinePlotSVG && compBarChartSVG){
            const compDataVisualization = (compLinePlotSVG || compBarChartSVG).parentElement
            const compAltVis = compUsageLinePlotSVG?.parentElement
            const compLinePlotHidden = compLinePlotSVG ? compLinePlotSVG.classList.contains("hide") : true
            const compBarChartHidden = compBarChartSVG ? compBarChartSVG.classList.contains("hide") : true

            const compWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth
            const compHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight

            const compSidePanelWidth = Math.floor(compWidth * 0.30)
            const compSidePanelLeftMargin = Math.floor((window.innerHeight <= 1024)? compWidth* 0.02 : compWidth * 0.01)
            const compSidePanelPadding = Math.floor(2 * compWidth * 0.01)
            const compPlotWidth = Math.floor((compSidePanelWidth - compSidePanelLeftMargin - compSidePanelPadding) * 0.55)
            const compAltPlotWidth = Math.floor((compSidePanelWidth - compSidePanelLeftMargin - compSidePanelPadding) * 0.85)
            const compPlotHeight = Math.floor((compHeight * 0.35) * 0.72)

            compLinePlotSVG?.remove()
            compBarChartSVG?.remove()
            compUsageLinePlotSVG?.remove()

            const compFuels = getShownRegionFuelData(regionalDataRef.current, compRegionFilterRef.current, compFuelFilterRef.current, true, yearsRef.current)
            const compUsageData = getUsageData("sidePanelComparisonLinePlot", compRegionFilterRef)
            drawLinePlot(compDataVisualization, compPlotWidth, compPlotHeight, compFuels, !compLinePlotHidden, "compLinePlotSVG", yearsRef.current)
            drawBarChart(compDataVisualization, compPlotWidth, compPlotHeight, compFuels, !compBarChartHidden, "compBarChartSVG")
            drawUsageLinePlot(compAltVis, compAltPlotWidth, compPlotHeight, compUsageData, "compUsagePlotSVG", shareYearsRef.current)
        }

        if (powerPlants.features.length != pps.length) {
            // Filtered -> show "full screen" icon
            if (zoomSelection.classList.contains("selection")) {
                zoomSelection.classList.remove("selection")
                zoomSelection.src = assetSources.zoomFullScreen
                zoomSelectionState.current.isSelection = false
            }
        } else {
            // All shown -> show "zoom selection" icon
            if (!zoomSelection.classList.contains("selection")) {
                zoomSelection.classList.add("selection")
                zoomSelection.src = assetSources.zoomSelection
                zoomSelectionState.current.isSelection = true
            }
        }

    }, [fuelFilter, regionFilter, yearFilter, generationFilter, powerPlants, comparisonRegionFilter, comparisonFuelFilter, reportedYears, estimatedYears])

    // Keep the year slider thumb positions in sync with the year filter state
    useEffect(() => {
        if (yearFilter.length !== 2) return
        const [values] = yearFilter
        const sliders = sidePanelContainer.current?.querySelectorAll(".sidePanelFilterSliderContainer")
        if (sliders && sliders[0] && sliders[0].sync) sliders[0].sync(values[0], values[1])
    }, [yearFilter])

    // Keep the year slider thumb position in sync with the share year filter state, update pop-ups if present
    useEffect(() => {
        if (shareYearFilter.length !== 2) return;
        const [value,bounds] = shareYearFilter

        // Slider position sync
        const sliders = sidePanelContainer.current?.querySelectorAll(".sidePanelFilterSliderContainer")
        if (sliders && sliders[1] && sliders[1].sync) sliders[1].sync(bounds[0], value)

        // Pop-up information sync
        const popUpContents = document.querySelectorAll(".pop-up-info")
        if(!popUpContents || !popUpContents.length) return;

        for(let i = 0; i < popUpContents.length; i++){
            let popUp = popUpContents[i]?.parentElement;
            let country = popUp.querySelector("h1").textContent
            let countryData = regionalData.find(r => r.country_long === country)
            if(countryData){
                let usageLC = countryData?.usage_shares?.[value]?.["LC"]
                let usageFF = countryData?.usage_shares?.[value]?.["FF"]
                let yearValue,LCValue,FFValue
                if(!popUp.parentElement.classList.contains("maplibregl-popup-selection-info")){
                    yearValue = popUpContents[i]?.querySelectorAll("strong")[0]
                    LCValue =  popUpContents[i]?.querySelectorAll("span span")[0]
                    FFValue =  popUpContents[i]?.querySelectorAll("span span")[1]
                }else{
                    const selectionContent = popUp.lastChild

                    yearValue = selectionContent?.querySelectorAll("strong")[0]
                    LCValue =  selectionContent?.querySelectorAll("span span")[0]
                    FFValue =  selectionContent?.querySelectorAll("span span")[1]
                }
                yearValue.textContent = "Usage Shares " + value + ": ";
                LCValue.textContent = (usageLC)? usageLC.toFixed(0) + "%" : "N/A"
                FFValue.textContent = (usageFF)? usageFF.toFixed(0) + "%" : "N/A"
            }
        }

    }, [shareYearFilter])

    // Check the context filter for any updates
    useEffect(()=>{
        if(!fuelFilter.length) return
        const currentBCF = barChartFilter
        const prevBCF = [...prevBarChartFilter.current]
        setFuelFilter(prev => {
            if (!currentBCF || !currentBCF.length) {
                const result = prev.map(f =>
                    prevBCF.includes(f.fuel) ? { ...f, show: false } : f
                )
                if (result.every(f => !f.show)) {
                    return prev.map(f => ({ ...f, show: true }))
                }
                return result
            }
            const added = currentBCF.filter(f => !prevBCF.includes(f))
            const removed = prevBCF.filter(f => !currentBCF.includes(f))
            if(prev.every(r => r.show)){
                return prev.map(f => ({ ...f, show: added.includes(f.fuel) }));
            }
            const result = prev.map(f => {
                if (added.includes(f.fuel)) return { ...f, show: true }
                if (removed.includes(f.fuel)) return { ...f, show: false }
                return f
            })
            if (result.every(f => !f.show)) {
                return prev.map(f => ({ ...f, show: true }))
            }
            return result
        })
        prevBarChartFilter.current = currentBCF ? [...currentBCF] : []
    }, [barChartFilter])

    // Check for region and comparison region filter changes, update diagram texts based on said changes
    useEffect(()=>{
        if(!regionFilter) return;

        // Set visibility for a set of layer ids
        const setVisibility = (layerIds, visibility) => {
            layerIds.forEach(id => {
                if (mapRef.current.getLayer(id)) mapRef.current.setLayoutProperty(id, "visibility", visibility)
            })
        }
        const powerPlantsButton = Array.from(document.querySelectorAll(".mapToggleButton"))
                .find(button => button.querySelector("span")?.textContent === "Power Plants")
        const powerPlantsSelected = powerPlantsButton?.classList.contains("selectedMapMode")

        const mainDiagram = document.getElementById("sidePanelLinePlot")

        // Check settings of the main diagram and update texts
        if(!mainDiagram) return;
        // Get text elements
        const showingMainOutput = mainDiagram.querySelectorAll(".dataToggleButton")[1].style.backgroundColor == "rgb(170, 211, 222)"

        const mainTitle = mainDiagram.querySelector("#linePlotTitle")
        const boldText = mainDiagram.querySelector("#linePlotExBoldText")
        const altMainTitle = mainDiagram.querySelector("#linePlotAltTitle")

        const openPopUps = document.querySelectorAll(".maplibregl-popup-selection-info")

        // Get shown regions
        const shownRegions = regionFilter.filter(f=>f.show)
        if(shownRegions.length > 2){ // Assumption that the user only can select more than two regions by clicking on the continent button
            // Close region-based pop-ups
            openPopUps.forEach(popup => {
                    gsap.to(popup.children[1].children, {opacity: 0, duration: 0.2, ease: "power2.in"})
                    gsap.to(popup.children[1], { height: 0, width: 0, opacity: 0, duration: 0.3, ease: "power2.in", transformOrigin: "bottom center", onComplete: () => popup.remove() })
            })

            if(powerPlantsSelected){
                setVisibility(["fuelType-fill","fuelType-border"], "visible")
                setVisibility(["powerplants-layer"], "none")
            }

            if(shownRegions.length == regionFilter.length){ // Global option selected
                mainTitle.textContent = "Global Electricity Source Trends"
                altMainTitle.textContent = "Global Low Carbon and Fossil Fuel Usage Shares"
                if(showingMainOutput){boldText.textContent = "Global electric generation per year "}
                else{boldText.textContent = "Global power plant capacity by source "}
            }else{ // A continent is selected, check first item to see which
                let continent = shownRegions[0].continent
                mainTitle.textContent = continent + "'s Electricity Source Trends"
                altMainTitle.textContent = continent + "'s Low Carbon and Fossil Fuel Usage Shares"
                if(showingMainOutput){boldText.textContent = continent + "'s electric generation per year "}
                else{boldText.textContent = continent + "'s power plant capacity by source "}
            }
        }else{ // User has selected a country or used the storymode

            if(powerPlantsSelected){
                setVisibility(["fuelType-fill","fuelType-border"], "none")
                setVisibility(["powerplants-layer"], "visible")
            }

            if(shownRegions <= 0) return; // Just to be sure undefined objects aren't checked
            let titleToShow = ""
            shownRegions.forEach((r, id) =>{
                if(id > 0){titleToShow += " and "}
                titleToShow += r.country_long
            })
            mainTitle.textContent = titleToShow + "'s Electricity Source Trends"
            altMainTitle.textContent = titleToShow + "'s Low Carbon and Fossil Fuel Usage Shares"
            if(showingMainOutput){boldText.textContent = titleToShow + "'s electric generation per year "}
            else{boldText.textContent = titleToShow + "'s power plant capacity by source "}

            const isOpen = (name) =>{
                let opened = document.querySelectorAll(".maplibregl-popup-selection-info")
                for(let i = 0; i<opened.length; i++){
                    let popup = opened[i]
                    let popUpName = popup.querySelector("h1").textContent

                    if(popUpName == name) return true;
                }
                return false;
            }

            // Close unwanted pop-ups
            if(openPopUps.length){
                for(let i = 0; i<openPopUps.length; i++){
                    let popup = openPopUps[i]
                    let popUpName = popup.querySelector("h1").textContent

                    if(typeof shownRegions.find(r=>r.country_long == popUpName) == 'undefined'){
                        gsap.to(popup.children[1].children, {opacity: 0, duration: 0.2, ease: "power2.in"})
                        gsap.to(popup.children[1], { height: 0, width: 0, opacity: 0, duration: 0.3, ease: "power2.in", transformOrigin: "bottom center", onComplete: () => popup.remove() })
                    }
                }
            }
            // Open relevant pop-ups
            for(let i = 0; i<shownRegions.length; i++){
                if(!isOpen(shownRegions[i].country_long)){
                    // Don't create new pop-up if desired to open already exsists
                    let bounds = boundaryData.features.find(b=>b.properties.adm0_iso == shownRegions[i].country)
                    if(!bounds){ // Attempt to find country with other code
                        bounds = boundaryData.features.find(b=>b.properties.iso_a3 == shownRegions[i].country)
                    }
                    if(!bounds) return;
                    let coordinates = [bounds.properties.label_x, bounds.properties.label_y]
                
                    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
                    let popup = new maplibregl.Popup({maxWidth: Math.round(400*scale) + "px", closeButton: false, closeOnClick: false})
                        .setLngLat(coordinates)
                        .setHTML(("<h1>"+ shownRegions[i].country_long +"</h1>"))
                        .addTo(mapRef.current);
                    // Assign special class to pop-up
                    popup.getElement().classList.add("maplibregl-popup-selection-info")

                    // Pop up rotate X "fade in"
                    const contentElement = popup.getElement().children[1]
                    gsap.set(contentElement, { rotateX: -90, opacity: 0, transformOrigin: "bottom center" })
                    gsap.set(popup.getElement(), { perspective: 800 })
                    gsap.to(contentElement, { rotateX: 0, opacity: 1, duration: 0.3, ease: "power2.out",
                        onComplete: ()=>{
                            const boundingBox = contentElement.getBoundingClientRect();
                            const mapWidth = window.screen.width - ((window.screen.height <= 1024)? window.screen.width * 0.30 : window.screen.width * 0.25) - 50
                            if(boundingBox.top <= 0 || boundingBox.right >= mapWidth){
                                mapRef.current?.panBy([0, 0], { duration: 1 }) // Work around to reposition pop-ups that are outside the screen
                            }
                        }
                    })
                    contentElement.style.width = Math.round(400*scale) + "px"
                    
                    // Replace text based close button with image based icon instead
                    const closeButton = document.createElement("img")
                    closeButton.src = assetSources.closeIcon
                    
                    closeButton.onclick = (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        gsap.to(contentElement.children, {opacity: 0, duration: 0.2, ease: "power2.in"})
                        gsap.to(contentElement, { height: 0, width: 0, opacity: 0, duration: 0.3, ease: "power2.in", transformOrigin: "bottom center", onComplete: () => popup.remove() })
                    }
                    
                    // Reorder header content
                    const popUpHeader = document.createElement("div")
                    popUpHeader.classList.add("pop-up-header")
                    popUpHeader.style.marginBottom = "0.5dvh";
                    const popupTitle = contentElement.children[0]
                    
                    popUpHeader.appendChild(popupTitle)
                    popUpHeader.appendChild(closeButton)
                    contentElement.appendChild(popUpHeader)

                    var regionInfo = document.createElement("div")
                    regionInfo.classList.add("pop-up-info", "noBorder", "hide")

                    var usageInfo = document.createElement("div")
                    usageInfo.classList.add("pop-up-info", "noBorder", "hide")

                    var regionDropDownHeader = document.createElement("div")
                    regionDropDownHeader.classList.add("selection-overview-header")
                    var usageDropDownHeader = document.createElement("div")
                    usageDropDownHeader.classList.add("selection-overview-header")

                    regionDropDownHeader.onclick = () => toggleSelectionDropDown(regionDropDownHeader, mapRef.current)
                    usageDropDownHeader.onclick = () => toggleSelectionDropDown(usageDropDownHeader, mapRef.current)
                    
                    var rDropDownTitle = document.createElement("h1")
                    var rDropDownIcon =document.createElement("img")
                    var uDropDownTitle = document.createElement("h1")
                    var uDropDownIcon =document.createElement("img")

                    // Set header title and add open/clsoe image
                    rDropDownTitle.textContent = "Electric Generation"
                    rDropDownIcon.src = assetSources.sidePanelRollupOpen

                    uDropDownTitle.textContent = "Usage Shares"
                    uDropDownIcon.src = assetSources.sidePanelRollupOpen

                    regionDropDownHeader.appendChild(rDropDownTitle)
                    regionDropDownHeader.appendChild(rDropDownIcon)

                    usageDropDownHeader.appendChild(uDropDownTitle)
                    usageDropDownHeader.appendChild(uDropDownIcon)


                    contentElement.appendChild(regionDropDownHeader)
                    contentElement.appendChild(regionInfo)
                    contentElement.appendChild(usageDropDownHeader)
                    contentElement.appendChild(usageInfo)

                    createPopUpBarChart(contentElement,shownRegions[i].country, regionalData,fuelFilter, estimatedYears, assetSources.infoIcon,true)
                    createPopUpUsagePlot(contentElement,shownRegions[i].country, regionalData, shareYears, true)

                    const infoIcon = contentElement.querySelector(".regionalInfoWrapper")
                    const infoToolTip = contentElement.querySelector(".generationInfoTooltipText")
                    infoIcon.onmouseover = () => infoToolTip.style.visibility = "visible"
                    infoIcon.onmouseout = () => infoToolTip.style.visibility = "hidden"

                    makePopUpMovable(popup.getElement(),mapRef.current)
                }
            }

        }
    }, [regionFilter])

    // Check for comparison region filter changes, update diagram texts based on said changes
    useEffect(()=>{
        if(!comparisonRegionFilter) return;

        const compDiagram = document.getElementById("sidePanelComparisonLinePlot")

        // Check settings of comp diagram and update texts
        if(!compDiagram) return;

        // Get text elements
        const showingCompOutput = compDiagram.querySelectorAll(".dataToggleButton")[1].style.backgroundColor == "rgb(170, 211, 222)"

        const compTitle = compDiagram.querySelector("#compLinePlotTitle")
        const boldCompText = compDiagram.querySelector("#compLinePlotExBoldText")
        const altCompTitle = compDiagram.querySelector("#compLinePlotAltTitle")

        // Get shown comparisson regions
        const shownCompRegions = comparisonRegionFilter.filter(f=>f.show)
        if(shownCompRegions.length > 2){ // Assumption that the user only can select more than two regions by clicking on the continent button
            if(shownCompRegions.length == comparisonRegionFilter.length){ // Global option selected
                compTitle.textContent = "Global Electricity Source Trends"
                altCompTitle.textContent = "Global Low Carbon and Fossil Fuel Usage Shares"
                if(showingCompOutput){boldCompText.textContent = "Global electric generation per year "}
                else{boldCompText.textContent = "Global power plant capacity by source "}
            }else{ // A continent is selected, check first item to see which
                let continentComp = shownCompRegions[0].continent
                compTitle.textContent = continentComp + "'s Electricity Source Trends"
                altCompTitle.textContent = continentComp + "'s Low Carbon and Fossil Fuel Usage Shares"
                if(showingCompOutput){boldCompText.textContent = continentComp + "'s electric generation per year "}
                else{boldCompText.textContent = continentComp + "'s power plant capacity by source "}
            }
        }else{ // User has selected a country or used the storymode
            if(shownCompRegions <= 0) return; // Just to be sure undefined objects aren't checked
            let titleToShowComp = ""
            shownCompRegions.forEach((r, id) =>{
                if(id > 0){titleToShowComp += " and "}
                titleToShowComp += r.country_long
            })
            compTitle.textContent = titleToShowComp + "'s Electricity Source Trends"
            altCompTitle.textContent = titleToShowComp + "'s Low Carbon and Fossil Fuel Usage Shares"
            if(showingCompOutput){boldCompText.textContent = titleToShowComp + "'s electric generation per year "}
            else{boldCompText.textContent = titleToShowComp + "'s power plant capacity by source "}
        }
    }, [comparisonRegionFilter])

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            const sidePanel = sidePanelContainer.current
            if (!sidePanel || !sidePanel.children.length) return
            const pageContainer = sidePanel.children[0]
            const dropdowns = [
                pageContainer.querySelector("#linePlotRegionFilter").children[0],
                pageContainer.querySelector("#compRegionFilter")?.children[0]
                //pageContainer.children[4]?.children[0],
            ]
            dropdowns.forEach(element => {
                if (!element || !element.children[1]) return
                const dropdown = element.children[1]
                if (dropdown.classList.contains("hide")) return
                if (!element.contains(e.target)) {
                    toggleDropDown(element)
                }
            })
        }
        document.addEventListener("click", handleClickOutside)
        return () => document.removeEventListener("click", handleClickOutside)
    }, [])

    // Update legend opacity, drop down titles, and bar chart strokes when filter changes
    useEffect(() => {
        const filter = filterContainer.current; // Get the current filter component
        const sidePanel = sidePanelContainer.current; // Get the current sidepanel component
        if (!filter || !fuelFilter.length) return; // If id does not exsist don't update anything

        const legendsFilter = filter.querySelectorAll(".filterLegend"); // Find all legends
        fuelFilter.forEach((fuel, i) => {
            if (legendsFilter[i]) { // If legend exists
                legendsFilter[i].style.opacity = fuel.show ? "1" : "0.3";
            }
        });

        if (!sidePanel || !sidePanel.children.length || !fuelFilter.length || !regionFilter.length) return; // If id does not exsist don't update anything
        //const fueLegSidePanel = sidePanel.children[0].children[4].querySelectorAll(".filterLegend"); // Find all legends
        const regLegSidePanel = sidePanel.children[0].querySelector("#linePlotRegionFilter").querySelectorAll(".filterLegend");
        const bars = document.querySelectorAll(".barchartContainer");

        const regionFilterDropDownTitle = sidePanel.children[0].querySelectorAll(".sidePanelFilterTitle")[0]
        //const fuelFilterDropDownTitle = sidePanel.children[0].querySelectorAll(".sidePanelFilterTitle")[1]

        const comparisonRegionFilterDropDown = sidePanel.children[0].querySelectorAll("#compRegionFilter")[0]

        const shownRegions = regionFilter.filter((region) => region.show)
        const shownFuels = fuelFilter.filter((fuel) => fuel.show)

        const handleDropDownTitle = (titleE, sidePanelE, type, shown)=>{
            if(shown.length == sidePanelE.length){
                titleE.textContent = (type =="region")?   "All Regions" : "All Power Sources"
            }else if(shown.length == 0){
                titleE.textContent = "No "
                titleE.textContent += (type =="region")? "Regions" : "Power Sources"
                titleE.textContent += " Selected"
            }else{
                titleE.textContent = getNewDropDownTitle(shown, type)
            }
        }

        handleDropDownTitle(regionFilterDropDownTitle,regLegSidePanel, "region", shownRegions)
        //handleDropDownTitle(fuelFilterDropDownTitle,fueLegSidePanel, "fuel", shownFuels)

        if(comparisonRegionFilterDropDown){
            const compRegionFilterDropDownTitle = comparisonRegionFilterDropDown.querySelectorAll(".sidePanelFilterTitle")[0]
            const compRegionFilterLegend = comparisonRegionFilterDropDown.querySelectorAll(".filterLegend")
            const shownCompRegions = comparisonRegionFilter.filter((region) => region.show)
            handleDropDownTitle(compRegionFilterDropDownTitle, compRegionFilterLegend, "region", shownCompRegions)

            comparisonRegionFilter.forEach((region, i)=>{
                if(compRegionFilterLegend[i]){
                    compRegionFilterLegend[i].style.opacity = region.show ? "1" : "0.3";
                    compRegionFilterLegend[i].children[0].children[0].style.opacity = region.show ? "1" : "0.0";
                }
            })
        }
        
        if(bars.length){
            for(var i = 0; i < bars.length; i++){
                let children = Array.from(bars[i].children)
                children.forEach(c =>{
                    let cName = c.classList.value
                    if(cName.includes("bar_") && shownFuels.some(f => f.fuel == cName.slice(4)) && shownFuels.length < fuelFilter.length){
                        c.style.stroke = "#11658C"
                        c.style.strokeWidth = "0.2dvh"
                    }else{
                        c.style.stroke = "unset"
                        c.style.strokeWidth = "unset"
                    }
                })
            }
        }

        /* fuelFilter.forEach((fuel, i) => {
            if (fueLegSidePanel[i+1]) { // If legend exists, +1 to skip select all option
                fueLegSidePanel[i+1].style.opacity = fuel.show ? "1" : "0.3"; // Set oppacity based on filter settings
            }
        }); */
        regionFilter.forEach((region, i)=>{
            if(regLegSidePanel[i]){
                regLegSidePanel[i].style.opacity = region.show ? "1" : "0.3";
                regLegSidePanel[i].children[0].children[0].style.opacity = region.show ? "1" : "0.0";
            }
        })

        // Update the line plot fuel filter entries and select all option
        const linePlotFuelContainer = sidePanel.querySelector("#fuelFilterContainer")
        if (linePlotFuelContainer) {
            const linePlotEntries = linePlotFuelContainer.querySelectorAll(".fuelFilterEntry")
            const allRegionFuels = getShownRegionFuelData(regionalData, regionFilter, fuelFilter, false, yearsRef.current)
            fuelFilter.forEach((fuel, i) => {
                const entry = linePlotEntries[i+1] // +1 to skip the select all entry
                if (entry) {
                    entry.style.opacity = fuel.show ? "1" : "0.3";
                    const checkMark = entry.querySelector(".fuelFilterCheckMark")
                    if (checkMark) checkMark.style.opacity = fuel.show ? "1" : "0";

                    const regionFuel = allRegionFuels.find(rf => rf.fuel === fuel.fuel)
                    const capacityValue = regionFuel ? regionFuel.sum_capacity_mw : fuel.sum_capacity_mw
                    const generationValue = getLatestGenerationValue(regionFuel || fuel, yearsRef.current)
                    const capacityEl = entry.querySelector(".ffCapacity")
                    const generationEl = entry.querySelector(".ffGeneration")
                    if (capacityEl) capacityEl.textContent = formatPowerOf10(capacityValue)
                    if (generationEl) generationEl.textContent = formatPowerOf10(generationValue)
                }
            })

            const selectAllName = linePlotFuelContainer.querySelector("#fuelFilterSelectAllName")
            const selectAllCheck = linePlotFuelContainer.querySelector("#fuelFilterSelectAllCheck")
            if (selectAllName && selectAllCheck) {
                if (fuelFilter.every(f => f.show)) {
                    selectAllName.textContent = "Deselect All"
                    selectAllCheck.style.opacity = "1"
                } else {
                    selectAllName.textContent = "Select All"
                    selectAllCheck.style.opacity = "0"
                }
            }
        }

        // Update the comparison diagram fuel filter legend opacity
        const comparisonFuelContainer = sidePanel.querySelector("#compFuelFilterContainer")
        if (comparisonFuelContainer) {
            const comparisonEntries = comparisonFuelContainer.querySelectorAll(".fuelFilterEntry")
            comparisonFuelFilter.forEach((fuel, i) => {
                const entry = comparisonEntries[i+1] // +1 to skip the select all entry
                if (entry) {
                    entry.style.opacity = fuel.show ? "1" : "0.3";
                    const checkMark = entry.querySelector(".fuelFilterCheckMark")
                    if (checkMark) checkMark.style.opacity = fuel.show ? "1" : "0";
                }
            })
        }
    }, [fuelFilter,regionFilter,regionalData,popupCount, comparisonRegionFilter, comparisonFuelFilter, reportedYears, estimatedYears]);

    // Update map layer filter
    useEffect(() => {
        const toFilter = mapRef.current;
        if (!toFilter ||
            !toFilter.getLayer("powerplants-layer") ||
            !toFilter.getLayer("fuelType-fill") ||
            !toFilter.getLayer("fuelType-border") ||
            !fuelFilter.length || !regionFilter.length
        ) return;
        const shownFuels = fuelFilter.filter(f => f.show).map(f => f.fuel);
        const shownRegions = regionFilter.filter(r => r.show).map(r => r.country);

        const filters = ["all"];
        const fuelTypeFitlers = ["all"];

        if (shownFuels.length < fuelFilter.length) {
            const matchFuels = shownFuels.flatMap(f => f === "Other" ? [...otherFuels] : [f]);
            filters.push(["in", ["get", "primary_fuel"], ["literal", matchFuels]]);
        }
        if (shownRegions.length < regionFilter.length) {
            filters.push(["in", ["get", "country"], ["literal", [...shownRegions]]]);
            fuelTypeFitlers.push(['any',["in", ["get", "adm0_iso"], ["literal", [...shownRegions]]],["in", ["get", "iso_a3"], ["literal", [...shownRegions]]]]);
        }
        if (yearFilter.length === 2) {
            const [values, bounds] = yearFilter
            if (values[0] !== bounds[0] || values[1] !== bounds[1]) {
                filters.push([">=", ["to-number", ["get", "commissioning_year"]], values[0]]);
                filters.push(["<=", ["to-number", ["get", "commissioning_year"]], values[1]]);
            }
        }
        if (generationFilter.length === 2) {
            const [values, bounds] = generationFilter
            if (values[0] !== bounds[0] || values[1] !== bounds[1]) {
                filters.push([">=", ["to-number", ["at", 0, ["get", "minMax"]]], values[0]]);
                filters.push(["<=", ["to-number", ["at", 1, ["get", "minMax"]]], values[1]]);
            }
        }

        if (filters.length === 1) {
            toFilter.setFilter("powerplants-layer", null);
        } else {
            toFilter.setFilter("powerplants-layer", filters);
        }

        if(fuelTypeFitlers.length === 1){
            toFilter.setFilter("fuelType-fill", null);
            toFilter.setFilter("fuelType-border", null);
        }else{
            toFilter.setFilter("fuelType-fill", fuelTypeFitlers);
            toFilter.setFilter("fuelType-border", fuelTypeFitlers);
        }

        // Store the freshly-computed base filters so the country selection
        // (kept in Map.jsx) can be re-applied on top of them.
        setBaseFilters(
            fuelTypeFitlers.length === 1 ? null : fuelTypeFitlers,
            filters.length === 1 ? null : filters
        )

        // Re-apply the country selection made on the map (if any) on top of
        // the base filters that were just set above.
        applyFuelTypeSelection()

    }, [fuelFilter, regionFilter, yearFilter, generationFilter, mapRef, mapReady, applyFuelTypeSelection, setBaseFilters]);

    // Update alternative map layer filters
    useEffect(() =>{
        const toFilter = mapRef.current;
        if (
            !toFilter ||
            !toFilter.getLayer("usage-fill") ||
            !toFilter.getLayer("usage-border") ||
            !shareYearFilter.length || !LCShareFilter.length
        ) return;

        const LCfilters = ["all"];
        const key = String(shareYearFilter[0])
        const shownRegions = regionFilter.filter(r => r.show).map(r => r.country);

        if (LCShareFilter.length === 2) {
            const [values, bounds] = LCShareFilter
            if (values[0] !== bounds[0] || values[1] !== bounds[1]) {
                LCfilters.push([">=", ["to-number", ['get', 'LC', ['get', key, ['get', 'usageShares']]]], values[0]]);
                LCfilters.push(["<=", ["to-number", ['get', 'LC', ['get', key, ['get', 'usageShares']]]], values[1]]);
            }
        }

        if (shownRegions.length < regionFilter.length) {
            LCfilters.push(['any',["in", ["get", "adm0_iso"], ["literal", [...shownRegions]]],["in", ["get", "iso_a3"], ["literal", [...shownRegions]]]]);
        }

        if (LCfilters.length === 1) {
            toFilter.setFilter("usage-fill", null);
            toFilter.setFilter("usage-border", null);
        } else {
            toFilter.setFilter("usage-fill", LCfilters);
            toFilter.setFilter("usage-border", LCfilters);
        }

        // Recolour the low carbon / fossil fuel layers based on the selected share year.
        // The year is not used to filter countries, only to pick which usage values colour them.
        if (shareYearFilter.length === 2 && boundaryData) {
            const year = shareYearFilter[0]
            const usageColor = usageColourForYear(year, shareYearFilter[1], boundaryData)

            toFilter.setPaintProperty("usage-fill", "fill-color", usageColor)
            toFilter.setPaintProperty("usage-border", "line-color", usageColor)
        }
    }, [regionFilter, shareYearFilter, LCShareFilter, FFShareFilter, mapRef, mapReady, boundaryData])

    // Compute shown and total power plant counts
    useEffect(() => {
        const sidePanel = sidePanelContainer.current;
        if (!sidePanel || !powerPlants?.features?.length || !fuelFilter.length || !regionFilter.length) return;
        if (sidePanel.children.length === 0) return;

        const total = powerPlants.features.length;
        const shown = getShownPowerPlants(powerPlants, regionFilter, fuelFilter, yearFilter, generationFilter).length
        const pageContainer = sidePanel.children[0];
        const filterCounterValue = pageContainer.querySelector("#filterCounterValue");
        const filterCounterStatic = pageContainer.querySelector("#filterCounterStatic");

        if(shown == 0){
            if (filterCounterValue) filterCounterValue.textContent = "";
            if (filterCounterStatic){
                filterCounterStatic.textContent = "No power plants found, reset filters";
                gsap.fromTo(filterCounterStatic,
                    {color: "#f7f7f7", fontSize: "1.4vmin"},
                    {color: "#8f0c0c", fontSize: "1.6vmin",
                        duration: 0.15, yoyo: true, repeat: 1, overwrite: true 
                    }
                )
            }
            return;
        }
        if (filterCounterValue) filterCounterValue.textContent = shown;
        if (filterCounterStatic) filterCounterStatic.textContent = `/${total} power plants selected`;
    }, [fuelFilter, regionFilter, yearFilter, generationFilter, powerPlants]);

    // Update side panel when it is changed
    useEffect(() =>{
        const sidePanel = sidePanelContainer.current; // Get the current sidePanel component
        
        if (!sidePanel) return;
        if (!pageContent) return;
        if (!regionalData.length) return;

        if(!pages || (!pages.dataset.powerPlantsSynced && powerPlants)){ // If the pages haven't been created yet, or data just loaded
            if (pages){sidePanel.replaceChildren()}
            const newPages = createPages(pageContent, powerPlants, regionalData, continentalData, regionFilter, regionFilterRef, fuelFilter,
                setFuelFilter, setRegionFilter, setBarChartFilter, yearsRef.current, shareYearsRef.current,
                (values, bounds) => setYearFilter([values, bounds]),
                (values, bounds) => setGenerationFilter([values, bounds]),
                (value, bounds) => setShareYearFilter([value, bounds]),
                (values, bounds) => setLCShareFilter([values,bounds]),
                (values, bounds) => setFFShareFilter([values,bounds]),
                (button, option) => handleResetClick(button, option, resetAllFilters),
                (element, index) => handleIndexClick(element, index, regionFilterRef),
                handleLinePlotToggle,
                (clickedFuel, setBarChartFilter, setFilter) => handleFueLegClick(clickedFuel, setBarChartFilter, setFilter, checkAndSetFilter),
                (element, regionalData, continent, continentData, filterRef, setFilter, shareYears, dontZoomTo) => handleContinentClick(element, regionalData, continent, continentData, filterRef, setFilter, shareYears, dontZoomTo, zoomToRegionFilter),
                () => handleAddDiagramClick(assetSources, comparisonFuelFilter, regionalData,continentalData, comparisonRegionFilter, compRegionFilterRef, setComparisonRegionFilter, setComparisonFuelFilter, fillDropDowns, toggleDropDown, zoomToRegionFilter, checkAndSetFilter, yearsRef.current, shareYearsRef.current)
            )
            if (powerPlants){newPages.dataset.powerPlantsSynced = "true"}
            setPages(newPages)
            return
        }else{ // The pages exists

            // Hide/show loop
            const pageChanged = prevPageRef.current !== sidePanelPage.id
            const previousPageId = prevPageRef.current
            for(var i = 0; i < sidePanelPage.visibleHtmlElements.length; i++){
                if(sidePanelPage.visibleHtmlElements[i]){
                    if(pages.children[i].classList[0] == "sidePanelInstructionsContainer" ||
                        pages.children[i].id == "sidePanelMainTitle" ||
                        pages.children[i].id == "sidePanelSubtitle" ||
                        pages.children[i].id == "InfoTitle"
                    ){
                        if (pageChanged){
                            gsap.fromTo(pages.children[i],
                                {opacity: 0/*, rotateX: 90, transformOrigin: "top"*/},
                                {opacity: 1, /*rotateX: 0, transformOrigin: "top"*/ duration: 1.0, ease: "power2.out"}
                            )
                        }
                    }
                    const element = pages.children[i]
                    if(element.classList[0] == "sidePanelFilterContainer" || element.id == "sidePanelLinePlot" ||
                         element.id == "navigationBarContainer" || element.id == "sidePanelFilterAndResetWrapper"
                    ){
                        element.style.display = "flex"
                    }else{
                        element.style.display = "block"
                    }
                }else{
                    pages.children[i].style.display = "none"
                }
            }
            prevPageRef.current = sidePanelPage.id

            // Filter settings on page change, for storytelling purposes
            if(pageChanged){
                // Different map mode buttons for easier acces
                const powerPlantsButton = Array.from(document.querySelectorAll(".mapToggleButton"))
                .find(button => button.querySelector("span")?.textContent === "Power Plants")

                const currentSelectionButton = document.querySelectorAll(".mapToggleButton.selectedMapMode")

                const usageButton = Array.from(document.querySelectorAll(".mapToggleButton"))
                .find(button => button.querySelector("span")?.textContent === "Energy Usage")

                switch(sidePanelPage.id){
                    case 2: // First instructions page
                        setRegionFilterTo(["SWE", "NOR"])
                        setFuelFilterTo(fuelFilterRef.current.map(f => f.fuel))
                        setGenerationFilterTo(0, 38000)
                        if (powerPlantsButton) handleMapModeToggle(powerPlantsButton, mapRef, regionFilter)
                        break;
                    case 3: // Second instructions page
                        setRegionFilterTo(["SWE"])
                        setFuelFilterTo(fuelFilterRef.current.map(f => f.fuel))
                        setGenerationFilterTo(0, 38000)
                        if (powerPlantsButton) handleMapModeToggle(powerPlantsButton, mapRef, regionFilter)
                        break;
                    case 4: // Third instruction page
                        setRegionFilterTo(["SWE"])
                        setFuelFilterTo(fuelFilterRef.current.map(f => f.fuel))
                        setGenerationFilterTo(0, 38000)
                        if (powerPlantsButton) handleMapModeToggle(powerPlantsButton, mapRef, regionFilter)
                        break;
                    case 5: // Fourth instructions page
                        setRegionFilterTo(["SWE", "DNK"])
                        setFuelFilterTo(fuelFilterRef.current.map(f => f.fuel))
                        setGenerationFilterTo(0, 38000)
                        if (powerPlantsButton) handleMapModeToggle(powerPlantsButton, mapRef, regionFilter)
                        break;
                    case 6: // Fifth instructions page
                        setRegionFilterTo(["SWE", "FIN"])
                        setFuelFilterTo(fuelFilterRef.current.map(f => f.fuel))
                        setGenerationFilterTo(0, 38000)
                        if(usageButton) handleMapModeToggle(usageButton, mapRef, regionFilter)
                        break;
                    default:
                        if(sidePanel.children.length){ // Is needed to ensure the select all options exists
                            resetAllFilters()
                            mapRef.current?.flyTo({
                                center: [89, 30],
                                zoom: 1.8,
                                speed: 0.8,
                                curve: 1.4
                            });
                            // Keep user selection for switch to home and info pages
                            if (currentSelectionButton[0]) handleMapModeToggle(currentSelectionButton[0], mapRef, regionFilter)
                        }
                }
            }

            // Add playback eventlisteners
            const playBackParents = pages.querySelectorAll("#sliderPlaybackField")

            playBackParents[0].onclick = () => handlePlayBackClick(playBackParents[0].children[1], yearFilter, setYearFilter, 20000, mapRef.current);
            playBackParents[1].onclick = () => handlePlayBackClick(playBackParents[1].children[1], shareYearFilter, setShareYearFilter, 20000, null);

            // Add eventlisteners to rollups
            const sidePanelRegionFilter = pages.querySelector("#linePlotRegionFilter").children[0]

            const sidePanelRegionHeader = sidePanelRegionFilter.children[0]

            sidePanelRegionHeader.onclick = () => handleRollupClick(sidePanelRegionFilter, toggleDropDown)

            // Fill drop down windows
            const regionDropDown = sidePanelRegionFilter.children[1]

            fillDropDowns(regionDropDown, regionFilter, setRegionFilter, regionFilterRef, true)

            // Add navigation and colour correct icon
            const navigationBar = pages.querySelector("#navigationBarContainer")
            const largeIcons = navigationBar.querySelectorAll(".navigationBarIconWrapperLarge")
            const smallIcons = navigationBar.querySelectorAll(".navigationBarIconWrapperSmall")
            const smallTitle = navigationBar.querySelectorAll("#sidePanelMainTitleSmall")

            if (pageChanged) {
                const isHomePage = sidePanelPage.id == 0
                const cameFromHome = previousPageId == 0

                if (isHomePage) {
                    // Slide home/info back to center, fade out instruction icons
                    gsap.to(smallTitle, {opacity: 0, duration: 0.5, ease: "power2.in"})
                    largeIcons.forEach(icon => gsap.to(icon, { x: 0, duration: 0.5, ease: "power2.out" }))
                    smallIcons.forEach((icon,i) => {
                        icon.children[1].style.opacity = 0
                        gsap.to(icon.children, {opacity: 0, duration: 0.5, ease: "power2.in", delay: i * 0.05})
                        gsap.to(icon, { opacity: 0, width:0, duration: 0.5, ease: "power2.in" , delay: i * 0.05,
                            onComplete: () => icon.style.display = "none" })
                    })
                } else if (cameFromHome) {
                    // Slide home/info outward, fade in instruction icons
                    gsap.fromTo(smallTitle, {opacity: 0}, {opacity: 1, duration: 0.5, ease: "power2.in"})
                    largeIcons[0] && gsap.to(largeIcons[0], { x: "-0.5dvh", duration: 0.5, ease: "power2.out" })
                    largeIcons[1] && gsap.to(largeIcons[1], { x: "-0.5dvh", duration: 0.5, ease: "power2.out" })
                    smallIcons.forEach((icon, i) => {
                        icon.style.display = "block"
                        gsap.fromTo(icon.children, {opacity: 0}, {opacity: 1, duration: 0.5, ease: "power2.in", delay: i * 0.05})
                        gsap.fromTo(icon, { opacity: 0, width:0, x: "-1dvh" },
                            { opacity: 1,width:'auto', x: 0, duration: 0.5, ease: "power2.out", delay: i * 0.05, 
                                onComplete: () => icon.children[1].style.opacity = 1
                            })
                    })
                }
            }

            const iconWrappers = navigationBar.querySelectorAll(".navigationBarIconWrapper")
            for(let i = 0; i < iconWrappers.length; i++){
                const wrapper = iconWrappers[i]
                const icon = wrapper.querySelector("img")
                if(sidePanelPage.id == i){
                    //icon.style.filter = "brightness(0) saturate(100%) invert(28%) sepia(99%) saturate(443%) hue-rotate(154deg) brightness(97%) contrast(94%)"
                    icon.style.filter = "brightness(0) saturate(100%) invert(85%) sepia(31%) saturate(240%) hue-rotate(149deg) brightness(93%) contrast(85%)"
                }else{
                    //icon.style.filter = "brightness(0) saturate(100%) invert(99%) sepia(27%) saturate(3815%) hue-rotate(171deg) brightness(87%) contrast(84%)"
                    icon.style.filter = "brightness(0) saturate(100%) invert(27%) sepia(96%) saturate(624%) hue-rotate(160deg) brightness(94%) contrast(90%)"
                }
                icon.onclick = () => handleNavigationClick(i, icon, setSidePanelPage, allPages)
            }

            if(sidePanel.children.length == 0){
                sidePanel.appendChild(pages)
            }
        }
        
    }, [sidePanelPage,pages, fuelFilter, regionFilter, regionalData, powerPlants, pageContent])

    // Handle clicks on the seperate country toggles
    // Zoom the map to fit the currently shown regions
    function zoomToRegionFilter(rFilter){
        const pps = getShownPowerPlants(powerPlants, rFilter, fuelFilter, yearFilter, generationFilter)
        const coordinates = []
        pps.forEach((p) =>{
            coordinates.push(p.geometry.coordinates)
        })
        if(coordinates.length && coordinates.length != powerPlants.features.length){
            const bounds = getBounds(coordinates)
            mapRef.current?.fitBounds([bounds.southWest, bounds.northEast],{
                padding: 75,
                maxZoom: 15
            });
        }else{
            mapRef.current?.flyTo({
                center: [89, 30],
                zoom: 1.8,
                speed: 0.8,
                curve: 1.4
            });
        }
    }

    // Set the region filter to a specific list of countries and zoom to them
    function setRegionFilterTo(countries){
        const toggled = regionFilterRef.current.map(r => ({ ...r, show: countries.includes(r.country) }))
        setRegionFilter(toggled)
        zoomToRegionFilter(toggled)
    }

    // Set the fuel filter to a specific list of fuels
    function setFuelFilterTo(fuels){
        //const selectAllOption = sidePanel.children[0].children[4].querySelectorAll(".filterLegend")[0];
        const toggled = fuelFilterRef.current.map(f => ({ ...f, show: fuels.includes(f.fuel) }))
        setFuelFilter(toggled)

        /* if(toggled.every(f => f.show)){
            selectAllOption.children[1].textContent = "Deselect all fuels"
            selectAllOption.children[0].children[0].style.opacity = "1"
        }else{
            selectAllOption.children[1].textContent = "Select all fuels"
            selectAllOption.children[0].children[0].style.opacity = "0"
        } */
    }

    // Set the year filter to a specific range
    function setYearFilterTo(minYear, maxYear){
        const { minVal, maxVal } = getSliderBounds("year", regionalData)
        setYearFilter([[minYear, maxYear], [minVal, maxVal]])
        const sliders = sidePanelContainer.current?.querySelectorAll(".sidePanelFilterSliderContainer")
        if (sliders && sliders[0] && sliders[0].set) sliders[0].set(minYear, maxYear)
    }

    // Set the generation filter to a specific range
    function setGenerationFilterTo(minGen, maxGen){
        const { minVal, maxVal } = getSliderBounds("generation", regionalData)
        setGenerationFilter([[minGen, maxGen], [minVal, maxVal]])
        const sliders = sidePanelContainer.current?.querySelectorAll(".sidePanelFilterSliderContainer")
        if (sliders && sliders[1] && sliders[1].set) sliders[1].set(minGen, maxGen)
    }

    // Fills the provided region drop down with the corresponding filter contents
    function fillDropDowns(dropDownE, filter, setFilter, filterRef, zoomTo){
        const legendContainer = dropDownE.querySelector(".sidePanelLegendContainer")
        if(legendContainer.children.length == 0){
            for(let i = 0; i < filter.length; i++){
                const item = filter[i] // Used for easier access

                // Create legend element
                const legend = document.createElement("div")
                legend.classList.add("filterLegend")

                // Create colour legend / radio circle
                const colour = document.createElement("div")
                colour.classList.add("legendColour", "sidePanelFilterColour", "legendRadio")
                colour.style.backgroundColor = "rgba(0,0,0,0.0)"

                const radioCircle = document.createElement("img")
                radioCircle.classList.add("selectAllCheck")
                radioCircle.src = assetSources.sidePanelSelectAllCircle

                colour.appendChild(radioCircle)
                legend.onclick = () => handleRegLegClick(item.country, filterRef, setFilter, zoomTo, zoomToRegionFilter); // Select only this region (radio-button logic)

                const name = document.createElement("p")
                name.classList.add("legendName", "sidePanelFilterName")
                name.textContent = item.country_long

                legend.appendChild(colour)
                legend.appendChild(name) // Append the text to the legend element
                legendContainer.appendChild(legend) // Append the legend to the filter container
            }
        }
    }

    // Get new title
    function getNewDropDownTitle(shownElements, type){
        var newTitle = ""
        for(let i = 0; i<shownElements.length; i++){
            if(i==0 && shownElements.length <= 2){
                newTitle += type=="fuel"? shownElements[i].fuel + " " : shownElements[i].country_long + " "
            }else if(i < (shownElements.length-1)){
                newTitle += type=="fuel"? shownElements[i].fuel + ", " : shownElements[i].country_long + ", "
            }else{
                newTitle += type=="fuel"? "and " + shownElements[i].fuel : "and " + shownElements[i].country_long
            }
        }
         if(newTitle.length >= 32){
            var splitTitle = newTitle.split(", ")
            splitTitle[splitTitle.length - 1] = splitTitle.at(-1).slice(3)
            newTitle = ""
            for(let i = 0; i<2; i++){
                newTitle += splitTitle[i] + ", "
            }
            newTitle += " and " + (splitTitle.length - 2) + " more"
        }
        return newTitle
    }

    // Resets all filters (fuelFilter, regionFilter, yearFilter, generationFilter)
    function resetAllFilters(){
        setFuelFilterTo(fuelFilterRef.current.map(f => f.fuel))
        setRegionFilter(prev => prev.map(r => ({ ...r, show: true })))
        setYearFilter([])
        setGenerationFilter([])

        const sidePanel = sidePanelContainer.current
        if (sidePanel && sidePanel.children.length) {
            sidePanel.querySelectorAll(".sidePanelFilterSliderContainer").forEach(slider => {
                if (slider.reset) slider.reset()
            })
        }
    }

    // Used by the two drop down and legends filter update functions, to set corresponding filters
    function checkAndSetFilter(selectAllOption, prevFilter, clickedItem, type){
        var propName = (type=="region") ? "country" : "fuel"
        if(prevFilter.every(i => i.show)){
            if(selectAllOption){
                selectAllOption.children[1].textContent = "Select all " + type + "s"
                selectAllOption.children[0].children[0].style.opacity = "0"
            }
            if(clickedItem == "all"){
                return prevFilter.map(i => ({ ...i, show: false}));
            }
            return prevFilter.map(i => ({ ...i, show: eval("i."+propName) === clickedItem})); // If true, deselect everything but the clicked option
        }

        const toggled = prevFilter.map(i =>
            eval("i."+propName) === clickedItem ? { ...i, show: !i.show } : i // Deselect or select the clicked option
            
        );
        if(clickedItem == "all"){
            if(selectAllOption){
                selectAllOption.children[1].textContent = "Deselect all " + type + "s"
                selectAllOption.children[0].children[0].style.opacity = "1"
            }
            return prevFilter.map(i => ({ ...i, show: true}));
        }

        if (toggled.every(i => !i.show)) { // Are all options hidden?
            if(selectAllOption){
                selectAllOption.children[1].textContent = "Deselect all " + type + "s"
                selectAllOption.children[0].children[0].style.opacity = "1"
            }
            return prevFilter.map(i => ({ ...i, show: true })); // If true, select everything 
        }
        return toggled
    }

    // Used by handleRollupClick
    function toggleDropDown(element){
        const dropdown = element.children[1]
        const rollupIcon = element.children[0].children[1]
        const isHidden = dropdown.classList.contains("hide")
        if (isHidden) {
            gsap.fromTo(dropdown,
                { height: 0, opacity: 0 },
                { height: "28dvh", opacity: 1, duration: 0.4, ease: "power4.out",
                  onComplete: () => gsap.set(dropdown, { clearProps: "height" }) }
            )
            gsap.to(rollupIcon,
                {rotationX: 180, duration: 0.6, ease: "power4.out"}
            )
            //element.parentElement.style['border-radius'] = "1dvh 1dvh 0 0";
            element.parentElement.style['z-index'] = "100"
            dropdown.classList.toggle("hide");
        } else {
            gsap.to(dropdown,
                { height: 0, opacity: 0, duration: 0.2, ease: "power4.in",
                    onComplete: () => {
                        //element.parentElement.style['border-radius'] = "1dvh";
                        element.parentElement.style['z-index'] = "unset"
                        dropdown.classList.toggle("hide");
                    }
                }
            )
            gsap.to(rollupIcon,
                {rotationX: 0, duration: 0.6, ease: "power4.out"}
            )
        }
    }

    return(<>
        <div id={fuelFilterDef.id} ref={filterContainer} style={{
            position: fuelFilterDef.position[0],
            top: fuelFilterDef.position[1],
            right: fuelFilterDef.position[2],
            bottom: fuelFilterDef.position[3],
            left: fuelFilterDef.position[4],
        }} />
        <div id={sidePanelDef.id} ref={sidePanelContainer} style={{
            width: sidePanelDef.width,
            height: sidePanelDef.height,
            position: sidePanelDef.position[0],
            top: sidePanelDef.position[1],
            right: sidePanelDef.position[2],
            bottom: sidePanelDef.position[3],
            left: sidePanelDef.position[4],
        }} />
        <div id="sidePanelToggleContainer" onClick={() => handleSidePanelToggle(sidePanelContainer, sidePanelOpenRef)}>
            <img src={assetSources.sidePanelInfo} id="sidePanelToggleIcon"></img>
        </div>
    </>)
}

export default PrimaryPanels

function getSliderBounds(filter, regionalData){
    let minVal = 0, maxVal = 100
    var largest = Number.NEGATIVE_INFINITY;
    var smallest = Number.POSITIVE_INFINITY;
    if (regionalData.length) {
        const usageKeys = Object.keys(regionalData[0].usage_shares)
        const dataYears = usageKeys.map((s) => parseInt(s.replace(/^\D+/g, "")))
        switch(filter){
            case "year":
                const minYears = regionalData.map(y => y.oldest_power_plant).filter(y => y != null)
                const maxYears = regionalData.map(y => y.newest_power_plant).filter(y => y != null)
                if (minYears.length && maxYears.length) { minVal = Math.floor(Math.min(...minYears) / 10) * 10; maxVal = Math.floor(Math.max(...maxYears)) }
                break;
            case "generated":
                const minGeneration = regionalData.map(y => y.regional_min_output)
                const maxGeneration = regionalData.map(y => y.regional_max_output)

                minGeneration.forEach((c) =>{
                    let values = Object.values(c).filter(g => g != null)
                    let min = 0;
                    if(values.length){
                        min = Math.min(...values)
                        if(min < smallest){ smallest = min }
                    }
                })
                maxGeneration.forEach((c) =>{
                    let values = Object.values(c).filter(g => g != null)
                    let max = 0;
                    if(values.length){
                        max = Math.max(...values)
                        if(max > largest){ largest = max }
                    }
                })

                minVal = Math.floor(smallest)
                maxVal = Math.floor(largest)
                break;
            case "shareYear":
                minVal = Math.min(...dataYears)
                maxVal = Math.max(...dataYears)
                break;
            case "LCShare":
                regionalData.forEach(r => {
                    for(let i = dataYears[0]; i <= dataYears[dataYears.length-1]; i++){
                        let usage = r.usage_shares?.[i]?.LC

                        if (usage != null) {
                            if (usage < smallest) smallest = usage
                            if (usage > largest) largest = usage
                        }
                    }
                })
                minVal = smallest
                maxVal = largest
                break;
            case "FFShare":
                regionalData.forEach(r => {
                    for(let i = dataYears[0]; i <= dataYears[dataYears.length-1]; i++){
                        let usage = r.usage_shares?.[i]?.FF

                        if (usage != null) {
                            if (usage < smallest) smallest = usage
                            if (usage > largest) largest = usage
                        }
                    }
                })
                minVal = smallest
                maxVal = largest
                break;
        }
    }
    return { minVal, maxVal }
}

function createPages(pageContent, powerPlants, regionalData, continentData, regionFilterData, regionFilterRef, fuels,
                                  setFuelFilter, setRegionFilter, setBarChartFilter, years, usageYears,
                                  onYearChange, onGenerationChange, onShareYearChange, onLCChange, onFFChange,
                                  onReset, onIndexClick, onToggleClick, onLegendClick, onContinentClick, onAddDiagramClick){
    const pageContainer = document.createElement("div")
    pageContainer.classList.add('sidePanelPageContainer')

    // NEW STRUCTURE:
    // - Navigation bar *Shown on all pages
    // - Main title (Info Title) *Shown on home page (and info page) 
    // - Subtitle *Only shown on home page
    // - sidePanelFilterAndResetWrapper (filter counter) *Shown on all pages except info page
    // - Year Filter *Shown on all pages except info page
    // - Generation Filter *Shown on all pages except info page
    // - Diagram (With region and fuel filters integrated) *Shown on all pages except info page
    // - Option to add additional diagrams *Shown on all pages except info page
    // - Information text *Shown on all pages except home page

    // Navigation bar
    const navigationContainer = document.createElement("div")
    navigationContainer.id = "navigationBarContainer"

    // Smaller main title
    const mainTitleSmall = document.createElement("span")
    mainTitleSmall.id = "sidePanelMainTitleSmall"
    mainTitleSmall.textContent = "Energy Map"

    navigationContainer.appendChild(mainTitleSmall)

    const navigationElements = document.createElement("div")
    navigationElements.style.display = "flex"

    for(let i = 0; i<7;i++){
        const wrapper = document.createElement("div")
        wrapper.classList.add("navigationBarIconWrapper")

        const icon = document.createElement("img")
        if(i==0){
            icon.src = assetSources.sidePanelHome
            icon.classList.add("navigationBarIconLarge")
            wrapper.classList.add("navigationBarIconWrapperLarge")
            wrapper.appendChild(icon)
        }else if(i==1){
            icon.src = assetSources.sidePanelInfo
            icon.classList.add("navigationBarIconLarge")
            wrapper.classList.add("navigationBarIconWrapperLarge")
            wrapper.appendChild(icon)
        }else{
            icon.src = assetSources.sidePanelInstructions
            icon.classList.add("navigationBarIconSmall")
            wrapper.classList.add("navigationBarIconWrapperSmall")

            const number = document.createElement("span")
            number.classList.add("navigationBarIconNumber")
            number.textContent = (i-1)
            wrapper.appendChild(icon)
            wrapper.appendChild(number)
        }
        icon.id = "navigationID" + i
        navigationElements.appendChild(wrapper)
        navigationContainer.appendChild(navigationElements)
    }

    pageContainer.appendChild(navigationContainer)
    
    // Main title and subtitle
    const sidePanelMainTitle = document.createElement("h1")
    const sidePanelSubtitle = document.createElement("h2")
    sidePanelMainTitle.id = "sidePanelMainTitle"
    sidePanelSubtitle.id = "sidePanelSubtitle"
    sidePanelMainTitle.textContent = "Energy Map"
    sidePanelSubtitle.textContent = "Mapping the Pulse of Power"

    pageContainer.appendChild(sidePanelMainTitle)
    pageContainer.appendChild(sidePanelSubtitle)

    // Info title
    const infoTitle = document.createElement("h1")
    infoTitle.id = "InfoTitle"
    infoTitle.textContent = "Info"
    pageContainer.appendChild(infoTitle)

    // Wrapper for filter and reset button
    const filterAndResetWrapper = document.createElement("div")
    filterAndResetWrapper.id = "sidePanelFilterAndResetWrapper"

    // Filter counter
    const filterCounter = document.createElement("span")
    const filterCounterValue = document.createElement("span")
    const filterCounterStatic = document.createElement("span")

    filterCounter.id = "filterCounter"
    filterCounterValue.id = "filterCounterValue"
    filterCounterStatic.id = "filterCounterStatic"

    var count = powerPlants? powerPlants.features.length : "1000"
    filterCounterValue.textContent = count // Update based on number of power plants in the data
    filterCounterStatic.textContent = "/"+ count + " power plants selected"// Update based on number of power plants in the data

    filterCounter.appendChild(filterCounterValue)
    filterCounter.appendChild(filterCounterStatic)
    filterAndResetWrapper.appendChild(filterCounter)

    // Close pop-ups button
    const closeButtonField = document.createElement("div")
    const closeButtonText = document.createElement("span")

    closeButtonField.classList.add("sidePanelResetButton")
    closeButtonText.textContent = "Close Pop-Ups"
    closeButtonField.onclick = () => onReset(closeButtonField, "close")

    closeButtonField.appendChild(closeButtonText)
    filterAndResetWrapper.appendChild(closeButtonField)

    // Reset button
    const resetButtonField = document.createElement("div")
    const resetButtonText = document.createElement("span")

    resetButtonField.classList.add("sidePanelResetButton")
    resetButtonText.textContent = "Reset Filters"
    resetButtonField.onclick = () => onReset(resetButtonField, "reset")

    resetButtonField.appendChild(resetButtonText)
    filterAndResetWrapper.appendChild(resetButtonField)
    pageContainer.appendChild(filterAndResetWrapper)

    const multiYearFilterContainer = document.createElement("div");
    const multiValueFilterContainer = document.createElement("div");
    // Filter drop downs and sliders
    for(var i = 0; i < 5; i++){
        let filterContainer = document.createElement("div")
        filterContainer.classList.add('sidePanelFilterContainer')
        switch (i) {
            //case 0: filterContainer.appendChild(getDropDown("region", onIndexClick)); break;
            //case 1: filterContainer.appendChild(getDropDown("fuel", onIndexClick)); break;
            case 0: 
                filterContainer.appendChild(getSliders("year", regionalData, onYearChange));
                multiYearFilterContainer.appendChild(filterContainer)
                break;
            case 1: 
                filterContainer.appendChild(getSliders("generated", regionalData, onGenerationChange));
                multiValueFilterContainer.appendChild(filterContainer)
                break;
            case 2:
                // shareYear
                filterContainer.appendChild(getSliders("shareYear", regionalData, onShareYearChange));
                filterContainer.classList.toggle("hide")
                filterContainer.id = "shareYearFilterContainer"
                multiYearFilterContainer.appendChild(filterContainer)
                break;
            case 3:
                // LCShare
                filterContainer.appendChild(getSliders("LCShare", regionalData, onLCChange));
                filterContainer.classList.toggle("hide")
                multiValueFilterContainer.appendChild(filterContainer)
                break;
            case 4:
                // FFShare
                filterContainer.appendChild(getSliders("FFShare", regionalData, onFFChange));
                filterContainer.classList.toggle("hide")
                multiValueFilterContainer.appendChild(filterContainer)
                break;
        }
    }

    pageContainer.appendChild(multiYearFilterContainer)
    pageContainer.appendChild(multiValueFilterContainer)

    // Diagram wrapper (for the initial one + additional ones)
    const allDiagramContainer = document.createElement("div");
    allDiagramContainer.id = "allDiagramContainer"

    // Generation by fuel line plot (built by sidePanelUtilities.createDiagram)
    const linePlotContainer = createDiagram({
        assetSources, fuels, regionalData, continentData, regionFilter: regionFilterData, regionFilterRef,setRegionFilter, setFuelFilter, setBarChartFilter,
        onIndexClick, onContinentClick, onToggleClick, onLegendClick,
        years, usageYears
    })

    // Additional diagram prompt
    const additionalDiagramPromptContainer = document.createElement("div");
    additionalDiagramPromptContainer.id = "additionalDiagramPromptContainer"
    const promptText = document.createElement("span");
    promptText.id = "diagramPromptText"
    promptText.textContent = "+ add one diagram for comparison";

    const additionalDiagramIcon = document.createElement("img");
    additionalDiagramIcon.src = assetSources.sidePanelRollupOpen

    additionalDiagramPromptContainer.appendChild(promptText)
    additionalDiagramPromptContainer.appendChild(additionalDiagramIcon)

    additionalDiagramPromptContainer.onclick = () => onAddDiagramClick()
    allDiagramContainer.appendChild(linePlotContainer)
    allDiagramContainer.appendChild(additionalDiagramPromptContainer)
    pageContainer.appendChild(allDiagramContainer)

    // Instruction containers / Info text
    for(var i = 0; i<pageContent.length; i++){
        let page = getInstructions(pageContent, i)
        pageContainer.appendChild(page)
    }

    return pageContainer
}

// Creates the range based filters found in the side panel
function getSliders(filter, regionalData, onChange){
    const singleThumb = filter === "shareYear"

    const sliderContainer = document.createElement("div")
    sliderContainer.classList.add("sidePanelFilterSliderContainer")

    const track = document.createElement("div")
    track.classList.add("sliderTrack")

    const range = document.createElement("div")
    range.classList.add("sliderRange")

    const thumbMin = document.createElement("div")
    thumbMin.classList.add("sliderThumb", "sliderThumbLeft")

    const thumbMinText = document.createElement("h2")
    thumbMinText.classList.add("sliderValueText")

    const thumbMax = document.createElement("div")
    thumbMax.classList.add("sliderThumb", "sliderThumbRight")

    const thumbMaxText = document.createElement("h2")
    thumbMaxText.classList.add("sliderValueText")

    sliderContainer.appendChild(track)
    sliderContainer.appendChild(range)
    thumbMin.appendChild(thumbMinText)
    thumbMax.appendChild(thumbMaxText)
    sliderContainer.appendChild(thumbMin)
    if(!singleThumb){
        sliderContainer.appendChild(thumbMax)
    }
    

    const textField = document.createElement("div")
    textField.classList.add("sliderTextField")

    const textMin = document.createElement("span")
    const textSliderTitle = document.createElement("strong")
    const textMax = document.createElement("span")

    textMin.classList.add("sliderEdgeText")
    textSliderTitle.classList.add("sliderTitle")
    textMax.classList.add("sliderEdgeText")

    textMin.style.transform = "translateX(-50%)";
    textMax.style.transform = "translateX(50%)";

    textField.appendChild(textMin)
    switch(filter){
        case "year":
        case "shareYear":
            const decadeBounds = (filter == "year")? getSliderBounds("year", regionalData) : getSliderBounds("shareYear", regionalData)
            const span = decadeBounds.maxVal - decadeBounds.minVal
            const nDecades = Math.floor(span/10)
            for(let i = 1; i<nDecades; i++){
                const value = decadeBounds.minVal + (i*10)
                const percentage = ((value - decadeBounds.minVal) / span) * 100
                const textDecade = document.createElement("span")
                textDecade.classList.add("sliderEdgeText")
                textDecade.style.position = "absolute"
                textDecade.style.left = percentage + "%"
                textDecade.style.top = "0"
                textDecade.style.transform = "translateX(-50%)"
                textDecade.textContent = value
                textField.appendChild(textDecade)
            }
            break;
        case "generated":
        case "LCShare":
        case "FFShare":
            // Wrapper for text and info icon
            const titleAndIconWrapper = document.createElement("span")
            titleAndIconWrapper.className = "sliderTitleWrapper"

            // The text displayed below the slider
            switch(filter){
                case "generated":
                    textSliderTitle.textContent = "Annual Generation (GWh)"
                    break;
                case "LCShare":
                case "FFShare":
                    textSliderTitle.textContent = (filter == "LCShare")? "Share of Low Carbon Usage" : "Share of Fossil Fuel Usage"
                    break;
            }

            titleAndIconWrapper.appendChild(textSliderTitle)

            if(filter == "generated"){
                // The icon displayed next to the text
                const sliderIcon = document.createElement("img")
                sliderIcon.className = "sliderIcon"
                sliderIcon.src = assetSources.infoIcon

                // Tool tip when icon is hovered
                const generationToolTip = document.createElement("div")
                generationToolTip.className = "sliderTooltipTooltip"
                const generationToolTipText = document.createElement("span")
                generationToolTipText.className = "sliderTooltipTooltipText"
                generationToolTipText.textContent  = "Annual generation in gigawatt hours (GWhs)"

                generationToolTip.appendChild(generationToolTipText)

                sliderIcon.onmouseover = () => generationToolTipText.style.visibility = "visible"
                sliderIcon.onmouseout = () => generationToolTipText.style.visibility = "hidden"

                titleAndIconWrapper.appendChild(sliderIcon)
                titleAndIconWrapper.appendChild(generationToolTip)
            }
        
            textField.appendChild(titleAndIconWrapper)
            break;
    }

    textField.appendChild(textMax)

    sliderContainer.appendChild(textField)

    if(filter=="year" || filter =="shareYear"){
        const playbackField = document.createElement("div");
        playbackField.id = "sliderPlaybackField";

        const playbackSliderTitle = document.createElement("strong")
        playbackSliderTitle.classList.add("sliderTitle")
        playbackSliderTitle.textContent = (filter == "year")? "Year Started" : "Year of data"

        const playbackSliderButton = document.createElement("div");
        playbackSliderButton.id = "sliderPlaybackButton"

        const playbackSliderButtonText = document.createElement("span");
        playbackSliderButtonText.textContent = "Animated historical playback";
        playbackSliderButton.appendChild(playbackSliderButtonText)


        playbackField.appendChild(playbackSliderTitle)
        playbackField.appendChild(playbackSliderButton)
        sliderContainer.appendChild(playbackField)
    }

    const minMax = getSliderBounds(filter, regionalData)
    const minVal = minMax.minVal
    const maxVal = minMax.maxVal
    let valueMin = minMax.minVal
    let valueMax = minMax.maxVal

    if(filter != "LCShare" && filter != "FFShare"){
        if(minVal == 0){
            textMin.textContent = "0 / no data"
        }else{
            textMin.textContent = (minVal<10000)? minVal : ((minVal / 100) / 10.0).toFixed(0) + " k"
        }
        textMax.textContent = (maxVal<10000)? maxVal : ((maxVal / 100) / 10.0).toFixed(0) + " k"
    }else{
        textMin.textContent = minVal.toFixed(0) + "%"
        textMax.textContent = maxVal.toFixed(0) + "%"
    }

    const updateSlider = () => {
        const span = maxVal - minVal
        const percentageMin = ((valueMin - minVal) / span) * 100
        const percentageMax = ((valueMax - minVal) / span) * 100
        if(singleThumb){
            thumbMin.style.left = percentageMax + "%"
            thumbMinText.textContent = (valueMax<10000)? valueMax : ((valueMax / 100) / 10.0).toFixed(0) + " k"
            range.style.left = "0%"
            range.style.width = percentageMax + "%"
        }else{
            thumbMin.style.left = percentageMin + "%"
            if(filter != "LCShare" && filter != "FFShare"){
                thumbMinText.textContent = (valueMin<10000)? valueMin : ((valueMin / 100) / 10.0).toFixed(0) + " k"
                thumbMaxText.textContent = (valueMax<10000)? valueMax : ((valueMax / 100) / 10.0).toFixed(0) + " k"
            }else{
                thumbMinText.textContent = valueMin.toFixed(0) + "%"
                thumbMaxText.textContent = valueMax.toFixed(0) + "%"
            }
            thumbMax.style.left = percentageMax + "%"
            range.style.left = percentageMin + "%"
            range.style.width = (percentageMax - percentageMin) + "%"
        }
    }

    function addRemoveListeners(e,type="", onMove, onEnd, onStart){
        if(type=="add" && onMove && onEnd){
            document.addEventListener("mousemove", onMove)
            document.addEventListener("mouseup", onEnd)
            document.addEventListener("touchmove", onMove, { passive: false })
            document.addEventListener("touchend", onEnd)
        }
        if(type=="remove" && onMove && onEnd){
            e.removeEventListener("mousemove", onMove)
            e.removeEventListener("mouseup", onEnd)
            e.removeEventListener("touchmove", onMove)
            e.removeEventListener("touchend", onEnd)
        }
        if(onStart){
            e.addEventListener("mousedown", onStart)
            e.addEventListener("touchstart", onStart, { passive: false })
        }
    }

    function makeDraggable(thumb, isMin) {
        const getClientX = (e) => e.touches ? e.touches[0].clientX : e.clientX

        const onStart = (e) => {
            e.preventDefault()
            const trackRect = track.getBoundingClientRect()
            const trackWidth = trackRect.width

            const onMove = (ev) => {
                const px = getClientX(ev) - trackRect.left
                const percentage = Math.max(0, Math.min(100, (px / trackWidth) * 100))
                const value = Math.round(minVal + (percentage / 100) * (maxVal - minVal))
                if (isMin) { valueMin = Math.min(value, valueMax - 1) }
                else { valueMax = Math.max(value, valueMin + 1) }
                updateSlider()
            }

            const onEnd = () => {
                addRemoveListeners(document,"remove", onMove, onEnd)
                if (onChange && !singleThumb) onChange([valueMin, valueMax], [minVal, maxVal])
                if (onChange && singleThumb) onChange(valueMax, [minVal, maxVal])
            }
            addRemoveListeners(document, "add", onMove, onEnd)
        }
        addRemoveListeners(thumb,"start",null,null, onStart)
    }

    function makeDraggableSingle(thumb) {
        const getClientX = (e) => e.touches ? e.touches[0].clientX : e.clientX

        const onStart = (e) => {
            e.preventDefault()
            const trackRect = track.getBoundingClientRect()
            const trackWidth = trackRect.width

            const onMove = (ev) => {
                const px = getClientX(ev) - trackRect.left
                const percentage = Math.max(0, Math.min(100, (px / trackWidth) * 100))
                valueMax = Math.round(minVal + (percentage / 100) * (maxVal - minVal))
                updateSlider()
            }

            const onEnd = () => {
                addRemoveListeners(document,"remove", onMove, onEnd)
                if (onChange) onChange(valueMax, [minVal, maxVal])
            }
            addRemoveListeners(document, "add", onMove, onEnd)
        }
        addRemoveListeners(thumb,"start",null,null, onStart)
    }

    function makeDraggableRange(rangeElement) {
        const getClientX = (e) => e.touches ? e.touches[0].clientX : e.clientX

        const onStart = (e) => {
            e.preventDefault()
            const trackRect = track.getBoundingClientRect()
            const trackWidth = trackRect.width
            const startX = getClientX(e)
            const rangeSize = valueMax - valueMin
            const startMin = valueMin

            const onMove = (ev) => {
                const deltaX = getClientX(ev) - startX
                const deltaValue = (deltaX / trackWidth) * (maxVal - minVal)
                let newMin = startMin + deltaValue
                let newMax = newMin + rangeSize

                if (newMin < minVal) {
                    newMin = minVal
                    newMax = minVal + rangeSize
                }
                if (newMax > maxVal) {
                    newMax = maxVal
                    newMin = maxVal - rangeSize
                }

                valueMin = Math.round(newMin)
                valueMax = Math.round(newMax)
                updateSlider()
            }

            const onEnd = () => {
                addRemoveListeners(document, "remove", onMove, onEnd)
                if (onChange && !singleThumb) onChange([valueMin, valueMax], [minVal, maxVal])
                if (onChange && singleThumb) onChange(valueMax, [minVal, maxVal])
            }
            addRemoveListeners(document, "add", onMove, onEnd)
        }
        addRemoveListeners(rangeElement, "start", null, null, onStart)
    }

    if(singleThumb){
        makeDraggableSingle(thumbMin)
    }else{
        makeDraggable(thumbMin, true)
        makeDraggable(thumbMax, false)
        makeDraggableRange(range)
    }
    updateSlider()
    if (onChange && !singleThumb) onChange([valueMin, valueMax], [minVal, maxVal])
    if (onChange && singleThumb) onChange(valueMax, [minVal, maxVal])
    sliderContainer.reset = () => {
        valueMin = minVal
        valueMax = maxVal
        updateSlider()
        if (onChange && !singleThumb) onChange([valueMin, valueMax], [minVal, maxVal])
        if (onChange && singleThumb) onChange(valueMax, [minVal, maxVal])
    }

    sliderContainer.set = (min, max) => {
        valueMin = Math.max(minVal, Math.min(min, maxVal))
        valueMax = Math.max(minVal, Math.min(max, maxVal))
        updateSlider()
        if (onChange && !singleThumb) onChange([valueMin, valueMax], [minVal, maxVal])
        if (onChange && singleThumb) onChange(valueMax, [minVal, maxVal])
    }

    sliderContainer.sync = (min, max) => {
        valueMin = Math.max(minVal, Math.min(min, maxVal))
        valueMax = Math.max(minVal, Math.min(max, maxVal))
        updateSlider()
    }

    return sliderContainer
}

function getInstructions(pageContent, id){
    const container = document.createElement("div")
    container.classList.add('sidePanelInstructionsContainer')

    const makeTitle = (text) => {
        const element = document.createElement("strong")
        element.classList.add("instructionStepsItemTitle")
        element.textContent = text
        return element
    }

    const makeStandard = (text) => {
        const element = document.createElement("span")
        element.classList.add("instructionStepsItemStandard")
        element.textContent = text
        return element
    }

    const makeHighlight = (text) => {
        const element = document.createElement("strong")
        element.classList.add("instructionStepsItemHighlight")
        element.textContent = text
        return element
    }

    pageContent.forEach(content =>{
        if(id == content.id){
            if(content.titles){
                content.titles.forEach((t,i) =>{
                    const title = document.createElement("h2")
                    title.classList.add("instructionsTitle")
                    title.textContent = t
                    if(t != "Research paper" && t !="Source of Information"){container.appendChild(title)}
                    if(content.bodies && content.bodies[i]){
                        content.bodies[i].forEach(p =>{
                            let qrImage = document.createElement("img")
                            qrImage.classList.add("instructionsQRImage")

                            let imgLinkWrapper = document.createElement("div");
                            imgLinkWrapper.classList.add("instructionsImgLinkWrapper")

                            let paragraph = document.createElement("p")
                            paragraph.classList.add('instructionsIntro')
                            paragraph.textContent = p

                            let titleAndParagraphWrapper = document.createElement("div");
                            titleAndParagraphWrapper.classList.add("instructionsTitleAndParagraphWrapper")

                            if(t == "Research paper"){ // Special case
                                titleAndParagraphWrapper.appendChild(title)
                                titleAndParagraphWrapper.appendChild(paragraph)
                                qrImage.src = assetSources.jinyiPaperQR
                                qrImage.style.marginRight = "0.5dvw"
                                titleAndParagraphWrapper.style.textAlign = "start"
                                imgLinkWrapper.style.justifyContent = "flex-start"
                                imgLinkWrapper.appendChild(qrImage)
                                imgLinkWrapper.appendChild(titleAndParagraphWrapper)
                            }
                            if(t == "Source of Information"){ // Special case
                                titleAndParagraphWrapper.appendChild(title)
                                titleAndParagraphWrapper.appendChild(paragraph)
                                qrImage.src = assetSources.energyDataQR
                                qrImage.style.marginLeft = "0.5dvw"
                                titleAndParagraphWrapper.style.textAlign = "end"
                                imgLinkWrapper.style.justifyContent = "flex-end"
                                imgLinkWrapper.appendChild(titleAndParagraphWrapper)
                                imgLinkWrapper.appendChild(qrImage)
                            }

                            if(t != "Research paper" && t !="Source of Information"){
                                container.appendChild(paragraph)
                            }else{
                                container.appendChild(imgLinkWrapper)
                            }
                        })
                    }
                    if(content.lists && content.lists[i]){
                        if(content.lists[i].length){
                            const stepsList = document.createElement("ul")
                            stepsList.classList.add('instructionStepsList')
                            // In the case that it is the info page list
                            if(content.id == 0){
                                stepsList.classList.add('infoStepsList')
                            }
                            content.lists[i].forEach((item, itemIndex) =>{
                                let collector = document.createElement("li")
                                let textWrapper = document.createElement("div")
                                if(content.id == 0){
                                    const iconWrapper = document.createElement("span")
                                    iconWrapper.classList.add("infoStepIconWrapper")
                                    const icon = document.createElement("img")
                                    icon.src = assetSources.sidePanelInstructions
                                    icon.style.filter = "brightness(0) saturate(100%) invert(85%) sepia(31%) saturate(240%) hue-rotate(149deg) brightness(93%) contrast(85%)"
                                    icon.classList.add("infoStepIcon")
                                    const number = document.createElement("span")
                                    number.classList.add("infoStepNumber")
                                    number.textContent = itemIndex + 1
                                    iconWrapper.appendChild(icon)
                                    iconWrapper.appendChild(number)
                                    collector.classList.add("infoStepItem")
                                    collector.appendChild(iconWrapper)
                                }
                                item.forEach(s =>{
                                    if(content.id == 0){
                                        textWrapper.appendChild(eval('make'+s[0]+'("'+s[1]+'")'))
                                        collector.appendChild(textWrapper)
                                    }else{
                                        collector.appendChild(eval('make'+s[0]+'("'+s[1]+'")'))
                                    }
                                })
                                stepsList.appendChild(collector)
                            })
                            container.append(stepsList)
                        }
                    }
                })
            }

        }
    })
    return container
}
