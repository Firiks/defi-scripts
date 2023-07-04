/**
 * Swap ETH for WETH
 */

const { ethers, getNamedAccounts, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat-config");

// amount of ETH to swap
const AMOUNT = ethers.utils.parseEther("0.1");

async function getWeth() {
  // get signer
  const { deployer } = await getNamedAccounts();
  const signer = await ethers.getSigner(deployer); // must use signer: https://github.com/smartcontractkit/full-blockchain-solidity-course-js/issues/1200

  // get WETH contract
  const iWeth = await ethers.getContractAt(
    "IWeth",
    networkConfig[network.config.chainId].wethToken,
    signer
  );

  // deposit ETH to WETH
  const txResponse = await iWeth.deposit({
    value: AMOUNT,
  });

  // wait for tx to be mined
  await txResponse.wait(1);

  // get WETH balance
  const wethBalance = await iWeth.balanceOf(deployer);

  console.log(`Got ${wethBalance.toString()} WETH`);
}

module.exports = { getWeth, AMOUNT }