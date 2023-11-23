const blindBackrunJSON = require('./utils/BlindBackrun.json');
const ethers = require('ethers');

class BundleExecutor {
  constructor(_signer, _flashbotsBundleProvider, _contractAddress, _bundleAPI, _percentageToKeep) {
    if (!_signer || !_flashbotsBundleProvider || !_contractAddress || !_bundleAPI || !_percentageToKeep) {
      throw new Error('Missing required constructor parameters');
    }

    this.signer = _signer;
    this.flashBotsBundleProvider = _flashbotsBundleProvider;
    this.contract = new ethers.Contract(_contractAddress, blindBackrunJSON, this.signer);
    this.connectionInfo = {
      url: _bundleAPI,
    };
    this.nextID = 1;
    this.percentageToKeep = _percentageToKeep;

    console.log('Successfully created BundleExecutor');
  }

  async execute(_firstPair, _secondPair, _txHash) {
    try {
      console.log("Sending bundles to MatchMaker for tx:", _txHash);
      const [bundleOneWithParams, bundleTwoWithParams] = await this.buildBundles(_firstPair, _secondPair, _txHash);
      await this.sendBundleToMatchMaker(bundleOneWithParams, bundleTwoWithParams);
    } catch (error) {
      console.error("Error executing bundles:", error);
      throw error;
    }
  }

  async sendBundleToMatchMaker(_bundleOneWithParams, _bundleTwoWithParams) {
    try {
      await Promise.all([
        this.sendBundle(_bundleOneWithParams),
        this.sendBundle(_bundleTwoWithParams)
      ]);
    } catch (error) {
      console.error("Error sending bundles to MatchMaker:", error);
      throw error;
    }
  }

  async simBundle(_bundle) {
    try {
      const request = JSON.stringify(this.prepareRelayRequest([_bundle], 'mev_simBundle'));
      const response = await this.request(request);
      return response;
    } catch (error) {
      console.error("Error simulating bundle:", error);
      throw error;
    }
  }

  async sendBundle(_bundle) {
    try {
      const request = JSON.stringify(this.prepareRelayRequest([_bundle], 'mev_sendBundle'));
      const response = await this.request(request);
      console.log("response:", response);

      // Implement miner rewards
      const minerReward = response.result.minerReward;
      console.log("Miner reward:", minerReward);

      // Implement relay submission
      const relaySubmission = response.result.relaySubmission;
      console.log("Relay submission:", relaySubmission);
    } catch (error) {
      console.error("Error sending bundle:", error);
      throw error;
    }
  }

  prepareRelayRequest(_params, _method) {
    return {
      method: _method,
      params: _params,
      id: this.nextID++,
      jsonrpc: '2.0'
    };
  }

  async request(_request) {
    try {
      this.connectionInfo.headers = {
        'X-Flashbots-Signature': `${await this.signer.address}:${await this.signer.signMessage(ethers.utils.id(_request))}`
      };
      console.log("Making request:", _request);
      let resp = await ethers.utils.fetchJson(this.connectionInfo, _request);
      return resp;
    } catch (error) {
      console.error("Error making request:", error);
      throw error;
    }
  }

  async buildBundles(_firstPair, _secondPair, _txHash) {
    try {
      let blockNumber = Number(await this.signer.provider.getBlockNumber());
      console.log("Current block number:", blockNumber);
      console.log("Building bundles");

      let bundleTransactionOptions = {
        gasPrice: (await this.signer.provider.getGasPrice()),
        gasLimit: ethers.BigNumber.from(400000),
        nonce: await this.signer.getTransactionCount(),
      };

      let bundleOneTransaction = await this.contract.populateTransaction.executeArbitrage(
        _firstPair,
        _secondPair,
        this.percentageToKeep,
        bundleTransactionOptions
      );

      let bundleOne = [
        { hash: _txHash },
        { tx: await this.signer.signTransaction(bundleOneTransaction), canRevert: false },
      ];

      let bundleTwoTransaction = await this.contract.populateTransaction.executeArbitrage(
        _secondPair,
        _firstPair,
        this.percentageToKeep,
        bundleTransactionOptions
      );

      let bundleTwo = [
        { hash: _txHash },
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

  bundleWithParams(_blockNumber, _blocksToTry, _bundle) {
    try {
      console.log("Submitting bundles for block:", _blockNumber, "through block:", _blockNumber + _blocksToTry);
      console.log("hexvalue    :", ethers.utils.hexValue(_blockNumber));
      console.log("Other method:", "0x" + _blockNumber.toString(16));

      return {
        version: "beta-1",
        inclusion: {
          block: ethers.utils.hexValue(_blockNumber),
          maxBlock: ethers.utils.hexValue(_blockNumber + _blocksToTry)
        },
        body: _bundle,
      };
    } catch (error) {
      console.error("Error adding parameters to bundle:", error);
      throw error;
    }
  }
}

module.exports = BundleExecutor;
