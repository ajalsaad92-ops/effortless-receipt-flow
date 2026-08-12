let lastError: unknown = null;

export const captureError = (error: unknown) => {
  lastError = error;
  console.error('Captured error:', error);
};

export const consumeLastCapturedError = () => {
  const error = lastError;
  lastError = null;
  return error;
};
