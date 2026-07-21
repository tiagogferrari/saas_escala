export type Location = {
  id: string;
  name: string;
  address: string | null;
  timezone: string | null;
  createdAt: string;
};

export type CreateLocationInput = {
  name: string;
  address?: string | null;
  timezone?: string | null;
};
