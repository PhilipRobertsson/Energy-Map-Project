import { useState, useEffect, useRef, useContext, createElement } from 'react'
import { gsap } from "gsap";
import * as d3 from "d3";

import { MapContext } from './Map.jsx'

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
    sidePanelHome: "./sidePanel/sidePanelHomeIcon.svg",
    sidePanelInstructions: "./sidePanel/sidePanelInstructionsIcon.svg",
    sidePanelInfo: "./sidePanel/sidePanelInfoIcon.svg",
    sidePanelRollupOpen: "./sidePanel/sidePanelRollupOpen.svg",
    sidePanelRollupClose: "./sidePanel/sidePanelRollupClose.svg",
    sidePanelCheckMark: "./sidePanel/sidePanelCheckMark.svg",
    sidePanelSelectAllCircle: "./sidePanel/sidePanelSelectAllCircle.svg",
    infoIcon: "./popup/popupInfo.svg",
    jinyiPaperQR: "./qrCodes/jinyiPaper.png",
    energyDataQR: "./qrCodes/energyData.png"
};

// Used to filter out fuels which either are too uncommon or unimportant for the visualization
const otherFuels =[
    "Petcoke", "Wave and Tidal", "Tidal",
    "Geothermal", "Cogeneration", "Storage",
    "Biomass", "Waste", "Other"
];

// The different pages on the instruction page
const allPages = [
    {id: 0, visibleHtmlElements: [true, true, false, true, true, true, true, true, false, false, false,false,false, true]}, /*Home page*/
    {id: 1, visibleHtmlElements: [false, false, true, false, false, false, false, false, true, false, false,false,false, true]}, /*Info page*/
    {id: 2, visibleHtmlElements: [false, false, false, true, true, true, true, true, false, true, false,false,false, true]}, /*Instructions page 1*/
    {id: 3, visibleHtmlElements: [false, false, false, true, true, true, true, true, false, false, true,false,false, true]}, /*Instructions page 2*/
    {id: 4, visibleHtmlElements: [false, false, false, true, true, true, true, true, false, false, false,true,false, true]}, /*Instructions page 3*/
    {id: 5, visibleHtmlElements: [false, false, false, true, true, true, true,true, false, false, false,false,true, true]}, /*Instructions page 4*/
];

// static JSON to fetch and states to set
const fetchJSON = ["fuelCatagories", "regionalInformation", "regionalFilter", "instructions"]
const statesToSet = ["FuelFilter", "RegionalData", "RegionFilter", "PageContent"]

const _firstYearOfGenerationData = 2013;
const _latestYearOfGenerationData = 2019;
const _firstYearOfEstimatedGenerationData = 2013;
const _latestYearOfEstimatedGenerationData = 2017;

function PrimaryPanels() {
    const { mapRef, powerPlants, barChartFilter, setBarChartFilter, popupCount, timeRef, resetTimer } = useContext(MapContext);
    const filterContainer = useRef(null);
    const sidePanelContainer = useRef(null)
    const [fuelFilter, setFuelFilter] = useState([]);
    const [regionFilter, setRegionFilter] = useState([]);
    const [yearFilter, setYearFilter] = useState([]);
    const [generationFilter, setGenerationFilter] = useState([]);
    const [regionalData, setRegionalData] = useState([]);
    const [sidePanelPage, setSidePanelPage] = useState(allPages[0]);
    const [pages, setPages] = useState(null);
    const [pageContent, setPageContent] = useState(null);
    const zoomSelectionState = useRef({ isSelection: true });
    const prevBarChartFilter = useRef([]);
    const prevPageRef = useRef(null);
    const regionFilterRef = useRef([]);
    const fuelFilterRef = useRef([]);
    const sidePanelOpenRef = useRef(true);
    const [screenSize, setScreenSize] = useState({
        width: window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth,
        height: window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight,
    });

    // Keep refs in sync with filter states
    useEffect(() => {
        regionFilterRef.current = regionFilter
        fuelFilterRef.current = fuelFilter
    }, [regionFilter, fuelFilter]);

    // Fetch JSON files and set relevant States
    useEffect(() => {
        for(var i = 0; i < fetchJSON.length; i++){
            let state = statesToSet[i]
            fetch("./" + fetchJSON[i] + ".json")
                .then((response) => response.json())
                .then((data) =>{
                    eval("set"+state+"(data)");
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
    }, [sidePanelPage,pages, fuelFilter, regionFilter, regionalData, powerPlants, pageContent])

    // Check the timer, if it reaches zero, reset everything
    useEffect(() =>{
        if(timeRef <= 0){
            resetAllFilters()
            mapRef.current?.flyTo({
                center: [9.902056, 49.843],
                zoom: 3.2,
                speed: 0.8,
                curve: 1.4
            });
            handleNavigationClick(0, document.getElementById("navigationID0"))
        }
    }, [timeRef])

    // Check if screen size changes, redraw plots
    useEffect(() => {
        const redrawPlots = (width, height) => {
            const linePlotSVG = document.getElementById("linePlotSVG")
            const barChartSVG = document.getElementById("barChartSVG")
            if (!linePlotSVG && !barChartSVG) return

            const sidePanelWidth = Math.floor(width * 0.25)
            const sidePanelLeftMargin = Math.floor(width * 0.01)
            const sidePanelPadding = Math.floor(2 * width * 0.01)
            const plotWidth = Math.floor((sidePanelWidth - sidePanelLeftMargin - sidePanelPadding) * 0.65)
            const plotHeight = Math.floor((height * 0.35) * 0.72)

            const dataVisualization = (linePlotSVG || barChartSVG).parentElement
            const linePlotHidden = linePlotSVG ? linePlotSVG.classList.contains("hide") : true
            const barChartHidden = barChartSVG ? barChartSVG.classList.contains("hide") : true

            linePlotSVG?.remove()
            barChartSVG?.remove()

            const fuels = fuelFilterRef.current
            if (fuels.length) {
                drawLinePlot(dataVisualization, plotWidth, plotHeight, fuels, !linePlotHidden)
                drawBarChart(dataVisualization, plotWidth, plotHeight, fuels, !barChartHidden)
            }
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
        zoomIn.onclick =() => handleZoomIn(zoomIn)
        // Zoom out button
        var zoomOut = document.createElement("img")
        zoomOut.className = "controlIcon"
        zoomOut.src = assetSources.zoomOut
        zoomOut.onclick = () => handleZoomOut(zoomOut)
        // Zoom selection
        var zoomSelection = document.createElement("img")
        zoomSelection.classList.add("controlIcon", "selection")
        zoomSelection.src = assetSources.zoomSelection
        zoomSelection.onclick = () =>  handleZoomSelection(zoomSelection)

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

        if(filter.children.length > 0){
            filter.replaceChild(controlContainer, filter.children[filter.children.length - 1])
        }

        if (filter.children.length > 0) return;
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

            // Create text for legend element
            const label = document.createElement("p")
            label.classList.add("legendName")
            label.textContent = fuel.fuel

            legend.onclick = () => handleFueLegClick(fuel.fuel); // Filters the data points on the map according to fuelFilter state
            legend.style.opacity = fuel.show ? "1" : "0.3"
            legend.appendChild(colour) // Append the colour box to the legend element
            legend.appendChild(label) // Append the text to the legend element
            filter.appendChild(legend) // Append the legend to the filter container
        }

        filter.appendChild(controlContainer) // Append control panel to filter panel
    }, [fuelFilter, powerPlants, regionFilter, yearFilter, generationFilter]);

    // Update zoom selection icon when filters change
    useEffect(() => {
        const filter = filterContainer.current
        if (!filter || !fuelFilter.length || !powerPlants) return
        const zoomSelection = filter.querySelectorAll(".controlIcon")[2]
        if (!zoomSelection) return
        const pps = getShownPowerPlants(powerPlants, regionFilter, fuelFilter, yearFilter, generationFilter)
        if (powerPlants.features.length != pps.length) {
            // Filtered → show "full screen" icon
            if (zoomSelection.classList.contains("selection")) {
                zoomSelection.classList.remove("selection")
                zoomSelection.src = assetSources.zoomFullScreen
                zoomSelectionState.current.isSelection = false
            }
        } else {
            // All shown → show "zoom selection" icon
            if (!zoomSelection.classList.contains("selection")) {
                zoomSelection.classList.add("selection")
                zoomSelection.src = assetSources.zoomSelection
                zoomSelectionState.current.isSelection = true
            }
        }
    }, [fuelFilter, regionFilter, yearFilter, generationFilter, powerPlants])

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

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            const sidePanel = sidePanelContainer.current
            if (!sidePanel || !sidePanel.children.length) return
            const pageContainer = sidePanel.children[0]
            const dropdowns = [
                pageContainer.children[3]?.children[0]
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
        const regLegSidePanel = sidePanel.children[0].children[3].querySelectorAll(".filterLegend");
        const bars = document.querySelectorAll(".barchartContainer");

        const regionFilterDropDownTitle = sidePanel.children[0].querySelectorAll(".sidePanelFilterTitle")[0]
        //const fuelFilterDropDownTitle = sidePanel.children[0].querySelectorAll(".sidePanelFilterTitle")[1]

        const shownRegions = regionFilter.filter((region) => region.show)
        const shownFuels = fuelFilter.filter((fuel) => fuel.show)

        const handleDropDownTitle = (titleE, sidePanelE, type, shown)=>{
            if(shown.length == (sidePanelE.length - 1)){
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
            if(regLegSidePanel[i+1]){
                regLegSidePanel[i+1].style.opacity = region.show ? "1" : "0.3";
                regLegSidePanel[i+1].children[0].children[0].style.opacity = region.show ? "1" : "0.0";
            }
        })

        // Update the line plot fuel filter entries and select all option
        const linePlotFuelContainer = sidePanel.querySelector("#fuelFilterContainer")
        if (linePlotFuelContainer) {
            const linePlotEntries = linePlotFuelContainer.querySelectorAll(".fuelFilterEntry")
            fuelFilter.forEach((fuel, i) => {
                const entry = linePlotEntries[i+1] // +1 to skip the select all entry
                if (entry) {
                    entry.style.opacity = fuel.show ? "1" : "0.3";
                    const checkMark = entry.querySelector(".fuelFilterCheckMark")
                    if (checkMark) checkMark.style.opacity = fuel.show ? "1" : "0";
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
    }, [fuelFilter,regionFilter,popupCount]);

    // Update map layer filter
    useEffect(() => {
        const toFilter = mapRef.current;
        if (!toFilter || !toFilter.getLayer("powerplants-layer") || !fuelFilter.length || !regionFilter.length) return;
        const shownFuels = fuelFilter.filter(f => f.show).map(f => f.fuel);
        const shownRegions = regionFilter.filter(r => r.show).map(r => r.country);

        const filters = ["all"];

        if (shownFuels.length < fuelFilter.length) {
            const matchFuels = shownFuels.flatMap(f => f === "Other" ? [...otherFuels] : [f]);
            filters.push(["in", ["get", "primary_fuel"], ["literal", matchFuels]]);
        }
        if (shownRegions.length < regionFilter.length) {
            filters.push(["in", ["get", "country"], ["literal", [...shownRegions]]]);
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
    }, [fuelFilter, regionFilter, yearFilter, generationFilter, mapRef]);

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
                    {color: "#030303", fontSize: "1.4vmin"},
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

        if(!pages || (!pages.dataset.powerPlantsSynced && powerPlants)){ // If the pages haven't been created yet, or data just loaded
            if (pages){sidePanel.replaceChildren()}
            const newPages = createPages(pageContent, powerPlants, regionalData, fuelFilter,
                (values, bounds) => setYearFilter([values, bounds]),
                (values, bounds) => setGenerationFilter([values, bounds]),
                handleResetClick,
                handleIndexClick,
                handleLinePlotToggle,
                handleFueLegClick
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
                switch(sidePanelPage.id){
                    case 2: // First instructions page
                        setRegionFilterTo(["SWE", "NOR"])
                        setFuelFilterTo(fuelFilterRef.current.map(f => f.fuel))
                        setGenerationFilterTo(0, 38000)
                        break;
                    case 3: // Second instructions page
                        setRegionFilterTo(["SWE"])
                        setFuelFilterTo(fuelFilterRef.current.map(f => f.fuel))
                        setGenerationFilterTo(0, 38000)
                        break;
                    case 4: // Third instruction page
                        setRegionFilterTo(["SWE"])
                        setFuelFilterTo(fuelFilterRef.current.map(f => f.fuel))
                        setGenerationFilterTo(0, 38000)
                        break;
                    case 5: // Fourth instructions page
                        setRegionFilterTo(["SWE", "DNK"])
                        setFuelFilterTo(["Hydro", "Wind"])
                        setGenerationFilterTo(0, 38000)
                        break;
                    default:
                        if(sidePanel.children.length){ // Is needed to ensure the select all options exists
                            resetAllFilters()
                            mapRef.current?.flyTo({
                                center: [35.902056, 49.843],
                                zoom: 3.2,
                                speed: 0.8,
                                curve: 1.4
                            });
                        }
                }
            }

            // Add eventlisteners to rollups
            const sidePanelRegionFilter = pages.children[3].children[0]
            //const sidePanelFuelFilter = pages.children[4].children[0]

            const sidePanelRegionHeader = sidePanelRegionFilter.children[0]
            //const sidePanelFuelHeader = sidePanelFuelFilter.children[0]

            sidePanelRegionHeader.onclick = () => handleRollupClick(sidePanelRegionFilter/*, [sidePanelFuelFilter]*/)
            //sidePanelFuelHeader.onclick = () => handleRollupClick(sidePanelFuelFilter, [sidePanelRegionFilter])

            // Fills the provided drop down with the corresponding filter contents
            const fillDropDowns = (dropDownE,type,filter) =>{
                const legendContainer = dropDownE.querySelector(".sidePanelLegendContainer")
                if(legendContainer.children.length == 0){
                    let selectAllField = document.createElement("div")
                    selectAllField.classList.add("filterLegend", "selectAllDropdown")

                    let selectAllCheckBox = document.createElement("div")
                    selectAllCheckBox.classList.add("legendColour", "sidePanelFilterColour")
                    selectAllCheckBox.style.backgroundColor = "rgba(0,0,0,0.0)"

                    let selectAllCircle = document.createElement("img")
                    selectAllCircle.classList.add("selectAllCheck")
                    selectAllCircle.src = assetSources.sidePanelSelectAllCircle

                    let selectAllName = document.createElement("p")
                    selectAllName.classList.add("legendName", "sidePanelFilterName")
                    selectAllName.textContent = "Deselect all " + type + "s"

                    selectAllCheckBox.appendChild(selectAllCircle)
                    selectAllField.appendChild(selectAllCheckBox)
                    selectAllField.appendChild(selectAllName) // Append the text to the legend element
                    legendContainer.appendChild(selectAllField) // Append the legend to the filter container

                    for(let i = 0; i < filter.length; i++){
                        const item = filter[i] // Used for easier access

                        // Create legend element
                        const legend = document.createElement("div")
                        legend.classList.add("filterLegend")

                        // Create colour legend / check box
                        const colour = document.createElement("div")
                        colour.classList.add("legendColour", "sidePanelFilterColour")

                        if(type == "region"){
                            /*Use checkmark*/
                            colour.style.backgroundColor = "rgba(0,0,0,0.0)"
                            colour.classList.add("legendCheckBox")

                            const checkMark = document.createElement("img")
                            checkMark.classList.add("legendCheck")
                            checkMark.src = assetSources.sidePanelCheckMark

                            colour.appendChild(checkMark)
                            legend.onclick = () => handleRegLegClick(item.country); // Filters the data points on the map according to regionFilter state
                            selectAllField.onclick = () => handleRegLegClick("all"); // Selects all regions on click
                        }else{
                            /*Use available colour*/
                            colour.style.backgroundColor = item.colour

                            legend.onclick = () => handleFueLegClick(item.fuel); // Filters the data points on the map according to fuelFilter state
                            selectAllField.onclick = () => handleFueLegClick("all"); // Selects all regions on click
                        }
                        const name = document.createElement("p")
                        name.classList.add("legendName", "sidePanelFilterName")
                        name.textContent = item.country_long? item.country_long : item.fuel

                        legend.appendChild(colour)
                        legend.appendChild(name) // Append the text to the legend element
                        legendContainer.appendChild(legend) // Append the legend to the filter container
                    }
                }
            }
            // Fill drop down windows
            const regionDropDown = sidePanelRegionFilter.children[1]
            //const fuelDropDown = sidePanelFuelFilter.children[1]

            fillDropDowns(regionDropDown, "region", regionFilter)
            //fillDropDowns(fuelDropDown, "fuel", fuelFilter)

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
                    icon.style.filter = "brightness(0) saturate(100%) invert(28%) sepia(99%) saturate(443%) hue-rotate(154deg) brightness(97%) contrast(94%)"
                }else{
                    icon.style.filter = "brightness(0) saturate(100%) invert(99%) sepia(27%) saturate(3815%) hue-rotate(171deg) brightness(87%) contrast(84%)"
                }
                icon.onclick = () => handleNavigationClick(i, icon)
            }

            if(sidePanel.children.length == 0){
                sidePanel.appendChild(pages)
            }
        }
        
    }, [sidePanelPage,pages, fuelFilter, regionFilter, regionalData, powerPlants, pageContent])

    // Get the bounding box for a set of power plant coordinates
    function getBounds(coordinates){ // coordinates -> long [0], lat [1]
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

    // Handle zoom in click
    function handleZoomIn(icon){
        gsap.fromTo(icon, 
            { scale: 1 }, 
            { scale: 1.25, duration: 0.15, yoyo: true, repeat: 1, overwrite: true }
        );
        mapRef.current?.zoomIn({ duration: 800 });
    }

    // Handle zoom out click
    function handleZoomOut(icon){
        gsap.fromTo(icon, 
            { scale: 1 }, 
            { scale: 1.25, duration: 0.15, yoyo: true, repeat: 1, overwrite: true }
        );
        mapRef.current?.zoomOut({ duration: 800 });
    }

    // Handle zoom selection click
    function handleZoomSelection(element){
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

    // Handle reset button click
    function handleResetClick(button, option){
        //const resetButton = document.getElementById("sidePanelResetButton")
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

    // Handle clicks on index elements
    function handleIndexClick(element, index){
        gsap.fromTo(element, { backgroundColor: "rgba(0,0,0,0.0)" }, 
            { backgroundColor: "#004B70",  duration: 0.15, yoyo: true,  repeat: 1,  overwrite: true }
        );
        gsap.fromTo(element.firstElementChild, { color: "#004B70" }, 
            { color: "#F2FBFF", duration: 0.15, yoyo: true, repeat: 1, overwrite: true }
        );
        
        const alphabetArray = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
        let matchingRegions = regionFilterRef.current.filter(r => r.country_long[0] == index)
        while(!matchingRegions.length){
            let newIndex = alphabetArray.findIndex(c => c == index) + 1
            matchingRegions = regionFilterRef.current.filter(r => r.country_long[0] == alphabetArray[newIndex])
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
    function handleFueLegClick(clickedFuel){
        if (clickedFuel === "all") {
            setBarChartFilter(null)
        } else {
            setBarChartFilter(prev => {
                if (!prev) return prev
                return prev.filter(f => f !== clickedFuel)
            })
        }
        setFuelFilter(prev => { // prev, previous filter
            //const selectAllOption = sidePanel.children[0].children[4].querySelectorAll(".filterLegend")[0]; // Easy acess to the select all fuels option
            const toggled = checkAndSetFilter(null, prev, clickedFuel, "fuel")
            return toggled;
        });
    }

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
        }
    }

    // Set the region filter to a specific list of countries and zoom to them
    function setRegionFilterTo(countries){
        const selectAllOption = sidePanel.children[0].children[3].querySelectorAll(".filterLegend")[0];
        const toggled = regionFilterRef.current.map(r => ({ ...r, show: countries.includes(r.country) }))
        setRegionFilter(toggled)

        if(toggled.every(r => r.show)){
            selectAllOption.children[1].textContent = "Deselect all regions"
            selectAllOption.children[0].children[0].style.opacity = "1"
        }else{
            selectAllOption.children[1].textContent = "Select all regions"
            selectAllOption.children[0].children[0].style.opacity = "0"
        }
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

    function handleRegLegClick(clickedCountry){
        const selectAllOption = sidePanel.children[0].children[3].querySelectorAll(".filterLegend")[0]; // Easy acess to the select all regions option
        const toggled = checkAndSetFilter(selectAllOption, regionFilterRef.current, clickedCountry, "region")
        setRegionFilter(toggled)
        zoomToRegionFilter(toggled)
    }

    // Handle navigationClick
    function handleNavigationClick(id, icon){
        setSidePanelPage(allPages[id])
        if(icon.classList.contains("navigationBarIconSmall")){ // Animate number as well
            gsap.fromTo(icon.parentElement.children[1], { fontSize: "1.5vmin" },
            { fontSize: "1.65vmin", duration: 0.15, yoyo: true, repeat: 1, overwrite: true }
        );
        }
        gsap.fromTo(icon, { scale: 1 }, 
            { scale: 1.25, duration: 0.15, yoyo: true, repeat: 1, overwrite: true }
        );
        icon.style.filter = "brightness(0) saturate(100%) invert(28%) sepia(99%) saturate(443%) hue-rotate(154deg) brightness(97%) contrast(94%)"
    }

    // Handle side panel open /close
    function handleSidePanelToggle(){
        const sidePanel = sidePanelContainer.current
        const toggleButton = document.querySelector("#sidePanelToggleContainer")
        if (!sidePanel) return



        if (sidePanelOpenRef.current) {
            gsap.fromTo(sidePanel.children,{opacity: 1}, {opacity:0, duration: 0.1, ease: "power2.out", onComplete: ()=>{
                gsap.fromTo(sidePanel,
                    {rotateY:0},
                    {rotateY:90, transformOrigin:"right 50%", duration: 0.15, ease: "power2.out",
                        onComplete: () => {
                            sidePanelOpenRef.current = false
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
                        sidePanelOpenRef.current = true
                     }
                })
            gsap.fromTo(toggleButton, {right:"0dvw"}, {right:"28dvw", duration: 0.15, ease: "power2.in"})
        }
    }

    // Handle rollupClick
    function handleRollupClick(element /*, otherElements*/){
        // Any other dropdowns open?
        /* for(var i = 0; i < otherElements.length; i++){
            if(!otherElements[i].children[1].classList.contains("hide")){
                toggleDropDown(otherElements[i])
            }
        } */
        toggleDropDown(element)
    }

    // Handle toggle click in line plot
    function handleLinePlotToggle(element){
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

        const linePlot = document.getElementById("linePlotSVG")
        const barChart = document.getElementById("barChartSVG")

        const boldText = document.getElementById("linePlotExBoldText")
        const standardText = document.getElementById("linePlotExStandardText")

        const capacityValues = document.querySelectorAll(".ffCapacity")
        const generationValues = document.querySelectorAll(".ffGeneration")

        if(linePlot.classList.contains("hide")){
            gsap.fromTo(linePlot, { opacity: 0 }, 
                { opacity: 1,  duration: 0.15, onComplete: () =>{
                    linePlot.classList.toggle("hide")
                    boldText.textContent = "Electric generation per year "
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
                    boldText.textContent = "Power plant capacity per fuel "
                    standardText.textContent = "(MW)"
                } } 
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
            const regionSelectAll = sidePanel.children[0].children[3].querySelectorAll(".filterLegend")[0]

            regionSelectAll.children[1].textContent = "Deselect all regions"
            regionSelectAll.children[0].children[0].style.opacity = "1"

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
            element.parentElement.style['border-radius'] = "1dvh 1dvh 0 0";
            element.parentElement.style['z-index'] = "100"
            dropdown.classList.toggle("hide");
        } else {
            gsap.to(dropdown,
                { height: 0, opacity: 0, duration: 0.2, ease: "power4.in",
                    onComplete: () => {
                        element.parentElement.style['border-radius'] = "1dvh";
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
        <div id="sidePanelToggleContainer" onClick={handleSidePanelToggle}>
            <img src={assetSources.sidePanelInfo} id="sidePanelToggleIcon"></img>
        </div>
    </>)
}

export default PrimaryPanels

function getShownPowerPlants(pps, rFilter, fFilter, yFilter, gFilter){ //powerplants, region, fuel, year, generation filters
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

function getSliderBounds(filter, regionalData){
    let minVal = 0, maxVal = 100
    if (regionalData.length) {
        if (filter === "year") {
            const minYears = regionalData.map(y => y.oldest_power_plant).filter(y => y != null)
            const maxYears = regionalData.map(y => y.newest_power_plant).filter(y => y != null)
            if (minYears.length && maxYears.length) { minVal = Math.min(...minYears); maxVal = Math.floor(Math.max(...maxYears)) }
        } else {
            var largest = Number.NEGATIVE_INFINITY;
            var smallest = Number.POSITIVE_INFINITY;

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
        }
    }
    return { minVal, maxVal }
}

function createPages(pageContent, powerPlants, regionalData, fuels,
                                  onYearChange, onGenerationChange, onReset, onIndexClick, onToggleClick, onLegendClick){
    const pageContainer = document.createElement("div")
    pageContainer.classList.add('sidePanelPageContainer')
    
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

    // Filter drop downs and sliders
    for(var i = 0; i < 3; i++){
        let filterContainer = document.createElement("div")
        filterContainer.classList.add('sidePanelFilterContainer')
        switch (i) {
            case 0: 
            filterContainer.id = "firstFilterContainer"
            filterContainer.appendChild(getDropDown("region", onIndexClick));
             break;
            //case 1: filterContainer.appendChild(getDropDown("fuel", onIndexClick)); break;
            case 1: filterContainer.appendChild(getSliders("year", regionalData, onYearChange)); break;
            case 2: filterContainer.appendChild(getSliders("generated", regionalData, onGenerationChange)); break;
        }
        pageContainer.appendChild(filterContainer)
    }

    // Generation by fuel line plot
    const linePlotContainer = document.createElement("div")
    linePlotContainer.id = "sidePanelLinePlot"

    // Header for line plot
    const linePlotHeader = document.createElement("div");
    linePlotHeader.id = "linePlotHeader"

    // Title and data toggle wrapper
    const titleAndDataWrapper = document.createElement("div");
    titleAndDataWrapper.id = "linePlotTitleWrapper"

    const linePlotTitle = document.createElement("span");
    linePlotTitle.id = "linePlotTitle";
    linePlotTitle.textContent = "Electricity Generation Trends"

    const toggleWrapper = document.createElement("div");
    toggleWrapper.id = "dataToggleWrapper";

    const toggleTitle = document.createElement("span");
    toggleTitle.id = "dataToggleTitle";
    toggleTitle.textContent = "Show: ";

    const toggleButtons = document.createElement("div");
    toggleButtons.id = "dataToggleButtonContainer"

    const buttonText = (text) =>{
        let textElement = document.createElement("span");
        textElement.classList.add("dataToggleButtonText")
        textElement.textContent = text
        return textElement
    }

    const capacityButton = document.createElement("div");
    capacityButton.classList.add("dataToggleButton")
    capacityButton.style.backgroundColor = "rgba(0,0,0,0.0)";
    capacityButton.onclick = () => onToggleClick(capacityButton)
    capacityButton.appendChild(buttonText("Capacity"))

    const outputButton = document.createElement("div");
    outputButton.classList.add("dataToggleButton")
    outputButton.style.backgroundColor = "#AAD3DE";
    outputButton.onclick = () => onToggleClick(outputButton)
    outputButton.appendChild(buttonText("Output"))

    toggleButtons.appendChild(capacityButton)
    toggleButtons.appendChild(outputButton)

    toggleWrapper.appendChild(toggleTitle)
    toggleWrapper.appendChild(toggleButtons)

    titleAndDataWrapper.appendChild(linePlotTitle)
    titleAndDataWrapper.appendChild(toggleWrapper)
    linePlotHeader.appendChild(titleAndDataWrapper)

    // Explanation text
    const linePlotTextCollector = document.createElement("div");
    linePlotTextCollector.id = "linePlotTextCollector"

    const linePlotExBold = document.createElement("span");
    linePlotExBold.id = "linePlotExBoldText"
    linePlotExBold.textContent = "Electric generation per year "

    const linePlotExStandard = document.createElement("span");
    linePlotExStandard.id = "linePlotExStandardText"
    linePlotExStandard.textContent = "(GWh)"

    linePlotTextCollector.appendChild(linePlotExBold)
    linePlotTextCollector.appendChild(linePlotExStandard)
    linePlotHeader.appendChild(linePlotTextCollector)

    linePlotContainer.appendChild(linePlotHeader)

    // Body of line plot (the graph and filter buttons)
    const linePlotBody = document.createElement("div");
    linePlotBody.id = "linePlotBody";

    // SVG for actual line plot
    const dataVisualization = document.createElement("svg");

    // Container for fuelFilter
    const fuelFilterContainer = document.createElement("div");
    fuelFilterContainer.id = "fuelFilterContainer"

    // Check if the fuel values are available
    if(fuels){
        // Pixel dimensions for the side panel
        const sidePanelWidth =  window.innerWidth * 0.25;
        const sidePanelLeftMargin = window.innerWidth * 0.01;
        const sidePanelPadding = Math.floor(2*window.innerWidth * 0.01);

        // Pixel dimensions for the bar chart container
        const linePlotWidth = Math.floor((sidePanelWidth - sidePanelLeftMargin - sidePanelPadding) * 0.65)
        const linePlotHeight = Math.floor((window.innerHeight * 0.35) * 0.72)

        drawLinePlot(dataVisualization, linePlotWidth,linePlotHeight, fuels, true)
        drawBarChart(dataVisualization, linePlotWidth, linePlotHeight, fuels, false)

        // Select all option
        const selectAllEntry = document.createElement("div");
        selectAllEntry.classList.add("fuelFilterEntry");
        selectAllEntry.style.justifyContent = "flex-end";

        const selectAllName = document.createElement("span");
        selectAllName.id = "fuelFilterSelectAllName"
        selectAllName.textContent = "Deselect All"

        const selectAllCheckBox = document.createElement("div")
        selectAllCheckBox.id = "fuelFilterSelectAllCircle"
        selectAllCheckBox.style.backgroundColor = "rgba(0,0,0,0.0)"

        const selectAllCheck = document.createElement("img")
        selectAllCheck.id = "fuelFilterSelectAllCheck"
        selectAllCheck.src = assetSources.sidePanelSelectAllCircle

        selectAllCheckBox.onclick = () => onLegendClick("all")
        selectAllCheckBox.appendChild(selectAllCheck)
        selectAllEntry.appendChild(selectAllName)
        selectAllEntry.appendChild(selectAllCheckBox)
        fuelFilterContainer.appendChild(selectAllEntry)

        // Fuel filter entries
        fuels.forEach(f =>{
            const filterEntry = document.createElement("div");
            filterEntry.classList.add("fuelFilterEntry");

            const leftDiv = document.createElement("div");
            leftDiv.style.display = "flex";
            leftDiv.style.alignItems = "center"

            const filterColour = document.createElement("div");
            filterColour.classList.add("fuelFilterLegendColour");
            filterColour.style.backgroundColor = f.colour;

            const filterName = document.createElement("span");
            filterName.textContent = f.fuel

            leftDiv.appendChild(filterColour)
            leftDiv.appendChild(filterName)

            const formatPowerOf10 = (num) => {
                if (num === 0) return `0`.trim();
  
                // Define metric prefixes mapping to powers of 10
                const prefixes = [
                    //{ value: 1e6,  symbol: 'M' }, // Mega
                    { value: 1e3,  symbol: 'k' }, // kilo
                    { value: 1,    symbol: ''  }, 
                ];

                // Find the closest matching tier
                const tier = prefixes.find(p => num >= p.value) || prefixes[prefixes.length - 1];
  
                // Round to 1 decimal place relative to the tier
                const rounded = Math.round((num / tier.value));
  
                return `${rounded} ${tier.symbol}`.trim();
            }

            const rightDiv = document.createElement("div");
            rightDiv.style.display = "flex";
            rightDiv.style.alignItems = "center"

            const filterCapacity = document.createElement("span");
            filterCapacity.classList.add("fuelFilterValue", "hide", "ffCapacity");
            filterCapacity.textContent = formatPowerOf10(f.sum_capacity_mw);

            const filterGeneration = document.createElement("span");
            filterGeneration.classList.add("fuelFilterValue", "ffGeneration");
            filterGeneration.textContent = formatPowerOf10(f.sum_generation_2019);

            const checkBox = document.createElement("div");
            checkBox.style.backgroundColor = "rgba(0,0,0,0.0)"
            checkBox.classList.add("fuelFilterCheckBox")

            const checkMark = document.createElement("img")
            checkMark.classList.add("fuelFilterCheckMark")
            checkMark.src = assetSources.sidePanelCheckMark

            checkBox.onclick = () => onLegendClick(f.fuel)
            checkBox.appendChild(checkMark)

            rightDiv.appendChild(filterCapacity)
            rightDiv.appendChild(filterGeneration)
            rightDiv.appendChild(checkBox)

            filterEntry.appendChild(leftDiv)
            filterEntry.appendChild(rightDiv)
            fuelFilterContainer.appendChild(filterEntry)
        })
    }

    linePlotBody.appendChild(dataVisualization)
    linePlotBody.appendChild(fuelFilterContainer)
    linePlotContainer.appendChild(linePlotBody)
    pageContainer.appendChild(linePlotContainer)

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

    // Instruction containers / Info text
    for(var i = 0; i<pageContent.length; i++){
        let page = getInstructions(pageContent, i)
        pageContainer.appendChild(page)
    }

    // Navigation bar at bottom of side panel
    const navigationContainer = document.createElement("div")
    navigationContainer.id = "navigationBarContainer"

    // Smaller main title
    const mainTitleSmall = document.createElement("span")
    mainTitleSmall.id = "sidePanelMainTitleSmall"
    mainTitleSmall.textContent = "Energy Map"

    navigationContainer.appendChild(mainTitleSmall)

    const navigationElements = document.createElement("div")
    navigationElements.style.display = "flex"

    for(let i = 0; i<6;i++){
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

    return pageContainer
}

// Creates the drop downs found in the side panel
function getDropDown(filter, onIndexClick){
    const dropDown = document.createElement("div")
    dropDown.classList.add("sidePanelFilterDropDown")

    const header = document.createElement("div")
    header.classList.add("sidePanelDropDownHeader")

    const title = document.createElement("h2")
    title.classList.add("sidePanelFilterTitle")

    const rollupIcon = document.createElement("img")
    rollupIcon.classList.add("sidePanelFilterIcon")
    rollupIcon.src = assetSources.sidePanelRollupOpen

    const dropDownField = document.createElement("div");
    dropDownField.classList.add("sidePanelDropDownField", "hide");

    const legendContainer = document.createElement("div");
    legendContainer.classList.add("sidePanelLegendContainer")

    const alphabetIndexContainer = document.createElement("div");
    alphabetIndexContainer.classList.add("dropDownIndexContainer");

    if(filter == "region"){
        title.textContent = "All Regions"

        const alphabetArray = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
        alphabetArray.forEach(c =>{
            const index = document.createElement("div");
            index.classList.add("dropDownIndex");

            const indexChar = document.createElement("span");
            indexChar.classList.add("dropDownIndexChar");
            indexChar.textContent = c;

            index.appendChild(indexChar)
            index.onclick = () => onIndexClick(index, c)
            alphabetIndexContainer.appendChild(index)
        })

    }else{ // fuel
        title.textContent = "All Power Sources"
    }

    dropDownField.appendChild(legendContainer)
    dropDownField.appendChild(alphabetIndexContainer)

    header.appendChild(title)
    header.appendChild(rollupIcon)
    dropDown.appendChild(header)
    dropDown.appendChild(dropDownField)
    return dropDown
}

// Creates the range based filters found in the side panel
function getSliders(filter, regionalData, onChange){
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
    sliderContainer.appendChild(thumbMax)
    

    const textField = document.createElement("div")
    textField.classList.add("sliderTextField")

    const textMin = document.createElement("span")
    const textSliderTitle = document.createElement("strong")
    const textMax = document.createElement("span")

    textMin.classList.add("sliderEdgeText")
    textSliderTitle.classList.add("sliderTitle")
    textMax.classList.add("sliderEdgeText")

    textField.appendChild(textMin)

    if(filter=="year"){
        textSliderTitle.textContent = "Year Started"
        textField.appendChild(textSliderTitle)
    }else{
        // Wrapper for text and info icon
        const titleAndIconWrapper = document.createElement("span")
        titleAndIconWrapper.className = "sliderTitleWrapper"

        // The text displayed below the slider
        textSliderTitle.textContent = "Annual Generation (GWh)"

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

        titleAndIconWrapper.appendChild(textSliderTitle)
        titleAndIconWrapper.appendChild(sliderIcon)
        titleAndIconWrapper.appendChild(generationToolTip)
        
        textField.appendChild(titleAndIconWrapper)
    }

    textField.appendChild(textMax)

    sliderContainer.appendChild(textField)

    const minMax = getSliderBounds(filter, regionalData)
    const minVal = minMax.minVal
    const maxVal = minMax.maxVal
    let valueMin = minMax.minVal
    let valueMax = minMax.maxVal

    if(minVal == 0){
        textMin.textContent = "0 / no data"
    }else{
        textMin.textContent = (minVal<10000)? minVal : ((minVal / 100) / 10.0).toFixed(0) + " k"
    }
    textMax.textContent = (maxVal<10000)? maxVal : ((maxVal / 100) / 10.0).toFixed(0) + " k"

    const updateSlider = () => {
        const span = maxVal - minVal
        const percentageMin = ((valueMin - minVal) / span) * 100
        const percentageMax = ((valueMax - minVal) / span) * 100
        thumbMin.style.left = percentageMin + "%"
        thumbMinText.textContent = (valueMin<10000)? valueMin : ((valueMin / 100) / 10.0).toFixed(0) + " k"
        thumbMaxText.textContent = (valueMax<10000)? valueMax : ((valueMax / 100) / 10.0).toFixed(0) + " k"
        thumbMax.style.left = percentageMax + "%"
        range.style.left = percentageMin + "%"
        range.style.width = (percentageMax - percentageMin) + "%"
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
                if (onChange) onChange([valueMin, valueMax], [minVal, maxVal])
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
                if (onChange) onChange([valueMin, valueMax], [minVal, maxVal])
            }
            addRemoveListeners(document, "add", onMove, onEnd)
        }
        addRemoveListeners(rangeElement, "start", null, null, onStart)
    }

    makeDraggable(thumbMin, true)
    makeDraggable(thumbMax, false)
    makeDraggableRange(range)
    updateSlider()
    if (onChange) onChange([valueMin, valueMax], [minVal, maxVal])

    sliderContainer.reset = () => {
        valueMin = minVal
        valueMax = maxVal
        updateSlider()
        if (onChange) onChange([valueMin, valueMax], [minVal, maxVal])
    }

    sliderContainer.set = (min, max) => {
        valueMin = Math.max(minVal, Math.min(min, maxVal))
        valueMax = Math.max(minVal, Math.min(max, maxVal))
        updateSlider()
        if (onChange) onChange([valueMin, valueMax], [minVal, maxVal])
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
                    if(t != "Research paper" && t !="Source of Information"){
                        console.log(title)
                        console.log(container)
                        container.appendChild(title)
                    }
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
                                    icon.style.filter = "brightness(0) saturate(100%) invert(28%) sepia(99%) saturate(443%) hue-rotate(154deg) brightness(97%) contrast(94%)"
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

function drawLinePlot(svgE, linePlotWidth, linePlotHeight, data, showPlot){
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
    var margin = {top: Math.floor(3*scale), right: Math.floor(40*scale), bottom: Math.floor(30*scale), left: Math.floor(10*scale)},
    width = linePlotWidth - margin.left - margin.right,
    height = linePlotHeight - margin.top - margin.bottom;

    var svg = d3.select(svgE)
        .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("class", showPlot? null : "hide")
            .attr("id", "linePlotSVG")
        .append("g")
            .attr("transform","translate(" + margin.left + "," + margin.top + ")");

    var sumstat = d3.index(data, (d) => d.fuel)

    // Create x-axis
    var x = d3.scaleLinear()
    .domain([_firstYearOfGenerationData-0.2, _latestYearOfGenerationData])
    .range([ 0, width ])

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).ticks(_latestYearOfGenerationData-_firstYearOfGenerationData).tickFormat(d3.format("d")))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick").selectAll("line").remove())
        .selectAll("text")
            .attr("transform", "translate(-5,0)rotate(-45)")
            .style("text-anchor", "end")
            .style("font-size", "1vmin")
            .style("font-family", "'Lato', sans-serif");

    const maxValue = (d) =>{
        var max = Number.NEGATIVE_INFINITY
        for(let i = _firstYearOfGenerationData; i <= _latestYearOfGenerationData; i++){
            let reported = eval("d.sum_generation_"+i)
            if(reported >= max){max = reported}
            /* if(i <= _latestYearOfEstimatedGenerationData){
                let estimated = eval("d.sum_estimated_generation_"+i)
                if(estimated >= max){max = estimated}
            } */
        }
        return max
    }

    // Create y-axis
    var y = d3.scaleLinear()
        .domain([0, d3.max(data, function(d) { return maxValue(d) })])
        .range([ height, 0 ]);

    svg.append("g")
        .attr("transform", "translate("+ width + ", 0)")
        .call(d3.axisRight(y).tickFormat(d => d === 0 ? 0 : d3.format('.2s')(d)))
        .call(g => g.select(".domain").remove())
        .selectAll(".tick text")
            .style("font-size", "1vmin")
            .style("font-family", "'Lato', sans-serif");

    // Append the grid lines group
    svg.append("g")
        .attr("class", "grid")
        .attr("stroke-width", 0.5) 
        .style("stroke-dasharray", ("3, 3"))
        .call(d3.axisLeft(y)
            .tickSize(-width)  // Stretches lines across the width of the chart
            .tickFormat("")    // Removes text labels from the grid lines
        )
        .call(g => g.select(".domain").remove());
    
    svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0, ${height})`)
    .attr("stroke-width", 0.5) 
    .style("stroke-dasharray", ("3, 3"))
    .call(d3.axisTop(x)
        .ticks(_latestYearOfGenerationData-_firstYearOfGenerationData)
        .tickSize(height) // Stretches lines up across the height of the chart
        .tickFormat("")    // Removes text labels
    )
    .call(g => g.select(".domain").remove());

    svg.selectAll(".line")
      .data(Array.from(sumstat.values()))
      .enter()
      .append("path")
        .attr("fill", "none")
        .attr("stroke", function(d){ return d.colour })
        .attr("stroke-width", 2.5)
        .attr("d", function(d){
          const points = []
          for(let year = _firstYearOfGenerationData; year <= _latestYearOfGenerationData; year++){
            points.push({ year: year, value: d["sum_generation_" + year] })
          }
          return d3.line()
            .x(function(p) { return x(p.year); })
            .y(function(p) { return p.value == null ? null : y(p.value); })
            (points)
        })

    // Second set of lines for estimated data
    /* svg.selectAll(".line")
      .data(Array.from(sumstat.values()))
      .enter()
      .append("path")
        .attr("fill", "none")
        .attr("stroke", function(d){ return d.colour })
        .attr("stroke-width", 1.5)
        .style("stroke-dasharray", ("2, 2"))
        .attr("d", function(d){
          const points = []
          for(let year = _firstYearOfEstimatedGenerationData; year <= _latestYearOfEstimatedGenerationData; year++){
            points.push({ year: year, value: d["sum_estimated_generation_" + year] })
          }
          return d3.line()
            .x(function(p) { return x(p.year); })
            .y(function(p) { return p.value == null ? y(0) : y(p.value); })
            (points)
        }) */
}

function drawBarChart(svgE, barChartWidth, barChartHeight, data, showPlot){
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
    var margin = {top: Math.floor(5*scale), right: Math.floor(40*scale), bottom: Math.floor(40*scale), left: Math.floor(10*scale)},
    width = barChartWidth - margin.left - margin.right,
    height = barChartHeight - margin.top - margin.bottom;

    var svg = d3.select(svgE)
        .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("class", showPlot? null : "hide")
            .attr("id", "barChartSVG")
        .append("g")
            .attr("transform","translate(" + margin.left + "," + margin.top + ")");

    var sumstat = d3.index(data, (d) => d.fuel)

    // Create x-axis
    var x = d3.scaleBand()
        .range([ 0, width ])
        .domain(sumstat.keys())
        .padding(0.2);

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick").selectAll("line").remove())
        .selectAll("text")
            .attr("transform", "translate(-5,0)rotate(-45)")
            .style("text-anchor", "end")
            .style("font-size", "1vmin")
            .style("font-family", "'Lato', sans-serif");

    var y = d3.scaleLinear()
        .domain([0, d3.max(data, function(d) { return d.sum_capacity_mw })])
        .range([ height, 0]);

    svg.append("g")
        .attr("transform", "translate("+ width + ", 0)")
        .call(d3.axisRight(y).tickFormat(d => d === 0 ? 0 : d3.format('.2s')(d)))
        .call(g => g.select(".domain").remove())
        .selectAll(".tick text")
            .style("font-size", "1vmin")
            .style("font-family", "'Lato', sans-serif");

    // Append the grid lines group
    svg.append("g")
        .attr("class", "grid")
        .attr("stroke-width", 0.5) 
        .style("stroke-dasharray", ("3, 3"))
        .call(d3.axisLeft(y)
            .tickSize(-width)  // Stretches lines across the width of the chart
            .tickFormat("")    // Removes text labels from the grid lines
        )
        .call(g => g.select(".domain").remove());
    
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0, ${height})`)
        .attr("stroke-width", 0.5) 
        .style("stroke-dasharray", ("3, 3"))
        .call(d3.axisTop(x)
            .ticks(sumstat.length)
            .tickSize(height) // Stretches lines up across the height of the chart
            .tickFormat("")    // Removes text labels
        )
        .call(g => g.select(".domain").remove());

    svg.selectAll("mybar")
        .data(Array.from(sumstat.values()))
        .enter()
        .append("rect")
            .attr("x", function(d) { return x(d.fuel); })
            .attr("y", function(d) { return y(d.sum_capacity_mw); })
            .attr("width", x.bandwidth())
            .attr("height", function(d) { return height - y(d.sum_capacity_mw); })
            .attr("fill", function(d) {return d.colour})
}