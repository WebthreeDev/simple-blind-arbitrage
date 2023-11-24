import fetch from 'node-fetch';

class BundleSimulator {
  constructor(signer, bundleAPI) {
    this.signer = signer;
    this.bundleAPI = bundleAPI;
  }

  async simulateBundleAndGetPairAndHash() {
    try {
      const firstPair = await this.simulateBundleAndGetPair('ETH/USD');
      const secondPair = await this.simulateBundleAndGetPair('BTC/USD');
      const transactionHash = await this.simulateBundleAndGetTransactionHash();

      return { firstPair, secondPair, transactionHash };
    } catch (error) {
      console.error('Error simulating bundles:', error);
      throw error;
    }
  }

  async simulateBundleAndGetPair(pair) {
    try {
      const response = await this.fetchPairFromSimulation(pair);
      return response.pair;
    } catch (error) {
      console.error(`Error simulating pair ${pair}:`, error);
      throw error;
    }
  }

  async simulateBundleAndGetTransactionHash() {
    try {
      const response = await this.fetchTransactionHashFromSimulation();
      return response.transactionHash;
    } catch (error) {
      console.error('Error simulating transaction hash:', error);
      throw error;
    }
  }

  async fetchPairFromSimulation(pair) {
    const response = await fetch(`${this.bundleAPI}/simulatePair/${pair}`);
    return response.json();
  }

  async fetchTransactionHashFromSimulation() {
    const response = await fetch(`${this.bundleAPI}/simulateTransactionHash`);
    return response.json();
  }
}

// Example usage
(async () => {
  const privateKey = '0x84499016db2f064abe7fdf7598882c656927f08367047d20a871694b64967901';
  const provider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/eth_goerli');
  const signer = new ethers.Wallet(privateKey, provider);

  const bundleAPI = 'your_bundle_api_url'; // Replace with your actual bundle API URL
  const bundleSimulator = new BundleSimulator(signer, bundleAPI);

  const { firstPair, secondPair, transactionHash } = await bundleSimulator.simulateBundleAndGetPairAndHash();

  // Now you can use these values with your BundleExecutor
  const flashbotsBundleProvider = 'your_flashbots_bundle_provider';
  const executorContractAddress = 'your_executor_contract_address';
  const percentageToKeep = 'your_percentage_to_keep';

  const bundleExecutor = new BundleExecutor(
    signer,
    flashbotsBundleProvider,
    executorContractAddress,
    bundleAPI,
    percentageToKeep
  );

  await bundleExecutor.execute(firstPair, secondPair, transactionHash);
})();
