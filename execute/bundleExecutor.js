const ethers = require('ethers');
const fetch = require('node-fetch');
const config = require('./utils/config.json');
const { SigningKey } = require('@ethersproject/signing-key');

const privateKey = '';
const provider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/eth_goerli');
const signer = new ethers.Wallet(privateKey, provider);

class BundleExecutor {
  constructor(signer, flashbotsBundleProvider, executorContractAddress, bundleAPI, percentageToKeep) {
    if (!signer || !flashbotsBundleProvider || !executorContractAddress || !bundleAPI || !percentageToKeep) {
      throw new Error('Missing required constructor parameters');
    }

    this.signer = signer;
    this.flashBotsBundleProvider = flashbotsBundleProvider;
    this.contract = new ethers.Contract(executorContractAddress, blindBackrunJSON, this.signer);
    this.connectionInfo = {
      url: bundleAPI,
      headers: {},
    };
    this.nextID = 1;
    this.percentageToKeep = percentageToKeep;

    console.log('Successfully created BundleExecutor');
  }

  async execute(firstPair, secondPair, transactionHash) {
    try {
      console.log("Sending bundles to MatchMaker for tx:", transactionHash);
      const transactionHashes = await Promise.all([
        this.simBundle(firstPair, transactionHash),
        this.simBundle(secondPair, transactionHash)
      ]);
      const bundlesWithParams = await this.buildBundles(firstPair, secondPair, transactionHashes);
      await this.sendBundlesToMatchMaker(bundlesWithParams);
    } catch (error) {
      console.error("Error executing bundles:", error);
      throw error;
    }
  }

  async simBundle(pair, transactionHash) {
    try {
      const request = JSON.stringify(this.prepareRelayRequest(pair, 'mev_simBundle'));
      const response = await this.request(request);
      const relaySubmission = response.result.relaySubmission;
      const matchingSubmission = relaySubmission.find(submission => submission.transactionHash === transactionHash);
      if (!matchingSubmission) {
        throw new Error(`Transaction hash ${transactionHash} not found in the simulation for pair ${pair}`);
      }
      const matchingHashes = relaySubmission.map(submission => submission.transactionHash);
      console.log(`Transaction Hashes for pair ${pair}:`, matchingHashes);
      return matchingHashes;
    } catch (error) {
      console.error("Error simulating bundle:", error);
      throw error;
    }
  }

  async sendBundlesToMatchMaker(bundlesWithParams) {
    try {
      await Promise.all(bundlesWithParams.map(bundleWithParams => this.sendBundle(bundleWithParams)));
    } catch (error) {
      console.error("Error sending bundles to MatchMaker:", error);
      throw error;
    }
  }

  async sendBundle(bundle) {
    try {
      const request = JSON.stringify(this.prepareRelayRequest([bundle], 'mev_sendBundle'));
      const response = await this.request(request);
      console.log("response:", response);

      const minerReward = response.result.minerReward;
      console.log("Miner reward:", minerReward);

      const relaySubmission = response.result.relaySubmission;
      console.log("Relay submission:", relaySubmission);
    } catch (error) {
      console.error("Error sending bundle:", error);
      throw error;
    }
  }

  prepareRelayRequest(params, method) {
    return {
      method: method,
      params: params,
      id: this.nextID++,
      jsonrpc: '2.0'
    };
  }

  async request(request) {
    try {
      this.connectionInfo.headers['X-Flashbots-Signature'] = `${await this.signer.address}:${await this.signer.signMessage(ethers.utils.id(request))}`;
      console.log("Making request:", request);

      const response = await fetch(this.connectionInfo.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.connectionInfo.headers,
        },
        body: request,
      });

      const respJson = await response.json();
      return respJson;
    } catch (error) {
      console.error("Error making request:", error);
      throw error;
    }
  }
  async buildBundles(firstPair, secondPair, transactionHashes) {
    try {
      const blockNumber = await this.signer.provider.getBlockNumber();
      console.log("Current block number:", blockNumber);
      console.log("Building bundles");
  
      const bundleTransactionOptions = {
        gasLimit: ethers.BigNumber.from(400000),
        nonce: await this.signer.getTransactionCount(),
      };
  
      // Get the gas prices for the transactions
      const gasPrices = await Promise.all([
        this.signer.provider.getGasPrice(),
        this.signer.provider.getGasPrice(),
      ]);
  
      // Sort the transactions based on gas price
      const sortedTransactionHashes = transactionHashes.sort((a, b) => {
        const gasPriceA = gasPrices[0];
        const gasPriceB = gasPrices[1];
        return gasPriceB.sub(gasPriceA);
      });
  
      const bundleOneTransaction = await this.contract.populateTransaction.executeArbitrage(
        firstPair,
        secondPair,
        this.percentageToKeep,
        bundleTransactionOptions
      );
  
      const bundleOne = [
        { hash: sortedTransactionHashes[0] },
        { tx: await this.signer.signTransaction(bundleOneTransaction), canRevert: false },
      ];
  
      const bundleTwoTransaction = await this.contract.populateTransaction.executeArbitrage(
        secondPair,
        firstPair,
        this.percentageToKeep,
        bundleTransactionOptions
      );
  
      const bundleTwo = [
        { hash: sortedTransactionHashes[1] },
        { tx: await this.signer.signTransaction(bundleTwoTransaction), canRevert: false },
      ];
  
      const bundleOneWithParams = this.bundleWithParams(blockNumber + 1, 10, bundleOne);
      const bundleTwoWithParams = this.bundleWithParams(blockNumber + 1, 10, bundleTwo);
  
      return [bundleOneWithParams, bundleTwoWithParams];
    } catch (error) {
      console.error("Error building bundles:", error);
      throw error;
    }
  }
  async buildBundles(firstPair, secondPair, transactionHashes) {
const currentGasPrice = await this.signer.provider.getGasPrice();
const gasPriceMultiplier = 1.5; // Adjust this multiplier as needed
const bundleTransactionOptions = {
  gasPrice: currentGasPrice.mul(gasPriceMultiplier),
  gasLimit: ethers.BigNumber.from(400000),
  nonce: await this.signer.getTransactionCount(),
};
try {
  const blockNumber = await this.signer.provider.getBlockNumber();
  console.log("Current block number:", blockNumber);
  console.log("Building bundles");

  const bundleTransactionOptions = {
    gasLimit: ethers.BigNumber.from(400000),
    nonce: await this.signer.getTransactionCount(),
  };

  // Get the gas prices for the transactions
  const gasPrices = await Promise.all([
    this.signer.provider.getGasPrice(),
    this.signer.provider.getGasPrice(),
  ]);

  // Sort the transactions based on gas price
  const sortedTransactionHashes = transactionHashes.sort((a, b) => {
    const gasPriceA = gasPrices[0];
    const gasPriceB = gasPrices[1];
    return gasPriceB.sub(gasPriceA);
  });

  const bundleOneTransaction = await this.contract.populateTransaction.executeArbitrage(
    firstPair,
    secondPair,
    this.percentageToKeep,
    bundleTransactionOptions
  );

  const bundleOne = [
    { hash: sortedTransactionHashes[0] },
    { tx: await this.signer.signTransaction(bundleOneTransaction), canRevert: false },
  ];

  const bundleTwoTransaction = await this.contract.populateTransaction.executeArbitrage(
    secondPair,
    firstPair,
    this.percentageToKeep,
    bundleTransactionOptions
  );

  const bundleTwo = [
    { hash: sortedTransactionHashes[1] },
    { tx: await this.signer.signTransaction(bundleTwoTransaction), canRevert: false },
  ];

  const bundleOneWithParams = this.bundleWithParams(blockNumber + 1, 10, bundleOne);
  const bundleTwoWithParams = this.bundleWithParams(blockNumber + 1, 10, bundleTwo);

  return [bundleOneWithParams, bundleTwoWithParams];
} catch (error) {
  console.error("Error building bundles:", error);
  throw error;
}
}
  bundleWithParams(blockNumber, blocksToTry, bundle) {
    try {
      console.log("Submitting bundles for block:", blockNumber, "through block:", blockNumber + blocksToTry);
      console.log("hexvalue    :", ethers.utils.hexValue(blockNumber));
      console.log("Other method:", "0x" + blockNumber.toString(16));

      return {
        version: "beta-1",
        inclusion: {
          block: ethers.utils.hexValue(blockNumber),
          maxBlock: ethers.utils.hexValue(blockNumber + blocksToTry)
        },
        body: bundle,
      };
    } catch (error) {
      console.error("Error adding parameters to bundle:", error);
      throw error;
    }
  }
}

(async () => {
  const flashbotsBundleProvider = config.flashbotsBundleProvider; // Use flashbotsBundleProvider details from config
  const executorContractAddress = config.executorContractAddress;
  const bundleAPI = config.bundleAPI;
  const percentageToKeep = config.percentageToKeep;

  const bundleExecutor = new BundleExecutor(
    signer,
    flashbotsBundleProvider,
    executorContractAddress,
    bundleAPI,
    percentageToKeep
  );

  const firstPair = await poolManager.checkFactory(factoryToCheck, token0, token1);
  const secondPair = await poolManager.checkFactory(factoryToCheck, token0, token1);
  const transactionHash = await fetchTransactionHashFromSimulations(); // Fetch the transaction hash from simulations

  await bundleExecutor.execute(firstPair, secondPair, transactionHash);
})();