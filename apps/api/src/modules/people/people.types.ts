export type Person = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
};

export type CreatePersonInput = {
  displayName: string;
  email?: string | null;
  phone?: string | null;
};
