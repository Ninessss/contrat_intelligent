'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Vote, Users, Trophy, Plus, CheckCircle } from 'lucide-react';

// ABI du contrat de vote (à adapter selon votre contrat)
const VOTING_ABI = [
  'function addVoter(address _addr) external',
  'function addProposal(string memory _desc) external',
  'function setVote(uint _id) external',
  'function startProposalsRegistering() external',
  'function endProposalsRegistering() external',
  'function startVotingSession() external',
  'function endVotingSession() external',
  'function tallyVotes() external',
  'function getVoter(address _addr) external view returns (bool isRegistered, bool hasVoted, uint votedProposalId)',
  'function getOneProposal(uint _id) external view returns (string memory description, uint voteCount)',
  'function workflowStatus() external view returns (uint8)',
  'function proposalsNum() external view returns (uint)',
  'function winningProposalID() external view returns (uint)',
  'function owner() external view returns (address)',
  'event VoterRegistered(address voterAddress)',
  'event WorkflowStatusChange(uint8 previousStatus, uint8 newStatus)',
  'event ProposalRegistered(uint proposalId)',
  'event Voted(address voter, uint proposalId)',
];

const WORKFLOW_STATUS = {
  0: 'Enregistrement des votants',
  1: 'Enregistrement des propositions',
  2: "Fin de l'enregistrement des propositions",
  3: 'Session de vote',
  4: 'Fin de la session de vote',
  5: 'Votes comptabilisés',
};

export default function VotingDApp() {
  const [account, setAccount] = useState<string>('');
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<number>(0);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [isVoter, setIsVoter] = useState<boolean>(false);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [proposals, setProposals] = useState<Array<{ id: number; description: string; voteCount: number }>>([]);
  const [winningProposal, setWinningProposal] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Adresse du contrat (à remplacer par votre adresse)
  const CONTRACT_ADDRESS = '0x...'; // Remplacez par l'adresse de votre contrat

  useEffect(() => {
    if (contract && account) {
      loadContractData();
    }
  }, [contract, account]);

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();

        const contract = new ethers.Contract(CONTRACT_ADDRESS, VOTING_ABI, signer);

        setProvider(provider);
        setAccount(address);
        setContract(contract);
        setError('');
      } else {
        setError("MetaMask n'est pas installé");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadContractData = async () => {
    if (!contract || !account) return;

    try {
      setLoading(true);

      // Récupérer le statut du workflow
      const status = await contract.workflowStatus();
      setWorkflowStatus(Number(status));

      // Vérifier si l'utilisateur est le propriétaire
      const owner = await contract.owner();
      setIsOwner(owner.toLowerCase() === account.toLowerCase());

      // Vérifier si l'utilisateur est un votant
      try {
        const voterInfo = await contract.getVoter(account);
        setIsVoter(voterInfo.isRegistered);
        setHasVoted(voterInfo.hasVoted);
      } catch {
        setIsVoter(false);
        setHasVoted(false);
      }

      // Charger les propositions si disponibles
      if (Number(status) >= 1) {
        await loadProposals();
      }

      // Charger le gagnant si les votes sont comptabilisés
      if (Number(status) === 5) {
        const winningId = await contract.winningProposalID();
        setWinningProposal(Number(winningId));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProposals = async () => {
    if (!contract) return;

    try {
      const proposalsNum = await contract.proposalsNum();
      const proposalsList = [];

      for (let i = 0; i < Number(proposalsNum); i++) {
        const proposal = await contract.getOneProposal(i);
        proposalsList.push({
          id: i,
          description: proposal.description,
          voteCount: Number(proposal.voteCount),
        });
      }

      setProposals(proposalsList);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addVoter = async (voterAddress: string) => {
    if (!contract) return;

    try {
      setLoading(true);
      const tx = await contract.addVoter(voterAddress);
      await tx.wait();
      setError('');
      alert('Votant ajouté avec succès!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addProposal = async (description: string) => {
    if (!contract) return;

    try {
      setLoading(true);
      const tx = await contract.addProposal(description);
      await tx.wait();
      await loadProposals();
      setError('');
      alert('Proposition ajoutée avec succès!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const vote = async (proposalId: number) => {
    if (!contract) return;

    try {
      setLoading(true);
      const tx = await contract.setVote(proposalId);
      await tx.wait();
      setHasVoted(true);
      await loadProposals();
      setError('');
      alert('Vote enregistré avec succès!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const changeWorkflowStatus = async (action: string) => {
    if (!contract) return;

    try {
      setLoading(true);
      let tx;

      switch (action) {
        case 'startProposals':
          tx = await contract.startProposalsRegistering();
          break;
        case 'endProposals':
          tx = await contract.endProposalsRegistering();
          break;
        case 'startVoting':
          tx = await contract.startVotingSession();
          break;
        case 'endVoting':
          tx = await contract.endVotingSession();
          break;
        case 'tally':
          tx = await contract.tallyVotes();
          break;
      }

      if (tx) {
        await tx.wait();
        await loadContractData();
        setError('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4'>
        <Card className='w-full max-w-md'>
          <CardHeader className='text-center'>
            <div className='mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center'>
              <Vote className='w-6 h-6 text-blue-600' />
            </div>
            <CardTitle className='text-2xl'>DApp de Vote Ethereum</CardTitle>
            <CardDescription>Connectez votre wallet pour participer au vote décentralisé</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={connectWallet} className='w-full' size='lg'>
              <Wallet className='w-4 h-4 mr-2' />
              Connecter MetaMask
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4'>
      <div className='max-w-6xl mx-auto space-y-6'>
        {/* Header */}
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='text-2xl flex items-center gap-2'>
                  <Vote className='w-6 h-6' />
                  DApp de Vote Ethereum
                </CardTitle>
                <CardDescription>
                  Compte connecté: {account.slice(0, 6)}...{account.slice(-4)}
                </CardDescription>
              </div>
              <div className='flex gap-2'>
                <Badge variant={isOwner ? 'default' : 'secondary'}>{isOwner ? 'Administrateur' : 'Utilisateur'}</Badge>
                <Badge variant={isVoter ? 'default' : 'outline'}>{isVoter ? 'Votant autorisé' : 'Non autorisé'}</Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <CheckCircle className='w-5 h-5' />
              Statut du processus de vote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex items-center gap-4'>
              <Badge variant='default' className='text-sm'>
                Étape {workflowStatus + 1}/6
              </Badge>
              <span className='font-medium'>{WORKFLOW_STATUS[workflowStatus as keyof typeof WORKFLOW_STATUS]}</span>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue='vote' className='space-y-4'>
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='vote'>Voter</TabsTrigger>
            <TabsTrigger value='proposals'>Propositions</TabsTrigger>
            {isOwner && <TabsTrigger value='admin'>Administration</TabsTrigger>}
            <TabsTrigger value='results'>Résultats</TabsTrigger>
          </TabsList>

          {/* Onglet Vote */}
          <TabsContent value='vote'>
            <Card>
              <CardHeader>
                <CardTitle>Session de vote</CardTitle>
                <CardDescription>
                  {workflowStatus === 3 ? 'Votez pour votre proposition préférée' : "La session de vote n'est pas encore ouverte"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {workflowStatus === 3 && isVoter && !hasVoted ? (
                  <div className='space-y-4'>
                    {proposals.map((proposal) => (
                      <div key={proposal.id} className='flex items-center justify-between p-4 border rounded-lg'>
                        <div>
                          <h3 className='font-medium'>{proposal.description}</h3>
                          <p className='text-sm text-muted-foreground'>ID: {proposal.id}</p>
                        </div>
                        <Button onClick={() => vote(proposal.id)} disabled={loading}>
                          Voter
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : hasVoted ? (
                  <Alert>
                    <CheckCircle className='h-4 w-4' />
                    <AlertDescription>Vous avez déjà voté!</AlertDescription>
                  </Alert>
                ) : !isVoter ? (
                  <Alert>
                    <AlertDescription>Vous n'êtes pas autorisé à voter.</AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertDescription>La session de vote n'est pas encore ouverte.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Propositions */}
          <TabsContent value='proposals'>
            <Card>
              <CardHeader>
                <CardTitle>Propositions</CardTitle>
                <CardDescription>
                  {workflowStatus === 1 ? 'Ajoutez vos propositions' : 'Consultez les propositions soumises'}
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {workflowStatus === 1 && isVoter && (
                  <div className='flex gap-2'>
                    <Input placeholder='Décrivez votre proposition...' id='proposalInput' />
                    <Button
                      onClick={() => {
                        const input = document.getElementById('proposalInput') as HTMLInputElement;
                        if (input.value.trim()) {
                          addProposal(input.value.trim());
                          input.value = '';
                        }
                      }}
                      disabled={loading}
                    >
                      <Plus className='w-4 h-4 mr-2' />
                      Ajouter
                    </Button>
                  </div>
                )}

                <div className='space-y-2'>
                  {proposals.map((proposal) => (
                    <div key={proposal.id} className='p-4 border rounded-lg'>
                      <div className='flex items-center justify-between'>
                        <div>
                          <h3 className='font-medium'>{proposal.description}</h3>
                          <p className='text-sm text-muted-foreground'>Proposition #{proposal.id}</p>
                        </div>
                        {workflowStatus >= 4 && (
                          <Badge variant='outline'>
                            {proposal.voteCount} vote{proposal.voteCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Administration */}
          {isOwner && (
            <TabsContent value='admin'>
              <div className='space-y-4'>
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Users className='w-5 h-5' />
                      Gestion des votants
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {workflowStatus === 0 ? (
                      <div className='flex gap-2'>
                        <Input placeholder='Adresse Ethereum du votant...' id='voterInput' />
                        <Button
                          onClick={() => {
                            const input = document.getElementById('voterInput') as HTMLInputElement;
                            if (input.value.trim()) {
                              addVoter(input.value.trim());
                              input.value = '';
                            }
                          }}
                          disabled={loading}
                        >
                          Ajouter votant
                        </Button>
                      </div>
                    ) : (
                      <Alert>
                        <AlertDescription>L'enregistrement des votants est terminé.</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Contrôle du processus</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='flex flex-wrap gap-2'>
                      {workflowStatus === 0 && (
                        <Button onClick={() => changeWorkflowStatus('startProposals')} disabled={loading}>
                          Démarrer l'enregistrement des propositions
                        </Button>
                      )}
                      {workflowStatus === 1 && (
                        <Button onClick={() => changeWorkflowStatus('endProposals')} disabled={loading}>
                          Terminer l'enregistrement des propositions
                        </Button>
                      )}
                      {workflowStatus === 2 && (
                        <Button onClick={() => changeWorkflowStatus('startVoting')} disabled={loading}>
                          Démarrer la session de vote
                        </Button>
                      )}
                      {workflowStatus === 3 && (
                        <Button onClick={() => changeWorkflowStatus('endVoting')} disabled={loading}>
                          Terminer la session de vote
                        </Button>
                      )}
                      {workflowStatus === 4 && (
                        <Button onClick={() => changeWorkflowStatus('tally')} disabled={loading}>
                          Comptabiliser les votes
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* Onglet Résultats */}
          <TabsContent value='results'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Trophy className='w-5 h-5' />
                  Résultats du vote
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workflowStatus === 5 ? (
                  <div className='space-y-4'>
                    {winningProposal !== null && (
                      <Alert>
                        <Trophy className='h-4 w-4' />
                        <AlertDescription>
                          <strong>Proposition gagnante:</strong> {proposals[winningProposal]?.description}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className='space-y-2'>
                      <h3 className='font-medium'>Tous les résultats:</h3>
                      {proposals
                        .sort((a, b) => b.voteCount - a.voteCount)
                        .map((proposal, index) => (
                          <div
                            key={proposal.id}
                            className={`p-4 border rounded-lg ${proposal.id === winningProposal ? 'border-yellow-400 bg-yellow-50' : ''}`}
                          >
                            <div className='flex items-center justify-between'>
                              <div>
                                <h4 className='font-medium flex items-center gap-2'>
                                  {proposal.id === winningProposal && <Trophy className='w-4 h-4 text-yellow-600' />}
                                  {proposal.description}
                                </h4>
                                <p className='text-sm text-muted-foreground'>
                                  Position #{index + 1} • Proposition #{proposal.id}
                                </p>
                              </div>
                              <Badge variant={proposal.id === winningProposal ? 'default' : 'outline'}>
                                {proposal.voteCount} vote{proposal.voteCount !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>Les résultats seront disponibles une fois les votes comptabilisés.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
