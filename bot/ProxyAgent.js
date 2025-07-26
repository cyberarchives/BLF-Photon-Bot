import { HttpProxyAgent } from 'http-proxy-agent';

// Original proxy list
const rawProxies = [
  '198.23.239.134:6540:rcmkahhi:11b5t28jdyhl',
  '207.244.217.165:6712:rcmkahhi:11b5t28jdyhl',
  '107.172.163.27:6543:rcmkahhi:11b5t28jdyhl',
  '161.123.152.115:6360:rcmkahhi:11b5t28jdyhl',
  '23.94.138.75:6349:rcmkahhi:11b5t28jdyhl',
  '216.10.27.159:6837:rcmkahhi:11b5t28jdyhl',
  '136.0.207.84:6661:rcmkahhi:11b5t28jdyhl',
  '64.64.118.149:6732:rcmkahhi:11b5t28jdyhl',
  '142.147.128.93:6593:rcmkahhi:11b5t28jdyhl',
  '154.36.110.199:6853:rcmkahhi:11b5t28jdyhl'
];

// Convert to proper proxy URL format
function convertToProxyUrl(rawProxy) {
  const [ip, port, username, password] = rawProxy.split(':');
  return `http://${username}:${password}@${ip}:${port}`;
}

// Get all converted proxy URLs
const proxyUrls = rawProxies.map(convertToProxyUrl);

// Function to get a random proxy URL
function getRandomProxy() {
  const randomIndex = Math.floor(Math.random() * proxyUrls.length);
  return proxyUrls[randomIndex];
}

// Function to create HttpProxyAgent with random proxy
function createRandomProxyAgent() {
  const proxyUrl = getRandomProxy();
  return new HttpProxyAgent(proxyUrl);
}

// Example usage with fetch
async function fetchWithRandomProxy(url, options = {}) {
  const agent = createRandomProxyAgent();
  
  return fetch(url, {
    ...options,
    agent: agent
  });
}

// Export functions
export {
  proxyUrls,
  getRandomProxy,
  createRandomProxyAgent,
  fetchWithRandomProxy
};
