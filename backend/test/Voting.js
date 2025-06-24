const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Voting Contract', function () {
  // Fixture pour déployer le contrat Voting
  async function deployVotingFixture() {
    // Obtenir les comptes de test
    const [owner, voter1, voter2, voter3, nonVoter] = await ethers.getSigners();

    // Déployer le contrat
    const Voting = await ethers.getContractFactory('Voting');
    const voting = await Voting.deploy();

    return { voting, owner, voter1, voter2, voter3, nonVoter };
  }

  // Fixture avec des votants enregistrés
  async function deployVotingWithVotersFixture() {
    const { voting, owner, voter1, voter2, voter3, nonVoter } = await loadFixture(deployVotingFixture);

    // Enregistrer des votants
    await voting.connect(owner).registerVoter(voter1.address);
    await voting.connect(owner).registerVoter(voter2.address);
    await voting.connect(owner).registerVoter(voter3.address);

    return { voting, owner, voter1, voter2, voter3, nonVoter };
  }

  // Fixture avec des propositions enregistrées
  async function deployVotingWithProposalsFixture() {
    const { voting, owner, voter1, voter2, voter3, nonVoter } = await loadFixture(deployVotingWithVotersFixture);

    // Démarrer l'enregistrement des propositions
    await voting.connect(owner).startProposalsRegistration();

    // Enregistrer des propositions
    await voting.connect(voter1).registerProposal("Proposition 1: Améliorer les transports");
    await voting.connect(voter2).registerProposal("Proposition 2: Construire un parc");
    await voting.connect(voter3).registerProposal("Proposition 3: Rénover l'école");

    return { voting, owner, voter1, voter2, voter3, nonVoter };
  }

  describe('🚀 Déploiement', function () {
    it('Devrait définir le propriétaire correct', async function () {
      const { voting, owner } = await loadFixture(deployVotingFixture);
      expect(await voting.owner()).to.equal(owner.address);
    });

    it('Devrait initialiser le workflow à RegisteringVoters', async function () {
      const { voting } = await loadFixture(deployVotingFixture);
      expect(await voting.workflowStatus()).to.equal(0); // RegisteringVoters
    });

    it('Devrait avoir zero propositions au début', async function () {
      const { voting } = await loadFixture(deployVotingFixture);
      expect(await voting.winningProposalId()).to.equal(0);
    });
  });

  describe('👤 Enregistrement des Votants', function () {
    describe('✅ Cas de Succès', function () {
      it('Devrait permettre au propriétaire d\'enregistrer un votant', async function () {
        const { voting, owner, voter1 } = await loadFixture(deployVotingFixture);

        await expect(voting.connect(owner).registerVoter(voter1.address))
          .to.emit(voting, 'VoterRegistered')
          .withArgs(voter1.address);

        const voterInfo = await voting.voters(voter1.address);
        expect(voterInfo.isRegistered).to.be.true;
        expect(voterInfo.hasVoted).to.be.false;
      });

      it('Devrait enregistrer plusieurs votants', async function () {
        const { voting, owner, voter1, voter2, voter3 } = await loadFixture(deployVotingFixture);

        await voting.connect(owner).registerVoter(voter1.address);
        await voting.connect(owner).registerVoter(voter2.address);
        await voting.connect(owner).registerVoter(voter3.address);

        expect((await voting.voters(voter1.address)).isRegistered).to.be.true;
        expect((await voting.voters(voter2.address)).isRegistered).to.be.true;
        expect((await voting.voters(voter3.address)).isRegistered).to.be.true;
      });
    });

    describe('❌ Cas d\'Erreur', function () {
      it('Devrait échouer si appelé par un non-propriétaire', async function () {
        const { voting, voter1, voter2 } = await loadFixture(deployVotingFixture);

        await expect(voting.connect(voter1).registerVoter(voter2.address))
          .to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('Devrait échouer si le votant est déjà enregistré', async function () {
        const { voting, owner, voter1 } = await loadFixture(deployVotingFixture);

        await voting.connect(owner).registerVoter(voter1.address);
        
        await expect(voting.connect(owner).registerVoter(voter1.address))
          .to.be.revertedWith('Voter already registered');
      });

      it('Devrait échouer si ce n\'est pas la phase RegisteringVoters', async function () {
        const { voting, owner, voter1 } = await loadFixture(deployVotingWithVotersFixture);

        // Passer à la phase suivante
        await voting.connect(owner).startProposalsRegistration();

        await expect(voting.connect(owner).registerVoter(voter1.address))
          .to.be.revertedWith('Invalid workflow status');
      });
    });
  });

  describe('📝 Gestion des Propositions', function () {
    describe('🎯 Démarrage de l\'Enregistrement', function () {
      it('Devrait permettre de démarrer l\'enregistrement des propositions', async function () {
        const { voting, owner } = await loadFixture(deployVotingWithVotersFixture);

        await expect(voting.connect(owner).startProposalsRegistration())
          .to.emit(voting, 'WorkflowStatusChange')
          .withArgs(0, 1); // RegisteringVoters -> ProposalsRegistrationStarted

        expect(await voting.workflowStatus()).to.equal(1);
      });

      it('Devrait échouer si ce n\'est pas la bonne phase', async function () {
        const { voting, owner } = await loadFixture(deployVotingWithProposalsFixture);

        await expect(voting.connect(owner).startProposalsRegistration())
          .to.be.revertedWith('Invalid workflow status');
      });
    });

    describe('📋 Enregistrement des Propositions', function () {
      it('Devrait permettre à un votant enregistré de soumettre une proposition', async function () {
        const { voting, owner, voter1 } = await loadFixture(deployVotingWithVotersFixture);
        
        await voting.connect(owner).startProposalsRegistration();

        await expect(voting.connect(voter1).registerProposal("Ma proposition"))
          .to.emit(voting, 'ProposalRegistered')
          .withArgs(0);

        const proposal = await voting.proposals(0);
        expect(proposal.description).to.equal("Ma proposition");
        expect(proposal.voteCount).to.equal(0);
      });

      it('Devrait échouer si le votant n\'est pas enregistré', async function () {
        const { voting, owner, nonVoter } = await loadFixture(deployVotingWithVotersFixture);
        
        await voting.connect(owner).startProposalsRegistration();

        await expect(voting.connect(nonVoter).registerProposal("Proposition non autorisée"))
          .to.be.revertedWith('You are not a registered voter');
      });

      it('Devrait échouer si ce n\'est pas la phase ProposalsRegistrationStarted', async function () {
        const { voting, voter1 } = await loadFixture(deployVotingWithVotersFixture);

        await expect(voting.connect(voter1).registerProposal("Proposition"))
          .to.be.revertedWith('Invalid workflow status');
      });
    });

    describe('🛑 Fin de l\'Enregistrement', function () {
      it('Devrait permettre de terminer l\'enregistrement des propositions', async function () {
        const { voting, owner } = await loadFixture(deployVotingWithProposalsFixture);

        await expect(voting.connect(owner).endProposalsRegistration())
          .to.emit(voting, 'WorkflowStatusChange')
          .withArgs(1, 2); // ProposalsRegistrationStarted -> ProposalsRegistrationEnded

        expect(await voting.workflowStatus()).to.equal(2);
      });
    });
  });

  describe('🗳️ Session de Vote', function () {
    describe('🚀 Démarrage du Vote', function () {
      it('Devrait permettre de démarrer la session de vote', async function () {
        const { voting, owner } = await loadFixture(deployVotingWithProposalsFixture);
        
        await voting.connect(owner).endProposalsRegistration();

        await expect(voting.connect(owner).startVotingSession())
          .to.emit(voting, 'WorkflowStatusChange')
          .withArgs(2, 3); // ProposalsRegistrationEnded -> VotingSessionStarted

        expect(await voting.workflowStatus()).to.equal(3);
      });
    });

    describe('🎯 Processus de Vote', function () {
      async function setupVotingSession() {
        const fixture = await loadFixture(deployVotingWithProposalsFixture);
        await fixture.voting.connect(fixture.owner).endProposalsRegistration();
        await fixture.voting.connect(fixture.owner).startVotingSession();
        return fixture;
      }

      it('Devrait permettre à un votant de voter pour une proposition', async function () {
        const { voting, voter1 } = await setupVotingSession();

        await expect(voting.connect(voter1).vote(0))
          .to.emit(voting, 'Voted')
          .withArgs(voter1.address, 0);

        // Vérifier l'état du votant
        const voterInfo = await voting.voters(voter1.address);
        expect(voterInfo.hasVoted).to.be.true;
        expect(voterInfo.votedProposalId).to.equal(0);

        // Vérifier le comptage des votes
        const proposal = await voting.proposals(0);
        expect(proposal.voteCount).to.equal(1);
      });

      it('Devrait échouer si le votant a déjà voté', async function () {
        const { voting, voter1 } = await setupVotingSession();

        await voting.connect(voter1).vote(0);

        await expect(voting.connect(voter1).vote(1))
          .to.be.revertedWith('You have already voted');
      });

      it('Devrait échouer pour une proposition invalide', async function () {
        const { voting, voter1 } = await setupVotingSession();

        await expect(voting.connect(voter1).vote(999))
          .to.be.revertedWith('Invalid proposal');
      });

      it('Devrait échouer si le votant n\'est pas enregistré', async function () {
        const { voting, nonVoter } = await setupVotingSession();

        await expect(voting.connect(nonVoter).vote(0))
          .to.be.revertedWith('You are not a registered voter');
      });
    });

    describe('🛑 Fin du Vote', function () {
      it('Devrait permettre de terminer la session de vote', async function () {
        const { voting, owner } = await loadFixture(deployVotingWithProposalsFixture);
        
        await voting.connect(owner).endProposalsRegistration();
        await voting.connect(owner).startVotingSession();

        await expect(voting.connect(owner).endVotingSession())
          .to.emit(voting, 'WorkflowStatusChange')
          .withArgs(3, 4); // VotingSessionStarted -> VotingSessionEnded

        expect(await voting.workflowStatus()).to.equal(4);
      });
    });
  });

  describe('📊 Comptabilisation et Résultats', function () {
    async function setupCompleteVoting() {
      const fixture = await loadFixture(deployVotingWithProposalsFixture);
      const { voting, owner, voter1, voter2, voter3 } = fixture;

      // Terminer l'enregistrement et démarrer le vote
      await voting.connect(owner).endProposalsRegistration();
      await voting.connect(owner).startVotingSession();

      // Effectuer des votes
      await voting.connect(voter1).vote(1); // Proposition 2
      await voting.connect(voter2).vote(1); // Proposition 2
      await voting.connect(voter3).vote(0); // Proposition 1

      // Terminer le vote
      await voting.connect(owner).endVotingSession();

      return fixture;
    }

    it('Devrait comptabiliser les votes et déterminer le gagnant', async function () {
      const { voting, owner } = await setupCompleteVoting();

      await expect(voting.connect(owner).tallyVotes())
        .to.emit(voting, 'WorkflowStatusChange')
        .withArgs(4, 5); // VotingSessionEnded -> VotesTallied

      expect(await voting.workflowStatus()).to.equal(5);
      expect(await voting.winningProposalId()).to.equal(1); // Proposition 2 a gagné avec 2 votes
    });

    it('Devrait retourner la description du gagnant', async function () {
      const { voting, owner } = await setupCompleteVoting();

      await voting.connect(owner).tallyVotes();
      
      const winnerDescription = await voting.getWinner();
      expect(winnerDescription).to.equal("Proposition 2: Construire un parc");
    });

    it('Devrait échouer si ce n\'est pas la phase VotingSessionEnded', async function () {
      const { voting, owner } = await loadFixture(deployVotingWithProposalsFixture);

      await expect(voting.connect(owner).tallyVotes())
        .to.be.revertedWith('Invalid workflow status');
    });
  });

  describe('🔧 Fonctionnalités Avancées', function () {
    describe('⏰ Gestion des Deadlines', function () {
      it('Devrait permettre de définir une deadline', async function () {
        const { voting, owner } = await loadFixture(deployVotingFixture);
        
        const duration = 3600; // 1 heure
        await voting.connect(owner).setWorkflowDeadline(duration);
        
        const deadline = await voting.workflowDeadline();
        expect(deadline).to.be.greaterThan(0);
      });

      it('Devrait échouer si la deadline n\'est pas atteinte', async function () {
        const { voting, owner } = await loadFixture(deployVotingFixture);
        
        await voting.connect(owner).setWorkflowDeadline(3600);
        
        await expect(voting.connect(owner).proceedToNextStep())
          .to.be.revertedWith('Deadline not reached');
      });
    });

    describe('🚫 Veto de Propositions', function () {
      it('Devrait permettre d\'annuler une proposition', async function () {
        const { voting, owner } = await loadFixture(deployVotingWithProposalsFixture);

        await expect(voting.connect(owner).vetoProposal(0))
          .to.emit(voting, 'ProposalVetoed')
          .withArgs(0);

        expect(await voting.vetoedProposals(0)).to.be.true;
      });

      it('Devrait échouer pour une proposition déjà annulée', async function () {
        const { voting, owner } = await loadFixture(deployVotingWithProposalsFixture);

        await voting.connect(owner).vetoProposal(0);

        await expect(voting.connect(owner).vetoProposal(0))
          .to.be.revertedWith('Proposal already vetoed');
      });

      it('Devrait échouer pour un ID de proposition invalide', async function () {
        const { voting, owner } = await loadFixture(deployVotingWithProposalsFixture);

        await expect(voting.connect(owner).vetoProposal(999))
          .to.be.revertedWith('Invalid proposal ID');
      });
    });
  });

  describe('🔒 Contrôle d\'Accès', function () {
    it('Seul le propriétaire peut gérer le workflow', async function () {
      const { voting, voter1 } = await loadFixture(deployVotingWithVotersFixture);

      await expect(voting.connect(voter1).startProposalsRegistration())
        .to.be.revertedWith('Ownable: caller is not the owner');

      await expect(voting.connect(voter1).endProposalsRegistration())
        .to.be.revertedWith('Ownable: caller is not the owner');

      await expect(voting.connect(voter1).startVotingSession())
        .to.be.revertedWith('Ownable: caller is not the owner');

      await expect(voting.connect(voter1).endVotingSession())
        .to.be.revertedWith('Ownable: caller is not the owner');

      await expect(voting.connect(voter1).tallyVotes())
        .to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('📈 Tests d\'Intégration Complète', function () {
    it('Devrait exécuter un processus de vote complet', async function () {
      const { voting, owner, voter1, voter2, voter3 } = await loadFixture(deployVotingFixture);

      // 1. Enregistrer les votants
      await voting.connect(owner).registerVoter(voter1.address);
      await voting.connect(owner).registerVoter(voter2.address);
      await voting.connect(owner).registerVoter(voter3.address);

      // 2. Démarrer l'enregistrement des propositions
      await voting.connect(owner).startProposalsRegistration();

      // 3. Enregistrer des propositions
      await voting.connect(voter1).registerProposal("Améliorer les transports");
      await voting.connect(voter2).registerProposal("Construire un parc");
      await voting.connect(voter3).registerProposal("Rénover l'école");

      // 4. Terminer l'enregistrement des propositions
      await voting.connect(owner).endProposalsRegistration();

      // 5. Démarrer la session de vote
      await voting.connect(owner).startVotingSession();

      // 6. Voter
      await voting.connect(voter1).vote(1); // Parc
      await voting.connect(voter2).vote(1); // Parc
      await voting.connect(voter3).vote(0); // Transports

      // 7. Terminer la session de vote
      await voting.connect(owner).endVotingSession();

      // 8. Comptabiliser les votes
      await voting.connect(owner).tallyVotes();

      // 9. Vérifier les résultats
      expect(await voting.workflowStatus()).to.equal(5); // VotesTallied
      expect(await voting.winningProposalId()).to.equal(1); // Le parc a gagné
      expect(await voting.getWinner()).to.equal("Construire un parc");

      // Vérifier les comptages
      const proposal0 = await voting.proposals(0);
      const proposal1 = await voting.proposals(1);
      const proposal2 = await voting.proposals(2);

      expect(proposal0.voteCount).to.equal(1); // Transports: 1 vote
      expect(proposal1.voteCount).to.equal(2); // Parc: 2 votes
      expect(proposal2.voteCount).to.equal(0); // École: 0 votes
    });
  });
}); 