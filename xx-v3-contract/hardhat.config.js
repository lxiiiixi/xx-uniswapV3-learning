require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 5000,
        details: { yul: false },
      },
    },
  },
  networks: {
    "etheruem-sepolia": {
      url: `https://sepolia.infura.io/v3/${process.env.AIP_KEY}`,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
  },
};
