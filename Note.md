# HH DAO

## What is DAO

- Notation
    - Decentralized Autonomous Organization
    - Somewhat overloaded statement:
        - Any group that is governed by a transparent set of rules fount on chain or smart contract
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
                      community, you
                      won't
                      get away with it
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
