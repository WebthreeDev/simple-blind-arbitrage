const yargs = require('yargs');
const ethers = require('ethers');
const CustomEventSource = require('./utils/CustomEventSource.js');
const PoolManager = require('./poolManager.js');
const BundleExecutor = require('./bundleExecutor.js');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');
const config = require('./utils/config.json');
const {
  analyzeHistoricalTrend,
  analyzeMarketConditions,
  fetchDataForTokenPair,
  analyzeLiquiditySnapshot,
} = require('./HistoricalDataAnalyzer.js');
const ArbitrageManager = require('./ArbitrageManager.js');
const ArbitrageFunctions = require('./ArbitrageFunctions.js');
const LiquiditySnapshotAnalyzer = require('./LiquiditySnapshotAnalyzer.js');

require('dotenv').config();

// Function to analyze liquidity provision event and identify arbitrage opportunities
function analyzeLiquidityEvent(tokenPairAddress, provider, liquidityAmount, timestamp) {
  try {
    // Example: Check historical liquidity trends
    const historicalTrend = analyzeHistoricalTrend(tokenPairAddress, timestamp);

    // Example: Check current market conditions
    const marketConditions = analyzeMarketConditions();

    // Example: Fetch and analyze data from liquidity_snapshot.json
    const liquiditySnapshotData = fetchDataForTokenPair(tokenPairAddress);
    const liquidityAnalysis = analyzeLiquiditySnapshot(liquiditySnapshotData);

    // Example: Based on analysis, determine if there's a potential arbitrage opportunity
    const isArbitrageOpportunity = determineArbitrageOpportunity(historicalTrend, marketConditions, liquidityAnalysis);

    if (isArbitrageOpportunity) {
      // Log the identified arbitrage opportunity
      console.log('Identified Arbitrage Opportunity:');
      console.log({
        tokenPair: tokenPairAddress,
        provider: provider,
        liquidityAmount: liquidityAmount,
        timestamp: timestamp,
        historicalTrend: historicalTrend,
        marketConditions: marketConditions,
        liquidityAnalysis: liquidityAnalysis,
      });

      // Implement your logic to act on the identified arbitrage opportunity
      // For example, you can trigger the ArbitrageManager to initiate arbitrage
      ArbitrageManager.initiateArbitrage();
    }
  } catch (error) {
    console.error('Error analyzing liquidity provision event:', error);
  }
}

// Function to determine if there's a potential arbitrage opportunity based on price change
async function executeArbitrageBasedOnPriceChange(tokenPairAddress, oldPrice, newPrice, bundleExecutor) {
  try {
    const priceChange = newPrice - oldPrice;

    if (priceChange > 0) {
      console.log(`Executing arbitrage for token pair at address ${tokenPairAddress} due to price increase.`);

      // Example: Check if the price change is significant (e.g., greater than 1%)
      if (priceChange > 0.01 * oldPrice) {
        // Fetch additional data or perform checks specific to your arbitrage strategy
        const additionalData = await fetchAdditionalData(tokenPairAddress);

        // Example: Execute arbitrage based on your specific strategy
        await bundleExecutor.executeArbitrage(tokenPairAddress, additionalData);
      } else {
        console.log('Price change is not significant enough for arbitrage.');
      }
    } else if (priceChange < 0) {
      console.log(`Executing arbitrage for token pair at address ${tokenPairAddress} due to price decrease.`);

      // Example: Check if the price change is significant (e.g., greater than 1%)
      if (Math.abs(priceChange) > 0.01 * oldPrice) {
        // Fetch additional data or perform checks specific to your arbitrage strategy
        const additionalData = await fetchAdditionalData(tokenPairAddress);

        // Example: Execute arbitrage based on your specific strategy
        await bundleExecutor.executeArbitrage(tokenPairAddress, additionalData);
      } else {
        console.log('Price change is not significant enough for arbitrage.');
      }
    } else {
      console.log(`No significant price change for token pair at address ${tokenPairAddress}.`);
    }
  } catch (error) {
    console.error(`Error in executeArbitrageBasedOnPriceChange: ${error}`);
  }
}

// Function to fetch additional data for arbitrage decision-making
async function fetchAdditionalData(tokenPairAddress) {
  try {
    // Use CustomEventSource to fetch liquidity data from liquiditySnapshot.json
    const liquidityEventSource = new CustomEventSource(config.liquiditySnapshotEventSource);
    const liquidityData = await new Promise((resolve, reject) => {
      liquidityEventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.tokenPair === tokenPairAddress) {
            resolve(data.liquiditySnapshot);
          }
        } catch (error) {
          reject(error);
        }
      };

      // Set a timeout for handling cases where the event data is not received
      setTimeout(() => reject(new Error('Timeout waiting for liquidity data')), 5000);
    });

    // Example: Log the fetched liquidity data
    console.log('Fetched Liquidity Data:', liquidityData);

    return liquidityData;
  } catch (error) {
    console.error(`Error fetching additional data: ${error}`);
    throw error; // Rethrow the error for handling in the calling function if needed
  }
}

async function main() {
  try {
    // Parse the command line argument for the network to use
    const argv = yargs(process.argv.slice(2))
      .usage('Usage: $0 [options]')
      .example('$0 -n network', 'Execute bundles on mainnet')
      .options({
        network: {
          alias: 'n',
          describe: 'The network (mainnet, goerli) to use',
          demandOption: true,
          type: 'string',
        },
      })
      .help()
      .argv;

    const provider = new ethers.providers.JsonRpcProvider(process.env.rpcUrl);
    const signer = new ethers.Wallet(process.env.privateKey, provider);
    const flashbotsBundleProvider = await FlashbotsBundleProvider.create(provider, signer);
    const poolManager = new PoolManager(provider, argv.network);

    console.log('Loaded wallet with address:', signer.address);

    let MatchMaker, bundleExecutor;

    if (argv.network === 'mainnet') {
      MatchMaker = new CustomEventSource(config.mainnetMatchMaker);
      bundleExecutor = new BundleExecutor(
        signer,
        flashbotsBundleProvider,
        process.env.executorContractAddress,
        config.mainnetBundleAPI,
        config.percentageToKeep
      );
    } else if (argv.network === 'goerli') {
      MatchMaker = new CustomEventSource(config.goerliMatchMaker);
      bundleExecutor = new BundleExecutor(
        signer,
        flashbotsBundleProvider,
        process.env.executorContractAddress,
        config.goerliBundleAPI,
        config.percentageToKeep
      );
    }

    // Additional event source for liquidity data
    const liquidityEventSource = new CustomEventSource(config.liquiditySnapshotEventSource);

    MatchMaker.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('New transaction with hash:', data.hash);

        if (data.logs == null) {
          return;
        }

        console.log('Transaction has logs, parsing them');
        for (let i = 0; i < data.logs.length; i++) {
          console.log(data.logs[i]);

          if (data.logs[i].topics[0] !== config.syncTopic) {
            continue;
          }

          const firstPair = data.logs[i].address;
          console.log('Transaction trading on Uniswap v2 pool detected! Pool address:', firstPair);

          const [token0, token1, factoryToCheck] = await poolManager.checkPool(firstPair);

          if (token0 === false || token1 === false || factoryToCheck === false) {
            return;
          }

          const secondPair = await poolManager.checkFactory(factoryToCheck, token0, token1);

          if (secondPair === false) {
            return;
          }

          // Fetch additional liquidity data
          const additionalLiquidityData = await fetchAdditionalData(firstPair, liquidityEventSource);

          // Execute arbitrage with additional data
          const privacyLevel = 2; // Set the privacy level to 2
          const signedBundle = await flashbotsBundleProvider.signBundle(bundle, privacyLevel);
          await bundleExecutor.executeArbitrage(firstPair, secondPair, data.hash, additionalLiquidityData, signedBundle);
        }
      } catch (error) {
        console.error('Error processing event:', error);
      }
    };

    MatchMaker.onerror = (error) => {
      console.error('MatchMaker error:', error);
    };
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

main();

// Export relevant functions
module.exports = {
  analyzeLiquidityEvent,
  executeArbitrageBasedOnPriceChange,
  fetchAdditionalData,
};