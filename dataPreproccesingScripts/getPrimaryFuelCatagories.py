import pandas as pd
import numpy as np
import json

def loadCSV(path, delimiter=','):
    return pd.read_csv(path, delimiter=delimiter)

def getColourAndID(fuelName):
    match fuelName:
        case "Coal":
            return ["#66c2a5", 0]
        #case "Petcoke": Only 12 points in data
            #return ["#a3a3a3", 1]
        case "Gas":
            return ["#fc8d62", 1]
        case "Oil":
            return ["#8da0cb", 2]
        case "Nuclear":
            return ["#e78ac3", 3]
        #case "Biomass":
            #return ["#80b3af", 4]
        #case "Waste":
            #return ["#81e4be", 5]
        case "Hydro":
            return ["#a6d854", 4]
        #case "Tidal": Does not show up apparently
            #return ["#2d6c94", 8]
        #case "Wave and Tidal": Only 10 points in data
            #return ["#0a027e", 9]
        case "Wind":
            return ["#ffd92f", 5]
        case "Solar":
            return ["#e5c494", 6]
        #case "Geothermal": Only 189 points in data
            #return ["#ea0611", 12]
        #case "Cogeneration": Only 41 points in data
            #return ["#8f2d0f", 13]
        #case "Storage": Only 135 points in data
            #return ["#7b653d", 14]
        case "Other" | "Petcoke" | "Wave and Tidal" | "Tidal" | "Geothermal" | "Cogeneration" | "Storage" | "Biomass" | "Waste":
            return ["#606280", 7]
        case _:
            return ["#E4E4E4", None]

def createJSON(path, list, genFuel):
    # The generation columns present in the data frame
    generationCols = [c for c in genFuel.columns if c != 'primary_fuel']

    # Sum generation data for each primary fuel
    grouped = genFuel.groupby('primary_fuel')[generationCols].sum()

    otherFuels = ["Petcoke", "Wave and Tidal", "Tidal", "Geothermal", "Cogeneration", "Storage", "Biomass", "Waste"]

    def cleanSum(value):
        if pd.isna(value):
            return None
        value = float(value)
        return None if value == 0.0 else value

    # Build a lookup of fuel -> summed generation, replacing NaN/0 with None
    sumsByFuel = {}
    for fuel in grouped.index:
        sumsByFuel[fuel] = {
            col: cleanSum(grouped.loc[fuel, col])
            for col in generationCols
        }

    # Aggregate the "Other" category from its constituent fuels
    otherSums = {col: 0.0 for col in generationCols}
    for fuel in otherFuels:
        if fuel in sumsByFuel:
            for col in generationCols:
                value = sumsByFuel[fuel][col]
                otherSums[col] += value if value is not None else 0.0
    sumsByFuel["Other"] = {col: cleanSum(v) for col, v in otherSums.items()}

    def toFieldName(col):
        return col.replace('estimated_generation_gwh_', 'sum_estimated_generation_').replace('generation_gwh_', 'sum_generation_')

    entries = []
    for idx, x in enumerate(list):
        data = {}
        data['id'] = getColourAndID(x)[1] #if getColourAndID(x)[1] is not None else list.len()
        data['fuel'] = x
        data['colour'] = getColourAndID(x)[0]
        data['show'] = True
        if data['fuel'] in sumsByFuel:
            for col in generationCols:
                data[toFieldName(col)] = sumsByFuel[data['fuel']][col]
        if data['fuel'] not in ["Petcoke", "Wave and Tidal", "Tidal", "Geothermal", "Cogeneration", "Storage","Biomass", "Waste"]:
            entries.append(data)

    sortedEntries = sorted(entries, key=lambda x: x['id'], reverse=False)

    with open(path, "w") as f:
        json.dump(sortedEntries, f, indent=2)


if __name__ == '__main__':
    csvPath = './public/global_power_plant_database.csv'
    savePath = './public/fuelCatagories.json'
    df = loadCSV(csvPath)
    generationByFuel = df[['primary_fuel',
                   'generation_gwh_2013', 'generation_gwh_2014', 'generation_gwh_2015',
                   'generation_gwh_2016','generation_gwh_2017','generation_gwh_2018',
                   'generation_gwh_2019','estimated_generation_gwh_2013', 'estimated_generation_gwh_2014',
                   'estimated_generation_gwh_2015','estimated_generation_gwh_2016','estimated_generation_gwh_2017']]
    primaryFuelsUnqiue = df['primary_fuel'].unique()
    other1Unqiue = df['other_fuel1'].unique()
    other2Unqiue = df['other_fuel2'].unique()
    other3Unqiue = df['other_fuel3'].unique()

    allFuels = pd.concat([df['primary_fuel'], df['other_fuel1'], df['other_fuel2'], df['other_fuel3']]).unique()
    allFuels = [x for x in allFuels if str(x) != 'nan']

    fuelJSON = createJSON(savePath, allFuels, generationByFuel)