// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Voting
 * @author [Votre nom]
 * @notice Ce contrat implémente un système de vote sécurisé avec un workflow en plusieurs étapes
 * @dev Hérite d'OpenZeppelin Ownable pour la gestion des permissions administrateur
 */
contract Voting is Ownable {

    /**
     * @notice États possibles du workflow de vote
     * @dev Enum utilisé pour contrôler les transitions d'état du processus de vote
     */
    enum WorkflowStatus {
        RegisteringVoters,              /// @dev Phase d'enregistrement des votants
        ProposalsRegistrationStarted,   /// @dev Phase d'enregistrement des propositions ouverte
        ProposalsRegistrationEnded,     /// @dev Phase d'enregistrement des propositions fermée
        VotingSessionStarted,          /// @dev Session de vote ouverte
        VotingSessionEnded,            /// @dev Session de vote fermée
        VotesTallied                   /// @dev Votes comptabilisés et gagnant déterminé
    }

    /**
     * @notice Structure représentant un votant
     * @dev Stocke l'état d'enregistrement et de vote d'une adresse
     */
    struct Voter {
        bool isRegistered;      /// @dev Indique si l'adresse est enregistrée pour voter
        bool hasVoted;          /// @dev Indique si l'adresse a déjà voté
        uint votedProposalId;   /// @dev ID de la proposition pour laquelle l'adresse a voté
    }

    /**
     * @notice Structure représentant une proposition
     * @dev Contient la description et le nombre de votes d'une proposition
     */
    struct Proposal {
        string description;  /// @dev Description textuelle de la proposition
        uint voteCount;      /// @dev Nombre de votes reçus par cette proposition
    }

    /// @notice Statut actuel du workflow de vote
    WorkflowStatus public workflowStatus;
    
    /// @notice Mapping des adresses vers les informations des votants
    mapping(address => Voter) public voters;
    
    /// @notice Tableau de toutes les propositions
    Proposal[] public proposals;
    
    /// @notice ID de la proposition gagnante après comptage
    uint public winningProposalId;
    
    /// @notice Timestamp limite pour l'étape en cours
    uint public workflowDeadline;
    
    /// @notice Mapping des propositions annulées par l'administrateur
    mapping(uint => bool) public vetoedProposals;

    /**
     * @notice Émis quand un nouveau votant est enregistré
     * @param voterAddress L'adresse du votant enregistré
     */
    event VoterRegistered(address voterAddress);
    
    /**
     * @notice Émis lors d'un changement d'état du workflow
     * @param previousStatus L'état précédent
     * @param newStatus Le nouvel état
     */
    event WorkflowStatusChange(WorkflowStatus previousStatus, WorkflowStatus newStatus);
    
    /**
     * @notice Émis quand une nouvelle proposition est enregistrée
     * @param proposalId L'ID de la proposition enregistrée
     */
    event ProposalRegistered(uint proposalId);
    
    /**
     * @notice Émis quand un vote est effectué
     * @param voter L'adresse du votant
     * @param proposalId L'ID de la proposition votée
     */
    event Voted(address voter, uint proposalId);
    
    /**
     * @notice Émis quand une proposition est annulée
     * @param proposalId L'ID de la proposition annulée
     */
    event ProposalVetoed(uint proposalId);

    /**
     * @notice Vérifie que le contrat est dans l'état spécifié
     * @param _status L'état requis pour exécuter la fonction
     */
    modifier onlyInState(WorkflowStatus _status) {
        require(workflowStatus == _status, "Invalid workflow status");
        _;
    }

    /**
     * @notice Vérifie que l'appelant est un votant enregistré
     * @dev Utilise le mapping voters pour vérifier l'enregistrement
     */
    modifier onlyRegisteredVoter() {
        require(voters[msg.sender].isRegistered, "You are not a registered voter");
        _;
    }

    /**
     * @notice Vérifie que l'appelant n'a pas encore voté
     * @dev Utilise le mapping voters pour vérifier l'état de vote
     */
    modifier hasNotVoted() {
        require(!voters[msg.sender].hasVoted, "You have already voted");
        _;
    }

    /**
     * @notice Vérifie que la deadline de l'étape actuelle est atteinte
     * @dev Compare block.timestamp avec workflowDeadline
     */
    modifier onlyAfterDeadline() {
        require(block.timestamp >= workflowDeadline, "Deadline not reached");
        _;
    }

    /**
     * @notice Constructeur du contrat
     * @dev Initialise le workflow à RegisteringVoters et définit le déployeur comme owner
     */
    constructor() {
        workflowStatus = WorkflowStatus.RegisteringVoters;
    }

    /**
     * @notice Enregistre une nouvelle adresse comme votant autorisé
     * @dev Seul l'owner peut appeler cette fonction pendant la phase RegisteringVoters
     * @param _voter L'adresse à enregistrer comme votant
     */
    function registerVoter(address _voter) external onlyOwner onlyInState(WorkflowStatus.RegisteringVoters) {
        require(!voters[_voter].isRegistered, "Voter already registered");
        voters[_voter].isRegistered = true;
        emit VoterRegistered(_voter);
    }

    /**
     * @notice Démarre la phase d'enregistrement des propositions
     * @dev Transition de RegisteringVoters vers ProposalsRegistrationStarted
     */
    function startProposalsRegistration() external onlyOwner onlyInState(WorkflowStatus.RegisteringVoters) {
        workflowStatus = WorkflowStatus.ProposalsRegistrationStarted;
        emit WorkflowStatusChange(WorkflowStatus.RegisteringVoters, WorkflowStatus.ProposalsRegistrationStarted);
    }

    /**
     * @notice Permet à un votant enregistré de soumettre une proposition
     * @dev Seuls les votants enregistrés peuvent soumettre pendant ProposalsRegistrationStarted
     * @param _description La description textuelle de la proposition
     */
    function registerProposal(string calldata _description) external onlyRegisteredVoter onlyInState(WorkflowStatus.ProposalsRegistrationStarted) {
        uint proposalId = proposals.length;
        proposals.push(Proposal({ description: _description, voteCount: 0 }));
        emit ProposalRegistered(proposalId);
    }

    /**
     * @notice Termine la phase d'enregistrement des propositions
     * @dev Transition de ProposalsRegistrationStarted vers ProposalsRegistrationEnded
     */
    function endProposalsRegistration() external onlyOwner onlyInState(WorkflowStatus.ProposalsRegistrationStarted) {
        workflowStatus = WorkflowStatus.ProposalsRegistrationEnded;
        emit WorkflowStatusChange(WorkflowStatus.ProposalsRegistrationStarted, WorkflowStatus.ProposalsRegistrationEnded);
    }

    /**
     * @notice Démarre la session de vote
     * @dev Transition de ProposalsRegistrationEnded vers VotingSessionStarted
     */
    function startVotingSession() external onlyOwner onlyInState(WorkflowStatus.ProposalsRegistrationEnded) {
        workflowStatus = WorkflowStatus.VotingSessionStarted;
        emit WorkflowStatusChange(WorkflowStatus.ProposalsRegistrationEnded, WorkflowStatus.VotingSessionStarted);
    }

    /**
     * @notice Permet à un votant enregistré de voter pour une proposition
     * @dev Le votant ne peut voter qu'une seule fois et seulement pendant VotingSessionStarted
     * @param _proposalId L'ID de la proposition pour laquelle voter
     */
    function vote(uint _proposalId) external onlyRegisteredVoter onlyInState(WorkflowStatus.VotingSessionStarted) hasNotVoted {
        require(_proposalId < proposals.length, "Invalid proposal");
        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedProposalId = _proposalId;
        proposals[_proposalId].voteCount++;
        emit Voted(msg.sender, _proposalId);
    }

    /**
     * @notice Termine la session de vote
     * @dev Transition de VotingSessionStarted vers VotingSessionEnded
     */
    function endVotingSession() external onlyOwner onlyInState(WorkflowStatus.VotingSessionStarted) {
        workflowStatus = WorkflowStatus.VotingSessionEnded;
        emit WorkflowStatusChange(WorkflowStatus.VotingSessionStarted, WorkflowStatus.VotingSessionEnded);
    }

    /**
     * @notice Comptabilise les votes et détermine le gagnant
     * @dev Parcourt toutes les propositions pour trouver celle avec le plus de votes
     */
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

    /**
     * @notice Retourne la description de la proposition gagnante
     * @dev Peut être appelé à tout moment, mais n'est significatif qu'après tallyVotes()
     * @return La description textuelle de la proposition gagnante
     */
    function getWinner() external view returns (string memory) {
        return proposals[winningProposalId].description;
    }

    /**
     * @notice Définit une deadline pour l'étape actuelle du workflow
     * @dev Seul l'owner peut définir une deadline
     * @param _durationInSeconds Durée en secondes à partir de maintenant
     */
    function setWorkflowDeadline(uint _durationInSeconds) external onlyOwner {
        workflowDeadline = block.timestamp + _durationInSeconds;
    }

    /**
     * @notice Fait automatiquement progresser le workflow vers l'étape suivante
     * @dev Ne peut être appelé qu'après expiration de la deadline par l'owner
     */
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

    /**
     * @notice Permet à l'owner d'annuler une proposition
     * @dev Une proposition annulée ne peut plus recevoir de votes effectifs
     * @param _proposalId L'ID de la proposition à annuler
     */
    function vetoProposal(uint _proposalId) external onlyOwner {
        require(_proposalId < proposals.length, "Invalid proposal ID");
        require(!vetoedProposals[_proposalId], "Proposal already vetoed");
        vetoedProposals[_proposalId] = true;
        emit ProposalVetoed(_proposalId);
    }
}