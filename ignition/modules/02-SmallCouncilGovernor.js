const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const {
    VOTING_DELAY,
    VOTING_PERIOD,
    QUROUM_PERCENTAGE
} = require("../../configs/contracts/governorParams");
const smallCouncilTokenModule = require("./00-SmallCouncilToken");

module.exports = buildModule("SmallCouncilGovernor", (m) => {
    const { smallCouncilToken } = m.useModule(smallCouncilTokenModule);
    const timelockAddress = m.getParameter("timelockAddress");

    const smallCouncilGovernor = m.contract("SmallCouncilGovernor", [
        smallCouncilToken,
        timelockAddress,
        VOTING_DELAY,
        VOTING_PERIOD,
        QUROUM_PERCENTAGE
    ]);

    return { smallCouncilToken, smallCouncilGovernor };
});
