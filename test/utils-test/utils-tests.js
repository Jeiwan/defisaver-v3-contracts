const { expect } = require('chai');
const hre = require('hardhat');

const {
    redeploy,
    balanceOf,
    WETH_ADDRESS,
    ETH_ADDR,
    depositToWeth,
    impersonateAccount,
    stopImpersonatingAccount,
    DAI_ADDR,
    MAX_UINT,
    send,
    nullAddress,
    sendEther,
    getAllowance,
    USDC_ADDR,
    ADMIN_ACC,
    getProxy,
    DFS_REG_CONTROLLER,
    getAddrFromRegistry,
    setBalance,
} = require('../utils');

const botRefillTest = async () => {
    describe('Bot-Refills', function () {
        this.timeout(80000);

        let botRefills;
        let refillCaller; let refillAddr; let feeAddr;

        before(async () => {
            const botRefillsAddr = await getAddrFromRegistry('BotRefills');
            botRefills = await hre.ethers.getContractAt('BotRefills', botRefillsAddr);

            refillAddr = '0x5aa40C7C8158D8E29CA480d7E05E5a32dD819332';
            feeAddr = '0x76720ac2574631530ec8163e4085d6f98513fb27';
            refillCaller = '0x33fDb79aFB4456B604f376A45A546e7ae700e880';

            // give approval to contract from feeAddr
            await impersonateAccount(feeAddr);

            let daiContract = await hre.ethers.getContractAt('IERC20', DAI_ADDR);
            let wethContract = await hre.ethers.getContractAt('IERC20', WETH_ADDRESS);

            const signer = await hre.ethers.provider.getSigner(feeAddr);
            wethContract = wethContract.connect(signer);
            daiContract = daiContract.connect(signer);

            await wethContract.approve(botRefills.address, MAX_UINT);
            await daiContract.approve(botRefills.address, MAX_UINT);

            // clean out all weth on fee addr for test to work
            const wethFeeAddrBalance = await balanceOf(WETH_ADDRESS, feeAddr);
            await wethContract.transfer(nullAddress, wethFeeAddrBalance);

            await stopImpersonatingAccount(feeAddr);
        });

        it('... should call refill with WETH', async () => {
            await impersonateAccount(refillCaller);

            const ethBotAddrBalanceBefore = await balanceOf(ETH_ADDR, refillAddr);

            const signer = await hre.ethers.provider.getSigner(refillCaller);
            botRefills = botRefills.connect(signer);

            const ethRefillAmount = hre.ethers.utils.parseUnits('4', 18);

            const wethFeeAddrBalance = await balanceOf(WETH_ADDRESS, feeAddr);

            if (wethFeeAddrBalance.lt(ethRefillAmount)) {
                await depositToWeth(ethRefillAmount);
                await send(WETH_ADDRESS, feeAddr, ethRefillAmount);
            }

            await botRefills.refill(ethRefillAmount, refillAddr);

            const ethBotAddrBalanceAfter = await balanceOf(ETH_ADDR, refillAddr);

            expect(ethBotAddrBalanceAfter).to.be.eq(ethBotAddrBalanceBefore.add(ethRefillAmount));

            await stopImpersonatingAccount(refillCaller);
        });

        it('... should call refill with DAI', async () => {
            await impersonateAccount(refillCaller);

            const ethBotAddrBalanceBefore = await balanceOf(ETH_ADDR, refillAddr);

            const signer = await hre.ethers.provider.getSigner(refillCaller);
            botRefills = botRefills.connect(signer);

            const ethRefillAmount = hre.ethers.utils.parseUnits('4', 18);
            const daiAmount = hre.ethers.utils.parseUnits('50000', 18);
            await setBalance(DAI_ADDR, feeAddr, daiAmount);
            await botRefills.refill(ethRefillAmount, refillAddr);

            const ethBotAddrBalanceAfter = await balanceOf(ETH_ADDR, refillAddr);

            console.log(ethBotAddrBalanceBefore.toString(), ethBotAddrBalanceAfter.toString());

            expect(ethBotAddrBalanceAfter).to.be.gt(ethBotAddrBalanceBefore);
            await stopImpersonatingAccount(refillCaller);
        });
    });
};
const feeReceiverTest = async () => {
    describe('Fee-Receiver', function () {
        this.timeout(80000);

        let feeReceiver;
        let senderAcc;

        const MULTISIG_ADDR = '0xA74e9791D7D66c6a14B2C571BdA0F2A1f6D64E06';

        before(async () => {
            /// @dev don't run dfs-registry-controller before this
            const feeReceiverAddr = await getAddrFromRegistry('FeeReceiver');
            feeReceiver = await hre.ethers.getContractAt('FeeReceiver', feeReceiverAddr);

            senderAcc = (await hre.ethers.getSigners())[0];

            await impersonateAccount(MULTISIG_ADDR);

            await sendEther(senderAcc, MULTISIG_ADDR, '0.5');

            const signer = await hre.ethers.provider.getSigner(MULTISIG_ADDR);
            feeReceiver = feeReceiver.connect(signer);
        });

        it('... should be able to withdraw 1 Weth', async () => {
            const wethAmount = hre.ethers.utils.parseUnits('3', 18);
            const oneWeth = hre.ethers.utils.parseUnits('1', 18);

            // deposit 3 weth to contract
            await depositToWeth(wethAmount);
            await send(WETH_ADDRESS, feeReceiver.address, wethAmount);

            const wethBalanceBefore = await balanceOf(WETH_ADDRESS, senderAcc.address);

            // withdraw 1 weth
            await feeReceiver.withdrawToken(WETH_ADDRESS, senderAcc.address, oneWeth);

            const wethBalanceAfter = await balanceOf(WETH_ADDRESS, senderAcc.address);

            // if we got that one weth to senderAcc
            expect(wethBalanceBefore.add(oneWeth)).to.be.eq(wethBalanceAfter);
        });

        it('... should be able to withdraw whole weth balance', async () => {
            const wethBalanceBefore = await balanceOf(WETH_ADDRESS, senderAcc.address);
            const contractWethBalance = await balanceOf(WETH_ADDRESS, feeReceiver.address);

            // withdraw whole weth balance
            await feeReceiver.withdrawToken(WETH_ADDRESS, senderAcc.address, 0);

            const wethBalanceAfter = await balanceOf(WETH_ADDRESS, senderAcc.address);

            // if we got that one weth to senderAcc
            expect(wethBalanceBefore.add(contractWethBalance)).to.be.eq(wethBalanceAfter);
        });

        it('... should be able to withdraw 1 Eth', async () => {
            const ethAmount = '3';
            const oneEth = hre.ethers.utils.parseUnits('1', 18);

            // deposit 3 eth to contract
            await sendEther(senderAcc, feeReceiver.address, ethAmount);

            const ethBalanceBefore = await balanceOf(ETH_ADDR, MULTISIG_ADDR);

            // withdraw 1 eth
            await feeReceiver.withdrawEth(MULTISIG_ADDR, oneEth);

            const ethBalanceAfter = await balanceOf(ETH_ADDR, MULTISIG_ADDR);

            // if we got that one eth to senderAcc
            expect(ethBalanceBefore.add(oneEth)).to.be.gt(ethBalanceAfter);
        });

        it('... should be able to withdraw whole Eth balance', async () => {
            const contractEthBalance = await balanceOf(ETH_ADDR, feeReceiver.address);
            const ethBalanceBefore = await balanceOf(ETH_ADDR, senderAcc.address);

            // withdraw whole eth balance
            await feeReceiver.withdrawEth(senderAcc.address, 0);

            const ethBalanceAfter = await balanceOf(ETH_ADDR, senderAcc.address);

            // if we got that one eth to senderAcc
            expect(ethBalanceBefore.add(contractEthBalance)).to.be.eq(ethBalanceAfter);
        });

        it('... should give approval from a contract to the address', async () => {
            const allowanceBefore = await getAllowance(
                USDC_ADDR,
                feeReceiver.address,
                senderAcc.address,
            );

            await feeReceiver.approveAddress(USDC_ADDR, senderAcc.address, MAX_UINT);

            const allowanceAfter = await getAllowance(
                USDC_ADDR,
                feeReceiver.address,
                senderAcc.address,
            );

            expect(allowanceBefore).to.be.eq(0);
            expect(allowanceAfter).to.be.eq(MAX_UINT);
        });

        it('... should remove approval from a contract to the address', async () => {
            const allowanceBefore = await getAllowance(
                USDC_ADDR,
                feeReceiver.address,
                senderAcc.address,
            );

            await feeReceiver.approveAddress(USDC_ADDR, senderAcc.address, 0);

            const allowanceAfter = await getAllowance(
                USDC_ADDR,
                feeReceiver.address,
                senderAcc.address,
            );

            expect(allowanceBefore).to.be.eq(MAX_UINT);
            expect(allowanceAfter).to.be.eq(0);
        });

        it('... should fail to withdraw Weth as the caller is not admin', async () => {
            try {
                feeReceiver = feeReceiver.connect(senderAcc);

                await feeReceiver.withdrawToken(WETH_ADDRESS, senderAcc.address, 0);
            } catch (err) {
                expect(err.toString()).to.have.string('Only Admin');
            }
        });

        it('... should fail to withdraw Eth as the caller is not admin', async () => {
            try {
                feeReceiver = feeReceiver.connect(senderAcc);

                await feeReceiver.withdrawEth(senderAcc.address, 0);

                await stopImpersonatingAccount(MULTISIG_ADDR);
            } catch (err) {
                expect(err.toString()).to.have.string('Only Admin');
            }
        });
    });
};
const dfsRegistryControllerTest = async () => {
    describe('DFS-Registry-Controller', function () {
        this.timeout(80000);

        let dfsRegController; let senderAcc;

        const ADMIN_VAULT = '0xCCf3d848e08b94478Ed8f46fFead3008faF581fD';

        before(async () => {
            dfsRegController = await hre.ethers.getContractAt('DFSProxyRegistryController', DFS_REG_CONTROLLER);

            await impersonateAccount(ADMIN_ACC);

            const signer = await hre.ethers.provider.getSigner(ADMIN_ACC);

            const adminVaultInstance = await hre.ethers.getContractFactory('AdminVault', signer);
            const adminVault = await adminVaultInstance.attach(ADMIN_VAULT);

            adminVault.connect(signer);

            console.log('dfsRegController: ', dfsRegController.address);

            // change owner in registry to dfsRegController
            await adminVault.changeOwner(dfsRegController.address);

            await stopImpersonatingAccount(ADMIN_ACC);

            senderAcc = (await hre.ethers.getSigners())[0];
            await getProxy(senderAcc.address);
        });

        it('... should create an additional proxy for the user', async () => {
            const proxiesBefore = await dfsRegController.getProxies(senderAcc.address);

            let recipe = await dfsRegController.addNewProxy({ gasLimit: 900_000 });

            recipe = await recipe.wait();

            console.log('Gas used: ', recipe.gasUsed.toString());

            const proxiesAfter = await dfsRegController.getProxies(senderAcc.address);

            // check new proxy if owner is user
            const latestProxy = proxiesAfter[proxiesAfter.length - 1];
            const dsProxy = await hre.ethers.getContractAt('IDSProxy', latestProxy);

            const owner = await dsProxy.owner();

            expect(owner).to.be.eq(senderAcc.address);
            expect(proxiesBefore.length + 1).to.be.eq(proxiesAfter.length);
        });

        it('... add to proxy pool and use that to assign new proxy', async () => {
            const proxiesBefore = await dfsRegController.getProxies(senderAcc.address);

            await dfsRegController.addToPool(1, { gasLimit: 5_000_000 });

            let recipe = await dfsRegController.addNewProxy({ gasLimit: 900_000 });
            let recipe2 = await dfsRegController.addNewProxy({ gasLimit: 900_000 });

            recipe = await recipe.wait();
            recipe2 = await recipe2.wait();

            console.log('Gas used with proxy pool: ', recipe.gasUsed.toString());
            console.log('Gas used with proxy pool: ', recipe2.gasUsed.toString());

            const proxiesAfter = await dfsRegController.getProxies(senderAcc.address);

            const latestProxy = proxiesAfter[proxiesAfter.length - 1];
            const dsProxy = await hre.ethers.getContractAt('IDSProxy', latestProxy);

            const owner = await dsProxy.owner();

            expect(owner).to.be.eq(senderAcc.address);
            expect(proxiesBefore.length + 2).to.be.eq(proxiesAfter.length);
        });
    });
};
const deployUtilsTestsContracts = async () => {
    await redeploy('BotRefills');
    await redeploy('FeeReceiver');
};
const utilsTestsFullTest = async () => {
    await deployUtilsTestsContracts();
    await botRefillTest();
    await feeReceiverTest();
};
module.exports = {
    utilsTestsFullTest,
    botRefillTest,
    feeReceiverTest,
    dfsRegistryControllerTest,
};
