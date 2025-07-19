// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/governance/TimelockController.sol";

contract TimeLock is TimelockController {
    /**
     * Constructor
     * @param _minDelay How long to wait at least before executing
     * @param _proposers List of addresses that can propose
     * @param _executors List of addresses the can execute a passed proposal
     * @param admin Address of admin
     */
    constructor(
        uint256 _minDelay,
        address[] memory _proposers,
        address[] memory _executors,
        address admin
    ) TimelockController(_minDelay, _proposers, _executors, admin) {}
}
