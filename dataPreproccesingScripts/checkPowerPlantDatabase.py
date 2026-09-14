import pandas as pd
import numpy as np
import json
import math

def loadCSV(path, delimiter=','):
    return pd.read_csv(path, delimiter=delimiter)

def checkData(df):
    entries = {}

    entries['N power plants'] = df.shape[0]
    entries['At least one reported value'] = 0
    entries['Has all reported values'] = 0
    entries['No reported, at least one estimated'] = 0
    entries['No reported, only estimated 2017'] = 0
    entries['No reported, only estimated 2017 with desired notes'] = 0
    entries['No reported, has all estimated values'] = 0
    entries['No reported, has all estimated values with desired notes'] = 0

    reportedCols = [col for col in df.columns if 'generation_gwh' in col and not 'estimated_generation_gwh' in col]
    estimatedCols = [col for col in df.columns if 'estimated_generation_gwh' in col]
    noteCols = [col for col in df.columns if 'estimated_generation_note' in col]

    desiredNotes = ["SOLAR-V1", "SOLAR-V1-NO-AGE", "WIND-V1", "HYDRO-V"]

    for index, row in df.iterrows():
        reportedCount = row[reportedCols].dropna().size
        estimatedCount = row[estimatedCols].dropna().size

        if reportedCount:
            entries['At least one reported value'] += 1

        if reportedCount == row[reportedCols].size:
            entries['Has all reported values'] += 1

        if not reportedCount and estimatedCount:
            entries['No reported, at least one estimated'] += 1
            if estimatedCount == 1 and pd.notna(row["estimated_generation_gwh_2017"]):
                entries['No reported, only estimated 2017'] += 1
                if row["estimated_generation_note_2017"] in desiredNotes:
                    entries['No reported, only estimated 2017 with desired notes'] += 1

        if not reportedCount and estimatedCount == row[estimatedCols].size:
            entries['No reported, has all estimated values'] += 1
            if all(row[noteCol] in desiredNotes for noteCol in noteCols):
                entries['No reported, has all estimated values with desired notes'] += 1

    print(entries)
    



if __name__ == '__main__':
    csvPath = './public/global_power_plant_database.csv'
    savePath = './public/regionalInformation.json'

    df = loadCSV(csvPath)

    checkData(df)