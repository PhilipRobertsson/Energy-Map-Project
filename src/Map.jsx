import { createContext, useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as d3 from "d3";

import './Map.css'

export const MapContext = createContext({ mapRef: null, powerPlants: null });

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
  "circle-stroke-color": "#efefef",
};

// Sources for the different svg files stored in the public folder
const assetSources ={
    popupInfo: "./popup/popupInfo.svg",
    popupClose: "./popup/popupClose.svg",
    popupRollupOpened: "./popup/popupRollupOpen.svg",
    popupRollupClosed: "./popup/popupRollupClosed.svg",
    alertIcon: "./sidePanel/sidePanelInfoIcon.svg"
}

// Update based on "global_power_plant_database.geojson"
const _firstYearOfGenerationData = 2013;
const _latestYearOfGenerationData = 2019;
const _firstYearOfEstimatedGenerationData = 2013;
const _latestYearOfEstimatedGenerationData = 2017;

function Map({ children }) {
  const [data, setData] = useState(null);
  const [colourData, setColourData] = useState(null);
  const [regionalData, setRegionalData] = useState(null);
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);

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
  }, []);

  useEffect(() => {
    fetch("./global_power_plant_database.geojson")
      .then((response) => response.json())
      .then((powerPlants) => {
        setData(powerPlants);
      });
    fetch("./regionalInformation.json")
      .then((response) => response.json())
      .then((data) => {
        setRegionalData(data);
      });
  }, []);

  useEffect(() => {
    if (mapInstance.current) return;

    fetch("./mapStyles.json")
      .then((response)=> response.json())
      .then((data) => {
        mapInstance.current = new maplibregl.Map({
          container: mapContainer.current,
          style: data, //mapStyle,
          center: [9.902056, 49.843],
          zoom: 3.2,
        });
      });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!data?.features?.length) return;

    const map = mapInstance.current;
    if (!map) return;

    const displayInformation = (e) =>{
        const coordinates = e.features[0].geometry.coordinates.slice();
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
          const popup = new maplibregl.Popup({maxWidth: '450px', closeOnClick: false})
            .setLngLat(coordinates)
            .setHTML("<h1>"+ properties.name +"</h1>")
            .addTo(map);
        
          const contentElement = popup.getElement().children[1]
        
          // Power plant information
          var consiseInformation = document.createElement("div")
          consiseInformation.classList.add("pop-up-info")
          consiseInformation = getPowerPlantInfo(properties, consiseInformation)

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

          const regionalInformation = getRegionalInfo(properties, regionalData, colourData)
          
          overviewOpen.onclick = () => handleRollupClick(overviewOpen.src, overviewOpen, regionalInformation);
        
          // Get regionalInfoIcon
          if(regionalInformation.children[0].children[2]){
              const regionalInfoIcon = regionalInformation.children[0].children[2]
              regionalInfoIcon.onmouseover = () => handleIconHoverOver(regionalInfoIcon)
              regionalInfoIcon.onmouseout = () => handleIconHoverOut(regionalInfoIcon)
          }

          overviewHeader.appendChild(overviewTitle)
          overviewHeader.appendChild(overviewOpen)
          regionalOverview.appendChild(overviewHeader)
          regionalOverview.appendChild(regionalInformation)
          contentElement.appendChild(regionalOverview)
        }else if(!isOpen){
          const alertEl = document.getElementById("popUpAlert");
          alertEl.classList.remove("animate");
          void alertEl.offsetWidth;
          alertEl.classList.add("animate");
        }
    }

    const addSourceAndLayer = () => {
      if (map.getSource("powerplants")) return;
      map.addSource("powerplants", {
        type: "geojson",
        data: data,
      });
      map.addLayer({
        id: "powerplants-layer",
        type: "circle",
        source: "powerplants",
        paint: powerPlantPaint
      }).on('click', 'powerplants-layer', (e) => {
            displayInformation(e)
      });
      
      map.on('mouseenter', 'powerplants-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'powerplants-layer', () => {
            map.getCanvas().style.cursor = '';
      });
    };

    if (map.loaded()) {
      addSourceAndLayer();
    } else {
      map.once("load", addSourceAndLayer);
    }
  }, [data, regionalData, colourData]);

  // Handle zoom in click
  function handleRollupClick(currentSource, element, infoElement){
    if(currentSource.includes("/popup/popupRollupClosed.svg")){
        element.src = assetSources.popupRollupOpened
        infoElement.style.display = "flex"
    }else{
        element.src = assetSources.popupRollupClosed
        infoElement.style.display = "none"
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

  return (
    <MapContext.Provider value={{ mapRef: mapInstance, powerPlants: data }}>
      <div ref={mapContainer} style={{ width: "78dvw", height: "100dvh", position: "fixed", top: 0, left: 0 }} />
      <div id="popUpAlert">
        <h1>You can only open 4 cards at a time</h1>
        <img src={assetSources.alertIcon}></img>
      </div>
      {children}
    </MapContext.Provider>
  );
}

function getPowerPlantInfo(feature, htmlElement){
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
    for(var i = _latestYearOfGenerationData; i >=_firstYearOfGenerationData; i--){
        var tempReported = eval("feature.generation_gwh_" + i)
        var tempEstimated = eval("feature.estimated_generation_gwh_" + i)
        if(tempReported != null){
            latestDataYear = i
            latestDataValue = tempReported
            reported = true
            break;
        }else if(i <= _latestYearOfEstimatedGenerationData && tempEstimated){
            latestDataYear = i
            latestDataValue = tempEstimated
            reported = false
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
        generationToolTipText.textContent = reported? "Reported value":"Estimated value"
        generationToolTipText.textContent+= " from " + latestDataYear

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

function getRegionalInfo(feature, data, colours){
    const region = data.find((c) => c.country == feature.country)
    const htmlElement = document.createElement("div")
    htmlElement.classList.add("regional-overview-info")

    const infoHeader = document.createElement("span")
    const infoTitle = document.createElement("strong")
    const infoValue = document.createElement("span")

    // -find the latest year with generation data
    var latestDataYear = 0
    var latestDataValue = 0
    var reported = false
    for(var i = _latestYearOfGenerationData; i >=_firstYearOfGenerationData; i--){
        var tempReported = eval("region.regional_annual_output.generation_gwh_" + i)
        var tempEstimated = eval("region.regional_annual_output.estimated_generation_gwh_" + i)
        if(tempReported != null){
            latestDataYear = i
            latestDataValue = tempReported
            reported = true
            break;
        }else if(i <= _latestYearOfEstimatedGenerationData && tempEstimated != null){
            latestDataYear = i
            latestDataValue = tempEstimated
            reported = false
            break;
        }
    }

    infoTitle.textContent = "Generation " + `${(latestDataYear==0)? "Data Not available" :":"}`
    infoValue.textContent = `${(latestDataValue==0)? "" : Math.round(latestDataValue*100)/100 + " GWh"}`
    
    infoHeader.appendChild(infoTitle)
    infoHeader.appendChild(infoValue)

    if(infoTitle.textContent !== "Generation Data Not available"){
        const infoWrapper = document.createElement("span")
        infoWrapper.className = "regionalInfoWrapper"

        const infoIcon = document.createElement("img")
        infoIcon.className = "regionalInfoIcon"
        infoIcon.src = assetSources.popupInfo
        
        // Add tooltip
        const infoToolTip = document.createElement("div")
        infoToolTip.className = "regionalInfoTooltip"
        const infoToolTipText = document.createElement("span")
        infoToolTipText.className = "regionalInfoTooltipText"
        infoToolTipText.textContent = reported? "Reported value":"Estimated value"
        infoToolTipText.textContent+= " from " + latestDataYear
        
        infoToolTip.appendChild(infoToolTipText)
        infoWrapper.appendChild(infoIcon)
        infoWrapper.appendChild(infoToolTip)
        infoHeader.appendChild(infoWrapper)
    }

    var latestData = {}
    for(var i = _latestYearOfGenerationData; i >=_firstYearOfGenerationData; i--){
        var tempReported = eval("region.annual_output_by_fuel.generation_gwh_" + i)
        var tempEstimated = eval("region.annual_output_by_fuel.estimated_generation_gwh_" + i)

        // Missing values / total values in reported data
        var numNullReported = Object.keys(tempReported).filter((key) => tempReported[key] === null).length;
        var totalReported = Object.keys(tempReported).length
        var missingReported = Object.keys(tempReported).filter((key) => tempReported[key] === null)
        var gotReported = Object.keys(tempReported).filter((key) => tempReported[key] != null)

        // Missing values / total values in estimated data
        if(i<=_latestYearOfEstimatedGenerationData){
            var numNullEstimated = Object.keys(tempEstimated).filter((key) => tempEstimated[key] === null).length
            var totalEstimated = Object.keys(tempEstimated).length
            var missingEstimated = Object.keys(tempEstimated).filter((key) => tempEstimated[key] === null)
            var gotEstimated = Object.keys(tempEstimated).filter((key) => tempEstimated[key] != null)
        }

        const cleanObject = (object) =>
                Object.fromEntries(
                Object.entries(object)
                .filter(([_, value]) => value)
        );

        const insertLastDataYear = (fuel, year) =>{
            latestData[fuel]['year'] = year
        }

        const insertLastDataValue = (fuel, value) =>{
            latestData[fuel]['value'] = value
        }

        const insertReported = (fuel, rep) =>{
            latestData[fuel]['reported'] = rep
        }

        // No reported values are found and estimated does not exist
        if(gotReported.length == 0 && i>_latestYearOfEstimatedGenerationData){
            continue
        }else if(i > _latestYearOfEstimatedGenerationData){ // There are some reported values, but estimated does not exist
            gotReported.forEach((fuel)=>{
                if (!(fuel in latestData)){
                    latestData[fuel] = {}
                    insertLastDataYear(fuel,i)
                    insertLastDataValue(fuel,tempReported[fuel])
                    insertReported(fuel, true)
                }
            })
            break
        }else{ // There are estimated values
            // Get the available reported values
            gotReported.forEach((fuel)=>{
                    if (!(fuel in latestData)){
                        latestData[fuel] = {}
                        insertLastDataYear(fuel,i)
                        insertLastDataValue(fuel,tempReported[fuel])
                        insertReported(fuel, true)
                    }
            })
            // Find which estimated values that can be used
            var estimatedValuesLeft = Object.keys(cleanObject(tempEstimated)).filter(item => !Object.keys(cleanObject(latestData)).includes(item))
            estimatedValuesLeft.forEach((fuel)=>{
                if (!(fuel in latestData)){
                    latestData[fuel] = {}
                    insertLastDataYear(fuel,i)
                    insertLastDataValue(fuel,tempEstimated[fuel])
                    insertReported(fuel, false)
                }
            })
            // All fuel types were found
            if(Object.keys(latestData).length == totalReported){break;}
        }
    }

    // Convert latestData object to array for D3
    const latestDataArray = Object.entries(latestData).map(([fuel, data]) => ({
        fuel,
        value: data.value,
        reported: data.reported,
        year: data.year,
    }))

    // If "Other" isn't present, add it
    if(!latestDataArray.some((d) =>"Other" == d.fuel)){
      latestDataArray.push({
        fuel: "Other",
        value: 0,
        reported: false,
        year: 0,
      })
    }

    const unwantedCatagories = ["Petcoke", "Wave and Tidal", "Tidal","Geothermal", "Cogeneration", "Storage","Biomass", "Waste"]

    // Go through array and reassign unwanted catagories to "Other"
    latestDataArray.forEach((d)=>{
      if(unwantedCatagories.includes(d.fuel)){
        var otherField = latestDataArray.find((d) =>"Other" == d.fuel)
        otherField.value += d.value
        if(d.reported){
          otherField.reported =d.reported
          otherField.year = d.year
        }else{
          if(d.year > otherField.year){
            otherField.year = d.year
            otherField.reported =d.reported
          }
        }
      }
    })

    // Trim the array from unwanted catagories and sort it
    unwantedCatagories.forEach((u) =>{
      const index = latestDataArray.findIndex((d) => u == d.fuel);
      if (index > -1) { // only splice array when item is found
        latestDataArray.splice(index, 1); // 2nd parameter means remove one item only
      }
    })
    
    // Sort the array
    latestDataArray.sort((a,b) => b.value - a.value)

    const findMax = (data) =>{
        var max = 0
        data.forEach(d => {
            if(d.value > max){max = d.value}
        })
        return max
    }

    const getPercentage = (value) =>{
        var total = 0
        latestDataArray.forEach((elem)=>{
            total += elem.value
        })
        return (value/total) * 100
    }

    // Variables for D3 code
    const barChartContainer = document.createElement("div")
    barChartContainer.classList.add("regional-overview-svg")
    var barChartPadding = 0.2
    var barHeight = 35
    var barChartWidth = 400
    var barChartHeight = latestDataArray.length * (barHeight + barChartPadding)
    var margin = {top: 0, right: 80, bottom: 0, left: 100},
          width = barChartWidth - margin.left - margin.right,
          height = barChartHeight - margin.top - margin.bottom;
    
    // D3 code
    var svg = d3.select(barChartContainer)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
            .attr("transform","translate(" + margin.left + "," + margin.top + ")");

    // Add X axis
    var x = d3.scaleLinear()
        .domain([0, findMax(latestDataArray)])
        .range([ 0, width]);
    svg.append("g")
    .attr("transform", "translate(0," + height + ")")

    // To truncate fuel names which might be too long
    const truncateLabel = (text) =>{
        text.each(function() {
            var fuelName = d3.select(this).text();
            if(fuelName.length > 7){
                fuelName = fuelName.slice(0,6) + ".."
            }
            d3.select(this).text(fuelName)
        })
    }

    // Add Y axis
    var y = d3.scaleBand()
        .range([ 0, height ])
        .domain(latestDataArray.map(d => d.fuel))
        .padding(barChartPadding);
    svg.append("g")
        .call(d3.axisLeft(y)
            .tickSize(0)              // Hide the tick lines
            .tickPadding(8))          // Add space between label and "line"
        .call(g => g.select(".domain").remove()) // Hide the main axis line
        .selectAll(".tick text")
            .style("font-size", "1.8vmin")
            .style("font-family", "'Lato', sans-serif")
            .call(truncateLabel)
    
    // Colour function
    const colour = (fuel) => {
        if(["Petcoke", "Wave and Tidal", "Tidal",
             "Geothermal", "Cogeneration", "Storage",
             "Biomass", "Waste"].includes(fuel)){
          fuel = "Other"
        }
        return colours[colours.findIndex((elem) => elem.fuel == fuel)].colour
    }

    //Bars
    svg.selectAll("myRect")
        .data(latestDataArray)
        .enter()
        .append("rect")
        .attr("x", x(0))
        .attr("y", d => y(d.fuel))
        .attr("width", d => x(d.value))
        .attr("height", y.bandwidth())
        .attr("fill", d=>colour(d.fuel))

    svg.selectAll(".bar-label")
        .data(latestDataArray)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d=> x(d.value) + 5) // 5px padding to the right of the bar
        .attr("y", d=> y(d.fuel) + (y.bandwidth() / 2)) // Centers in the bar
        .attr("dy", "0.35em") // Fine-tunes vertical text alignment
        .text(d =>  getPercentage(d.value).toFixed(2) + "%")
        .style("fill", "black")
        .style("text-anchor", "start")
        .style("font-size", "1.2rem")
        .style("font-family", "'Lato', sans-serif");

    htmlElement.appendChild(infoHeader)
    htmlElement.appendChild(barChartContainer)
    return htmlElement;
}

export default Map;
