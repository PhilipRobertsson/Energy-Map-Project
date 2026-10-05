import { createContext, useState, useEffect, useRef, use } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { gsap } from "gsap";

import { createPopUpBarChart, createPopUpUsagePlot,
              getLatestDataArray,makePopUpMovable, toggleSelectionDropDown } from "./popUpUtilites.js";

import './Map.css'

export const MapContext = createContext({ mapRef: null, powerPlants: null, boundaryData: null, barChartFilter: null, setBarChartFilter: null, popupCount: 0, reportedYears: { first: 0, last: 0 }, estimatedYears: { first: 0, last: 0 } });

// Previous mapStyle version
  /*
// Styling for the background map
const mapStyle = {
   version: 8,
  name: "Energy Map Visualization",
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#D8F2FF",
      },
      filter: ["all"],
      layout: {
        visibility: "visible",
      },
      maxzoom: 24,
    },
    {
      id: "coastline",
      source: "maplibre-demotiles",
      "source-layer": "countries",
      type: "line",
      paint: {
        "line-blur": 0.2,
        "line-color": "#198EC8",
        "line-width": {
          stops: [
            [0, 1],
            [6, 4],
            [14, 6],
            [22, 12],
          ],
        },
      },
      filter: ["all"],
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: "visible",
      },
      maxzoom: 24,
    },
    {
      id: "countries-fill",
      source: "maplibre-demotiles",
      "source-layer": "countries",
      type: "fill",
      paint: {
        "fill-color": "#FFF3EB",
      },
      maxzoom: 24,
    },
    {
      id: "countries-boundary",
      type: "line",
      paint: {
        "line-color": "#BFBBAB",
        "line-width": {
          stops: [
            [1, 1],
            [6, 2],
            [14, 6],
            [22, 12],
          ],
        },
        "line-opacity": {
          stops: [
            [3, 0.5],
            [6, 1],
          ],
        },
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: "visible",
      },
      source: "maplibre-demotiles",
      maxzoom: 24,
      "source-layer": "countries",
    },
    {
      id: "countries-label",
      type: "symbol",
      paint: {
        "text-color": "rgba(8, 37, 77, 1)",
        "text-halo-blur": {
          stops: [
            [2, 0.2],
            [6, 0],
          ],
        },
        "text-halo-color": "rgba(255, 255, 255, 1)",
        "text-halo-width": {
          stops: [
            [2, 1],
            [6, 1.6],
          ],
        },
      },
      filter: ["all"],
      layout: {
        "text-font": ["Open Sans Semibold"],
        "text-size": {
          stops: [
            [2, 10],
            [4, 12],
            [6, 16],
          ],
        },
        "text-field": {
          stops: [
            [2, "{ABBREV}"],
            [4, "{NAME}"],
          ],
        },
        visibility: "visible",
        "text-max-width": 10,
        "text-transform": {
          stops: [
            [0, "uppercase"],
            [2, "none"],
          ],
        },
      },
      source: "maplibre-demotiles",
      maxzoom: 24,
      minzoom: 2,
      "source-layer": "centroids",
    },
  ],
  sources: {
    "maplibre-demotiles": {
      type: "vector",
      url: "https://demotiles.maplibre.org/tiles/tiles.json",
    },
  },
}; */

// Styling for the points representing each power plant
const powerPlantPaint = {
  'circle-radius': ['interpolate', ['linear'], ['zoom'],
    4, ['interpolate', ['linear'], ['to-number', ['get', 'capacity_mw']], // Zoom level 4
        0,   4, // 0 - 99 capacity, 4px radii
        100, 6, // 100 - 999 capacity, 6px radii
        1000, 8, // 1000 - 4999 capacity, 8px radii
        5000, 14 // 5000+ capacity, 14px radii
    ],
    10, ['interpolate', ['linear'], ['to-number', ['get', 'capacity_mw']], // Zoom level 10
        0,   4, // 0 - 99 capacity, 4px radii
        100, 8, // 100 - 999 capacity, 8px radii
        1000, 16, // 1000 - 4999 capacity, 16px radii
        5000, 28 // 5000+ capacity, 28px radii
    ],
    18, ['interpolate', ['linear'], ['to-number', ['get', 'capacity_mw']], // Zoom level 18
        0,   8, // 0 - 99 capacity, 8px radii
        100, 16, // 100 - 999 capacity, 16px radii
        1000, 32, // 1000 - 4999 capacity, 32px radii
        5000, 56 // 5000+ capacity, 56px radii
    ]
  ],
  // Static circle radii
  /* [
    'interpolate',
    ['linear'],
    ['zoom'],
    5, 4,   // At zoom 5 (or less), radius is 4 pixels
    12, 20, // At zoom 12, radius is 20 pixels
    20, 80  // At zoom 20 (or greater), radius is 80 pixels
  ], */
  "circle-color": [],
  "circle-stroke-width": 1,
  "circle-stroke-color": "#a19eb6",
};

// Sources for the different svg files stored in the public folder
const assetSources ={
    popupInfo: "./popup/popupInfo.svg",
    popupClose: "./popup/popupClose.svg",
    popupRollupOpened: "./popup/popupRollupOpen.svg",
    popupRollupClosed: "./popup/popupRollupClosed.svg",
    alertIcon: "./sidePanel/sidePanelInfoIcon.svg"
}

// Variables for the timer
// Convert to seconds: 60, Desired reset time in minutes: 5 (default), Convert to miliseconds: 1000
const TIME_IN_MILISECONDS_TO_EXHIBITION_RESET = 60*5*1000;
const INTERVAL_IN_MILISECONDS = 1000;

function Map({ children }) {
  const [data, setData] = useState(null);
  const [boundaryData, setBoundaryData] = useState(null);
  const [filter, setFilter] = useState(null);
  const [popupCount, setPopupCount] = useState(0);
  const [colourData, setColourData] = useState(null);
  const [regionalData, setRegionalData] = useState(null);
  const [reportedYears, setReportedYears] = useState({ first: 0, last: 0 });
  const [estimatedYears, setEstimatedYears] = useState({ first: 0, last: 0 });
  const [shareYears, setShareYears] = useState({ first: 0, last: 0 });
  const [mapReady, setMapReady] = useState(false);
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const [time, setTime] = useState(TIME_IN_MILISECONDS_TO_EXHIBITION_RESET);
  const [referenceTime, setReferenceTime] = useState(Date.now());

  // Load needed data from public folder
  useEffect(() => {
    fetch("./fuelCatagories.json") // Go through this file and ensure the colours have more contrast between one another
      .then((response) => response.json())
      .then((data) => {
            powerPlantPaint["circle-color"] = ["match", ["get", "primary_fuel"]]
            data.forEach(d=>{
                powerPlantPaint["circle-color"].push(d.fuel)
                powerPlantPaint["circle-color"].push(d.colour)
            })
            powerPlantPaint["circle-color"].push("#8E91BC")
            setColourData(data)
      });
    fetch("./global_power_plant_database.geojson")
      .then((response) => response.json())
      .then((powerPlants) => {
        setData(powerPlants);
      });
    fetch("./countryBoundaries.geojson") // TODO: Find different dataset that doesn't mark Crimea as Russian
      .then((response) => response.json())
      .then((boundaries) => {
        setBoundaryData(boundaries);
      });
    fetch("./regionalInformation.json")
      .then((response) => response.json())
      .then((data) => {
        setRegionalData(data);
        // Extract first and last years from reported and estimated data
        const reportedCols = Object.keys(data[0].annual_output_by_fuel).filter(
          (str) => str.indexOf("estimated") === -1
        );
        const estimatedCols = Object.keys(data[0].annual_output_by_fuel).filter(
          (str) => str.indexOf("estimated") >= 0
        );
        const reportedYearValues = reportedCols.map((s) => parseInt(s.replace(/^\D+/g, "")));
        const estimatedYearValues = estimatedCols.map((s) => parseInt(s.replace(/^\D+/g, "")));
        setReportedYears({ first: Math.min(...reportedYearValues), last: Math.max(...reportedYearValues) });
        setEstimatedYears({ first: Math.min(...estimatedYearValues), last: Math.max(...estimatedYearValues) });

        const usageKeys = Object.keys(data[0].usage_shares)
        const dataYears = usageKeys.map((s) => parseInt(s.replace(/^\D+/g, "")))
        setShareYears({first: Math.min(...dataYears), last: Math.max(...dataYears)})
      });
  }, []);

  // Create map instance
  useEffect(() => {
    if (mapInstance.current) return;

    fetch("./mapStyles.json")
      .then((response)=> response.json())
      .then((data) => {
        mapInstance.current = new maplibregl.Map({
          container: mapContainer.current,
          style: data, //mapStyle,
          center: [24.325556, 62.3875],
          zoom: 4.5,
        });

        // disable map rotation using right click + drag
        mapInstance.current.dragRotate.disable();

        // disable map rotation using keyboard
        mapInstance.current.keyboard.disable();

        // disable map rotation using touch rotation gesture
        mapInstance.current.touchZoomRotate.disableRotation();

        // disable map tilting/pitching using touch rotation gesture
        mapInstance.current.touchPitch.disable();
      });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // Pop-up functionality
  useEffect(() => {
    if (!data?.features?.length) return;

    const map = mapInstance.current;
    if (!map) return;

    const displayInformation = (e, mode) =>{
        const coordinates = (mode=="powerPlants")? e.features[0].geometry.coordinates.slice() : e.lngLat;
        const properties = e.features[0].properties;
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        // Check if the clicked power plant has been opened already
        var isOpen = false
        const openPopups = document.querySelectorAll(".maplibregl-popup")
        for(var i = 0; i < openPopups.length; i++){
          let name = openPopups[i].children[1].children[0].textContent
          if(name === properties.name){
            isOpen = true
            break;
          }
        }

        if(openPopups.length < 4 && !isOpen){
          var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
          const popup = new maplibregl.Popup({maxWidth: Math.round(400*scale) + "px", closeButton: false, closeOnClick: false})
            .setLngLat(coordinates)
            .setHTML((mode=="powerPlants")?("<h1>"+ properties.name +"</h1>"):("<h1>"+ properties.name_en +"</h1>"))
            .addTo(map);

          // Pop up rotate X "fade in"
          const contentElement = popup.getElement().children[1]
          gsap.set(contentElement, { rotateX: -90, opacity: 0, transformOrigin: "bottom center" })
          gsap.set(popup.getElement(), { perspective: 800 })
          gsap.to(contentElement, { rotateX: 0, opacity: 1, duration: 0.3, ease: "power2.out",
            onComplete: ()=>{
              const boundingBox = contentElement.getBoundingClientRect();
              const mapWidth = window.screen.width - ((window.screen.height <= 1024)? window.screen.width * 0.30 : window.screen.width * 0.25) - 50
              if(boundingBox.top <= 0 || boundingBox.right >= mapWidth){
                mapInstance.current?.panBy([0, 0], { duration: 1 }) // Work around to reposition pop-ups that are outside the screen
              }
            }
           })
          contentElement.style.width = Math.round(400*scale) + "px"

          // Replace text based close button with image based icon instead
          const closeButton = document.createElement("img")
          closeButton.src = assetSources.popupClose

          closeButton.onclick = (e) => {
            e.preventDefault()
            e.stopPropagation()
            gsap.to(contentElement.children, {opacity: 0, duration: 0.2, ease: "power2.in"})
            gsap.to(contentElement, { height: 0, width: 0, opacity: 0, duration: 0.3, ease: "power2.in", transformOrigin: "bottom center", onComplete: () => popup.remove() })
          }

          // Reorder header content
          const popUpHeader = document.createElement("div")
          popUpHeader.classList.add("pop-up-header")
          const popupTitle = contentElement.children[0]

          popUpHeader.appendChild(popupTitle)
          popUpHeader.appendChild(closeButton)
          contentElement.appendChild(popUpHeader)

          var consiseInformation = document.createElement("div")
          consiseInformation.classList.add("pop-up-info")

          switch(mode){
            case "powerPlants":
              // Power plant information
              consiseInformation = getPowerPlantInfo(properties, consiseInformation, reportedYears, estimatedYears)

              // Get regionalInfoIcon
              if(consiseInformation.children[3].children[2]){
                const consiseInformationIcon = consiseInformation.children[3].children[2]
                consiseInformationIcon.onmouseover = () => handleIconHoverOver(consiseInformationIcon)
                consiseInformationIcon.onmouseout = () => handleIconHoverOut(consiseInformationIcon)
              }

              contentElement.appendChild(consiseInformation)

              // Regional overview panel, given the data, this is currently the country which the powerplant is located in
              const regionalOverview = document.createElement("div")
              regionalOverview.classList.add("regional-overview-panel")
              const overviewHeader = document.createElement("div")
              overviewHeader.classList.add("regional-overview-header")
              const overviewTitle = document.createElement("h1")
              const overviewOpen = document.createElement("img")

              // Set header title and add open/clsoe image
              overviewTitle.textContent = `${properties.country_long}`
              overviewOpen.src = assetSources.popupRollupClosed

              // Get the regional information about the corresponding country
              const regionalInformation = getRegionalInfo(properties, regionalData, colourData, reportedYears, estimatedYears)
          
              // Handle clicks on the rollup icon
              overviewOpen.onclick = () => handleRollupClick(overviewOpen.src, overviewOpen, regionalInformation);
        
              // Get regionalInfoIcon
              if(regionalInformation.children[0].children[2]){
                const regionalInfoIcon = regionalInformation.children[0].children[2]
                regionalInfoIcon.onmouseover = () => handleIconHoverOver(regionalInfoIcon)
                regionalInfoIcon.onmouseout = () => handleIconHoverOut(regionalInfoIcon)
              }

              // Append elements to created elements
              overviewHeader.appendChild(overviewTitle)
              overviewHeader.appendChild(overviewOpen)
              regionalOverview.appendChild(overviewHeader)
              regionalOverview.appendChild(regionalInformation)
              contentElement.appendChild(regionalOverview)

              // Get bar chart bars and make them clickable
              const barElements = regionalInformation.querySelectorAll('[class*="bar_"]')
              barElements.forEach(bar => { 
                bar.style.cursor = "pointer"
                bar.onclick = () => {
                  setFilter(prev => {
                    // Each bar has a name in the form "bar_Fuel"
                    const fuel = bar.getAttribute("class").split(" ").find(c => c.startsWith("bar_")).slice(4)
                    const updated = prev ? (prev.includes(fuel) // Update the filter from the map context, used in PrimaryPanels.jsx
                      ? prev.filter(f => f !== fuel)
                      : [...prev, fuel])
                      : [fuel]
                    return updated.length ? updated : null
                  })
                }
              })
              break;
            case "usage":
              consiseInformation.classList.add("noBorder")
              consiseInformation = getUsageInfo(properties, consiseInformation, shareYears)
              contentElement.appendChild(consiseInformation)

              break;
            case "fuelType":
              popup.getElement().classList.add("maplibregl-popup-selection-info")

              popUpHeader.style.marginBottom = "0.5dvh"

              var regionInfo = document.createElement("div")
              regionInfo.classList.add("pop-up-info", "noBorder", "hide")
              
              var usageInfo = document.createElement("div")
              usageInfo.classList.add("pop-up-info", "noBorder", "hide")
              
              var regionDropDownHeader = document.createElement("div")
              regionDropDownHeader.classList.add("selection-overview-header")
              var usageDropDownHeader = document.createElement("div")
              usageDropDownHeader.classList.add("selection-overview-header")
              
              regionDropDownHeader.onclick = () => toggleSelectionDropDown(regionDropDownHeader, map)
              usageDropDownHeader.onclick = () => toggleSelectionDropDown(usageDropDownHeader, map)
                                  
              var rDropDownTitle = document.createElement("h1")
              var rDropDownIcon =document.createElement("img")
              var uDropDownTitle = document.createElement("h1")
              var uDropDownIcon =document.createElement("img")
              
              // Set header title and add open/clsoe image
              rDropDownTitle.textContent = "Electric Generation"
              rDropDownIcon.src = assetSources.popupRollupOpened
              
              uDropDownTitle.textContent = "Usage Shares"
              uDropDownIcon.src = assetSources.popupRollupOpened
              
              regionDropDownHeader.appendChild(rDropDownTitle)
              regionDropDownHeader.appendChild(rDropDownIcon)
              
              usageDropDownHeader.appendChild(uDropDownTitle)
              usageDropDownHeader.appendChild(uDropDownIcon)
              
              
              contentElement.appendChild(regionDropDownHeader)
              contentElement.appendChild(regionInfo)
              contentElement.appendChild(usageDropDownHeader)
              contentElement.appendChild(usageInfo)

              const iso = properties.adm0_iso
              const altIso = properties.iso_a3
              let entry = regionalData.find(r => r.country == iso)
              if(!entry){ // Attempt to find country with other code
                entry = regionalData.find(r => r.country == altIso)
              } 
              
              createPopUpBarChart(contentElement,entry.country, regionalData,colourData, estimatedYears, assetSources.popupInfo,true)
              createPopUpUsagePlot(contentElement,entry.country, regionalData, shareYears, true)
              break;
          }
          setPopupCount(pc => pc + 1) // Count each pop-up window open

          // Make pop up movable
          makePopUpMovable(popup.getElement(), map)
        }else if(!isOpen){
          const alertEl = document.getElementById("popUpAlert");
          alertEl.classList.remove("animate");
          void alertEl.offsetWidth;
          alertEl.classList.add("animate");
        }
    }

    const addSourceAndLayer = () => {
      if (map.getSource("powerplants")) return; // If the power plants layer already has been added, return
      if (map.getSource("countryboundaries")) return; // If the country boundaries layer already has been added, return
      if (!boundaryData || !regionalData) return; // Wait until all data is loaded

      // Assumes the low carbon and fossil fuel usage data has the same lenghts
      const usageKeys = Object.keys(regionalData[0].usage_shares)
      const dataYears = usageKeys.map((s) => parseInt(s.replace(/^\D+/g, "")))

      // Attach the usage values to each boundary feature (matched by iso_a3)
      boundaryData.features.forEach(f => {
        const iso = f.properties.adm0_iso
        const altIso = f.properties.iso_a3
        let entry = regionalData.find(r => r.country == iso)
        if(!entry){ // Attempt to find country with other code
          entry = regionalData.find(r => r.country == altIso)
        } 
        f.properties.usageShares = {}
        f.properties.highestFuelType = {}
        f.properties.highestFuelType = (entry)?getLatestDataArray(estimatedYears,entry)[0].fuel : null

        for(let i = dataYears[0]; i <= dataYears[dataYears.length-1]; i++){
          f.properties.usageShares[i] = {}
          let usage = entry?.usage_shares?.[i]

          f.properties.usageShares[i]['LC'] = usage?.LC ?? null
          f.properties.usageShares[i]['FF'] = usage?.FF ?? null
        }
      })

      // Colour the countries based on the latest year of data by default
      const latestYear = dataYears[dataYears.length - 1]
      const usageColor = usageColourForYear(latestYear, dataYears, boundaryData)
      const fuelTypeColor = getFuelTypeColor(boundaryData, colourData)

      // Add the power plant data as a source to the map
      map.addSource("powerplants", {
        type: "geojson",
        data: data,
      });

      // Add country boundaries as a source to the map
      map.addSource("countryboundaries",{
        type: "geojson",
        data: boundaryData,
      });

      // Create country boundaries layer on the map, each polygon is a country
      map.addLayer({
        id: 'usage-fill',
        type: 'fill',
        source:'countryboundaries',
        paint: {
          'fill-color': usageColor,
          'fill-opacity': 0.6
        }
      }).on('click', 'usage-fill', (e) => { // If any feature on the layer is clicked on, open pop-up
            displayInformation(e, "usage")
      });

      map.addLayer({
        id: 'usage-border',
        type: 'line',
        source: 'countryboundaries',
        paint: {
          'line-color': usageColor,
          'line-width': 2
        }
      });

      map.on('mouseenter', 'usage-fill', () => { // Relevant for screens with mouse input, make the mouse a pointer if hovered
            map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'usage-fill', () => { // Relevant for screens with mouse input, remove cursor style when mouse leaves feature
            map.getCanvas().style.cursor = '';
      });

      // Hide usage layer by default
      map.getLayer("usage-fill").visibility = "none"
      map.getLayer("usage-border").visibility = "none"

      // Create fuel type layer on the map, colours 
      map.addLayer({
        id: "fuelType-fill",
        type: "fill",
        source: 'countryboundaries',
        paint: {
          'fill-color': fuelTypeColor,
          'fill-opacity': 0.5
        }
      }).on('click', 'fuelType-fill', (e) => { // If any feature on the layer is clicked on, open pop-up
            displayInformation(e, "fuelType")
      });

      map.addLayer({
        id: "fuelType-border",
        type: "line",
        source: 'countryboundaries',
        paint: {
          'line-color': fuelTypeColor,
          'line-width': 2
        }
      })

      map.on('mouseenter', 'fuelType-fill', () => { // Relevant for screens with mouse input, make the mouse a pointer if hovered
            map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'fuelType-fill', () => { // Relevant for screens with mouse input, remove cursor style when mouse leaves feature
            map.getCanvas().style.cursor = '';
      });

      // Hide fuel type layer by default
      map.getLayer("fuelType-fill").visibility = "none"
      map.getLayer("fuelType-border").visibility = "none"

      // Create the power plants layer on the map, each circle is a power plant
      map.addLayer({
        id: "powerplants-layer",
        type: "circle",
        source: "powerplants",
        paint: powerPlantPaint
      }).on('click', 'powerplants-layer', (e) => { // If any feature on the layer is clicked on, open pop-up
            displayInformation(e, "powerPlants")
      });
      
      map.on('mouseenter', 'powerplants-layer', () => { // Relevant for screens with mouse input, make the mouse a pointer if hovered
            map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'powerplants-layer', () => { // Relevant for screens with mouse input, remove cursor style when mouse leaves feature
            map.getCanvas().style.cursor = '';
      });
      setMapReady(true);
    };

    // Add the source layer if map is loaded, else load the map
    if (map.loaded()) {
      addSourceAndLayer();
    } else {
      map.once("load", addSourceAndLayer);
    }
  }, [data, boundaryData, regionalData, colourData]);

  // Timer update
  useEffect(() =>{
    const countDownUntilZero = () => {
        const now = Date.now();
        const interval = now - referenceTime;
        setReferenceTime(now);
        setTime(prevTime => Math.max(0, prevTime - interval));
    }
    const timeoutId = setTimeout(countDownUntilZero, INTERVAL_IN_MILISECONDS);
    //console.log("Time remaining: " + Math.floor(time/1000) + "s"); // To check if timing function works
    return () => clearTimeout(timeoutId);
  }, [time]);

  // Handle rollup in click
  function handleRollupClick(currentSource, element, infoElement){
    const isHidden = infoElement.classList.contains("hide")
    const barChart = infoElement.children[1]
    if(isHidden){
        gsap.fromTo(infoElement,
          { height: 0, opacity: 0 },
          { height: "auto", opacity: 1, duration: 0.4, ease: "power2.out",
            onComplete: () => {
              gsap.set(infoElement, { clearProps: "height" })
              const popUpContentElement = infoElement.parentElement.parentElement;
              const boundingBox = popUpContentElement.getBoundingClientRect();
              if(boundingBox.top <= 0){
                mapInstance.current?.panBy([0, 0], { duration: 1 }) // Work around to reposition pop-ups that are outside the screen
              }
            }
          }
        )
        gsap.to(element,
          {rotationX: 180, duration: 0.6, ease: "power4.out"}
        )
        gsap.fromTo(barChart,
          {opacity: 0},
          {opacity: 1, duration: 1.2, ease: "power2.out"}
        )
        infoElement.classList.toggle("hide");
        barChart.classList.toggle("hide")
    }else{
        gsap.to(barChart,
          { opacity: 0, duration: 0.1, ease: "power2.in",
            onComplete: () => {
              barChart.classList.toggle("hide")
            }
          }
        )
        gsap.to(infoElement,
          { height: 0, opacity: 0, duration: 0.2, ease: "power2.in",
            onComplete: () => {
              infoElement.classList.toggle("hide");
            }
          }
        )
        gsap.to(element,
          {rotationX: 0, duration: 0.4, ease: "power4.in"}
        )
    }
  }

  // Handle info icon hover on
  function handleIconHoverOver(element){
    element.parentElement.children[2].children[1].children[0].style.visibility = "visible"
  }

  // Handle info icon hover off
  function handleIconHoverOut(element){
    element.parentElement.children[2].children[1].children[0].style.visibility = "hidden"
  }

  // Reset the timer
  function resetTimer(){
    setReferenceTime(Date.now())
    setTime(TIME_IN_MILISECONDS_TO_EXHIBITION_RESET)
  }

  return (
    <MapContext.Provider value={{ mapRef: mapInstance, powerPlants: data, boundaryData,
                                                    barChartFilter: filter, setBarChartFilter: setFilter,
                                                    popupCount, timeRef: time, resetTimer,
                                                    reportedYears, estimatedYears, shareYears, mapReady }}>
      <div ref={mapContainer} style={{ width: "100dvw", height: "100dvh", position: "fixed", top: 0, left: 0 }} />
      <div id="popUpAlert">
        <h1>You can only open 4 cards at a time</h1>
        <img src={assetSources.alertIcon}></img>
      </div>
      {children}
    </MapContext.Provider>
  );
}

// Function to get relevant information about a given powerplant
function getPowerPlantInfo(feature, htmlElement, reportedYears, estimatedYears){
    // Commisioning year
    const yearStartedField = document.createElement("span")
    const yearStartedTitle = document.createElement("strong")
    const yearStartedValue = document.createElement("span")
    yearStartedTitle.textContent = "Commissioning Year:"
    yearStartedValue.textContent = `${(feature.commissioning_year==null)? "N/A" : Math.trunc(feature.commissioning_year)}` 
        
    yearStartedField.appendChild(yearStartedTitle)
    yearStartedField.appendChild(yearStartedValue)

    // Primary fuel
    const primaryFuelField = document.createElement("span")
    const primaryFuelTitle = document.createElement("strong")
    const primaryFuelName = document.createElement("span")
    primaryFuelTitle.textContent = "Primary Fuel:"
    primaryFuelName.textContent = `${(feature.primary_fuel==null)? "N/A" : feature.primary_fuel}` 
        
    primaryFuelField.appendChild(primaryFuelTitle)
    primaryFuelField.appendChild(primaryFuelName)

    // Capacity (MW)
    const capacityField = document.createElement("span")
    const capacityTitle = document.createElement("strong")
    const capacityValue = document.createElement("span")
    capacityTitle.textContent = "Capacity:"
    capacityValue.textContent = `${(feature.capacity_mw==null)? "N/A" : feature.capacity_mw + " MW"}` 
        
    capacityField.appendChild(capacityTitle)
    capacityField.appendChild(capacityValue)

    // Generation (latest)
    const generationField = document.createElement("span")
    const generationTitle = document.createElement("strong")
    const generationValue = document.createElement("span")
    
    // -find the latest year with generation data
    var latestDataYear = 0
    var latestDataValue = 0
    var reported = false
    for(var i = estimatedYears.last; i >=estimatedYears.first; i--){
        //var tempReported = eval("feature.generation_gwh_" + i)
        var tempEstimated = eval("feature.estimated_generation_gwh_" + i)
        /* if(tempReported != null){
            latestDataYear = i
            latestDataValue = tempReported
            reported = true
            break;
        }else if(i <= estimatedYears.last && tempEstimated){
            latestDataYear = i
            latestDataValue = tempEstimated
            reported = false
            break;
        } */
       if(tempEstimated != null){
          latestDataYear = i
          latestDataValue = tempEstimated
          break;
       }
    }

    generationTitle.textContent = "Generation " + `${(latestDataYear==0)? "Data Not available" :":"}`
    generationValue.textContent = `${(latestDataValue==0)? "" : Math.round(latestDataValue*100)/100 + " GWh"}`
    
    generationField.appendChild(generationTitle)
    generationField.appendChild(generationValue)

    if(generationTitle.textContent !== "Generation Data Not available"){
        const infoWrapper = document.createElement("span")
        infoWrapper.className = "popupInfoWrapper"

        const generationInfo = document.createElement("img")
        generationInfo.className = "popupInfoIcon"
        generationInfo.src = assetSources.popupInfo

        // Add tooltip
        const generationToolTip = document.createElement("div")
        generationToolTip.className = "generationInfoTooltip"
        const generationToolTipText = document.createElement("span")
        generationToolTipText.className = "generationInfoTooltipText"
        generationToolTipText.textContent = reported? "Reported ":"Estimated "
        generationToolTipText.textContent += "annual generation " + latestDataYear + " in gigawatt hours (GWhs)"
        /* generationToolTipText.textContent = reported? "Reported value":"Estimated value"
        generationToolTipText.textContent+= " from " + latestDataYear */

        generationToolTip.appendChild(generationToolTipText)
        infoWrapper.appendChild(generationInfo)
        infoWrapper.appendChild(generationToolTip)
        generationField.appendChild(infoWrapper)
    }

    htmlElement.appendChild(yearStartedField)
    htmlElement.appendChild(primaryFuelField)
    htmlElement.appendChild(capacityField)
    htmlElement.appendChild(generationField)
    return htmlElement;
}

// Function to generate the regional information stored in each pop-up
function getRegionalInfo(feature, data, colours, reportedYears, estimatedYears){
    return createPopUpBarChart(null, feature.country, data, colours, estimatedYears, assetSources, false)
}

function getUsageInfo(feature, htmlElement, shareYears){
    return createPopUpUsagePlot(htmlElement, feature, null, shareYears, false)
}

export function getFuelTypeColor(boundaryData,colourData){
  if(!boundaryData) return '#00000000'
  return [
    'match',
      ['get', 'highestFuelType'],
      'Coal', colourData[0].colour,
      'Gas', colourData[1].colour,
      'Oil', colourData[2].colour,
      'Nuclear', colourData[3].colour,
      'Hydro', colourData[4].colour,
      'Wind', colourData[5].colour,
      'Solar', colourData[6].colour,
      'Other', colourData[7].colour,
      '#00000000' // Fallback color for missing or unmatched fuel types
  ]
}

export function usageColourForYear(year, years, boundaryData){
  if(!boundaryData) return '#00000000'
  const key = String(year)
  let minFF = Infinity, maxFF = -Infinity
  let minLC = Infinity, maxLC = -Infinity

  boundaryData.features.forEach(f =>{
    years.forEach(y=>{
      const FF = f.properties.usageShares?.[String(y)]?.FF
      const LC = f.properties.usageShares?.[String(y)]?.LC

      if(FF != null) {minFF = Math.min(minFF,FF); maxFF = Math.max(maxFF,FF)}
      if(LC != null) {minLC = Math.min(minLC,LC); maxLC = Math.max(maxLC,LC)}
    })
  })
  // LC data is singular or missing 
  if (minLC === maxLC || maxLC === -Infinity){
    if (minFF === maxFF || maxFF === -Infinity) return '#00000000'; // FF data is also singular or missing 
    else return [ // FF data exists, use previous colouring function
        'case',
        ['==', ['get', 'FF', ['get', key, ['get', 'usageShares']]], null],
        '#00000000',
        ['interpolate', ['linear'], ['get', 'FF', ['get', key, ['get', 'usageShares']]], minFF, '#ffffbf', maxFF, '#ed0e12']
    ]
  }

  // FF data is singular or missing 
  if (minFF === maxFF || maxFF === -Infinity){
    if (minLC === maxLC || maxLC === -Infinity) return '#00000000'; // LC data is also singular or missing 
    else return [ // LC data exists, use previous colouring function
        'case',
        ['==', ['get', 'FF', ['get', key, ['get', 'usageShares']]], null],
        '#00000000',
        ['interpolate', ['linear'], ['get', 'LC', ['get', key, ['get', 'usageShares']]], minLC, '#ffffbf', maxLC, '#13d651']
    ]
  }

  // Min and max values could be found for both datasets
  return [
    'case',
    ['all', // Both values are equal to null
      ['==',['get', 'LC', ['get', key, ['get', 'usageShares']]], null],
      ['==', ['get', 'FF', ['get', key, ['get', 'usageShares']]], null]
    ],
      '#00000000', // LC and FF are missing for the given year
    ['all', // LC equal to null, FF different from null
      ['==', ['get', 'LC', ['get', key, ['get', 'usageShares']]], null],
      ['!=', ['get', 'FF', ['get', key, ['get', 'usageShares']]], null]
    ],
      ['case',
        ['<=',
          ['get', 'FF', ['get', key, ['get', 'usageShares']]],
          20
        ],
          ['interpolate', ['linear'],
            ['get', 'FF', ['get', key, ['get', 'usageShares']]],
              0, '#1b5e39', 20, '#5fa675'
          ],
        ['<',
          ['get', 'FF', ['get', key, ['get', 'usageShares']]],
          40
        ],
          ['interpolate', ['linear'],
            ['get', 'FF', ['get', key, ['get', 'usageShares']]],
              20, '#5fa675', 40, '#f3db5e'
          ],
        ['<',
          ['get', 'FF', ['get', key, ['get', 'usageShares']]],
          60
        ],
          ['interpolate', ['linear'],
            ['get', 'FF', ['get', key, ['get', 'usageShares']]],
              40, '#f3db5e', 60, '#e68a47 '
          ],
        ['<',
          ['get', 'FF', ['get', key, ['get', 'usageShares']]],
          80
        ],
          ['interpolate', ['linear'],
            ['get', 'FF', ['get', key, ['get', 'usageShares']]],
              60, '#e68a47', 80, '#c93b2b '
          ],
        ['>=',
          ['get', 'FF', ['get', key, ['get', 'usageShares']]],
          80
        ],
          '#c93b2b ',
        '#00000000'
      ],
    ['all', // LC different from null, FF equal to null
      ['!=', ['get', 'LC', ['get', key, ['get', 'usageShares']]], null],
      ['==', ['get', 'FF', ['get', key, ['get', 'usageShares']]], null]
    ],
      ['case',
        ['<=',
          ['get', 'LC', ['get', key, ['get', 'usageShares']]],
          20
        ],
          ['interpolate', ['linear'],
            ['get', 'LC', ['get', key, ['get', 'usageShares']]],
              0, '#c93b2b ', 20, '#e68a47'
          ],
        ['<',
          ['get', 'LC', ['get', key, ['get', 'usageShares']]],
          40
        ],
          ['interpolate', ['linear'],
            ['get', 'LC', ['get', key, ['get', 'usageShares']]],
              20, '#e68a47', 40, '#f3db5e'
          ],
        ['<',
          ['get', 'LC', ['get', key, ['get', 'usageShares']]],
          60
        ],
          ['interpolate', ['linear'],
            ['get', 'LC', ['get', key, ['get', 'usageShares']]],
              40, '#f3db5e', 60, '#5fa675'
          ],
        ['<',
          ['get', 'LC', ['get', key, ['get', 'usageShares']]],
          80
        ],
          ['interpolate', ['linear'],
            ['get', 'LC', ['get', key, ['get', 'usageShares']]],
              60, '#5fa675', 80, '#1b5e39'
          ],
        ['>=',
          ['get', 'LC', ['get', key, ['get', 'usageShares']]],
          80
        ],
          '#1b5e39',
        '#00000000'
      ],
    ['>=', // LC value larger or equal to FF
      ['get', 'LC', ['get', key, ['get', 'usageShares']]],
      ['get', 'FF', ['get', key, ['get', 'usageShares']]]
    ],
      ['case',
        ['<=',
          ['get', 'LC', ['get', key, ['get', 'usageShares']]],
          60
        ],
          ['interpolate', ['linear'],
            ['get', 'LC', ['get', key, ['get', 'usageShares']]],
              50, '#f3db5e', 60, '#5fa675'
          ],
        ['<',
          ['get', 'LC', ['get', key, ['get', 'usageShares']]],
          80
        ],
          ['interpolate', ['linear'],
            ['get', 'LC', ['get', key, ['get', 'usageShares']]],
              60, '#5fa675', 80, '#1b5e39'
          ],
        ['>=',
          ['get', 'LC', ['get', key, ['get', 'usageShares']]],
          80
        ],
          '#1b5e39',
        '#00000000'
      ],
    ['<', // LC value smaller than FF
      ['get', 'LC', ['get', key, ['get', 'usageShares']]],
      ['get', 'FF', ['get', key, ['get', 'usageShares']]]
    ],
      ['case',
        ['<=',
          ['get', 'FF', ['get', key, ['get', 'usageShares']]],
          60
        ],
          ['interpolate', ['linear'],
            ['get', 'FF', ['get', key, ['get', 'usageShares']]],
              50, '#f3db5e', 60, '#e68a47 '
          ],
        ['<',
          ['get', 'FF', ['get', key, ['get', 'usageShares']]],
          80
        ],
          ['interpolate', ['linear'],
            ['get', 'FF', ['get', key, ['get', 'usageShares']]],
              60, '#e68a47', 80, '#c93b2b '
          ],
        ['>=',
          ['get', 'FF', ['get', key, ['get', 'usageShares']]],
          80
        ],
          '#c93b2b ',
        '#00000000'
      ],
    '#00000000' // Fallback (unreachable, required by 'case' to have an odd number of arguments)
  ]

}

export default Map;
