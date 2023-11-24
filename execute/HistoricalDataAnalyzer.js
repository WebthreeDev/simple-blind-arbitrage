// HistoricalDataAnalyzer.js

const fs = require('fs');

class HistoricalDataAnalyzer {
  static analyzeHistoricalTrend(tokenPairAddress, timestamp, liquiditySnapshotPath = './liquidity_snapshot.json') {
    try {
      // Read liquidity snapshot data from the provided file path
      const liquiditySnapshotData = fs.readFileSync(liquiditySnapshotPath, 'utf8');
      const snapshot = JSON.parse(liquiditySnapshotData);

      // Retrieve historical data for the specified token pair
      const historicalData = snapshot.historicalData[tokenPairAddress];

      // Analyze the historical trend based on the provided timestamp
      const trendAtTimestamp = historicalData.find((dataPoint) => dataPoint.timestamp === timestamp);

      // Determine if the trend is upward based on historical data
      const isUpward = trendAtTimestamp ? trendAtTimestamp.priceChange > 0 : false;

      // Return the result of the historical trend analysis
      return { isUpward, trendAtTimestamp };
    } catch (error) {
      // Handle errors that may occur during the analysis process
      console.error(`Error in analyzeHistoricalTrend: ${error}`);
      throw error;
    }
  }
}

module.exports = HistoricalDataAnalyzer;
