'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Vote, Users, Trophy, Plus, CheckCircle, Eye, Globe } from 'lucide-react';
import { VOTING_ABI, VOTING_CONTRACT_ADDRESS, WORKFLOW_STATUS } from '@/lib/contracts';

export default function VotingDApp() {
  const [account, setAccount] = useState<string>('');
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [publicContract, setPublicContract] = useState<ethers.Contract | null>(null); // Contrat en lecture seule
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [publicProvider, setPublicProvider] = useState<ethers.JsonRpcProvider | null>(null); // Provider public
  const [workflowStatus, setWorkflowStatus] = useState<number>(0);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [isVoter, setIsVoter] = useState<boolean>(false);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [proposals, setProposals] = useState<Array<{ id: number; description: string; voteCount: number }>>([]);
  const [winningProposal, setWinningProposal] = useState<number | null>(null);
  const [winnerDescription, setWinnerDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isPublicMode, setIsPublicMode] = useState<boolean>(true); // Mode public par défaut

  // Adresse du contrat obtenue depuis les variables d'environnement
  const CONTRACT_ADDRESS = VOTING_CONTRACT_ADDRESS;

  useEffect(() => {
    // Initialiser le mode public au chargement
    initPublicMode();
  }, []);

  useEffect(() => {
    if (contract && account) {
      loadContractData();
    }
  }, [contract, account]);

  useEffect(() => {
    if (publicContract && isPublicMode) {
      loadPublicData();
    }
  }, [publicContract, isPublicMode]);

  const initPublicMode = async () => {
    try {
      // Créer un provider public (sans MetaMask)
      const publicProv = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
      const publicContr = new ethers.Contract(CONTRACT_ADDRESS, VOTING_ABI, publicProv);
      
      setPublicProvider(publicProv);
      setPublicContract(publicContr);
      setError('');
    } catch (err: any) {
      setError("Impossible de se connecter au réseau blockchain");
    }
  };

  const loadPublicData = async () => {
    if (!publicContract) return;

    try {
      setLoading(true);

      // Récupérer le statut du workflow
      const status = await publicContract.workflowStatus();
      setWorkflowStatus(Number(status));

      // Charger les propositions si disponibles
      if (Number(status) >= 1) {
        await loadPublicProposals();
      }

      // Charger le gagnant si les votes sont comptabilisés
      if (Number(status) === 5) {
        const winningId = await publicContract.winningProposalId();
        setWinningProposal(Number(winningId));
        
        const winner = await publicContract.getWinner();
        setWinnerDescription(winner);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPublicProposals = async () => {
    if (!publicContract) return;

    try {
      const proposalsList = [];
      let i = 0;
      
      // Parcourir les propositions jusqu'à en trouver une qui n'existe pas
      while (true) {
        try {
          const proposal = await publicContract.proposals(i);
          if (proposal.description === "") break; // Arrêter si la description est vide
          
          proposalsList.push({
            id: i,
            description: proposal.description,
            voteCount: Number(proposal.voteCount),
          });
          i++;
        } catch {
          break; // Arrêter en cas d'erreur (proposition inexistante)
        }
      }

      setProposals(proposalsList);
    } catch (err: any) {
      setError(err.message);
    }
  };

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
        setIsPublicMode(false); // Basculer en mode connecté
        setError('');
      } else {
        setError("MetaMask n'est pas installé");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const disconnectWallet = () => {
    setAccount('');
    setContract(null);
    setProvider(null);
    setIsOwner(false);
    setIsVoter(false);
    setHasVoted(false);
    setIsPublicMode(true);
    // Recharger les données publiques
    loadPublicData();
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
        const voterInfo = await contract.voters(account);
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
        const winningId = await contract.winningProposalId();
        setWinningProposal(Number(winningId));
        
        const winner = await contract.getWinner();
        setWinnerDescription(winner);
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
      const proposalsList = [];
      let i = 0;
      
      // Parcourir les propositions jusqu'à en trouver une qui n'existe pas
      while (true) {
        try {
          const proposal = await contract.proposals(i);
          if (proposal.description === "") break; // Arrêter si la description est vide
          
          proposalsList.push({
            id: i,
            description: proposal.description,
            voteCount: Number(proposal.voteCount),
          });
          i++;
        } catch {
          break; // Arrêter en cas d'erreur (proposition inexistante)
        }
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
      const tx = await contract.registerVoter(voterAddress);
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
      const tx = await contract.registerProposal(description);
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

  const voteForProposal = async (proposalId: number) => {
    if (!contract) return;

    try {
      setLoading(true);
      const tx = await contract.vote(proposalId);
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
          tx = await contract.startProposalsRegistration();
          break;
        case 'endProposals':
          tx = await contract.endProposalsRegistration();
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

  // Composant pour la consultation publique
  const PublicResultsView = () => (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4'>
      <div className='max-w-4xl mx-auto space-y-6'>
        {/* Header Public */}
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='text-3xl flex items-center gap-2'>
                  <Globe className='w-8 h-8 text-blue-600' />
                  DApp de Vote - Consultation Publique
                </CardTitle>
                <CardDescription className='text-lg'>
                  Consultez les résultats du vote en temps réel
                </CardDescription>
              </div>
              <div className='flex gap-2'>
                <Button onClick={connectWallet} variant='outline'>
                  <Wallet className='w-4 h-4 mr-2' />
                  Se connecter pour participer
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Status Public */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Eye className='w-5 h-5' />
              Statut actuel du processus de vote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex items-center gap-4'>
              <Badge variant='default' className='text-sm'>
                Étape {workflowStatus + 1}/6
              </Badge>
              <span className='font-medium text-lg'>{WORKFLOW_STATUS[workflowStatus as keyof typeof WORKFLOW_STATUS]}</span>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Propositions en cours */}
        {proposals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Vote className='w-5 h-5' />
                Propositions soumises ({proposals.length})
              </CardTitle>
              <CardDescription>
                {workflowStatus >= 4 ? 'Résultats du vote' : 'Propositions en cours'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                {proposals.map((proposal) => (
                  <div key={proposal.id} className={`p-4 border rounded-lg ${
                    winningProposal === proposal.id ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}>
                    <div className='flex items-center justify-between'>
                      <div className='flex-1'>
                        <h3 className='font-medium text-lg'>{proposal.description}</h3>
                        <p className='text-sm text-muted-foreground'>Proposition #{proposal.id}</p>
                      </div>
                      <div className='flex items-center gap-2'>
                        {workflowStatus >= 4 && (
                          <Badge variant={winningProposal === proposal.id ? 'default' : 'outline'} className='text-sm'>
                            {proposal.voteCount} vote{proposal.voteCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {winningProposal === proposal.id && (
                          <Trophy className='w-5 h-5 text-yellow-500' />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Résultat final */}
        {workflowStatus === 5 && winnerDescription && (
          <Card className='border-green-500'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-green-700'>
                <Trophy className='w-6 h-6' />
                🎉 Proposition gagnante !
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='p-4 bg-green-50 rounded-lg'>
                <p className='text-lg font-medium text-green-800'>{winnerDescription}</p>
                <p className='text-sm text-green-600 mt-2'>
                  Cette proposition a remporté le vote à la majorité simple
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Information sur la participation */}
        <Card>
          <CardContent className='pt-6'>
            <div className='text-center text-muted-foreground'>
              <p>Vous souhaitez participer au processus de vote ?</p>
              <Button onClick={connectWallet} className='mt-2'>
                <Wallet className='w-4 h-4 mr-2' />
                Connecter votre wallet MetaMask
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Mode public : affichage pour tout le monde
  if (isPublicMode && !account) {
    return <PublicResultsView />;
  }

  // Mode connecté : interface complète
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
                <Button onClick={disconnectWallet} variant='outline' size='sm'>
                  <Globe className='w-4 h-4 mr-2' />
                  Mode public
                </Button>
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
                        <Button onClick={() => voteForProposal(proposal.id)} disabled={loading}>
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
                        <Input placeholder="0x..." id='voterInput' />
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
                          <Plus className='w-4 h-4 mr-2' />
                          Ajouter Votant
                        </Button>
                      </div>
                    ) : (
                      <Alert>
                        <AlertDescription>
                          L'enregistrement des votants est terminé.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Gestion du workflow</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-2'>
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
                    <Alert className='border-green-500 bg-green-50'>
                      <Trophy className='h-4 w-4 text-green-600' />
                      <AlertDescription className='text-green-800'>
                        <strong>Proposition gagnante :</strong> {winnerDescription}
                      </AlertDescription>
                    </Alert>
                    
                    <div className='space-y-2'>
                      <h4 className='font-medium'>Détail des votes :</h4>
                      {proposals
                        .sort((a, b) => b.voteCount - a.voteCount)
                        .map((proposal) => (
                        <div key={proposal.id} className={`p-3 border rounded ${
                          winningProposal === proposal.id ? 'border-green-500 bg-green-50' : ''
                        }`}>
                          <div className='flex items-center justify-between'>
                            <span>{proposal.description}</span>
                            <div className='flex items-center gap-2'>
                              <Badge variant={winningProposal === proposal.id ? 'default' : 'outline'}>
                                {proposal.voteCount} vote{proposal.voteCount !== 1 ? 's' : ''}
                              </Badge>
                              {winningProposal === proposal.id && <Trophy className='w-4 h-4 text-yellow-500' />}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      Les résultats seront disponibles après le décompte des votes.
                    </AlertDescription>
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
