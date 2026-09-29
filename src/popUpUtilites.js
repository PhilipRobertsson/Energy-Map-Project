import * as d3 from "d3";
import { drawUsageLinePlot} from './sidePanelUtilities.js'

export function createPopUpBarChart(parent, country, regionalData,fuelFilter, estimatedYears, assetSources, selection){
    const countryData = regionalData.find(r => r.country == country)

    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
    const contentWidth = selection ? Math.round(400*scale) : Math.round(390*scale)

    const contentElement = selection ? parent.querySelectorAll(".pop-up-info")[0] : document.createElement("div")
    if(!selection){contentElement.classList.add("regional-overview-info", "hide")}

    const infoHeader = document.createElement("span")
    const infoTitle = document.createElement("strong")
    const infoValue = document.createElement("span")

    var latestDataYear = 0
    var latestDataValue = 0
    for(var i = estimatedYears.last; i >=estimatedYears.first; i--){
        var tempEstimated = eval("countryData.regional_annual_output.estimated_generation_gwh_" + i)
       if(tempEstimated != null){
        latestDataYear = i
        latestDataValue = tempEstimated
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
        infoIcon.src = selection ? assetSources.infoIcon : assetSources.popupInfo
        
        // Add tooltip
        const infoToolTip = document.createElement("div")
        infoToolTip.className = "generationInfoTooltip"
        const infoToolTipText = document.createElement("span")
        infoToolTipText.className = "generationInfoTooltipText"
        infoToolTipText.textContent = "Estimated annual generation " + latestDataYear + " in gigawatt hours (GWhs)"
        
        infoToolTip.appendChild(infoToolTipText)
        infoWrapper.appendChild(infoIcon)
        infoWrapper.appendChild(infoToolTip)
        infoHeader.appendChild(infoWrapper)
    }

    contentElement.appendChild(infoHeader)

    var latestData = {}
    for(var i = estimatedYears.last; i >=estimatedYears.first; i--){
        var tempEstimated = eval("countryData.annual_output_by_fuel.estimated_generation_gwh_" + i)

        // Removes null items from the object
        const cleanObject = (object) =>
                Object.fromEntries(
                Object.entries(object)
                .filter(([_, value]) => value)
        );

        // Insert year into data
        const insertLastDataYear = (fuel, year) =>{
            latestData[fuel]['year'] = year
        }

        // Insert generation value into data
        const insertLastDataValue = (fuel, value) =>{
            latestData[fuel]['value'] = value
        }

        // Only save estimated values; reported is always false for these entries
        Object.keys(cleanObject(tempEstimated)).forEach((fuel)=>{
            if (!(fuel in latestData)) {
                latestData[fuel] = {}
                insertLastDataYear(fuel, i)
                insertLastDataValue(fuel, tempEstimated[fuel])
            }
        })
    }

    // Convert latestData object to array for D3
    const latestDataArray = Object.entries(latestData).map(([fuel, data]) => ({
        fuel,
        value: data.value,
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

    // Will be represented as "other" in the bar-charts, this methods avoids changing the data used
    const unwantedCatagories = ["Petcoke", "Wave and Tidal", "Tidal","Geothermal", "Cogeneration", "Storage","Biomass", "Waste"]

    // Go through array and reassign unwanted catagories to "Other"
    latestDataArray.forEach((d)=>{
      if(unwantedCatagories.includes(d.fuel)){
        var otherField = latestDataArray.find((d) =>"Other" == d.fuel)
        otherField.value += d.value
        if(d.year > otherField.year){
            otherField.year = d.year
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

    // Finds the max value in the data
    const findMax = (data) =>{
        var max = 0
        data.forEach(d => {
            if(d.value > max){max = d.value}
        })
        return max
    }

    // Converts the generation value to a percentage of the total generation in the region
    const getPercentage = (value) =>{
        var total = 0
        latestDataArray.forEach((elem)=>{
            total += elem.value
        })
        return (value/total) * 100
    }

    // Variables for D3 code
        const barChartContainer = document.createElement("div")
        if(selection){barChartContainer.classList.add("pop-up-selection-svg")}
        else{barChartContainer.classList.add("regional-overview-svg", "hide")}
        var barChartPadding = 0.2 
        var barHeight = Math.round(35 * scale)
        var barChartWidth = contentWidth
        var barChartHeight = latestDataArray.length * (barHeight + barChartPadding)
        var margin = {top: 0, right: Math.round(100 * scale), bottom: 0, left: Math.round(100 * scale)},
              width = barChartWidth - margin.left - margin.right,
              height = barChartHeight - margin.top - margin.bottom;
        
        // D3 code
        var svg = d3.select(barChartContainer)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
                .attr("class", "barchartContainer")
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
            return fuelFilter.find(f=>f.fuel == fuel).colour
        }
    
        //Bars
        svg.selectAll("myRect")
            .data(latestDataArray)
            .enter()
            .append("rect")
            .attr("x", x(0))
            .attr("y", d => y(d.fuel))
            .attr("class", d => "bar_" + d.fuel)
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
            .style("font-size", "1.8vmin")
            .style("font-family", "'Lato', sans-serif");
    
        contentElement.appendChild(barChartContainer)

        if(!selection){return contentElement}
}

export function createPopUpUsagePlot(parent, country, regionalData, shareYears, selection){
    const usageShares = selection ? regionalData.find(r => r.country == country).usage_shares : JSON.parse(country.usageShares)

    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
    const contentWidth = Math.round(400*scale)

    const contentElement = selection ? parent.querySelectorAll(".pop-up-info")[1] : parent

    const yearFilterEl = document.getElementById("shareYearFilterContainer")
    let year
    if(yearFilterEl){ // If the share year filter exists, use the specific choice there for pop-up
        year = yearFilterEl.querySelector(".sliderValueText").textContent
    }else{ // Else just use the latest available data point
        year = Object.keys(usageShares)[Object.keys(usageShares).length - 1]
    }

    const ShareField = document.createElement("span")
    const ShareTitle = document.createElement("strong")
    ShareTitle.textContent = "Usage Shares " + year + ": "
    ShareField.appendChild(ShareTitle)

    const LCShareField = document.createElement("span")
    const LCShareTitle = document.createElement("strong")
    const LCShareValue = document.createElement("span");
    LCShareTitle.textContent = "Low Carbon: "
    if(usageShares[String(year)]["LC"]?.toFixed(0)){LCShareValue.textContent = usageShares[String(year)]["LC"]?.toFixed(0) + "%"}
    else{LCShareValue.textContent = "N/A"}
    LCShareField.appendChild(LCShareTitle)
    LCShareField.appendChild(LCShareValue)

    const FFShareField = document.createElement("span")
    const FFShareTitle = document.createElement("strong")
    const FFShareValue = document.createElement("span");
    FFShareTitle.textContent = "Fossil Fuel: "
    if(usageShares[String(year)]["FF"]?.toFixed(0)){FFShareValue.textContent = usageShares[String(year)]["FF"]?.toFixed(0) + "%"}
    else{FFShareValue.textContent = "N/A"}
    FFShareField.appendChild(FFShareTitle)
    FFShareField.appendChild(FFShareValue)

    contentElement.appendChild(ShareField)
    contentElement.appendChild(LCShareField)
    contentElement.appendChild(FFShareField)

    // Display line plot based on available information
    const usageDiagram = document.createElement("div")
    usageDiagram.classList.add("pop-up-diagram")
      
    const diagramWidth = selection ? contentWidth : Math.floor(420 * scale)
    const diagramHeight = Math.floor(210 * scale)
    
    drawUsageLinePlot(usageDiagram, diagramWidth, diagramHeight, [{ usage: usageShares }], "popUpUsagePlot", shareYears)

    contentElement.appendChild(usageDiagram)

    if(!selection){return contentElement}
}