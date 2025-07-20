# HH DAO

## What is DAO

- Notation
    - Decentralized Autonomous Organization
    - Somewhat overloaded statement:
        - Any group that is governed by a transparent set of rules found on chain or smart contract
- Governance
    - Give the community power to govern through mechanisms like voting
        - Life cycle of a proposal:
            1. Created
            2. Active
                - People vote
            3. Queued / Failed
            4. Executed (If went through)

## Mechanisms

- Voting Mechanism
    - How to participate
        - The "correct" way varies through different groups
            - Easy way:
                - ERC20 / 721 as voting power
                - Problem
                    - Tokenized voting power creates inequality in power distribution: deepest pocket -> most voting
                      power
            - Skin in the game
                - Voting is recorded -> Decision made led to bad outcomes -> Get punished
                    - Say "bought" a great deal of voting power, voted to your own benefit at the peril of the
                      community, you won't get away with it
                - Problem
                    - As a community, how to determine a "bad outcome"
            - Proof of Personhood of Participation(hardest to implement)
                - In the decision-making community, one (provable)**PERSON** is given one vote, so no matter how many
                  tokens one entity can buy, how many wallet it owns, it's down to person
                - Problem
                    - Sybil resistance
                        - A malicious entity can still impersonate PEOPLE to gain control
    - Not so different from existing mechanisms in real world
        - E.G:
            - Proof of person: voting for a president
            - Tokenized: Large shareholders gets the most decision-making power
    - Tech-wise implementation
        - On-chain voting VS Off-chain voting
            - On-chain
                - Make txn to on-chain smart contract
                - Pros
                    - Straight forward logic, on-chain -> transparent and immutable
                - Problem
                    - Decisions can get literally costly
                - Governance C
            - Off-chain
                - Votes get stored in Decentralized storage like IPFS, when the voting window closes, count the vote,
                  send the result on-chain, mainly to save gas
                    - Alternatively, replay these side txns in a single txn

## Project structure

- "Box" contract
    - A simple contract that has simple functions
    - Ownable -> Owned by DAO
    - Functions are only executable by DAO
- DAO
    - Voting, querying, executing

### Implementation

- Voting
    - ERC20 Mechanism
    - Create a base ERC20 token and then make it governance-compatible
    - Fair?
        - Scenario:
            - A profitable proposal coming up, some entity buys a lot of token(votes), and dumps the votes afterwords, (
              causing value drop?)
                - How to solve?
                    - Snapshot of block num of the tokens -> Use `ERC20Votes`
                    - Checkpoints
- `GovernanceContract`
    - Contains the governance functions like voting
- `TimeLock`
    - The owner of the box contract
        - Need to wait after proposal went through
            - Give time for user to get out if they wish to exit the governance after a proposal
    - [OpenZeppelin Wizard](https://docs.openzeppelin.com/contracts/5.x/wizard)
        - Creates basic boilerplate
            - The actual time logic will be in terms of block, but when creating here, for simplicity, it's using real
              world time period(parameterized in this project for flexibility)
            - Notations
                - `Proposal threshold`
                    - Min votes the proposer needs to hold to create a proposal
                - `Quorum`
                    - Determine whether a proposal passes, can be in percentage or num
        - Generated code explained
            - Need to go through the code for this part
- General flow
    - Token holders create proposals(Governor contract checks if the user is able to based on configurations)
        - Governor takes `targets`(target governed contracts), `values`(values to send to the targets), `calldatas`(
          encoded calldatas to send to the targets), `description`(description for the proposals)
    - Governor takes the proposal and take the proposal to `TimeLock` and enters vote pending state
    - `TimeLock` pends the proposal based on config, then execute to bring the proposal into voting state
    - User vote on the proposal
    - Governor talis the votes and determines if the proposal passes based on quorum and majority
    - Governor tells TimeLock to enter queued state(can be invoked by any valid user)
    - `TimeLock` Pends queued state
    - Governor `execute()`(can be invoked by any valid user)
- Deployment flow
    - Flow
        - Token(as long as before Governor)
        - TimeLock(On deployment, temp admin is the deployer)
            - Deploying `TimeLock` with the `proposers` and `executors` blank
        - Governor
        - **Set up governor related contracts**
            - _Governor_ should be the only proposer of `Timelock`
                - Governor proposes into the Timelock -> Timelock waits -> Anyone can execute the passed proposal
            - Adjusting states
                - Proposer role
                    - Is in charge of queueing operation, should be granted to Governor, and should only contain
                      the governor in most cases
                - Executor role
                    - Allow everyone
                - Admin role
                    - Should be the Timelock itself and **OPTIONALLY** a second account for ease of setup,
                      but should **RENOUNCE** after
            - Call `grantRole` on `TimeLock`, it is originated from `AccessControl`, it only accepts admin role to call
              it, etc., the deployer

        - Governed contract
            - Deploy with initial owner of deployer
            - Transfer ownership to `Timelock`

- Deployment implementation
    - I would need to get the deployer to pass-in as parameter, I am thinking that I need `ethers.getSigners()` -> I
      need `await` -> I need to do it with `deploy.js`
        - To do this, I can write separate ignition modules for all, and implement parameterized `TimeLock`, and
          then finally group them all together
        - Or I put everything in one ignition module and parameterize and deploy in `deploy.js`
    - Verdict
        - Use separate modules to isolate possible problems, and for adjusting roles with timelock, I am already using
          `deploy.js` so might as well do it there instead of `m.call` in ignition module

- [ ] OpenZeppelin standard explained

## Problems

- [x] OpenZeppelin has updated, follow
      new [docs](https://docs.openzeppelin.com/contracts/5.x/governance#erc20votes_erc20votescomp)
- [x] Deploying Governor, contract not accepting timelock
    - The first thing I did wrong was that I accidentally used `const {timelockAddress}` instead of
      `const timelockAddress`, when ignition tries to handle this, instead of passing an object that tells ignition to
      wait for `timelockAddress`, I passed in `timelockAddress` property of this expected object, hence I got the error
    - The second thing I noticed is that, here I cannot use objects of contracts like before:

        ```js
        const base = m.contract();

        const newer = m.contract("name", [base]);
        ```

        Instead, I have to pass in the address of `timelock`, the key thing that I overlooked before is that I wasn't
        passing the actual contract object, I am passing its `Future` object, I know the term but didn't get deeper into
        this until now, I assumed that ignition is smart enough to handle any contract objects, I did not clearly
        understand the
        distinction between `Future` and an actual deployed contract object: if
        passing `Future`, ignition will handle the "conversion" onwards, but since I am passing an already deployed
        contract "script" instance, ignition won't know what to do

- [x] `loadFixture` in a more complex project like this one
    - Can still use `deploy.js`'s `Aggregated`, just in `deploy.js` remember to add, or you will run into a nonce
      conflict
        ```js
        if (require.main === module) {
            main()
                .then(() => process.exit(0))
                .catch((error) => {
                    console.error(error);
                    process.exit(1);
                });
        }
        ```
        so that it `main` does not run when using `AggregatedDeploy` from other places, used to be familiar with this
        usage back with hardhat deploy, but it became rare after transition to ignition, now's my reminder
- [x] Vote interpretation
    - There are three in most cases: Against, for, and Abstain(`VOTE_TYPE_FRACTIONAL` from `GovernorCountingFractional`
      in addition to `GovernorCountingSimple`), and from `GovernorCountingSimple`:
        ```solidity
        enum VoteType {
            Against,
            For,
            Abstain
        }
        ```
        hence `uint` values are: against: 0, for: 1, abstain: 2
- [x] Event argument access: `args.values` vs `args[3]`
    - `args.values[0]` returns undefined, but `args[3][0]` works fine for the same event parameter
        - `values` is a reserved method on JavaScript arrays (`Array.prototype.values`). When ethers.js adds named
          properties to event args array, it doesn't override existing methods
        - Solution
            - Use positional indexing `args[3]` instead of named access `args.values` for the "values" parameter in
              events
- [x] Vote token initializing
    - Should be initialized like any other ERC20 token
- [x] Quorum calculation
    - Traditionally based on participated votes against TOTAL SUPPLY, `Fraction` version of OpenZeppelin has different
      optional strategy
    - One "vote" might be confusing, it does not mean that one token is cast as vote, it means the voter casts all its
      voting power to this vote: having 1 token as vote -> 1 vote, having 10 token as vote -> 10 votes in this one
      action

## Wrap note

- Working on this project I felt the need to do a little summary on what's kept me confused, cuz it includes not only
  the technical details but
  also the general design, the flow, the lifecycles

### Design

- The full lifecycle of a proposal from creation to execution
    - Components involved
    - Actors involved
    - Ownership and permission between the component contracts
    - And how does the above affect implementation and deployment
- The importance of delaying
    - For the community to review the proposal, to vote, to react to its result
- The snapshot design
    - Token & Voting power(delegate)

### Technical

- Some configurations are needed to be done by deployer as a temporary admin, after wards, it should be transferred /
  renounced
    - OpenZeppelin suggested that(comment in its src), it could be done with submitting proposal to renounce deployer's
      admin role, but I did it right after I am done, cuz I think this approach is temp by intention and should not be
      brought on-chain at all
