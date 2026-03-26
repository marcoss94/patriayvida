const SERVER_ACTION_BODY_LIMIT_PATTERN = /body exceeded\s+(.+?)\s+limit/i;

export function getUploadErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.trim();

    if (SERVER_ACTION_BODY_LIMIT_PATTERN.test(message)) {
      const matchedLimit = message.match(SERVER_ACTION_BODY_LIMIT_PATTERN)?.[1]?.trim();
      return matchedLimit
        ? `La imagen supera el limite que acepta el servidor (${matchedLimit}). Proba con un archivo mas liviano.`
        : "La imagen supera el limite que acepta el servidor. Proba con un archivo mas liviano.";
    }

    if (message.length > 0) {
      return message;
    }
  }

  return "No se pudo subir la imagen. Proba de nuevo.";
}
