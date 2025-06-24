const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Déploiement du contrat Voting...");

  // Déployer le contrat Voting
  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy();
  
  await voting.waitForDeployment();
  
  const address = await voting.getAddress();
  console.log(`✅ Contrat Voting déployé à l'adresse: ${address}`);

  // Sauvegarder l'adresse dans un fichier pour le frontend
  const deploymentInfo = {
    contractAddress: address,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    abi: [
      // ABI minimal pour référence
      "function registerVoter(address _voter) external",
      "function startProposalsRegistration() external",
      "function registerProposal(string calldata _description) external",
      "function endProposalsRegistration() external",
      "function startVotingSession() external",
      "function vote(uint _proposalId) external",
      "function endVotingSession() external",
      "function tallyVotes() external",
      "function getWinner() external view returns (string memory)",
      "function workflowStatus() external view returns (uint8)",
      "function voters(address) external view returns (bool isRegistered, bool hasVoted, uint votedProposalId)",
      "function proposals(uint) external view returns (string memory description, uint voteCount)",
      "function winningProposalId() external view returns (uint)",
      "function owner() external view returns (address)",
      "event VoterRegistered(address voterAddress)",
      "event WorkflowStatusChange(uint8 previousStatus, uint8 newStatus)",
      "event ProposalRegistered(uint proposalId)",
      "event Voted(address voter, uint proposalId)"
    ]
  };

  // Créer le dossier deployments s'il n'existe pas
  const deploymentsDir = "./deployments";
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  // Sauvegarder les informations de déploiement
  fs.writeFileSync(
    `${deploymentsDir}/${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`📄 Informations de déploiement sauvegardées dans ${deploymentsDir}/${hre.network.name}.json`);

  // Mettre à jour la configuration du frontend
  const frontendConfigPath = "../frontend/config/contracts.ts";
  if (fs.existsSync(frontendConfigPath)) {
    let configContent = fs.readFileSync(frontendConfigPath, "utf8");
    
    // Remplacer l'adresse vide par l'adresse déployée
    configContent = configContent.replace(
      /localhost:\s*{\s*voting:\s*['"][^'"]*['"][^}]*}/,
      `localhost: {
    voting: '${address}', // Déployé le ${new Date().toLocaleString()}
  }`
    );

    fs.writeFileSync(frontendConfigPath, configContent);
    console.log("✅ Configuration du frontend mise à jour");
  }

  console.log("\n🎉 Déploiement terminé avec succès!");
  console.log(`📋 Résumé:`);
  console.log(`   - Contrat: ${address}`);
  console.log(`   - Réseau: ${hre.network.name}`);
  console.log(`   - Configuration frontend: mise à jour`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erreur lors du déploiement:", error);
    process.exit(1);
  }); 