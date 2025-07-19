const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { MIN_DELAY } = require("../../configs/contracts/timelockParams");

module.exports = buildModule("TimeLock", (m) => {
    const deployer = m.getParameter("deployerAddress");

    const timelock = m.contract("TimeLock", [MIN_DELAY, [], [], deployer]);
    return { timelock };
});
