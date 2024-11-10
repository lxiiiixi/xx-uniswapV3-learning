WETH_ADDRESS = "0x7969c5eD335650692Bc04293B07F5BF2e7A673C0";
FACTORY_ADDRESS = "0x7bc06c482DEAd17c0e297aFbC32f6e63d3846650";
SWAP_ROUTER_ADDRESS = "0xc351628EB244ec633d5f21fBD6621e1a683B1181";
NFT_DESCRIPTOR_ADDRESS = "0xFD471836031dc5108809D173A067e8486B9047A3";
POSITION_DESCRIPTOR_ADDRESS = "0xcbEAF3BDe82155F56486Fb5a1072cb8baAf547cc";
POSITION_MANAGER_ADDRESS = "0x1429859428C0aBc9C2C47C8Ee9FBaf82cFA0F20f";

TETHER_ADDRESS = "0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07";
USDC_ADDRESS = "0x162A433068F51e18b7d13932F27e66a3f99E6890";
WRAPPED_BITCOIN_ADDRESS = "0x922D6956C99E12DFeB3224DEA977D0939758A1Fe";

USDT_USDC_500 = "0x58dF8cFCE20F849AB3aC6Eb9a67f670E90752c55";

const artifacts = {
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
  Usdt: require("../artifacts/contracts/Tether.sol/Tether.json"),
  Usdc: require("../artifacts/contracts/UsdCoin.sol/UsdCoin.json"),
  UniswapV3Pool: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json"),
};

const { Contract } = require("ethers");
const { Token } = require("@uniswap/sdk-core");
const { Pool, Position, nearestUsableTick } = require("@uniswap/v3-sdk");

async function getPoolData(poolContract) {
  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  return {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
  };
}

async function main() {
  const [owner, signer2] = await ethers.getSigners();
  const provider = waffle.provider;

  const usdtContract = new Contract(
    TETHER_ADDRESS,
    artifacts.Usdt.abi,
    provider
  );
  const usdcContract = new Contract(USDC_ADDRESS, artifacts.Usdc.abi, provider);

  await usdtContract
    .connect(signer2)
    .approve(POSITION_MANAGER_ADDRESS, ethers.utils.parseEther("1000"));
  await usdcContract
    .connect(signer2)
    .approve(POSITION_MANAGER_ADDRESS, ethers.utils.parseEther("1000"));

  const poolContract = new Contract(
    USDT_USDC_500,
    artifacts.UniswapV3Pool.abi,
    provider
  );

  const poolData = await getPoolData(poolContract);

  const UsdtToken = new Token(31337, TETHER_ADDRESS, 18, "USDT", "Tether");
  const UsdcToken = new Token(31337, USDC_ADDRESS, 18, "USDC", "UsdCoin");

  const pool = new Pool(
    UsdtToken,
    UsdcToken,
    poolData.fee,
    poolData.sqrtPriceX96.toString(),
    poolData.liquidity.toString(),
    poolData.tick
  );

  const position = new Position({
    pool: pool,
    liquidity: ethers.utils.parseEther("1"),
    tickLower:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) -
      poolData.tickSpacing * 2,
    tickUpper:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) +
      poolData.tickSpacing * 2,
  });

  const { amount0: amount0Desired, amount1: amount1Desired } =
    position.mintAmounts;

  const [token0, token1] =
    TETHER_ADDRESS.toLowerCase() < USDC_ADDRESS.toLowerCase()
      ? [TETHER_ADDRESS, USDC_ADDRESS]
      : [USDC_ADDRESS, TETHER_ADDRESS];

  params = {
    token0,
    token1,
    fee: poolData.fee,
    tickLower:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) -
      poolData.tickSpacing * 2,
    tickUpper:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) +
      poolData.tickSpacing * 2,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: 0,
    amount1Min: 0,
    recipient: signer2.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10,
  };

  const nonfungiblePositionManager = new Contract(
    POSITION_MANAGER_ADDRESS,
    artifacts.NonfungiblePositionManager.abi,
    provider
  );

  const tx = await nonfungiblePositionManager
    .connect(signer2)
    .mint(params, { gasLimit: "1000000" });
  const receipt = await tx.wait();
}

/*
npx hardhat run --network localhost scripts/04_addLiquidity.js
*/

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
