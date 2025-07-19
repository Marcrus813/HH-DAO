const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("SmallCouncil", (m) => {
    const deployer = m.getParameter("deployerAddress");

    const smallCouncil = m.contract("SmallCouncil", [deployer]);

    return { smallCouncil };
});
