// Tiny module-level holder so the bottom-nav add sheet can preserve the
// user-gesture when opening the camera / file picker, and hand the chosen
// file off to the New Expense screen after navigation.
let pending: File | null = null;

export function setPendingReceipt(file: File) {
  pending = file;
}

export function consumePendingReceipt(): File | null {
  const f = pending;
  pending = null;
  return f;
}