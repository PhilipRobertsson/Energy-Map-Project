import { useState, useEffect, useRef, useContext, createElement } from 'react'
import * as d3 from "d3";

import { MapContext } from './Map.jsx'

import './PrimaryPanels.css'

// Definition for the filter panel
const fuelFilterDef = {
    id: "fuelFilter",
    width: 9 + "dvw", // 9% of screen width
    height: 44 + "dvh", // 44% of screen height
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
}

// The different pages on the instruction page
const allPages = [
    {id: 0, visibleHtmlElements: [true, true, false, false, false, false, false, false, true, true, true, true, true, false, false, false, false,false,false, true]},
    {id: 1, visibleHtmlElements: [false, false, true, false, false, false, false, false, true, true, true, true, true, true, false, false, false,false,false, true]},
    {id: 2, visibleHtmlElements: [false, false, false, true, false, false, false, false, true, true, true, true, true, false, true, false, false,false,false, true]},
    {id: 3, visibleHtmlElements: [false, false, false, false, true, false, false, false, true, true, true, true, true, false, false, true, false,false,false, true]},
    {id: 4, visibleHtmlElements: [false, false, false, false, false, true, false, false, true, true, true, true, true, false, false, false, true,false,false, true]},
    {id: 5, visibleHtmlElements: [false, false, false, false, false, false, true, false, true, true, true, true, true, false, false, false, false,true,false, true]},
    {id: 6, visibleHtmlElements: [false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, false, false,false,true, true]},
]

const _firstYearOfGenerationData = 2013;
const _latestYearOfGenerationData = 2019;
const _firstYearOfEstimatedGenerationData = 2013;
const _latestYearOfEstimatedGenerationData = 2017;

function PrimaryPanels() {
    const { mapRef, powerPlants } = useContext(MapContext);
    const filterContainer = useRef(null);
    const sidePanelContainer = useRef(null)
    const [fuelFilter, setFuelFilter] = useState([]);
    const [regionFilter, setRegionFilter] = useState([]);
    const [yearFilter, setYearFilter] = useState([]);
    const [generationFilter, setGenerationFilter] = useState([]);
    const [regionalData, setRegionalData] = useState([]);
    const [sidePanelPage, setSidePanelPage] = useState(allPages[0]);
    const [pages, setPages] = useState(null);

    // Set initial filter, also get all fuel types
    useEffect(() => {
    fetch("./fuelCatagories.json") // Go through this file and ensure the colours have more contrast between one another
      .then((response) => response.json())
      .then((data) => {
        setFuelFilter(data);
      });

    fetch("./regionalInformation.json")
      .then((response) => response.json())
      .then((data) => {
        setRegionalData(data);
      });

    fetch("./regionalFilter.json")
      .then((response) => response.json())
      .then((data) => {
        setRegionFilter(data);
      });
    }, []);

    // Initial draw of panels
    useEffect(() => {
        if (filterContainer.current) return;
        if (sidePanelContainer.current) return;

        filterContainer.current = document.createElement("div");
        sidePanelContainer.current = document.createElement("div");
    }, []);

    // Add information and buttons to filter panel
    useEffect(() =>{
        const filter = filterContainer.current;
        if (!filter || !fuelFilter.length) return;
        filter.replaceChildren();

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

            legend.onclick = () => handleLegendClick(fuel.fuel); // Filters the data points on the map according to fuelFilter state
            legend.appendChild(colour) // Append the colour box to the legend element
            legend.appendChild(label) // Append the text to the legend element
            filter.appendChild(legend) // Append the legend to the filter container
        }

        /*--[Control buttons at the bottom of the filter panel]--*/
        var controlContainer = document.createElement("div")
        controlContainer.id = "controlContainer"
        // Zoom in button
        var zoomIn = document.createElement("img")
        zoomIn.className = "controlIcon"
        zoomIn.src = assetSources.zoomIn
        zoomIn.onclick = handleZoomIn
        // Zoom out button
        var zoomOut = document.createElement("img")
        zoomOut.className = "controlIcon"
        zoomOut.src = assetSources.zoomOut
        zoomOut.onclick = handleZoomOut
        // Zoom selection
        var zoomSelection = document.createElement("img")
        zoomSelection.classList.add("controlIcon", "selection")
        zoomSelection.src = assetSources.zoomSelection
        zoomSelection.onclick = () =>  handleZoomSelection(zoomSelection) /*Fix so the icon doesn't change when filters are changed*/

        controlContainer.appendChild(zoomIn) // Append zoom in button
        controlContainer.appendChild(zoomOut) // Append zoom out button
        controlContainer.appendChild(zoomSelection) // Append slection zoom button
        filter.appendChild(controlContainer) // Append control panel to filter panel


    }, [fuelFilter,powerPlants, regionFilter, yearFilter, generationFilter]);

    // Handle zoom in click
    function handleZoomIn(){
        mapRef.current?.zoomIn({ duration: 800 });
    }

    // Handle zoom out click
    function handleZoomOut(){
        mapRef.current?.zoomOut({ duration: 800 });
    }

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

        if(element.classList.contains("selection")){
            element.src = assetSources.zoomFullScreen
            const shownRegions = regionFilter.filter(r => r.show).map(r => r.country);
            const shownFuels = fuelFilter.filter(f => f.show).map(f => f.fuel);
            const yearValues = yearFilter.length === 2 ? yearFilter[0] : null;
            const yearBounds = yearFilter.length === 2 ? yearFilter[1] : null;
            const genValues = generationFilter.length === 2 ? generationFilter[0] : null;
            const genBounds = generationFilter.length === 2 ? generationFilter[1] : null;

            const coordinates = []

            // Filter out unselected powerplants
            for (const f of powerPlants.features) {
                const p = f.properties
                const c = f.geometry.coordinates
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
                coordinates.push(c)
            }
            
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
            fullScreen()
        }
        element.classList.toggle("selection");
    }

    // Handle clicks on the seperate legends
    function handleLegendClick(clickedFuel){
        // Set filter state
        setFuelFilter(prev => { // Take previous filter
            const clicked = prev.find(f => f.fuel === clickedFuel); // Find the clicked fuel type in the previous state of fuelFilter
            const add = prev.filter(f=>f.show).find(f=>f.fuel === clickedFuel) == null // If the clickedFuel was not part of the filter -> add true
            const reset = clicked.show && prev.filter(f => f.show).length < prev.length; // Reset if clickedFuel is already shown and the number of shown fuel types are less than all

            if(add){
                const valid = prev.filter(f => f.show) // Find the previously shown fuel types
                return prev.map(f => ({ ...f, show: f.fuel == clickedFuel || valid.some(v=>v.fuel == f.fuel)})); // Previously shown are kept for the new filter, along with the clicked one 
            }
            if (reset) {
                return prev.map(f => ({ ...f, show: true })); // Set all fuel types to be shown
            }
            return prev.map(f => ({ ...f, show: f.fuel === clickedFuel })); // First click if previous filter shows all fuels
        });
    }

    // Handle clicks on the seperate country toggles
    function handleToggleClick(clickedCountry){
        // Set filter state
        setRegionFilter(prev => { // Take previous filter
            const clicked = prev.find(r => r.country === clickedCountry); // Find the clicked fuel type in the previous state of fuelFilter
            const add = prev.filter(r=>r.show).find(r=>r.country === clickedCountry) == null // If the clickedFuel was not part of the filter -> add true
            const reset = clicked.show && prev.filter(r => r.show).length < prev.length; // Reset if clickedFuel is already shown and the number of shown fuel types are less than all
            if(add){
                const valid = prev.filter(r => r.show) // Find the previously shown fuel types
                return prev.map(r => ({ ...r, show: r.country == clickedCountry || valid.some(v=>v.country == r.country)})); // Previously shown are kept for the new filter, along with the clicked one 
            }
            if (reset) {
                return prev.map(r => ({ ...r, show: true })); // Set all fuel types to be shown
            }
            return prev.map(r => ({ ...r, show: r.country === clickedCountry })); // First click if previous filter shows all fuels
        });
    }

    // Handle navigationClick
    function handleNavigationClick(id, icon){
        setSidePanelPage(allPages[id])
        icon.style.filter = "brightness(0) saturate(100%) invert(28%) sepia(99%) saturate(443%) hue-rotate(154deg) brightness(97%) contrast(94%)"
    }

    // Used by the below function
    function toggleDropDown(element){
        if(element.children[1].classList.contains("hide")){ // Open the rollup
            element.children[0].children[1].src = assetSources.sidePanelRollupClose
            element.parentElement.style['border-radius'] = "11px 11px 0 0";
            element.parentElement.style['z-index'] = "100" // Arbitrary value to show it on top
        }else{ // Close the rollup
            element.children[0].children[1].src = assetSources.sidePanelRollupOpen
            element.parentElement.style['border-radius'] = "11px 11px 11px 11px";
            element.parentElement.style['z-index'] = "unset"
        }
        element.children[1].classList.toggle("hide");
    }

    // Handle rollupClick
    function handleRollupClick(element, otherElements){
        // Any other dropdowns open?
        for(var i = 0; i < otherElements.length; i++){
            if(!otherElements[i].children[1].classList.contains("hide")){
                toggleDropDown(otherElements[i])
            }
        }
        toggleDropDown(element)
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

    // Update legend opacity when filter changes
    useEffect(() => {
        const filter = filterContainer.current; // Get the current filter component
        const sidePanel = sidePanelContainer.current; // Get the current sidepanel component
        if (!filter || !fuelFilter.length) return; // If id does not exsist don't update anything
        const legendsFilter = filter.querySelectorAll(".filterLegend"); // Find all legends
        fuelFilter.forEach((fuel, i) => {
            if (legendsFilter[i]) { // If legend exists
                legendsFilter[i].style.opacity = fuel.show ? "1" : "0.3"; // Set oppacity based on filter settings
            }
        });
        if (!sidePanel || !fuelFilter.length || !regionFilter.length) return; // If id does not exsist don't update anything
        const legendsSidePanel = sidePanel.children[0].children[9].querySelectorAll(".filterLegend"); // Find all legends
        const toggleSidePanel = sidePanel.children[0].children[8].querySelectorAll(".filterLegend");

        const fuelFilterDropDownTitle = sidePanel.children[0].querySelectorAll(".sidePanelFilterTitle")[1]
        const regionFilterDropDownTitle = sidePanel.children[0].querySelectorAll(".sidePanelFilterTitle")[0]

        const shownFuels = fuelFilter.filter((fuel) => fuel.show)
        const shownRegions = regionFilter.filter((region) => region.show)

        if(shownFuels.length == legendsSidePanel.length || legendsSidePanel.length == 0){
            fuelFilterDropDownTitle.textContent = "All Power Sources"
        }else{
            var newFuelTitle = getNewDropDownTitle(shownFuels, "fuel")
            fuelFilterDropDownTitle.textContent = newFuelTitle
        }

        if(shownRegions.length == toggleSidePanel.length || toggleSidePanel.length == 0){
            regionFilterDropDownTitle.textContent = "All Regions"
        }else{
            var newRegionTitle = getNewDropDownTitle(shownRegions, "region")
            regionFilterDropDownTitle.textContent = newRegionTitle
        }

        fuelFilter.forEach((fuel, i) => {
            if (legendsSidePanel[i]) { // If legend exists
                legendsSidePanel[i].style.opacity = fuel.show ? "1" : "0.3"; // Set oppacity based on filter settings
            }
        });
        regionFilter.forEach((region, i)=>{
            if(toggleSidePanel[i]){
                toggleSidePanel[i].style.opacity = region.show ? "1" : "0.3";
            }
        })
    }, [fuelFilter,regionFilter]);

    // Update map layer filter
    useEffect(() => {
        const toFilter = mapRef.current;
        if (!toFilter || !toFilter.getLayer("powerplants-layer") || !fuelFilter.length || !regionFilter.length) return;
        const shownFuels = fuelFilter.filter(f => f.show).map(f => f.fuel);
        const shownRegions = regionFilter.filter(r => r.show).map(r => r.country);

        const filters = ["all"];

        if (shownFuels.length < fuelFilter.length) {
            filters.push(["in", ["get", "primary_fuel"], ["literal", [...shownFuels]]]);
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

        const shownRegions = regionFilter.filter(r => r.show).map(r => r.country);
        const shownFuels = fuelFilter.filter(f => f.show).map(f => f.fuel);
        const yearValues = yearFilter.length === 2 ? yearFilter[0] : null;
        const yearBounds = yearFilter.length === 2 ? yearFilter[1] : null;
        const genValues = generationFilter.length === 2 ? generationFilter[0] : null;
        const genBounds = generationFilter.length === 2 ? generationFilter[1] : null;

        let shown = 0;
        const total = powerPlants.features.length;

        for (const f of powerPlants.features) {
            const p = f.properties;
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
            shown++;
        }

        const pageContainer = sidePanel.children[0];
        const filterCounterValue = pageContainer.querySelector("#filterCounterValue");
        const filterCounterStatic = pageContainer.querySelector("#filterCounterStatic");
        if (filterCounterValue) filterCounterValue.textContent = shown;
        if (filterCounterStatic) filterCounterStatic.textContent = `/${total} power plants selected`;
    }, [fuelFilter, regionFilter, yearFilter, generationFilter, powerPlants]);

    // Update side panel when it is changed
    useEffect(() =>{
        const sidePanel = sidePanelContainer.current; // Get the current sidePanel component

        if (!sidePanel) return;
        if(!pages || (!pages.dataset.powerPlantsSynced && powerPlants)){ // If the pages haven't been created yet, or data just loaded
            if (pages) sidePanel.replaceChildren()
            const newPages = createPages(powerPlants, regionalData,
                (values, bounds) => setYearFilter([values, bounds]),
                (values, bounds) => setGenerationFilter([values, bounds])
            )
            if (powerPlants) newPages.dataset.powerPlantsSynced = "true"
            setPages(newPages)
            return
        }else{ // The pages exists

            // Hide/show loop
            for(var i = 0; i < sidePanelPage.visibleHtmlElements.length; i++){
                if(sidePanelPage.visibleHtmlElements[i]){
                    if(pages.children[i].classList[0] == "sidePanelInstructionsContainer"){
                        pages.children[i].style.display = "block"
                    }else{
                        pages.children[i].style.display = "flex"
                    }
                }else{
                    pages.children[i].style.display = "none"
                }
            }

            // Add eventlisteners to rollups
            const sidePanelRegionFilter = pages.children[8].children[0]
            const sidePanelFuelFilter = pages.children[9].children[0]

            const sidePanelRegionHeader = sidePanelRegionFilter.children[0]
            const sidePanelFuelHeader = sidePanelFuelFilter.children[0]

            sidePanelRegionHeader.onclick = () => handleRollupClick(sidePanelRegionFilter, [sidePanelFuelFilter])
            sidePanelFuelHeader.onclick = () => handleRollupClick(sidePanelFuelFilter, [sidePanelRegionFilter])

            // Fill drop down windows
            const regionDropDown = sidePanelRegionFilter.children[1]
            if(regionDropDown.children.length == 0){
                for(let i = 0; i < regionFilter.length; i++){
                    const region = regionFilter[i] // Used for easier access

                    const toggle = document.createElement("div")
                    toggle.classList.add("filterLegend")

                    /*Use checkmark instead*/
                    const checkBox = document.createElement("div")
                    checkBox.classList.add("legendColour", "sidePanelFilterColour")
                    checkBox.style.backgroundColor = "#11658C"

                    const name = document.createElement("p")
                    name.classList.add("legendName", "sidePanelFilterName")
                    name.textContent = region.country_long

                    toggle.onclick = () => handleToggleClick(region.country); // Filters the data points on the map according to regionFilter state
                    toggle.appendChild(checkBox)
                    toggle.appendChild(name) // Append the text to the legend element
                    regionDropDown.appendChild(toggle) // Append the legend to the filter container
                }
            }


            const fuelDropDown = sidePanelFuelFilter.children[1]
            if(fuelDropDown.children.length == 0){
                for(let i = 0; i < fuelFilter.length; i++){
                    const fuel = fuelFilter[i] // Used for easier access

                    // Create legend element
                    const legend = document.createElement("div")
                    legend.classList.add("filterLegend")

                    // Create colour box for legend element
                    const colour = document.createElement("div")
                    colour.classList.add("legendColour", "sidePanelFilterColour")
                    colour.style.backgroundColor = fuel.colour

                    // Create text for legend element
                    const label = document.createElement("p")
                    label.classList.add("legendName", "sidePanelFilterName")
                    label.textContent = fuel.fuel

                    legend.onclick = () => handleLegendClick(fuel.fuel); // Filters the data points on the map according to fuelFilter state
                    legend.appendChild(colour) // Append the colour box to the legend element
                    legend.appendChild(label) // Append the text to the legend element
                    fuelDropDown.appendChild(legend) // Append the legend to the filter container
                }
            }


            // Add navigation and colour correct icon
            const navigationBar = pages.lastChild
            for(let i = 0; i < navigationBar.children.length; i++){
                const icon = navigationBar.children[i]
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
        
    }, [sidePanelPage,pages, fuelFilter, regionFilter, regionalData, powerPlants])

    return(<>
        <div id={fuelFilterDef.id} ref={filterContainer} style={{
            width: fuelFilterDef.width,
            height: fuelFilterDef.height,
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
    </>)
}

export default PrimaryPanels

function createPages(powerPlants, regionalData, onYearChange, onGenerationChange){
    /*--[Plan]--*/
    // - The different filters, ensure these are stae-based, so that the filter parameters are saved when page is changed
    // - This also goes for the counter showing the number of displayed power plants
    // - The container for the instruction text, change text for each page and just hide it for the home page and info-page
    // - The smaller title used in each instruction page, change text for each page and hide on home page and info-page
    // - Large title, show only on home page, hide on in rest
    // - Entire info page will be unique
    // - Navigation bar is freestanding and will be updated in main function 

    // All of this should preferable be generated from a JSON file or similar, allows for quick addition of additional
    // pages or different languages

    const pageContainer = document.createElement("div")
    pageContainer.classList.add('sidePanelPageContainer')
    
    // Main title and subtitle
    const sidePanelMainTitle = document.createElement("h1")
    const sidePanelSubtitle = document.createElement("h2")
    sidePanelMainTitle.id = "sidePanelMainTitle"
    sidePanelSubtitle.id = "sidePanelSubtitle"
    sidePanelMainTitle.textContent = "Energy Map"
    sidePanelSubtitle.textContent = "Mapping the Pulse of Power"

    // Instruction page titles
    const titleFilters = document.createElement("h2")
    const titleLegends = document.createElement("h2")
    const titleDataCards = document.createElement("h2")
    const titleDataOverview = document.createElement("h2")
    const titleDataCompare = document.createElement("h2")

    titleFilters.classList.add('instructionTitle')
    titleLegends.classList.add('instructionTitle')
    titleDataCards.classList.add('instructionTitle')
    titleDataOverview.classList.add('instructionTitle')
    titleDataCompare.classList.add('instructionTitle')

    titleFilters.textContent = "Energy Map - Filters"
    titleLegends.textContent = "Energy Map - Legends"
    titleDataCards.textContent = "Energy Map - Data Cards"
    titleDataOverview.textContent = "Energy Map - Sweden Overview"
    titleDataCompare.textContent = "Energy Map - Compare Sweden and Denmark"

    // Info page title
    const InfoTitle = document.createElement("h1")
    InfoTitle.id = "InfoTitle"
    InfoTitle.textContent = "Info"

    // Filter drop downs
    const regionFilterContainer = document.createElement("div")
    const sourceFilterContainer = document.createElement("div")
    const yearFilterContainer = document.createElement("div")
    const generatedFilterContainer = document.createElement("div")

    regionFilterContainer.classList.add('sidePanelFilterContainer')
    sourceFilterContainer.classList.add('sidePanelFilterContainer')
    yearFilterContainer.classList.add('sidePanelFilterContainer')
    generatedFilterContainer.classList.add('sidePanelFilterContainer')

    // Drop downs
    regionFilterContainer.appendChild(getDropDown("region"))
    sourceFilterContainer.appendChild(getDropDown("fuel"))

    // Sliders
    yearFilterContainer.appendChild(getSliders("year", regionalData, onYearChange))
    generatedFilterContainer.appendChild(getSliders("generated", regionalData, onGenerationChange))

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

    // Instruction containers / Info text
    const filtersPageContainer = getInstructions("filter")
    const legendsPageContainer = getInstructions("legends")
    const dataCardsPageContainer = getInstructions("dataCards")
    const overviewPageContainer = getInstructions("overview")
    const comparePageContainer = getInstructions("compare")
    const infoPageContainer = getInstructions("info")


    // Navigation bar at bottom of side panel
    const navigationContainer = document.createElement("div")
    navigationContainer.id = "navigationBarContainer"

    for(let i = 0; i<7;i++){
        const icon = document.createElement("img")
        if(i==0){
            icon.src = assetSources.sidePanelHome
            icon.classList.add("navigationBarIconLarge")
        }else if(i==6){
            icon.src = assetSources.sidePanelInfo
            icon.classList.add("navigationBarIconLarge")
        }else{
            icon.src = assetSources.sidePanelInstructions
            icon.classList.add("navigationBarIconSmall")
        }
        icon.id = "navigationID" + i
        navigationContainer.appendChild(icon)
    }    

    // Append elements
    pageContainer.appendChild(sidePanelMainTitle)
    pageContainer.appendChild(sidePanelSubtitle)

    pageContainer.appendChild(titleFilters)
    pageContainer.appendChild(titleLegends)
    pageContainer.appendChild(titleDataCards)
    pageContainer.appendChild(titleDataOverview)
    pageContainer.appendChild(titleDataCompare)

    pageContainer.appendChild(InfoTitle)

    pageContainer.appendChild(regionFilterContainer)
    pageContainer.appendChild(sourceFilterContainer)
    pageContainer.appendChild(yearFilterContainer)
    pageContainer.appendChild(generatedFilterContainer)

    pageContainer.appendChild(filterCounter)

    pageContainer.appendChild(filtersPageContainer)
    pageContainer.appendChild(legendsPageContainer)
    pageContainer.appendChild(dataCardsPageContainer)
    pageContainer.appendChild(overviewPageContainer)
    pageContainer.appendChild(comparePageContainer)
    pageContainer.appendChild(infoPageContainer)

    pageContainer.appendChild(navigationContainer)

    return pageContainer
}

// Creates the drop downs found in the side panel
function getDropDown(filter){
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

    if(filter == "region"){
        title.textContent = "All Regions"
    }else{ // fuel
        title.textContent = "All Power Sources"
    }

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

    if(filter=="year"){
        textSliderTitle.textContent = "Year Started"
    }else{
        textSliderTitle.textContent = "Electricity Generated per Year"
    }

    textField.appendChild(textMin)
    textField.appendChild(textSliderTitle)
    textField.appendChild(textMax)

    sliderContainer.appendChild(textField)

    const minMax = (() => {
        let minVal = 0, maxVal = 100
        if (regionalData.length) {
            if (filter === "year") {
                const minYears = regionalData
                    .map(y => y.oldest_power_plant)
                    .filter(y => y != null)
                const maxYears = regionalData
                    .map(y=> y.newest_power_plant)
                    .filter(y => y != null)
                if (minYears.length && maxYears.length) { minVal = Math.min(...minYears); maxVal = Math.floor(Math.max(...maxYears)) }
            } else {
                var largest = Number.NEGATIVE_INFINITY;
                var smallest = Number.POSITIVE_INFINITY;

                const minGeneration = regionalData
                    .map(y => y.regional_min_output)

                const maxGeneration = regionalData
                    .map(y => y.regional_max_output)

                minGeneration.forEach((c) =>{
                    let values = Object.values(c).filter(g => g != null)
                    let min = 0;
                    if(values.length){
                        min = Math.min(...values)
                        if(min < smallest){
                            smallest = min
                        }
                    }
                })

                maxGeneration.forEach((c) =>{
                    let values = Object.values(c).filter(g => g != null)
                    let max = 0;
                    if(values.length){
                        max = Math.max(...values)
                        if(max > largest){
                            largest = max
                        }
                    }
                })

                minVal = Math.floor(smallest)
                maxVal = Math.floor(largest)
            }
        }
        return { minVal, maxVal }
    })()
    const minVal = minMax.minVal
    const maxVal = minMax.maxVal
    let valueMin = minMax.minVal
    let valueMax = minMax.maxVal

    textMin.textContent = (minVal<10000)? minVal : ((minVal / 100) / 10.0).toFixed(1) + " k"
    textMax.textContent = (maxVal<10000)? maxVal : ((maxVal / 100) / 10.0).toFixed(1) + " k"

    const updateSlider = () => {
        const span = maxVal - minVal
        const percentageMin = ((valueMin - minVal) / span) * 100
        const percentageMax = ((valueMax - minVal) / span) * 100
        thumbMin.style.left = percentageMin + "%"
        thumbMinText.textContent = (valueMin<10000)? valueMin : ((valueMin / 100) / 10.0).toFixed(1) + " k"
        thumbMaxText.textContent = (valueMax<10000)? valueMax : ((valueMax / 100) / 10.0).toFixed(1) + " k"
        thumbMax.style.left = percentageMax + "%"
        range.style.left = percentageMin + "%"
        range.style.width = (percentageMax - percentageMin) + "%"
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
                if (isMin) {
                    valueMin = Math.min(value, valueMax - 1)
                } else {
                    valueMax = Math.max(value, valueMin + 1)
                }
                updateSlider()
            }

            const onEnd = () => {
                document.removeEventListener("mousemove", onMove)
                document.removeEventListener("mouseup", onEnd)
                document.removeEventListener("touchmove", onMove)
                document.removeEventListener("touchend", onEnd)
    if (onChange) onChange([valueMin, valueMax], [minVal, maxVal])
            }

            document.addEventListener("mousemove", onMove)
            document.addEventListener("mouseup", onEnd)
            document.addEventListener("touchmove", onMove, { passive: false })
            document.addEventListener("touchend", onEnd)
        }

        thumb.addEventListener("mousedown", onStart)
        thumb.addEventListener("touchstart", onStart, { passive: false })
    }

    makeDraggable(thumbMin, true)
    makeDraggable(thumbMax, false)
    updateSlider()
    if (onChange) onChange([valueMin, valueMax], [minVal, maxVal])

    return sliderContainer
}

// This entire function will be rewritten to better suit JSON data (and shorten it)
function getInstructions(page){
    const container = document.createElement("div")
    container.classList.add('sidePanelInstructionsContainer')

    const title = document.createElement("h2")
    const introText = document.createElement("p")
    title.classList.add('instructionsTitle')
    introText.classList.add('instructionsIntro')

    const stepsTitle = document.createElement("h3")
    const stepsList = document.createElement("ul")
    stepsTitle.classList.add('instructionStepsTitle')
    stepsList.classList.add('instructionStepsList')

    // List items
    const firstItem = document.createElement("li") // First item in list
    const secondItem = document.createElement("li") // Second item in list
    const thirdItem = document.createElement("li") // Third item in list
    const fourthItem = document.createElement("li") // Fourth item in list
    const fifthItem = document.createElement("li") // Fifth item in list
    const sixthItem = document.createElement("li") // Sixth item in list

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

    switch(page){
        case "filter":
            title.textContent = "Filter your map view"
            introText.textContent = "Use the drop-downs and sliders to filter what is shown on the map to filter what is shown on the map."
            stepsTitle.textContent = "Try these steps:"

            // Instructions for this page
            firstItem.appendChild(makeTitle('Choose a place: '))
            firstItem.appendChild(makeStandard('Tap the top drop-down list to select '))
            firstItem.appendChild(makeHighlight('regions'))
            firstItem.appendChild(makeStandard(', like Sweden, Norway, and others.'))
            stepsList.appendChild(firstItem)

            secondItem.appendChild(makeTitle('Choose a place: '))
            secondItem.appendChild(makeStandard('Tap the second drop-down list to select different '))
            secondItem.appendChild(makeHighlight('power sources'))
            secondItem.appendChild(makeStandard('.'))
            stepsList.appendChild(secondItem)

            thirdItem.appendChild(makeTitle('Select a time range: '))
            thirdItem.appendChild(makeStandard('Drag the handles on the '))
            thirdItem.appendChild(makeHighlight('year started '))
            thirdItem.appendChild(makeStandard('slider to select a specific time period.'))
            stepsList.appendChild(thirdItem)

            fourthItem.appendChild(makeTitle('Select plants by size: '))
            fourthItem.appendChild(makeStandard('Drag the '))
            fourthItem.appendChild(makeHighlight('electricity generated per year '))
            fourthItem.appendChild(makeStandard('slider to filter out smaller and larger stations and see only the middle-range power generators.'))
            stepsList.appendChild(fourthItem)

            break;
        case "legends":
            title.textContent = "Reading the Map"
            introText.textContent = "The coloured circles on the map show individual power plants scattered across the landscape."
            stepsTitle.textContent = "How to read the symbols:"

            // Instructions for this page
            firstItem.appendChild(makeTitle('Circle size (capacity): '))
            firstItem.appendChild(makeStandard('Bigger circles represent major power stations that generate large amounts of electicity, while smaller dots represent smaller stations.'))

            secondItem.appendChild(makeTitle('Circle colour (energy source): '))
            secondItem.appendChild(makeStandard('Each colour stands for a different type of energy. Check the map legend for the full list.'))

            // Append list items to list
            stepsList.appendChild(firstItem)
            stepsList.appendChild(secondItem)
            break;
        case "dataCards":
            title.textContent = "Compare Power Plant Details"
            introText.textContent = "Tap on the map to open data cards and compare information across different power plants."
            stepsTitle.textContent = "Try these steps:"

            // Instructions for this page
            firstItem.appendChild(makeTitle('Open a card: '))
            firstItem.appendChild(makeStandard('Tap any circle on the map to view its specific '))
            firstItem.appendChild(makeHighlight('data panel'))
            firstItem.appendChild(makeStandard('.'))

            secondItem.appendChild(makeTitle('Review the data: '))
            secondItem.appendChild(makeStandard("Check the panel to see the facility's location, year started, and annual energy output."))

            thirdItem.appendChild(makeTitle('Compare side-by-side: '))
            thirdItem.appendChild(makeStandard('Tap another circle on the map. The new data panel will open next to the first one for direct comparison.'))
            
            fourthItem.appendChild(makeTitle('Compare the mix: '))
            fourthItem.appendChild(makeStandard('Tap the '))
            fourthItem.appendChild(makeHighlight('arrow next to the region '))
            fourthItem.appendChild(makeStandard('on the data card to open the '))
            fourthItem.appendChild(makeHighlight('regional overview panel '))
            fourthItem.appendChild(makeStandard('to see the percentages of wind, water, and other sources of the region.'))

            fifthItem.appendChild(makeTitle('Close a panel: '))
            fifthItem.appendChild(makeStandard('Tap the "'))
            fifthItem.appendChild(makeHighlight('X'))
            fifthItem.appendChild(makeStandard('" in the corner of any data card to remove it from your screen.'))
            
            // Append list items to list
            stepsList.appendChild(firstItem)
            stepsList.appendChild(secondItem)
            stepsList.appendChild(thirdItem)
            stepsList.appendChild(fourthItem)
            stepsList.appendChild(fifthItem)
            break;
        case "overview":
            title.textContent = "What powers Sweden?"
            introText.textContent = "Explore how Swedish power plants catch the energy of nature to keep your lights on."
            stepsTitle.textContent = "Try these steps:"

            // Instructions for this page
            firstItem.appendChild(makeTitle('Find your region: '))
            firstItem.appendChild(makeStandard('Tap the top '))
            firstItem.appendChild(makeHighlight('region dropdown '))
            firstItem.appendChild(makeStandard('and select '))
            firstItem.appendChild(makeTitle('Sweden'))
            firstItem.appendChild(makeStandard('.'))

            secondItem.appendChild(makeTitle('Select your source: '))
            secondItem.appendChild(makeStandard('Switch the '))
            secondItem.appendChild(makeHighlight('power source dropdown '))
            secondItem.appendChild(makeStandard('to '))
            secondItem.appendChild(makeTitle('wind '))
            secondItem.appendChild(makeStandard('or '))
            secondItem.appendChild(makeTitle('water '))
            secondItem.appendChild(makeStandard('to see where they are on the map.'))

            thirdItem.appendChild(makeTitle('Change the time range: '))
            thirdItem.appendChild(makeStandard('Drag the '))
            thirdItem.appendChild(makeHighlight('year started slider '))
            thirdItem.appendChild(makeStandard('to see how the plants grew over the decades.'))

            fourthItem.appendChild(makeTitle('Find your local source: '))
            fourthItem.appendChild(makeStandard('Tap a large '))
            fourthItem.appendChild(makeHighlight('circle '))
            fourthItem.appendChild(makeStandard('near your city to see its opening year and annual energy output.'))

            fifthItem.appendChild(makeTitle('Open the reginal overview: '))
            fifthItem.appendChild(makeStandard('Tap the '))
            fifthItem.appendChild(makeHighlight('arrow next to the region '))
            fifthItem.appendChild(makeStandard('to open the '))
            fifthItem.appendChild(makeHighlight('regional overview panel '))
            fifthItem.appendChild(makeStandard('to read about the energy sources and total capacity of '))
            fifthItem.appendChild(makeTitle('Sweden'))
            fifthItem.appendChild(makeStandard('.'))

            // Append list items to list
            stepsList.appendChild(firstItem)
            stepsList.appendChild(secondItem)
            stepsList.appendChild(thirdItem)
            stepsList.appendChild(fourthItem)
            stepsList.appendChild(fifthItem)
            break;
        case "compare":
            title.textContent = "Why does Sweden and Denmark use different energy sources?"
            introText.style.display = "none" // No text for this part of the page
            stepsTitle.textContent = "Follow these steps to see how geography shapes energy:"

            // Instructions for this page
            firstItem.appendChild(makeTitle('Filter by regions: '))
            firstItem.appendChild(makeStandard('Use the '))
            firstItem.appendChild(makeHighlight('region dropdown '))
            firstItem.appendChild(makeStandard('to show plants in Sweden and Denmark on the map.'))

            secondItem.appendChild(makeTitle('Compare side-by-side: '))
            secondItem.appendChild(makeStandard('Look at the dominant colors in each country, and see what energy source they represent.'))

            thirdItem.appendChild(makeTitle('Compare data: '))
            thirdItem.appendChild(makeStandard('Tap a plant in each region to open its '))
            thirdItem.appendChild(makeHighlight('data card'))
            thirdItem.appendChild(makeStandard(', then open and read the '))
            thirdItem.appendChild(makeHighlight('regional overview'))
            thirdItem.appendChild(makeStandard('.'))

            fourthItem.appendChild(makeTitle('See the difference: '))
            fourthItem.appendChild(makeStandard('Notice how Sweden’s rivers favor hydropower, while Denmark’s flat coasts favor wind energy.'))

            fifthItem.appendChild(makeTitle('Explore changes over time: '))
            fifthItem.appendChild(makeStandard('Adjust the '))
            fifthItem.appendChild(makeHighlight('year slider '))
            fifthItem.appendChild(makeStandard('how wind and water power expanded over the decades.'))

            sixthItem.appendChild(makeTitle('Finding the "giants": '))
            sixthItem.appendChild(makeStandard('Slide the '))
            sixthItem.appendChild(makeHighlight('electricity generation filter '))
            sixthItem.appendChild(makeStandard('to high to locate the country’s most powerful energy stations.'))

            // Append list items to list
            stepsList.appendChild(firstItem)
            stepsList.appendChild(secondItem)
            stepsList.appendChild(thirdItem)
            stepsList.appendChild(fourthItem)
            stepsList.appendChild(fifthItem)
            stepsList.appendChild(sixthItem)
            break;
        case "info":
            title.textContent = "Introduction"

            const firstParagraph = document.createElement("p")
            const secondParagraph = document.createElement("p")
            const thirdParagraph = document.createElement("p")

            firstParagraph.classList.add('instructionsIntro')
            secondParagraph.classList.add('instructionsIntro')
            thirdParagraph.classList.add('instructionsIntro')

            firstParagraph.textContent = "This PhD research project visualizes the distribution and capacity of power plants worldwide. It transforms complex energy data into an interactive map, revealing how our planet stays powered. Explore the hidden infrastructure that sustains modern society across every continent."
            secondParagraph.textContent += "By tapping individual data points, you can access specific details about any plant on the map. Use the built-in filters to compare different energy sources. \n"
            thirdParagraph.textContent += "The Story Mode will walk you through the tool’s features while highlighting key trends in global energy. Discover the balance of power that shapes our international communities today. \n"
            
            const secondTitle = document.createElement("h2")
            secondTitle.classList.add('instructionsTitle')
            secondTitle.textContent = "Source of Information"

            const sourceOfData = document.createElement("p")
            sourceOfData.classList.add('instructionsIntro')
            sourceOfData.textContent = "https://www.wri.org/research/global-database-power-plants"
            
            container.appendChild(title)
            container.appendChild(firstParagraph)
            container.appendChild(secondParagraph)
            container.appendChild(thirdParagraph)
            container.appendChild(secondTitle)
            container.appendChild(sourceOfData)

            break;
        default:
            break;
    }
    if(page == "info"){
        return container
    }else{
        container.appendChild(title)
        container.appendChild(introText)
        container.appendChild(stepsTitle)
        container.appendChild(stepsList)
        return container
    }
}
