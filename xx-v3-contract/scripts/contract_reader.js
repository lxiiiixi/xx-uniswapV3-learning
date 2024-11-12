const { Contract } = require("ethers");

const artifacts = {
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
  Usdt: require("../artifacts/contracts/Tether.sol/Tether.json"),
  Usdc: require("../artifacts/contracts/UsdCoin.sol/UsdCoin.json"),
  UniswapV3Pool: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json"),
};

async function main() {
  const [owner] = await ethers.getSigners();
  const pool = new Contract(
    "0x61a8683F032D6a322F253FA83b294339A9F658c2",
    artifacts.UniswapV3Pool.abi,
    owner
  );
  const slot0 = await pool.slot0();
  console.log("🚀 ~ main ~ slot0:", slot0);
  const liquidity = await pool.liquidity();
  console.log("🚀 ~ main ~ liquidity:", liquidity);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
