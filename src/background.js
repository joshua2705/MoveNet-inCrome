async function setupOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'MoveNet background tracking and 5s photo interval.'
  });
}

chrome.runtime.onInstalled.addListener(setupOffscreen);
chrome.runtime.onStartup.addListener(setupOffscreen);

const ICONS = [
  {16:'icons/icon-green-16.png',48:'icons/icon-green-48.png',128:'icons/icon-green-128.png'},
  {16:'icons/icon-yellow-16.png',48:'icons/icon-yellow-48.png',128:'icons/icon-yellow-128.png'},
  {16:'icons/icon-red-16.png',48:'icons/icon-red-48.png',128:'icons/icon-red-128.png'}
];
let iconIndex = 0;

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'ICON_TICK') {
    iconIndex = (iconIndex + 1) % ICONS.length;
    chrome.action.setIcon({ path: ICONS[iconIndex] });
  }
});
