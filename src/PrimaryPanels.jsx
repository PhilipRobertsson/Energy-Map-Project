import { useState, useEffect, useRef, useContext, createElement } from 'react'
import * as d3 from "d3";

import { MapContext } from './Map.jsx'

import './PrimaryPanels.css'
import { typeOf } from 'maplibre-gl';

// Definition for the filter panel
const fuelFilterDef = {
    id: "fuelFilter",
    position: ["absolute", null, null, 0, 0], // Bottom left corner, css -> [position, top, right, bottom, left]
};

// Definition for the side panel
const sidePanelDef ={
    id: "sidePanel",
    width: 25 + "dvw", // 25% of screen height
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
    sidePanelCheckMark: "./sidePanel/sidePanelCheckMark.svg"
};

// Used to filter out fuels which either are too uncommon or unimportant for the visualization
const otherFuels =[
    "Petcoke", "Wave and Tidal", "Tidal",
    "Geothermal", "Cogeneration", "Storage",
    "Biomass", "Waste", "Other"
];

// The different pages on the instruction page
const allPages = [
    {id: 0, visibleHtmlElements: [true, true, false, false, false, false, false, false, true, true, true, true, true, false, false, false, false,false,false, true]},
    {id: 1, visibleHtmlElements: [false, false, true, false, false, false, false, false, true, true, true, true, true, true, false, false, false,false,false, true]},
    {id: 2, visibleHtmlElements: [false, false, false, true, false, false, false, false, true, true, true, true, true, false, true, false, false,false,false, true]},
    {id: 3, visibleHtmlElements: [false, false, false, false, true, false, false, false, true, true, true, true, true, false, false, true, false,false,false, true]},
    {id: 4, visibleHtmlElements: [false, false, false, false, false, true, false, false, true, true, true, true, true, false, false, false, true,false,false, true]},
    {id: 5, visibleHtmlElements: [false, false, false, false, false, false, true, false, true, true, true, true, true, false, false, false, false,true,false, true]},
    {id: 6, visibleHtmlElements: [false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, false, false,false,true, true]},
];

const _firstYearOfGenerationData = 2013;
const _latestYearOfGenerationData = 2019;
const _firstYearOfEstimatedGenerationData = 2013;
const _latestYearOfEstimatedGenerationData = 2017;

function PrimaryPanels() {
    const { mapRef, powerPlants, barChartFilter, setBarChartFilter, popupCount } = useContext(MapContext);
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

    fetch("./instructions.json")
      .then((response) => response.json())
      .then((data) => {
        setPageContent(data);
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
        if (!filter || !regionFilter.length ||!fuelFilter.length || !yearFilter.length || !generationFilter.length || !powerPlants) return;
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
        zoomSelection.classList.add("controlIcon")
        zoomSelection.src = assetSources.zoomSelection
        zoomSelection.onclick = () =>  handleZoomSelection(zoomSelection)

        const pps = getShownPowerPlants(powerPlants, regionFilter, fuelFilter, yearFilter,generationFilter)
        if (zoomSelectionState.current.isSelection ||
             powerPlants.features.length != 
             pps.length) {
          zoomSelection.classList.add("selection")
        } else {
          zoomSelection.src = assetSources.zoomFullScreen
        }

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

    // Handle clicks on the seperate legends
    function handleLegendClick(clickedFuel){
        if (clickedFuel === "all") {
            setBarChartFilter(null)
        } else {
            setBarChartFilter(prev => {
                if (!prev) return prev
                return prev.filter(f => f !== clickedFuel)
            })
        }
        setFuelFilter(prev => { // prev, previous filter
            const selectAllOption = sidePanel.children[0].children[9].querySelectorAll(".filterLegend")[0]; // Easy acess to the select all fuels option
            if (prev.every(f => f.show)) { // Are all options shown?
                selectAllOption.children[1].textContent = "Select all fuels"
                selectAllOption.children[0].style.backgroundColor = "#F2FBFF"
                if(clickedFuel == "all"){
                    return prev.map(f => ({ ...f, show: false}));
                }
                return prev.map(f => ({ ...f, show: f.fuel === clickedFuel })); // If true, deselect everything but the clicked option
            }

            const toggled = prev.map(f =>
                f.fuel === clickedFuel ? { ...f, show: !f.show } : f // Deselect or select the clicked option
            );
            if(clickedFuel == "all"){
                    selectAllOption.children[1].textContent = "Deselect all fuels"
                    selectAllOption.children[0].style.backgroundColor = "#11658C"
                    return prev.map(f => ({ ...f, show: true}));
            }

            if (toggled.every(f => !f.show)) { // Are all options hidden?
                selectAllOption.children[1].textContent = "Deselect all fuels"
                selectAllOption.children[0].style.backgroundColor = "#11658C"
                return prev.map(f => ({ ...f, show: true })); // If true, select everything 
            }
            return toggled;
        });
    }

    // Handle clicks on the seperate country toggles
    function handleToggleClick(clickedCountry){
        setRegionFilter(prev => { // prev, previous filter
            const selectAllOption = sidePanel.children[0].children[8].querySelectorAll(".filterLegend")[0]; // Easy acess to the select all regions option
            if (prev.every(r => r.show)) { // Are all options shown?
                selectAllOption.children[1].textContent = "Select all regions"
                selectAllOption.children[0].style.backgroundColor = "#F2FBFF"
                if(clickedCountry == "all"){
                    return prev.map(f => ({ ...f, show: false}));
                }
                return prev.map(r => ({ ...r, show: r.country === clickedCountry })); // If true, deselect everything but the clicked option
            }

            const toggled = prev.map(r =>
                r.country === clickedCountry ? { ...r, show: !r.show } : r // Deselect or select the clicked option
            );

            if(clickedCountry == "all"){
                    selectAllOption.children[1].textContent = "Deselect all regions"
                    selectAllOption.children[0].style.backgroundColor = "#11658C"
                    return prev.map(r => ({ ...r, show: true}));
            }
            if (toggled.every(r => !r.show)) { // Are all options hidden?
                selectAllOption.children[1].textContent = "Deselect all regions"
                selectAllOption.children[0].style.backgroundColor = "#11658C"
                return prev.map(r => ({ ...r, show: true })); // If true, select everything 
            }
            return toggled;
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
            element.parentElement.style['border-radius'] = "1dvh 1dvh 0 0";
            element.parentElement.style['z-index'] = "100" // Arbitrary value to show it on top
        }else{ // Close the rollup
            element.children[0].children[1].src = assetSources.sidePanelRollupOpen
            element.parentElement.style['border-radius'] = "1dvh";
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
        if (!sidePanel || !sidePanel.children.length || !fuelFilter.length || !regionFilter.length) return; // If id does not exsist don't update anything
        const legendsSidePanel = sidePanel.children[0].children[9].querySelectorAll(".filterLegend"); // Find all legends
        const toggleSidePanel = sidePanel.children[0].children[8].querySelectorAll(".filterLegend");
        const bars = document.querySelectorAll(".barchartContainer");

        const fuelFilterDropDownTitle = sidePanel.children[0].querySelectorAll(".sidePanelFilterTitle")[1]
        const regionFilterDropDownTitle = sidePanel.children[0].querySelectorAll(".sidePanelFilterTitle")[0]

        const shownFuels = fuelFilter.filter((fuel) => fuel.show)
        const shownRegions = regionFilter.filter((region) => region.show)

        if(shownFuels.length == (legendsSidePanel.length - 1)){
            fuelFilterDropDownTitle.textContent = "All Power Sources"
        }else if(shownFuels.length == 0){
            fuelFilterDropDownTitle.textContent = "No power sources selected"
        }else{
            var newFuelTitle = getNewDropDownTitle(shownFuels, "fuel")
            fuelFilterDropDownTitle.textContent = newFuelTitle
        }

        if(shownRegions.length == (toggleSidePanel.length - 1)){
            regionFilterDropDownTitle.textContent = "All Regions"
        }else if(shownRegions.length == 0){
            regionFilterDropDownTitle.textContent = "No regions selected"
        }else{
            var newRegionTitle = getNewDropDownTitle(shownRegions, "region")
            regionFilterDropDownTitle.textContent = newRegionTitle
        }

        if(bars.length){
            for(var i = 0; i < bars.length; i++){
                let children = Array.from(bars[i].children)
                children.forEach(c =>{
                    let cName = c.classList.value
                    if(cName.includes("bar_") && shownFuels.some(f => f.fuel == cName.slice(4)) && shownFuels.length < (legendsSidePanel.length - 1)){
                        c.style.stroke = "#11658C"
                        c.style.strokeWidth = "0.2dvh"
                    }else{
                        c.style.stroke = "unset"
                        c.style.strokeWidth = "unset"
                    }
                })
            }
        }

        fuelFilter.forEach((fuel, i) => {
            if (legendsSidePanel[i+1]) { // If legend exists, +1 to skip select all option
                legendsSidePanel[i+1].style.opacity = fuel.show ? "1" : "0.3"; // Set oppacity based on filter settings
            }
        });
        regionFilter.forEach((region, i)=>{
            if(toggleSidePanel[i+1]){
                toggleSidePanel[i+1].style.opacity = region.show ? "1" : "0.3";
                toggleSidePanel[i+1].children[0].children[0].style.opacity = region.show ? "1" : "0.0";
            }
        })
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
            const newPages = createPages(pageContent, powerPlants, regionalData,
                (values, bounds) => setYearFilter([values, bounds]),
                (values, bounds) => setGenerationFilter([values, bounds])
            )
            if (powerPlants){newPages.dataset.powerPlantsSynced = "true"}
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

                let selectAllField = document.createElement("div")
                selectAllField.classList.add("filterLegend", "selectAllDropdown")

                let selectAllCheckBox = document.createElement("div")
                selectAllCheckBox.classList.add("legendColour", "sidePanelFilterColour")
                selectAllCheckBox.style.backgroundColor = "#11658C"

                let selectAllName = document.createElement("p")
                selectAllName.classList.add("legendName", "sidePanelFilterName")
                selectAllName.textContent = "Deselect all regions"

                selectAllField.onclick = () => handleToggleClick("all"); // Selects all regions on click
                selectAllField.appendChild(selectAllCheckBox)
                selectAllField.appendChild(selectAllName) // Append the text to the legend element
                regionDropDown.appendChild(selectAllField) // Append the legend to the filter container

                for(let i = 0; i < regionFilter.length; i++){
                    const region = regionFilter[i] // Used for easier access

                    const toggle = document.createElement("div")
                    toggle.classList.add("filterLegend")

                    /*Use checkmark instead*/
                    const checkBox = document.createElement("div")
                    checkBox.classList.add("legendColour", "sidePanelFilterColour")
                    checkBox.style.backgroundColor = "#11658C"

                    const checkMark = document.createElement("img")
                    checkMark.classList.add("legendCheck")
                    checkMark.src = assetSources.sidePanelCheckMark

                    checkBox.appendChild(checkMark)

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

                let selectAllField = document.createElement("div")
                selectAllField.classList.add("filterLegend", "selectAllDropdown")

                let selectAllCheckBox = document.createElement("div")
                selectAllCheckBox.classList.add("legendColour", "sidePanelFilterColour")
                selectAllCheckBox.style.backgroundColor = "#11658C"

                let selectAllName = document.createElement("p")
                selectAllName.classList.add("legendName", "sidePanelFilterName")
                selectAllName.textContent = "Deselect all fuels"

                selectAllField.onclick = () => handleLegendClick("all"); // Selects all regions on click
                selectAllField.appendChild(selectAllCheckBox)
                selectAllField.appendChild(selectAllName) // Append the text to the legend element
                fuelDropDown.appendChild(selectAllField) // Append the legend to the filter container


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
        
    }, [sidePanelPage,pages, fuelFilter, regionFilter, regionalData, powerPlants, pageContent])

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
    </>)
}

export default PrimaryPanels

function getShownPowerPlants(pps, rFilter, fFilter, yFilter, gFilter){
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

function createPages(pageContent, powerPlants, regionalData, onYearChange, onGenerationChange){
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
    const filtersPageContainer = getInstructions(pageContent, 0)
    const legendsPageContainer = getInstructions(pageContent, 1)
    const dataCardsPageContainer = getInstructions(pageContent, 2)
    const overviewPageContainer = getInstructions(pageContent, 3)
    const comparePageContainer = getInstructions(pageContent, 4)
    const infoPageContainer = getInstructions(pageContent, 5)


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
            if(content.title){ // If the page contains a title
                const title = document.createElement("h2")
                title.classList.add('instructionsTitle')
                title.textContent = content.title
                container.appendChild(title)
            }

            if(content.introText){ // If the page contains an intro text
                const introText = document.createElement("p")
                introText.classList.add('instructionsIntro')
                introText.textContent = content.introText
                container.appendChild(introText)
            }

            if(content.stepsTitle){ // If the page contains a steps title
                const stepsTitle = document.createElement("h3")
                stepsTitle.classList.add('instructionStepsTitle')
                stepsTitle.textContent = content.stepsTitle
                container.appendChild(stepsTitle)
            }

            if(content.stepsItems){ // If the page contains a list of steps
                const stepsList = document.createElement("ul")
                stepsList.classList.add('instructionStepsList')
                content.stepsItems.forEach(item =>{
                    let collector = document.createElement("li")
                    item.forEach(s =>{
                        collector.appendChild(eval('make'+s[0]+'("'+s[1]+'")'))
                    })
                    stepsList.appendChild(collector)
                })
                container.append(stepsList)
            }

            if(content.paragraphs){ // If the page contains paragraphs
                content.paragraphs.forEach(p =>{
                    const paragraph = document.createElement("p")
                    paragraph.classList.add('instructionsIntro')
                    paragraph.textContent = p
                    container.append(paragraph)
                })
            }

            if(content.secondTitle){ // If the page contains a second title
                const secondTitle = document.createElement("h2")
                secondTitle.classList.add('instructionsTitle')
                secondTitle.textContent = content.secondTitle
                container.appendChild(secondTitle)
            }

            if(content.secondParagraphs){ // If the page contains a second set of paragraphs
                content.secondParagraphs.forEach(p =>{
                    const secondParagraph = document.createElement("p")
                    secondParagraph.classList.add('instructionsIntro')
                    secondParagraph.textContent = p
                    container.append(secondParagraph)
                })
            }
        }
    })
    return container
}
