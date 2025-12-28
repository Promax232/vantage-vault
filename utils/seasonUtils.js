function getSeasonProgress() {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const day = now.getDate();
    const year = now.getFullYear();
    // Define Season Windows
    // Winter: Jan-Mar | Spring: Apr-Jun | Summer: Jul-Sep | Fall: Oct-Dec
    const seasons = [
        { name: "WINTER", start: 0 }, { name: "SPRING", start: 3 },
        { name: "SUMMER", start: 6 }, { name: "FALL", start: 9 }
    ];
  const currentSeason =
    [...seasons].reverse().find(s => month >= s.start) || seasons[0];

    const nextSeasonName = currentSeason.name === "FALL" ? "WINTER" : seasons[seasons.findIndex(s => s.name === currentSeason.name) + 1].name;
    // Calculate progress within the 3-month window
    const seasonStartMonth = currentSeason.start;
    const totalDaysInSeason = 91; // Rough average
    const daysPassed = ((month - seasonStartMonth) * 30) + day;
    const percent = Math.min(99, Math.round((daysPassed / totalDaysInSeason) * 100));
    return { name: currentSeason.name, percent, next: nextSeasonName, year };
}
module.exports = { getSeasonProgress };