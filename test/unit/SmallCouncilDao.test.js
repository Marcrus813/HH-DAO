const { ethers, ignition } = require("hardhat");
const { expect } = require("chai");

const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { AggregatedDeployment } = require("../../scripts/deploy");

const {
    VOTING_PERIOD,
    VOTING_DELAY,
    QUROUM_PERCENTAGE
} = require("../../configs/contracts/governorParams");
const { MIN_DELAY } = require("../../configs/contracts/timelockParams");

describe("SmallCouncilDAO", () => {
    let smallCouncilToken;
    let smallCouncilTokenAddress;
    let timelock;
    let timelockAddress;
    let smallCouncilGovernor;
    let smallCouncilGovernorAddress;
    let smallCouncil;
    let smallCouncilAddress;

    async function deployFixture() {
        const { smallCouncilToken, timelock, smallCouncilGovernor, smallCouncil } =
            await AggregatedDeployment();
        return { smallCouncilToken, timelock, smallCouncilGovernor, smallCouncil };
    }

    beforeEach(async () => {
        const deployments = await loadFixture(deployFixture);

        smallCouncilToken = deployments.smallCouncilToken;
        smallCouncilTokenAddress = await smallCouncilToken.getAddress();

        timelock = deployments.timelock;
        timelockAddress = await timelock.getAddress();

        smallCouncilGovernor = deployments.smallCouncilGovernor;
        smallCouncilGovernorAddress = await smallCouncilGovernor.getAddress();

        smallCouncil = deployments.smallCouncil;
        smallCouncilAddress = await smallCouncil.getAddress();
    });
});
