const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY } = require("../../configs/contracts/tokenParams");

module.exports = buildModule("SmallCouncilToken", (m) => {
    const smallCouncilToken = m.contract("SmallCouncilToken", [
        TOKEN_NAME,
        TOKEN_SYMBOL,
        INITIAL_SUPPLY
    ]);

    return { smallCouncilToken };
});
