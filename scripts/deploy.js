const { ignition, ethers } = require("hardhat");

const timelockModule = require("../ignition/modules/01-TimeLock");
const smallCouncilGovernorModule = require("../ignition/modules/02-SmallCouncilGovernor");
const smallCouncilModule = require("../ignition/modules/03-SmallCouncil");
const { ZeroAddress } = require("ethers");

async function getDeployerAddress() {
    console.log("Getting Deployer");
    const [deployerInstance] = await ethers.getSigners();
    const deployerAddress = deployerInstance.address;

    return { deployerAddress };
}

async function deployTimelock() {
    console.log("Deploying `TimeLock.sol`");
    const { deployerAddress } = await getDeployerAddress();
    const { timelock } = await ignition.deploy(timelockModule, {
        parameters: {
            TimeLock: { deployerAddress }
        }
    });

    console.log(`\`TimeLock.sol\` deployed to **${timelock.target}**`);
    return { timelock };
}

async function deployGovernor() {
    console.log("Initiating deployment `SmallCouncilGovernor.sol`");

    console.log("Deploying dependencies of `SmallCouncilGovernor.sol`");
    const timelockDeployment = await deployTimelock();
    const timelock = timelockDeployment.timelock;
    const timelockAddress = await timelock.getAddress();

    console.log("Deploying `SmallCouncilGovernor.sol`");
    const { smallCouncilGovernor } = await ignition.deploy(smallCouncilGovernorModule, {
        parameters: {
            SmallCouncilGovernor: { timelockAddress }
        }
    });

    console.log(`\`SmallCouncilGovernor.sol\` deployed to **${smallCouncilGovernor.target}**`);
    return { timelock, smallCouncilGovernor };
}

async function deploySmallCouncil() {
    console.log("Deploying `SmallCouncil.sol`");
    const { deployerAddress } = await getDeployerAddress();

    const { smallCouncil } = await ignition.deploy(smallCouncilModule, {
        parameters: {
            SmallCouncil: { deployerAddress }
        }
    });

    console.log(`\`SmallCouncil.sol\` deployed to **${smallCouncil.target}**`);
    return { smallCouncil };
}

export const AggregatedDeployment = async () => {
    const [deployer] = await ethers.getSigners();
    const { timelock, smallCouncilToken, smallCouncilGovernor } = await deployGovernor();
    const smallCouncilGovernorAddress = await smallCouncilGovernor.getAddress();
    const timelockByDeployer = await timelock.connect(deployer);

    console.log("Granting Governor contract role: 'PROPOSER_ROLE'");
    const proposerRole = await timelockByDeployer.PROPOSER_ROLE();
    const grantGovernorProposerTxn = await timelockByDeployer.grantRole(
        proposerRole,
        smallCouncilGovernorAddress
    );
    const grantGovernorProposerTxnRecipt = await grantGovernorProposerTxn.wait(1);

    console.log("Granting address 0(etc., everyone) contract role: 'EXECUTOR_ROLE'");
    const executorRole = await timelockByDeployer.EXECUTOR_ROLE();
    /*
     * Zero address having `EXECUTOR_ROLE` -> Everyone has `EXECUTOR_ROLE`:
     * ```solidity
     * modifier onlyRoleOrOpenRole(bytes32 role) {
     *    if (!hasRole(role, address(0))) {
     *        _checkRole(role, _msgSender());
     *    }
     *    _;
     * }
     * ```
     * */
    const grantAllExecutorTxn = await timelockByDeployer.grantRole(executorRole, ZeroAddress);
    const grantAllExecutorTxnRecipt = await grantAllExecutorTxn.wait(1);

    console.log(`Deployer --${deployer.address}-- renouncing admin role of \`TimeLock.sol\``);
    const adminRole = await timelockByDeployer.DEFAULT_ADMIN_ROLE();
    const renounceAdminTxn = await timelockByDeployer.renounceRole(adminRole, deployer.address);
    const renounceAdminTxnRecipt = await renounceAdminTxn.wait(1);

    const { smallCouncil } = await deploySmallCouncil();

    const smallCouncilByDeployer = await smallCouncil.connect(deployer);
    const timelockAddress = await timelock.getAddress();
    console.log(
        `Deployer --${deployer.address}-- transferring ownership to \`TimeLock.sol\` **${timelockAddress}**`
    );
    const transferOwnToTimelockTxn =
        await smallCouncilByDeployer.transferOwnership(timelockAddress);
    const transferOwnTxnRecipt = await transferOwnToTimelockTxn.wait(1);

    return { smallCouncilToken, timelock, smallCouncilGovernor, smallCouncil };
};

async function main() {
    await AggregatedDeployment();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
