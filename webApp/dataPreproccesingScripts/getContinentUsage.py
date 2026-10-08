import pandas as pd
import numpy as np
import json
import math

def loadCSV(path, delimiter=','):
    return pd.read_csv(path, delimiter=delimiter)

def createJSON(path, lowCarbonDf, fossilFuelDf):
    entries = []
    desiredColumnPattern = "OWID"
    desiredEntities = ['World', 'Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America']
    yearBounds = lowCarbonDf[lowCarbonDf['Entity'] == 'Africa'].iloc[:,2]

    LCFiltered = lowCarbonDf[lowCarbonDf['Code'].str.contains(desiredColumnPattern)==True]
    FFFiltered = fossilFuelDf[fossilFuelDf['Code'].str.contains(desiredColumnPattern)==True]

    uniqueLC = set(LCFiltered['Entity'].unique())
    uniqueFF = set(FFFiltered['Entity'].unique())

    uniqueLCFiltered = res = [elem for elem in uniqueLC if elem in desiredEntities]
    uniqueFFFiltered = res = [elem for elem in uniqueFF if elem in desiredEntities]

    for idx, x in enumerate(uniqueLCFiltered):
        data = {}
        data['entity'] = x
        data['code'] = lowCarbonDf[lowCarbonDf['Entity'] == x].iloc[0,1]
        data['usage'] = {}
        for i in range(yearBounds[0], yearBounds[len(yearBounds)-1] + 1):
            data['usage'][str(i)] = {}
            lcUsage = lowCarbonDf[lowCarbonDf['Entity'] == x][lowCarbonDf['Year'] == i].iloc[0,3]
            ffUsage = fossilFuelDf[fossilFuelDf['Entity'] == x][fossilFuelDf['Year'] == i].iloc[0,3]

            data['usage'][str(i)]['LC'] = lcUsage if not math.isnan(lcUsage) else None
            data['usage'][str(i)]['FF'] = ffUsage if not math.isnan(ffUsage) else None

        entries.append(data)
            
    with open(path, "w") as f:
            json.dump(entries, f, indent=2)

if __name__ == "__main__":
    LCPath = './public/share-of-primary-energy-from-low-carbon-energy.csv'
    FFPath = './public/share-of-primary-energy-from-fossil-fuels.csv'
    savePath = './public/continentalInformation.json'

    LCDf = loadCSV(LCPath)
    FFDf = loadCSV(FFPath)

    createJSON(savePath, LCDf, FFDf)