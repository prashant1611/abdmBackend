import {
  handleGenerateToken,
  handleAddContexts,
  handleDiscover,
  handleInit,
  handleConfirm,
} from "../controllers/webhookHandlers.js";
export async function dispatchByPath(path, body) {
  if (path.includes("on-generate-token")) {
    return await handleGenerateToken(body);
  } else if (path.includes("link/on-add-contexts")) {
    return await handleAddContexts(body);
  } else if (path.includes("care-contexts/discover")) {
    return await handleDiscover(body);
  } else if (path.includes("link/init")) {
    return await handleInit(body);
  } else if (path.includes("link/confirm")) {
    return await handleConfirm(body);
  } else if (path.includes("hip/notify")) {
    return await handleNotify(body);
  } else if (path.includes("hip/request")) {
    return await handleRequest(body);
  } else {
    throw new Error("Unhandled webhook path: " + path);
  }
}
