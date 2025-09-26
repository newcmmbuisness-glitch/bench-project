function showLoadingScreen() {
  document.getElementById("loadingScreen").style.display = "flex";
}

function hideLoadingScreen() {
  const loader = document.getElementById("loadingScreen");
  if (loader) loader.style.display = "none";
}

// Beim Start sofort anzeigen
document.addEventListener("DOMContentLoaded", () => {
  showLoadingScreen();
});
