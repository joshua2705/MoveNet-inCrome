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

const ICONS = {
  green: {16:'icons/icon-green-16.png',48:'icons/icon-green-48.png',128:'icons/icon-green-128.png'},
  red: {16:'icons/icon-red-16.png',48:'icons/icon-red-48.png',128:'icons/icon-red-128.png'}
};

function setPoseIcon(isValid) {
  chrome.action.setIcon({ path: isValid ? ICONS.green : ICONS.red });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'ICON_SET') {
    setPoseIcon(Boolean(message.valid));
  }
});

