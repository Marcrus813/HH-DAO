const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("SmallCouncilToken", (m) => {
    const smallCouncilToken = m.contract("SmallCouncilToken", ["Small Council Token", "SCT"]);

    return { smallCouncilToken };
});
