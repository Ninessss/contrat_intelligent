// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Voting is Ownable {

    enum WorkflowStatus {
        RegisteringVoters,
        ProposalsRegistrationStarted,
        ProposalsRegistrationEnded,
        VotingSessionStarted,
        VotingSessionEnded,
        VotesTallied
    }

    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint votedProposalId;
    }

    struct Proposal {
        string description;
        uint voteCount;
    }

    WorkflowStatus public workflowStatus;
    mapping(address => Voter) public voters;
    Proposal[] public proposals;
    uint public winningProposalId;

    event VoterRegistered(address voterAddress);
    event WorkflowStatusChange(WorkflowStatus previousStatus, WorkflowStatus newStatus);
    event ProposalRegistered(uint proposalId);
    event Voted(address voter, uint proposalId);

    modifier onlyInState(WorkflowStatus _status) {
        require(workflowStatus == _status, "Invalid workflow status");
        _;
    }

    modifier onlyRegisteredVoter() {
        require(voters[msg.sender].isRegistered, "You are not a registered voter");
        _;
    }

    modifier hasNotVoted() {
        require(!voters[msg.sender].hasVoted, "You have already voted");
        _;
    }

    // Appel explicite du constructeur d'Ownable avec msg.sender
    constructor() Ownable(msg.sender) {
        workflowStatus = WorkflowStatus.RegisteringVoters;
    }

    // Step 1: Register voters
    function registerVoter(address _voter) external onlyOwner onlyInState(WorkflowStatus.RegisteringVoters) {
        require(!voters[_voter].isRegistered, "Voter already registered");
        voters[_voter].isRegistered = true;
        emit VoterRegistered(_voter);
    }

    // Step 2: Start proposal registration
    function startProposalsRegistration() external onlyOwner onlyInState(WorkflowStatus.RegisteringVoters) {
        workflowStatus = WorkflowStatus.ProposalsRegistrationStarted;
        emit WorkflowStatusChange(WorkflowStatus.RegisteringVoters, WorkflowStatus.ProposalsRegistrationStarted);
    }

    // Step 3: Submit a proposal
    function registerProposal(string calldata _description) external onlyRegisteredVoter onlyInState(WorkflowStatus.ProposalsRegistrationStarted) {
        uint proposalId = proposals.length;
        proposals.push(Proposal({ description: _description, voteCount: 0 }));
        emit ProposalRegistered(proposalId);
    }

    // Step 4: End proposal registration
    function endProposalsRegistration() external onlyOwner onlyInState(WorkflowStatus.ProposalsRegistrationStarted) {
        workflowStatus = WorkflowStatus.ProposalsRegistrationEnded;
        emit WorkflowStatusChange(WorkflowStatus.ProposalsRegistrationStarted, WorkflowStatus.ProposalsRegistrationEnded);
    }

    // Step 5: Start voting session
    function startVotingSession() external onlyOwner onlyInState(WorkflowStatus.ProposalsRegistrationEnded) {
        workflowStatus = WorkflowStatus.VotingSessionStarted;
        emit WorkflowStatusChange(WorkflowStatus.ProposalsRegistrationEnded, WorkflowStatus.VotingSessionStarted);
    }

    // Step 6: Vote for a proposal
    function vote(uint _proposalId) external onlyRegisteredVoter onlyInState(WorkflowStatus.VotingSessionStarted) hasNotVoted {
        require(_proposalId < proposals.length, "Invalid proposal");
        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedProposalId = _proposalId;
        proposals[_proposalId].voteCount++;
        emit Voted(msg.sender, _proposalId);
    }

    // Step 7: End voting session
    function endVotingSession() external onlyOwner onlyInState(WorkflowStatus.VotingSessionStarted) {
        workflowStatus = WorkflowStatus.VotingSessionEnded;
        emit WorkflowStatusChange(WorkflowStatus.VotingSessionStarted, WorkflowStatus.VotingSessionEnded);
    }

    // Step 8: Tally votes and determine winner
    function tallyVotes() external onlyOwner onlyInState(WorkflowStatus.VotingSessionEnded) {
        uint winningVoteCount = 0;
        for (uint i = 0; i < proposals.length; i++) {
            if (proposals[i].voteCount > winningVoteCount) {
                winningVoteCount = proposals[i].voteCount;
                winningProposalId = i;
            }
        }
        workflowStatus = WorkflowStatus.VotesTallied;
        emit WorkflowStatusChange(WorkflowStatus.VotingSessionEnded, WorkflowStatus.VotesTallied);
    }

    // Step 9: Get winner
    function getWinner() external view returns (string memory) {
        return proposals[winningProposalId].description;
    }

uint public workflowDeadline; // Timestamp limite pour l'étape en cours

modifier onlyAfterDeadline() {
    require(block.timestamp >= workflowDeadline, "Deadline not reached");
    _;
}

function setWorkflowDeadline(uint _durationInSeconds) external onlyOwner {
    workflowDeadline = block.timestamp + _durationInSeconds;
}

function proceedToNextStep() external onlyOwner onlyAfterDeadline {
    if (workflowStatus == WorkflowStatus.RegisteringVoters) {
        this.startProposalsRegistration();
    } else if (workflowStatus == WorkflowStatus.ProposalsRegistrationStarted) {
        this.endProposalsRegistration();
    } else if (workflowStatus == WorkflowStatus.ProposalsRegistrationEnded) {
        this.startVotingSession();
    } else if (workflowStatus == WorkflowStatus.VotingSessionStarted) {
        this.endVotingSession();
    } else if (workflowStatus == WorkflowStatus.VotingSessionEnded) {
        this.tallyVotes();
    }
}

mapping(uint => bool) public vetoedProposals; // Propositions annulées

event ProposalVetoed(uint proposalId);

function vetoProposal(uint _proposalId) external onlyOwner {
    require(_proposalId < proposals.length, "Invalid proposal ID");
    require(!vetoedProposals[_proposalId], "Proposal already vetoed");
    vetoedProposals[_proposalId] = true;
    emit ProposalVetoed(_proposalId);
}

}