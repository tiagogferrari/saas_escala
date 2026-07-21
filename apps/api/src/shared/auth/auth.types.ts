export type AuthenticatedUser = {
  id: string;
  displayName: string;
  email: string;
};

export type UserCredentials = AuthenticatedUser & {
  passwordHash: string | null;
  status: string;
};
