// Wrapper to load ESM module without requiring type="module"
// This gets the script's own URL to find the ESM module
(() => {
  const currentScript = document.currentScript;
  const scriptUrl = currentScript ? currentScript.src : null;

  if (scriptUrl) {
    // Replace wrapper filename with ESM module filename
    const moduleUrl = scriptUrl.replace("pyrepl.js", "pyrepl.esm.js");

    // Dynamically import the ESM module
    import(moduleUrl).catch((err) => {
      console.error("pyrepl-web: Failed to load module:", err);
    });
  } else {
    console.error("pyrepl-web: Could not determine script URL");
  }
})();
