const { ethers, network } = require("hardhat");
const { expect } = require("chai");

const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { AggregatedDeployment } = require("../../scripts/deploy");

const { TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY } = require("../../configs/contracts/tokenParams");
const {
    VOTING_PERIOD,
    VOTING_DELAY,
    QUORUM_PERCENTAGE
} = require("../../configs/contracts/governorParams");
const { MIN_DELAY } = require("../../configs/contracts/timelockParams");
const { ZeroAddress } = require("ethers");

describe("SmallCouncilDAO", () => {
    let signers;
    let deployer;

    let smallCouncilToken;
    let smallCouncilTokenAddress;
    let timelock;
    let timelockAddress;
    let smallCouncilGovernor;
    let smallCouncilGovernorAddress;
    let smallCouncil;
    let smallCouncilAddress;

    async function deployFixture() {
        const { smallCouncilToken, timelock, smallCouncilGovernor, smallCouncil } =
            await AggregatedDeployment();

        return { smallCouncilToken, timelock, smallCouncilGovernor, smallCouncil };
    }

    beforeEach(async () => {
        const deployments = await loadFixture(deployFixture);

        smallCouncilToken = deployments.smallCouncilToken;
        smallCouncilTokenAddress = await smallCouncilToken.getAddress();

        timelock = deployments.timelock;
        timelockAddress = await timelock.getAddress();

        smallCouncilGovernor = deployments.smallCouncilGovernor;
        smallCouncilGovernorAddress = await smallCouncilGovernor.getAddress();

        smallCouncil = deployments.smallCouncil;
        smallCouncilAddress = await smallCouncil.getAddress();
        signers = await ethers.getSigners();
        [deployer] = signers;
    });

    describe("Configuration", () => {
        describe("Vote token", () => {
            it("should have the correct `tokenName` and `tokenSymbol`", async () => {
                const expectedName = TOKEN_NAME;
                const expectedSymbol = TOKEN_SYMBOL;

                const gotName = await smallCouncilToken.name();
                const gotSymbol = await smallCouncilToken.symbol();

                expect(gotName).to.be.equals(expectedName);
                expect(gotSymbol).to.be.equals(expectedSymbol);
            });

            it("should have correct total supply", async () => {
                const totalSupply = await smallCouncilToken.totalSupply();

                expect(totalSupply).to.be.equals(INITIAL_SUPPLY);
            });

            it("should all be owned by deployer", async () => {
                const deployerBalance = await smallCouncilToken.balanceOf(deployer.address);

                expect(deployerBalance).to.be.equals(INITIAL_SUPPLY);
            });
        });

        describe("Timelock", () => {
            it("should have correct `minDelay`", async () => {
                const expectedMinDelay = MIN_DELAY;

                const gotMinDelay = await timelock.getMinDelay();
                expect(gotMinDelay).to.be.equals(expectedMinDelay);
            });
            it("should have correct `proposers`", async () => {
                const proposerRole = timelock.PROPOSER_ROLE();
                for (let i = 0; i < 50; i++) {
                    const randomWallet = ethers.Wallet.createRandom();
                    const proposerResult = await timelock.hasRole(
                        proposerRole,
                        randomWallet.address
                    );
                    expect(proposerResult).to.be.false;
                }
                const governorResult = await timelock.hasRole(
                    proposerRole,
                    smallCouncilGovernorAddress
                );
                expect(governorResult).to.be.true;
            });
            it("should have correct `executors`", async () => {
                const executorRole = await timelock.EXECUTOR_ROLE();

                const zeroAddressResult = await timelock.hasRole(executorRole, ZeroAddress);
                expect(zeroAddressResult).to.be.true;
            });
            it("should not have deployer as admin", async () => {
                const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

                const deployerAdminCheck = await timelock.hasRole(adminRole, deployer.address);
                expect(deployerAdminCheck).to.be.false;
            });
        });

        describe("Governor", () => {
            it("should have correct name", async () => {
                const expectedName = "SmallCouncilGovernor";

                const gotName = await smallCouncilGovernor.name();

                expect(gotName).to.be.equals(expectedName);
            });

            it("should have correct voting delay", async () => {
                const expectedVotingDelay = VOTING_DELAY;
                const gotVotingDelay = await smallCouncilGovernor.votingDelay();

                expect(gotVotingDelay).to.be.equals(expectedVotingDelay);
            });

            it("should have correct voting period", async () => {
                const expectedVotingPeriod = VOTING_PERIOD;
                const gotVotingPeriod = await smallCouncilGovernor.votingPeriod();

                expect(gotVotingPeriod).to.be.equals(expectedVotingPeriod);
            });

            it("should have correct quorum percentage", async () => {
                const expectedQuorumPercentage = QUORUM_PERCENTAGE;
                const gotQuorumPercentage = await smallCouncilGovernor.quorumNumerator();

                expect(gotQuorumPercentage).to.be.equals(expectedQuorumPercentage);
            });

            it("should have linked correct token", async () => {
                const expectedToken = smallCouncilTokenAddress;
                const gotToken = await smallCouncilGovernor.token();

                expect(gotToken).to.be.equals(expectedToken);
            });

            it("should have linked correct timelock", async () => {
                const expectedTimelock = timelockAddress;
                const gotTimelock = await smallCouncilGovernor.timelock();

                expect(gotTimelock).to.be.equals(expectedTimelock);
            });
        });

        describe("SmallCouncil", () => {
            it("should no longer have deployer as owner", async () => {
                const currentOwner = await smallCouncil.owner();

                expect(currentOwner).to.not.be.equals(deployer.address);
            });

            it("should have `timelock` as owner", async () => {
                const currentOwner = await smallCouncil.owner();

                expect(currentOwner).to.be.equals(timelockAddress);
            });
        });
    });

    describe("Functions", () => {
        let user0, user1, user2, user3, user4, user5, user6, user7, user8, user9;
        let voteAgainst;
        let voteFor;
        let voteAbstain;

        let user0TokenBalance,
            user1TokenBalance,
            user2TokenBalance,
            user3TokenBalance,
            user4TokenBalance,
            user5TokenBalance,
            user6TokenBalance,
            user7TokenBalance,
            user8TokenBalance,
            user9TokenBalance;

        const initializeTokenBalance = async (account, amount) => {
            const connectedContract = await smallCouncilToken.connect(deployer);
            const transferTxn = await connectedContract.transfer(account.address, amount);
            await transferTxn.wait(1);
        };

        const delegateVotes = async (from, to) => {
            const connectedContract = await smallCouncilToken.connect(from);
            const delegateTxn = await connectedContract.delegate(to.address);
            await delegateTxn.wait(1);
        };

        const proposeOnSmallCouncil = async (proposer, verdict) => {
            const connectedGovernor = await smallCouncilGovernor.connect(proposer);

            const targets = [smallCouncilAddress];
            const values = [0];
            const calldata = smallCouncil.interface.encodeFunctionData("store", [verdict]);
            const calldatas = [calldata];
            const description = `Change the verdict to "${verdict}"`;

            const proposeBlockNum = await ethers.provider.getBlockNumber();
            const proposeTxn = await connectedGovernor.propose(
                targets,
                values,
                calldatas,
                description
            );
            const proposeTxnReceipt = await proposeTxn.wait(1);
            return { proposeBlockNum, proposeTxnReceipt };
        };

        const voteWithReasonOnProposal = async (voter, proposalId, support, reason) => {
            const connectedGovernor = await smallCouncilGovernor.connect(voter);

            const voteBlockNum = await ethers.provider.getBlockNumber();
            const voteTxn = await connectedGovernor.castVoteWithReason(proposalId, support, reason);

            const voteTxnReceipt = await voteTxn.wait(1);

            return { voteBlockNum, voteTxnReceipt };
        };

        const fastForwardByBlock = async (blockNum) => {
            for (let i = 0; i < blockNum; i++) {
                await network.provider.send("evm_mine");
            }
        };

        const fastForwardByTime = async (time) => {
            await network.provider.send("evm_increaseTime", [time]);
            await network.provider.send("evm_mine");
        };

        beforeEach(async () => {
            [, user0, user1, user2, user3, user4, user5, user6, user7, user8, user9] = signers;

            user0TokenBalance = BigInt(5 * 10 ** 18);
            user1TokenBalance = BigInt(10 ** 18);
            user2TokenBalance = BigInt(5 * 10 ** 18);
            user3TokenBalance = BigInt(5 * 10 ** 18);
            user4TokenBalance = BigInt(5 * 10 ** 18);
            user5TokenBalance = BigInt(5 * 10 ** 18);
            user6TokenBalance = BigInt(5 * 10 ** 18);
            user7TokenBalance = BigInt(5 * 10 ** 18);
            user8TokenBalance = BigInt(5 * 10 ** 18);
            user9TokenBalance = BigInt(9 * 10 ** 18);

            voteAgainst = 0;
            voteFor = 1;
            voteAbstain = 2;

            await initializeTokenBalance(user0, user0TokenBalance);
            await initializeTokenBalance(user1, user1TokenBalance);
            await initializeTokenBalance(user2, user2TokenBalance);
            await initializeTokenBalance(user3, user3TokenBalance);
            await initializeTokenBalance(user4, user4TokenBalance);
            await initializeTokenBalance(user5, user5TokenBalance);
            await initializeTokenBalance(user6, user6TokenBalance);
            await initializeTokenBalance(user7, user7TokenBalance);
            await initializeTokenBalance(user8, user8TokenBalance);
            await initializeTokenBalance(user9, user9TokenBalance);

            await delegateVotes(user0, user0);
            await delegateVotes(user1, user1);
            await delegateVotes(user2, user2);
            await delegateVotes(user3, user3);
            await delegateVotes(user4, user4);
            await delegateVotes(user5, user5);
            await delegateVotes(user6, user6);
            await delegateVotes(user7, user7);
            await delegateVotes(user8, user8);
            await delegateVotes(user9, user9);
        });

        describe("Governing", () => {
            it("should prevent any action made by non-owner", async () => {
                const connectedContract = await smallCouncil.connect(deployer);

                await expect(connectedContract.store(true))
                    .to.be.revertedWithCustomError(smallCouncil, "OwnableUnauthorizedAccount")
                    .withArgs(deployer.address);
            });

            it("should allow user to create proposal", async () => {
                const verdict = true;

                const { proposeBlockNum } = await proposeOnSmallCouncil(user0, true);

                const calldata = smallCouncil.interface.encodeFunctionData("store", [verdict]);
                const description = `Change the verdict to "${verdict}"`;

                const filter = smallCouncilGovernor.filters.ProposalCreated();
                const events = await smallCouncilGovernor.queryFilter(filter, proposeBlockNum);

                const createdEvent = events[events.length - 1];
                const [
                    proposalId,
                    emittedProposer,
                    emittedTargets,
                    emittedValues,
                    ,
                    emittedCalldatas,
                    ,
                    ,
                    emittedDescription
                ] = createdEvent.args;
                expect(emittedProposer).to.be.equals(user0.address);
                expect(emittedTargets[0]).to.be.equals(smallCouncilAddress);
                // expect(createdEvent.args.values[0]).to.be.equals(0);
                expect(emittedValues[0]).to.be.equals(0);
                expect(emittedCalldatas[0]).to.be.equals(calldata);
                expect(emittedDescription).to.be.equals(description);

                const proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(0);
            });

            it("should allow users to vote", async () => {
                const { proposeBlockNum } = await proposeOnSmallCouncil(user0, true);

                const proposalCreatedFilter = smallCouncilGovernor.filters.ProposalCreated();
                const proposalCreatedEvents = await smallCouncilGovernor.queryFilter(
                    proposalCreatedFilter,
                    proposeBlockNum
                );
                const [proposalId] = proposalCreatedEvents[proposalCreatedEvents.length - 1].args;

                await fastForwardByBlock(VOTING_DELAY + 1);

                const support = 1; // For
                const reason = "User1 likes it";

                const { voteBlockNum } = await voteWithReasonOnProposal(
                    user1,
                    proposalId,
                    support,
                    reason
                );

                const voteCastFilter = smallCouncilGovernor.filters.VoteCast();
                const voteCastEvents = await smallCouncilGovernor.queryFilter(
                    voteCastFilter,
                    voteBlockNum
                );

                const [voter, emittedProposalId, emittedSupport, , emittedReason] =
                    voteCastEvents[voteCastEvents.length - 1].args;
                expect(voter).to.be.equals(user1.address);
                expect(emittedProposalId).to.be.equals(proposalId);
                expect(emittedSupport).to.be.equals(support);
                expect(emittedReason).to.be.equals(reason);
            });

            it("should defeat the proposal if quorum not met", async () => {
                const { proposeBlockNum } = await proposeOnSmallCouncil(user0, true);

                const proposalCreatedFilter = smallCouncilGovernor.filters.ProposalCreated();
                const proposalCreatedEvents = await smallCouncilGovernor.queryFilter(
                    proposalCreatedFilter,
                    proposeBlockNum
                );
                const [proposalId] = proposalCreatedEvents[proposalCreatedEvents.length - 1].args;

                await fastForwardByBlock(VOTING_DELAY + 1);

                let proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(1);

                const support = 1; // For
                const reason = "User1 likes it"; // 1 vote
                await voteWithReasonOnProposal(user1, proposalId, support, reason);

                await fastForwardByBlock(VOTING_PERIOD - 2);
                proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(1);

                await fastForwardByBlock(2);
                proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(3);
            });

            it("should pass the proposal if quorum met", async () => {
                const { proposeBlockNum } = await proposeOnSmallCouncil(user0, true);

                const proposalCreatedFilter = smallCouncilGovernor.filters.ProposalCreated();
                const proposalCreatedEvents = await smallCouncilGovernor.queryFilter(
                    proposalCreatedFilter,
                    proposeBlockNum
                );
                const [proposalId] = proposalCreatedEvents[proposalCreatedEvents.length - 1].args;

                await fastForwardByBlock(VOTING_DELAY + 1);

                let proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(1);

                const support = 1; // For
                const reason1 = "User1 likes it"; // 1 vote
                await voteWithReasonOnProposal(user1, proposalId, support, reason1);

                const reason2 = "User2 likes it"; // 5 vote
                await voteWithReasonOnProposal(user2, proposalId, support, reason2);

                await fastForwardByBlock(VOTING_PERIOD - 3); // Another vote -> another block mined
                proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(1);

                await fastForwardByBlock(2);
                proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(4);
            });

            // ---
            it("should allow proposal cancellation by proposer", async () => {
                const verdict = true;
                const targets = [smallCouncilAddress];
                const values = [0];
                const calldata = smallCouncil.interface.encodeFunctionData("store", [verdict]);
                const calldatas = [calldata];
                const description = `Change the verdict to "${verdict}"`;
                const descriptionHash = ethers.solidityPackedKeccak256(["string"], [description]);

                const { proposeBlockNum } = await proposeOnSmallCouncil(user0, verdict);

                const proposalCreatedFilter = smallCouncilGovernor.filters.ProposalCreated();
                const proposalCreatedEvents = await smallCouncilGovernor.queryFilter(
                    proposalCreatedFilter,
                    proposeBlockNum
                );
                const [proposalId] = proposalCreatedEvents[proposalCreatedEvents.length - 1].args;

                let proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(0);

                const connectedGovernor = await smallCouncilGovernor.connect(user0);

                const cancelTxn = await connectedGovernor.cancel(
                    targets,
                    values,
                    calldatas,
                    descriptionHash
                );
                await cancelTxn.wait(1);

                proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(2);
            });

            it("should allow delegating voting power to another user", async () => {
                const beforeDelegationVotes = await smallCouncilToken.getVotes(user5.address);
                expect(beforeDelegationVotes).to.be.equals(user5TokenBalance);

                const beforeDelegationVotesUser6 = await smallCouncilToken.getVotes(user6.address);
                expect(beforeDelegationVotesUser6).to.be.equals(user6TokenBalance);

                await delegateVotes(user5, user6);

                const afterDelegationVotesUser5 = await smallCouncilToken.getVotes(user5.address);
                expect(afterDelegationVotesUser5).to.be.equals(0);

                const afterDelegationVotesUser6 = await smallCouncilToken.getVotes(user6.address);
                expect(afterDelegationVotesUser6).to.be.equals(
                    user5TokenBalance + user6TokenBalance
                );
            });

            it("should not affect voting power when tokens are transferred after proposal creation", async () => {
                const { proposeBlockNum } = await proposeOnSmallCouncil(user0, true);

                await fastForwardByBlock(VOTING_DELAY + 1);

                const user7VotingPowerBeforeTransfer = await smallCouncilGovernor.getVotes(
                    user7.address,
                    proposeBlockNum
                );
                const user8VotingPowerBeforeTransfer = await smallCouncilGovernor.getVotes(
                    user8.address,
                    proposeBlockNum
                );

                const transferAmount = BigInt(2 * 10 ** 18);
                const connectedToken = await smallCouncilToken.connect(user7);
                const transferTxn = await connectedToken.transfer(user8.address, transferAmount);
                await transferTxn.wait(1);

                const user7VotingPowerAfterTransfer = await smallCouncilGovernor.getVotes(
                    user7.address,
                    proposeBlockNum
                );
                const user8VotingPowerAfterTransfer = await smallCouncilGovernor.getVotes(
                    user8.address,
                    proposeBlockNum
                );

                expect(user7VotingPowerAfterTransfer).to.be.equals(user7VotingPowerBeforeTransfer);
                expect(user8VotingPowerAfterTransfer).to.be.equals(user8VotingPowerBeforeTransfer);

                expect(user7VotingPowerAfterTransfer).to.be.equals(user7TokenBalance);
                expect(user8VotingPowerAfterTransfer).to.be.equals(user8TokenBalance);
            });
            // ---
        });
        describe("Time lock", () => {
            let proposalId;

            beforeEach(async () => {
                const { proposeBlockNum } = await proposeOnSmallCouncil(user0, true);

                const filter = smallCouncilGovernor.filters.ProposalCreated();
                const events = await smallCouncilGovernor.queryFilter(filter, proposeBlockNum);

                const [_proposalId] = events[events.length - 1].args;
                proposalId = _proposalId;
            });

            it("should set proposal active after voting delay", async () => {
                let proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(0);

                const votingDelay = await smallCouncilGovernor.votingDelay();

                await fastForwardByBlock(votingDelay - 1n);
                proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(0);

                await fastForwardByBlock(2);
                proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(1);
            });

            it("should set proposal succeeded after successful voting", async () => {
                await fastForwardByBlock(VOTING_DELAY + 1);

                let proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(1);

                const support = 1; // For
                const reason = "User2 likes it";
                await voteWithReasonOnProposal(user2, proposalId, support, reason);

                await fastForwardByBlock(VOTING_PERIOD - 2);
                proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(1);

                await fastForwardByBlock(2);
                proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(4);
            });
        });
        describe("Executing", () => {
            let proposalId;
            let descriptionHash;

            const queueProposal = async (operator, calldata, descriptionHash) => {
                const connectedGovernor = await smallCouncilGovernor.connect(operator);

                const calldatas = [calldata];

                const queueBlockNum = await ethers.provider.getBlockNumber();
                const queueTxn = await connectedGovernor.queue(
                    [smallCouncilAddress],
                    [0],
                    calldatas,
                    descriptionHash
                );
                const queueTxnReceipt = await queueTxn.wait(1);
                return { queueBlockNum, queueTxnReceipt };
            };

            const executeProposal = async (operator, calldata, descriptionHash) => {
                const connectedGovernor = await smallCouncilGovernor.connect(operator);

                const calldatas = [calldata];

                const executeBlockNum = await ethers.provider.getBlockNumber();
                const executeTxn = await connectedGovernor.execute(
                    [smallCouncilAddress],
                    [0],
                    calldatas,
                    descriptionHash
                );
                const executeTxnReceipt = await executeTxn.wait(1);
                return { executeBlockNum, executeTxnReceipt };
            };

            beforeEach(async () => {
                const { proposeBlockNum } = await proposeOnSmallCouncil(user0, true);

                const filter = smallCouncilGovernor.filters.ProposalCreated();
                const events = await smallCouncilGovernor.queryFilter(filter, proposeBlockNum);

                const [_proposalId, , , , , , , , proposalDescription] =
                    events[events.length - 1].args;
                proposalId = _proposalId;
                descriptionHash = ethers.solidityPackedKeccak256(["string"], [proposalDescription]);

                await fastForwardByBlock(VOTING_DELAY + 1);
                const support = 1; // For
                const reason = "User2 likes it";
                await voteWithReasonOnProposal(user2, proposalId, support, reason);
            });

            it("should allow user to queue the proposal", async () => {
                await fastForwardByBlock(VOTING_PERIOD + 1);

                const verdict = true;
                const calldata = smallCouncil.interface.encodeFunctionData("store", [verdict]);

                await queueProposal(deployer, calldata, descriptionHash);
                const proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(5);
            });

            it("should get executed after min delay", async () => {
                await fastForwardByBlock(VOTING_PERIOD + 1);

                const targetVerdict = true;
                const calldata = smallCouncil.interface.encodeFunctionData("store", [
                    targetVerdict
                ]);

                const { queueBlockNum } = await queueProposal(deployer, calldata, descriptionHash);

                const queuedEventFileter = smallCouncilGovernor.filters.ProposalQueued();
                const queuedEvents = await smallCouncilGovernor.queryFilter(
                    queuedEventFileter,
                    queueBlockNum
                );
                const [emittedProposalId] = queuedEvents[queuedEvents.length - 1].args;

                expect(emittedProposalId).to.be.equals(proposalId);

                let proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(5);

                await fastForwardByTime(MIN_DELAY - 1);
                proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(5);

                await fastForwardByTime(2);

                await executeProposal(deployer, calldata, descriptionHash);

                proposalState = await smallCouncilGovernor.state(proposalId);
                expect(proposalState).to.be.equals(7);

                const resultVerdict = await smallCouncil.retrieve();
                expect(resultVerdict).to.be.equals(targetVerdict);
            });
        });
    });
});
