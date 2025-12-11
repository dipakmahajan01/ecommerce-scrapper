async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithDelay(url, times, delayMs) {
  for (let i = 0; i < times; i++) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      console.log(`Fetch #${i + 1}: Status ${response.status}`);
    } catch (err) {
      console.error(`Fetch #${i + 1} failed:`, err);
    }
    if (i < times - 1) {
      await delay(delayMs);
    }
  }
}

fetchWithDelay(
  "https://www.91mobiles.com/realme-c33-price-in-india?ty=specs",
  100,
  10000
);

/**
 * product specs fetch
 *  processor
 *  camera
 *  display
 *  gpu
 *  battery
 *  charging speed
 * normalize
 * sorting implement
 * 
 * 
 */