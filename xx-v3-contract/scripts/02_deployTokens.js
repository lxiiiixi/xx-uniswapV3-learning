async function main() {
  const [owner] = await ethers.getSigners();

  Tether = await ethers.getContractFactory("Tether", owner);
  tether = await Tether.deploy();

  Usdc = await ethers.getContractFactory("UsdCoin", owner);
  usdc = await Usdc.deploy();

  // WrappedBitcoin = await ethers.getContractFactory("WrappedBitcoin", owner);
  // wrappedBitcoin = await WrappedBitcoin.deploy();

  await tether.connect(owner).mint(owner.address, ethers.parseEther("100000"));
  await usdc.connect(owner).mint(owner.address, ethers.parseEther("100000"));
  // await wrappedBitcoin
  //   .connect(owner)
  //   .mint(owner.address, ethers.parseEther("1000"));

  console.log("TETHER_ADDRESS=", `'${tether.target}'`);
  console.log("USDC_ADDRESS=", `'${usdc.target}'`);
  // console.log("WRAPPED_BITCOIN_ADDRESS=", `'${wrappedBitcoin.target}'`);
}

/*
  npx hardhat run --network localhost scripts/02_deployTokens.js
  */

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
