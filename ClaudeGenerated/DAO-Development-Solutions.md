# DAO Development Solutions & Learning Notes

This document tracks problems encountered during DAO development, their solutions, key insights, and takeaways.

## Problem 1: DAO Deployment Order and TimeLock Admin Role Management

### Problem Description
Confusion about the proper deployment order for DAO contracts and how to handle TimeLock admin role transfer. Specifically:
- What order to deploy: Token, TimeLock, Governor, Governed contract?
- Should TimeLock be self-owned or Governor-owned?
- How to transfer admin role from deployer to Governor?

### Solution
**Correct Deployment Order:**
1. SmallCouncilToken (governance token)
2. TimeLock (with deployer as temporary admin)
3. SmallCouncilGovernor (with TimeLock address)
4. SmallCouncil (with TimeLock as owner)
5. Grant Governor roles to TimeLock and revoke deployer admin

**Role Management Process:**
1. Deploy TimeLock with deployer as temporary admin (not address(0))
2. After Governor deployment, grant `PROPOSER_ROLE` to Governor
3. Grant `EXECUTOR_ROLE` to Governor (or address(0) for public execution)
4. Deployer renounces admin role using `renounceRole(DEFAULT_ADMIN_ROLE, deployer)`

### Key Points
- TimeLockController checks if admin parameter is address(0) - if so, sets itself as admin
- In practice, use deployer as temporary admin for easier role management
- Governor becomes the only proposer after role transfer
- System becomes fully decentralized after deployer renounces admin role

### Main Takeaway
The deployment order follows dependency chain: Token → TimeLock → Governor → Governed, with role management happening post-deployment to ensure proper decentralization.

---

## Problem 2: Hardhat Ignition vs Traditional Deploy.js for Async Operations

### Problem Description
Need to use `await ethers.getSigners()[0]` to get deployer address for TimeLock deployment, but Hardhat Ignition modules don't support async operations directly. Two approaches considered:
1. Separate ignition modules with parameters populated in deploy.js
2. Single ignition module with sequential deployment using `after: []`

Also questioned whether role adjustments should be done in ignition modules with `m.call()` or in deploy.js as interactions.

### Solution
**Recommended Approach: Separate Ignition Modules (#1)**

**Structure:**
- `00-SmallCouncilToken.js` - standalone module
- `01-TimeLock.js` - parameterized with deployer address
- `02-SmallCouncilGovernor.js` - parameterized with token + timelock addresses  
- `03-SmallCouncil.js` - parameterized with timelock address

**deploy.js handles:**
- Getting deployer with `await ethers.getSigners()[0]`
- Sequential deployment with `ignition.deploy()` and parameters
- Role adjustments as post-deployment interactions

**Role Adjustments: Use deploy.js interactions, not `m.call()`**

### Key Points
- Separate modules provide better modularity and easier debugging
- Parameters allow modules to remain reusable across different deployments
- Role adjustments in deploy.js give better error handling and clearer separation
- Ignition handles deployment, deploy.js handles configuration

### Main Takeaway
Hardhat Ignition excels at deployment orchestration, but complex async operations and post-deployment configuration are better handled in traditional deploy.js scripts. The hybrid approach leverages the strengths of both systems.

---

## Problem 3: Hardhat Ignition Module Dependencies with Async Parameters

### Problem Description
When using `m.useModule()` in Ignition modules, discovered that modules depending on async-generated parameters (like deployer address) create dependency chain issues. Specifically:
- TimeLock module needs deployer address (async from `ethers.getSigners()[0]`)
- Governor module uses `m.useModule(timelockModule)`
- This creates a chain where Governor depends on TimeLock which depends on async operation

### Solution
**Two approaches identified:**

**Option 1: Full Parameterization (Recommended)**
- Parameterize all contract addresses that have async dependencies
- Use `m.getParameter("contractAddress")` instead of `m.useModule()`
- Maintains full control over deployment flow in deploy.js

**Option 2: Mixed Approach**
- Keep `m.useModule()` for contracts with no async dependencies (like Token)
- Parameterize contracts that need async values (TimeLock, Governor)

### Key Points
- `m.useModule()` automatically deploys dependencies but loses parameter control
- Async dependencies break the automatic module deployment chain
- Parameterization gives explicit control over deployment order and values
- Token contract has no async dependencies, so can use either approach

### Main Takeaway
When deployment involves async operations (like getting signer addresses), prefer parameterization over `m.useModule()` to maintain explicit control over the deployment flow and parameter passing.

**Additional Insight:** When using `m.useModule()` in a module, you don't need to explicitly deploy that dependency in deploy.js - Ignition automatically deploys dependencies when the parent module is deployed.

---

## Problem 4: Proper Admin Role Renunciation in TimeLock

### Problem Description
OpenZeppelin TimelockController documentation states that the optional admin role should be "subsequently renounced in favor of administration through timelocked proposals." Question arose about whether to:
1. Grant admin role to TimeLock itself and revoke from deployer
2. Submit a governance proposal to renounce admin
3. Directly renounce the deployer's admin role

### Solution
**Direct renunciation is the correct approach:**
```javascript
// After initial role setup
await timelock.grantRole(PROPOSER_ROLE, governor.address);
await timelock.grantRole(EXECUTOR_ROLE, governor.address);

// Directly renounce admin - no proposal needed
await timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
```

**Why this approach:**
- Admin role is designed for bootstrap configuration without delay
- Making a proposal to renounce admin creates chicken-and-egg problem
- Deployer admin is temporary by design for initial setup only

### Key Points
- Admin role exists specifically for initial configuration without timelock delay
- After setup, admin should be renounced immediately, not transferred
- Don't set TimeLock as its own admin - this centralizes control
- Goal is complete decentralization where only governance can make future changes
- Future role changes must go through governance proposals with delay

### Main Takeaway
The TimeLock admin role is a bootstrap mechanism that should be directly renounced after initial configuration, not transferred or managed through governance. This achieves true decentralization where all future changes require community governance.

---

## Problem 5: deploy.js Script Review - Common Pitfalls

### Problem Description
Review of complete deploy.js implementation revealed a critical error in admin role renunciation method call.

### Solution
**Critical Fix Required:**
```javascript
// WRONG - renounceOwnership is for Ownable contracts
await timelockByDeployer.renounceOwnership(adminRole, deployer.address);

// CORRECT - renounceRole is for AccessControl
await timelockByDeployer.renounceRole(adminRole, deployer.address);
```

**Deployment Flow Validation:**
✅ Correct sequence: TimeLock → Governor (auto-deploys Token) → Role Config → SmallCouncil → Ownership Transfer

### Key Points
- TimeLock uses AccessControl pattern, not Ownable pattern
- `renounceRole()` is the correct method for AccessControl role management
- `renounceOwnership()` is for contracts inheriting from Ownable
- Easy to confuse when working with multiple contract patterns

### Main Takeaway
When working with OpenZeppelin contracts, be mindful of which pattern each contract uses:
- AccessControl: `grantRole()`, `revokeRole()`, `renounceRole()`
- Ownable: `transferOwnership()`, `renounceOwnership()`

TimeLockController uses AccessControl, not Ownable.

---

## Problem 6: Hardhat Ignition Contract Access Pattern

### Problem Description
Attempted to call `timelock.getAddress()` on the result of `ignition.deploy()` but getting undefined. The contract method isn't available directly on the deployment result.

### Solution
**Issue:** `ignition.deploy()` returns a deployment result object, not the contract instance directly.

**Wrong pattern:**
```javascript
const timelock = await ignition.deploy(timelockModule, {...});
const timelockAddress = await timelock.getAddress(); // ❌ undefined
```

**Correct patterns:**
```javascript
// Option 1: Destructure the contract
const { timelock } = await ignition.deploy(timelockModule, {...});
const timelockAddress = await timelock.getAddress(); // ✅ Works

// Option 2: Access from result object
const timelockResult = await ignition.deploy(timelockModule, {...});
const timelock = timelockResult.timelock;
const timelockAddress = await timelock.getAddress(); // ✅ Works
```

### Key Points
- `ignition.deploy()` returns an object where keys match the contract names from module's `return` statement
- Must destructure or access the specific contract from the result object
- The contract instance has all the ethers.js contract methods like `getAddress()`, `connect()`, etc.

### Main Takeaway
Always destructure contracts from Hardhat Ignition deployment results. The deployment result is a container object, not the contract itself.

---

## Problem 7: Ignition Futures vs Contract Instances - Parameter Passing

### Problem Description
Getting "Invalid address" error when passing contract objects from `ignition.deploy()` as parameters to ignition modules. However, `m.useModule()` contracts work fine as constructor arguments. Why does `smallCouncilToken` from `m.useModule()` work but `timelock` contract object doesn't?

### Solution
**Root cause:** Different object types and execution contexts.

**Ignition Futures vs Contract Instances:**
- `m.useModule()` returns **Ignition Future** - special object representing contract-to-be-deployed
- `ignition.deploy()` returns **ethers.js contract instance** - actual deployed contract

**Two execution contexts:**
- **Module context**: Ignition's internal dependency graph where Futures auto-resolve to addresses
- **Script context**: Regular JavaScript with actual contract instances

**Working patterns:**
```javascript
// ✅ Module context - Ignition Future auto-resolves
const { smallCouncilToken } = m.useModule(smallCouncilTokenModule);
m.contract("Governor", [smallCouncilToken]);

// ✅ Script context - extract address manually
const { timelock } = await ignition.deploy(...);
const timelockAddress = await timelock.getAddress();
// Pass address string as parameter
```

### Key Points
- Ignition modules operate in their own execution context with dependency resolution
- Contract objects from deploy.js are ethers.js instances, not Ignition Futures
- Ignition can't automatically convert ethers.js contracts to addresses in module parameters
- Address extraction must happen in script context before passing as parameters

### Main Takeaway
Understand the boundary between Ignition's module context (Futures) and script context (ethers.js contracts). Parameters crossing this boundary must be primitive values (addresses, numbers, strings), not complex objects.

---

## Problem 8: Console Output for Programmatic Ignition Deployment

### Problem Description
When using `ignition.deploy()` programmatically in deploy.js, missing the native console output that CLI `npx hardhat ignition deploy` provides. Expected to see deployment progress, batch execution logs, and deployment addresses automatically.

### Solution
**Key Finding:** `ignition.deploy()` does NOT show native Ignition console output when used programmatically.

**Why:**
- CLI deployment provides structured Hardhat Ignition progress logs
- Programmatic deployment runs silently by design for flexibility
- No built-in way to enable native Ignition progress logs in scripts
- Verbose flags only affect Hardhat internals, not Ignition deployment output

**Recommended Approach:** Implement custom logging that's actually better than native output:
- Step-by-step progress with visual indicators
- Transaction hashes for blockchain verification
- Contract relationships explanation
- Deployment summary with next steps
- Error handling with clear messages

### Key Points
- Programmatic deployment offers more control over logging than CLI
- Custom logging can be more informative than native output
- Include transaction hashes, addresses, and relationships
- Visual separators and emojis improve readability
- Consider hybrid approach: CLI for simple deployments, scripts for complex logic

### Main Takeaway
Programmatic deployment's silent nature is actually an opportunity to create better, more informative logging than the native CLI provides. Custom logging can explain the "why" behind each step, not just the "what."

---

## Problem 9: Testing Strategy for Tightly Coupled Contracts with Ignition

### Problem Description
With tightly coupled DAO contracts, traditional `loadFixture` + single module deployment isn't sufficient. Considering whether to export `AggregatedDeployment` from deploy.js and use it in `beforeEach` (hardhat-deploy style) or find a way to work with Ignition's fixture pattern.

### Solution
**Two viable approaches identified:**

**Option 1: Pure Ignition with Master Fixture (Recommended)**
```javascript
// Use existing AggregatedDeployment as a fixture
async function deployDAOFixture() {
  return await AggregatedDeployment();
}

// In tests
const contracts = await loadFixture(deployDAOFixture);
```

**Option 2: Export AggregatedDeployment Pattern**
```javascript
// deploy.js
module.exports = { AggregatedDeployment };

// test file
beforeEach(async function() {
  const contracts = await AggregatedDeployment();
});
```

### Key Points
- **Option 1 Benefits**: Snapshot optimization, Ignition ecosystem consistency, faster test runs
- **Option 2 Benefits**: Explicit control, familiar hardhat-deploy pattern
- Both approaches handle tightly coupled contracts effectively
- `loadFixture` provides automatic state snapshots and cleanup
- Aggregated deployment ensures proper role configuration and ownership setup

### Main Takeaway
For tightly coupled contracts, create a single "master" deployment function that handles all dependencies and configuration. Use this with `loadFixture` for optimal test performance, or export it for more explicit control. The key is having one place that sets up the complete, configured system.

---

## Problem 10: Testing Strategy for Projects Using Pre-tested Framework Code

### Problem Description
When using well-tested framework code like OpenZeppelin contracts, unclear whether to test framework internals or focus on custom integration. Question: Should framework code be tested line-by-line even though it's already tested by the framework authors?

### Solution
**Don't test framework internals** - focus on integration points and custom logic.

**What TO test:**
1. **Integration Points**: How your code interacts with framework contracts
2. **Configuration**: Your specific parameter combinations and settings
3. **Business Logic**: Custom functions and workflows you've implemented
4. **End-to-End Flows**: Complete user journeys through your system
5. **Edge Cases**: Boundary conditions in your specific setup

**What NOT to test:**
- Framework's internal implementations
- Standard compliance (ERC20, ERC721, etc.) - framework handles this
- Core functionality already covered by framework tests

**Example for DAO project:**
```javascript
// ❌ Don't test (OpenZeppelin's responsibility)
it("should implement ERC20Votes correctly");
it("should handle AccessControl roles properly");

// ✅ Test (your integration and configuration)
it("should allow token holders to vote on proposals");
it("should enforce 4% quorum requirement");
it("should prevent execution before 2-day timelock");
it("should transfer SmallCouncil ownership to TimeLock");
```

### Key Points
- Framework authors have comprehensive test suites
- Focus on the "glue" between components
- Test your specific parameter combinations
- Verify business logic and user workflows
- Check custom inheritance patterns and state changes

### Main Takeaway
Test the integration, configuration, and custom logic - not the framework internals. Your tests should verify that your specific setup works correctly and that components interact as expected, leveraging the framework's proven foundation.

---

*This document will be updated as new problems and solutions are encountered during DAO development.*