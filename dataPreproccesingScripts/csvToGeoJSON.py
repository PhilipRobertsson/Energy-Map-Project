import pandas as pd
import numpy as np
import math
import json

def loadCSV(path, delimiter=','):
    return pd.read_csv(path, delimiter=delimiter)

def createJSON(path, dataframe):
    geojson = {'type':'FeatureCollection', 'features':[]}
    allButLatLong = dataframe.drop(['latitude', 'longitude'], axis=1)
    generationData = dataframe[['generation_gwh_2013', 'generation_gwh_2014', 'generation_gwh_2015', 'generation_gwh_2016', 'generation_gwh_2017', 'generation_gwh_2018', 'generation_gwh_2019',
                                                   'estimated_generation_gwh_2013', 'estimated_generation_gwh_2014', 'estimated_generation_gwh_2015', 'estimated_generation_gwh_2016', 'estimated_generation_gwh_2017']]
    for _, row in dataframe.iterrows():
        # create a feature template to fill in
        feature = {'type':'Feature',
                   'properties':{},
                   'geometry':{'type':'Point',
                               'coordinates':[]}}
        feature['geometry']['coordinates'] = [row['longitude'],row['latitude']]
        for prop in allButLatLong: # Rewrite to have all columns apart from longitude and latitude
            if type(row[prop]) is float:
                feature['properties'][prop] = row[prop] if not math.isnan(row[prop])  else None
            else: 
                feature['properties'][prop] = row[prop]

        # find minMax generation
        min = float('inf')
        max = float('-inf')

        for prop in generationData:
            if math.isnan(row[prop]): continue
            if row[prop] < min: min = row[prop]
            if row[prop] > max: max = row[prop]
        
        feature['properties']['minMax'] = [min if not min == float('inf') else None, max if not max == float('-inf') else None]
        # add this feature (aka, converted dataframe row) to the list of features inside our dict
        geojson['features'].append(feature)
    
    with open(path, "w") as f:
        json.dump(geojson, f, indent=2)

if __name__ == '__main__':
    csvPath = './public/global_power_plant_database.csv'
    savePath = './public/global_power_plant_database.geojson'
    df = loadCSV(csvPath)

    createJSON(savePath, df)