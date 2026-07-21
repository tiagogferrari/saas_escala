export type MemberAccessPerson = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
};

export type MemberAccessToken = {
  token: string;
  expiresAt: string;
  person: MemberAccessPerson;
};

export type MemberAccessErrorCode = "access_token_invalid" | "person_not_found";
