async function setupOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'MoveNet background tracking and 5s photo interval.'
  });
  // Wait for the offscreen document to load
  await new Promise(r => setTimeout(r, 1000));
}

chrome.runtime.onInstalled.addListener(setupOffscreen);
chrome.runtime.onStartup.addListener(setupOffscreen);