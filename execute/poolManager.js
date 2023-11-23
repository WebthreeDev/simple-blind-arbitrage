const ethers = require('ethers');
const poolABI = require('./utils/uniswapPairV2ABI.json');
const factoryABI = require('./utils/uniswapFactoryV2ABI.json');
const config = require('./utils/config.json');

class PoolManager {
  constructor(provider, network) {
    this.provider = provider;
    this.network = network;
    this.UniswapFactoryAddress = this.getFactoryAddress(network, 'Uniswap');
    this.SushiFactoryAddress = this.getFactoryAddress(network, 'Sushi');
    this.WETHAddress = this.getWETHAddress(network);
    this.pools = {}; // Store all Uniswap v2 pairs upfront
    console.log("PoolManager initialized for network:", network);
  }

  getFactoryAddress(network, type) {
    if (network === 'mainnet') {
      return type === 'Uniswap' ? config.mainnetUniswapFactoryAddress : config.mainnetSushiFactoryAddress;
    } else if (network === 'goerli') {
      return type === 'Uniswap' ? config.goerliUniswapFactoryAddress : config.goerliSushiFactoryAddress;
    }
    return null;
  }

  getWETHAddress(network) {
    return network === 'mainnet' ? config.mainnetWETHAddress : config.goerliWETHAddress;
  }

  async checkPool(address) {
    if (this.pools[address]) {
      return this.pools[address];
    }

    try {
      const poolContract = new ethers.Contract(address, poolABI, this.provider);
      const [token0, token1, factory] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.factory()
      ]);

      console.log("Pool contract created, getting tokens");
      console.log("Token0:", token0);
      console.log("Token1:", token1);
      console.log("Factory:", factory);

      if (token0 === this.WETHAddress || token1 === this.WETHAddress) {
        console.log("Pool is WETH pair");
        const alternativeFactory = factory === this.UniswapFactoryAddress ? this.SushiFactoryAddress : this.UniswapFactoryAddress;
        const pool = [token0, token1, alternativeFactory];
        this.pools[address] = pool; // Cache the pool for future use
        return pool;
      } else {
        console.log("Pool is not WETH pair, WETH address is:", this.WETHAddress);
        return [false, false, false];
      }
    } catch (error) {
      console.error("Error checking pool:", error);
      return [false, false, false];
    }
  }

  async checkFactory(factoryAddress, token0, token1) {
    try {
      const factoryContract = new ethers.Contract(factoryAddress, factoryABI, this.provider);
      console.log("Checking alternative factory for pair");
      const pair = await factoryContract.getPair(token0, token1);

      if (pair === "0x0000000000000000000000000000000000000000") {
        console.log("Pair does not exist on alternative factory, returning");
        return false;
      } else {
        console.log("Alternate pair exists! Pair address:", pair);
        return pair;
      }
    } catch (error) {
      console.error("Error checking factory:", error);
      return false;
    }
  }
}

module.exports = PoolManager;
