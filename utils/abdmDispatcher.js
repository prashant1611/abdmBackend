exports.dispatchByPath = async (path, body) => {
  if (path.includes("on-generate-token")) {
    return await handleGenerateToken(body);
  } else if (path.includes("link/on-init")) {
    return await handleLinkInit(body);
  } else if (path.includes("link/on-add-contexts")) {
    return await handleAddContexts(body);
  } else if (path.includes("consents/on-notify")) {
    return await handleConsentNotification(body);
  } else {
    throw new Error("Unhandled webhook path: " + path);
  }
};

// Example handlers
async function handleGenerateToken(data) {
  console.log("Handle: on-generate-token");
  // process token
  return "handleGenerateToken";
}

async function handleLinkInit(data) {
  console.log("Handle: link/on-init");
  // process link init
  return "handleLinkInit";
}

async function handleAddContexts(data) {
  console.log("Handle: link/on-add-contexts");
  // process contexts
  return "handleAddContexts";
}

async function handleConsentNotification(data) {
  console.log("andle: consents/on-notify");
  // process notification
  return "handleConsentNotification";
}
