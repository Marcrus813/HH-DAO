// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract SmallCouncil is Ownable {
    bool private verdict;

    event VerdictStored(bool indexed oldVerdict, bool indexed newVerdict);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function store(bool newVerdict) public onlyOwner {
        bool oldVerdict = verdict;
        verdict = newVerdict;

        emit VerdictStored(oldVerdict, newVerdict);
    }

    function retrieve() public view returns (bool result) {
        result = verdict;
    }
}
