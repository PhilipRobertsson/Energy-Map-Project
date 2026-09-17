import * as d3 from "d3";

// Used to filter out fuels which either are too uncommon or unimportant for the visualization
export const otherFuels = [
    "Petcoke", "Wave and Tidal", "Tidal",
    "Geothermal", "Cogeneration", "Storage",
    "Biomass", "Waste", "Other"
];

// Aggregate generation data from regionalInformation.json for the currently shown regions,
// producing the same per-fuel shape that drawLinePlot / drawBarChart expect.
export function getShownRegionFuelData(regionalData, regionFilter, fuelFilter, filterByShow = true, years){
    const shownCountries = regionFilter.filter(r => r.show).map(r => r.country)
    const shownRegions = regionalData.filter(d => shownCountries.includes(d.country))

    // Sum a given generation field across shown regions for a set of raw fuel names
    const sumFuelField = (field, rawFuels) => {
        let total = 0
        let hasValue = false
        shownRegions.forEach(d => {
            const map = d.annual_output_by_fuel[field]
            if (!map) return
            rawFuels.forEach(fuel => {
                const v = map[fuel]
                if (v != null) { total += v; hasValue = true }
            })
        })
        return hasValue ? total : null
    }

    const fuels = filterByShow ? fuelFilter.filter(f => f.show) : fuelFilter

    return fuels
        .map(f => {
            // The "Other" category aggregates several raw fuels
            const rawFuels = f.fuel === "Other" ? otherFuels : [f.fuel]
            const result = { fuel: f.fuel, colour: f.colour }

            for(let year = years.estimated.first; year <= years.estimated.last; year++){
                result["sum_generation_" + year] = sumFuelField("generation_gwh_" + year, rawFuels)
            }
            for(let year = years.estimated.first; year <= years.estimated.last; year++){
                result["sum_estimated_generation_" + year] = sumFuelField("estimated_generation_gwh_" + year, rawFuels)
            }

            // Sum capacity across shown regions for the raw fuel names
            let capacity = 0
            let hasCapacity = false
            shownRegions.forEach(d => {
                rawFuels.forEach(fuel => {
                    const v = d.sum_capacity_mw[fuel]
                    if (v != null) { capacity += v; hasCapacity = true }
                })
            })
            result["sum_capacity_mw"] = hasCapacity ? capacity : null

            return result
        })
}

export function formatPowerOf10(num){
    if (num == null) return "N/A";
    if (num === 0) return `0`.trim();

    // Define metric prefixes mapping to powers of 10
    const prefixes = [
        { value: 1e3,  symbol: 'k' }, // kilo
        { value: 1,    symbol: ''  },
    ];

    // Find the closest matching tier
    const tier = prefixes.find(p => num >= p.value) || prefixes[prefixes.length - 1];

    // Round to nearest whole number relative to the tier
    const rounded = Math.round((num / tier.value));

    return `${rounded} ${tier.symbol}`.trim();
}

// Find the latest year (checking backwards) where a fuel has reported generation data
export function getLatestGenerationValue(fuelData, years){
    /* for(let year = years.reported.last; year >= years.reported.first; year--){
        var value = fuelData["sum_generation_" + year]
        if(value == null && year <= years.estimated.last) value = fuelData["sum_estimated_generation_"+year]
        if (value != null) return value
    } */
   for(let year = years.estimated.last; year >= years.estimated.first; year--){
        var value = fuelData["sum_estimated_generation_"+year]
        if(value != null) return value
   }
    return null
}

export function drawLinePlot(svgE, linePlotWidth, linePlotHeight, data, showPlot, svgId = "linePlotSVG", years){
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
    var margin = {top: Math.floor(5*scale), right: Math.floor(40*scale), bottom: Math.floor(30*scale), left: Math.floor(10*scale)}
    if(window.innerHeight <= 1024){margin = {top: Math.floor(15*scale), right: Math.floor(45*scale), bottom: Math.floor(45*scale), left: Math.floor(15*scale)}}
    var width = linePlotWidth - margin.left - margin.right,
    height = linePlotHeight - margin.top - margin.bottom;

    var svg = d3.select(svgE)
        .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("class", showPlot? null : "hide")
            .attr("id", svgId)
        .append("g")
            .attr("transform","translate(" + margin.left + "," + margin.top + ")");

    var sumstat = d3.index(data, (d) => d.fuel)

    // Create x-axis
    var x = d3.scaleLinear()
    .domain([years.estimated.first-0.2, years.estimated.last])
    .range([ 0, width ])

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).ticks(years.estimated.last-years.estimated.first).tickFormat(d3.format("d")))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick").selectAll("line").remove())
        .selectAll("text")
            .attr("transform", "translate(-5,0)rotate(-45)")
            .style("text-anchor", "end")
            .style("font-size", "1vmin")
            .style("font-family", "'Lato', sans-serif");

    const maxValue = (d) =>{
        var max = Number.NEGATIVE_INFINITY
        for(let i = years.estimated.first; i <= years.estimated.last; i++){
            let estimated = d["sum_estimated_generation_" + i]
            if(estimated >= max){max = estimated}
            /* if(i <= years.estimated.last && estimated == null){
                let estimated = d["sum_estimated_generation_" + i]
                if(estimated >= max){max = estimated}
            } */
        }
        return max
    }

    // Create y-axis
    var lineMax = d3.max(data, function(d) { return maxValue(d) })
    if (lineMax == null || !isFinite(lineMax) || lineMax <= 0) lineMax = 1
    var y = d3.scaleLinear()
        .domain([0, lineMax])
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
        .ticks(years.estimated.last-years.estimated.first)
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
          for(let year = years.estimated.first; year <= years.estimated.last; year++){
            /* if(d["sum_generation_" + year] != null){
                points.push({ year: year, value: d["sum_generation_" + year] })
            }else if(year <= years.estimated.last){
                points.push({ year: year, value: d["sum_estimated_generation_" + year] })
            } */
           points.push({year:year, value: d["sum_estimated_generation_" + year]})
          }
          const filtered = points.filter(p => p.value !== null);
          if(filtered.length == 1){
            const point = filtered[0]
            svg.append("circle")
                .attr("class", "lone-point")
                .attr("cx", x(point.year))
                .attr("cy", (point.value == null || point.value < 0) ? y(0.0) : y(point.value))
                .attr("r", 5)
                .attr("fill", d.colour);
          }
          return d3.line()
            .x(function(p) { return x(p.year); })
            .y(function(p) { return (p.value == null || p.value < 0) ? y(0.0) : y(p.value); })
            (filtered)
        })
}

export function drawBarChart(svgE, barChartWidth, barChartHeight, data, showPlot, svgId = "barChartSVG"){
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
    var margin = {top: Math.floor(8*scale), right: Math.floor(40*scale), bottom: Math.floor(40*scale), left: Math.floor(10*scale)}
    if(window.innerHeight <= 1024){margin = {top: Math.floor(15*scale), right: Math.floor(45*scale), bottom: Math.floor(55*scale), left: Math.floor(15*scale)}}
    var width = barChartWidth - margin.left - margin.right,
    height = barChartHeight - margin.top - margin.bottom;

    var svg = d3.select(svgE)
        .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("class", showPlot? null : "hide")
            .attr("id", svgId)
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

    var barMax = d3.max(data, function(d) { return d.sum_capacity_mw })
    if (barMax == null || !isFinite(barMax) || barMax <= 0) barMax = 1
    var y = d3.scaleLinear()
        .domain([0, barMax])
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
            .attr("height", function(d) {
                return (d.sum_capacity_mw==null || d.sum_capacity_mw<0)? 0.0 : height - y(d.sum_capacity_mw);
             })
            .attr("fill", function(d) {return d.colour})
}

// Creates the region drop down (with alphabet index)
export function getDropDown(onIndexClick, assetSources){
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

    dropDownField.appendChild(legendContainer)
    dropDownField.appendChild(alphabetIndexContainer)

    header.appendChild(title)
    header.appendChild(rollupIcon)
    dropDown.appendChild(header)
    dropDown.appendChild(dropDownField)
    return dropDown
}

// Creates the main diagram window (sidePanelLinePlot)
export function createDiagram({
    assetSources, fuels, regionalData, regionFilter,regionFilterRef,setRegionFilter,setFuelFilter, setBarChartFilter,
    onIndexClick, onContinentClick, onToggleClick, onLegendClick,
    comparison = false, years,
}){
    const ids = comparison ? {
        container: "sidePanelComparisonLinePlot",
        regionFilter: "compRegionFilter",
        continentFilter: "compLinePlotContinentFilter",
        header: "compLinePlotHeader",
        titleWrapper: "compLinePlotTitleWrapper",
        title: "compLinePlotTitle",
        toggleWrapper: "compDataToggleWrapper",
        toggleTitle: "compDataToggleTitle",
        toggleButtons: "compDataToggleButtonContainer",
        textCollector: "compLinePlotTextCollector",
        exBold: "compLinePlotExBoldText",
        exStandard: "compLinePlotExStandardText",
        body: "compLinePlotBody",
        fuelFilterContainer: "compFuelFilterContainer",
        selectAllName: "compFuelFilterSelectAllName",
        selectAllCircle: "compFuelFilterSelectAllCircle",
        selectAllCheck: "compFuelFilterSelectAllCheck",
        linePlotSvg: "compLinePlotSVG",
        barChartSvg: "compBarChartSVG",
    } : {
        container: "sidePanelLinePlot",
        regionFilter: "linePlotRegionFilter",
        continentFilter: "linePlotContinentFilter",
        header: "linePlotHeader",
        titleWrapper: "linePlotTitleWrapper",
        title: "linePlotTitle",
        toggleWrapper: "dataToggleWrapper",
        toggleTitle: "dataToggleTitle",
        toggleButtons: "dataToggleButtonContainer",
        textCollector: "linePlotTextCollector",
        exBold: "linePlotExBoldText",
        exStandard: "linePlotExStandardText",
        body: "linePlotBody",
        fuelFilterContainer: "fuelFilterContainer",
        selectAllName: "fuelFilterSelectAllName",
        selectAllCircle: "fuelFilterSelectAllCircle",
        selectAllCheck: "fuelFilterSelectAllCheck",
        linePlotSvg: "linePlotSVG",
        barChartSvg: "barChartSVG",
    }

    const container = document.createElement("div")
    container.id = ids.container

    // Region filter
    const regionFilterEl = document.createElement("div");
    regionFilterEl.id = ids.regionFilter
    regionFilterEl.appendChild(getDropDown(onIndexClick, assetSources))
    container.appendChild(regionFilterEl)

    // Continent buttons
    const continentFilter = document.createElement("div");
    continentFilter.id = ids.continentFilter

    const continents = ["Global", "Africa", "Asia","Europe","North America", "Oceania", "South America"]
    for(let i = 0; i<continents.length; i++){
        let continentButton = document.createElement("div");
        continentButton.classList.add("linePlotContinentButton");
        if(i == 0){ // First entry, selected by default
            continentButton.classList.add("continentSelected");
        }

        let continentName = document.createElement("span");
        continentName.textContent = continents[i];

        continentButton.onclick = () => onContinentClick(continentButton, continents[i], regionFilterRef, setRegionFilter, comparison)

        continentButton.appendChild(continentName)
        continentFilter.appendChild(continentButton)
    }
    container.appendChild(continentFilter)

    // Header
    const linePlotHeader = document.createElement("div");
    linePlotHeader.id = ids.header

    const titleAndDataWrapper = document.createElement("div");
    titleAndDataWrapper.id = ids.titleWrapper

    const linePlotTitle = document.createElement("span");
    linePlotTitle.id = ids.title;
    linePlotTitle.textContent = "Global Electricity Source Trends"

    const toggleWrapper = document.createElement("div");
    toggleWrapper.id = ids.toggleWrapper;

    const toggleTitle = document.createElement("span");
    toggleTitle.id = ids.toggleTitle;
    toggleTitle.textContent = "Show: ";

    const toggleButtons = document.createElement("div");
    toggleButtons.id = ids.toggleButtons

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
    linePlotTextCollector.id = ids.textCollector

    const linePlotExBold = document.createElement("span");
    linePlotExBold.id = ids.exBold
    linePlotExBold.textContent = "Global electric generation by source"

    const linePlotExStandard = document.createElement("span");
    linePlotExStandard.id = ids.exStandard
    linePlotExStandard.textContent = "(GWh)"

    linePlotTextCollector.appendChild(linePlotExBold)
    linePlotTextCollector.appendChild(linePlotExStandard)
    linePlotHeader.appendChild(linePlotTextCollector)

    container.appendChild(linePlotHeader)

    // Body of line plot (the graph and filter buttons)
    const linePlotBody = document.createElement("div");
    linePlotBody.id = ids.body;

    // SVG for actual line plot
    const dataVisualization = document.createElement("svg");

    // Container for fuelFilter
    const fuelFilterContainer = document.createElement("div");
    fuelFilterContainer.id = ids.fuelFilterContainer

    if(fuels){
        // Pixel dimensions for the side panel
        const sidePanelWidth =  Math.floor(window.innerWidth * 0.30);
        const sidePanelLeftMargin = Math.floor((window.innerHeight <= 1024)? window.innerWidth* 0.02 : window.innerWidth * 0.01)
        const sidePanelPadding = Math.floor(2*window.innerWidth * 0.01);

        // Pixel dimensions for the bar chart container
        const linePlotWidth = Math.floor((sidePanelWidth - sidePanelLeftMargin - sidePanelPadding) * 0.55)
        const linePlotHeight = Math.floor((window.innerHeight * 0.35) * 0.72)

        const shownRegionFuels = getShownRegionFuelData(regionalData, regionFilter, fuels, true, years)
        const allRegionFuels = getShownRegionFuelData(regionalData, regionFilter, fuels, false, years)
        drawLinePlot(dataVisualization, linePlotWidth,linePlotHeight, shownRegionFuels, true, ids.linePlotSvg, years)
        drawBarChart(dataVisualization, linePlotWidth, linePlotHeight, shownRegionFuels, false, ids.barChartSvg)

        // Select all option
        const selectAllEntry = document.createElement("div");
        selectAllEntry.classList.add("fuelFilterEntry");
        selectAllEntry.style.justifyContent = "flex-end";

        const selectAllName = document.createElement("span");
        selectAllName.id = ids.selectAllName
        selectAllName.textContent = "Deselect All"

        const selectAllCheckBox = document.createElement("div")
        selectAllCheckBox.id = ids.selectAllCircle
        selectAllCheckBox.style.backgroundColor = "rgba(0,0,0,0.0)"

        const selectAllCheck = document.createElement("img")
        selectAllCheck.id = ids.selectAllCheck
        selectAllCheck.src = assetSources.sidePanelSelectAllCircle

        selectAllCheckBox.onclick = () => onLegendClick("all", setBarChartFilter, setFuelFilter)
        selectAllCheckBox.appendChild(selectAllCheck)
        selectAllEntry.appendChild(selectAllName)
        selectAllEntry.appendChild(selectAllCheckBox)
        fuelFilterContainer.appendChild(selectAllEntry)

        // Fuel filter entries
        fuels.forEach(f =>{
            const regionFuel = allRegionFuels.find(rf => rf.fuel === f.fuel)
            const filterEntry = document.createElement("div");
            filterEntry.classList.add("fuelFilterEntry");

            const leftDiv = document.createElement("div");
            leftDiv.style.display = "flex";
            leftDiv.style.alignItems = "center"

            const filterColour = document.createElement("div");
            filterColour.classList.add("fuelFilterLegendColour");
            filterColour.style.backgroundColor = f.colour;

            // Add icon to colour box
            if(f.fuel != "Other"){
                const icon = document.createElement("img")
                icon.classList.add("legendIcon")
                icon.src = assetSources["fuelIcon" + f.fuel]
                filterColour.appendChild(icon)
            }

            const filterName = document.createElement("span");
            filterName.textContent = f.fuel

            leftDiv.appendChild(filterColour)
            leftDiv.appendChild(filterName)

            const rightDiv = document.createElement("div");
            rightDiv.style.display = "flex";
            rightDiv.style.alignItems = "center"

            const filterCapacity = document.createElement("span");
            filterCapacity.classList.add("fuelFilterValue", "hide", "ffCapacity");
            filterCapacity.textContent = formatPowerOf10(regionFuel ? regionFuel.sum_capacity_mw : f.sum_capacity_mw);

            const filterGeneration = document.createElement("span");
            filterGeneration.classList.add("fuelFilterValue", "ffGeneration");
            filterGeneration.textContent = formatPowerOf10(getLatestGenerationValue(regionFuel || f, years));

            const checkBox = document.createElement("div");
            checkBox.style.backgroundColor = "rgba(0,0,0,0.0)"
            checkBox.classList.add("fuelFilterCheckBox")

            const checkMark = document.createElement("img")
            checkMark.classList.add("fuelFilterCheckMark")
            checkMark.src = assetSources.sidePanelCheckMark

            checkBox.onclick = () => onLegendClick(f.fuel, setBarChartFilter,setFuelFilter)
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
    container.appendChild(linePlotBody)

    return container
}

export function createUsageGradient(container, colours, regionalData, mapMode){

    // Assumes the low carbon and fossil fuel usage data has the same lenghts
    const usageKeys = Object.keys(regionalData[0].usage_shares)
    const dataYears = usageKeys.map((s) => parseInt(s.replace(/^\D+/g, "")))

    let minUsage = Infinity
    let maxUsage = -Infinity
    regionalData.forEach(r => {
        for(let i = dataYears[0]; i <= dataYears[dataYears.length-1]; i++){
            const usage = (mapMode == "LC")? r.usage_shares?.[i]?.LC : r.usage_shares?.[i]?.FF

            if (usage != null) {
                if (usage < minUsage) minUsage = usage.toFixed(2)
                if (usage > maxUsage) maxUsage = usage.toFixed(2)
            }
        }
    })

    //console.log(mapMode + ": (Min: " + minUsage + ", Max: " + maxUsage + ")")

    const gradientHeight = "24dvh"
    const pixelHeight = Math.floor((window.innerHeight*0.24))

    const legend = document.createElement("div");
    legend.classList.add("gradientLegend")
    legend.style.height = gradientHeight
    legend.style.background = `linear-gradient(0deg, ${colours[0]} 0%, ${colours[1]} 100%)`

    const tickContainer = document.createElement("div");
    tickContainer.classList.add("gradientTickContainer");
    tickContainer.style.height = gradientHeight

    const nTicks = 8 // Same as the number of fuel filter entries
    const stepLength = (maxUsage-minUsage)/(nTicks-1)
    const tickValues = Array.from({ length: nTicks }, (value, index) => (maxUsage - (stepLength * index)).toFixed(0))
    for(let i = 0; i < nTicks; i++){
        const tick = document.createElement("spin");
        tick.classList.add("gradientTick");
        tick.textContent = "-   " + tickValues[i] + "%"
        tickContainer.appendChild(tick)
    }

    container.appendChild(legend)
    container.appendChild(tickContainer)

    return container
}