import { createMiddleware } from "@tanstack/react-start";

export const attachSupabaseAuth = createMiddleware().client(async ({ next }) => {
  return next();
});
