declare global {
  namespace Express {
    interface Locals {
      userId: string;
      user: { id: string; email: string; name: string; avatar: string | null };
    }
  }
}

export {};
