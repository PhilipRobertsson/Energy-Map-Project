import pandas as pd
import numpy as np
import json

def loadCSV(path, delimiter=','):
    return pd.read_csv(path, delimiter=delimiter)

def getColour(fuelName):
    match fuelName:
        case "Coal":
            return "#BA9C69"
        case "Petcoke":
            return "#8B8373"
        case "Gas":
            return "#E5BDBE"
        case "Oil":
            return "#706557"
        case "Nuclear":
            return "#E5D347"
        case "Biomass":
            return "#8DCFCB"
        case "Waste":
            return "#7dc1a8"
        case "Hydro":
            return "#5A9FC9"
        case "Tidal":
            return "#2d6c94"
        case "Wave and Tidal":
            return "#0E3751"
        case "Wind":
            return "#9BBFD2"
        case "Solar":
            return "#DDCF90"
        case "Geothermal":
            return "#9d4429"
        case "Cogeneration":
            return "#db552c"
        case "Storage":
            return "#50442e"
        case "Other":
            return "#8E91BC"
        case _:
            return "#000000"

def createJSON(path, list):
    entries = []
    for idx, x in enumerate(list):
        data = {}
        data['id'] = idx
        data['fuel'] = x
        data['colour'] = getColour(x)
        data['show'] = True
        entries.append(data)

    with open(path, "w") as f:
        json.dump(entries, f, indent=2)


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