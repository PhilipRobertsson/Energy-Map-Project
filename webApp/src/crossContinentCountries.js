// Countries that span more than one continent.
//
// The region filter data (regionalFilter.json) stores a single "primary"
// continent per country (e.g. Russia -> Europe), so this mapping is used to
// include these countries when filtering by any of their continents.
export const crossContinentCountries = {
    AZE: ["Europe", "Asia"],
    GEO: ["Europe", "Asia"],
    KAZ: ["Europe", "Asia"],
    RUS: ["Europe", "Asia"],
    TUR: ["Europe", "Asia"],
    EGY: ["Africa", "Asia"],
    PAN: ["North America", "South America"]
}
