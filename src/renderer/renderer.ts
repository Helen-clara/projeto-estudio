// Código TypeScript do processo Renderer (Frontend)
window.addEventListener('DOMContentLoaded', () => {
  const versionsContainer = document.getElementById('versions-container');

  if (window.api && versionsContainer) {
    const versions = window.api.getVersions();
    versionsContainer.textContent = `Node: v${versions.node} | Chrome: v${versions.chrome} | Electron: v${versions.electron}`;
    console.log('Preload API conectada com sucesso:', window.api.ping());
  } else if (versionsContainer) {
    versionsContainer.textContent = 'Modo de visualização independente';
  }
});
