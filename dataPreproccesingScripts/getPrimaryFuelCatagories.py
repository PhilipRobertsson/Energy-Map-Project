import pandas as pd
import numpy as np
import json

def loadCSV(path, delimiter=','):
    return pd.read_csv(path, delimiter=delimiter)

def getColourAndID(fuelName):
    match fuelName:
        case "Coal":
            return ["#754a00", 0]
        case "Petcoke":
            return ["#a3a3a3", 1]
        case "Gas":
            return ["#fe95e2", 2]
        case "Oil":
            return ["#000000", 3]
        case "Nuclear":
            return ["#ffa742", 4]
        case "Biomass":
            return ["#80b3af", 5]
        case "Waste":
            return ["#81e4be", 6]
        case "Hydro":
            return ["#0892e7", 7]
        case "Tidal":
            return ["#2d6c94", 8]
        case "Wave and Tidal":
            return ["#0a027e", 9]
        case "Wind":
            return ["#89bcd7", 10]
        case "Solar":
            return ["#fed72a", 11]
        case "Geothermal":
            return ["#ea0611", 12]
        case "Cogeneration":
            return ["#8f2d0f", 13]
        case "Storage":
            return ["#7b653d", 14]
        case "Other":
            return ["#606280", 15]
        case _:
            return ["#E4E4E4", None]

def createJSON(path, list):
    entries = []
    for idx, x in enumerate(list):
        data = {}
        data['id'] = getColourAndID(x)[1] if getColourAndID(x)[1] is not None else list.len()
        data['fuel'] = x
        data['colour'] = getColourAndID(x)[0]
        data['show'] = True
        entries.append(data)

    sortedEntries = sorted(entries, key=lambda x: x['id'], reverse=False)
    with open(path, "w") as f:
        json.dump(sortedEntries, f, indent=2)


if __name__ == '__main__':
    csvPath = './public/global_power_plant_database.csv'
    savePath = './public/fuelCatagories.json'
    df = loadCSV(csvPath)
    primaryFuelsUnqiue = df['primary_fuel'].unique()
    other1Unqiue = df['other_fuel1'].unique()
    other2Unqiue = df['other_fuel2'].unique()
    other3Unqiue = df['other_fuel3'].unique()

    allFuels = pd.concat([df['primary_fuel'], df['other_fuel1'], df['other_fuel2'], df['other_fuel3']]).unique()
    allFuels = [x for x in allFuels if str(x) != 'nan']

    fuelJSON = createJSON(savePath, allFuels)