// Configuration des adresses de contrats pour différents environnements
export const CONTRACT_ADDRESSES = {
  // Adresse locale (Hardhat Network)
  localhost: {
    voting: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Déployé le 24/06/2025 21:16:35 - Admin: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  },
  
  // Autres réseaux peuvent être ajoutés ici
  sepolia: {
    voting: '',
  },
};

// Configuration des réseaux
export const NETWORKS = {
  localhost: {
    chainId: 31337,
    name: 'Localhost',
    rpcUrl: 'http://127.0.0.1:8545',
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
  },
};

// Fonction pour obtenir l'adresse du contrat en fonction du réseau
export function getContractAddress(network: keyof typeof CONTRACT_ADDRESSES): string {
  return CONTRACT_ADDRESSES[network]?.voting || '';
} 