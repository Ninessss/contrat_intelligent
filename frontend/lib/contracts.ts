// Configuration des contrats et ABI
import { getContractAddress } from '../config/contracts';

export const VOTING_CONTRACT_ADDRESS = getContractAddress('localhost'); // Par défaut en local

// ABI complet du contrat Voting basé sur le contrat Solidity réel
export const VOTING_ABI = [
  // Constructor
  'constructor()',
  
  // Fonctions principales
  'function registerVoter(address _voter) external',
  'function startProposalsRegistration() external',
  'function registerProposal(string calldata _description) external',
  'function endProposalsRegistration() external',
  'function startVotingSession() external',
  'function vote(uint _proposalId) external',
  'function endVotingSession() external',
  'function tallyVotes() external',
  'function getWinner() external view returns (string memory)',
  
  // Fonctions de vue
  'function workflowStatus() external view returns (uint8)',
  'function voters(address) external view returns (bool isRegistered, bool hasVoted, uint votedProposalId)',
  'function proposals(uint) external view returns (string memory description, uint voteCount)',
  'function winningProposalId() external view returns (uint)',
  'function owner() external view returns (address)',
  'function workflowDeadline() external view returns (uint)',
  'function vetoedProposals(uint) external view returns (bool)',
  
  // Fonctions d'administration
  'function setWorkflowDeadline(uint _durationInSeconds) external',
  'function proceedToNextStep() external',
  'function vetoProposal(uint _proposalId) external',
  
  // Events
  'event VoterRegistered(address voterAddress)',
  'event WorkflowStatusChange(uint8 previousStatus, uint8 newStatus)',
  'event ProposalRegistered(uint proposalId)',
  'event Voted(address voter, uint proposalId)',
  'event ProposalVetoed(uint proposalId)',
];

export const WORKFLOW_STATUS = {
  0: 'Enregistrement des votants',
  1: 'Enregistrement des propositions démarré',
  2: 'Enregistrement des propositions terminé',
  3: 'Session de vote démarrée',
  4: 'Session de vote terminée',
  5: 'Votes comptabilisés',
} as const;

export type WorkflowStatus = keyof typeof WORKFLOW_STATUS; 