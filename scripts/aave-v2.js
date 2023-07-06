/**
 * Fork mainnet and run following steps:
 * 
 * 1. Deposit collateral
 * 2. Borrow
 * 3. Repay
 */

const { ethers, getNamedAccounts, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat-config");
const { getWeth, AMOUNT } = require("./weth.js");

/**
 * Get lending pool for signer
 */
async function getLendingPool(signer) {
  const lendingPoolAddressesProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    networkConfig[network.config.chainId].lendingPoolAddressesProvider, // use lending pool address based on network
    signer
  );
  const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool(); // get lending pool address fom provider
  const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, signer); // get contract object

  return lendingPool;
}

/**
 * Approve address to spend ERC20
 */
async function approveErc20(erc20Address, spenderAddress, amount, signer) {
  const erc20Token = await ethers.getContractAt("IERC20", erc20Address, signer);
  txResponse = await erc20Token.approve(spenderAddress, amount);
  await txResponse.wait(1);
  console.log(`Approved ${spenderAddress} to spend ${amount.toString()} of ${erc20Address}`);
}

/**
 * Get available borrow ETH, total debt ETH, and available collateral ETH
 */
async function getBorrowUserData(lendingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } = await lendingPool.getUserAccountData(account);
  console.log(`You have ${totalCollateralETH} worth of ETH deposited.`);
  console.log(`You have ${totalDebtETH} worth of ETH borrowed.`);
  console.log(`You can borrow ${availableBorrowsETH} worth of ETH.`);
  return { availableBorrowsETH, totalDebtETH, totalCollateralETH }
}

/**
 * Get current DAI price against ETH
 */
async function getDaiPrice() {
  const daiEthPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    networkConfig[network.config.chainId].daiEthPriceFeed
  );
  const price = (await daiEthPriceFeed.latestRoundData())[1];

  console.log(`The DAI/ETH price is ${price.toString()}`);
  return price;
}

/**
 * Borrow DAI from lending pool
 */
async function borrowDai(daiAddress, lendingPool, amountDaiToBorrow, account) {
  const borrowTx = await lendingPool.borrow(daiAddress, amountDaiToBorrow, 1, 0, account);
  await borrowTx.wait(1);
  console.log("DAI borrowed!");
}

/**
 * Repay DAI to lending pool
 */
async function repay(amount, daiAddress, lendingPool, account, signer) {
  await approveErc20(daiAddress, lendingPool.address, amount, signer);
  const repayTx = await lendingPool.repay(daiAddress, amount, 1, account);
  await repayTx.wait(1);
  console.log("Repaid!");
}

async function main() {
  // convert ETH to WETH
  await getWeth();

  // get named accounts
  const { deployer } = await getNamedAccounts();

  // get signer
  const signer = await ethers.getSigner(deployer);

  // get lending pool
  const lendingPool = await getLendingPool(signer);

  // get WETH token address
  const wethTokenAddress = networkConfig[network.config.chainId].wethToken;

  // approve lending pool to spend WETH
  await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, signer);

  console.log("Depositing WETH...");

  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0);

  console.log("Desposited!");

  let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer);

  // get DAI price
  const daiPrice = await getDaiPrice();

  // calculate amount of DAI to borrow
  const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber());

  // convert DAI amount to wei
  const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString());
  console.log(`You can borrow ${amountDaiToBorrow.toString()} DAI`);

  // borrow DAI
  await borrowDai(
    networkConfig[network.config.chainId].daiToken,
    lendingPool,
    amountDaiToBorrowWei,
    deployer
  );

  // get updated borrow data
  await getBorrowUserData(lendingPool, deployer)

  // repay DAI
  await repay(
    amountDaiToBorrowWei,
    networkConfig[network.config.chainId].daiToken,
    lendingPool,
    deployer,
    signer
  );

  // get updated borrow data
  await getBorrowUserData(lendingPool, deployer);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });