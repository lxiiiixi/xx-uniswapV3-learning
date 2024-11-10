const { ContractFactory, utils } = require("ethers");
const WETH9 = require("../helpers/WETH9.json");

const artifacts = {
  UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  SwapRouter: require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
  NFTDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
  NonfungibleTokenPositionDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
  WETH9,
};

const linkLibraries = ({ bytecode, linkReferences }, libraries) => {
  Object.keys(linkReferences).forEach((fileName) => {
    Object.keys(linkReferences[fileName]).forEach((contractName) => {
      if (!libraries.hasOwnProperty(contractName)) {
        throw new Error(`Missing link library name ${contractName}`);
      }
      const address = utils
        .getAddress(libraries[contractName])
        .toLowerCase()
        .slice(2);
      linkReferences[fileName][contractName].forEach(({ start, length }) => {
        const start2 = 2 + start * 2;
        const length2 = length * 2;
        bytecode = bytecode
          .slice(0, start2)
          .concat(address)
          .concat(bytecode.slice(start2 + length2, bytecode.length));
      });
    });
  });
  return bytecode;
};

async function main() {
  const [owner] = await ethers.getSigners();

  Weth = new ContractFactory(
    artifacts.WETH9.abi,
    artifacts.WETH9.bytecode,
    owner
  );
  weth = await Weth.deploy();

  Factory = new ContractFactory(
    artifacts.UniswapV3Factory.abi,
    artifacts.UniswapV3Factory.bytecode,
    owner
  );
  factory = await Factory.deploy();

  SwapRouter = new ContractFactory(
    artifacts.SwapRouter.abi,
    artifacts.SwapRouter.bytecode,
    owner
  );
  swapRouter = await SwapRouter.deploy(factory.address, weth.address);

  NFTDescriptor = new ContractFactory(
    artifacts.NFTDescriptor.abi,
    artifacts.NFTDescriptor.bytecode,
    owner
  );
  nftDescriptor = await NFTDescriptor.deploy();

  const linkedBytecode = linkLibraries(
    {
      bytecode: artifacts.NonfungibleTokenPositionDescriptor.bytecode,
      // 这里的 linkReferences 对应hardhat编译合约后的自动生成输出得到的值
      linkReferences: {
        "NFTDescriptor.sol": {
          NFTDescriptor: [
            {
              length: 20,
              start: 1681, // 分别表示库合约地址占位符在字节码中的具体位置和长度
            },
          ],
        },
      },
    },
    {
      NFTDescriptor: nftDescriptor.address,
    }
  );

  // 因为这里是使用预编译的ABI和字节码部署合约而不通过hardhat
  NonfungibleTokenPositionDescriptor = new ContractFactory(
    artifacts.NonfungibleTokenPositionDescriptor.abi,
    linkedBytecode,
    owner
  );
  nonfungibleTokenPositionDescriptor =
    await NonfungibleTokenPositionDescriptor.deploy(
      weth.address,
      ethers.utils.formatBytes32String("ETH")
    );

  NonfungiblePositionManager = new ContractFactory(
    artifacts.NonfungiblePositionManager.abi,
    artifacts.NonfungiblePositionManager.bytecode,
    owner
  );
  nonfungiblePositionManager = await NonfungiblePositionManager.deploy(
    factory.address,
    weth.address,
    nonfungibleTokenPositionDescriptor.address
  );

  console.log("WETH_ADDRESS=", `'${weth.address}'`);
  console.log("FACTORY_ADDRESS=", `'${factory.address}'`);
  console.log("SWAP_ROUTER_ADDRESS=", `'${swapRouter.address}'`);
  console.log("NFT_DESCRIPTOR_ADDRESS=", `'${nftDescriptor.address}'`);
  console.log(
    "POSITION_DESCRIPTOR_ADDRESS=",
    `'${nonfungibleTokenPositionDescriptor.address}'`
  );
  console.log(
    "POSITION_MANAGER_ADDRESS=",
    `'${nonfungiblePositionManager.address}'`
  );
}

/*
npx hardhat run --network localhost scripts/01_deployContracts.js
*/

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
