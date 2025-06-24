const hre = require("hardhat");

async function main() {
  console.log("🔧 Configuration de l'admin du contrat Voting...");
  
  // Obtenir les comptes Hardhat
  const [deployer] = await hre.ethers.getSigners();
  console.log(`📍 Compte de déploiement : ${deployer.address}`);
  console.log(`📍 Compte cible (Account 0) : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`);
  
  // Vérifier que c'est bien le même compte
  if (deployer.address.toLowerCase() === "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase()) {
    console.log("✅ Le compte de déploiement correspond déjà à l'Account 0!");
  } else {
    console.log("⚠️  Le compte de déploiement ne correspond pas à l'Account 0");
    console.log("   Redéploiement nécessaire avec le bon compte...");
  }

  // Déployer le contrat avec l'Account 0
  console.log("\n🚀 Déploiement du contrat avec l'Account 0...");
  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy();
  
  await voting.waitForDeployment();
  const address = await voting.getAddress();
  
  console.log(`✅ Contrat déployé à l'adresse: ${address}`);
  
  // Vérifier l'owner
  const owner = await voting.owner();
  console.log(`👑 Owner du contrat: ${owner}`);
  
  if (owner.toLowerCase() === "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase()) {
    console.log("🎉 SUCCESS! L'Account 0 est bien l'admin du contrat!");
  } else {
    console.log("❌ ERREUR: L'admin n'est pas l'Account 0");
  }

  // Mettre à jour la configuration du frontend
  const fs = require("fs");
  const frontendConfigPath = "../frontend/config/contracts.ts";
  if (fs.existsSync(frontendConfigPath)) {
    let configContent = fs.readFileSync(frontendConfigPath, "utf8");
    
    configContent = configContent.replace(
      /localhost:\s*{\s*voting:\s*['"][^'"]*['"][^}]*}/,
      `localhost: {
    voting: '${address}', // Déployé le ${new Date().toLocaleString()} - Admin: ${owner}
  }`
    );

    fs.writeFileSync(frontendConfigPath, configContent);
    console.log("✅ Configuration du frontend mise à jour avec la nouvelle adresse");
  }

  console.log("\n📋 Résumé final:");
  console.log(`   - Contrat: ${address}`);
  console.log(`   - Admin/Owner: ${owner}`);
  console.log(`   - Réseau: ${hre.network.name}`);
  console.log(`   - Account 0 confirmé: ${owner.toLowerCase() === "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase() ? "✅" : "❌"}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erreur:", error);
    process.exit(1);
  }); 