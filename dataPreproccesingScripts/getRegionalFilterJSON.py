import pandas as pd
import json

def loadCSV(path, delimiter=','):
    return pd.read_csv(path, delimiter=delimiter)

def createJSON(path, dataframe, countries,continets):
    entries = []
    for idx, x in enumerate(countries):
        data = {}
        data["id"] = idx
        data["country"] = x
        countryDataframe = dataframe[(dataframe['country'] == x)]
        data['country_long'] = countryDataframe['country_long'].loc[countryDataframe.index[0]]

        continentDataframe = continets[(continets['Country'] == data['country_long'])]
        data['continent'] = ''.join(continentDataframe['Continent'].values)
        if data['continent'] == '':
            data['continent'] = None

        data["show"] = True
        entries.append(data)

    with open(path, "w") as f:
        json.dump(entries, f, indent=2)

if __name__ == '__main__':
    csvPath = './public/global_power_plant_database.csv'
    continentPath = './public/countries_by_continent.csv'
    savePath = './public/regionalFilter.json'
    df = loadCSV(csvPath)
    cont = loadCSV(continentPath)
    c = df['country'].unique()
    createJSON(savePath, df,c, cont)