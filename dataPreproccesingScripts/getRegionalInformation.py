import pandas as pd
import numpy as np
import json
import math

def loadCSV(path, delimiter=','):
    return pd.read_csv(path, delimiter=delimiter)

def sum_by_fuel(country_df, col):
    result = {}
    for fuel, group in country_df.groupby('primary_fuel')[col]:
        non_null = group.dropna()
        result[fuel] = float(non_null.sum()) if len(non_null) > 0 and non_null.sum() != 0 else None
    return result

def createJSON(path, dataframe, countries):
    entries = []
    for x in countries:
        data = {}
        countryDataframe = dataframe[(dataframe['country'] == x)]
        data['country'] = x
        data['country_long'] = countryDataframe['country_long'].loc[countryDataframe.index[0]]
        data['total_power_plants'] = countryDataframe.shape[0]


        commissioningYears = countryDataframe['commissioning_year'].dropna()

        data['oldest_power_plant'] = math.floor(commissioningYears.min()) if not math.isnan(commissioningYears.min()) else None
        data['newest_power_plant'] = math.floor(commissioningYears.max()) if not math.isnan(commissioningYears.max()) else None

        data['power_plants_by_fuel'] = {}
        for y in countryDataframe['primary_fuel']:
            if y in data['power_plants_by_fuel']:
                data['power_plants_by_fuel'][y] += 1
            else:
                data['power_plants_by_fuel'][y] = 1

        data['regional_annual_output'] = {}
        data['annual_output_by_fuel'] = {}
        data['regional_min_output'] = {}
        data['regional_max_output'] = {}

        for i in range(2013, 2020):
            col_reported = 'generation_gwh_' + str(i)
            reported = countryDataframe[col_reported]
            rep_total = reported.dropna().sum()
            reportedMin = reported.dropna().min()
            reportedMax = reported.dropna().max()
            data['regional_annual_output'][col_reported] = rep_total if reported.notna().any() and rep_total != 0 else None
            data['annual_output_by_fuel'][col_reported] = sum_by_fuel(countryDataframe, col_reported)
            data['regional_min_output'][col_reported] = reportedMin if not math.isnan(reportedMin) and reportedMin > 0  else None
            data['regional_max_output'][col_reported] = reportedMax if not math.isnan(reportedMax) and reportedMax > 0 else None

            if i < 2018:
                col_estimated = 'estimated_generation_gwh_' + str(i)
                estimated = countryDataframe[col_estimated]
                est_total = estimated.dropna().sum()
                estMin = estimated.dropna().min()
                estMax = estimated.dropna().max()
                data['regional_annual_output'][col_estimated] = est_total if estimated.notna().any() and est_total != 0 else None
                data['annual_output_by_fuel'][col_estimated] = sum_by_fuel(countryDataframe, col_estimated)
                data['regional_min_output'][col_estimated] = estMin if not math.isnan(estMin) and estMin > 0 else None
                data['regional_max_output'][col_estimated] = estMax if not math.isnan(estMax) and estMax > 0 else None

        entries.append(data)
    with open(path, "w") as f:
        json.dump(entries, f, indent=2)


if __name__ == '__main__':
    csvPath = './public/global_power_plant_database.csv'
    savePath = './public/regionalInformation.json'
    df = loadCSV(csvPath)
    c = df['country'].unique()
    createJSON(savePath, df,c)