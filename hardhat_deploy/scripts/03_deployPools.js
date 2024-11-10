// Token addresses
TETHER_ADDRESS = "0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07";
USDC_ADDRESS = "0x162A433068F51e18b7d13932F27e66a3f99E6890";
WRAPPED_BITCOIN_ADDRESS = "0x922D6956C99E12DFeB3224DEA977D0939758A1Fe";

// Uniswap contract address
WETH_ADDRESS = "0x7969c5eD335650692Bc04293B07F5BF2e7A673C0";
FACTORY_ADDRESS = "0x7bc06c482DEAd17c0e297aFbC32f6e63d3846650";
SWAP_ROUTER_ADDRESS = "0xc351628EB244ec633d5f21fBD6621e1a683B1181";
NFT_DESCRIPTOR_ADDRESS = "0xFD471836031dc5108809D173A067e8486B9047A3";
POSITION_DESCRIPTOR_ADDRESS = "0xcbEAF3BDe82155F56486Fb5a1072cb8baAf547cc";
POSITION_MANAGER_ADDRESS = "0x1429859428C0aBc9C2C47C8Ee9FBaf82cFA0F20f";

const artifacts = {
  UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
};

const { Contract, BigNumber } = require("ethers");
const bn = require("bignumber.js");
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

const provider = waffle.provider;

function encodePriceSqrt(reserve1, reserve0) {
  return BigNumber.from(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  );
}

const nonfungiblePositionManager = new Contract(
  POSITION_MANAGER_ADDRESS,
  artifacts.NonfungiblePositionManager.abi,
  provider
);
const factory = new Contract(
  FACTORY_ADDRESS,
  artifacts.UniswapV3Factory.abi,
  provider
);

function sortTokens(tokenA, tokenB) {
  return tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];
}

async function deployPool(tokenA, tokenB, fee, price) {
  const [owner] = await ethers.getSigners();
  // 需要注意的是 V3 中 token 得顺序是也是基于地址大小排序（token0 < token1），而这里的排序是需要自己链下判断的
  const [token0, token1] = sortTokens(tokenA, tokenB);
  await nonfungiblePositionManager
    .connect(owner)
    .createAndInitializePoolIfNecessary(token0, token1, fee, price, {
      gasLimit: 5000000,
    });
  const poolAddress = await factory.connect(owner).getPool(token0, token1, fee);
  return poolAddress;
}

async function main() {
  const usdtUsdc500 = await deployPool(
    TETHER_ADDRESS,
    USDC_ADDRESS,
    500,
    encodePriceSqrt(1, 1)
  );
  console.log("USDT_USDC_500=", `'${usdtUsdc500}'`);
}

/*
npx hardhat run --network localhost scripts/03_deployPools.js
*/

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
