// Token addresses
TETHER_ADDRESS = "0xf7dCA3722d51062A9F1580340543419C34428EaE";
USDC_ADDRESS = "0x63F1A2bC12C63f956c4f59b3B9700b21433685f2";

// Uniswap contract address
WETH_ADDRESS = "0x178be338d891ec2abb3381b2b252f90401a70430";
FACTORY_ADDRESS = "0x4d577ff51f5f4c36d2480869dc51ec0d56c541dc";
SWAP_ROUTER_ADDRESS = "0x834245f2a2EE731C8eb69b1E2E8f5E4B205011bD";
NFT_DESCRIPTOR_ADDRESS = "0x62814e8C84474a308b86A5577FB440dffd027b80";
POSITION_DESCRIPTOR_ADDRESS = "0x2385f393A10d259FD65C1c736c514E2bc0f7A9A2";
POSITION_MANAGER_ADDRESS = "0x761ced8b0E79b1C57f8646226AE5333f997043ED";

const artifacts = {
  UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
};

const { Contract, BigNumber } = require("ethers");
const bn = require("bignumber.js");
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

const provider = ethers.provider;

function bigintSqrt(value) {
  if (value < 0n) {
    throw new Error("Cannot compute square root of a negative number");
  }
  if (value < 2n) {
    return value;
  }
  let x0 = value / 2n;
  let x1 = (x0 + value / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) / 2n;
  }
  return x0;
}

function encodePriceSqrt(reserve1, reserve0) {
  const numerator = BigInt(reserve1) << 192n; // 相当于乘以 2^192
  const denominator = BigInt(reserve0);
  const ratio = numerator / denominator;
  const sqrtPriceX96 = bigintSqrt(ratio);
  return sqrtPriceX96;
}

function sortTokens(tokenA, tokenB) {
  return tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];
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
